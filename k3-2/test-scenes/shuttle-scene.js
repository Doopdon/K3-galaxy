// The mini is the outside model only. Its interior is never drawn here.
class ShuttleMini {
    create(size) {
        const cube = new THREE.Group();
        const box = new THREE.BoxGeometry(size * 2, size * 2, size * 2);
        cube.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(box),
            new THREE.LineBasicMaterial({ color: 0x3399ff })
        ));
        box.dispose();
        return cube;
    }
}

class Shuttle extends K3Scene {
    constructor(name) {
        const mini = new ShuttleMini();
        super({
            name,
            size: 6,
            insideSize: 1000,
            makeOutside: scene => mini.create(scene.size),
            makeInside: () => new THREE.Mesh(
                new THREE.PlaneGeometry(500, 500),
                new THREE.MeshBasicMaterial({ color: 0x0066ff, side: THREE.DoubleSide })
            )
        });
    }

    containsPosition(position) {
        const local = position.clone().sub(this.position);
        return Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) <= this.size;
    }

    containsInsidePosition(position) {
        return Math.max(Math.abs(position.x), Math.abs(position.y), Math.abs(position.z)) <= this.insideSize;
    }
}

