const colors = [
    0xffb3c6,
    0xcdb4ff,
    0xa2d2ff,
    0xb9fbc0,
    0xfde4a6,
    0xffc8a2,
    0x98f5e1,
    0xe4c1f9
];

// Place eight planets at cube corners, entirely inside their galaxy.
function createPlanetScenes(parentSize, namePrefix) {
    const scenes = [];
    const distance = parentSize * 0.45;
    const size = parentSize * 0.1;

    for (const x of [-distance, distance]) {
        for (const y of [-distance, distance]) {
            for (const z of [-distance, distance]) {
                const color = colors[scenes.length];
                const name = namePrefix + " " + (scenes.length + 1);

                scenes.push(new K3Scene({
                    name,
                    info: "A planet inside its galaxy.",
                    size,
                    insideSize: 1000,
                    position: [x, y, z],

                    makeOutside(scene) {
                        return new THREE.Mesh(
                            new THREE.SphereGeometry(scene.size, 32, 32),
                            new THREE.MeshBasicMaterial({ color })
                        );
                    }
                }));
            }
        }
    }

    return scenes;
}
