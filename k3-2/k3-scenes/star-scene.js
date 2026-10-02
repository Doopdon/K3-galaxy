const starScene = new K3Scene({

    name: "Star Scene",

    info: "A star system viewed from outside.",

    size: 10,

    position: [30, 0, 0],

    makeOutside(scene) {

        const group = new THREE.Group();

        // Blue outer sphere
        const outerSphere = new THREE.Mesh(
            new THREE.SphereGeometry(
                scene.size,
                24,
                24
            ),
            new THREE.MeshBasicMaterial({
                color: 0x99ccff,
                wireframe: true
            })
        );

        group.add(outerSphere);


        // Star in the center
        const star = new THREE.Mesh(
            new THREE.SphereGeometry(
                scene.size * 0.25,
                24,
                24
            ),
            new THREE.MeshBasicMaterial({
                color: 0x00ff66
            })
        );

        group.add(star);

        return group;
    }

});
