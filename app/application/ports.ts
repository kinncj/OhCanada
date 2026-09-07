import type { Result } from '@common/result';
import type { Character, CharacterCatalog } from '@domain/character';
import type { District, UnlockRules } from '@domain/district';
import type { ExamParameters } from '@domain/exam';
import type { DistrictId, Locale, QuestId, QuestionId, Subject } from '@domain/ids';
import type { Progress } from '@domain/progress';
import type { Quest } from '@domain/quest';
import type { Question } from '@domain/question';

export type PresetName = 'minimal' | 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsPreset {
  readonly renderScale: number;
  readonly maxPixelRatio: number;
  readonly shadows: boolean;
  readonly postProcessing: boolean;
  readonly screenSpaceGI?: boolean;
  /** lite: characters + terrain textures only (phones); standard: + props, fewer tree kinds; full: everything. */
  readonly assetPolicy?: 'lite' | 'standard' | 'full';
  readonly shadowMapSize: number;
  readonly shadowCascades: number;
  readonly ssao: boolean;
  readonly bloom: boolean;
  readonly antialias: 'none' | 'fxaa' | 'taa' | 'msaa';
  readonly maxInstances: number;
  readonly anisotropy: number;
  readonly volumetricFog: boolean;
}

export interface GameConfig {
  readonly title: string;
  readonly version: string;
  readonly basePath: string;
  readonly defaultLocale: Locale;
  readonly locales: readonly Locale[];
  readonly startDistrict: DistrictId;
  readonly unlockRules: UnlockRules;
  readonly exam: ExamParameters;
  readonly graphicsPresets: Readonly<Record<PresetName, GraphicsPreset>>;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly volatileMaxAgeDays: number;
  readonly districts: readonly DistrictId[];
  readonly benchmark: { readonly durationMs: number; readonly thresholdsFps: { readonly low: number; readonly medium: number; readonly high: number; readonly ultra: number }; readonly mobileDefault: 'minimal' | 'low' | 'medium' };
  readonly budgets: { readonly initialPayloadBytes: number; readonly hubSceneBytes: number; readonly districtSceneBytes: number; readonly timeToInteractiveMs: number };
}

export interface ContentError {
  readonly code: 'not-found' | 'invalid' | 'io';
  readonly message: string;
}

/** Read-only access to validated content. Implemented by adapters/content. */
export interface ContentRepository {
  getConfig(): GameConfig;
  listDistricts(): Promise<Result<readonly Pick<District, 'id' | 'subject' | 'name' | 'description' | 'chapter'>[], ContentError>>;
  getDistrict(id: DistrictId): Promise<Result<District, ContentError>>;
  getQuest(id: QuestId): Promise<Result<Quest, ContentError>>;
  getQuestions(ids: readonly QuestionId[]): Promise<Result<readonly Question[], ContentError>>;
  getQuestionsBySubject(subject: Subject): Promise<Result<readonly Question[], ContentError>>;
  getAllQuestions(): Promise<Result<readonly Question[], ContentError>>;
  getCharacterCatalog(): Promise<Result<CharacterCatalog, ContentError>>;
}

export interface PersistenceError {
  readonly code: 'io' | 'corrupt' | 'schema' | 'version';
  readonly message: string;
}

export interface ProgressRepository {
  load(): Promise<Result<Progress | null, PersistenceError>>;
  save(progress: Progress): Promise<Result<void, PersistenceError>>;
  clear(): Promise<Result<void, PersistenceError>>;
}

/** Serialises/deserialises save files. Import MUST validate against the save schema (STRIDE: tampering). */
export interface SaveCodec {
  encode(progress: Progress): string;
  decode(json: string): Result<Progress, PersistenceError>;
}

export interface Clock {
  now(): number; // ms since epoch
  nowIso(): string;
}

export interface CharacterValidatorPort {
  validate(character: Character, catalog: CharacterCatalog): readonly string[];
}
