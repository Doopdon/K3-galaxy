const galaxyScenes = [];
const galaxySize = 100;
const orbitRadius = 350;

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
        spinSpeed: 0.25,
        childrenOrbitSpeed: 0.08,
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
    childrenOrbitSpeed: 0.025,
    children: galaxyScenes
});

const sceneSetup = {
    startPosition: [0, 700, 1100],
    startPitch: -Math.atan2(700, 1100),
    shuttles: false
};
