import { describe, expect, it } from 'vitest';

import {
  canvasRowColour,
  canvasSkyProfile,
  canvasTopColour,
  layerRowAtCanvasRow,
  layerRowAtCanvasTop,
  meanRowColour,
  medianRowColour,
  skyStopList,
  type Rgba,
  type SkyTopLayer,
} from '@adapters/phaser/sky-top';

/**
 * The band above the canvas is painted with the canvas's own first row
 * (ADR-0044), and the desktop side panels are painted with the canvas's whole
 * sky. These are the cases a screenshot would only catch at the right hour, on
 * the right tier, on the right level.
 */

/** A tinted evening sky, and the untinted image every shipped level draws over it. */
const TINTED_SKY = '#265089';
const OTTAWA_SKY_ROW: Rgba = { r: 31, g: 95, b: 168, a: 255 };

const layer = (overrides: Partial<SkyTopLayer> = {}): SkyTopLayer => ({
  depth: 10,
  visible: true,
  offsetY: 0,
  scrollFactorY: 0.02,
  height: 1160,
  rowColour: () => OTTAWA_SKY_ROW,
  ...overrides,
});

describe('layerRowAtCanvasTop', () => {
  it('is the first row of a layer that starts at the top of a world that does not scroll', () => {
    expect(layerRowAtCanvasTop(layer(), 0)).toBe(0);
  });

  it('follows the layer\'s vertical parallax, not the camera\'s', () => {
    expect(layerRowAtCanvasTop(layer({ scrollFactorY: 0.5 }), 200)).toBe(100);
    expect(layerRowAtCanvasTop(layer({ scrollFactorY: 0.5, offsetY: 40 }), 200)).toBe(60);
  });

  it('is null for a layer that starts below the first row', () => {
    expect(layerRowAtCanvasTop(layer({ offsetY: 620 }), 0)).toBeNull();
  });

  it('is null once the camera has carried a layer wholly above the canvas', () => {
    expect(layerRowAtCanvasTop(layer({ height: 100, scrollFactorY: 1 }), 100)).toBeNull();
    expect(layerRowAtCanvasTop(layer({ height: 100, scrollFactorY: 1 }), 99)).toBe(99);
  });

  it('is null for a layer with no rows, and reads nonsense input as a still camera', () => {
    expect(layerRowAtCanvasTop(layer({ height: 0 }), 0)).toBeNull();
    expect(layerRowAtCanvasTop(layer({ height: Number.NaN }), 0)).toBeNull();
    expect(layerRowAtCanvasTop(layer(), Number.NaN)).toBe(0);
    expect(layerRowAtCanvasTop(layer({ offsetY: Number.NaN, scrollFactorY: Number.NaN }), 0)).toBe(0);
  });
});

