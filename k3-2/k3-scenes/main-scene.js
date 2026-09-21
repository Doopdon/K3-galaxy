const galaxyScenes = [];
// Neighboring centers are 350 units apart; radius 250 gives 150 units of overlap.
const galaxySize = 250;
const orbitRadius = 350;
const orbitSpeed = 0.025;

// One stationary center and six evenly spaced spheres on a circular orbit.
for (let index = 0; index < 7; index++) {
    const angle = (index - 1) * Math.PI / 3;
    const name = index === 0 ? "Central Sphere" : "Orbiting Sphere " + index;
    galaxyScenes.push(new K3Scene({
        name,
        size: galaxySize,
        insideSize: 1000,
        position: index === 0 ? [0, 0, 0]
            : [Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius],
        // Each sphere carries its contents and any camera inside it.
        rotationSpeed: orbitSpeed,
        children: createPlanetScenes(1000, name + " / Planet"),
        makeOutside(scene) {
            return new THREE.Mesh(
                new THREE.SphereGeometry(scene.size, 32, 32),
                new THREE.MeshBasicMaterial({ color: 0x22ddbb, wireframe: true })
            );
        }
    }));
}

const mainScene = new K3Scene({
    name: "Galaxy",
    info: "Six spheres slowly orbit a central sphere; each contains eight planets.",
    size: 5000,
    // Keep the observer's frame still while the sphere centers orbit within it.
    childrenOrbitSpeed: orbitSpeed,
    children: galaxyScenes
});

const sceneSetup = {
    startPosition: [0, 700, 1100],
    startPitch: -Math.atan2(700, 1100),
    shuttles: false
};
