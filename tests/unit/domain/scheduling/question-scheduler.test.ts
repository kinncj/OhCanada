/**
 * The QuestionScheduler, judged against the plan's acceptance and the PO's
 * stories rather than against its own implementation.
 *
 * The tuning is read from `content/game.config.json`, not hardcoded, so these
 * are assertions about the numbers that actually ship. If someone changes
 * `scheduler.exclusionWindow` or `study.drillSize`, this suite still describes
 * the game rather than a fixture of it.
 */

import { describe, expect, it } from 'vitest';

import gameConfig from '@content/game.config.json';

import { isErr, isOk } from '@common/result';
import type { EpochMillis, QuestionId } from '@domain/ids';
import { recordAnswer } from '@domain/scheduling/review-record';
import type { ReviewRecord } from '@domain/scheduling/review-record';
import { rememberAsked, selectQuestions } from '@domain/scheduling/question-scheduler';
import type {
  SchedulerSettings,
  ScheduledQuestion,
  SelectionRequest,
} from '@domain/scheduling/question-scheduler';

import { seededRandom } from './seeded-random';

const qid = (value: string): QuestionId => value as unknown as QuestionId;
const at = (value: number): EpochMillis => value as unknown as EpochMillis;

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** 2026-01-05T00:00:00Z. Fixed, because nothing here may read a wall clock. */
const ORIGIN = 1_767_571_200_000;

/** Exactly what ships in `content/game.config.json#/scheduler`. */
const SHIPPED: SchedulerSettings = gameConfig.scheduler;
const DRILL_SIZE: number = gameConfig.study.drillSize;

const poolOf = (size: number): readonly QuestionId[] =>
  Array.from({ length: size }, (_unused, index) => qid(`q-${String(index).padStart(2, '0')}`));

interface Overrides {
  readonly reviews?: readonly ReviewRecord[];
  readonly recentlyAsked?: readonly QuestionId[];
  readonly settings?: SchedulerSettings;
  readonly now?: EpochMillis;
  readonly seed?: number;
}

const request = (
  pool: readonly QuestionId[],
  count: number,
  overrides: Overrides = {},
): SelectionRequest => ({
  pool,
  reviews: overrides.reviews ?? [],
  recentlyAsked: overrides.recentlyAsked ?? [],
  count,
  now: overrides.now ?? at(ORIGIN),
  settings: overrides.settings ?? SHIPPED,
  random: seededRandom(overrides.seed ?? 1),
});

/** `selectQuestions`, unwrapped. Fails loudly rather than returning undefined. */
const select = (
  pool: readonly QuestionId[],
  count: number,
  overrides: Overrides = {},
): readonly ScheduledQuestion[] => {
  const result = selectQuestions(request(pool, count, overrides));
  if (!isOk(result)) throw new Error(`selection failed: ${result.error.code}`);
  return result.value;
};

const ids = (questions: readonly ScheduledQuestion[]): readonly QuestionId[] =>
  questions.map((question) => question.questionId);

/** Answer every question in `pool`, right or wrong as `correct` says. */
const answerAll = (
  pool: readonly QuestionId[],
  now: EpochMillis,
  correct: (id: QuestionId, index: number) => boolean,
): readonly ReviewRecord[] =>
  pool.map((id, index) => recordAnswer(null, id, correct(id, index), now).record);

/* -------------------------------------------------------------------------- */
/* the plan's acceptance                                                      */
/* -------------------------------------------------------------------------- */

