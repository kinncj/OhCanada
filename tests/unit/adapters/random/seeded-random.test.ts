/**
 * The randomness adapter.
 *
 * The property that matters is not "looks random" — it is "replays". A drill a
 * player calls repetitive is only actionable if the same seed produces the same
 * draw on the machine that reads the report.
 */

import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '@adapters/random';

describe('createSeededRandom', () => {
  it('replays exactly from its seed', () => {
    const a = createSeededRandom(12345);
    const b = createSeededRandom(12345);
    const first = Array.from({ length: 64 }, () => a.next());
    const second = Array.from({ length: 64 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('gives different seeds different streams', () => {
    const a = Array.from({ length: 16 }, createSeededRandom(1).next);
    const b = Array.from({ length: 16 }, createSeededRandom(2).next);
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const random = createSeededRandom(7);
    for (let index = 0; index < 5_000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads over the unit interval rather than sitting in one corner', () => {
    /* A generator stuck at 0.5, or one that only ever returns the low half,
       satisfies "inside [0, 1)" perfectly. Ten buckets over ten thousand draws
       should each hold about a thousand; 700 is loose enough never to flake on a
       fixed seed and tight enough to catch a stream with no spread at all. */
    const random = createSeededRandom(99);
    const counts = new Array<number>(10).fill(0);
    for (let index = 0; index < 10_000; index += 1) {
      const bucket = Math.floor(random.next() * 10);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    for (const count of counts) expect(count).toBeGreaterThan(700);
  });

  it('draws integers inside the half-open range', () => {
    const random = createSeededRandom(4);
    const seen = new Set<number>();
    for (let index = 0; index < 1_000; index += 1) seen.add(random.int(3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('returns the lower bound for an empty or inverted range', () => {
    const random = createSeededRandom(4);
    expect(random.int(5, 5)).toBe(5);
    expect(random.int(5, 1)).toBe(5);
  });

  it('picks from a list, and returns undefined only for an empty one', () => {
    const random = createSeededRandom(11);
    expect(random.pick([])).toBeUndefined();
    expect(random.pick(['only'])).toBe('only');
    const picks = new Set(Array.from({ length: 200 }, () => random.pick(['a', 'b', 'c'])));
    expect([...picks].sort()).toEqual(['a', 'b', 'c']);
  });

  it('shuffles into a permutation without touching the input', () => {
    const source = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const shuffled = createSeededRandom(21).shuffle(source);
    expect([...shuffled].sort((a, b) => a - b)).toEqual([...source]);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    /* And it actually moves things: an identity "shuffle" would pass the two
       assertions above and reorder nothing. */
    const anyMoved = shuffled.some((value, index) => value !== source[index]);
    expect(anyMoved).toBe(true);
  });

  it('shuffles an empty and a single-item list without complaint', () => {
    const random = createSeededRandom(3);
    expect(random.shuffle([])).toEqual([]);
    expect(random.shuffle(['x'])).toEqual(['x']);
  });

  it('forks a stream that is independent of its parent but fixed by its label', () => {
    const parent = createSeededRandom(1234);
    const a = parent.fork('study');
    const b = createSeededRandom(1234).fork('study');
    const c = createSeededRandom(1234).fork('exam');

    expect(a.seed).toBe(b.seed);
    expect(a.seed).not.toBe(c.seed);
    expect(Array.from({ length: 8 }, a.next)).toEqual(Array.from({ length: 8 }, b.next));
    expect(Array.from({ length: 8 }, () => createSeededRandom(1234).fork('exam').next())).not.toEqual(
      Array.from({ length: 8 }, () => createSeededRandom(1234).fork('study').next()),
    );
  });

  it('does not let a fork disturb the stream its parent hands out', () => {
    const withFork = createSeededRandom(55);
    withFork.fork('anything');
    const withoutFork = createSeededRandom(55);
    expect(Array.from({ length: 8 }, withFork.next)).toEqual(
      Array.from({ length: 8 }, withoutFork.next),
    );
  });

  it('truncates a fractional seed rather than producing a stream nobody can restate', () => {
    expect(Array.from({ length: 4 }, createSeededRandom(9.7).next)).toEqual(
      Array.from({ length: 4 }, createSeededRandom(9).next),
    );
  });
});