describe('canvasTopColour', () => {
  it('is the untinted sky image, not the tinted theme sky, when the image covers the first row', () => {
    /* The defect: the page painted TINTED_SKY over a canvas whose first row is
       the image's own colour. */
    expect(canvasTopColour({ backdrop: TINTED_SKY, layers: [layer()], cameraY: 0 })).toBe('#1f5fa8');
  });

  it('is the tinted gradient when no layer reaches the first row', () => {
    expect(
      canvasTopColour({ backdrop: TINTED_SKY, layers: [layer({ offsetY: 780 })], cameraY: 0 }),
    ).toBe(TINTED_SKY);
  });

  it('is the tinted gradient when the tier has switched the sky layer off', () => {
    expect(
      canvasTopColour({ backdrop: TINTED_SKY, layers: [layer({ visible: false })], cameraY: 0 }),
    ).toBe(TINTED_SKY);
  });

  it('falls through to what is underneath when a layer\'s row cannot be read', () => {
    expect(
      canvasTopColour({ backdrop: TINTED_SKY, layers: [layer({ rowColour: () => null })], cameraY: 0 }),
    ).toBe(TINTED_SKY);
  });

  it('lays layers over each other in depth order, whatever order they are listed in', () => {
    const near = layer({ depth: 20, rowColour: () => ({ r: 255, g: 0, b: 0, a: 255 }) });
    const far = layer({ depth: 10, rowColour: () => ({ r: 0, g: 0, b: 255, a: 255 }) });
    expect(canvasTopColour({ backdrop: TINTED_SKY, layers: [near, far], cameraY: 0 })).toBe('#ff0000');
    expect(canvasTopColour({ backdrop: TINTED_SKY, layers: [far, near], cameraY: 0 })).toBe('#ff0000');
  });

  it('keeps list order for two layers at one depth, as the scene does', () => {
    const first = layer({ rowColour: () => ({ r: 0, g: 255, b: 0, a: 255 }) });
    const second = layer({ rowColour: () => ({ r: 0, g: 0, b: 255, a: 255 }) });
    expect(canvasTopColour({ backdrop: TINTED_SKY, layers: [first, second], cameraY: 0 })).toBe('#0000ff');
  });

  it('mixes a translucent layer with what it is drawn over, and skips a transparent one', () => {
    const half = layer({ rowColour: () => ({ r: 255, g: 255, b: 255, a: 127.5 }) });
    expect(canvasTopColour({ backdrop: '#000000', layers: [half], cameraY: 0 })).toBe('#808080');
    const clear = layer({ rowColour: () => ({ r: 255, g: 255, b: 255, a: 0 }) });
    expect(canvasTopColour({ backdrop: '#123456', layers: [clear], cameraY: 0 })).toBe('#123456');
  });

  it('asks the layer for the row that is actually on screen', () => {
    const asked: number[] = [];
    const tall = layer({
      scrollFactorY: 1,
      rowColour: (row) => {
        asked.push(row);
        return OTTAWA_SKY_ROW;
      },
    });
    canvasTopColour({ backdrop: TINTED_SKY, layers: [tall], cameraY: 37 });
    expect(asked).toEqual([37]);
  });

  it('clamps a colour read out of range, and never returns a colour the page cannot parse', () => {
    const wild = layer({ rowColour: () => ({ r: 300, g: -4, b: Number.NaN, a: 999 }) });
    expect(canvasTopColour({ backdrop: '#000000', layers: [wild], cameraY: 0 })).toBe('#ff0000');
  });

  it('returns a backdrop that is not a hex literal untouched', () => {
    expect(canvasTopColour({ backdrop: 'navy', layers: [layer()], cameraY: 0 })).toBe('navy');
  });
});

/**
 * The side panels, which are the same question asked of every row rather than
 * of row 0.
 *
 * The fourth live-site audit found a seam down both edges of the playfield at
 * 1440 x 900. `--tn-sky-top` made the panel exact on row 0 and the page then ran
 * a straight ramp from there to the theme ground, while the canvas below row 0
 * is a sky image, a range of hills and a skyline — none of them on that line.
 * Measured on the shipped build: the per-channel step was 0 at the top row and
 * grew to 25 on Halifax and 33 on the North by mid-screen.
 */
describe('layerRowAtCanvasRow', () => {
  it('is the same answer as the first-row rule when the row asked for is the first', () => {
    for (const cameraY of [0, 37, 200]) {
      expect(layerRowAtCanvasRow(layer({ scrollFactorY: 0.5 }), 0, cameraY)).toBe(
        layerRowAtCanvasTop(layer({ scrollFactorY: 0.5 }), cameraY),
      );
    }
  });

  it('walks down the layer one row per screen row, whatever the parallax', () => {
    /* Parallax moves where a layer starts, never how fast its own rows go past:
       the layers are drawn unscaled, one texture row per design row. */
    expect(layerRowAtCanvasRow(layer({ offsetY: 620, scrollFactorY: 0.06 }), 620, 0)).toBe(0);
    expect(layerRowAtCanvasRow(layer({ offsetY: 620, scrollFactorY: 0.06 }), 700, 0)).toBe(80);
    expect(layerRowAtCanvasRow(layer({ offsetY: 620, scrollFactorY: 0.5 }), 700, 200)).toBe(180);
  });

  it('is null above a layer and null past its last row', () => {
    const band = layer({ offsetY: 620, height: 230, scrollFactorY: 0 });
    expect(layerRowAtCanvasRow(band, 619, 0)).toBeNull();
    expect(layerRowAtCanvasRow(band, 620, 0)).toBe(0);
    expect(layerRowAtCanvasRow(band, 849, 0)).toBe(229);
    expect(layerRowAtCanvasRow(band, 850, 0)).toBeNull();
  });
});

