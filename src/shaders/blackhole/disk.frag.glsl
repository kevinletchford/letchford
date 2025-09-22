precision highp float;

uniform float uTime;
uniform vec3  uColorInner;
uniform vec3  uColorOuter;
uniform float uInnerR;
uniform float uOuterR;
uniform float uSpin;     // rad/s texture flow
uniform float uBeaming;  // Doppler beaming intensity
uniform vec3  uCamPos;

varying vec2 vUv;
varying vec3 vWorldPos;

// ⬇️ this placeholder is replaced with the contents of noise.glsl by blackhole.ts
//__NOISE__

void main(){
  // RingGeometry: vUv.x is radial 0..1, vUv.y is angle 0..1
  float r01 = vUv.x;
  float ang = vUv.y * 6.2831853 + uTime * uSpin;

  // turbulence / heat
  float turb = bh_fbm(vec2(ang * 0.5, r01 * 4.0 + uTime * 0.1));

  // inner hot rim & outer fade
  float innerGlow = smoothstep(0.02, 0.25, 1.0 - r01);
  float outerFade = smoothstep(1.0, 0.85, r01);
  float core = innerGlow * (0.6 + 0.4 * turb);

  // Doppler-ish brightening toward camera
  vec3 toCam   = normalize(uCamPos - vWorldPos);
  vec3 tangent = normalize(vec3(cos(ang), 0.0, -sin(ang))); // around +Y
  float doppler = pow(max(dot(tangent, toCam), 0.0), 1.5) * uBeaming;

  vec3 col = mix(uColorInner, uColorOuter, r01);
  col *= (0.6 + 0.6 * core + doppler);

  // soft edges
  float alpha = smoothstep(0.0, 0.02, r01) * smoothstep(1.0, 0.98, 1.0 - r01);
  alpha *= 0.9 * (0.8 + 0.2 * turb);

  gl_FragColor = vec4(col, alpha);
}
