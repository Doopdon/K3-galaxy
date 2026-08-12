const mirrorSceneData = new SceneData({

    scale: 0.0001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [citySceneData],

    populateScene: function () {

        const parentMirror =
            this.parentCollider;

        const scaleRatio =
            this.parentSceneData.scale /
            this.scale;


        // --------------------------------
        // MIRROR
        // --------------------------------

        const mirror =
            parentMirror.clone();

        mirror.material =
            parentMirror.material.clone();

        mirror.position.set(0, 0, 0);
        mirror.quaternion.identity();

        mirror.scale.copy(
            parentMirror.scale
        );

        mirror.scale.multiplyScalar(
            scaleRatio
        );


        const environmentTexture =
            this.parentSceneData.environmentTexture;

        if (environmentTexture) {

            this.scene.environment =
                environmentTexture;

            this.scene.environmentIntensity = 0.1;
        }


        mirror.visible = true;

        this.rootGroup.add(mirror);


        // --------------------------------
        // GET MIRROR SIZE
        // --------------------------------

        mirror.geometry.computeBoundingBox();

        const box =
            mirror.geometry.boundingBox;

        const mirrorHalfX =
            (
                box.max.x -
                box.min.x
            ) *
            mirror.scale.x *
            0.5;

        const mirrorHalfY =
            (
                box.max.y -
                box.min.y
            ) *
            mirror.scale.y *
            0.5;

        const mirrorHalfZ =
            (
                box.max.z -
                box.min.z
            ) *
            mirror.scale.z *
            0.5;


        // --------------------------------
        // PYRAMID CITIES
        // --------------------------------

        this.cityPyramids = [];
        this.cityGlowData = [];
        this.dotConnections = [];
        this.backFieldDots = [];

        this.makeMirrorFieldDots(
            mirrorHalfX,
            mirrorHalfY,
            mirrorHalfZ
        );

        // Move them slightly inward from
        // the literal edge of the mirror.
        const cityPositions =
            this.getMirrorCorners(
                mirror
            );


        const inset = 0.25;


        // Find polygon center
        const center =
            new THREE.Vector3();

        for (const position of cityPositions) {

            center.add(
                position
            );
        }

        center.divideScalar(
            cityPositions.length
        );


        // Move every city slightly toward
        // the center of the polygon.
        for (const position of cityPositions) {

            const inward =
                new THREE.Vector3(
                    0,
                    center.y - position.y,
                    center.z - position.z
                );

            if (
                inward.lengthSq() >
                0
            ) {

                inward
                    .normalize()
                    .multiplyScalar(
                        inset
                    );

                position.add(
                    inward
                );
            }
        }




        // Pyramid metal is shared by ALL cities.
        // Much cheaper than making a new material
        // for every pyramid.
        const pyramidMaterial =
            new THREE.MeshStandardMaterial({

                color: 0x777788,

                metalness: 0.95,

                roughness: 0.22
            });


        const cornerColors = [

            0x33ddff, // cyan
            0xff44bb, // pink
            0xffbb33, // orange
            0x66ff88  // green

        ];


        for (
            let i = 0;
            i < cityPositions.length;
            i++
        ) {

            const pyramid =
                this.makeCityPyramid(
                    cityPositions[i],
                    pyramidMaterial,

                    cornerColors[
                    i %
                    cornerColors.length
                    ]
                );

            this.rootGroup.add(
                pyramid
            );

            this.addCollider(
                pyramid
            );

            this.cityPyramids.push(
                pyramid
            );
        }


        // --------------------------------
        // TRAFFIC CONNECTIONS
        // --------------------------------

        // Around the perimeter...
        this.makeDottedConnection(
            this.cityPyramids[0],
            this.cityPyramids[1]
        );

        this.makeDottedConnection(
            this.cityPyramids[0],
            this.cityPyramids[2]
        );

        this.makeDottedConnection(
            this.cityPyramids[1],
            this.cityPyramids[3]
        );

        this.makeDottedConnection(
            this.cityPyramids[2],
            this.cityPyramids[3]
        );


        // ...plus diagonals
        this.makeDottedConnection(
            this.cityPyramids[0],
            this.cityPyramids[3]
        );

        this.makeDottedConnection(
            this.cityPyramids[1],
            this.cityPyramids[2]
        );
    },


    animate: function (deltaTime) {

        this.updateDottedConnections(
            deltaTime
        );

        this.animateCityGlows(
            deltaTime
        );

        this.animateBackFieldDots(
            deltaTime
        );
    }

});

