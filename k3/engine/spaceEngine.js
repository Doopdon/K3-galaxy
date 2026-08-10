const activeSceneStack = [
    mainSceneData
];
// start sim
const scenesData = [mainSceneData];

function addChildScenes(parentSceneData) {

    parentSceneData.childScenes.forEach(childScene => {
        scenesData.push(childScene);
    });

    parentSceneData.childScenes.forEach(childScene => {
        addChildScenes(childScene);
    });
}

addChildScenes(mainSceneData);

window.renderer =
    new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance"
    });

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure =
    1.12;

renderer.autoClear = false;

document.body.appendChild(
    renderer.domElement
);

const composer =
    new EffectComposer(renderer);

composer.addPass(
    new RenderPass(
        mainSceneData.scene,
        mainSceneData.camera
    )
);

const bloomPass =
    new UnrealBloomPass(
        new THREE.Vector2(
            window.innerWidth,
            window.innerHeight
        ),
        0.95,
        0.72,
        0.06
    );

composer.addPass(
    bloomPass
);



let keys = {};


function yawCamera(camera, amount) {
    camera.rotateY(amount);
}

function pitchCamera(camera, amount) {
    camera.rotateX(amount);
}

function rollCamera(camera, amount) {
    camera.rotateZ(amount);
}

function addEventHandlers() {

    const mainCamera = scenesData[0].camera;

    addEventListener(
        "keydown",
        e => keys[e.key.toLowerCase()] = true
    );

    addEventListener(
        "keyup",
        e => keys[e.key.toLowerCase()] = false
    );

    renderer.domElement.addEventListener(
        "click",
        () => renderer.domElement.requestPointerLock()
    );

    addEventListener("mousemove", e => {

        if (
            document.pointerLockElement !==
            renderer.domElement
        ) return;

        yawCamera(
            mainCamera,
            -e.movementX * 0.002
        );

        pitchCamera(
            mainCamera,
            -e.movementY * 0.002
        );
    });
}

let speed = 1;

function moveCamera() {

    const mainCamera = scenesData[0].camera;

    // Movement
    if (keys["w"])
        mainCamera.translateZ(-speed);

    if (keys["s"])
        mainCamera.translateZ(speed);

    if (keys["a"])
        mainCamera.translateX(-speed);

    if (keys["d"])
        mainCamera.translateX(speed);


    // Speed
    if (keys["f"])
        speed *= 1.1;

    if (keys["r"])
        speed /= 1.1;


    if (keys["q"])
        rollCamera(mainCamera, 0.01);

    if (keys["e"])
        rollCamera(mainCamera, -0.01);

    if (keys["arrowleft"])
        yawCamera(mainCamera, 0.01);

    if (keys["arrowright"])
        yawCamera(mainCamera, -0.01);

    if (keys["arrowup"])
        pitchCamera(mainCamera, 0.01);

    if (keys["arrowdown"])
        pitchCamera(mainCamera, -0.01);
}

scenesData[0].populateScene();

addEventHandlers();
const clock = new THREE.Clock();

function updateTimeScales() {

    let slowdown = 1;

    for (let i = activeSceneStack.length - 1; i >= 0; i--) {

        const sceneData = activeSceneStack[i];

        sceneData.speedMultiplier = 1 / slowdown;

        slowdown *= sceneData.timescale;
    }
}

const camera = scenesData[0].camera;

camera.position.set(...cam_position);

camera.lookAt(...cam_lookAt);


function run() {
    setTimeout(() => {

        const deltaTime = clock.getDelta();

        moveCamera();

        renderer.clear();

        let timers = [0];

        activeSceneStack.forEach((data, i) => {

            if (i !== 0) {

                data.camera.quaternion.copy(
                    activeSceneStack[0].camera.quaternion
                );

                data.camera.position
                    .copy(activeSceneStack[0].camera.position)
                    .multiplyScalar(1 / data.scale);

                renderer.clearDepth();
            }

            data.checkCollision?.();

            data.update?.(deltaTime);

            if (activeSceneStack == 1 && data === mainSceneData) {
                composer.render();
            }

            else if (data === mainSceneData && timers[0]++ >= 10) {
                timers[0] = 0;
                composer.render();

            } else {

                renderer.render(
                    data.scene,
                    data.camera
                );
            }
        });

        run();

    }, 10);
}

