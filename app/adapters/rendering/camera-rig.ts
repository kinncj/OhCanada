import * as THREE from 'three/webgpu';

/** Third-person orbit camera with BVH-accelerated collision pull-in and optional head bob. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.28;
  distance = 6.5;
  reducedMotion = false;
  private readonly target = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private bobPhase = 0;
  private smoothed = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 900);
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.35, 1.25);
  }

  /** Forward direction on the ground plane; matches the character's facing for the same yaw. */
  forward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  right(out: THREE.Vector3): THREE.Vector3 {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).normalize();
  }

  update(dt: number, playerPos: THREE.Vector3, speed: number, occluders: THREE.Object3D[]): void {
    this.target.copy(playerPos).add(new THREE.Vector3(0, 1.6, 0));
    const cp = Math.cos(this.pitch);
    this.desired.set(this.target.x - Math.sin(this.yaw) * cp * this.distance, this.target.y + Math.sin(this.pitch) * this.distance, this.target.z - Math.cos(this.yaw) * cp * this.distance);
    // Pull in when something blocks the view.
    const dir = this.desired.clone().sub(this.target);
    const len = dir.length();
    dir.normalize();
    this.raycaster.set(this.target, dir);
    this.raycaster.far = len;
    const hits = this.raycaster.intersectObjects(occluders, false);
    if (hits[0]) this.desired.copy(this.target).addScaledVector(dir, Math.max(1.2, hits[0].distance - 0.35));
    if (this.smoothed.lengthSq() === 0) this.smoothed.copy(this.desired);
    this.smoothed.lerp(this.desired, Math.min(1, dt * 10));
    this.camera.position.copy(this.smoothed);
    if (!this.reducedMotion && speed > 0.5) {
      this.bobPhase += dt * Math.min(12, 6 + speed);
      this.camera.position.y += Math.sin(this.bobPhase * 2) * 0.03;
    }
    this.camera.lookAt(this.target);
  }

  snapTo(playerPos: THREE.Vector3): void {
    this.smoothed.set(0, 0, 0);
    this.update(0, playerPos, 0, []);
  }
}
