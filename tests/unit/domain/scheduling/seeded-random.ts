/**
 * A seeded uniform stream for the domain tests.
 *
 * It lives here rather than in `app/adapters` because the real
 * `SeededRandomSource` adapter is not slice 1 task 1.4's to write, and because a
 * scheduler test should not fail when that adapter is refactored. What the tests
 * need from it is the whole of what the domain needs: `next()`, reproducible
 * from a seed.
 *
 * mulberry32 — 32 bits of state, uniform enough for tie-breaking, and short
 * enough to read.
 */

export interface SeededRandom {
  next(): number;
}

export const seededRandom = (seed: number): SeededRandom => {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
};
