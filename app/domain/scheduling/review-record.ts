/**
 * What the game remembers about one question, and how one answer changes it.
 *
 * This is the domain's own vocabulary, not a library's. The player answers by
 * tapping one of four options (TN-CARD-03/04) — there is no "how hard was that?"
 * prompt anywhere in the stories — so the only thing that crosses this boundary
 * is `correct: boolean`. Grades, ratings and card states stay inside
 * `memory-model.ts`, and a change of model cannot change what a caller says.
 *
 * Every function here is pure: `now` arrives as a parameter, never from a clock,
 * and every transition returns a new record rather than mutating one. The caller
 * (slice 1 task 1.5) is what holds the `Clock`.
 *
 * Timestamps are `EpochMillis`. `ReviewStateDocument` persists them as
 * `IsoInstant`; converting between the two is a persistence concern and lives
 * with the codec, not here — the domain does not need a calendar, only
 * arithmetic.
 */

import type { EpochMillis, QuestionId } from '@domain/ids';

import {
  DEFAULT_MEMORY_PARAMETERS,
  GRADE_AGAIN,
  GRADE_GOOD,
  GRADE_HARD,
  nextIntervalDays,
  nextMemoryState,
  recallProbability,
} from '@domain/scheduling/memory-model';
import type { Grade, MemoryParameters } from '@domain/scheduling/memory-model';

/**
 * How far through learning a question is.
 *
 * Named `phase` rather than `state` because "card state" is one of the words
 * TN-CARD-02 forbids on screen, and because a field the UI can read is a field
 * the UI can leak. The values map one-for-one onto
 * `ReviewStateDocument.state`, so persistence is a rename and nothing more.
 */
export type ReviewPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface ReviewRecord {
  readonly questionId: QuestionId;
  /** When this question should next be offered. */
  readonly dueAt: EpochMillis;
  /** Days until recall probability falls to 0.9. */
  readonly stability: number;
  /** 1–10; larger is harder for this player. */
  readonly difficulty: number;
  /** How many times this question has been answered, right or wrong. */
  readonly reps: number;
  /** How many times a settled question was later missed. */
  readonly lapses: number;
  readonly lastReviewedAt: EpochMillis | null;
  /**
   * When this question was first answered — what "introduced" means for
   * `dailyNewLimit`.
   *
   * Carried in `ReviewStateDocument` since slice 1 task 1.4 — it was missing at
   * first, and without it the only marker of a first sighting is `reps === 1`,
   * which stops being true the moment the question is answered a second time,
   * and the daily cap is then bypassed simply by drilling twice.
   */
  readonly firstReviewedAt: EpochMillis | null;
  readonly phase: ReviewPhase;
  /**
   * Which short-term step the question is on.
   *
   * Carried in `ReviewStateDocument` since slice 1 task 1.4. Without it a
   * question in `learning` or `relearning` cannot be resumed after a reload: the
   * next gap is read from this index, and a missing one silently restarts the
   * sequence. It is also what distinguishes "answered wrongly a
   * moment ago" from "answered rightly a moment ago", which is what TN-CARD-02
   * and TN-STUDY-02 order the drill by.
   */
  readonly learningSteps: number;
}

/** The result of one answer: the new record, and whether the promise holds. */
export interface AnswerOutcome {
  readonly record: ReviewRecord;
  /**
   * True when the card may keep TN-CARD-04's promise, "You will see this
   * question again soon." A wrong answer always makes this true — that is
   * asserted, not hoped for, so the copy can never outrun the scheduler
   * (OQ-CARD-5).
   */
  readonly returnsSoon: boolean;
}

/** Tuning the transition needs. Defaults are the shipped FSRS-6 ones. */
export interface MemoryTuning {
  readonly parameters: MemoryParameters;
  readonly requestRetention: number;
  readonly maximumInterval: number;
  /**
   * Minutes to wait after each answer while a question is still being learned.
   * Every entry must be under a day; the scheduler has no path that turns a
   * short-term step into a multi-day gap, because none of these do.
   */
  readonly learningStepMinutes: readonly number[];
  /** The same, for a settled question that was missed. */
  readonly relearningStepMinutes: readonly number[];
}

