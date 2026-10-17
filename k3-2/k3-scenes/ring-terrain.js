// Generate a rectangular map first; U wraps around the ring and V spans its width.
const K3RingTerrain = {
    maps: new WeakMap(),
    create(part, scale, innerRadiusRatio) {
        if (!part.terrain) {
            part.terrain = TerrainGenerator.randomSettings();
        }
        let map = this.maps.get(part);
        if (!map) {
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            const aspect = 2 * Math.PI * part.topRadius * innerRadiusRatio / (part.length * 0.88);
            canvas.height = Math.max(16, Math.min(128, Math.round(canvas.width / aspect)));
            map = TerrainGenerator.render(canvas, part.terrain);
            this.maps.set(part, map);
        }
        const { canvas, heights } = map;
        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.flipY = false;
        const along = 128, across = 12, stride = along + 1;
        const positions = [], uvs = [], indices = [];
        const radius = part.topRadius * scale * (innerRadiusRatio - 0.0005);
        const width = part.length * scale * 0.88;
        for (let row = 0; row <= across; row++) {
            const v = row / across;
            for (let column = 0; column <= along; column++) {
                const u = column / along;
                const sampleX = Math.floor((column % along) / along * canvas.width);
                const sampleY = Math.min(canvas.height - 1, Math.floor(v * canvas.height));
                const height = heights[sampleY * canvas.width + sampleX];
                // Land rises toward the axis: gravity points outward in a ring.
                const edgeSink = Math.pow(Math.abs(v - 0.5) * 2, 8) * radius * 0.006;
                const localRadius = radius + edgeSink - Math.max(0, height - (part.terrain.sea ?? 0.5)) * radius * 0.035;
                const angle = (column % along) / along * Math.PI * 2;
                positions.push((v - 0.5) * width, localRadius * Math.cos(angle), localRadius * Math.sin(angle));
                uvs.push(u, v);
                if (row < across && column < along) {
                    const a = row * stride + column, b = a + 1, c = a + stride, d = c + 1;
                    indices.push(a, c, b, b, c, d); // Inward-facing surface.
                }
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        // Average duplicated seam normals so lighting also wraps seamlessly.
        const normals = geometry.attributes.normal;
        for (let row = 0; row <= across; row++) {
            const first = row * stride, last = first + along;
            const normal = new THREE.Vector3().fromBufferAttribute(normals, first)
                .add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
            normals.setXYZ(first, normal.x, normal.y, normal.z);
            normals.setXYZ(last, normal.x, normal.y, normal.z);
        }
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95,
            metalness: 0, emissive: 0x182018, emissiveIntensity: 0.12 });
        material.addEventListener("dispose", () => texture.dispose());
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = part.id + " terrain";
        mesh.position.x = part.x * scale;
        mesh.userData.ringTerrain = part.terrain;
        return mesh;
    }
};
