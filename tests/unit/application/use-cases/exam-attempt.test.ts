/**
 * An attempt as a value: `TN-EXAM-04`, `TN-RESULT-03`, `TN-ATTEMPT-02` and
 * `TN-ATTEMPT-04`.
 *
 * Everything here is arithmetic over save format version 3, and the version is
 * the point: there is no `correctCount` to keep in step, no `askedQuestionIds`
 * to reconcile and no `correct` flag, so the interesting assertions are about
 * states that **cannot be written down** rather than about states that are
 * forbidden.
 */

import { describe, expect, it } from 'vitest';

import type { ShippableQuestion } from '@application/ports';
import { defaultSettings } from '@domain/entities/player';
import { newProgress } from '@domain/entities/progress';
import type { ExamAnswer, Progress } from '@domain/entities/progress';
import type { EpochMillis, LocaleCode, QuestionId, SubjectId } from '@domain/ids';

import {
  countAnswered,
  countRight,
  discardExam,
  finishExam,
  isAnswerCorrect,
  missedQuestionIds,
  nextUnansweredIndex,
  openingIndex,
  resultsBySubject,
  startExam,
  withChoice,
  withExamInProgress,
  withRemaining,
} from '@application/use-cases/exam-attempt';

const NOW = 1_764_000_000_000 as EpochMillis;

const question = (id: string, subject: string, correctIndex = 0): ShippableQuestion =>
  ({
    id: id as QuestionId,
    subject: subject as SubjectId,
    correctIndex,
  }) as unknown as ShippableQuestion;

const answer = (
  id: string,
  subject: string,
  chosenIndex: number | null,
  correctIndex = 0,
): ExamAnswer => ({
  questionId: id as QuestionId,
  subjectId: subject as SubjectId,
  chosenIndex,
  correctIndex,
});

const blank = (): Progress => newProgress(defaultSettings('en' as LocaleCode));

describe('starting an exam', () => {
  it('writes the draw down with nothing answered, and copies the bank down with it', () => {
    const exam = startExam(
      [question('a', 'government', 2), question('b', 'justice', 1)],
      NOW,
      1_800_000,
    );
    expect(exam.startedAt).toBe(NOW);
    expect(exam.remainingMs).toBe(1_800_000);
    expect(exam.answers).toEqual([
      { questionId: 'a', subjectId: 'government', chosenIndex: null, correctIndex: 2 },
      { questionId: 'b', subjectId: 'justice', chosenIndex: null, correctIndex: 1 },
    ]);
  });

  it('records an untimed exam as one field, not as a number beside a boolean', () => {
    /* `ADR-0027`: `{ timed: true, remainingMs: null }` is unwritable because
       there is only one field to write. */
    expect(startExam([question('a', 'rights')], NOW, null).remainingMs).toBeNull();
  });
});

describe('answering, and changing an answer', () => {
  const exam = startExam([question('a', 'rights', 1), question('b', 'rights', 0)], NOW, null);

  it('records one answer for a question, not two', () => {
    const once = withChoice(exam, 0, 3);
    const twice = withChoice(once, 0, 1);
    expect(twice.answers).toHaveLength(2);
    expect(twice.answers[0]?.chosenIndex).toBe(1);
    /* The draw is untouched: the array is still the exam. */
    expect(twice.answers.map((entry) => String(entry.questionId))).toEqual(['a', 'b']);
  });

  it('leaves every other answer where it was', () => {
    const changed = withChoice(withChoice(exam, 1, 2), 0, 0);
    expect(changed.answers[1]?.chosenIndex).toBe(2);
  });

  it('counts what was answered and what was right, out of the answers themselves', () => {
    const answers = [
      answer('a', 'rights', 0, 0),
      answer('b', 'rights', 1, 0),
      answer('c', 'rights', null, 0),
    ];
    expect(countAnswered(answers)).toBe(2);
    expect(countRight(answers)).toBe(1);
    expect(isAnswerCorrect(answers[2] as ExamAnswer)).toBe(false);
  });

  it('folds the clock in only when it changed', () => {
    const held = withRemaining(exam, null);
    expect(held).toBe(exam);
    expect(withRemaining(exam, 60_000).remainingMs).toBe(60_000);
  });
});

describe('finishing', () => {
  const twenty = (right: number, unanswered = 0): readonly ExamAnswer[] =>
    Array.from({ length: 20 }, (_unused, index) =>
      index >= 20 - unanswered
        ? answer(`q${String(index)}`, 'rights', null)
        : answer(`q${String(index)}`, 'rights', index < right ? 0 : 1),
    );

  const finish = (answers: readonly ExamAnswer[], timed = false): ReturnType<typeof finishExam> =>
    finishExam(blank(), {
      exam: { startedAt: NOW, answers, remainingMs: null },
      now: (NOW + 1000) as EpochMillis,
      passMark: 15,
      timed,
    });

  it('records a pass at exactly the pass mark', () => {
    expect(finish(twenty(15)).attempt.passed).toBe(true);
  });

  it('records the pass mark as reached, not as re-derivable later', () => {
    /* `exam.passMark` is config and may change under a saved result, so the
       verdict is written down (`TN-RESULT-07`). */
    const { attempt } = finish(twenty(14));
    expect(attempt.passed).toBe(false);
    expect(attempt.finishedAt).toBe(NOW + 1000);
    expect(attempt.startedAt).toBe(NOW);
  });

  it('counts an unanswered question towards the twenty and never towards the score', () => {
    /* `TN-EXAM-04` and `TN-TIMER-05`: unanswered is a third state. */
    const { attempt } = finish(twenty(15, 4));
    expect(attempt.answers).toHaveLength(20);
    expect(countRight(attempt.answers)).toBe(15);
    expect(countAnswered(attempt.answers)).toBe(16);
    expect(attempt.passed).toBe(true);
  });

  it('says which exam it was', () => {
    expect(finish(twenty(20), true).attempt.timed).toBe(true);
    expect(finish(twenty(20), false).attempt.timed).toBe(false);
  });

  it('files the attempt and clears the exam in progress, both or neither', () => {
    const started = withExamInProgress(blank(), {
      startedAt: NOW,
      answers: twenty(20),
      remainingMs: null,
    });
    expect(started.examInProgress).not.toBeNull();
    const { progress } = finishExam(started, {
      exam: started.examInProgress ?? { startedAt: NOW, answers: twenty(20), remainingMs: null },
      now: NOW,
      passMark: 15,
      timed: false,
    });
    expect(progress.exams).toHaveLength(1);
    /* `TN-ATTEMPT-04`: an appended result that left `examInProgress` set would
       offer the player an exam they have just finished. */
    expect(progress.examInProgress).toBeNull();
  });
});

