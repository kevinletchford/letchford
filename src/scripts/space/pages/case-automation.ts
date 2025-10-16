// src/space/pages/case-automation.ts
import * as THREE from "three";
import holographicVertexShader from "@src/shaders/holographic/vertex.glsl";
import holographicFragmentShader from "@src/shaders/holographic/fragment.glsl";
import type { Ctx, LoadResult, PageLoader } from "../types";
import { mountTextEffects } from "../ui/text-animator";

const loadAutomation: PageLoader = async ({ three: T }: Ctx): Promise<LoadResult> => {
  const group = new T.Group();
  let cancelled = false;

  // Shared holographic shader material
  const makeHolo = (color: string, alpha = 0.35) =>
    new T.ShaderMaterial({
      vertexShader: holographicVertexShader,
      fragmentShader: holographicFragmentShader,
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: new T.Color(color) },
        uAlpha: { value: alpha },
      },
      transparent: false,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });

  // Materials (slightly different tint so the two spheres read well)
  const bigMat   = makeHolo("#70c1ff", 0.35);
  const smallMat = makeHolo("#9ad7ff", 0.35);

  // Geometry
  const bigGeo   = new T.SphereGeometry(1.2, 128, 128);  // larger sphere
  const smallGeo = new T.SphereGeometry(0.35, 96, 96);   // orbiting sphere

  // Meshes
  const big   = new T.Mesh(bigGeo, bigMat);
  const small = new T.Mesh(smallGeo, smallMat);

  // Orbit setup: use a pivot so we can rotate it for orbit
  const pivot = new T.Group();
  const orbitRadius = 3.2;
  small.position.set(orbitRadius, 0, 0); // start at +X

  // Optional: subtle base rotations so the holo shading shimmers
  big.rotation.set(0.6, -0.4, 0.5);
  small.rotation.set(0.2, 0.3, 0);

  // Assemble
  pivot.add(small);
  group.add(big);
  group.add(pivot);

  group.rotation.set(0.5, 0, 0);
  group.scale.set(1.25,1.25, 1.25);
  group.position.set(0, 0, 0);
  group.position.set( -20, -30, 74);

  // Updater (manager calls this every frame)
  const orbitSpeed = 0.01; // radians/sec
  const selfSpin   = 0.7; // small sphere self-rotation
  const shimmer    = 1.0; // time multiplier for shader motion (if desired)

  const uiText = await mountTextEffects();

  const updater = (dt: number, t: number) => {
    if (cancelled) return;

    // Animate shader time (both materials)
    (bigMat.uniforms.uTime as any).value   = t * shimmer;
    (smallMat.uniforms.uTime as any).value = t * shimmer;

    // Orbit the small sphere around the big one
    pivot.rotation.y += orbitSpeed * dt;

    // Gentle spins for some life
    big.rotation.y   += 0.15 * dt;
    small.rotation.y += selfSpin * dt;
  };

  const dispose = () => {
    cancelled = true;
    uiText.dispose();
  };

  return { group, dispose, updater };
};

export default loadAutomation;
