// src/space/mars-surface.ts
// A procedurally generated patch of Martian ground: rolling terrain with layered
// bedrock, craters, scattered rocks, drifting dust and a butterscotch sky.
// Every build uses a fresh seed, so no two visits get the same landscape.
import * as THREE from "three";
import { byTier, type DeviceTier } from "./device";
import { createBeaconMaterial } from "./beacon";

export type MarsSurface = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /**
   * k: 0 = high above the ground looking straight down (where the planet dive hands over),
   *    1 = standing on the surface looking at the horizon.
   * haze: 0..1 full-screen dust overlay used to hide the hand-over.
   * rig: the space camera rig, so mouse/gyro parallax carries over.
   */
  update: (t: number, k: number, haze: number, rig?: THREE.Object3D | null) => void;
  setAspect: (aspect: number) => void;
  /** Ground height at (x, z). */
  heightAt: (x: number, z: number) => number;
  dispose: () => void;
};


/** Dust colour shared by both sides of the hand-over, so the cut happens inside a solid colour. */
export const HAZE_COLOR = 0xb86d40;

const SKY_HORIZON = 0xcfa27a;
const SKY_ZENITH = 0x9a7760;
const SAND = 0xb5693a;
const DUST = 0xc98552;
const BEDROCK = 0x8f5332;
const DARK = 0x6e3f28;
const ROCK_COLORS = [0x5e3a28, 0x6b4330, 0x4a3024, 0x7a4f36, 0x553629];

const EYE = 1.7;
/** The beacon seen on the planet from space, ahead of the landing spot. The project hologram rises from it. */
export const BEACON = { x: 0, z: -8, size: 4.4 };
const HALF = 340; // terrain half-size
const WARP = 1.7; // grid spacing grows with distance: dense under the camera, sparse on the hills

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, z: number, s: number) {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ s) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 2D value noise in [-1, 1]; `period` > 0 makes it tile. */
function noise2(x: number, y: number, s: number, period = 0) {
  let x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  let x1 = x0 + 1, y1 = y0 + 1;
  if (period) {
    x0 = ((x0 % period) + period) % period;
    y0 = ((y0 % period) + period) % period;
    x1 = (x0 + 1) % period;
    y1 = (y0 + 1) % period;
  }
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, 0, s), b = hash(x1, y0, 0, s);
  const c = hash(x0, y1, 0, s), d = hash(x1, y1, 0, s);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

function fbm2(x: number, y: number, octaves: number, s: number, period = 0) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x, y, s + o * 101, period) * amp;
    norm += amp;
    x *= 2; y *= 2; amp *= 0.5;
    if (period) period *= 2;
  }
  return sum / norm;
}

