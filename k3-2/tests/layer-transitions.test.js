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
    setScalar(s) { return this.set(s, s, s); }
    normalize() { return this.multiplyScalar(1 / (this.length() || 1)); }
    addScaledVector(v, s) { return this.add(v.clone().multiplyScalar(s)); }
    lerp(v, t) { return this.add(v.clone().sub(this).multiplyScalar(t)); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    distanceTo(v) { return this.clone().sub(v).length(); }
}
class Group {
    constructor() { this.children = []; this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.rotation = { y: 0 }; this.userData = {}; }
    add(o) { this.children.push(o); }
    remove(o) { this.children.splice(this.children.indexOf(o), 1); }
    traverse(fn) { fn(this); for (const child of this.children) child.traverse(fn); }
}
class Mesh extends Group {
    constructor(geometry, material) { super(); Object.assign(this, { geometry, material }); }
}
class Resource { dispose() {} }
class Camera {
    constructor() { this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0 }; this.quaternion = { copy() {} }; this.aspect = 1; this.fov = 60; }
    clone() { return new Camera(); }
    updateProjectionMatrix() {}
    lookAt() {}
    rotateX() {}
    rotateY() {}
    rotateZ() {}
}
const context = vm.createContext({
    THREE: { Vector3, Group, Scene: Group, Mesh, SphereGeometry: Resource, MeshBasicMaterial: Resource,
        BoxGeometry: Resource, EdgesGeometry: Resource, LineSegments: Mesh,
        LineBasicMaterial: Resource, PlaneGeometry: Resource, DoubleSide: 2 },
    document: { getElementById() { return null; } },
    console: { log() {} }
});
// The test demo retains the eight-galaxy shuttle fixtures used below.
const sceneFolder = "test-scenes";
const source = ["k3-scene.js", sceneFolder + "/planet-scenes.js", sceneFolder + "/main-scene.js",
    sceneFolder + "/shuttle-scene.js", "k3-game.js", "shuttles.js"]
    .map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const { K3Scene, K3Game, mainScene, K3ShuttleSystem } = vm.runInContext(source + ";({ K3Scene, K3Game, mainScene, K3ShuttleSystem });", context);
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
// A quarter orbit preserves the group layout and updates collision positions.
const galaxy = mainScene.children[0];
const planet = galaxy.children[0];
const originalGalaxyPosition = galaxy.position.clone();
const initial = planet.position.clone();
const separation = planet.position.distanceTo(galaxy.children[1].position);
const elapsed = Math.PI / (2 * galaxy.childrenOrbitSpeed);
game.updateSceneAnimation(elapsed);
assert.ok(planet.position.distanceTo(new Vector3(initial.z, initial.y, -initial.x)) < 1e-9);
assert.ok(Math.abs(planet.position.distanceTo(galaxy.children[1].position) - separation) < 1e-9);
assert.equal(galaxy.position.distanceTo(originalGalaxyPosition), 0);
game.renderLayers();
assert.equal(game.worldRoot.children[0].rotation.y, galaxy.spinAngle);
assert.ok(galaxy.spinAngle > 0);
game.camera.position.copy(galaxy.position).add(new Vector3(0, 0, 99));
game.updateSceneTransitions();
game.renderLayers();
assert.equal(game.checkChildCollision(planet.position), planet);
assert.equal(game.worldRoot.children[0].position.distanceTo(planet.position), 0);
// Time subdivision must produce the same orbit, independent of frame rate.
const afterQuarter = planet.position.clone();
game.updateSceneAnimation(elapsed / 2);
game.updateSceneAnimation(elapsed / 2);
assert.ok(planet.position.distanceTo(new Vector3(-initial.x, initial.y, -initial.z)) < 1e-9);
assert.ok(planet.position.distanceTo(afterQuarter) > 1);
// While inside a moving planet, the parent camera follows its current center.
game.camera.position.copy(planet.position).add(new Vector3(0, 0, 99));
game.updateSceneTransitions();
assert.equal(game.activeScene, planet);
game.updateSceneAnimation(1);
game.renderLayers();
assert.ok(game.layers[1].camera.position.distanceTo(planet.position.clone().add(new Vector3(0, 0, 99))) < 1e-9);
game.camera.position.set(0, 0, 1010);
game.updateSceneTransitions();
assert.equal(game.activeScene, galaxy);
assert.ok(game.camera.position.distanceTo(planet.position.clone().add(new Vector3(0, 0, 101))) < 1e-9);
console.log("PASS: layers, transitions, render order, spinning galaxies, group orbits, moving collisions, and moving-parent camera mapping.");

