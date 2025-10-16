varying vec2 vUv;
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


    // Final color
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}