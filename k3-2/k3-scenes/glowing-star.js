// Match the yellow outside sphere across the parent/interior unit boundary.
const STAR_VISUAL_RADIUS_RATIO = 0.25;

function createGlowingStarInterior(scene) {
    const root = new THREE.Group();
    const swarmRadius = scene.insideSize * STAR_VISUAL_RADIUS_RATIO;
    // Dimensions and radial color falloff from fake_glowing_star_threejs.html.
    const scale = swarmRadius / 9.6;
    root.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.5 * scale, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    ));

    const count = 100000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const axisA = new Float32Array(count * 3);
    const axisB = new Float32Array(count * 3);
    const orbits = new Float32Array(count * 2);
    const normal = new THREE.Vector3();
    const helper = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
        const t = (Math.random() + Math.random()) / 2;
        const radius = 1.08 + t * (9.6 - 1.08);
        const z = Math.random() * 2 - 1;
        const azimuth = Math.random() * Math.PI * 2;
        const ring = Math.sqrt(1 - z * z);
        normal.set(ring * Math.cos(azimuth), ring * Math.sin(azimuth), z);
        helper.set(Math.abs(normal.y) < 0.9 ? 0 : 1,
            Math.abs(normal.y) < 0.9 ? 1 : 0, 0);
        a.crossVectors(normal, helper).normalize().multiplyScalar(radius * scale);
        b.crossVectors(normal, a).normalize().multiplyScalar(radius * scale);
        const angle = Math.random() * Math.PI * 2;
        orbits[i * 2] = angle;
        orbits[i * 2 + 1] = Math.sqrt(14 / (radius * radius * radius)) *
            (Math.random() < 0.5 ? -1 : 1);

        const brightness = THREE.MathUtils.lerp(1, 0.045, 1 - Math.pow(1 - t, 3.5));
        const hotCore = Math.pow(1 - t, 3);
        colors[i * 3] = brightness;
        colors[i * 3 + 1] = brightness * (0.02 + 0.75 * hotCore);
        colors[i * 3 + 2] = brightness * (0.005 + 0.55 * hotCore);
        for (let j = 0; j < 3; j++) {
            axisA[i * 3 + j] = a.getComponent(j);
            axisB[i * 3 + j] = b.getComponent(j);
            positions[i * 3 + j] = a.getComponent(j) * Math.cos(angle) +
                b.getComponent(j) * Math.sin(angle);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("orbitAxisA", new THREE.BufferAttribute(axisA, 3));
    geometry.setAttribute("orbitAxisB", new THREE.BufferAttribute(axisB, 3));
    geometry.setAttribute("orbit", new THREE.BufferAttribute(orbits, 2));
    // Shader motion stays within this sphere, independently of initial positions.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), swarmRadius);
    const material = new THREE.PointsMaterial({
        size: 0.095 * scale,
        sizeAttenuation: true,
        vertexColors: true,
        depthWrite: true
    });
    const time = { value: 0 };
    material.onBeforeCompile = shader => {
        shader.uniforms.orbitTime = time;
        shader.vertexShader = `
            uniform float orbitTime;
            attribute vec3 orbitAxisA;
            attribute vec3 orbitAxisB;
            attribute vec2 orbit;
        ` + shader.vertexShader.replace("#include <begin_vertex>", `
            float angle = orbit.x + orbit.y * orbitTime;
            vec3 transformed = orbitAxisA * cos(angle) + orbitAxisB * sin(angle);
        `);
    };
    const cloud = new THREE.Points(geometry, material);
    // Use the game's clock so time controls and overlapping interiors stay in sync.
    cloud.onBeforeRender = () => { time.value = scene.game.simulationTime || 0; };
    root.add(cloud);
    return root;
}
