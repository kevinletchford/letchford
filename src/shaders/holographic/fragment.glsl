uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;

varying vec3 vPosition;
varying vec3 vNormal;

void main()
{
    // Normal
    vec3 normal = normalize(vNormal);
    if(!gl_FrontFacing)
        normal *= - 1.0;

    // Stripes
    float stripes = mod((vPosition.y - uTime * 0.02) * 30.0, 1.0);
    stripes = pow(stripes, 5.0);

    // Fresnel
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    // Falloff
    float falloff = smoothstep(0.8, 0.2, fresnel);

    // Holographic
    float holographic = stripes * fresnel;
    holographic += fresnel * 1.25;
    holographic *= falloff;

    float alpha = holographic * uAlpha;         // <— scale down opacity here
    gl_FragColor = vec4(uColor, alpha);

    // Final color
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}