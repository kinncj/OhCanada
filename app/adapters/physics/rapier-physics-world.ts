import RAPIER from '@dimforge/rapier3d-compat';
import type { ColliderHandle, PhysicsWorldPort } from '@application/engine-ports';
import type { Vec3 } from '@domain/district';

const GRAVITY = -18;
const MAX_FALL = -40;

interface CharacterRecord {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  verticalVelocity: number;
}

/** Rapier behind PhysicsWorldPort. Static colliders are tracked so a district can be unloaded in one call. */
export class RapierPhysicsWorld implements PhysicsWorldPort {
  private world!: RAPIER.World;
  private readonly statics = new Map<ColliderHandle, RAPIER.Collider>();
  private readonly characters = new Map<ColliderHandle, CharacterRecord>();
  private ready = false;

  async init(): Promise<void> {
    if (this.ready) return;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.ready = true;
  }

  addHeightfield(center: Vec3, size: number, heights: Float32Array, rows: number, cols: number, _maxHeight: number): ColliderHandle {
    // Rapier heightfield: nrows x ncols subdivisions, column-major heights, scaled to size.
    const desc = RAPIER.ColliderDesc.heightfield(rows - 1, cols - 1, heights, { x: size, y: 1, z: size }).setTranslation(center[0], center[1], center[2]);
    const c = this.world.createCollider(desc);
    this.statics.set(c.handle, c);
    return c.handle;
  }

  addBox(center: Vec3, halfExtents: Vec3, rotationY = 0): ColliderHandle {
    const q = quatY(rotationY);
    const desc = RAPIER.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2]).setTranslation(center[0], center[1], center[2]).setRotation(q);
    const c = this.world.createCollider(desc);
    this.statics.set(c.handle, c);
    return c.handle;
  }

  addCylinder(center: Vec3, halfHeight: number, radius: number): ColliderHandle {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius).setTranslation(center[0], center[1], center[2]);
    const c = this.world.createCollider(desc);
    this.statics.set(c.handle, c);
    return c.handle;
  }

  removeCollider(handle: ColliderHandle): void {
    const c = this.statics.get(handle);
    if (c) {
      this.world.removeCollider(c, false);
      this.statics.delete(handle);
    }
  }

  clearStatic(): void {
    for (const c of this.statics.values()) this.world.removeCollider(c, false);
    this.statics.clear();
  }

  createCharacter(position: Vec3, radius: number, halfHeight: number): ColliderHandle {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position[0], position[1], position[2]);
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight, radius), body);
    const controller = this.world.createCharacterController(0.05);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    controller.enableAutostep(0.5, 0.3, true);
    controller.enableSnapToGround(0.4);
    controller.setApplyImpulsesToDynamicBodies(false);
    this.characters.set(collider.handle, { body, collider, controller, verticalVelocity: 0 });
    return collider.handle;
  }

  setCharacterPosition(handle: ColliderHandle, position: Vec3): void {
    const rec = this.characters.get(handle);
    if (!rec) return;
    rec.body.setNextKinematicTranslation({ x: position[0], y: position[1], z: position[2] });
    rec.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    rec.verticalVelocity = 0;
  }

  private lastDt = 1 / 60;

  moveCharacter(handle: ColliderHandle, desired: Vec3): { position: Vec3; grounded: boolean } {
    const rec = this.characters.get(handle);
    if (!rec) return { position: desired, grounded: false };
    const dt = this.lastDt;
    // desired[1] > 0 is a jump impulse request (velocity), otherwise gravity applies
    if (desired[1] > 0 && rec.controller.computedGrounded()) rec.verticalVelocity = desired[1];
    rec.verticalVelocity = Math.max(MAX_FALL, rec.verticalVelocity + GRAVITY * dt);
    const delta = { x: desired[0], y: rec.verticalVelocity * dt, z: desired[2] };
    rec.controller.computeColliderMovement(rec.collider, delta, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = rec.controller.computedMovement();
    const grounded = rec.controller.computedGrounded();
    if (grounded && rec.verticalVelocity < 0) rec.verticalVelocity = 0;
    const t = rec.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    rec.body.setNextKinematicTranslation(next);
    return { position: [next.x, next.y, next.z], grounded };
  }

  step(dt: number): void {
    this.lastDt = Math.min(dt, 1 / 30);
    this.world.timestep = this.lastDt;
    this.world.step();
  }
}

function quatY(angle: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
}
