/**
 * ProgressRepository — where a player's progress is kept, and nothing more.
 *
 * Storage is local only: `localStorage` plus JSON export/import, no accounts, no
 * server, no analytics (CLAUDE.md). This port hides that: the application asks for
 * a snapshot and hands one back. Quota failures, absent storage in private mode and
 * corrupt payloads all arrive as `Result` errors, never as thrown exceptions.
 *
 * Serialisation is *not* this port's job — see `SaveCodec`.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call site: slice 1 task 1.6 (the localStorage adapter). Whoever
 * writes the first implementation may change this interface without an ADR, and
 * removes this marker in the same change.
 */

import type { IsoInstant, LevelId, LocaleCode, QuestId, QuestionId, SubjectId } from '@domain/ids';
import type { Result } from '@common/result';

/*
 * The five types below are *documents*: they are what gets written to
 * localStorage and what a player pastes back in from a save code, so they are
 * authored data in every sense that matters — just authored by the previous
 * session instead of by a content agent. ADR-0007 applies to them: the schema is
 * the authority, and `SaveCodec.decode` cannot honour "validate, migrate and
 * return" against a schema that does not exist. Slice 1 task 1.6 writes
 * `content/schemas/progress.schema.json`; until then every one of them is
 * SPECULATIVE and `decode` has nothing to validate against.
 */

/**
 * FSRS card state for one question. The scheduler itself is pure domain (ADR-0001).
 *
 * SPECULATIVE — no `progress.schema.json` yet (ADR-0007).
 */
export interface ReviewStateDocument {
  readonly questionId: QuestionId;
  readonly due: IsoInstant;
  readonly stability: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly lastReview: IsoInstant | null;
  readonly state: 'new' | 'learning' | 'review' | 'relearning';
}

/** SPECULATIVE — no `progress.schema.json` yet (ADR-0007). */
export interface LevelProgressDocument {
  readonly levelId: LevelId;
  readonly unlocked: boolean;
  readonly completedQuests: readonly QuestId[];
  readonly bestScore: number;
}

/** SPECULATIVE — no `progress.schema.json` yet (ADR-0007). */
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

/**
 * Accessibility and comfort settings. Persisted, because a player should set them once.
 *
 * SPECULATIVE — no `progress.schema.json` yet (ADR-0007).
 */
export interface SettingsDocument {
  readonly locale: LocaleCode;
  readonly autoMove: boolean;
  readonly singleSwitch: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly dyslexiaFont: boolean;
  /** 100–200 %, expressed as a multiplier. */
  readonly textScale: number;
  readonly subtitles: boolean;
  readonly volumes: Readonly<Record<'master' | 'music' | 'sfx' | 'voice', number>>;
}

/**
 * The whole persisted state, versioned so `SaveCodec` can migrate it.
 *
 * SPECULATIVE — no `progress.schema.json` yet (ADR-0007). This is the root of the
 * save document, so it is the shape `SaveCodec.decode` must refuse to trust.
 */
export interface ProgressSnapshot {
  readonly version: number;
  readonly updatedAt: IsoInstant;
  readonly settings: SettingsDocument;
  readonly levels: readonly LevelProgressDocument[];
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
