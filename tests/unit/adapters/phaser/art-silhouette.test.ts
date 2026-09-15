/**
 * Where a subject's art is drawn, band by band. ADR-0049.
 *
 * A mark used to sit a fixed height above its subject's rectangle — a texture's
 * bounds, or `characterSpace` — and neither is the art: the guide's ring hung
 * about 90 px over his head and a grain elevator's 450 px over its roof. The
 * silhouette is what the mark points at instead. This file holds its arithmetic
 * on images small enough to read; every shipped subject is
 * `tests/unit/contracts/a-mark-sits-on-its-subject.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import {
  SILHOUETTE_ALPHA_MIN,
  SILHOUETTE_STEP_PX,
  placeSilhouette,
  silhouetteBounds,
  silhouetteFromBoxes,
  silhouetteFromRgba,
  silhouetteOfRect,
  topWithin,
  type ArtSilhouette,
} from '@adapters/phaser/art-silhouette';

/** An RGBA buffer, clear except for the listed pixels at `alpha`. */
function image(
  width: number,
  height: number,
  ink: readonly (readonly [number, number])[],
  alpha = 255,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of ink) pixels[(y * width + x) * 4 + 3] = alpha;
  return pixels;
}

describe('a silhouette read from pixels', () => {
  it('records the highest art in every band and the lowest row the art reaches', () => {
    const pixels = image(8, 6, [
      [1, 3],
      [2, 1],
      [5, 4],
      [6, 2],
    ]);
    expect(silhouetteFromRgba(pixels, 8, 6, { step: 4 })).toEqual({ x: 0, step: 4, tops: [1, 2], bottom: 5 });
  });

  it('leaves a band with no art empty, rather than pretending it is at the top', () => {
    const pixels = image(12, 4, [
      [1, 2],
      [9, 0],
    ]);
    expect(silhouetteFromRgba(pixels, 12, 4, { step: 4 })?.tops).toEqual([2, null, 0]);
  });

  it('does not count an anti-aliased fringe as art', () => {
    expect(silhouetteFromRgba(image(4, 4, [[0, 0]], SILHOUETTE_ALPHA_MIN - 1), 4, 4)).toBeNull();
    expect(silhouetteFromRgba(image(4, 4, [[0, 0]], SILHOUETTE_ALPHA_MIN), 4, 4)?.tops).toEqual([0]);
  });

  it('bands columns by the default step, and a part band at the right edge is still a band', () => {
    const width = SILHOUETTE_STEP_PX + 1;
    expect(silhouetteFromRgba(image(width, 2, [[SILHOUETTE_STEP_PX, 1]]), width, 2)?.tops).toEqual([null, 1]);
  });

  it('answers null for an image with no size, a buffer too short for it, or nothing drawn', () => {
    expect(silhouetteFromRgba(new Uint8ClampedArray(0), 0, 4)).toBeNull();
    expect(silhouetteFromRgba(new Uint8ClampedArray(8), 4, 4)).toBeNull();
    expect(silhouetteFromRgba(image(4, 4, []), 4, 4)).toBeNull();
    expect(silhouetteFromRgba(image(4, 4, [[0, 0]]), 2.5, 4)).toBeNull();
  });
});

describe('a silhouette placed in the world', () => {
  it('moves and scales every band, and leaves an empty band empty', () => {
    const local: ArtSilhouette = { x: 0, step: 4, tops: [1, null, 3], bottom: 10 };
    expect(placeSilhouette(local, { x: 100, y: 1000, scale: 2 })).toEqual({
      x: 100,
      step: 8,
      tops: [1002, null, 1006],
      bottom: 1020,
    });
  });
});

describe('a silhouette built from boxes', () => {
  it('takes the highest box in each band, and the lowest edge of any', () => {
    const silhouette = silhouetteFromBoxes(
      [
        { x: 0, y: 50, width: 8, height: 50 },
        { x: 4, y: 20, width: 4, height: 10 },
      ],
      4,
    );
    expect(silhouette).toEqual({ x: 0, step: 4, tops: [50, 20], bottom: 100 });
  });

  it('leaves the gap between two boxes empty, and ignores a box with no area', () => {
    const silhouette = silhouetteFromBoxes(
      [
        { x: 0, y: 5, width: 4, height: 5 },
        { x: 8, y: 7, width: 4, height: 5 },
        { x: 4, y: 0, width: 0, height: 9 },
      ],
      4,
    );
    expect(silhouette?.tops).toEqual([5, null, 7]);
  });

  it('snaps a fractional edge outward to a whole pixel', () => {
    expect(silhouetteFromBoxes([{ x: 0.5, y: 3, width: 3, height: 1 }], 4)).toEqual({
      x: 0,
      step: 4,
      tops: [3],
      bottom: 4,
    });
  });

  it('answers null for nothing to draw', () => {
    expect(silhouetteFromBoxes([])).toBeNull();
    expect(silhouetteFromBoxes([{ x: 0, y: 0, width: 0, height: 4 }])).toBeNull();
  });

  it('takes a rectangle as solid art, which is what a placeholder is', () => {
    expect(silhouetteOfRect({ x: 10, y: 20, width: 30, height: 40 })).toEqual({
      x: 10,
      step: 30,
      tops: [20],
      bottom: 60,
    });
    expect(silhouetteOfRect({ x: 10, y: 20, width: 0, height: 40 }).step).toBe(1);
  });
});

describe('asking a silhouette where its art is', () => {
  const silhouette: ArtSilhouette = { x: 100, step: 10, tops: [50, null, 30, 70], bottom: 90 };

  it('takes the highest art whose band overlaps the span', () => {
    expect(topWithin(silhouette, 100, 110)).toBe(50);
    expect(topWithin(silhouette, 105, 125)).toBe(30);
    expect(topWithin(silhouette, 130, 140)).toBe(70);
  });

  it('answers null when only empty bands, or none, lie under the span', () => {
    expect(topWithin(silhouette, 110, 120)).toBeNull();
    expect(topWithin(silhouette, 0, 50)).toBeNull();
  });

  it('bounds the art from its first drawn band to its last', () => {
    expect(silhouetteBounds({ x: 100, step: 10, tops: [null, 40, null, 60, null], bottom: 90 })).toEqual({
      left: 110,
      right: 140,
      top: 40,
      bottom: 90,
    });
    expect(silhouetteBounds({ x: 0, step: 4, tops: [null, null], bottom: 0 })).toBeNull();
  });
});
