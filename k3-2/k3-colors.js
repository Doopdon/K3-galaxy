// Edit red, then reload the page to recolor stars, swarm particles and ship disks.
const K3_COLORS = {
    red: 0x990000,//0x7a2b1d,
    galaxyStarColor: 0xffdd66, // Galactic-scale star markers; reload after editing.
    lineBrightness: 1.5, // Galaxy connections are brighter than the base red.

    particles: {
        color: null,          // null uses red above; or set a hex color here.
        innerBrightness: 1,   // 1 = full base color near the center.
        outerBrightness: 0.35,// Raise toward 1 for less darkening at the edge.
        falloff: 1.5,         // Higher = brightness drops off sooner.
        whiteMix: 0          // 0 = preserve hue; up to 1 adds white near the core.
    },

    particleColorAt(radiusFraction) {
        const settings = this.particles;
        const color = settings.color === null ? this.red : settings.color;
        const inward = 1 - Math.max(0, Math.min(1, radiusFraction));
        const brightness = settings.outerBrightness +
            (settings.innerBrightness - settings.outerBrightness) * Math.pow(inward, settings.falloff);
        const white = Math.max(0, Math.min(1, settings.whiteMix)) * Math.pow(inward, 3);
        return [16, 8, 0].map(shift => {
            const base = ((color >> shift) & 255) / 255;
            return Math.max(0, Math.min(1, brightness * (base + (1 - base) * white)));
        });
    },

    get lineRed() {
        const brighten = shift => Math.min(255,
            Math.round(((this.red >> shift) & 255) * this.lineBrightness));
        return (brighten(16) << 16) | (brighten(8) << 8) | brighten(0);
    }
};
