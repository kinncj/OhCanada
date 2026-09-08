/**
 * One answer, folded into one record — pinned against `ts-fsrs` 5.4.2.
 *
 * `memory-model.test.ts` pins the arithmetic; this file pins the state machine
 * around it: which phase a question lands in, which short-term step, when it is
 * next offered, and when `lapses` moves. Those are the parts a hand-written
 * scheduler gets subtly wrong, and the parts that decide whether TN-CARD-04's
 * "You will see this question again soon." is true.
 *
 * The oracle is `fsrs()` on stock parameters with fuzz off. TrueNorth's card has
 * one tap and four options, so only Again and Good can ever occur (TN-CARD-03,
 * TN-CARD-04); those are the two ratings compared here, over randomised
 * sequences of answers and gaps.
 */

import { Rating, State, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';
import type { Card, Grade as FsrsGrade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import type { EpochMillis, QuestionId } from '@domain/ids';
import {
  DEFAULT_MEMORY_TUNING,
  SOON_MS,
  hasBeenSeen,
  isDue,
  onSameUtcDay,
  recordAnswer,
  recallProbabilityNow,
  unseenRecord,
  wasLastAnswerWrong,
  wholeDaysBetween,
} from '@domain/scheduling/review-record';
import type { ReviewRecord } from '@domain/scheduling/review-record';

import { seededRandom } from './seeded-random';

const qid = (value: string): QuestionId => value as unknown as QuestionId;
const at = (value: number): EpochMillis => value as unknown as EpochMillis;

const MINUTE = 60_000;
const DAY = 86_400_000;
/** 2026-01-05T00:00:00Z — a fixed origin, so nothing here reads a wall clock. */
const ORIGIN = 1_767_571_200_000;

const engine = fsrs(generatorParameters({ enable_fuzz: false }));

const PHASE_OF: Record<State, ReviewRecord['phase']> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

/**
 * The reference card, expressed in the domain's vocabulary.
 *
 * `firstReviewedAt` has no counterpart in `ts-fsrs` — it is TrueNorth's, so that
 * `dailyNewLimit` can mean what its name says — so it is passed in and checked
 * on its own below.
 */
const asRecord = (
  card: Card,
  questionId: QuestionId,
  firstReviewedAt: EpochMillis | null,
): ReviewRecord => ({
  questionId,
  dueAt: at(card.due.getTime()),
  stability: card.stability,
  difficulty: card.difficulty,
  reps: card.reps,
  lapses: card.lapses,
  lastReviewedAt: card.last_review === undefined ? null : at(card.last_review.getTime()),
  firstReviewedAt,
  phase: PHASE_OF[card.state],
  learningSteps: card.learning_steps,
});

describe('recordAnswer matches the ts-fsrs scheduler for the two grades a card can produce', () => {
  it('agrees over randomised sequences of answers and gaps', () => {
    const random = seededRandom(20260105);
    const gaps = [
      2 * MINUTE,
      45 * MINUTE,
      6 * 3_600_000,
      DAY,
      3 * DAY,
      11 * DAY,
      90 * DAY,
    ];

    for (let sequence = 0; sequence < 40; sequence += 1) {
      const questionId = qid(`q-${sequence}`);
      let card: Card = createEmptyCard(new Date(ORIGIN));
      let record: ReviewRecord | null = null;
      let now = ORIGIN;

      for (let step = 0; step < 12; step += 1) {
        const correct = random.next() > 0.4;
        const rating: FsrsGrade = correct ? Rating.Good : Rating.Again;

        card = engine.next(card, new Date(now), rating).card;
        const outcome = recordAnswer(record, questionId, correct, at(now), DEFAULT_MEMORY_TUNING);
        record = outcome.record;

        expect(
          record,
          `sequence ${sequence}, step ${step}, ${correct ? 'right' : 'wrong'}`,
        ).toStrictEqual(asRecord(card, questionId, at(ORIGIN)));

        now += gaps[Math.floor(random.next() * gaps.length)] ?? DAY;
      }
    }
  });

  it('agrees when the same question is answered twice without the day changing', () => {
    let card: Card = createEmptyCard(new Date(ORIGIN));
    let record: ReviewRecord | null = null;
    const questionId = qid('same-day');

    for (const [minutes, correct] of [
      [0, true],
      [11, true],
      [40, false],
      [55, true],
      [70, true],
      [400, false],
    ] as const) {
      const now = ORIGIN + minutes * MINUTE;
      card = engine.next(card, new Date(now), correct ? Rating.Good : Rating.Again).card;
      record = recordAnswer(record, questionId, correct, at(now)).record;
      expect(record, `after ${minutes} minutes`).toStrictEqual(asRecord(card, questionId, at(ORIGIN)));
    }
  });
});

describe('the promise the card makes to the player', () => {
  it('is always keepable after a wrong answer, whatever the question had become', () => {
    const questionId = qid('promise');
    const random = seededRandom(7);
    let record: ReviewRecord | null = null;
    let now = ORIGIN;

    for (let step = 0; step < 60; step += 1) {
      const correct = random.next() > 0.25;
      const outcome = recordAnswer(record, questionId, correct, at(now));
      record = outcome.record;
      if (!correct) {
        // TN-CARD-04 shows "You will see this question again soon." only here.
        expect(outcome.returnsSoon, `step ${step}`).toBe(true);
        expect(record.dueAt - now, `step ${step}`).toBeLessThanOrEqual(SOON_MS);
      }
      now += Math.floor(random.next() * 9) * DAY + MINUTE;
    }
  });

  it('stops promising once a question is well known', () => {
    const questionId = qid('well-known');
    let record: ReviewRecord | null = null;
    let now = ORIGIN;
    for (let step = 0; step < 8; step += 1) {
      const outcome = recordAnswer(record, questionId, true, at(now));
      record = outcome.record;
      now = record.dueAt;
    }
    const later = recordAnswer(record, questionId, true, at(now));
    expect(later.returnsSoon).toBe(false);
    expect(later.record.dueAt - now).toBeGreaterThan(SOON_MS);
  });
});

describe('what the scheduler reads off a record', () => {
  it('remembers when a question was first met, and never moves it again', () => {
    const questionId = qid('first-met');
    const first = recordAnswer(null, questionId, false, at(ORIGIN)).record;
    expect(first.firstReviewedAt).toBe(ORIGIN);

    let record = first;
    for (const offset of [11 * MINUTE, 3 * DAY, 40 * DAY]) {
      record = recordAnswer(record, questionId, true, at(ORIGIN + offset)).record;
      expect(record.firstReviewedAt, `after ${offset} ms`).toBe(ORIGIN);
      expect(record.lastReviewedAt).toBe(ORIGIN + offset);
    }
  });

  it('treats a question nobody has answered as unseen', () => {
    const record = unseenRecord(qid('fresh'), at(ORIGIN));
    expect(hasBeenSeen(record)).toBe(false);
    expect(wasLastAnswerWrong(record)).toBe(false);
    expect(recallProbabilityNow(record, at(ORIGIN + 30 * DAY))).toBe(1);
    expect(isDue(record, at(ORIGIN))).toBe(true);
  });

  it('reads "the last answer was wrong" off the phase and the step', () => {
    const questionId = qid('wrongness');

    const missedFirst = recordAnswer(null, questionId, false, at(ORIGIN)).record;
    expect(missedFirst.phase).toBe('learning');
    expect(missedFirst.lapses).toBe(0);
    expect(wasLastAnswerWrong(missedFirst)).toBe(true);

    const gotFirst = recordAnswer(null, questionId, true, at(ORIGIN)).record;
    expect(gotFirst.phase).toBe('learning');
    expect(wasLastAnswerWrong(gotFirst)).toBe(false);

    const thenMissed = recordAnswer(gotFirst, questionId, false, at(ORIGIN + 11 * MINUTE)).record;
    expect(wasLastAnswerWrong(thenMissed)).toBe(true);

    const settled = recordAnswer(gotFirst, questionId, true, at(ORIGIN + 11 * MINUTE)).record;
    expect(settled.phase).toBe('review');
    expect(wasLastAnswerWrong(settled)).toBe(false);

    const lapsed = recordAnswer(settled, questionId, false, at(settled.dueAt)).record;
    expect(lapsed.phase).toBe('relearning');
    expect(lapsed.lapses).toBe(1);
    expect(wasLastAnswerWrong(lapsed)).toBe(true);

    const recovered = recordAnswer(lapsed, questionId, true, at(lapsed.dueAt)).record;
    expect(recovered.phase).toBe('review');
    expect(wasLastAnswerWrong(recovered)).toBe(false);
  });

  it('falls due exactly at its moment, not before', () => {
    const record = recordAnswer(null, qid('due'), false, at(ORIGIN)).record;
    expect(isDue(record, at(record.dueAt - 1))).toBe(false);
    expect(isDue(record, at(record.dueAt))).toBe(true);
  });

  it('forgets faster the longer it is left', () => {
    const first = recordAnswer(null, qid('forgetting'), true, at(ORIGIN)).record;
    const settled = recordAnswer(first, qid('forgetting'), true, at(ORIGIN + 11 * MINUTE)).record;
    const soon = recallProbabilityNow(settled, at(ORIGIN + DAY));
    const late = recallProbabilityNow(settled, at(ORIGIN + 400 * DAY));
    expect(soon).toBeGreaterThan(late);
    expect(recallProbabilityNow(settled, at(ORIGIN))).toBe(1);
  });

  it('normalises a stored record that says "new" back to never seen', () => {
    const stored: ReviewRecord = {
      ...unseenRecord(qid('stored'), at(ORIGIN)),
      // A save written before the question was ever answered: phase new, no reps.
      phase: 'new',
    };
    expect(stored.firstReviewedAt).toBeNull();
    const fromStored = recordAnswer(stored, qid('stored'), true, at(ORIGIN)).record;
    const fromNothing = recordAnswer(null, qid('stored'), true, at(ORIGIN)).record;
    expect(fromStored).toStrictEqual(fromNothing);
  });
});

describe('tuning the short-term steps', () => {
  it('sends a question straight to a whole-day gap when there are no steps', () => {
    const tuning = {
      ...DEFAULT_MEMORY_TUNING,
      learningStepMinutes: [],
      relearningStepMinutes: [],
    };
    const questionId = qid('no-steps');
    const first = recordAnswer(null, questionId, true, at(ORIGIN), tuning).record;
    expect(first.phase).toBe('review');
    expect(first.learningSteps).toBe(0);
    expect(first.dueAt - ORIGIN).toBeGreaterThanOrEqual(DAY);

    // And a miss buys a whole day rather than ten minutes, so "You will see this
    // question again soon." would mean tomorrow. OQ-CARD-5 asked exactly this;
    // it is why the shipped tuning keeps short-term steps.
    const missed = recordAnswer(first, questionId, false, at(first.dueAt), tuning);
    expect(missed.record.phase).toBe('review');
    expect(missed.record.dueAt - missed.record.lastReviewedAt!).toBeGreaterThanOrEqual(DAY);
  });
});

describe('the calendar arithmetic the model counts elapsed time with', () => {
  it('counts whole UTC days, so midnight is what advances the count', () => {
    expect(wholeDaysBetween(at(ORIGIN), at(ORIGIN + 23 * 3_600_000))).toBe(0);
    expect(wholeDaysBetween(at(ORIGIN), at(ORIGIN + DAY))).toBe(1);
    expect(wholeDaysBetween(at(ORIGIN + 23 * 3_600_000), at(ORIGIN + 25 * 3_600_000))).toBe(1);
  });

  it('groups instants by UTC day', () => {
    expect(onSameUtcDay(at(ORIGIN), at(ORIGIN + 23 * 3_600_000))).toBe(true);
    expect(onSameUtcDay(at(ORIGIN), at(ORIGIN + DAY))).toBe(false);
  });
});
