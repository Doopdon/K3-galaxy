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
    normalize() { return this.multiplyScalar(1 / this.length()); }
    getComponent(i) { return [this.x, this.y, this.z][i]; }
    crossVectors(a, b) {
        return this.set(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x);
    }
}
class Object3D {
    constructor() { this.children = []; this.userData = {}; this.position = new Vector3(); this.scale = new Vector3(1,1,1); this.rotation = { x: 0, y: 0, z: 0 }; }
    get quaternion() { return new Quaternion(this).setFromEuler(this.rotation); }
    add(v) { this.children.push(v); }
    remove(v) { this.children.splice(this.children.indexOf(v), 1); }
    traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
    updateMatrix() { this.matrix = { position: this.position.clone(), scale: this.scale.clone(), yaw: this.rotation.y }; }
}
class Euler {
    constructor(x, y, z, order) { Object.assign(this, {x,y,z,order}); }
    setFromQuaternion(q, order) {
        const owner = { rotation: {} };
        new Quaternion(owner).copy(q);
        Object.assign(this, owner.rotation, { order });
        return this;
    }
}
class Quaternion {
    constructor(owner = null) { Object.assign(this, {x:0,y:0,z:0,w:1,owner}); }
    setFromEuler(e) {
        const c1=Math.cos(e.x/2),c2=Math.cos(e.y/2),c3=Math.cos(e.z/2);
        const s1=Math.sin(e.x/2),s2=Math.sin(e.y/2),s3=Math.sin(e.z/2);
        Object.assign(this,{x:s1*c2*c3+c1*s2*s3,y:c1*s2*c3-s1*c2*s3,
            z:c1*c2*s3-s1*s2*c3,w:c1*c2*c3+s1*s2*s3});
        return this;
    }
    setFromAxisAngle(axis, angle) {
        const sine = Math.sin(angle / 2);
        Object.assign(this, { x: axis.x*sine, y: axis.y*sine, z: axis.z*sine, w: Math.cos(angle / 2) });
        return this;
    }
    normalize() {
        const length = Math.hypot(this.x, this.y, this.z, this.w);
        this.x/=length; this.y/=length; this.z/=length; this.w/=length;
        return this;
    }
    copy(q) { Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w}); return this.commit(); }
    invert() { this.x=-this.x;this.y=-this.y;this.z=-this.z;return this.commit(); }
    multiply(q) { return this.product(this,q); }
    premultiply(q) { return this.product(q,this); }
    product(a,b) {
        const {x:ax,y:ay,z:az,w:aw}=a,{x:bx,y:by,z:bz,w:bw}=b;
        Object.assign(this,{x:ax*bw+aw*bx+ay*bz-az*by,y:ay*bw+aw*by+az*bx-ax*bz,
            z:az*bw+aw*bz+ax*by-ay*bx,w:aw*bw-ax*bx-ay*by-az*bz});
        return this.commit();
    }
    commit() {
        if (this.owner) {
            const {x,y,z,w}=this;
            const m23=2*(y*z-x*w);
            const pitch=Math.asin(-Math.max(-1,Math.min(1,m23)));
            const yaw=Math.abs(m23)<0.9999999 ? Math.atan2(2*(x*z+y*w),1-2*(x*x+y*y)) : Math.atan2(-2*(x*z-y*w),1-2*(y*y+z*z));
            const roll=Math.abs(m23)<0.9999999 ? Math.atan2(2*(x*y+z*w),1-2*(x*x+z*z)) : 0;
            Object.assign(this.owner.rotation,{x:pitch,y:yaw,z:roll});
        }
        return this;
    }
}
class BufferAttribute {
    constructor(array, itemSize) { Object.assign(this, { array, itemSize }); }
    setUsage() { return this; }
}
class Geometry {
    constructor() { geometryCount++; this.attributes = {}; }
    setAttribute(n, a) { this.attributes[n] = a; }
    setDrawRange(start, count) { this.drawRange = { start, count }; }
    addEventListener(type, callback) { this.listeners = this.listeners || {}; this.listeners[type] = callback; }
    dispose() { this.disposed = true; if (this.listeners?.dispose) this.listeners.dispose(); }
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
const THREE = { Vector3, Object3D, Euler, Quaternion, Group: Object3D, Scene: Object3D, BufferGeometry: Geometry,
    SphereGeometry: Geometry, BoxGeometry: Geometry, PlaneGeometry: Geometry, DoubleSide: 2,
    BufferAttribute, Mesh, InstancedMesh, Points: Mesh,
    LineSegments: Mesh, MeshBasicMaterial: Material, PointsMaterial: Material,
    LineBasicMaterial: Material, Color, DynamicDrawUsage: 35048,
    Sphere: class { constructor(center, radius) { Object.assign(this, { center, radius }); } },
    MathUtils: { lerp: (a, b, t) => a + (b - a) * t } };
const context = vm.createContext({ THREE, console, showWireFrames: false,
    document: { getElementById() { return null; } } });
const source = ["k3-display.js", "k3-scene.js", "k3-game.js", "k3-colors.js", "../ship-generator/spaceship-generator.js", "k3-scenes/swarm-cubes.js", "k3-scenes/glowing-star.js", "k3-scenes/star-scenes.js",
    "k3-scenes/shuttle-scene.js", "k3-scenes/route-corridor.js", "k3-scenes/main-scene.js"]
    .map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const { K3Scene, K3Display, K3Game, mainScene, createNeighborConnections, connectionPositions, RouteCorridor, SpaceshipGenerator } =
    vm.runInContext(source + ";({ K3Scene, K3Display, K3Game, mainScene, createNeighborConnections, connectionPositions, RouteCorridor, SpaceshipGenerator });", context);
// The playground and cube previews use the same recipe and centered bounds.
const recipe = SpaceshipGenerator.generate(() => 0.5);
const palette = vm.runInContext("K3_COLORS", context);
const savedRed = palette.red;
const savedParticles = palette.particles;
palette.red = 0xff0000;
palette.particles = { color: null, innerBrightness: 1, outerBrightness: 0.35, falloff: 1.5, whiteMix: 0 };
assert.deepEqual(Array.from(palette.particleColorAt(0)), [1, 0, 0]);
assert.deepEqual(Array.from(palette.particleColorAt(1)), [0.35, 0, 0]);
assert.equal(palette.particleColorAt(0.5)[1], 0, "brightness must not add white or change hue");
palette.particles.outerBrightness = 1;
assert.deepEqual(Array.from(palette.particleColorAt(0.5)), [1, 0, 0]);
palette.particles.color = 0x00ff00;
assert.deepEqual(Array.from(palette.particleColorAt(0)), [0, 1, 0]);
palette.particles.whiteMix = 1;
assert.deepEqual(Array.from(palette.particleColorAt(0)), [1, 1, 1]);
palette.red = savedRed;
palette.particles = savedParticles;
const shipDescriptions = SpaceshipGenerator.describeOutside(recipe, 1);
const restoredRecipe = JSON.parse(JSON.stringify(recipe));
assert.equal(restoredRecipe.version, 1);
assert.equal(restoredRecipe.spineSegments.length, recipe.parts.filter(part => part.role === "spine").length);
assert.equal(new Set(recipe.parts.map(part => part.id)).size, recipe.parts.length);
assert.ok(recipe.parts.every(part => ["spine", "ring", "disk"].includes(part.role)));
assert.equal(JSON.stringify(SpaceshipGenerator.describeOutside(restoredRecipe, 1)), JSON.stringify(shipDescriptions));
assert.ok(recipe.parts.some(part => part.type === "disk"));
assert.ok(recipe.parts.some(part => part.type === "cylinder" && part.topRadius === 1.2));
for (const part of shipDescriptions) {
    assert.equal(part.positions.length % 9, 0);
    assert.ok(part.positions.every(value => Number.isFinite(value) && Math.abs(value) <= 0.85 + 1e-9));
}
const shipMaterials = { gray: new Material({ color: 0x888888 }), red: new Material({ color: SpaceshipGenerator.diskColor }) };
const playgroundShip = SpaceshipGenerator.createObject(
    { ...THREE, CylinderGeometry: Geometry, RingGeometry: Geometry }, recipe, shipMaterials);
assert.equal(playgroundShip.children.length, recipe.parts.length);
assert.ok(playgroundShip.children.some(mesh => mesh.material === shipMaterials.red));
assert.throws(() => K3Display.create([{ appearance: { type: "triangles", positions: [0, 0, 0] } }]),
    /groups of three XYZ vertices/);
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
    total += region.stars.length;
    const inside = region.createInside();
    assert.equal(inside.children.length, 5);
    assert.equal(inside.children[0].count, region.stars.length);
    assert.equal(inside.children[1].count, region.stars.length);
    assert.equal(inside.children[2].count, region.stars.length);
    assert.equal(inside.children[3].count, region.connections.length);
    assert.equal(region.corridors.length, region.connections.length);
    assert.ok(region.corridors.every(corridor => corridor.parent === region && corridor.children.length === 8));
    const outside = region.createOutside();
    const preview = outside.children[0];
    assert.equal(preview.children.length, 2);
    assert.equal(preview.children[0].geometry.drawRange.count, region.stars.length);
    const overviewRoutes = preview.children[1];
    assert.equal(overviewRoutes.geometry.drawRange.count, region.connections.length * 2);
    assert.equal(overviewRoutes.geometry.attributes.stream, undefined, "galactic routes must be solid lines");
    assert.ok(inside.children[4].geometry.attributes.stream, "region routes must use moving dot streams");
    const positions = preview.children[0].geometry.attributes.position.array;
    assert.ok(Math.abs(positions[0] * preview.scale.x - region.children[0].position.x * region.size / region.insideSize) < 1e-4);
}
assert.ok(total > 30000);
assert.equal(mainScene.children[0].stars.length, 1000);
const scaledStar = mainScene.children[0].stars[0];
assert.ok(Math.abs(scaledStar.size - 8 / (10 * Math.cbrt(10))) < 1e-12);
assert.equal(scaledStar.insideSize, 1000);
const scaledRoute = mainScene.children[0].corridors[0];
assert.ok(Math.abs(scaledRoute.boundary.halfExtents[0] - scaledStar.size * 1.25) < 1e-12);
assert.ok(scaledRoute.traffic.every(craft => craft.shuttle.size <= scaledStar.size * 0.375));
// Entering a blue shell replaces its yellow core with an equally sized swarm.
const star = mainScene.children[0].stars[0];
star.game = { simulationTime: 12 };
const starInside = star.createInside();
assert.equal(starInside.children.length, 3); // Environment, cube batch, ship surface batch.
const cloud = starInside.children[0].children[1];
const outsideRadius = star.describeOutside().parts[1].radius;
assert.equal(cloud.geometry.boundingSphere.radius * star.size / star.insideSize, outsideRadius);
assert.equal(cloud.geometry.attributes.position.array.length, 100000 * 3);
for (let i = 0; i < 100000; i++) {
    const p = cloud.geometry.attributes.position.array;
    const radius = Math.hypot(p[i*3], p[i*3+1], p[i*3+2]);
    assert.ok(radius <= star.insideSize * 0.25 + 0.001);
}
const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>\ngl_PointSize = size;" };
shader.fragmentShader = "void main() {\n#include <clipping_planes_fragment>\n}";
cloud.material.onBeforeCompile(shader);
cloud.onBeforeRender();
assert.equal(shader.uniforms.orbitTime.value, 12);
star.game.simulationTime = 24;
cloud.onBeforeRender();
assert.equal(shader.uniforms.orbitTime.value, 24);
assert.ok(shader.vertexShader.includes("orbitAxisA * cos(angle)"));
assert.ok(shader.vertexShader.includes("gl_PointSize = size * length(modelMatrix[0].xyz);"));
assert.ok(!shader.vertexShader.includes("gl_PointSize = size;"));
assert.ok(shader.fragmentShader.includes("if (swarmVisible < 0.5) discard;"));
assert.equal(cloud.geometry.attributes.particleVisible.array, star.swarmData.visible);
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

