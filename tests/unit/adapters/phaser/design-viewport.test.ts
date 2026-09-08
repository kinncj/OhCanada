/**
 * The reconciliation between one design resolution and any number of canvas
 * pixels.
 *
 * The tier degrades pixel count now — `renderScale` and `maxPixelRatio` were
 * declared in every graphics preset and applied by nothing — so the drawing
 * buffer is no longer 1080x1920 while every scene still draws in those
 * coordinates. The camera **origin** is the part worth testing: Phaser anchors
 * zoom on it and it defaults to the centre, which would inset every
 * screen-locked thing this adapter draws by 12.5% of the canvas at a scale of
 * 0.75 and overflow it by the same amount on the other side. That is a
 * mis-framed portrait canvas, and it is silent.
 */

import { describe, expect, it } from 'vitest';

import { backingScaleOf, fitCameraToDesign } from '@adapters/phaser/design-viewport';

function camera(): { origin: [number, number] | null; zoom: number | null } & {
  setOrigin(x: number, y: number): void;
  setZoom(value: number): void;
} {
  const state = {
    origin: null as [number, number] | null,
    zoom: null as number | null,
    setOrigin(x: number, y: number): void {
      state.origin = [x, y];
    },
    setZoom(value: number): void {
      state.zoom = value;
    },
  };
  return state;
}

describe('backingScaleOf', () => {
  it('is the ratio of the buffer to the design resolution', () => {
    expect(backingScaleOf(810, 1080)).toBeCloseTo(0.75, 5);
    expect(backingScaleOf(1080, 1080)).toBe(1);
  });

  it('is 1 when there is nothing to measure, rather than 0', () => {
    /* A scene created before the scale manager has laid anything out. A 0 here
       would become a zoom of 0 and a blank canvas. */
    expect(backingScaleOf(0, 1080)).toBe(1);
    expect(backingScaleOf(810, 0)).toBe(1);
    expect(backingScaleOf(Number.NaN, 1080)).toBe(1);
  });
});

describe('fitCameraToDesign', () => {
  it('zooms from the top-left, never the centre', () => {
    const main = camera();
    fitCameraToDesign(main, 810, 1080);

    /* The whole point. At origin (0,0) a design rect from (0,0) to (1080,1920)
       lands exactly on an 810x1440 buffer; at the default centre origin it
       would land at x = 101..911 on an 810-wide canvas. */
    expect(main.origin).toEqual([0, 0]);
    expect(main.zoom).toBeCloseTo(0.75, 5);
  });

  it('composes with the level’s own authored zoom rather than replacing it', () => {
    const main = camera();
    /* A level that wants to see half as much world still does — at whatever
       resolution the tier chose. */
    expect(fitCameraToDesign(main, 540, 1080, 2)).toBeCloseTo(0.5, 5);
    expect(main.zoom).toBeCloseTo(1, 5);
  });

  it('ignores a zoom that is not a zoom', () => {
    const main = camera();
    fitCameraToDesign(main, 1080, 1080, 0);
    expect(main.zoom).toBe(1);
  });

  it('changes nothing at full resolution, which is what the high tier gets', () => {
    const main = camera();
    expect(fitCameraToDesign(main, 1080, 1080, 1)).toBe(1);
    expect(main.zoom).toBe(1);
  });
});
