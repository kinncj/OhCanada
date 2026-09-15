/**
 * A ride that does not turn round, backing up. ADR-0043.
 *
 * ## The defect
 *
 * A mode with `drive: "auto"` keeps going the way the player faces
 * (`locomotion.ts#requestedDirection`). That is the whole of auto-move, and on a
 * walk it is right: a walker who turns round faces the other way and walks
 * there. A ride whose art does not turn with its rider (`turnsWithRider: false`,
 * ADR-0031) has a front, and the rule read it backwards. A live-site audit let a
 * stop go by steering back on the Prairies: the car turned its passenger round in
 * the seat, then drove itself backwards at cruise speed, 739 px/s, to the start
 * of the world, and sat pinned against the edge with the brake losing to the
 * drive every frame, the rider half off the glass because the camera cannot
 * scroll past the world's edge. And because steering back lets a stop go and
 * latches what it held, it ran straight past the guide it was trying to return
 * to.
 *
 * ## What this decides
 *
 *  1. **A ride that does not turn has a front**: the way the player spawns
 *     facing, which is right on every level (`level-exit.ts` states that every
 *     level spawns at its left and grows rightwards).
 *  2. **Backing is never automatic.** The automatic drive only ever carries such
 *     a ride forward. Backing is a held drive: it moves only while the player
 *     presses back, and brakes to rest on the mode's own brake when they let go.
 *  3. **Backing is slow.** Capped at the ride's own `backingMaxSpeed`, a level
 *     document number, never a constant here. Going back to something passed is
 *     a short, careful move and not a run at cruise speed.
 *  4. **After backing, an automatic drive waits.** It does not start forward on
 *     its own the moment the ride comes to rest — the player backed up to reach
 *     something, and a ride that left as it arrived would take the offer away
 *     before a thumb could reach it, on a mode that may only engage at rest. It
 *     goes on with a press forward, or when the player engages, exactly as
 *     ADR-0032's stop does. No timer.
 *  5. **The ride's art stays in the world.** A ride that backs up stops where
 *     its tail meets the world's left edge ({@link backingBounds}), so the camera,
 *     which stops scrolling there, keeps the rider and the whole car on screen.
 *
 * A ride that turns with its rider, or no ride at all, is untouched: every
 * answer below is the one the scene gave before this module existed.
 *
 * Pure: no Phaser, no DOM, no clock.
 */

import type { LocomotionState, LocomotionTuning, Ride } from '@application/ports';

import type { LevelBounds } from './ground-profile';
import { MOVE_DEADZONE } from './locomotion';

/** Which strategy steps the player this frame. */
export type BackingDrive =
  /** The mode as the document authored it — and as auto-move set it. */
  | 'forward'
  /** {@link backingTuning}: held, capped, braking when let go. */
  | 'backing'
  /** At rest after backing, with nothing pressed: step the brake, so nothing moves. */
  | 'parked';

export interface BackingFrame {
  /** How fast, and which way, the player is actually travelling. */
  readonly velocityX: number;
  /** The player's own intent this frame: keyboard and finger, already summed. */
  readonly playerMove: number;
}

export interface BackingWatch {
  /** Does the ride this mode moves by have a front? False for no ride, or one that turns. */
  readonly applies: boolean;
  /** Waiting at rest after backing, for a press forward or an engagement. */
  readonly parked: boolean;
  /** Feed this frame, after sampling input and before stepping. */
  update(frame: BackingFrame): BackingDrive;
  /** The player engaged something: an automatic drive may carry them forward again. */
  release(): void;
}

/** The way a ride with a front faces: right, the way every level grows. */
export const FORWARD = 1 as const;

/** Does this ride back up rather than turn round? */
export function backsUp(ride: Ride | null): ride is Ride {
  return ride !== null && !ride.turnsWithRider;
}

/**
 * The mode backing up.
 *
 * `drive: 'held'`, so a zero intent is zero rather than "keep going"; no glide,
 * and the deceleration raised to the mode's own brake (`turnAcceleration`), so
 * letting go stops it in a few pixels — the same brake `auto-stop.ts` applies;
 * and the cap is the ride's `backingMaxSpeed`, with no slope allowance on top of
 * it, because a cap a descent could raise would not be the number the document
 * gave. A ride that declares none keeps the mode's `maxSpeed`, which is still a
 * held, braked move.
 */
export function backingTuning(tuning: LocomotionTuning, ride: Ride | null): LocomotionTuning {
  const declared = ride?.backingMaxSpeed;
  const cap =
    declared !== undefined && Number.isFinite(declared) && declared > 0
      ? Math.min(declared, tuning.maxSpeed)
      : tuning.maxSpeed;
  return {
    ...tuning,
    drive: 'held',
    glide: 0,
    deceleration: tuning.turnAcceleration,
    maxSpeed: cap,
    maxSpeedMultiplierDownhill: 1,
  };
}

/**
 * Where a player may go, with a ride that backs up kept inside the world.
 *
 * The art is drawn unmirrored with its `riderAnchor` on the player's x, so
 * `riderAnchor.x` of it lies behind the rider. The left bound moves in by that
 * much: the tail meets the world's edge and goes no further. The right bound is
 * where the level ends and is never moved (`level-exit.ts`).
 */
export function backingBounds(bounds: LevelBounds, ride: Ride | null): LevelBounds {
  if (!backsUp(ride)) return bounds;
  const left = Math.min(bounds.right, bounds.left + Math.max(0, ride.riderAnchor.x));
  return { left, right: bounds.right };
}

/**
 * The state the forward strategy is stepped with.
 *
 * Backing leaves the passenger turned round in the seat, facing back, and an
 * automatic drive keeps going the way the player faces. At rest, a ride with a
 * front is faced forward before the automatic drive is asked which way to go, so
 * it never reads the passenger's back as the way on.
 */
export function facingForward(state: LocomotionState, ride: Ride | null): LocomotionState {
  if (!backsUp(ride) || state.velocityX !== 0 || state.facing === 'right') return state;
  return { ...state, facing: 'right' };
}

function pressedDirection(move: number): -1 | 0 | 1 {
  if (!Number.isFinite(move) || Math.abs(move) < MOVE_DEADZONE) return 0;
  return move > 0 ? 1 : -1;
}

/** A watch over one level visit, for the ride the player spawns on. */
export function createBacking(ride: Ride | null): BackingWatch {
  const applies = backsUp(ride);
  /* Was the last frame that moved a frame backing up? It is what turns coming
     to rest into waiting, rather than into the automatic drive's next frame. */
  let backed = false;
  let parked = false;

  return {
    applies,
    get parked(): boolean {
      return parked;
    },
    release(): void {
      parked = false;
      backed = false;
    },
    update(frame: BackingFrame): BackingDrive {
      if (!applies) return 'forward';

      const travel = Math.sign(frame.velocityX);
      if (travel === -FORWARD) {
        backed = true;
        return 'backing';
      }
      if (travel === FORWARD) {
        backed = false;
        parked = false;
        return 'forward';
      }

      /* At rest. Pressing back backs up; pressing forward goes forward, at once,
         with or without a lift — nothing about pressing the way the ride faces
         needs a fresh press. */
      const pressed = pressedDirection(frame.playerMove);
      if (pressed === -FORWARD) {
        parked = false;
        return 'backing';
      }
      if (pressed === FORWARD) {
        parked = false;
        backed = false;
        return 'forward';
      }
      if (backed) {
        backed = false;
        parked = true;
      }
      return parked ? 'parked' : 'forward';
    },
  };
}
