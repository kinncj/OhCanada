import type { DistrictId } from './ids';
import type { Vec3 } from './district';

/** ECS-lite: entities are ids; components are plain data. The player is entity 0 by convention. */
export type EntityId = number;

export interface Transform {
  position: Vec3;
  yaw: number;
}

export interface PlayerComponent {
  readonly entity: EntityId;
  district: DistrictId;
  transform: Transform;
  speed: number;
  sprinting: boolean;
  grounded: boolean;
}

export function createPlayer(district: DistrictId, position: Vec3, yaw: number): PlayerComponent {
  return { entity: 0, district, transform: { position, yaw }, speed: 4.5, sprinting: false, grounded: false };
}

export function distance2D(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

export function withinRadius(a: Vec3, b: Vec3, radius: number): boolean {
  return distance2D(a, b) <= radius;
}
