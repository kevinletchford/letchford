// src/scripts/space.ts
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// Shaders (strings via your bundler like Vite)
import diskVert from '@src/shaders/blackhole/disk.vert.glsl';
import diskFragRaw from '@src/shaders/blackhole/disk.frag.glsl';
import ringVert from '@src/shaders/blackhole/ring.vert.glsl';
import ringFrag from '@src/shaders/blackhole/ring.frag.glsl';
import noiseGLSL from '@src/shaders/blackhole/noise.glsl';
import { gsap } from "gsap";
import { blendScreen } from 'three/tsl';

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);

const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();

const yAxis = new THREE.Vector3(0, 1, 0);
const PLANET_SPIN_RAD_PER_SEC = 0.015;
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader()

// Camera - static position looking at ship
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);             // give yourself room while debugging
camera.updateProjectionMatrix()


type BlackHole = {
  root: THREE.Group;
  update: (dt: number, t: number) => void;
};

export function createBlackHole(opts: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  position?: THREE.Vector3;
  scale?: number;
}): BlackHole {
  const { scene, camera } = opts;
  const root = new THREE.Group();
  root.position.copy(opts.position ?? new THREE.Vector3(0, -40, -20));
  const S = opts.scale ?? 6.0;
  root.scale.setScalar(S);

  // 1) Event horizon
  const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 128, 128),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  horizon.renderOrder = 1;
  root.add(horizon);

  // 2) Photon ring (Fresnel)
  const ringMat = new THREE.ShaderMaterial({
    uniforms: {
      uRingColor: { value: new THREE.Color(0xffe7b0) },
      uIntensity: { value: 1.7 }
    },
    vertexShader: ringVert,
    fragmentShader: ringFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const ring = new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 128, 128),
    ringMat
  );
  ring.renderOrder = 2;
  root.add(ring);

  // 3) Accretion disk (RingGeometry in XZ plane)
  const innerR = 1.25, outerR = 3.5, seg = 256;
  const diskGeo = new THREE.RingGeometry(innerR, outerR, seg, 1);
  diskGeo.rotateX(-Math.PI / 2);

  const diskFrag = diskFragRaw.replace('//__NOISE__', noiseGLSL);

  const diskMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:       { value: 0 },
      uColorInner: { value: new THREE.Color(0xffc36b) },
      uColorOuter: { value: new THREE.Color(0x9944ff) },
      uInnerR:     { value: innerR },
      uOuterR:     { value: outerR },
      uSpin:       { value: 0.7 },
      uBeaming:    { value: 0.9 },
      uCamPos:     { value: new THREE.Vector3() }
    },
    vertexShader:  diskVert,
    fragmentShader: diskFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.renderOrder = 0;
  root.add(disk);

  // 4) Infall particles
  const pCount = 1200;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pSpeed = new Float32Array(pCount);

  for (let i = 0; i < pCount; i++) {
    const r = THREE.MathUtils.lerp(outerR * 0.9, outerR * 1.2, Math.random());
    const a = Math.random() * Math.PI * 2;
    pPos[i*3+0] = Math.cos(a) * r;
    pPos[i*3+1] = (Math.random() - 0.5) * 0.5;
    pPos[i*3+2] = Math.sin(a) * r;
    pSpeed[i] = THREE.MathUtils.lerp(0.2, 0.7, Math.random());
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffaa88,
    size: 0.45,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.renderOrder = 3;
  root.add(particles);

  scene.add(root);

  const tmp = new THREE.Vector3();

  function update(dt: number, t: number) {
    // visual spin
    disk.rotation.y += dt * 0.25;

    // shader uniforms
    (diskMat.uniforms.uTime as any).value = t;
    (diskMat.uniforms.uCamPos as any).value.copy(camera.getWorldPosition(tmp));

    // particle spiral inward
    const pos = pGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pCount; i++) {
      const ix = i * 3;
      const x = pos.array[ix+0];
      const y = pos.array[ix+1];
      const z = pos.array[ix+2];
      const r = Math.max(0.2, Math.hypot(x, z));
      const w = pSpeed[i] * (1.2 / r);        // angular vel ~ 1/r
      const ang = Math.atan2(z, x) + w * dt;

      const rNew = r - dt * pSpeed[i] * 0.15; // inward drift
      const yNew = y * (1.0 - dt * 0.35);     // thin the disk

      const crossed = rNew < innerR * 0.95;
      const rClamp = crossed ? THREE.MathUtils.lerp(outerR*0.9, outerR*1.2, Math.random()) : rNew;
      const aNew   = crossed ? Math.random()*Math.PI*2 : ang;

      pos.array[ix+0] = Math.cos(aNew) * rClamp;
      pos.array[ix+1] = crossed ? (Math.random()-0.5)*0.5 : yNew;
      pos.array[ix+2] = Math.sin(aNew) * rClamp;
    }
    pos.needsUpdate = true;
  }

  return { root, update };
}



