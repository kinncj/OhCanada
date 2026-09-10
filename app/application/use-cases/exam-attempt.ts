/**
 * An attempt at the exam, as a value: starting one, answering into it, leaving
 * it, discarding it and finishing it.
 *
 * Save format version 3 made this file possible and shapes every function in it
 * (`ADR-0027`, `content/schemas/progress.schema.json`):
 *
 *  - **Every total is read out of `answers`.** There is no `correctCount` to
 *    keep in step and no `askedQuestionIds` to reconcile, so {@link countRight}
 *    and {@link countAnswered} are the domain's own folds over the array and
 *    nothing in this file writes a number beside the answers it came from.
 *  - **Correctness is `chosenIndex === correctIndex`.** There is no `correct`
 *    flag to set, so "unanswered, and scored" is unwritable rather than
 *    forbidden — which is what lets {@link finishExam} treat a question nobody
 *    reached as neither right nor wrong without a single conditional.
 *  - **`examInProgress` is a nullable field beside `exams`, not a row in it.**
 *    So "at most one unfinished exam" (`TN-ATTEMPT-04`) is a property of the
 *    shape, and {@link discardExam} is an assignment rather than a search.
 *
 * Pure, total, and no clock: `now` arrives as a parameter, exactly as it does
 * throughout `@domain/entities/progress`.
 */

import type { ShippableQuestion } from '@application/ports';
import type { EpochMillis, QuestionId, SubjectId } from '@domain/ids';
import {
  answeredCountOf,
  correctCountOf,
  isAnswerCorrect,
  withExamAttempt,
} from '@domain/entities/progress';
import type { ExamAnswer, ExamAttempt, ExamInProgress, Progress } from '@domain/entities/progress';

/** How many of these were right. Re-exported so a caller needs one import. */
export const countRight = correctCountOf;
/** How many were answered at all. The complement is unanswered, never wrong. */
export const countAnswered = answeredCountOf;
export { isAnswerCorrect };

/**
 * The twenty questions as drawn, with nothing answered yet.
 *
 * `subjectId` and `correctIndex` are copied down here, at the only moment the
 * bank and the attempt are both in hand. That is the whole reason `TN-RESULT-07`
 * can promise a result read a year later keeps its by-subject rows and its score
 * after the question has left the build.
 */
export const startExam = (
  questions: readonly ShippableQuestion[],
  now: EpochMillis,
  remainingMs: number | null,
): ExamInProgress => ({
  startedAt: now,
  answers: questions.map((question) => ({
    questionId: question.id,
    subjectId: question.subject,
    chosenIndex: null,
    correctIndex: question.correctIndex,
  })),
  remainingMs,
});

/**
 * Record one answer, or change one.
 *
 * `TN-EXAM-03`: "the exam records one answer for question 1, not two". The
 * answer is replaced in place rather than appended, so the array stays the draw
 * — which is what makes it both the running exam and, unchanged, the result.
 */
export const withChoice = (
  exam: ExamInProgress,
  index: number,
  chosenIndex: number,
): ExamInProgress => ({
  ...exam,
  answers: exam.answers.map((answer, at) =>
    at === index ? { ...answer, chosenIndex } : answer,
  ),
});

/** The clock, folded back in before the exam is written down. */
export const withRemaining = (exam: ExamInProgress, remainingMs: number | null): ExamInProgress =>
  exam.remainingMs === remainingMs ? exam : { ...exam, remainingMs };

/**
 * Keep the unfinished exam. Leaving records this and nothing else — no
 * `finishedAt`, no `passed` (`TN-ATTEMPT-01`).
 */
export const withExamInProgress = (progress: Progress, exam: ExamInProgress): Progress =>
  progress.examInProgress === exam ? progress : { ...progress, examInProgress: exam };

/**
 * Throw the unfinished exam away, and nothing else.
 *
 * `TN-ATTEMPT-04`: "discarding the exam discarded the attempt, not what it
 * taught the game about me". The reviews the answers wrote are somewhere else
 * entirely and are not touched here, which is why this is one assignment.
 */
export const discardExam = (progress: Progress): Progress =>
  progress.examInProgress === null ? progress : { ...progress, examInProgress: null };

