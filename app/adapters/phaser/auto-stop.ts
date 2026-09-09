/**
 * Where an automatic drive comes to rest, and what lets it go again.
 *
 * ## The defect
 *
 * Auto-move existed, was wired to the settings switch, and stopped for nothing.
 * A player who turned it on walked past every landmark and every character in
 * the level: the option that exists so somebody does not have to hold a control
 * removed their only chance to use it. For an accessibility feature that is
 * worse than not shipping it.
 *
 * ## `requiresStop` already said this, and nothing did it
 *
 * `content/levels/prairie-rail.json` declares `train` with `drive: "auto"` and
 * `interaction.requiresStop: true`, and `locomotion.ts` reads that field — it
 * gates `interaction-requested` on `velocityX === 0`. So the rule was
 * *implemented as a refusal and never as a behaviour*: a mode that drives itself
 * and may only engage at rest could never engage anything at all, because
 * nothing in the game ever brought it to rest. This module is the missing half,
 * and it is deliberately keyed on **the drive being automatic**, not on the
 * accessibility setting, so the train gets it from `content/levels/*.json` alone
 * and auto-move gets it from the same path rather than from a second one.
 *
 * `requiresStop` keeps its meaning untouched: it says whether engaging *needs*
 * the halt. This says when the halt happens. A mode with `whileMoving: true`
 * still stops, because a player who cannot hold a control cannot choose to stop
 * either, and "you may engage while moving" is not "you must".
 *
 * ## Where the stop is, and why it is not `ready`
 *
 * `interaction-affordance.ts` already draws a `ready` mark the moment a subject
 * is within `reachPx`, and that boundary is the obvious trigger. It is the wrong
 * one, and it is wrong in **both** directions at once, because `reachPx` is a
 * fixed distance while stopping is a speed-dependent one:
 *
 * | mode (level)          | brake from cruise | `reachPx` |
 * |-----------------------|------------------:|----------:|
 * | walk (Halifax)        |            ~ 56 px |    200 px |
 * | skate (Ottawa)        |           ~ 204 px |    220 px |
 * | train (prairie-rail)  |           ~ 378 px |    320 px |
 * | toboggan (Québec City)|           ~ 406 px |    240 px |
 * | bike (Toronto)        |           ~ 365 px |    260 px |
 *
 * Braking at `ready` puts the toboggan and the bike at rest 100–150 px *past*
 * the landmark, and puts the walk at rest 150 px *short* of one — a halt with
 * nothing at it, which reads as the game seizing up. So the trigger is the
 * distance at which this mode, braking with its own declared brake, comes to
 * rest level with the subject: {@link stopLinePx}. It lands the player at the
 * thing every time, at 420 px/s and at 760 px/s, and it needs no new field in
 * `level.schema.json` — a level that tunes its brake moves its own stop line.
 *
 * ## How it stops, and why the intent stays zero
 *
 * By handing the strategy {@link brakingTuning} for the frames it is stopping:
 * the same mode with `drive: 'held'`, no glide, and `deceleration` set to the
 * mode's own `turnAcceleration` — which `level.schema.json` calls "the brake" and
 * a contract test already pins strictly above `deceleration`. Nothing here
 * synthesises a direction, so `LocomotionIntent.move` is still exactly what the
 * player asked for and `tests/e2e/touch-controls.spec.ts`'s "every frame's
 * intent was zero" stays the honest statement it was. Coasting was not an option:
 * Ottawa's skate glides at 0.9 and would need 2 135 px to stop on friction alone.
 *
 * ## Letting go
 *
 * Two ways out, and no third:
 *
 *  - **the player engages what stopped them.** {@link AutoStopWatch.release} is
 *    called from the scene's `#engageNearest`, so closing the card and having the
 *    world move on again is the direct consequence of finishing with it. This is
 *    the one that matters: a player who chose auto-move because they cannot hold
 *    a contact must not need to hold one to carry on, or the first landmark is a
 *    dead end;
 *  - **the player steers.** Any intent the strategy would act on (≥
 *    `MOVE_DEADZONE`, the same threshold `requestedDirection` uses) releases the
 *    hold on the frame it arrives, because a setting a player cannot overrule is
 *    the trap `TN-SET-05` forbids.
 *
 * There is no timer and no automatic re-start after a delay. A world that begins
 * moving on its own while somebody is still reading is startling, and a timer
 * outside Exam mode is forbidden by CLAUDE.md anyway.
 *
 * ## Not stopping twice
 *
 * A released subject is latched, exactly as `level-exit.ts` latches the arrival
 * at the end of the level and for the same reason: a stop is a moment, and a
 * position is not. Without the latch a player standing at a landmark they have
 * declined is re-caught on the next frame, and a player walking back past a
 * finished landmark is stopped by it again. Subjects the domain has reported
 * finished (the affordance's `done` state) are never stopped for at all.
 *
 * ## Cost
 *
 * One pass over the level's engageable subjects per frame — three of them in the
 * largest shipped level — and a `Set` lookup each. No allocation, no drawing,
 * nothing that touches the frame budget.
 *
 * Pure: no Phaser, no DOM, no clock. `tests/unit/adapters/phaser/auto-stop.test.ts`
 * drives it over every shipped level with the real strategy.
 */

