/**
 * Where a level ends, and the latch that says so once per arrival.
 *
 * A level had no ending. You walked to the far edge of the world, `applyBounds`
 * clamped you to it, and nothing happened — which is the whole of the player's
 * "we don't know how to go to the next level" seen from the world's side.
 *
 * This is the *observation*, not the decision. The scene watches the player's x
 * and publishes `level/exitReached` each time they arrive; whether arriving
 * finishes a level is a product question the composition root answers, and the
 * inbound `LevelScene.markLevelComplete()` — the domain telling the world a
 * stamp was earned — stays exactly as it was. Nothing here asserts the player
 * learned anything.
 *
 * It lives in its own module, and is pure, for the reason `vitest.config.ts`
 * gives: `level-scene.ts` imports Phaser at module scope and cannot be loaded
 * under `environment: 'node'`, so a rule left in the scene is a rule proved only
 * by a browser, once, on one machine. `tests/unit/adapters/phaser/level-exit.test.ts`
 * walks every shipped level to the end and back with the real locomotion
 * strategy and the real camera instead.
 *
 * ## Where the end is, and why it is not the edge
 *
 * `bounds.right` — the far edge of `size.x`, intersected with the drawn ground —
 * is the obvious answer and it is the wrong one, twice over:
 *
 *  - **A player at the wall is already stuck.** `applyBounds` pins x to
 *    `bounds.right` and bleeds the velocity off. Announcing the arrival there
 *    means the completion card opens on somebody who has been pushing into an
 *    invisible wall for however long it took them to give up, and the moment
 *    reads as "you cannot go further", not "you arrived".
 *  - **The camera is still moving there.** It eases towards a target with a dead
 *    zone, so it reaches its right-hand clamp *after* the player does. A card
 *    that opens over a sliding world is the kind of thing reduced-motion exists
 *    to prevent.
 *
 * So the line is {@link EXIT_VIEW_FRACTION} of the camera's view back from the
 * right bound: half a screen. That number is not a taste — it is the smallest
 * one that makes both of the following true, and the test asserts both rather
 * than asserting the number:
 *
 *  - the player is half a view short of the wall and still walking freely, at
 *    every locomotion speed the four levels declare (420 to 720 px/s);
 *  - the camera has *already* reached `scrollBounds().maxX` and stopped. It
 *    wants to be clamped from `right - view/2 - camera.offset.x` onwards, and
 *    every level's look-ahead offset is positive, so by the time the player is
 *    half a view out the camera has had `offset.x` pixels of travel to settle
 *    its dead zone and its lag. The end of the world is on screen, the player is
 *    in the middle of it, and the picture is still.
 *
 * Expressed as a fraction of the *view* rather than of the level: a threshold of
 * "2 % of `size.x`" would mean 180 px in Ottawa and 121 in Québec City for no
 * physical reason, while "half of what you can see" means the same thing to the
 * player in every level and at every zoom. It is device-independent — the view
 * is `designWidth / zoom`, and the render scale divides out of both — so the
 * line is in the same place on a phone and on a desktop.
 *
 * ## The direction
 *
 * The end is the **right** bound, because every level document spawns the player
 * at the left and grows rightwards. If a level ever has to end where it started,
 * or in the middle, that is a field in `level.schema.json` and a content change
 * — not a special case in here. Nothing today needs it, so nothing today
 * invents it.
 */

import type { LevelBounds } from './ground-profile';

/**
 * How much of the camera's view is left between the arrival line and the wall.
 *
 * Exported so the test asserts the property at the level's own scale instead of
 * restating a pixel count that would then have to be edited per level.
 */
export const EXIT_VIEW_FRACTION = 0.5;

export interface ExitLineInput {
  /** The playable span, from `levelBounds` — the ground and `size.x`, intersected. */
  readonly bounds: LevelBounds;
  /** Where the player starts. The line is never at or behind it. */
  readonly spawnX: number;
  /** World units the camera can see across: `designWidth / camera.zoom`. */
  readonly viewWidth: number;
}

/**
 * The world x at which the player has arrived at the end of this level.
 *
 * Two guards, and both are about documents rather than about players:
 *
 *  - a world narrower than one and a half views puts `right - view/2` behind the
 *    spawn, and a line behind the spawn fires on the first frame — a level that
 *    announces its own end before anybody has moved. Such a level ends halfway
 *    between the spawn and the wall instead, so there is still a walk;
 *  - a spawn at or past the end is a broken document. The line is the end
 *    itself, never a point outside the world that could not be reached: an
 *    arrival that fires immediately is wrong in a way somebody will see and fix,
 *    an arrival that can never fire is the silent kind.
 */
