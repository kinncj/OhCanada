/**
 * One locomotion strategy. Eight modes. No mode names in the code.
 *
 * Task 1.14's acceptance is "tuning from level JSON; walk and skate differ by
 * data only", and the way that is made true rather than claimed is structural:
 * there is exactly one `step` below, every mode goes through it, and the only
 * thing that varies is a `LocomotionTuning` record read out of
 * `content/levels/<id>.json`. `tests/unit/adapters/phaser/locomotion.test.ts`
 * strips the comments out of this file and fails if a single mode name survives
 * in the code, because "differ by data only" is exactly the claim that decays
 * into `if (mode === 'skate')` the first time a mode needs one more thing.
 *
 * ## The feel, as relationships (TN-LEVEL-03)
 *
 * The story states skating as relationships, not magic numbers, so tuning a
 * level does not rewrite the tests. Each one lands on a specific line here:
 *
 *   - *speed builds up* — acceleration is a rate, so speed is a ramp and never a
 *     step. A level tunes how steep.
 *   - *releasing does not stop the skater* — the coast decays at
 *     `deceleration x (1 - glide)`. `glide` is the fraction of momentum that
 *     survives a release, so ice (0.9) coasts nine times as far as pavement
 *     (0.1) on the same `deceleration`, which is TN-LEVEL-03's "at least five
 *     times as far as the walker" with room to spare.
 *   - *turning around costs time* — holding against the current direction uses
 *     `turnAcceleration`, which the schema and
 *     `tests/unit/contracts/locomotion-tuning-is-coherent.test.ts` hold strictly
 *     between `deceleration` and `acceleration`: harder than a free glide (so
 *     the brake is a brake) and softer than starting from rest (so the turn
 *     costs time).
 *   - *no instant stop* — the reversing branch clamps at zero rather than
 *     through it, so there is always at least one frame at rest, and the step is
 *     linear in `dt` with `dt` bounded, so a single frame can only ever remove
 *     `turnAcceleration x MAX_STEP_SECONDS` of speed.
 *   - *a slope adds speed, up to a stated limit* — the slope raises and lowers
 *     the **cap**, it does not add force. The cap can therefore never exceed
 *     `maxSpeed x maxSpeedMultiplierDownhill`, which is the assertion, rather
 *     than approximately obeying it.
 *   - *a hop keeps the momentum* — nothing touches horizontal velocity while
 *     airborne except the player's own input at `airControl`, so landing speed
 *     equals take-off speed.
 *
 * ## Why `dt` is clamped here as well as by the caller
 *
 * The port says the caller clamps. It still clamps here, because "speed never
 * falls from above half of maxSpeed to 0 inside a single frame" is a property of
 * *this function*, and a pure function that violates its own contract for some
 * `dt` has not got that property — it has an unwritten precondition. A backgrounded
 * tab, a breakpoint, or a slow first frame all produce a `dt` big enough to brake
 * a skater from cruise to zero in one step. Clamping trades a moment of slow
 * motion after a stall for an invariant that always holds.
 *
 * Pure: same inputs, same output. No Phaser, no DOM, no clock.
 */

import type {
  Locomotion,
  LocomotionEvent,
  LocomotionFactory,
  LocomotionIntent,
  LocomotionState,
  LocomotionStep,
  LocomotionTuning,
} from '@application/ports';
import { appErr, ok, type Result } from '@common/result';

import { LOCOMOTION_MODES } from './level-document';

/**
 * The longest step the simulation will take, ~33 ms.
 *
 * Two jobs. It bounds how much velocity one call can change, which is what makes
 * the single-frame invariants above true rather than usually true; and it stops
 * the spiral of death, where a slow frame produces a bigger step which produces
 * a slower frame.
 */
export const MAX_STEP_SECONDS = 1 / 30;

