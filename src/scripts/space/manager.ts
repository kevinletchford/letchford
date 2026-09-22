// src/space/manager.ts
import * as THREE from "three";
import gsap from "gsap"; // ✅ you use gsap below, import it explicitly
import { lazyLoaders } from "./pages";
import type { Ctx, PageLoader } from "./types";
import { ShootingStars } from "./shooting-stars";
import { TwinklingStars } from "./twinkling-stars";
import { AssetLoader, AbortError, isAbortError, type Assets } from "./assets";
import { byTier, getDeviceTier, isMobileDevice, type DeviceTier } from "./device";

// (A) Persist the singleton across re-runs/HMR on the window object
declare global {
  interface Window {
    __SpaceManagerInstance?: Manager;      // the singleton instance
    SpaceManager: typeof SpaceManagerAPI; // public facade (optional if you export it elsewhere)
  }
}

export class Manager {
  private static _i: Manager | null = null;
  static I() {
    if (typeof window !== "undefined" && window.__SpaceManagerInstance) {
      this._i = window.__SpaceManagerInstance;
      return this._i;
    }
    this._i ??= new Manager();
    if (typeof window !== "undefined") window.__SpaceManagerInstance = this._i;
    return this._i;
  }

  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  cameraRig = new THREE.Group();
  camera!: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  world = new THREE.Group();
  pageLayer = new THREE.Group();

  tier: DeviceTier = "high";
  assets!: AssetLoader;

  currentKey: string | null = null;
  private session: AbortController | null = null;
  private bootPromise: Promise<void> = Promise.resolve();
  private mountChain: Promise<void> = Promise.resolve();
  currentDispose: (() => void) | null = null;
  shootingStars?: ShootingStars;
  twinklingStars?: TwinklingStars;

  mouse = new THREE.Vector2(0, 0);
  targetMouse = new THREE.Vector2(0, 0);

  private pageUpdater: ((dt: number, t: number) => void) | null = null;
  private updaters: Array<(dt: number, t: number) => void> = [];

  private keys: Record<string, boolean> = {};
  private yaw = 0;
  private pitch = 0;
  private wrUpdater = (dt: number) => this.updateWorldRotation(dt);

  private _ready = false;
  private _readyPromise: Promise<void>;
  private _resolveReady!: () => void;

  constructor() {
    this._readyPromise = new Promise<void>((res) => (this._resolveReady = res));
  }

  whenReady(): Promise<void> { return this._readyPromise; }
  get ready(): boolean { return this._ready; }

  getCamera(): THREE.PerspectiveCamera {
    if (!this.camera) throw new Error("SpaceManager not initialized: camera unavailable");
    return this.camera;
  }
  getScene(): THREE.Scene {
    if (!this.scene) throw new Error("SpaceManager not initialized: scene unavailable");
    return this.scene;
  }
  getRenderer(): THREE.WebGLRenderer {
    if (!this.renderer) throw new Error("SpaceManager not initialized: renderer unavailable");
    return this.renderer;
  }
  getWorld(): THREE.Group { return this.world; }
  getPageLayer(): THREE.Group { return this.pageLayer; }

  onTick(fn: (dt: number, t: number) => void): () => void {
    this.addUpdater(fn);
    return () => this.removeUpdater(fn);
  }

async init({ canvasId }: { canvasId: string }): Promise<void> {
    // If already initialized (HMR/StrictMode), just wait until ready.
    if (this.renderer) return this.whenReady();

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) throw new Error("Canvas not found");

