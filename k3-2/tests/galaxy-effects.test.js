// Run with: node k3-2/tests/galaxy-effects.test.js
// Verify render-target ownership and that galactic fog/exposure cannot leak
// into the nearby scene renderer, including when a postprocessing pass fails.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Pass { setSize() {} }
class Composer {
    constructor(renderer) { this.renderer = renderer; this.passes = []; this.readBuffer = {}; }
    addPass(pass) { this.passes.push(pass); }
    setPixelRatio(value) { this.pixelRatio = value; }
    setSize(width, height) { this.size = [width, height]; }
    render() {
        for (const pass of this.passes) pass.render(this.renderer, {}, this.readBuffer);
        if (this.fail) throw new Error("simulated GPU failure");
    }
}
class Bloom extends Pass {
    constructor(resolution, strength, radius, threshold) {
        super(); Object.assign(this, { strength, radius, threshold });
    }
    render() {}
}
const THREE = { EffectComposer: Composer, UnrealBloomPass: Bloom, ShaderPass: Pass, Pass,
    Vector2: class {}, FogExp2: class { constructor(color, density) { Object.assign(this, {color, density}); } },
    ACESFilmicToneMapping: 4 };
const context = vm.createContext({ THREE, window: { innerWidth: 800, innerHeight: 600 }, console });
const source = ["k3-colors.js", "k3-galaxy-effects.js", "k3-game.js"]
    .map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const { K3GalaxyEffects, K3_COLORS, K3Game } = vm.runInContext(source + ";({K3GalaxyEffects, K3_COLORS, K3Game})", context);
const previousTarget = {};
const previousFog = {};
const renderer = { target: previousTarget, toneMapping: 0, toneMappingExposure: 0.8,
    getPixelRatio: () => 2, getRenderTarget() { return this.target; },
    setRenderTarget(target) { this.target = target; } };
let draws = 0;
const calls = [];
renderer.clear = () => calls.push("clear");
renderer.clearDepth = () => calls.push("depth");
renderer.render = scene => calls.push(scene.name);
const game = { renderer, layers: [
    { scene: { name: "galaxy", fog: previousFog } },
    { scene: { name: "region", fog: null } },
    { scene: { name: "ship", fog: null } }
], renderStarBackground() { calls.push("background"); },
    renderLayerStack(start, end, clear) {
        draws++;
        assert.equal(start, 0);
        assert.equal(end, 1);
        assert.notEqual(renderer.target, previousTarget);
        assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
        assert.equal(renderer.toneMappingExposure, K3_COLORS.galaxyEffects.exposure);
        assert.equal(this.layers[0].scene.fog.density, K3_COLORS.galaxyEffects.fogDensity);
        assert.equal(this.layers[1].scene.fog, null);
        assert.equal(this.layers[2].scene.fog, null);
        K3Game.prototype.renderLayerStack.call(this, start, end, clear);
    } };
const effects = new K3GalaxyEffects(game);
assert.equal(effects.render(), true);
assert.equal(draws, 1);
assert.deepEqual(calls, ["clear", "background", "depth", "galaxy"]);
K3Game.prototype.renderLayerStack.call(game, 1, game.layers.length, false);
assert.deepEqual(calls, ["clear", "background", "depth", "galaxy", "depth", "region", "depth", "ship"]);
assert.equal(renderer.target, previousTarget);
assert.equal(renderer.toneMappingExposure, 0.8);
assert.equal(renderer.toneMapping, 0);
assert.equal(game.layers[0].scene.fog, previousFog);
assert.equal(effects.composer.pixelRatio, 1.5);
effects.resize(1200, 700);
assert.deepEqual(effects.composer.size, [1200, 700]);
effects.composer.fail = true;
assert.throws(() => effects.render(), /simulated GPU failure/);
assert.equal(renderer.target, previousTarget);
assert.equal(game.layers[0].scene.fog, previousFog);
assert.equal(renderer.toneMapping, 0);
assert.equal(renderer.toneMappingExposure, 0.8);
console.log("PASS: one bloomed galaxy render, sharp foreground layers without clearing color, resize, and state restoration on success/failure.");
