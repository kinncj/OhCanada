/**
 * Where a level ends, and the latch that says so once.
 *
 * A level had no ending. You walked to the far edge of the world, `applyBounds`
 * clamped you to it, and nothing happened — which is the whole of the player's
 * "we don't know how to go to the next level" seen from the world's side.
 *
 * This is the *observation*, not the decision. The scene watches the player's x
 * and publishes `level/exitReached` the first time they arrive; whether arriving
 * finishes a level is a product question the composition root answers, and the
 * inbound `LevelScene.markLevelComplete()` — the domain telling the world a
 * stamp was earned — stays exactly as it was. Nothing here asserts the player
 * learned anything.
 *
 * It lives in its own module, and is pure, for the reason `vitest.config.ts`
 * gives: `level-scene.ts` imports Phaser at module scope and cannot be loaded
 * under `environment: 'node'`, so a rule left in the scene is a rule proved only
 * by a browser, once, on one machine. `tests/unit/adapters/phaser/level-exit.test.ts`
 * walks all four shipped levels to the end and back with the real locomotion
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

/** The line, and whether the player has crossed it yet. */
export interface ExitWatch {
  /** Where the line is, in world x. Fixed for the life of the level. */
  readonly x: number;
  /** Has the arrival already been reported? */
  readonly reached: boolean;
  /**
   * Feed this frame's player x. `true` **exactly once**, on the first frame at
   * or past the line; `false` for every frame after it, however the player
   * jostles at the boundary.
   */
  arrived(playerX: number): boolean;
}

/**
 * A latch, because an arrival is a moment and a position is not.
 *
 * Without it the check is `x >= line`, which is true on every frame the player
 * spends near the end of the level — a completion card sixty times a second.
 * With it the answer is a boolean read after the first crossing, which is also
 * why this is cheap enough to call every frame: once it has fired the update
 * costs one field read and a return.
 *
 * It never re-arms. Walking back and forth across the line is one arrival,
 * because the player has still only reached the end of the level once, and the
 * scene that owns the latch is destroyed when the level is unloaded.
 */
export function watchExit(input: ExitLineInput): ExitWatch {
  const x = exitLineX(input);
  let reached = false;

  return {
    x,
    get reached(): boolean {
      return reached;
    },
    arrived(playerX: number): boolean {
      if (reached) return false;
      if (!(playerX >= x)) return false;
      reached = true;
      return true;
    },
  };
}
