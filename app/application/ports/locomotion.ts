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
 * Implementations are pure functions of (state, intent, dt). The seam is declared
 * here because the application composes it and hands it to the scene.
 *
 * WHERE THE IMPLEMENTATION LIVES, and why it is not where this comment used to
 * say. It shipped in `app/adapters/phaser/`, not `app/domain/`, and that is a
 * deviation worth naming rather than quietly leaving: the strategy is pure and
 * belongs in the domain by the argument this file already makes. It is in the
 * adapter because the domain was being edited by another agent in the same
 * session, and moving it later is a file move plus one import — nothing about
 * the module reaches for Phaser, the DOM or a clock. `vitest.config.ts` already
 * measures `app/adapters/**` at the same ≥ 90 % threshold, so it is not
 * unmeasured in the meantime. Move it when the domain is quiet.
 *
 * Implemented as of slice 1 task 1.14 by `app/adapters/phaser/locomotion.ts`:
 * one `step`, eight modes, and every difference between them a number in
 * `content/levels/<id>.json`. The ADR-0008 PROVISIONAL marker is gone because
 * the first call site landed with that task.
 *
 * Three fields were added by that implementation and are recorded here rather
 * than left as folklore. `LocomotionIntent.groundY` joins `slope`: both are
 * terrain samples the caller takes for the strategy, and without the surface
 * height under the player, landing, grounding and slope-following would have had
 * to happen in scene code — which is precisely the thing this port exists to
 * prevent. `LocomotionState.braking` exists so `braked` is emitted once per
 * brake instead of once per frame; `jumpBufferMs` and `jumpHoldMs` exist so
 * `JumpAffordance.bufferMs` and `maxHoldMs` are honoured instead of being
 * tuning nobody reads. None of the three is in `content/schemas/level.schema.json`
 * and none needs to be: they are per-frame state, not authored content.
 */

import type { Result } from '@common/result';

/**
 * The name of a way to move. `level.schema.json#/$defs/locomotionMode`.
 *
 * **Not a union of eight literals any more** (ADR-0023). A mode carries no
 * behaviour: there is exactly one `step`, every mode goes through it, and the
 * only thing that varies is a `LocomotionTuning` read out of a level document —
 * a rule enforced by a gate that strips the comments out of the strategy file
 * and fails if a single mode name survives in the code.
 *
 * So the legal set is *data*, and it lives in
 * `content/game.config.json#/locomotionModes`. That is where a name is
 * validated, which keeps a typo a build failure rather than a load-time
 * surprise. It is the same treatment `LevelId` gets, for the same reason: ten
 * levels are not an enum, and neither are nine ways of crossing them.
 */
export type LocomotionMode = string;

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
  /**
   * Was the player holding *against* their direction of travel last step?
   *
   * Carried in the state so `braked` fires on the frame the brake starts rather
   * than on every frame it lasts. A pure step cannot remember, so the caller
   * hands the memory back; the alternative was de-duplicating the event in the
   * scene, which would have put one mode's feel into scene code.
   */
  readonly braking: boolean;
  /** Remaining jump-buffer window, ms. `JumpAffordance.bufferMs` on a press. */
  readonly jumpBufferMs: number;
  /** How long the current jump has been held, ms. Bounded by `maxHoldMs`. */
  readonly jumpHoldMs: number;
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
  /**
   * Surface height under the player, design-resolution px, y growing downwards.
   *
   * The other half of the terrain sample. A strategy owns landing, grounding and
   * following the ground down a bank — those differ per mode (a canoe never
   * leaves the water, a dogsled lands heavier than a skater) — and it cannot own
   * them without knowing where the ground is. Sampled by the caller from the
   * level's `ground` polyline, so the strategy stays pure and terrain stays data.
   */
  readonly groundY: number;
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
