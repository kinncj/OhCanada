import { describe, expect, it } from 'vitest';

import {
  CONIFERS,
  GROUND_FILL_SHADE,
  LAND_FADE_DEPTH,
  LAND_SHADE,
  RIDGE_MAX_DROP,
  RIDGE_MAX_RISE,
  RIDGE_SAMPLES,
  landBand,
  landSkirtTop,
  levelLandBand,
  ridgeHeightAt,
  ridgePoints,
} from '@adapters/phaser/horizon-profile';

/**
 * The horizon profile exists because of a real defect: a straight, full-width,
 * bright rule across an empty screen was reported twice, from two devices, as
 * "stuck at the loading screen". The build was healthy. The picture was not.
 *
 * So the assertions here are not "the maths is arithmetic". They are the two
 * properties that keep the fix a fix — the ridge is *not flat*, and it still
 * averages out on the two-thirds line ADR-0002 fixes — plus the things a scene
 * would draw wrong if they silently changed. The screenshot proof is in
 * `tests/e2e/boot.spec.ts`; this file is what makes the shape reviewable
 * without a browser.
 */

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;
const HORIZON_FRACTION = 2 / 3;

const sample = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => ridgeHeightAt(index / (count - 1)));

describe('ridgeHeightAt', () => {
  it('is never flat: the land rises and falls across the width', () => {
    const heights = sample(RIDGE_SAMPLES);
    const spread = Math.max(...heights) - Math.min(...heights);

    /*
      The whole defect in one number. A ridge that varies by less than a
      finger-width at design resolution is a rule with a wobble, and a rule
      across an empty screen is a progress bar. 100 px of 1920 is roughly 44 CSS
      px on a 390 px-wide phone.
    */
    expect(spread).toBeGreaterThan(100);
  });

  it('averages out on the two-thirds line, so the composition rule still holds', () => {
    const heights = sample(RIDGE_SAMPLES);
    const mean = heights.reduce((total, value) => total + value, 0) / heights.length;

    /* ADR-0002: playfield above, HUD and cards below. The line moves; the split does not. */
    expect(Math.abs(mean)).toBeLessThan(1);
  });

  it('rises further than it dips, so the hills read as hills', () => {
    expect(RIDGE_MAX_RISE).toBeGreaterThan(RIDGE_MAX_DROP);
    expect(RIDGE_MAX_RISE).toBe(Math.max(...sample(RIDGE_SAMPLES)));
    expect(RIDGE_MAX_DROP).toBe(-Math.min(...sample(RIDGE_SAMPLES)));
  });

  it('stays inside its declared extremes everywhere, not just at the samples', () => {
    for (let t = 0; t <= 1; t += 0.0005) {
      const height = ridgeHeightAt(t);
      expect(height).toBeLessThanOrEqual(RIDGE_MAX_RISE + 1);
      expect(height).toBeGreaterThanOrEqual(-RIDGE_MAX_DROP - 1);
    }
  });

  it('clamps out-of-range and non-finite positions to the edges of the profile', () => {
    expect(ridgeHeightAt(-3)).toBe(ridgeHeightAt(0));
    expect(ridgeHeightAt(4)).toBe(ridgeHeightAt(1));
    expect(ridgeHeightAt(Number.NaN)).toBe(ridgeHeightAt(0));
    expect(ridgeHeightAt(Number.POSITIVE_INFINITY)).toBe(ridgeHeightAt(0));
  });

  it('is deterministic: the same boot draws the same hills', () => {
    expect(sample(41)).toEqual(sample(41));
  });
});

describe('ridgePoints', () => {
  it('spans the full width, left edge to right edge inclusive', () => {
    const points = ridgePoints(DESIGN_WIDTH, 1280);

    expect(points).toHaveLength(RIDGE_SAMPLES);
    expect(points[0]?.x).toBe(0);
    expect(points.at(-1)?.x).toBe(DESIGN_WIDTH);
  });

  it('advances left to right, so the path never doubles back on itself', () => {
    const points = ridgePoints(DESIGN_WIDTH, 1280);

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]?.x ?? 0).toBeGreaterThan(points[index - 1]?.x ?? 0);
    }
  });

  it('places every point around the horizon it was given', () => {
    const horizonY = 1280;
    for (const point of ridgePoints(DESIGN_WIDTH, horizonY)) {
      expect(point.y).toBeLessThanOrEqual(horizonY + RIDGE_MAX_DROP);
      expect(point.y).toBeGreaterThanOrEqual(horizonY - RIDGE_MAX_RISE);
    }
  });

  it('honours a caller-chosen sample count, and refuses to degenerate', () => {
    expect(ridgePoints(DESIGN_WIDTH, 1280, 9)).toHaveLength(9);
    /* Two points is the least that is still a line; anything lower is coerced up. */
    expect(ridgePoints(DESIGN_WIDTH, 1280, 1)).toHaveLength(2);
    expect(ridgePoints(DESIGN_WIDTH, 1280, 0)).toHaveLength(2);
  });
});

describe('landSkirtTop', () => {
  it('sits below every dip of the ridge, so the hill body and the fade cannot gap', () => {
    const horizonY = 1280;
    const skirt = landSkirtTop(horizonY);

    for (const point of ridgePoints(DESIGN_WIDTH, horizonY)) {
      expect(point.y).toBeLessThan(skirt);
    }
  });
});

