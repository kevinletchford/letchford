import * as THREE from "three";

export class TwinklingStars {
  public mesh: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(isMobile: boolean) {
    // Determine the number of stars based on the device
    const starCount = isMobile ? 1500 : 4000;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const phases = new Float32Array(starCount);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
       // Distribute randomly on a large sphere surrounding the scene
       const r = 400 + Math.random() * 600;
       const theta = 2 * Math.PI * Math.random();
       const phi = Math.acos(2 * Math.random() - 1);
       
       positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta); // x
       positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta); // y
       positions[i * 3 + 2] = r * Math.cos(phi); // z
       
       // Slower twinkle for most, faster for some
       phases[i] = Math.random() * Math.PI * 2;
       
       // Randomize relative sizes so some stand out
       sizes[i] = Math.random() * 2.5 + 1.0; 
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    // A custom shader to independently twinkle each star over time
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Twinkle effect: sine wave based on time and individual phase.
          // Add some unpredictability to individual speed based on fract of aPhase
          float speed = 0.5 + fract(aPhase * 3.14) * 1.5; 
          float twinkle = sin(uTime * speed + aPhase) * 0.5 + 0.5;
          
          // Keep a base opacity so they don't disappear completely
          vAlpha = twinkle * 0.7 + 0.3; 
          
          // Perspective scale attenuation
          gl_PointSize = aSize * (500.0 / -mvPosition.z); 
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          // Circular particle
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;
          
          // Soft radial gradient for a tiny glow effect
          float alpha = (0.5 - dist) * 2.0 * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.mesh = new THREE.Points(geometry, this.material);
  }

  public update(t: number) {
    this.material.uniforms.uTime.value = t;
  }
}
