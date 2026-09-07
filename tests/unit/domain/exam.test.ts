import { describe, expect, it } from 'vitest';
import { answerExam, gradeExam, isExpired, remainingSeconds, selectExamQuestions, startExam } from '@domain/exam';
import { SeededRandom } from '@common/rng';
import { QUESTIONS, q } from '../../fixtures/content';
import { questionId } from '@domain/ids';

const params = { questionCount: 4, passMark: 3, timeLimitSeconds: 60 };

describe('exam', () => {
  it('spreads selection across subjects', () => {
    const picked = selectExamQuestions(QUESTIONS, 4, new SeededRandom(1));
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((p) => p.subject)).size).toBe(4);
  });
  it('returns fewer when pool is small and startExam refuses', () => {
    expect(selectExamQuestions(QUESTIONS.slice(0, 2), 5, new SeededRandom(1))).toHaveLength(2);
    expect(() => startExam(QUESTIONS.slice(0, 2), params, new SeededRandom(1), 0)).toThrow('Not enough');
  });
  it('answers, times and grades', () => {
    let s = startExam(QUESTIONS, params, new SeededRandom(9), 1000);
    expect(remainingSeconds(s, 1000)).toBe(60);
    expect(isExpired(s, 1000 + 61_000)).toBe(true);
    const first = s.questions[0]!;
    const ck = first.choices.find((c) => c.correct)!.key;
    s = answerExam(s, first.question.id, ck);
    s = answerExam(s, questionId('nope'), 'a');
    for (const pq of s.questions.slice(1)) {
      const wrong = pq.choices.find((c) => !c.correct)!.key;
      s = answerExam(s, pq.question.id, wrong);
    }
    const grade = gradeExam(s, 1000 + 30_000);
    expect(grade.correct).toBe(1);
    expect(grade.total).toBe(4);
    expect(grade.passed).toBe(false);
    expect(grade.durationSeconds).toBe(30);
    expect(grade.perQuestion[0]?.correct).toBe(true);
    // submitted exams ignore answers; duration is clamped
    const done = { ...s, submittedAt: 5 };
    expect(answerExam(done, first.question.id, 'a')).toBe(done);
    expect(gradeExam(s, 1000 + 999_000).durationSeconds).toBe(60);
  });
  it('unanswered questions are wrong', () => {
    const s = startExam([...QUESTIONS, q('q-sy-001', 'symbols')], params, new SeededRandom(2), 0);
    const g = gradeExam(s, 10);
    expect(g.correct).toBe(0);
    expect(g.perQuestion.every((p) => p.chosen === null)).toBe(true);
  });
});
