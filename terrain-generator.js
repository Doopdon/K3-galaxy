// Shared terrain implementation extracted from terrain_generator.html.
const TerrainGenerator = {
  randomSettings(random = Math.random) {
    const integer = (min,max) => Math.floor(min + random() * (max-min+1));
    const mode = random();
    return { seed: integer(0,2147483646), sea: 0.3 + random() * 0.4,
      temperature: integer(0,100), islandiness: integer(0,100),
      // One-fifth of the old scale range: lower frequency = larger land masses.
      scale: integer(6,44), octaves: integer(1,8),
      seamless: true, mode: mode < 0.12 ? "salt" : mode < 0.24 ? "dead" : "normal",
      rivers: random() < 0.8, riverDensity: integer(1,100), civilization: integer(0,100) };
  },
  render(canvas, settings = {}) {
    const ctx = canvas.getContext("2d");
    const renderWidth = canvas.width, renderHeight = canvas.height;
    const seed = settings.seed ?? 12345, sea = settings.sea ?? 0.5;
    const scale = settings.scale ?? 90, octaves = settings.octaves ?? 5;
    const temp01 = (settings.temperature ?? 50) / 100;
    const islandiness = (settings.islandiness ?? 50) / 100;
    const seamless = settings.seamless ?? true, ringMode = settings.mode ?? "normal";
    const riversInput = { checked: settings.rivers ?? true };
    const riverCountInput = { value: settings.riverDensity ?? 25 };
    const civilizationInput = { value: settings.civilization ?? 0 };
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash2D(x, y, seed) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
    h = (h ^ (h >>> 13));
    h = Math.imul(h, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function fade(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function mixColor(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }

  function valueNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = fade(x - x0);
    const sy = fade(y - y0);

    const n00 = hash2D(x0, y0, seed);
    const n10 = hash2D(x1, y0, seed);
    const n01 = hash2D(x0, y1, seed);
    const n11 = hash2D(x1, y1, seed);

    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sy);
  }

  function fbm(x, y, seed, octaves) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let totalAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += valueNoise(x * frequency, y * frequency, seed + i * 1013) * amplitude;
      totalAmplitude += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value / totalAmplitude;
  }

  // 3-D value noise. Going around a circle in (x,z) creates a periodic
  // horizontal coordinate; y remains the physical width of the ring.
  function hash3D(x, y, z, seed) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^
            Math.imul(z, 2246822519) ^ Math.imul(seed, 1442695041);
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function valueNoise3D(x, y, z, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const tx = fade(x - ix), ty = fade(y - iy), tz = fade(z - iz);
    const c00 = lerp(hash3D(ix,iy,iz,seed), hash3D(ix+1,iy,iz,seed), tx);
    const c10 = lerp(hash3D(ix,iy+1,iz,seed), hash3D(ix+1,iy+1,iz,seed), tx);
    const c01 = lerp(hash3D(ix,iy,iz+1,seed), hash3D(ix+1,iy,iz+1,seed), tx);
    const c11 = lerp(hash3D(ix,iy+1,iz+1,seed), hash3D(ix+1,iy+1,iz+1,seed), tx);
    return lerp(lerp(c00,c10,ty),lerp(c01,c11,ty),tz);
  }

  function periodicFBM(x, y, seed, octaves, circumference) {
    const angle = x / circumference * Math.PI * 2;
    const radius = circumference / (Math.PI * 2);
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    let value = 0, weight = 0, amplitude = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      value += valueNoise3D(cx * freq, y * freq, cz * freq, seed + i * 1013) * amplitude;
      weight += amplitude;
      amplitude *= 0.5;
      freq *= 2;
    }
    return value / weight;
  }

  function getWaterColor(h, sea) {
    const depth = clamp(h / sea, 0, 1);
    if (depth < 0.45) return [10, 37, 76];
    if (depth < 0.75) return [16, 67, 113];
    return [26, 101, 144];
  }

  function getLandColor(h, sea, temp01, dryness, ringMode) {
    const land = clamp((h - sea) / (1 - sea), 0, 1);

    // Temperature behavior:
    // temp01 = 0 => cold, lots of snow, no desert
    // temp01 = 0.5 => mix of snow, green, desert
    // temp01 = 1 => hot, no snow, lots of desert

    // Snow line rises with temperature. At cold settings snow reaches low areas.
    const snowStart = lerp(0.18, 1.02, temp01);
    const snowBlend = smoothstep(snowStart - 0.08, snowStart + 0.08, land);

    // Desert begins absent on cold side, then appears in small patches and grows.
    const desertStrength = smoothstep(0.22, 1.0, temp01);
    const desertThreshold = lerp(0.92, 0.28, temp01); // lower threshold = more desert coverage
    const desertPatch = smoothstep(desertThreshold - 0.10, desertThreshold + 0.10, dryness) * desertStrength;

    // Let low elevations desertify more easily than high mountains.
    const elevationDesertPenalty = smoothstep(0.65, 1.0, land);
    const desertAmount = desertPatch * (1 - elevationDesertPenalty * 0.75);

    // Reduce green as the world gets hotter and as local dryness increases.
    const warmth = temp01;
    const greenSuppression = clamp(0.25 * warmth + 0.65 * desertAmount, 0, 1);

    const beach = [194, 184, 126];
    const lushLow = [72, 130, 70];
    const greenUpland = [89, 117, 63];
    const brownHill = [120, 101, 70];
    const grayMountain = [122, 122, 118];

    const desertSand = [214, 188, 110];
    const desertRock = [168, 133, 83];

    const snow = [240, 243, 246];

    // Base terrain by height.
    let base;
    if (land < 0.06) {
      base = beach;
    } else if (land < 0.30) {
      base = lushLow;
    } else if (land < 0.55) {
      base = greenUpland;
    } else if (land < 0.80) {
      base = brownHill;
    } else {
      base = grayMountain;
    }

    // Shift greens toward hotter/yellower tones before full desert takes over.
    const warmLow = [138, 137, 72];
    const warmUpland = [130, 121, 74];
    const warmedBase =
      land < 0.30 ? mixColor(base, warmLow, greenSuppression) :
      land < 0.55 ? mixColor(base, warmUpland, greenSuppression) :
      base;

    // Desert replacement palette depends on elevation.
    const desertBase = land < 0.45 ? desertSand : desertRock;
    let color = mixColor(warmedBase, desertBase, desertAmount);

    if (ringMode === "salt") {
      // Salt has no green or snow: all exposed land is desert.
      // Desert sand on the lowlands, desert rock up high.
      return mixColor(desertSand, desertRock, smoothstep(0.38, 0.78, land));
    }

    if (ringMode === "dead") {
      // Replace vegetated terrain with dark, lifeless rock. Keep existing
      // desert patches their original sand/rock colors and snow intact.
      const deadRock = [49, 51, 53];
      if (land >= 0.06 && land < 0.55) {
        color = mixColor(deadRock, desertBase, desertAmount);
      }
    }

    // Snow always overrides based on snow amount, but at hot end there is none because snowStart > 1.
    color = mixColor(color, snow, snowBlend);

    return color;
  }

  function drawRivers(heights, sea, seed, density, seamless, mode) {
    const w = renderWidth, h = renderHeight;
    const used = new Uint8Array(w * h);
    const rng = mulberry32((seed ^ 0x6f23a11d) >>> 0);
    const neighbors = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const count = Math.floor(15 + density * 1.8);
    const candidates = [];
    // Stratified sampling spreads potential headwaters across the whole ring.
    const cells = Math.max(8, Math.floor(Math.sqrt(count * 11)));
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const x = Math.floor((gx + rng()) / cells * w);
        const y = Math.floor((gy + rng()) / cells * h);
        const z = heights[y*w+x];
        if (z > sea + 0.025) candidates.push({x,y,z,rank:z + rng()*0.025});
      }
    }
    candidates.sort((a,b) => b.rank - a.rank);
    let drawn = 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = mode === 'normal' ? '#267db0' : mode === 'dead' ? '#9ba9ae' : '#c8ddd9';
    ctx.lineWidth = 1.15;
    for (const start of candidates) {
      if (drawn >= count) break;
      if (used[start.y*w + start.x]) continue;
      const path = [[start.x,start.y]];
      const visited = new Set();
      let x = start.x, y = start.y, reachesWater = false, joinsRiver = false;
      for (let step = 0; step < w+h; step++) {
        const idx = y*w+x;
        if (visited.has(idx)) break;
        visited.add(idx);
        if (heights[idx] <= sea) { reachesWater = true; break; }
        if (used[idx] && step > 0) { joinsRiver = true; break; }
        let best = null, bestSlope = 0;
        for (const [dx,dy] of neighbors) {
          const yy = y+dy;
          if (yy < 0 || yy >= h) continue;
          let xx = x+dx;
          if (seamless) xx = (xx + w) % w;
          else if (xx < 0 || xx >= w) continue;
          const next = yy*w+xx;
          const slope = (heights[idx]-heights[next]) / (dx && dy ? 1.414 : 1);
          if (slope > bestSlope) { bestSlope = slope; best = [xx, yy]; }
        }
        if (!best) break;
        x = best[0]; y = best[1];
        path.push([x,y]);
      }
      // Discard short streams or paths stranded in local depressions.
      if ((!reachesWater && !joinsRiver) || path.length < 10) continue;
      for (const [px,py] of path) used[py*w+px] = 1;
      ctx.beginPath();
      ctx.moveTo(path[0][0]+0.5,path[0][1]+0.5);
      for (let i=1; i<path.length; i++) {
        // Don't draw a stroke across the whole screen at the wrap.
        if (Math.abs(path[i][0]-path[i-1][0]) > 2) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(path[i][0]+0.5,path[i][1]+0.5);
        } else ctx.lineTo(path[i][0]+0.5,path[i][1]+0.5);
      }
      ctx.stroke();
      drawn++;
    }
    ctx.restore();
    return used;
  }


  // Generate stable settlement nuclei near shores and traced rivers, then grow
  // them outward through a distance field. Different civilization settings
  // expand the SAME centers rather than rerolling the settlement geography.
  function drawCivilization(heights, sea, seed, amount, seamless, riverPixels) {
    if (amount <= 0) return;
    const w = renderWidth, h = renderHeight, n = w * h;
    const centers = [];
    const stride = 7;
    // Pick reproducible candidate towns near the water network.
    for (let y = 2; y < h - 2; y += stride) {
      for (let x = 0; x < w; x += stride) {
        const idx = y * w + x;
        if (heights[idx] <= sea) continue;
        let closeToWater = !!(riverPixels && riverPixels[idx]);
        // A small radius permits settlements a few pixels inland.
        for (let dy = -3; dy <= 3 && !closeToWater; dy += 3) {
          for (let dx = -3; dx <= 3; dx += 3) {
            let xx = x + dx;
            if (seamless) xx = (xx + w) % w;
            else if (xx < 0 || xx >= w) continue;
            const ii = (y + dy) * w + xx;
            if (heights[ii] <= sea || (riverPixels && riverPixels[ii])) {
              closeToWater = true; break;
            }
          }
        }
        if (!closeToWater) continue;
        // Sparse founding towns, naturally increasing in number with slider.
        const roll = hash2D(Math.floor(x / stride), Math.floor(y / stride), seed ^ 0x51d3c710);
        if (roll < 0.035) centers.push(idx);
      }
    }
    // Avoid blank maps when terrain contains little water or rivers.
    if (!centers.length) {
      for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 200))) {
        if (heights[i] > sea) { centers.push(i); break; }
      }
    }
    if (!centers.length) return;

    // Multi-source Manhattan distance map, wrapping around ring circumference.
    const distances = new Uint16Array(n);
    distances.fill(65535);
    const queue = new Int32Array(n);
    let head = 0, tail = 0;
    for (const idx of centers) { distances[idx] = 0; queue[tail++] = idx; }
    while (head < tail) {
      const idx = queue[head++], x = idx % w, y = Math.floor(idx / w);
      const d = distances[idx] + 1;
      if (d > 180) continue;
      const nx0 = x === 0 ? (seamless ? w-1 : -1) : x-1;
      const nx1 = x === w-1 ? (seamless ? 0 : -1) : x+1;
      const options = [nx0 < 0 ? -1 : y*w+nx0, nx1 < 0 ? -1 : y*w+nx1,
                       y > 0 ? idx-w : -1, y < h-1 ? idx+w : -1];
      for (const next of options) {
        if (next < 0 || distances[next] <= d || heights[next] <= sea) continue;
        distances[next] = d;
        queue[tail++] = next;
      }
    }

    // Blend a low-frequency expansion field into the urban boundary so that
    // cities have irregular edges rather than perfectly round outlines.
    const image = ctx.getImageData(0, 0, w, h);
    const data = image.data;
    const t = amount / 100;
    const baseRadius = 1.5 + 160 * Math.pow(t, 1.75);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y*w + x;
        if (heights[idx] <= sea) continue;
        const d = distances[idx];
        // Multi-scale stable variation creates lobes and patchy suburbs.
        const p = seamless
          ? periodicFBM(x / 28, y / 28, seed ^ 0x173b5db1, 3, w / 28)
          : fbm(x / 28, y / 28, seed ^ 0x173b5db1, 3);
        const radius = baseRadius * (0.6 + p * 0.95);
        const developed = t >= 0.999 ? 1 : smoothstep(radius + 2, radius - 3, d);
        if (developed <= 0) continue;

        // Every seed assigns each district its own street geometry. Mix rotated
        // grids, rings/plazas, broad avenues, overlapping squares and diagonals.
        // Sample neighboring districts too, so shapes extend across boundaries.
        const districtSize = 76;
        const districtX = Math.floor(x / districtSize);
        const districtY = Math.floor(y / districtSize);
        let street = false, highway = false, plaza = false, building = false;
        let material = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const dx = districtX + ox, dy = districtY + oy;
            const pick = (salt) => hash2D(dx, dy, seed ^ salt);
            const cx = (dx + 0.25 + pick(0x44f)*0.5)*districtSize;
            const cy = (dy + 0.25 + pick(0x118)*0.5)*districtSize;
            let rx = x - cx, ry = y - cy;
            if (seamless) rx = ((rx + w/2) % w + w) % w - w/2;
            if (Math.abs(rx)>115 || Math.abs(ry)>115) continue;
            const angle = pick(0x351)*Math.PI;
            const ca = Math.cos(angle), sa = Math.sin(angle);
            const u = rx*ca + ry*sa, v = -rx*sa + ry*ca;
            const type = Math.floor(pick(0x911)*4);
            const spacing = 7 + Math.floor(pick(0xa91)*8);
            const originU = pick(0x712)*spacing, originV = pick(0x987)*spacing;
            const mod = (n,m) => ((n%m)+m)%m;
            const du = Math.min(mod(u+originU,spacing), spacing-mod(u+originU,spacing));
            const dv = Math.min(mod(v+originV,spacing), spacing-mod(v+originV,spacing));
            const radius = Math.hypot(u,v);
            const theta = Math.atan2(v,u);
            const core = Math.max(Math.abs(u),Math.abs(v)) < 38 + pick(0x812)*24;
            if (core) {
              if (type === 0) { // skewed lattice with offset circular plazas
                street ||= du < 0.9 || dv < 0.9;
                plaza ||= radius < 9 + pick(0x119)*8;
              } else if (type === 1) { // concentric streets with spokes
                street ||= mod(radius,spacing*1.75) < 1.25 ||
                          Math.abs(Math.sin(theta*(5+Math.floor(pick(0x171)*5))))*radius < 1.2;
                plaza ||= radius < 8;
              } else if (type === 2) { // intersecting squares and rectangular wards
                const r = Math.max(Math.abs(u),Math.abs(v));
                street ||= mod(r,spacing*1.65)<1.2 || du < 1.0 || dv < 1.0;
                building ||= Math.abs(u)<15 && Math.abs(v)<22;
              } else { // long diagonal arterials and loosely spaced cells
                street ||= du < 1.1 || dv < 1.1 || mod(u+v,spacing*3)<1.4;
                plaza ||= radius < 7;
              }
              highway ||= Math.abs(v) < 1.2 && Math.abs(u) < 70;
              material = Math.max(material, hash2D(Math.floor(u/spacing),Math.floor(v/spacing),seed ^ (dx*29+dy*113)));
            }
          }
        }
        // Secondary building details are seed-based rather than screen-aligned.
        const detail = hash2D(Math.floor(x/3), Math.floor(y/3), seed ^ 0x4a5379c9);
        let urban;
        if (plaza) urban = [186, 166, 124];
        else if (highway) urban = [51, 56, 62];
        else if (street) urban = [78, 82, 86];
        else if (building) urban = [117, 119, 116];
        else if (material > 0.70 || detail > 0.83) urban = [181, 179, 166];
        else if (material > 0.43) urban = [145, 151, 148];
        else urban = [105, 113, 114];
        const offset = idx * 4;
        const alpha = developed * (t >= 0.999 ? 1 : 0.88);
        for (let c = 0; c < 3; c++) data[offset+c] = Math.round(lerp(data[offset+c], urban[c], alpha));
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function render() {
    const image = ctx.createImageData(renderWidth, renderHeight);
    const data = image.data;
    const heights = new Float32Array(renderWidth * renderHeight);

    const aspect = renderWidth / renderHeight;
    const baseScale = scale / 100;
    const circumference = aspect * baseScale * 6;
    // All layers (including climate) must wrap, not only elevation.
    const noise = (x, y, seedValue, count, horizontalMultiplier = 1) =>
      seamless ? periodicFBM(x, y, seedValue, count, circumference * horizontalMultiplier)
               : fbm(x, y, seedValue, count);

    let i = 0;
    for (let y = 0; y < renderHeight; y++) {
      for (let x = 0; x < renderWidth; x++) {
        const nx = (x / renderWidth) * aspect * baseScale * 6;
        const ny = (y / renderHeight) * baseScale * 6;

        const a = noise(nx, ny, seed, octaves);
        const b = noise(nx * 0.55 + 17.2, ny * 0.55 - 8.4, seed ^ 0x9e3779b9, Math.max(2, octaves - 1), 0.55);
        // Islandiness controls the *spatial scale* of coastlines, not merely sea level.
        // The middle reproduces the original terrain's landmass layout.
        const originalHeight = a * 0.72 + b * 0.28;
        let h = originalHeight;
        if (islandiness < 0.5) {
          // Large, connected continental landmasses.
          const macro = noise(nx * 0.25 + 5.3, ny * 0.25 - 2.7,
                            seed ^ 0x27d4eb2d, Math.max(3, octaves), 0.25);
          const continent = macro * 0.72 + a * 0.28;
          h = lerp(continent, originalHeight, islandiness * 2);
        } else if (islandiness > 0.5) {
          // A faster varying field creates many smaller islands and channels.
          const micro = noise(nx * 2.9 + 5.3, ny * 2.9 - 2.7,
                            seed ^ 0x165667b1, Math.max(3, octaves), 2.9);
          const archipelago = micro * 0.70 + a * 0.30;
          h = lerp(originalHeight, archipelago, (islandiness - 0.5) * 2);
        }
        h = Math.pow(h, 1.08);
        heights[y * renderWidth + x] = h;

        let color;
        if (h < sea) {
          color = ringMode === "normal" ? getWaterColor(h, sea) : [245, 246, 242];
        } else {
          // Separate dryness field for desert patch placement.
          const dryness = noise(nx * 1.6 + 31.7, ny * 1.6 - 12.9, seed ^ 0x85ebca6b, 4, 1.6);
          color = getLandColor(h, sea, temp01, dryness, ringMode);
        }

        data[i++] = color[0];
        data[i++] = color[1];
        data[i++] = color[2];
        data[i++] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    const riverPixels = riversInput.checked
      ? drawRivers(heights, sea, seed, Number(riverCountInput.value), seamless, ringMode)
      : null;
    drawCivilization(heights, sea, seed, Number(civilizationInput.value), seamless, riverPixels);
    return { canvas, heights };
  }

  return render();
  }
};
