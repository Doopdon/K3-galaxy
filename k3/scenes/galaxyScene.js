class StarCollider {

    constructor(position, frame, index) {

        this.position = position.clone();

        this.frame = frame;

        this.visible = true;

        this.userData = {
            starIndex: index
        };
    }


    getWorldPosition(target) {

        this.frame.updateWorldMatrix(
            true,
            false
        );

        return target
            .copy(this.position)
            .applyMatrix4(
                this.frame.matrixWorld
            );
    }


    getWorldQuaternion(target) {

        return this.frame
            .getWorldQuaternion(target);
    }
}

function randomGaussian() {
    let u = 0;
    let v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function makeStarTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext("2d");

    const gradient = context.createRadialGradient(
        32, 32, 0,
        32, 32, 32
    );

    gradient.addColorStop(0.00, "rgba(255,255,255,1)");
    gradient.addColorStop(0.10, "rgba(255,255,255,0.96)");
    gradient.addColorStop(0.32, "rgba(255,255,255,0.38)");
    gradient.addColorStop(1.00, "rgba(255,255,255,0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

function buildGalaxyConnectionNetwork(
    sourcePositions,
    group,
    neighborCount = 6
) {

    const count =
        sourcePositions.length / 3;


    const workerSource = String.raw`

        self.onmessage = (event) => {

            const {
                positionsBuffer,
                count,
                neighborCount
            } = event.data;


            const positions =
                new Float32Array(
                    positionsBuffer
                );


            const indices =
                new Int32Array(count);


            for (let i = 0; i < count; i++) {
                indices[i] = i;
            }



            // ========================================
            // KD TREE
            // ========================================

            const coordinate =
                (pointIndex, axis) =>
                    positions[
                        pointIndex * 3 + axis
                    ];


            function swap(a, b) {

                const temp =
                    indices[a];

                indices[a] =
                    indices[b];

                indices[b] =
                    temp;
            }


            function partition(
                left,
                right,
                pivotIndex,
                axis
            ) {

                const pivotValue =
                    coordinate(
                        indices[pivotIndex],
                        axis
                    );


                swap(
                    pivotIndex,
                    right
                );


                let storeIndex =
                    left;


                for (
                    let i = left;
                    i < right;
                    i++
                ) {

                    if (
                        coordinate(
                            indices[i],
                            axis
                        ) <
                        pivotValue
                    ) {

                        swap(
                            storeIndex,
                            i
                        );

                        storeIndex++;
                    }
                }


                swap(
                    right,
                    storeIndex
                );


                return storeIndex;
            }


            function quickSelect(
                left,
                right,
                target,
                axis
            ) {

                while (
                    left < right
                ) {

                    let pivotIndex =
                        (left + right) >> 1;


                    pivotIndex =
                        partition(
                            left,
                            right,
                            pivotIndex,
                            axis
                        );


                    if (
                        target ===
                        pivotIndex
                    ) {
                        return;
                    }


                    if (
                        target <
                        pivotIndex
                    ) {

                        right =
                            pivotIndex - 1;

                    } else {

                        left =
                            pivotIndex + 1;
                    }
                }
            }


            function buildTree(
                left,
                right,
                depth
            ) {

                if (
                    left > right
                ) return;


                const middle =
                    (left + right) >> 1;


                quickSelect(
                    left,
                    right,
                    middle,
                    depth % 3
                );


                buildTree(
                    left,
                    middle - 1,
                    depth + 1
                );


                buildTree(
                    middle + 1,
                    right,
                    depth + 1
                );
            }


            console.log(
                "Worker: building KD tree"
            );


            buildTree(
                0,
                count - 1,
                0
            );



            // ========================================
            // NEAREST NEIGHBOR SEARCH
            // ========================================

            const nearestIndices =
                new Int32Array(
                    neighborCount
                );


            const nearestDistances =
                new Float64Array(
                    neighborCount
                );


            let nearestSize = 0;
            let worstSlot = 0;
            let worstDistance =
                Infinity;


            let targetIndex = 0;
            let targetX = 0;
            let targetY = 0;
            let targetZ = 0;


            function refreshWorst() {

                if (
                    nearestSize <
                    neighborCount
                ) {

                    worstDistance =
                        Infinity;

                    worstSlot =
                        nearestSize;

                    return;
                }


                worstSlot = 0;

                worstDistance =
                    nearestDistances[0];


                for (
                    let i = 1;
                    i < nearestSize;
                    i++
                ) {

                    if (
                        nearestDistances[i] >
                        worstDistance
                    ) {

                        worstDistance =
                            nearestDistances[i];

                        worstSlot = i;
                    }
                }
            }


            function consider(
                pointIndex
            ) {

                if (
                    pointIndex ===
                    targetIndex
                ) return;


                const offset =
                    pointIndex * 3;


                const dx =
                    positions[offset] -
                    targetX;

                const dy =
                    positions[offset + 1] -
                    targetY;

                const dz =
                    positions[offset + 2] -
                    targetZ;


                const distanceSquared =
                    dx * dx +
                    dy * dy +
                    dz * dz;


                if (
                    nearestSize <
                    neighborCount
                ) {

                    nearestIndices[
                        nearestSize
                    ] = pointIndex;

                    nearestDistances[
                        nearestSize
                    ] = distanceSquared;


                    nearestSize++;

                    refreshWorst();

                } else if (
                    distanceSquared <
                    worstDistance
                ) {

                    nearestIndices[
                        worstSlot
                    ] = pointIndex;

                    nearestDistances[
                        worstSlot
                    ] = distanceSquared;


                    refreshWorst();
                }
            }


            function searchTree(
                left,
                right,
                depth
            ) {

                if (
                    left > right
                ) return;


                const middle =
                    (left + right) >> 1;

                const pointIndex =
                    indices[middle];

                const axis =
                    depth % 3;


                const targetCoordinate =
                    axis === 0
                        ? targetX
                        : axis === 1
                            ? targetY
                            : targetZ;


                const difference =
                    targetCoordinate -
                    positions[
                        pointIndex * 3 +
                        axis
                    ];


                if (
                    difference <= 0
                ) {

                    searchTree(
                        left,
                        middle - 1,
                        depth + 1
                    );


                    consider(
                        pointIndex
                    );


                    if (
                        difference *
                        difference <
                        worstDistance
                    ) {

                        searchTree(
                            middle + 1,
                            right,
                            depth + 1
                        );
                    }

                } else {

                    searchTree(
                        middle + 1,
                        right,
                        depth + 1
                    );


                    consider(
                        pointIndex
                    );


                    if (
                        difference *
                        difference <
                        worstDistance
                    ) {

                        searchTree(
                            left,
                            middle - 1,
                            depth + 1
                        );
                    }
                }
            }



            // ========================================
            // BUILD UNIQUE CONNECTION LIST
            // ========================================

            const edgeSet =
                new Set();


            for (
                targetIndex = 0;
                targetIndex < count;
                targetIndex++
            ) {

                const offset =
                    targetIndex * 3;


                targetX =
                    positions[offset];

                targetY =
                    positions[offset + 1];

                targetZ =
                    positions[offset + 2];


                nearestSize = 0;

                worstSlot = 0;

                worstDistance =
                    Infinity;


                searchTree(
                    0,
                    count - 1,
                    0
                );


                for (
                    let i = 0;
                    i < nearestSize;
                    i++
                ) {

                    const neighbor =
                        nearestIndices[i];


                    const low =
                        Math.min(
                            targetIndex,
                            neighbor
                        );

                    const high =
                        Math.max(
                            targetIndex,
                            neighbor
                        );


                    edgeSet.add(
                        low * count +
                        high
                    );
                }
            }



            // ========================================
            // CREATE LINE BUFFERS
            // ========================================

            const edgeCount =
                edgeSet.size;


            const linePositions =
                new Float32Array(
                    edgeCount * 6
                );


            const lineColors =
                new Float32Array(
                    edgeCount * 6
                );


            let writeOffset = 0;


            for (
                const key of edgeSet
            ) {

                const first =
                    Math.floor(
                        key / count
                    );

                const second =
                    key -
                    first * count;


                const a =
                    first * 3;

                const b =
                    second * 3;


                const dx =
                    positions[a] -
                    positions[b];

                const dy =
                    positions[a + 1] -
                    positions[b + 1];

                const dz =
                    positions[a + 2] -
                    positions[b + 2];


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy +
                        dz * dz
                    );


                // Exact old-galaxy brightness logic
                const intensity =
                    Math.max(
                        0.055,
                        Math.min(
                            0.72,
                            1.1 /
                            (
                                1 +
                                distance *
                                0.075
                            )
                        )
                    );


                linePositions[
                    writeOffset
                ] =
                    positions[a];

                linePositions[
                    writeOffset + 1
                ] =
                    positions[a + 1];

                linePositions[
                    writeOffset + 2
                ] =
                    positions[a + 2];


                linePositions[
                    writeOffset + 3
                ] =
                    positions[b];

                linePositions[
                    writeOffset + 4
                ] =
                    positions[b + 1];

                linePositions[
                    writeOffset + 5
                ] =
                    positions[b + 2];


                const redBrightness =
                    intensity * 0.2;


                lineColors[
                    writeOffset
                ] =
                    redBrightness;

                lineColors[
                    writeOffset + 1
                ] =
                    redBrightness *
                    0.025;

                lineColors[
                    writeOffset + 2
                ] = 0;


                lineColors[
                    writeOffset + 3
                ] =
                    redBrightness;

                lineColors[
                    writeOffset + 4
                ] =
                    redBrightness *
                    0.025;

                lineColors[
                    writeOffset + 5
                ] = 0;


                writeOffset += 6;
            }


            self.postMessage(
                {
                    edgeCount,

                    positionsBuffer:
                        linePositions.buffer,

                    colorsBuffer:
                        lineColors.buffer
                },
                [
                    linePositions.buffer,
                    lineColors.buffer
                ]
            );
        };

    `;



    // ========================================
    // START WORKER
    // ========================================

    const blob =
        new Blob(
            [workerSource],
            {
                type:
                    "text/javascript"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const worker =
        new Worker(url);


    worker.onmessage =
        event => {

            console.log(
                "Galaxy links:",
                event.data.edgeCount
            );


            const geometry =
                new THREE.BufferGeometry();


            geometry.setAttribute(
                "position",
                new THREE.BufferAttribute(
                    new Float32Array(
                        event.data
                            .positionsBuffer
                    ),
                    3
                )
            );


            geometry.setAttribute(
                "color",
                new THREE.BufferAttribute(
                    new Float32Array(
                        event.data
                            .colorsBuffer
                    ),
                    3
                )
            );


            geometry.computeBoundingSphere();


            const material =
                new THREE.LineBasicMaterial({

                    vertexColors: true,

                    transparent: true,

                    opacity: 0.78,

                    depthWrite: false,

                    blending:
                        THREE.AdditiveBlending,

                    fog: true
                });


            const lines =
                new THREE.LineSegments(
                    geometry,
                    material
                );


            // IMPORTANT:
            // lines live in the SAME group as stars,
            // so tilt + galaxy rotation happen automatically.
            group.add(lines);


            worker.terminate();

            URL.revokeObjectURL(
                url
            );
        };


    worker.onerror =
        error => {

            console.error(
                "Galaxy connection worker failed:",
                error
            );

            worker.terminate();

            URL.revokeObjectURL(
                url
            );
        };


    // COPY IT!
    //
    // Transferring the original positions.buffer
    // would detach your actual galaxy array.
    const positionCopy =
        sourcePositions.slice();


    worker.postMessage(
        {
            positionsBuffer:
                positionCopy.buffer,

            count,

            neighborCount
        },
        [
            positionCopy.buffer
        ]
    );


    return worker;
}

const galaxySceneData = new GalaxySceneData({

    scale: 1,

    timescale: 1,

    disapearDistance: 5,

    childScenes: [
        solarSystemSceneData
    ],

    getSubSceneData: function (star) {
        return solarSystemSceneData;
    },

    populateScene: function () {

        const STAR_COUNT = 130000;
        const GALAXY_RADIUS = 650;
        const GALAXY_THICKNESS = 48;
        const ARM_COUNT = 2;

        const group = new THREE.Group();

        const positions = new Float32Array(STAR_COUNT * 3);
        const colors = new Float32Array(STAR_COUNT * 3);
        const color = new THREE.Color();

        for (let i = 0; i < STAR_COUNT; i++) {
            const i3 = i * 3;
            const component = Math.random();

            let x;
            let y;
            let z;
            let radius;
            let temperature;

            if (component < 0.72) {
                // Spiral disk
                radius = Math.pow(Math.random(), 0.52) * GALAXY_RADIUS;

                const arm = Math.floor(Math.random() * ARM_COUNT);
                const armBase = arm * (Math.PI * 2 / ARM_COUNT);
                const winding = radius * 0.018;
                const spread =
                    0.20 +
                    Math.pow(radius / GALAXY_RADIUS, 1.2) * 0.1;

                const angle =
                    armBase +
                    winding +
                    randomGaussian() * spread;

                const radialScatter =
                    randomGaussian() * (8 + radius * 0.035);

                const scatteredRadius =
                    radius + radialScatter;

                x = Math.cos(angle) * scatteredRadius;
                z = Math.sin(angle) * scatteredRadius;

                const diskHeight =
                    3.5 +
                    (1 - radius / GALAXY_RADIUS) * GALAXY_THICKNESS;

                y = randomGaussian() * diskHeight;

                // Outer arms skew slightly blue; inner stars skew warm
                temperature =
                    Math.random() +
                    (radius / GALAXY_RADIUS) * 0.45;

            } else if (component < 0.93) {
                // Dense central bulge
                radius = Math.pow(Math.random(), 2.1) * 190;

                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);

                x = Math.sin(phi) * Math.cos(theta) * radius * 1.25;
                z = Math.sin(phi) * Math.sin(theta) * radius * 1.25;
                y = Math.cos(phi) * radius * 0.48;

                x += randomGaussian() * 5;
                y += randomGaussian() * 3;
                z += randomGaussian() * 5;

                temperature = Math.random() * 0.72;

            } else {
                // Sparse halo
                radius = Math.pow(Math.random(), 0.34) * GALAXY_RADIUS * 1.18;

                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);

                x = Math.sin(phi) * Math.cos(theta) * radius;
                z = Math.sin(phi) * Math.sin(theta) * radius;
                y = Math.cos(phi) * radius * 0.42;

                temperature = Math.random() * 1.25;
            }

            const collider =
                new StarCollider(
                    new THREE.Vector3(x, y, z),
                    group,
                    i
                );

            this.addCollider(collider);

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            if (temperature < 0.26) {
                color.setRGB(
                    1.00,
                    0.55 + Math.random() * 0.18,
                    0.34
                );
            } else if (temperature < 0.70) {
                color.setRGB(
                    1.00,
                    0.80 + Math.random() * 0.16,
                    0.62 + Math.random() * 0.18
                );
            } else if (temperature < 1.08) {
                const whiteness = 0.84 + Math.random() * 0.16;
                color.setRGB(
                    whiteness,
                    whiteness,
                    1.00
                );
            } else {
                color.setRGB(
                    0.58 + Math.random() * 0.12,
                    0.72 + Math.random() * 0.12,
                    1.00
                );
            }

            const brightness =
                0.42 + Math.random() * 0.58;

            colors[i3] = color.r * brightness;
            colors[i3 + 1] = color.g * brightness;
            colors[i3 + 2] = color.b * brightness;
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(colors, 3)
        );

        geometry.computeBoundingSphere();

        const material = new THREE.PointsMaterial({
            size: 1.5,
            sizeAttenuation: true,
            map: makeStarTexture(),
            transparent: true,
            opacity: 0.9,
            alphaTest: 0.01,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,

            fog: false
        });

        const stars = new THREE.Points(geometry, material);

        group.add(stars);

        // Match the tilt from the good version
        group.rotation.x = THREE.MathUtils.degToRad(-8);
        group.rotation.z = THREE.MathUtils.degToRad(5);

        this.rootGroup.add(group);
        this.orbitGroup = group;

        this.connectionWorker =
            buildGalaxyConnectionNetwork(
                positions,
                group,
                6
            );

        // Save if you want colliders later
        this.starPositions = positions;
        this.starColors = colors;
        this.starPoints = stars;
    },

    animate: function (deltaTime) {
        if (!this.orbitGroup) return;

        // Slow it way down
        this.orbitGroup.rotation.y += 0.0006 * deltaTime;
    },
});

galaxySceneData.onColide = function () {
    window.galaxySkyBox = captureSkybox(window.renderer, this.scene, this.camera.position)
}

galaxySceneData.scene.background =
    new THREE.Color(0x000003);

galaxySceneData.scene.fog =
    new THREE.FogExp2(
        0x000003,
        0.00024
    );