/**
 * Downward acceleration, design-resolution px/s^2.
 *
 * An engine constant and not a level field, and that is a decision worth being
 * explicit about: `level.schema.json#/$defs/jumpAffordance` has `impulse`,
 * `maxHoldMs`, `airControl`, `coyoteMs`, `bufferMs` and `maxJumps` — and no
 * gravity. So a level tunes how *hard* a character jumps and how long the jump
 * is controllable, but every level falls at the same rate. That is coherent
 * (gravity is a property of the world, not of a canoe) and it is enough for the
 * eight modes named in `docs/plan/slices.md`; if a level ever needs the moon, the
 * schema is what changes, not this file.
 *
 * 3200 with Ottawa's 980 px/s impulse gives a ~150 px hop lasting ~0.6 s, which
 * clears a skateway crack and does not read as a jetpack.
 */
export const GRAVITY_PX_S2 = 3200;

/**
 * Below this, an analogue stick is at rest.
 *
 * Digital devices report exactly -1, 0 or 1 (`InputFrame.moveAxis`), so this
 * only ever matters for a gamepad — but without it a resting stick would trickle
 * a hundredth of `acceleration` into the skater every frame and "the player does
 * not move while a card is open" would be false by a pixel a second.
 */
export const MOVE_DEADZONE = 0.15;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

/** Where the player may go in world x. Level geometry, not tuning — see `applyBounds`. */
export interface MovementBounds {
  readonly left: number;
  readonly right: number;
}

/**
 * The direction the player is asking for, after the deadzone and after `drive`.
 *
 * `drive: 'auto'` is the whole of the train, and of the auto-move and
 * single-switch accessibility profiles: with no input, keep going the way you
 * are already facing. One expression, driven by one enum in the level file —
 * "the skater moves along the canal without any input" (TN-LEVEL-07) is a
 * setting, not a second code path.
 */
function requestedDirection(tuning: LocomotionTuning, state: LocomotionState, move: number): number {
  if (Math.abs(move) >= MOVE_DEADZONE) return Math.sign(move);
  return tuning.drive === 'auto' ? (state.facing === 'left' ? -1 : 1) : 0;
}

/**
 * The speed ceiling on this frame's terrain, as a multiple of `maxSpeed`.
 *
 * Symmetric in one number: a full descent multiplies the cap by
 * `maxSpeedMultiplierDownhill` and a full climb divides by it. A mode that
 * declares `1` is flat-footed at every gradient, which is how a train or a canoe
 * says "terrain does not move me".
 */
function speedCap(tuning: LocomotionTuning, uphillGrade: number): number {
  const multiplier = Math.max(1, tuning.maxSpeedMultiplierDownhill);
  const downhill = Math.max(0, -uphillGrade);
  const uphill = Math.max(0, uphillGrade);
  const scale = 1 + (multiplier - 1) * downhill - (1 - 1 / multiplier) * uphill;
  return tuning.maxSpeed * scale;
}

/**
 * Build the strategy for one tuning record.
 *
 * Exported so a test can build a walk and a skate out of two JSON records and
 * compare them, which is the only honest way to assert "they differ by data
 * only": the two objects come from the same call.
 */
