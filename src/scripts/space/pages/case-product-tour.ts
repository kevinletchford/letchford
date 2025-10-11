// src/space/pages/case-product-tour.ts
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import holographicVertexShader from "@src/shaders/holographic/vertex.glsl";
import holographicFragmentShader from "@src/shaders/holographic/fragment.glsl";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";

const GLTF = (lm: THREE.LoadingManager) => new GLTFLoader(lm);

const loadProductTour: PageLoader = async ({
  three: T,
  loadingManager,
}: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  // Holographic material (shared across meshes)
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

  // Load the GLTF (rocket/tablet)
  const gltf = await GLTF(loadingManager).loadAsync("/rocket/Rocket.glb");
  if (cancelled) return { group };

  const tablet = gltf.scene;
  tablet.traverse((obj) => {
    if (obj instanceof T.Mesh) {
      // assign holographic material to every mesh
      obj.material = holoMat;
    }
  });

  // Transform like your original snippet
  tablet.rotation.set(0, 0, 0);
  tablet.scale.set(1.25,1.25, 1.25);
  tablet.position.set(0, 0, 0);
  tablet.position.set( -20, -30, 75);

  group.add(tablet);

    // const ui = await mountCaseStudyUI();
  const uiText = await mountTextEffects();
  // Per-frame updater (manager will call this)
  const updater = (dt: number, t: number) => {
    holoMat.uniforms.uTime.value = t;
    tablet.rotation.y = t * 0.2;
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadProductTour;
