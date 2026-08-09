function makeHighDefStar(radius, coreColor, glowColor) {
    const group = new THREE.Group();

    // Smaller, less obvious solid core
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.75, 32, 32),
        new THREE.MeshBasicMaterial({
            color: coreColor
        })
    );

    // Reuse your soft radial glow function
    const glow1 = makeGlowingSphere(radius * 3.5, coreColor, glowColor);
    const glow2 = makeGlowingSphere(radius * 7.0, coreColor, glowColor);

    glow1.material.opacity = 0.9;
    glow2.material.opacity = 0.35;

    group.add(glow2);
    group.add(glow1);
    group.add(core);

    group.userData.core = core;

    return group;
}

function makeGlowingSphere(radius, coreColor, glowColor) {

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(
        32, 32, 0,
        32, 32, 32
    );

    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.15, "rgba(255,255,255,0.7)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture =
        new THREE.CanvasTexture(canvas);

    const material =
        new THREE.SpriteMaterial({
            map: texture,
            color: glowColor,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

    const glow =
        new THREE.Sprite(material);

    glow.scale.set(
        radius * 4,
        radius * 4,
        1
    );

    return glow;
}

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

        const sunLight =
            new THREE.PointLight(
                0xffddaa,
                40,
                100
            );

        group.add(sunLight);


        const fillLight =
            new THREE.HemisphereLight(
                0x88aaff,
                0x221100,
                1.5
            );

        group.add(fillLight);


        const rimLight =
            new THREE.DirectionalLight(
                0xaaccff,
                4
            );

        rimLight.position.set(
            -10,
            8,
            -6
        );

        group.add(rimLight);

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


            const ball =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        size,
                        24,
                        24
                    ),

                    new THREE.MeshPhysicalMaterial({

                        color,

                        metalness: 1,

                        roughness:
                            0.08 +
                            Math.random() *
                            0.22,

                        clearcoat: 0.4,

                        clearcoatRoughness:
                            0.12
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
