/**
 * Where a drive comes to rest at the things a player can choose, and what lets
 * it go again. ADR-0032.
 *
 * ## The defects
 *
 * Auto-move existed, was wired to the settings switch, and stopped for nothing.
 * A player who turned it on walked past every landmark and every character in
 * the level: the option that exists so somebody does not have to hold a control
 * removed their only chance to use it.
 *
 * The held drive had the same hole from the other side. A player holding to move
 * came to rest wherever their thumb happened to lift — on Ottawa's skate, which
 * glides at 0.9, that is up to 2 000 px past the officer — so "tap an NPC or POI
 * to engage" asked for a precision one-thumb play does not have. The product
 * owner's ask was one sentence: *the character stops on each point of interest,
 * and that also works with the auto walk.* So the rule is keyed on neither the
 * setting nor the mode: **any drive, held or automatic, comes to rest at every
 * engageable subject it approaches, once per visit.**
 *
 * ## `requiresStop` already said this, and nothing did it
 *
 * `content/levels/prairie-rail.json` declares `train` with `drive: "auto"` and
 * `interaction.requiresStop: true`, and `locomotion.ts` gates
 * `interaction-requested` on `velocityX === 0`. A mode that drives itself and may
 * only engage at rest could never engage anything, because nothing brought it to
 * rest. This module is the missing half. `requiresStop` keeps its meaning: it
 * says whether engaging *needs* the halt, and this says when the halt happens.
 *
 * ## Where the stop is, and why it is not `ready`
 *
 * `interaction-affordance.ts` draws a `ready` mark the moment a subject is within
 * `reachPx`, and that boundary is the obvious trigger. It is wrong in **both**
 * directions at once, because `reachPx` is a fixed distance and stopping is a
 * speed-dependent one:
 *
 * | mode (level)          | brake from cruise | `reachPx` |
 * |-----------------------|------------------:|----------:|
 * | walk (Halifax)        |            ~ 56 px |    200 px |
 * | skate (Ottawa)        |           ~ 204 px |    220 px |
 * | train (prairie-rail)  |           ~ 378 px |    320 px |
 * | toboggan (Québec City)|           ~ 406 px |    240 px |
 * | bike (Toronto)        |           ~ 365 px |    260 px |
 *
 * Braking at `ready` puts the toboggan and the bike at rest 100–150 px *past* the
 * landmark and the walk 150 px *short* of one. So the trigger is the distance at
 * which this mode, braking with its own declared brake, comes to rest level with
 * the subject: {@link stopLinePx}. It needs no new field in `level.schema.json` —
 * a level that tunes its brake moves its own stop line.
 *
 * Because the stop always lands inside reach, `poi/entered` has fired by the time
 * the player is at rest: the prompt is on screen, the mark reads `ready`, and the
 * live region has already said the offer. The stop needs no announcement of its
 * own, and no new copy.
 *
 * ## How it stops, and why the recorded intent is still the player's
 *
 * By stepping the strategy with {@link brakingTuning} and {@link brakingIntent}
 * for the frames it is stopping: the same mode with `drive: 'held'`, no glide,
 * `deceleration` set to the mode's own `turnAcceleration` ("the brake" in
 * `level.schema.json`), and the move taken out of the intent. The move has to
 * come out: a held drive that is being stopped is, by definition, a player still
 * asking to go, and `drive: 'held'` with `move: 1` accelerates. Nothing is ever
 * *added* to the intent, and the scene records the intent it sampled, so
 * `tests/e2e/touch-controls.spec.ts`'s "every frame's intent was zero" on a
 * hands-off run stays the honest statement it was.
 *
 * ## What the stop catches
 *
 * A subject is caught when it lies ahead of the way the player is travelling,
 * inside the stop line, and this visit has not already let the player go from it,
 * on a frame where **something is driving**: the drive is automatic, or the
 * player is pressing the way they are travelling. A skater who let go and is
 * gliding is not driving, and a glide is theirs — `TN-LEVEL-06` "releasing it
 * glides exactly as it does after a released touch". A player pressing *against*
 * their travel is braking or turning, and is not heading for anything.
 *
 * ## Letting go in reach is a choice (ADR-0037)
 *
 * The glide rule above had one case it got wrong, and it was the one-thumb case.
 * The prompt appears when a subject comes into reach, and the thumb has to leave
 * the glass to take it. On the skate the prompt appears 220 px out and the stop
 * line is 204 px at cruise, so a player who let go the moment it appeared glided
 * 2 000 px on and the prompt was gone before the thumb arrived; any mode lifted
 * in reach at a speed whose stop line is shorter than its reach did the same.
 *
 * So the frame a held press **ends** is read as well as the frames it lasts. If a
 * subject this visit has not let the player go from is within reach on that
 * frame, the drive is held at the nearest one: it glides on to the stop line and
 * brakes there, or brakes at once when it is already inside it. A glide that
 * began outside reach is still the player's, and still passes everything — which
 * is what keeps a skater's long coast down the canal a coast.
 *
 * The three ways out are the same three. Rest points (`stand-off.ts`) move where
 * a stop aims for a character: beside them, not inside them.
 *
 * ## Letting go
 *
 * Three ways out, and no fourth:
 *
 *  - **the player engages.** {@link AutoStopWatch.release} is called with the
 *    subject engaged, from the scene's `#engageNearest` (the interact key, a tap on
 *    the canvas) and, through `GameRenderer.markEngaged`, from the composition
 *    root (the interact prompt, by touch, by `Tab` and `Enter`, or by the switch).
 *    Closing the card and having the world move on is the direct consequence of
 *    finishing with it — a player who cannot hold a contact must not need one to
 *    carry on;
 *  - **the player presses again.** A press that *begins* while the drive is held
 *    releases it. For a held drive that means letting go and pressing again: the
 *    thumb that was already down when the stop caught it is the thumb that walked
 *    into the landmark, and letting it overrule the stop would mean the stop never
 *    happens, because a held control is intent ≥ `MOVE_DEADZONE` on every frame.
 *    For an automatic drive, which is stopped with nothing pressed, every press is
 *    a new one, so this is exactly the nudge auto-move has always had. Once the
 *    brake is on, the press has to begin with the player **at rest** (ADR-0043):
 *    a press that lands while the drive is still being brought to rest is not an
 *    answer to a stop the player has not reached yet, and on a mode that drives
 *    itself it was the first press of the level. "Begins" also counts a key let
 *    go and pressed again between two frames ({@link AutoStopFrame.pressBegan});
 *  - **the player steers the other way.** Always, at once, however long the
 *    control has been held, because a setting a player cannot overrule is the trap
 *    `TN-SET-05` forbids.
 *
 * There is no timer and no automatic re-start after a delay. A world that begins
 * moving on its own while somebody is still reading is startling, and a timer
 * outside Exam mode is forbidden by CLAUDE.md anyway.
 *
 * "Begins" is measured in the frames this watch is fed. A pause — a card, the
 * menu, a backgrounded tab — hides the hands, so the scene calls
 * {@link AutoStopWatch.forgetInput} and the first press seen afterwards counts as
 * new. Otherwise a player who lifted their thumb while the menu was open would
 * press again and be ignored.
 *
 * ## Once per visit, finished or not
 *
 * A released subject is latched, exactly as `level-exit.ts` latches the arrival
 * at the end of the level and for the same reason: a stop is a moment, and a
 * position is not. Without the latch a player standing at a landmark they have
 * declined is re-caught on the next frame, and a player walking back past it is
 * stopped by it again. The latch lives in the watch, and the scene builds one per
 * level visit.
 *
 * Subjects the domain reports finished are stopped for too — once, like any
 * other. `TN-REACH-03` offers a done target as "Done. See it again", and on
 * the train, whose `requiresStop` refuses an engagement in motion, or with
 * auto-move, which a player chose because they cannot hold, a landmark the drive
 * never stops at is one that offer can never be taken up from. The cost to
 * everyone else is one press per landmark per visit — four or five in a level —
 * and never twice.
 *
 * ## Cost
 *
 * One pass over the level's engageable subjects per frame — five in the largest
 * shipped level — and a `Set` lookup each. No allocation, no drawing.
 *
 * Pure: no Phaser, no DOM, no clock. `tests/unit/adapters/phaser/auto-stop.test.ts`
 * drives it over every shipped level with the real strategy.
 */

