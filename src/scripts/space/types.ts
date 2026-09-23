// src/space/types.ts
import * as THREE from "three";
import type { Assets } from "./assets";
import type { DeviceTier } from "./device";

export type DeferOptions = {
  /** Secondary content: skipped entirely on the "low" tier. */
  optional?: boolean;
};

export type Ctx = {
  three: typeof THREE;
  scene: THREE.Scene;
  parent: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  tier: DeviceTier;
  /** Aborted when the user navigates away before this page finished loading. */
  signal: AbortSignal;
  /** Critical assets: awaited before the page counts as loaded. */
  assets: Assets;
  /**
   * Work that runs after the page's critical content is on screen.
   * Use `assets` (deferred priority) to load and `add` to stream objects in.
   */
  defer: (task: (assets: Assets) => Promise<void>, opts?: DeferOptions) => void;
  /** Upload + compile `obj` without blocking a frame, then add it to `parent` with a reveal. */
  add: (obj: THREE.Object3D, parent: THREE.Object3D) => Promise<void>;
  /** Render a different scene/camera instead of the shared space scene (null = back to space). Reset on unload. */
  setView: (view: View | null) => void;
  /** Read a value the page's DOM script set with `SpaceManager.setParam` (0 when unset). */
  param: (key: string) => number;
};

export type View = { scene: THREE.Scene; camera: THREE.Camera };

export type LoadResult = {
  group: THREE.Group;
  dispose?: () => void;
  updater?: (dt: number, t: number) => void; // never call renderer.render here
};

export type PageLoader = (ctx: Ctx) => Promise<LoadResult> | LoadResult;
