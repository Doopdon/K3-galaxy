// Each star is a real scene, with a small red outside representation.
function createStarScenes(parentSize, starCount, namePrefix) {
    const stars = [];
    const starSize = 8;

    for (let index = 0; index < starCount; index++) {

        const y = Math.random() * 2 - 1;
        const angle = Math.random() * Math.PI * 2;

        // Uniformly distribute stars throughout the sphere volume
        const radius =
            Math.cbrt(Math.random()) *
            (parentSize - starSize);

        const ring = Math.sqrt(1 - y * y);

        stars.push(new K3Scene({
            name: namePrefix + " " + (index + 1),
            info: "An enterable star scene. Its interior is empty for now.",

            size: starSize,
            insideSize: 1000,

            position: [
                Math.cos(angle) * ring * radius,
                y * radius,
                Math.sin(angle) * ring * radius
            ],

            makeOutside(scene) {
                const geometry = new THREE.BufferGeometry();

                geometry.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute([0, 0, 0], 3)
                );

                return new THREE.Points(
                    geometry,
                    new THREE.PointsMaterial({
                        color: 0xff3333,
                        size: 5,
                        sizeAttenuation: false
                    })
                );
            }
        }));
    }

    return stars;
}

// Derive the distant white dots directly from the child scenes.
// Also draw red lines between nearby stars.
function createOutsideStars(scene, excludedChild = null) {

    const group = new THREE.Group();

    const stars = scene.children.filter(
        star => star !== excludedChild
    );

    const starCount = stars.length;
    const scale = scene.size / scene.insideSize;

    // ========================================================
    // STAR POSITIONS
    // ========================================================

    const positions = new Float32Array(starCount * 3);

    const scaledPositions = [];

    stars.forEach((star, index) => {

        const x = star.position.x * scale;
        const y = star.position.y * scale;
        const z = star.position.z * scale;

        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;

        scaledPositions.push(new THREE.Vector3(x, y, z));
    });


    // ========================================================
    // WHITE STAR DOTS
    // ========================================================

    const starGeometry = new THREE.BufferGeometry();

    starGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    const starPoints = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 3,
            sizeAttenuation: false
        })
    );

    group.add(starPoints);


    // ========================================================
    // RED CONNECTION LINES
    // ========================================================

    const connectionsPerStar = 2;

    const linePositions = [];

    for (let i = 0; i < starCount; i++) {

        const distances = [];

        // Find distance to every other star
        for (let j = 0; j < starCount; j++) {

            if (i === j) continue;

            distances.push({
                index: j,
                distance:
                    scaledPositions[i].distanceTo(
                        scaledPositions[j]
                    )
            });
        }

        // Closest stars first
        distances.sort((a, b) => a.distance - b.distance);


        // Connect to nearest neighbors
        for (
            let n = 0;
            n < Math.min(connectionsPerStar, distances.length);
            n++
        ) {

            const j = distances[n].index;

            // Avoid drawing the same connection twice
            if (j <= i) continue;

            const a = scaledPositions[i];
            const b = scaledPositions[j];

            linePositions.push(
                a.x, a.y, a.z,
                b.x, b.y, b.z
            );
        }
    }


    const lineGeometry = new THREE.BufferGeometry();

    lineGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePositions, 3)
    );

    const lines = new THREE.LineSegments(
        lineGeometry,
        new THREE.LineBasicMaterial({
            color: 0xff0000
        })
    );

    group.add(lines);


    return group;
}

function createInsideStars(scene, excludedChild = null) {

    const stars = scene.children.filter(
        star => star !== excludedChild
    );

    if (stars.length === 0) {
        return new THREE.Group();
    }

    // One geometry shared by every star
    const geometry = new THREE.SphereGeometry(8, 8, 6);

    // Blue so we can clearly distinguish INSIDE from OUTSIDE
    const material = new THREE.MeshBasicMaterial({
        color: 0x3388ff,
        wireframe: true
    });

    // All stars rendered in ONE InstancedMesh
    const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        stars.length
    );

    const matrix = new THREE.Matrix4();

    stars.forEach((star, index) => {

        matrix.makeTranslation(
            star.position.x,
            star.position.y,
            star.position.z
        );

        mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;

    return mesh;
}
