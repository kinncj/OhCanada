/**
 * The memory model behind review scheduling — FSRS-6, written out as pure
 * functions over plain numbers.
 *
 * Why this is here and not `import { fsrs } from 'ts-fsrs'`:
 * `.dependency-cruiser.cjs` rule `domain-is-pure` forbids `app/domain` from
 * importing *anything* outside `app/domain` and `common/`, and an npm package
 * resolves to `node_modules/...`, which is outside both. The rule fires — it was
 * checked, not assumed. `application-no-frameworks` forbids the same thing one
 * layer up. So a library could only be reached from an adapter, which would put
 * the scheduling maths outside the >= 90% coverage gate and behind a port whose
 * only implementation is arithmetic. The maths lives here instead, and
 * `tests/unit/domain/scheduling/memory-model.test.ts` pins every function in
 * this file against `ts-fsrs` 5.4.2 as an oracle: the library is the authority
 * on the numbers, this file is the authority on the vocabulary, and the test is
 * what keeps them equal.
 *
 * Nothing in this file is player-facing. `stability`, `difficulty` and
 * `recallProbability` are memory-model terms that any replacement model has an
 * equivalent for; the words the UI must never show (TN-CARD-02) do not appear in
 * any exported type or value.
 *
 * All functions are total and pure: no clock, no randomness, no mutation.
 */

/**
 * The 21 model weights. A fixed-length tuple rather than `readonly number[]` so
 * that `w[8]` is a `number` under `noUncheckedIndexedAccess` instead of
 * `number | undefined` — the alternative is 21 non-null assertions in the middle
 * of the arithmetic.
 */
export type MemoryParameters = readonly [
  number, number, number, number, number, number, number,
  number, number, number, number, number, number, number,
  number, number, number, number, number, number, number,
];

/** How well a question is known, and how hard it is. The whole persisted model. */
export interface MemoryState {
  /** Days until recall probability falls to 0.9. Larger is better known. */
  readonly stability: number;
  /** 1–10. Larger is harder for this player. */
  readonly difficulty: number;
}

/**
 * What the player did with the question, in the model's vocabulary.
 *
 * TrueNorth's card is four options and one tap (TN-CARD-03/04): there is no
 * "how hard was that?" prompt anywhere in the stories, so only two of the four
 * FSRS grades can ever occur. `Hard` is here because the Good interval is
 * defined in terms of it (see `question-scheduler`'s caller,
 * `review-record.ts`), not because anything can produce it.
 */
export const GRADE_AGAIN = 1;
export const GRADE_HARD = 2;
export const GRADE_GOOD = 3;
export const GRADE_EASY = 4;

export type Grade = 1 | 2 | 3 | 4;

/** Smallest stability the model will represent, in days. */
export const MIN_STABILITY = 0.001;
/** Largest stability the model will represent, in days (100 years). */
export const MAX_STABILITY = 36500;

/**
 * FSRS-6 default weights. Shipped as data, not tuned per player: TrueNorth keeps
 * no server and no training pipeline, so there is nothing to optimise them with.
 */
export const DEFAULT_MEMORY_PARAMETERS: MemoryParameters = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
  0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

/** Recall probability the scheduler aims for at the moment a question comes due. */
export const DEFAULT_REQUEST_RETENTION = 0.9;
/** Longest gap the scheduler will ever leave, in days. */
export const DEFAULT_MAXIMUM_INTERVAL = 36500;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Round to eight decimals. Present because the reference implementation rounds
 * at exactly these points; dropping it makes this file and the oracle disagree
 * in the tenth decimal and then, after a few reviews, in the scheduled day.
 */
export const roundTo8 = (value: number): number => Math.round(value * 1e8) / 1e8;

interface DecayFactor {
  readonly decay: number;
  readonly factor: number;
}

const decayFactor = (w: MemoryParameters): DecayFactor => {
  const decay = -w[20];
  return { decay, factor: roundTo8(Math.exp((1 / decay) * Math.log(0.9)) - 1) };
};

/**
 * Probability the player still knows the answer, `elapsedDays` after the last
 * review of a memory with this stability. 1 at the moment of review, falling
 * from there.
 */
export const recallProbability = (
  w: MemoryParameters,
  elapsedDays: number,
  stability: number,
): number => {
  const { decay, factor } = decayFactor(w);
  return roundTo8(Math.pow(1 + (factor * elapsedDays) / stability, decay));
};

