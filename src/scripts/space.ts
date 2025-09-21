// src/scripts/space.ts
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import marsVertexShader from '@src/shaders/mars/vertex.glsl'
import marsFragmentShader from '@src/shaders/mars/fragment.glsl'
import { gsap } from "gsap";

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
);


const planetRadius = 10;
let initialLoad = true;
let yaw = 0;   // rotation around Y-axis
let pitch = 0; // rotation around X-axis
let targetX = 0;
let targetY = -2000; // default distance
let targetZ = 200; // default distance

camera.position.set(targetX, targetY, targetZ);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);

// Group for planet, clouds, and trail (rotates under ship)
const world = new THREE.Group();
world.position.y = -2;
world.position.x = 8;
scene.add(world);

//Planet Textures
const marsDayTexture = textureLoader.load('/mars/mars.jpg');
marsDayTexture.colorSpace = THREE.SRGBColorSpace;
marsDayTexture.anisotropy = 8;

const marsNightTexture = textureLoader.load('/mars/mars-night.jpg')
marsNightTexture.colorSpace = THREE.SRGBColorSpace
marsNightTexture.anisotropy = 8;

const marsSpecular = textureLoader.load('/mars/mars-specular.jpg')
marsSpecular.anisotropy = 8;

// After you create `textureLoader`, somewhere near your other textures:
const starsTex = textureLoader.load('/stars/stars.jpg');
starsTex.colorSpace = THREE.SRGBColorSpace;                   // if authored in sRGB
starsTex.mapping = THREE.EquirectangularReflectionMapping;    // treat as 360° pano
starsTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Use as sky background (no parallax, always behind everything)
scene.background = starsTex;

// Planet shader
const planetGeometry = new THREE.SphereGeometry(planetRadius, 256, 256);
const planetMaterial = new THREE.ShaderMaterial({
  uniforms: {
        uDayTexture: new THREE.Uniform(marsDayTexture),
        uNightTexture: new THREE.Uniform(marsNightTexture),
        uSpecularTexture: new THREE.Uniform(marsSpecular),
        uSunDirection: new THREE.Uniform(new THREE.Vector3(0, 0, 1))
  },
  vertexShader:marsVertexShader,
  fragmentShader: marsFragmentShader,
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.rotation.z = THREE.MathUtils.degToRad(25.19);

world.add(planet);

// Clouds
const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
const cloudGeometry = new THREE.SphereGeometry(planetRadius + 0.1, 64, 64);
const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
world.add(clouds);

// // Spacecraft
// const pyramidGeometry = new THREE.ConeGeometry(0.25, 0.25, 10);
// pyramidGeometry.rotateX(92);
// const pyramidMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 });
// const spacecraft = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
// spacecraft.position.set(0, -(planetRadius + 3), 0);
// scene.add(spacecraft);

/**
 * Particles
 */
// Geometry
const particlesCount = 200;
const objectsDistance = 100;
const positions = new Float32Array(particlesCount * 3)

for(let i = 0; i < particlesCount; i++)
{
    positions[i * 3 + 0] = (Math.random() - 0.5) * 100
    positions[i * 3 + 1] = objectsDistance * 0.5 - Math.random() * objectsDistance 
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100
}

const particlesGeometry = new THREE.BufferGeometry()
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

// Material
const particlesMaterial = new THREE.PointsMaterial({
    color: 0xff6467,
    sizeAttenuation: true,
    size: 0.02
})

const particles = new THREE.Points(particlesGeometry, particlesMaterial)
world.add(particles)


let satellite = new THREE.Group<THREE.Object3DEventMap>;
let satelliteRotateX = -0.5;
let satelliteRotateY = 0.125; 


// load a resource

mtlLoader.load('/satellite/Satellite.mtl', (materials) => {
  materials.preload();
  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  objLoader.load(
    // resource URL
    '/satellite/Satellite.obj',
    // called when resource is loaded
    function ( object ) {
      satellite = object;
      satellite.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.color.set(0xffffff); 
          child.material.needsUpdate = true;
          const texture = child.material.map;
          child.material = new THREE.MeshStandardMaterial({
            map: texture,
            color: new THREE.Color(0xffffff),
            emissive: new THREE.Color(0x222222), // subtle boost
            roughness: 1.0,
            metalness: 0.0
          });
        }
      });
      satellite.scale.set(0.05,0.05,0.05),
      satellite.rotateX(satelliteRotateX);
      satellite.rotateY(satelliteRotateY);
      satellite.position.set(10, -(planetRadius + 3), 0);
      scene.add( satellite );
    }
  );
});

const satelliteLight = new THREE.AmbientLight(0xffffff, 0.5);
const satelliteLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
satelliteLight.position.set(20, -(planetRadius + 5), 0);
satelliteLight2.position.set(20, -(planetRadius + 10), -10);

scene.add(satelliteLight2);

const sunSpherical = new THREE.Spherical(1, Math.PI * 0.5, 0.5)
const sunDirection = new THREE.Vector3()

