function makeHighDefStar(radius, coreColor, glowColor) {

    const group = new THREE.Group();

    // Actual luminous surface
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 48, 48),

        new THREE.MeshStandardMaterial({
            color: coreColor,

            emissive: coreColor,
            emissiveIntensity: 8,

            metalness: 0,
            roughness: 0.8
        })
    );

    // Tight corona
    const glow1 = makeGlowingSphere(
        radius * 1.6,
        glowColor
    );

    // Very faint outer haze
    const glow2 = makeGlowingSphere(
        radius * 2.5,
        glowColor
    );

    glow1.material.opacity = 0.65;
    glow2.material.opacity = 0.18;

    group.add(glow2);
    group.add(glow1);
    group.add(core);

    group.userData.core = core;

    return group;
}

function makeGlowingSphere(radius, glowColor) {

    const canvas = document.createElement("canvas");

    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(
        64, 64, 0,
        64, 64, 64
    );

    gradient.addColorStop(0.00, "rgba(255,255,255,1)");
    gradient.addColorStop(0.20, "rgba(255,255,255,0.6)");
    gradient.addColorStop(0.50, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1.00, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        color: glowColor,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const glow = new THREE.Sprite(material);

    glow.scale.set(
        radius * 2,
        radius * 2,
        1
    );

    return glow;
}

const textureLoader = new THREE.TextureLoader();

const skyTexture = textureLoader.load("skybox.png");

skyTexture.mapping = THREE.EquirectangularReflectionMapping;

const solarSystemSceneData = new SceneData({

    scale: 0.001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [],

    populateScene: function () {

        const group = new THREE.Group();

        // Random tilt for the whole system
        group.rotation.x = Math.random() * 0.8;
        group.rotation.z = Math.random() * 0.8;

        this.localUp = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(group.quaternion)
            .normalize();

        // Glowing sun
        const sun = makeHighDefStar(1.0, 0xffdd66, 0xffaa22);
        group.add(sun);

        const sunLight = new THREE.PointLight(
            0xffe0aa,
            1500,
            0,
            2
        );

        group.add(sunLight);

        const fillLight = new THREE.HemisphereLight(
            0x6688aa,
            0x080808,
            0.08
        );

        group.add(fillLight);

        this.planetPivots = [];

        this.planetPivots = [];

        const planetCount = 80;

        for (
            let i = 0;
            i < planetCount;
            i++
        ) {

            const pivot =
                new THREE.Group();


            const radius =
                3 +
                Math.random() * 20;


            const size =
                0.08 +
                Math.random() * 0.25;


            const color =
                new THREE.Color()
                    .setHSL(
                        Math.random(),
                        0.12,
                        0.55
                    );


            const ball = new THREE.Mesh(

                new THREE.SphereGeometry(
                    size,
                    24,
                    24
                ),

                new THREE.MeshPhysicalMaterial({

                    color,

                    metalness:
                        0.75 +
                        Math.random() * 0.20,

                    roughness:
                        0.20 +
                        Math.random() * 0.20,

                    clearcoat: 0.8,

                    clearcoatRoughness: 0.08,
                })
            );


            ball.position.x =
                radius;


            // Give it some vertical spread
            pivot.rotation.x =
                THREE.MathUtils
                    .randFloatSpread(
                        0.5
                    );


            pivot.rotation.z =
                THREE.MathUtils
                    .randFloatSpread(
                        0.5
                    );


            pivot.rotation.y =
                Math.random() *
                Math.PI *
                2;


            pivot.add(ball);

            group.add(pivot);


            this.addCollider(ball);


            this.planetPivots.push({

                pivot,

                speed:
                    0.3 /
                    Math.sqrt(radius) +
                    Math.random() *
                    0.03
            });
        }

        this.rootGroup.add(group);
        this.orbitGroup = group;
    },

    animate: function (deltaTime) {

        if (!this.planetPivots) return;

        for (const orbit of this.planetPivots) {
            orbit.pivot.rotateY(orbit.speed * deltaTime);
        }
    }
});

solarSystemSceneData.scene.background = skyTexture;
solarSystemSceneData.scene.environment = skyTexture;

solarSystemSceneData.scene.environmentIntensity = 10;