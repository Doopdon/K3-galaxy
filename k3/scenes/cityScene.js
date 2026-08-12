const citySceneData = new SceneData({

    scale: 0.00001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [],

    populateScene: function () {

        const geometry =
            new THREE.BoxGeometry(
                0.2,
                0.2,
                0.2
            );

        const material =
            new THREE.MeshBasicMaterial({
                color: 0x0088ff
            });


        // Just a pile/grid of blue cubes for now
        for (let x = -5; x <= 5; x++) {

            for (let z = -5; z <= 5; z++) {

                const cube =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                cube.position.set(
                    x * 0.4,
                    0,
                    z * 0.4
                );

                this.rootGroup.add(cube);
            }
        }
    },

    animate: function (deltaTime) {

        // nothing yet

    }

});