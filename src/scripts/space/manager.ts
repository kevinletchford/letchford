// src/space/manager.ts
import * as THREE from "three";
import { gsap } from "gsap";
import { lazyLoaders } from "./pages";
import type { PageLoader } from "./types";

export class Manager {
  private static _i: Manager | null = null;
  static I() { return (this._i ??= new Manager()); }

  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  world = new THREE.Group();
  pageLayer = new THREE.Group();

  loadingManager = new THREE.LoadingManager();
  textureLoader = new THREE.TextureLoader(this.loadingManager);

  currentKey: string | null = null;
  currentDispose: (() => void) | null = null;

  // Keep a single reference to the current page's updater so we can remove it
  private pageUpdater: ((dt: number, t: number) => void) | null = null;
  private updaters: Array<(dt: number, t: number) => void> = [];

  // Stable WASD/world-rotation updater so we don't add duplicates
  private keys: Record<string, boolean> = {};
  private yaw = 0;
  private pitch = 0;
  private wrUpdater = (dt: number) => this.updateWorldRotation(dt); // <-- stable reference

  init({ canvasId }: { canvasId: string }) {
    if (this.renderer) return;
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) throw new Error("Canvas not found");

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setClearColor(0x000000);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
    this.camera.position.set(-20, -30, 80);



    // Stars background
    const starsTex = this.textureLoader.load("/stars/stars.jpg");
    starsTex.colorSpace = THREE.SRGBColorSpace;
    starsTex.mapping = THREE.EquirectangularReflectionMapping;
    starsTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.scene.background = starsTex;

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(50, 50, 50);
    this.scene.add(dir);

    this.scene.add(this.world);
    this.scene.add(this.pageLayer);

    addEventListener("resize", this.onResize);
    addEventListener("keydown", (e) => (this.keys[e.key.toLowerCase()] = true));
    addEventListener("keyup",   (e) => (this.keys[e.key.toLowerCase()] = false));

    // Add stable world-rotation updater once
    this.addUpdater(this.wrUpdater as any);

    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      for (const u of this.updaters) u(dt, t);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
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
    return "home";
  }

  async loadForPath(path: string) {
    const key = this.routeToKey(path);
    if (key === this.currentKey) return;

        console.log("[manager] unload", this.currentKey);
      console.log("[manager] load", key);
      console.log("[manager] updaters", this.updaters.length);

    // Unload current page *first*
    this.unloadCurrent();

    // Load new page
    const factory = lazyLoaders[key];
    if (factory) {
      const mod = await factory();
      const loader: PageLoader = mod.default;
      const { group, dispose, updater } = await loader({
        three: THREE,
        scene: this.scene,
        parent: this.pageLayer,
        camera: this.camera,
        renderer: this.renderer,
        textureLoader: this.textureLoader,
        loadingManager: this.loadingManager,
      });

      this.pageLayer.add(group);

      // Track this page's updater so we can remove exactly it later
      if (updater) {
        this.pageUpdater = updater;
        this.addUpdater(updater);
      } else {
        this.pageUpdater = null;
      }

      // Compose a disposer we can call centrally on route change
      this.currentDispose = () => {
        try { dispose?.(); } catch {}
        // Kill tweens that might target page objects (optional but useful)
        killTweensDeep(group);
        // Deep dispose geometries/materials/textures and remove from graph
        disposeObject(group);
      };
    }

    this.renderer.compile(this.scene, this.camera);
    this.currentKey = key;
  }

  unloadCurrent() {
    // Remove the page updater from the frame loop
    if (this.pageUpdater) {
      this.removeUpdater(this.pageUpdater);
      this.pageUpdater = null;
    }
    // Call the page's dispose (AbortControllers, observers, timers, etc.)
    if (this.currentDispose) {
      try { this.currentDispose(); } catch {}
      this.currentDispose = null;
    }
    // Ensure the page layer is empty
    this.pageLayer.children.slice().forEach(disposeObject);
    this.pageLayer.clear();
  }

  zoomTo(pos: THREE.Vector3Like, duration = 1, delay = 0) {
    gsap.to(this.camera.position, { x: pos.x, y: pos.y, z: pos.z, duration, delay, ease: "power2.inOut" });
  }
}

export const SpaceManager = {
  init: (o: { canvasId: string }) => Manager.I().init(o),
  loadForPath: (p: string) => Manager.I().loadForPath(p),
  zoomTo: (pos: THREE.Vector3Like, d?: number, delay?: number) => Manager.I().zoomTo(pos, d, delay),
};

/** Kill GSAP tweens on an object tree to avoid lingering animations. */
function killTweensDeep(root: THREE.Object3D) {
  root.traverse(o => {
    try { gsap.killTweensOf(o); } catch {}
    // if you tweened uniforms/positions directly, kill those too:
    if ((o as any).material) {
      const mats = Array.isArray((o as any).material) ? (o as any).material : [(o as any).material];
      mats.forEach(m => {
        try { gsap.killTweensOf(m); } catch {}
        if (m && m.uniforms) {
          Object.values(m.uniforms).forEach((u: any) => { try { gsap.killTweensOf(u); } catch {} });
        }
      });
    }
  });
}

/** Deep-dispose helper: geometries, materials, textures, then remove from parent. */
export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o: any) => {
    if (o.geometry) {
      o.geometry.dispose?.();
      o.geometry = undefined;
    }
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        // dispose common texture slots
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
