import { EntityManager, Vehicle, WanderBehavior, Vector3 as YVector3, Time } from 'yuka';

export interface NpcPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly speed: number;
}

interface NpcRecord {
  vehicle: Vehicle;
  home: YVector3;
  radius: number;
  behavior: 'idle' | 'wander' | 'patrol';
  paused: boolean;
  faceYaw: number | null;
}

/**
 * Yuka steering for NPCs: wanderers roam inside a home radius, idle NPCs stand still, and every
 * NPC turns to face the player while a conversation is open.
 */
export class YukaNpcBrain {
  private readonly manager = new EntityManager();
  private readonly time = new Time();
  private readonly npcs = new Map<string, NpcRecord>();
  private heightAt: (x: number, z: number) => number = () => 0;

  setHeightFunction(fn: (x: number, z: number) => number): void {
    this.heightAt = fn;
  }

  add(id: string, position: readonly [number, number, number], behavior: 'idle' | 'wander' | 'patrol', radius = 6): void {
    const vehicle = new Vehicle();
    vehicle.position.set(position[0], position[1], position[2]);
    vehicle.maxSpeed = 1.1;
    vehicle.maxForce = 4;
    vehicle.updateOrientation = true;
    if (behavior !== 'idle') {
      const wander = new WanderBehavior(2.5, 1.2, 0.6);
      vehicle.steering.add(wander);
    }
    this.manager.add(vehicle);
    this.npcs.set(id, { vehicle, home: new YVector3(position[0], position[1], position[2]), radius, behavior, paused: false, faceYaw: null });
  }

  clear(): void {
    this.manager.clear();
    this.npcs.clear();
  }

  /** Pause movement and face a world point (e.g. the player) or resume. */
  attend(id: string, towards: readonly [number, number, number] | null): void {
    const n = this.npcs.get(id);
    if (!n) return;
    if (towards) {
      n.paused = true;
      n.faceYaw = Math.atan2(towards[0] - n.vehicle.position.x, towards[2] - n.vehicle.position.z);
      n.vehicle.velocity.set(0, 0, 0);
    } else {
      n.paused = false;
      n.faceYaw = null;
    }
  }

  update(): void {
    const delta = this.time.update().getDelta();
    for (const n of this.npcs.values()) n.vehicle.active = !n.paused && n.behavior !== 'idle';
    this.manager.update(delta);
    for (const n of this.npcs.values()) {
      const v = n.vehicle;
      // Keep wanderers in their home radius.
      const dx = v.position.x - n.home.x;
      const dz = v.position.z - n.home.z;
      const d = Math.hypot(dx, dz);
      if (d > n.radius) {
        const k = n.radius / d;
        v.position.x = n.home.x + dx * k;
        v.position.z = n.home.z + dz * k;
        v.velocity.multiplyScalar(-0.5);
      }
      v.position.y = this.heightAt(v.position.x, v.position.z);
    }
  }

  pose(id: string): NpcPose | null {
    const n = this.npcs.get(id);
    if (!n) return null;
    const v = n.vehicle;
    const speed = Math.hypot(v.velocity.x, v.velocity.z);
    const yaw = n.faceYaw ?? (speed > 0.05 ? Math.atan2(v.velocity.x, v.velocity.z) : Math.atan2(v.rotation.y, v.rotation.w) * 2);
    return { x: v.position.x, y: v.position.y, z: v.position.z, yaw, speed };
  }
}
