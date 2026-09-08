/**
 * RandomSource — the only source of randomness.
 *
 * Distractor order, ambient NPC behaviour and exam question selection are all
 * random, and all of them must be reproducible in a test and in a bug report.
 * The domain therefore never calls `Math.random()`; it takes a `RandomSource`.
 * A seeded implementation makes a failing exam draw replayable from its seed.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call site: slice 1 task 1.4 (`QuestionScheduler`, seeded RNG).
 * Whoever writes the first implementation may change this interface without an
 * ADR, and removes this marker in the same change.
 */

export interface RandomSource {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** `undefined` only when `items` is empty. */
  pick<T>(items: readonly T[]): T | undefined;
  /** Returns a new array; never mutates the input. */
  shuffle<T>(items: readonly T[]): readonly T[];
}

/** A `RandomSource` whose stream can be reproduced. Used by tests and by Exam mode. */
export interface SeededRandomSource extends RandomSource {
  readonly seed: number;
  /** An independent stream derived from this one, so one consumer cannot desync another. */
  fork(label: string): SeededRandomSource;
}