/** Days-per-unit-stability that hit `requestRetention` exactly. */
export const intervalModifier = (
  w: MemoryParameters,
  requestRetention: number,
): number => {
  const { decay, factor } = decayFactor(w);
  return roundTo8((Math.pow(requestRetention, 1 / decay) - 1) / factor);
};

/** Stability of a question seen for the first time and graded `g`. */
export const initialStability = (w: MemoryParameters, g: Grade): number => {
  const base = g === GRADE_AGAIN ? w[0] : g === GRADE_HARD ? w[1] : g === GRADE_GOOD ? w[2] : w[3];
  return Math.max(base, 0.1);
};

/** Difficulty of a question seen for the first time and graded `g`. */
export const initialDifficulty = (w: MemoryParameters, g: Grade): number =>
  roundTo8(w[4] - Math.exp((g - 1) * w[5]) + 1);

const linearDamping = (deltaD: number, oldD: number): number =>
  roundTo8((deltaD * (10 - oldD)) / 9);

const meanReversion = (w: MemoryParameters, init: number, current: number): number =>
  roundTo8(w[7] * init + (1 - w[7]) * current);

/** Difficulty after grading a question that already has one. Always in [1, 10]. */
export const nextDifficulty = (w: MemoryParameters, d: number, g: Grade): number =>
  clamp(
    meanReversion(w, initialDifficulty(w, GRADE_EASY), d + linearDamping(-w[6] * (g - 3), d)),
    1,
    10,
  );

/** Stability after the player answered from memory (any grade but Again). */
export const nextRecallStability = (
  w: MemoryParameters,
  d: number,
  s: number,
  r: number,
  g: Grade,
): number => {
  const hardPenalty = g === GRADE_HARD ? w[15] : 1;
  const easyBound = g === GRADE_EASY ? w[16] : 1;
  return roundTo8(
    clamp(
      s *
        (1 +
          Math.exp(w[8]) *
            (11 - d) *
            Math.pow(s, -w[9]) *
            (Math.exp((1 - r) * w[10]) - 1) *
            hardPenalty *
            easyBound),
      MIN_STABILITY,
      MAX_STABILITY,
    ),
  );
};

/** Stability after the player could not recall the answer. */
export const nextForgetStability = (
  w: MemoryParameters,
  d: number,
  s: number,
  r: number,
): number =>
  roundTo8(
    clamp(
      w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
      MIN_STABILITY,
      MAX_STABILITY,
    ),
  );

/** Stability after a second look in the same sitting, before any time has passed. */
export const nextShortTermStability = (
  w: MemoryParameters,
  s: number,
  g: Grade,
): number => {
  const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
  const masked = g >= GRADE_HARD ? Math.max(sinc, 1) : sinc;
  return roundTo8(clamp(s * masked, MIN_STABILITY, MAX_STABILITY));
};

/**
 * The whole state transition: `previous` (or `null` for a question never seen),
 * the whole days since the last review, and the grade, in — the new state out.
 *
 * `recall` is the recall probability at review time. The caller passes it when it
 * has already computed it for another grade, so that two grades of the same
 * review agree to the last decimal.
 */
export const nextMemoryState = (
  w: MemoryParameters,
  previous: MemoryState | null,
  elapsedDays: number,
  g: Grade,
  recall?: number,
): MemoryState => {
  if (previous === null) {
    return {
      difficulty: clamp(initialDifficulty(w, g), 1, 10),
      stability: initialStability(w, g),
    };
  }

  const { difficulty: d, stability: s } = previous;
  const r = recall ?? recallProbability(w, elapsedDays, s);

  let stability: number;
  if (elapsedDays === 0) {
    stability = nextShortTermStability(w, s, g);
  } else if (g === GRADE_AGAIN) {
    const afterFailure = nextForgetStability(w, d, s, r);
    const floorStability = s / Math.exp(w[17] * w[18]);
    stability = clamp(roundTo8(floorStability), MIN_STABILITY, afterFailure);
  } else {
    stability = nextRecallStability(w, d, s, r, g);
  }

  return { difficulty: nextDifficulty(w, d, g), stability };
};

/** Whole days to wait before asking again, for a question of this stability. */
export const nextIntervalDays = (
  w: MemoryParameters,
  stability: number,
  requestRetention: number = DEFAULT_REQUEST_RETENTION,
  maximumInterval: number = DEFAULT_MAXIMUM_INTERVAL,
): number =>
  Math.min(
    Math.max(1, Math.round(stability * intervalModifier(w, requestRetention))),
    maximumInterval,
  );