describe('canvasRowColour', () => {
  it('is the first-row answer for row 0', () => {
    const input = { backdrop: TINTED_SKY, layers: [layer()], cameraY: 0 };
    expect(canvasRowColour(input, 0)).toBe(canvasTopColour(input));
  });

  it('is the band that covers the row, not the one above it', () => {
    /* Halifax's shape: a sky from row 0 and a citadel band from row 620. The
       panel beside row 700 was painting a ramp toward the ground instead. */
    const sky = layer({ depth: 10, offsetY: 0, scrollFactorY: 0, height: 1160 });
    const citadel = layer({
      depth: 20,
      offsetY: 620,
      scrollFactorY: 0,
      height: 300,
      rowColour: () => ({ r: 61, g: 138, b: 74, a: 255 }),
    });
    const input = { backdrop: TINTED_SKY, layers: [sky, citadel], cameraY: 0 };
    expect(canvasRowColour(input, 400)).toBe('#1f5fa8');
    expect(canvasRowColour(input, 700)).toBe('#3d8a4a');
  });

  it('falls through to the gradient AT THAT ROW, not to its first band', () => {
    /*
     * The canvas paints sky-to-ground in 64 steps behind the layers, so a row no
     * layer covers is not `palette.sky` — it is the ramp at that height. Measured
     * on a build with no level art, where every band is a short placeholder and
     * most rows fall through: the panel drew one flat blue beside a canvas that
     * was ramping the whole way down.
     */
    const short = layer({ offsetY: 0, scrollFactorY: 0, height: 230 });
    const ramp = (row: number): string => (row < 500 ? '#112233' : '#445566');
    const input = { backdrop: '#112233', layers: [short], cameraY: 0, backdropAt: ramp };
    expect(canvasRowColour(input, 100)).toBe('#1f5fa8');
    expect(canvasRowColour(input, 300)).toBe('#112233');
    expect(canvasRowColour(input, 900)).toBe('#445566');
  });

  it('keeps the flat backdrop when no gradient is supplied, as ADR-0044 asked it', () => {
    const short = layer({ offsetY: 0, scrollFactorY: 0, height: 230 });
    expect(canvasRowColour({ backdrop: TINTED_SKY, layers: [short], cameraY: 0 }, 900)).toBe(
      TINTED_SKY,
    );
  });

  it('falls back to the sky under a band the tier switched off', () => {
    const citadel = layer({
      depth: 20,
      offsetY: 620,
      scrollFactorY: 0,
      height: 300,
      visible: false,
      rowColour: () => ({ r: 61, g: 138, b: 74, a: 255 }),
    });
    const sky = layer({ depth: 10, offsetY: 0, scrollFactorY: 0, height: 1160 });
    expect(canvasRowColour({ backdrop: TINTED_SKY, layers: [sky, citadel], cameraY: 0 }, 700)).toBe(
      '#1f5fa8',
    );
  });
});

