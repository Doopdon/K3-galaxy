const planetScenes = [];

const d = 45;       // distance from center on each axis
const planetSize = 10;

const colors = [
    0xff5555,
    0x55ff55,
    0x5555ff,
    0xffff55,
    0xff55ff,
    0x55ffff,
    0xff9955,
    0xffffff
];

let index = 0;


// Every combination of:
//
// x = -45 or +45
// y = -45 or +45
// z = -45 or +45
//
// gives us the 8 corners of a cube.

for (const x of [-d, d]) {

    for (const y of [-d, d]) {

        for (const z of [-d, d]) {

            const color = colors[index];

            const planet = new K3Scene({

                name: "Planet " + (index + 1),

                info:
                    "Test planet at one corner of the cube.",

                size: planetSize,

                position: [
                    x,
                    y,
                    z
                ],

                makeOutside(scene) {

                    return new THREE.Mesh(

                        new THREE.SphereGeometry(
                            scene.size,
                            32,
                            32
                        ),

                        new THREE.MeshBasicMaterial({
                            color: color
                        })

                    );

                }

            });


            planetScenes.push(
                planet
            );

            index++;
        }
    }
}