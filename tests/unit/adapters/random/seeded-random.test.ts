/**
 * The randomness adapter.
 *
 * The property that matters is not "looks random" — it is "replays". A drill a
 * player calls repetitive is only actionable if the same seed produces the same
 * draw on the machine that reads the report.
 */

import { describe, expect, it } from 'vitest';

import type { SeededRandomSource } from '@application/ports';

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

  it('does not walk a fork back to its parent, or lose the order labels were applied in', () => {
    /*
     * `fork` derived its seed by xoring a label hash over the parent's, and xor
     * is its own inverse and commutative. So `fork('a').fork('a')` replayed the
     * *parent's* exact stream — a grandchild silently desyncing the consumer it
     * was forked away from — and `fork('a').fork('b')` was the same stream as
     * `fork('b').fork('a')`. Neither is reachable from a fixed pair of labels in
     * `app/bootstrap` today, which is precisely why it would have been found
     * late.
     */
    const parent = createSeededRandom(4242);
    const eight = (random: SeededRandomSource): readonly number[] =>
      Array.from({ length: 8 }, () => random.next());

    expect(eight(parent.fork('study').fork('study'))).not.toEqual(
      eight(createSeededRandom(4242)),
    );
    expect(eight(parent.fork('study').fork('exam'))).not.toEqual(
      eight(parent.fork('exam').fork('study')),
    );
    /* And it is still a replay: the same two labels in the same order twice. */
    expect(eight(parent.fork('study').fork('exam'))).toEqual(
      eight(createSeededRandom(4242).fork('study').fork('exam')),
    );
  });

  it('gives two parents different forks of the same label', () => {
    /* A fork whose seed ignored its parent would hand every save the same exam
       stream, which is the same failure as a cold generator wearing a hat. */
    const seeds = new Set(
      Array.from({ length: 40 }, (_unused, index) =>
        createSeededRandom(index + 1).fork('exam').seed,
      ),
    );
    expect(seeds.size).toBe(40);
  });

  it('truncates a fractional seed rather than producing a stream nobody can restate', () => {
    expect(Array.from({ length: 4 }, createSeededRandom(9.7).next)).toEqual(
      Array.from({ length: 4 }, createSeededRandom(9).next),
    );
  });
});

/**
 * A cold generator is a broken generator (the defect this file now pins).
 *
 * sfc32 is specified with warm-up rounds after seeding, and this adapter shipped
 * without them. The consequence was measured, not theorised: over seeds 1 to 40
 * the *first* shuffle of a three-element array was `['c','a','b']` — the same
 * one — for every seed. The stream diverged a few draws in, so every "different
 * seeds give different sequences" test passed while the property Exam mode
 * actually needs was false.
 *
 * The tests below are therefore about the *first* value and the *first* shuffle,
 * over a range of seeds and over small arrays, because that is the only place
 * the defect was ever visible. Each one counts what it saw across a range whose
 * size it asserts first, so a range that silently emptied could not read as a
 * pass (ADR-0024).
 */

const SEEDS = Array.from({ length: 40 }, (_unused, index) => index + 1);

/** Every ordering of three things. Six of them; anything less is a stuck draw. */
const permutationsOfThree = (streams: readonly SeededRandomSource[]): ReadonlySet<string> =>
  new Set(streams.map((random) => random.shuffle(['a', 'b', 'c']).join('')));

describe('a seeded stream is usable from its first draw', () => {
  it('has 40 seeds to measure over, so the counts below are not counts of nothing', () => {
    /* ADR-0024, mechanically: the three cases that follow are all "how many
       distinct things did 40 seeds produce". Over an empty range every one of
       them reads as a pass, so the range is asserted before it is used. */
    expect(SEEDS).toHaveLength(40);
    expect(new Set(SEEDS).size).toBe(40);
  });

  it('varies the first value across seeds in the bits a small draw reads', () => {
    /*
     * Not "the first values differ" — they always did, in the low bits nobody
     * reads. `floor(next() * 3)` is what `shuffle` of a three-element array
     * asks, and it is what was constant. All three buckets must be reachable
     * from the first draw of some seed.
     */
    const firstBuckets = new Set(SEEDS.map((seed) => Math.floor(createSeededRandom(seed).next() * 3)));
    expect([...firstBuckets].sort()).toEqual([0, 1, 2]);
  });

  it('varies the first shuffle of a three-element array across seeds', () => {
    /* The regression itself. Before the warm-up this set had exactly one member
       — `'cab'` — for all 40 seeds. */
    const seen = permutationsOfThree(SEEDS.map((seed) => createSeededRandom(seed)));
    expect([...seen].sort()).toEqual(['abc', 'acb', 'bac', 'bca', 'cab', 'cba']);
  });

  it('varies the first shuffle for adjacent seeds, not only for distant ones', () => {
    /*
     * Seeds 1 and 2 are the case a save-file counter produces, and the case a
     * seeding step that only xors constants over one word cannot separate. Two
     * neighbours are allowed to collide by chance — one ordering in six — so the
     * claim is over ten consecutive pairs: at least eight must differ, which no
     * generator that ignores the low bits of its seed can reach.
     */
    const pairs = Array.from({ length: 10 }, (_unused, index) => index + 1);
    expect(pairs).toHaveLength(10);
    const differing = pairs.filter(
      (seed) =>
        createSeededRandom(seed).shuffle(['a', 'b', 'c']).join('') !==
        createSeededRandom(seed + 1).shuffle(['a', 'b', 'c']).join(''),
    ).length;
    expect(differing).toBeGreaterThanOrEqual(8);
  });

  it('varies the first shuffle a fork hands out, not only the parent stream', () => {
    /*
     * `fork` had the same exposure and for the same reason: FNV-1a of a fixed
     * label xored with a small seed is another small-ish seed, so the forked
     * streams were as correlated as their parents. Measured before the fix:
     * every seed from 1 to 40 forked to `'cba'`. It needs no warm-up of its own
     * — it routes through `createSeededRandom`, so the generator's warm-up is
     * the fork's warm-up — but it does need to be checked rather than assumed.
     */
    const seen = permutationsOfThree(SEEDS.map((seed) => createSeededRandom(seed).fork('exam')));
    expect([...seen].sort()).toEqual(['abc', 'acb', 'bac', 'bca', 'cab', 'cba']);
  });

  it('does not favour one ordering once the first shuffle is warm', () => {
    /*
     * Six orderings over a thousand seeds is about 167 each. A generator that
     * reaches all six but reaches one of them half the time is still biased, and
     * the exam would still open the same way for most players. The band is wide
     * enough never to flake — the seeds are fixed — and narrow enough that the
     * unfixed generator (1000/0/0/0/0/0) is nowhere near it.
     */
    const seeds = Array.from({ length: 1_000 }, (_unused, index) => index + 1);
    expect(seeds).toHaveLength(1_000);
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      const ordering = createSeededRandom(seed).shuffle(['a', 'b', 'c']).join('');
      counts.set(ordering, (counts.get(ordering) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(100);
      expect(count).toBeLessThan(240);
    }
  });
});
