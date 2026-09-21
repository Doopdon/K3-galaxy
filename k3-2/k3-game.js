class K3Game {

    constructor() {

        // --------------------------------------------------
        // MOVEMENT
        // --------------------------------------------------

        this.moveSpeed = 50;
        this.timeScale = 1;

        this.keys = {};

        this.pitch = 0;
        this.yaw = 0;
        this.roll = 0;

        this.mouseSensitivity = 0.002;

        this.clock = new THREE.Clock();


        // --------------------------------------------------
        // THREE.JS SCENE
        // --------------------------------------------------

        this.threeScene = new THREE.Scene();

        // Each logical level gets a separate render layer with no background.
        this.layers = [];


        // --------------------------------------------------
        // CAMERA
        // --------------------------------------------------

        this.camera =
            new THREE.PerspectiveCamera(
                60,
                window.innerWidth / window.innerHeight,
                0.1,
                100000
            );

        this.camera.position.set(
            0,
            0,
            300
        );

        this.camera.lookAt(
            0,
            0,
            0
        );


        // --------------------------------------------------
        // RENDERER
        // --------------------------------------------------

        this.renderer =
            new THREE.WebGLRenderer({
                antialias: true
            });

        this.renderer.autoClear = false;
        this.renderer.setClearColor(0x000000);

        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        this.renderer.setPixelRatio(
            window.devicePixelRatio
        );

        document.body.appendChild(
            this.renderer.domElement
        );


        // --------------------------------------------------
        // CONTROLS
        // Renderer now exists!
        // --------------------------------------------------

        this.setupControls();


        // --------------------------------------------------
        // CURRENT WORLD
        // --------------------------------------------------

        this.worldRoot =
            new THREE.Group();

        this.threeScene.add(
            this.worldRoot
        );

        this.activeScene = null;
        this.rootScene = null;
        this.mode = "outside";


        // --------------------------------------------------
        // WINDOW RESIZE
        // --------------------------------------------------

        window.addEventListener(
            "resize",
            () => this.onResize()
        );


        // --------------------------------------------------
        // START
        // --------------------------------------------------

        this.animate();
    }

    updateSceneTransitions() {

        if (!this.activeScene) {
            return;
        }


        // --------------------------------------------------
        // OUTSIDE A SCENE
        //
        // If we cross its boundary, enter it.
        // --------------------------------------------------

        if (this.mode === "outside") {

            const distance =
                this.camera.position.length();

            if (
                distance <=
                this.activeScene.getSize()
            ) {

                console.log(
                    "Crossed boundary of",
                    this.activeScene.name
                );

                this.enter(
                    this.activeScene
                );

            }

            return;
        }


        // --------------------------------------------------
        // INSIDE A SCENE
        //
        // Leave this scene before checking its immediate children.
        // --------------------------------------------------

        if (!this.activeScene.containsInsidePosition(this.camera.position)) {
            this.exit();
            // Crossing out of one sphere can leave us inside an overlapping one.
            const next = this.checkChildCollision(this.camera.position);
            if (next) this.enterVisibleScene(next);
            return;
        }

        const child =
            this.checkChildCollision(
                this.camera.position
            );


        if (child) {

            console.log(
                "Entered child:",
                child.name
            );

            this.enterVisibleScene(child);

        }

    }



    load(rootScene) {

        this.rootScene = rootScene;

        rootScene.bind(this);

    }

    setupControls() {

        window.addEventListener("keydown", (event) => {

            this.keys[event.code] = true;
            if (this.shuttleSystem) this.shuttleSystem.handleKey(event);
            // Key repeat applies more steps while F or R is held down.
            if (event.code === "KeyF") this.adjustTimeScale(1.1);
            if (event.code === "KeyR") this.adjustTimeScale(1 / 1.1);

        });

        this.renderer.domElement.addEventListener("wheel", (event) => {
            event.preventDefault();
            if (event.deltaY === 0) return;
            this.adjustSpeed(event.deltaY < 0 ? 1.1 : 1 / 1.1);
        }, { passive: false });

        window.addEventListener("keyup", (event) => {

            this.keys[event.code] = false;

        });


        // Click screen to capture mouse
        this.renderer.domElement.addEventListener(
            "click",
            () => {

                this.renderer.domElement.requestPointerLock();

            }
        );


        window.addEventListener("mousemove", (event) => {

            if (
                document.pointerLockElement !==
                this.renderer.domElement
            ) {
                return;
            }


            this.yaw -=
                event.movementX *
                this.mouseSensitivity;


            this.pitch -=
                event.movementY *
                this.mouseSensitivity;


            // Stop camera from flipping vertically
            const limit =
                Math.PI / 2 - 0.01;

            this.pitch = Math.max(
                -limit,
                Math.min(
                    limit,
                    this.pitch
                )
            );

        });

    }

    adjustTimeScale(factor) {
        this.timeScale = Math.max(0.01, Math.min(100, this.timeScale * factor));
        if (this.shuttleSystem) this.shuttleSystem.updateStatus();
    }

    adjustSpeed(factor) {
        const nextSpeed = this.moveSpeed * factor;
        if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) return;
        this.moveSpeed = nextSpeed;
        const system = this.shuttleSystem;
        if (system && system.rideIndex >= 0) {
            system.shuttles[system.rideIndex].speed *= factor;
        }
        if (system) system.updateStatus();
    }

    updateControls(delta) {

        let speed =
            this.moveSpeed *
            delta;


        // Hold shift = turbo
        if (
            this.keys["ShiftLeft"] ||
            this.keys["ShiftRight"]
        ) {

            speed *= 5;

        }


        // ----------------------------------------------
        // FORWARD / BACK
        // ----------------------------------------------

        if (this.keys["KeyW"]) {

            this.camera.translateZ(
                -speed
            );

        }


        if (this.keys["KeyS"]) {

            this.camera.translateZ(
                speed
            );

        }


        // ----------------------------------------------
        // LEFT / RIGHT
        // ----------------------------------------------

        if (this.keys["KeyA"]) {

            this.camera.translateX(
                -speed
            );

        }


        if (this.keys["KeyD"]) {

            this.camera.translateX(
                speed
            );

        }


        // ----------------------------------------------
        // UP / DOWN
        // ----------------------------------------------

        if (this.keys["Space"]) {

            this.camera.translateY(
                speed
            );

        }


        if (this.keys["KeyC"]) {

            this.camera.translateY(
                -speed
            );

        }


        // ----------------------------------------------
        // ROLL
        // ----------------------------------------------

        const rollSpeed =
            1.5 * delta;


        if (this.keys["KeyQ"]) {

            this.roll += rollSpeed;

        }


        if (this.keys["KeyE"]) {

            this.roll -= rollSpeed;

        }


        // ----------------------------------------------
        // CAMERA ROTATION
        // ----------------------------------------------

        this.camera.rotation.order =
            "YXZ";


        this.camera.rotation.set(
            this.pitch,
            this.yaw,
            this.roll
        );

    }



    clearWorld() {

        // These representations are generated afresh for each transition.
        for (const layer of this.layers) {
            layer.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material : [object.material];
                    for (const material of materials) material.dispose();
                }
            });
        }
        this.layers = [];

        while (
            this.worldRoot.children.length > 0
        ) {

            this.worldRoot.remove(
                this.worldRoot.children[0]
            );

        }

    }



    showOutside(scene) {

        this.clearWorld();

        const outside =
            scene.createOutside();

        outside.position.set(
            0,
            0,
            0
        );

        this.worldRoot.add(
            outside
        );

        this.activeScene = scene;

        this.mode = "outside";

        this.layers = [{ node: scene, scene: this.threeScene, camera: this.camera }];

        console.log(
            "Showing outside of",
            scene.name
        );

    }



    enter(scene) {

        // Convert only across the immediate boundary; never build a global scale.
        if (this.mode === "inside" && scene.parent === this.activeScene) {
            this.moveSpeed *= scene.insideSize / scene.size;
            this.camera.position.sub(scene.position)
                .multiplyScalar(scene.insideSize / scene.size);
        } else if (this.mode === "outside" && this.activeScene === scene) {
            this.moveSpeed *= scene.insideSize / scene.size;
            this.camera.position.multiplyScalar(scene.insideSize / scene.size);
        }

        this.clearWorld();

        const path = [];
        for (let node = scene; node; node = node.parent) path.unshift(node);

        for (let index = 0; index < path.length; index++) {
            const node = path[index];
            const renderScene = new THREE.Scene();
            const inside = node.createInside(path[index + 1]);
            renderScene.add(inside);
            this.layers.push({
                node,
                scene: renderScene,
                camera: index === path.length - 1 ? this.camera : this.camera.clone()
            });
        }
        this.threeScene = this.layers[this.layers.length - 1].scene;
        this.worldRoot = this.threeScene.children[0];

        this.activeScene = scene;

        this.mode = "inside";

        console.log(
            "Entered",
            scene.name
        );

    }



    exit() {

        if (!this.activeScene || this.mode !== "inside") {
            return;
        }

        const parent =
            this.activeScene.parent;

        if (parent) {

            // Restore the camera's position in the parent's coordinates.
            this.moveSpeed *= this.activeScene.size / this.activeScene.insideSize;
            this.camera.position.multiplyScalar(
                this.activeScene.size / this.activeScene.insideSize
            ).add(this.activeScene.position);

            this.enter(parent);

        } else {

            this.moveSpeed *= this.activeScene.size / this.activeScene.insideSize;
            this.camera.position.multiplyScalar(
                this.activeScene.size / this.activeScene.insideSize
            );

            this.showOutside(
                this.activeScene
            );

        }

    }



    enterVisibleScene(scene) {
        // Change coordinate frames through the common ancestor. A visible planet
        // may belong to an overlapping sibling rather than the movement scene.
        const path = [];
        for (let node = scene; node; node = node.parent) path.unshift(node);
        while (!path.includes(this.activeScene)) this.exit();
        const start = path.indexOf(this.activeScene) + 1;
        for (let index = start; index < path.length; index++) this.enter(path[index]);
    }

    checkChildCollision(position) {

        if (
            !this.activeScene ||
            this.mode !== "inside"
        ) {
            return null;
        }


        if (this.shuttleSystem) {
            const shuttle = this.shuttleSystem.checkCollision(position);
            if (shuttle) return shuttle;
        }

        for (
            const child
            of this.activeScene.children
        ) {

            const distance =
                position.distanceTo(
                    child.position
                );

            if (
                distance <= child.getSize()
            ) {

                return child;

            }

        }

        // Check children of overlapping peers at the current movement depth.
        // Once inside a planet, keep that frame until exiting it; switching to
        // another containing planet at the same depth would cause oscillation.
        const parentPosition = position.clone();
        const branch = this.activeScene;
        if (branch.parent) {
            parentPosition.multiplyScalar(branch.size / branch.insideSize).add(branch.position);
            for (const sibling of branch.parent.children) {
                if (sibling === branch || parentPosition.distanceTo(sibling.position) > sibling.size) continue;
                const local = parentPosition.clone().sub(sibling.position)
                    .multiplyScalar(sibling.insideSize / sibling.size);
                for (const child of sibling.children) {
                    if (local.distanceTo(child.position) <= child.size) return child;
                }
            }
        }

        return null;
    }



    onResize() {

        this.camera.aspect =
            window.innerWidth /
            window.innerHeight;

        this.camera.updateProjectionMatrix();


        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }

    updateSceneAnimation(delta) {
        if (!this.rootScene) return;

        const pending = [this.rootScene];
        const fullTurn = Math.PI * 2;
        while (pending.length > 0) {
            const node = pending.pop();
            node.spinAngle = (node.spinAngle + node.spinSpeed * delta) % fullTurn;
            node.childrenOrbitAngle =
                (node.childrenOrbitAngle + node.childrenOrbitSpeed * delta) % fullTurn;

            if (node.childrenOrbitSpeed !== 0) {
                const cosine = Math.cos(node.childrenOrbitAngle);
                const sine = Math.sin(node.childrenOrbitAngle);
                for (const child of node.children) {
                    const start = child.orbitPosition;
                    // Rotate the whole arrangement together, without accumulating drift.
                    // The logical position also drives collisions and parent camera mapping.
                    child.position.set(
                        start.x * cosine + start.z * sine,
                        start.y,
                        -start.x * sine + start.z * cosine
                    );
                }
            }
            pending.push(...node.children);
        }
    }

    syncOverlappingInteriors() {
        if (this.mode !== "inside") return;
        const positions = new Map();
        const position = this.camera.position.clone();
        for (let index = this.layers.length - 1; index >= 0; index--) {
            const node = this.layers[index].node;
            positions.set(node, position.clone());
            if (index > 0) position.multiplyScalar(node.size / node.insideSize).add(node.position);
        }

        for (let index = 0; index + 1 < this.layers.length; index++) {
            const parentLayer = this.layers[index];
            const foreground = this.layers[index + 1];
            const anchor = foreground.node;
            const parentPosition = positions.get(parentLayer.node);
            if (!foreground.overlapInteriors) foreground.overlapInteriors = new Map();
            const visible = new Set();

            for (const sibling of parentLayer.node.children) {
                if (sibling === anchor || parentPosition.distanceTo(sibling.position) > sibling.size) continue;
                visible.add(sibling);
                let inside = foreground.overlapInteriors.get(sibling);
                if (!inside) {
                    inside = sibling.createInside();
                    foreground.overlapInteriors.set(sibling, inside);
                    foreground.scene.add(inside);
                }
                // Put sibling interiors in the SAME scene and coordinate frame as
                // the active interior, so a single depth buffer orders their planets.
                const parentToAnchor = anchor.insideSize / anchor.size;
                inside.position.copy(sibling.position).sub(anchor.position).multiplyScalar(parentToAnchor);
                inside.scale.setScalar(parentToAnchor * sibling.size / sibling.insideSize);
            }

            for (const [sibling, inside] of foreground.overlapInteriors) {
                if (visible.has(sibling)) continue;
                foreground.scene.remove(inside);
                inside.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        const materials = Array.isArray(object.material) ? object.material : [object.material];
                        for (const material of materials) material.dispose();
                    }
                });
                foreground.overlapInteriors.delete(sibling);
            }

            // Only the parent's own child shells are affected, not nested models.
            for (const object of parentLayer.scene.children[0].children) {
                const node = object.userData.k3Scene;
                if (node && node.parent === parentLayer.node) object.visible = !visible.has(node);
            }
        }
    }

    renderLayers() {
        this.syncOverlappingInteriors();
        if (!this.shuttleSystem) {
            const status = document.getElementById("ride-status");
            if (status && this.activeScene) {
                status.textContent = this.activeScene.name + " | Speed: " +
                    this.moveSpeed.toPrecision(4) + " | Time: " + this.timeScale.toFixed(2) + "x";
            }
        }
        if (this.shuttleSystem) this.shuttleSystem.syncLayers();
        for (const layer of this.layers) {
            layer.scene.traverse((object) => {
                const node = object.userData.k3Scene;
                if (!node) return;
                object.rotation.y = node.spinAngle;
                if (this.mode === "inside") object.position.copy(node.position);
            });
        }

        // Map the active camera back through each parent's local coordinates.
        // Distant layers may lose tiny movements, but active geometry stays local.
        const position = this.camera.position.clone();
        for (let index = this.layers.length - 1; index >= 0; index--) {
            const layer = this.layers[index];
            if (layer.camera !== this.camera) {
                layer.camera.position.copy(position);
                layer.camera.quaternion.copy(this.camera.quaternion);
                layer.camera.aspect = this.camera.aspect;
                layer.camera.fov = this.camera.fov;
                layer.camera.updateProjectionMatrix();
            }
            if (index > 0) {
                position.multiplyScalar(layer.node.size / layer.node.insideSize)
                    .add(layer.node.position);
            }
        }

        this.renderer.clear();
        // Ancestors first; clear only depth so local objects draw on top.
        for (const layer of this.layers) {
            this.renderer.clearDepth();
            this.renderer.render(layer.scene, layer.camera);
        }
    }


    updateSimulation(delta) {
        // Small simulation steps keep boundary crossings reliable at fast time.
        let remaining = delta * this.timeScale;
        while (remaining > 0) {
            const step = Math.min(remaining, 0.05);
            this.updateSceneAnimation(step);
            if (this.shuttleSystem) this.shuttleSystem.update(step);
            this.updateSceneTransitions();
            remaining = Math.max(0, remaining - step);
        }
    }

    animate() {

        requestAnimationFrame(
            () => this.animate()
        );


        const delta =
            Math.min(this.clock.getDelta(), 0.05);


        this.updateControls(
            delta
        );


        // Flight controls use real time; moving objects use simulation time.
        this.updateSimulation(delta);


        this.renderLayers();

    }

}
