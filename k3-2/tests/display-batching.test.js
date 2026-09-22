// Run with: node k3-2/tests/display-batching.test.js
// Geometry/call-count tests use lightweight Three.js doubles, not WebGL timing.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
let geometryCount = 0;
let materialCount = 0;
class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    setScalar(v) { return this.set(v, v, v); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    clone() { return new Vector3().copy(this); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(v) { this.x *= v; this.y *= v; this.z *= v; return this; }
    distanceTo(v) { return Math.hypot(this.x-v.x, this.y-v.y, this.z-v.z); }
    length() { return Math.hypot(this.x, this.y, this.z); }
}
class Object3D {
    constructor() { this.children = []; this.userData = {}; this.position = new Vector3(); this.scale = new Vector3(1,1,1); this.rotation = { y: 0 }; }
    add(v) { this.children.push(v); }
    remove(v) { this.children.splice(this.children.indexOf(v), 1); }
    traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
    updateMatrix() { this.matrix = { position: this.position.clone(), scale: this.scale.clone(), yaw: this.rotation.y }; }
}
class BufferAttribute {
    constructor(array, itemSize) { Object.assign(this, { array, itemSize }); }
    setUsage() { return this; }
}
class Geometry {
    constructor() { geometryCount++; this.attributes = {}; }
    setAttribute(n, a) { this.attributes[n] = a; }
    setDrawRange(start, count) { this.drawRange = { start, count }; }
    dispose() { this.disposed = true; }
}
class Material {
    constructor(options) { materialCount++; Object.assign(this, options); }
    dispose() { this.disposed = true; }
}
class Mesh extends Object3D {
    constructor(geometry, material) { super(); Object.assign(this, { geometry, material }); }
}
class InstancedMesh extends Mesh {
    constructor(g, m, count) { super(g, m); this.isInstancedMesh = true; this.count = count; this.matrices = []; this.colors = []; this.instanceMatrix = new BufferAttribute(); }
    dispose() { this.disposed = true; }
    setMatrixAt(i, m) { this.matrices[i] = m; }
    setColorAt(i, c) { this.colors[i] = [c.r,c.g,c.b]; this.instanceColor = this.instanceColor || {}; }
}
class Color {
    set(value) { this.r = ((value >> 16) & 255) / 255; this.g = ((value >> 8) & 255) / 255; this.b = (value & 255) / 255; return this; }
}
const THREE = { Vector3, Object3D, Group: Object3D, Scene: Object3D, BufferGeometry: Geometry,
    SphereGeometry: Geometry, BufferAttribute, Mesh, InstancedMesh, Points: Mesh,
    LineSegments: Mesh, MeshBasicMaterial: Material, PointsMaterial: Material,
    LineBasicMaterial: Material, Color, DynamicDrawUsage: 35048 };
const context = vm.createContext({ THREE, console, document: { getElementById() { return null; } } });
const source = ["k3-display.js", "k3-scene.js", "k3-game.js", "k3-scenes/star-scenes.js", "k3-scenes/main-scene.js"]
    .map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const { K3Scene, K3Display, K3Game, mainScene } = vm.runInContext(source + ";({ K3Scene, K3Display, K3Game, mainScene });", context);
const children = Array.from({ length: 5000 }, (_, i) => new K3Scene({
    name: (i % 2 ? "Ship " : "Star ") + i, position: [i, 0, 0], size: 1 + i % 3,
    makeOutside(s) { return { type: "sphere", radius: s.size, color: i % 2 ? 0xff0000 : 0x00ff00 }; }
}));
const parent = new K3Scene({ children });
const beforeGeometry = geometryCount;
const beforeMaterial = materialCount;
const display = parent.createInside();
assert.equal(display.children.length, 1);
const mesh = display.children[0];
assert.equal(mesh.count, 5000);
assert.equal(geometryCount - beforeGeometry, 1);
assert.equal(materialCount - beforeMaterial, 1);
assert.equal(parent.children.length, 5000);
assert.ok(children.every(child => child.parent === parent));
assert.equal(mesh.matrices[2].scale.x, 3);
assert.equal(mesh.colors[1][0], 1);
mesh.instanceMatrix.needsUpdate = false;
display.userData.k3Display.update();
assert.equal(mesh.instanceMatrix.needsUpdate, false);
children[1].position.set(7,8,9);
children[1].rotation = 0.7;
display.userData.k3Display.hidden.add(children[0]);
display.userData.k3Display.update();
assert.equal(mesh.count, 4999);
assert.equal(mesh.userData.k3Scenes[0], children[1]);
assert.equal(mesh.matrices[0].position.y, 8);
assert.equal(mesh.matrices[0].yaw, 0.7);
assert.equal(parent.createInside(children[2]).children[0].count, 4999);
display.userData.k3Display.hidden.clear();
display.userData.k3Display.update();
assert.equal(mesh.count, 5000);
assert.equal(mesh.userData.k3Scenes[0], children[0]);
// Default placeholders also batch, while incompatible wireframe settings split.
const defaults = new K3Scene({ children: [new K3Scene(), new K3Scene()] });
assert.equal(defaults.createInside().children[0].count, 2);
const split = K3Display.create([
    { node: children[0], appearance: { type: "sphere", wireframe: true } },
    { node: children[1], appearance: { type: "sphere", wireframe: false } }
]);
assert.equal(split.children.length, 2);
const points = K3Display.create(children.slice(0, 800).map(node => ({ node,
    appearance: { type: "point", color: 0xffffff, size: 3 } })));
assert.equal(points.children.length, 1);
assert.equal(points.children[0].geometry.drawRange.count, 800);
points.userData.k3Display.hidden.add(children[1]);
points.userData.k3Display.update();
assert.equal(points.children[0].geometry.drawRange.count, 799);
const lines = K3Display.create(children.slice(0, 2).map(node => ({ node,
    appearance: { type: "lines", positions: [0,0,0, 1,0,0], color: 0xff0000 } })));
assert.equal(lines.children.length, 1);
assert.equal(lines.children[0].geometry.drawRange.count, 4);
assert.ok(Math.abs(lines.children[0].geometry.attributes.position.array[9] - (7 + Math.cos(0.7))) < 1e-5);
// Legacy callbacks and inside environments coexist with batched children.
const legacy = new K3Scene({ makeOutside: () => new Mesh(new Geometry(), new Material()) });
const mixed = new K3Scene({ children: [children[0], legacy], makeInside: () => new Object3D() });
const mixedDisplay = mixed.createInside();
assert.equal(mixedDisplay.children.length, 3);
assert.equal(mixedDisplay.children[1].userData.k3Scene, legacy);
const lone = children[1].createOutside();
assert.equal(lone.children[0].matrices[0].position.length(), 0);
// Scene transitions operate on logical children even though the batch has one object.
const g = Object.create(K3Game.prototype);
Object.assign(g, { activeScene: parent, mode: "inside" });
assert.equal(g.checkChildCollision(children[1].position), children[1]);
// The actual galaxy retains its configured counts; every region uses generic batching.
assert.equal(mainScene.children.length, 50);
let total = 0;
for (const region of mainScene.children) {
    total += region.children.length;
    const inside = region.createInside();
    assert.equal(inside.children.length, 1);
    assert.equal(inside.children[0].count, region.children.length);
    const outside = region.createOutside();
    const preview = outside.children[1];
    assert.equal(preview.children.length, 2);
    assert.equal(preview.children[0].geometry.drawRange.count, region.children.length);
    const positions = preview.children[0].geometry.attributes.position.array;
    assert.ok(Math.abs(positions[0] * preview.scale.x - region.children[0].position.x * region.size / region.insideSize) < 1e-4);
}
assert.ok(total > 3000);
// Existing disposal traversal releases batch resources as well.
g.layers = [{ scene: display }]; g.worldRoot = display;
g.clearWorld();
assert.ok(mesh.disposed && mesh.geometry.disposed && mesh.material.disposed);

// Batched shells and interiors participate in the real overlap/entry engine.
class Camera extends Object3D {
    constructor() { super(); this.aspect = 1; this.fov = 60;
        this.rotation = { x: 0, y: 0, z: 0, copy(v) { Object.assign(this, { x:v.x, y:v.y, z:v.z }); } }; }
    clone() { return new Camera(); }
    updateProjectionMatrix() {}
}
const a = new K3Scene({ size: 250, insideSize: 1000,
    children: Array.from({length:800}, () => new K3Scene({size:1, position:[0,0,0]})) });
const b = new K3Scene({ size:250, insideSize:1000, position:[350,0,0],
    children: Array.from({length:800}, () => new K3Scene({size:1, position:[0,0,0]})) });
const root = new K3Scene({size:5000, children:[a,b]});
const overlapGame = Object.create(K3Game.prototype);
Object.assign(overlapGame, {layers:[], worldRoot:new Object3D(), threeScene:new Object3D(),
    camera:new Camera(), mode:"outside", activeScene:null, moveSpeed:50, timeScale:1,
    renderer:{clear(){}, clearDepth(){}, render(){}}});
overlapGame.load(root);
overlapGame.enter(root);
overlapGame.camera.position.set(175,0,0);
overlapGame.updateSceneTransitions();
overlapGame.renderLayers();
assert.equal(overlapGame.layers[0].scene.children[0].children[0].count, 0);
assert.equal(overlapGame.worldRoot.children[0].count, 800);
assert.equal(overlapGame.layers[1].overlapInteriors.get(b).children[0].count, 800);
// Hide a logical star on entry without dropping any unrelated instances.
a.children[0].position.set(700,0,0);
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, a.children[0]);
overlapGame.renderLayers();
assert.equal(overlapGame.layers[1].scene.children[0].children[0].count, 799);
overlapGame.camera.position.set(0,0,2);
overlapGame.updateSceneTransitions();
assert.equal(overlapGame.activeScene, a);
overlapGame.camera.position.set(0,0,500);
overlapGame.renderLayers();
assert.equal(overlapGame.layers[0].scene.children[0].children[0].count, 1);
assert.equal(overlapGame.worldRoot.children[0].count, 800);
console.log("PASS: 5000 logical children in one sphere batch; points, lines, compatibility splits, exclusions, updates, fallback, disposal, and full galaxy counts.");
