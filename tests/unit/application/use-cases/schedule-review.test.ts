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
