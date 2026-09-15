import { describe, expect, it } from 'vitest';

import {
  canvasTopColour,
  layerRowAtCanvasTop,
  meanRowColour,
  type Rgba,
  type SkyTopLayer,
} from '@adapters/phaser/sky-top';

/**
 * The band above the canvas is painted with the canvas's own first row
 * (ADR-0044). These are the cases a screenshot would only catch at the right
 * hour, on the right tier, on the right level.
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
