/**
 * Which things in the world are tappable, and how loudly each one says so.
 *
 * ## The defect
 *
 * Touch worked and was invisible. `touch-controls.ts` had a tap resolve against
 * a hit area grown to 44 pt, `#engageNearest` had a reach rule, the level
 * emitted `poi/entered` — and the screen showed a landmark and a person with
 * nothing on or near them, so a player had no way to learn that either could be
 * touched. The user's words were "we don't know what to click".
 *
 * ## What this decides, and what it deliberately does not
 *
 * This is geometry and state: for each engageable subject, one mark, its state,
 * its size and where it sits. The *shapes* are `level-scene.ts`'s, because they
 * are drawing; the rule that the three states differ in shape and not only in
 * colour is CLAUDE.md's ("colour is never the only signal") and is why this
 * returns a state rather than a tint.
 *
 * Three states, and each is a different claim:
 *
 * | state   | claim                                        |
 * |---------|----------------------------------------------|
 * | `idle`  | this can be tapped, when you get to it        |
 * | `ready` | tapping it now will work                      |
 * | `done`  | you have already done this one                |
 *
 * `done` arrives from outside — the domain decides that a quest is finished and
 * the scene is told — because nothing in an adapter knows what a quest is.
 *
 * ## The two rules that keep it honest
 *
 * **Reach is measured exactly as the engage rule measures it**, from
 * `position.x`, against the mode's own `reachPx`. A mark computed from a
 * different distance would promise a tap the game then refused, which is worse
 * than no mark at all. And **a mode that cannot engage anything shows no
 * marks** — a canoe mid-river has `interaction: null`, every tap would be
 * declined, and a ring over a landmark would be advertising a control that does
 * not exist.
 *
 * **The mark is never smaller than the glass that counts as the subject.**
 * `touch-controls.ts` grows a hit area to 44 pt of the *device's* canvas; the
 * same number is passed in here, so what the player sees is at least what they
 * can hit. It is not the other way round: the art is never resized.
 *
 * ## Cost
 *
 * Pure arithmetic over a list built once at level create. The scene calls this
 * when the in-reach set changes rather than every frame, and the only per-frame
 * work is {@link markPulse}, which is one cosine and is skipped entirely under
 * reduced motion.
 */

import type { Vec2 } from '@application/ports';

import type { TargetRect } from './touch-controls';

/** What a mark is claiming. See the table in the header. */
export type AffordanceState = 'idle' | 'ready' | 'done';

/** One engageable thing, as the scene already holds it in `#reachTargets`. */
export interface AffordanceSubject {
  readonly id: string;
  /** A person or a place. The scene draws the two differently. */
  readonly npc: boolean;
  /** Where the level document puts it; what reach is measured from. */
  readonly position: Vec2;
  /** Where its art was actually drawn; what a finger has to land on. */
  readonly rect: TargetRect;
}

export interface AffordanceOptions {
  readonly playerX: number;
  /** The mode's `interaction.reachPx`. Zero means this mode engages nothing. */
  readonly reachPx: number;
  /** 44 pt in design pixels for this canvas, from `minTouchTargetPx`. */
  readonly minTouchPx: number;
  /** Ids the domain has reported finished. Absent is "none yet". */
  readonly completed?: ReadonlySet<string>;
}

export interface AffordanceMark {
  readonly id: string;
  readonly npc: boolean;
  readonly state: AffordanceState;
  /** Centre of the mark, in world coordinates. */
  readonly x: number;
  readonly y: number;
  /** Width and height; the mark is square about its centre. */
  readonly size: number;
}

/**
 * The smallest a mark may be drawn, whatever the canvas measured.
 *
 * A floor under the 44 pt figure rather than a replacement for it: on a wide
 * desktop canvas 44 pt is about 95 design pixels, and on an implausibly wide one
 * it would shrink further. A mark that small over a 780 px landmark reads as
 * dirt on the screen.
 */
export const MIN_MARK_PX = 64;

/** Clear air between the top of the subject's art and the bottom of the mark. */
export const MARK_GAP_PX = 26;

export const PULSE_PERIOD_MS = 1600;

/**
 * How much the ready mark breathes, as a fraction of its size.
 *
 * Small on purpose. This has to be noticeable in the corner of the eye without
 * being the thing on screen that moves most, and it is switched off completely
 * under reduced motion (CLAUDE.md) rather than merely slowed.
 */
export const PULSE_AMPLITUDE = 0.08;

/**
 * One mark per engageable subject, in the order they were given.
 *
 * Order is preserved rather than sorted by distance: the scene creates one
 * drawing object per mark at level create and indexes them by id, and a stable
 * order means that list never has to be rebuilt.
 */
export function affordanceMarks(
  subjects: readonly AffordanceSubject[],
  options: AffordanceOptions,
): readonly AffordanceMark[] {
  const reach = Number.isFinite(options.reachPx) ? options.reachPx : 0;
  if (reach <= 0) return [];

  const floor = Number.isFinite(options.minTouchPx) ? options.minTouchPx : 0;
  const size = Math.max(MIN_MARK_PX, floor);
  const completed = options.completed;

  return subjects.map((subject) => {
    const distance = Math.abs(subject.position.x - options.playerX);
    const state: AffordanceState = completed?.has(subject.id)
      ? 'done'
      : distance <= reach
        ? 'ready'
        : 'idle';

    /* Above the art, and never off the top of the world: a landmark whose
       texture reaches the sky would otherwise put its mark outside the canvas,
       which is a mark that does not exist. */
    const above = subject.rect.y - MARK_GAP_PX - size / 2;

    return {
      id: subject.id,
      npc: subject.npc,
      state,
      x: subject.rect.x + subject.rect.width / 2,
      y: Math.max(size / 2, above),
      size,
    };
  });
}

/**
 * The ready mark's scale at this instant, or exactly 1 under reduced motion.
 *
 * `1` rather than "a slower pulse": reduced motion disables the animation, and a
 * value that merely approaches 1 would still repaint every frame for no visible
 * result.
 */
export function markPulse(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1;
  const phase = (elapsedMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
  return 1 + PULSE_AMPLITUDE * Math.sin(2 * Math.PI * phase);
}
