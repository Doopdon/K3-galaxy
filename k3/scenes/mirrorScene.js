const mirrorSceneData = new SceneData({

    scale: 0.0001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [citySceneData],

    populateScene: function () {

        const parentMirror = this.parentCollider;

        const scaleRatio =
            this.parentSceneData.scale /
            this.scale;


        const mirror =
            parentMirror.clone();


        // Clone parent's material
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


        // Give THIS scene the same environment
        const environmentTexture =
            this.parentSceneData.environmentTexture;

        if (environmentTexture) {

            this.scene.environment =
                environmentTexture;

            this.scene.environmentIntensity =
                0.5;
        }


        mirror.visible = true;

        this.rootGroup.add(mirror);

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


        for (let x = 0; x < 2; x++) {

            for (let z = 0; z < 2; z++) {

                const cube =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                cube.position.set(
                    0.5,
                    (x - 1) * 0.6,
                    (z - 1) * 0.6
                );

                this.rootGroup.add(cube);
                this.addCollider(cube);
            }
        }
    },

    animate: function (deltaTime) {

        // nothing yet

    }

});