// Diagnostic: count actual swarm submissions, rather than calls to enter().
// Use the production star shader/geometry and production corridor/ship classes.
{
    const makeStar = vm.runInContext("createGlowingStarInterior", context);
    let loads = 0;
    const diagnosticStar = new K3Scene({ name: "Diagnostic star", size: 8, insideSize: 1000,
        makeInside(scene) { loads++; return makeStar(scene); } });
    const endpoint = new K3Scene({ size: 8, position: [100, 0, 0] });
    const corridor = new RouteCorridor(diagnosticStar, endpoint, "Diagnostic corridor");
    const region = new K3Scene({ size: 500, children: [diagnosticStar, endpoint, corridor] });
    const root = new K3Scene({ size: 5000, children: [region] });
    const frames = [];
    let submissions;
    const renderer = {
        clear() { submissions = []; },
        clearDepth() {},
        render(scene) {
            const visit = (object, scale = 1) => {
                if (object.visible === false) return;
                scale *= object.scale.x;
                if (object.geometry?.attributes.orbit) {
                    const pointShader = { uniforms: {},
                        vertexShader: "#include <begin_vertex>\ngl_PointSize = size;" };
                    object.material.onBeforeCompile(pointShader);
                    assert.ok(pointShader.vertexShader.includes(
                        "gl_PointSize = size * length(modelMatrix[0].xyz);"));
                    submissions.push({ cloud: object,
                        points: object.geometry.attributes.position.array.length / 3,
                        // Evaluate the shader's model-scale factor for these
                        // uniformly scaled scene frames, before perspective.
                        pointSize: object.material.size * Math.abs(scale),
                        swarmRadius: object.geometry.boundingSphere.radius * scale });
                }
                for (const child of object.children) visit(child, scale);
            };
            visit(scene);
        }
    };
    const diagnostic = Object.create(K3Game.prototype);
    Object.assign(diagnostic, { layers: [], worldRoot: new Object3D(), threeScene: new Object3D(),
        camera: new Camera(), activeScene: null, mode: "outside", moveSpeed: 50, timeScale: 1, renderer });
    diagnostic.load(root);
    function record(label) {
        diagnostic.renderLayers();
        assert.equal(submissions.length, 1, label + ": expected exactly one swarm render");
        assert.equal(new Set(submissions.map(item => item.cloud)).size, 1);
        assert.equal(submissions[0].points, 100000);
        assert.ok(!submissions[0].cloud.geometry.disposed);
        frames.push({ label, ...submissions[0] });
    }
    diagnostic.enter(root);
    diagnostic.enter(region);
    diagnostic.camera.position.set(5, 0, 0);
    diagnostic.enter(diagnosticStar);
    record("direct star entry");
    diagnostic.exit();
    diagnostic.enter(corridor);
    record("corridor overlap");
    let ship = corridor.children.find(child => child.enabled);
    diagnostic.camera.position.copy(ship.position);
    diagnostic.updateSceneTransitions();
    assert.ok(diagnostic.activeScene === ship, "expected occupied diagnostic shuttle");
    record("inside ship at star");
    const loadsBefore = loads;
    for (let frame = 0; frame < 120; frame++) record("ship frame " + frame);
    assert.equal(loads, loadsBefore, "stationary ship must not reload the star");
    for (let frame = 0; frame < 120; frame++) {
        diagnostic.updateSimulation(0.0001);
        assert.ok(diagnostic.activeScene === ship, "expected occupied diagnostic shuttle");
        record("moving ship frame " + frame);
    }
    assert.equal(loads, loadsBefore, "moving ship must not reload the star");
    // Repeatedly cross the real ship boundary and return, retaining the same
    // physical camera location when converting between coordinate frames.
    for (let crossing = 0; crossing < 5; crossing++) {
        diagnostic.camera.position.set(0, 1001, 0);
        diagnostic.updateSceneTransitions();
        assert.ok(diagnostic.activeScene === corridor, "expected corridor after leaving diagnostic shuttle");
        record("exit ship " + crossing);
        ship = corridor.children.find(child => child.enabled);
        diagnostic.camera.position.copy(ship.position);
        diagnostic.updateSceneTransitions();
        assert.ok(diagnostic.activeScene === ship, "expected occupied diagnostic shuttle");
        record("reenter ship " + crossing);
    }
    const ratio = frame => frame.pointSize / frame.swarmRadius;
    for (const frame of frames) {
        assert.ok(Math.abs(ratio(frame) - ratio(frames[0])) < 1e-10,
            frame.label + ": particle size must remain proportional to the swarm");
    }
    console.log("DIAGNOSTIC: " + frames.length + " frames, one 100000-point swarm submission per frame; " +
        "stationary/moving ship caused zero reloads. Point-size/swarm-radius: direct=" +
        ratio(frames[0]).toFixed(5) + ", corridor=" + ratio(frames[1]).toFixed(5) +
        ", ship=" + ratio(frames[2]).toFixed(5) + ".");

    // Approach an actual GPU-orbited dot, enter its promoted scene, then leave.
    diagnostic.enterVisibleScene(diagnosticStar);
    diagnostic.simulationTime = 0;
    const swarm = diagnosticStar.swarmData;
    const target = swarm.positionAt(0, 0, new Vector3());
    diagnostic.camera.position.copy(target);
    diagnostic.renderLayers();
    const promoted = swarm.pool.filter(child => child.enabled);
    assert.ok(promoted.length > 64 && promoted.length <= 320);
    assert.ok(promoted.some(child => child.particleIndex === 0));
    assert.equal(swarm.visibilityAttributes.size, 1, "disposed layers must release mask attributes");
    assert.ok(swarm.lastQueryCount <= 100000, "radial bins must visit each candidate at most once");
    const previousRange = cube => cube.size * 2 * 12;
    assert.ok(Math.abs(swarm.range / previousRange(promoted[0]) - 5) < 1e-12);
    const expectedNearest = [];
    const sample = new Vector3();
    for (let index = 0; index < swarm.orbits.length / 2; index++) {
        const distance = swarm.positionAt(index, 0, sample).distanceTo(target);
        if (distance <= swarm.range) expectedNearest.push({ index, distance });
    }
    expectedNearest.sort((a, b) => a.distance - b.distance);
    assert.deepEqual(Array.from(promoted, child => child.particleIndex).sort((a, b) => a - b),
        expectedNearest.slice(0, 320).map(item => item.index).sort((a, b) => a - b),
        "radial search must find the same nearest dots as a full scan");
    assert.equal(Array.from(swarm.visible).filter(value => value === 0).length, promoted.length);
    for (const child of promoted) {
        assert.equal(swarm.visible[child.particleIndex], 0);
        const expected = swarm.positionAt(child.particleIndex, 0, new Vector3());
        assert.ok(child.position.distanceTo(expected) < 1e-9);
        assert.equal(child.rotation, child.shipData.orientation.rotation);
        assert.equal(child.pitch, child.shipData.orientation.pitch);
        assert.equal(child.roll, child.shipData.orientation.roll);
        assert.ok(Math.abs(child.shipData.insideScale - child.shipData.outsideScale *
            child.insideSize / child.size) < 1e-12);
        assert.equal(JSON.stringify(SpaceshipGenerator.describeOutside(child.shipData, child.size)),
            JSON.stringify(child.describeOutside().parts.slice(1)));
        for (const part of child.describeOutside().parts.slice(1)) {
            assert.equal(part.type, "triangles");
            assert.ok(part.positions.every(value => Math.abs(value) < child.size));
        }
    }
    const surfaceBatch = diagnostic.worldRoot.children[2];
    assert.equal(diagnostic.worldRoot.children.length, 3, "all ship surfaces must share one generic batch");
    assert.ok(surfaceBatch.geometry.drawRange.count > 0);
    assert.equal(surfaceBatch.material.side, THREE.DoubleSide);
    assert.ok(surfaceBatch.userData.k3Scenes.includes(promoted[0]));
    const geometryBeforeToggle = geometryCount;
    const layersBeforeToggle = diagnostic.layers;
    const shipVerticesBeforeToggle = surfaceBatch.geometry.drawRange.count;
    diagnostic.toggleCollisionWireframes();
    diagnostic.renderLayers();
    assert.equal(diagnostic.worldRoot.children[1].count, 0);
    assert.equal(surfaceBatch.geometry.drawRange.count, shipVerticesBeforeToggle);
    assert.equal(diagnostic.layers, layersBeforeToggle);
    assert.equal(geometryCount, geometryBeforeToggle);
    assert.ok(promoted.some(child => child.containsPosition(target)), "hidden boxes must still collide");
    diagnostic.toggleCollisionWireframes();
    diagnostic.renderLayers();
    assert.equal(diagnostic.worldRoot.children[1].count, promoted.length);
    assert.equal(geometryCount, geometryBeforeToggle);
    assert.ok(new Set(swarm.pool.map(child => child.rotation)).size > 1);
    const firstShip = surfaceBatch.userData.k3Scenes[0];
    const firstVertex = firstShip.describeOutside().parts[1].positions;
    const rotatedVertex = new Vector3(firstVertex[0], firstVertex[1], firstVertex[2]);
    firstShip.rotateFramePosition(rotatedVertex).add(firstShip.position);
    const renderedPositions = surfaceBatch.geometry.attributes.position.array;
    assert.ok(rotatedVertex.distanceTo(new Vector3(...Array.from(renderedPositions.slice(0, 3)))) < 1e-4);
    const cube = diagnostic.checkChildCollision(diagnostic.camera.position);
    assert.ok(promoted.includes(cube));
    const dotIndex = cube.particleIndex;
    const savedShipData = cube.shipData;
    const savedShipJSON = JSON.stringify(savedShipData);
    const dotPositions = swarm.positions;
    const expectedEdge = cloud.material.size * Math.tan(diagnostic.camera.fov * Math.PI / 360);
    assert.ok(Math.abs(cube.size * 2 - expectedEdge) < 1e-9);
    assert.equal(cube.describeOutside().parts[0].color, 0xff0000);
    assert.equal(cube.describeOutside().parts[0].wireframe, true);
    const beforeFrame = cube.position.clone();
    const beforeResources = geometryCount;
    diagnostic.renderLayers();
    assert.equal(geometryCount, beforeResources, "stable selection must not allocate geometry");
    diagnostic.updateSceneTransitions();
    assert.equal(diagnostic.activeScene, cube);
    assert.equal(diagnostic.activeScene.shipData, savedShipData);
    assert.equal(diagnostic.worldRoot.children.length, 1); // Placeholder square.
    assert.equal(diagnostic.worldRoot.children[0].material.color, 0xff3333);
    diagnostic.renderLayers();
    assert.equal(swarm.positions, dotPositions, "entry must preserve the original swarm");
    const starLayer = diagnostic.layers.find(layer => layer.node === diagnosticStar);
    const cubeBatch = starLayer.scene.children[0].children[1];
    assert.ok(!cubeBatch.userData.k3Scenes.includes(cube), "entered cube shell must be hidden");
    const shipsBatch = starLayer.scene.children[0].children[2];
    assert.ok(!shipsBatch.userData.k3Scenes.includes(cube), "entered cube's ship must also be hidden");
    diagnostic.simulationTime = 0.05;
    diagnostic.updateSceneAnimation(0.05);
    diagnostic.renderLayers();
    assert.ok(cube.position.distanceTo(beforeFrame) > 0);
    assert.ok(cube.position.distanceTo(swarm.positionAt(dotIndex, 0.05, new Vector3())) < 1e-9);
    // Occupancy pins the assignment even if its camera is beyond the LOD range.
    diagnostic.camera.position.set(100000, 0, 0);
    diagnostic.renderLayers();
    assert.equal(cube.particleIndex, dotIndex);
    assert.equal(cube.enabled, true);
    diagnostic.exit();
    assert.equal(cube.shipData, savedShipData);
    assert.equal(JSON.stringify(cube.shipData), savedShipJSON, "entry, motion and exit must retain ship data and orientation");
    diagnostic.camera.position.set(0, 0, 900);
    diagnostic.renderLayers();
    assert.equal(swarm.pool.filter(child => child.enabled).length, 0);
    assert.equal(diagnostic.worldRoot.children[2].geometry.drawRange.count, 0,
        "distant cubes must hide their ships as well as their shells");
    assert.ok(swarm.visible.every(value => value === 1), "far cubes must restore their dots");
    assert.equal(cube.containsPosition(cube.position), false, "inactive pool slots cannot be entered");
    diagnostic.camera.position.copy(swarm.positionAt(dotIndex, 0.05, new Vector3()));
    diagnostic.renderLayers();
    assert.ok(swarm.pool.some(child => child.enabled && child.particleIndex === dotIndex));
    // Flight collision checks must see newly promoted ships without waiting
    // for another render pass to populate the pool.
    diagnostic.camera.position.set(0, 0, 900);
    diagnostic.refreshNearbySceneChildren();
    assert.ok(swarm.pool.every(child => !child.enabled));
    assert.equal(swarm.lastQueryCount, 0);
    diagnostic.camera.position.copy(swarm.positionAt(0, 0.05, new Vector3()));
    Object.assign(diagnostic, {keys:{}, pitch:0, yaw:0, roll:0});
    diagnostic.camera.rotation.set = function(x,y,z) { Object.assign(this,{x,y,z}); };
    diagnostic.updateControls(0);
    assert.ok(swarm.pool.includes(diagnostic.activeScene), "new nearby ships must be collidable before rendering");
    console.log("PASS: nearby swarm cube promotion, bounded radial search, particle masking, matched size, " +
        "nested entry, moving occupied frames, stable orbits, resource reuse, and distant dot restoration.");
}

