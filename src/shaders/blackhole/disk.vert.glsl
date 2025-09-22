uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPos;

void main(){
  vUv = uv;
  vec4 wpos = modelMatrix * vec4(position, 1.0);
  vWorldPos = wpos.xyz;
  gl_Position = projectionMatrix * viewMatrix * wpos;
}