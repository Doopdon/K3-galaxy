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

    childScenes: [mirrorSceneData],

    populateScene: function () {

        const skyTexture = window.galaxySkyBox;

        if (skyTexture) {

            this.scene.environment = skyTexture;
            this.scene.environmentIntensity = 0.5;

            // Save it so children can access it
            this.environmentTexture = skyTexture;
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

        for (let i = 0; i < 100; i++) {
            this.makeDottedConnection(group);
        }

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

    if (!this.dotConnections) {
        this.dotConnections = [];
    }
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


    const dotCount = 4;

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
            size: 1,

            sizeAttenuation: false,

            transparent: true,

            opacity: 0.9,

            depthWrite: false
        });


    const dottedLine =
        new THREE.Points(
            geometry,
            material
        );

    group.add(dottedLine);


    this.dotConnections.push({
        a: this.planetPivots[aIndex].mirror,
        b: this.planetPivots[bIndex].mirror,
        group: group,
        phase: Math.random(), // nice: don't synchronize them
        dottedLine: dottedLine
    });
};

solarSystemSceneData.updateDottedConnection =
    function (deltaTime) {

        if (!this.dotConnections) return;


        for (const connection of this.dotConnections) {

            connection.phase +=
                deltaTime * 0.2;

            connection.phase %= 1;


            const a =
                new THREE.Vector3();

            const b =
                new THREE.Vector3();


            connection.a.getWorldPosition(a);
            connection.b.getWorldPosition(b);

            connection.group.worldToLocal(a);
            connection.group.worldToLocal(b);


            const positions =
                connection.dottedLine
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
        }
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

        const sideCount =
            5 +
            Math.floor(
                Math.random() * 6
            );

        // 5 through 10 sides
        const mirror = new THREE.Mesh(

            makeIrregularNgonGeometry(
                mirrorWidth,
                mirrorHeight,
                mirrorThickness,
                sideCount
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

function makeIrregularNgonGeometry(
    width,
    height,
    thickness,
    sides
) {

    const points = [];

    for (let i = 0; i < sides; i++) {

        // Base angle around the polygon
        const angle =
            (i / sides) *
            Math.PI *
            2;

        // Random distance from center.
        // This is what gives us unequal side lengths.
        const radius =
            0.65 +
            Math.random() * 0.35;

        const x =
            Math.cos(angle) *
            width *
            0.5 *
            radius;

        const y =
            Math.sin(angle) *
            height *
            0.5 *
            radius;

        points.push(
            new THREE.Vector2(
                x,
                y
            )
        );
    }


    const shape =
        new THREE.Shape(points);


    const geometry =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: thickness,
                bevelEnabled: false
            }
        );


    // ExtrudeGeometry is thin along Z by default.
    //
    // Rotate it so the thin direction becomes X,
    // matching your old BoxGeometry:
    //
    // X = thickness / points toward sun
    // Y = polygon height
    // Z = polygon width
    geometry.rotateY(
        Math.PI / 2
    );


    // Put the polygon's center at its local origin.
    geometry.center();


    return geometry;
}