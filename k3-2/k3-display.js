// Turns visual descriptions into batched Three.js objects. No scene-type checks.
class K3Display {
    constructor(root, entries, centered = false) {
        this.root = root;
        this.centered = centered;
        this.hidden = new Set();
        this.batches = [];
        this.custom = [];
        const groups = new Map();
        for (const entry of K3Display.flatten(entries)) {
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

    static flatten(entries) {
        const flat = [];
        for (const entry of entries) {
            if (entry.appearance && entry.appearance.type === "group") {
                flat.push(...K3Display.flatten(entry.appearance.parts.map(appearance => ({ node: entry.node, appearance }))));
            } else flat.push(entry);
        }
        return flat;
    }

    static vertexCapacity(appearance) {
        if (appearance.type === "point") return 1;
        if (appearance.type === "dashes") {
            const period = (appearance.dashSize ?? 4) + (appearance.gapSize ?? 4);
            if (!(period > 0) || !(appearance.length >= 0)) throw new Error("Invalid dashed-line dimensions");
            return (Math.ceil(appearance.length / period) + 2) * 2;
        }
        return appearance.positions.length / 3;
    }

    static style(description) {
        if (!description || !["sphere", "box", "point", "lines", "dashes"].includes(description.type)) {
            throw new Error("Unsupported outside appearance description.");
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
        } else if (style.type === "box") {
            style.wireframe = description.wireframe ?? false;
        } else if (style.type === "point") {
            style.size = description.size ?? 3;
            style.sizeAttenuation = description.sizeAttenuation ?? false;
        } else {
            style.linewidth = description.linewidth ?? 1;
            if (style.type === "lines" && (!description.positions || description.positions.length % 6 !== 0)) {
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
        if (style.type === "sphere" || style.type === "box") {
            const geometry = style.type === "sphere"
                ? new THREE.SphereGeometry(1, style.widthSegments, style.heightSegments)
                : new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshBasicMaterial({ ...materialOptions, wireframe: style.wireframe });
            batch.object = new THREE.InstancedMesh(geometry, material, batch.entries.length);
            batch.transform = new THREE.Object3D();
            batch.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        } else {
            const count = batch.entries.reduce((sum, entry) => sum + K3Display.vertexCapacity(entry.appearance), 0);
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
        batch.vertex = new THREE.Vector3();
        batch.states = batch.entries.map(() => ({}));
    }

    needsUpdate(batch) {
        let changed = batch.style.type === "dashes" && batch.time !== this.time;
        batch.time = this.time;
        batch.entries.forEach(({ node, appearance }, index) => {
            const state = batch.states[index];
            const x = !this.centered && node ? node.position.x : 0;
            const y = !this.centered && node ? node.position.y : 0;
            const z = !this.centered && node ? node.position.z : 0;
            const angle = node ? node.rotation + node.spinAngle : 0;
            const pitch = node ? node.pitch : 0;
            const roll = node ? node.roll : 0;
            const visible = !this.hidden.has(node);
            const radius = appearance.radius ?? (node ? node.size : 1);
            const color = appearance.color ?? 0xffffff;
            const half = appearance.halfExtents || [radius, radius, radius];
            if (state.x !== x || state.y !== y || state.z !== z || state.angle !== angle ||
                state.pitch !== pitch || state.roll !== roll ||
                state.halfX !== half[0] || state.halfY !== half[1] || state.halfZ !== half[2] ||
                state.visible !== visible || state.radius !== radius || state.color !== color) changed = true;
            Object.assign(state, { x, y, z, angle, pitch, roll, visible, radius, color,
                halfX: half[0], halfY: half[1], halfZ: half[2] });
        });
        return changed;
    }

    update(time = 0) {
        this.time = time;
        for (const { node, object } of this.custom) {
            object.visible = !this.hidden.has(node);
            if (node) {
                if (!this.centered) object.position.copy(node.position);
                node.applyOutsideRotation(object);
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
                if (batch.style.type === "sphere" || batch.style.type === "box") {
                    const transform = batch.transform;
                    transform.position.copy(position);
                    if (node) node.applyOutsideRotation(transform);
                    else { transform.rotation.x = 0; transform.rotation.y = 0; transform.rotation.z = 0; }
                    const radius = appearance.radius ?? (node ? node.size : 1);
                    const half = appearance.halfExtents || [radius, radius, radius];
                    transform.scale.set(half[0], half[1], half[2]);
                    transform.updateMatrix();
                    object.setMatrixAt(count, transform.matrix);
                    object.setColorAt(count, batch.color);
                    nodes.push(node);
                    count++;
                } else {
                    const positions = object.geometry.attributes.position.array;
                    const colors = object.geometry.attributes.color.array;
                    const writeVertex = (x, y, z) => {
                        const offset = count * 3;
                        batch.vertex.set(x, y, z);
                        if (node) node.rotateFramePosition(batch.vertex, false, node.spinAngle);
                        positions[offset] = position.x + batch.vertex.x;
                        positions[offset + 1] = position.y + batch.vertex.y;
                        positions[offset + 2] = position.z + batch.vertex.z;
                        colors[offset] = batch.color.r;
                        colors[offset + 1] = batch.color.g;
                        colors[offset + 2] = batch.color.b;
                        nodes.push(node);
                        count++;
                    };
                    if (batch.style.type === "dashes") {
                        const length = appearance.length;
                        const dash = appearance.dashSize ?? 4;
                        const period = dash + (appearance.gapSize ?? 4);
                        const phase = ((time * (appearance.speed ?? 8)) % period + period) % period;
                        for (let start = phase - period; start < length; start += period) {
                            const a = Math.max(0, start), b = Math.min(length, start + dash);
                            if (b <= a) continue;
                            writeVertex(0, 0, a - length / 2);
                            writeVertex(0, 0, b - length / 2);
                        }
                    } else {
                        const local = batch.style.type === "point" ? [0, 0, 0] : appearance.positions;
                        for (let index = 0; index < local.length; index += 3) {
                            writeVertex(local[index], local[index + 1], local[index + 2]);
                        }
                    }
                }
            }
            object.visible = count > 0;
            if (batch.style.type === "sphere" || batch.style.type === "box") {
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
