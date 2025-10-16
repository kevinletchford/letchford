import{m as K}from"./text-animator.vFfjRLf3.js";import{ab as L,J as E,A as j}from"./FullPage.astro_astro_type_script_index_0_lang.UhxFxrQy.js";import"./index.CH_iu5NA.js";var D=`uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPos;

void main(){
  vUv = uv;
  vec4 wpos = modelMatrix * vec4(position, 1.0);
  vWorldPos = wpos.xyz;
  gl_Position = projectionMatrix * viewMatrix * wpos;
}`,$=`precision highp float;

uniform float uTime;
uniform vec3  uColorInner;
uniform vec3  uColorOuter;
uniform float uInnerR;
uniform float uOuterR;
uniform float uSpin;     
uniform float uBeaming;  
uniform vec3  uCamPos;

varying vec2 vUv;
varying vec3 vWorldPos;

void main(){
  
  float r01 = vUv.x;
  float ang = vUv.y * 6.2831853 + uTime * uSpin;

  
  float turb = bh_fbm(vec2(ang * 0.5, r01 * 4.0 + uTime * 0.1));

  
  float innerGlow = smoothstep(0.02, 0.25, 1.0 - r01);
  float outerFade = smoothstep(1.0, 0.85, r01);
  float core = innerGlow * (0.6 + 0.4 * turb);

  
  vec3 toCam   = normalize(uCamPos - vWorldPos);
  vec3 tangent = normalize(vec3(cos(ang), 0.0, -sin(ang))); 
  float doppler = pow(max(dot(tangent, toCam), 0.0), 1.5) * uBeaming;

  vec3 col = mix(uColorInner, uColorOuter, r01);
  col *= (0.6 + 0.6 * core + doppler);

  
  float alpha = smoothstep(0.0, 0.02, r01) * smoothstep(1.0, 0.98, 1.0 - r01);
  alpha *= 0.9 * (0.8 + 0.2 * turb);

  gl_FragColor = vec4(col, alpha);
}`,H=`varying vec3 vWorldPos;
varying vec3 vNormal;

void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorldPos = w.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,J=`precision highp float;

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
}`,X=`vec2 bh_hash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float bh_noise(vec2 p){
  const float K1 = 0.366025404; 
  const float K2 = 0.211324865; 
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3 n = h*h*h*h * vec3(
    dot(a, bh_hash2(i + 0.0)),
    dot(b, bh_hash2(i + o)),
    dot(c, bh_hash2(i + 1.0))
  );
  return dot(n, vec3(70.0));
}
float bh_fbm(vec2 p){
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ f += a * bh_noise(p); p *= 2.02; a *= 0.5; }
  return f;
}`;function Y(n=64){const e=document.createElement("canvas");e.width=e.height=n;const i=e.getContext("2d"),o=i.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);o.addColorStop(0,"rgba(255,255,255,1.0)"),o.addColorStop(.25,"rgba(255,231,176,0.9)"),o.addColorStop(.9,"rgba(255,231,176,0.35)"),o.addColorStop(1,"rgba(255,231,176,0.0)"),i.fillStyle=o,i.fillRect(0,0,n,n);const a=new L(e);return a.needsUpdate=!0,a.flipY=!1,a.magFilter=E,a.minFilter=j,a.generateMipmaps=!0,a}const q=`
  attribute float aSize;
  attribute float aPhase;
  varying float vPhase;

  void main() {
    vPhase = aPhase;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z); // tweak 300.0 to taste
    gl_Position = projectionMatrix * mvPosition;
  }
`,Q=`
  precision mediump float;

  uniform sampler2D uSprite;
  uniform vec3 uColor;
  uniform float uTime;

  varying float vPhase;

  void main() {
    vec2 uv = gl_PointCoord;
    vec4 tex = texture2D(uSprite, uv);

    // circular cutoff in case sprite edge bleeds
    float d = distance(uv, vec2(0.5));
    if (d > 0.5) discard;

    // subtle per-particle flicker
    float flicker = 0.7 + 0.3 * sin(uTime * 6.0 + vPhase);

    float alpha = tex.a * flicker;
    if (alpha < 0.01) discard;

    vec3 col = uColor * tex.rgb;
    gl_FragColor = vec4(col, alpha);
  }
