const cubeSceneData = new SceneData({

    scale: 0.1,

    timescale: 10,

    disapearDistance: 1.5,

    childScenes: [
        redSphereSceneData
    ],

    getSubSceneData: function (cube) {
        return redSphereSceneData;
    },


    populateScene: function () {

        const group = new THREE.Group();

        for (let i = 0; i < 4; i++) {

            const cube = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({
                    color: "yellow"
                })
            );

            const angle =
                (i / 4) * Math.PI * 2;

            cube.position.set(
                Math.cos(angle) * 5,
                0,
                Math.sin(angle) * 5
            );

            group.add(cube);

            this.addCollider(cube);
        }

        this.rootGroup.add(group);

        this.orbitGroup = group;
    },

    animate: function (deltaTime) {

        if (!this.orbitGroup) return;

        // this.orbitGroup.rotation.y +=
        //     1.0 * deltaTime;
    }
});
