/**
 * ProgressRepository — where a player's progress is kept, and nothing more.
 *
 * Storage is local only: IndexedDB, with `localStorage` as the fallback where
 * IndexedDB is unavailable, plus JSON export/import — no accounts, no server, no
 * analytics (CLAUDE.md, ADR-0026). This port hides all of that: the application
 * asks for a snapshot and hands one back, and it did not change when the store
 * underneath it did, which is the seam doing its job. Quota failures, absent
 * storage in private mode and corrupt payloads all arrive as `Result` errors,
 * never as thrown exceptions.
 *
 * Serialisation is *not* this port's job — see `SaveCodec`.
 *
 * Consumed since slice 1 task 1.6 by `app/application/persistence/`, so the
 * ADR-0008 marker is gone: this shape has been compiled against a real caller.
 * It is still young, and changing it is a two-file edit in a fixed order —
 * `content/schemas/progress.schema.json` first, this file second (ADR-0007) —
 * because the schema is what `SaveCodec.decode` validates against and what a
 * save written by an older build is held to.
 */

import type {
  CharacterId,
  IsoInstant,
  LevelId,
  LocaleCode,
  QuestId,
  QuestionId,
  SubjectId,
} from '@domain/ids';
import type { Result } from '@common/result';

/*
 * The five types below are *documents*: they are what gets written to
 * the browser's store and what a player pastes back in from a save code, so they are
 * authored data in every sense that matters — just authored by the previous
 * session instead of by a content agent. ADR-0007 applies to them, and
 * `content/schemas/progress.schema.json` is now the authority on their shape, so
 * `SaveCodec.decode` has something real to validate against.
 */

/**
 * The persisted half of one question's review record. The model itself is pure
 * domain (ADR-0001, ADR-0012).
 *
 * Timestamps here are `IsoInstant`; the domain's `ReviewRecord` holds the same
 * moments as `EpochMillis`. That is deliberate and the conversion belongs to
 * `SaveCodec` (ADR-0012): the domain does arithmetic — "is this due", "how many
 * whole days since" — and epoch milliseconds are the type for arithmetic, while
 * a save file is exported, pasted between devices and read by a person, and
 * needs a value that is sortable, unambiguous about its timezone and legible.
 */
export interface ReviewStateDocument {
  readonly questionId: QuestionId;
  readonly due: IsoInstant;
  readonly stability: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly lastReview: IsoInstant | null;
  /**
   * When the question was first answered; `null` while it never has been.
   * `dailyNewLimit` means "introduced today", and `reps === 1` stops marking that
   * the moment a question is answered twice — which measured as 26 of 30
   * questions introduced against a limit of 10.
   */
  readonly firstReviewedAt: IsoInstant | null;
  /**
   * Which short-term step the question is on while learning or relearning; 0
   * otherwise. The next gap is read from this index, so a snapshot without it
   * silently restarts the sequence after a reload.
   */
  readonly learningSteps: number;
  /**
   * Named `phase`, not `state`: "card state" is on TN-CARD-02's banned-vocabulary
   * list, and a field the UI can read is a field the UI can leak.
   */
  readonly phase: 'new' | 'learning' | 'review' | 'relearning';
}

/**
 * Where the player is in one quest.
 *
 * `offered` and `declined` are distinct from absent: a quest never met is not in
 * the list at all, and TN-SAVE asserts that a declined quest comes back declined
 * rather than as never offered.
 */
export interface QuestProgressDocument {
  readonly questId: QuestId;
  readonly status: 'offered' | 'declined' | 'active' | 'completed';
  /** Index into the quest document's steps; a completed quest keeps its last. */
  readonly stepIndex: number;
  /**
   * How many of the current step's required items are done — questions answered
   * on an `answer` step, 0 on every other kind. This is what lets "accepted, on
   * step 2, two of three answered" survive a closed tab.
   */
  readonly stepProgress: number;
  readonly updatedAt: IsoInstant;
}

/** What the character creator produced. There is no player-entered name — slot choices only. */
export interface PlayerCharacterDocument {
  readonly characterId: CharacterId;
  /** Slot name to chosen option id, one entry per selectable slot. */
  readonly skins: Readonly<Record<string, string>>;
}

