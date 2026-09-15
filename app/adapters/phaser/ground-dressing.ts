/**
 * The ground dressing: the strip drawn over the ground fill (ADR-0042).
 *
 * ## The defect
 *
 * A live-site audit photographed the lower quarter of every level as one flat
 * colour. The ground polygon is painted opaque over every parallax layer, from
 * the polyline to the bottom of the world, so nothing a level could declare was
 * ever drawn below its walking line: at 390 x 844 that was about 530 design rows
 * between the player's feet and the HUD, on all ten levels.
 *
 * ## The one rule a level can break
 *
 * The strip is fixed to a world row, and the ground is a polyline. On a level
 * whose ground falls away — Ottawa drops 230 px past x 6000 — a strip that
 * starts at the walking line of the high stretch would be drawn in the air over
 * the low one, across the backdrop. So the strip's first row sits at or below
 * the ground's LOWEST point, which is the one placement that is under the
 * ground everywhere, whatever shape the polyline has. JSON Schema cannot compare
 * a number with an array, so the parser asks this module, and the contract test
 * asks it again against every level on disk.
 *
 * Pure. No Phaser, no DOM.
 */

import type { GroundDressing, Vec2 } from '@application/ports';

/**
 * The point of the polyline that is lowest on screen: the largest `y`, and the
 * first such point when several tie. `null` for an empty polyline.
 */
export function lowestGroundPoint(points: readonly Vec2[]): Vec2 | null {
  let lowest: Vec2 | null = null;
  for (const point of points) {
    if (lowest === null || point.y > lowest.y) lowest = point;
  }
  return lowest;
}

/**
 * The world row the ground fill must reach down to.
 *
 * The fill runs from the polyline to the bottom of the world, and a strip that
 * drew runs from its `topY` to the bottom of the world over it, opaque in every
 * row (the asset pipeline refuses a dressing with a single see-through pixel).
 * Every fill pixel below `topY` is then painted and painted over in the same
 * frame, which is a third of a screen of overdraw on a flat level — so the fill
 * stops at the strip, and adding the strip costs about what it hides.
 *
 * The whole world is filled when the strip's art did not load, and when the
 * strip ends above the bottom of the world: either way something must still be
 * under the rows the strip does not cover.
 */
export function groundFillFloor(input: {
  readonly dressing: GroundDressing;
  /** The strip's drawn height in rows, or `null` when its art did not load. */
  readonly stripHeight: number | null;
  readonly worldHeight: number;
}): number {
  const { dressing, stripHeight, worldHeight } = input;
  if (stripHeight === null) return worldHeight;
  if (dressing.topY + stripHeight < worldHeight) return worldHeight;
  return Math.min(dressing.topY, worldHeight);
}

/**
 * Everything wrong with a level's ground dressing against its own ground, as
 * sentences, or `[]`.
 *
 * Two faults, both of which would reach `ready` looking deliberate: a strip that
 * starts above the ground's lowest point is drawn over the backdrop wherever the
 * ground is below it, and a strip that starts at or under the bottom of the
 * world draws nothing at all, which is the flat band it exists to dress.
 */
export function groundDressingProblems(
  dressing: GroundDressing,
  ground: readonly Vec2[],
  worldHeight: number,
): readonly string[] {
  const problems: string[] = [];
  const lowest = lowestGroundPoint(ground);
  if (lowest !== null && dressing.topY < lowest.y) {
    problems.push(
      `the ground dressing "${dressing.key}" starts at world row ${String(dressing.topY)}, above the ` +
        `ground's lowest point (y ${String(lowest.y)} at x ${String(lowest.x)}). Where the ground is ` +
        'that low the strip would be drawn in the air over the backdrop; start it at or below that row.',
    );
  }
  if (dressing.topY >= worldHeight) {
    problems.push(
      `the ground dressing "${dressing.key}" starts at world row ${String(dressing.topY)}, at or below ` +
        `the bottom of the world (${String(worldHeight)}), so it draws nothing.`,
    );
  }
  return problems;
}
