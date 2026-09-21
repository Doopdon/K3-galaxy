const starScene = new K3Scene({

    name: "Star Scene",

    info: "A star system viewed from outside.",

    size: 10,

    position: [30, 0, 0],

    makeOutside(scene) {

        return new THREE.Mesh(
            new THREE.SphereGeometry(
                scene.size,
                24,
                24
            ),

            new THREE.MeshBasicMaterial({
                color: 0x99ccff
            })
        );

    }

});
