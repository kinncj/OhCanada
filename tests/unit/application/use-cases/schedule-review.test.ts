/**
 * ScheduleReview: the content filter this use case adds, and the two ports it
 * passes straight through.
 *
 * The exclusion window itself is proved in
 * `tests/unit/domain/scheduling/question-scheduler.test.ts` against the pure
 * draw. It is proved *again* here, through the port, because the passthrough is
 * the thing this file adds: a wrapper that copied the seeded stream, or read a
 * clock of its own, would break the property without the domain test noticing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { scheduleReview } from '@application/use-cases/schedule-review';
import { answerQuestion } from '@application/use-cases/answer-question';
import type { SchedulerTuning } from '@application/ports/content-repository';
import type { QuestionId } from '@domain/ids';
import type { Progress } from '@domain/entities/progress';

import {
  DAY,
  ORIGIN,
  at,
  emptyProgress,
  makeBank,
  makeQuestion,
  questionId,
  seededRandomSource,
  subjectId,
  testClock,
  text,
} from '../../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

interface GameConfig {
  readonly scheduler: SchedulerTuning;
  readonly study: { readonly drillSize: number };
}

const config = JSON.parse(
  readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8'),
) as GameConfig;

const tuning = config.scheduler;

describe('what may be asked', () => {
  it('drops questions the verifier has not passed, and half-translated ones', () => {
    const bank = [
      makeQuestion('gov-01'),
      makeQuestion('gov-02', {
        verification: { ...makeQuestion('gov-02').verification, status: 'quarantined' },
      }),
      makeQuestion('gov-03', { prompt: text('Only English', '') }),
      makeQuestion('gov-04'),
    ];
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(1) },
      { questions: bank, count: 4, progress: emptyProgress(), tuning },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId).sort()).toEqual([
      'gov-01',
      'gov-04',
    ]);
    expect(drawn.value.shortfall).toBe(2);
  });

  it('says the questions are not ready when nothing may be asked (TN-QUEST-05)', () => {
    const quarantined = makeQuestion('gov-01', {
      verification: { ...makeQuestion('gov-01').verification, status: 'quarantined' },
    });
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(1) },
      { questions: [quarantined], count: 3, progress: emptyProgress(), tuning },
    );
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) {
      expect(drawn.error.kind).toBe('not-found');
      expect(drawn.error.code).toBe('scheduler.bank.empty');
    }
  });

  it('narrows to a quest step pool without choosing from it', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(7) },
      {
        questions: makeBank(10),
        count: 3,
        progress: emptyProgress(),
        tuning,
        pool: [questionId('q-02'), questionId('q-05'), questionId('q-09')],
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId).sort()).toEqual([
      'q-02',
      'q-05',
      'q-09',
    ]);
  });

  it('narrows to one subject when the bank holds more than one', () => {
    const bank = [
      makeQuestion('gov-01'),
      makeQuestion('his-01', { subject: subjectId('history') }),
    ];
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(3) },
      { questions: bank, count: 2, progress: emptyProgress(), tuning, subject: subjectId() },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) {
      expect(drawn.value.questions.map((question) => question.questionId)).toEqual(['gov-01']);
    }
  });

  it('asks a question the place just told first, then lets the scheduler choose the rest', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(5) },
      {
        questions: makeBank(10),
        count: 3,
        progress: emptyProgress(),
        tuning,
        prefer: [questionId('q-07')],
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    const ids = drawn.value.questions.map((question) => question.questionId);
    expect(ids[0]).toBe('q-07');
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(drawn.value.shortfall).toBe(0);
    expect(drawn.value.recentlyAsked).toContain('q-07');
  });

  it('never prefers its way out of the subject or the pool', () => {
    const bank = [
      makeQuestion('gov-01'),
      makeQuestion('gov-02'),
      makeQuestion('his-01', { subject: subjectId('history') }),
    ];
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(3) },
      {
        questions: bank,
        count: 1,
        progress: emptyProgress(),
        tuning,
        subject: subjectId(),
        pool: [questionId('gov-02'), questionId('his-01')],
        prefer: [questionId('his-01'), questionId('gov-01')],
      },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) {
      expect(drawn.value.questions.map((question) => question.questionId)).toEqual(['gov-02']);
    }
  });

  it('does not ask again what was asked in this sitting, however preferred', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(9) },
      {
        questions: makeBank(10),
        count: 2,
        progress: emptyProgress(),
        tuning,
        recentlyAsked: [questionId('q-07')],
        prefer: [questionId('q-07')],
      },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) {
      expect(drawn.value.questions.map((question) => question.questionId)).not.toContain('q-07');
      expect(drawn.value.questions).toHaveLength(2);
    }
  });

  it('fills a drill of one with the preferred question alone', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(2) },
      {
        questions: makeBank(4),
        count: 1,
        progress: emptyProgress(),
        tuning,
        prefer: [questionId('q-03'), questionId('q-04')],
      },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) {
      expect(drawn.value.questions).toEqual([{ questionId: 'q-03', familiarity: 'new' }]);
    }
  });

  it('tags a preferred question the player has answered as seen', () => {
    const bank = makeBank(4);
    const first = bank[2];
    if (first === undefined) throw new Error('the fixture bank is short');
    const answered = answerQuestion(
      { clock: testClock() },
      { question: first, chosenIndex: 0, progress: emptyProgress() },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    const drawn = scheduleReview(
      { clock: testClock(at(ORIGIN + DAY)), random: seededRandomSource(2) },
      { questions: bank, count: 1, progress: answered.value.progress, tuning, prefer: [first.id] },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) expect(drawn.value.questions[0]?.familiarity).toBe('seen');
  });

  it('still refuses a drill of zero when something is preferred', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(2) },
      {
        questions: makeBank(4),
        count: 0,
        progress: emptyProgress(),
        tuning,
        prefer: [questionId('q-01')],
      },
    );
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) expect(drawn.error.code).toBe('scheduler.count.invalid');
  });

  it('asks for a shorter drill rather than repeating to pad it (TN-STUDY-02)', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(11) },
      { questions: makeBank(2), count: config.study.drillSize, progress: emptyProgress(), tuning },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions).toHaveLength(2);
    expect(new Set(drawn.value.questions.map((question) => question.questionId)).size).toBe(2);
    expect(drawn.value.shortfall).toBe(config.study.drillSize - 2);
  });
});

describe('a level visit (ADR-0048)', () => {
  it('asks nothing but what the place told, when told to', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(4) },
      {
        questions: makeBank(10),
        count: 3,
        progress: emptyProgress(),
        tuning,
        prefer: [questionId('q-06')],
        preferOnly: true,
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId)).toEqual(['q-06']);
    expect(drawn.value.shortfall).toBe(2);
    expect(drawn.value.repeated).toBe(0);
  });

  it('is an empty draw, not a refusal, at a place that told nothing a question grades', () => {
    /* The Prairies' grain bins: no modern-canada question rests on their sentence. */
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(4) },
      { questions: makeBank(10), count: 1, progress: emptyProgress(), tuning, prefer: [], preferOnly: true },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions).toEqual([]);
    expect(drawn.value.shortfall).toBe(1);
  });

  it('still says the questions are not ready when the bank itself has none', () => {
    const quarantined = makeQuestion('gov-01', {
      verification: { ...makeQuestion('gov-01').verification, status: 'quarantined' },
    });
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(4) },
      {
        questions: [quarantined],
        count: 1,
        progress: emptyProgress(),
        tuning,
        prefer: [questionId('gov-01')],
        preferOnly: true,
      },
    );
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) expect(drawn.error.code).toBe('scheduler.bank.empty');
  });

  it('holds back what the place told once it was answered in this sitting', () => {
    /* Answered in a Study drill over the level, then the landmark is engaged. */
    const bank = makeBank(10);
    const told = bank[5];
    if (told === undefined) throw new Error('the fixture bank is short');
    const answered = answerQuestion(
      { clock: testClock() },
      { question: told, chosenIndex: told.correctIndex, progress: emptyProgress() },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(4) },
      {
        questions: bank,
        count: 1,
        progress: answered.value.progress,
        tuning,
        recentlyAsked: [told.id],
        prefer: [told.id],
        preferOnly: true,
      },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) expect(drawn.value.questions).toEqual([]);
  });

  it('asks again what the place told when it was put on screen and never answered (TN-CARD-05)', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(4) },
      {
        questions: makeBank(10),
        count: 1,
        progress: emptyProgress(),
        tuning,
        recentlyAsked: [questionId('q-06')],
        prefer: [questionId('q-06')],
        preferOnly: true,
      },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) {
      expect(drawn.value.questions).toEqual([{ questionId: 'q-06', familiarity: 'new' }]);
    }
  });

  it('counts a question the visit answered twice once when it makes up a spent scope', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(6) },
      {
        questions: makeBank(4),
        count: 2,
        progress: emptyProgress(),
        tuning,
        pool: [questionId('q-01'), questionId('q-02')],
        answeredHere: [questionId('q-01'), questionId('q-02'), questionId('q-01')],
        repeatWhenExhausted: true,
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId)).toEqual(['q-02', 'q-01']);
    expect(drawn.value.repeated).toBe(2);
  });

  it('still refuses a drill of zero when a spent scope may repeat', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(6) },
      {
        questions: makeBank(4),
        count: 0,
        progress: emptyProgress(),
        tuning,
        pool: [questionId('q-01')],
        answeredHere: [questionId('q-01')],
        repeatWhenExhausted: true,
      },
    );
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) expect(drawn.error.code).toBe('scheduler.count.invalid');
  });

  it('still refuses a drill of zero at a place with nothing to ask', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(4) },
      { questions: makeBank(4), count: 0, progress: emptyProgress(), tuning, prefer: [], preferOnly: true },
    );
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) expect(drawn.error.code).toBe('scheduler.count.invalid');
  });

  it('never asks again what this visit answered, even a missed question that has come due', () => {
    /*
     * The audit's repeat: answered wrongly at the grain bins, due a minute later,
     * and first in the missed tier at the combine harvester — the exclusion window
     * holds back only a question whose moment has not come.
     */
    const clock = testClock();
    const bank = makeBank(10);
    const missed = bank[0];
    if (missed === undefined) throw new Error('the fixture bank is short');
    const answered = answerQuestion(
      { clock },
      {
        question: missed,
        chosenIndex: (missed.correctIndex + 1) % missed.options.length,
        progress: emptyProgress(),
      },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    clock.advance(11 * 60_000);

    const unguarded = scheduleReview(
      { clock, random: seededRandomSource(8) },
      {
        questions: bank,
        count: 1,
        progress: answered.value.progress,
        tuning,
        recentlyAsked: [missed.id],
      },
    );
    expect(unguarded.ok).toBe(true);
    if (!unguarded.ok) return;
    expect(unguarded.value.questions.map((question) => question.questionId)).toEqual([missed.id]);

    const guarded = scheduleReview(
      { clock, random: seededRandomSource(8) },
      {
        questions: bank,
        count: 1,
        progress: answered.value.progress,
        tuning,
        recentlyAsked: [missed.id],
        answeredHere: [missed.id],
      },
    );
    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    expect(guarded.value.questions).toHaveLength(1);
    expect(guarded.value.questions.map((question) => question.questionId)).not.toContain(missed.id);
  });

  it('asks a spent scope again only when allowed, least recently answered first, and counts it', () => {
    const pool = [questionId('q-01'), questionId('q-02'), questionId('q-03')];
    const answeredHere = [questionId('q-03'), questionId('q-01')];

    const again = scheduleReview(
      { clock: testClock(), random: seededRandomSource(6) },
      {
        questions: makeBank(6),
        count: 2,
        progress: emptyProgress(),
        tuning,
        pool,
        answeredHere,
        repeatWhenExhausted: true,
      },
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.questions.map((question) => question.questionId)).toEqual(['q-02', 'q-01']);
    expect(again.value.repeated).toBe(1);
    expect(again.value.shortfall).toBe(0);

    const short = scheduleReview(
      { clock: testClock(), random: seededRandomSource(6) },
      { questions: makeBank(6), count: 2, progress: emptyProgress(), tuning, pool, answeredHere },
    );
    expect(short.ok).toBe(true);
    if (!short.ok) return;
    expect(short.value.questions.map((question) => question.questionId)).toEqual(['q-02']);
    expect(short.value.repeated).toBe(0);
    expect(short.value.shortfall).toBe(1);
  });

  it('repeats nothing while the scope still holds enough it has not answered', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(6) },
      {
        questions: makeBank(6),
        count: 2,
        progress: emptyProgress(),
        tuning,
        pool: [questionId('q-01'), questionId('q-02'), questionId('q-03')],
        answeredHere: [questionId('q-01')],
        repeatWhenExhausted: true,
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId).sort()).toEqual(['q-02', 'q-03']);
    expect(drawn.value.repeated).toBe(0);
  });

  it('makes up a whole draw from the visit when the visit has answered everything', () => {
    const drawn = scheduleReview(
      { clock: testClock(), random: seededRandomSource(6) },
      {
        questions: makeBank(6),
        count: 1,
        progress: emptyProgress(),
        tuning,
        pool: [questionId('q-01'), questionId('q-02')],
        answeredHere: [questionId('q-02'), questionId('q-01')],
        repeatWhenExhausted: true,
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId)).toEqual(['q-01']);
    expect(drawn.value.repeated).toBe(1);
  });
});

