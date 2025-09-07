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
camera.position.set(0, -30, 0);

const planetRadius = 10;
let yaw = 0;   // rotation around Y-axis
let pitch = 0; // rotation around X-axis

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
    positions[i * 3 + 0] = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = objectsDistance * 0.5 - Math.random() * objectsDistance 
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
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
scene.add(particles)


let satellite = new THREE.Group<THREE.Object3DEventMap>;
let satelliteRotateX = -0.5;
let satelliteRotateY = 0.125; 

const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();
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
  if (keys['ArrowUp']) {
    pitch += speed;
    targetRotateX = -0.75;  // <-- target value
  }
  if (keys['ArrowDown']) {
    pitch -= speed;
    targetRotateX = 0.0;
  }
  if (keys['ArrowLeft']) {
    yaw += speed;
    targetRotateY = -0.75;
  }
  if (keys['ArrowRight']) {
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


const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta(); // seconds since last frame

  // gentle axial spin (local Y)
  planet.rotateOnAxis(yAxis, PLANET_SPIN_RAD_PER_SEC * dt);

  updateWorldRotation();
  camera.lookAt(planet.position);
  renderer.render(scene, camera);
}

const updateSun = () =>
{
    // Sun direction
    sunDirection.setFromSpherical(sunSpherical)
    planetMaterial.uniforms.uSunDirection.value.copy(sunDirection)
}



updateSun()

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log(renderer.capabilities.getMaxAnisotropy());


// observer.ts

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

window.addEventListener('sectionchange', (e) => {
  const id = (e as CustomEvent<{ id: string }>).detail.id;

  // e.g. send analytics, trigger animations, etc.

 let targetX = 0;
 let targetY = -30; // default distance
 let targetZ = 0; // default distance
  switch (id) {
    case 'header':
      targetY = -30;
      break;
    case 'skills':
      targetY = -20;
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
    duration: 1,
    ease: 'power2.inOut',
    onUpdate: () => {
    }
  });
});