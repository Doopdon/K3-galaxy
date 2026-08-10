function captureSkybox(
    renderer,
    scene,
    position,
    resolution = 128
) {
    const target =
        new THREE.WebGLCubeRenderTarget(
            resolution,
            {
                type: THREE.HalfFloatType,

                generateMipmaps: true,

                minFilter:
                    THREE.LinearMipmapLinearFilter
            }
        );

    const cubeCamera =
        new THREE.CubeCamera(
            0.1,
            10000,
            target
        );

    cubeCamera.position.copy(position);

    scene.add(cubeCamera);

    cubeCamera.update(
        renderer,
        scene
    );

    scene.remove(cubeCamera);


    // Keep the render target alive along with the texture.
    target.texture.userData.renderTarget =
        target;

    return target.texture;
}