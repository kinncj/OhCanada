import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Culling/ray';

/** Third-person orbit camera with collision pull-in and optional head bob. */
export class CameraRig {
  readonly camera: UniversalCamera;
  yaw = Math.PI;
  pitch = 0.28;
  distance = 6.5;
  reducedMotion = false;
  private readonly target = new Vector3();
  private readonly desired = new Vector3();
  private readonly smoothed = new Vector3();
  private bobPhase = 0;
  private initialised = false;

  constructor(private readonly scene: Scene) {
    this.camera = new UniversalCamera('player-camera', new Vector3(0, 5, 10), scene);
    this.camera.fov = 1.05; // ~60°
    this.camera.minZ = 0.15;
    this.camera.maxZ = 1200;
    this.camera.inputs.clear(); // driven entirely by our own input adapter
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = Math.min(1.25, Math.max(-0.35, this.pitch + dy));
  }

  /** Ground-plane forward, matching the character's facing for the same yaw. */
  forward(out: Vector3): Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  right(out: Vector3): Vector3 {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).normalize();
  }

  update(dt: number, playerPos: Vector3, speed: number, occluders: AbstractMesh[]): void {
    this.target.copyFrom(playerPos);
    this.target.y += 1.6;
    const cp = Math.cos(this.pitch);
    this.desired.set(
      this.target.x - Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z - Math.cos(this.yaw) * cp * this.distance,
    );
    if (occluders.length > 0) {
      const dir = this.desired.subtract(this.target);
      const len = dir.length();
      dir.normalize();
      const hit = this.scene.pickWithRay(new Ray(this.target, dir, len), (m) => occluders.includes(m as AbstractMesh));
      if (hit?.hit && hit.distance > 0) {
        this.desired.copyFrom(this.target).addInPlace(dir.scale(Math.max(1.2, hit.distance - 0.35)));
      }
    }
    if (!this.initialised) {
      this.smoothed.copyFrom(this.desired);
      this.initialised = true;
    }
    const k = Math.min(1, dt * 10);
    this.smoothed.addInPlace(this.desired.subtract(this.smoothed).scale(k));
    this.camera.position.copyFrom(this.smoothed);
    if (!this.reducedMotion && speed > 0.5) {
      this.bobPhase += dt * Math.min(12, 6 + speed);
      this.camera.position.y += Math.sin(this.bobPhase * 2) * 0.03;
    }
    this.camera.setTarget(this.target);
  }

  snapTo(playerPos: Vector3): void {
    this.initialised = false;
    this.update(0, playerPos, 0, []);
  }
}
