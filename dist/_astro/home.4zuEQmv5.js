import{L as K,a as $,F as ee,b as te,R as se,C as A,c as C,S as w,M as ae,V as _,D as oe,T as re}from"./FullPage.astro_astro_type_script_index_0_lang.UhxFxrQy.js";import{O as ne}from"./OBJLoader.DPBpHw1b.js";import{m as ie}from"./text-animator.vFfjRLf3.js";import"./index.CH_iu5NA.js";class le extends K{constructor(t){super(t)}load(t,a,l,e){const o=this,c=this.path===""?$.extractUrlBase(t):this.path,r=new ee(this.manager);r.setPath(this.path),r.setRequestHeader(this.requestHeader),r.setWithCredentials(this.withCredentials),r.load(t,function(s){try{a(o.parse(s,c))}catch(i){e?e(i):console.error(i),o.manager.itemError(t)}},l,e)}setMaterialOptions(t){return this.materialOptions=t,this}parse(t,a){const l=t.split(`
`);let e={};const o=/\s+/,c={};for(let s=0;s<l.length;s++){let i=l[s];if(i=i.trim(),i.length===0||i.charAt(0)==="#")continue;const m=i.indexOf(" ");let u=m>=0?i.substring(0,m):i;u=u.toLowerCase();let h=m>=0?i.substring(m+1):"";if(h=h.trim(),u==="newmtl")e={name:h},c[h]=e;else if(u==="ka"||u==="kd"||u==="ks"||u==="ke"){const g=h.split(o,3);e[u]=[parseFloat(g[0]),parseFloat(g[1]),parseFloat(g[2])]}else e[u]=h}const r=new ce(this.resourcePath||a,this.materialOptions);return r.setCrossOrigin(this.crossOrigin),r.setManager(this.manager),r.setMaterials(c),r}}class ce{constructor(t="",a={}){this.baseUrl=t,this.options=a,this.materialsInfo={},this.materials={},this.materialsArray=[],this.nameLookup={},this.crossOrigin="anonymous",this.side=this.options.side!==void 0?this.options.side:te,this.wrap=this.options.wrap!==void 0?this.options.wrap:se}setCrossOrigin(t){return this.crossOrigin=t,this}setManager(t){this.manager=t}setMaterials(t){this.materialsInfo=this.convert(t),this.materials={},this.materialsArray=[],this.nameLookup={}}convert(t){if(!this.options)return t;const a={};for(const l in t){const e=t[l],o={};a[l]=o;for(const c in e){let r=!0,s=e[c];const i=c.toLowerCase();switch(i){case"kd":case"ka":case"ks":this.options&&this.options.normalizeRGB&&(s=[s[0]/255,s[1]/255,s[2]/255]),this.options&&this.options.ignoreZeroRGBs&&s[0]===0&&s[1]===0&&s[2]===0&&(r=!1);break}r&&(o[i]=s)}}return a}preload(){for(const t in this.materialsInfo)this.create(t)}getIndex(t){return this.nameLookup[t]}getAsArray(){let t=0;for(const a in this.materialsInfo)this.materialsArray[t]=this.create(a),this.nameLookup[a]=t,t++;return this.materialsArray}create(t){return this.materials[t]===void 0&&this.createMaterial_(t),this.materials[t]}createMaterial_(t){const a=this,l=this.materialsInfo[t],e={name:t,side:this.side};function o(r,s){return typeof s!="string"||s===""?"":/^https?:\/\//i.test(s)?s:r+s}function c(r,s){if(e[r])return;const i=a.getTextureParams(s,e),m=a.loadTexture(o(a.baseUrl,i.url));m.repeat.copy(i.scale),m.offset.copy(i.offset),m.wrapS=a.wrap,m.wrapT=a.wrap,(r==="map"||r==="emissiveMap")&&(m.colorSpace=w),e[r]=m}for(const r in l){const s=l[r];let i;if(s!=="")switch(r.toLowerCase()){case"kd":e.color=A.colorSpaceToWorking(new C().fromArray(s),w);break;case"ks":e.specular=A.colorSpaceToWorking(new C().fromArray(s),w);break;case"ke":e.emissive=A.colorSpaceToWorking(new C().fromArray(s),w);break;case"map_kd":c("map",s);break;case"map_ks":c("specularMap",s);break;case"map_ke":c("emissiveMap",s);break;case"norm":c("normalMap",s);break;case"map_bump":case"bump":c("bumpMap",s);break;case"disp":c("displacementMap",s);break;case"map_d":c("alphaMap",s),e.transparent=!0;break;case"ns":e.shininess=parseFloat(s);break;case"d":i=parseFloat(s),i<1&&(e.opacity=i,e.transparent=!0);break;case"tr":i=parseFloat(s),this.options&&this.options.invertTrProperty&&(i=1-i),i>0&&(e.opacity=1-i,e.transparent=!0);break}}return this.materials[t]=new ae(e),this.materials[t]}getTextureParams(t,a){const l={scale:new _(1,1),offset:new _(0,0)},e=t.split(/\s+/);let o;return o=e.indexOf("-bm"),o>=0&&(a.bumpScale=parseFloat(e[o+1]),e.splice(o,2)),o=e.indexOf("-mm"),o>=0&&(a.displacementBias=parseFloat(e[o+1]),a.displacementScale=parseFloat(e[o+2]),e.splice(o,3)),o=e.indexOf("-s"),o>=0&&(l.scale.set(parseFloat(e[o+1]),parseFloat(e[o+2])),e.splice(o,4)),o=e.indexOf("-o"),o>=0&&(l.offset.set(parseFloat(e[o+1]),parseFloat(e[o+2])),e.splice(o,4)),l.url=e.join(" ").trim(),l}loadTexture(t,a,l,e,o){const c=this.manager!==void 0?this.manager:oe;let r=c.getHandler(t);r===null&&(r=new re(c)),r.setCrossOrigin&&r.setCrossOrigin(this.crossOrigin);const s=r.load(t,l,e,o);return a!==void 0&&(s.mapping=a),s}}var pe=`varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    
    vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

    
    vUv = uv;
    vNormal = modelNormal;
    vPosition = modelPosition.xyz;
}`,me=`varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uSpecularTexture;
uniform vec3 uSunDirection;

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = vec3(0.0);

    float sunOrientation = dot(uSunDirection, normal);
    float dayMix = sunOrientation;
    vec3 dayColor = texture(uDayTexture, vUv).rgb;
    vec3 nightColor = texture(uNightTexture, vUv).rgb;

    vec3 atmosphereDayColor = vec3(0.91, 0.33, 0.05);
    vec3 atmosphereTwilightColor = vec3(0.51, 0.04, 0.0);

    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 10.0);
    float atmosphereDayMix = smoothstep(- 0.5, 1.0, sunOrientation);
    vec3 atmosphereColor = mix(atmosphereTwilightColor, atmosphereDayColor, atmosphereDayMix);

    vec2 specularColor = texture(uSpecularTexture, vUv).rg;
    color = mix(nightColor, dayColor, dayMix);

    float specularMix =  smoothstep(0.9, 1.0, specularColor.g);
    specularMix *= dayMix;
    color = mix(color, vec3(1.0), specularMix);

    color = mix(color, atmosphereColor, fresnel * atmosphereDayMix);

    
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;const G=n=>new le(n),B=n=>new ne(n);function z(n,t){const a=t.material;let l;if(Array.isArray(a))for(const e of a)!l&&e.map&&(l=e.map),e.dispose?.();else a&&(a.map&&(l=a.map),a.dispose?.());t.material=new n.MeshStandardMaterial({map:l,color:16777215,emissive:2236962,roughness:1,metalness:0})}const xe=async({three:n,renderer:t,textureLoader:a,loadingManager:l})=>{const e=new n.Group;e.position.set(-10,-30,50);const o=await ie(),c=t?.capabilities?.getMaxAnisotropy?.()??8,[r,s,i]=await Promise.all([a.loadAsync("/mars/mars.jpg"),a.loadAsync("/mars/mars-night.jpg"),a.loadAsync("/mars/mars-specular.jpg")]);r.colorSpace=n.SRGBColorSpace,s.colorSpace=n.SRGBColorSpace,[r,s,i].forEach(p=>p.anisotropy=c);const m=10,u=new n.SphereGeometry(m,256,256),h=new n.ShaderMaterial({uniforms:{uDayTexture:{value:r},uNightTexture:{value:s},uSpecularTexture:{value:i},uSunDirection:{value:new n.Vector3(-.4,0,.1)}},vertexShader:pe,fragmentShader:me,lights:!1}),g=new n.Mesh(u,h);g.rotation.z=n.MathUtils.degToRad(25.19),e.add(g);const P=await G(l).setResourcePath("/satellite/").loadAsync("/satellite/Satellite.mtl");P.preload();const M=await B(l).setMaterials(P).setResourcePath("/satellite/").loadAsync("/satellite/Satellite.obj");M.traverse(p=>p instanceof n.Mesh&&z(n,p));const b=new n.Group,x=new n.Group;e.add(b),b.add(x);const I=m+3;M.scale.setScalar(.05),M.position.set(I,0,0);const j=n.MathUtils.degToRad(15),T=n.MathUtils.degToRad(10);b.rotation.set(j,T,0);const Q=n.MathUtils.degToRad(180);x.rotation.y=Q,M.rotation.set(0,-20,10),x.add(M);const O=await G(l).setResourcePath("/astronaut/").loadAsync("/astronaut/Astronaut.mtl");O.preload();const v=await B(l).setMaterials(O).setResourcePath("/astronaut/").loadAsync("/astronaut/Astronaut.obj");v.traverse(p=>p instanceof n.Mesh&&z(n,p)),v.rotation.set(1.25,-1,0),v.position.set(10,-40,0),e.add(v);const V=new n.Vector3(0,1,0),q=.015,E=v.quaternion.clone(),N=v.position.clone(),d=new n.Vector3,R=new n.Vector3,D=new n.Euler,F=new n.Quaternion,L=new n.Quaternion,W=.35,k=.1,U=W,S=n.MathUtils.degToRad(8),H=.05,Y=.037,Z=.031,X=.15;return{group:e,dispose:()=>{o.dispose(),e.traverse(p=>{const f=p;f.isMesh&&(f.geometry?.dispose?.(),(Array.isArray(f.material)?f.material:[f.material]).forEach(J=>J?.dispose?.()))}),u.dispose(),h.dispose(),r.dispose(),s.dispose(),i.dispose()},updater:(p,f)=>{g.rotateOnAxis(V,q*p),x.rotateY(X*p),M.rotateZ(.25*p);const y=Math.sqrt(Math.max(p,0));d.x+=-.35*d.x*p+k*y*(Math.random()*2-1),d.y+=-.35*d.y*p+k*y*(Math.random()*2-1),d.z+=-.35*d.z*p+k*y*(Math.random()*2-1),d.length()>U&&d.setLength(U),R.copy(N).add(d),v.position.lerp(R,1-Math.exp(-2.5*p)),D.set(S*Math.sin(2*Math.PI*H*f),S*Math.sin(2*Math.PI*Y*f),S*Math.cos(2*Math.PI*Z*f),"XYZ"),F.setFromEuler(D),L.multiplyQuaternions(E,F),v.quaternion.slerp(L,1-Math.exp(-2*p))}}};export{xe as default};
