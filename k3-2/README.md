# K3 entry points

Open either HTML file directly in a browser; no local server is required.

- `test.html` loads `test-scenes/` for small-scale engine experiments.
- `index.html` loads `k3-scenes/`: Galaxy has a core, haze, and two spiral arms populated with enterable stars. It starts in free flight with no shuttles.

Both pages share `k3-display.js` (visual batching), `k3-scene.js` (scene base), `k3-game.js` (engine and controls), and `main.js` (startup). Each main scene supplies `sceneSetup` for the initial view. The test page loads the original `shuttles.js` ride demo. The K3 page instead loads its shuttle scene model and region route networks, without automatic boarding.

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
| `box` | `radius` (half-edge length), `color`, `wireframe` | One `InstancedMesh` per compatible material |
| `point` | `color`, `size` (pixels when attenuation is false), `sizeAttenuation` | One `Points` per compatible point style |
| `lines` | `positions` (flat XYZ endpoint pairs), `color`, `linewidth` | One `LineSegments` per compatible line style |

All descriptions support `opacity`, `transparent`, `depthTest`, and `depthWrite`. Different colors and sphere radii can share a batch. Different topology, wireframe, transparency/depth settings, point sizes, or line widths split batches. Materials are unlit/basic. Unsupported effects should use the Object3D fallback. Line widths above one pixel may be ignored by WebGL implementations.

Descriptions are collected when the display is created. Geometry/style changes require recreating the display; node positions, frame rotation, visual spin, descriptor color/radius, and hidden membership are synchronized automatically. Unchanged batches skip buffer uploads. Line endpoint arrays are treated as fixed geometry.

Legacy callbacks returning a normal `THREE.Object3D` still work and remain unbatched. Custom inside environments are also retained. The default placeholder now returns a batchable wireframe-sphere description. Existing disposal behavior is retained: callbacks should create resources owned by their display rather than sharing disposable resources between unrelated displays.

Batching is local to each displayed child collection. Overlapping interiors retain their shared depth-tested render layer; each interior's batches use its own local frame. Hidden children are removed from active batch slots. `object.userData.k3Scenes` maps current instance/vertex slots back to logical nodes; custom objects retain `userData.k3Scene`.

The galaxy's outside preview deliberately requests white points and red connection lines through `K3Display`; this is a choice of region artwork. Stars themselves request blue wireframe spheres. No core code checks whether a scene is a star, ship, planet, or region. Neighbor connections are computed once when a region is created.

## Region shuttle traffic

Each region stores `stars` separately from its full `children` list and retains `connections` as `[starA, starB]` references. The existing two-nearest-neighbor/index-filter rule is unchanged, so these are precisely the old red-line edges. `connectionPositions()` produces line geometry data from the same graph when needed.

`ShuttleNetwork` builds undirected adjacency lists once and starts one logical `Shuttle` per edge. Each craft moves at 20 region units per simulation second and chooses a connected neighbor at arrival. It excludes the previous star whenever another neighbor is available; dead ends reverse. Isolated stars receive no traffic. Network updates write `shuttle.position` directly.

Regions invoke their networks through the generic `onUpdate(scene, delta)` callback. The engine runs this callback in simulation time before containment checks, so F/R also control traffic. Stars and shuttles are ordinary sibling K3Scenes; no special boarding, reparenting, or shuttle render pass is used. Flying inside a moving cube enters its local frame and shows the reused orange square interior. Flying out restores its outside representation at its current position.

Shuttle minis now request gold wireframe `box` descriptions, which share a second instanced batch alongside the blue star batch. Movement updates matrices without recreating geometry or material resources. The original test-page shuttle system remains separate and unchanged.

`region.showRouteLines` defaults to `false`: inside views show traffic but no connection lines. Set it to `true` before constructing/re-entering the region's display to enable line visualization alongside traffic. Outside previews still show the original white stars/red links and explicitly exclude shuttles. The graph remains available for navigation and other visualizations.

Remaining costs: logical animation/visibility checks and batch change detection are linear in scene count; many overlapping interiors add batches; dynamic batches still upload changed buffers; custom objects retain their individual draw calls. Dynamic batches disable frustum culling to avoid stale bounds in Three.js r128. Initial nearest-neighbor decoration generation is quadratic per region. The tests verify resource/batch counts and behavior using Three.js doubles, not actual GPU frame rates.
