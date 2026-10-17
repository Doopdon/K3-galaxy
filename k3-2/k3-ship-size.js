// Shared physical ship size. Edit multiplier and reload: 1 = original swarm
// ship size, 0.5 = half size, 2 = double size, for BOTH swarm and transit ships.
const K3_SHIP_SIZE = {
    multiplier: 1,
    referenceFov: 60,
    particleSize: 0.095,

    swarmHalfExtent(star) {
        const particleSize = star.insideSize * STAR_VISUAL_RADIUS_RATIO / 9.6 * this.particleSize;
        return particleSize * Math.tan(this.referenceFov * Math.PI / 360) * 0.5 * this.multiplier;
    },

    parentHalfExtent(star) {
        return this.swarmHalfExtent(star) * star.size / star.insideSize;
    }
};
