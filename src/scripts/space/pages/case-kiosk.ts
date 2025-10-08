// src/space/pages/case-kiosk.ts
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import holographicVertexShader from "@src/shaders/holographic/vertex.glsl";
import holographicFragmentShader from "@src/shaders/holographic/fragment.glsl";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountCaseStudyUI } from "../ui/case-studies";
import { mountTextEffects } from "../ui/text-animator";

const OBJ = (lm: THREE.LoadingManager) => new OBJLoader(lm);

const loadKiosk: PageLoader = async ({
  three: T,
  loadingManager,
}: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  // Holographic material (shared)
  const holoMat = new T.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new T.Color("#70c1ff") },
      uAlpha: { value: 0.35 },
    },
    transparent: false,
    side: T.DoubleSide,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });

  // Load OBJ (laptop)
  const laptop = await OBJ(loadingManager).loadAsync("/laptop/Laptop-2.obj");
  if (cancelled) return { group };

  laptop.traverse((obj) => {
    if (obj instanceof T.Mesh) {
      obj.material = holoMat;
    }
  });

  // Match your original transforms
  laptop.rotation.set(0, 0, 0);
  laptop.scale.set(0.75,0.75, 0.75);
  laptop.position.set(0, 0, 0);
    laptop.position.set( -20, -30, 75);

  group.add(laptop);

  //const ui = await mountCaseStudyUI();
  const uiText = await mountTextEffects();

  // Per-frame updates (manager will call this)
  const updater = (_dt: number, t: number) => {
    holoMat.uniforms.uTime.value = t;
    laptop.rotation.y = t * 0.2;
    // No renderer.render() or camera.lookAt() here; manager handles render.
  };

  const dispose = () => {
    cancelled = true;
    //ui.dispose();
     uiText.dispose();
    // No DOM listeners here. Manager will deep-dispose materials/geo via disposeObject(group).
  };

  return { group, dispose, updater };
};

export default loadKiosk;
