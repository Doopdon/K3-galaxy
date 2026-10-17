// Shared physical ship size. Edit multiplier and reload: 1 = original swarm
// ship size, 0.5 = half size, 2 = double size, for BOTH swarm and transit ships.
const K3_SHIP_SIZE = {
    multiplier: 1,
    spinSpeed: Math.PI * 2, // Radians per simulation second: one axial turn/sec at 1x.
    lightRotationMultiplier: 1.15, // World light turns 15% faster than the ship.
    referenceFov: 60,
    particleSize: 0.095,

    updateRotation(scene, time, base) {
        const angle = (time * this.spinSpeed) % (Math.PI * 2);
        if (angle === 0) {
            scene.rotation = base.rotation; scene.pitch = base.pitch; scene.roll = base.roll;
            return;
        }
        // Ship recipes run along local X. Compose after the base orientation
        // so even randomly tilted ships spin around their own spine.
        const orientation = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(base.pitch, base.rotation, base.roll, "YXZ"));
        orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), angle));
        const frame = new THREE.Euler().setFromQuaternion(orientation, "YXZ");
        scene.rotation = frame.y; scene.pitch = frame.x; scene.roll = frame.z;
    },

    swarmHalfExtent(star) {
        const particleSize = star.insideSize * STAR_VISUAL_RADIUS_RATIO / 9.6 * this.particleSize;
        return particleSize * Math.tan(this.referenceFov * Math.PI / 360) * 0.5 * this.multiplier;
    },

    parentHalfExtent(star) {
        return this.swarmHalfExtent(star) * star.size / star.insideSize;
    }
};
