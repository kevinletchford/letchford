// src/space/holo.ts
// Building blocks for the procedural case-study holograms (see pages/case-*.ts).
import holographicVertexShader from "@src/shaders/holographic/vertex.glsl";
import holographicFragmentShader from "@src/shaders/holographic/fragment.glsl";
import type * as THREE from "three";

type Three = typeof THREE;

export const HOLO_BLUE = "#70c1ff";
export const HOLO_ACCENT = "#9ad7ff";

export type HoloMaterial = THREE.ShaderMaterial & {
  uniforms: { uTime: { value: number }; uColor: { value: THREE.Color }; uAlpha: { value: number } };
};

export const makeHolo = (T: Three, color = HOLO_BLUE, alpha = 0.35) =>
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
  }) as HoloMaterial;

export const roundedRect = (T: Three, w: number, h: number, r: number) => {
  const s = new T.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

/** A rounded-rectangle outline, extruded so its edges catch the fresnel. Centred on z = 0. */
export const frameMesh = (
  T: Three,
  mat: THREE.Material,
  w: number,
  h: number,
  { radius = 0.25, border = 0.1, depth = 0.12 } = {},
) => {
  const shape = roundedRect(T, w, h, radius);
  shape.holes.push(roundedRect(T, w - border * 2, h - border * 2, Math.max(radius - border * 0.7, 0.02)));
  const geo = new T.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  return new T.Mesh(geo, mat);
};

/** A horizontal pill, e.g. a line of text or an address bar. `x` is its left edge. */
export const pill = (T: Three, mat: THREE.Material, length: number, x: number, y: number, radius = 0.05) => {
  const m = new T.Mesh(new T.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.001), 6, 12), mat);
  m.rotation.z = Math.PI / 2;
  m.position.set(x + length / 2, y, 0);
  return m;
};