export interface FinishExamInput {
  readonly exam: ExamInProgress;
  readonly now: EpochMillis;
  /** `exam.passMark` from `game.config.json`. Recorded on the attempt, not re-read later. */
  readonly passMark: number;
  /** Was the clock still running when this ended? A timer stopped mid-exam records `false`. */
  readonly timed: boolean;
}

export interface FinishExamResult {
  readonly progress: Progress;
  readonly attempt: ExamAttempt;
}

/**
 * File the attempt as a finished result, and clear the exam in progress.
 *
 * Both edits or neither — that is `withExamAttempt`'s promise in the domain, and
 * this function exists to make sure nothing else has to remember it. `passed` is
 * computed once, here, and recorded: `exam.passMark` is configuration and may
 * change under a saved result (`TN-RESULT-07`, "no score is recomputed from a
 * bank that has changed" — nor from a rule that has).
 */
export const finishExam = (progress: Progress, input: FinishExamInput): FinishExamResult => {
  const attempt: ExamAttempt = {
    startedAt: input.exam.startedAt,
    finishedAt: input.now,
    answers: input.exam.answers,
    passed: countRight(input.exam.answers) >= input.passMark,
    timed: input.timed,
  };
  return { progress: withExamAttempt(progress, attempt), attempt };
};

/**
 * Where a resumed exam opens: the first question with no answer, or the last
 * one when every question has one (`TN-ATTEMPT-02`).
 *
 * Not "where the player was". Which question was on screen is in `TN-ATTEMPT`'s
 * *does not survive* table on purpose: it is the one thing a player can find
 * again in one press, and storing it would be the third thing a save has to keep
 * true about an exam.
 */
export const openingIndex = (answers: readonly ExamAnswer[]): number => {
  const first = answers.findIndex((answer) => answer.chosenIndex === null);
  return first === -1 ? Math.max(0, answers.length - 1) : first;
};

/** The first question after `from` with no answer, wrapping. `-1` when there is none. */
export const nextUnansweredIndex = (answers: readonly ExamAnswer[], from = -1): number => {
  for (let step = 1; step <= answers.length; step += 1) {
    const at = (from + step + answers.length) % answers.length;
    if (answers[at]?.chosenIndex === null) return at;
  }
  return -1;
};

/** One row of the by-subject breakdown, in the order the subjects were first asked. */
export interface SubjectResult {
  readonly subjectId: SubjectId;
  /** Right answers in this subject. Unanswered questions are not among them. */
  readonly correct: number;
  /** Every question asked about this subject, answered or not (`TN-RESULT-03`). */
  readonly total: number;
}

/**
 * How the player did, subject by subject.
 *
 * `TN-RESULT-03`: one row per subject **the exam asked about**, no row for a
 * subject with no questions in this exam, and never a row reading "0 out of 0".
 * That is not a filter here — a subject with no questions never gets a row,
 * because the rows are built from the answers rather than from the catalogue.
 *
 * The totals add up to the exam and the right answers add up to the score line,
 * because both are folds over the same array. Nothing is looked up: the subject
 * on the answer is what the build that asked it recorded (`ADR-0027`).
 */
export const resultsBySubject = (answers: readonly ExamAnswer[]): readonly SubjectResult[] => {
  const order: SubjectId[] = [];
  const rows = new Map<SubjectId, { correct: number; total: number }>();
  for (const answer of answers) {
    let row = rows.get(answer.subjectId);
    if (row === undefined) {
      row = { correct: 0, total: 0 };
      rows.set(answer.subjectId, row);
      order.push(answer.subjectId);
    }
    row.total += 1;
    if (isAnswerCorrect(answer)) row.correct += 1;
  }
  return order.map((subjectId) => {
    const row = rows.get(subjectId) ?? { correct: 0, total: 0 };
    return { subjectId, correct: row.correct, total: row.total };
  });
};

/**
 * The questions the player got wrong, for the drill offered from a result.
 *
 * Wrong, not unanswered: `TN-RESULT-02` offers "Practise the questions you
 * missed" and `TN-RESULT-04` is careful that a question nobody reached "is shown
 * as not answered … and no marking calls it wrong". A drill built from both
 * would quietly disagree with the screen above it.
 */
export const missedQuestionIds = (answers: readonly ExamAnswer[]): readonly QuestionId[] =>
  answers
    .filter((answer) => answer.chosenIndex !== null && !isAnswerCorrect(answer))
    .map((answer) => answer.questionId);
