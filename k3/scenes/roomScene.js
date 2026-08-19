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
            // FIND WHERE THE PLAYER ACTUALLY IS
            // IN THIS SCENE
            // --------------------------------

            this.scene.updateMatrixWorld(true);


            const mainCamera =
                scenesData[0].camera;


            // Same conversion your engine uses
            // when syncing child-scene cameras.
            const cameraInScene =
                mainCamera.position
                    .clone()
                    .multiplyScalar(
                        1 / this.scale
                    );


            // Convert into rootGroup-local space.
            const roomCenter =
                this.rootGroup.worldToLocal(
                    cameraInScene
                );


            // --------------------------------
            // PUT THE PLAYER NEAR THE FLOOR
            // --------------------------------
            //
            // +Z = floor / radial outward
            // -Z = ceiling / radial inward
            //
            // Put the floor about 1.6 units
            // below the camera.

            const standingHeight = 1.6;


            roomCenter.z -=
                height / 2 -
                standingHeight;



            // --------------------------------
            // MATERIALS
            // --------------------------------

            const wallMaterial =
                new THREE.MeshStandardMaterial({

                    color: 0xb8b1a5,

                    roughness: 0.8,

                    metalness: 0,

                    side:
                        THREE.DoubleSide
                });


            const floorMaterial =
                new THREE.MeshStandardMaterial({

                    color: 0x403b35,

                    roughness: 0.9,

                    side:
                        THREE.DoubleSide
                });


            // --------------------------------
            // HELPER
            // --------------------------------
            //
            // All coordinates are relative
            // to roomCenter now.

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

                        roomCenter.x + x,

                        roomCenter.y + y,

                        roomCenter.z + z

                    );


                    this.rootGroup.add(
                        wall
                    );


                    return wall;
                };


            // =================================
            // FLOOR
            // RADIAL OUTWARD (+Z)
            // =================================

            makeWall(

                width,
                depth,
                wallThickness,

                0,
                0,
                height / 2,

                floorMaterial
            );


            // =================================
            // CEILING
            // RADIAL INWARD (-Z)
            // =================================

            makeWall(

                width,
                depth,
                wallThickness,

                0,
                0,
                -height / 2
            );


            // =================================
            // LEFT WALL
            // =================================

            makeWall(

                wallThickness,
                depth,
                height,

                -width / 2,
                0,
                0
            );


            // =================================
            // FRONT WALL
            // =================================

            makeWall(

                width,
                wallThickness,
                height,

                0,
                -depth / 2,
                0
            );


            // =================================
            // BACK WALL
            // =================================

            makeWall(

                width,
                wallThickness,
                height,

                0,
                depth / 2,
                0
            );


            // =================================
            // RIGHT WALL WITH WINDOW
            // =================================

            const windowWidth = 6;

            const windowHeight = 3.5;

            const windowCenterZ = 0;


            // --------------------------------
            // SIDES OF WINDOW
            // --------------------------------

            const sideDepth =
                (
                    depth -
                    windowWidth
                ) / 2;


            makeWall(

                wallThickness,
                sideDepth,
                height,

                width / 2,

                -(
                    windowWidth / 2 +
                    sideDepth / 2
                ),

                0
            );


            makeWall(

                wallThickness,
                sideDepth,
                height,

                width / 2,

                (
                    windowWidth / 2 +
                    sideDepth / 2
                ),

                0
            );


            // =================================
            // ABOVE WINDOW
            // toward ceiling (-Z)
            // =================================

            const ceilingEdge =
                -height / 2;


            const windowTop =
                windowCenterZ -
                windowHeight / 2;


            const topHeight =
                windowTop -
                ceilingEdge;


            makeWall(

                wallThickness,
                windowWidth,
                topHeight,

                width / 2,
                0,

                ceilingEdge +
                topHeight / 2
            );


            // =================================
            // BELOW WINDOW
            // toward floor (+Z)
            // =================================

            const floorEdge =
                height / 2;


            const windowBottom =
                windowCenterZ +
                windowHeight / 2;


            const bottomHeight =
                floorEdge -
                windowBottom;


            makeWall(

                wallThickness,
                windowWidth,
                bottomHeight,

                width / 2,
                0,

                windowBottom +
                bottomHeight / 2
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


            // top
            makeWall(

                frameDepth,

                windowWidth +
                frameThickness * 2,

                frameThickness,

                width / 2,

                0,

                windowCenterZ -
                windowHeight / 2,

                frameMaterial
            );


            // bottom
            makeWall(

                frameDepth,

                windowWidth +
                frameThickness * 2,

                frameThickness,

                width / 2,

                0,

                windowCenterZ +
                windowHeight / 2,

                frameMaterial
            );


            // left
            makeWall(

                frameDepth,

                frameThickness,

                windowHeight,

                width / 2,

                -windowWidth / 2,

                windowCenterZ,

                frameMaterial
            );


            // right
            makeWall(

                frameDepth,

                frameThickness,

                windowHeight,

                width / 2,

                windowWidth / 2,

                windowCenterZ,

                frameMaterial
            );


            // =================================
            // CEILING LIGHT
            // =================================

            const roomLight =
                new THREE.PointLight(

                    0xffe4c4,

                    25,

                    30
                );


            // Ceiling is -Z.
            // Move slightly toward the room (+Z)
            // so the light isn't buried in it.
            roomLight.position.set(

                roomCenter.x,

                roomCenter.y,

                roomCenter.z -
                height / 2 +
                0.4

            );


            this.rootGroup.add(
                roomLight
            );


            // --------------------------------
            // VISIBLE CEILING FIXTURE
            // --------------------------------

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


            lightFixture.position.set(

                roomCenter.x,

                roomCenter.y,

                roomCenter.z -
                height / 2 +
                0.18

            );


            this.rootGroup.add(
                lightFixture
            );
        }
    });