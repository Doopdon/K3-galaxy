const mainSceneData = new GalaxySceneData({

    scale: 1,

    timescale: 1,

    disapearDistance: 1.5,

    childScenes: [
        cubeSceneData
    ],


    getSubSceneData: function (sphere) {

        return cubeSceneData;
    },


    populateScene: function () {

        const group = new THREE.Group();


        for (let i = 0; i < 4; i++) {

            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(1, 32, 32),
                new THREE.MeshBasicMaterial({
                    color: "green"
                })
            );


            const angle =
                (i / 4) * Math.PI * 2;

            sphere.position.set(
                Math.cos(angle) * 5,
                0,
                Math.sin(angle) * 5
            );


            group.add(sphere);

            // Sphere can be entered
            this.addCollider(sphere);
        }


        this.scene.add(group);

        this.orbitGroup = group;


        // ----------------------
        // Background stars
        // ----------------------

        const starCount = 2000;

        const starPositions =
            new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {

            // Keep stars well outside the test area
            const distance =
                100 + Math.random() * 300;

            const theta =
                Math.random() * Math.PI * 2;

            const phi =
                Math.acos(2 * Math.random() - 1);


            starPositions[i * 3] =
                distance * Math.sin(phi) * Math.cos(theta);

            starPositions[i * 3 + 1] =
                distance * Math.cos(phi);

            starPositions[i * 3 + 2] =
                distance * Math.sin(phi) * Math.sin(theta);
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


        this.scene.add(stars);
    },


    animate: function (deltaTime) {

        if (!this.orbitGroup) return;

        this.orbitGroup.rotation.y +=
            1.0 * deltaTime;
    }
});