mirrorSceneData.getMirrorCorners =
    function (mirror) {

        const geometry =
            mirror.geometry;

        const positions =
            geometry.attributes.position;


        geometry.computeBoundingBox();

        // The inhabited/front surface of the
        // mirror is the +X face.
        const frontX =
            geometry.boundingBox.max.x;


        const tolerance = 0.0001;

        const corners = [];


        for (
            let i = 0;
            i < positions.count;
            i++
        ) {

            const x =
                positions.getX(i);

            // Only look at vertices on
            // the front face.
            if (
                Math.abs(
                    x - frontX
                ) > tolerance
            ) {
                continue;
            }


            const y =
                positions.getY(i);

            const z =
                positions.getZ(i);


            // ExtrudeGeometry duplicates
            // vertices internally, so remove
            // duplicates.
            const alreadyExists =
                corners.some(
                    corner =>
                        Math.abs(corner.y - y) <
                        tolerance &&
                        Math.abs(corner.z - z) <
                        tolerance
                );


            if (!alreadyExists) {

                corners.push(
                    new THREE.Vector3(
                        x,
                        y,
                        z
                    )
                );
            }
        }


        // Put them in perimeter order.
        // Important later for connecting
        // neighboring cities.
        let centerY = 0;
        let centerZ = 0;

        for (const corner of corners) {

            centerY += corner.y;
            centerZ += corner.z;
        }

        centerY /= corners.length;
        centerZ /= corners.length;


        corners.sort(
            (a, b) => {

                const angleA =
                    Math.atan2(
                        a.z - centerZ,
                        a.y - centerY
                    );

                const angleB =
                    Math.atan2(
                        b.z - centerZ,
                        b.y - centerY
                    );

                return angleA - angleB;
            }
        );


        // Geometry coordinates need to be
        // converted into this child scene's
        // scaled mirror coordinates.
        for (const corner of corners) {

            corner.x *=
                mirror.scale.x;

            corner.y *=
                mirror.scale.y;

            corner.z *=
                mirror.scale.z;
        }


        return corners;
    };

mirrorSceneData.makeMirrorFieldDots =
    function (
        mirrorHalfX,
        mirrorHalfY,
        mirrorHalfZ
    ) {

        const rows = 8;
        const cols = 12;

        const yMin =
            -mirrorHalfY + 0.15;

        const yMax =
            mirrorHalfY - 0.15;

        const zMin =
            -mirrorHalfZ + 0.15;

        const zMax =
            mirrorHalfZ - 0.15;


        // one plane on each side
        const xPositions = [
            -mirrorHalfX - 0.03, // back
            mirrorHalfX + 0.03  // front
        ];


        for (const x of xPositions) {

            for (let row = 0; row < rows; row++) {

                for (let col = 0; col < cols; col++) {

                    const y =
                        THREE.MathUtils.lerp(
                            yMin,
                            yMax,
                            row / (rows - 1)
                        );

                    const z =
                        THREE.MathUtils.lerp(
                            zMin,
                            zMax,
                            col / (cols - 1)
                        );


                    const material =
                        new THREE.SpriteMaterial({

                            map:
                                this.getCornerGlowTexture(),

                            color:
                                0xff3344,

                            transparent:
                                true,

                            opacity:
                                0.5,

                            depthWrite:
                                false,

                            blending:
                                THREE.AdditiveBlending
                        });


                    const dot =
                        new THREE.Sprite(
                            material
                        );

                    dot.position.set(
                        x,
                        y + (Math.random() - 0.5) * 0.03,
                        z + (Math.random() - 0.5) * 0.03
                    );

                    dot.scale.set(
                        0.08,
                        0.08,
                        1
                    );

                    this.rootGroup.add(
                        dot
                    );


                    this.backFieldDots.push({

                        dot: dot,

                        baseScale:
                            0.08,

                        phase:
                            Math.random() *
                            Math.PI * 2,

                        speed:
                            1.0 +
                            Math.random() * 2.0

                    });
                }
            }
        }
    };

