/**
 * `Progress` <-> `ProgressSnapshot`: the domain value and the save document.
 *
 * Two differences, and only two, which is what makes this file short enough to
 * read:
 *
 *  1. every instant is `EpochMillis` on the domain side and `IsoInstant` on the
 *     document side (ADR-0012, `iso-instant.ts`);
 *  2. the document carries `$schema`, `version` and `updatedAt`, which describe
 *     the *file* rather than the game, and the domain has no field for them.
 *
 * Everything else is property for property the same, because the domain entities
 * mirror `progress.schema.json` deliberately (see `app/domain/entities/`). The
 * single exception is the review record, where the domain says `dueAt` and
 * `lastReviewedAt` and the schema says `due` and `lastReview`; the mapping is
 * stated once, here, rather than by renaming either side to match the other.
 *
 * Both directions are total functions returning `Result`: an instant that cannot
 * be expressed and a timestamp that cannot be read are both expected failures of
 * a file that may have been hand-edited, not exceptions.
 */

import { all, appErr, map, ok } from '@common/result';
import type { Result } from '@common/result';
import type { EpochMillis, IsoInstant, LocaleCode } from '@domain/ids';
import type {
  ExamAttemptDocument,
  LevelProgressDocument,
  ProgressSnapshot,
  QuestProgressDocument,
  ReviewStateDocument,
} from '@application/ports/progress-repository';

import { clampSettings } from '@domain/entities/player';
import type { ReviewRecord } from '@domain/scheduling/review-record';
import type { ExamAttempt, LevelProgress, Progress } from '@domain/entities/progress';
import type { QuestState } from '@domain/entities/quest';

import { fromIsoInstant, toIsoInstant } from '@application/persistence/iso-instant';

/** The `$id` of the schema a save validates against; written into every document. */
export const PROGRESS_SCHEMA_ID = 'https://truenorth.app/schemas/progress.schema.json';

/** What the document needs that the domain does not carry. */
export interface DocumentHeader {
  readonly version: number;
  readonly updatedAt: EpochMillis;
  /** Defaults to the canonical schema id; a caller may not invent a different shape. */
  readonly schemaId?: string;
}

const nullableToIso = (value: EpochMillis | null): Result<IsoInstant | null> =>
  value === null ? ok(null) : toIsoInstant(value);

const nullableFromIso = (value: IsoInstant | null): Result<EpochMillis | null> =>
  value === null ? ok(null) : fromIsoInstant(value);

const questToDocument = (state: QuestState): Result<QuestProgressDocument> =>
  map(toIsoInstant(state.updatedAt), (updatedAt) => ({
    questId: state.questId,
    status: state.status,
    stepIndex: state.stepIndex,
    stepProgress: state.stepProgress,
    updatedAt,
  }));

const questFromDocument = (document: QuestProgressDocument): Result<QuestState> =>
  map(fromIsoInstant(document.updatedAt), (updatedAt) => ({
    questId: document.questId,
    status: document.status,
    stepIndex: document.stepIndex,
    stepProgress: document.stepProgress,
    updatedAt,
  }));

const levelToDocument = (level: LevelProgress): Result<LevelProgressDocument> => {
  const quests = all(level.quests.map(questToDocument));
  if (!quests.ok) return quests;
  const stamped = nullableToIso(level.stampEarnedAt);
  if (!stamped.ok) return stamped;
  return ok({
    levelId: level.levelId,
    unlocked: level.unlocked,
    quests: quests.value,
    bestScore: level.bestScore,
    stampEarnedAt: stamped.value,
  });
};

const levelFromDocument = (document: LevelProgressDocument): Result<LevelProgress> => {
  const quests = all(document.quests.map(questFromDocument));
  if (!quests.ok) return quests;
  const stamped = nullableFromIso(document.stampEarnedAt);
  if (!stamped.ok) return stamped;
  return ok({
    levelId: document.levelId,
    unlocked: document.unlocked,
    quests: quests.value,
    bestScore: document.bestScore,
    stampEarnedAt: stamped.value,
  });
};

const reviewToDocument = (record: ReviewRecord): Result<ReviewStateDocument> => {
  const due = toIsoInstant(record.dueAt);
  if (!due.ok) return due;
  const lastReview = nullableToIso(record.lastReviewedAt);
  if (!lastReview.ok) return lastReview;
  const firstReviewedAt = nullableToIso(record.firstReviewedAt);
  if (!firstReviewedAt.ok) return firstReviewedAt;
  return ok({
    questionId: record.questionId,
    due: due.value,
    stability: record.stability,
    difficulty: record.difficulty,
    reps: record.reps,
    lapses: record.lapses,
    lastReview: lastReview.value,
    firstReviewedAt: firstReviewedAt.value,
    learningSteps: record.learningSteps,
    phase: record.phase,
  });
};

