/**
 * RandomSource — the only source of randomness.
 *
 * Distractor order, ambient NPC behaviour and exam question selection are all
 * random, and all of them must be reproducible in a test and in a bug report.
 * The domain therefore never calls `Math.random()`; it takes a `RandomSource`.
 * A seeded implementation makes a failing exam draw replayable from its seed.
 *
 * The ADR-0008 marker is gone: `ScheduleReview` (slice 1 task 1.5) is the first
 * call site. It passes this port straight into the domain draw, which declares
 * its own one-method `Randomness` because `domain-is-pure` forbids it importing
 * the application layer; `RandomSource` satisfies that structurally, so a seeded
 * stream reaches the scheduler with no adapter in between.
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
