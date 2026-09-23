// src/space/moon.ts
import * as THREE from "three";

export type MoonOptions = {
  /** Mean radius; the long axis ends up ~1.2× this. */
  radius: number;
  segments: number;
  /** World-space direction the sunlight comes from (share it with Mars so both are lit alike). */
  sunDirection: THREE.Vector3;
};

// Phobos is ~27 × 22 × 18 km. Long axis on +X (towards Mars when placed on the orbit's +X),
// intermediate along the direction of travel (Z), short axis along the orbit normal (Y).
const AXES = new THREE.Vector3(1.21, 0.81, 0.99);

type Crater = { dir: THREE.Vector3; size: number; depth: number };

/** Small seeded PRNG so the shape is identical on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDir(rand: () => number) {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
}

/** Bowl with a raised rim; `x` is distance from the crater centre in crater radii. */
function craterProfile(x: number) {
  const bowl = x < 1 ? x * x - 1 : 0;
  const rim = Math.exp(-(((x - 1) / 0.3) ** 2)) * 0.25;
  return bowl + rim;
}

/** Radial offset (in unit-sphere radii) for the surface point in direction `d`. */
function phobosRelief(d: THREE.Vector3, lumps: Crater[], craters: Crater[]) {
  let h = 0;
  // Broad lumps and hollows break up the ellipsoid.
  for (const l of lumps) h += l.depth * Math.exp(-(d.distanceToSquared(l.dir) / (l.size * l.size)));
  for (const c of craters) {
    const x = d.distanceTo(c.dir) / c.size;
    if (x < 1.8) h += c.depth * craterProfile(x);
  }
  return h;
}

/**
 * Builds Phobos's lumpy shape from a sphere: stretched to its proportions, with the huge
 * Stickney crater at one end of the long axis and smaller craters scattered around.
 */
function createPhobosGeometry(T: typeof THREE, radius: number, segments: number) {
  const geometry = new T.SphereGeometry(1, segments, segments);
  const rand = mulberry32(7);

  const lumps: Crater[] = Array.from({ length: 16 }, () => ({
    dir: randomDir(rand),
    size: 0.35 + rand() * 0.5,
    depth: (rand() - 0.5) * 0.36,
  }));
  const craters: Crater[] = [
    // Stickney: ~9 km across on a ~22 km body, near the leading end of the long axis.
    { dir: new T.Vector3(0.75, 0.05, 0.66).normalize(), size: 0.42, depth: 0.14 },
    ...Array.from({ length: 22 }, () => ({
      dir: randomDir(rand),
      size: 0.06 + rand() ** 2 * 0.18,
      depth: 0.02 + rand() * 0.03,
    })),
  ];

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const d = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const r = radius * (1 + phobosRelief(d, lumps, craters));
    pos.setXYZ(i, d.x * r * AXES.x, d.y * r * AXES.y, d.z * r * AXES.z);
  }
  geometry.computeVertexNormals();
  weldNormals(geometry);
  return geometry;
}

/** Average normals across the UV seam and poles, where the sphere duplicates vertices. */
function weldNormals(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const nrm = geometry.attributes.normal as THREE.BufferAttribute;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(i);
  }
  const n = new THREE.Vector3();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of idx) n.x += nrm.getX(i), n.y += nrm.getY(i), n.z += nrm.getZ(i);
    n.normalize();
    for (const i of idx) nrm.setXYZ(i, n.x, n.y, n.z);
  }
}

/**
 * Phobos: a lumpy, cratered moon, lambert-lit from `sunDirection`, with the albedo map's
 * luminance doubling as a bump map so small craters catch light along the terminator.
 */
export function createMoon(T: typeof THREE, map: THREE.Texture, { radius, segments, sunDirection }: MoonOptions) {
  const geometry = createPhobosGeometry(T, radius, segments);
  const material = new T.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uSunDirection: { value: sunDirection.clone().normalize() },
      uBumpScale: { value: 0.04 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
        vUv = uv;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vPosition = worldPosition.xyz;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uSunDirection;
      uniform float uBumpScale;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      float height(vec2 uv) {
        return dot(texture(uMap, uv).rgb, vec3(0.299, 0.587, 0.114));
      }

      // Screen-space bump mapping (same approach as three's bumpmap chunk, in world space).
      vec3 perturbNormal(vec3 n) {
        vec2 dSTdx = dFdx(vUv);
        vec2 dSTdy = dFdy(vUv);
        float h = height(vUv);
        float dBx = uBumpScale * (height(vUv + dSTdx) - h);
        float dBy = uBumpScale * (height(vUv + dSTdy) - h);

        vec3 dpdx = dFdx(vPosition);
        vec3 dpdy = dFdy(vPosition);
        vec3 r1 = cross(dpdy, n);
        vec3 r2 = cross(n, dpdx);
        float det = dot(dpdx, r1);
        vec3 grad = sign(det) * (dBx * r1 + dBy * r2);
        return normalize(abs(det) * n - grad);
      }

      void main() {
        vec3 n = perturbNormal(normalize(vNormal));
        vec3 albedo = texture(uMap, vUv).rgb;

        // Soft terminator, with a faint warm fill so the night side isn't pure black.
        float light = smoothstep(-0.05, 1.0, dot(n, uSunDirection));
        vec3 color = albedo * (light * 1.6 + vec3(0.035, 0.028, 0.024));

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new T.Mesh(geometry, material);
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
