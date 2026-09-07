import type { Question } from './question';
import { presentQuestion, type PresentedQuestion } from './question';
import type { RandomSource } from '@common/rng';
import { shuffle } from '@common/rng';
import { SUBJECTS, type QuestionId, type Subject } from './ids';
import { selectQuestions, type SelectionHistory } from './question-selector';

export interface ExamParameters {
  readonly questionCount: number;
  readonly passMark: number;
  readonly timeLimitSeconds: number;
}

export interface ExamState {
  readonly startedAt: number; // ms
  readonly params: ExamParameters;
  readonly questions: readonly PresentedQuestion[];
  readonly answers: Readonly<Record<string, string>>; // questionId -> choice key
  readonly submittedAt: number | null;
}

const NO_HISTORY: SelectionHistory = { seenQuestionIds: [], wrongQuestionIds: [] };

/**
 * Pick questions spread across subjects (round-robin) so the exam mirrors the real test's breadth.
 * Within a subject the QuestionSelector avoids recently seen questions and favours previously-wrong ones.
 */
export function selectExamQuestions(pool: readonly Question[], count: number, rng: RandomSource, history: SelectionHistory = NO_HISTORY): Question[] {
  const bySubject = new Map<Subject, Question[]>();
  for (const s of SUBJECTS) bySubject.set(s, []);
  for (const q of pool) bySubject.get(q.subject)?.push(q);
  for (const s of SUBJECTS) {
    const subjectPool = bySubject.get(s) ?? [];
    bySubject.set(s, selectQuestions(subjectPool, s, history, subjectPool.length, rng));
  }

  const picked: Question[] = [];
  const subjects = shuffle(SUBJECTS, rng);
  let progress = true;
  while (picked.length < count && progress) {
    progress = false;
    for (const s of subjects) {
      if (picked.length >= count) break;
      const q = bySubject.get(s)?.shift();
      if (q) {
        picked.push(q);
        progress = true;
      }
    }
  }
  return shuffle(picked, rng);
}

export function startExam(pool: readonly Question[], params: ExamParameters, rng: RandomSource, startedAt: number, history: SelectionHistory = NO_HISTORY): ExamState {
  const chosen = selectExamQuestions(pool, params.questionCount, rng, history);
  if (chosen.length < params.questionCount) throw new Error(`Not enough questions for exam: ${chosen.length} < ${params.questionCount}`);
  return { startedAt, params, questions: chosen.map((q) => presentQuestion(q, rng)), answers: {}, submittedAt: null };
}

export function answerExam(state: ExamState, questionId: QuestionId, key: string): ExamState {
  if (state.submittedAt !== null) return state;
  if (!state.questions.some((q) => q.question.id === questionId)) return state;
  return { ...state, answers: { ...state.answers, [questionId]: key } };
}

export function remainingSeconds(state: ExamState, now: number): number {
  return Math.max(0, state.params.timeLimitSeconds - Math.floor((now - state.startedAt) / 1000));
}

export function isExpired(state: ExamState, now: number): boolean {
  return remainingSeconds(state, now) <= 0;
}

export interface ExamGrade {
  readonly correct: number;
  readonly total: number;
  readonly passed: boolean;
  readonly durationSeconds: number;
  readonly perQuestion: readonly { readonly questionId: QuestionId; readonly correct: boolean; readonly chosen: string | null; readonly correctKey: string }[];
}

export function gradeExam(state: ExamState, submittedAt: number): ExamGrade {
  const perQuestion = state.questions.map((pq) => {
    const chosen = state.answers[pq.question.id] ?? null;
    const ck = pq.choices.find((c) => c.correct)?.key ?? '';
    return { questionId: pq.question.id, correct: chosen === ck, chosen, correctKey: ck };
  });
  const correct = perQuestion.filter((p) => p.correct).length;
  return {
    correct,
    total: state.questions.length,
    passed: correct >= state.params.passMark,
    durationSeconds: Math.min(state.params.timeLimitSeconds, Math.max(0, Math.round((submittedAt - state.startedAt) / 1000))),
    perQuestion,
  };
}
