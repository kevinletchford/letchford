// src/space/types.ts
import * as THREE from "three";

export type Ctx = {
  three: typeof THREE;
  scene: THREE.Scene;
  parent: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  textureLoader: THREE.TextureLoader;
  loadingManager: THREE.LoadingManager;
};

export type LoadResult = {
  group: THREE.Group;
  dispose?: () => void;
  updater?: (dt: number, t: number) => void; // never call renderer.render here
};

export type PageLoader = (ctx: Ctx) => Promise<LoadResult> | LoadResult;
