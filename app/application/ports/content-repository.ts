/**
 * ContentRepository — the only way the application reads authored content.
 *
 * Everything a level needs is data (ADR-0005): levels, quests, questions,
 * characters and locale bundles are JSON validated against `content/schemas`
 * before they cross this seam. Only `game.config.json` has a schema today; see
 * the SPECULATIVE marker on every other document type below. The implementation
 * (fetch + ajv + cache) is an adapter; nothing here knows about HTTP, bundlers
 * or the file system.
 *
 * Contract:
 *  - every read is async and returns `Result` — a missing or invalid document is
 *    an expected failure, not an exception;
 *  - a returned document has already passed schema validation, so callers may
 *    trust its shape but must still trust nothing about game rules;
 *  - `unload` exists because of the 64 MB decoded-texture budget: the previous
 *    level is released before the next one is loaded (CLAUDE.md, Budgets).
 */

import type {
  CharacterId,
  IsoInstant,
  LevelId,
  LocaleCode,
  PoiId,
  QuestId,
  QuestionId,
  SubjectId,
} from '@domain/ids';
import type { Result } from '@common/result';
import type { LocomotionTuning } from './locomotion';

/**
 * The document types below mirror `content/schemas/*.schema.json` exactly: same
 * properties, same optionality, same names. The schema is the authority — it is
 * what `make validate-content` runs in CI and it sets `additionalProperties:
 * false`, so a port that declares a property the schema does not have is a
 * defect, not a convenience.
 *
 * Where the schema does not exist yet the type is marked SPECULATIVE. Nothing
 * validates those shapes today, so they are a sketch, not a contract; each one
 * must be reconciled against its schema when that schema is written (slice 1).
 *
 * Keep every type structural and dumb — behaviour belongs to the domain entities
 * built from them.
 */

/* --------------------------------------------------------------------------
 * game.config.json — schema: content/schemas/game.config.schema.json (exists)
 * ----------------------------------------------------------------------- */

/** Which levels are playable at the start, and how the next one is earned. */
export interface UnlockRules {
  /** Levels playable before any stamp is earned. */
  readonly initialLevels: readonly LevelId[];
  /** Progression order used when a level is unlocked by the previous one. */
  readonly order: readonly LevelId[];
  readonly stampsToUnlockNext: number;
}

/** Mirrors IRCC: 20 questions, 15 to pass, 30 minutes, timer optional. */
export interface ExamRules {
  readonly questionCount: number;
  readonly passMark: number;
  readonly timeLimitSeconds: number;
  readonly timerOptional: boolean;
}

/** Tuning for the FSRS-backed review scheduler, which is pure domain. */
export interface SchedulerTuning {
  /** Number of recent questions that may not repeat. */
  readonly exclusionWindow: number;
  /** Relative draw weight of a previously wrong question. */
  readonly wrongWeight: number;
  /** Maximum unseen questions introduced per day. */
  readonly dailyNewLimit: number;
}

export interface GraphicsPreset {
  /** Backbuffer scale, greater than 0 and at most 1. */
  readonly renderScale: number;
  readonly maxPixelRatio: number;
  readonly particles: number;
  readonly parallaxLayers: number;
  readonly postProcessing: boolean;
}

/** The three tiers a device may be placed in. Picking one is an adapter concern. */
export interface GraphicsPresets {
  readonly low: GraphicsPreset;
  readonly medium: GraphicsPreset;
  readonly high: GraphicsPreset;
}

/** CI gates. Breaching any of these fails the build (CLAUDE.md, Budgets). */
export interface PerformanceBudgets {
  readonly initialPayloadBytes: number;
  readonly levelPayloadBytes: number;
  readonly totalPayloadBytes: number;
  readonly textureMemoryMbPerLevel: number;
  readonly timeToPlayMs: number;
  readonly frameTimeMs: number;
}

export interface FeatureFlags {
  readonly debugOverlay: boolean;
  readonly autoMove: boolean;
  readonly serviceWorker: boolean;
  readonly switchMode: boolean;
}

/**
 * The palette a scene paints itself from, `game.config.schema.json#/$defs/theme`.
 *
 * Optional at the root of the config: the schema does not require `theme`, and a
 * renderer that gets none keeps its built-in default. The same shape is intended
 * to be reusable per level so a level document can override the whole block, so
 * do not fold these five colours into `GameConfigDocument` directly.
 *
 * Colours are sRGB `#rrggbb` (`common.schema.json#/$defs/hexColour`). All five
 * are required when the block is present.
 */