mirrorSceneData.animateBackFieldDots =
    function (deltaTime) {

        if (!this.backFieldDots) {
            return;
        }

        for (const fieldDot of this.backFieldDots) {

            fieldDot.phase +=
                deltaTime *
                fieldDot.speed;


            const pulse =
                0.5 +
                0.5 *
                Math.sin(fieldDot.phase);


            fieldDot.dot.material.opacity =
                0.15 + pulse * 0.65;


            const scale =
                fieldDot.baseScale *
                (0.85 + pulse * 0.35);

            fieldDot.dot.scale.set(
                scale,
                scale,
                1
            );
        }
    };

mirrorSceneData.makeCityPyramid =
    function (
        position,
        pyramidMaterial,
        glowColor
    ) {

        const height = 0.65;
        const radius = 0.24;


        const pyramid =
            new THREE.Mesh(

                new THREE.ConeGeometry(
                    radius,
                    height,
                    4
                ),

                pyramidMaterial
            );


        // ConeGeometry normally points upward
        // on Y.
        //
        // Rotate it so it sticks OUT from
        // the mirror along +X.
        pyramid.rotation.z =
            -Math.PI / 2;


        // Because position represents the
        // mirror surface, move the pyramid
        // half its height outward.
        pyramid.position.copy(
            position
        );

        pyramid.position.x +=
            height * 0.5;


        // --------------------------------
        // GLOWING CORNERS
        // --------------------------------

        const cornerMaterial =
            new THREE.MeshBasicMaterial({
                color: glowColor
            });


        const glowMaterial =
            new THREE.SpriteMaterial({

                map:
                    this.getCornerGlowTexture(),

                color:
                    glowColor,

                transparent:
                    true,

                depthWrite:
                    false,

                blending:
                    THREE.AdditiveBlending
            });


        // Tip
        const corners = [

            new THREE.Vector3(
                0,
                height / 2,
                0
            )

        ];


        // Four base corners
        for (let i = 0; i < 4; i++) {

            const angle =
                i / 4 *
                Math.PI *
                2;

            corners.push(

                new THREE.Vector3(

                    Math.cos(angle) *
                    radius,

                    -height / 2,

                    Math.sin(angle) *
                    radius
                )

            );
        }


        for (const position of corners) {

            // Bright solid center
            const orb =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        0.035,
                        8,
                        8
                    ),

                    cornerMaterial
                );

            orb.position.copy(
                position
            );

            pyramid.add(
                orb
            );


            // Cheap fake glow around it
            const glow =
                new THREE.Sprite(
                    glowMaterial
                );

            glow.position.copy(
                position
            );

            glow.scale.set(
                0.16,
                0.16,
                1
            );

            pyramid.add(
                glow
            );


            this.cityGlowData.push({

                orb: orb,

                glow: glow,

                phase:
                    Math.random() *
                    Math.PI *
                    2

            });
        }


        return pyramid;
    };

mirrorSceneData.getCornerGlowTexture =
    function () {

        if (this.cornerGlowTexture) {

            return this.cornerGlowTexture;
        }


        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width = 64;
        canvas.height = 64;


        const ctx =
            canvas.getContext("2d");


        const gradient =
            ctx.createRadialGradient(
                32,
                32,
                0,

                32,
                32,
                32
            );


        gradient.addColorStop(
            0.0,
            "rgba(255,255,255,1)"
        );

        gradient.addColorStop(
            0.25,
            "rgba(255,255,255,0.8)"
        );

        gradient.addColorStop(
            0.6,
            "rgba(255,255,255,0.2)"
        );

        gradient.addColorStop(
            1.0,
            "rgba(255,255,255,0)"
        );


        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            0,
            0,
            64,
            64
        );


        this.cornerGlowTexture =
            new THREE.CanvasTexture(
                canvas
            );


        return this.cornerGlowTexture;
    };

