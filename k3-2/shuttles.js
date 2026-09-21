// Four test shuttles, each traveling between one pair of galaxies.
class K3ShuttleSystem {
    constructor(game, galaxies) {
        this.game = game;
        this.shuttles = [];
        this.rideIndex = -1;
        this.followOffset = new THREE.Vector3(0, 6, 22);
        this.status = document.getElementById("ride-status");

        for (let index = 0; index + 1 < galaxies.length; index += 2) {
            const start = galaxies[index + 1];
            const end = galaxies[index];
            this.shuttles.push({
                start,
                end,
                position: start.position.clone().add(end.position).multiplyScalar(0.5),
                direction: end.position.clone().sub(start.position).normalize(),
                target: end,
                wait: 0,
                speed: 40
            });
        }
    }

    createCube() {
        const cube = new THREE.Group();
        const box = new THREE.BoxGeometry(12, 12, 12);
        cube.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(box),
            new THREE.LineBasicMaterial({ color: 0x3399ff })
        ));
        box.dispose();
        // The square is deliberately flat, solid, and visible from either side.
        cube.add(new THREE.Mesh(
            new THREE.PlaneGeometry(5, 5),
            new THREE.MeshBasicMaterial({ color: 0x0066ff, side: THREE.DoubleSide })
        ));
        return cube;
    }

    startRide(index = 0) {
        if (this.shuttles.length === 0) return;
        // Return to the route's coordinate frame before attaching to another cube.
        while (this.game.mode === "inside" && this.game.activeScene.parent) {
            this.game.exit();
        }
        if (this.game.mode === "outside") this.game.enter(this.game.rootScene);
        this.rideIndex = index % this.shuttles.length;
        const shuttle = this.shuttles[this.rideIndex];
        this.followOffset.copy(shuttle.direction).multiplyScalar(-22);
        this.followOffset.y += 6;
        this.game.pitch = 0;
        this.game.yaw = 0;
        this.game.roll = 0;
        this.updateRideCamera(0);
        this.game.updateSceneTransitions();
        this.updateStatus();
    }

    stopRide() {
        if (this.rideIndex < 0) return;
        this.rideIndex = -1;
        // Keep the view direction when handing the camera back to flight controls.
        this.game.pitch = this.game.camera.rotation.x;
        this.game.yaw = this.game.camera.rotation.y;
        this.game.roll = this.game.camera.rotation.z;
        this.updateStatus();
    }

    handleKey(event) {
        if (event.repeat) return;
        if (event.code === "KeyB") {
            if (this.rideIndex < 0) this.startRide();
            else this.stopRide();
        } else if (event.code === "KeyN") {
            this.startRide((this.rideIndex + 1) % this.shuttles.length);
        } else if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyC"].includes(event.code)) {
            this.stopRide();
        }
    }

    update(delta) {
        for (const shuttle of this.shuttles) {
            if (shuttle.wait > 0) {
                shuttle.wait = Math.max(0, shuttle.wait - delta);
                continue;
            }
            const remaining = shuttle.position.distanceTo(shuttle.target.position);
            const step = shuttle.speed * delta;
            if (remaining <= step) {
                shuttle.position.copy(shuttle.target.position);
                shuttle.target = shuttle.target === shuttle.end ? shuttle.start : shuttle.end;
                shuttle.direction.copy(shuttle.target.position).sub(shuttle.position).normalize();
                shuttle.wait = 3;
            } else {
                shuttle.position.addScaledVector(shuttle.direction, step);
            }
        }
        if (this.rideIndex >= 0) this.updateRideCamera(delta);
        this.updateStatus();
    }

    toActivePosition(position) {
        const local = position.clone();
        const path = [];
        for (let node = this.game.activeScene; node && node.parent; node = node.parent) {
            path.unshift(node);
        }
        for (const node of path) {
            local.sub(node.position).multiplyScalar(node.insideSize / node.size);
        }
        return local;
    }

    updateRideCamera(delta) {
        const shuttle = this.shuttles[this.rideIndex];
        const desiredOffset = shuttle.direction.clone().multiplyScalar(-22);
        desiredOffset.y += 6;
        // Ease the chase camera around the cube when it reverses.
        this.followOffset.lerp(desiredOffset, 1 - Math.exp(-2 * delta));
        this.game.camera.position.copy(this.toActivePosition(
            shuttle.position.clone().add(this.followOffset)
        ));
        this.game.camera.lookAt(this.toActivePosition(shuttle.position));
        // Mouse look remains available while riding.
        this.game.camera.rotateY(this.game.yaw);
        this.game.camera.rotateX(this.game.pitch);
        this.game.camera.rotateZ(this.game.roll);
    }

    syncLayers() {
        for (const layer of this.game.layers) {
            if (!layer.shuttleObjects) {
                layer.shuttleObjects = this.shuttles.map(() => {
                    const cube = this.createCube();
                    layer.scene.add(cube);
                    return cube;
                });
            }
            this.shuttles.forEach((shuttle, index) => {
                const cube = layer.shuttleObjects[index];
                // A moving cube belongs to the galaxy it is in, or to the universe.
                const owner = [shuttle.start, shuttle.end].find(galaxy =>
                    shuttle.position.distanceTo(galaxy.position) <= galaxy.size
                ) || this.game.rootScene;
                // If that galaxy is still a closed sphere, keep its cube in the
                // universe layer. Otherwise move it into the galaxy's local layer.
                const ownerIsOpen = this.game.layers.some(entry => entry.node === owner);
                const renderOwner = ownerIsOpen ? owner : this.game.rootScene;
                cube.visible = this.game.mode === "inside" && layer.node === renderOwner;
                if (!cube.visible) return;
                const scale = renderOwner === this.game.rootScene ? 1 : owner.insideSize / owner.size;
                cube.position.copy(shuttle.position);
                if (renderOwner !== this.game.rootScene) cube.position.sub(owner.position);
                cube.position.multiplyScalar(scale);
                cube.scale.setScalar(scale);
            });
        }
    }

    updateStatus() {
        if (!this.status) return;
        const shuttle = this.shuttles[this.rideIndex];
        this.status.textContent = shuttle
            ? "Riding cube " + (this.rideIndex + 1) + " · " + this.game.activeScene.name +
                (shuttle.wait > 0 ? " · Turning around" : " · Heading to " + shuttle.target.name)
            : "Free flight · " + this.game.activeScene.name;
    }
}
