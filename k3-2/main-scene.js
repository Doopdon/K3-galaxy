const mainScene = new K3Scene({

    name: "K3 Galaxy",

    info:
        "Main test scene containing eight child planets.",

    size: 100,


    makeOutside(scene) {

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


    children: planetScenes

});