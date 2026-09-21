const galaxyScenes = [];

const orbitSpeed = 0.025;


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

            // outside.add(new THREE.Mesh(
            //     new THREE.SphereGeometry(scene.size, 32, 32),
            //     new THREE.MeshBasicMaterial({
            //         color: 0x22ddbb,
            //         wireframe: true
            //     })
            // ));

            outside.add(createOutsideStars(scene));

            return outside;
        }
    }));
}


// ============================================================
// CORE
// ============================================================

// Large, dense galactic core
addGalaxySphere(
    0,
    0,
    "Galactic Core",
    300,    // size
    800     // stars
);


// ============================================================
// TWO SPIRAL ARMS
// ============================================================

const spheresPerArm = 24;

// Shape of the spiral
const spiralGrowth = 180;

// Sphere-to-sphere spacing
const sphereSpacing = 260;

// Arm spheres start large/dense...
const innerSphereSize = 240;
const innerStarCount = 350;

// ...and end small/sparse
const outerSphereSize = 360;
const outerStarCount = 40;


for (let arm = 0; arm < 2; arm++) {

    let theta = 0;

    for (let i = 0; i < spheresPerArm; i++) {

        // 0 at inner arm
        // 1 at outer arm
        const progress = i / (spheresPerArm - 1);


        // ----------------------------------------------------
        // SPIRAL POSITION
        // ----------------------------------------------------

        const radius =
            spiralGrowth * theta +
            250;

        const angle =
            theta +
            arm * Math.PI;

        const x =
            Math.cos(angle) * radius;

        const z =
            Math.sin(angle) * radius;


        // ----------------------------------------------------
        // ARM THICKNESS
        // ----------------------------------------------------

        // Gradually shrink the sphere toward the edge
        const sphereSize =
            innerSphereSize +
            (outerSphereSize - innerSphereSize) * progress;


        // ----------------------------------------------------
        // STAR DENSITY
        // ----------------------------------------------------

        // Density falls faster than sphere size.
        // Squaring progress keeps the inner arm dense longer.
        const densityFalloff =
            1 - progress * progress;

        const starCount =
            Math.round(
                outerStarCount +
                (innerStarCount - outerStarCount) *
                densityFalloff
            );


        addGalaxySphere(
            x,
            z,
            `Arm ${arm + 1} / Sphere ${i + 1}`,
            sphereSize,
            starCount
        );


        // ----------------------------------------------------
        // MOVE ALONG SPIRAL
        // ----------------------------------------------------

        theta += sphereSpacing / Math.sqrt(
            radius * radius +
            spiralGrowth * spiralGrowth
        );
    }
}


// ============================================================
// MAIN GALAXY
// ============================================================

const mainScene = new K3Scene({
    name: "Galaxy",

    info:
        "A dense galactic core surrounded by two spiral arms " +
        "that become thinner and less dense toward the edge.",

    size: 5000,

    childrenOrbitSpeed: orbitSpeed,

    children: galaxyScenes
});


const sceneSetup = {
    startPosition: [0, 700, 1100],
    startPitch: -Math.atan2(700, 1100),
    shuttles: false
};