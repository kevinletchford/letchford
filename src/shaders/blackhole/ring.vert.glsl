varying vec3 vWorldPos;
varying vec3 vNormal;

void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorldPos = w.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
