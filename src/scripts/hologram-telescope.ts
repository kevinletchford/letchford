// A telescope on a tripod, drawn with the holographic shader used by the project
// holograms. It turns as its slide scrolls through the viewport, and the tube
// tips up towards the sky as the slide settles. Returns a cleanup function.
import * as THREE from "three";
import { isMobileDevice } from "./space/device";
import vertexShader from "@src/shaders/holographic/vertex.glsl";
import fragmentShader from "@src/shaders/holographic/fragment.glsl";

type Vec3 = [number, number, number];

// One full scroll of the slide past the viewport turns the telescope this far.
const SCROLL_TURN = Math.PI * 1.5;
const START_TURN = -Math.PI * 0.55;
// Tube elevation (radians above horizontal) as the slide arrives and once it's in place.
const TILT_FROM = 0.1;
const TILT_TO = 0.6;

const UP = new THREE.Vector3(0, 1, 0);

// A cylinder (or cone, with two radii) running from a to b.
const strut = (material: THREE.Material, a: Vec3, b: Vec3, radius: number, radiusB = radius, openEnded = false) => {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const direction = to.clone().sub(from);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusB, radius, direction.length(), 32, 1, openEnded),
    material,
  );
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
};

// A ring around the tube's x axis.
const band = (material: THREE.Material, x: number, radius: number, tube = 0.025) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 48), material);
  mesh.position.x = x;
  mesh.rotation.y = Math.PI / 2;
  return mesh;
};

const buildTelescope = (material: THREE.Material) => {
  const telescope = new THREE.Group();

  // Tripod: three splayed legs meeting under the mount, with a spreader tray.
  const apex: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const foot: Vec3 = [Math.cos(angle) * 0.95, -1.75, Math.sin(angle) * 0.95];
    telescope.add(strut(material, apex, foot, 0.045, 0.03));
    const knee: Vec3 = [foot[0] * 0.45, -0.8, foot[2] * 0.45];
    telescope.add(strut(material, [0, -0.8, 0], knee, 0.015));
  }
  telescope.add(strut(material, [0, -0.83, 0], [0, -0.77, 0], 0.16));

  // Mount: a turntable head with a fork the tube pivots in.
  telescope.add(strut(material, [0, 0, 0], [0, 0.18, 0], 0.17, 0.14));
  telescope.add(strut(material, [0, 0.18, -0.24], [0, 0.48, -0.24], 0.04));
  telescope.add(strut(material, [0, 0.18, 0.24], [0, 0.48, 0.24], 0.04));
  telescope.add(strut(material, [0, 0.18, -0.26], [0, 0.18, 0.26], 0.05));

  // The tube points along +x from the pivot; `tube` is what tilts.
  const tube = new THREE.Group();
  tube.position.y = 0.48;
  tube.add(strut(material, [0, 0, -0.26], [0, 0, 0.26], 0.035)); // trunnion
  tube.add(strut(material, [-0.95, 0, 0], [1.25, 0, 0], 0.19, 0.22)); // main tube
  tube.add(strut(material, [1.25, 0, 0], [1.7, 0, 0], 0.25, 0.25, true)); // dew shield
  tube.add(band(material, -0.45, 0.205), band(material, 0.45, 0.215), band(material, 1.25, 0.25));
  // Focuser and a diagonal eyepiece pointing up from the back.
  tube.add(strut(material, [-1.25, 0, 0], [-0.95, 0, 0], 0.08));
  tube.add(strut(material, [-1.25, 0, 0], [-1.25, 0.32, 0], 0.06, 0.07));
  // Finder scope riding on top.
  tube.add(strut(material, [0.1, 0.22, 0], [0.1, 0.32, 0], 0.02));
  tube.add(strut(material, [0.6, 0.22, 0], [0.6, 0.32, 0], 0.02));
  tube.add(strut(material, [-0.05, 0.36, 0], [0.85, 0.36, 0], 0.05, 0.06));
  telescope.add(tube);

  return { telescope, tube };
};

export default function initHologramTelescope(container: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Phones get a lighter context: no MSAA and a lower pixel ratio, so the
  // page's WebGL contexts fit in mobile Safari's memory together.
  const lowPower = isMobileDevice();
  const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.domElement.classList.add("block", "size-full");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.6, 7);
  camera.lookAt(0, -0.1, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: new THREE.Uniform(0),
      uColor: new THREE.Uniform(new THREE.Color("#70c1ff")),
      uAlpha: new THREE.Uniform(0.6),
    },
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const { telescope, tube } = buildTelescope(material);
  telescope.position.y = 0.4;
  scene.add(telescope);

  // How far the container has travelled through the viewport: 0 as its top
  // enters from below, 1 as its bottom leaves the top. Read from the layout
  // every frame so it follows the smoothed scroll.
  const scrollProgress = () => {
    const { top, height } = container.getBoundingClientRect();
    const travel = window.innerHeight + height;
    return Math.min(1, Math.max(0, (window.innerHeight - top) / travel));
  };

  // Eased towards the scroll-driven targets each frame.
  const current = { turn: START_TURN, tilt: TILT_FROM };
  const pose = (t: number, ease: number) => {
    const progress = scrollProgress();
    const turn = START_TURN + progress * SCROLL_TURN;
    // Reaches full elevation by the time the slide is centred.
    const tilt = TILT_FROM + (TILT_TO - TILT_FROM) * THREE.MathUtils.smoothstep(progress, 0.15, 0.5);
    current.turn += (turn - current.turn) * ease;
    current.tilt += (tilt - current.tilt) * ease;

    telescope.rotation.y = current.turn;
    tube.rotation.z = current.tilt;
    telescope.position.y = 0.4 + Math.sin(t * 0.9) * 0.05;
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduceMotion) renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  let visible = false;
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  visibilityObserver.observe(container);

  const clock = new THREE.Clock();
  let raf = 0;
  const render = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (visible) {
      const t = clock.elapsedTime;
      material.uniforms.uTime.value = t;
      pose(t, Math.min(1, dt * 6));
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(render);
  };

  // Reduced motion: a fixed three-quarter view, no turning.
  current.turn = -Math.PI * 0.2;
  current.tilt = TILT_TO;
  telescope.rotation.y = current.turn;
  tube.rotation.z = current.tilt;
  if (reduceMotion) renderer.render(scene, camera);
  else {
    current.turn = START_TURN + scrollProgress() * SCROLL_TURN;
    render();
  }

  container.style.opacity = "1";

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    telescope.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    container.style.opacity = "";
  };
}