// Keys
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => (keys[e.key] = true));
window.addEventListener('keyup', (e) => (keys[e.key] = false));


let targetRotateX = 0;
let targetRotateY = 0;

function updateWorldRotation() {
  const speed = 0.005;
  
  // Adjust pitch/yaw based on keys
  if (keys['w']) {
    pitch += speed;
    targetRotateX = -0.75;  // <-- target value
  }
  if (keys['s']) {
    pitch -= speed;
    targetRotateX = 0.0;
  }
  if (keys['a']) {
    yaw += speed;
    targetRotateY = -0.75;
  }
  if (keys['d']) {
    yaw -= speed;
    targetRotateY = 0.0;
  }

  // Apply easing (lerp)
  const ease = 0.1; // smaller = smoother
  satelliteRotateX += (targetRotateX - satelliteRotateX) * ease;
  satelliteRotateY += (targetRotateY - satelliteRotateY) * ease;

  // Apply rotations
  world.rotation.set(pitch, yaw, 0);
  satellite.rotation.set(satelliteRotateX, satelliteRotateY, 0);
}


let astronaut = new THREE.Group<THREE.Object3DEventMap>;

// load a resource

mtlLoader.load('/astronaut/Astronaut.mtl', (materials) => {
  materials.preload();
  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  objLoader.load(
    // resource URL
    '/astronaut/Astronaut.obj',
    // called when resource is loaded
    function ( object ) {
      astronaut = object;
      astronaut.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.color.set(0xffffff); 
          child.material.needsUpdate = true;
          const texture = child.material.map;
          child.material = new THREE.MeshStandardMaterial({
            map: texture,
            color: new THREE.Color(0xffffff),
            emissive: new THREE.Color(0x222222), // subtle boost
            roughness: 1.0,
            metalness: 0.0
          });
        }
      });
      astronaut.rotateX( 1.25);
      astronaut.rotateY( -1);
      astronaut.position.set(10, -(planetRadius + 30), 0);
      scene.add( astronaut );
    }
  );
});

// Set your base orientation once
astronaut.rotation.set(0, 0, 0);
astronaut.rotateX(1.25);
astronaut.rotateY(-1);

// Save the baseline quaternion to compose with the tumble every frame
const baseQuat = astronaut.quaternion.clone();


const clock = new THREE.Clock();

let anchorSet = false;
const basePos    = new THREE.Vector3();  // will be set after intro
const offset     = new THREE.Vector3();
const targetPos  = new THREE.Vector3();

// rotation helpers
const targetEuler = new THREE.Euler();
const tumbleQuat  = new THREE.Quaternion();
const desiredQuat = new THREE.Quaternion();

// --- Tunables ---
const driftAmp   = 0.35;     // roam radius (meters) — a bit more than before
const k          = 0.35;     // mean reversion strength (lower = looser)
const sigma      = 0.10;     // randomness strength (slightly more movement)
const maxOffset  = driftAmp; // clamp radius

const rotAmp     = THREE.MathUtils.degToRad(8); // ~8° wobble
const speedX     = 0.050, speedY = 0.037, speedZ = 0.031; // Hz (periods ~20–32s)

// Smoothing (exp easing by frequency)
const posSmoothHz = 2.5;  // position ease
const rotSmoothHz = 2.0;  // rotation ease

// If you know intro length, keep this. Otherwise flip anchorSet externally when intro ends.
const INTRO_SECONDS = 4.0;

