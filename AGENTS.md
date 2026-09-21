# K3 Galaxy project instructions

This is a Three.js K3 galaxy prototype.

## Architecture

- Use one real THREE.Scene.
- K3Scene objects are logical nested scene nodes.
- Each K3Scene has an outside representation.
- A K3Scene may contain child K3Scenes.
- Entering a K3Scene hides its outside representation and shows the outside representations of its children.
- Positions and sizes are local to the parent scene.
- Collision checks should only operate on the currently active scene and its immediate children.

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