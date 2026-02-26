import * as THREE from "three";

export class ShootingStars {
  public mesh: THREE.InstancedMesh;
  private count = 20;
  private dummy = new THREE.Object3D();
  
  private starData: {
    progress: number;
    speed: number;
    delay: number;
    startX: number;
    startY: number;
    startZ: number;
    dirX: number;
    dirY: number;
    dirZ: number;
    scaleBase: number;
    length: number;
  }[] = [];

  constructor(isMobile: boolean) {
    this.count = isMobile ? 5 : 12; // Slightly more stars overall
    
    // A thin cone to represent the streak (tail fading out)
    const geometry = new THREE.ConeGeometry(0.2, 20, 4);
    geometry.rotateX(Math.PI / 2); // point along Z axis
    
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    
    for (let i = 0; i < this.count; i++) {
      this.resetStar(i);
      // Stagger initial delays
      this.starData[i].delay = Math.random() * 12; 
      this.starData[i].progress = 0;
    }
  }

  private resetStar(index: number) {
    // Generate far away
    // Since world is a starfield background, place them at a large radius
    const radius = 150 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1); // Spherical distribution
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    // Random direction generally across the sky, horizontally biased
    let dirX = (Math.random() - 0.5) * 2;
    let dirY = (Math.random() - 0.5) * 0.4; // Restrict vertical movement
    let dirZ = (Math.random() - 0.5) * 2;
    
    // Ensure we don't accidentally get a zero vector horizontally
    if (Math.abs(dirX) < 0.1 && Math.abs(dirZ) < 0.1) {
      dirX = 1;
    }
    
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    
    this.starData[index] = {
      progress: 0,
      speed: 400 + Math.random() * 600, // Faster!
      delay: Math.random() * 8 + 2, // 2 to 10 seconds delay between showing up
      startX: x,
      startY: y,
      startZ: z,
      dirX: dirX / dirLen,
      dirY: dirY / dirLen,
      dirZ: dirZ / dirLen,
      scaleBase: 0.3 + Math.random() * 0.7,
      length: 15 + Math.random() * 35
    };
    
    this.updateMatrix(index);
  }

  private updateMatrix(index: number) {
    const data = this.starData[index];
    
    if (data.delay > 0) {
      this.dummy.scale.set(0, 0, 0);
    } else {
      const currentX = data.startX + data.dirX * data.progress;
      const currentY = data.startY + data.dirY * data.progress;
      const currentZ = data.startZ + data.dirZ * data.progress;
      
      this.dummy.position.set(currentX, currentY, currentZ);
      
      // Point in the direction of travel
      const target = this.dummy.position.clone();
      target.x += data.dirX;
      target.y += data.dirY;
      target.z += data.dirZ;
      this.dummy.lookAt(target);
      
      // Scale: start small, peak, then stretch but fade out (handled by scale)
      // distance traveled relative to total rough lifespan
      const maxDist = 1000;
      const lifeRatio = data.progress / maxDist;
      
      // A simple envelope that fades out
      const sizeMultiplier = Math.max(0, 1 - lifeRatio);
      
      this.dummy.scale.set(data.scaleBase * sizeMultiplier, data.scaleBase * sizeMultiplier, (data.length / 20) * sizeMultiplier);
    }
    
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }

  public update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      const data = this.starData[i];
      if (data.delay > 0) {
        data.delay -= dt;
      } else {
        data.progress += data.speed * dt;
        if (data.progress > 1500) { // Disappear after it travels far
          this.resetStar(i);
        }
      }
      this.updateMatrix(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
