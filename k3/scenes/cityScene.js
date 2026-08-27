const citySceneData = new SceneData({

    scale: 0.00001,

    timescale: 10,

    disapearDistance: 0.10,

    childScenes: [cylinderSceneData],


    populateScene: function () {

        const parentPyramid =
            this.parentCollider;


        // -----------------------------------
        // GET THE SIZE OF THE PARENT PYRAMID
        // -----------------------------------

        parentPyramid.geometry.computeBoundingBox();

        const box =
            parentPyramid.geometry.boundingBox;

        const size =
            new THREE.Vector3();

        box.getSize(size);


        // Apply the pyramid mesh's scale.
        size.multiply(
            parentPyramid.scale
        );


        // Convert from parent-scene units
        // into city-scene units.
        const scaleRatio =
            this.parentSceneData.scale /
            this.scale;

        size.multiplyScalar(
            scaleRatio
        );


        const height =
            size.y;

        const baseRadius =
            Math.min(
                size.x,
                size.z
            ) * 0.5;

        const cylinderMaterial = makeCylinderMaterial();


        // -----------------------------------
        // KEEP TRACK OF MOVING CYLINDERS
        // -----------------------------------

        this.cityCylinders = [];



        // -----------------------------------
        // CENTRAL TRUNK
        // -----------------------------------

        const trunkRadius =
            baseRadius * 0.08;

        const trunkHeight =
            height * 0.82;


        const trunkGeometry =
            new THREE.CylinderGeometry(
                trunkRadius,
                trunkRadius,
                trunkHeight,
                16
            );


        const trunk =
            new THREE.Mesh(
                trunkGeometry,
                cylinderMaterial
            );


        trunk.position.y =
            -height * 0.05;


        this.rootGroup.add(
            trunk
        );



        // -----------------------------------
        // RADIAL CYLINDER TIERS
        // -----------------------------------

        const tierCount = 11;


        for (
            let tier = 0;
            tier < tierCount;
            tier++
        ) {

            // 0 = bottom
            // 1 = top
            const t =
                tier /
                (tierCount - 1);


            // Keep away from absolute bottom/top
            const y =
                -height * 0.38 +
                t * height * 0.70;


            // Pyramid becomes narrower
            // toward the top.
            const availableRadius =
                baseRadius *
                (1.0 - t * 0.82);


            // More cylinders near the bottom,
            // fewer near the top.
            const spokeCount =
                Math.max(
                    4,
                    Math.round(
                        12 -
                        t * 6
                    )
                );

            const minBranchLength =
                availableRadius * 0.45;

            const maxBranchLength =
                availableRadius * 0.95;


            for (
                let i = 0;
                i < spokeCount;
                i++
            ) {

                const cylinderLength =
                    THREE.MathUtils.lerp(
                        minBranchLength,
                        maxBranchLength,
                        Math.random()
                    );

                const cylinderRadius =
                    Math.max(
                        baseRadius * 0.025,
                        availableRadius * 0.06
                    );

                const geometry =
                    new THREE.CylinderGeometry(

                        cylinderRadius,
                        cylinderRadius,

                        cylinderLength,

                        12

                    );

                // Offset alternating tiers
                // so they don't make straight columns.
                const angle =
                    (
                        i /
                        spokeCount
                    ) *
                    Math.PI *
                    2
                    +
                    tier * 0.27;


                const direction =
                    new THREE.Vector3(

                        Math.cos(angle),

                        0,

                        Math.sin(angle)

                    );


                const cylinder =
                    new THREE.Mesh(
                        geometry,
                        cylinderMaterial
                    );


                // -----------------------------------
                // BOX COLLIDER
                // -----------------------------------
                //
                // CylinderGeometry:
                // X/Z = diameter
                // Y   = length
                //
                // So this box exactly surrounds
                // the cylinder.

                const colliderGeometry =
                    new THREE.BoxGeometry(
                        cylinderRadius * 5,
                        cylinderLength * 2,
                        cylinderRadius * 5
                    );


                const colliderMaterial =
                    new THREE.MeshBasicMaterial({
                        visible: false
                    });


                const collider =
                    new THREE.Mesh(
                        colliderGeometry,
                        colliderMaterial
                    );


                // Make the collider follow the cylinder.
                //
                // Since it is a child, it automatically
                // inherits the cylinder's position,
                // rotation, and spinning.
                cylinder.add(
                    collider
                );


                // THIS is now the thing we collide with.
                this.addCollider(
                    collider
                );


                // Draw the debug wireframe around
                // the actual box collider.
                // showCollider(
                //     collider
                // );


                // Position it halfway outward
                // from the trunk.
                const centerDistance =
                    trunkRadius +
                    cylinderLength * 0.48;


                cylinder.position.set(

                    direction.x *
                    centerDistance,

                    y,

                    direction.z *
                    centerDistance

                );


                // CylinderGeometry normally
                // points along +Y.
                //
                // Rotate +Y so it points
                // outward from the trunk.

                cylinder.quaternion
                    .setFromUnitVectors(

                        new THREE.Vector3(
                            0,
                            1,
                            0
                        ),

                        direction

                    );


                // Different cylinders rotate
                // at slightly different speeds.
                cylinder.userData.spinSpeed =
                    0.5;


                this.cityCylinders.push(
                    cylinder
                );


                this.rootGroup.add(
                    cylinder
                );
            }
        }
    },


    animate: function (deltaTime) {

        if (!this.cityCylinders) {
            return;
        }


        for (
            const cylinder
            of this.cityCylinders
        ) {

            // rotate around the cylinder's
            // OWN long axis
            cylinder.rotateY(

                cylinder.userData.spinSpeed *
                deltaTime

            );
        }
    }

});