function noise3(x: number, y: number, z: number, s: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(x0 + dx, y0 + dy, z0 + dz, s);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), ux), l(c(0, 1, 0), c(1, 1, 0), ux), uy),
    l(l(c(0, 0, 1), c(1, 0, 1), ux), l(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz,
  ) * 2 - 1;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const nextTask = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Tileable grain used as colour variation and bump on both ground and rocks. */
function makeDetailTexture(seed: number) {
  const size = 256, period = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period, v = (y / size) * period;
      let n = 0.5 + 0.5 * fbm2(u, v, 5, seed, period);
      // Pebble speckle: a few dark and light grains
      const h = hash(x, y, 7, seed);
      if (h < 0.03) n -= 0.25;
      else if (h > 0.985) n += 0.15;
      const c = Math.round(Math.min(1, Math.max(0, 0.72 + 0.34 * (n - 0.5) * 2)) * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** A chipped, lumpy rock: noisy icosahedron cut by a few random planes, flat underneath. */
function makeRockGeometry(rand: () => number, detail: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const cuts = Array.from({ length: 3 + Math.floor(rand() * 4) }, () => ({
    n: new THREE.Vector3(rand() * 2 - 1, rand() * 1.4 - 0.2, rand() * 2 - 1).normalize(),
    d: 0.5 + rand() * 0.35,
  }));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = 1 + noise3(v.x * 1.3, v.y * 1.3, v.z * 1.3, seed) * 0.32
                + noise3(v.x * 3.4, v.y * 3.4, v.z * 3.4, seed + 1) * 0.08;
    v.multiplyScalar(r);
    for (const c of cuts) {
      const k = v.dot(c.n) - c.d;
      if (k > 0) v.addScaledVector(c.n, -k);
    }
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // Icosahedron geometry is non-indexed, so this gives crisp faceted normals.
  g.computeVertexNormals();
  return g;
}

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFrag = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, d.y));
    float s = max(dot(d, uSunDir), 0.0);
    col += vec3(1.0, 0.95, 0.85) * (pow(s, 900.0) * 2.0 + pow(s, 10.0) * 0.18);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const dustVert = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform vec3 uWind;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position + uWind * uTime * (0.6 + aSeed * 0.8);
    p.x += sin(uTime * 0.3 + aSeed * 17.0) * 0.4;
    p.y += sin(uTime * 0.5 + aSeed * 40.0) * 0.3;
    // Wrap the particles in a box that follows the camera
    p = mod(p - uCenter + uBox, 2.0 * uBox) - uBox + uCenter;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = uSize * (0.4 + aSeed) * uPixelRatio / max(dist, 0.1);
    float edge = 1.0 - smoothstep(0.6, 1.0, length((p.xz - uCenter.xz) / uBox.xz));
    vAlpha = smoothstep(0.2, 1.5, dist) * edge;
  }