export interface ThemeColours {
  /** Top of the vertical gradient; also the renderer's clear colour. */
  readonly sky: string;
  /** Bottom of the vertical gradient. */
  readonly ground: string;
  /** The horizon rule (ADR-0002). */
  readonly horizon: string;
  /** Primary on-canvas text. */
  readonly ink: string;
  /** Secondary on-canvas text. */
  readonly inkMuted: string;
}

/**
 * `content/game.config.json`, exactly as validated by
 * `content/schemas/game.config.schema.json`.
 *
 * Every property here is `required` in that schema except `theme` (see above),
 * and the schema rejects anything not listed. If this interface and that file
 * disagree, the schema wins and this file is wrong.
 */
export interface GameConfigDocument {
  readonly $schema: string;
  readonly title: string;
  /** Semantic version of the configuration payload, `major.minor.patch`. */
  readonly version: string;
  /** Vite `base` and the Pages sub-path; starts and ends with `/` (ADR-0006). */
  readonly basePath: string;
  readonly defaultLocale: LocaleCode;
  readonly locales: readonly LocaleCode[];
  /** Design resolution — 1080x1920, portrait only (ADR-0002). */
  readonly designWidth: number;
  readonly designHeight: number;
  /** Level ids in authoring order. Empty until slice 1. */
  readonly levels: readonly LevelId[];
  readonly unlockRules: UnlockRules;
  readonly exam: ExamRules;
  readonly scheduler: SchedulerTuning;
  readonly graphicsPresets: GraphicsPresets;
  readonly budgets: PerformanceBudgets;
  readonly featureFlags: FeatureFlags;
  /** Optional in the schema; the renderer falls back to its default palette. */
  readonly theme?: ThemeColours;
}

/* --------------------------------------------------------------------------
 * SPECULATIVE from here down.
 *
 * `content/schemas/` holds three files today: `common.schema.json`,
 * `game.config.schema.json` and `credits.schema.json`. There is no level, quest,
 * question, character or locale schema, and no such content file exists. Every
 * type below was written from the design notes, not from a validator, so the
 * `ContentRepository` guarantee "the document has already passed schema
 * validation" does not hold for any of them yet.
 *
 * Rule for slice 1: write the schema first, then reconcile the type against it
 * property by property and delete the marker. Do not add a property here to make
 * a caller compile — add it to the schema, or the caller is relying on data that
 * will never be validated.
 * ----------------------------------------------------------------------- */

/** SPECULATIVE — no `level.schema.json` yet. */
export interface LevelSummary {
  readonly id: LevelId;
  readonly subject: SubjectId;
  /** Localiser key, never literal copy — content is EN/FR from the first commit. */
  readonly titleKey: string;
  readonly order: number;
}

/** SPECULATIVE — no `level.schema.json` yet. */
export interface LevelDocument extends LevelSummary {
  readonly $schema: string;
  /** Locomotion modes this level offers, in the order the player unlocks them. */
  readonly locomotion: readonly LocomotionTuning[];
  readonly quests: readonly QuestId[];
  readonly pois: readonly PoiId[];
  readonly characters: readonly CharacterId[];
  /** Asset manifest for preload and for the per-level payload budget (≤ 8 MB). */
  readonly assets: readonly LevelAssetRef[];
  /**
   * Author-declared decoded-texture cost in bytes. `make lint`/CI check it against
   * the 64 MB per-level ceiling; the loader checks the sum before it commits.
   */
  readonly textureBudgetBytes: number;
}

/** SPECULATIVE — no `level.schema.json` yet. */
export type LevelAssetKind = 'atlas' | 'rive' | 'audio' | 'font' | 'tilemap' | 'json';

/** SPECULATIVE — no `level.schema.json` yet. */
export interface LevelAssetRef {
  readonly key: string;
  readonly kind: LevelAssetKind;
  readonly url: string;
  readonly bytes: number;
  /** Decoded (not transfer) size for textures; 0 for non-texture assets. */
  readonly decodedBytes: number;
}

/** SPECULATIVE — no `quest.schema.json` yet. */
export interface QuestDocument {
  readonly $schema: string;
  readonly id: QuestId;
  readonly levelId: LevelId;
  readonly titleKey: string;
  readonly steps: readonly QuestStepDocument[];
}

/** SPECULATIVE — no `quest.schema.json` yet. */
export interface QuestStepDocument {
  readonly id: string;
  readonly kind: 'talk' | 'visit' | 'collect' | 'answer';
  readonly targetId: string;
  /** Questions asked by an `answer` step; empty for other kinds. */
  readonly questionIds: readonly QuestionId[];
}