import type { LocomotionIntent, LocomotionTuning } from '@application/ports';

import { MAX_STEP_SECONDS, MOVE_DEADZONE } from './locomotion';

/** Where a drive travelling right, and one travelling left, comes to rest for a subject. */
export interface RestPoints {
  readonly right: number;
  readonly left: number;
}

/** One thing in the level a player could choose, as the scene already holds it. */
export interface AutoStopSubject {
  readonly id: string;
  /** Where the level document puts it. The same x reach is measured from. */
  readonly x: number;
  /**
   * Where to come to rest for it, when that is not level with {@link x}.
   *
   * A character: beside them, not inside them (`stand-off.ts`, ADR-0037).
   * Absent for a landmark, which a player stands in front of.
   */
  readonly rest?: RestPoints;
}

/** The world x a drive travelling `heading` aims at for `subject`. */
export function restXFor(subject: AutoStopSubject, heading: 1 | -1): number {
  if (subject.rest === undefined) return subject.x;
  return heading > 0 ? subject.rest.right : subject.rest.left;
}

/** One frame, as the scene knows it after sampling input and before stepping. */
export interface AutoStopFrame {
  /**
   * Does the drive carry the player with nothing pressed?
   *
   * True when the level document says `drive: "auto"` **or** the accessibility
   * option is on. It decides one thing only: whether a frame with nothing pressed
   * is still a drive that can be caught. What releases a stop is the same either
   * way.
   */
  readonly automatic: boolean;
  readonly playerX: number;
  /**
   * How fast, and which way, the player is actually travelling.
   *
   * The direction comes from here and from nowhere else — not from `facing`, and
   * not from the level's layout. A player at rest has a braking distance of zero
   * and therefore no stop line at all, which is what stops a subject placed on
   * the spawn pinning a player before they have moved.
   */
  readonly velocityX: number;
  /** The player's own intent this frame: keyboard and finger, already summed. */
  readonly playerMove: number;
  /**
   * A direction whose key went down since the previous frame, whatever
   * `playerMove` reads now (ADR-0043).
   *
   * `playerMove` is a level, read once a frame. A key let go and pressed again
   * between two frames reads as held on both, so the lift and the new press are
   * invisible in it — and that press is the one that lets a held stop go. The
   * scene counts key-down events (`key-presses.ts`) and hands the direction here.
   * Absent, or 0, for an input that cannot do it: a finger is a tap for its
   * first 160 ms (`touch-controls.ts`), so a new hold always shows a frame of 0.
   */
  readonly pressBegan?: -1 | 0 | 1;
  readonly subjects: readonly AutoStopSubject[];
}

