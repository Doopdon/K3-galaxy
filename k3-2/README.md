# K3 entry points

Open either HTML file directly in a browser; no local server is required.

- `test.html` loads `test-scenes/` for small-scale engine experiments.
- `index.html` loads `k3-scenes/`: Galaxy has one central sphere and six orbiting spheres, each with eight planets. It starts in free flight with no shuttles.

Both pages share `k3-scene.js` (scene base), `k3-game.js` (engine and controls), and `main.js` (startup). Each main scene supplies `sceneSetup` for the initial view and optional shuttles. Only the test page currently loads `shuttles.js` and its shuttle models.

Each scene folder owns its planets, main scene, shuttle/mini models, and spare star scene. `star-scene.js` is not loaded by either page yet. Keep script dependencies in order, with `main.js` last; use normal script tags rather than modules so `file://` continues to work.

Run the transition checks with Node.js:

```
node k3-2/tests/layer-transitions.test.js
```