/** SPECULATIVE — no `question.schema.json` yet. */
export interface QuestionDocument {
  readonly $schema: string;
  readonly id: QuestionId;
  readonly subject: SubjectId;
  /** Localised prompt keys; the text itself lives in the locale bundle. */
  readonly promptKey: string;
  /** Exactly four options — one correct, three distractors (CLAUDE.md, Content rules). */
  readonly optionKeys: readonly [string, string, string, string];
  readonly correctIndex: 0 | 1 | 2 | 3;
  readonly explanationKey: string;
  readonly source: QuestionSourceRef;
  readonly verification: QuestionVerification;
}

/** SPECULATIVE — no `question.schema.json` yet. ADR-0003 fixes the intent, not the shape. */
export interface QuestionSourceRef {
  /** Discover Canada chapter reference; every fact is chapter-referenced. */
  readonly chapter: string;
  readonly url: string;
  /** Hash of the source text the question was written against. */
  readonly sourceHash: string;
  readonly asOf: IsoInstant;
  /** Volatile facts are re-verified every run and quarantined after 180 days. */
  readonly volatile: boolean;
}

/**
 * The block ADR-0003's verifier agent writes, and the only block it may write.
 *
 * SPECULATIVE — no `question.schema.json` yet. The field names come from ADR-0003,
 * which is accepted and names all five: an earlier version of this interface
 * declared `status`, `sourceHash` and `verifiedAt` only, dropping `evidence` and
 * `model` and renaming `checkedAt`. `evidence` is not optional detail — ADR-0003's
 * consequence is "the bank is auditable: every shipped question carries the
 * passage that supports it", and a verification without it cannot be audited.
 */
export interface QuestionVerification {
  /** Only `verified` may ship. Set by the verifier agent, never by the author (ADR-0003). */
  readonly status: 'unverified' | 'verified' | 'quarantined' | 'rejected';
  /** The model that granted the status, so a bad verifier run can be identified later. */
  readonly model: string;
  /** When the check ran. `null` while `status` is `unverified`. */
  readonly checkedAt: IsoInstant | null;
  /** The `sourceHash` the status was granted for; a mismatch invalidates it. */
  readonly sourceHash: string;
  /**
   * The passage from the cited section that entails the answer, quoted exactly.
   * Empty only when the status is `unverified`.
   */
  readonly evidence: string;
}

/** SPECULATIVE — no `character.schema.json` yet. */
export interface CharacterDocument {
  readonly $schema: string;
  readonly id: CharacterId;
  readonly nameKey: string;
  /** How this character is drawn — see `ICharacterRenderer`. */
  readonly artboard: string;
  readonly stateMachine: string;
  /** Default skin option per slot; identical slot names in Rive and in the sprite atlas. */
  readonly skins: Readonly<Record<string, string>>;
  /**
   * Nation depicted, when the character is Indigenous. Required by
   * `docs/content-review.md`; the art verifier rejects a missing value.
   */
  readonly nation?: string;
}

/**
 * Flat key -> localised string map for one locale, as loaded by the i18n adapter.
 *
 * SPECULATIVE — no `locale.schema.json` yet. Note this is not the on-disk shape:
 * the bundle file is expected to be the bare key/value object, and the adapter
 * attaches `locale`. That indirection is exactly what a schema would settle.
 */
export interface LocaleBundle {
  readonly locale: LocaleCode;
  readonly strings: Readonly<Record<string, string>>;
}

export interface ContentRepository {
  gameConfig(): Promise<Result<GameConfigDocument>>;
  /** Cheap list for the world map — never loads level payloads. */
  levelIndex(): Promise<Result<readonly LevelSummary[]>>;
  level(id: LevelId): Promise<Result<LevelDocument>>;
  quests(levelId: LevelId): Promise<Result<readonly QuestDocument[]>>;
  /** The whole bank for a subject; the scheduler picks from it in the domain. */
  questions(subject: SubjectId): Promise<Result<readonly QuestionDocument[]>>;
  character(id: CharacterId): Promise<Result<CharacterDocument>>;
  locale(code: LocaleCode): Promise<Result<LocaleBundle>>;
  /**
   * Drop everything cached for a level. Called before the next level loads so the
   * decoded-texture footprint stays inside budget. Safe to call for a level that
   * was never loaded.
   */
  unload(levelId: LevelId): Promise<Result<void>>;
}
