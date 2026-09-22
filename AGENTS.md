# K3 Galaxy project instructions

This is a Three.js K3 galaxy prototype.

## Architecture

- In k3-2, use separate THREE.Scene render layers for the active scene and its ancestors. Render ancestors first and clear depth between layers so the active scene draws on top.
- K3Scene objects are logical nested scene nodes.
- In k3-2, K3Display batches outside descriptions by visual compatibility, never by semantic scene type. createInside always displays its environment plus generic child representations; do not add star-specific child renderers.
- Each K3Scene has an outside representation.
- A K3Scene may contain child K3Scenes.
- Entering a K3Scene hides its outside representation and shows the outside representations of its children. Ancestor layers retain the siblings of the entered scene.
- Positions and sizes are local to the parent scene.
- In k3-2, insideSize defines the interior radius in independent local units; size defines the outside radius in parent units. Convert camera positions across one boundary at a time instead of accumulating a global scale.
- Scene rotation (yaw), pitch, and roll define the local YXZ coordinate frame (all default to zero); rotationSpeed advances yaw. Cameras inherit their active scene frame; visual spin and child orbit animations remain independent. Use parentToLocal/localToParent for boundary transforms.
- Scenes support spherical boundaries or oriented box boundaries with halfExtents in parent units. Use containsPosition/containsInsidePosition rather than assuming every boundary is a sphere. revealOnOverlap can disable automatic peer-interior reveals while retaining normal entry.
- Collision checks operate on the active scene and its immediate children, plus immediate children of overlapping sibling interiors at the same movement depth. Keep one movement frame until its boundary is exited.
- Overlapping containing spheres hide their shells and reveal their interiors together. Put peer interiors into a common local render layer so their geometry shares depth testing.

## Project constraints

- The project must run by double-clicking index.html using file://.
- Do not require a local server.
- Do not convert the project to ES modules.
- JavaScript files are loaded with normal script tags in index.html.
- Keep dependencies simple.
- Preserve WASD + mouse flight controls.
- Prefer readable code over clever abstractions.

## Current goal

Build nested spatial scenes where flying across a scene boundary enters that scene.
