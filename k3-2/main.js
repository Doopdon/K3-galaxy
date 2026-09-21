function main() {

    const game = new K3Game();

    game.load(mainScene);

    // Looking at the galaxy from outside.
    mainScene.show();

    return game;
}

const game = main();