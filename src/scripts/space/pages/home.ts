// src/space/pages/home.ts
import * as THREE from "three";
import marsVertexShader from "@src/shaders/mars/vertex.glsl";
import marsFragmentShader from "@src/shaders/mars/fragment.glsl";

import type { Ctx, LoadResult, PageLoader } from "../types";
// import { mountHomeUI } from "./home-ui"; // uses AbortController internally and returns { dispose }
import { mountTextEffects } from "../ui/text-animator";
import { byTier } from "../device";
import { createHaze, createMarsSurface, type MarsSurface } from "../mars-surface";
import { createMoon } from "../moon";
import { createBeaconMaterial } from "../beacon";
import { createPortals, type Portals } from "../portals";
import { PROJECTS } from "@src/data/projects";

function upgradeToStandard(T: typeof THREE, mesh: THREE.Mesh, map: THREE.Texture) {
  const oldMat = mesh.material as THREE.Material | THREE.Material[] | undefined;
  (Array.isArray(oldMat) ? oldMat : [oldMat]).forEach((m) => m?.dispose?.());

  mesh.material = new T.MeshStandardMaterial({
    map,
    color: 0xffffff,
    emissive: 0x222222,
    roughness: 1,
    metalness: 0,
  });
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const loadHome: PageLoader = async ({ three: T, renderer, camera, tier, signal, assets, defer, add, setView, param }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  // keep planet centered in local group-space; offset the whole scene with the parent transform if needed elsewhere
  const homePosition = new T.Vector3(-10, -30, 50);
  group.position.copy(homePosition);

  let cancelled = false;

  // --- Mount homepage DOM listeners (AbortController inside) ---
  // const { dispose: disposeUI } = mountHomeUI();
  const uiText = await mountTextEffects();

  // --- Textures (critical: the preloader waits for these) ---
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  const isMobile = tier !== "high";

  // Use smaller textures/geometry on mobile to prevent crashes
  const dayPath   = byTier(tier, { high: "/mars/mars.jpg",       mid: "/mars/mars-mobile.jpg" });
  const nightPath = byTier(tier, { high: "/mars/mars-night.jpg", mid: "/mars/mars-night-mobile.jpg" });
  const segs      = isMobile ? 64 : 128;

  const [marsDay, marsNight] = await Promise.all([
    assets.texture(dayPath),
    assets.texture(nightPath),
  ]);

  marsDay.colorSpace = T.SRGBColorSpace;
  marsNight.colorSpace = T.SRGBColorSpace;
  [marsDay, marsNight].forEach((t) => (t.anisotropy = isMobile ? 1 : maxAniso));

  // --- Mars (shader) ---
  const planetRadius = 10;
  const sunDirection = new T.Vector3(-0.4, 0, 0.1);
  const planetGeo = new T.SphereGeometry(planetRadius, segs, segs);
  const planetMat = new T.ShaderMaterial({
    uniforms: {
      uDayTexture: { value: marsDay },
      uNightTexture: { value: marsNight },
      uSpecularTexture: { value: marsDay }, // Reusing day texture for specular as per original
      uSunDirection: { value: sunDirection },
    },
    vertexShader: marsVertexShader,
    fragmentShader: marsFragmentShader,
    lights: false, 
  });
  const planet = new T.Mesh(planetGeo, planetMat);
  planet.rotation.z = T.MathUtils.degToRad(25.19);
  // During the dive this turns the planet so the beacon ends up where the camera lands.
  const planetPivot = new T.Group();
  planetPivot.add(planet);
  group.add(planetPivot);

  // --- Beacon (pulsing marker on the sunlit side facing the camera; the dive lands on it) ---
  const beaconLocal = camera.getWorldPosition(new T.Vector3()).sub(homePosition).normalize()
    .addScaledVector(sunDirection.clone().normalize(), 0.2)
    .add(new T.Vector3(0.15, 0.2, 0))
    .normalize()
    .applyQuaternion(planet.quaternion.clone().invert());
  const beaconGeo = new T.PlaneGeometry(1.4, 1.4);
  const beaconMat = createBeaconMaterial();
  const beacon = new T.Mesh(beaconGeo, beaconMat);
  beacon.position.copy(beaconLocal).multiplyScalar(planetRadius + 0.03);
  beacon.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), beaconLocal);
  beacon.renderOrder = 1;
  planet.add(beacon);

  // --- Atmosphere Halo ---
  let atmoGeo: THREE.SphereGeometry | undefined;
  let atmoMat: THREE.ShaderMaterial | undefined;
  
  if (!isMobile) {
    const atmoRadius = planetRadius * 1.03; // tighter radius based on feedback
    atmoGeo = new T.SphereGeometry(atmoRadius, segs, segs);
    atmoMat = new T.ShaderMaterial({
      uniforms: {
        uColor: { value: new T.Color(0xffddbb) } // very pale, subtle warm tint
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          // vNormal is in view-space, vec3(0,0,1) is towards the camera
          float f = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
          // Very subtle ramp: only barely visible near the edges
          float intensity = smoothstep(0.4, 0.0, f) * smoothstep(0.0, 0.2, f);
          gl_FragColor = vec4(uColor, intensity * 0.3); // much more translucent
        }
      `,
      blending: T.AdditiveBlending,
      side: T.FrontSide, 
      transparent: true,
      depthWrite: false
    });
    const atmosphere = new T.Mesh(atmoGeo, atmoMat);
    group.add(atmosphere);
  }

  // --- Orbit rig ---
  // We separate the tilt (orbital plane) from the orbit rotation so we can set an initial angle easily.
  const tiltPivot = new T.Group();
  const orbitPivot = new T.Group();
  group.add(tiltPivot);
  tiltPivot.add(orbitPivot);

  const orbitAltitude = 3; // distance above the planet surface
  const orbitRadius = planetRadius + orbitAltitude; // total radius from center

  // Tilt the orbital plane a bit for visual interest
  const tiltX = T.MathUtils.degToRad(15);
  const tiltY = T.MathUtils.degToRad(10);
  tiltPivot.rotation.set(tiltX, tiltY, 0);

  // Choose where along the orbit the satellite starts (0 = +X). 180° puts it in front, typically most visible.
  const initialOrbitAngle = T.MathUtils.degToRad(180);
  orbitPivot.rotation.y = initialOrbitAngle;

  // --- Satellite (secondary: streamed in after Mars, dropped on low-tier devices) ---
  let satellite: THREE.Group | null = null;
  defer(async (deferredAssets) => {
    const [obj, map] = await Promise.all([
      deferredAssets.obj("/satellite/Satellite.obj"),
      deferredAssets.texture(byTier(tier, {
        high: "/satellite/Satellite_BaseColor.png",
        mid: "/satellite/Satellite_BaseColor.webp",
      })),
    ]);

    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    obj.traverse((c) => (c instanceof T.Mesh) && upgradeToStandard(T, c, map));

    obj.scale.setScalar(0.05);
    obj.position.set(orbitRadius, 0, 0); // start on +X before we rotate the orbit
    // optional: a subtle local rotation so it isn't perfectly rigid in space
    obj.rotation.set(0, -20, 10);

    await add(obj, orbitPivot);
    satellite = obj;
  }, { optional: true });

  // --- Moon (streamed in after Mars) ---
  // Its own wider, steeper orbit; as a child of the pivot it stays tidally locked to Mars.
  const moonTilt = new T.Group();
  const moonPivot = new T.Group();
  // Starts above-left of Mars (over the headline) and swings round in front of it.
  moonTilt.rotation.set(0, 0, T.MathUtils.degToRad(-35));
  moonPivot.rotation.y = T.MathUtils.degToRad(170);
  moonTilt.add(moonPivot);
  group.add(moonTilt);

  let disposeMoon: (() => void) | null = null;
  defer(async (deferredAssets) => {
    const map = await deferredAssets.texture(byTier(tier, {
      high: "/moon/moon.jpg",
      mid: "/moon/moon-mobile.jpg",
    }));
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = isMobile ? 1 : maxAniso;

    const moon = createMoon(T, map, { radius: 1.0, segments: isMobile ? 48 : 96, sunDirection });
    disposeMoon = moon.dispose;
    moon.mesh.position.set(15, 0, 0);
    await add(moon.mesh, moonPivot);
  });

  // --- Mars surface (the planet dive lands here) ---
  // Scroll drives `marsSurface` 0..1 (see index.astro):
  //   0.00–0.60  the planet flies at the camera until its sunlit side fills the screen
  //   0.38–0.62  a dust haze thickens over it
  //   0.62       cut to the surface scene, still fully hazed
  //   0.62–0.85  the haze clears while the camera drops from altitude
  //   0.62–1.00  camera lands and tilts up to the horizon
  const SWITCH = 0.62;
  const spaceHaze = createHaze();
  group.add(spaceHaze.mesh);

  let surface: MarsSurface | null = null;
  let portals: Portals | null = null;
  defer(async (deferredAssets) => {
    const [built, maps] = await Promise.all([
      createMarsSurface({ tier, pixelRatio: renderer.getPixelRatio(), signal }),
      // Large desktops show the wide hologram; everything else the 4:5 card
      Promise.all(PROJECTS.map((p) => deferredAssets.texture(matchMedia("(min-width: 1024px)").matches ? p.screen : p.image))),
    ]);
    maps.forEach((m) => (m.colorSpace = T.SRGBColorSpace));
    const builtPortals = createPortals({ projects: PROJECTS, maps, heightAt: built.heightAt });
    built.scene.add(builtPortals.group);
    try {
      await renderer.compileAsync(built.scene, built.camera);
    } catch {}
    if (cancelled || signal.aborted) {
      builtPortals.dispose();
      return built.dispose();
    }
    surface = built;
    portals = builtPortals;
  });

  const beaconDir = new T.Vector3();
  const landDir = new T.Vector3();
  const toCam = new T.Vector3();
  const align = new T.Quaternion();
  const noTurn = new T.Quaternion();
  const camPos = new T.Vector3();
  const camFwd = new T.Vector3();
  const camRight = new T.Vector3();
  const size = new T.Vector2();
  let viewingSurface = false;

  const updateDive = (dt: number, t: number) => {
    const v = param("marsSurface");
    if (v <= 0) {
      if (surface) portals?.update(dt, t, 0, surface.camera);
      if (viewingSurface) {
        viewingSurface = false;
        setView(null);
      }
      group.position.copy(homePosition);
      planetPivot.quaternion.identity();
      beaconMat.uniforms.uOpacity.value = 1;
      spaceHaze.set(0);
      return;
    }

    // Park the planet so the camera ends ~0.5 units above its day side, looking down at ~40°.
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camFwd);
    camRight.crossVectors(camFwd, camera.up).normalize();
    const dive = smoothstep(0, 0.6, v);
    group.position.copy(camPos)
      .addScaledVector(camFwd, 0.5 + planetRadius * 0.89)
      .addScaledVector(camRight, planetRadius * 0.45);
    group.position.lerpVectors(homePosition, group.position, dive);

    // Turn the planet so the beacon sits where the view ray meets the surface
    // (or the nearest point of the limb while the planet is still off to the side).
    toCam.subVectors(camPos, group.position);
    const b = toCam.dot(camFwd);
    const disc = b * b - (toCam.lengthSq() - planetRadius * planetRadius);
    landDir.copy(toCam).addScaledVector(camFwd, disc > 0 ? -b - Math.sqrt(disc) : -b).normalize();
    beaconDir.copy(beaconLocal).applyQuaternion(planet.quaternion);
    align.setFromUnitVectors(beaconDir, landDir);
    planetPivot.quaternion.slerpQuaternions(noTurn, align, smoothstep(0, 0.45, v));
    beaconMat.uniforms.uOpacity.value = 1 - smoothstep(0.4, 0.6, v);

    const onSurface = !!surface && v >= SWITCH;
    spaceHaze.set(smoothstep(0.38, SWITCH, v) * (surface ? 1 : 0.5));

    if (onSurface && surface) {
      renderer.getSize(size);
      surface.setAspect(size.x / size.y);
      surface.update(t, smoothstep(SWITCH, 1, v), 1 - smoothstep(SWITCH, 0.85, v), camera.parent);
    }
    if (surface) portals?.update(dt, t, onSurface ? smoothstep(SWITCH, 1, v) : 0, surface.camera);
    if (onSurface !== viewingSurface) {
      viewingSurface = onSurface;
      setView(onSurface && surface ? surface : null);
    }
  };

  // --- Astronaut (kept, cleaned) ---
  
  // --- Idle motion & orbit ---
  const yAxis = new T.Vector3(0, 1, 0);
  const planetSpin = 0.015; // radians/sec multiplier

  // Satellite orbit params
  const orbitSpeed = 0.15; // radians per second around Y after pivot tilts
  const moonOrbitSpeed = 0.04;

  const updater = (dt: number, t: number) => {
    // Planet axial rotation
    planet.rotateOnAxis(yAxis, planetSpin * dt);
    beaconMat.uniforms.uTime.value = t;

    // Satellite orbit (spin the pivot)
    orbitPivot.rotateY(orbitSpeed * dt);

    // Optional: keep satellite oriented tangentially along its orbit
    // Compute tangent by differentiating the pivot rotation around Y (approximate with small step)
    // For simplicity and perf, just add a slow local spin:
    satellite?.rotateZ(0.25 * dt);

    moonPivot.rotateY(moonOrbitSpeed * dt);

    updateDive(dt, t);
  };

  const dispose = () => {
    cancelled = true; // stop async additions
    portals?.dispose();
    portals = null;
    surface?.dispose();
    surface = null;
    disposeMoon?.();
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
    atmoGeo?.dispose();
    atmoMat?.dispose();
    marsDay.dispose();
    marsNight.dispose();
  };

  return { group, dispose, updater };
};

export default loadHome;
