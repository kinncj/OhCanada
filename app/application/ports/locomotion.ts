/**
 * Locomotion — the strategy seam for how a player moves.
 *
 * TrueNorth traverses Canada by walking, canoe, skate, bike, train, horse,
 * skateboard and dogsled. None of that may become a scene change: a scene reads
 * intent, calls `step`, and applies the result. Adding a mode is
 * **one strategy plus level data** — never an edit to a scene, a camera or an
 * input handler.
 *
 * Traversal stays one-thumb throughout (CLAUDE.md): hold to move, tap to
 * jump/interact, tap an NPC or POI to engage, and no trick system — so a mode is
 * described entirely by *tuning*, not by new verbs. `LocomotionTuning` and its
 * satellites are declared in `content/schemas/level.schema.json` (`$defs`
 * `locomotionTuning`, `jumpAffordance`, `interactionAffordance`,
 * `locomotionAnimationBinding`, `locomotionMode`, `movementDrive`), because they
 * are part of a level document; the contract test mirrors each of them here.
 *
 * Implementations are pure functions of (state, intent, dt) and therefore live in
 * the domain, not in an adapter — they are covered by the ≥ 90 % gate. The seam is
 * declared here because the application composes it and hands it to the scene.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call site: slice 1 task 1.14 (skate locomotion). Eight modes are
 * declared here and zero have been built, so the tuning record is validated but
 * still untried; the implementer may change it — schema first, then this file —
 * and removes this marker in the same change.
 */

import type { Result } from '@common/result';

/** `level.schema.json#/$defs/locomotionMode`. */
export type LocomotionMode =
  | 'walk'
  | 'canoe'
  | 'skate'
  | 'bike'
  | 'train'
  | 'horse'
  | 'skateboard'
  | 'dogsled';

/**
 * How movement is driven.
 *  - `held`: the player holds to move and stops on release (walk, bike, skate).
 *  - `auto`: movement is continuous and the player only steers or brakes
 *    (train; also every mode when the auto-move accessibility option is on).
 */
/** `level.schema.json#/$defs/movementDrive`. */
export type MovementDrive = 'held' | 'auto';

/**
 * What a tap does in this mode when the player is not touching an NPC or POI.
 *
 * `level.schema.json#/$defs/jumpAffordance`.
 */
export interface JumpAffordance {
  /** Upward impulse in design-resolution px/s. */
  readonly impulse: number;
  /** Hold-to-jump-higher window; 0 makes the jump fixed-height. */
  readonly maxHoldMs: number;
  /** 0–1 fraction of ground acceleration available in the air. */
  readonly airControl: number;
  /** Forgiveness after leaving the ground, and before landing. */
  readonly coyoteMs: number;
  readonly bufferMs: number;
  /** 1 for a single jump; 2 for a bunny-hop mode. Never a trick system. */
  readonly maxJumps: number;
}

/**
 * How close, and how still, the player must be to engage an NPC or POI.
 *
 * `level.schema.json#/$defs/interactionAffordance`.
 */
export interface InteractionAffordance {
  /** Reach in design-resolution px. */
  readonly reachPx: number;
  /** Some modes (canoe, train) require coming to rest before engaging. */
  readonly requiresStop: boolean;
  /** Whether a tap engages while moving, or only when idle. */
  readonly whileMoving: boolean;
  /** Speed the mode decelerates to when an interaction starts. */
  readonly approachSpeed: number;
}

/**
 * Everything a level's JSON must provide to offer a mode, exactly as
 * `level.schema.json#/$defs/locomotionTuning` validates it. No field is optional:
 * the two affordances are nullable instead, because `null` *is* the statement
 * that the mode cannot jump or cannot interact, and an absent key would leave
 * that unsaid.
 */
