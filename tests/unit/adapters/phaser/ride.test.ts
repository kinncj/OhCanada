/**
 * ADR-0031: a ride is placed at its rider, and rocks with them, by arithmetic.
 *
 * The defect is a picture — a figure walking along a track on a level whose HUD
 * says Train — and the fix is a picture too, which is exactly why its rules are
 * held here rather than by a browser. Where the car goes, where the passenger's
 * feet go, what mirrors and what does not, and that reduced motion stills the
 * rock are all properties of `ride.ts`, which imports no Phaser and runs under
 * `environment: 'node'`.
 */

import { describe, expect, it } from 'vitest';

import type { Ride } from '@application/ports';
import {
  rideArtProblems,
  rideBobPx,
  rideFor,
  ridePlacement,
  type RideArtSize,
} from '@adapters/phaser/ride';

const car: Ride = {
  mode: 'rail',
  art: [{ key: 'car-front', side: 'front' }],
  riderAnchor: { x: 520, y: 416 },
  groundLineY: 280,
  turnsWithRider: false,
  footprint: { x: 380, width: 320 },
  bob: { amplitudePx: 2, periodPx: 180 },
  track: { artKey: 'car-track', topY: 532 },
};

const animal: Ride = {
  mode: 'gallop',
  art: [
    { key: 'animal-body', side: 'behind' },
    { key: 'animal-near-legs', side: 'front' },
  ],
  riderAnchor: { x: 100, y: 60 },
  groundLineY: 200,
  turnsWithRider: true,
  footprint: { x: 0, width: 240 },
};

const SIZE: RideArtSize = { width: 1520, height: 540 };

describe('rideFor', () => {
  it('answers null for a mode with no ride, which is most modes and is not a failure', () => {
    expect(rideFor([car], 'walk')).toBeNull();
    expect(rideFor([], 'rail')).toBeNull();
  });

  it('answers the one ride that carries the mode', () => {
    expect(rideFor([animal, car], 'rail')).toBe(car);
  });

  it('refuses two rides for one mode instead of quietly choosing one (ADR-0024)', () => {
    expect(() => rideFor([car, { ...car }], 'rail')).toThrow(/2 rides carry the mode "rail"/u);
  });
});

describe('ridePlacement', () => {
  const at = (ride: Ride, facing: 'left' | 'right', bobPx = 0) =>
    ridePlacement({ ride, size: SIZE, riderX: 4000, groundY: 1280, facing, bobPx });

  it('puts the art`s rider anchor under the rider and its ground row on the ground', () => {
    const placed = at(car, 'right');
    const left = placed.centreX - SIZE.width / 2;
    expect(left + car.riderAnchor.x).toBe(4000);
    expect(placed.top + car.groundLineY).toBe(1280);
  });

  it('seats the rider on the anchor, not on the ground', () => {
    const placed = at(car, 'right');
    expect(placed.riderY).toBe(placed.top + car.riderAnchor.y);
    /* This car's floor is below the ground line: it runs on a nearer line, so
       the landmarks on the walking line stand beyond it. */
    expect(placed.riderY).toBe(1280 - 280 + 416);
  });

  it('does not mirror a ride that does not turn, and keeps the rider in the same seat', () => {
    const right = at(car, 'right');
    const left = at(car, 'left');
    expect(left.flipX).toBe(false);
    expect(left.centreX).toBe(right.centreX);
    expect(left.riderY).toBe(right.riderY);
  });

  it('mirrors a ride that turns about the rider, so the rider does not jump seats', () => {
    const right = at(animal, 'right');
    const left = at(animal, 'left');
    expect(right.flipX).toBe(false);
    expect(left.flipX).toBe(true);
    /* Mirrored about the anchor: the art's left edge moves so the anchor, read
       from the flipped art's right, is still under the rider. */
    const leftEdgeFlipped = left.centreX - SIZE.width / 2;
    expect(leftEdgeFlipped + (SIZE.width - animal.riderAnchor.x)).toBe(4000);
    expect(left.riderY).toBe(right.riderY);
  });

  it('moves the art and the rider together by the rock, and never the track', () => {
    const still = at(car, 'right', 0);
    const rocked = at(car, 'right', -2);
    expect(rocked.top - still.top).toBe(-2);
    expect(rocked.riderY - still.riderY).toBe(-2);
    expect(rocked.trackTop).toBe(still.trackTop);
    expect(still.trackTop).toBe(1280 - 280 + 532);
  });

  it('has no track for a ride that runs on the level`s own ground', () => {
    expect(at(animal, 'right').trackTop).toBeNull();
  });
});

