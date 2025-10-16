import{g as o}from"./index.CH_iu5NA.js";import{l as i,O as e,k as n}from"./FullPage.astro_astro_type_script_index_0_lang.UhxFxrQy.js";var r=`uniform float uTime;

varying vec3 vPosition;
varying vec3 vNormal;

float random2D(vec2 value)
{
    return fract(sin(dot(value.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main()
{
    
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    
    float glitchTime = uTime - modelPosition.y;
    float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) +  sin(glitchTime * 8.76);
    glitchStrength /= 3.0;
    glitchStrength = smoothstep(0.3, 1.0, glitchStrength);
    glitchStrength *= 0.025;
    modelPosition.x += (random2D(modelPosition.xz + uTime) - 0.5) * glitchStrength;
    modelPosition.z += (random2D(modelPosition.zx + uTime) - 0.5) * glitchStrength;

    
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    
    vec4 modelNormal = modelMatrix * vec4(normal, 0.0);

    
    vPosition = modelPosition.xyz;
    vNormal = modelNormal.xyz;
}`,a=`uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;

varying vec3 vPosition;
varying vec3 vNormal;

void main()
{
    
    vec3 normal = normalize(vNormal);
    if(!gl_FrontFacing)
        normal *= - 1.0;

    
    float stripes = mod((vPosition.y - uTime * 0.02) * 30.0, 1.0);
    stripes = pow(stripes, 5.0);

    
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    
    float falloff = smoothstep(0.8, 0.2, fresnel);

    
    float holographic = stripes * fresnel;
    holographic += fresnel * 1.25;
    holographic *= falloff;

    float alpha = holographic * uAlpha;         
    gl_FragColor = vec4(uColor, alpha);

    
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;o.registerPlugin(i,e,n);n.defaults({scroller:void 0});export{a as f,r as v};
