function main() {

    const game = new K3Game();

    game.load(mainScene);

    // Start inside the universe, looking at the galaxies from outside.
    game.camera.position.set(0, 0, 900);
    mainScene.enter();

    game.shuttleSystem = new K3ShuttleSystem(game, galaxyScenes);
    game.shuttleSystem.startRide(0);

    return game;
}

const game = main();
