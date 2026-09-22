// Logical stars use exactly the same outside-description API as any other scene.
function createStarScenes(parentSize, starCount, namePrefix) {
    const stars = [];
    const starSize = 8;
    for (let index = 0; index < starCount; index++) {
        const y = Math.random() * 2 - 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.cbrt(Math.random()) * (parentSize - starSize);
        const ring = Math.sqrt(1 - y * y);
        stars.push(new K3Scene({
            name: namePrefix + " " + (index + 1),
            info: "An enterable star scene. Its interior is empty for now.",
            size: starSize,
            insideSize: 1000,
            position: [Math.cos(angle) * ring * radius, y * radius,
                Math.sin(angle) * ring * radius],
            makeOutside(scene) {
                return {
                    type: "sphere", radius: scene.size, color: 0x3388ff,
                    widthSegments: 8, heightSegments: 6, wireframe: true
                };
            }
        }));
    }
    return stars;
}

// Scene-specific decoration, not a separate child-rendering path.
// Preserve the existing nearest-neighbor links, computing them once per region.
function createNeighborConnections(children) {
    const positions = [];
    for (let i = 0; i < children.length; i++) {
        let first = -1;
        let second = -1;
        let firstDistance = Infinity;
        let secondDistance = Infinity;
        for (let j = 0; j < children.length; j++) {
            if (i === j) continue;
            const distance = children[i].position.distanceTo(children[j].position);
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
            const a = children[i].position;
            const b = children[j].position;
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
    }
    return positions;
}

// A region's chosen outside model: a white point preview plus red links.
// Both decorations use the same generic batcher as ordinary child displays.
function createRegionPreview(scene, connections) {
    const entries = scene.children.map(node => ({
        node, appearance: { type: "point", color: 0xffffff, size: 3 }
    }));
    entries.push({ node: null, appearance: { type: "lines", color: 0xff0000, positions: connections } });
    const preview = K3Display.create(entries);
    preview.scale.setScalar(scene.size / scene.insideSize);
    return preview;
}
