/**
 * Progress — everything a closed tab must not lose, as the domain holds it.
 *
 * Property for property, this is `content/schemas/progress.schema.json` minus
 * the three fields that describe the *document* rather than the game — `$schema`,
 * `version` and `updatedAt` — and with every instant as `EpochMillis` instead of
 * `IsoInstant`. Those two differences are the whole boundary between a domain
 * value and a save file, and `@application/persistence/progress-document` is the
 * only place that crosses it (ADR-0012).
 *
 * The eight rows of TN-SAVE's survives table land here as: `character` (1),
 * `settings.locale` (2), the rest of `settings` (3), `levels[].unlocked` (4),
 * `levels[].quests` (5), `levels[].stampEarnedAt` (6), `reviews` (7) and
 * `subjectsStarted` (8). Nothing else is promised, and nothing else is here:
 * there is no player position, no camera, no open screen and no drill in
 * progress (TN-SAVE-03).
 *
 * Every function returns a new `Progress`. Nothing is mutated, nothing reads a
 * clock: `now` arrives as a parameter from the use case that holds the `Clock`.
 */

import type { EpochMillis, LevelId, QuestId, QuestionId, SubjectId } from '@domain/ids';

import type { ReviewRecord } from '@domain/scheduling/review-record';
import type { Player, Settings } from '@domain/entities/player';
import type { PlayerCharacter } from '@domain/entities/character';
import type { QuestState } from '@domain/entities/quest';
import { withCharacter as setCharacter, withSettings as setSettings } from '@domain/entities/player';

/** One run at the exam. IRCC mirror: 20 questions, 15 to pass, 30 minutes. */
export interface ExamAttempt {
  readonly startedAt: EpochMillis;
  readonly finishedAt: EpochMillis | null;
  readonly askedQuestionIds: readonly QuestionId[];
  readonly correctCount: number;
  readonly passed: boolean;
  /** The timer is optional even in Exam mode; record whether it was on. */
  readonly timed: boolean;
}

export interface LevelProgress {
  readonly levelId: LevelId;
  readonly unlocked: boolean;
  /** One entry per quest the player has met, in any state — not a completed-only list. */
  readonly quests: readonly QuestState[];
  readonly bestScore: number;
  /** When the stamp was earned; `null` while it has not been. */
  readonly stampEarnedAt: EpochMillis | null;
}

export interface Progress extends Player {
  readonly character: PlayerCharacter | null;
  readonly settings: Settings;
  readonly levels: readonly LevelProgress[];
  /**
   * The level the player was last in, so the title screen can offer Continue.
   * `null` until one has been entered. The LEVEL, not the screen (ADR-0023).
   */
  readonly lastPlayedLevelId: LevelId | null;
  readonly reviews: readonly ReviewRecord[];
  readonly subjectsStarted: readonly SubjectId[];
  readonly exams: readonly ExamAttempt[];
}

/** A game that has not been played yet, with the levels the config opens. */
export const newProgress = (
  settings: Settings,
  unlockedLevelIds: readonly LevelId[] = [],
): Progress => ({
  character: null,
  settings,
  levels: unlockedLevelIds.map((levelId) => emptyLevelProgress(levelId, true)),
  lastPlayedLevelId: null,
  reviews: [],
  subjectsStarted: [],
  exams: [],
});

export const emptyLevelProgress = (levelId: LevelId, unlocked: boolean): LevelProgress => ({
  levelId,
  unlocked,
  quests: [],
  bestScore: 0,
  stampEarnedAt: null,
});

export const levelProgressFor = (
  progress: Progress,
  levelId: LevelId,
): LevelProgress | undefined => progress.levels.find((level) => level.levelId === levelId);

/** Is this level playable? An absent entry is locked, not an error. */
export const isLevelUnlocked = (progress: Progress, levelId: LevelId): boolean =>
  levelProgressFor(progress, levelId)?.unlocked === true;

export const questStateFor = (
  progress: Progress,
  levelId: LevelId,
  questId: QuestId,
): QuestState | undefined =>
  levelProgressFor(progress, levelId)?.quests.find((quest) => quest.questId === questId);

