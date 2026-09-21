// Each star is a real scene, with a small red outside representation.
function createStarScenes(parentSize, namePrefix) {
    const stars = [];
    const starSize = 8;
    for (let index = 0; index < 100; index++) {
        const y = Math.random() * 2 - 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.cbrt(Math.random()) * (parentSize - starSize);
        const ring = Math.sqrt(1 - y * y);
        stars.push(new K3Scene({
            name: namePrefix + " " + (index + 1),
            info: "An enterable star scene. Its interior is empty for now.",
            size: starSize,
            insideSize: 1000,
            position: [Math.cos(angle) * ring * radius, y * radius,
                Math.sin(angle) * ring * radius],
            makeOutside(scene) {
                return new THREE.Mesh(
                    new THREE.SphereGeometry(scene.size, 12, 8),
                    new THREE.MeshBasicMaterial({ color: 0xff3333 })
                );
            }
        }));
    }
    return stars;
}

// Derive the distant white dots directly from the child scenes, never rerandomize.
function createOutsideStars(scene) {
    const positions = new Float32Array(scene.children.length * 3);
    const scale = scene.size / scene.insideSize;
    scene.children.forEach((star, index) => {
        positions[index * 3] = star.position.x * scale;
        positions[index * 3 + 1] = star.position.y * scale;
        positions[index * 3 + 2] = star.position.z * scale;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3,
        sizeAttenuation: false
    }));
}
