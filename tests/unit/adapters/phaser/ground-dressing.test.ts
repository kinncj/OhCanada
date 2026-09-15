/**
 * The ground dressing's placement rule (ADR-0042).
 *
 * The strip is fixed to one world row and the ground is a polyline, so the only
 * placement that is under the ground everywhere is at or below the polyline's
 * lowest point. The fixture below is the shape that makes the rule necessary:
 * Ottawa's, flat and then falling away.
 */

import { describe, expect, it } from 'vitest';

import {
  groundDressingProblems,
  groundFillFloor,
  lowestGroundPoint,
} from '@adapters/phaser/ground-dressing';

/** Flat, then a descent to the right, then flat again, lower. */
const FALLING = [
  { x: 0, y: 1240 },
  { x: 6000, y: 1240 },
  { x: 6400, y: 1440 },
  { x: 9000, y: 1470 },
];

const FLAT = [
  { x: 0, y: 1280 },
  { x: 8000, y: 1280 },
];

const WORLD_HEIGHT = 1920;

describe('lowestGroundPoint', () => {
  it('is the point with the largest y, because screen y grows downwards', () => {
    expect(lowestGroundPoint(FALLING)).toEqual({ x: 9000, y: 1470 });
  });

  it('takes the first of several that tie', () => {
    expect(lowestGroundPoint(FLAT)).toEqual({ x: 0, y: 1280 });
  });

  it('is null for a polyline with no points', () => {
    expect(lowestGroundPoint([])).toBeNull();
  });
});

describe('groundFillFloor', () => {
  const dressing = { key: 'strip', topY: 1280 };

  it('stops the fill at the strip when the strip reaches the bottom of the world', () => {
    expect(groundFillFloor({ dressing, stripHeight: 640, worldHeight: WORLD_HEIGHT })).toBe(1280);
  });

  it('counts a strip that runs past the bottom as reaching it (its transparent foot is off the world)', () => {
    expect(groundFillFloor({ dressing, stripHeight: 644, worldHeight: WORLD_HEIGHT })).toBe(1280);
  });

  it('fills the whole world when the strip ends above the bottom, so no row is left with nothing under it', () => {
    expect(groundFillFloor({ dressing, stripHeight: 639, worldHeight: WORLD_HEIGHT })).toBe(WORLD_HEIGHT);
  });

  it('fills the whole world when the strip did not draw, which is the band as it always was', () => {
    expect(groundFillFloor({ dressing, stripHeight: null, worldHeight: WORLD_HEIGHT })).toBe(WORLD_HEIGHT);
  });

  it('never reaches past the world, whatever the strip says', () => {
    expect(
      groundFillFloor({ dressing: { key: 'strip', topY: 2400 }, stripHeight: 10, worldHeight: WORLD_HEIGHT }),
    ).toBe(WORLD_HEIGHT);
  });
});

describe('groundDressingProblems', () => {
  it('accepts a strip that starts on a flat walking line', () => {
    expect(groundDressingProblems({ key: 'strip', topY: 1280 }, FLAT, WORLD_HEIGHT)).toEqual([]);
  });

  it('accepts a strip that starts exactly at the lowest point of a falling ground', () => {
    expect(groundDressingProblems({ key: 'strip', topY: 1470 }, FALLING, WORLD_HEIGHT)).toEqual([]);
  });

  it('refuses a strip that starts on the high stretch, because it would hang in the air over the low one', () => {
    const problems = groundDressingProblems({ key: 'strip', topY: 1240 }, FALLING, WORLD_HEIGHT);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('world row 1240');
    expect(problems[0]).toContain('y 1470 at x 9000');
  });

  it('refuses a strip one row above the lowest point: the rule has no tolerance to hide a hairline in', () => {
    expect(groundDressingProblems({ key: 'strip', topY: 1469 }, FALLING, WORLD_HEIGHT)).toHaveLength(1);
  });

  it('refuses a strip that starts at the bottom of the world, which draws nothing', () => {
    const problems = groundDressingProblems({ key: 'strip', topY: WORLD_HEIGHT }, FLAT, WORLD_HEIGHT);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('draws nothing');
  });

  it('judges only the world bound when there is no ground to compare with', () => {
    expect(groundDressingProblems({ key: 'strip', topY: 0 }, [], WORLD_HEIGHT)).toEqual([]);
  });
});
