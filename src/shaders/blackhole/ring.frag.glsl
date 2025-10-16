precision highp float;

uniform vec3 uRingColor;
uniform float uIntensity;

varying vec3 vWorldPos;
varying vec3 vNormal;

void main(){
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 2.5);
  float ring = smoothstep(0.2, 1.0, fres);
  vec3 col = uRingColor * ring * uIntensity;
  gl_FragColor = vec4(col, ring);
}
