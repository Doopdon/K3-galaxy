const mainScene = new K3Scene({

    name: "K3 Galaxy",

    info:
        "A galaxy filled with a red web of momentum-exchange routes and heavily engineered stars.",

    size: 100,

    makeOutside(scene) {

        // Placeholder galaxy
        return new THREE.Mesh(
            new THREE.SphereGeometry(
                scene.size,
                32,
                32
            ),
            new THREE.MeshBasicMaterial({
                color: 0xaa2222,
                wireframe: true
            })
        );
    },

    children: [
        starScene
    ]

});