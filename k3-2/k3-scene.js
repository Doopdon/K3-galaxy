class K3Scene {
    constructor({
        name = "Unnamed Scene",
        info = "",
        size = 1,
        position = [0, 0, 0],

        // Creates what this scene looks like from OUTSIDE.
        makeOutside = null,

        // Creates background/environment geometry seen while INSIDE.
        makeInside = null,

        children = []
    } = {}) {

        this.name = name;
        this.info = info;

        // Size/position are in the PARENT'S coordinate system.
        this.size = size;

        this.position = new THREE.Vector3(
            position[0],
            position[1],
            position[2]
        );

        this.makeOutside = makeOutside;
        this.makeInside = makeInside;

        this.children = [];
        this.parent = null;

        this.game = null;

        for (const child of children) {
            this.add(child);
        }
    }

    add(child) {
        child.parent = this;
        this.children.push(child);

        if (this.game) {
            child.bind(this.game);
        }

        return child;
    }

    bind(game) {
        this.game = game;

        for (const child of this.children) {
            child.bind(game);
        }
    }

    getSize() {
        return this.size;
    }

    createOutside() {

        let object;

        if (this.makeOutside) {
            object = this.makeOutside(this);
        } else {
            // Default placeholder
            object = new THREE.Mesh(
                new THREE.SphereGeometry(this.size, 16, 16),
                new THREE.MeshBasicMaterial({
                    wireframe: true
                })
            );
        }

        object.userData.k3Scene = this;

        return object;
    }

    createInside() {

        const root = new THREE.Group();

        root.name = `${this.name}_inside`;

        // Add environmental/background geometry
        if (this.makeInside) {
            const environment = this.makeInside(this);

            if (environment) {
                root.add(environment);
            }
        }

        // Add OUTSIDE representations of children
        for (const child of this.children) {

            const outside = child.createOutside();

            outside.position.copy(child.position);

            root.add(outside);
        }

        return root;
    }

    // Show this object from the outside.
    show() {
        this.game.showOutside(this);
    }

    // Enter this level and reveal its children.
    enter() {
        this.game.enter(this);
    }

    exit() {
        this.game.exit();
    }

    hide() {
        this.game.clearWorld();
    }
}