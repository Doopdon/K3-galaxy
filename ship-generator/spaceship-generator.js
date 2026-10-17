// Shared by the Flying Shapes playground and the K3 swarm cube scenes.
// A recipe contains only shape data, so each viewer can choose its renderer.
const SpaceshipGenerator = {
    get diskColor() { return K3_COLORS.red; },
    generate(random = Math.random) {
        const between = (min, max) => min + random() * (max - min);
        const segments = [];
        const segmentCount = Math.floor(between(3, 14));
        for (let index = 0; index < segmentCount; index++) {
            segments.push({ top: between(0.1, 0.2), bottom: between(0.1, 0.2), height: between(1, 3) });
        }
        const length = segments.reduce((sum, segment) => sum + segment.height, 0);
        const parts = [];
        let current = -length / 2;
        for (const [index, segment] of segments.entries()) {
            parts.push({ id: "spine-" + index, role: "spine", type: "cylinder", x: -(current + segment.height / 2),
                topRadius: segment.top / 2, bottomRadius: segment.bottom / 2,
                length: segment.height, color: 0x888888 });
            current += segment.height;
        }
        const count = Math.max(2, Math.floor(between(2, length / 2)));
        const spacing = length / (count + 1);
        const spots = [];
        for (let index = 1; index <= count; index++) {
            spots.push(index * spacing + (random() - 0.5) * spacing * 0.5);
        }
        const types = Array(count).fill("ring");
        types[0] = "disk";
        let rings = count - 1, disks = 1;
        for (let index = 1; index < count - 1; index++) {
            if (random() < 0.5 && rings - 1 > disks + 1) {
                types[index] = "disk";
                rings--; disks++;
            }
        }
        for (let index = 0; index < count; index++) {
            const x = length / 2 - spots[index];
            if (types[index] === "ring") {
                parts.push({ id: "ring-" + index, role: "ring", type: "cylinder", x, topRadius: 1.2, bottomRadius: 1.2,
                    length: between(0.2, 0.65), color: 0x888888,
                    terrain: TerrainGenerator.randomSettings(random) });
            } else {
                const innerRadius = between(1.5, 2);
                parts.push({ id: "disk-" + index, role: "disk", type: "disk", x, innerRadius,
                    outerRadius: innerRadius + between(2, 3.5), color: this.diskColor });
            }
        }
        // Plain data survives JSON serialization and can seed deeper scenes;
        // render geometry is a derived preview, never the source of truth.
        return { version: 1, length, spineSegments: segments, parts };
    },

    fitScale(recipe, halfExtent) {
        const maxRadius = Math.max(...recipe.parts.map(part => part.outerRadius || part.topRadius || 0));
        return halfExtent * 0.85 / Math.max(recipe.length / 2 + 0.325, maxRadius);
    },

    createObject(THREE, recipe, materials) {
        const root = new THREE.Group();
        for (const part of recipe.parts) {
            const disk = part.type === "disk";
            const geometry = disk
                ? new THREE.RingGeometry(part.innerRadius, part.outerRadius, 64)
                : new THREE.CylinderGeometry(part.topRadius, part.bottomRadius, part.length, 48, 1, true);
            const mesh = new THREE.Mesh(geometry, disk ? materials.red : materials.gray);
            mesh.position.x = part.x;
            if (disk) mesh.rotation.y = Math.PI / 2;
            else mesh.rotation.z = Math.PI / 2;
            root.add(mesh);
        }
        return root;
    },

    // Small distant ships need fewer segments. Triangle descriptions let the
    // generic display batch every ship together, including both surface colors.
    // emissiveness: 0 disables disk halos; 1 uses the full configured glow.
    describeOutside(recipe, halfExtent, segments = 12, emissiveness = 1) {
        emissiveness = Math.max(0, Math.min(1, emissiveness));
        const scale = this.fitScale(recipe, halfExtent);
        const surfaces = recipe.parts.map(part => {
            const positions = [];
            const vertex = (x, radius, angle) => [x * scale,
                radius * Math.cos(angle) * scale, radius * Math.sin(angle) * scale];
            for (let index = 0; index < segments; index++) {
                const a = index * Math.PI * 2 / segments;
                const b = (index + 1) * Math.PI * 2 / segments;
                let p, q, r, s;
                if (part.type === "disk") {
                    p = vertex(part.x, part.innerRadius, a);
                    q = vertex(part.x, part.outerRadius, a);
                    r = vertex(part.x, part.outerRadius, b);
                    s = vertex(part.x, part.innerRadius, b);
                } else {
                    p = vertex(part.x - part.length / 2, part.topRadius, a);
                    q = vertex(part.x + part.length / 2, part.bottomRadius, a);
                    r = vertex(part.x + part.length / 2, part.bottomRadius, b);
                    s = vertex(part.x - part.length / 2, part.topRadius, b);
                }
                positions.push(...p, ...q, ...r, ...p, ...r, ...s);
            }
            return { type: "triangles", positions, color: part.color };
        });
        const glow = K3_COLORS.shipDiskGlow;
        if (!glow.enabled || glow.strength <= 0 || emissiveness === 0) return surfaces;
        for (const part of recipe.parts) {
            if (part.role !== "disk") continue;
            const positions = [], vertexBrightness = [];
            // Radial brightness gradients fade both edges to black, which
            // contributes no color with additive blending. Keep the hole open.
            const bands = [
                [part.innerRadius * (1 - glow.spread), 0],
                [part.innerRadius, 1], [part.outerRadius, 1],
                [part.outerRadius * (1 + glow.spread), 0]
            ];
            const vertex = (radius, angle, brightness) => {
                positions.push(part.x * scale, radius * Math.cos(angle) * scale, radius * Math.sin(angle) * scale);
                vertexBrightness.push(brightness);
            };
            for (let band = 0; band < bands.length - 1; band++) {
                const [inner, innerLight] = bands[band], [outer, outerLight] = bands[band + 1];
                for (let index = 0; index < segments; index++) {
                    const a = index * Math.PI * 2 / segments, b = (index + 1) * Math.PI * 2 / segments;
                    vertex(inner, a, innerLight); vertex(outer, a, outerLight); vertex(outer, b, outerLight);
                    vertex(inner, a, innerLight); vertex(outer, b, outerLight); vertex(inner, b, innerLight);
                }
            }
            surfaces.push({ type: "triangles", positions, vertexBrightness, color: part.color,
                additive: true, transparent: true, opacity: glow.strength * emissiveness, depthWrite: false });
        }
        return surfaces;
    }
};
