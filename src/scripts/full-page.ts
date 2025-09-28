// src/scripts/space.ts
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
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