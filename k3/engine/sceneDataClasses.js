class SpatialHashGrid {

    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    getKey(position) {

        const x = Math.floor(position.x / this.cellSize);
        const y = Math.floor(position.y / this.cellSize);
        const z = Math.floor(position.z / this.cellSize);

        return `${x},${y},${z}`;
    }

    add(object, position) {

        const key = this.getKey(position);

        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }

        this.cells.get(key).push(object);
    }

    getNearby(position) {

        const cx = Math.floor(position.x / this.cellSize);
        const cy = Math.floor(position.y / this.cellSize);
        const cz = Math.floor(position.z / this.cellSize);

        const results = [];

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {

                    const key =
                        `${cx + x},${cy + y},${cz + z}`;

                    const cell =
                        this.cells.get(key);

                    if (cell) {
                        results.push(...cell);
                    }
                }
            }
        }

        return results;
    }
}

class SceneData {

    constructor({
        scale,
        timescale = 1,
        disapearDistance = 1,
        childScenes = [],
        collisionEnterDistance = 0.01,
        getSubSceneData,
        populateScene,
        animate
    }) {

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.05,
            7000
        );

        this.camera.rotation.order = "YXZ";
        this.camera.position.z = 5;


        // Scene properties
        this.scale = scale;
        this.timescale = timescale;
        this.speedMultiplier = 1;

        this.disapearDistance = disapearDistance;
        this.childScenes = childScenes;


        // Only these objects can be entered
        this.colliders = [];


        // Current thing we're riding
        this.activeCollider = null;
        this.activeSubScene = null;

        this.parentCollider = null;
        this.parentSceneData = null;


        // Previous transform of collider
        this.lastColliderPosition = new THREE.Vector3();
        this.lastColliderQuaternion = new THREE.Quaternion();


        // User supplied behavior
        this.populateSceneFunction = populateScene;
        this.animateFunction = animate;

        if (getSubSceneData) {
            this.getSubSceneData = getSubSceneData;
        }