describe('rideBobPx', () => {
  const bob = { amplitudePx: 2, periodPx: 180 };

  it('is still with no bob declared', () => {
    expect(rideBobPx({ bob: undefined, distancePx: 90, speedFraction: 1, reducedMotion: false })).toBe(0);
  });

  it('is still at rest, whatever phase the ride stopped at', () => {
    expect(rideBobPx({ bob, distancePx: 90, speedFraction: 0, reducedMotion: false })).toBe(0);
  });

  it('is still under reduced motion even at cruise — the engine`s rule, not a level`s', () => {
    for (const distancePx of [0, 45, 90, 135]) {
      expect(rideBobPx({ bob, distancePx, speedFraction: 1, reducedMotion: true })).toBe(0);
    }
  });

  it('lifts between joints, up to the amplitude, and settles on each joint', () => {
    expect(rideBobPx({ bob, distancePx: 90, speedFraction: 1, reducedMotion: false })).toBeCloseTo(-2, 10);
    expect(rideBobPx({ bob, distancePx: 180, speedFraction: 1, reducedMotion: false })).toBe(0);
    for (let distancePx = 0; distancePx <= 720; distancePx += 7) {
      const lift = rideBobPx({ bob, distancePx, speedFraction: 1, reducedMotion: false });
      expect(lift).toBeLessThanOrEqual(0);
      expect(lift).toBeGreaterThanOrEqual(-2);
    }
  });

  it('grows with speed and clamps a speed past cruise', () => {
    const half = rideBobPx({ bob, distancePx: 90, speedFraction: 0.5, reducedMotion: false });
    const over = rideBobPx({ bob, distancePx: 90, speedFraction: 3, reducedMotion: false });
    expect(half).toBeCloseTo(-1, 10);
    expect(over).toBeCloseTo(-2, 10);
    expect(rideBobPx({ bob, distancePx: 90, speedFraction: Number.NaN, reducedMotion: false })).toBe(0);
  });
});

describe('rideArtProblems', () => {
  const loaded =
    (sizes: Readonly<Record<string, RideArtSize>>) =>
    (key: string): RideArtSize | null =>
      sizes[key] ?? null;

  it('finds nothing wrong with a ride whose art all loaded at one size', () => {
    expect(rideArtProblems(car, loaded({ 'car-front': SIZE, 'car-track': { width: 480, height: 56 } }))).toEqual([]);
  });

  it('says which texture did not load, the track included', () => {
    const problems = rideArtProblems(car, loaded({ 'car-front': SIZE }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"car-track"');
  });

  it('refuses layers of two sizes, which one anchor cannot register', () => {
    const problems = rideArtProblems(
      animal,
      loaded({ 'animal-body': { width: 300, height: 220 }, 'animal-near-legs': { width: 300, height: 200 } }),
    );
    expect(problems.join('\n')).toContain('two sizes');
  });

  it('refuses an anchor outside the art, and a ground row below it', () => {
    const problems = rideArtProblems(
      { ...car, riderAnchor: { x: 2000, y: 10 }, groundLineY: 900 },
      loaded({ 'car-front': SIZE, 'car-track': { width: 480, height: 56 } }),
    );
    expect(problems.join('\n')).toContain('outside its 1520x540 art');
    expect(problems.join('\n')).toContain('row 900');
  });

  it('reports every missing layer rather than stopping at the first', () => {
    expect(rideArtProblems(animal, loaded({}))).toHaveLength(2);
  });
});