    const isMobile = isMobileDevice();
    this.tier = getDeviceTier();
    this.assets = new AssetLoader(this.tier);
    const lowPower = this.tier !== "high";

    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: !lowPower, 
      powerPreference: lowPower ? "default" : "high-performance" 
    });

    const maxPR = lowPower ? 1 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPR));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setClearColor(0x000000);

    this.scene = new THREE.Scene();

    this.scene.add(this.cameraRig);

    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
    this.cameraRig.add(this.camera);
    // Move the rig instead of the camera directly, so zoomTo can animate the rig
    // or we can animate the camera inside the rig. Let's keep camera animated by GSAP and parallax applied to rig.
    this.camera.position.set(-20, -30, 80);

    // Tracked by the preloader: the first page isn't "loaded" until the sky is in.
    this.bootPromise = this.assets
      .bind(new AbortController().signal)
      .texture(byTier(this.tier, { high: "/stars/stars.jpg", mid: "/stars/stars.webp" }))
      .then((starsTex) => {
        starsTex.colorSpace = THREE.SRGBColorSpace;
        starsTex.mapping = THREE.EquirectangularReflectionMapping;
        starsTex.anisotropy = lowPower ? 1 : (this.renderer.capabilities.getMaxAnisotropy?.() ?? 4);
        this.scene.background = starsTex;
      })
      .catch((e) => console.error("Failed to load star background", e));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(50, 50, 50);
    this.scene.add(dir);

    this.scene.add(this.world);
    this.scene.add(this.pageLayer);

    if (!lowPower) {
      this.shootingStars = new ShootingStars(false);
      this.scene.add(this.shootingStars.mesh);
      
      this.twinklingStars = new TwinklingStars(false);
      this.scene.add(this.twinklingStars.mesh);
    }

    addEventListener("resize", this.onResize);
    
    if (isMobile) {
      // Listen for gyroscope/accelerometer on mobile
      addEventListener("deviceorientation", (e) => {
        if (e.gamma === null || e.beta === null) return;
        // gamma is left/right tilt [-90 to 90]
        // beta is front/back tilt [-180 to 180]
        // Map these roughly to a [-1, 1] range for the existing targetMouse logic
        let x = e.gamma / 45; 
        let y = (e.beta - 45) / 45; // Assume holding phone at a 45 degree angle naturally
        
        // clamp
        this.targetMouse.x = Math.max(-1, Math.min(1, x));
        this.targetMouse.y = Math.max(-1, Math.min(1, y));
      });
    } else {
      // Mouse for desktop
      addEventListener("mousemove", (e) => {
        this.targetMouse.x = (e.clientX / innerWidth) * 2 - 1;
        this.targetMouse.y = -(e.clientY / innerHeight) * 2 + 1;
      });
    }
    addEventListener("keydown", (e) => (this.keys[e.key.toLowerCase()] = true));
    addEventListener("keyup",   (e) => (this.keys[e.key.toLowerCase()] = false));

    this.addUpdater(this.wrUpdater as any);

    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      
      // Frame-rate independent smoothing factor
      const lerpFactor = 1.0 - Math.exp(-3.0 * dt);
      
      this.mouse.lerp(this.targetMouse, lerpFactor);

      // Parallax & Breathing
      const targetRigX = this.mouse.x * 2.5; // parallax range
      const targetRigY = this.mouse.y * 2.5;
      
      // Breathing effect (slower and softer)
      const breatheX = Math.sin(t * 0.3) * 0.4;
      const breatheY = Math.cos(t * 0.25) * 0.4;

      // Apply to rig with smoothing
      this.cameraRig.position.x = THREE.MathUtils.lerp(this.cameraRig.position.x, targetRigX + breatheX, lerpFactor * 2.0);
      this.cameraRig.position.y = THREE.MathUtils.lerp(this.cameraRig.position.y, targetRigY + breatheY, lerpFactor * 2.0);
      
      // Slight rotation parallax
      const targetRotY = -this.mouse.x * 0.02;
      const targetRotX = this.mouse.y * 0.02;
      this.cameraRig.rotation.y = THREE.MathUtils.lerp(this.cameraRig.rotation.y, targetRotY, lerpFactor * 2.0);
      this.cameraRig.rotation.x = THREE.MathUtils.lerp(this.cameraRig.rotation.x, targetRotX, lerpFactor * 2.0);

      for (const u of this.updaters) u(dt, t);
      
      if (!lowPower) {
        this.shootingStars?.update(dt);
        this.twinklingStars?.update(t);
      }
      
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();

    this._ready = true;
    this._resolveReady?.();

    // Always return a stable promise so callers can await safely.
    return this.whenReady();
  }

  private onResize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };

  private updateWorldRotation(dt: number) {
    const speed = 0.25 * dt;
    if (this.keys["w"]) this.pitch += speed;
    if (this.keys["s"]) this.pitch -= speed;
    if (this.keys["a"]) this.yaw   += speed;
    if (this.keys["d"]) this.yaw   -= speed;
    this.world.rotation.set(this.pitch, this.yaw, 0);
  }

  private addUpdater(fn: (dt: number, t: number) => void) {
    if (!this.updaters.includes(fn)) this.updaters.push(fn);
  }
  private removeUpdater(fn: (dt: number, t: number) => void) {
    this.updaters = this.updaters.filter(u => u !== fn);
  }

  routeToKey(path: string) {
    const p = path.replace(/\/+/g, "/");
    if (p === "/" || p === "") return "home";
    if (p.startsWith("/case-studies/kiosk/")) return "case-kiosk";
    if (p.startsWith("/case-studies/automation/")) return "case-automation";
    if (p.startsWith("/case-studies/product-tour/")) return "case-product-tour";
    if (p.startsWith("/projects/")) return "projects";
    if (p.startsWith("/contact/")) return "contact";
    return "";
  }

  async loadForPath(path: string) {
    const key = this.routeToKey(path);
    if (key === this.currentKey) return;

    // Cancel anything the previous navigation was still loading, so a slow page
    // can't add its objects on top of the page we've moved to.
    this.session?.abort();
    const session = new AbortController();
    this.session = session;

    this.unloadCurrent();
    this.currentKey = key;

    try {
      const factory = lazyLoaders[key];
      if (factory) await this.mountPage(factory, session.signal);
      await this.bootPromise;
    } catch (e) {
      if (isAbortError(e)) return;
      if (this.session === session) this.currentKey = null; // allow a retry
      throw e;
    }
  }

  private async mountPage(factory: () => Promise<{ default: PageLoader }>, signal: AbortSignal) {
    const mod = await factory();
    if (signal.aborted) throw new AbortError();

    const deferred: Array<(assets: Assets) => Promise<void>> = [];
    const ctx: Ctx = {
      three: THREE,
      scene: this.scene,
      parent: this.pageLayer,
      camera: this.camera,
      renderer: this.renderer,
      tier: this.tier,
      signal,
      assets: this.assets.bind(signal, "critical"),
      defer: (task, opts) => {
        if (opts?.optional && this.tier === "low") return;
        deferred.push(task);
      },
      add: (obj, parent) => this.mount(obj, parent, signal),
    };

    const { group, dispose, updater } = await mod.default(ctx);
    const teardown = () => {
      try { dispose?.(); } catch {}
      killTweensDeep(group);
      disposeObject(group);
    };
    if (signal.aborted) {
      teardown();
      throw new AbortError();
    }

    this.currentDispose = teardown;
    if (updater) {
      this.pageUpdater = updater;
      this.addUpdater(updater);
    }

    // Stream the page's objects in one by one rather than uploading everything in a single frame.
    const children = group.children.slice();
    group.clear();
    this.pageLayer.add(group);
    await Promise.all(children.map((c) => this.assets.track(this.mount(c, group, signal))));

    this.runDeferred(deferred, signal);
  }

  private runDeferred(tasks: Array<(assets: Assets) => Promise<void>>, signal: AbortSignal) {
    if (!tasks.length) return;
    const assets = this.assets.bind(signal, "deferred");
    const start = () => {
      if (signal.aborted) return;
      for (const task of tasks) {
        task(assets).catch((e) => {
          if (!isAbortError(e)) console.error("Deferred page task failed", e);
        });
      }
    };
    if (this.tier === "high") start();
    else whenIdle(start);
  }

  /**
   * Upload textures and compile shaders for `obj` off the critical frame, then add it.
   * Mounts are serialised; on low-power tiers each GPU upload gets its own frame.
   */
  private mount(obj: THREE.Object3D, parent: THREE.Object3D, signal: AbortSignal): Promise<void> {
    const throttle = this.tier !== "high";
    const run = async () => {
      if (signal.aborted) return disposeObject(obj);

      for (const tex of collectTextures(obj)) {
        this.renderer.initTexture(tex);
        if (throttle) {
          await nextFrame();
          if (signal.aborted) return disposeObject(obj);
        }
      }

      try {
        // Never let a stalled compile block every later mount.
        await Promise.race([
          this.renderer.compileAsync(obj, this.camera, this.scene),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      } catch {}
      if (signal.aborted) return disposeObject(obj);

      parent.add(obj);
      reveal(obj);
      if (throttle) await nextFrame();
    };

    const next = this.mountChain.then(run, run);
    this.mountChain = next.catch(() => {});
    return next;
  }

  unloadCurrent() {
    if (this.pageUpdater) {
      this.removeUpdater(this.pageUpdater);
      this.pageUpdater = null;
    }
    // Take the old page off screen now, but free its GPU resources only once any
    // in-flight mount has settled: disposing a material mid-compileAsync throws inside three.
    const teardown = this.currentDispose;
    const leftovers = this.pageLayer.children.slice();
    this.currentDispose = null;
    this.pageLayer.clear();
    this.mountChain.then(() => {
      try { teardown?.(); } catch {}
      leftovers.forEach(disposeObject);
    });
  }

  zoomTo(pos: THREE.Vector3Like, duration = 1, delay = 0) {
    gsap.to(this.camera.position, { x: pos.x, y: pos.y, z: pos.z, duration, delay, ease: "power2.inOut" });
  }
}

// (B) A small facade that’s easy to expose globally
export const SpaceManagerAPI = {
  init: (o: { canvasId: string }) => Manager.I().init(o), // now returns Promise<void>
  loadForPath: (p: string) => Manager.I().loadForPath(p),
  zoomTo: (pos: THREE.Vector3Like, d?: number, delay?: number) => Manager.I().zoomTo(pos, d, delay),
  getCamera: () => Manager.I().getCamera(),
  getScene: () => Manager.I().getScene(),
  getRenderer: () => Manager.I().getRenderer(),
  getWorld: () => Manager.I().getWorld(),
  getPageLayer: () => Manager.I().getPageLayer(),
  whenReady: () => Manager.I().whenReady(),
  onTick: (fn: (dt: number, t: number) => void) => Manager.I().onTick(fn),
};

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function whenIdle(fn: () => void) {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(fn, 200);
}

function forEachMaterial(root: THREE.Object3D, fn: (m: THREE.Material) => void) {
  const seen = new Set<THREE.Material>();
  root.traverse((o: any) => {
    if (!o.material) return;
    const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!seen.has(m)) { seen.add(m); fn(m); }
    });
  });
}

