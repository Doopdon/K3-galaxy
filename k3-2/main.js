function main() {

    const game = new K3Game();

    game.load(mainScene);

    // Start inside the universe, looking at the galaxies from outside.
    game.camera.position.set(...sceneSetup.startPosition);
    game.pitch = sceneSetup.startPitch;
    game.camera.rotation.set(game.pitch, 0, 0);
    mainScene.enter();

    if (sceneSetup.shuttles) {
        game.shuttleSystem = new K3ShuttleSystem(game, galaxyScenes);
        game.shuttleSystem.startRide(0);
    }

    return game;
}

const game = main();
