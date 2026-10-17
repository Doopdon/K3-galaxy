class K3Game {

    constructor() {

        // --------------------------------------------------
        // MOVEMENT
        // --------------------------------------------------

        this.moveSpeed = 50;
        this.timeScale = 1;
        this.showCollisionWireframes = false;

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
                0.0001, // Keep close detail without an unnecessarily tiny near plane.
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

        this.createStarBackground();


        // --------------------------------------------------
        // RENDERER
        // --------------------------------------------------

        this.renderer =
            new THREE.WebGLRenderer({
                antialias: true,
                logarithmicDepthBuffer: true
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

    createStarBackground() {
        this.starScene = new THREE.Scene();
        this.starCamera = this.camera.clone();
        this.starCamera.position.set(0, 0, 0);
        this.starCamera.near = 0.1;
        this.starCamera.far = 2000;
        for (const [count, size] of [[2200, 1], [300, 2]]) {
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            for (let index = 0; index < count; index++) {
                const y = Math.random() * 2 - 1;
                const angle = Math.random() * Math.PI * 2;
                const ring = Math.sqrt(1 - y * y);
                positions[index * 3] = Math.cos(angle) * ring * 1000;
                positions[index * 3 + 1] = y * 1000;
                positions[index * 3 + 2] = Math.sin(angle) * ring * 1000;
                colors.fill(0.35 + Math.random() * 0.65, index * 3, index * 3 + 3);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            this.starScene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
                size, sizeAttenuation: false, vertexColors: true, depthWrite: false
            })));
        }
    }

    renderStarBackground() {
        if (!this.starScene) return;
        const outerCamera = this.layers.length ? this.layers[0].camera : this.camera;
        this.starCamera.rotation.copy(outerCamera.rotation);
        if (this.mode === "inside" && this.rootScene) {
            this.applyCameraFrame(this.starCamera, this.rootScene);
        }
        // Ignore translation and scale: these stars remain at infinity.
        this.starCamera.aspect = this.camera.aspect;
        this.starCamera.fov = this.camera.fov;
        this.starCamera.updateProjectionMatrix();
        this.renderer.render(this.starScene, this.starCamera);
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

            if (
                this.activeScene.containsInsidePosition(
                    this.activeScene.parentToLocal(this.camera.position.clone(), true)
                )
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

        this.adjustingFov = false;
        window.addEventListener("mousedown", (event) => {
            if (event.button === 1) {
                event.preventDefault();
                this.adjustingFov = true;
            }
        });
        window.addEventListener("mouseup", (event) => {
            if (event.button === 1) this.adjustingFov = false;
        });
        window.addEventListener("keydown", (event) => {

            this.keys[event.code] = true;
            if (event.code === "KeyH" && !event.repeat) this.toggleCollisionWireframes();
            if (event.code === "KeyU" && !event.repeat) {
                const help = document.getElementById("ride-help");
                if (help) help.hidden = !help.hidden;
            }
            if (this.shuttleSystem) this.shuttleSystem.handleKey(event);
            if (event.code === "Space") {
                event.preventDefault();
                if (!event.repeat) this.resetFlightSpeed();
            }

        });

        this.renderer.domElement.addEventListener("wheel", (event) => {
            event.preventDefault();
            if (event.deltaY === 0) return;
            this.adjustSpeed(event.deltaY < 0 ? 1.1 : 1 / 1.1);
        }, { passive: false });

        window.addEventListener("keyup", (event) => {

            this.keys[event.code] = false;

        });

        window.addEventListener("blur", () => {
            this.keys = {};
            this.adjustingFov = false;
        });


        // Click screen to capture mouse
        this.renderer.domElement.addEventListener(
            "click",
            () => {

                this.renderer.domElement.requestPointerLock();

            }
        );


        window.addEventListener("mousemove", (event) => {

            if (this.adjustingFov) {
                this.camera.fov = Math.max(15, Math.min(110, this.camera.fov + event.movementY * 0.15));
                this.camera.updateProjectionMatrix();
                return;
            }

            if (
                document.pointerLockElement !==
                this.renderer.domElement
            ) {
                return;
            }


            this.applyMouseLook(event.movementX, event.movementY);

        });

    }

    applyMouseLook(movementX, movementY) {
        // Mouse look keeps one north reference. Only explicit roll (or a scene
        // boundary/frame rotation) changes that reference.
        if (this.roll !== 0) this.rollLookFrame(0);
        this.yaw -= movementX * this.mouseSensitivity;
        const limit = Math.PI / 2 - 0.01;
        this.pitch = Math.max(-limit, Math.min(limit,
            this.pitch - movementY * this.mouseSensitivity));
    }

    rollLookFrame(angle) {
        const total = angle + this.roll;
        if (total === 0) return;
        const look = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")
        );
        const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), total);
        if (!this.controlFrame) this.controlFrame = new THREE.Quaternion();
        // Tilt the north reference around the current view direction, while
        // preserving heading and pitch in the newly rolled frame.
        this.controlFrame.multiply(look).multiply(turn).multiply(look.invert()).normalize();
        this.roll = 0;
    }

    toggleCollisionWireframes() {
        this.showCollisionWireframes = this.showCollisionWireframes === false;
        const status = document.getElementById("collision-wireframes-status");
        if (status) status.textContent = this.showCollisionWireframes ? "on" : "off";
    }

    adjustTimeScale(factor) {
        if (!Number.isFinite(factor) || factor <= 0) return;
        this.timeScale = Math.max(0.000001, Math.min(100, this.timeScale * factor));
        if (this.shuttleSystem) this.shuttleSystem.updateStatus();
    }

    updateAnimationSpeed(delta) {
        const direction = Number(!!this.keys.KeyF) - Number(!!this.keys.KeyR);
        // One second held changes time by 10x, independent of key repeat/FPS.
        if (direction) this.adjustTimeScale(Math.pow(10, direction * delta));
    }

    resetFlightSpeed() {
        const scene = this.activeScene;
        if (!scene) return;
        this.moveSpeed = this.mode === "inside"
            ? (scene.flightSpeed ?? scene.insideSize * 0.01)
            : scene.size * 0.01;
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

        this.updateAnimationSpeed(delta);
        this.refreshNearbySceneChildren();
        const movementStart = this.camera.position.clone();

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

        if (this.keys["KeyX"]) {

            this.camera.translateY(
                speed
            );

        }


        if (this.keys["KeyC"]) {

            this.camera.translateY(
                -speed
            );

        }


        // Stop at the first crossed child boundary rather than stepping over
        // its entire interior in one flight frame. Continue flying next frame
        // in the newly entered scene's local units.
        this.enterCrossedChild(movementStart);

        // ----------------------------------------------
        // ROLL
        // ----------------------------------------------

        const rollSpeed =
            1.5 * delta;


        if (this.keys["KeyQ"]) {

            this.rollLookFrame(rollSpeed);

        }


        if (this.keys["KeyE"]) {

            this.rollLookFrame(-rollSpeed);

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
        if (this.controlFrame) {
            this.camera.quaternion.premultiply(this.controlFrame);
        }

    }



    openInterior(scene, excludedChild = null) {
        if (!this.openInteriors) this.openInteriors = new Map();
        // All entry paths share this ownership table. A second caller must not
        // create or attach another copy, even in a different render layer.
        if (this.openInteriors.has(scene)) return null;
        this.openInteriors.set(scene, null);
        try {
            const inside = scene.createInside(excludedChild);
            this.openInteriors.set(scene, inside);
            return inside;
        } catch (error) {
            this.openInteriors.delete(scene);
            throw error;
        }
    }

    clearWorld() {

        // These representations are generated afresh for each transition.
        for (const layer of this.layers) {
            layer.scene.traverse((object) => {
                if (object.isInstancedMesh) object.dispose();
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material : [object.material];
                    for (const material of materials) material.dispose();
                }
            });
            // Detach disposed interiors before releasing their ownership.
            while (layer.scene.children.length) layer.scene.remove(layer.scene.children[0]);
        }
        this.layers = [];
        if (this.openInteriors) this.openInteriors.clear();

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

        const path = [];
        for (let node = scene; node; node = node.parent) path.unshift(node);
        // An occupied ship can change parents, which requires rebuilding its
        // path. Otherwise an already active interior cannot be entered again.
        if (this.mode === "inside" && this.activeScene === scene &&
            this.layers.length === path.length &&
            this.layers.every((layer, index) => layer.node === path[index])) return;

        // Convert only across the immediate boundary; never build a global scale.
        if (this.mode === "inside" && scene.parent === this.activeScene) {
            this.moveSpeed *= scene.insideSize / scene.size;
            scene.parentToLocal(this.camera.position);
            this.rotateCameraFrame(scene, true);
        } else if (this.mode === "outside" && this.activeScene === scene) {
            this.moveSpeed *= scene.insideSize / scene.size;
            scene.parentToLocal(this.camera.position, true);
            this.rotateCameraFrame(scene, true);
        }

        this.clearWorld();

        for (let index = 0; index < path.length; index++) {
            const node = path[index];
            const renderScene = new THREE.Scene();
            const inside = this.openInterior(node, path[index + 1]);
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
            this.activeScene.localToParent(this.camera.position);
            this.rotateCameraFrame(this.activeScene);

            this.enter(parent);

        } else {

            this.moveSpeed *= this.activeScene.size / this.activeScene.insideSize;
            this.activeScene.localToParent(this.camera.position, true);
            this.rotateCameraFrame(this.activeScene);

            this.showOutside(
                this.activeScene
            );

        }

    }



    applyCameraFrame(camera, scene, inverse = false) {
        camera.rotation.order = "YXZ";
        if (scene.pitch === 0 && scene.roll === 0) {
            camera.rotation.y += inverse ? -scene.rotation : scene.rotation;
        } else {
            const orientation = scene.frameQuaternion();
            if (inverse) orientation.invert();
            camera.quaternion.premultiply(orientation);
        }
    }

    rotateCameraFrame(scene, inverse = false) {
        // Keep all boundary rotations out of the Euler angles used by input.
        // The view is frame * user look, rather than
        // an Euler decomposition of the combined orientation.
        if (!this.controlFrame && (scene.rotation !== 0 || scene.pitch !== 0 || scene.roll !== 0)) {
            this.pitch = this.camera.rotation.x;
            this.yaw = this.camera.rotation.y;
            this.roll = this.camera.rotation.z;
            this.controlFrame = new THREE.Quaternion();
        }
        this.applyCameraFrame(this.camera, scene, inverse);
        if (this.controlFrame) {
            const look = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(this.pitch, this.yaw, this.roll, "YXZ")
            );
            this.controlFrame.copy(this.camera.quaternion).multiply(look.invert());
            return;
        }
        this.pitch = this.camera.rotation.x;
        this.yaw = this.camera.rotation.y;
        this.roll = this.camera.rotation.z;
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

    enterCrossedChild(start) {
        if (this.mode !== "inside" || !this.activeScene) return;
        const end = this.camera.position.clone();
        const candidates = this.activeScene.children.map(node => ({ node, start, end }));
        const branch = this.activeScene;
        if (branch.parent) {
            const parentStart = branch.localToParent(start.clone());
            const parentEnd = branch.localToParent(end.clone());
            for (const sibling of branch.parent.children) {
                if (sibling === branch || !sibling.revealOnOverlap ||
                    !sibling.containsPosition(parentStart)) continue;
                const peerStart = sibling.parentToLocal(parentStart.clone());
                const peerEnd = sibling.parentToLocal(parentEnd.clone());
                for (const node of sibling.children) candidates.push({ node, start: peerStart, end: peerEnd });
            }
        }
        let first = null, fraction = Infinity;
        if (!branch.containsInsidePosition(end)) {
            const reverseEntry = branch.movementEntry(branch.localToParent(end.clone()),
                branch.localToParent(start.clone()));
            if (reverseEntry !== null) fraction = 1 - reverseEntry;
        }
        for (const candidate of candidates) {
            const entry = candidate.node.movementEntry(candidate.start, candidate.end);
            if (entry !== null && entry < fraction) {
                first = candidate.node;
                fraction = entry;
            }
        }
        if (!first) return;
        // Move a tiny fraction of this child's radius inward, independent of
        // the length of the flight step (which can span many tiny scenes).
        const parentPoint = start.clone().add(end.clone().sub(start).multiplyScalar(fraction));
        const displacement = end.clone().sub(start);
        const step = Math.min(1 - fraction, first.size * 1e-6 / (displacement.length() || 1));
        parentPoint.add(displacement.multiplyScalar(step));
        this.camera.position.copy(parentPoint);
        this.enterVisibleScene(first);
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

            if (child.containsPosition(position)) {

                return child;

            }

        }

        // Check children of overlapping peers at the current movement depth.
        // Once inside a planet, keep that frame until exiting it; switching to
        // another containing planet at the same depth would cause oscillation.
        const parentPosition = position.clone();
        const branch = this.activeScene;
        if (branch.parent) {
            branch.localToParent(parentPosition);
            for (const sibling of branch.parent.children) {
                if (sibling === branch || !sibling.revealOnOverlap || !sibling.containsPosition(parentPosition)) continue;
                const local = sibling.parentToLocal(parentPosition.clone());
                for (const child of sibling.children) {
                    if (child.containsPosition(local)) return child;
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
        if (this.galaxyEffects) this.galaxyEffects.resize(window.innerWidth, window.innerHeight);

    }

    updateSceneAnimation(delta) {
        if (!this.rootScene) return;

        const pending = [this.rootScene];
        const fullTurn = Math.PI * 2;
        while (pending.length > 0) {
            const node = pending.pop();
            node.rotation = (node.rotation + node.rotationSpeed * delta) % fullTurn;
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
            if (node.onUpdate) node.onUpdate(node, delta);
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
            if (index > 0) node.localToParent(position);
        }

        for (let index = 0; index + 1 < this.layers.length; index++) {
            const parentLayer = this.layers[index];
            const foreground = this.layers[index + 1];
            const anchor = foreground.node;
            const parentPosition = positions.get(parentLayer.node);
            if (!foreground.overlapInteriors) foreground.overlapInteriors = new Map();
            const visible = new Set();

            for (const sibling of parentLayer.node.children) {
                if (sibling === anchor || !sibling.revealOnOverlap || !sibling.containsPosition(parentPosition)) continue;
                visible.add(sibling);
                let inside = foreground.overlapInteriors.get(sibling);
                if (!inside) {
                    inside = this.openInterior(sibling);
                    if (!inside) continue;
                    foreground.overlapInteriors.set(sibling, inside);
                    foreground.scene.add(inside);
                }
                // Put sibling interiors in the SAME scene and coordinate frame as
                // the active interior, so a single depth buffer orders their planets.
                const parentToAnchor = anchor.insideSize / anchor.size;
                anchor.parentToLocal(inside.position.copy(sibling.position));
                if (anchor.pitch || anchor.roll || sibling.pitch || sibling.roll) {
                    inside.quaternion.copy(anchor.frameQuaternion().invert().multiply(sibling.frameQuaternion()));
                } else {
                    inside.rotation.y = sibling.rotation - anchor.rotation;
                }
                inside.scale.setScalar(parentToAnchor * sibling.size / sibling.insideSize);
            }

            for (const [sibling, inside] of foreground.overlapInteriors) {
                if (visible.has(sibling)) continue;
                foreground.scene.remove(inside);
                inside.traverse(object => {
                    if (object.isInstancedMesh) object.dispose();
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        const materials = Array.isArray(object.material) ? object.material : [object.material];
                        for (const material of materials) material.dispose();
                    }
                });
                foreground.overlapInteriors.delete(sibling);
                if (this.openInteriors.get(sibling) === inside) this.openInteriors.delete(sibling);
            }

            // The display handles individual objects and compacted batch slots.
            parentLayer.scene.children[0].userData.k3Display.hidden = visible;
        }
    }

    refreshNearbySceneChildren() {
        // Let procedural scenes choose nearby logical children in their own
        // units, including ancestors while a moving child is occupied.
        if (this.mode === "inside") {
            const positions = new Map();
            const local = this.camera.position.clone();
            for (let index = this.layers.length - 1; index >= 0; index--) {
                const node = this.layers[index].node;
                positions.set(node, local.clone());
                if (node.refreshNearbyChildren) node.refreshNearbyChildren(local, this.simulationTime || 0);
                if (index > 0) node.localToParent(local);
            }
            // Overlapping interiors are just as visible and collidable as the
            // active branch. Query them in their own units instead of disabling
            // their procedural children until the movement frame is entered.
            for (const [node] of this.openInteriors || []) {
                if (positions.has(node) || !node.refreshNearbyChildren) continue;
                const parentPosition = positions.get(node.parent);
                const position = parentPosition ? node.parentToLocal(parentPosition.clone()) : null;
                node.refreshNearbyChildren(position, this.simulationTime || 0);
            }
        }
    }

    renderLayers() {
        this.syncOverlappingInteriors();
        this.refreshNearbySceneChildren();
        if (!this.shuttleSystem) {
            const status = document.getElementById("ride-status");
            if (status && this.activeScene) {
                status.textContent = this.activeScene.name + " | Speed: " +
                    this.moveSpeed.toPrecision(4) + " | Time: " + this.timeScale.toPrecision(3) + "x";
            }
        }
        if (this.shuttleSystem) this.shuttleSystem.syncLayers();
        for (const layer of this.layers) {
            layer.scene.traverse((object) => {
                if (object.userData.k3Display) object.userData.k3Display.update(this.simulationTime || 0);
                if (object.userData.k3DisplayManaged) return;
                const node = object.userData.k3Scene;
                if (!node) return;
                node.applyOutsideRotation(object);
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
                const childLayer = this.layers[index + 1];
                layer.camera.rotation.copy(childLayer.camera.rotation);
                this.applyCameraFrame(layer.camera, childLayer.node);
                layer.camera.aspect = this.camera.aspect;
                layer.camera.fov = this.camera.fov;
                layer.camera.updateProjectionMatrix();
            }
            if (index > 0) {
                layer.node.localToParent(position);
            }
        }

        // Keep the galactic ancestor glowing, then overlay closer layers with
        // their own depth buffers and normal exposure, outside postprocessing.
        if (this.mode === "inside" && this.layers[0].node === this.rootScene &&
            typeof K3GalaxyEffects !== "undefined" && K3_COLORS.galaxyEffects.enabled) {
            if (!this.galaxyEffects) this.galaxyEffects = new K3GalaxyEffects(this);
            if (this.galaxyEffects.render()) {
                this.renderLayerStack(1, this.layers.length, false);
                return;
            }
        }
        this.renderLayerStack();
    }

    renderLayerStack(start = 0, end = this.layers.length, clear = true) {
        if (clear) {
            this.renderer.clear();
            this.renderStarBackground();
        }
        // Ancestors first; clear only depth so local objects draw on top.
        for (let index = start; index < end; index++) {
            const layer = this.layers[index];
            this.renderer.clearDepth();
            this.renderer.render(layer.scene, layer.camera);
        }
    }


    updateSimulation(delta) {
        // Small simulation steps keep boundary crossings reliable at fast time.
        let remaining = delta * this.timeScale;
        while (remaining > 0) {
            const step = Math.min(remaining, 0.05);
            this.simulationTime = (this.simulationTime || 0) + step;
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