export interface LocomotionTuning {
  readonly mode: LocomotionMode;
  /** Cruise speed, design-resolution px/s. */
  readonly maxSpeed: number;
  /** px/s² while input is held. */
  readonly acceleration: number;
  /** px/s² while input is released — friction, edging, paddling drag. */
  readonly deceleration: number;
  /**
   * px/s² while input is held *against* the current direction — the brake, and
   * then the turn.
   *
   * Strictly between `deceleration` and `acceleration`, and both halves of that
   * band come from TN-LEVEL-03: above `deceleration` so holding the other way
   * stops you in a shorter distance than a free glide, below `acceleration` so
   * reaching cruise speed the other way takes longer than starting from rest.
   * An earlier comment here said "high for skate/canoe", which is backwards — a
   * high acceleration makes reversing *faster*. The band is asserted by
   * `tests/unit/contracts/locomotion-tuning-is-coherent.test.ts`, because JSON
   * Schema cannot compare two sibling values.
   */
  readonly turnAcceleration: number;
  /** 0–1. How much momentum survives an input release; ice and water sit near 1. */
  readonly glide: number;
  /** Speed cap on a downhill/tailwind segment, as a multiple of `maxSpeed`. */
  readonly maxSpeedMultiplierDownhill: number;
  readonly drive: MovementDrive;
  /** `null` means this mode cannot jump (canoe, train). */
  readonly jump: JumpAffordance | null;
  /** `null` means this mode cannot engage; the player must dismount first. */
  readonly interaction: InteractionAffordance | null;
  /** Character state-machine input names this mode drives (see `ICharacterRenderer`). */
  readonly animation: LocomotionAnimationBinding;
  /** Localiser key naming the mode for the a11y live region and the HUD. */
  readonly labelKey: string;
}

/** `level.schema.json#/$defs/locomotionAnimationBinding`. */
export interface LocomotionAnimationBinding {
  /** Number input fed normalised speed (0–1). */
  readonly speedInput: string;
  /** Bool input set while airborne. Absent when the mode cannot jump. */
  readonly airborneInput?: string;
  /** Trigger fired on take-off, on landing, and on a hard stop. */
  readonly jumpTrigger?: string;
  readonly landTrigger?: string;
  readonly brakeTrigger?: string;
}

/** Movement state, expressed in design-resolution units. Plain data, no entity refs. */
export interface LocomotionState {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly grounded: boolean;
  readonly facing: 'left' | 'right';
  /** Milliseconds since leaving the ground; 0 while grounded. Drives coyote time. */
  readonly airborneMs: number;
  readonly jumpsUsed: number;
}

/** One frame of player intent, already normalised by the input adapter. */
export interface LocomotionIntent {
  /** -1 … 1. Auto-move and single-switch synthesise this. */
  readonly move: number;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  readonly interactPressed: boolean;
  /** Terrain slope at the player, -1 (steep down) … 1 (steep up). */
  readonly slope: number;
}

/** Facts the step produced, published on the event bus for audio, VFX and subtitles. */
export type LocomotionEvent =
  | { readonly kind: 'took-off' }
  | { readonly kind: 'landed'; readonly impactSpeed: number }
  | { readonly kind: 'started-moving' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'braked'; readonly fromSpeed: number }
  | { readonly kind: 'interaction-requested' };

export interface LocomotionStep {
  readonly state: LocomotionState;
  readonly events: readonly LocomotionEvent[];
  /** Normalised 0–1 speed for `LocomotionAnimationBinding.speedInput`. */
  readonly animationSpeed: number;
}

export interface Locomotion {
  readonly mode: LocomotionMode;
  readonly tuning: LocomotionTuning;
  /** Pure: same inputs, same output. `dtSeconds` is already clamped by the caller. */
  step(state: LocomotionState, intent: LocomotionIntent, dtSeconds: number): LocomotionStep;
  /** Neutral starting state at a spawn point. */
  spawn(x: number, y: number, facing: 'left' | 'right'): LocomotionState;
}

/**
 * The registry that makes "data plus one strategy" true. A level names a mode in
 * JSON; the factory finds the strategy and applies the level's tuning to it. An
 * unregistered mode fails as `unsupported` at load time, not mid-level.
 */
export interface LocomotionFactory {
  readonly modes: readonly LocomotionMode[];
  create(tuning: LocomotionTuning): Result<Locomotion>;
}