/** Every texture referenced by materials (plain map slots and shader uniforms). */
function collectTextures(root: THREE.Object3D): THREE.Texture[] {
  const out = new Set<THREE.Texture>();
  forEachMaterial(root, (m: any) => {
    for (const v of Object.values(m)) if ((v as any)?.isTexture) out.add(v as THREE.Texture);
    if (m.uniforms) {
      for (const u of Object.values(m.uniforms) as any[]) if (u?.value?.isTexture) out.add(u.value);
    }
  });
  return [...out];
}

/** Fade in via uAlpha/opacity where the material supports it, otherwise scale in. */
function reveal(obj: THREE.Object3D) {
  const fades: Array<{ target: any; key: "value" | "opacity"; to: number }> = [];
  forEachMaterial(obj, (m: any) => {
    const uAlpha = m.uniforms?.uAlpha;
    // Remember the resting value so a reveal mid-way through another can't lock in a low alpha.
    if (uAlpha) fades.push({ target: uAlpha, key: "value", to: (m.userData.revealTo ??= uAlpha.value) });
    else if (m.transparent && !m.isShaderMaterial) fades.push({ target: m, key: "opacity", to: (m.userData.revealTo ??= m.opacity) });
  });

  if (fades.length) {
    for (const f of fades) {
      f.target[f.key] = 0;
      gsap.to(f.target, { [f.key]: f.to, duration: 0.8, ease: "power2.out" });
    }
  } else {
    const s = obj.scale.clone();
    obj.scale.setScalar(0.0001);
    gsap.to(obj.scale, { x: s.x, y: s.y, z: s.z, duration: 1.2, ease: "expo.out" });
  }
}

/** Kill GSAP tweens on an object tree to avoid lingering animations. */
function killTweensDeep(root: THREE.Object3D) {
  root.traverse(o => {
    try { gsap.killTweensOf(o); gsap.killTweensOf(o.scale); } catch {}
    const any = o as any;
    if (any.material) {
      const mats = Array.isArray(any.material) ? any.material : [any.material];
      mats.forEach((m: any) => {
        try { gsap.killTweensOf(m); } catch {}
        if (m?.uniforms) {
          Object.values(m.uniforms).forEach((u: any) => { try { gsap.killTweensOf(u); } catch {} });
        }
      });
    }
  });
}

/** Deep-dispose helper: geometries, materials, textures, then remove from parent. */
export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o: any) => {
    if (o.geometry) { o.geometry.dispose?.(); o.geometry = undefined; }
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => {
        ["map","lightMap","aoMap","emissiveMap","metalnessMap","roughnessMap",
         "normalMap","bumpMap","displacementMap","alphaMap","envMap"]
          .forEach((k) => m?.[k]?.dispose?.());
        m.dispose?.();
      });
      o.material = undefined;
    }
  });
  obj.parent?.remove(obj);
}
