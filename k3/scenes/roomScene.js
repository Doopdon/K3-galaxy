const roomSceneData =
    new HabSceneData({

        scale: 0.000000001,

        timescale: 5,

        disapearDistance: 1.0,

        childScenes: [],


        populateScene: function () {

            // --------------------------------
            // ROOM SIZE
            // --------------------------------

            const width = 12;
            const height = 7;
            const depth = 16;

            const wallThickness = 0.15;


            // --------------------------------
            // MATERIALS
            // --------------------------------

            const wallMaterial =
                new THREE.MeshStandardMaterial({

                    color: 0xb8b1a5,

                    roughness: 0.8,

                    metalness: 0,

                    // IMPORTANT:
                    // we're looking at these
                    // walls from the inside.
                    side: THREE.DoubleSide
                });


            const floorMaterial =
                new THREE.MeshStandardMaterial({

                    color: 0x403b35,

                    roughness: 0.9,

                    side: THREE.DoubleSide
                });


            // --------------------------------
            // HELPER
            // --------------------------------

            const makeWall =
                (
                    sizeX,
                    sizeY,
                    sizeZ,
                    x,
                    y,
                    z,
                    material = wallMaterial
                ) => {

                    const wall =
                        new THREE.Mesh(

                            new THREE.BoxGeometry(
                                sizeX,
                                sizeY,
                                sizeZ
                            ),

                            material
                        );


                    wall.position.set(
                        x,
                        y,
                        z
                    );


                    this.rootGroup.add(
                        wall
                    );


                    return wall;
                };


            // =================================
            // FLOOR
            // =================================

            makeWall(

                width,
                wallThickness,
                depth,

                0,
                -height / 2,
                0,

                floorMaterial
            );


            // =================================
            // CEILING
            // =================================

            makeWall(

                width,
                wallThickness,
                depth,

                0,
                height / 2,
                0
            );


            // =================================
            // LEFT WALL
            // SOLID
            // =================================

            makeWall(

                wallThickness,
                height,
                depth,

                -width / 2,
                0,
                0
            );


            // =================================
            // FRONT WALL
            // SOLID
            // =================================

            makeWall(

                width,
                height,
                wallThickness,

                0,
                0,
                -depth / 2
            );


            // =================================
            // BACK WALL
            // SOLID
            // =================================

            makeWall(

                width,
                height,
                wallThickness,

                0,
                0,
                depth / 2
            );


            // =================================
            // RIGHT WALL WITH WINDOW
            // =================================

            const windowWidth = 6;
            const windowHeight = 3.5;

            const windowCenterY = 0.4;


            // ---------------------------------
            // Pieces beside the window
            // Window width runs along Z now.
            // ---------------------------------

            const sideDepth =
                (
                    depth -
                    windowWidth
                ) / 2;


            // ---- one side of window

            makeWall(

                wallThickness,
                height,
                sideDepth,

                width / 2,
                0,

                -(
                    windowWidth / 2 +
                    sideDepth / 2
                )
            );


            // ---- other side of window

            makeWall(

                wallThickness,
                height,
                sideDepth,

                width / 2,
                0,

                (
                    windowWidth / 2 +
                    sideDepth / 2
                )
            );


            // ---------------------------------
            // BELOW WINDOW
            // ---------------------------------

            const windowBottom =
                windowCenterY -
                windowHeight / 2;


            const bottomHeight =
                windowBottom +
                height / 2;


            makeWall(

                wallThickness,
                bottomHeight,
                windowWidth,

                width / 2,

                -height / 2 +
                bottomHeight / 2,

                0
            );


            // ---------------------------------
            // ABOVE WINDOW
            // ---------------------------------

            const windowTop =
                windowCenterY +
                windowHeight / 2;


            const topHeight =
                height / 2 -
                windowTop;


            makeWall(

                wallThickness,
                topHeight,
                windowWidth,

                width / 2,

                windowTop +
                topHeight / 2,

                0
            );


            // =================================
            // WINDOW FRAME
            // =================================

            const frameMaterial =
                new THREE.MeshStandardMaterial({

                    color: 0x22252a,

                    metalness: 0.7,

                    roughness: 0.3
                });


            const frameThickness = 0.12;
            const frameDepth = 0.25;


            // ---------------------------------
            // TOP FRAME
            // ---------------------------------

            makeWall(

                frameDepth,
                frameThickness,
                windowWidth +
                frameThickness * 2,

                width / 2,

                windowCenterY +
                windowHeight / 2,

                0,

                frameMaterial
            );


            // ---------------------------------
            // BOTTOM FRAME
            // ---------------------------------

            makeWall(

                frameDepth,
                frameThickness,
                windowWidth +
                frameThickness * 2,

                width / 2,

                windowCenterY -
                windowHeight / 2,

                0,

                frameMaterial
            );


            // ---------------------------------
            // LEFT SIDE OF FRAME
            // ---------------------------------

            makeWall(

                frameDepth,
                windowHeight,
                frameThickness,

                width / 2,

                windowCenterY,

                -windowWidth / 2,

                frameMaterial
            );


            // ---------------------------------
            // RIGHT SIDE OF FRAME
            // ---------------------------------

            makeWall(

                frameDepth,
                windowHeight,
                frameThickness,

                width / 2,

                windowCenterY,

                windowWidth / 2,

                frameMaterial
            );


            // =================================
            // SIMPLE ROOM LIGHT
            // =================================

            const roomLight =
                new THREE.PointLight(

                    0xffe4c4,

                    25,

                    30

                );


            roomLight.position.set(
                0,
                height / 2 - 0.7,
                1
            );


            this.rootGroup.add(
                roomLight
            );


            // Tiny visible ceiling light
            const lightFixture =
                new THREE.Mesh(

                    new THREE.SphereGeometry(
                        0.15,
                        12,
                        8
                    ),

                    new THREE.MeshBasicMaterial({
                        color: 0xffeedd
                    })
                );


            lightFixture.position.copy(
                roomLight.position
            );


            this.rootGroup.add(
                lightFixture
            );
        }
    });