game.shuttleSystem = new K3ShuttleSystem(game, mainScene.children);
const rides = game.shuttleSystem;
assert.equal(rides.shuttles.length, 4);
for (let route = 0; route < 4; route++) {
    rides.startRide(route);
    const shuttle = rides.shuttles[route];
    const visited = new Set();
    let pauses = 0;
    let returnsToMain = 0;
    for (let frame = 0; frame < 8000; frame++) {
        const previous = shuttle.scene.parent;
        const previousWait = shuttle.wait;
        const previousPosition = shuttle.position.clone();
        game.updateSceneAnimation(0.025);
        rides.update(0.025);
        if (previousWait === 0 && shuttle.wait === 0) {
            const routeDistance = shuttle.position.distanceTo(previousPosition);
            assert.ok(Math.abs(routeDistance - shuttle.speed * 0.025) < 1e-8);
        }
        game.updateSceneTransitions();
        rides.syncLayers();
        visited.add(shuttle.scene.parent);
        if (previousWait === 0 && shuttle.wait > 0) pauses++;
        if (previous !== mainScene && shuttle.scene.parent === mainScene) returnsToMain++;
        assert.equal(game.activeScene, shuttle.scene);
        // Reconstruct the chase camera in the route frame after every transition.
        const rootCamera = game.camera.position.clone();
        for (let node = game.activeScene; node.parent; node = node.parent) {
            rootCamera.multiplyScalar(node.size / node.insideSize).add(node.position);
        }
        assert.ok(rootCamera.distanceTo(shuttle.position.clone().add(rides.followOffset)) < 1e-8);
        // Each shuttle must appear in exactly one layer, at the matching scale.
        for (let index = 0; index < rides.shuttles.length; index++) {
            const visibleLayers = game.layers.filter(layer => layer.shuttleObjects[index].visible);
            if (rides.shuttles[index].scene === game.activeScene) {
                assert.equal(visibleLayers.length, 0);
                // Only the entered shuttle has an interior square in its own layer.
                assert.equal(game.worldRoot.children.length, 1);
                continue;
            }
            assert.equal(visibleLayers.length, 1);
            const layer = visibleLayers[0];
            const cube = layer.shuttleObjects[index];
            const rootPosition = cube.position.clone().multiplyScalar(1 / cube.scale.x);
            if (layer.node !== mainScene) rootPosition.add(layer.node.position);
            assert.ok(rootPosition.distanceTo(rides.shuttles[index].position) < 1e-8);
            assert.equal(cube.children.length, 1);
        }
    }
    assert.ok(visited.has(shuttle.start) && visited.has(shuttle.end) && visited.has(mainScene));
    assert.ok(pauses >= 2 && returnsToMain >= 2);
}
const beforeDetach = game.camera.position.clone();
rides.handleKey({ code: "KeyW", repeat: false });
assert.equal(rides.rideIndex, -1);
rides.update(0.025);
assert.equal(game.camera.position.distanceTo(beforeDetach), 0);
rides.handleKey({ code: "KeyB", repeat: false });
assert.equal(rides.rideIndex, 0);
rides.handleKey({ code: "KeyN", repeat: false });
assert.equal(rides.rideIndex, 1);
console.log("PASS: four shuttle round trips, galaxy visits, reversals, local camera mapping, cube visibility/scaling, and ride controls.");

// Flying out hides the square and restores the mini; flying back in restores it.
rides.stopRide();
const occupied = game.activeScene;
game.camera.position.set(0, 0, occupied.insideSize + 10);
game.updateSceneTransitions();
assert.equal(game.activeScene, occupied.parent);
rides.syncLayers();
assert.ok(game.layers.every(layer => layer.node !== occupied));
game.camera.position.copy(occupied.position);
game.updateSceneTransitions();
assert.equal(game.activeScene, occupied);
rides.syncLayers();
assert.ok(game.layers.every(layer => !layer.shuttleObjects[1].visible));
assert.equal(game.worldRoot.children.length, 1);
console.log("PASS: occupied shuttle hides mini; manual exit/reentry swaps outside cube and inside square.");

game.moveSpeed = 50;
game.adjustSpeed(1.1);
assert.ok(Math.abs(game.moveSpeed - 55) < 1e-10);
game.adjustSpeed(1 / 1.1);
assert.ok(Math.abs(game.moveSpeed - 50) < 1e-10);
game.camera.position.set(0, 0, occupied.insideSize + 10);
game.updateSceneTransitions();
assert.ok(Math.abs(game.moveSpeed - 50 * occupied.size / occupied.insideSize) < 1e-10);
game.camera.position.copy(occupied.position);
game.updateSceneTransitions();
assert.ok(Math.abs(game.moveSpeed - 50) < 1e-10);
rides.startRide(0);
const rideSpeed = rides.shuttles[0].speed;
game.adjustSpeed(1.1);
assert.ok(Math.abs(rides.shuttles[0].speed - rideSpeed * 1.1) < 1e-10);
game.adjustSpeed(1 / 1.1);
assert.ok(Math.abs(rides.shuttles[0].speed - rideSpeed) < 1e-10);
console.log("PASS: 1.1x speed steps, inverse steps, ride speed adjustment, and reversible flight-speed unit conversion across boundaries.");

