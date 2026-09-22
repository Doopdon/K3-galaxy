// Turns visual descriptions into batched Three.js objects. No scene-type checks.
class K3Display {
    constructor(root, entries, centered = false) {
        this.root = root;
        this.centered = centered;
        this.hidden = new Set();
        this.batches = [];
        this.custom = [];
        const groups = new Map();
        for (const entry of entries) {
            const appearance = entry.appearance;
            if (appearance && typeof appearance.traverse === "function") {
                const object = appearance;
                object.userData.k3Scene = entry.node;
                object.userData.k3DisplayManaged = true;
                root.add(object);
                this.custom.push({ node: entry.node, object });
                continue;
            }
            const style = K3Display.style(appearance);
            const key = JSON.stringify(style);
            if (!groups.has(key)) groups.set(key, { style, entries: [] });
            groups.get(key).entries.push(entry);
        }
        for (const batch of groups.values()) {
            this.build(batch);
            this.batches.push(batch);
            root.add(batch.object);
        }
        root.userData.k3Display = this;
        this.update();
    }

    static style(description) {
        if (!description || !["sphere", "point", "lines"].includes(description.type)) {
            throw new Error("Outside appearance must be an Object3D or a sphere, point, or lines description.");
        }
        const style = {
            type: description.type,
            opacity: description.opacity ?? 1,
            transparent: description.transparent ?? false,
            depthTest: description.depthTest ?? true,
            depthWrite: description.depthWrite ?? true
        };
        if (style.type === "sphere") {
            style.widthSegments = description.widthSegments ?? 16;
            style.heightSegments = description.heightSegments ?? 12;
            style.wireframe = description.wireframe ?? false;
        } else if (style.type === "point") {
            style.size = description.size ?? 3;
            style.sizeAttenuation = description.sizeAttenuation ?? false;
        } else {
            style.linewidth = description.linewidth ?? 1;
            if (!description.positions || description.positions.length % 6 !== 0) {
                throw new Error("Line positions must contain pairs of XYZ endpoints.");
            }
        }
        return style;
    }

    static create(entries, centered = false) {
        const root = new THREE.Group();
        new K3Display(root, entries, centered);
        return root;
    }

    build(batch) {
        const style = batch.style;
        const materialOptions = {
            opacity: style.opacity, transparent: style.transparent,
            depthTest: style.depthTest, depthWrite: style.depthWrite
        };
        if (style.type === "sphere") {
            const geometry = new THREE.SphereGeometry(1, style.widthSegments, style.heightSegments);
            const material = new THREE.MeshBasicMaterial({ ...materialOptions, wireframe: style.wireframe });
            batch.object = new THREE.InstancedMesh(geometry, material, batch.entries.length);
            batch.transform = new THREE.Object3D();
            batch.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        } else {
            const count = batch.entries.reduce((sum, entry) => sum +
                (style.type === "point" ? 1 : entry.appearance.positions.length / 3), 0);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
            geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
            geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
            geometry.attributes.color.setUsage(THREE.DynamicDrawUsage);
            if (style.type === "point") {
                batch.object = new THREE.Points(geometry, new THREE.PointsMaterial({
                    ...materialOptions, vertexColors: true, size: style.size,
                    sizeAttenuation: style.sizeAttenuation
                }));
            } else {
                batch.object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
                    ...materialOptions, vertexColors: true, linewidth: style.linewidth
                }));
            }
        }
        // Dynamic instances may move outside their original bounds in Three r128.
        batch.object.frustumCulled = false;
        batch.object.userData.k3Scenes = [];
        batch.color = new THREE.Color();
        batch.states = batch.entries.map(() => ({}));
    }

    needsUpdate(batch) {
        let changed = false;
        batch.entries.forEach(({ node, appearance }, index) => {
            const state = batch.states[index];
            const x = !this.centered && node ? node.position.x : 0;
            const y = !this.centered && node ? node.position.y : 0;
            const z = !this.centered && node ? node.position.z : 0;
            const angle = node ? node.rotation + node.spinAngle : 0;
            const visible = !this.hidden.has(node);
            const radius = appearance.radius ?? (node ? node.size : 1);
            const color = appearance.color ?? 0xffffff;
            if (state.x !== x || state.y !== y || state.z !== z || state.angle !== angle ||
                state.visible !== visible || state.radius !== radius || state.color !== color) changed = true;
            Object.assign(state, { x, y, z, angle, visible, radius, color });
        });
        return changed;
    }

    update() {
        for (const { node, object } of this.custom) {
            object.visible = !this.hidden.has(node);
            if (node) {
                if (!this.centered) object.position.copy(node.position);
                object.rotation.y = node.rotation + node.spinAngle;
            }
        }
        for (const batch of this.batches) {
            // Parent-frame motion changes only the containing group. Do not
            // regenerate/upload thousands of unchanged local positions each frame.
            if (!this.needsUpdate(batch)) continue;
            const object = batch.object;
            const nodes = object.userData.k3Scenes;
            nodes.length = 0;
            let count = 0;
            for (const { node, appearance } of batch.entries) {
                if (this.hidden.has(node)) continue;
                const position = !this.centered && node ? node.position : { x: 0, y: 0, z: 0 };
                const angle = node ? node.rotation + node.spinAngle : 0;
                batch.color.set(appearance.color ?? 0xffffff);
                if (batch.style.type === "sphere") {
                    const transform = batch.transform;
                    transform.position.copy(position);
                    transform.rotation.y = angle;
                    transform.scale.setScalar(appearance.radius ?? (node ? node.size : 1));
                    transform.updateMatrix();
                    object.setMatrixAt(count, transform.matrix);
                    object.setColorAt(count, batch.color);
                    nodes.push(node);
                    count++;
                } else {
                    const positions = object.geometry.attributes.position.array;
                    const colors = object.geometry.attributes.color.array;
                    const local = batch.style.type === "point" ? [0, 0, 0] : appearance.positions;
                    const cosine = Math.cos(angle);
                    const sine = Math.sin(angle);
                    for (let index = 0; index < local.length; index += 3) {
                        const offset = count * 3;
                        positions[offset] = position.x + local[index] * cosine + local[index + 2] * sine;
                        positions[offset + 1] = position.y + local[index + 1];
                        positions[offset + 2] = position.z - local[index] * sine + local[index + 2] * cosine;
                        colors[offset] = batch.color.r;
                        colors[offset + 1] = batch.color.g;
                        colors[offset + 2] = batch.color.b;
                        nodes.push(node);
                        count++;
                    }
                }
            }
            object.visible = count > 0;
            if (batch.style.type === "sphere") {
                object.count = count;
                object.instanceMatrix.needsUpdate = true;
                if (object.instanceColor) object.instanceColor.needsUpdate = true;
            } else {
                object.geometry.setDrawRange(0, count);
                object.geometry.attributes.position.needsUpdate = true;
                object.geometry.attributes.color.needsUpdate = true;
            }
        }
    }
}
