const nationSceneData = new SceneData({

    scale: 0.0001,

    timescale: 10,

    disapearDistance: 1.0,

    childScenes: [],

    populateScene: function () {

        const parentMirror = this.parentCollider;

        const scaleRatio =
            this.parentSceneData.scale /
            this.scale;


        // Clone the actual parent mirror
        const mirror =
            parentMirror.clone();


        // We don't want to share the material,
        // because we'll modify this version.
        mirror.material =
            new THREE.MeshBasicMaterial({
                color: 0x0088ff
            });


        // rootGroup already inherits the parent's
        // position + rotation, so reset these.
        mirror.position.set(0, 0, 0);

        mirror.quaternion.identity();


        // Convert parent-scene size into child-scene size.
        mirror.scale.copy(
            parentMirror.scale
        );

        mirror.scale.multiplyScalar(
            scaleRatio
        );


        // Give the close-up version a better material.
        mirror.material =
            parentMirror.material.clone();


        mirror.material =
            new THREE.MeshBasicMaterial({
                color: 0x0088ff
            });

        mirror.visible = true;

        this.rootGroup.add(mirror);


        // -------------------------
        // TEST CUBES / NATIONS
        // -------------------------

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
            }
        }
    },

    animate: function (deltaTime) {

        // nothing yet

    }

});