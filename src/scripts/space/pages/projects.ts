// src/space/pages/projects.ts
import * as THREE from "three";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import holographicVertexShader from "@src/shaders/holographic/vertex.glsl";
import holographicFragmentShader from "@src/shaders/holographic/fragment.glsl";

const OBJ = (lm: THREE.LoadingManager) => new OBJLoader(lm);

  const loadProjects: PageLoader = async ({ three: T, camera, loadingManager }: Ctx): Promise<LoadResult> => {
    const group = new T.Group();
    let cancelled = false;


    const holoMat = new T.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new T.Color("#70c1ff") },
      uAlpha: { value: 0.75 },
    },
    transparent: false,
    side: T.DoubleSide,
    depthWrite: true,
    blending: T.AdditiveBlending,
  }); 

    const astronaut = await OBJ(loadingManager)
      .setResourcePath("/astronaut/")
      .loadAsync("/astronaut/Astronaut.obj");

    astronaut.traverse((obj) => {
      if (obj instanceof T.Mesh) {
        // assign holographic material to every mesh
        obj.material = holoMat;
      }
    });

    astronaut.rotation.set(-1, -1, 0);
    astronaut.scale.set(1,1, 1);
    astronaut.position.set(0, 0, 0);
    astronaut.position.set( -18, -29.5, 72);

   group.add(astronaut);

    const baseQuat = astronaut.quaternion.clone();
    const basePos = astronaut.position.clone();
    const offset = new T.Vector3();
    const targetPos = new T.Vector3();
    const targetEuler = new T.Euler();
    const tumbleQuat = new T.Quaternion();
    const desiredQuat = new T.Quaternion();

    const driftAmp = 0.15, k = 0.15, sigma = 0.10, maxOffset = driftAmp;
    const rotAmp = T.MathUtils.degToRad(8);
    const speedX = 0.050, speedY = 0.037, speedZ = 0.031;
    const posSmoothHz = 5.5, 
    rotSmoothHz = 10.0;
      
    const uiText = await mountTextEffects();
  
    const updater = (dt: number, t: number) => {
      if (cancelled) return;
          const sdt = Math.sqrt(Math.max(dt, 0));
    offset.x += (-k * offset.x) * dt + sigma * sdt * (Math.random() * 2 - 1);
    offset.y += (-k * offset.y) * dt + sigma * sdt * (Math.random() * 2 - 1);
    offset.z += (-k * offset.z) * dt + sigma * sdt * (Math.random() * 2 - 1);
    if (offset.length() > maxOffset) offset.setLength(maxOffset);

    targetPos.copy(basePos).add(offset);
    astronaut.position.lerp(targetPos, 1 - Math.exp(-posSmoothHz * dt));

    targetEuler.set(
      rotAmp * Math.sin(2 * Math.PI * speedX * t),
      rotAmp * Math.sin(2 * Math.PI * speedY * t),
      rotAmp * Math.cos(2 * Math.PI * speedZ * t),
      "XYZ"
    );
    tumbleQuat.setFromEuler(targetEuler);
    desiredQuat.multiplyQuaternions(baseQuat, tumbleQuat);
    astronaut.quaternion.slerp(desiredQuat, 1 - Math.exp(-rotSmoothHz * dt));
      camera.position.set(-20, -30, 80);
    };

    const dispose = () => {
      cancelled = true;
      uiText.dispose();
    };

  
    return { group, dispose, updater };
  };

    document.addEventListener("astro:before-preparation", (event) => {
    const originalLoader = event.loader;
    event.loader = async function () {
      const camera = window.SpaceManager.getCamera();
      const camProxy = { x: -20, y: -30, z: 90, ox: 0, oy: 0 };
      const qCamX = gsap.quickTo(camera.position, "x", { duration: 0.62, ease: "power3.out" });
      const qCamY = gsap.quickTo(camera.position, "y", { duration: 0.62, ease: "power3.out" });
      const qCamZ = gsap.quickTo(camera.position, "z", { duration: 0.62, ease: "power3.out" });
      const updateCamera = () => {
        qCamX(camProxy.x + camProxy.ox);
        qCamY(camProxy.y + camProxy.oy);
        qCamZ(camProxy.z);
        camera.updateMatrixWorld();
      };
      await originalLoader();
      updateCamera();
    };
  });

  export default loadProjects;

