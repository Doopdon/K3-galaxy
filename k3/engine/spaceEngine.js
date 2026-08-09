const mainSceneData = galaxySceneData;

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

const renderer =
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
        galaxySceneData.scene,
        galaxySceneData.camera
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

const UP_CHANGE_DELAY = 500;

let upScene =
    activeSceneStack[
    activeSceneStack.length - 1
    ];

let pendingUpScene = null;
let pendingUpSince = 0;


function getCurrentUp() {

    const currentScene =
        activeSceneStack[
        activeSceneStack.length - 1
        ];


    // We're still in the scene whose
    // orientation we're already using.
    if (currentScene === upScene) {

        pendingUpScene = null;

        return upScene.getWorldUp();
    }


    // We just entered a different scene.
    // Start the half-second timer.
    if (currentScene !== pendingUpScene) {

        pendingUpScene =
            currentScene;

        pendingUpSince =
            performance.now();
    }


    // Have we stayed in that scene
    // for half a second?
    if (
        performance.now() -
        pendingUpSince >
        UP_CHANGE_DELAY
    ) {

        upScene =
            pendingUpScene;

        pendingUpScene =
            null;

        // NOW adopt the new north pole
        upScene.alignCameraUp();
    }


    return upScene.getWorldUp();
}


// Rotate left/right around the current scene's "north pole"
function yawCamera(camera, amount) {

    const up = getCurrentUp();

    const rotation =
        new THREE.Quaternion()
            .setFromAxisAngle(up, amount);

    camera.quaternion.premultiply(rotation);
}


// Rotate up/down around the camera's own right axis
function pitchCamera(camera, amount) {

    const up = getCurrentUp().normalize();

    const forward =
        new THREE.Vector3(0, 0, -1)
            .applyQuaternion(camera.quaternion)
            .normalize();


    // Current pitch relative to the current "up"
    const currentPitch = Math.asin(
        THREE.MathUtils.clamp(
            forward.dot(up),
            -1,
            1
        )
    );


    const maxPitch =
        Math.PI / 2 - 0.01;


    // Clamp where we're allowed to end up
    const targetPitch =
        THREE.MathUtils.clamp(
            currentPitch + amount,
            -maxPitch,
            maxPitch
        );


    // Only rotate by the amount we're actually allowed
    const actualAmount =
        targetPitch - currentPitch;


    // Right direction, perpendicular to both
    // where we're looking and the current up axis
    const right =
        forward.clone()
            .cross(up)
            .normalize();


    // If we're effectively exactly at a pole,
    // the cross product can become unusably tiny
    if (right.lengthSq() < 0.000001) {
        return;
    }


    const rotation =
        new THREE.Quaternion()
            .setFromAxisAngle(
                right,
                actualAmount
            );


    camera.quaternion.premultiply(rotation);
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


    // Movement stays relative to camera
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


    // Keyboard look controls now use the
    // exact same local-up system as the mouse

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

camera.position.set(
    0,
    115,
    890
);

camera.lookAt(
    0,
    0,
    0
);



function run() {
    setTimeout(() => {

        const deltaTime = clock.getDelta();

        moveCamera();

        renderer.clear();

        let timers = [0];

        activeSceneStack.forEach((data, i) => {

            if (i !== 0) {

                data.camera.rotation.copy(
                    activeSceneStack[0].camera.rotation
                );

                data.camera.position
                    .copy(activeSceneStack[0].camera.position)
                    .multiplyScalar(1 / data.scale);

                renderer.clearDepth();
            }

            data.checkCollision?.();

            data.update?.(deltaTime);

            if (activeSceneStack == 1 && data === galaxySceneData) {
                composer.render();
            }

            else if (data === galaxySceneData && timers[0]++ >= 10) {
                timers[0] = 0;
                composer.render();

            } else {

                renderer.render(
                    data.scene,
                    data.camera
                );
            }
        });

        const currentScene =
            activeSceneStack[
            activeSceneStack.length - 1
            ];

        const up = getCurrentUp();

        scenesData[0].camera.up.copy(up);

        run();

    }, 10);
}

