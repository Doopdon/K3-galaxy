function makeHighDefStar(radius, coreColor, glowColor) {

    const group = new THREE.Group();

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


    // Tight glow
    const glow1 =
        makeGlowingSphere(
            radius * 1.6,
            glowColor
        );

    glow1.material.opacity = 0.45;


    // Medium corona
    const glow2 =
        makeGlowingSphere(
            radius * 3.0,
            glowColor
        );

    glow2.material.opacity = 0.15;


    // Huge bright glare
    const glare =
        makeGlowingSphere(
            radius * 35.0,
            0xffffff
        );

    glare.material.opacity = 0.8;
    glare.material.depthTest = false;
    glare.material.depthWrite = false;


    group.add(glare);
    group.add(glow2);
    group.add(glow1);
    group.add(core);

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


const solarSystemSceneData = new SceneData({

    scale: 0.001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [],

    populateScene: function () {

        const skyTexture =
            window.galaxySkyBox;

        if (skyTexture) {

            this.scene.environment =
                skyTexture;

            this.scene.environmentIntensity =
                .5;
        }

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
            0xfff8ee,
            8000,
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

        this.makeOrbitingObjects(group);
        this.makeDottedConnection(group);

        this.rootGroup.add(group);
        this.orbitGroup = group;
    },

    animate: function (deltaTime) {

        if (!this.planetPivots) return;

        for (const orbit of this.planetPivots) {

            orbit.pivot.rotateY(
                orbit.speed * deltaTime
            );
        }

        this.updateDottedConnection(
            deltaTime
        );
    },
});

solarSystemSceneData.makeDottedConnection = function (group) {

    // Pick two different random mirrors
    const aIndex =
        Math.floor(
            Math.random() *
            this.planetPivots.length
        );

    let bIndex =
        Math.floor(
            Math.random() *
            this.planetPivots.length
        );

    while (bIndex === aIndex) {
        bIndex =
            Math.floor(
                Math.random() *
                this.planetPivots.length
            );
    }


    this.dotConnection = {
        a: this.planetPivots[aIndex].mirror,
        b: this.planetPivots[bIndex].mirror,
        group: group,
        phase: 0
    };


    const dotCount = 20;

    const positions =
        new Float32Array(
            dotCount * 3
        );


    const geometry =
        new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );


    const material =
        new THREE.PointsMaterial({

            color: 0xffffff,

            // Pixels, because sizeAttenuation is false
            size: 3,

            sizeAttenuation: false,

            transparent: true,

            opacity: 0.9,

            depthWrite: false
        });


    this.dottedLine =
        new THREE.Points(
            geometry,
            material
        );


    group.add(
        this.dottedLine
    );
};

solarSystemSceneData.updateDottedConnection = function (deltaTime) {

    if (!this.dotConnection) return;


    const connection =
        this.dotConnection;


    // Move dots toward B
    connection.phase +=
        deltaTime * 0.2;

    connection.phase %= 1;


    const a =
        new THREE.Vector3();

    const b =
        new THREE.Vector3();


    connection.a.getWorldPosition(a);
    connection.b.getWorldPosition(b);


    // Points object lives inside group,
    // so convert world positions back to group space.
    connection.group.worldToLocal(a);
    connection.group.worldToLocal(b);


    const positions =
        this.dottedLine
            .geometry
            .attributes
            .position;


    const dotCount =
        positions.count;


    for (
        let i = 0;
        i < dotCount;
        i++
    ) {

        // Evenly spaced dots,
        // shifted forward every frame
        const t =
            (
                i / dotCount +
                connection.phase
            ) % 1;


        positions.setXYZ(
            i,

            THREE.MathUtils.lerp(
                a.x,
                b.x,
                t
            ),

            THREE.MathUtils.lerp(
                a.y,
                b.y,
                t
            ),

            THREE.MathUtils.lerp(
                a.z,
                b.z,
                t
            )
        );
    }


    positions.needsUpdate = true;
};

solarSystemSceneData.makeOrbitingObjects = function (group) {

    this.planetPivots = [];

    const planetCount = 80;

    // Controls overall animation speed.
    // Increase this if everything feels too slow.
    const orbitalSpeedScale = 3.0;

    for (let i = 0; i < planetCount; i++) {

        const pivot = new THREE.Group();


        // Orbital distance
        const radius =
            3 +
            Math.random() * 20;


        // Object size
        const size =
            0.08 +
            Math.random() * 0.25;


        const color = new THREE.Color(0xffffff);


        const mirrorWidth =
            0.2 + Math.random() * 0.5;

        const mirrorHeight =
            0.2 + Math.random() * 0.5;

        const mirrorThickness =
            0.01 + Math.random() * 0.02;

        const mirror = new THREE.Mesh(

            new THREE.BoxGeometry(
                mirrorThickness, // X = thin, points toward sun
                mirrorWidth,     // Y
                mirrorHeight     // Z
            ),

            new THREE.MeshPhysicalMaterial({
                color: 0xffffff,

                metalness: 1.0,

                roughness:
                    0.01 +
                    Math.random() * 0.04,

                clearcoat: 1.0,
                clearcoatRoughness: 0.01,

                envMapIntensity: 1.5
            })
        );


        // Put planet at orbital radius
        mirror.position.set(
            radius,
            0,
            0
        );


        // Small orbital inclination
        pivot.rotation.x =
            Math.random() * Math.PI * 2;

        pivot.rotation.z =
            Math.random() * Math.PI * 2;


        // Random starting position around orbit
        pivot.rotation.y =
            Math.random() *
            Math.PI *
            2;


        pivot.add(mirror);

        group.add(pivot);

        this.addCollider(mirror);


        // Keplerian angular velocity:
        //
        // omega ∝ 1 / r^(3/2)
        //
        const angularSpeed =
            orbitalSpeedScale /
            Math.pow(radius, 1.5);


        this.planetPivots.push({
            pivot,
            mirror,
            speed: angularSpeed
        });
    }
};