export interface LevelProgressDocument {
  readonly levelId: LevelId;
  readonly unlocked: boolean;
  /**
   * One entry per quest the player has met, in any state. Not a completed-only
   * list: a quest recorded only once it is finished cannot be resumed, which is
   * the whole point of TN-SAVE item 5. Completion is `status: 'completed'`, so no
   * second list says the same thing.
   */
  readonly quests: readonly QuestProgressDocument[];
  readonly bestScore: number;
  /**
   * When this level's stamp was earned; `null` while it has not been.
   * `unlockRules.stampsToUnlockNext` counts these, so a stamp is *recorded* rather
   * than derived from a rule that could change under an existing save.
   */
  readonly stampEarnedAt: IsoInstant | null;
}

export interface ExamAttemptDocument {
  readonly startedAt: IsoInstant;
  readonly finishedAt: IsoInstant | null;
  /** IRCC mirror: 20 questions, 15 to pass, 30 minutes (CLAUDE.md). */
  readonly askedQuestionIds: readonly QuestionId[];
  readonly correctCount: number;
  readonly passed: boolean;
  /** The timer is optional even in Exam mode; record whether it was on. */
  readonly timed: boolean;
}

/** One 0–1 level per audio bus. Fixed keys: the buses are code, not content. */
export interface VolumeSettings {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly voice: number;
}

/** Accessibility and comfort settings. Persisted, because a player should set them once. */
export interface SettingsDocument {
  readonly locale: LocaleCode;
  readonly autoMove: boolean;
  readonly singleSwitch: boolean;
  /**
   * TN-SET-09's single-switch hold time, in milliseconds.
   *
   * Added in save version 2. It was the one setting the game asked a switch user
   * to re-enter every session, which is the least acceptable one to lose, and a
   * new *required* property is a format change however small it looks: an older
   * document without it is invalid under `additionalProperties: false`, so it
   * arrives through `SaveMigration` 1 -> 2 rather than by widening the schema.
   */
  readonly holdToChooseMs: number;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly dyslexiaFont: boolean;
  /** 100–200 %, expressed as a multiplier. */
  readonly textScale: number;
  readonly subtitles: boolean;
  readonly volumes: VolumeSettings;
}

/**
 * The whole persisted state, versioned so `SaveCodec` can migrate it, and exactly
 * what `content/schemas/progress.schema.json` validates.
 *
 * `$schema` is carried in the persisted document too, not only in authored
 * content: an exported save that names its schema can be validated by the same
 * tooling, and read by a person, without guessing which build wrote it.
 */
export interface ProgressSnapshot {
  readonly $schema: string;
  readonly version: number;
  readonly updatedAt: IsoInstant;
  readonly settings: SettingsDocument;
  /** `null` before the creator has run; settings persist from the first screen. */
  readonly character: PlayerCharacterDocument | null;
  readonly levels: readonly LevelProgressDocument[];
  /**
   * The level the player was last in, so the title screen can offer **Continue**.
   * `null` before any level has been entered.
   *
   * The level, not the screen. `TN-SAVE`'s survives table takes "the level last
   * played"; "which screen the player was on" is explicitly in the *does not*
   * survive table, and the distinction is the reason this field is a `LevelId`
   * and not a route: restoring a player into a modal, a summary or a question
   * card they have no context for is worse than putting them back on the map.
   *
   * Nothing fails closed without it — "Choose a level" still reaches every
   * unlocked level — so this is a convenience the save carries, not a
   * dependency (OQ-FLOW-4 / OQ-SAVE-7).
   */
  readonly lastPlayedLevelId: LevelId | null;
  readonly reviews: readonly ReviewStateDocument[];
  readonly subjectsStarted: readonly SubjectId[];
  readonly exams: readonly ExamAttemptDocument[];
}

export interface ProgressRepository {
  /** `ok(null)` means "no save yet", which is different from "storage failed". */
  load(): Promise<Result<ProgressSnapshot | null>>;
  save(snapshot: ProgressSnapshot): Promise<Result<void>>;
  /** Wipe local progress. The settings screen offers this; it is irreversible. */
  clear(): Promise<Result<void>>;
}
