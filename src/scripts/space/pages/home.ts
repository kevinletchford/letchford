// src/space/pages/home.ts
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import marsVertexShader from "@src/shaders/mars/vertex.glsl";
import marsFragmentShader from "@src/shaders/mars/fragment.glsl";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { gsap } from "gsap";
import { mountHomeUI } from "./home-ui"; // <- uses AbortController internally and returns { dispose }
import { mountTextEffects } from "../ui/text-animator";

const MTL = (lm: THREE.LoadingManager) => new MTLLoader(lm);
const OBJ = (lm: THREE.LoadingManager) => new OBJLoader(lm);

function upgradeToStandard(T: typeof THREE, mesh: THREE.Mesh) {
  const old: any = mesh.material;
  const tex = old?.map as THREE.Texture | undefined;
  mesh.material = new T.MeshStandardMaterial({
    map: tex, color: 0xffffff, emissive: 0x222222, roughness: 1, metalness: 0,
  });
}

const loadHome: PageLoader = async ({ three: T,camera,renderer,scene, textureLoader, loadingManager }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  group.position.set( -10, -30, 50);
  let cancelled = false;
    console.log("just before homeui")
  // --- Mount homepage DOM listeners (AbortController inside) ---
  const { dispose: disposeUI } = mountHomeUI();
    const uiText = await mountTextEffects();

  // --- Mars (shader) ---
  const planetRadius = 10;
  const marsDay   = textureLoader.load("/mars/mars.jpg");        marsDay.colorSpace   = T.SRGBColorSpace; marsDay.anisotropy = 8;
  const marsNight = textureLoader.load("/mars/mars-night.jpg");  marsNight.colorSpace = T.SRGBColorSpace; marsNight.anisotropy = 8;
  const marsSpec  = textureLoader.load("/mars/mars-specular.jpg"); marsSpec.anisotropy = 8;

  const planetGeo = new T.SphereGeometry(planetRadius, 256, 256);
  const planetMat = new T.ShaderMaterial({
    uniforms: {
      uDayTexture:      new T.Uniform(marsDay),
      uNightTexture:    new T.Uniform(marsNight),
      uSpecularTexture: new T.Uniform(marsSpec),
      uSunDirection:    new T.Uniform(new T.Vector3(-0.4, 0, 0.1)),
    },
    vertexShader: marsVertexShader,
    fragmentShader: marsFragmentShader,
    lights: false,
  });
  const planet = new T.Mesh(planetGeo, planetMat);
  planet.rotation.z = T.MathUtils.degToRad(25.19);
  group.add(planet);

  // --- Satellite ---
  const satMtl = await MTL(loadingManager).loadAsync("/satellite/Satellite.mtl");
  if (cancelled) return { group, dispose: () => disposeUI?.() };
  satMtl.preload();
  const satellite = await OBJ(loadingManager).setMaterials(satMtl).loadAsync("/satellite/Satellite.obj");
  if (cancelled) return { group, dispose: () => disposeUI?.() };
  satellite.traverse((c) => (c instanceof T.Mesh) && upgradeToStandard(T, c));
  satellite.scale.set(0.05, 0.05, 0.05);
  satellite.rotation.set(-0.5, 0.125, 0);
  satellite.position.set(10, -(planetRadius + 3), 0);
  group.add(satellite);

  // --- Astronaut ---
  const astMtl = await MTL(loadingManager).loadAsync("/astronaut/Astronaut.mtl");
  if (cancelled) return { group, dispose: () => disposeUI?.() };
  astMtl.preload();
  const astronaut = await OBJ(loadingManager).setMaterials(astMtl).loadAsync("/astronaut/Astronaut.obj");
  if (cancelled) return { group, dispose: () => disposeUI?.() };
  astronaut.traverse((c) => (c instanceof T.Mesh) && upgradeToStandard(T, c));
  astronaut.rotation.set(1.25, -1, 0);
  astronaut.position.set(10, -(planetRadius + 30), 0);
  group.add(astronaut);

  // --- Idle motion (no rendering here; manager renders) ---
  const yAxis = new T.Vector3(0, 1, 0);
  const spin = 0.015;
  const baseQuat = astronaut.quaternion.clone();
  const basePos  = astronaut.position.clone();
  const offset   = new T.Vector3();
  const targetPos = new T.Vector3();
  const targetEuler = new T.Euler();
  const tumbleQuat  = new T.Quaternion();
  const desiredQuat = new T.Quaternion();

  const driftAmp = 0.35, k = 0.35, sigma = 0.10, maxOffset = driftAmp;
  const rotAmp  = T.MathUtils.degToRad(8);
  const speedX = 0.050, speedY = 0.037, speedZ = 0.031;
  const posSmoothHz = 2.5, rotSmoothHz = 2.0;

  let rx = -0.5, ry = 0.125;
  const ease = 0.1;

  const updater = (dt: number, t: number) => {
    planet.rotateOnAxis(yAxis, spin * dt);

    const sdt = Math.sqrt(dt);
    offset.x += (-k * offset.x) * dt + sigma * sdt * (Math.random() * 2 - 1);
    offset.y += (-k * offset.y) * dt + sigma * sdt * (Math.random() * 2 - 1);
    offset.z += (-k * offset.z) * dt + sigma * sdt * (Math.random() * 2 - 1);
    if (offset.length() > maxOffset) offset.setLength(maxOffset);

    targetPos.copy(basePos).add(offset);
    astronaut.position.lerp(targetPos, 1 - Math.exp(-posSmoothHz * dt));

    targetEuler.set(
      rotAmp * Math.sin(2 * Math.PI * speedX * t),
      rotAmp * Math.sin(2 * Math.PI * speedY * t),
      rotAmp * Math.cos(2 * Math.PI * speedZ * t),
      "XYZ"
    );
    tumbleQuat.setFromEuler(targetEuler);
    desiredQuat.multiplyQuaternions(baseQuat, tumbleQuat);
    astronaut.quaternion.slerp(desiredQuat, 1 - Math.exp(-rotSmoothHz * dt));

    const tx = -0.5 + 0.1 * Math.sin(t * 0.5);
    const ty =  0.125 + 0.1 * Math.cos(t * 0.4);
    rx += (tx - rx) * ease;
    ry += (ty - ry) * ease;
    satellite.rotation.set(rx, ry, 0);

    
   
  };

  const dispose = () => {
    cancelled = true;     // stop async additions
    disposeUI?.();        // <-- abort all page event listeners & observers
    uiText.dispose();
    // (3D objects are disposed by the manager’s disposeObject on the returned group)
  };

  return { group, dispose, updater };
};




export default loadHome;
