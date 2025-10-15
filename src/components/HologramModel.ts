import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'gsap';

export type HologramClientProps = {
  modelSrc: string;
  vertexShader: string;
  fragmentShader: string;
  hoverTilt?: number;
  hoverLift?: number;
  shaderUniforms?: Record<string, any>;
  exposure?: number;
  resourcePath?: string;
  modelPosition?:THREE.Vector3;
  cameraPosition?:THREE.Vector3;
  modelRotation?:THREE.Vector3;
};

export default function init(container: HTMLElement, props: HologramClientProps) {
  const {
    modelSrc,
    vertexShader,
    fragmentShader,
    hoverTilt = 0.25,
    hoverLift = 0.1,
    shaderUniforms = {},
    exposure = 1.0,
    resourcePath,
    cameraPosition = new THREE.Vector3(5, -20, 40),
    modelPosition = new THREE.Vector3(0, 0.3, 0),
    modelRotation = new THREE.Vector3(0, 0, 0),
  } = props;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  
  renderer.domElement.classList.add('holo-canvas');
  container.appendChild(renderer.domElement);

  // Scene & camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

  // Lights
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x66ccff as any, 0.8);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  

  const clock = new THREE.Clock();

  // Base uniforms
  const baseUniforms: Record<string, { value: any }> = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
    uColor: { value: new THREE.Color('#49e5ff') },
  };
  for (const [k, v] of Object.entries(shaderUniforms || {})) {
    baseUniforms[k] = { value: v };
  }

  const rig = new THREE.Group();
  scene.add(rig);

  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');

  let resPath = resourcePath;
  if (!resPath && /\.gltf(\?.*)?$/i.test(modelSrc)) {
    try {
      const url = new URL(modelSrc, window.location.href);
      resPath = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    } catch {
      const lastSlash = modelSrc.lastIndexOf('/');
      resPath = lastSlash >= 0 ? modelSrc.slice(0, lastSlash + 1) : '/';
    }
  }
  if (resPath) loader.setResourcePath(resPath);

  let model: THREE.Object3D | null = null;

  loader.load(
    modelSrc,
    (gltf) => {
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 1.4;
      const scale = targetSize / maxDim;
      model.scale.setScalar(0.35);

      model.traverse((obj: any) => {
        if (obj.isMesh) {
          const mat = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
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
          });
          if (obj.material && (obj.material as any).map) {
            (mat.uniforms as any).uMap = { value: (obj.material as any).map };
          }
          obj.material = mat;
        }
      });

      model.rotation.set(modelRotation.x, modelRotation.y, modelRotation.z);

      rig.add(model);
      gsap.to(rig.position, { x: modelPosition.x, y: modelPosition.y, z: modelPosition.z,  duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      animate();
    },
    undefined,
    (err) => {}
  );

  const state = { overCorner: false };
  const cornerThreshold =  0.1;

  function onPointerMove(e: PointerEvent) {
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const nx = x * 2 - 1;
    const ny = (1 - y) * 2 - 1;
    const nearCorner = Math.abs(nx) > cornerThreshold && Math.abs(ny) > cornerThreshold;
    if (!model) return;

    if (nearCorner) {
      const xSign = Math.sign(nx) || 1;
      const ySign = Math.sign(ny) || 1;
      gsap.to(rig.rotation, { x: (-ySign) * hoverTilt, y: (xSign) * hoverTilt, duration: 0.35, ease: 'power2.out' });
      gsap.to(rig.position, { y: hoverLift, duration: 0.35, ease: 'power2.out' });
      state.overCorner = true;
    } else if (state.overCorner) {
      gsap.to(rig.rotation, { x: 0, y: 0, z: 0, duration: 0.5, ease: 'power2.out' });
      gsap.to(rig.position, { y: 0, duration: 0.5, ease: 'power2.out' });
      state.overCorner = false;
    }
  }

  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerleave', () => {
    if (!model) return;
    gsap.to(rig.rotation, { x: 0, y: 0, z: 0, duration: 0.5, ease: 'power2.out' });
    gsap.to(rig.position, { y: 0, duration: 0.5, ease: 'power2.out' });
    state.overCorner = false;
  });

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    // renderer.setClearColor(0x0e1116, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const uRes = (baseUniforms.uResolution?.value as THREE.Vector2 | undefined);
    if (uRes) uRes.set(w, h);
  });
  ro.observe(container);

  let raf = 0;
  function animate() {
    (baseUniforms.uTime.value as number) = clock.getElapsedTime();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    container.removeEventListener('pointermove', onPointerMove);
    renderer.dispose();
    scene.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: any) => {
          if (m.map) m.map.dispose?.();
          m.dispose?.();
        });
      }
      if (obj.geometry) obj.geometry.dispose?.();
    });
    container.innerHTML = '';
  }

  window.addEventListener('beforeunload', cleanup);
}