let initialLoad = true;
let yaw = 0;   // rotation around Y-axis
let pitch = 0; // rotation around X-axis
let targetX = 0;
let targetY = -2000; // default distance
let targetZ = 200; // default distance


// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);


const blackHole = createBlackHole({
  scene,
  camera,
  position: new THREE.Vector3(0, -30, -120), // tweak to taste
  scale: 40.0
});



// Group for planet, clouds, and trail (rotates under ship)


// After you create `textureLoader`, somewhere near your other textures:
const starsTex = textureLoader.load('/stars/stars.jpg');
starsTex.colorSpace = THREE.SRGBColorSpace;                   // if authored in sRGB
starsTex.mapping = THREE.EquirectangularReflectionMapping;    // treat as 360° pano
starsTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Use as sky background (no parallax, always behind everything)
scene.background = starsTex;



const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  let dt = clock.getDelta();
  const t = clock.elapsedTime;

  blackHole.update(dt, t);
camera.position.set(-20, -30, 80);
camera.lookAt(blackHole.root.position);
  renderer.render(scene, camera);
}

animate();


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log(renderer.capabilities.getMaxAnisotropy());


// observer.ts

// Extend the window types for our global + event
declare global {
  interface Window {
    currentSectionId?: string;
  }
  interface WindowEventMap {
    sectionchange: CustomEvent<{ id: string }>;
  }
}

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sections: NodeListOf<HTMLElement> = document.querySelectorAll('article section[id]');

  const navLinks: Map<string, HTMLAnchorElement> = new Map(
    Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
      .map(a => [a.getAttribute('href')!.slice(1), a])
  );

  const setActiveNav = (id: string) => {
    navLinks.forEach((a, key) => {
      if (key === id) a.classList.add('is-active');
      else a.classList.remove('is-active');
    });
  };

  let lastHash = '';
  const updateHash = (id: string) => {
    if (!id || lastHash === id) return;
    history.replaceState(null, '', `#${id}`);
    lastHash = id;
  };

  const setActiveSection = (id: string, el: HTMLElement) => {
    // remove old classes
    sections.forEach(s => s.classList.remove('is-visible'));
    // set new active
    el.classList.add('is-visible');

    // update nav + hash
    setActiveNav(id);
    updateHash(id);

    // only notify if it changed
    if (window.currentSectionId !== id) {
      window.currentSectionId = id;
      // 🔔 dispatch a typed custom event
      window.dispatchEvent(new CustomEvent('sectionchange', { detail: { id } }));
    }
  };

  const io = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;

      // Choose the most visible section
      const top = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const el = top.target as HTMLElement;
      const id = el.id;
      setActiveSection(id, el);
    },
    {
      root: null,
      rootMargin: '0px 0px -40% 0px',
      threshold: reduceMotion ? 0 : [0.15, 0.35, 0.55, 0.75]
    }
  );

  sections.forEach(s => io.observe(s));

  // Optional: initialize active based on current hash (if present)
  const initialId = location.hash?.slice(1);
  if (initialId) {
    const el = document.getElementById(initialId);
    if (el) setActiveSection(initialId, el);
  }

  // Optional parallax
  if (!reduceMotion) {
    const speedNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-speed]'));
    const speeds = new WeakMap<HTMLElement, number>();
    speedNodes.forEach(node => speeds.set(node, parseFloat(node.dataset.speed || '1')));

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const vh = window.innerHeight;
        sections.forEach(section => {
          if (!section.classList.contains('is-visible')) return;
          const rect = section.getBoundingClientRect();
          const progress = 1 - Math.min(Math.max(rect.top / vh, 0), 1);
          speedNodes.forEach(node => {
            if (!section.contains(node)) return;
            const speed = speeds.get(node) ?? 1;
            node.style.transform = `translate3d(0, ${Math.round((progress - 0.5) * 40 * speed)}px, 0)`;
          });
        });
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }
})();