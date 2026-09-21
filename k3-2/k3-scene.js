class K3Scene {
    constructor({
        name = "Unnamed Scene",
        info = "",
        size = 1,
        insideSize = size,
        position = [0, 0, 0],
        rotation = 0,
        rotationSpeed = 0,
        spinSpeed = 0,
        childrenOrbitSpeed = 0,

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
        // Interior units are independent of the radius seen by the parent.
        this.insideSize = insideSize;

        this.position = new THREE.Vector3(
            position[0],
            position[1],
            position[2]
        );
        this.orbitPosition = this.position.clone();
        // Scene-frame yaw in radians, independent of visual spin and child orbits.
        this.rotation = rotation;
        this.rotationSpeed = rotationSpeed;
        // Angular speeds are radians per second around the local Y axis.
        this.spinSpeed = spinSpeed;
        this.childrenOrbitSpeed = childrenOrbitSpeed;
        this.spinAngle = 0;
        this.childrenOrbitAngle = 0;

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

    rotatePosition(position, angle) {
        const x = position.x;
        const z = position.z;
        position.x = x * Math.cos(angle) + z * Math.sin(angle);
        position.z = -x * Math.sin(angle) + z * Math.cos(angle);
        return position;
    }

    parentToLocal(position, centered = false) {
        if (!centered) position.sub(this.position);
        this.rotatePosition(position, -this.rotation);
        return position.multiplyScalar(this.insideSize / this.size);
    }

    localToParent(position, centered = false) {
        position.multiplyScalar(this.size / this.insideSize);
        this.rotatePosition(position, this.rotation);
        if (!centered) position.add(this.position);
        return position;
    }

    containsInsidePosition(position) {
        return position.length() <= this.insideSize;
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
        object.rotation.y = this.rotation + this.spinAngle;

        return object;
    }

    createInside(excludedChild = null) {

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

            if (child === excludedChild) continue;

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
