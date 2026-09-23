// src/space/portals.ts
// The project hologram on the Mars surface: one large hologram rising from the beacon, switched
// by hovering or picking a project in the list. Picking the hologram flies the camera through it
// to the project. The icons and the hologram's hit area/title are real elements in #portal-layer
// (index.astro); the hit area is positioned over the hologram every frame.
import * as THREE from "three";
import gsap from "gsap";
import { navigate } from "astro:transitions/client";
import { BEACON } from "./mars-surface";
import type { Project } from "@src/data/projects";

const COLOR = 0x6ff3ff;
const CARD = { w: 2.4, h: 3 }; // hologram size on narrower screens (4:5)
const CINEMA = 1.85; // aspect ratio of the wide hologram on large desktops
const MARGIN = 0.35; // extra plane around the content, for the glow (world units)
const HOVER_Y = 0.7; // gap between the beacon and the bottom of the hologram
const EYE = 1.7; // surface camera height once landed
const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(25)); // surface camera: 50° vertical fov

const holoVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const holoFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uHover;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uSeed;
  uniform vec2 uSize;      // content size (world units)
  uniform vec2 uPlane;     // plane size, content + margin
  uniform float uImgAspect;
  varying vec2 vUv;

  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 p = (vUv - 0.5) * uPlane;
    vec2 cuv = p / uSize + 0.5;
    // Cover-fit the image: crop the sides, or the bottom (keeping the top of the screenshot)
    float r = (uSize.x / uSize.y) / uImgAspect;
    if (r > 1.0) cuv.y = 1.0 - (1.0 - cuv.y) / r;
    else cuv.x = (cuv.x - 0.5) * r + 0.5;

    // Materialise bottom-up behind a bright scan line
    float front = uReveal * 1.3 - 0.15;
    if (vUv.y > front + 0.03) discard;
    float scanFront = (1.0 - smoothstep(0.0, 0.03, abs(vUv.y - front))) * (1.0 - step(0.999, uReveal));

    // Occasional horizontal tearing, calmer while hovered
    float row = floor(p.y * 16.0);
    float tear = step(0.975 + uHover * 0.02, hash(row + floor(uTime * 10.0) + uSeed * 17.0));
    cuv.x += tear * (hash(row * 1.7 + uSeed) - 0.5) * 0.05;

    vec3 img = texture2D(uMap, clamp(cuv, 0.0, 1.0)).rgb;
    float lum = dot(img, vec3(0.299, 0.587, 0.114));
    // Dark glass backing so the hologram reads against the bright sky
    vec3 holo = vec3(0.01, 0.06, 0.08) + uColor * lum * 1.6;
    vec3 col = mix(holo, img * 1.15 + uColor * 0.05, 0.4 + 0.5 * uHover);

    float scan = 0.8 + 0.2 * sin(p.y * 130.0 - uTime * 5.0);
    float band = exp(-pow((fract(uTime * 0.11 + uSeed) * 1.6 - 0.3 - cuv.y) * 10.0, 2.0));
    col = col * scan + uColor * band * 0.3;

    float d = sdBox(p, uSize * 0.5, 0.07);
    float inside = 1.0 - smoothstep(0.0, 0.01, d);
    float border = exp(-abs(d) * 55.0);
    float glow = exp(-max(d, 0.0) * 8.0) * (1.0 - inside);
    float flicker = 0.93 + 0.07 * step(0.5, hash(floor(uTime * 9.0) + uSeed));

    float a = inside * (0.72 + 0.23 * uHover) * scan
            + border * (0.7 + 0.3 * uHover)
            + glow * (0.2 + 0.4 * uHover);
    vec3 c = col * inside + uColor * (border * 1.6 + glow);
    c += uColor * scanFront * 2.0;
    a = max(a, scanFront);

    gl_FragColor = vec4(c, clamp(a * flicker * uOpacity, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

const beamVert = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float a = pow(vFacing, 2.0) * mix(0.35, 0.05, vUv.y);
    a *= 0.75 + 0.25 * sin(vUv.y * 26.0 - uTime * 3.0);
    gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
    #include <colorspace_fragment>
  }
`;

export type Portals = {
  group: THREE.Group;
  /** k: how far the surface camera has landed (0..1); the hologram appears once it's down. */
  update: (dt: number, t: number, k: number, camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
};

export function createPortals(opts: {
  projects: Project[];
  maps: THREE.Texture[];
  heightAt: (x: number, z: number) => number;
}): Portals {
  const { projects, maps, heightAt } = opts;
  const group = new THREE.Group();
  const controller = new AbortController();
  const { signal } = controller;

  const layer = document.querySelector<HTMLElement>("#portal-layer");
  const link = layer?.querySelector<HTMLAnchorElement>("[data-portal-main]") ?? null;
  const title = layer?.querySelector<HTMLElement>("[data-portal-title]") ?? null;
  const blurb = layer?.querySelector<HTMLElement>("[data-portal-blurb]") ?? null;
  const picks = projects.map((p) => layer?.querySelector<HTMLButtonElement>(`[data-portal-pick="${p.key}"]`) ?? null);

  // --- Hologram + the light beam feeding it from the beacon ---
  const color = new THREE.Color(COLOR);
  const ground = heightAt(BEACON.x, BEACON.z);
  const eyeY = heightAt(0, 0) + EYE;
  const distance = Math.abs(BEACON.z); // landing spot to hologram
  const list = layer?.querySelector<HTMLElement>("[data-portal-list]") ?? null;
  const holoSize = new THREE.Vector2(CARD.w, CARD.h);
  const planeSize = new THREE.Vector2();
  let baseY = ground + HOVER_Y + CARD.h / 2;
  let lift = 0; // how far the landed camera rises to look at the hologram level
  let shift = 0; // how far the landed camera slides left so the hologram clears the project list

  const aspectOf = (m: THREE.Texture) => {
    const img = m.image as { width?: number; height?: number } | undefined;
    return img?.width && img.height ? img.width / img.height : 16 / 9;
  };

  const holoGeo = new THREE.PlaneGeometry(1, 1);
  const holoMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: maps[0] },
      uColor: { value: color },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 1 },
      uSeed: { value: 0 },
      uSize: { value: holoSize },
      uPlane: { value: planeSize },
      uImgAspect: { value: aspectOf(maps[0]) },
    },
    vertexShader: holoVert,
    fragmentShader: holoFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const holo = new THREE.Mesh(holoGeo, holoMat);
  holo.renderOrder = 3;
  holo.position.set(BEACON.x, baseY, BEACON.z);
  holo.lookAt(0, baseY, 0);

  const beamGeo = new THREE.CylinderGeometry(CARD.w * 0.45, BEACON.size * 0.18, 1, 40, 1, true).translate(0, 0.5, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: beamVert,
    fragmentShader: beamFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.renderOrder = 2;
  beam.position.set(BEACON.x, ground + 0.05, BEACON.z);
  beam.scale.y = HOVER_Y + 0.1;
  group.add(beam, holo);

  // --- Selection: the hologram scans out, swaps project, and builds back up ---
  let current = 0;
  let switching: gsap.core.Timeline | null = null;
  let reveal = 0; // the landing reveal; the switch transition multiplies into it
  const swap = { v: 1 };

  const showDetails = (i: number) => {
    const p = projects[i];
    if (link) {
      link.href = p.href;
      link.setAttribute("aria-label", `Enter ${p.title}`);
    }
    if (title) title.textContent = p.title;
    if (blurb) blurb.textContent = p.blurb;
    picks.forEach((b, j) => b?.setAttribute("aria-pressed", String(j === i)));
  };

  const select = (i: number) => {
    if (i === current || entering) return;
    current = i;
    showDetails(i);
    switching?.kill();
    switching = gsap.timeline()
      .to(swap, { v: 0, duration: 0.22, ease: "power1.in" })
      .add(() => {
        holoMat.uniforms.uMap.value = maps[i];
        holoMat.uniforms.uImgAspect.value = aspectOf(maps[i]);
      })
      .to(swap, { v: 1, duration: 0.7, ease: "power2.out" });
  };

  // --- Entering: fly through the hologram, flash, then go to the project ---
  let entering = false;
  const enterState = { e: 0 };
  let flash: HTMLDivElement | null = null;

  const removeFlash = () => {
    const f = flash;
    flash = null;
    if (!f) return;
    gsap.to(f, { opacity: 0, duration: 0.5, onComplete: () => f.remove() });
  };
  const reset = () => {
    entering = false;
    enterState.e = 0;
    removeFlash();
  };

  const enter = () => {
    if (entering) return;
    entering = true;
    const href = projects[current].href;
    flash = document.createElement("div");
    flash.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;opacity:0;" +
      "background:radial-gradient(circle at 50% 50%, #e8fdff 0%, #6ff3ff 45%, #0b3a44 100%)";
    document.body.appendChild(flash);
    gsap.timeline()
      .to(enterState, { e: 1, duration: 1.3, ease: "power2.in" })
      .to(flash, { opacity: 1, duration: 0.35, ease: "power1.in" }, 0.95)
      .add(() => {
        if (/^https?:\/\//.test(href)) window.location.assign(href);
        else navigate(href);
      });
  };

  let hovered = false;
  if (link) {
    const on = () => (hovered = true);
    const off = () => (hovered = false);
    link.addEventListener("pointerenter", on, { signal });
    link.addEventListener("pointerleave", off, { signal });
    link.addEventListener("focus", on, { signal });
    link.addEventListener("blur", off, { signal });
    link.addEventListener("click", (e) => {
      // Let modified clicks open a new tab as usual
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      enter();
    }, { signal });
  }
  // Hovering (or focusing) a project brings it up; a short delay stops a quick sweep
  // down the list from flicking through every one.
  let hoverTimer = 0;
  picks.forEach((b, i) => {
    b?.addEventListener("click", () => select(i), { signal });
    b?.addEventListener("focus", () => select(i), { signal });
    b?.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => select(i), 90);
    }, { signal });
    b?.addEventListener("pointerleave", () => clearTimeout(hoverTimer), { signal });
    // Arrow keys move along the list
    b?.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = (i + step + picks.length) % picks.length;
      picks[next]?.focus(); // focusing selects it
    }, { signal });
  });
  showDetails(current);

  // Coming back with the browser's back button can restore this page from the bfcache
  window.addEventListener("pageshow", (e) => e.persisted && reset(), { signal });
  document.addEventListener("astro:after-swap", removeFlash, { signal });

  // --- Per-frame ---
  let shownTime = 0;
  let hover = 0;
  const corner = new THREE.Vector3();
  const basePos = new THREE.Vector3();
  const baseQuat = new THREE.Quaternion();
  const lookQuat = new THREE.Quaternion();
  const through = new THREE.Vector3();
  const lookM = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);

  const setLayerVisible = (v: boolean) => {
    if (!layer) return;
    if (layer.inert !== !v) layer.inert = !v;
    layer.style.visibility = v ? "visible" : "hidden";
    layer.style.opacity = v ? "1" : "0";
  };
  setLayerVisible(false);

  // --- Sizing: a wide, cinematic screen on large desktops, a 4:5 card on smaller screens ---
  let laidOutAspect = 0;
  let laidOutWidth = 0;
  const relayout = (aspect: number) => {
    laidOutAspect = aspect;
    laidOutWidth = innerWidth;
    const viewW = 2 * distance * FOV_TAN * aspect; // visible width at the hologram
    const cinema = innerWidth >= 1024 && aspect >= 1.15;
    if (cinema) {
      // Centre it in the space right of the project list
      const listRight = list ? list.getBoundingClientRect().right + 24 : 0;
      const free = 1 - listRight / innerWidth;
      const w = Math.min(viewW * 0.55, viewW * free * 0.9, 9.5);
      holoSize.set(w, w / CINEMA);
      shift = (viewW * (1 - free)) / 2;
    } else {
      const s = aspect >= 1.15 ? 1.25 : THREE.MathUtils.clamp(aspect * 1.6, 0.75, 1);
      holoSize.set(CARD.w * s, CARD.h * s);
      shift = 0;
    }
    planeSize.set(holoSize.x + MARGIN * 2, holoSize.y + MARGIN * 2);
    baseY = ground + HOVER_Y + holoSize.y / 2;
    // Wide screens look at it level, then a touch higher so it sits just below centre
    // (narrow screens keep the eye low so the hologram sits higher, above the project icons)
    lift = aspect >= 1.15 ? Math.max(0, baseY - eyeY + distance * FOV_TAN * 0.14) : 0;
    beam.scale.set(holoSize.x / CARD.w, 1, Math.min(1, holoSize.y / CARD.h));
    beam.scale.y = HOVER_Y + 0.1;
  };

  const update: Portals["update"] = (dt, t, k, camera) => {
    if (camera.aspect !== laidOutAspect || innerWidth !== laidOutWidth) relayout(camera.aspect);
    camera.position.x -= shift * k * k;
    camera.position.y += lift * k * k;

    const landed = k > 0.9;
    shownTime = landed ? shownTime + dt : Math.max(0, shownTime - dt * 4);
    const layerOn = landed && shownTime > 0.5;
    setLayerVisible(layerOn);
    group.visible = shownTime > 0;
    reveal = Math.min(1, shownTime / 1.1);

    if (entering) {
      basePos.copy(camera.position);
      baseQuat.copy(camera.quaternion);
      through.set(0, 0, -0.6).applyMatrix4(holo.matrixWorld); // just behind the hologram
      lookM.lookAt(basePos, holo.position, up);
      lookQuat.setFromRotationMatrix(lookM);
      camera.position.lerpVectors(basePos, through, enterState.e);
      camera.quaternion.slerpQuaternions(baseQuat, lookQuat, Math.min(1, enterState.e * 2.5));
    }
    camera.updateMatrixWorld();

    hover += ((hovered || entering ? 1 : 0) - hover) * (1 - Math.exp(-8 * dt));
    const u = holoMat.uniforms;
    u.uTime.value = t;
    u.uHover.value = hover;
    u.uReveal.value = reveal * swap.v;
    beamMat.uniforms.uTime.value = t;
    beamMat.uniforms.uOpacity.value = reveal * (0.6 + 0.4 * swap.v) * (0.8 + 0.4 * hover);

    holo.position.y = baseY + Math.sin(t * 0.8) * 0.05;
    holo.scale.set(planeSize.x, planeSize.y, 1).multiplyScalar(1 + hover * 0.04);
    holo.updateMatrixWorld();

    // Keep the hologram's link over its on-screen bounds
    if (!link || !layerOn) return;
    const w = innerWidth, h = innerHeight;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      corner.set((cx * holoSize.x) / planeSize.x / 2, (cy * holoSize.y) / planeSize.y / 2, 0)
        .applyMatrix4(holo.matrixWorld).project(camera);
      const sx = ((corner.x + 1) / 2) * w, sy = ((1 - corner.y) / 2) * h;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    link.style.transform = `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)`;
    link.style.width = `${(x1 - x0).toFixed(1)}px`;
    link.style.height = `${(y1 - y0).toFixed(1)}px`;
  };

  const dispose = () => {
    controller.abort();
    clearTimeout(hoverTimer);
    switching?.kill();
    setLayerVisible(false);
    removeFlash();
    holoGeo.dispose();
    holoMat.dispose();
    beamGeo.dispose();
    beamMat.dispose();
    maps.forEach((m) => m.dispose());
  };

  return { group, update, dispose };
}
