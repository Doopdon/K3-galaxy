# K3 entry points

Open either HTML file directly in a browser; no local server is required.

- `test.html` loads `test-scenes/` for small-scale engine experiments.
- `index.html` loads `k3-scenes/` for the real game scene definitions. This starts as a copy of the test scenes, ready to develop independently.

Both pages share `k3-scene.js` (scene base), `k3-game.js` (engine and controls), `shuttles.js` (shuttle movement and riding), and `main.js` (startup).

Each scene folder owns its planets, main scene, shuttle/mini models, and spare star scene. `star-scene.js` is not loaded by either page yet. Keep script dependencies in order, with `main.js` last; use normal script tags rather than modules so `file://` continues to work.

Run the transition checks with Node.js:

```
node k3-2/tests/layer-transitions.test.js
node k3-2/tests/layer-transitions.test.js k3-scenes
```
