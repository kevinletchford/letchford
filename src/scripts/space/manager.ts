import * as THREE from "three";
import { gsap } from "gsap";
import { lazyLoaders } from "./pages";
import type { PageLoader } from "./types";

type InitOpts = { canvasId: string };

class Manager {
  private static _i: Manager | null = null;
  static I() { return (this._i ??= new Manager()); }

  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  clock = new THREE.Clock();
  rafId: number | null = null;

  // Scene graph
  world = new THREE.Group();      // stays forever; you can rotate this if needed
  pageLayer = new THREE.Group();  // per-page disposables live here

  // Loaders
  loadingManager = new THREE.LoadingManager();
  textureLoader = new THREE.TextureLoader(this.loadingManager);

  // State
  currentKey: string | null = null;
  currentDispose: (() => void) | null = null;
  updaters: Array<(dt: number, t: number) => void> = [];

  // Controls (WASD world rotate if you want)
  private keys: Record<string, boolean> = {};
  private yaw = 0;
  private pitch = 0;

  init({ canvasId }: InitOpts) {
    if (this.renderer) return;

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) throw new Error("Canvas not found");

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setClearColor(0x000000);
    this.renderer.debug.checkShaderErrors = true;

    // Scene + Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
    this.camera.position.set(0, -30, 0);

    // Stars background
    const starsTex = this.textureLoader.load("/stars/stars.jpg");
    starsTex.colorSpace = THREE.SRGBColorSpace;
    starsTex.mapping = THREE.EquirectangularReflectionMapping;
    starsTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.scene.background = starsTex;

    // Stable lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(50, 50, 50);
    this.scene.add(dir);

    // Graph roots
    this.scene.add(this.world);
    this.scene.add(this.pageLayer);

    // Events
    addEventListener("resize", this.onResize);
    addEventListener("keydown", (e) => (this.keys[e.key.toLowerCase()] = true));
    addEventListener("keyup",   (e) => (this.keys[e.key.toLowerCase()] = false));

    addEventListener("sectionchange", (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      this.zoomForSection(id);
    });

    // Loop
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      this.update(dt, t);
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private onResize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };

  addUpdater(fn: (dt: number, t: number) => void) { this.updaters.push(fn); }
  update(dt: number, t: number) { for (const u of this.updaters) u(dt, t); }

  private updateWorldRotation(dt: number) {
    const speed = 0.25 * dt;
    if (this.keys["w"]) this.pitch += speed;
    if (this.keys["s"]) this.pitch -= speed;
    if (this.keys["a"]) this.yaw   += speed;
    if (this.keys["d"]) this.yaw   -= speed;
    this.world.rotation.set(this.pitch, this.yaw, 0);
  }

private routeToKey(path: string) {
  // Normalize: keep trailing slash behavior predictable
  const p = path.replace(/\/+/g, "/");
  if (p === "/" || p === "") return "home";
  if (p.startsWith("/case-studies/kiosk/")) return "case-kiosk";
  if (p.startsWith("/case-studies/automation/")) return "case-automation";
  if (p.startsWith("/case-studies/product-tour/")) return "case-product-tour";
  if (p.startsWith("/projects/")) return "projects";
  if (p.startsWith("/contact/")) return "contact";
  return "home"; // fallback
}

async loadForPath(path: string) {
  const key = this.routeToKey(path);
  if (key === this.currentKey) return;

  this.unloadCurrent();

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
    if (updater) this.addUpdater(updater);
    this.currentDispose = () => {
      dispose?.();
      disposeObject(group);
      if (updater) this.updaters = this.updaters.filter(u => u !== updater);
    };
  }

  this.renderer.compile(this.scene, this.camera);
  this.currentKey = key;
}

  unloadCurrent() {
    if (this.currentDispose) this.currentDispose();
    this.currentDispose = null;
    this.pageLayer.children.slice().forEach(disposeObject);
  }

  zoomTo(pos: THREE.Vector3Like, duration = 1, delay = 0) {
    gsap.to(this.camera.position, {
      x: pos.x, y: pos.y, z: pos.z, duration, delay, ease: "power2.inOut",
    });
  }

  private zoomForSection(id: string) {
    switch (id) {
      case "header":     this.zoomTo({ x: 0, y: -30, z: 0 }, 1); break;
      case "skills":     this.zoomTo({ x: 0, y: -20, z: 0 }, 1); break;
      case "experience": this.zoomTo({ x: 0, y: -20, z: 10 }, 1); break;
      case "education":  this.zoomTo({ x: 0, y: -60, z: 10 }, 1); break;
    }
  }
}

export const SpaceManager = {
  init: (opts: InitOpts) => Manager.I().init(opts),
  loadForPath: (p: string) => Manager.I().loadForPath(p),
  zoomTo: (pos: THREE.Vector3Like, d?: number, delay?: number) => Manager.I().zoomTo(pos, d, delay),
};

// Deep-dispose utility
export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o: any) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        m.map?.dispose?.();
        m.lightMap?.dispose?.();
        m.aoMap?.dispose?.();
        m.emissiveMap?.dispose?.();
        m.metalnessMap?.dispose?.();
        m.roughnessMap?.dispose?.();
        m.normalMap?.dispose?.();
        m.displacementMap?.dispose?.();
        if (m.envMap?.dispose) m.envMap.dispose();
        m.dispose?.();
      });
    }
  });
  obj.parent?.remove(obj);
}