export const DEFAULT_MEMORY_TUNING: MemoryTuning = {
  parameters: DEFAULT_MEMORY_PARAMETERS,
  requestRetention: 0.9,
  maximumInterval: 36500,
  learningStepMinutes: [1, 10],
  relearningStepMinutes: [10],
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** "Soon" as TN-CARD-04 promises it: within a day. */
export const SOON_MS = DAY_MS;

/** UTC day number. Pure integer arithmetic — no `Date`, no time zone. */
const utcDay = (at: EpochMillis): number => Math.floor(at / DAY_MS);

/**
 * Whole UTC days between two instants, matching how the model counts elapsed
 * time. Two reviews 23 hours apart across midnight count as one day; two reviews
 * 23 hours apart inside one day count as none.
 */
export const wholeDaysBetween = (from: EpochMillis, to: EpochMillis): number =>
  utcDay(to) - utcDay(from);

/** Do these two instants fall on the same UTC day? */
export const onSameUtcDay = (a: EpochMillis, b: EpochMillis): boolean => utcDay(a) === utcDay(b);

const millis = (value: number): EpochMillis => value as EpochMillis;

/** A question the player has never answered. `reps` 0 is what "never" means. */
export const unseenRecord = (questionId: QuestionId, at: EpochMillis): ReviewRecord => ({
  questionId,
  dueAt: at,
  stability: 0,
  difficulty: 0,
  reps: 0,
  lapses: 0,
  lastReviewedAt: null,
  firstReviewedAt: null,
  phase: 'new',
  learningSteps: 0,
});

/** Has the player ever answered this question? */
export const hasBeenSeen = (record: ReviewRecord): boolean => record.reps > 0;

/**
 * Was the most recent answer wrong?
 *
 * Derived rather than stored, so no extra persisted field is needed. A wrong
 * answer always sends the question back to step 0 of a short-term sequence; a
 * right answer either advances the step or settles the question into `review`.
 * So `relearning`, or `learning` at step 0 after at least one answer, is exactly
 * "the last answer was wrong".
 */
export const wasLastAnswerWrong = (record: ReviewRecord): boolean =>
  record.phase === 'relearning' ||
  (record.phase === 'learning' && record.reps > 0 && record.learningSteps === 0);

/** Is this question ready to be offered again? */
export const isDue = (record: ReviewRecord, now: EpochMillis): boolean => now >= record.dueAt;

/**
 * Probability the player still knows this answer, right now.
 *
 * Fractional days rather than whole ones: this value orders a drill, and whole
 * days would make every question answered today rank identically. A question
 * never answered returns 1 — there is nothing yet to forget.
 */
export const recallProbabilityNow = (
  record: ReviewRecord,
  now: EpochMillis,
  tuning: MemoryTuning = DEFAULT_MEMORY_TUNING,
): number => {
  if (record.lastReviewedAt === null || record.stability <= 0) return 1;
  const elapsedDays = Math.max(0, (now - record.lastReviewedAt) / DAY_MS);
  return recallProbability(tuning.parameters, elapsedDays, record.stability);
};

interface ShortTermStep {
  readonly minutes: number;
  readonly nextStep: number;
}

/**
 * The next short-term gap, or `null` when the sequence is finished and the
 * question graduates to a multi-day interval.
 */
const shortTermStep = (
  tuning: MemoryTuning,
  phase: ReviewPhase,
  currentStep: number,
  grade: Grade,
): ShortTermStep | null => {
  const steps =
    phase === 'relearning' || phase === 'review'
      ? tuning.relearningStepMinutes
      : tuning.learningStepMinutes;
  const step = Math.max(0, currentStep);
  if (steps.length === 0 || step >= steps.length) return null;

  if (grade === GRADE_AGAIN) {
    // A miss restarts the sequence. From a settled question it restarts at the
    // step the question was on; from a new one, at the beginning.
    const minutes = phase === 'review' ? steps[step] : steps[0];
    return minutes === undefined ? null : { minutes, nextStep: 0 };
  }

  const next = steps[step + 1];
  return next === undefined ? null : { minutes: Math.round(next), nextStep: step + 1 };
};

interface Scheduled {
  readonly dueAt: EpochMillis;
  readonly phase: ReviewPhase;
  readonly learningSteps: number;
}

const scheduleShortTermOrGraduate = (
  tuning: MemoryTuning,
  now: EpochMillis,
  stability: number,
  stayingPhase: ReviewPhase,
  step: ShortTermStep | null,
): Scheduled => {
  if (step !== null) {
    return {
      dueAt: millis(now + Math.round(step.minutes) * MINUTE_MS),
      phase: stayingPhase,
      learningSteps: step.nextStep,
    };
  }
  const days = nextIntervalDays(
    tuning.parameters,
    stability,
    tuning.requestRetention,
    tuning.maximumInterval,
  );
  return { dueAt: millis(now + days * DAY_MS), phase: 'review', learningSteps: 0 };
};

/**
 * Fold one answer into one record.
 *
 * `previous` is `null` the first time a question is answered. The returned
 * record is new; nothing is mutated.
 */
export const recordAnswer = (
  previous: ReviewRecord | null,
  questionId: QuestionId,
  correct: boolean,
  now: EpochMillis,
  tuning: MemoryTuning = DEFAULT_MEMORY_TUNING,
): AnswerOutcome => {
  const before =
    previous === null || previous.phase === 'new' || !hasBeenSeen(previous)
      ? unseenRecord(questionId, now)
      : previous;
  const grade: Grade = correct ? GRADE_GOOD : GRADE_AGAIN;
  const w = tuning.parameters;

  const elapsedDays =
    before.phase === 'new' || before.lastReviewedAt === null
      ? 0
      : wholeDaysBetween(before.lastReviewedAt, now);

  const common = {
    questionId,
    reps: before.reps + 1,
    lastReviewedAt: now,
    firstReviewedAt: before.firstReviewedAt ?? now,
  };

  if (before.phase === 'review') {
    const recall = recallProbability(w, elapsedDays, before.stability);
    const memory = nextMemoryState(
      w,
      { difficulty: before.difficulty, stability: before.stability },
      elapsedDays,
      grade,
      recall,
    );

    if (grade === GRADE_AGAIN) {
      const scheduled = scheduleShortTermOrGraduate(
        tuning,
        now,
        memory.stability,
        'relearning',
        shortTermStep(tuning, 'review', before.learningSteps, GRADE_AGAIN),
      );
      return outcome(
        {
          ...common,
          ...scheduled,
          stability: memory.stability,
          difficulty: memory.difficulty,
          lapses: before.lapses + 1,
        },
        now,
      );
    }

    // A settled question answered rightly graduates to a whole-day interval. The
    // Hard branch is computed because the Good interval is defined as at least
    // one day past it — dropping it shortens every interval by a day.
    const harder = nextMemoryState(
      w,
      { difficulty: before.difficulty, stability: before.stability },
      elapsedDays,
      GRADE_HARD,
      recall,
    );
    const hardDays = Math.min(
      nextIntervalDays(w, harder.stability, tuning.requestRetention, tuning.maximumInterval),
      nextIntervalDays(w, memory.stability, tuning.requestRetention, tuning.maximumInterval),
    );
    const goodDays = Math.max(
      nextIntervalDays(w, memory.stability, tuning.requestRetention, tuning.maximumInterval),
      hardDays + 1,
    );
    return outcome(
      {
        ...common,
        dueAt: millis(now + goodDays * DAY_MS),
        phase: 'review',
        learningSteps: 0,
        stability: memory.stability,
        difficulty: memory.difficulty,
        lapses: before.lapses,
      },
      now,
    );
  }

  const memory = nextMemoryState(
    w,
    before.phase === 'new'
      ? null
      : { difficulty: before.difficulty, stability: before.stability },
    elapsedDays,
    grade,
  );
  const stayingPhase: ReviewPhase = before.phase === 'new' ? 'learning' : before.phase;
  const scheduled = scheduleShortTermOrGraduate(
    tuning,
    now,
    memory.stability,
    stayingPhase,
    shortTermStep(tuning, before.phase, before.learningSteps, grade),
  );

  return outcome(
    {
      ...common,
      ...scheduled,
      stability: memory.stability,
      difficulty: memory.difficulty,
      lapses: before.lapses,
    },
    now,
  );
};

const outcome = (record: ReviewRecord, now: EpochMillis): AnswerOutcome => ({
  record,
  returnsSoon: record.dueAt - now <= SOON_MS,
});
