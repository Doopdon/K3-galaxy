const colors = [
    0xff5555,
    0x55ff55,
    0x5555ff,
    0xffff55,
    0xff55ff,
    0x55ffff,
    0xff9955,
    0xffffff
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
