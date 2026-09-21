const galaxyScenes = [];
const galaxySize = 100;
const galaxySpacing = 180;

for (const x of [-galaxySpacing, galaxySpacing]) {
    for (const y of [-galaxySpacing, galaxySpacing]) {
        for (const z of [-galaxySpacing, galaxySpacing]) {
            const name = "Galaxy " + (galaxyScenes.length + 1);

            galaxyScenes.push(new K3Scene({
                name,
                info: "A galaxy containing eight planets.",
                size: galaxySize,
                insideSize: 1000,
                position: [x, y, z],
                // Each galaxy owns its own scene tree and parent links.
                children: createPlanetScenes(1000, name + " / Planet"),

                makeOutside(scene) {
                    return new THREE.Mesh(
                        new THREE.SphereGeometry(scene.size, 32, 32),
                        new THREE.MeshBasicMaterial({
                            color: 0xaa2222,
                            wireframe: true
                        })
                    );
                }
            }));
        }
    }
}

const mainScene = new K3Scene({
    name: "K3 Universe",
    info: "Main scene containing eight red galaxies.",
    size: 5000,
    children: galaxyScenes
});
