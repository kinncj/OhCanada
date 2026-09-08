/**
 * The ground polyline, sampled.
 *
 * Small module, and the assertions are correspondingly literal — but two of them
 * are load-bearing and neither is obvious: the slope *sign* (screen y grows
 * downwards, so a descent is a negative slope) and the flat extension beyond the
 * ends (a level's ground is only defined where the author drew it). Both are
 * the kind of thing that reads as arbitrary until it is wrong, at which point
 * the skater is standing in the sky or accelerating up a hill.
 */

import { describe, expect, it } from 'vitest';

import { MAX_GRADIENT, groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';

/** Flat, then a descent to the right, then flat again. */
const CANAL = [
  { x: 0, y: 1000 },
  { x: 1000, y: 1000 },
  { x: 1400, y: 1200 },
  { x: 2000, y: 1200 },
];

describe('groundYAt', () => {
  it('returns the surface at an authored point', () => {
    expect(groundYAt(CANAL, 1000)).toBe(1000);
    expect(groundYAt(CANAL, 1400)).toBe(1200);
  });

  it('interpolates between two points', () => {
    expect(groundYAt(CANAL, 1200)).toBe(1100);
    expect(groundYAt(CANAL, 1100)).toBe(1050);
  });

  it('is flat beyond both ends rather than extrapolating off the world', () => {
    expect(groundYAt(CANAL, -5_000)).toBe(1000);
    expect(groundYAt(CANAL, 9_000)).toBe(1200);
  });

  it('answers 0 for a polyline with no points instead of throwing', () => {
    expect(groundYAt([], 10)).toBe(0);
  });

  it('survives a degenerate zero-width segment', () => {
    const doubled = [
      { x: 0, y: 100 },
      { x: 500, y: 100 },
      { x: 500, y: 300 },
      { x: 900, y: 300 },
    ];
    expect(groundYAt(doubled, 500)).toBe(300);
    expect(Number.isFinite(groundYAt(doubled, 500))).toBe(true);
  });
});

describe('slopeAt', () => {
  it('is zero on the flat', () => {
    expect(slopeAt(CANAL, 500)).toBe(0);
    expect(slopeAt(CANAL, 1700)).toBe(0);
  });

  it('is negative where the ground falls to the right', () => {
    /* Screen y grows downwards, so a segment whose y increases is a descent.
       `LocomotionIntent.slope` is documented as -1 steep down, 1 steep up, and
       the locomotion strategy multiplies this by the direction of travel — get
       the sign wrong here and skating downhill slows you down. */
    expect(slopeAt(CANAL, 1200)).toBeLessThan(0);
    expect(slopeAt(CANAL, 1200)).toBeCloseTo(-0.5, 6);
  });

  it('clamps a gradient steeper than 45 degrees rather than reporting a wall', () => {
    const cliff = [
      { x: 0, y: 0 },
      { x: 10, y: 900 },
    ];
    expect(slopeAt(cliff, 5)).toBe(-MAX_GRADIENT);
    const wall = [
      { x: 0, y: 900 },
      { x: 10, y: 0 },
    ];
    expect(slopeAt(wall, 5)).toBe(MAX_GRADIENT);
  });

  it('is zero beyond both ends, where there is no drawn ground to have a slope', () => {
    expect(slopeAt(CANAL, -100)).toBe(0);
    expect(slopeAt(CANAL, 5_000)).toBe(0);
  });

  it('answers 0 for an empty polyline', () => {
    expect(slopeAt([], 10)).toBe(0);
  });

  it('answers 0 across a zero-width segment', () => {
    expect(
      slopeAt(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
        ],
        100,
      ),
    ).toBe(0);
  });
});

describe('levelBounds', () => {
  it('is the intersection of the declared size and the drawn ground', () => {
    expect(levelBounds(CANAL, { x: 2000, y: 1920 })).toEqual({ left: 0, right: 2000 });
  });

  it('never lets the player past the end of the painted level', () => {
    expect(levelBounds(CANAL, { x: 9_000, y: 1920 }).right).toBe(2000);
  });

  it('never lets the player past the camera clamp either', () => {
    expect(levelBounds(CANAL, { x: 900, y: 1920 }).right).toBe(900);
  });

  it('does not produce an inverted span when the two disagree completely', () => {
    const bounds = levelBounds([{ x: 500, y: 0 }, { x: 800, y: 0 }], { x: 100, y: 1920 });
    expect(bounds.right).toBeGreaterThanOrEqual(bounds.left);
  });

  it('handles an empty polyline without producing NaN', () => {
    const bounds = levelBounds([], { x: 1000, y: 1920 });
    expect(Number.isFinite(bounds.left)).toBe(true);
    expect(Number.isFinite(bounds.right)).toBe(true);
  });
});