describe('canvasSkyProfile', () => {
  /** A sky whose rows ramp from one colour to another, as an authored sky does. */
  const ramp = (from: number, to: number, height: number): SkyTopLayer =>
    layer({
      offsetY: 0,
      scrollFactorY: 0,
      height,
      rowColour: (row) => {
        const t = row / (height - 1);
        const value = Math.round(from + (to - from) * t);
        return { r: value, g: value, b: value, a: 255 };
      },
    });

  it('is two stops for a sky that is one flat colour, because a ramp needs no more', () => {
    const flat = layer({ offsetY: 0, scrollFactorY: 0, height: 1400 });
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [flat], cameraY: 0 },
      { height: 1920, until: 1280 },
    );
    expect(stops).toEqual([
      { at: 0, colour: '#1f5fa8' },
      { at: 1280 / 1920, colour: '#1f5fa8' },
    ]);
  });

  it('is two stops for a sky that ramps evenly, because CSS interpolates the middle', () => {
    const stops = canvasSkyProfile(
      { backdrop: '#000000', layers: [ramp(0, 255, 1920)], cameraY: 0 },
      { height: 1920, until: 1280 },
    );
    expect(stops).toHaveLength(2);
    expect(stops[0]?.at).toBe(0);
    expect(stops[stops.length - 1]?.at).toBeCloseTo(1280 / 1920, 6);
  });

  it('keeps a stop where the canvas steps, so a hill edge is not ramped through', () => {
    const sky = layer({ offsetY: 0, scrollFactorY: 0, height: 1920 });
    const hills = layer({
      depth: 20,
      offsetY: 640,
      scrollFactorY: 0,
      height: 1280,
      rowColour: () => ({ r: 61, g: 138, b: 74, a: 255 }),
    });
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [sky, hills], cameraY: 0 },
      { height: 1920, until: 1280 },
    );
    /* A stop just above the edge still reads sky, and one at or below it reads
       hill: that is what stops the panel fading blue into green across 640 px. */
    const above = stops.filter((stop) => stop.at < 640 / 1920);
    const below = stops.filter((stop) => stop.at >= 640 / 1920);
    expect(above.at(-1)?.colour).toBe('#1f5fa8');
    expect(below[0]?.colour).toBe('#3d8a4a');
    expect(below[0]!.at - above.at(-1)!.at).toBeLessThan(0.05);
  });

  it('drops a lone cloud band rather than painting it down the panel', () => {
    /*
     * The North's defect: cirrus covering more than half the width of one row
     * makes that row's dominant colour the cloud, and the panel grew pale
     * streaks the canvas beside it did not have. A row that disagrees with the
     * row above AND the row below is decoration.
     */
    const cloudRow = 640;
    const sky = layer({
      offsetY: 0,
      scrollFactorY: 0,
      height: 1920,
      rowColour: (row) =>
        Math.abs(row - cloudRow) < 10
          ? { r: 240, g: 245, b: 250, a: 255 }
          : { r: 31, g: 95, b: 168, a: 255 },
    });
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [sky], cameraY: 0 },
      { height: 1920, until: 1280 },
    );
    expect(stops.every((stop) => stop.colour === '#1f5fa8')).toBe(true);
  });

  it('drops a cloud band two samples thick, which is the one three taps left behind', () => {
    /*
     * The North again, measured: its thickest cirrus band spans two adjacent
     * samples, so a three-tap median still read cloud and one pale streak
     * survived across both panels. 1280 design rows over 33 samples is a sample
     * every 40 rows, so a 70-row band covers two of them.
     */
    const sky = layer({
      offsetY: 0,
      scrollFactorY: 0,
      height: 1920,
      rowColour: (row) =>
        row >= 600 && row < 670
          ? { r: 240, g: 245, b: 250, a: 255 }
          : { r: 31, g: 95, b: 168, a: 255 },
    });
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [sky], cameraY: 0 },
      { height: 1920, until: 1280 },
    );
    expect(stops.every((stop) => stop.colour === '#1f5fa8')).toBe(true);
  });

  it('keeps a real horizon, which is what tells it apart from a cloud', () => {
    /* The same filter must not round off an edge: below it, everything is hill. */
    const sky = layer({ offsetY: 0, scrollFactorY: 0, height: 1920 });
    const hills = layer({
      depth: 20,
      offsetY: 640,
      scrollFactorY: 0,
      height: 1280,
      rowColour: () => ({ r: 61, g: 138, b: 74, a: 255 }),
    });
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [sky, hills], cameraY: 0 },
      { height: 1920, until: 1280 },
    );
    expect(stops.at(-1)?.colour).toBe('#3d8a4a');
    expect(stops[0]?.colour).toBe('#1f5fa8');
  });

  it('never returns more stops than it sampled, however busy the sky', () => {
    const noisy = layer({
      offsetY: 0,
      scrollFactorY: 0,
      height: 1920,
      rowColour: (row) => ({ r: (row * 97) % 256, g: (row * 31) % 256, b: (row * 7) % 256, a: 255 }),
    });
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [noisy], cameraY: 0 },
      { height: 1920, until: 1280, samples: 9 },
    );
    expect(stops.length).toBeLessThanOrEqual(9);
    expect(stops.length).toBeGreaterThan(2);
  });

  it('starts at the first row and ends where the land band takes over', () => {
    const stops = canvasSkyProfile(
      { backdrop: TINTED_SKY, layers: [layer({ offsetY: 0, scrollFactorY: 0, height: 1920 })], cameraY: 0 },
      { height: 1920, until: 1236 },
    );
    expect(stops[0]?.at).toBe(0);
    expect(stops.at(-1)?.at).toBeCloseTo(1236 / 1920, 6);
  });

  it('is nothing at all for a degenerate canvas, rather than a broken stop list', () => {
    const input = { backdrop: TINTED_SKY, layers: [layer()], cameraY: 0 };
    expect(canvasSkyProfile(input, { height: 0, until: 1280 })).toEqual([]);
    expect(canvasSkyProfile(input, { height: 1920, until: 0 })).toEqual([]);
    expect(canvasSkyProfile(input, { height: Number.NaN, until: 1280 })).toEqual([]);
  });
});

