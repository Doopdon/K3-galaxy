// Traffic uses the region's existing undirected edges, not another neighbor search.
class ShuttleNetwork {
    constructor(region, connections) {
        this.region = region;
        this.connections = connections;
        this.neighbors = new Map();
        this.routes = [];
        for (const [a, b] of connections) {
            if (!this.neighbors.has(a)) this.neighbors.set(a, []);
            if (!this.neighbors.has(b)) this.neighbors.set(b, []);
            this.neighbors.get(a).push(b);
            this.neighbors.get(b).push(a);
        }
        // Seed every existing edge with one craft. They can later change edges.
        connections.forEach(([from, to], index) => {
            const shuttle = new Shuttle(region.name + " / Shuttle " + (index + 1));
            region.add(shuttle);
            const route = {
                shuttle, from, to, progress: 0.15 + 0.7 * (index + 0.5) / connections.length,
                speed: 20
            };
            this.place(route);
            this.routes.push(route);
        });
    }

    place(route) {
        const a = route.from.position;
        const b = route.to.position;
        const t = route.progress;
        route.shuttle.position.set(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            a.z + (b.z - a.z) * t
        );
    }

    update(delta) {
        for (const route of this.routes) {
            let remaining = route.speed * delta;
            // Guard against a graph with coincident vertices and zero-length cycles.
            for (let hop = 0; hop < 64 && remaining > 0; hop++) {
                const length = route.from.position.distanceTo(route.to.position);
                const distanceLeft = (1 - route.progress) * length;
                if (length > 0 && remaining < distanceLeft) {
                    route.progress += remaining / length;
                    remaining = 0;
                } else {
                    remaining -= distanceLeft;
                    const previous = route.from;
                    route.from = route.to;
                    const neighbors = this.neighbors.get(route.from);
                    const alternatives = neighbors.filter(star => star !== previous);
                    const choices = alternatives.length ? alternatives : neighbors;
                    route.to = choices[Math.floor(Math.random() * choices.length)];
                    route.progress = 0;
                }
            }
            // Update the actual scene; the generic display syncs instance matrices.
            this.place(route);
        }
    }
}