describe('the ports it holds', () => {
  it('replays the same draw from the same seed, and a different one from another', () => {
    const draw = (seed: number): readonly string[] => {
      const drawn = scheduleReview(
        { clock: testClock(), random: seededRandomSource(seed) },
        { questions: makeBank(30), count: 5, progress: emptyProgress(), tuning },
      );
      if (!drawn.ok) throw new Error('the draw must succeed');
      return drawn.value.questions.map((question) => question.questionId as string);
    };
    expect(draw(1234)).toEqual(draw(1234));
    expect(draw(1234)).not.toEqual(draw(4321));
  });

  it('offers a question answered wrongly before one answered rightly (TN-CARD-02)', () => {
    const clock = testClock();
    const bank = makeBank(6);
    let progress: Progress = emptyProgress();
    for (const [index, question] of bank.entries()) {
      const answered = answerQuestion(
        { clock },
        { question, chosenIndex: index === 3 ? 2 : question.correctIndex, progress },
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      progress = answered.value.progress;
      clock.advance(60_000);
    }
    clock.advance(10 * 60_000);

    const drawn = scheduleReview(
      { clock, random: seededRandomSource(5) },
      { questions: bank, count: 6, progress, tuning },
    );
    expect(drawn.ok).toBe(true);
    if (drawn.ok) expect(drawn.value.questions[0]?.questionId).toBe('q-04');
  });

  it('draws 50 times from a 30-question pool without repeating inside the window', () => {
    const clock = testClock();
    const random = seededRandomSource(0xc0ffee);
    const bank = makeBank(30);
    const window = tuning.exclusionWindow;
    expect(window).toBeGreaterThan(0);
    expect(bank.length).toBeGreaterThan(window);

    // Every question has been met before — forty days ago, so all thirty are
    // due. That is what "a 30-question pool" means for a scheduler; a cold start
    // is a different scenario, and it is the one below.
    let progress: Progress = emptyProgress();
    clock.set(at(ORIGIN - 40 * DAY));
    for (const [index, question] of bank.entries()) {
      const answered = answerQuestion(
        { clock },
        { question, chosenIndex: index % 3 === 0 ? 2 : question.correctIndex, progress },
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      progress = answered.value.progress;
    }
    clock.set(ORIGIN);

    let recentlyAsked: readonly QuestionId[] = [];
    const drawn: string[] = [];

    // Fifty draws in one sitting, so `now` does not move: the player is at the
    // card, not away from it.
    for (let index = 0; index < 50; index += 1) {
      const result = scheduleReview(
        { clock, random },
        { questions: bank, count: 1, progress, tuning, recentlyAsked },
      );
      expect(result.ok, `draw ${index}`).toBe(true);
      if (!result.ok) return;
      expect(result.value.questions, `draw ${index} came back empty`).toHaveLength(1);

      const asked = result.value.questions[0]?.questionId;
      expect(asked).toBeDefined();
      if (asked === undefined) return;
      drawn.push(asked);
      recentlyAsked = result.value.recentlyAsked;

      const question = bank.find((entry) => entry.id === asked);
      expect(question).toBeDefined();
      if (question === undefined) return;
      const answered = answerQuestion(
        { clock },
        { question, chosenIndex: random.next() > 0.35 ? question.correctIndex : 3, progress },
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      progress = answered.value.progress;
    }

    // Stated over the whole transcript rather than step by step, so the property
    // holds of the sequence and not only of the loop that produced it.
    for (let index = 0; index < drawn.length; index += 1) {
      const preceding = drawn.slice(Math.max(0, index - window), index);
      expect(preceding, `${String(drawn[index])} repeated at draw ${index}`).not.toContain(
        drawn[index],
      );
    }
    // And it moved around rather than cycling a small set forever.
    expect(new Set(drawn).size).toBe(bank.length);
  });

  it('never hands back an empty drill from a cold start, even against the daily new limit', () => {
    // The other side of the same rule: with `dailyNewLimit` questions already
    // introduced today and nothing due yet, the scheduler relaxes the window
    // rather than returning nothing (TN-STUDY-02's "unless fewer questions are
    // ready than the drill size"). An empty drill is only ever shown to a player
    // who has never answered anything.
    const clock = testClock();
    const random = seededRandomSource(99);
    const bank = makeBank(30);
    let progress: Progress = emptyProgress();
    let recentlyAsked: readonly QuestionId[] = [];

    for (let index = 0; index < 50; index += 1) {
      const result = scheduleReview(
        { clock, random },
        { questions: bank, count: 1, progress, tuning, recentlyAsked },
      );
      expect(result.ok, `draw ${index}`).toBe(true);
      if (!result.ok) return;
      expect(result.value.questions, `draw ${index} came back empty`).toHaveLength(1);
      recentlyAsked = result.value.recentlyAsked;

      const asked = result.value.questions[0]?.questionId;
      const question = bank.find((entry) => entry.id === asked);
      if (question === undefined) return;
      const answered = answerQuestion({ clock }, { question, chosenIndex: 0, progress });
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      progress = answered.value.progress;
    }
  });
});