// Preserve exactly the previous red-line edge rule, including its index filter.
const routeStars = [[0,0,0],[100,0,0],[200,0,0],[100,0,100],[400,0,400]]
    .map((position, i) => new K3Scene({name:"Route star " + i, size:8, position}));
const connections = createNeighborConnections(routeStars);
const expectedEdges = [];
for (let i = 0; i < routeStars.length; i++) {
    const nearest = routeStars.map((star,j) => ({j, d:star.position.distanceTo(routeStars[i].position)}))
        .filter(item => item.j !== i).sort((a,b) => a.d-b.d).slice(0,2);
    for (const item of nearest) if (item.j > i) expectedEdges.push([routeStars[i],routeStars[item.j]]);
}
assert.equal(connections.length, expectedEdges.length);
connections.forEach((pair,i) => { assert.equal(pair[0],expectedEdges[i][0]); assert.equal(pair[1],expectedEdges[i][1]); });
assert.equal(connectionPositions(connections).length, connections.length * 6);
{
// Diagonal, vertical and horizontal connections all map to corridor-local Z.
for (const endpoint of [[100,80,160],[0,100,0],[100,0,0]]) {
    const a = new K3Scene({position:[0,0,0],size:8});
    const b = new K3Scene({position:endpoint,size:8});
    const corridor = new RouteCorridor(a,b,"Corridor");
    assert.ok(corridor.localToParent(new Vector3(0,0,-corridor.length/2)).distanceTo(a.position)<1e-9);
    assert.ok(corridor.localToParent(new Vector3(0,0,corridor.length/2)).distanceTo(b.position)<1e-9);
    const local = new Vector3(2,3,4);
    assert.ok(corridor.parentToLocal(corridor.localToParent(local.clone())).distanceTo(local)<1e-9);
    assert.ok(corridor.containsPosition(corridor.localToParent(new Vector3(9,9,0))));
    assert.ok(!corridor.containsPosition(corridor.localToParent(new Vector3(11,0,0))));
    assert.equal(corridor.children.length,8);
    assert.ok(corridor.children.every(child=>child.parent===corridor));
    corridor.selectNearbyTraffic(new Vector3(0,0,0), 0);
    const before = corridor.children[0].position.clone();
    corridor.updateTraffic(0.2);
    assert.ok(before.distanceTo(corridor.children[0].position)>0);
    corridor.updateTraffic(10000);
    assert.ok(corridor.traffic.every(craft=>Math.abs(craft.shuttle.position.z)<=craft.limit+1e-9));
}
const a = new K3Scene({size:8,position:[0,0,0]});
const b = new K3Scene({size:8,position:[100,80,160]});
const corridor = new RouteCorridor(a,b,"Boarding corridor");
const region = new K3Scene({size:500,insideSize:500,children:[a,b,corridor]});
const routeRoot = new K3Scene({size:5000,children:[region]});
const rideGame = Object.create(K3Game.prototype);
Object.assign(rideGame,{layers:[],worldRoot:new Object3D(),threeScene:new Object3D(),camera:new Camera(),
    activeScene:null,mode:"outside",moveSpeed:50,timeScale:1,renderer:{clear(){},clearDepth(){},render(){}}});
rideGame.load(routeRoot); rideGame.enter(routeRoot);
// A point inside the box but away from the traffic lanes and endpoint stars.
const localCamera = new Vector3(8,7,0);
rideGame.camera.position.copy(corridor.localToParent(localCamera.clone()));
rideGame.updateSceneTransitions(); assert.equal(rideGame.activeScene,region);
const originalHeading = rideGame.camera.quaternion;
rideGame.updateSceneTransitions(); assert.equal(rideGame.activeScene,corridor);
assert.ok(rideGame.camera.position.distanceTo(localCamera)<1e-9);
rideGame.renderLayers();
assert.ok(rideGame.layers[1].camera.position.distanceTo(corridor.localToParent(localCamera.clone()))<1e-9);
const parentHeading = rideGame.layers[1].camera.quaternion;
assert.ok(Math.abs(parentHeading.x-originalHeading.x)+Math.abs(parentHeading.y-originalHeading.y)+Math.abs(parentHeading.z-originalHeading.z)<1e-8);
assert.equal(rideGame.worldRoot.children.length,3); // Stream, collision boxes, batched ship surfaces.
const trafficPoints = rideGame.worldRoot.children[0].children[0];
const promotedTraffic = corridor.traffic.filter(craft => craft.shuttle.enabled);
assert.ok(rideGame.worldRoot.children[2].geometry.drawRange.count > 0);
const shipVertexCount = rideGame.worldRoot.children[2].geometry.drawRange.count;
for (const craft of promotedTraffic) {
    assert.ok(craft.shuttle.shipData.parts.some(part => part.role === "spine"));
    assert.equal(craft.shuttle.rotation, -craft.direction * Math.PI / 2);
}
rideGame.toggleCollisionWireframes();
rideGame.renderLayers();
assert.equal(rideGame.worldRoot.children[1].count, 0);
assert.equal(rideGame.worldRoot.children[2].geometry.drawRange.count, shipVertexCount);
rideGame.toggleCollisionWireframes();
rideGame.renderLayers();
assert.equal(trafficPoints.geometry.drawRange.count, corridor.stream.count - promotedTraffic.length);
assert.equal(corridor.stream.hiddenIndices.size, promotedTraffic.length);
const trafficGeometry = trafficPoints.geometry;
const trafficShader = { uniforms: {}, vertexShader: "#include <begin_vertex>",
    fragmentShader: "#include <clipping_planes_fragment>" };
trafficPoints.material.onBeforeCompile(trafficShader);
const versionBeforeTime = corridor.stream.version;
trafficPoints.geometry.attributes.position.needsUpdate = false;
rideGame.worldRoot.children[0].userData.k3Display.update(3);
assert.equal(trafficShader.uniforms.streamTime.value, 3);
assert.equal(trafficPoints.geometry, trafficGeometry);
assert.equal(trafficPoints.geometry.attributes.position.needsUpdate, false,
    "distant dot animation must use the GPU clock without vertex uploads");
assert.equal(corridor.stream.version, versionBeforeTime);
assert.ok(trafficShader.fragmentShader.includes("dot(offset, offset) > 0.25"));
const shuttle = corridor.children.find(child => child.enabled);
assert.ok(shuttle);
rideGame.camera.position.copy(shuttle.position);
rideGame.updateSceneTransitions(); assert.equal(rideGame.activeScene,shuttle);
assert.equal(rideGame.worldRoot.children[0].material.color,0xff6600);
rideGame.updateSceneAnimation(0.1);
rideGame.renderLayers();
assert.ok(rideGame.layers[2].camera.position.distanceTo(shuttle.position)<1e-9);
rideGame.camera.position.set(0,0,1010);
rideGame.updateSceneTransitions(); assert.equal(rideGame.activeScene,corridor);
rideGame.camera.position.set(11,0,0);
const expectedExit = corridor.localToParent(rideGame.camera.position.clone());
rideGame.updateSceneTransitions(); assert.equal(rideGame.activeScene,region);
assert.ok(rideGame.camera.position.distanceTo(expectedExit)<1e-8);
// Stream geometry stays fixed while its shader clock animates traffic.
const outside = corridor.createOutside();
assert.equal(outside.children.length,2);
const dashMesh = outside.children[1];
const dashGeometry = dashMesh.geometry;
const oldPositions = Array.from(dashGeometry.attributes.position.array);
const oldShuttle = shuttle.position.clone();
const resourceCount = geometryCount;
outside.userData.k3Display.update(0.1);
assert.equal(dashMesh.geometry,dashGeometry);
assert.equal(geometryCount,resourceCount);
assert.deepEqual(Array.from(dashGeometry.attributes.position.array), oldPositions);
assert.equal(dashMesh.geometry.attributes.stream.array.length, corridor.outsideStream.count * 4);
assert.equal(shuttle.position.distanceTo(oldShuttle),0);
// Corridor boxes and point streams batch irrespective of orientation/length.
const regionOutside = region.createInside();
assert.equal(regionOutside.children.length,3); // Stars, corridor boxes, streams; no shuttle bodies.
const starBatch = regionOutside.children[0];
assert.equal(starBatch.count,2);
assert.equal(regionOutside.children[1].count,1);
assert.ok(regionOutside.children[1].userData.k3Scenes.every(node=>node===corridor));
// A crossing corridor must not expose its fleet while another corridor is active.
const crossing = new RouteCorridor(a,b,"Crossing corridor");
region.add(crossing);
rideGame.camera.position.copy(corridor.localToParent(new Vector3(8,7,0)));
rideGame.updateSceneTransitions();
assert.equal(rideGame.activeScene,corridor);
rideGame.renderLayers();
assert.ok(!rideGame.layers[2].overlapInteriors || !rideGame.layers[2].overlapInteriors.has(crossing));
// Arbitrary box aspect ratio and scale, including roll, use the same core conversion.
const scaledBox = new K3Scene({size:2,insideSize:20,rotation:0.3,pitch:0.4,roll:0.2,
    boundary:{type:"box",halfExtents:[2,3,9]}});
const p = new Vector3(10,20,80);
assert.ok(scaledBox.parentToLocal(scaledBox.localToParent(p.clone())).distanceTo(p)<1e-9);
assert.ok(scaledBox.containsPosition(scaledBox.localToParent(p.clone())));
assert.ok(!scaledBox.containsPosition(scaledBox.localToParent(new Vector3(21,0,0))));
const coincident = new RouteCorridor(a,a,"Coincident endpoints");
coincident.updateTraffic(1000);
assert.ok(coincident.children.every(child=>Number.isFinite(child.position.z)));

// A heavily populated route still owns only eight full shuttle scenes.
const busy = new RouteCorridor(new K3Scene({size:0.1}),
    new K3Scene({size:0.1,position:[0,0,1000]}), "Busy route");
assert.equal(busy.children.length, 8);
assert.equal(busy.stream.count, 512);
assert.ok(Math.abs(busy.traffic[0].shuttle.size - 0.1 * 1.25 * 0.3 / 100) < 1e-12);
assert.ok(Math.abs(busy.stream.laneOffset - 0.1 * 1.25 * 0.04) < 1e-12);
const forward = new Vector3(), reverse = new Vector3();
busy.trafficPosition(5, 0, forward);
busy.trafficPosition(5 + busy.stream.count / 2, 0, reverse);
const nextForward = new Vector3(), nextReverse = new Vector3();
busy.trafficPosition(5, 0.01, nextForward);
busy.trafficPosition(5 + busy.stream.count / 2, 0.01, nextReverse);
assert.ok(Math.abs(nextForward.z - forward.z - busy.stream.speed * 0.01) < 1e-9);
assert.ok(Math.abs(nextReverse.z - reverse.z + busy.stream.speed * 0.01) < 1e-9);
assert.equal(forward.x, -reverse.x);
busy.selectNearbyTraffic(forward, 0);
const occupiedTraffic = busy.traffic.find(craft => craft.particleIndex === 5);
assert.ok(occupiedTraffic && occupiedTraffic.shuttle.enabled);
assert.ok(occupiedTraffic.shuttle.position.distanceTo(forward) < 1e-9);
assert.ok(busy.stream.hiddenIndices.has(5));
busy.game = { activeScene: occupiedTraffic.shuttle, simulationTime: 0.01 };
busy.updateTraffic(0.01);
assert.ok(occupiedTraffic.shuttle.position.distanceTo(nextForward) < 1e-9);
busy.selectNearbyTraffic(new Vector3(10000,10000,10000), 0.01);
assert.equal(occupiedTraffic.particleIndex, 5, "occupied traffic must not be recycled");
const turnaround = (busy.stream.span - busy.stream.phases[5]) / busy.stream.speed;
const gaps = Array.from(busy.stream.phases.slice(1), (phase, index) => phase - busy.stream.phases[index]);
assert.ok(gaps.every(gap => gap > 0));
assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.1, "vehicle gaps must be uneven");
assert.ok(Math.max(...gaps) / Math.min(...gaps) > 5, "spacing must have pronounced clusters and gaps");
const distantGaps = Array.from(busy.outsideStream.phases.slice(1), (phase, index) => phase - busy.outsideStream.phases[index]);
assert.ok(Math.max(...distantGaps) / Math.min(...distantGaps) > 5, "distant sampling must retain visibly irregular spacing");
for (let index = 0; index < busy.outsideStream.count; index++) {
    assert.equal(busy.outsideStream.phases[index], busy.stream.phases[busy.outsideStream.sourceIndices[index]]);
}
const beforeTurn = new Vector3(), afterTurn = new Vector3();
busy.trafficPosition(5, turnaround - 0.0001, beforeTurn);
busy.trafficPosition(5, turnaround + 0.0001, afterTurn);
assert.ok(Math.abs(beforeTurn.z - afterTurn.z) < 1e-8, "traffic must turn at the end, not teleport to the start");
busy.game.activeScene = busy;
busy.selectNearbyTraffic(null, 0.01);
assert.ok(busy.children.every(child => !child.enabled));
assert.equal(busy.stream.hiddenIndices.size, 0);
assert.equal(busy.children.length, 8);
console.log("PASS: opposing GPU dot streams, exact shuttle handoff, fixed pool, occupied identity, endpoint turns and dot restoration.");
console.log("PASS: graph-to-corridor ownership, diagonal/vertical box transforms, normal nested entry/exit, local shuttle motion, dashed animation and unchanged buffers.");