import type { LocomotionTuning } from '@application/ports';

import { MAX_STEP_SECONDS, MOVE_DEADZONE } from './locomotion';

/** One thing in the level a player could choose, as the scene already holds it. */
export interface AutoStopSubject {
  readonly id: string;
  /** Where the level document puts it. The same x reach is measured from. */
  readonly x: number;
}

/** One frame, as the scene knows it after sampling input and before stepping. */
export interface AutoStopFrame {
  /**
   * Is the drive automatic at all?
   *
   * True when the level document says `drive: "auto"` **or** the accessibility
   * option is on. False makes this inert: a player holding to move already
   * stops by letting go, and a halt they did not ask for would be an override.
   */
  readonly automatic: boolean;
  readonly playerX: number;
  /**
   * How fast, and which way, the player is actually travelling.
   *
   * The direction comes from here and from nowhere else — not from `facing`, and
   * not from the level's layout. A player at rest has a braking distance of zero
   * and therefore no stop line at all, so "which way would the drive take them
   * from a standstill" is a question that never has to be answered: nothing can
   * be inside a line of zero length. That is also what stops a subject placed on
   * the spawn pinning a player before they have moved.
   */
  readonly velocityX: number;
  /** The player's own intent this frame: keyboard and finger, already summed. */
  readonly playerMove: number;
  readonly subjects: readonly AutoStopSubject[];
  /** Ids the domain has reported finished. Never stopped for. */
  readonly completed: ReadonlySet<string>;
}

export interface AutoStopWatch {
  /** The subject the drive is currently held at, or `null`. */
  readonly holding: string | null;
  /**
   * Feed this frame. `true` means the automatic drive is suspended: step the
   * player with {@link brakingTuning} instead of the driving one.
   */
  update(frame: AutoStopFrame): boolean;
  /**
   * The player is done here — let the drive carry them on, and never stop for
   * this subject again.
   *
   * Called by the scene when an engagement actually happens. Releasing with
   * nothing held is a no-op rather than an error: an engagement can happen while
   * moving in every mode that allows it, and that is not a resume.
   */
  release(): void;
}

/**
 * The mode with its brake on.
 *
 * `drive: 'held'` so a zero intent means zero rather than "keep going";
 * `glide: 0` so momentum stops surviving the release; and `deceleration` raised
 * to the mode's own `turnAcceleration`, which is the number
 * `level.schema.json#/$defs/locomotionTuning` describes as "the brake, and then
 * the turn". Everything else — the reach, the interaction rules, the jump, the
 * animation binding — is the mode the level authored, because a halt that
 * changed what a player could do would be a second rulebook.
 */
export function brakingTuning(tuning: LocomotionTuning): LocomotionTuning {
  return { ...tuning, drive: 'held', glide: 0, deceleration: tuning.turnAcceleration };
}