describe('50 draws from a 30-question pool never repeat inside the exclusion window', () => {
  it('holds for the shipped tuning, from a seeded stream', () => {
    const pool = poolOf(30);
    const window = SHIPPED.exclusionWindow;
    expect(window).toBeGreaterThan(0);
    expect(pool.length).toBeGreaterThan(window);

    // Every question has been met before, which is what "a 30-question pool"
    // means for a scheduler: all thirty are drawable. The cold-start case, where
    // `dailyNewLimit` holds most of the bank back, is the next test.
    let reviews = answerAll(pool, at(ORIGIN - 40 * DAY), (_id, index) => index % 3 !== 0);
    let recentlyAsked: readonly QuestionId[] = [];
    const drawn: QuestionId[] = [];
    const random = seededRandom(0xc0ffee);

    // Fifty draws in one sitting, so `now` does not move: the player is at the
    // card, not away from it. That matters, because a question answered wrongly
    // is due again a minute later by design (TN-CARD-04, TN-STUDY-05) — the
    // window is what stops it coming back *now*, not what stops it coming back.
    const now = at(ORIGIN);

    for (let draw = 0; draw < 50; draw += 1) {
      const result = selectQuestions({
        pool,
        reviews,
        recentlyAsked,
        count: 1,
        now,
        settings: SHIPPED,
        random,
      });
      expect(isOk(result), `draw ${draw}`).toBe(true);
      if (!isOk(result)) return;
      expect(result.value, `draw ${draw} came back empty`).toHaveLength(1);

      const id = (result.value[0] as ScheduledQuestion).questionId;
      expect(
        recentlyAsked.slice(0, window),
        `draw ${draw} repeated ${id} inside the window`,
      ).not.toContain(id);

      drawn.push(id);
      const previous = reviews.find((record) => record.questionId === id) ?? null;
      reviews = [
        ...reviews.filter((record) => record.questionId !== id),
        recordAnswer(previous, id, random.next() > 0.35, now).record,
      ];
      recentlyAsked = rememberAsked(recentlyAsked, [id], SHIPPED);
    }

    expect(drawn).toHaveLength(50);
    // Stated over the whole transcript rather than step by step, so the property
    // holds of the sequence and not only of the loop that produced it.
    for (let index = 0; index < drawn.length; index += 1) {
      const preceding = drawn.slice(Math.max(0, index - window), index);
      expect(preceding, `${String(drawn[index])} repeated at draw ${index}`).not.toContain(
        drawn[index],
      );
    }
    // And the draw really did move around: a scheduler that cycled the same
    // twenty-one questions forever would also pass the line above.
    expect(new Set(drawn).size).toBe(pool.length);
  });

  it('never hands back an empty draw from a cold start, even against the daily new limit', () => {
    const pool = poolOf(30);
    let reviews: readonly ReviewRecord[] = [];
    let recentlyAsked: readonly QuestionId[] = [];
    const drawn: QuestionId[] = [];
    const random = seededRandom(99);
    // One sitting again, for the same reason as the test above.
    const now = at(ORIGIN);

    for (let draw = 0; draw < 50; draw += 1) {
      const result = selectQuestions({
        pool,
        reviews,
        recentlyAsked,
        count: 1,
        now,
        settings: SHIPPED,
        random,
      });
      expect(isOk(result), `draw ${draw}`).toBe(true);
      if (!isOk(result)) return;
      expect(result.value, `draw ${draw} came back empty`).toHaveLength(1);

      const id = (result.value[0] as ScheduledQuestion).questionId;
      // Every answer here is right, so nothing the player has just seen is due
      // again: the window holds as deep as there are questions to honour it with.
      const honourable = Math.min(SHIPPED.exclusionWindow, new Set(drawn).size - 1);
      if (honourable > 0) {
        expect(drawn.slice(-honourable), `draw ${draw}`).not.toContain(id);
      }

      drawn.push(id);
      const previous = reviews.find((record) => record.questionId === id) ?? null;
      reviews = [
        ...reviews.filter((record) => record.questionId !== id),
        recordAnswer(previous, id, true, now).record,
      ];
      recentlyAsked = rememberAsked(recentlyAsked, [id], SHIPPED);
    }

    // `dailyNewLimit` did its job: the player met that many questions today and
    // then went round them again, rather than meeting all thirty in one sitting.
    expect(new Set(drawn).size).toBe(SHIPPED.dailyNewLimit);
  });

  it('replays exactly from its seed, and differs when the seed does', () => {
    const pool = poolOf(30);
    const reviews = answerAll(pool, at(ORIGIN - DAY), () => true);
    const options = { reviews, now: at(ORIGIN) };

    expect(ids(select(pool, 5, { ...options, seed: 4 }))).toStrictEqual(
      ids(select(pool, 5, { ...options, seed: 4 })),
    );
    expect(ids(select(pool, 5, { ...options, seed: 4 }))).not.toStrictEqual(
      ids(select(pool, 5, { ...options, seed: 5 })),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* TN-CARD-02 — what "scheduled" means to the player                          */
/* -------------------------------------------------------------------------- */

describe('TN-CARD-02 — what "scheduled" means to the player', () => {
  it('offers a question answered wrongly before one answered rightly', () => {
    const [a, b] = [qid('a'), qid('b')];
    const reviews = [
      recordAnswer(null, a, false, at(ORIGIN)).record,
      recordAnswer(null, b, true, at(ORIGIN)).record,
    ];
    const chosen = select([a, b], 2, { reviews, now: at(ORIGIN + 20 * MINUTE) });
    expect(ids(chosen)).toStrictEqual([a, b]);
  });

  it('puts the missed question first however many right answers surround it', () => {
    const pool = poolOf(10);
    const missed = pool[3] as QuestionId;
    const reviews = answerAll(pool, at(ORIGIN), (id) => id !== missed);
    const chosen = select(pool, DRILL_SIZE, { reviews, now: at(ORIGIN + 30 * MINUTE) });
    expect(chosen[0]?.questionId).toBe(missed);
  });

  it('keeps the promise: a question missed in a quest is in the next Study drill', () => {
    // TN-QUEST-04 asks three; the player gets the middle one wrong.
    const pool = poolOf(12);
    const asked = pool.slice(0, 3);
    const missed = asked[1] as QuestionId;
    let reviews: readonly ReviewRecord[] = [];
    for (const id of asked) {
      const outcome = recordAnswer(null, id, id !== missed, at(ORIGIN));
      if (id === missed) expect(outcome.returnsSoon).toBe(true);
      reviews = [...reviews, outcome.record];
    }

    const drill = select(pool, DRILL_SIZE, {
      reviews,
      recentlyAsked: rememberAsked([], asked, SHIPPED),
      now: at(ORIGIN + 25 * MINUTE),
    });
    expect(ids(drill)).toContain(missed);
    expect(drill[0]?.questionId).toBe(missed);
  });

  it('does not ask a question answered rightly again in the same session', () => {
    const pool = poolOf(30);
    const seeded = answerAll(pool, at(ORIGIN - DAY), () => true);
    const now = at(ORIGIN);

    const first = ids(select(pool, DRILL_SIZE, { reviews: seeded, now }));
    expect(new Set(first).size).toBe(first.length);

    // The player answers all five rightly, and taps "Study again" straight away.
    const answered = first.map(
      (id) =>
        recordAnswer(
          seeded.find((record) => record.questionId === id) ?? null,
          id,
          true,
          now,
        ).record,
    );
    const reviews = [
      ...seeded.filter((record) => !first.includes(record.questionId)),
      ...answered,
    ];

    const second = ids(
      select(pool, DRILL_SIZE, {
        reviews,
        recentlyAsked: rememberAsked([], first, SHIPPED),
        now,
      }),
    );
    expect(second.filter((id) => first.includes(id))).toStrictEqual([]);
  });

  it('offers a question answered wrongly again once its moment arrives', () => {
    // TN-STUDY-05: "Given I answered question A wrongly before leaving / When I
    // start a new drill / Then question A is offered." The window does not
    // outrank the promise, and neither does a bank full of older questions.
    const pool = poolOf(30);
    const seeded = answerAll(pool, at(ORIGIN - DAY), () => true);
    const missed = pool[11] as QuestionId;
    const reviews = [
      ...seeded.filter((record) => record.questionId !== missed),
      recordAnswer(
        seeded.find((record) => record.questionId === missed) ?? null,
        missed,
        false,
        at(ORIGIN),
      ).record,
    ];
    const nextDrill = select(pool, DRILL_SIZE, {
      reviews,
      recentlyAsked: rememberAsked([], [missed], SHIPPED),
      now: at(ORIGIN + 15 * MINUTE),
    });
    expect(ids(nextDrill)).toContain(missed);
    // And first, ahead of twenty-nine questions that have been due for a day.
    expect(nextDrill[0]?.questionId).toBe(missed);
  });

  it('exposes nothing a card could turn into scheduling jargon', () => {
    const pool = poolOf(6);
    const reviews = answerAll(pool.slice(0, 3), at(ORIGIN - DAY), () => true);
    const chosen = select(pool, 6, { reviews, now: at(ORIGIN) });

    for (const question of chosen) {
      expect(Object.keys(question).sort()).toStrictEqual(['familiarity', 'questionId']);
      expect(['new', 'seen']).toContain(question.familiarity);
    }

    // TN-CARD-02's fourth scenario, made a property of the domain rather than of
    // the card: if the value never carries the word, the card cannot print it.
    const rendered = JSON.stringify(chosen).toLowerCase();
    for (const banned of [
      'spaced repetition',
      'fsrs',
      'algorithm',
      'interval',
      'card state',
      'due',
      'stability',
      'difficulty',
      'lapse',
      'retention',
      'schedul',
    ]) {
      expect(rendered, `"${banned}" reached the card`).not.toContain(banned);
    }
  });

  it('tags a question the player has met as seen, and the rest as new', () => {
    const pool = poolOf(4);
    const known = pool[2] as QuestionId;
    const reviews = [recordAnswer(null, known, true, at(ORIGIN - DAY)).record];
    const chosen = select(pool, 4, { reviews, now: at(ORIGIN) });
    const tags = new Map(chosen.map((q) => [q.questionId, q.familiarity]));
    expect(tags.get(known)).toBe('seen');
    for (const id of pool) {
      if (id !== known) expect(tags.get(id)).toBe('new');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* TN-STUDY-02 — what the drill contains                                      */
/* -------------------------------------------------------------------------- */

describe('TN-STUDY-02 — what the drill contains', () => {
  it('asks the number of questions the configuration says', () => {
    const pool = poolOf(30);
    const reviews = answerAll(pool, at(ORIGIN - DAY), () => true);
    expect(select(pool, DRILL_SIZE, { reviews, now: at(ORIGIN) })).toHaveLength(DRILL_SIZE);
    expect(DRILL_SIZE).toBe(5);
  });

  it('runs a short drill rather than padding it with a repeat', () => {
    const pool = poolOf(3);
    const reviews = answerAll(pool, at(ORIGIN - DAY), () => true);
    const chosen = select(pool, DRILL_SIZE, { reviews, now: at(ORIGIN) });
    expect(chosen).toHaveLength(3);
    expect(new Set(ids(chosen)).size).toBe(3);
  });

  it('keeps working when the whole bank is smaller than the window', () => {
    // Slice 1 ships three questions against a window of twenty. Every drill must
    // still be full: the window relaxes, least recently asked first.
    const pool = poolOf(3);
    const reviews = answerAll(pool, at(ORIGIN - DAY), () => true);
    let recentlyAsked: readonly QuestionId[] = [];
    for (let round = 0; round < 5; round += 1) {
      const chosen = select(pool, 3, {
        reviews,
        recentlyAsked,
        now: at(ORIGIN + round * MINUTE),
      });
      expect(chosen, `round ${round}`).toHaveLength(3);
      expect(new Set(ids(chosen)).size, `round ${round}`).toBe(3);
      recentlyAsked = rememberAsked(recentlyAsked, ids(chosen), SHIPPED);
    }
  });

  it('introduces new questions, but no more than the daily limit', () => {
    const pool = poolOf(30);
    const settings: SchedulerSettings = { ...SHIPPED, dailyNewLimit: 4 };
    const chosen = select(pool, 10, { settings, now: at(ORIGIN) });
    expect(chosen).toHaveLength(4);
    expect(chosen.every((question) => question.familiarity === 'new')).toBe(true);
  });

  it('counts what was introduced today against the limit', () => {
    const pool = poolOf(30);
    const settings: SchedulerSettings = { ...SHIPPED, dailyNewLimit: 4 };
    // Three met earlier today; only one more may be introduced.
    const met = answerAll(pool.slice(0, 3), at(ORIGIN + 60 * MINUTE), () => true);
    const chosen = select(pool, 10, {
      reviews: met,
      // Not due yet, and already asked, so the three cannot fill the drill.
      recentlyAsked: rememberAsked([], ids(met.map(toQuestion)), SHIPPED),
      settings,
      now: at(ORIGIN + 61 * MINUTE),
    });
    expect(chosen.filter((question) => question.familiarity === 'new')).toHaveLength(1);
  });

  it('does not count what was introduced yesterday', () => {
    const pool = poolOf(30);
    const settings: SchedulerSettings = { ...SHIPPED, dailyNewLimit: 4 };
    const met = answerAll(pool.slice(0, 3), at(ORIGIN - DAY), () => true);
    const chosen = select(pool, 10, {
      reviews: met,
      recentlyAsked: rememberAsked([], ids(met.map(toQuestion)), SHIPPED),
      settings,
      now: at(ORIGIN),
    });
    expect(chosen.filter((question) => question.familiarity === 'new')).toHaveLength(4);
  });

  it('has something to ask when nothing has come due yet, closest to forgotten first', () => {
    const pool = poolOf(8);
    // All answered rightly and settled days out, so nothing is due.
    let reviews: readonly ReviewRecord[] = [];
    pool.forEach((id, index) => {
      const met = at(ORIGIN - (index + 2) * HOUR);
      const first = recordAnswer(null, id, true, met).record;
      reviews = [
        ...reviews,
        recordAnswer(first, id, true, at(met + 11 * MINUTE)).record,
      ];
    });
    const now = at(ORIGIN);
    expect(reviews.every((record) => record.dueAt > now)).toBe(true);

    const chosen = select(pool, 3, { reviews, now });
    expect(chosen).toHaveLength(3);
    expect(chosen.every((question) => question.familiarity === 'seen')).toBe(true);
    // The oldest sightings are the least well remembered, so they come first.
    expect(ids(chosen)).toStrictEqual([pool[7], pool[6], pool[5]]);
  });

  it('offers a previously missed question ahead of one that was never missed', () => {
    const missed = qid('missed');
    const clean = qid('clean');
    // Same phase, same gap, same everything — the only difference is the last
    // answer, and TN-STUDY-02 says that difference decides the order outright.
    const missedRecord: ReviewRecord = {
      questionId: missed,
      dueAt: at(ORIGIN),
      stability: 2,
      difficulty: 5,
      reps: 4,
      lapses: 1,
      lastReviewedAt: at(ORIGIN - 10 * MINUTE),
      firstReviewedAt: at(ORIGIN - 30 * DAY),
      phase: 'relearning',
      learningSteps: 0,
    };
    const cleanRecord: ReviewRecord = { ...missedRecord, questionId: clean, phase: 'review' };
    const options = {
      reviews: [missedRecord, cleanRecord],
      now: at(ORIGIN + 10 * MINUTE),
    };

    for (const seed of [1, 2, 3, 4, 5]) {
      expect(ids(select([missed, clean], 2, { ...options, seed }))).toStrictEqual([missed, clean]);
      expect(ids(select([clean, missed], 2, { ...options, seed }))).toStrictEqual([missed, clean]);
    }
  });

  it('still prefers it ahead of a question that has been overdue far longer', () => {
    const missed = qid('missed');
    const ancient = qid('ancient');
    const missedRecord: ReviewRecord = {
      questionId: missed,
      dueAt: at(ORIGIN),
      stability: 2,
      difficulty: 5,
      reps: 4,
      lapses: 1,
      lastReviewedAt: at(ORIGIN - 10 * MINUTE),
      firstReviewedAt: at(ORIGIN - 30 * DAY),
      phase: 'relearning',
      learningSteps: 0,
    };
    const ancientRecord: ReviewRecord = {
      ...missedRecord,
      questionId: ancient,
      phase: 'review',
      lapses: 0,
      dueAt: at(ORIGIN - 60 * DAY),
      lastReviewedAt: at(ORIGIN - 61 * DAY),
    };
    const chosen = select([ancient, missed], 2, {
      reviews: [ancientRecord, missedRecord],
      now: at(ORIGIN + 10 * MINUTE),
    });
    expect(ids(chosen)).toStrictEqual([missed, ancient]);
  });

  it('measures lateness against the gap the question was given, not in raw time', () => {
    // Both were answered rightly, so neither gets the missed tier; the only
    // thing separating them is how far past their own moment they are.
    // `learning` was given ten minutes and left an hour: six times over.
    // `settled` was given thirty days and left thirty-one: a thirtieth over,
    // but a far larger number of milliseconds. The one still being learned
    // should be finished first.
    const learning = qid('learning');
    const settled = qid('settled');
    const learningRecord: ReviewRecord = {
      questionId: learning,
      dueAt: at(ORIGIN - 50 * MINUTE),
      lastReviewedAt: at(ORIGIN - 60 * MINUTE),
      firstReviewedAt: at(ORIGIN - 60 * MINUTE),
      stability: 0.4,
      difficulty: 5,
      reps: 2,
      lapses: 0,
      phase: 'learning',
      learningSteps: 1,
    };
    const settledRecord: ReviewRecord = {
      questionId: settled,
      dueAt: at(ORIGIN - DAY),
      lastReviewedAt: at(ORIGIN - 31 * DAY),
      firstReviewedAt: at(ORIGIN - 90 * DAY),
      stability: 30,
      difficulty: 5,
      reps: 6,
      lapses: 0,
      phase: 'review',
      learningSteps: 0,
    };
    const options = { reviews: [learningRecord, settledRecord], now: at(ORIGIN) };
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(ids(select([settled, learning], 1, { ...options, seed }))).toStrictEqual([learning]);
    }
  });

  it('uses wrongWeight to pull a missed question forward before it is even due', () => {
    const missed = qid('missed');
    const clean = qid('clean');
    // Neither is due yet, and both are equally well remembered. `wrongWeight` is
    // the only thing that can separate them.
    const base: ReviewRecord = {
      questionId: missed,
      dueAt: at(ORIGIN + DAY),
      stability: 4,
      difficulty: 5,
      reps: 4,
      lapses: 1,
      lastReviewedAt: at(ORIGIN - 2 * DAY),
      firstReviewedAt: at(ORIGIN - 30 * DAY),
      phase: 'relearning',
      learningSteps: 0,
    };
    const cleanRecord: ReviewRecord = { ...base, questionId: clean, phase: 'review' };
    const options = { reviews: [base, cleanRecord], now: at(ORIGIN) };

    for (const seed of [1, 2, 3, 4, 5]) {
      expect(ids(select([clean, missed], 1, { ...options, seed }))).toStrictEqual([missed]);
    }

    // Turn the weight off and the two are indistinguishable, so the seeded draw
    // decides — which is what proves the weight was doing the work above.
    const evenSettings: SchedulerSettings = { ...SHIPPED, wrongWeight: 1 };
    const orders = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      ids(select([clean, missed], 1, { ...options, settings: evenSettings, seed })).join(),
    );
    expect(new Set(orders).size).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* failure paths                                                              */
/* -------------------------------------------------------------------------- */

describe('the scheduler returns its failures rather than throwing them', () => {
  const cases: readonly (readonly [string, SelectionRequest, string])[] = [
    ['an empty pool', request([], 3), 'scheduler.pool.empty'],
    [
      'a pool that names one question twice',
      request([qid('a'), qid('b'), qid('a')], 2),
      'scheduler.pool.duplicate',
    ],
    ['a count of zero', request(poolOf(3), 0), 'scheduler.count.invalid'],
    ['a fractional count', request(poolOf(3), 2.5), 'scheduler.count.invalid'],
    ['a negative count', request(poolOf(3), -1), 'scheduler.count.invalid'],
    [
      'a negative exclusion window',
      request(poolOf(3), 1, { settings: { ...SHIPPED, exclusionWindow: -1 } }),
      'scheduler.settings.invalid',
    ],
    [
      'a wrong weight below one',
      request(poolOf(3), 1, { settings: { ...SHIPPED, wrongWeight: 0.5 } }),
      'scheduler.settings.invalid',
    ],
    [
      'a negative daily new limit',
      request(poolOf(3), 1, { settings: { ...SHIPPED, dailyNewLimit: -3 } }),
      'scheduler.settings.invalid',
    ],
    [
      'a fractional exclusion window',
      request(poolOf(3), 1, { settings: { ...SHIPPED, exclusionWindow: 1.5 } }),
      'scheduler.settings.invalid',
    ],
    [
      'a non-finite wrong weight',
      request(poolOf(3), 1, {
        settings: { ...SHIPPED, wrongWeight: Number.POSITIVE_INFINITY },
      }),
      'scheduler.settings.invalid',
    ],
    [
      'a fractional daily new limit',
      request(poolOf(3), 1, { settings: { ...SHIPPED, dailyNewLimit: 0.5 } }),
      'scheduler.settings.invalid',
    ],
  ];

  it.each(cases)('rejects %s', (_name, input, code) => {
    const result = selectQuestions(input);
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe(code);
    expect(result.error.kind).toBe('invalid');
  });

  it('ignores review history for questions outside the pool', () => {
    const pool = poolOf(3);
    const stranger = recordAnswer(null, qid('not-in-this-subject'), false, at(ORIGIN)).record;
    const chosen = select(pool, 3, { reviews: [stranger], now: at(ORIGIN + MINUTE) });
    expect(ids(chosen)).not.toContain(qid('not-in-this-subject'));
    expect(chosen.every((question) => question.familiarity === 'new')).toBe(true);
  });

  it('treats a stored record with no answers as a question never met', () => {
    const pool = poolOf(2);
    const stored: ReviewRecord = {
      questionId: pool[0] as QuestionId,
      dueAt: at(ORIGIN),
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      lastReviewedAt: null,
      firstReviewedAt: null,
      phase: 'new',
      learningSteps: 0,
    };
    const chosen = select(pool, 2, { reviews: [stored], now: at(ORIGIN) });
    expect(chosen.every((question) => question.familiarity === 'new')).toBe(true);
  });

  it('survives a record that claims answers but no time of answering', () => {
    // Not something `recordAnswer` can produce; something a hand-edited or
    // half-migrated save can. It must rank, not divide by nothing.
    const pool = poolOf(2);
    const damaged: ReviewRecord = {
      questionId: pool[0] as QuestionId,
      dueAt: at(ORIGIN - HOUR),
      stability: 3,
      difficulty: 5,
      reps: 4,
      lapses: 0,
      lastReviewedAt: null,
      firstReviewedAt: null,
      phase: 'review',
      learningSteps: 0,
    };
    const chosen = select(pool, 2, { reviews: [damaged], now: at(ORIGIN) });
    expect(ids(chosen)).toHaveLength(2);
    expect(chosen[0]?.questionId).toBe(pool[0]);
    expect(chosen[0]?.familiarity).toBe('seen');
  });

  it('reads a recently-asked list that names the same question twice', () => {
    // `rememberAsked` never writes one, but the list is the caller's and a
    // duplicate must count from its most recent position, not its oldest.
    const pool = poolOf(4);
    const settings: SchedulerSettings = { ...SHIPPED, exclusionWindow: 2 };
    const first = pool[0] as QuestionId;
    const chosen = select(pool, 4, {
      recentlyAsked: [pool[1] as QuestionId, pool[2] as QuestionId, first, first],
      settings,
      now: at(ORIGIN),
    });
    expect(ids(chosen)).toHaveLength(4);
  });

  it('asks for more than the pool holds without inventing a question', () => {
    const pool = poolOf(2);
    expect(select(pool, 20, { now: at(ORIGIN) })).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* the recently-asked list                                                    */
/* -------------------------------------------------------------------------- */

describe('rememberAsked', () => {
  it('puts the most recently asked question at the front', () => {
    const asked = [qid('a'), qid('b'), qid('c')];
    expect(rememberAsked([], asked, SHIPPED)).toStrictEqual([qid('c'), qid('b'), qid('a')]);
  });

  it('keeps older history behind the new questions', () => {
    const history = rememberAsked([qid('x'), qid('y')], [qid('a')], SHIPPED);
    expect(history).toStrictEqual([qid('a'), qid('x'), qid('y')]);
  });

  it('records a repeat once, at its most recent position', () => {
    const history = rememberAsked([qid('a'), qid('b')], [qid('b')], SHIPPED);
    expect(history).toStrictEqual([qid('b'), qid('a')]);
  });

  it('never grows past the window', () => {
    const settings: SchedulerSettings = { ...SHIPPED, exclusionWindow: 3 };
    const history = rememberAsked([], [...poolOf(10)], settings);
    expect(history).toStrictEqual([qid('q-09'), qid('q-08'), qid('q-07')]);
  });

  it('keeps nothing when the window is zero', () => {
    const settings: SchedulerSettings = { ...SHIPPED, exclusionWindow: 0 };
    expect(rememberAsked([qid('a')], [qid('b')], settings)).toStrictEqual([]);
  });
});

/** A review record, seen as the question it belongs to. */
function toQuestion(record: ReviewRecord): ScheduledQuestion {
  return { questionId: record.questionId, familiarity: 'seen' };
}
