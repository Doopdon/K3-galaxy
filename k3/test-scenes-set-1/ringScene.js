const mainSceneData = new GalaxySceneData({

    scale: 1,

    timescale: 1,

    disapearDistance: 1.5,

    childScenes: [
       // cubeSceneData
    ],


    getSubSceneData: function (object) {

        // return cubeSceneData;
    },


    populateScene: function () {

        const group = new THREE.Group();


        // ========================================
        // FOUR-SIDED TORUS
        // ========================================

        const innerRadius = 4;
        const outerRadius = 6;

        const height = 2;

        // Number of faces around the circle
        const segments = 128;


        const positions = [];
        const indices = [];


        const halfHeight =
            height / 2;


        // ----------------------------------------
        // CREATE VERTICES
        //
        // Each step around the circle has:
        //
        // 0 = outer top
        // 1 = inner top
        // 2 = inner bottom
        // 3 = outer bottom
        //
        //
        //     outer top -------- inner top
        //         |                 |
        //         |                 |
        //     outer bottom ----- inner bottom
        //
        // ----------------------------------------

        for (let i = 0; i <= segments; i++) {

            const angle =
                (i / segments) *
                Math.PI * 2;


            const cos =
                Math.cos(angle);

            const sin =
                Math.sin(angle);


            // OUTER TOP
            positions.push(

                cos * outerRadius,
                halfHeight,
                sin * outerRadius
            );


            // INNER TOP
            positions.push(

                cos * innerRadius,
                halfHeight,
                sin * innerRadius
            );


            // INNER BOTTOM
            positions.push(

                cos * innerRadius,
                -halfHeight,
                sin * innerRadius
            );


            // OUTER BOTTOM
            positions.push(

                cos * outerRadius,
                -halfHeight,
                sin * outerRadius
            );
        }


        // ----------------------------------------
        // HELPER FOR ONE RECTANGULAR FACE
        // ----------------------------------------

        function addQuad(
            a,
            b,
            c,
            d
        ) {

            indices.push(
                a,
                b,
                d
            );

            indices.push(
                b,
                c,
                d
            );
        }


        // ----------------------------------------
        // CONNECT THE RING
        // ----------------------------------------

        for (let i = 0; i < segments; i++) {

            const current =
                i * 4;

            const next =
                (i + 1) * 4;


            // --------------------------
            // TOP
            // --------------------------

            addQuad(

                current + 0,
                next + 0,

                next + 1,
                current + 1
            );


            // --------------------------
            // INNER WALL
            // --------------------------

            addQuad(

                current + 1,
                next + 1,

                next + 2,
                current + 2
            );


            // --------------------------
            // BOTTOM
            // --------------------------

            addQuad(

                current + 2,
                next + 2,

                next + 3,
                current + 3
            );


            // --------------------------
            // OUTER WALL
            // --------------------------

            addQuad(

                current + 3,
                next + 3,

                next + 0,
                current + 0
            );
        }


        const torusGeometry =
            new THREE.BufferGeometry();


        torusGeometry.setAttribute(

            "position",

            new THREE.Float32BufferAttribute(
                positions,
                3
            )
        );


        torusGeometry.setIndex(
            indices
        );


        torusGeometry.computeVertexNormals();


        // Important if your collider code
        // expects bounding boxes.
        torusGeometry.computeBoundingBox();


        const torusMaterial =
            new THREE.MeshStandardMaterial({

                color: 0x999999,

                roughness: 0.6,

                metalness: 0.2,

                side: THREE.DoubleSide,

                flatShading: true
            });


        const torus =
            new THREE.Mesh(

                torusGeometry,
                torusMaterial
            );


        group.add(
            torus
        );


        // ----------------------------------------
        // OPTIONAL EDGE LINES
        //
        // Makes the top/bottom/inside/outside
        // shape easier to see.
        // ----------------------------------------

        const edgeGeometry =
            new THREE.EdgesGeometry(
                torusGeometry,
                15
            );


        const edgeMaterial =
            new THREE.LineBasicMaterial({

                color: 0x222222
            });


        const edges =
            new THREE.LineSegments(

                edgeGeometry,
                edgeMaterial
            );


        group.add(
            edges
        );


        // ----------------------------------------
        // COLLIDER
        // ----------------------------------------

        this.addCollider(
            torus
        );


        this.scene.add(
            group
        );


        this.orbitGroup =
            group;



        // ========================================
        // LIGHTING
        // ========================================

        const ambientLight =
            new THREE.AmbientLight(
                0xffffff,
                1.5
            );


        this.scene.add(
            ambientLight
        );


        const directionalLight =
            new THREE.DirectionalLight(
                0xffffff,
                3
            );


        directionalLight.position.set(
            10,
            15,
            10
        );


        this.scene.add(
            directionalLight
        );



        // ========================================
        // BACKGROUND STARS
        // ========================================

        const starCount = 2000;


        const starPositions =
            new Float32Array(
                starCount * 3
            );


        for (let i = 0; i < starCount; i++) {

            const distance =
                100 +
                Math.random() * 300;


            const theta =
                Math.random() *
                Math.PI * 2;


            const phi =
                Math.acos(
                    2 * Math.random() - 1
                );


            starPositions[i * 3] =

                distance *
                Math.sin(phi) *
                Math.cos(theta);


            starPositions[i * 3 + 1] =

                distance *
                Math.cos(phi);


            starPositions[i * 3 + 2] =

                distance *
                Math.sin(phi) *
                Math.sin(theta);
        }


        const starGeometry =
            new THREE.BufferGeometry();


        starGeometry.setAttribute(

            "position",

            new THREE.BufferAttribute(
                starPositions,
                3
            )
        );


        const starMaterial =
            new THREE.PointsMaterial({

                color: "white",

                size: 0.5
            });


        const stars =
            new THREE.Points(

                starGeometry,
                starMaterial
            );


        this.scene.add(
            stars
        );
    },


    animate: function (deltaTime) {

        if (!this.orbitGroup)
            return;


        this.orbitGroup.rotation.y +=
            0.2 * deltaTime;
    }
});