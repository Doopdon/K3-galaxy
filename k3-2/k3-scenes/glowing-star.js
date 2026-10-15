// Match the yellow outside sphere across the parent/interior unit boundary.
const STAR_VISUAL_RADIUS_RATIO = 0.25;

function createGlowingStarInterior(scene) {
    const root = new THREE.Group();
    const swarmRadius = scene.insideSize * STAR_VISUAL_RADIUS_RATIO;
    // Dimensions and radial color falloff from fake_glowing_star_threejs.html.
    const scale = swarmRadius / 9.6;
    root.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.1 * scale, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    ));

    const count = 100000;
    const data = scene.swarmData || {
        positions: new Float32Array(count * 3), colors: new Float32Array(count * 3),
        axisA: new Float32Array(count * 3), axisB: new Float32Array(count * 3),
        orbits: new Float32Array(count * 2), visible: new Float32Array(count).fill(1)
    };
    const { positions, colors, axisA, axisB, orbits } = data;
    const normal = new THREE.Vector3();
    const helper = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    for (let i = 0; !scene.swarmData && i < count; i++) {
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

        colors.set(K3_COLORS.particleColorAt(t), i * 3);
        for (let j = 0; j < 3; j++) {
            axisA[i * 3 + j] = a.getComponent(j);
            axisB[i * 3 + j] = b.getComponent(j);
            positions[i * 3 + j] = a.getComponent(j) * Math.cos(angle) +
                b.getComponent(j) * Math.sin(angle);
        }
    }

    if (!scene.swarmData) {
        scene.swarmData = data;
        installSwarmChildren(scene, data, 0.095 * scale);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("orbitAxisA", new THREE.BufferAttribute(axisA, 3));
    geometry.setAttribute("orbitAxisB", new THREE.BufferAttribute(axisB, 3));
    geometry.setAttribute("orbit", new THREE.BufferAttribute(orbits, 2));
    const visibility = new THREE.BufferAttribute(data.visible, 1);
    visibility.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("particleVisible", visibility);
    data.visibilityAttributes.add(visibility);
    if (geometry.addEventListener) {
        geometry.addEventListener("dispose", () => data.visibilityAttributes.delete(visibility));
    }
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
            attribute float particleVisible;
            varying float swarmVisible;
        ` + shader.vertexShader.replace("#include <begin_vertex>", `
            float angle = orbit.x + orbit.y * orbitTime;
            swarmVisible = particleVisible;
            vec3 transformed = orbitAxisA * cos(angle) + orbitAxisB * sin(angle);
        `).replace("gl_PointSize = size;", `
            // PointsMaterial scales positions but not point sizes. Interiors
            // use uniform scale, including when revealed beside a corridor.
            gl_PointSize = size * length(modelMatrix[0].xyz);
        `);
        if (shader.fragmentShader) {
            shader.fragmentShader = "varying float swarmVisible;\n" +
                shader.fragmentShader.replace("#include <clipping_planes_fragment>",
                    `#include <clipping_planes_fragment>
                    if (swarmVisible < 0.5) discard;
                    vec2 pointOffset = gl_PointCoord - vec2(0.5);
                    if (dot(pointOffset, pointOffset) > 0.25) discard;`);
        }
    };
    const cloud = new THREE.Points(geometry, material);
    // Use the game's clock so time controls and overlapping interiors stay in sync.
    cloud.onBeforeRender = () => { time.value = scene.game.simulationTime || 0; };
    root.add(cloud);
    return root;
}