// Mouse look preserves a rolled north reference instead of accumulating bank.
{
    const rotate = (q, x, y, z) => {
        const point = new Quaternion();
        Object.assign(point, {x,y,z,w:0});
        return new Quaternion().copy(q).multiply(point).multiply(new Quaternion().copy(q).invert());
    };
    const orientation = game => new Quaternion().copy(game.controlFrame).multiply(
        new Quaternion().setFromEuler(new Euler(game.pitch, game.yaw, game.roll, "YXZ")));
    for (const roll of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const game = Object.create(K3Game.prototype);
        Object.assign(game, {pitch:0.6, yaw:0.3, roll:0, mouseSensitivity:0.002,
            controlFrame:new Quaternion().setFromEuler(new Euler(0.8,-0.6,0.4,"YXZ"))});
        const before = rotate(orientation(game), 0, 0, -1);
        const oldNorth = rotate(game.controlFrame, 0, 1, 0);
        game.rollLookFrame(roll);
        const after = rotate(orientation(game), 0, 0, -1);
        assert.ok(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z) < 1e-9,
            "roll must preserve the direction being viewed");
        const north = rotate(game.controlFrame, 0, 1, 0);
        assert.ok(Math.hypot(north.x-oldNorth.x,north.y-oldNorth.y,north.z-oldNorth.z) > 0.1);
        for (let step=0; step<100; step++) {
            game.applyMouseLook(15, step%2 ? 30 : -20);
            const unchangedNorth = rotate(game.controlFrame, 0, 1, 0);
            assert.ok(Math.hypot(north.x-unchangedNorth.x,north.y-unchangedNorth.y,north.z-unchangedNorth.z) < 1e-12,
                "yaw/pitch must not move the player's north pole");
            const onScreen = rotate(orientation(game).invert(), north.x, north.y, north.z);
            assert.ok(Math.abs(onScreen.x) < 1e-9, "north must stay on the screen's vertical axis");
            assert.ok(onScreen.y > 0, "north must stay toward the screen top");
        }
        game.applyMouseLook(0,-100000);
        assert.ok(Math.abs(game.pitch-(Math.PI/2-0.01)) < 1e-12);
        game.applyMouseLook(0,100000);
        assert.ok(Math.abs(game.pitch+(Math.PI/2-0.01)) < 1e-12);
    }
    console.log("PASS: fixed player north during yaw/pitch, explicit roll changes north without changing heading, and pole limits.");
}

