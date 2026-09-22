# K3 entry points

Open either HTML file directly in a browser; no local server is required.

- `test.html` loads `test-scenes/` for small-scale engine experiments.
- `index.html` loads `k3-scenes/`: Galaxy has a core, haze, and two spiral arms populated with enterable stars and route corridors. Shuttles appear only inside an entered corridor. It starts in free flight.

Both pages share `k3-display.js` (visual batching), `k3-scene.js` (scene base), `k3-game.js` (engine and controls), and `main.js` (startup). Each main scene supplies `sceneSetup` for the initial view. The test page loads the original `shuttles.js` ride demo. The K3 page loads its shuttle and route-corridor models, without automatic boarding.

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
| `box` | `radius` (half-edge length) or `halfExtents: [x,y,z]`, `color`, `wireframe` | One `InstancedMesh` per compatible material |
| `point` | `color`, `size` (pixels when attenuation is false), `sizeAttenuation` | One `Points` per compatible point style |
| `lines` | `positions` (flat XYZ endpoint pairs), `color`, `linewidth` | One `LineSegments` per compatible line style |
| `dashes` | `length` along local Z, `dashSize`, `gapSize`, `speed`, `color` | One animated `LineSegments` per compatible line style |
| `group` | `parts: [description, ...]` | Parts flatten into the same generic batches |

All descriptions support `opacity`, `transparent`, `depthTest`, and `depthWrite`. Different colors and sphere radii can share a batch. Different topology, wireframe, transparency/depth settings, point sizes, or line widths split batches. Materials are unlit/basic. Unsupported effects should use the Object3D fallback. Line widths above one pixel may be ignored by WebGL implementations.

Descriptions are collected when the display is created. Geometry/style changes require recreating the display; node positions, frame rotation, visual spin, descriptor color/radius, and hidden membership are synchronized automatically. Unchanged batches skip buffer uploads. Line endpoint arrays are treated as fixed geometry.

Legacy callbacks returning a normal `THREE.Object3D` still work and remain unbatched. Custom inside environments are also retained. The default placeholder now returns a batchable wireframe-sphere description. Existing disposal behavior is retained: callbacks should create resources owned by their display rather than sharing disposable resources between unrelated displays.

Batching is local to each displayed child collection. Overlapping interiors retain their shared depth-tested render layer; each interior's batches use its own local frame. Hidden children are removed from active batch slots. `object.userData.k3Scenes` maps current instance/vertex slots back to logical nodes; custom objects retain `userData.k3Scene`.

The galaxy's outside preview requests white points and animated dashed links through `K3Display`. Stars request blue wireframe spheres. No core code checks whether a scene is a star, ship, planet, or corridor. Neighbor connections are computed once when a region is created.

## Enterable route corridors

Each region stores `stars` separately from its full `children` list and retains `connections` as `[starA, starB]` references. The existing two-nearest-neighbor/index-filter rule is unchanged, so these are precisely the old red-line edges. `connectionPositions()` produces line geometry data from the same graph when needed.

Each pair becomes one `RouteCorridor` in `region.corridors`, also added to `region.children`. Its midpoint is `(A+B)/2`, its length is `distance(A,B)`, and its yaw/pitch align local +Z with B-A. The box is initially 20 units wide and high. Endpoint stars are references on `corridor.endpoints`; connectivity never depends on rendered geometry.

The hierarchy is `Galaxy -> Region -> RouteCorridor -> Shuttle`. Each corridor owns three shuttle children, moving along local Z in separate lanes at 20 local units per simulation second. They reverse at the endpoint sides. They no longer choose other graph edges or belong to the region directly. Movement uses the generic `onUpdate(scene, delta)` hook and updates logical positions; ordinary batching synchronizes their matrices.

The corridor outside description combines a stretched wireframe `box` with animated `dashes`. Region interiors use three batches: stars, corridor boxes, and corridor dashes. No shuttle geometry appears at that level. Inside a corridor, only its own gold shuttle batch is created. The old orange-square shuttle interior is retained, as is the independent test-page shuttle demo.

Dashed lines move in local +Z using simulation time, independently of traffic. Their fixed-capacity buffers are updated without recreating geometry or materials. Appearance settings live in the corridor's display description and can be changed without changing routing. Distant region previews reuse only the dashed part, plus white stars.

## Boundaries and orientation

`K3Scene` defaults to a spherical boundary. For rectangular scenes use `boundary: {type: "box", halfExtents: [x,y,z]}` in parent units. `size/insideSize` still defines a uniform unit conversion; interior box extents are multiplied by `insideSize/size`. Corridors currently use a 1:1 conversion. `containsPosition` and `containsInsidePosition` drive the same normal enter/exit path for both shapes.

Scene `rotation` is yaw; `pitch` and `roll` default to zero. Position and orientation conversion uses YXZ order, including camera headings, overlap displays, and batched visuals. A camera inside a moving shuttle keeps its local position and follows the shuttle's current frame.

`revealOnOverlap` defaults to true. Corridors set it false so another intersecting corridor does not reveal its fleet automatically; the active corridor still opens normally. There is no route-specific entry mechanism.

Limitations: corridor placement is established when the region is built; moving individual endpoint stars later requires refreshing the corridor dimensions/pose. Shuttles are confined to one corridor, not transferred through the graph. Extremely short/coincident links are clamped to a small positive box length. Wireframe boxes use the standard mesh wireframe, so face diagonals may be visible. Animated dash buffers are updated on the CPU, and there is no spatial index for containment tests yet.

Remaining costs: logical animation/visibility checks and batch change detection are linear in scene count; many overlapping interiors add batches; dynamic batches still upload changed buffers; custom objects retain their individual draw calls. Dynamic batches disable frustum culling to avoid stale bounds in Three.js r128. Initial nearest-neighbor decoration generation is quadratic per region. The tests verify resource/batch counts and behavior using Three.js doubles, not actual GPU frame rates.