export function createLocomotion(tuning: LocomotionTuning): Locomotion {
  const step = (
    state: LocomotionState,
    intent: LocomotionIntent,
    dtSeconds: number,
  ): LocomotionStep => {
    const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, MAX_STEP_SECONDS);
    const events: LocomotionEvent[] = [];

    const direction = requestedDirection(tuning, state, intent.move);
    const jump = tuning.jump;
    const airControl = jump === null ? 0 : jump.airControl;
    const control = state.grounded ? 1 : airControl;

    /* ---------------------------------------------------------------- vertical
       Resolved before the horizontal step so `grounded` is this frame's answer:
       a hop taken this frame must not also get a frame of ground friction. */
    let velocityY = state.velocityY;
    let grounded = state.grounded;
    let airborneMs = state.airborneMs;
    let jumpsUsed = state.jumpsUsed;
    let jumpBufferMs = Math.max(0, state.jumpBufferMs - dt * 1000);
    let jumpHoldMs = state.jumpHoldMs;

    if (intent.jumpPressed && jump !== null) jumpBufferMs = jump.bufferMs;

    const withinCoyote = jump !== null && airborneMs <= jump.coyoteMs;
    const wantsJump = jump !== null && (intent.jumpPressed || jumpBufferMs > 0);
    if (wantsJump && jump !== null && (grounded || withinCoyote) && jumpsUsed < jump.maxJumps) {
      velocityY = -jump.impulse;
      grounded = false;
      jumpsUsed += 1;
      airborneMs = 0;
      jumpHoldMs = 0;
      jumpBufferMs = 0;
      events.push({ kind: 'took-off' });
    }

    /* ------------------------------------------------------------- horizontal */
    const travel = Math.sign(state.velocityX);
    const facingSign = state.facing === 'left' ? -1 : 1;
    const along = direction !== 0 ? direction : travel !== 0 ? travel : facingSign;
    /* Positive is uphill *for the way this player is going*, which is why the
       terrain sample is multiplied by the direction of travel rather than used
       raw: the same bank is a descent one way and a climb the other. */
    const uphillGrade = clamp(intent.slope, -1, 1) * along;
    const cap = speedCap(tuning, uphillGrade);

    let velocityX = state.velocityX;
    let braking = false;

    if (direction !== 0 && (velocityX === 0 || Math.sign(velocityX) === direction)) {
      const next = velocityX + direction * tuning.acceleration * control * dt;
      /* Only ever a ceiling: a skater already above the cap (they came off a
         descent) keeps what they had and coasts it off, rather than snapping
         down to the cap the instant the ground levels out. */
      const ceiling = Math.max(cap, Math.abs(velocityX));
      velocityX = Math.abs(next) > ceiling ? direction * ceiling : next;
    } else if (direction !== 0 && velocityX !== 0) {
      braking = true;
      const fromSpeed = Math.abs(velocityX);
      const next = velocityX + direction * tuning.turnAcceleration * control * dt;
      /* Stop *at* zero, never through it: TN-LEVEL-03 requires the speed to pass
         through 0 before the player moves the other way, so a frame that would
         overshoot is truncated and the reversal starts on the next one. */
      velocityX = Math.sign(next) === direction ? 0 : next;
      if (!state.braking) events.push({ kind: 'braked', fromSpeed });
    } else if (grounded) {
      const friction = tuning.deceleration * (1 - clamp(tuning.glide, 0, 1)) * dt;
      velocityX = Math.abs(velocityX) <= friction ? 0 : velocityX - Math.sign(velocityX) * friction;
    }

    if (state.velocityX === 0 && velocityX !== 0) events.push({ kind: 'started-moving' });
    if (state.velocityX !== 0 && velocityX === 0) events.push({ kind: 'stopped' });

    /* ---------------------------------------------------- integrate and land */
    let x = state.x + velocityX * dt;
    let y = state.y;

    if (!grounded) {
      const holding =
        jump !== null && jump.maxHoldMs > 0 && intent.jumpHeld && jumpHoldMs < jump.maxHoldMs;
      /* Hold-to-jump-higher is a lighter gravity while the button is down, which
         is what `maxHoldMs: 0` switches off entirely — a fixed-height hop. */
      velocityY += GRAVITY_PX_S2 * (holding && velocityY < 0 ? 0.5 : 1) * dt;
      y += velocityY * dt;
      airborneMs += dt * 1000;
      if (intent.jumpHeld) jumpHoldMs += dt * 1000;
    }

    const groundY = intent.groundY;
    if (grounded) {
      /* A grounded character rides the polyline exactly. Without this a descent
         would leave the ground under the player every frame and the skater would
         chatter down the bank as a series of tiny falls. */
      y = groundY;
      velocityY = 0;
    } else if (y >= groundY) {
      events.push({ kind: 'landed', impactSpeed: Math.abs(velocityY) });
      y = groundY;
      velocityY = 0;
      grounded = true;
      jumpsUsed = 0;
      airborneMs = 0;
      jumpHoldMs = 0;
    }

    if (!grounded) x = state.x + velocityX * dt;

    const interaction = tuning.interaction;
    if (intent.interactPressed && interaction !== null) {
      const stopped = velocityX === 0;
      const slowEnough = Math.abs(velocityX) <= interaction.approachSpeed;
      const allowed = interaction.requiresStop
        ? stopped
        : interaction.whileMoving || stopped || slowEnough;
      if (allowed) events.push({ kind: 'interaction-requested' });
    }

    const facing: LocomotionState['facing'] =
      velocityX > 0 ? 'right' : velocityX < 0 ? 'left' : state.facing;

    return {
      state: {
        x,
        y,
        velocityX,
        velocityY,
        grounded,
        facing,
        airborneMs: grounded ? 0 : airborneMs,
        jumpsUsed,
        braking,
        jumpBufferMs,
        jumpHoldMs,
      },
      events,
      animationSpeed:
        tuning.maxSpeed > 0 ? clamp(Math.abs(velocityX) / tuning.maxSpeed, 0, 1) : 0,
    };
  };

  return {
    mode: tuning.mode,
    tuning,
    step,
    spawn(x: number, y: number, facing: LocomotionState['facing']): LocomotionState {
      return {
        x,
        y,
        velocityX: 0,
        velocityY: 0,
        grounded: true,
        facing,
        airborneMs: 0,
        jumpsUsed: 0,
        braking: false,
        jumpBufferMs: 0,
        jumpHoldMs: 0,
      };
    },
  };
}