function makeCylinderMaterial() {
    // -----------------------------------
    // METALLIC TEXTURE + TINY WINDOWS
    // -----------------------------------

    const canvas =
        document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 128;

    const ctx =
        canvas.getContext("2d");


    // dark metallic base
    ctx.fillStyle = "#24272b";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // subtle metal bands
    for (
        let x = 0;
        x < canvas.width;
        x += 32
    ) {

        ctx.fillStyle = "#4a4f54";

        ctx.fillRect(
            x,
            0,
            10,
            canvas.height
        );


        ctx.fillStyle = "#303438";

        ctx.fillRect(
            x + 10,
            0,
            19,
            canvas.height
        );


        ctx.fillStyle = "#737980";

        ctx.fillRect(
            x + 29,
            0,
            3,
            canvas.height
        );
    }



    // -----------------------------------
    // EMISSIVE TEXTURE
    // -----------------------------------

    const glowCanvas =
        document.createElement("canvas");

    glowCanvas.width = 256;
    glowCanvas.height = 128;

    const glowCtx =
        glowCanvas.getContext("2d");


    glowCtx.fillStyle = "#000000";

    glowCtx.fillRect(
        0,
        0,
        glowCanvas.width,
        glowCanvas.height
    );



    // -----------------------------------
    // RANDOM WINDOWS
    // -----------------------------------

    const windowCount = 110;


    for (
        let i = 0;
        i < windowCount;
        i++
    ) {

        const x =
            Math.floor(
                Math.random() *
                canvas.width
            );


        const y =
            Math.floor(
                Math.random() *
                canvas.height
            );


        // Tiny rectangular windows
        const width =
            Math.random() < 0.8
                ? 1
                : 2;


        const height =
            Math.random() < 0.85
                ? 1
                : 2;


        // Mostly warm yellow,
        // some red/orange.
        const isRed =
            Math.random() < 0.28;


        const color =
            isRed
                ? "#ff3b18"
                : "#ffd35a";


        ctx.fillStyle =
            color;

        ctx.fillRect(
            x,
            y,
            width,
            height
        );


        // same window in emissive map
        glowCtx.fillStyle =
            color;

        glowCtx.fillRect(
            x,
            y,
            width,
            height
        );
    }



    // -----------------------------------
    // CREATE TEXTURES
    // -----------------------------------

    const cylinderTexture =
        new THREE.CanvasTexture(
            canvas
        );

    cylinderTexture.wrapS =
        THREE.RepeatWrapping;

    cylinderTexture.wrapT =
        THREE.RepeatWrapping;

    cylinderTexture.repeat.set(
        4,
        8
    );



    const glowTexture =
        new THREE.CanvasTexture(
            glowCanvas
        );

    glowTexture.wrapS =
        THREE.RepeatWrapping;

    glowTexture.wrapT =
        THREE.RepeatWrapping;

    glowTexture.repeat.set(
        4,
        8
    );



    // -----------------------------------
    // MATERIAL
    // -----------------------------------

    return new THREE.MeshStandardMaterial({

            map:
                cylinderTexture,

            metalness:
                0.9,

            roughness:
                0.3,

            emissive:
                0xffffff,

            emissiveMap:
                glowTexture,

            emissiveIntensity:
                2.5

        });
}