// src/scripts/space.ts
import * as THREE from 'three';
import marsVertexShader from '@src/shaders/mars/vertex.glsl'
import marsFragmentShader from '@src/shaders/mars/fragment.glsl'

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
scene.add(world);

//Planet Textures
const marsDayTexture = textureLoader.load('./mars/mars.jpg');
marsDayTexture.colorSpace = THREE.SRGBColorSpace;
marsDayTexture.anisotropy = 8;

const marsNightTexture = textureLoader.load('./mars/mars-night.jpg')
marsNightTexture.colorSpace = THREE.SRGBColorSpace
marsNightTexture.anisotropy = 8;

const marsSpecular = textureLoader.load('./mars/mars-specular.jpg')
marsSpecular.anisotropy = 8;

// After you create `textureLoader`, somewhere near your other textures:
const starsTex = textureLoader.load('./stars/stars.jpg');
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

// Spacecraft
const pyramidGeometry = new THREE.ConeGeometry(0.25, 0.25, 10);
pyramidGeometry.rotateX(92);
const pyramidMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 });
const spacecraft = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
spacecraft.position.set(0, -(planetRadius + 3), 0);
scene.add(spacecraft);


const sunSpherical = new THREE.Spherical(1, Math.PI * 0.5, 0.5)
const sunDirection = new THREE.Vector3()

// Debug
const debugSun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.1, 2),
    new THREE.MeshBasicMaterial()
)
world.add(debugSun)

// Trail
const MAX_TRAIL_POINTS = 100;
const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
const trailAttr = new THREE.BufferAttribute(trailPositions, 3);
trailAttr.setUsage(THREE.DynamicDrawUsage);
const trailGeometry = new THREE.BufferGeometry();
trailGeometry.setAttribute('position', trailAttr);
trailGeometry.setDrawRange(0, 0);
const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffaa00 });
const trailLine = new THREE.Line(trailGeometry, trailMaterial);
world.add(trailLine);

let trailCount = 0;
let trailIndex = 0;

// Keys
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => (keys[e.key] = true));
window.addEventListener('keyup', (e) => (keys[e.key] = false));

function updateTrail() {
  const base = new THREE.Vector3(0, -(planetRadius + 0.5), 0);
  const pos = base.clone()
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const i = trailIndex * 3;
  trailPositions[i] = pos.x;
  trailPositions[i + 1] = pos.y;
  trailPositions[i + 2] = pos.z;
  trailIndex = (trailIndex + 1) % MAX_TRAIL_POINTS;
  trailCount = Math.min(trailCount + 1, MAX_TRAIL_POINTS);
  trailAttr.needsUpdate = true;
  trailGeometry.setDrawRange(0, trailCount);
}

function updateWorldRotation() {
  const speed = 0.005;
  if (keys['ArrowUp']) pitch += speed;
  if (keys['ArrowDown']) pitch -= speed;
  if (keys['ArrowLeft']) yaw += speed;
  if (keys['ArrowRight']) yaw -= speed;
  world.rotation.set(pitch, yaw, 0);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta(); // seconds since last frame

  // gentle axial spin (local Y)
  planet.rotateOnAxis(yAxis, PLANET_SPIN_RAD_PER_SEC * dt);

  updateWorldRotation();
  updateTrail();
  camera.lookAt(spacecraft.position);
  renderer.render(scene, camera);
}

const updateSun = () =>
{
    // Sun direction
    sunDirection.setFromSpherical(sunSpherical)

    // Debug
    debugSun.position.copy(sunDirection).multiplyScalar(15);


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