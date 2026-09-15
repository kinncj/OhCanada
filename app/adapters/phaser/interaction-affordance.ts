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
 * ## Where a mark sits (ADR-0049)
 *
 * **On the art, not on its rectangle.** The mark's point — the ready chevron's
 * tip — rests {@link MARK_GAP_PX} above the highest art under the mark's own
 * width, read from the subject's silhouette (`art-silhouette.ts`). A texture's
 * top edge and `characterSpace`'s are not the art: the guide's box starts 40 px
 * above his crown and a grain elevator's texture 520 px above the roof under its
 * centre, and a live-site audit photographed both marks as hollow rings in
 * empty sky.
 *
 * **Never on the player's head at a stop.** A subject can name boxes the mark
 * must keep clear of — the player's head wherever a stop holds them there
 * (`mark-clearance.ts`). A landmark lower than the player put its mark on their
 * face at the North's sternwheeler. Such a mark moves sideways along the art to
 * the nearest place that is clear, still on the art; only when no place is does
 * it rise above what it must clear.
 *
 * ## Cost
 *
 * Pure arithmetic over a list built once at level create. The scene calls this
 * when the in-reach set changes rather than every frame, and the only per-frame
 * work is {@link markPulse}, which is one cosine and is skipped entirely under
 * reduced motion.
 */

import type { Vec2 } from '@application/ports';

import {
  silhouetteBounds,
  silhouetteOfRect,
  topWithin,
  type ArtSilhouette,
} from './art-silhouette';
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
  /**
   * Where inside `rect` the art is, band by band. Absent or `null` takes the
   * rectangle as solid art, which is what a placeholder is.
   */
  readonly art?: ArtSilhouette | null;
  /** World boxes the mark may not overlap: the player's head wherever a stop rests them here. */
  readonly clear?: readonly TargetRect[];
}

export interface AffordanceOptions {
  readonly playerX: number;
  /** The mode's `interaction.reachPx`. Zero means this mode engages nothing. */
  readonly reachPx: number;
  /** 44 pt in design pixels for this canvas, from `minTouchTargetPx`. */
  readonly minTouchPx: number;
  /** Ids the domain has reported finished. Absent is "none yet". */
  readonly completed?: ReadonlySet<string>;
  /**
   * The subject a drive is held at, once it has come into reach (ADR-0037).
   *
   * Held is in reach. A stop that lands a little past the edge of reach, or a
   * brake that carries the player through it, does not take away the offer it
   * made — the prompt, the tap target and this mark all say `ready` until the
   * hold is let go. Absent or `null` is "nothing held".
   */
  readonly held?: string | null;
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

/** Clear air between the mark's point and the art under it, and between the mark and what it must clear. */
export const MARK_GAP_PX = 12;

/** The ring's radius, as a fraction of the mark's size. `level-scene.ts` draws with it. */
export const MARK_RING_FRACTION = 0.34;

/**
 * How far below its centre the mark points, as a fraction of its size: the tip of
 * the ready chevron, the lowest thing any state draws. `level-scene.ts` draws the
 * chevron to it.
 */
export const MARK_TIP_FRACTION = MARK_RING_FRACTION * 1.4;

export const PULSE_PERIOD_MS = 1600;

/**
 * How much the ready mark breathes, as a fraction of its size.
 *
 * Small on purpose. This has to be noticeable in the corner of the eye without
 * being the thing on screen that moves most, and it is switched off completely
 * under reduced motion (CLAUDE.md) rather than merely slowed.
 */
export const PULSE_AMPLITUDE = 0.08;

/** A sideways step, as a fraction of the mark, when looking for a place that is clear. */
const SEARCH_STRIDE_FRACTION = 0.25;

/**
 * Everything a mark can cover at its largest: the square about its centre, grown
 * by the pulse. The ring, its halo and the chevron's tip all lie inside it.
 */
export function markExtent(mark: Pick<AffordanceMark, 'x' | 'y' | 'size'>): TargetRect {
  const half = (mark.size / 2) * (1 + PULSE_AMPLITUDE);
  return { x: mark.x - half, y: mark.y - half, width: 2 * half, height: 2 * half };
}

/** The point a mark points at: the tip of its chevron. */
export function markAnchor(mark: Pick<AffordanceMark, 'x' | 'y' | 'size'>): Vec2 {
  return { x: mark.x, y: mark.y + mark.size * MARK_TIP_FRACTION };
}

function overlaps(a: TargetRect, b: TargetRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Where a mark of `size` goes over one subject. See "Where a mark sits" in the header. */
function markPosition(subject: AffordanceSubject, size: number): { readonly x: number; readonly y: number } {
  const art = subject.art ?? silhouetteOfRect(subject.rect);
  const clear = subject.clear ?? [];
  const half = size / 2;
  const tip = size * MARK_TIP_FRACTION;
  const centre = subject.rect.x + subject.rect.width / 2;

  /* The mark over column `x`, pointing at the highest art under its own width,
     and never off the top of the world: a landmark whose art reaches the sky
     would otherwise put its mark outside the canvas. */
  const over = (x: number): { readonly x: number; readonly y: number } | null => {
    const top = topWithin(art, x - half, x + half);
    return top === null ? null : { x, y: Math.max(half, top - MARK_GAP_PX - tip) };
  };
  const isClear = (spot: { readonly x: number; readonly y: number }): boolean =>
    !clear.some((box) => overlaps(markExtent({ ...spot, size }), box));

  const first = over(centre);
  if (first !== null && isClear(first)) return first;

  /* Along the art, nearest first. At the same distance the higher place wins,
     then the right-hand one, so the answer never depends on list order. */
  const bounds = silhouetteBounds(art);
  if (bounds !== null) {
    const stride = Math.max(1, size * SEARCH_STRIDE_FRACTION);
    for (let step = 1; centre + step * stride <= bounds.right || centre - step * stride >= bounds.left; step += 1) {
      const spots = [centre + step * stride, centre - step * stride]
        .filter((x) => x >= bounds.left && x <= bounds.right)
        .map(over)
        .filter((spot): spot is { readonly x: number; readonly y: number } => spot !== null && isClear(spot))
        .sort((a, b) => a.y - b.y || b.x - a.x);
      const found = spots[0];
      if (found !== undefined) return found;
    }
  }

  /* Nowhere on the art is clear. Above everything it must clear that is under
     it, at the centre: a mark above a head is better than a mark on one. */
  const base = first ?? { x: centre, y: Math.max(half, subject.rect.y - MARK_GAP_PX - tip) };
  const extent = markExtent({ ...base, size });
  const growth = extent.height / 2;
  let y = base.y;
  for (const box of clear) {
    if (box.x >= extent.x + extent.width || box.x + box.width <= extent.x) continue;
    y = Math.min(y, box.y - MARK_GAP_PX - growth);
  }
  return { x: base.x, y: Math.max(half, y) };
}

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
      : distance <= reach || subject.id === options.held
        ? 'ready'
        : 'idle';
    const { x, y } = markPosition(subject, size);
    return { id: subject.id, npc: subject.npc, state, x, y, size };
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
