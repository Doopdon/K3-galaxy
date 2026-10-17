// One logical scene per existing graph edge. Local +Z points from A to B.
const K3_ROUTE_SHIPS = {
    maxVisible: 8,
    revealDistance: 80, // Multiples of shuttle boundary radius (previously 20).
    laneOffset: 0.04, // Fraction of corridor half-width (previously 0.4).
    dotsPerLane: 256,
    distantDotsPerLane: 32
};

class RouteCorridor extends K3Scene {
    constructor(starA, starB, name) {
        const a = starA.position, b = starB.position;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const length = Math.hypot(dx, dy, dz);
        const halfWidth = Math.min(starA.size, starB.size) * 1.25;
        const half = [halfWidth, halfWidth, Math.max(length / 2, halfWidth * 0.001)];
        const size = Math.max(...half);
        super({
            name,
            size, insideSize: size,
            position: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2],
            rotation: Math.atan2(dx, dz),
            pitch: -Math.atan2(dy, Math.hypot(dx, dz)),
            boundary: { type: "box", halfExtents: half },
            revealOnOverlap: false,
            makeOutside(scene) {
                return {
                    type: "group", parts: [
                        { type: "box", halfExtents: half, wireframe: true, color: 0xcc4455, collisionBoundary: true },
                        scene.outsideStream
                    ]
                };
            },
            makeInside: scene => K3Display.create([{ node: null, appearance: scene.stream }]),
            onUpdate(scene, delta) { scene.updateTraffic(delta); }
        });
        this.endpoints = [starA, starB];
        this.length = length;
        const shuttleSize = Math.min(K3_SHIP_SIZE.parentHalfExtent(starA),
            K3_SHIP_SIZE.parentHalfExtent(starB), half[2] / 4);
        // Reveal distance is independent of the physical ship-size control.
        this.shipRevealRange = Math.min(halfWidth * 0.3, half[2] / 4) * K3_ROUTE_SHIPS.revealDistance;
        const span = Math.max(half[2] * 2 - shuttleSize * 2, halfWidth * 0.001);
        // Keep physical vehicles separated, including on short routes. Long
        // routes show dense dot streams while keeping the full ship pool fixed.
        const perLane = Math.max(1, Math.min(K3_ROUTE_SHIPS.dotsPerLane,
            2 ** Math.floor(Math.log2(Math.max(1, span / (shuttleSize * 6))))));
        this.stream = { type: "pointStream", count: perLane * 2, size: 2,
            span,
            laneOffset: halfWidth * K3_ROUTE_SHIPS.laneOffset, speed: 20 * (0.85 + Math.random() * 0.3), color: K3_COLORS.lineRed,
            hiddenIndices: new Set(), version: 0 };
        // Random gap lengths, not jittered grid slots. Each lane starts with
        // its own pattern and phase; keep a minimum gap for physical vehicles.
        this.stream.phases = new Float32Array(this.stream.count);
        for (let lane = 0; lane < 2; lane++) {
            const weights = Array.from({ length: perLane }, () => -Math.log(Math.max(1e-9, Math.random())));
            const total = weights.reduce((sum, weight) => sum + weight, 0);
            const minimum = Math.min(shuttleSize * 3, span / perLane * 0.5);
            const freeLength = span - minimum * perLane;
            const offset = Math.random() * span;
            const phases = [];
            let cursor = 0;
            for (const weight of weights) {
                phases.push(((cursor + offset) % span) + lane * span);
                cursor += minimum + freeLength * weight / total;
            }
            phases.sort((a, b) => a - b);
            this.stream.phases.set(phases, lane * perLane);
        }
        // Distant views sample the same stream at a lower density.
        this.outsideStream = { ...this.stream, count: Math.min(K3_ROUTE_SHIPS.distantDotsPerLane * 2, this.stream.count), hiddenIndices: new Set() };
        this.outsideStream.phases = new Float32Array(this.outsideStream.count);
        // Sampling every nth particle averages out the irregular gaps. Choose
        // a stable random subset instead, retaining exact vehicle identities.
        const indices = Array.from({ length: this.stream.count }, (_, index) => index);
        for (let index = indices.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [indices[index], indices[other]] = [indices[other], indices[index]];
        }
        this.outsideStream.sourceIndices = indices.slice(0, this.outsideStream.count).sort((a, b) => a - b);
        for (let index = 0; index < this.outsideStream.count; index++) {
            this.outsideStream.phases[index] = this.stream.phases[this.outsideStream.sourceIndices[index]];
        }
        this.trafficTime = 0;
        this.traffic = [];
        for (let index = 0; index < K3_ROUTE_SHIPS.maxVisible; index++) {
            const shuttle = new Shuttle(name + " / Shuttle " + (index + 1));
            const describeBoundary = shuttle.makeOutside;
            let shipParts = null;
            shuttle.makeOutside = node => {
                // Generate only when this corridor is opened, not for every
                // pooled shuttle across the entire galaxy at startup.
                if (!shipParts) {
                    node.shipData = SpaceshipGenerator.generate();
                    node.shipData.emissiveness = 1;
                    const modelRadius = node.size;
                    node.shipData.outsideScale = SpaceshipGenerator.fitScale(node.shipData, modelRadius);
                    node.shipData.insideScale = node.shipData.outsideScale * node.insideSize / node.size;
                    shipParts = SpaceshipGenerator.describeOutside(node.shipData, modelRadius, 12, node.shipData.emissiveness);
                }
                return { type: "group", parts: [describeBoundary(node), ...shipParts] };
            };
            shuttle.size = shuttleSize;
            shuttle.boundary.halfExtents = [shuttle.size, shuttle.size, shuttle.size];
            const limit = Math.max(0, half[2] - shuttle.size);
            shuttle.position.set(0, 0, 0);
            this.add(shuttle);
            shuttle.enabled = false;
            this.traffic.push({ shuttle, limit, speed: 20, direction: 1, particleIndex: -1 });
        }
        this.refreshNearbyChildren = (position, time) => this.selectNearbyTraffic(position, time);
    }

    trafficPosition(index, time, target) {
        const { span, speed, laneOffset, phases } = this.stream;
        const phase = ((phases[index] + speed * time) % (span * 2) + span * 2) % (span * 2);
        const direction = phase < span ? 1 : -1;
        target.set(direction * laneOffset, 0, phase < span ? phase - span / 2 : span * 1.5 - phase);
        return direction;
    }

    selectNearbyTraffic(position, time) {
        let occupied = this.game && this.game.activeScene;
        while (occupied && occupied.parent !== this) occupied = occupied.parent;
        const pinned = this.traffic.find(craft => craft.shuttle === occupied);
        const nearby = [];
        const point = new THREE.Vector3();
        // Preserve the reveal bubble when shrinking the physical vehicles.
        const range = this.shipRevealRange;
        if (position) for (let index = 0; index < this.stream.count; index++) {
            if (pinned && pinned.particleIndex === index) continue;
            this.trafficPosition(index, time, point);
            const distance = point.distanceTo(position);
            if (distance < range) nearby.push({ index, distance });
        }
        nearby.sort((a, b) => a.distance - b.distance);
        const chosen = new Set(nearby.slice(0, this.traffic.length - (pinned ? 1 : 0)).map(item => item.index));
        if (pinned) chosen.add(pinned.particleIndex);
        let changed = false;
        for (const craft of this.traffic) {
            if (craft.particleIndex >= 0 && !chosen.has(craft.particleIndex)) {
                this.stream.hiddenIndices.delete(craft.particleIndex);
                craft.particleIndex = -1;
                craft.shuttle.enabled = false;
                changed = true;
            }
        }
        for (const index of chosen) {
            if (this.traffic.some(craft => craft.particleIndex === index)) continue;
            const craft = this.traffic.find(entry => entry.particleIndex < 0);
            craft.particleIndex = index;
            craft.shuttle.enabled = true;
            this.stream.hiddenIndices.add(index);
            changed = true;
        }
        if (changed) this.stream.version++;
        for (const craft of this.traffic) if (craft.shuttle.enabled) {
            craft.direction = this.trafficPosition(craft.particleIndex, time, craft.shuttle.position);
            craft.shuttle.rotation = -craft.direction * Math.PI / 2;
        }
    }

    updateTraffic(delta) {
        this.trafficTime = this.game ? (this.game.simulationTime || 0) : this.trafficTime + delta;
        for (const craft of this.traffic) {
            if (craft.shuttle.enabled) {
                craft.direction = this.trafficPosition(craft.particleIndex, this.trafficTime, craft.shuttle.position);
                craft.shuttle.rotation = -craft.direction * Math.PI / 2;
            }
        }
    }
}