// Boundary rotations must never become mouse-look or user-roll angles.
{
    const game = Object.create(K3Game.prototype);
    const camera = new Camera();
    camera.rotation.set = function(x, y, z) { Object.assign(this, {x, y, z}); };
    Object.assign(game, {camera, pitch:0.25, yaw:-0.4, roll:0.15, keys:{}, moveSpeed:50});
    game.updateControls(0);
    const original = camera.quaternion;
    const frames = [
        new K3Scene({rotation:0.8, pitch:0.7, roll:-0.5}),
        new K3Scene({rotation:-1.2, pitch:-0.9, roll:0.6}),
        new K3Scene({rotation:0.3}),
        new K3Scene({rotation:1.8, pitch:1.4, roll:0.9})
    ];
    function sameOrientation(actual, expected) {
        const dot = actual.x*expected.x + actual.y*expected.y +
            actual.z*expected.z + actual.w*expected.w;
        assert.ok(Math.abs(Math.abs(dot)-1)<1e-9);
    }
    for (let pass=0; pass<20; pass++) {
        let expected = new Quaternion().copy(original);
        for (const frame of frames) {
            game.rotateCameraFrame(frame, true);
            expected.premultiply(frame.frameQuaternion().invert());
            game.updateControls(0);
            sameOrientation(camera.quaternion, expected);
            [game.pitch, game.yaw, game.roll].forEach((angle, i) =>
                assert.ok(Math.abs(angle-[0.25,-0.4,0.15][i])<1e-12));
        }
        // Vertical/horizontal look and explicit roll use the original control
        // basis even when the camera's scene-local Euler angles are tilted.
        const basis = new Quaternion().copy(game.controlFrame);
        for (const axis of ["pitch", "yaw", "roll"]) {
            game[axis] += 0.1;
            game.updateControls(0);
            sameOrientation(camera.quaternion, new Quaternion().copy(basis).multiply(
                new Quaternion().setFromEuler(new Euler(game.pitch,game.yaw,game.roll,"YXZ"))
            ));
            game[axis] -= 0.1;
        }
        game.updateControls(0);
        for (const frame of frames.slice().reverse()) {
            game.rotateCameraFrame(frame);
            game.updateControls(0);
        }
        sameOrientation(camera.quaternion, original);
    }
    console.log("PASS: repeated tilted nested frame crossings preserve look axes, user roll, and heading.");
}
}
