/**
 * The memory model, pinned against `ts-fsrs` 5.4.2.
 *
 * `app/domain` cannot import `ts-fsrs`: `.dependency-cruiser.cjs`'s
 * `domain-is-pure` rule forbids `app/domain` reaching anything outside
 * `app/domain` and `common/`, and an npm package resolves under `node_modules`.
 * `application-no-frameworks` says the same one layer up. So the model is
 * written out in `app/domain/scheduling/memory-model.ts` and this file is what
 * makes that safe: `ts-fsrs` is the oracle for every number, checked exactly,
 * not to a tolerance.
 *
 * If `ts-fsrs` is upgraded and its weights or formulas change, this file fails
 * and someone decides deliberately whether TrueNorth follows. That is the point:
 * a silent divergence between the domain and the reference is exactly what a
 * hand-written model risks, and it is the only real cost of the layering rule.
 *
 * A test may import a library the code under test may not — `depcruise app
 * common` never has `tests/` in scope, and ADR-0008's "a test is not a consumer"
 * is about ports, not about oracles.
 */

import {
  FSRSAlgorithm,
  Rating,
  computeDecayFactor,
  default_maximum_interval,
  default_request_retention,
  default_w,
  forgetting_curve,
  generatorParameters,
} from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAXIMUM_INTERVAL,
  DEFAULT_MEMORY_PARAMETERS,
  DEFAULT_REQUEST_RETENTION,
  GRADE_AGAIN,
  GRADE_EASY,
  GRADE_GOOD,
  GRADE_HARD,
  MAX_STABILITY,
  MIN_STABILITY,
  clamp,
  initialDifficulty,
  initialStability,
  intervalModifier,
  nextDifficulty,
  nextForgetStability,
  nextIntervalDays,
  nextMemoryState,
  nextRecallStability,
  nextShortTermStability,
  recallProbability,
  roundTo8,
} from '@domain/scheduling/memory-model';
import type { Grade } from '@domain/scheduling/memory-model';

const w = DEFAULT_MEMORY_PARAMETERS;

/** The reference algorithm, on the same defaults the domain hardcodes. */
const reference = new FSRSAlgorithm(generatorParameters());

const GRADES: readonly Grade[] = [GRADE_AGAIN, GRADE_HARD, GRADE_GOOD, GRADE_EASY];

/** Difficulties and stabilities spread over the useful range, plus the edges. */
const DIFFICULTIES = [1, 1.7, 3.25, 5, 6.9, 8.4, 10];
const STABILITIES = [MIN_STABILITY, 0.01, 0.212, 1, 2.3065, 9.5, 40, 365, 3650, MAX_STABILITY];
const ELAPSED_DAYS = [0, 1, 2, 5, 13, 60, 400, 4000];

describe('the domain memory model matches ts-fsrs 5.4.2', () => {
  it('ships the same weights and the same defaults', () => {
    expect([...w]).toStrictEqual([...default_w]);
    // generatorParameters() runs migrate + clip; if either changed default_w the
    // domain constant would be stale while still looking equal to `default_w`.
    expect([...generatorParameters().w]).toStrictEqual([...w]);
    expect(DEFAULT_REQUEST_RETENTION).toBe(default_request_retention);
    expect(DEFAULT_MAXIMUM_INTERVAL).toBe(default_maximum_interval);
  });

  it('maps its four grade constants onto the reference ratings', () => {
    expect(GRADE_AGAIN).toBe(Rating.Again);
    expect(GRADE_HARD).toBe(Rating.Hard);
    expect(GRADE_GOOD).toBe(Rating.Good);
    expect(GRADE_EASY).toBe(Rating.Easy);
  });

  it('derives the same decay and factor', () => {
    const { decay, factor } = computeDecayFactor(w as unknown as number[]);
    // Not exported by name; observed through the curve it defines.
    expect(decay).toBe(-w[20]);
    expect(factor).toBe(roundTo8(Math.exp((1 / decay) * Math.log(0.9)) - 1));
  });

  it('computes the same recall probability everywhere it matters', () => {
    for (const stability of STABILITIES) {
      for (const elapsed of ELAPSED_DAYS) {
        expect(recallProbability(w, elapsed, stability)).toBe(
          forgetting_curve(w as unknown as number[], elapsed, stability),
        );
      }
    }
  });

  it('computes the same interval modifier', () => {
    for (const retention of [0.7, 0.8, 0.9, 0.95, 1]) {
      expect(intervalModifier(w, retention)).toBe(
        reference.calculate_interval_modifier(retention),
      );
    }
  });

  it('computes the same initial stability and difficulty for every grade', () => {
    for (const g of GRADES) {
      expect(initialStability(w, g)).toBe(reference.init_stability(g));
      expect(initialDifficulty(w, g)).toBe(reference.init_difficulty(g));
    }
  });

  it('computes the same next difficulty', () => {
    for (const d of DIFFICULTIES) {
      for (const g of GRADES) {
        expect(nextDifficulty(w, d, g)).toBe(reference.next_difficulty(d, g));
      }
    }
  });

  it('computes the same recall, forget and short-term stabilities', () => {
    for (const d of DIFFICULTIES) {
      for (const s of STABILITIES) {
        for (const elapsed of ELAPSED_DAYS) {
          const r = recallProbability(w, elapsed, s);
          expect(nextForgetStability(w, d, s, r)).toBe(
            reference.next_forget_stability(d, s, r),
          );
          for (const g of GRADES) {
            expect(nextRecallStability(w, d, s, r, g)).toBe(
              reference.next_recall_stability(d, s, r, g),
            );
          }
        }
        for (const g of GRADES) {
          expect(nextShortTermStability(w, s, g)).toBe(
            reference.next_short_term_stability(s, g),
          );
        }
      }
    }
  });

  it('computes the same whole state transition, including the first sighting', () => {
    for (const g of GRADES) {
      expect(nextMemoryState(w, null, 0, g)).toStrictEqual(reference.next_state(null, 0, g));
    }
    for (const d of DIFFICULTIES) {
      for (const s of STABILITIES) {
        for (const elapsed of ELAPSED_DAYS) {
          for (const g of GRADES) {
            expect(nextMemoryState(w, { difficulty: d, stability: s }, elapsed, g)).toStrictEqual(
              reference.next_state({ difficulty: d, stability: s }, elapsed, g),
            );
          }
        }
      }
    }
  });

  it('honours a caller-supplied recall probability, as the reference does', () => {
    const previous = { difficulty: 5, stability: 9.5 };
    for (const g of GRADES) {
      expect(nextMemoryState(w, previous, 13, g, 0.42)).toStrictEqual(
        reference.next_state(previous, 13, g, 0.42),
      );
    }
  });

  it('computes the same interval in days', () => {
    for (const s of STABILITIES) {
      expect(nextIntervalDays(w, s)).toBe(reference.next_interval(s, 0));
    }
  });
});

describe('the arithmetic helpers the model is built from', () => {
  it('clamps on both sides and passes the middle through', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
  });

  it('rounds to eight decimals, which is where the reference rounds', () => {
    expect(roundTo8(1 / 3)).toBe(0.33333333);
    expect(roundTo8(2)).toBe(2);
  });

  it('never lets an interval fall below one day or above the maximum', () => {
    expect(nextIntervalDays(w, MIN_STABILITY)).toBe(1);
    expect(nextIntervalDays(w, MAX_STABILITY, DEFAULT_REQUEST_RETENTION, 30)).toBe(30);
  });
});
