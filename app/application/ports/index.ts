/**
 * The application's ports: every seam between a use case and the outside world.
 *
 * Interfaces and types only — no implementation reaches this directory. Adapters
 * under `app/adapters/*` implement these; `app/bootstrap` is the only place that
 * knows which implementation is chosen (ADR-0005).
 */

export type {
  CameraTuning,
  CharacterDocument,
  CharacterInput,
  ContentRepository,
  CharacterSkinOption,
  CharacterSlot,
  CommunityReview,
  DialogueLine,
  ExamRules,
  FactClaim,
  FactSource,
  FactVerification,
  FeatureFlags,
  GameConfigDocument,
  GraphicsPreset,
  GraphicsPresets,
  LevelAssetKind,
  LevelAssetRef,
  LevelCharacter,
  LevelDocument,
  LevelSummary,
  LocaleBundle,
  NationSource,
  LocalizedText,
  ParallaxLayer,
  PerformanceBudgets,
  PointOfInterest,
  QuestDocument,
  QuestStepDocument,
  QuestionDocument,
  SaveRules,
  SchedulerTuning,
  StudyRules,
  TerritoryStatement,
  ThemeColours,
  UnlockRules,
  Vec2,
} from './content-repository';

export type {
  ExamAttemptDocument,
  LevelProgressDocument,
  PlayerCharacterDocument,
  ProgressRepository,
  ProgressSnapshot,
  QuestProgressDocument,
  ReviewStateDocument,
  SettingsDocument,
  VolumeSettings,
} from './progress-repository';

export type { SaveCodec } from './save-codec';

export type { Clock } from './clock';
export type { RandomSource, SeededRandomSource } from './random-source';

export type {
  ArtboardName,
  CharacterRendererFactory,
  CharacterRendererSpec,
  ExpressionName,
  ICharacterRenderer,
  InputName,
  SkinOptionName,
  SkinSlotName,
  StateMachineName,
  SurfaceHandle,
} from './character-renderer';

export type {
  InteractionAffordance,
  JumpAffordance,
  Locomotion,
  LocomotionAnimationBinding,
  LocomotionEvent,
  LocomotionFactory,
  LocomotionIntent,
  LocomotionMode,
  LocomotionState,
  LocomotionStep,
  LocomotionTuning,
  MovementDrive,
} from './locomotion';

export type { AudioBus, AudioCue, AudioPort, CueId, PlaybackHandle } from './audio';
export type { LocalizerPort, TranslationParams } from './localizer';
export type {
  GameAction,
  InputDevice,
  InputPort,
  InputProfile,
  InputFrame,
  KeyBindings,
  PadBindings,
} from './input';
