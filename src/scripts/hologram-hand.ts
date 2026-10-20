// A waving hand in the shape of the 👋 emoji, drawn with the holographic shader
// used by the project holograms. The hand is one smooth surface: a signed
// distance field of soft-blended capsules, meshed once with marching cubes.
// Returns a cleanup function.
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import vertexShader from "@src/shaders/holographic/vertex.glsl";
import fragmentShader from "@src/shaders/holographic/fragment.glsl";

type Vec3 = [number, number, number];

// Hand units: palm towards the camera, y up, thumb on the viewer's left.
// The field is sampled mirrored so the thumb ends up on the right, as in 👋.
const PALM = { center: [0, -0.15, 0] as Vec3, radii: [0.66, 0.66, 0.3] as Vec3 };
const DIGITS: { from: Vec3; to: Vec3; radius: number }[] = [
  { from: [-0.45, 0.3, 0], to: [-0.6, 1.12, 0.06], radius: 0.16 }, // index
  { from: [-0.15, 0.35, 0], to: [-0.2, 1.3, 0.06], radius: 0.165 }, // middle
  { from: [0.15, 0.32, 0], to: [0.2, 1.2, 0.06], radius: 0.16 }, // ring
  { from: [0.44, 0.22, 0], to: [0.56, 0.95, 0.06], radius: 0.145 }, // pinky
  { from: [-0.45, -0.35, 0.06], to: [-1.0, 0.12, 0.14], radius: 0.19 }, // thumb
];

const EXTENT = 1.6; // half-size of the meshed volume, in hand units
const RESOLUTION = 80;
const WRIST_PIVOT = -0.7; // hand-unit height the wave swings around (base of the palm)

// Waving is driven by shaking the pointer side to side: each change of direction
// after at least SHAKE_TRAVEL px adds energy, which dies away over about a second.
const SHAKE_TRAVEL = 30;
const SHAKE_KICK = 0.45;
const WAVE_DECAY = 1.6; // per second
const WAVE_SPEED = Math.PI * 3.4; // radians of swing phase per second

// While the hand is waving, the cursor becomes a 👋 too.
const WAVE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text x='2' y='26' font-size='26'>👋</text></svg>",
)}") 16 16, grab`;

const capsule = (x: number, y: number, z: number, a: Vec3, b: Vec3, r: number) => {
  const pax = x - a[0], pay = y - a[1], paz = z - a[2];
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
};

const ellipsoid = (x: number, y: number, z: number, c: Vec3, r: Vec3) =>
  (Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]) - 1) * Math.min(...r);

// Polynomial smooth minimum: blends two surfaces over a band of width k.
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

const handDistance = (x: number, y: number, z: number) => {
  // Fingers only just melt into each other, so the gaps between them still read.
  let fingers = Infinity;
  for (const { from, to, radius } of DIGITS) {
    fingers = smin(fingers, capsule(x, y, z, from, to, radius), 0.05);
  }
  return smin(ellipsoid(x, y, z, PALM.center, PALM.radii), fingers, 0.18);
};

export default function initHologramHand(container: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.classList.add("block", "size-full");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: new THREE.Uniform(0),
      uColor: new THREE.Uniform(new THREE.Color("#70c1ff")),
      uAlpha: new THREE.Uniform(0.6),
    },
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Mesh the distance field once. MarchingCubes treats field > isolation as inside
  // and spans [-1, 1] locally, so sample at EXTENT and scale the mesh back up.
  const surface = new MarchingCubes(RESOLUTION, material, false, false, 60000);
  surface.isolation = 0;
  const { size, halfsize, field } = surface;
  for (let k = 0; k < size; k++) {
    const z = ((k - halfsize) / halfsize) * EXTENT;
    for (let j = 0; j < size; j++) {
      const y = ((j - halfsize) / halfsize) * EXTENT;
      for (let i = 0; i < size; i++) {
        const x = ((i - halfsize) / halfsize) * EXTENT;
        field[i + j * size + k * size * size] = -handDistance(-x, y, z);
      }
    }
  }
  surface.update();
  surface.scale.setScalar(EXTENT);
  surface.position.y = -WRIST_PIVOT;

  // The wrist group (base of the palm) is the pivot the hand waves around.
  const hand = new THREE.Group();
  const wrist = new THREE.Group();
  wrist.add(surface);
  hand.add(wrist);
  // Lean the fingers up and to the left like the emoji, shifted right to stay centred.
  hand.position.set(0.35, -0.7, 0);
  scene.add(hand);

  // Pointer tilt, eased towards each frame.
  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  const shake = { lastX: NaN, direction: 0, travel: 0, energy: 0 };
  const wave = { phase: 0, amount: 0 };
  const onPointerMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;

    const dx = e.clientX - shake.lastX;
    shake.lastX = e.clientX;
    if (!dx || !onIntro) return;
    const direction = Math.sign(dx);
    if (direction === shake.direction) {
      shake.travel += Math.abs(dx);
    } else {
      if (shake.travel > SHAKE_TRAVEL) shake.energy = Math.min(1.5, shake.energy + SHAKE_KICK);
      shake.direction = direction;
      shake.travel = Math.abs(dx);
    }
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  let waveCursor = false;
  const setWaveCursor = (on: boolean) => {
    if (on === waveCursor) return;
    waveCursor = on;
    document.documentElement.style.cursor = on ? WAVE_CURSOR : "";
  };

  const pose = (t: number, dt: number) => {
    // Wave while the pointer is being shaken, settling back as the energy dies away.
    shake.energy *= Math.exp(-WAVE_DECAY * dt);
    wave.amount += (Math.min(1, shake.energy) - wave.amount) * Math.min(1, dt * 6);
    wave.phase += WAVE_SPEED * dt;
    wrist.rotation.z = 0.45 + wave.amount * Math.sin(wave.phase) * 0.38;
    // Hysteresis so the cursor doesn't flicker as the wave fades.
    setWaveCursor(onIntro && wave.amount > (waveCursor ? 0.15 : 0.3));

    hand.position.y = -0.7 + Math.sin(t * 0.9) * 0.06;

    tilt.x += (pointer.y * 0.25 - tilt.x) * 0.05;
    tilt.y += (pointer.x * 0.4 - tilt.y) * 0.05;
    hand.rotation.x = tilt.x;
    hand.rotation.y = tilt.y;
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back on tall phone screens so the hand still fits across.
    camera.position.z = w < h ? 7.5 * Math.min(1.6, h / w) * 0.8 : 7.5;
    camera.updateProjectionMatrix();
    if (reduceMotion) renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // Only animate while the intro slide is on screen, and only wave (and swap the
  // cursor) while it's the slide being looked at, not just peeking in.
  let visible = true;
  let onIntro = true;
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      onIntro = entry.intersectionRatio >= 0.5;
      if (!onIntro) {
        shake.energy = 0;
        setWaveCursor(false);
      }
    },
    { threshold: [0, 0.5] },
  );
  visibilityObserver.observe(container);

  const clock = new THREE.Clock();
  let raf = 0;
  const render = () => {
    if (visible) {
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      material.uniforms.uTime.value = t;
      pose(t, dt);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(render);
  };

  pose(0, 0);
  if (reduceMotion) renderer.render(scene, camera);
  else render();

  container.style.opacity = "1";

  return () => {
    cancelAnimationFrame(raf);
    setWaveCursor(false);
    window.removeEventListener("pointermove", onPointerMove);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    surface.geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
