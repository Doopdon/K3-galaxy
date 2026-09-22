// One logical scene per existing graph edge. Local +Z points from A to B.
class RouteCorridor extends K3Scene {
    constructor(starA, starB, name) {
        const a = starA.position, b = starB.position;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const length = Math.hypot(dx, dy, dz);
        const half = [10, 10, Math.max(length / 2, 0.01)];
        const size = Math.max(...half);
        super({
            name,
            size, insideSize: size,
            position: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2],
            rotation: Math.atan2(dx, dz),
            pitch: -Math.atan2(dy, Math.hypot(dx, dz)),
            boundary: { type: "box", halfExtents: half },
            revealOnOverlap: false,
            makeOutside() {
                return { type: "group", parts: [
                    { type: "box", halfExtents: half, wireframe: true, color: 0xcc4455 },
                    { type: "dashes", length, dashSize: 4, gapSize: 4, speed: 8, color: 0xff5555 }
                ] };
            },
            onUpdate(scene, delta) { scene.updateTraffic(delta); }
        });
        this.endpoints = [starA, starB];
        this.length = length;
        this.traffic = [];
        for (let index = 0; index < 3; index++) {
            const shuttle = new Shuttle(name + " / Shuttle " + (index + 1));
            shuttle.size = Math.min(3, half[2] / 4);
            shuttle.boundary.halfExtents = [shuttle.size, shuttle.size, shuttle.size];
            const limit = Math.max(0, half[2] - shuttle.size);
            shuttle.position.set((index - 1) * 4, 0, (index - 1) * limit * 0.6);
            this.add(shuttle);
            this.traffic.push({ shuttle, limit, speed: 20, direction: index % 2 ? -1 : 1 });
        }
    }

    updateTraffic(delta) {
        // Reflected motion along local Z, independent of the dotted-line phase.
        for (const craft of this.traffic) {
            const span = craft.limit * 2;
            if (span === 0) continue;
            const z = craft.shuttle.position.z + craft.limit;
            let phase = craft.direction > 0 ? z : span * 2 - z;
            phase = (phase + craft.speed * delta) % (span * 2);
            craft.direction = phase < span ? 1 : -1;
            craft.shuttle.position.z = (phase < span ? phase : span * 2 - phase) - craft.limit;
        }
    }
}
