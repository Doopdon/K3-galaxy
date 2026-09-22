# K3 entry points

Open either HTML file directly in a browser; no local server is required.

- `test.html` loads `test-scenes/` for small-scale engine experiments.
- `index.html` loads `k3-scenes/`: Galaxy has a core, haze, and two spiral arms populated with enterable stars. It starts in free flight with no shuttles.

Both pages share `k3-display.js` (visual batching), `k3-scene.js` (scene base), `k3-game.js` (engine and controls), and `main.js` (startup). Each main scene supplies `sceneSetup` for the initial view and optional shuttles. Only the test page currently loads `shuttles.js` and its shuttle models.

Each scene folder owns its planets, main scene, shuttle/mini models, and spare star scene. `star-scene.js` is not loaded by either page yet. Keep script dependencies in order, with `main.js` last; use normal script tags rather than modules so `file://` continues to work.

Run the transition checks with Node.js:

```
node k3-2/tests/layer-transitions.test.js
node k3-2/tests/display-batching.test.js
```

## Outside descriptions and batching

`makeOutside(scene)` can return a visual description:

```js
makeOutside(scene) {
    return { type: "sphere", radius: scene.size, color: 0xff3333 };
}
```

`createInside()` adds `makeInside()` environment geometry, then sends every child's outside description to `K3Display`. Logical children, their parents, containment, positions, and entry/exit remain individual scene objects. The former `makeChildren` hook is removed; the existing galaxy usage has been migrated.

| Type | Options | Batched output |
| --- | --- | --- |
| `sphere` | `radius`, `color`, `wireframe`, `widthSegments`, `heightSegments` | One `InstancedMesh` per compatible material/topology |
| `point` | `color`, `size` (pixels when attenuation is false), `sizeAttenuation` | One `Points` per compatible point style |
| `lines` | `positions` (flat XYZ endpoint pairs), `color`, `linewidth` | One `LineSegments` per compatible line style |

All descriptions support `opacity`, `transparent`, `depthTest`, and `depthWrite`. Different colors and sphere radii can share a batch. Different topology, wireframe, transparency/depth settings, point sizes, or line widths split batches. Materials are unlit/basic. Unsupported effects should use the Object3D fallback. Line widths above one pixel may be ignored by WebGL implementations.

Descriptions are collected when the display is created. Geometry/style changes require recreating the display; node positions, frame rotation, visual spin, descriptor color/radius, and hidden membership are synchronized automatically. Unchanged batches skip buffer uploads. Line endpoint arrays are treated as fixed geometry.

Legacy callbacks returning a normal `THREE.Object3D` still work and remain unbatched. Custom inside environments are also retained. The default placeholder now returns a batchable wireframe-sphere description. Existing disposal behavior is retained: callbacks should create resources owned by their display rather than sharing disposable resources between unrelated displays.

Batching is local to each displayed child collection. Overlapping interiors retain their shared depth-tested render layer; each interior's batches use its own local frame. Hidden children are removed from active batch slots. `object.userData.k3Scenes` maps current instance/vertex slots back to logical nodes; custom objects retain `userData.k3Scene`.

The galaxy's outside preview deliberately requests white points and red connection lines through `K3Display`; this is a choice of region artwork. Stars themselves request blue wireframe spheres. No core code checks whether a scene is a star, ship, planet, or region. Neighbor connections are computed once when a region is created.

Remaining costs: logical animation/visibility checks and batch change detection are linear in scene count; many overlapping interiors add batches; dynamic batches still upload changed buffers; custom objects retain their individual draw calls. Dynamic batches disable frustum culling to avoid stale bounds in Three.js r128. Initial nearest-neighbor decoration generation is quadratic per region. The tests verify resource/batch counts and behavior using Three.js doubles, not actual GPU frame rates.
