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

import type { Ride, RideArt } from '@application/ports';
import {
  rideArtProblems,
  rideBobPx,
  rideFor,
  rideFrameKey,
  rideLayerKeys,
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

/**
 * ADR-0035: a ride layer's frames follow the ground, not the clock.
 *
 * The horse's legs are the defect this closes (`OQ-RIG-2`): one still stride
 * sliding along the trail. The rules below are what would each bring a version
 * of it back — a gait on a timer runs on the spot when the player stops, a gait
 * that keeps its last frame stops mid-stride, and a gait that plays under
 * reduced motion is movement nobody asked for.
 */
describe('rideFrameKey', () => {
  const horse: RideArt = {
    key: 'horse-walk-1',
    side: 'behind',
    cycle: {
      rest: 'horse-stand',
      frames: ['horse-walk-1', 'horse-walk-2', 'horse-walk-3', 'horse-walk-4'],
      framePx: 60,
    },
  };
  const frameAt = (distancePx: number, speed = 620, reducedMotion = false): string =>
    rideFrameKey({ layer: horse, distancePx, speed, reducedMotion });

  it('draws a layer with no cycle as its one key, at any distance and speed', () => {
    const still: RideArt = { key: 'car-front', side: 'front' };
    for (const distancePx of [0, 59, 60, 1e6]) {
      expect(rideFrameKey({ layer: still, distancePx, speed: 760, reducedMotion: false })).toBe('car-front');
      expect(rideFrameKey({ layer: still, distancePx, speed: 0, reducedMotion: false })).toBe('car-front');
    }
  });

  it('advances one frame per framePx travelled, in order, and starts over after the last', () => {
    expect(frameAt(0)).toBe('horse-walk-1');
    expect(frameAt(59.9)).toBe('horse-walk-1');
    expect(frameAt(60)).toBe('horse-walk-2');
    expect(frameAt(120)).toBe('horse-walk-3');
    expect(frameAt(180)).toBe('horse-walk-4');
    expect(frameAt(239.9)).toBe('horse-walk-4');
    expect(frameAt(240)).toBe('horse-walk-1');
    expect(frameAt(60 * 4 * 1000 + 130)).toBe('horse-walk-3');
  });

  it('picks the frame by distance alone, so a slow ride steps slowly and a fast one quickly', () => {
    /* The same ground covered is the same frame whatever the speed: the gait
       cannot run ahead of the trail at a crawl or fall behind it at cruise. */
    for (const distancePx of [0, 75, 150, 225, 300]) {
      expect(frameAt(distancePx, 40)).toBe(frameAt(distancePx, 620));
      expect(frameAt(distancePx, -620)).toBe(frameAt(distancePx, 620));
    }
  });

  it('holds the rest frame at rest, whatever frame the ride stopped on', () => {
    for (const distancePx of [0, 60, 130, 199]) {
      expect(frameAt(distancePx, 0)).toBe('horse-stand');
    }
    expect(frameAt(130, Number.NaN)).toBe('horse-stand');
  });

  it('holds the layer`s key under reduced motion, at rest and at cruise, and never advances', () => {
    const seen = new Set<string>();
    for (let distancePx = 0; distancePx <= 960; distancePx += 7) {
      for (const speed of [0, 40, 620]) seen.add(frameAt(distancePx, speed, true));
    }
    expect([...seen]).toEqual(['horse-walk-1']);
  });

  it('lands on a frame for a distance nothing should produce', () => {
    expect(horse.cycle?.frames).toContain(frameAt(-61));
    expect(frameAt(Number.POSITIVE_INFINITY)).toBe('horse-walk-1');
  });
});

describe('rideLayerKeys', () => {
  it('is the key alone for a layer with no cycle', () => {
    expect(rideLayerKeys({ key: 'car-front', side: 'front' })).toEqual(['car-front']);
  });

  it('names each texture a cycled layer can draw once, the key among its frames included', () => {
    expect(
      rideLayerKeys({
        key: 'walk-1',
        side: 'behind',
        cycle: { rest: 'stand', frames: ['walk-1', 'walk-2', 'walk-1'], framePx: 50 },
      }),
    ).toEqual(['walk-1', 'stand', 'walk-2']);
  });
});

describe('rideArtProblems', () => {
  const loaded =
    (sizes: Readonly<Record<string, RideArtSize>>) =>
    (key: string): RideArtSize | null =>
      sizes[key] ?? null;

  const cycling: Ride = {
    ...animal,
    art: [
      {
        key: 'animal-walk-1',
        side: 'behind',
        cycle: { rest: 'animal-stand', frames: ['animal-walk-1', 'animal-walk-2'], framePx: 60 },
      },
    ],
  };
  const BODY: RideArtSize = { width: 300, height: 220 };

  it('finds nothing wrong with a cycled layer whose every frame loaded at one size', () => {
    expect(
      rideArtProblems(cycling, loaded({ 'animal-walk-1': BODY, 'animal-walk-2': BODY, 'animal-stand': BODY })),
    ).toEqual([]);
  });

  it('says which frame did not load, the rest frame included', () => {
    const problems = rideArtProblems(cycling, loaded({ 'animal-walk-1': BODY }));
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toContain('"animal-stand"');
    expect(problems.join('\n')).toContain('"animal-walk-2"');
  });

  it('refuses a frame of another size, which would move the rider`s seat mid-stride', () => {
    const problems = rideArtProblems(
      cycling,
      loaded({ 'animal-walk-1': BODY, 'animal-walk-2': { width: 300, height: 224 }, 'animal-stand': BODY }),
    );
    expect(problems.join('\n')).toContain('two sizes');
    expect(problems.join('\n')).toContain('"animal-walk-2"');
  });

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
