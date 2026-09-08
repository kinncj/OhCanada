/**
 * AnswerQuestion: the review record, the quest count and the stamp, all from one
 * tap and one instant (TN-CARD, TN-QUEST-02, TN-QUEST-04, TN-SAVE items 6-8).
 */

import { describe, expect, it } from 'vitest';

import { answerQuestion } from '@application/use-cases/answer-question';
import { offerQuest, startQuest } from '@application/use-cases/start-quest';
import { hasStamp, questStateFor, reviewFor } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import { wasLastAnswerWrong } from '@domain/scheduling/review-record';

import {
  DAY,
  ORIGIN,
  at,
  emptyProgress,
  levelId,
  makeQuest,
  makeQuestion,
  questId,
  questionId,
  subjectId,
  testClock,
} from '../../support/fixtures';

const quest = makeQuest();
const question = makeQuestion('gov-01');

/** Accepted, landmark engaged: the player is on the three-question step. */
const onTheAnswerStep = (): Progress => {
  const clock = testClock();
  const offered = offerQuest({ clock }, { quest, progress: emptyProgress() });
  if (!offered.ok) throw new Error('offer');
  const accepted = startQuest({ clock }, { quest, progress: offered.value.progress, decision: 'accept' });
  if (!accepted.ok) throw new Error('accept');
  // Engaging the landmark is a quest event, not an answer; the domain rule is
  // exercised in its own suite, so it is applied directly here.
  const state = questStateFor(accepted.value.progress, levelId(), questId());
  if (state === undefined) throw new Error('state');
  return {
    ...accepted.value.progress,
    levels: accepted.value.progress.levels.map((level) =>
      level.levelId === levelId()
        ? { ...level, quests: [{ ...state, stepIndex: 2, stepProgress: 0 }] }
        : level,
    ),
  };
};

describe('one answer, on its own', () => {
  it('records the review and remembers the subject was started', () => {
    const clock = testClock();
    const answered = answerQuestion({ clock }, { question, chosenIndex: 0, progress: emptyProgress() });
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.judgement.correct).toBe(true);
    expect(reviewFor(answered.value.progress, questionId('gov-01'))?.reps).toBe(1);
    expect(answered.value.progress.subjectsStarted).toEqual([subjectId()]);
    expect(answered.value.questState).toBeNull();
    expect(answered.value.stampEarned).toBe(false);
  });

  it('promises a wrong answer comes back soon, and marks it as missed', () => {
    const answered = answerQuestion(
      { clock: testClock() },
      { question, chosenIndex: 2, progress: emptyProgress() },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.judgement.correct).toBe(false);
    expect(answered.value.returnsSoon).toBe(true);
    const record = reviewFor(answered.value.progress, questionId('gov-01'));
    expect(record).toBeDefined();
    if (record !== undefined) expect(wasLastAnswerWrong(record)).toBe(true);
  });

  it('folds a second answer into the same record rather than adding another', () => {
    const clock = testClock();
    const first = answerQuestion({ clock }, { question, chosenIndex: 1, progress: emptyProgress() });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    clock.advance(DAY);
    const second = answerQuestion({ clock }, { question, chosenIndex: 0, progress: first.value.progress });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.progress.reviews).toHaveLength(1);
    expect(reviewFor(second.value.progress, questionId('gov-01'))?.reps).toBe(2);
    expect(reviewFor(second.value.progress, questionId('gov-01'))?.lastReviewedAt).toBe(
      at(ORIGIN + DAY),
    );
  });

  it('refuses an option that is not on the card', () => {
    const answered = answerQuestion(
      { clock: testClock() },
      { question, chosenIndex: 9, progress: emptyProgress() },
    );
    expect(answered.ok).toBe(false);
    if (!answered.ok) expect(answered.error.code).toBe('question.option.outOfRange');
  });
});

describe('an answer that counts toward a quest', () => {
  it('counts up to three and then completes the quest and earns the stamp', () => {
    const clock = testClock();
    let progress = onTheAnswerStep();
    const counted: number[] = [];

    for (const [index, chosen] of [2, 0, 3].entries()) {
      const answered = answerQuestion(
        { clock },
        { question: makeQuestion(`gov-0${index + 1}`), chosenIndex: chosen, progress, quest },
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      progress = answered.value.progress;
      counted.push(answered.value.questState?.stepProgress ?? -1);
      if (index < 2) {
        expect(answered.value.questCompleted).toBe(false);
        expect(answered.value.stampEarned).toBe(false);
      } else {
        // Two of the three answers were wrong, and the quest still finishes.
        expect(answered.value.questCompleted).toBe(true);
        expect(answered.value.stampEarned).toBe(true);
        expect(answered.value.completedStepIndex).toBe(2);
      }
      clock.advance(60_000);
    }

    expect(counted).toEqual([1, 2, 0]);
    expect(hasStamp(progress, levelId())).toBe(true);
    expect(questStateFor(progress, levelId(), questId())?.status).toBe('completed');
  });

  it('never earns a second stamp for the same level (TN-QUEST-04)', () => {
    const clock = testClock();
    let progress = onTheAnswerStep();
    for (let index = 0; index < 3; index += 1) {
      const answered = answerQuestion(
        { clock },
        { question: makeQuestion(`gov-1${index}`), chosenIndex: 0, progress, quest },
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      progress = answered.value.progress;
      clock.advance(60_000);
    }
    const stampedAt = progress.levels[0]?.stampEarnedAt;

    // A fourth answer, with the quest already complete, changes no quest state
    // and earns nothing.
    const extra = answerQuestion(
      { clock },
      { question: makeQuestion('gov-20'), chosenIndex: 0, progress, quest },
    );
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;
    expect(extra.value.stampEarned).toBe(false);
    expect(extra.value.questCompleted).toBe(false);
    expect(extra.value.progress.levels[0]?.stampEarnedAt).toBe(stampedAt);
    // ...but the answer itself is still recorded (TN-SAVE item 7).
    expect(reviewFor(extra.value.progress, questionId('gov-20'))?.reps).toBe(1);
  });

  it('does not advance a quest that is not on an answer step', () => {
    const clock = testClock();
    const offered = offerQuest({ clock }, { quest, progress: emptyProgress() });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const accepted = startQuest(
      { clock },
      { quest, progress: offered.value.progress, decision: 'accept' },
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    // A Study drill answered while the quest waits on "Find the Peace Tower".
    const answered = answerQuestion(
      { clock },
      { question, chosenIndex: 0, progress: accepted.value.progress, quest },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.questState?.stepIndex).toBe(1);
    expect(answered.value.questState?.stepProgress).toBe(0);
    expect(answered.value.completedStepIndex).toBeNull();
    expect(reviewFor(answered.value.progress, questionId('gov-01'))?.reps).toBe(1);
  });

  it('records the answer when the player has not met the quest at all', () => {
    const answered = answerQuestion(
      { clock: testClock() },
      { question, chosenIndex: 0, progress: emptyProgress(), quest },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.questState).toBeNull();
    expect(reviewFor(answered.value.progress, questionId('gov-01'))?.reps).toBe(1);
  });
});