/**
 * How far this mode travels bringing `speed` to rest on its own brake.
 *
 * `v² / 2a`, with `a` the brake {@link brakingTuning} applies. Zero for a speed
 * that is not a positive number, and zero for a mode that declares no brake at
 * all: such a mode can never be brought to rest, so it is never stopped for.
 * `level.schema.json` gives `turnAcceleration` an `exclusiveMinimum` of 0 and
 * `locomotion-tuning-is-coherent.test.ts` pins it above `deceleration`, so no
 * shipped document reaches that branch — but answering 0 keeps a broken document
 * a level that moves rather than a level that halts on the spawn.
 */
export function brakeDistancePx(speed: number, tuning: LocomotionTuning): number {
  const brake = tuning.turnAcceleration;
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  if (!Number.isFinite(brake) || brake <= 0) return 0;
  return (speed * speed) / (2 * brake);
}

/**
 * The distance ahead at which the drive must let go to rest at the subject.
 *
 * The braking distance plus one capped frame of travel. `locomotion.ts` clamps a
 * step at {@link MAX_STEP_SECONDS}, so a frame the browser delivered late can
 * carry the player a whole `speed × 1/30` past the line before this is asked
 * again; without the slack that frame becomes an overshoot the brake can never
 * take back. With it, the player comes to rest between one such frame short of
 * the subject and level with it — inside every `reachPx` the game ships.
 */
export function stopLinePx(speed: number, tuning: LocomotionTuning): number {
  const brake = brakeDistancePx(speed, tuning);
  if (brake <= 0) return 0;
  return brake + speed * MAX_STEP_SECONDS;
}

/**
 * A watch over one level's engageable subjects, for one locomotion mode.
 *
 * Built per scene, alongside the strategy, and it holds the two pieces of memory
 * a pure per-frame rule cannot: which subject the drive is currently held at, and
 * which subjects the player is already finished being stopped by.
 */
export function createAutoStop(tuning: LocomotionTuning): AutoStopWatch {
  /* A mode that can engage nothing stops for nothing — a canoe mid-river would
     otherwise halt at a landmark it is not allowed to touch. The same test
     `affordanceMarks` makes before drawing a mark, so what stops the player and
     what the player can see agree by construction. */
  const engages = (tuning.interaction?.reachPx ?? 0) > 0;
  const done = new Set<string>();
  let holding: string | null = null;

  const letGo = (): void => {
    if (holding === null) return;
    done.add(holding);
    holding = null;
  };

  return {
    get holding(): string | null {
      return holding;
    },
    release: letGo,
    update(frame: AutoStopFrame): boolean {
      if (!engages || !frame.automatic) {
        /* Not latched: turning the option off is not the player declining the
           landmark, so turning it back on may stop for it again. */
        holding = null;
        return false;
      }

      /* Steering wins, on the frame it arrives. The threshold is the strategy's
         own, so the input that would override the drive is exactly the input
         that releases the hold — one boundary, not two that can disagree. */
      if (Math.abs(frame.playerMove) >= MOVE_DEADZONE) {
        letGo();
        return false;
      }

      if (holding !== null) return true;

      const speed = Math.abs(frame.velocityX);
      const line = stopLinePx(speed, tuning);
      if (line <= 0) return false;

      /* Travel, not the level's layout: the same landmark is ahead going one way
         and behind going the other, and a drive does not brake for what it has
         already passed. Never zero — `line > 0` means `speed > 0`. */
      const heading = Math.sign(frame.velocityX);

      let nearest: { id: string; ahead: number } | null = null;
      for (const subject of frame.subjects) {
        if (done.has(subject.id) || frame.completed.has(subject.id)) continue;
        const ahead = (subject.x - frame.playerX) * heading;
        if (ahead <= 0 || ahead > line) continue;
        if (nearest === null || ahead < nearest.ahead) nearest = { id: subject.id, ahead };
      }

      if (nearest === null) return false;
      holding = nearest.id;
      return true;
    },
  };
}
