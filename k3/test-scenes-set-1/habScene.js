const redSphereSceneData = new HabSceneData({

    scale: 0.01,

    timescale: 10,

    disapearDistance: 1.5,

    childScenes: [],


    populateScene: function () {

        const group = new THREE.Group();

        // Weird orbital-plane tilt
        group.rotation.x = 0.65;
        group.rotation.z = 0.35;

        this.localUp = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(group.quaternion)
            .normalize();


        const habitatTexture =
            createHabitatTexture();


        for (let i = 0; i < 4; i++) {

            const cylinder = new THREE.Mesh(

                new THREE.CylinderGeometry(
                    1,      // top radius
                    1,      // bottom radius
                    4,      // length
                    32      // segments
                ),

                new THREE.MeshBasicMaterial({
                    map: habitatTexture
                })
            );


            const angle =
                (i / 4) * Math.PI * 2;


            cylinder.position.set(
                Math.cos(angle) * 5,
                0,
                Math.sin(angle) * 5
            );


            group.add(cylinder);

            this.addCollider(cylinder);
        }


        this.rootGroup.add(group);

        this.orbitGroup = group;
    },


    animate: function (deltaTime) {

        if (!this.orbitGroup) return;


        // Whole habitat system orbits
        const axis =
            new THREE.Vector3(0, 1, 0);

        this.orbitGroup.rotateOnAxis(
            axis,
            1.0 * deltaTime
        );


        // Each cylinder spins around its OWN long axis
        for (const habitat of this.orbitGroup.children) {

            habitat.rotateY(
                2.0 * deltaTime
            );
        }
    }
});