`;function Z(n){const e=n.three,{camera:i}=n,o=new e.Group;o.position.copy(n.position??new e.Vector3(0,-40,-20));const a=n.scale??6;o.scale.setScalar(a);const m=new e.Mesh(new e.SphereGeometry(1,128,128),new e.MeshBasicMaterial({color:0}));m.renderOrder=1,o.add(m);const b=new e.ShaderMaterial({uniforms:{uRingColor:{value:new e.Color(16770992)},uIntensity:{value:1.7}},vertexShader:H,fragmentShader:J,transparent:!0,depthWrite:!1,blending:e.AdditiveBlending}),h=new e.Mesh(new e.SphereGeometry(1.06,128,128),b);h.renderOrder=2,o.add(h);const u=1.1,l=3,B=256,P=new e.RingGeometry(u,l,B,1);P.rotateX(-Math.PI/2);const W=`${X}
${$}`,g=new e.ShaderMaterial({uniforms:{uTime:{value:0},uColorInner:{value:new e.Color(16761707)},uColorOuter:{value:new e.Color(16761707)},uInnerR:{value:u},uOuterR:{value:l},uSpin:{value:.7},uBeaming:{value:.9},uCamPos:{value:new e.Vector3}},vertexShader:D,fragmentShader:W,transparent:!0,depthWrite:!1,side:e.DoubleSide,blending:e.AdditiveBlending}),w=new e.Mesh(P,g);w.renderOrder=0,o.add(w);const s=1200,d=new e.BufferGeometry,f=new Float32Array(s*3),M=new Float32Array(s),x=new Float32Array(s),C=new Float32Array(s);for(let t=0;t<s;t++){const v=e.MathUtils.lerp(l*.9,l*1.2,Math.random()),r=Math.random()*Math.PI*2;f[t*3+0]=Math.cos(r)*v,f[t*3+1]=(Math.random()-.5)*.5,f[t*3+2]=Math.sin(r)*v,M[t]=e.MathUtils.lerp(.2,.3,Math.random()),x[t]=e.MathUtils.lerp(6,14,Math.random()),C[t]=Math.random()*Math.PI*2}d.setAttribute("position",new e.BufferAttribute(f,3)),d.setAttribute("aSize",new e.BufferAttribute(x,1)),d.setAttribute("aPhase",new e.BufferAttribute(C,1));const G=Y(64),S=new e.ShaderMaterial({uniforms:{uSprite:{value:G},uColor:{value:new e.Color(16755336)},uTime:{value:0}},vertexShader:q,fragmentShader:Q,transparent:!0,depthWrite:!1,blending:e.AdditiveBlending}),_=new e.Points(d,S);_.renderOrder=3,o.add(_);const U=new e.Vector3;return{root:o,update:(t,v)=>{w.rotation.y+=t*.25,g.uniforms.uTime.value=v,g.uniforms.uCamPos.value.copy(i.getWorldPosition(U)),S.uniforms.uTime.value=v;const r=d.getAttribute("position");for(let p=0;p<s;p++){const c=p*3,A=r.array[c+0],O=r.array[c+1],T=r.array[c+2],F=Math.max(.2,Math.hypot(A,T)),z=M[p]*(1.2/F),V=Math.atan2(T,A)+z*t,I=F-t*M[p]*.15,N=O*(1-t*.35),y=I<u*.95,R=y?e.MathUtils.lerp(l*.9,l*1.2,Math.random()):I,k=y?Math.random()*Math.PI*2:V;r.array[c+0]=Math.cos(k)*R,r.array[c+1]=y?(Math.random()-.5)*.5:N,r.array[c+2]=Math.sin(k)*R}r.needsUpdate=!0}}}const ae=async({three:n,camera:e})=>{const i=new n.Group;let o=!1;const a=Z({three:n,camera:e,position:new n.Vector3(0,-35,-120),scale:40});i.add(a.root);const m=await K();return{group:i,dispose:()=>{o=!0,m.dispose()},updater:(u,l)=>{o||(a.update(u,l),e.position.set(-20,-30,80))}}};export{ae as default};
