class K3Game {

    constructor() {

        // --------------------------------------------------
        // MOVEMENT
        // --------------------------------------------------

        this.moveSpeed = 50;

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

            this.enter(child);

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

            // Increase speed
            if (event.code === "KeyF") {

                this.moveSpeed *= 2;

                console.log(
                    "Speed:",
                    this.moveSpeed
                );
            }

            // Decrease speed
            if (event.code === "KeyR") {

                this.moveSpeed /= 2;

                console.log(
                    "Speed:",
                    this.moveSpeed
                );
            }

        });


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
            this.camera.position.sub(scene.position)
                .multiplyScalar(scene.insideSize / scene.size);
        } else if (this.mode === "outside" && this.activeScene === scene) {
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
            this.camera.position.multiplyScalar(
                this.activeScene.size / this.activeScene.insideSize
            ).add(this.activeScene.position);

            this.enter(parent);

        } else {

            this.camera.position.multiplyScalar(
                this.activeScene.size / this.activeScene.insideSize
            );

            this.showOutside(
                this.activeScene
            );

        }

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

    renderLayers() {
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


    animate() {

        requestAnimationFrame(
            () => this.animate()
        );


        const delta =
            Math.min(this.clock.getDelta(), 0.05);


        this.updateControls(
            delta
        );


        // Move logical objects before checking their current collision positions.
        this.updateSceneAnimation(delta);
        if (this.shuttleSystem) this.shuttleSystem.update(delta);

        // Check scene boundaries
        this.updateSceneTransitions();


        this.renderLayers();

    }

}
