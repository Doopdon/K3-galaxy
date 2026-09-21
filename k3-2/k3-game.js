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

        this.threeScene.background =
            new THREE.Color(0x000000);


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



    load(rootScene) {

        this.rootScene = rootScene;

        rootScene.bind(this);

    }

    setupControls() {

        window.addEventListener("keydown", (event) => {

            this.keys[event.code] = true;

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

        console.log(
            "Showing outside of",
            scene.name
        );

    }



    enter(scene) {

        this.clearWorld();

        const inside =
            scene.createInside();

        this.worldRoot.add(
            inside
        );

        this.activeScene = scene;

        this.mode = "inside";

        console.log(
            "Entered",
            scene.name
        );

    }



    exit() {

        if (!this.activeScene) {
            return;
        }

        const parent =
            this.activeScene.parent;

        if (parent) {

            this.enter(parent);

        } else {

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



    animate() {

        requestAnimationFrame(
            () => this.animate()
        );


        const delta =
            this.clock.getDelta();


        this.updateControls(
            delta
        );


        this.renderer.render(
            this.threeScene,
            this.camera
        );

    }

}