        this.rootGroup = new THREE.Group();
        this.scene.add(this.rootGroup);
    }

    addCollider(object) {

        this.colliders.push(object);

        return object;
    }

    updateParentLock() {

        if (!this.parentCollider) return;

        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();

        this.parentCollider.getWorldPosition(position);
        this.parentCollider.getWorldQuaternion(quaternion);

        position.multiplyScalar(
            this.parentSceneData.scale / this.scale
        );

        this.rootGroup.position.copy(position);
        this.rootGroup.quaternion.copy(quaternion);
    }

    getColliderLocalQuaternion(collider) {

        const colliderWorld = new THREE.Quaternion();
        const rootWorld = new THREE.Quaternion();

        collider.getWorldQuaternion(colliderWorld);
        this.rootGroup.getWorldQuaternion(rootWorld);

        return rootWorld
            .invert()
            .multiply(colliderWorld);
    }

    populateScene() {

        this.colliders = [];

        // Clear old child content
        this.rootGroup.clear();

        // Rebuild the scene contents locally around rootGroup
        this.populateSceneFunction?.call(this);
    }

    update(deltaTime) {

        this.updateParentLock();

        const scaledDelta =
            deltaTime * this.speedMultiplier;

        this.animateFunction?.call(
            this,
            scaledDelta
        );

        this.scene.updateMatrixWorld(true);

        this.updateCameraLock();
    }

    getColliders() {
        return this.colliders;
    }

    getColliderDistance(collider) {

        const cameraWorld =
            new THREE.Vector3();

        this.camera.getWorldPosition(
            cameraWorld
        );


        // --------------------------------
        // POINT COLLIDER
        // --------------------------------

        if (
            collider.userData
                ?.collisionType === "point"
        ) {

            const colliderWorld =
                new THREE.Vector3();

            collider.getWorldPosition(
                colliderWorld
            );


            return cameraWorld.distanceTo(
                colliderWorld
            );
        }


        // --------------------------------
        // NO GEOMETRY FALLBACK
        // --------------------------------

        if (!collider.geometry) {

            const colliderWorld =
                new THREE.Vector3();

            collider.getWorldPosition(
                colliderWorld
            );


            return cameraWorld.distanceTo(
                colliderWorld
            );
        }


        // --------------------------------
        // GEOMETRY COLLIDER
        // --------------------------------

        if (
            !collider.geometry.boundingBox
        ) {

            collider.geometry
                .computeBoundingBox();
        }


        // Camera in collider-local space.
        const cameraLocal =
            collider.worldToLocal(
                cameraWorld.clone()
            );


        // Closest point on the box.
        const closestLocal =
            cameraLocal.clone()
                .clamp(
                    collider.geometry
                        .boundingBox.min,

                    collider.geometry
                        .boundingBox.max
                );


        // Convert closest point back to world.
        const closestWorld =
            collider.localToWorld(
                closestLocal
            );


        return cameraWorld.distanceTo(
            closestWorld
        );
    }

    isCameraInsideCollider(collider) {

        if (!collider.geometry) {
            return false;
        }


        if (
            !collider.geometry.boundingBox
        ) {

            collider.geometry
                .computeBoundingBox();
        }


        const cameraWorld =
            new THREE.Vector3();

        this.camera.getWorldPosition(
            cameraWorld
        );


        // Transform the camera into the
        // collider's local coordinate system.
        const cameraLocal =
            collider.worldToLocal(
                cameraWorld.clone()
            );


        return collider.geometry
            .boundingBox
            .containsPoint(
                cameraLocal
            );
    }

    checkCollision() {

        this.scene.updateMatrixWorld(true);


        // --------------------------------
        // ALREADY INSIDE SOMETHING
        // --------------------------------

        if (this.activeCollider) {

            const distance =
                this.getColliderDistance(
                    this.activeCollider
                );


            if (
                distance >
                this.disapearDistance
            ) {

                this.leaveCollider();
            }

            return;
        }


        // --------------------------------
        // LOOK FOR COLLIDERS
        // --------------------------------

        const cameraWorld =
            new THREE.Vector3();

        this.camera.getWorldPosition(
            cameraWorld
        );


        let bestCollider =
            null;

        let bestCenterDistance =
            Infinity;


        for (
            const collider
            of this.getColliders()
        ) {

            const isPoint =
                collider.userData
                    ?.collisionType === "point";


            let collided;


            // Point objects:
            // stars, mirrors, pyramids, etc.
            if (isPoint) {

                collided =
                    this.getColliderDistance(
                        collider
                    ) <
                    this.disapearDistance;
            }


            // Physical objects:
            // box colliders.
            else {

                collided =
                    this.isCameraInsideCollider(
                        collider
                    );
            }


            if (!collided) {
                continue;
            }


            // Multiple colliders may overlap.
            // Pick the nearest one.
            const center =
                new THREE.Vector3();

            collider.getWorldPosition(
                center
            );


            const centerDistance =
                cameraWorld.distanceTo(
                    center
                );


            if (
                centerDistance <
                bestCenterDistance
            ) {

                bestCollider =
                    collider;

                bestCenterDistance =
                    centerDistance;
            }
        }


        // --------------------------------
        // ENTER WINNER
        // --------------------------------

        if (bestCollider) {

            const position =
                new THREE.Vector3();

            bestCollider.getWorldPosition(
                position
            );


            this.enterCollider(
                bestCollider,
                position
            );
        }
    }

    enterCollider(collider, worldPosition) {
        // any extra functionality to call when enetering an object.
        this.onColide?.(collider, worldPosition)

        const subScene = this.getSubSceneData(collider);


        // Always lock to the collider
        this.activeCollider = collider;
        this.activeSubScene = subScene ?? null;


        // Remember its current transform for camera locking
        collider.getWorldPosition(
            this.lastColliderPosition
        );

        // Convert from world position into this scene's local frame
        this.rootGroup.worldToLocal(
            this.lastColliderPosition
        );

        this.lastColliderQuaternion.copy(
            this.getColliderLocalQuaternion(collider)
        );


        // No deeper scene:
        // stay locked to the object, but don't change the stack
        if (!subScene) {
            return;
        }


        // Tell the child scene what object/frame it belongs to
        subScene.parentCollider = collider;
        subScene.parentSceneData = this;


        // Hide parent object because we've descended inside it
        collider.visible = false;


        // Position child scene root at the collider
        subScene.updateParentLock();
        subScene.populateScene();

        // subScene.alignCameraUp();


        // Add child to active hierarchy
        const index =
            activeSceneStack.indexOf(this);

        activeSceneStack.splice(index + 1);

        activeSceneStack.push(subScene);




        updateTimeScales();
    }

    leaveCollider() {
        if (!this.activeCollider) return;


        this.activeSubScene?.remove();

        this.activeCollider.visible = true;

        this.activeCollider = null;
        this.activeSubScene = null;


        const index =
            activeSceneStack.indexOf(this);

        activeSceneStack.splice(index + 1);


        updateTimeScales();

        // this.alignCameraUp()
    }

    updateCameraLock() {

        if (!this.activeCollider) return;

        const mainCamera = scenesData[0].camera;


        // ----------------------
        // COLLIDER LOCAL POSITION
        // ----------------------

        const newPosition = new THREE.Vector3();

        this.activeCollider.getWorldPosition(
            newPosition
        );

        this.rootGroup.worldToLocal(
            newPosition
        );


        // ----------------------
        // COLLIDER LOCAL ROTATION
        // ----------------------

        const newQuaternion =
            this.getColliderLocalQuaternion(
                this.activeCollider
            );


        // ----------------------
        // TRANSLATION CHANGE
        // ----------------------

        const movement = newPosition
            .clone()
            .sub(this.lastColliderPosition);


        // Movement is currently in rootGroup coordinates.
        // Convert its direction back into world coordinates.

        const rootQuaternion =
            new THREE.Quaternion();

        this.rootGroup.getWorldQuaternion(
            rootQuaternion
        );

        movement.applyQuaternion(
            rootQuaternion
        );


        movement.multiplyScalar(
            this.scale / scenesData[0].scale
        );


        mainCamera.position.add(
            movement
        );


        // ----------------------
        // ROTATION CHANGE
        // ----------------------

        const rotationChange =
            newQuaternion
                .clone()
                .multiply(
                    this.lastColliderQuaternion
                        .clone()
                        .invert()
                );


        // rotationChange is local to rootGroup.
        // Convert it into world-space rotation.

        const rootInverse =
            rootQuaternion
                .clone()
                .invert();

        const worldRotationChange =
            rootQuaternion
                .clone()
                .multiply(rotationChange)
                .multiply(rootInverse);


        // ----------------------
        // ROTATE CAMERA POSITION
        // AROUND THE COLLIDER
        // ----------------------

        const colliderWorldPosition =
            new THREE.Vector3();

        this.activeCollider.getWorldPosition(
            colliderWorldPosition
        );

        colliderWorldPosition.multiplyScalar(
            this.scale / scenesData[0].scale
        );


        const cameraOffset =
            mainCamera.position
                .clone()
                .sub(colliderWorldPosition);


        cameraOffset.applyQuaternion(
            worldRotationChange
        );


        mainCamera.position
            .copy(colliderWorldPosition)
            .add(cameraOffset);


        // Rotate where camera is looking too
        mainCamera.quaternion.premultiply(
            worldRotationChange
        );


        // ----------------------
        // SAVE FOR NEXT FRAME
        // ----------------------

        this.lastColliderPosition.copy(
            newPosition
        );

        this.lastColliderQuaternion.copy(
            newQuaternion
        );
    }

    getSubSceneData(collider) {
        return this.childScenes[0];
    }

    remove() {

        this.activeSubScene?.remove();

        this.rootGroup.clear();

        this.colliders = [];

        this.activeCollider = null;
        this.activeSubScene = null;

        this.parentCollider = null;
        this.parentSceneData = null;
    }

}

class HabSceneData extends SceneData {

    constructor(options) {
        super(options);
    }

}

class GalaxySceneData extends SceneData {
    constructor(options) {
        super(options);
    }
    buildCollisionGrid(
        collisionFrame,
        cellSize = this.disapearDistance * 2
    ) {

        this.collisionFrame = collisionFrame;

        this.collisionGrid =
            new SpatialHashGrid(cellSize);

        this.scene.updateMatrixWorld(true);

        for (const collider of this.colliders) {

            const position = new THREE.Vector3();

            collider.getWorldPosition(position);

            collisionFrame.worldToLocal(position);

            this.collisionGrid.add(
                collider,
                position
            );
        }
    }

    getColliders() {
        return this.getNearbyColliders();
    }

    getNearbyColliders() {

        // Small scene / no grid
        if (!this.collisionGrid) {
            return this.colliders;
        }

        const cameraPosition =
            this.camera.position.clone();

        // Camera and collisionFrame exist in same scene,
        // so convert camera to the grid's local coordinates.
        this.collisionFrame.worldToLocal(
            cameraPosition
        );

        return this.collisionGrid.getNearby(
            cameraPosition
        );
    }
}
