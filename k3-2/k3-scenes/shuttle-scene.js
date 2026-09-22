// The mini is the outside model only. Its interior is never drawn here.
class ShuttleMini {
    create(size) {
        return { type: "box", radius: size, color: 0xffbb33, wireframe: true };
    }
}

class Shuttle extends K3Scene {
    constructor(name) {
        const mini = new ShuttleMini();
        super({
            name,
            size: 3,
            insideSize: 1000,
            makeOutside: scene => mini.create(scene.size),
            makeInside: () => new THREE.Mesh(
                new THREE.PlaneGeometry(500, 500),
                new THREE.MeshBasicMaterial({ color: 0xff6600, side: THREE.DoubleSide })
            )
        });
    }

    containsPosition(position) {
        const local = position.clone().sub(this.position);
        this.rotatePosition(local, -this.rotation);
        return Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) <= this.size;
    }

    containsInsidePosition(position) {
        return Math.max(Math.abs(position.x), Math.abs(position.y), Math.abs(position.z)) <= this.insideSize;
    }
}
