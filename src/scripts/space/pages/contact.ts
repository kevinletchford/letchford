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

/** Build the black hole object (no scene adds; caller attaches to a parent/group). */
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

  // 1) Event horizon (simple black sphere)
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

  // 3) Accretion disk
  const innerR = 1.25,
    outerR = 3.5,
    seg = 256;
  const diskGeo = new T.RingGeometry(innerR, outerR, seg, 1);
  diskGeo.rotateX(-Math.PI / 2);

  // Inject noise into fragment shader
  const diskFrag = diskFragRaw.replace("//__NOISE__", noiseGLSL);

  const diskMat = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorInner: { value: new T.Color(0xffc36b) },
      uColorOuter: { value: new T.Color(0x9944ff) },
      uInnerR: { value: innerR },
      uOuterR: { value: outerR },
      uSpin: { value: 0.7 },
      uBeaming: { value: 0.9 },
      uCamPos: { value: new T.Vector3() },
    },
    vertexShader: diskVert,
    fragmentShader: diskFrag,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  const disk = new T.Mesh(diskGeo, diskMat);
  disk.renderOrder = 0;
  root.add(disk);

  // 4) Infall particles
  const pCount = 1200;
  const pGeo = new T.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pSpeed = new Float32Array(pCount);

  for (let i = 0; i < pCount; i++) {
    const r = T.MathUtils.lerp(outerR * 0.9, outerR * 1.2, Math.random());
    const a = Math.random() * Math.PI * 2;
    pPos[i * 3 + 0] = Math.cos(a) * r;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    pPos[i * 3 + 2] = Math.sin(a) * r;
    pSpeed[i] = T.MathUtils.lerp(0.2, 0.7, Math.random());
  }
  pGeo.setAttribute("position", new T.BufferAttribute(pPos, 3));
  const pMat = new T.PointsMaterial({
    color: 0xffaa88,
    size: 0.45,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
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
      const yNew = y * (1.0 - dt * 0.35); // thin the disk

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

const loadContact: PageLoader = async ({
  three: T,
  camera,
  renderer,
}: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  // Build black hole and attach to this page's group
  const bh = createBlackHole({
    three: T,
    camera,
    position: new T.Vector3(0, -30, -120),
    scale: 40,
  });
  group.add(bh.root);
  const uiText = await mountTextEffects();
  // Per-frame updater (manager will call this)
  const updater = (dt: number, t: number) => {
    if (cancelled) return;
    bh.update(dt, t);
    camera.position.set(-20, -30, 80);

  };

  const dispose = () => {
    cancelled = true;
      uiText.dispose();
    // No DOM listeners here; manager will deep-dispose geometries/materials on `group`
  };

  return { group, dispose, updater };
};

export default loadContact;
