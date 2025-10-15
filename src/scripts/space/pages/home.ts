// src/space/pages/home.ts
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import marsVertexShader from "@src/shaders/mars/vertex.glsl";
import marsFragmentShader from "@src/shaders/mars/fragment.glsl";
import type { Ctx, LoadResult, PageLoader } from "../types";
// import { mountHomeUI } from "./home-ui"; // uses AbortController internally and returns { dispose }
import { mountTextEffects } from "../ui/text-animator";

const MTL = (lm: THREE.LoadingManager) => new MTLLoader(lm);
const OBJ = (lm: THREE.LoadingManager) => new OBJLoader(lm);

function upgradeToStandard(T: typeof THREE, mesh: THREE.Mesh) {
  const oldMat = mesh.material as THREE.Material | THREE.Material[] | undefined;
  let map: THREE.Texture | undefined;

  if (Array.isArray(oldMat)) {
    for (const m of oldMat) {
      if (!map && (m as any).map) map = (m as any).map as THREE.Texture;
      m.dispose?.();
    }
  } else if (oldMat) {
    if ((oldMat as any).map) map = (oldMat as any).map as THREE.Texture;
    oldMat.dispose?.();
  }

  mesh.material = new T.MeshStandardMaterial({
    map,
    color: 0xffffff,
    emissive: 0x222222,
    roughness: 1,
    metalness: 0,
  });
}

const loadHome: PageLoader = async ({ three: T, renderer, textureLoader, loadingManager }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  // keep planet centered in local group-space; offset the whole scene with the parent transform if needed elsewhere
  group.position.set(-10, -30, 50);

  let cancelled = false;

  // --- Mount homepage DOM listeners (AbortController inside) ---
  // const { dispose: disposeUI } = mountHomeUI();
  const uiText = await mountTextEffects();

  // --- Textures (async, cancellable) ---
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;

  const [marsDay, marsNight, marsSpec] = await Promise.all([
    textureLoader.loadAsync("/mars/mars.jpg"),
    textureLoader.loadAsync("/mars/mars-night.jpg"),
    textureLoader.loadAsync("/mars/mars-specular.jpg"),
  ]);
  // if (cancelled) return { group, dispose: () => disposeUI?.() };

  marsDay.colorSpace = T.SRGBColorSpace;
  marsNight.colorSpace = T.SRGBColorSpace;
  [marsDay, marsNight, marsSpec].forEach((t) => (t.anisotropy = maxAniso));

  // --- Mars (shader) ---
  const planetRadius = 10;
  const planetGeo = new T.SphereGeometry(planetRadius, 256, 256);
  const planetMat = new T.ShaderMaterial({
    uniforms: {
      uDayTexture: { value: marsDay },
      uNightTexture: { value: marsNight },
      uSpecularTexture: { value: marsSpec },
      uSunDirection: { value: new T.Vector3(-0.4, 0, 0.1) },
    },
    vertexShader: marsVertexShader,
    fragmentShader: marsFragmentShader,
    lights: false,
  });
  const planet = new T.Mesh(planetGeo, planetMat);
  planet.rotation.z = T.MathUtils.degToRad(25.19);
  group.add(planet);

  // --- Satellite (OBJ/MTL) ---
  const satMtl = await MTL(loadingManager)
    .setResourcePath("/satellite/")
    .loadAsync("/satellite/Satellite.mtl");
  // if (cancelled) return { group, dispose: () => disposeUI?.() };
  satMtl.preload();

  const satellite = await OBJ(loadingManager)
    .setMaterials(satMtl)
    .setResourcePath("/satellite/")
    .loadAsync("/satellite/Satellite.obj");
  // if (cancelled) return { group, dispose: () => disposeUI?.() };

  satellite.traverse((c) => (c instanceof T.Mesh) && upgradeToStandard(T, c));

  // --- Orbit rig ---
  // We separate the tilt (orbital plane) from the orbit rotation so we can set an initial angle easily.
  const tiltPivot = new T.Group();
  const orbitPivot = new T.Group();
  group.add(tiltPivot);
  tiltPivot.add(orbitPivot);

  const orbitAltitude = 3; // distance above the planet surface
  const orbitRadius = planetRadius + orbitAltitude; // total radius from center

  // Satellite mesh setup
  satellite.scale.setScalar(0.05);
  satellite.position.set(orbitRadius, 0, 0); // start on +X before we rotate the orbit

  // Tilt the orbital plane a bit for visual interest
  const tiltX = T.MathUtils.degToRad(15);
  const tiltY = T.MathUtils.degToRad(10);
  tiltPivot.rotation.set(tiltX, tiltY, 0);

  // Choose where along the orbit the satellite starts (0 = +X). 180° puts it in front, typically most visible.
  const initialOrbitAngle = T.MathUtils.degToRad(180);
  orbitPivot.rotation.y = initialOrbitAngle;

  // optional: a subtle local rotation so it isn't perfectly rigid in space
  satellite.rotation.set(0, -20, 10);

  orbitPivot.add(satellite);

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
    satellite.rotateZ(0.25 * dt);

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
    marsDay.dispose();
    marsNight.dispose();
    marsSpec.dispose();
  };

  return { group, dispose, updater };
};

export default loadHome;