/**
 * Keep the player inside the level (TN-LEVEL-03: "the player cannot leave the
 * level"), without breaking the level's own invariant.
 *
 * Bounds are level geometry — `size` and the drawn polyline — and not part of a
 * tuning record, so they are applied *outside* `step` rather than smuggled into
 * it. The edge brakes at `turnAcceleration` instead of zeroing the velocity,
 * because "speed never falls from above half of maxSpeed to 0 inside a single
 * frame" does not carve out the wall, and a scenario that skates into the end of
 * the canal at cruise speed would otherwise fail an invariant the physics
 * satisfies everywhere else.
 */
export function applyBounds(
  state: LocomotionState,
  bounds: MovementBounds,
  tuning: LocomotionTuning,
  dtSeconds: number,
): LocomotionState {
  if (state.x >= bounds.left && state.x <= bounds.right) return state;

  const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, MAX_STEP_SECONDS);
  const drop = tuning.turnAcceleration * dt;
  const velocityX =
    Math.abs(state.velocityX) <= drop
      ? 0
      : state.velocityX - Math.sign(state.velocityX) * drop;

  return { ...state, x: clamp(state.x, bounds.left, bounds.right), velocityX };
}

/**
 * The registry that makes "data plus one strategy" true.
 *
 * Every mode in the schema's enum resolves to the same `createLocomotion`, so
 * `modes` is the vocabulary a level document may name and not a list of things
 * somebody remembered to implement. A `mode` outside it fails as `unsupported`
 * at load time — which is what the port asks for, and the only failure this
 * factory has.
 */
export function createLocomotionFactory(): LocomotionFactory {
  return {
    modes: LOCOMOTION_MODES,
    create(tuning: LocomotionTuning): Result<Locomotion> {
      if (!LOCOMOTION_MODES.includes(tuning.mode)) {
        return appErr(
          'unsupported',
          'locomotion.mode.unknown',
          `no locomotion mode named "${String(tuning.mode)}"; the level document names one the ` +
            `schema does not declare. Known: ${LOCOMOTION_MODES.join(', ')}.`,
          { mode: tuning.mode },
        );
      }
      return ok(createLocomotion(tuning));
    },
  };
}
