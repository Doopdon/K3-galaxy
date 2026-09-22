class K3Scene {
    constructor({
        name = "Unnamed Scene",
        info = "",
        size = 1,
        insideSize = size,
        position = [0, 0, 0],
        rotation = 0,
        pitch = 0,
        roll = 0,
        boundary = null,
        revealOnOverlap = true,
        rotationSpeed = 0,
        spinSpeed = 0,
        childrenOrbitSpeed = 0,
        onUpdate = null,

        makeOutside = null,
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
        this.pitch = pitch;
        this.roll = roll;
        // Box half-extents are in parent units; size/insideSize still define
        // the uniform unit conversion, independently of the boundary shape.
        this.boundary = boundary || { type: "sphere" };
        this.revealOnOverlap = revealOnOverlap;
        this.rotationSpeed = rotationSpeed;
        // Angular speeds are radians per second around the local Y axis.
        this.spinSpeed = spinSpeed;
        this.childrenOrbitSpeed = childrenOrbitSpeed;
        this.onUpdate = onUpdate;
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
        this.rotateFramePosition(position, true);
        return position.multiplyScalar(this.insideSize / this.size);
    }

    localToParent(position, centered = false) {
        position.multiplyScalar(this.size / this.insideSize);
        this.rotateFramePosition(position);
        if (!centered) position.add(this.position);
        return position;
    }

    containsInsidePosition(position) {
        if (this.boundary.type === "box") {
            const scale = this.insideSize / this.size;
            const half = this.boundary.halfExtents;
            return Math.abs(position.x) <= half[0] * scale &&
                Math.abs(position.y) <= half[1] * scale &&
                Math.abs(position.z) <= half[2] * scale;
        }
        return position.length() <= this.insideSize;
    }

    rotateFramePosition(position, inverse = false, visualSpin = 0) {
        const rotateX = angle => {
            const y = position.y, z = position.z;
            position.y = y * Math.cos(angle) - z * Math.sin(angle);
            position.z = y * Math.sin(angle) + z * Math.cos(angle);
        };
        const rotateZ = angle => {
            const x = position.x, y = position.y;
            position.x = x * Math.cos(angle) - y * Math.sin(angle);
            position.y = x * Math.sin(angle) + y * Math.cos(angle);
        };
        if (inverse) {
            this.rotatePosition(position, -this.rotation - visualSpin);
            rotateX(-this.pitch);
            rotateZ(-this.roll);
        } else {
            rotateZ(this.roll);
            rotateX(this.pitch);
            this.rotatePosition(position, this.rotation + visualSpin);
        }
        return position;
    }

    frameQuaternion() {
        return new THREE.Quaternion().setFromEuler(
            new THREE.Euler(this.pitch, this.rotation, this.roll, "YXZ")
        );
    }

    applyOutsideRotation(object) {
        object.rotation.order = "YXZ";
        object.rotation.x = this.pitch;
        object.rotation.y = this.rotation + this.spinAngle;
        object.rotation.z = this.roll;
    }

    describeOutside() {
        if (this.makeOutside) {
            return this.makeOutside(this);
        } else {
            if (this.boundary.type === "box") {
                return { type: "box", halfExtents: this.boundary.halfExtents,
                    color: 0xffffff, wireframe: true };
            }
            return { type: "sphere", radius: this.size, color: 0xffffff,
                widthSegments: 16, heightSegments: 16, wireframe: true };
        }
    }

    containsPosition(position) {
        if (this.boundary.type === "box") return this.containsInsidePosition(this.parentToLocal(position.clone()));
        return position.distanceTo(this.position) <= this.size;
    }

    createOutside() {
        const appearance = this.describeOutside();
        // Preserve existing Object3D callbacks, including their resource ownership.
        if (!appearance || typeof appearance.traverse !== "function") {
            return K3Display.create([{ node: this, appearance }], true);
        }
        const object = appearance;

        object.userData.k3Scene = this;
        this.applyOutsideRotation(object);

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

        // Every child uses the same description-to-display path.
        new K3Display(root, this.children
            .filter(child => child !== excludedChild)
            .map(child => ({ node: child, appearance: child.describeOutside() })));

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