const reviewFromDocument = (document: ReviewStateDocument): Result<ReviewRecord> => {
  const dueAt = fromIsoInstant(document.due);
  if (!dueAt.ok) return dueAt;
  const lastReviewedAt = nullableFromIso(document.lastReview);
  if (!lastReviewedAt.ok) return lastReviewedAt;
  const firstReviewedAt = nullableFromIso(document.firstReviewedAt);
  if (!firstReviewedAt.ok) return firstReviewedAt;
  return ok({
    questionId: document.questionId,
    dueAt: dueAt.value,
    stability: document.stability,
    difficulty: document.difficulty,
    reps: document.reps,
    lapses: document.lapses,
    lastReviewedAt: lastReviewedAt.value,
    firstReviewedAt: firstReviewedAt.value,
    phase: document.phase,
    learningSteps: document.learningSteps,
  });
};

const examToDocument = (attempt: ExamAttempt): Result<ExamAttemptDocument> => {
  const startedAt = toIsoInstant(attempt.startedAt);
  if (!startedAt.ok) return startedAt;
  const finishedAt = nullableToIso(attempt.finishedAt);
  if (!finishedAt.ok) return finishedAt;
  return ok({
    startedAt: startedAt.value,
    finishedAt: finishedAt.value,
    askedQuestionIds: attempt.askedQuestionIds,
    correctCount: attempt.correctCount,
    passed: attempt.passed,
    timed: attempt.timed,
  });
};

const examFromDocument = (document: ExamAttemptDocument): Result<ExamAttempt> => {
  const startedAt = fromIsoInstant(document.startedAt);
  if (!startedAt.ok) return startedAt;
  const finishedAt = nullableFromIso(document.finishedAt);
  if (!finishedAt.ok) return finishedAt;
  return ok({
    startedAt: startedAt.value,
    finishedAt: finishedAt.value,
    askedQuestionIds: document.askedQuestionIds,
    correctCount: document.correctCount,
    passed: document.passed,
    timed: document.timed,
  });
};

/** Write the game out as the document `progress.schema.json` describes. */
export const toProgressSnapshot = (
  progress: Progress,
  header: DocumentHeader,
): Result<ProgressSnapshot> => {
  if (!Number.isInteger(header.version) || header.version < 1) {
    return appErr('invalid', 'save.version.invalid', 'A save version is a whole number from 1.', {
      version: header.version,
    });
  }
  const updatedAt = toIsoInstant(header.updatedAt);
  if (!updatedAt.ok) return updatedAt;
  const levels = all(progress.levels.map(levelToDocument));
  if (!levels.ok) return levels;
  const reviews = all(progress.reviews.map(reviewToDocument));
  if (!reviews.ok) return reviews;
  const exams = all(progress.exams.map(examToDocument));
  if (!exams.ok) return exams;

  return ok({
    $schema: header.schemaId ?? PROGRESS_SCHEMA_ID,
    version: header.version,
    updatedAt: updatedAt.value,
    settings: progress.settings,
    character: progress.character,
    levels: levels.value,
    lastPlayedLevelId: progress.lastPlayedLevelId,
    reviews: reviews.value,
    subjectsStarted: progress.subjectsStarted,
    exams: exams.value,
  });
};

/**
 * Read the game back out of a document that has already passed the schema check.
 *
 * Settings are clamped on the way in (`clampSettings`): the schema bounds text
 * scale and the volumes, but a document that reached this function from a
 * migration rather than from `decode` has not been through it, and a first
 * screen drawn at 40x text is not a failure a player should have to diagnose.
 */
export const fromProgressSnapshot = (
  snapshot: ProgressSnapshot,
  fallbackLocale: LocaleCode,
): Result<Progress> => {
  const levels = all(snapshot.levels.map(levelFromDocument));
  if (!levels.ok) return levels;
  const reviews = all(snapshot.reviews.map(reviewFromDocument));
  if (!reviews.ok) return reviews;
  const exams = all(snapshot.exams.map(examFromDocument));
  if (!exams.ok) return exams;

  return ok({
    character: snapshot.character,
    settings: clampSettings(snapshot.settings, fallbackLocale),
    levels: levels.value,
    // Carried straight through. It is not validated against `levels` on purpose:
    // a save whose last level is one this build no longer ships should offer a
    // Continue that fails gracefully at load, not fail to import (ADR-0023).
    lastPlayedLevelId: snapshot.lastPlayedLevelId,
    reviews: reviews.value,
    subjectsStarted: snapshot.subjectsStarted,
    exams: exams.value,
  });
};
