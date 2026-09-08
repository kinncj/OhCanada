/**
 * The ground polyline, sampled.
 *
 * `level.schema.json` says the surface is "a polyline in design-resolution
 * pixels, ordered left to right. Slope between consecutive points is what
 * `LocomotionIntent.slope` samples." This module is that sentence, and nothing
 * else: two lookups and a bound. It knows nothing about a mode, a scene or a
 * camera, so the same polyline drives skating, walking, canoeing and dogsledding
 * without any of them appearing here.
 *
 * Why `slope` is normalised to -1..1 rather than passed as a raw gradient: the
 * port declares it that way ("-1 (steep down) … 1 (steep up)"), and it keeps the
 * locomotion strategy free of a length unit. A gradient of 1.0 — 45 degrees — is
 * "as steep as this game gets"; anything steeper is a wall, and clamping is the
 * honest reading of a polyline that a level author drew too aggressively.
 *
 * Pure. No Phaser, no DOM.
 */

import type { Vec2 } from '@application/ports';

/** A gradient at or beyond this is reported as fully steep. 1.0 is 45 degrees. */
export const MAX_GRADIENT = 1;

/**
 * The index of the segment containing `x`: the last point whose x is <= `x`,
 * clamped so a query off either end uses the first or last segment.
 *
 * Linear scan. A level is a dozen points and this runs once a frame; a binary
 * search would be faster on a polyline nobody is going to author.
 */
function segmentIndexAt(points: readonly Vec2[], x: number): number {
  const last = points.length - 2;
  if (last < 0) return 0;
  for (let index = last; index >= 0; index -= 1) {
    const point = points[index];
    if (point !== undefined && x >= point.x) return index;
  }
  return 0;
}

/**
 * The surface height under `x`, linearly interpolated between the two points
 * either side of it and flat beyond both ends.
 *
 * Flat beyond the ends rather than extrapolated: a level's ground is only
 * defined where it was drawn, and continuing the last gradient off the edge of
 * the world is how a player ends up standing in the sky at the level bound.
 */
export function groundYAt(points: readonly Vec2[], x: number): number {
  const first = points[0];
  if (first === undefined) return 0;
  const last = points[points.length - 1] ?? first;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;

  const index = segmentIndexAt(points, x);
  const a = points[index] ?? first;
  const b = points[index + 1] ?? last;
  const span = b.x - a.x;
  if (span <= 0) return a.y;
  return a.y + ((x - a.x) / span) * (b.y - a.y);
}

/**
 * The normalised gradient at `x`: positive where the ground rises to the right,
 * negative where it falls, zero on the flat and beyond both ends.
 *
 * Screen y grows downwards, so a segment whose y *increases* to the right is
 * going downhill and this returns a negative number. That sign convention is the
 * one `LocomotionIntent.slope` is documented with and the one the locomotion
 * strategy multiplies by the direction of travel.
 */
export function slopeAt(points: readonly Vec2[], x: number): number {
  const first = points[0];
  if (first === undefined) return 0;
  const last = points[points.length - 1] ?? first;
  if (x <= first.x || x >= last.x) return 0;

  const index = segmentIndexAt(points, x);
  const a = points[index] ?? first;
  const b = points[index + 1] ?? last;
  const run = b.x - a.x;
  if (run <= 0) return 0;
  const gradient = -(b.y - a.y) / run;
  const clamped = Math.max(-MAX_GRADIENT, Math.min(MAX_GRADIENT, gradient));
  /* Negating a flat segment produces -0, which compares equal to 0 with `===`
     and unequal with `Object.is`. It would also reach the locomotion strategy as
     a signed zero and the scene probe as the string "-0". Flat is flat. */
  return clamped === 0 ? 0 : clamped;
}

/** Where the player may go, in world x. */
export interface LevelBounds {
  readonly left: number;
  readonly right: number;
}

/**
 * The playable span: the intersection of the level's declared size and the
 * ground the author actually drew.
 *
 * Both, not either. A `size.x` wider than the polyline would let a player skate
 * off the end of the drawn ground and stand on the flat extension; a polyline
 * wider than `size.x` would let them leave the level the camera is clamped to,
 * which is TN-LEVEL-04's "no empty space is shown past the end of the painted
 * level" seen from the other side.
 */
export function levelBounds(points: readonly Vec2[], size: Vec2): LevelBounds {
  const first = points[0];
  const last = points[points.length - 1];
  const left = Math.max(0, first?.x ?? 0);
  const right = Math.min(size.x, last?.x ?? size.x);
  return { left, right: Math.max(left, right) };
}