/** Replace one level's entry, adding it if the player has never been there. */
const withLevelProgress = (
  progress: Progress,
  levelId: LevelId,
  update: (level: LevelProgress) => LevelProgress,
): Progress => {
  const existing = levelProgressFor(progress, levelId);
  if (existing === undefined) {
    // Reaching a level the save has no row for means it was just played, so the
    // row is created unlocked. A locked level cannot produce quest progress.
    return { ...progress, levels: [...progress.levels, update(emptyLevelProgress(levelId, true))] };
  }
  return {
    ...progress,
    levels: progress.levels.map((level) => (level.levelId === levelId ? update(level) : level)),
  };
};

/** Record where a quest has got to. One entry per quest; the newest wins. */
export const withQuestState = (
  progress: Progress,
  levelId: LevelId,
  state: QuestState,
): Progress =>
  withLevelProgress(progress, levelId, (level) => ({
    ...level,
    quests: level.quests.some((quest) => quest.questId === state.questId)
      ? level.quests.map((quest) => (quest.questId === state.questId ? state : quest))
      : [...level.quests, state],
  }));

/** Open a level. Idempotent, and it never re-locks one. */
export const withLevelUnlocked = (progress: Progress, levelId: LevelId): Progress =>
  withLevelProgress(progress, levelId, (level) => ({ ...level, unlocked: true }));

/** Open every level in the list, leaving the rest as they are. */
export const withUnlockedLevels = (
  progress: Progress,
  levelIds: readonly LevelId[],
): Progress => levelIds.reduce(withLevelUnlocked, progress);

export const hasStamp = (progress: Progress, levelId: LevelId): boolean =>
  (levelProgressFor(progress, levelId)?.stampEarnedAt ?? null) !== null;

/** Every level whose stamp is in the passport. */
export const stampedLevelIds = (progress: Progress): readonly LevelId[] =>
  progress.levels.filter((level) => level.stampEarnedAt !== null).map((level) => level.levelId);

/**
 * Earn the stamp for a level.
 *
 * Idempotent by design: TN-QUEST-04 asserts the passport holds *exactly one*
 * Ottawa stamp however many times the quest is finished, so a second call keeps
 * the first moment rather than moving it.
 */
export const withStamp = (progress: Progress, levelId: LevelId, now: EpochMillis): Progress =>
  withLevelProgress(progress, levelId, (level) =>
    level.stampEarnedAt === null ? { ...level, stampEarnedAt: now } : level,
  );

/** Record a level's best score, keeping the better of the two. */
export const withBestScore = (progress: Progress, levelId: LevelId, score: number): Progress =>
  withLevelProgress(progress, levelId, (level) => ({
    ...level,
    bestScore: Math.max(level.bestScore, score),
  }));

export const reviewFor = (
  progress: Progress,
  questionId: QuestionId,
): ReviewRecord | undefined =>
  progress.reviews.find((review) => review.questionId === questionId);

/** Fold one question's new review record in, replacing any earlier one. */
export const withReview = (progress: Progress, record: ReviewRecord): Progress => ({
  ...progress,
  reviews: progress.reviews.some((review) => review.questionId === record.questionId)
    ? progress.reviews.map((review) =>
        review.questionId === record.questionId ? record : review,
      )
    : [...progress.reviews, record],
});

/** Note that Study has something to offer for this subject (TN-SAVE item 8). */
export const withSubjectStarted = (progress: Progress, subject: SubjectId): Progress =>
  progress.subjectsStarted.includes(subject)
    ? progress
    : { ...progress, subjectsStarted: [...progress.subjectsStarted, subject] };

export const withExamAttempt = (progress: Progress, attempt: ExamAttempt): Progress => ({
  ...progress,
  exams: [...progress.exams, attempt],
});

/**
 * The player half of progress, re-exported so a caller changing a setting does
 * not have to know that `Progress` is also a `Player`.
 */
export const withSettings = (progress: Progress, patch: Partial<Settings>): Progress =>
  setSettings(progress, patch);

export const withCharacter = (progress: Progress, character: PlayerCharacter): Progress =>
  setCharacter(progress, character);
