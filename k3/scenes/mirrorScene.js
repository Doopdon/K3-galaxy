const nationSceneData = new SceneData({

    scale: 0.0001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [],

    populateScene: function () {

        const gridSize = 2;
        const spacing = 0.6;

        const geometry =
            new THREE.BoxGeometry(
                0.4,
                0.4,
                0.4
            );

        const material =
            new THREE.MeshBasicMaterial({
                color: 0x00ff00
            });


        // -------------------------
        // CUBES
        // -------------------------

        for (let x = 0; x < gridSize; x++) {

            for (let z = 0; z < gridSize; z++) {

                const cube =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                cube.position.set(
                    (x - gridSize / 2) * spacing,
                    0,
                    (z - gridSize / 2) * spacing
                );

                this.rootGroup.add(cube);
            }
        }


        // -------------------------
        // BIG MIRROR
        // -------------------------

        const mirror =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.05,
            8,
            12
        ),

        new THREE.MeshBasicMaterial({
            color: 0x0088ff
        })
    );


        // Put it beside the cubes.
        // Since it is thin in X, its face is
        // perpendicular to the cube ground plane.
        mirror.position.set(
            3,
            3,
            0
        );

        this.rootGroup.add(mirror);
    },

    animate: function (deltaTime) {

        // nothing yet

    }

});