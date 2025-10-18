// src/space/pages/contact.ts
import * as THREE from "three";
import diskVert from "@src/shaders/blackhole/disk.vert.glsl";
import diskFragRaw from "@src/shaders/blackhole/disk.frag.glsl";
import ringVert from "@src/shaders/blackhole/ring.vert.glsl";
import ringFrag from "@src/shaders/blackhole/ring.frag.glsl";
import noiseGLSL from "@src/shaders/blackhole/noise.glsl";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";

type BlackHole = {
  root: THREE.Group;
  update: (dt: number, t: number) => void;
};

// ---- glowing round sprite (generated in-memory) ----
function makeCircleSprite(size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // soft radial glow
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.0, "rgba(255,255,255,1.0)");
  g.addColorStop(0.25,"rgba(255,231,176,0.9)");
  g.addColorStop(0.9, "rgba(255,231,176,0.35)");
  g.addColorStop(1.0, "rgba(255,231,176,0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  tex.flipY = false;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

// Vertex shader — no re-declarations of built-ins
const PARTICLE_VS = `
  attribute float aSize;
  attribute float aPhase;
  varying float vPhase;

  void main() {
    vPhase = aPhase;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z); // tweak 300.0 to taste
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader — same as before (kept for clarity)
const PARTICLE_FS = `
  precision mediump float;

  uniform sampler2D uSprite;
  uniform vec3 uColor;
  uniform float uTime;

  varying float vPhase;

  void main() {
    vec2 uv = gl_PointCoord;
    vec4 tex = texture2D(uSprite, uv);

    // circular cutoff in case sprite edge bleeds
    float d = distance(uv, vec2(0.5));
    if (d > 0.5) discard;

    // subtle per-particle flicker
    float flicker = 0.7 + 0.3 * sin(uTime * 6.0 + vPhase);

    float alpha = tex.a * flicker;
    if (alpha < 0.01) discard;

    vec3 col = uColor * tex.rgb;
    gl_FragColor = vec4(col, alpha);
  }
`;


/** Build the black hole object (caller attaches the returned group). */
function createBlackHole(opts: {
  three: typeof THREE;
  camera: THREE.PerspectiveCamera;
  position?: THREE.Vector3;
  scale?: number;
}): BlackHole {
  const T = opts.three;
  const { camera } = opts;

  const root = new T.Group();
  root.position.copy(opts.position ?? new T.Vector3(0, -40, -20));
  const S = opts.scale ?? 6.0;
  root.scale.setScalar(S);

  // 1) Event horizon
  const horizon = new T.Mesh(
    new T.SphereGeometry(1.0, 128, 128),
    new T.MeshBasicMaterial({ color: 0x000000 })
  );
  horizon.renderOrder = 1;
  root.add(horizon);

  // 2) Photon ring (Fresnel)
  const ringMat = new T.ShaderMaterial({
    uniforms: {
      uRingColor: { value: new T.Color(0xffe7b0) },
      uIntensity: { value: 1.7 },
    },
    vertexShader: ringVert,
    fragmentShader: ringFrag,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const ring = new T.Mesh(new T.SphereGeometry(1.06, 128, 128), ringMat);
  ring.renderOrder = 2;
  root.add(ring);

  // 3) Accretion disk (noise prepended so bh_fbm(vec2) exists)
  const innerR = 1.1, outerR = 3, seg = 256;
  const diskGeo = new T.RingGeometry(innerR, outerR, seg, 1);
  diskGeo.rotateX(-Math.PI / 2);

  const diskFrag = `${noiseGLSL}\n${diskFragRaw}`;

  const diskMat = new T.ShaderMaterial({
    uniforms: {
      uTime:       { value: 0 },
      uColorInner: { value: new T.Color(0xffc36b) },
      uColorOuter: { value: new T.Color(0xffc36b) },
      uInnerR:     { value: innerR },
      uOuterR:     { value: outerR },
      uSpin:       { value: 0.7 },
      uBeaming:    { value: 0.9 },
      uCamPos:     { value: new T.Vector3() },
    },
    vertexShader:   diskVert,
    fragmentShader: diskFrag,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  const disk = new T.Mesh(diskGeo, diskMat);
  disk.renderOrder = 0;
  root.add(disk);

  // 4) Infall particles (round, glowing, flickering)
  const pCount = 1200;
  const pGeo = new T.BufferGeometry();
  const pPos   = new Float32Array(pCount * 3);
  const pSpeed = new Float32Array(pCount);
  const pSize  = new Float32Array(pCount);
  const pPhase = new Float32Array(pCount);

  for (let i = 0; i < pCount; i++) {
    const r = T.MathUtils.lerp(outerR * 0.9, outerR * 1.2, Math.random());
    const a = Math.random() * Math.PI * 2;
    pPos[i*3+0] = Math.cos(a) * r;
    pPos[i*3+1] = (Math.random() - 0.5) * 0.5;
    pPos[i*3+2] = Math.sin(a) * r;

    pSpeed[i] = T.MathUtils.lerp(0.2, 0.3, Math.random());

    // per-particle screen size and flicker phase
    pSize[i]  = T.MathUtils.lerp(6.0, 14.0, Math.random());  // pixels at ~300 factor
    pPhase[i] = Math.random() * Math.PI * 2.0;
  }

  pGeo.setAttribute("position", new T.BufferAttribute(pPos, 3));
  pGeo.setAttribute("aSize",    new T.BufferAttribute(pSize, 1));
  pGeo.setAttribute("aPhase",   new T.BufferAttribute(pPhase, 1));

  const spriteTex = makeCircleSprite(64);
  const pMat = new T.ShaderMaterial({
    uniforms: {
      uSprite: { value: spriteTex },
      uColor:  { value: new T.Color(0xffaa88) },
      uTime:   { value: 0 },
    },
    vertexShader:   PARTICLE_VS,
    fragmentShader: PARTICLE_FS,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });

  const particles = new T.Points(pGeo, pMat);
  particles.renderOrder = 3;
  root.add(particles);

  const tmp = new T.Vector3();

  const update = (dt: number, t: number) => {
    // disk spin
    disk.rotation.y += dt * 0.25;

    // shader uniforms
    (diskMat.uniforms.uTime as any).value = t;
    (diskMat.uniforms.uCamPos as any).value.copy(camera.getWorldPosition(tmp));

    // particle flicker time
    (pMat.uniforms.uTime as any).value = t;

    // spiral particles inward
    const pos = pGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pCount; i++) {
      const ix = i * 3;
      const x = pos.array[ix + 0];
      const y = pos.array[ix + 1];
      const z = pos.array[ix + 2];
      const r = Math.max(0.2, Math.hypot(x, z));
      const w = pSpeed[i] * (1.2 / r); // angular ~ 1/r
      const ang = Math.atan2(z, x) + w * dt;

      const rNew = r - dt * pSpeed[i] * 0.15; // inward drift
      const yNew = y * (1.0 - dt * 0.35);     // thin the disk

      const crossed = rNew < innerR * 0.95;
      const rClamp = crossed
        ? T.MathUtils.lerp(outerR * 0.9, outerR * 1.2, Math.random())
        : rNew;
      const aNew = crossed ? Math.random() * Math.PI * 2 : ang;

      pos.array[ix + 0] = Math.cos(aNew) * rClamp;
      pos.array[ix + 1] = crossed ? (Math.random() - 0.5) * 0.5 : yNew;
      pos.array[ix + 2] = Math.sin(aNew) * rClamp;
    }
    pos.needsUpdate = true;
  };

  return { root, update };
}

const loadContact: PageLoader = async ({ three: T, camera }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  // Build black hole and attach to this page's group
  const bh = createBlackHole({
    three: T,
    camera,
    position: new T.Vector3(0, -35, -120),
    scale: 40,
  });
  group.add(bh.root);

  const uiText = await mountTextEffects();

  const updater = (dt: number, t: number) => {
    if (cancelled) return;
    bh.update(dt, t);
  };

    document.addEventListener("astro:before-preparation", (event) => {
    const originalLoader = event.loader;
    event.loader = async function () {
      const camera = window.SpaceManager.getCamera();
      const camProxy = { x: -20, y: -30, z: 90, ox: 0, oy: 0 };
      const qCamX = gsap.quickTo(camera.position, "x", { duration: 0.62, ease: "power3.out" });
      const qCamY = gsap.quickTo(camera.position, "y", { duration: 0.62, ease: "power3.out" });
      const qCamZ = gsap.quickTo(camera.position, "z", { duration: 0.62, ease: "power3.out" });
      const updateCamera = () => {
        qCamX(camProxy.x + camProxy.ox);
        qCamY(camProxy.y + camProxy.oy);
        qCamZ(camProxy.z);
        camera.updateMatrixWorld();
      };
      await originalLoader();
      updateCamera();
    };
  });

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};




export default loadContact;