const timeGame = Object.create(K3Game.prototype);
timeGame.timeScale = 1;
timeGame.moveSpeed = 50;
let animationTime = 0;
let shuttleTime = 0;
let boundaryChecks = 0;
timeGame.updateSceneAnimation = delta => {
    assert.ok(delta <= 0.05);
    animationTime += delta;
};
timeGame.shuttleSystem = { update(delta) { shuttleTime += delta; }, updateStatus() {} };
timeGame.updateSceneTransitions = () => boundaryChecks++;
timeGame.adjustTimeScale(1.1);
assert.ok(Math.abs(timeGame.timeScale - 1.1) < 1e-10);
timeGame.updateSimulation(0.1);
assert.ok(Math.abs(animationTime - 0.11) < 1e-10);
assert.ok(Math.abs(shuttleTime - animationTime) < 1e-10);
assert.equal(boundaryChecks, 3);
assert.equal(timeGame.moveSpeed, 50);
timeGame.adjustTimeScale(1 / 1.1);
assert.ok(Math.abs(timeGame.timeScale - 1) < 1e-10);
timeGame.timeScale = 0.5;
animationTime = 0;
timeGame.updateSimulation(0.1);
assert.ok(Math.abs(animationTime - 0.05) < 1e-10);
console.log("PASS: shared animation time scaling, slower time, inverse adjustments, bounded simulation steps, and independent flight speed.");

// Overlapping interiors share one depth-tested scene, including different scales.
function makeOverlapSphere(name, x, insideSize) {
    const children = [];
    for (const px of [-0.45, 0.45]) {
        for (const py of [-0.45, 0.45]) {
            for (const pz of [-0.45, 0.45]) {
                children.push(new K3Scene({ size: insideSize * 0.1, insideSize: 1000,
                    position: [px * insideSize, py * insideSize, pz * insideSize] }));
            }
        }
    }
    return new K3Scene({ name, size: 250, insideSize, position: [x, 0, 0], children });
}
const left = makeOverlapSphere("Left", 0, 1000);
const right = makeOverlapSphere("Right", 350, 2000);
const overlapRoot = new K3Scene({ size: 5000, children: [left, right] });
const overlapGame = Object.create(K3Game.prototype);
Object.assign(overlapGame, { camera: new Camera(), layers: [], worldRoot: new Group(),
    threeScene: new Group(), mode: "outside", activeScene: null, moveSpeed: 50,
    timeScale: 1, renderer: game.renderer });
overlapGame.load(overlapRoot);
overlapGame.enter(overlapRoot);
overlapGame.camera.position.set(175, 0, 0);
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, left);
calls.length = 0;
overlapGame.renderLayers();
const foreground = overlapGame.layers[1];
const otherInside = foreground.overlapInteriors.get(right);
assert.ok(otherInside);
assert.equal(otherInside.children.length, 8);
assert.equal(overlapGame.worldRoot.children.length, 8);
assert.equal(otherInside.position.x, 1400);
assert.equal(otherInside.scale.x, 0.5);
assert.equal(overlapGame.layers[0].scene.children[0].children[0].visible, false);
assert.equal(foreground.scene.children.length, 2);
assert.deepEqual(calls, ["clear", "depth", overlapGame.layers[0].scene, "depth", foreground.scene]);
// Do not rebuild geometry every frame.
overlapGame.renderLayers();
assert.equal(foreground.overlapInteriors.get(right), otherInside);
// Leaving only the right sphere restores its shell and removes its interior.
overlapGame.camera.position.set(0, 0, 0);
overlapGame.renderLayers();
assert.equal(foreground.overlapInteriors.size, 0);
assert.equal(overlapGame.layers[0].scene.children[0].children[0].visible, true);
// Enter a planet belonging to the non-active overlapping sphere.
right.children[0].position.set(-900, 0, 0);
overlapGame.camera.position.set(950, 0, 0); // Parent x=237.5, inside both spheres.
assert.equal(overlapGame.checkChildCollision(overlapGame.camera.position), right.children[0]);
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, right.children[0]);
assert.ok(overlapGame.camera.position.length() < 1e-8);
assert.ok(Math.abs(overlapGame.moveSpeed - 2000) < 1e-8);
const previousPlanetPosition = left.children[0].position.clone();
left.children[0].position.set(950, 0, 0);
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, right.children[0]);
left.children[0].position.copy(previousPlanetPosition);
overlapGame.renderLayers();
assert.ok(overlapGame.layers[1].overlapInteriors.has(left));
// Moving directly from left-only to right-only switches movement frames.
overlapGame.exit();
overlapGame.exit();
overlapGame.camera.position.set(175, 0, 0);
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, left);
overlapGame.camera.position.set(1040, 0, 0); // Parent x=260, outside left, inside right.
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, right);
assert.ok(Math.abs(overlapGame.camera.position.x + 720) < 1e-8);
overlapGame.renderLayers();
assert.equal(overlapGame.layers[1].overlapInteriors.size, 0);
console.log("PASS: overlapping interiors, common depth pass, unequal scales, shell restoration, sibling planet entry, and direct overlap exit.");
