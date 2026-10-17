// Nearby swarm dots promoted to reusable, enterable cube scenes.
const K3_SWARM_SHIPS = { maxVisible: 320, revealDistance: 60 };

function installSwarmChildren(scene, data) {
    const capacity = K3_SWARM_SHIPS.maxVisible;
    // PointsMaterial uses viewportHeight/2; geometric projection also includes
    // 1/tan(fov/2). Match a face-on cube's edge to that point footprint.
    // Use a fixed reference: zooming must not change physical ship sizes.
    const edge = K3_SHIP_SIZE.swarmHalfExtent(scene) * 2;
    const range = edge * K3_SWARM_SHIPS.revealDistance;
    const binWidth = edge * 12;
    const bins = [];
    const pool = [];
    data.visibilityAttributes = new Set();
    data.positionAt = (index, time, target) => {
        const angle = data.orbits[index * 2] + data.orbits[index * 2 + 1] * time;
        const cosine = Math.cos(angle), sine = Math.sin(angle), offset = index * 3;
        return target.set(
            data.axisA[offset] * cosine + data.axisB[offset] * sine,
            data.axisA[offset + 1] * cosine + data.axisB[offset + 1] * sine,
            data.axisA[offset + 2] * cosine + data.axisB[offset + 2] * sine);
    };
    // Orbital radius is constant: only nearby radial bands need trig/distance
    // evaluation. No full 100000-particle position update or GPU readback.
    for (let index = 0; index < data.orbits.length / 2; index++) {
        const offset = index * 3;
        const radius = Math.hypot(data.axisA[offset], data.axisA[offset + 1], data.axisA[offset + 2]);
        const bin = Math.floor(radius / binWidth);
        if (!bins[bin]) bins[bin] = [];
        bins[bin].push(index);
    }
    for (let slot = 0; slot < capacity; slot++) {
        const ship = SpaceshipGenerator.generate();
        const orientation = {
            rotation: Math.random() * Math.PI * 2,
            pitch: Math.asin(Math.random() * 2 - 1),
            roll: Math.random() * Math.PI * 2
        };
        ship.emissiveness = 0;
        const shipParts = SpaceshipGenerator.describeOutside(ship, edge / 2, 12, ship.emissiveness);
        const child = new K3Scene({ name: scene.name + " / Swarm cube", size: edge / 2,
            ...orientation,
            insideSize: 100, flightSpeed: 10, revealOnOverlap: false,
            boundary: { type: "box", halfExtents: [edge / 2, edge / 2, edge / 2] },
            makeOutside: node => ({ type: "group", parts: [
                { type: "box", radius: node.size, color: 0xff0000, wireframe: true, collisionBoundary: true },
                ...shipParts
            ] }),
            makeInside: node => K3ShipCloseup.create(node.shipData) });
        // Keep the full recipe on the logical scene, rather than only inside
        // the outside renderer's closure. Descendants can use parent.shipData.
        child.shipData = ship;
        child.shipData.orientation = orientation;
        child.shipData.outsideScale = SpaceshipGenerator.fitScale(ship, child.size);
        child.shipData.insideScale = child.shipData.outsideScale * child.insideSize / child.size;
        child.enabled = false;
        child.particleIndex = -1;
        scene.add(child);
        pool.push(child);
    }
    data.pool = pool;
    data.range = range;
    const previousUpdate = scene.onUpdate;
    scene.onUpdate = (node, delta) => {
        if (previousUpdate) previousUpdate(node, delta);
        const time = scene.game.simulationTime || 0;
        for (const child of pool) {
            if (child.enabled) data.positionAt(child.particleIndex, time, child.position);
        }
    };
    const point = new THREE.Vector3();
    let lastQuery = null;
    scene.refreshNearbyChildren = (cameraPosition, time) => {
        let occupied = scene.game.activeScene;
        while (occupied && occupied.parent !== scene) occupied = occupied.parent;
        if (lastQuery && lastQuery.time === time && lastQuery.occupied === occupied &&
            lastQuery.x === (cameraPosition && cameraPosition.x) &&
            lastQuery.y === (cameraPosition && cameraPosition.y) &&
            lastQuery.z === (cameraPosition && cameraPosition.z)) return;
        lastQuery = { time, occupied, x: cameraPosition && cameraPosition.x,
            y: cameraPosition && cameraPosition.y, z: cameraPosition && cameraPosition.z };
        const candidates = [];
        const radius = cameraPosition ? cameraPosition.length() : 0;
        const outerRange = range * 1.25;
        const retained = new Set(pool.filter(child => child.enabled).map(child => child.particleIndex));
        data.lastQueryCount = 0;
        for (let bin = Math.max(0, Math.floor((radius - outerRange) / binWidth));
            cameraPosition && bin <= Math.floor((radius + outerRange) / binWidth); bin++) {
            for (const index of bins[bin] || []) {
                data.lastQueryCount++;
                data.positionAt(index, time, point);
                const distance = point.distanceTo(cameraPosition);
                if (distance <= (retained.has(index) ? outerRange : range)) candidates.push({ index, distance });
            }
        }
        candidates.sort((a, b) => a.distance - b.distance);
        const chosen = new Set(candidates.slice(0, capacity - (occupied ? 1 : 0)).map(item => item.index));
        if (occupied && pool.includes(occupied)) chosen.add(occupied.particleIndex);
        let changed = false;
        for (const child of pool) {
            if (child.enabled && !chosen.has(child.particleIndex)) {
                data.visible[child.particleIndex] = 1;
                child.enabled = false;
                child.particleIndex = -1;
                changed = true;
            }
        }
        const assigned = new Set(pool.filter(child => child.enabled).map(child => child.particleIndex));
        for (const index of chosen) {
            if (assigned.has(index)) continue;
            const child = pool.find(entry => !entry.enabled);
            if (!child) break;
            child.enabled = true;
            child.particleIndex = index;
            child.name = scene.name + " / Dot " + (index + 1);
            data.visible[index] = 0;
            changed = true;
        }
        for (const child of pool) if (child.enabled) data.positionAt(child.particleIndex, time, child.position);
        // Upload before renderer traversal, so the dot disappears in the very
        // same frame that its cube becomes visible.
        if (changed) for (const attribute of data.visibilityAttributes) attribute.needsUpdate = true;
    };
}