describe('landBand', () => {
  const band = landBand(DESIGN_HEIGHT, HORIZON_FRACTION);

  it('runs crest, then foot of the hills, then the end of the fade', () => {
    expect(band.crest).toBeLessThan(band.skirt);
    expect(band.skirt).toBeLessThan(band.end);
  });

  it('describes the land the scene actually draws', () => {
    const horizonY = Math.round(DESIGN_HEIGHT * HORIZON_FRACTION);

    expect(band.skirt * DESIGN_HEIGHT).toBeCloseTo(landSkirtTop(horizonY), 6);
    expect(band.end * DESIGN_HEIGHT).toBeCloseTo(landSkirtTop(horizonY) + LAND_FADE_DEPTH, 6);
  });

  it('meets the canvas edges: the crest is the mean of the two frame heights', () => {
    const points = ridgePoints(DESIGN_WIDTH, Math.round(DESIGN_HEIGHT * HORIZON_FRACTION));
    const left = points[0]?.y ?? 0;
    const right = points.at(-1)?.y ?? 0;

    expect(band.crest * DESIGN_HEIGHT).toBeCloseTo((left + right) / 2, 6);
  });

  it('finishes above the bottom of the screen, or the side panels lose their ground', () => {
    /*
      The last row of the canvas has to be `palette.ground`, because that is what
      the page gradient ends on and the two meet at the letterbox edge. A fade
      that reached the bottom would darken it.
    */
    expect(band.end).toBeLessThan(1);
    expect(band.end).toBeGreaterThan(HORIZON_FRACTION);
  });

  it('never runs off the page, however short the design space is', () => {
    const squat = landBand(400, HORIZON_FRACTION);
    expect(squat.end).toBeLessThanOrEqual(1);
  });
});

/**
 * The open level's ground, continued into the desktop side panels.
 *
 * CLAUDE.md: "Desktop centres the portrait canvas; side panels extend the
 * level's sky/ground." With a level open the band used to collapse to nothing,
 * on the argument that a polyline has no single height — so the panels were the
 * sky-to-ground ramp alone, a flat blue-grey wash next to a canvas with a crisp
 * horizon. The mean is the stop that keeps the promise: exact on a flat level,
 * and far closer than nothing on one that rolls.
 */
describe('levelLandBand', () => {
  const DESIGN = 1920;
  const flat = [0, 2000, 4000, 6000].map((x) => ({ x, y: 1280 }));

  it('puts the band exactly on the ground line of a flat level', () => {
    expect(levelLandBand(flat, DESIGN).crest).toBeCloseTo(1280 / DESIGN, 9);
  });

  it('runs opaque to the last row, because a level\'s ground does not fade', () => {
    /* Unlike the boot screen's hills, which fade so the canvas and the page end
       on the same colour. `#paintGround` fills to the floor of the world. */
    const band = levelLandBand(flat, DESIGN);
    expect(band.skirt).toBe(1);
    expect(band.end).toBe(1);
  });

  it('takes the mean of a ground that rolls, so no single stop is wildly wrong', () => {
    /* Ottawa's shape: a canal bank that dips and rises along its length. */
    const rolling = [
      { x: 0, y: 1236 },
      { x: 3000, y: 1470 },
      { x: 6000, y: 1236 },
      { x: 9000, y: 1314 },
    ];
    const mean = (1236 + 1470 + 1236 + 1314) / 4;

    expect(levelLandBand(rolling, DESIGN).crest).toBeCloseTo(mean / DESIGN, 9);
  });

  it('collapses rather than throwing when there is no ground to read', () => {
    for (const band of [levelLandBand([], DESIGN), levelLandBand(flat, 0)]) {
      expect(band).toEqual({ crest: 1, skirt: 1, end: 1 });
    }
  });

  it('stays inside the page, whatever a document says', () => {
    const underneath = [{ x: 0, y: 99_999 }];
    const overhead = [{ x: 0, y: -400 }];

    expect(levelLandBand(underneath, DESIGN).crest).toBe(1);
    expect(levelLandBand(overhead, DESIGN).crest).toBe(0);
  });

  it('shades the panel with the ground fill, which is lighter than the boot hills', () => {
    /* Two different shades of `palette.ground` for two different pictures: the
       scene's ground fill, and the boot screen's silhouetted ridge. The panel
       takes whichever is on the canvas, so neither may drift from the other. */
    expect(GROUND_FILL_SHADE).toBeGreaterThan(0);
    expect(GROUND_FILL_SHADE).toBeLessThan(LAND_SHADE);
  });
});

describe('the land palette shade', () => {
  it('darkens the ground rather than introducing a colour of its own', () => {
    /*
      A level re-themes `theme.ground` and gets matching hills for free. If this
      ever becomes a colour in its own right it belongs in the schema, not here.
    */
    expect(LAND_SHADE).toBeGreaterThan(0);
    expect(LAND_SHADE).toBeLessThan(1);
  });
});

describe('CONIFERS', () => {
  it('stand on the ridge, spread across the width', () => {
    expect(CONIFERS.length).toBeGreaterThan(3);
    for (const tree of CONIFERS) {
      expect(tree.t).toBeGreaterThanOrEqual(0);
      expect(tree.t).toBeLessThanOrEqual(1);
      expect(tree.height).toBeGreaterThan(0);
      expect(tree.halfWidth).toBeGreaterThan(0);
    }
  });

  it('vary in size, because a row of identical marks reads as a scale, not a forest', () => {
    expect(new Set(CONIFERS.map((tree) => tree.height)).size).toBeGreaterThan(3);
  });

  it('are shorter than the hills they stand on, so they read as trees', () => {
    for (const tree of CONIFERS) {
      expect(tree.height).toBeLessThan(RIDGE_MAX_RISE + RIDGE_MAX_DROP);
    }
  });
});