mirrorSceneData.makeDottedConnection =
    function (a, b) {

        const dotsPerDirection = 5;

        const totalDots =
            dotsPerDirection * 2;


        const positions =
            new Float32Array(
                totalDots * 3
            );


        const colors =
            new Float32Array(
                totalDots * 3
            );


        const colorForward =
            new THREE.Color(
                0x44ddff
            );

        const colorBackward =
            new THREE.Color(
                0xff55cc
            );


        for (
            let i = 0;
            i < dotsPerDirection;
            i++
        ) {

            colors.set(
                [
                    colorForward.r,
                    colorForward.g,
                    colorForward.b
                ],
                i * 3
            );
        }


        for (
            let i = dotsPerDirection;
            i < totalDots;
            i++
        ) {

            colors.set(
                [
                    colorBackward.r,
                    colorBackward.g,
                    colorBackward.b
                ],
                i * 3
            );
        }


        const geometry =
            new THREE.BufferGeometry();


        geometry.setAttribute(

            "position",

            new THREE.BufferAttribute(
                positions,
                3
            )
        );


        geometry.setAttribute(

            "color",

            new THREE.BufferAttribute(
                colors,
                3
            )
        );


        const material =
            new THREE.PointsMaterial({

                size: 10,

                sizeAttenuation: false,

                map: this.getCornerGlowTexture(),

                transparent: true,

                opacity: 0.9,

                depthWrite: false,

                blending: THREE.AdditiveBlending,

                vertexColors: true,

                alphaTest: 0.01
            });


        const dots =
            new THREE.Points(
                geometry,
                material
            );

        dots.frustumCulled = false;


        this.rootGroup.add(
            dots
        );


        this.dotConnections.push({

            a: a,

            b: b,

            phase:
                Math.random(),

            speed:
                0.2 +
                Math.random() *
                0.15,

            dots:
                dots,

            dotsPerDirection:
                dotsPerDirection

        });
    };

mirrorSceneData.updateDottedConnections =
    function (deltaTime) {

        if (!this.dotConnections) {
            return;
        }


        const a =
            new THREE.Vector3();

        const b =
            new THREE.Vector3();

        const direction =
            new THREE.Vector3();

        const perpendicular =
            new THREE.Vector3();


        for (
            const connection
            of this.dotConnections
        ) {

            connection.phase +=
                deltaTime *
                connection.speed;

            connection.phase %= 1;


            connection.a.getWorldPosition(
                a
            );

            connection.b.getWorldPosition(
                b
            );


            this.rootGroup.worldToLocal(
                a
            );

            this.rootGroup.worldToLocal(
                b
            );


            direction
                .subVectors(
                    b,
                    a
                );


            // Create a sideways direction
            // in the mirror's Y/Z plane.
            perpendicular.set(

                0,

                -direction.z,

                direction.y
            );


            if (
                perpendicular.lengthSq() >
                0.00001
            ) {

                perpendicular
                    .normalize()
                    .multiplyScalar(
                        0.035
                    );
            }


            const positions =
                connection.dots
                    .geometry
                    .attributes
                    .position;


            const count =
                connection
                    .dotsPerDirection;


            // -----------------------------
            // FORWARD TRAFFIC
            // -----------------------------

            for (
                let i = 0;
                i < count;
                i++
            ) {

                const t =
                    (
                        i / count +
                        connection.phase
                    ) % 1;


                positions.setXYZ(

                    i,

                    THREE.MathUtils.lerp(
                        a.x,
                        b.x,
                        t
                    ) +
                    perpendicular.x,

                    THREE.MathUtils.lerp(
                        a.y,
                        b.y,
                        t
                    ) +
                    perpendicular.y,

                    THREE.MathUtils.lerp(
                        a.z,
                        b.z,
                        t
                    ) +
                    perpendicular.z
                );
            }


            // -----------------------------
            // RETURN TRAFFIC
            // -----------------------------

            for (
                let i = 0;
                i < count;
                i++
            ) {

                let t =
                    (
                        i / count -
                        connection.phase
                    ) % 1;

                if (t < 0) {
                    t += 1;
                }


                positions.setXYZ(

                    count + i,

                    THREE.MathUtils.lerp(
                        a.x,
                        b.x,
                        t
                    ) -
                    perpendicular.x,

                    THREE.MathUtils.lerp(
                        a.y,
                        b.y,
                        t
                    ) -
                    perpendicular.y,

                    THREE.MathUtils.lerp(
                        a.z,
                        b.z,
                        t
                    ) -
                    perpendicular.z
                );
            }


            positions.needsUpdate =
                true;
        }
    };

mirrorSceneData.animateCityGlows =
    function (deltaTime) {

        if (!this.cityGlowData) {
            return;
        }


        for (
            const glow
            of this.cityGlowData
        ) {

            glow.phase +=
                deltaTime *
                1.5;


            const pulse =
                1 +
                Math.sin(
                    glow.phase
                ) *
                0.08;


            glow.glow.scale.set(
                0.16 * pulse,
                0.16 * pulse,
                1
            );
        }
    };