// src/scripts/space.ts
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import holographicVertexShader from '@src/shaders/holographic/vertex.glsl'
import holographicFragmentShader from '@src/shaders/holographic/fragment.glsl'

import { gsap } from "gsap";

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);

const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();

const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader()

// Camera - static position looking at ship
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

let targetX = 0;
let targetY = -1; // default distance
let targetZ = 0; // default distance

camera.position.set(targetX, targetY, targetZ);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);

// Group for planet, clouds, and trail (rotates under ship)
const world = new THREE.Group();
world.position.y = 0;
world.position.x = 0;
scene.add(world);


// After you create `textureLoader`, somewhere near your other textures:
const starsTex = textureLoader.load('/stars/stars.jpg');
starsTex.colorSpace = THREE.SRGBColorSpace;                   // if authored in sRGB
starsTex.mapping = THREE.EquirectangularReflectionMapping;    // treat as 360° pano
starsTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Use as sky background (no parallax, always behind everything)
scene.background = starsTex;

let tablet = new THREE.Group<THREE.Object3DEventMap>;

// load a resource


const material = new THREE.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms:
    {
        uTime: new THREE.Uniform(0),
        uColor: new THREE.Uniform(new THREE.Color('#70c1ff')),
        uAlpha: new THREE.Uniform(0.35),
    },
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
})


  objLoader.load(
    // resource URL
    '/laptop/Laptop-2.obj',
    // called when resource is loaded
    function ( object ) {
      tablet = object;
        console.log(tablet)
        tablet.traverse((child) =>
        {
            if (child instanceof THREE.Mesh) {
                child.material = material
            }
        });

      tablet.rotateX(2);
      tablet.rotateY(-1);
        tablet.scale.set(0.15,0.15,0.15),
      tablet.position.set(0,0,0);
      world.add( tablet );
    }
  );

const clock = new THREE.Clock()

function animate() {
    const elapsedTime = clock.getElapsedTime();
    material.uniforms.uTime.value = elapsedTime;
        if(tablet)
    {

        tablet.rotation.y = elapsedTime * 0.2
    }
    camera.lookAt(tablet.position);
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();



window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});