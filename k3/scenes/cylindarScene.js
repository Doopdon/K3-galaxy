const cylinderSceneData = new SceneData({

    scale: 0.000001,

    timescale: 10,

    disapearDistance: 0.05,

    childScenes: [],


    populateScene: function () {

        const parentCylinder =
            this.parentCollider;


        // -----------------------------------
        // GET PARENT CYLINDER SIZE
        // -----------------------------------

        parentCylinder.geometry.computeBoundingBox();

        const box =
            parentCylinder.geometry.boundingBox;

        const size =
            new THREE.Vector3();

        box.getSize(size);


        // Include any scaling on the actual mesh.
        size.multiply(
            parentCylinder.scale
        );


        // Convert parent scene units
        // into this scene's units.
        const scaleRatio =
            this.parentSceneData.scale /
            this.scale;

        size.multiplyScalar(
            scaleRatio
        );


        // CylinderGeometry uses Y
        // as its long axis.
        const cylinderLength =
            size.y/2;

        const cylinderRadius =
            Math.min(
                size.x/2,
                size.z/2
            ) * 0.5;



        // -----------------------------------
        // MATERIAL
        // -----------------------------------

        const material = makeCylinderMaterial();

        material.map.repeat.set(
            1,
            1
        );

        material.emissiveMap.repeat.set(
            1,
            1
        );

        const textureTileSize =
            cylinderRadius * 0.06;

        // -----------------------------------
        // RANDOM RADIAL STRUCTURES
        // -----------------------------------

        const structureCount =
            500;


        for (
            let i = 0;
            i < structureCount;
            i++
        ) {

            // Random location along
            // the length of the cylinder.
            const y =
                (
                    Math.random() - 0.5
                ) *
                cylinderLength;


            // Random angle around
            // the central axis.
            const angle =
                Math.random() *
                Math.PI *
                2;


            // -----------------------------------
            // RANDOM BUILDING SIZE
            // -----------------------------------

            // radial length
            const radialLength =
                cylinderRadius *
                (
                    0.08 +
                    Math.random() *
                    0.30
                );


            // width around circumference
            const width =
                cylinderRadius *
                (
                    0.025 +
                    Math.random() *
                    0.07
                );


            // length along cylinder axis
            const axialLength =
                cylinderLength *
                (
                    0.004 +
                    Math.random() *
                    0.02
                );


            const geometry =
                new THREE.BoxGeometry(
                    width,
                    axialLength,
                    radialLength
                );


            tileBoxUVs(
                geometry,

                width,
                axialLength,
                radialLength,

                textureTileSize
            );


            const structure =
                new THREE.Mesh(

                    geometry,

                    material

                );



            // -----------------------------------
            // POSITION
            // -----------------------------------

            // Put the center of the building
            // somewhere between the center axis
            // and outer edge.
            //
            // Bias toward the outside so it
            // resembles a cylindrical city.

            const startRadius =
                cylinderRadius * 0.5;


            // Center must be half the building's
            // radial length beyond its starting point.
            const radialPosition =
                startRadius +
                radialLength * 0.5;


            structure.position.set(

                Math.sin(angle) *
                radialPosition,

                y,

                Math.cos(angle) *
                radialPosition

            );


            // BoxGeometry's long radial direction
            // is local Z, so rotate local Z outward.
            structure.rotation.set(
                0,
                angle,
                0
            );



            // -----------------------------------
            // ROTATE BUILDING OUTWARD
            // -----------------------------------

            structure.rotation.y =
                angle;



            this.rootGroup.add(
                structure
            );
        }



        // -----------------------------------
        // DIM CENTRAL CORE
        // -----------------------------------

        // Helps visually establish the
        // cylinder's central axis.

        const coreGeometry =
            new THREE.CylinderGeometry(

                cylinderRadius * 0.5,

                cylinderRadius * 0.5,

                cylinderLength,

                64

            );


        const core =
            new THREE.Mesh(

                coreGeometry,

                material

            );


        this.rootGroup.add(
            core
        );



        // -----------------------------------
        // LIGHT
        // -----------------------------------

        const light =
            new THREE.AmbientLight(

                0xffffff,

                0.7

            );

        this.rootGroup.add(
            light
        );
    },


    animate: function (deltaTime) {

        // stationary for now

    }

});

function tileBoxUVs(
    geometry,
    width,
    height,
    depth,
    tileSize
) {

    const uv =
        geometry.attributes.uv;


    function setFace(
        start,
        uRepeat,
        vRepeat
    ) {

        uRepeat =
            Math.max(
                1,
                uRepeat
            );

        vRepeat =
            Math.max(
                1,
                vRepeat
            );


        uv.setXY(
            start + 0,
            0,
            vRepeat
        );

        uv.setXY(
            start + 1,
            uRepeat,
            vRepeat
        );

        uv.setXY(
            start + 2,
            0,
            0
        );

        uv.setXY(
            start + 3,
            uRepeat,
            0
        );
    }


    // +X
    setFace(
        0,
        depth / tileSize,
        height / tileSize
    );

    // -X
    setFace(
        4,
        depth / tileSize,
        height / tileSize
    );

    // +Y
    setFace(
        8,
        width / tileSize,
        depth / tileSize
    );

    // -Y
    setFace(
        12,
        width / tileSize,
        depth / tileSize
    );

    // +Z
    setFace(
        16,
        width / tileSize,
        height / tileSize
    );

    // -Z
    setFace(
        20,
        width / tileSize,
        height / tileSize
    );


    uv.needsUpdate = true;
}