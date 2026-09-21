// Run with: node k3-2/tests/layer-transitions.test.js
// Tests scene transitions and render ordering without a browser or WebGL.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    copy(v) { return this.set(v.x, v.y, v.z); }
    clone() { return new Vector3().copy(this); }
    add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
    multiplyScalar(s) { return this.set(this.x * s, this.y * s, this.z * s); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    distanceTo(v) { return this.clone().sub(v).length(); }
}
class Group {
    constructor() { this.children = []; this.position = new Vector3(); this.userData = {}; }
    add(o) { this.children.push(o); }
    remove(o) { this.children.splice(this.children.indexOf(o), 1); }
    traverse(fn) { fn(this); for (const child of this.children) child.traverse(fn); }
}
class Mesh extends Group {
    constructor(geometry, material) { super(); Object.assign(this, { geometry, material }); }
}
class Resource { dispose() {} }
class Camera {
    constructor() { this.position = new Vector3(); this.quaternion = { copy() {} }; this.aspect = 1; this.fov = 60; }
    clone() { return new Camera(); }
    updateProjectionMatrix() {}
}
const context = vm.createContext({
    THREE: { Vector3, Group, Scene: Group, Mesh, SphereGeometry: Resource, MeshBasicMaterial: Resource },
    console: { log() {} }
});
const source = ["k3-scene.js", "planet-scenes.js", "main-scene.js", "k3-game.js"]
    .map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const { K3Game, mainScene } = vm.runInContext(source + ";({ K3Game, mainScene });", context);
const game = Object.create(K3Game.prototype);
Object.assign(game, { camera: new Camera(), layers: [], worldRoot: new Group(), threeScene: new Group(), mode: "outside", activeScene: null });
const calls = [];
game.renderer = {
    clear() { calls.push("clear"); },
    clearDepth() { calls.push("depth"); },
    render(scene) { calls.push(scene); }
};
game.load(mainScene);
game.camera.position.set(0, 0, 900);
game.enter(mainScene);
assert.equal(game.layers.length, 1);
assert.equal(game.worldRoot.children.length, 8);

for (const galaxy of mainScene.children) {
    game.camera.position.copy(galaxy.position).add(new Vector3(0, 0, 99));
    game.updateSceneTransitions();
    assert.equal(game.activeScene, galaxy);
    assert.equal(game.camera.position.z, 990);
    assert.equal(game.layers.length, 2);
    const background = game.layers[0].scene.children[0];
    assert.equal(background.children.length, 7);
    assert.ok(background.children.every(o => o.userData.k3Scene !== galaxy));
    assert.equal(game.worldRoot.children.length, 8);
    calls.length = 0;
    game.renderLayers();
    assert.deepEqual(calls, ["clear", "depth", game.layers[0].scene, "depth", game.layers[1].scene]);
    assert.ok(game.layers[0].camera.position.distanceTo(galaxy.position.clone().add(new Vector3(0, 0, 99))) < 1e-10);
    // Collisions see only active children, never background galaxies.
    assert.equal(game.checkChildCollision(new Vector3()), null);

    const planet = galaxy.children[0];
    game.camera.position.copy(planet.position).add(new Vector3(0, 0, 99));
    game.updateSceneTransitions();
    assert.equal(game.activeScene, planet);
    assert.equal(game.layers.length, 3);
    assert.equal(game.layers[1].scene.children[0].children.length, 7);
    game.camera.position.set(0, 0, 1010);
    game.updateSceneTransitions();
    assert.equal(game.activeScene, galaxy);
    assert.ok(game.camera.position.distanceTo(planet.position.clone().add(new Vector3(0, 0, 101))) < 1e-10);
    game.camera.position.set(0, 0, 1010);
    game.updateSceneTransitions();
    assert.equal(game.activeScene, mainScene);
    assert.equal(game.layers.length, 1);
    assert.equal(game.worldRoot.children.length, 8);
    assert.ok(game.camera.position.distanceTo(galaxy.position.clone().add(new Vector3(0, 0, 101))) < 1e-10);
}
// Root outside/inside transitions also retain usable render layers.
game.camera.position.set(0, 0, 5001);
game.updateSceneTransitions();
assert.equal(game.mode, "outside");
assert.equal(game.worldRoot.children.length, 1);
game.renderLayers();
game.camera.position.set(0, 0, 4999);
game.updateSceneTransitions();
assert.equal(game.mode, "inside");
assert.equal(game.worldRoot.children.length, 8);
console.log("PASS: layers, sibling visibility, render order, local scaling, nested exits, and root reentry.");