describe('leaving, discarding and coming back', () => {
  it('holds at most one unfinished exam, by the shape rather than by a rule', () => {
    const first = withExamInProgress(blank(), {
      startedAt: NOW,
      answers: [answer('a', 'rights', null)],
      remainingMs: null,
    });
    const second = withExamInProgress(first, {
      startedAt: NOW,
      answers: [answer('b', 'rights', null)],
      remainingMs: null,
    });
    expect(second.examInProgress?.answers).toHaveLength(1);
    expect(String(second.examInProgress?.answers[0]?.questionId)).toBe('b');
  });

  it('discards the attempt and nothing else', () => {
    const held = withExamInProgress(blank(), {
      startedAt: NOW,
      answers: [answer('a', 'rights', 1)],
      remainingMs: null,
    });
    const after = discardExam(held);
    expect(after.examInProgress).toBeNull();
    /* `TN-ATTEMPT-04`: "discarding the exam discarded the attempt, not what it
       taught the game about me". The reviews live somewhere else entirely. */
    expect(after.reviews).toEqual(held.reviews);
    expect(after.exams).toEqual(held.exams);
  });

  it('discarding nothing changes nothing', () => {
    const progress = blank();
    expect(discardExam(progress)).toBe(progress);
  });

  it('opens at the first question with no answer', () => {
    /* `TN-ATTEMPT-02`: twelve answered, question 5 skipped — it opens at 5. */
    const answers = Array.from({ length: 20 }, (_unused, index) =>
      answer(`q${String(index)}`, 'rights', index < 12 && index !== 4 ? 0 : null),
    );
    expect(openingIndex(answers)).toBe(4);
  });

  it('opens at the last question when every one has an answer', () => {
    const answers = Array.from({ length: 20 }, (_unused, index) =>
      answer(`q${String(index)}`, 'rights', 0),
    );
    expect(openingIndex(answers)).toBe(19);
  });

  it('finds the next unanswered question, wrapping', () => {
    const answers = [
      answer('a', 'rights', 0),
      answer('b', 'rights', null),
      answer('c', 'rights', 0),
    ];
    expect(nextUnansweredIndex(answers, 0)).toBe(1);
    expect(nextUnansweredIndex(answers, 1)).toBe(1);
    expect(nextUnansweredIndex([answer('a', 'rights', 0)], 0)).toBe(-1);
  });
});

describe('results by subject', () => {
  const answers: readonly ExamAnswer[] = [
    answer('a', 'government', 0, 0),
    answer('b', 'justice', 1, 0),
    answer('c', 'government', null, 0),
    answer('d', 'justice', 0, 0),
    answer('e', 'government', 0, 0),
  ];

  it('gives one row per subject the exam asked about, in the order asked', () => {
    expect(resultsBySubject(answers)).toEqual([
      { subjectId: 'government', correct: 2, total: 3 },
      { subjectId: 'justice', correct: 1, total: 2 },
    ]);
  });

  it('adds up to the exam and to the score line', () => {
    const rows = resultsBySubject(answers);
    expect(rows.reduce((total, row) => total + row.total, 0)).toBe(answers.length);
    expect(rows.reduce((total, row) => total + row.correct, 0)).toBe(countRight(answers));
  });

  it('draws no row for a subject with no questions in this exam', () => {
    /* `TN-RESULT-03`: "no row shows 0 out of 0". It cannot: rows are built from
       the answers, so a subject with none never gets one. */
    expect(resultsBySubject(answers).map((row) => String(row.subjectId))).not.toContain(
      'history',
    );
    expect(resultsBySubject([])).toEqual([]);
  });

  it('counts an unanswered question in its subject total and not as right', () => {
    const government = resultsBySubject(answers)[0];
    expect(government?.total).toBe(3);
    expect(government?.correct).toBe(2);
  });
});

describe('what comes back in Study', () => {
  it('names the questions answered wrongly, and not the ones nobody reached', () => {
    /* `TN-RESULT-04` is careful that an unanswered question "is shown as not
       answered … and no marking calls it wrong", so the drill must agree. */
    const answers = [
      answer('right', 'rights', 0, 0),
      answer('wrong', 'rights', 1, 0),
      answer('skipped', 'rights', null, 0),
    ];
    expect(missedQuestionIds(answers).map(String)).toEqual(['wrong']);
  });
});
