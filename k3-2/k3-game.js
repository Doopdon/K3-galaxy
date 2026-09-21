class K3Game {

    constructor() {

        // --------------------------------------------------
        // THREE.JS SCENE
        // --------------------------------------------------

        this.threeScene = new THREE.Scene();

        this.threeScene.background = new THREE.Color(0x000000);


        // --------------------------------------------------
        // CAMERA
        // --------------------------------------------------

        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100000
        );

        // Main scene sphere is radius 100,
        // so put the camera far enough away to see it.
        this.camera.position.set(0, 0, 300);

        this.camera.lookAt(0, 0, 0);


        // --------------------------------------------------
        // RENDERER
        // --------------------------------------------------

        this.renderer = new THREE.WebGLRenderer({
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
        // CURRENT WORLD
        // --------------------------------------------------

        this.worldRoot = new THREE.Group();

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
        // START RENDER LOOP
        // --------------------------------------------------

        this.animate();
    }



    load(rootScene) {

        this.rootScene = rootScene;

        rootScene.bind(this);

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


        this.renderer.render(
            this.threeScene,
            this.camera
        );

    }

}