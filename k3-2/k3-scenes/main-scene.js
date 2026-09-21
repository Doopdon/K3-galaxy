const galaxyScenes = [];

const galaxySize = 250;
const spacing = 350;
const orbitSpeed = 0.025;

// How many rings around the center?
const ringCount = 2;

function addGalaxySphere(x, z, name, size, starCount) {
    galaxyScenes.push(new K3Scene({
        name,
        size: size,
        insideSize: size,
        position: [x, 0, z],

        rotationSpeed: orbitSpeed,

        children: createStarScenes(
            size,
            starCount,
            name + " / Star"
        ),

        makeOutside(scene) {
            const outside = new THREE.Group();

            outside.add(new THREE.Mesh(
                new THREE.SphereGeometry(scene.size, 32, 32),
                new THREE.MeshBasicMaterial({
                    color: 0x22ddbb,
                    wireframe: true
                })
            ));

            outside.add(createOutsideStars(scene));

            return outside;
        }
    }));
}


// CENTER
addGalaxySphere(0, 0, "Central Sphere", 250, 100);


// TWO CLEAN SPIRAL ARMS
const spheresPerArm = 20;

// Distance between neighboring spheres
const sphereSpacing = 350;

// Controls how tightly the arms curl.
// Bigger = more open spiral
const spiralGrowth = 180;


// Create each arm
for (let arm = 0; arm < 2; arm++) {

    let theta = 0;

    for (let i = 1; i <= spheresPerArm; i++) {

        // Radius grows as we travel outward
        const radius = spiralGrowth * theta + sphereSpacing;

        // Opposite arm is rotated exactly 180 degrees
        const angle = theta + arm * Math.PI;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        addGalaxySphere(
            x,
            z,
            `Arm ${arm + 1} / Sphere ${i}`,
            100,
            100
        );

        // Approximate equal distance along the spiral.
        // At larger radius, angular steps get smaller.
        theta += sphereSpacing / Math.sqrt(
            radius * radius +
            spiralGrowth * spiralGrowth
        );
    }
}

const mainScene = new K3Scene({
    name: "Galaxy",
    info: "Six spheres slowly orbit a central sphere; each contains 100 star scenes.",
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
