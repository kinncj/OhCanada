/**
 * Question — one exam-style question, and what answering it means.
 *
 * Mirrors `content/schemas/question.schema.json`: four options, one correct
 * index, both languages inline, a source block and a verification block. The
 * rules here answer two questions the stories ask and nothing else — *may this
 * question be shown?* (CLAUDE.md content rules, TN-QUEST-05) and *was that
 * answer right?* (TN-CARD).
 *
 * What a right or wrong answer does to the *schedule* is
 * `@domain/scheduling/review-record`; this file has no clock and no memory model.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { QuestionId, SubjectId } from '@domain/ids';

import { isBilingual } from '@domain/entities/values';
import type { LocalizedText } from '@domain/entities/values';

/**
 * The part of `common.schema.json#/$defs/factSource` a *rule* reads.
 *
 * One field, because one field is what `isVerified` needs. The rest of the block
 * — the chapter, the url, the page, the author's quote, `asOf`, `volatile` — is
 * read by `make verify-content` and by a human reviewer, and a domain type that
 * listed it would have to be edited every time the content pipeline grew a field
 * it does not use. `QuestionDocument` from the content port satisfies this
 * exactly, which is the whole mechanism.
 */
export interface FactSource {
  /** SHA-256 of what the verifier read. A status granted for a different one is stale. */
  readonly sourceHash: string;
}

/** What the verifier agent wrote, and only the verifier (ADR-0003). */
export interface FactVerification {
  readonly status: 'unverified' | 'verified' | 'quarantined' | 'rejected';
  /** The hash the status was granted for; a mismatch with the source invalidates it. */
  readonly sourceHash: string;
  /** The passage that entails the claim. A verified status without one is an assertion. */
  readonly evidence: string;
}

/** The four options, positionally. Exactly four; the schema says so and so does the card. */
export type QuestionOptions = readonly [LocalizedText, LocalizedText, LocalizedText, LocalizedText];

/** Index into `QuestionOptions`. */
export type OptionIndex = 0 | 1 | 2 | 3;

export interface Question {
  readonly id: QuestionId;
  readonly subject: SubjectId;
  readonly prompt: LocalizedText;
  readonly options: QuestionOptions;
  readonly correctIndex: OptionIndex;
  readonly explanation: LocalizedText;
  readonly source: FactSource;
  readonly verification: FactVerification;
}

/** What one answer produced: the judgement, and the text that explains it. */
export interface AnswerJudgement {
  readonly questionId: QuestionId;
  readonly chosenIndex: OptionIndex;
  readonly correctIndex: OptionIndex;
  readonly correct: boolean;
  readonly explanation: LocalizedText;
}

/**
 * Was this question's status granted for the source it now cites?
 *
 * Three conditions, all of them ADR-0003's: the status is `verified`, the hash
 * it was granted for still matches the source block, and a passage was quoted.
 * A status granted for a hash that has since moved is stale, which is exactly
 * what the hash is in the document for.
 */
export const isVerified = (question: Question): boolean =>
  question.verification.status === 'verified' &&
  question.verification.sourceHash === question.source.sourceHash &&
  question.verification.evidence.trim().length > 0;

/**
 * May this question be put in front of a player?
 *
 * Verified, and readable in both languages. TN-QUEST-05: "a question that has no
 * French text is never shown", and the build has already failed for it — this is
 * the runtime half, so a content mistake degrades the drill instead of showing a
 * player an empty card.
 */
export const isShippable = (question: Question): boolean =>
  isVerified(question) &&
  isBilingual(question.prompt) &&
  isBilingual(question.explanation) &&
  question.options.every(isBilingual);

/** The questions of a bank that may actually be asked, in the order given. */
export const shippableQuestions = <T extends Question>(
  questions: readonly T[],
): readonly T[] => questions.filter(isShippable);

/** Is this a real option index for this question? */
export const isOptionIndex = (value: number): value is OptionIndex =>
  Number.isInteger(value) && value >= 0 && value <= 3;

/**
 * Judge one answer.
 *
 * A wrong answer is not an error: it is a normal, expected outcome that this
 * project treats as learning (TN-QUEST-04, "no message tells me I failed"). The
 * only `Result` failure here is a chosen index that is not one of the four
 * options, which no card can produce and a bad caller can.
 */
export const gradeAnswer = (question: Question, chosenIndex: number): Result<AnswerJudgement> => {
  if (!isOptionIndex(chosenIndex)) {
    return appErr('invalid', 'question.option.outOfRange', 'That is not one of the options.', {
      questionId: question.id,
      chosenIndex,
    });
  }
  return ok({
    questionId: question.id,
    chosenIndex,
    correctIndex: question.correctIndex,
    correct: chosenIndex === question.correctIndex,
    explanation: question.explanation,
  });
};
