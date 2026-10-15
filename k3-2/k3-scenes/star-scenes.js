// Relative separation is measured in star radii, keeping galaxy navigation units.
const K3_GALAXY_SCALE = {
    starCountMultiplier: 10,
    relativeSeparation: 10
};

// Logical stars use exactly the same outside-description API as any other scene.
function createStarScenes(parentSize, starCount, namePrefix) {
    const stars = [];
    // Ten times the density reduces typical 3D spacing by cbrt(10). Account
    // for that as well as the desired increase in spacing relative to size.
    const starSize = 8 / (K3_GALAXY_SCALE.relativeSeparation *
        Math.cbrt(K3_GALAXY_SCALE.starCountMultiplier));
    for (let index = 0; index < starCount; index++) {
        const y = Math.random() * 2 - 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.cbrt(Math.random()) * (parentSize - starSize);
        const ring = Math.sqrt(1 - y * y);
        stars.push(new K3Scene({
            name: namePrefix + " " + (index + 1),
            info: "A white star surrounded by a glowing red orbital swarm.",
            size: starSize,
            insideSize: 1000,
            position: [Math.cos(angle) * ring * radius, y * radius,
            Math.sin(angle) * ring * radius],
            makeInside: createGlowingStarInterior,
            makeOutside(scene) {
                return {
                    type: "group",
                    parts: [
                        {
                            type: "sphere",
                            radius: scene.size,
                            color: 0x3388ff,
                            widthSegments: 8,
                            heightSegments: 6,
                            wireframe: true,
                            collisionBoundary: true
                        },
                        {
                            type: "sphere",
                            radius: scene.size * STAR_VISUAL_RADIUS_RATIO,
                            color: K3_COLORS.red,
                            transparent: true,
                            opacity: 0.7,
                            depthWrite: false,
                            widthSegments: 12,
                            heightSegments: 8
                        },
                        {
                            type: "sphere",
                            radius: scene.size * STAR_VISUAL_RADIUS_RATIO * (0.5 / 9.6),
                            color: 0xffffff,
                            widthSegments: 12,
                            heightSegments: 8
                        }
                    ]
                };
            }
        }));
    }
    return stars;
}

// Scene-specific decoration, not a separate child-rendering path.
// Preserve the existing nearest-neighbor links, computing them once per region.
function createNeighborConnections(children) {
    const connections = [];
    for (let i = 0; i < children.length; i++) {
        let first = -1;
        let second = -1;
        let firstDistance = Infinity;
        let secondDistance = Infinity;
        for (let j = 0; j < children.length; j++) {
            if (i === j) continue;
            // Squared distances preserve neighbor order without a square root
            // or temporary vector for every pair in the larger population.
            const a = children[i].position, b = children[j].position;
            const distance = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
            if (distance < firstDistance) {
                second = first;
                secondDistance = firstDistance;
                first = j;
                firstDistance = distance;
            } else if (distance < secondDistance) {
                second = j;
                secondDistance = distance;
            }
        }
        for (const j of [first, second]) {
            if (j <= i) continue;
            connections.push([children[i], children[j]]);
        }
    }
    return connections;
}

function connectionPositions(connections) {
    const positions = [];
    for (const [a, b] of connections) {
        positions.push(a.position.x, a.position.y, a.position.z,
            b.position.x, b.position.y, b.position.z);
    }
    return positions;
}

// Galactic overview: white star points and solid route lines. Entering the
// region reveals corridor dot streams; entering a corridor reveals shuttles.
// Both decorations use the same generic batcher as ordinary child displays.
function createRegionPreview(scene) {
    const entries = scene.stars.map(node => ({
        node, appearance: { type: "point", color: 0xffffff, size: 3 }
    }));
    for (const node of scene.corridors) {
        entries.push({ node, appearance: {
            type: "lines",
            positions: [0, 0, -node.length / 2, 0, 0, node.length / 2],
            color: K3_COLORS.lineRed
        } });
    }
    const preview = K3Display.create(entries);
    preview.scale.setScalar(scene.size / scene.insideSize);
    return preview;
}