function animate() {
  requestAnimationFrame(animate);

  let dt = clock.getDelta();
  const t = clock.elapsedTime;
  if (dt > 0.05) dt = 0.05; // cap dt for stability (tab switches, stalls)

  // Your planet spin
  planet.rotateOnAxis(yAxis, PLANET_SPIN_RAD_PER_SEC * dt);

  // Defer anchor until the intro settles
  if (!anchorSet && t >= INTRO_SECONDS) {
    basePos.copy(astronaut.position);
    anchorSet = true;
  }

  if (anchorSet) {
    // --- Mean-reverting drift (Ornstein–Uhlenbeck) ---
    const sdt = Math.sqrt(dt);
    offset.x += (-k * offset.x) * dt + sigma * sdt * (Math.random() * 2 - 1);
    offset.y += (-k * offset.y) * dt + sigma * sdt * (Math.random() * 2 - 1);
    offset.z += (-k * offset.z) * dt + sigma * sdt * (Math.random() * 2 - 1);

    // Soft clamp so we never wander far
    if (offset.length() > maxOffset) offset.setLength(maxOffset);

    // Smoothly approach target position
    targetPos.copy(basePos).add(offset);
    const posAlpha = 1 - Math.exp(-posSmoothHz * dt);
    astronaut.position.lerp(targetPos, posAlpha);

    // --- Gentle tumbling, relative to your base orientation ---
    // Slightly more motion, still smooth
    targetEuler.set(
      rotAmp * Math.sin(2 * Math.PI * speedX * t),
      rotAmp * Math.sin(2 * Math.PI * speedY * t),
      rotAmp * Math.cos(2 * Math.PI * speedZ * t),
      'XYZ'
    );
    tumbleQuat.setFromEuler(targetEuler);

    // desired = base * tumble  (DO NOT call rotateX/rotateY each frame)
    desiredQuat.multiplyQuaternions(baseQuat, tumbleQuat);

    const rotAlpha = 1 - Math.exp(-rotSmoothHz * dt);
    astronaut.quaternion.slerp(desiredQuat, rotAlpha);
  }

  updateWorldRotation();
  camera.lookAt(planet.position);
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

 window.addEventListener('DOMContentLoaded', (e) =>{
  setZoom('header', 0.5, 3);
 });

window.addEventListener('sectionchange', (e) => {
  const id = (e as CustomEvent<{ id: string }>).detail.id;
  if(id != 'header' || initialLoad == false){
    setZoom(id);
  }
  toggleActiveNavItem(id);
});

const setZoom = (id:string, delay = 0, duration = 1) => {
  // e.g. send analytics, trigger animations, etc.
  switch (id) {
    case 'header':
        targetX = 0;
        targetY = -30;
        targetZ = 0;
      break;
    case 'skills':
      initialLoad = false;
      targetY = -20;
      targetZ = 0;
      break;
    case 'experience':
      targetY = -20;
      targetZ = 10;
      break;
    case 'education':
      targetY = -60;
      targetZ = 10;
      break;
  }

  // Smooth zoom with GSAP
  gsap.to(camera.position, {
    x: targetX,
    y: targetY,
    z: targetZ,
    duration: duration,
    delay: delay,
    ease: 'power2.inOut',
    onUpdate: () => {
    }
  });
}

// === Config ===
const WRAP_AROUND = false; // set true to wrap instead of disabling at ends

// --- Utilities ---
const qs = <T extends Element>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T | null;

const qsa = <T extends Element>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

// Smoothly scroll to a section by id and mark its nav dot active
function goToSection(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toggleActiveNavItem(id);
}

// Your provided helper (kept, just TS typed)
const toggleActiveNavItem = (navItem: string): void => {
  const items = qsa<HTMLAnchorElement>('a[data-nav-item]');
  const item = qs<HTMLAnchorElement>(`a[data-nav-item="${navItem}"]`);

  items.forEach((x) => x.classList.remove('dot_active'));
  item?.classList.add('dot_active');
};

document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = qs<HTMLButtonElement>('.previous-section');
  const nextBtn = qs<HTMLButtonElement>('.next-section');
  const dotLinks = qsa<HTMLAnchorElement>('a[data-nav-item]');

  // Ordered list of section ids based on the nav dots
  const sectionIds: string[] = dotLinks
    .map((a) => a.getAttribute('data-nav-item'))
    .filter((x): x is string => Boolean(x));

  const sections: HTMLElement[] = sectionIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));

  // Click dots -> smooth scroll + sync
  dotLinks.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-nav-item');
      if (id) goToSection(id);
    });
  });

  const getActiveIndex = (): number => {
    const active = qs<HTMLAnchorElement>('a[data-nav-item].dot_active');
    const id = active?.getAttribute('data-nav-item') ?? null;
    return id ? sectionIds.indexOf(id) : -1;
  };

  function setDisabled(btn: HTMLButtonElement | null, disabled: boolean): void {
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('opacity-40', disabled);
    btn.classList.toggle('pointer-events-none', disabled);
  }

  function updateButtonsState(): void {
    if (WRAP_AROUND) return; // no disabled state when wrapping
    const i = getActiveIndex();
    setDisabled(prevBtn, i <= 0);
    setDisabled(nextBtn, i >= sectionIds.length - 1);
  }

  // Button handlers
  prevBtn?.addEventListener('click', () => {
    const i = getActiveIndex();
    if (i < 0) return;
    if (WRAP_AROUND) {
      const j = (i - 1 + sectionIds.length) % sectionIds.length;
      goToSection(sectionIds[j]);
    } else if (i > 0) {
      goToSection(sectionIds[i - 1]);
    }
  });

  nextBtn?.addEventListener('click', () => {
    const i = getActiveIndex();
    if (i < 0) return;
    if (WRAP_AROUND) {
      const j = (i + 1) % sectionIds.length;
      goToSection(sectionIds[j]);
    } else if (i < sectionIds.length - 1) {
      goToSection(sectionIds[i + 1]);
    }
  });

  // Keep dots in sync when user scrolls manually
  const observer = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      const id = visible?.target instanceof HTMLElement ? visible.target.id : null;
      if (id) {
        toggleActiveNavItem(id);
        updateButtonsState();
      }
    },
    {
      root: null,
      rootMargin: '0px',
      threshold: [0.5],
    }
  );

  sections.forEach((sec) => observer.observe(sec));

  // Initialize state (use hash if present)
  const initialId = (location.hash?.replace('#', '') || sectionIds[0]) ?? null;
  if (initialId) toggleActiveNavItem(initialId);
  updateButtonsState();
});
