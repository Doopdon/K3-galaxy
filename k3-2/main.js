function main() {

    const game = new K3Game();

    game.load(mainScene);

    // Start inside the universe, looking at the galaxies from outside.
    game.camera.position.set(0, 0, 900);
    mainScene.enter();

    return game;
}

const game = main();
