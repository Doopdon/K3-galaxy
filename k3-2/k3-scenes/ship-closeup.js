// Reconstruct saved shipData (or its JSON string) without generating a new ship.
// Coordinates and component IDs remain available for deeper component scenes.
const K3ShipCloseup = {
    ringGeometry: null,

    getRingGeometry() {
        if (this.ringGeometry) return this.ringGeometry;
        const binary = atob(K3_RING_STL_BASE64);
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        const count = view.getUint32(80, true);
        if (bytes.length !== 84 + count * 50) throw new Error("Invalid binary ring STL");
        const positions = new Float32Array(count * 9);
        let minZ = Infinity, maxZ = -Infinity, radius = 0;
        for (let triangle = 0; triangle < count; triangle++) {
            for (let vertex = 0; vertex < 3; vertex++) {
                const offset = 84 + triangle * 50 + 12 + vertex * 12;
                const x = view.getFloat32(offset, true), y = view.getFloat32(offset + 4, true);
                const z = view.getFloat32(offset + 8, true);
                positions.set([z, x, y], triangle * 9 + vertex * 3);
                minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
                radius = Math.max(radius, Math.hypot(x, y));
            }
        }
        const thickness = maxZ - minZ;
        if (!(radius > 0 && thickness > 0)) throw new Error("Ring STL has no volume");
        // Normalize to thickness 1 along X and radial extent 1 in YZ.
        for (let index = 0; index < positions.length; index += 3) {
            positions[index] = (positions[index] - (minZ + maxZ) / 2) / thickness;
            positions[index + 1] /= radius;
            positions[index + 2] /= radius;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        this.ringGeometry = geometry;
        return geometry;
    },

    create(savedData, options = {}) {
        const data = typeof savedData === "string" ? JSON.parse(savedData) : savedData;
        if (!data || !Array.isArray(data.parts)) throw new Error("Close-up ship requires saved shipData.parts");
        const scale = options.scale ?? data.insideScale ?? SpaceshipGenerator.fitScale(data, 100);
        const root = new THREE.Group();
        root.name = "Ship close-up";
        root.userData.shipData = data;
        for (const part of data.parts) {
            let geometry, material;
            if (part.role === "ring") {
                // Each visible ring owns its clone; scene disposal must never
                // invalidate the cached source mesh or another ring.
                geometry = this.getRingGeometry().clone();
                material = new THREE.MeshStandardMaterial({ color: part.color,
                    metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide });
            } else {
                // Preserve the low-resolution disk/spine profiles and segments.
                geometry = part.type === "disk"
                    ? new THREE.RingGeometry(part.innerRadius, part.outerRadius, 12)
                    : new THREE.CylinderGeometry(part.topRadius, part.bottomRadius, part.length, 12, 1, true);
                material = new THREE.MeshBasicMaterial({ color: part.color, side: THREE.DoubleSide });
            }
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = part.id;
            mesh.userData.shipPart = part;
            mesh.position.x = part.x * scale;
            if (part.role === "ring") {
                mesh.scale.set(part.length * scale, part.topRadius * scale, part.bottomRadius * scale);
            } else {
                mesh.scale.setScalar(scale);
                if (part.type === "disk") mesh.rotation.y = Math.PI / 2;
                else mesh.rotation.z = Math.PI / 2;
            }
            root.add(mesh);
        }
        if (data.emissiveness > 0 && K3_COLORS.shipDiskGlow.enabled) {
            const halfExtent = scale / SpaceshipGenerator.fitScale(data, 1);
            const halos = SpaceshipGenerator.describeOutside(data, halfExtent, 12, data.emissiveness)
                .filter(appearance => appearance.additive)
                .map(appearance => ({ node: null, appearance }));
            if (halos.length) root.add(K3Display.create(halos));
        }
        root.add(new THREE.HemisphereLight(0xffffff, 0x303040, 1.5));
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(100, 150, 100);
        root.add(light);
        return root;
    }
};