export interface AutoStopWatch {
  /**
   * The subject the drive is currently held at, or `null`.
   *
   * Held is offered: the scene keeps a held subject in reach once it has come
   * into reach, so the prompt, the mark and the tap target outlive a brake that
   * carries the player past the edge of reach (ADR-0037).
   */
  readonly holding: string | null;
  /**
   * Feed this frame. `true` means the drive is suspended: step the player with
   * {@link brakingTuning} and {@link brakingIntent} instead of the driving pair.
   */
  update(frame: AutoStopFrame): boolean;
  /**
   * The player engaged something — let the drive carry them on, and never stop
   * for what they engaged, or for what was holding them, again this visit.
   *
   * `engaged` is optional because an engagement can happen while moving in every
   * mode that allows it, before the stop line is reached; latching it then is
   * what keeps the player from being halted at a card they have just closed.
   * Releasing with nothing held and nothing named is a no-op, not an error.
   */
  release(engaged?: string): void;
  /**
   * The scene stopped seeing the player's hands — a pause, a blur. The next press
   * this watch is fed counts as a new one.
   */
  forgetInput(): void;
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
 * The intent the brake is stepped with: the player's, with the move taken out.
 *
 * A held drive is caught while the control is still down, and
 * {@link brakingTuning}'s `drive: 'held'` would accelerate on it. Only the move
 * goes: a jump or an interact pressed on a stopped frame is still the player's
 * to make. Nothing is added — a direction the player did not ask for is never
 * synthesised.
 */
export function brakingIntent(intent: LocomotionIntent): LocomotionIntent {
  return intent.move === 0 ? intent : { ...intent, move: 0 };
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

/** The direction a move asks for after the strategy's own deadzone: -1, 0 or 1. */
function pressedDirection(move: number): -1 | 0 | 1 {
  if (!Number.isFinite(move) || Math.abs(move) < MOVE_DEADZONE) return 0;
  return move > 0 ? 1 : -1;
}

/**
 * A watch over one level visit's engageable subjects, for one locomotion mode.
 *
 * Built per scene, alongside the strategy, and it holds the memory a pure
 * per-frame rule cannot: which subject the drive is held at and which way it was
 * going, which subjects this visit has already let the player go from, and which
 * way the player was pressing on the last frame it saw.
 */
export function createAutoStop(tuning: LocomotionTuning): AutoStopWatch {
  /* A mode that can engage nothing stops for nothing — a canoe mid-river would
     otherwise halt at a landmark it is not allowed to touch. The same test
     `affordanceMarks` makes before drawing a mark, so what stops the player and
     what the player can see agree by construction. */
  const reachPx = tuning.interaction?.reachPx ?? 0;
  const engages = reachPx > 0;
  const done = new Set<string>();
  /*
   * What the drive is held at, which way it was going, where it is aiming to
   * come to rest, and whether the brake is on yet.
   *
   * `braking` is false only for a hold a lift began short of the stop line
   * (ADR-0037): the glide carries on to the line and the brake takes over there,
   * so the player comes to rest at the thing rather than short of it. Once on it
   * stays on — the slack in the stop line shrinks with speed, and a brake that
   * could let go half way would hand an automatic drive back its throttle.
   */
  let holding: {
    readonly id: string;
    readonly heading: 1 | -1;
    readonly restX: number;
    braking: boolean;
  } | null = null;
  /* The press the previous frame saw. A press is "new" when this frame's
     direction differs from it, which is what makes letting go and pressing again
     a release while holding on is not. */
  let lastPressed: -1 | 0 | 1 = 0;

  /* The brake goes on once the rest point is inside the stop line — or behind
     the player, when there is no glide left to spend. An automatic drive is never
     left coasting under a hold, because its strategy would drive. */
  const brakeNow = (restX: number, heading: 1 | -1, frame: AutoStopFrame): boolean => {
    if (frame.automatic) return true;
    const ahead = (restX - frame.playerX) * heading;
    return ahead <= stopLinePx(Math.abs(frame.velocityX), tuning);
  };

  const letGo = (): void => {
    if (holding === null) return;
    done.add(holding.id);
    holding = null;
  };

  return {
    get holding(): string | null {
      return holding?.id ?? null;
    },
    release(engaged?: string): void {
      if (engaged !== undefined) done.add(engaged);
      letGo();
    },
    forgetInput(): void {
      lastPressed = 0;
    },
    update(frame: AutoStopFrame): boolean {
      const pressed = pressedDirection(frame.playerMove);
      /* New when this frame's direction differs from the last one's, or when a
         key for it went down between the two frames — a let-go and a press again
         that the level, reading each key once a frame, saw as one long hold
         (ADR-0043). */
      const began = pressed !== 0 && (pressed !== lastPressed || frame.pressBegan === pressed);
      const lifted = pressed === 0 && lastPressed !== 0;
      lastPressed = pressed;

      if (!engages) {
        holding = null;
        return false;
      }

      if (holding !== null) {
        /* Steering back always wins, on the frame it arrives. The threshold is
           the strategy's own, so the input that would move the player is exactly
           the input that can release them. */
        if (pressed !== 0 && pressed !== holding.heading) {
          letGo();
          return false;
        }
        /*
         * A press the way they were already going wins when it **began** while
         * held. A control held down since before the stop does not: that is the
         * thumb that walked them here.
         *
         * And once the brake is on, only a press that begins **at rest** does
         * (ADR-0043). A press that lands while the brake is still bringing the
         * drive to rest is not an answer to the stop — the player has not been
         * stopped yet — and on the Prairies it was the first press of the level:
         * the train drives itself to the guide, a player pressed "go" as it
         * braked, and the task's giver was let go and passed before anyone had
         * seen the offer. A hold that is still gliding on to its stop line keeps
         * ADR-0037's rule, because the player lifted to choose it and a press
         * then is a change of mind.
         */
        if (began && (!holding.braking || frame.velocityX === 0)) {
          letGo();
          return false;
        }
        if (!holding.braking) holding.braking = brakeNow(holding.restX, holding.heading, frame);
        return holding.braking;
      }

      const speed = Math.abs(frame.velocityX);
      /* Travel, not the level's layout: the same landmark is ahead going one way
         and behind going the other. */
      const heading: 1 | -1 = frame.velocityX > 0 ? 1 : -1;

      if (pressed === 0 && !frame.automatic) {
        /*
         * Nobody is driving. A glide the player let go of **outside** reach is
         * theirs, and passes everything (TN-LEVEL-06, ADR-0032).
         *
         * Letting go **inside** reach is the one-thumb way of saying "this one"
         * (ADR-0037): the prompt is up, and the thumb has to leave the glass to
         * take it. So the frame a held press ends, with a subject this visit has
         * not let the player go from within reach, holds the player at it — the
         * nearest, whichever side of them it is on. A player at rest has nothing
         * to bring to rest.
         */
        if (!lifted || speed <= 0) return false;
        let inReach: { subject: AutoStopSubject; distance: number } | null = null;
        for (const subject of frame.subjects) {
          if (done.has(subject.id)) continue;
          const distance = Math.abs(subject.x - frame.playerX);
          if (distance > reachPx) continue;
          if (inReach === null || distance < inReach.distance) inReach = { subject, distance };
        }
        if (inReach === null) return false;
        const restX = restXFor(inReach.subject, heading);
        holding = { id: inReach.subject.id, heading, restX, braking: brakeNow(restX, heading, frame) };
        return holding.braking;
      }

      const line = stopLinePx(speed, tuning);
      if (line <= 0) return false;
      /* Pressing against the travel is braking or turning, not approaching. */
      if (pressed !== 0 && pressed !== heading) return false;

      let nearest: { subject: AutoStopSubject; restX: number; ahead: number } | null = null;
      for (const subject of frame.subjects) {
        if (done.has(subject.id)) continue;
        /* Measured to where the drive will rest, which for a character is beside
           them rather than on them (ADR-0037). */
        const restX = restXFor(subject, heading);
        const ahead = (restX - frame.playerX) * heading;
        if (ahead <= 0 || ahead > line) continue;
        if (nearest === null || ahead < nearest.ahead) nearest = { subject, restX, ahead };
      }

      if (nearest === null) return false;
      holding = { id: nearest.subject.id, heading, restX: nearest.restX, braking: true };
      return true;
    },
  };
}
