// src/space/beacon.ts
// A video-game style objective marker: slow rings pulsing out from a glowing dot.
// Drawn on a flat disc (uv 0..1, centre at 0.5), so it can lie on a planet or on terrain.
import * as THREE from "three";

export const BEACON_COLOR = 0x6ff3ff;

export function createBeaconMaterial(color = BEACON_COLOR) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;

      const float RINGS = 3.0;
      const float SPEED = 0.22; // one ring's lifetime is 1 / SPEED seconds

      void main() {
        float r = length(vUv - 0.5) * 2.0;
        if (r > 1.0) discard;
        float aa = fwidth(r) * 1.5;

        float a = 0.0;
        for (float i = 0.0; i < RINGS; i++) {
          float p = fract(uTime * SPEED + i / RINGS);
          float w = 0.018 + 0.02 * (1.0 - p) + aa;
          float ring = 1.0 - smoothstep(0.0, w, abs(r - p));
          // Fade in as it leaves the centre, fade out as it reaches the edge
          a += ring * smoothstep(0.0, 0.12, p) * pow(1.0 - p, 1.4);
        }

        // Steady marker ring and a breathing core
        a += (1.0 - smoothstep(0.0, 0.012 + aa, abs(r - 0.16))) * 0.8;
        float breathe = 0.75 + 0.25 * sin(uTime * 2.2);
        a += (1.0 - smoothstep(0.06 - aa, 0.06 + aa, r)) * breathe;
        a += exp(-r * 9.0) * 0.45 * breathe;

        gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