describe('skyStopList', () => {
  it('places every stop against the canvas box, not the page, and ends on a comma', () => {
    const list = skyStopList([
      { at: 0, colour: '#1f5fa8' },
      { at: 0.5, colour: '#3d8a4a' },
    ]);
    /* The canvas box, because a phone taller than 9:16 letterboxes top and
       bottom: the ramp runs over the canvas and the bands outside it are flat. */
    expect(list).toBe(
      '#1f5fa8 calc(var(--tn-canvas-top) + 0 * var(--tn-canvas-height)), ' +
        '#3d8a4a calc(var(--tn-canvas-top) + 0.5 * var(--tn-canvas-height)), ',
    );
  });

  it('is empty for no stops, so the page falls back to the plain ramp', () => {
    /* Not "", which would make `var(--tn-sky-stops)` invalid at computed-value
       time and take the whole gradient down with it. */
    expect(skyStopList([]).trim()).toBe('');
  });

  it('drops a stop the page could not parse rather than breaking the gradient', () => {
    const list = skyStopList([
      { at: 0, colour: '#1f5fa8' },
      { at: 0.5, colour: 'rgb(1 2 3)' },
      { at: Number.NaN, colour: '#000000' },
    ]);
    expect(list).toContain('#1f5fa8');
    expect(list).not.toContain('rgb(');
    expect(list).not.toContain('NaN');
  });
});

describe('medianRowColour', () => {
  /** Four pixels: `[r,g,b,a]` each, flattened. */
  const row = (...pixels: readonly (readonly [number, number, number, number])[]): number[] =>
    pixels.flatMap((pixel) => [...pixel]);

  it('is the colour of a uniform row, exactly, as the mean is', () => {
    const uniform = row([31, 95, 168, 255], [31, 95, 168, 255], [31, 95, 168, 255]);
    expect(medianRowColour(uniform)).toEqual({ r: 31, g: 95, b: 168, a: 255 });
  });

  it('is the sky, not a pale average, for a sky row with clouds on it', () => {
    /*
     * The defect this exists for. Two of five pixels are cloud; the mean is a
     * blue nobody drew, and a panel built from a stack of those reads as a
     * horizontal smear of the level.
     */
    const sky: readonly [number, number, number, number] = [31, 95, 168, 255];
    const cloud: readonly [number, number, number, number] = [255, 255, 255, 255];
    const clouded = row(sky, cloud, sky, cloud, sky);
    expect(medianRowColour(clouded)).toEqual({ r: 31, g: 95, b: 168, a: 255 });
    expect(meanRowColour(clouded)?.r).toBeGreaterThan(100);
  });

  it('does not let a half-transparent edge vote on the colour', () => {
    const sky: readonly [number, number, number, number] = [31, 95, 168, 255];
    const fringe: readonly [number, number, number, number] = [255, 255, 255, 40];
    expect(medianRowColour(row(sky, fringe, sky))?.r).toBe(31);
  });

  it('reports a row nothing is drawn on as empty, so the caller looks underneath', () => {
    expect(medianRowColour(row([9, 9, 9, 0], [9, 9, 9, 0]))).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('is null for an empty or ragged read, exactly as the mean is', () => {
    expect(medianRowColour([])).toBeNull();
    expect(medianRowColour([1, 2, 3])).toBeNull();
  });
});

describe('meanRowColour', () => {
  it('is the colour of a uniform row, exactly', () => {
    const row = new Uint8ClampedArray([31, 95, 168, 255, 31, 95, 168, 255, 31, 95, 168, 255]);
    expect(meanRowColour(row)).toEqual({ r: 31, g: 95, b: 168, a: 255 });
  });

  it('weights colour by alpha, so a transparent pixel cannot tint the band', () => {
    const row = [200, 100, 50, 255, 0, 255, 0, 0];
    expect(meanRowColour(row)).toEqual({ r: 200, g: 100, b: 50, a: 127.5 });
  });

  it('reads a fully transparent row as nothing drawn', () => {
    expect(meanRowColour([9, 9, 9, 0, 9, 9, 9, 0])).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('is null for an empty or ragged read', () => {
    expect(meanRowColour([])).toBeNull();
    expect(meanRowColour([1, 2, 3])).toBeNull();
    expect(meanRowColour([1, 2, 3, 4, 5])).toBeNull();
  });

  it('treats a non-finite byte as zero', () => {
    expect(meanRowColour([Number.NaN, 10, 20, 255])).toEqual({ r: 0, g: 10, b: 20, a: 255 });
    expect(meanRowColour([10, 10, 10, Number.NaN])).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});