`;
const dustFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** Full-screen colour wash. Ignores transforms, so it can live anywhere in a scene. */
export function createHaze(color = HAZE_COLOR) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uHaze: { value: 0 } },
      vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uHaze;
        void main() {
          gl_FragColor = vec4(uColor, uHaze);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.visible = false;
  const set = (v: number) => {
    (mesh.material as THREE.ShaderMaterial).uniforms.uHaze.value = v;
    mesh.visible = v > 0.001;
  };
  return { mesh, set };
}

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

type Rock = {
  variant: number;
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rx: number; ry: number; rz: number;
  color: THREE.Color;
};

export async function createMarsSurface(opts: {
  tier: DeviceTier;
  pixelRatio: number;
  signal?: AbortSignal;
  seed?: number;
}): Promise<MarsSurface> {
  const { tier, pixelRatio, signal } = opts;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = mulberry32(seed);
  const s = (n: number) => (seed + n * 7919) | 0;
  const checkpoint = async () => {
    await nextTask();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SKY_HORIZON, 0.0042);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1500);
  camera.rotation.order = "YXZ";

  // --- Height field ----------------------------------------------------------
  const craters = Array.from({ length: 4 }, () => {
    const a = -Math.PI / 2 + (rand() * 2 - 1) * 1.1;
    const r = 30 + rand() * 100;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, r: 6 + rand() * 14, d: 0.6 + rand() * 1.4 };
  });

  let lastMask = 0;
  const height = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    let h = fbm2(x * 0.011, z * 0.011, 4, s(1)) * 4.5 + fbm2(x * 0.045, z * 0.045, 3, s(2)) * 0.9;

    // Exposed, layered bedrock: terrace the ground where the mask says so
    const mask = smoothstep(0.05, 0.4, fbm2(x * 0.018 + 31, z * 0.018 - 17, 2, s(3)));
    if (mask > 0) {
      const t = h * 1.4, f = t - Math.floor(t);
      const terraced = (Math.floor(t) + smoothstep(0.3, 0.7, f)) / 1.4;
      h += (terraced - h) * mask * 0.85;
    }
    lastMask = mask;

    for (const c of craters) {
      const dx = x - c.x, dz = z - c.z;
      const q = Math.sqrt(dx * dx + dz * dz) / c.r;
      if (q > 2.2) continue;
      if (q < 1) h -= c.d * (1 - q * q);
      h += c.d * 0.35 * Math.exp(-((q - 1) * (q - 1)) / 0.08);
    }

    h += fbm2(x * 0.35, z * 0.35, 3, s(4)) * 0.16;
    h *= 0.45 + 0.55 * smoothstep(3, 30, d); // calmer ground where the camera lands

    // Hazy ridge line on the horizon
    const ridge = 1 - Math.abs(fbm2(x * 0.007 + 5, z * 0.007 + 9, 4, s(5)));
    h += smoothstep(90, 260, d) * (ridge ** 3 * 32 + 3);
    return h;
  };

  // --- Terrain grid ----------------------------------------------------------
  const N = byTier(tier, { high: 320, mid: 180, low: 120 });
  const row = N + 1;
  const toWorld = (i: number) => {
    const u = (i / N) * 2 - 1;
    return Math.sign(u) * Math.abs(u) ** WARP * HALF;
  };
  const toIndex = (x: number) => {
    const u = Math.sign(x) * (Math.min(Math.abs(x), HALF) / HALF) ** (1 / WARP);
    return ((u + 1) / 2) * N;
  };

  const vCount = row * row;
  const positions = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const masks = new Float32Array(vCount);
  const axis = Array.from({ length: row }, (_, i) => toWorld(i));
  for (let j = 0; j < row; j++) {
    const z = axis[j];
    for (let i = 0; i < row; i++) {
      const x = axis[i];
      const k = j * row + i;
      positions[k * 3] = x;
      positions[k * 3 + 1] = height(x, z);
      positions[k * 3 + 2] = z;
      masks[k] = lastMask;
      uvs[k * 2] = x * 0.25;
      uvs[k * 2 + 1] = z * 0.25;
    }
    if (j % 64 === 63) await checkpoint();
  }
  const index = new Uint32Array(N * N * 6);
  for (let j = 0, p = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      index[p++] = a; index[p++] = c; index[p++] = b;
      index[p++] = b; index[p++] = c; index[p++] = d;
    }
  }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  terrainGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  terrainGeo.setIndex(new THREE.BufferAttribute(index, 1));
  terrainGeo.computeVertexNormals();
  await checkpoint();

  // --- Rocks -----------------------------------------------------------------
  const variants = byTier(tier, { high: 6, mid: 4, low: 3 });
  const rockCount = byTier(tier, { high: 2400, mid: 1100, low: 500 });
  const pebbleCount = byTier(tier, { high: 1500, mid: 600, low: 250 });
  const rockColors = ROCK_COLORS.map((c) => new THREE.Color(c));
  const rocks: Rock[] = [];

  const clusters = Array.from({ length: 40 }, () => {
    const a = rand() * Math.PI * 2, r = 4 + rand() ** 1.3 * 120;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r - 30, r: 2 + rand() * 7 };
  });

  const addRock = (x: number, z: number, size: number, variant: number, color?: THREE.Color) => {
    const slab = rand() < 0.15;
    const sx = size * (0.8 + rand() * 0.8) * (slab ? 2 : 1);
    const sz = size * (0.8 + rand() * 0.8) * (slab ? 2 : 1);
    const sy = size * (0.4 + rand() * 0.5) * (slab ? 0.3 : 1);
    const c = color ?? rockColors[Math.floor(rand() * rockColors.length)].clone()
      .lerp(new THREE.Color(SAND), rand() * 0.35)
      .multiplyScalar(0.8 + rand() * 0.3);
    rocks.push({
      variant, x, z, sx, sy, sz,
      y: height(x, z) - sy * 0.3,
      rx: (rand() - 0.5) * 0.5, ry: rand() * Math.PI * 2, rz: (rand() - 0.5) * 0.5,
      color: c,
    });
  };

  // Hero boulders, roughly where the eye lands (like the big pale rock in the rover shots)
  addRock(1.4, -5.5, 0.9, 0, new THREE.Color(0x9a6c4c));
  addRock(-7, -16, 2.1, 1);
  addRock(13, -34, 3.4, 2);

  for (let n = 0; n < rockCount; n++) {
    let x: number, z: number;
    const pick = rand();
    if (pick < 0.45) {
      // Clumps
      const c = clusters[Math.floor(rand() * clusters.length)];
      const a = rand() * Math.PI * 2, r = rand() ** 0.7 * c.r;
      x = c.x + Math.cos(a) * r;
      z = c.z + Math.sin(a) * r;
    } else if (pick < 0.75) {
      // All around the landing spot (seen from above during the descent)
      const a = rand() * Math.PI * 2, r = 2.5 + rand() ** 1.3 * 70;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r + 15;
    } else {
      // Out towards the horizon, in front of the camera
      const a = -Math.PI / 2 + (rand() * 2 - 1) * 1.25, r = 20 + rand() ** 1.4 * 190;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    const d = Math.hypot(x, z);
    if (d < 2.2) continue;
    const size = (0.05 + rand() ** 6 * 1.3) * (1 + d / 90);
    addRock(x, z, size, Math.floor(rand() * variants));
  }
  // Gravel close to the camera
  for (let n = 0; n < pebbleCount; n++) {
    const a = -Math.PI / 2 + (rand() * 2 - 1) * 1.1, r = 2 + rand() ** 1.5 * 28;
    addRock(Math.cos(a) * r, Math.sin(a) * r, 0.03 + rand() ** 3 * 0.12, Math.floor(rand() * variants));
  }
  // Keep the beacon's patch of ground clear
  for (let n = rocks.length - 1; n >= 0; n--) {
    const r = rocks[n];
    if (Math.hypot(r.x - BEACON.x, r.z - BEACON.z) < BEACON.size * 0.55 + Math.max(r.sx, r.sz)) rocks.splice(n, 1);
  }
  await checkpoint();

  // --- Ground colour, with contact shadows under nearby rocks ----------------
  const ao = new Float32Array(vCount).fill(1);
  for (const r of rocks) {
    const d = Math.hypot(r.x, r.z);
    if (d > 80) continue;
    const rr = Math.max(r.sx, r.sz) * 1.5;
    const i0 = Math.max(0, Math.floor(toIndex(r.x - rr))), i1 = Math.min(N, Math.ceil(toIndex(r.x + rr)));
    const j0 = Math.max(0, Math.floor(toIndex(r.z - rr))), j1 = Math.min(N, Math.ceil(toIndex(r.z + rr)));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const q = Math.hypot(axis[i] - r.x, axis[j] - r.z) / rr;
        if (q < 1) ao[j * row + i] *= 1 - 0.5 * (1 - smoothstep(0.35, 1, q));
      }
    }
  }

  const normals = terrainGeo.attributes.normal.array as Float32Array;
  const colors = new Float32Array(vCount * 3);
  const cSand = new THREE.Color(SAND), cDust = new THREE.Color(DUST);
  const cBed = new THREE.Color(BEDROCK), cDark = new THREE.Color(DARK);
  const col = new THREE.Color();
  for (let k = 0; k < vCount; k++) {
    const x = positions[k * 3], z = positions[k * 3 + 2];
    const slope = 1 - normals[k * 3 + 1];
    col.copy(cSand).lerp(cDust, smoothstep(-0.25, 0.35, fbm2(x * 0.04, z * 0.04, 3, s(6))));
    col.lerp(cBed, Math.min(1, masks[k] * 0.55 + slope * 3));
    col.lerp(cDark, smoothstep(0.25, 0.6, fbm2(x * 0.09, z * 0.09, 2, s(7))) * 0.35);
    col.multiplyScalar(ao[k]);
    colors[k * 3] = col.r;
    colors[k * 3 + 1] = col.g;
    colors[k * 3 + 2] = col.b;
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  await checkpoint();

  const detail = makeDetailTexture(s(8));
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detail,
      bumpMap: detail,
      bumpScale: 3,
      roughness: 1,
      metalness: 0,
    }),
  );
  scene.add(terrain);

  const rockMat = new THREE.MeshStandardMaterial({
    bumpMap: detail,
    bumpScale: 3,
    roughness: 0.95,
    metalness: 0,
  });
  const detailLevel = tier === "high" ? 2 : 1;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let v = 0; v < variants; v++) {
    const mine = rocks.filter((r) => r.variant === v);
    if (!mine.length) continue;
    const mesh = new THREE.InstancedMesh(makeRockGeometry(rand, detailLevel, s(20 + v)), rockMat, mine.length);
    mine.forEach((r, i) => {
      m.compose(p.set(r.x, r.y, r.z), q.setFromEuler(e.set(r.rx, r.ry, r.rz)), sc.set(r.sx, r.sy, r.sz));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, r.color);
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }

  // --- Beacon: the marker disc, draped over the terrain ---------------------
  const beaconGeo = new THREE.PlaneGeometry(BEACON.size, BEACON.size, 24, 24).rotateX(-Math.PI / 2);
  const beaconPos = beaconGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < beaconPos.count; i++) {
    beaconPos.setY(i, height(beaconPos.getX(i) + BEACON.x, beaconPos.getZ(i) + BEACON.z) + 0.05);
  }
  const beaconMat = createBeaconMaterial();
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(BEACON.x, 0, BEACON.z);
  beacon.renderOrder = 1;
  scene.add(beacon);

  // --- Sky & light -----------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.8);
  sun.position.set(-70, 45, 40);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xe8c29a, 0x4a2818, 1.2));

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: new THREE.Color(SKY_HORIZON) },
        uZenith: { value: new THREE.Color(SKY_ZENITH) },
        uSunDir: { value: sun.position.clone().normalize() },
      },
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // --- Dust ------------------------------------------------------------------
  const makeDust = (count: number, box: THREE.Vector3, size: number, opacity: number, color: number) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() * 2 - 1) * box.x;
      pos[i * 3 + 1] = (rand() ** 2 * 2 - 1) * box.y; // denser near the ground
      pos[i * 3 + 2] = (rand() * 2 - 1) * box.z;
      seeds[i] = rand();
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uPixelRatio: { value: pixelRatio },
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: box },
        uWind: { value: new THREE.Vector3(1.2, 0.05, 0.4) },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return mat;
  };
  const dust = [
    makeDust(byTier(tier, { high: 2500, mid: 1000, low: 400 }), new THREE.Vector3(35, 6, 35), 14, 0.55, 0xe6b48a),
    makeDust(byTier(tier, { high: 50, mid: 25, low: 12 }), new THREE.Vector3(45, 5, 45), 1400, 0.025, 0xd9a577),
  ];

  const haze = createHaze();
  scene.add(haze.mesh);

  // --- Per-frame -------------------------------------------------------------
  const update: MarsSurface["update"] = (t, k, hazeAmount, rig) => {
    const land = 1 - (1 - k) ** 3;
    // Start the descent over the beacon (the pitch-down view looks ~6 units ahead), so it stays
    // centred through the hand-over from space, then land a short walk back from it.
    const x = (rig?.position.x ?? 0) * 0.12 + THREE.MathUtils.lerp(BEACON.x, 0, land);
    const z = THREE.MathUtils.lerp(BEACON.z + 6, 0, land);
    const ground = height(x, z);
    camera.position.set(x, ground + EYE + (1 - land) * 85 + (rig?.position.y ?? 0) * 0.05, z);

    const pitch = THREE.MathUtils.lerp(-1.5, -0.06, smoothstep(0, 1, k) ** 1.5);
    // Idle sway calms down once landed, so the project portals stay framed
    const yaw = Math.sin(t * 0.04) * 0.1 * (1 - 0.8 * land) + (rig?.rotation.y ?? 0) * 4;
    camera.rotation.set(pitch + (rig?.rotation.x ?? 0) * 3, yaw, 0);

    sky.position.copy(camera.position);
    beaconMat.uniforms.uTime.value = t;
    for (const mat of dust) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uCenter.value.set(x, ground + 3, z);
    }
    haze.set(hazeAmount);
  };

  const setAspect = (aspect: number) => {
    if (Math.abs(camera.aspect - aspect) < 1e-4) return;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    scene.traverse((o: any) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((mat: THREE.Material) => mat.dispose());
    });
    detail.dispose();
  };

  return { scene, camera, update, setAspect, heightAt: height, dispose };
}
