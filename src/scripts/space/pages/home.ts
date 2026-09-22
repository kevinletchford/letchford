// src/space/pages/home.ts
import * as THREE from "three";
import marsVertexShader from "@src/shaders/mars/vertex.glsl";
import marsFragmentShader from "@src/shaders/mars/fragment.glsl";

import type { Ctx, LoadResult, PageLoader } from "../types";
// import { mountHomeUI } from "./home-ui"; // uses AbortController internally and returns { dispose }
import { mountTextEffects } from "../ui/text-animator";
import { byTier } from "../device";

function upgradeToStandard(T: typeof THREE, mesh: THREE.Mesh, map: THREE.Texture) {
  const oldMat = mesh.material as THREE.Material | THREE.Material[] | undefined;
  (Array.isArray(oldMat) ? oldMat : [oldMat]).forEach((m) => m?.dispose?.());

  mesh.material = new T.MeshStandardMaterial({
    map,
    color: 0xffffff,
    emissive: 0x222222,
    roughness: 1,
    metalness: 0,
  });
}

const loadHome: PageLoader = async ({ three: T, renderer, tier, assets, defer, add }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  // keep planet centered in local group-space; offset the whole scene with the parent transform if needed elsewhere
  group.position.set(-10, -30, 50);

  let cancelled = false;

  // --- Mount homepage DOM listeners (AbortController inside) ---
  // const { dispose: disposeUI } = mountHomeUI();
  const uiText = await mountTextEffects();

  // --- Textures (critical: the preloader waits for these) ---
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  const isMobile = tier !== "high";

  // Use smaller textures/geometry on mobile to prevent crashes
  const dayPath   = byTier(tier, { high: "/mars/mars.jpg",       mid: "/mars/mars-mobile.jpg" });
  const nightPath = byTier(tier, { high: "/mars/mars-night.jpg", mid: "/mars/mars-night-mobile.jpg" });
  const segs      = isMobile ? 64 : 128;

  const [marsDay, marsNight] = await Promise.all([
    assets.texture(dayPath),
    assets.texture(nightPath),
  ]);

  marsDay.colorSpace = T.SRGBColorSpace;
  marsNight.colorSpace = T.SRGBColorSpace;
  [marsDay, marsNight].forEach((t) => (t.anisotropy = isMobile ? 1 : maxAniso));

  // --- Mars (shader) ---
  const planetRadius = 10;
  const planetGeo = new T.SphereGeometry(planetRadius, segs, segs);
  const planetMat = new T.ShaderMaterial({
    uniforms: {
      uDayTexture: { value: marsDay },
      uNightTexture: { value: marsNight },
      uSpecularTexture: { value: marsDay }, // Reusing day texture for specular as per original
      uSunDirection: { value: new T.Vector3(-0.4, 0, 0.1) },
    },
    vertexShader: marsVertexShader,
    fragmentShader: marsFragmentShader,
    lights: false, 
  });
  const planet = new T.Mesh(planetGeo, planetMat);
  planet.rotation.z = T.MathUtils.degToRad(25.19);
  group.add(planet);

  // --- Atmosphere Halo ---
  let atmoGeo: THREE.SphereGeometry | undefined;
  let atmoMat: THREE.ShaderMaterial | undefined;
  
  if (!isMobile) {
    const atmoRadius = planetRadius * 1.03; // tighter radius based on feedback
    atmoGeo = new T.SphereGeometry(atmoRadius, segs, segs);
    atmoMat = new T.ShaderMaterial({
      uniforms: {
        uColor: { value: new T.Color(0xffddbb) } // very pale, subtle warm tint
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          // vNormal is in view-space, vec3(0,0,1) is towards the camera
          float f = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
          // Very subtle ramp: only barely visible near the edges
          float intensity = smoothstep(0.4, 0.0, f) * smoothstep(0.0, 0.2, f);
          gl_FragColor = vec4(uColor, intensity * 0.3); // much more translucent
        }
      `,
      blending: T.AdditiveBlending,
      side: T.FrontSide, 
      transparent: true,
      depthWrite: false
    });
    const atmosphere = new T.Mesh(atmoGeo, atmoMat);
    group.add(atmosphere);
  }

  // --- Orbit rig ---
  // We separate the tilt (orbital plane) from the orbit rotation so we can set an initial angle easily.
  const tiltPivot = new T.Group();
  const orbitPivot = new T.Group();
  group.add(tiltPivot);
  tiltPivot.add(orbitPivot);

  const orbitAltitude = 3; // distance above the planet surface
  const orbitRadius = planetRadius + orbitAltitude; // total radius from center

  // Tilt the orbital plane a bit for visual interest
  const tiltX = T.MathUtils.degToRad(15);
  const tiltY = T.MathUtils.degToRad(10);
  tiltPivot.rotation.set(tiltX, tiltY, 0);

  // Choose where along the orbit the satellite starts (0 = +X). 180° puts it in front, typically most visible.
  const initialOrbitAngle = T.MathUtils.degToRad(180);
  orbitPivot.rotation.y = initialOrbitAngle;

  // --- Satellite (secondary: streamed in after Mars, dropped on low-tier devices) ---
  let satellite: THREE.Group | null = null;
  defer(async (deferredAssets) => {
    const [obj, map] = await Promise.all([
      deferredAssets.obj("/satellite/Satellite.obj"),
      deferredAssets.texture(byTier(tier, {
        high: "/satellite/Satellite_BaseColor.png",
        mid: "/satellite/Satellite_BaseColor.webp",
      })),
    ]);

    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    obj.traverse((c) => (c instanceof T.Mesh) && upgradeToStandard(T, c, map));

    obj.scale.setScalar(0.05);
    obj.position.set(orbitRadius, 0, 0); // start on +X before we rotate the orbit
    // optional: a subtle local rotation so it isn't perfectly rigid in space
    obj.rotation.set(0, -20, 10);

    await add(obj, orbitPivot);
    satellite = obj;
  }, { optional: true });

  // --- Astronaut (kept, cleaned) ---
  
  // --- Idle motion & orbit ---
  const yAxis = new T.Vector3(0, 1, 0);
  const planetSpin = 0.015; // radians/sec multiplier

  // Satellite orbit params
  const orbitSpeed = 0.15; // radians per second around Y after pivot tilts

  const updater = (dt: number, t: number) => {
    // Planet axial rotation
    planet.rotateOnAxis(yAxis, planetSpin * dt);

    // Satellite orbit (spin the pivot)
    orbitPivot.rotateY(orbitSpeed * dt);

    // Optional: keep satellite oriented tangentially along its orbit
    // Compute tangent by differentiating the pivot rotation around Y (approximate with small step)
    // For simplicity and perf, just add a slow local spin:
    satellite?.rotateZ(0.25 * dt);

  };

  const dispose = () => {
    cancelled = true; // stop async additions
    // disposeUI?.();
    uiText.dispose();

    // Explicitly dispose GPU resources created here
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh) {
        mesh.geometry?.dispose?.();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });

    planetGeo.dispose();
    planetMat.dispose();
    atmoGeo?.dispose();
    atmoMat?.dispose();
    marsDay.dispose();
    marsNight.dispose();
  };

  return { group, dispose, updater };
};

export default loadHome;