export function exitLineX(input: ExitLineInput): number {
  const { bounds, spawnX } = input;
  const view = Number.isFinite(input.viewWidth) && input.viewWidth > 0 ? input.viewWidth : 0;
  const line = bounds.right - view * EXIT_VIEW_FRACTION;
  const halfway = (spawnX + bounds.right) / 2;
  return Math.min(bounds.right, Math.max(line, halfway));
}

/**
 * How far behind the line, as a fraction of the camera's view, the player has to
 * go before arriving again counts as a new arrival (ADR-0073).
 *
 * A tenth of a view — 108 world px at zoom 1 — is a step back the player can
 * see themselves take, and far more than the few pixels a turn at the line
 * carries them: a turn is a deceleration from a standing start or a brake from
 * cruise, and the latch must not read either as leaving the end. Expressed
 * against the view for the reason {@link EXIT_VIEW_FRACTION} is.
 */
export const EXIT_REARM_VIEW_FRACTION = 0.1;

/** The line, and whether the player has crossed it yet. */
export interface ExitWatch {
  /** Where the line is, in world x. Fixed for the life of the level. */
  readonly x: number;
  /**
   * Where the player has to be, strictly behind, for the next crossing of
   * {@link x} to count as a new arrival. Always ahead of the spawn and behind
   * the line.
   */
  readonly rearmX: number;
  /** Is the player at the end right now, as far as the latch knows? */
  readonly reached: boolean;
  /**
   * Feed this frame's player x. `true` on the first frame at or past the line
   * of each arrival; `false` on every frame after it until the player has gone
   * back behind {@link rearmX}, however they jostle at the boundary.
   */
  arrived(playerX: number): boolean;
}

/**
 * Where the latch opens again, for a line at `lineX`.
 *
 * The margin is {@link EXIT_REARM_VIEW_FRACTION} of the view, but never more
 * than half the walk from the spawn to the line — a re-arm point behind the
 * spawn could never be reached by a player who spawned there, and would make
 * the first arrival the only one. A nonsense view (see {@link exitLineX}) takes
 * that half-walk too, so the point is always strictly behind the line.
 */
function rearmPointX(lineX: number, input: ExitLineInput): number {
  const view = Number.isFinite(input.viewWidth) && input.viewWidth > 0 ? input.viewWidth : 0;
  const halfWalk = (lineX - input.spawnX) / 2;
  const wanted = view > 0 ? view * EXIT_REARM_VIEW_FRACTION : halfWalk;
  const margin = halfWalk > 0 ? Math.min(wanted, halfWalk) : wanted;
  return lineX - Math.max(margin, Number.EPSILON * Math.max(1, Math.abs(lineX)));
}

/**
 * A latch with a re-arm, because an arrival is a moment and a position is not.
 *
 * Without the latch the check is `x >= line`, which is true on every frame the
 * player spends near the end of the level — a completion card sixty times a
 * second. With it the answer is a boolean read after the crossing, which is
 * also why this is cheap enough to call every frame.
 *
 * **It re-arms once the player goes back behind {@link ExitWatch.rearmX}**
 * (ADR-0073). It used to fire once per level visit, which was right while an
 * arrival could only ever mean one thing, and wrong once it could mean two: a
 * player who reached the end with the task unfinished, went back and finished
 * it, and walked to the end again got nothing, because the end had already been
 * reported. Whether each arrival is worth a card, a new level or nothing is
 * still `app/bootstrap`'s to say; the scene only reports that it happened.
 *
 * The re-arm point sits behind the line rather than on it — hysteresis — so a
 * turn at the line, which carries the player a few pixels back before they walk
 * on, is the same arrival and not a second one.
 */
export function watchExit(input: ExitLineInput): ExitWatch {
  const x = exitLineX(input);
  const rearmX = rearmPointX(x, input);
  let reached = false;

  return {
    x,
    rearmX,
    get reached(): boolean {
      return reached;
    },
    arrived(playerX: number): boolean {
      if (reached) {
        if (playerX < rearmX) reached = false;
        return false;
      }
      if (!(playerX >= x)) return false;
      reached = true;
      return true;
    },
  };
}
