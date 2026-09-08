/**
 * The Phaser adapter's public surface. `app/bootstrap` imports from here and
 * from nowhere else inside this directory (ADR-0005).
 */

export { GameRenderer, type GameRendererOptions } from './game-renderer';
export { BootScene, HORIZON_FRACTION } from './boot-scene';
/*
  No palette type is re-exported: the palette is the port's `ThemeColours`
  (`@application/ports`), and re-exporting it from here would put a second name
  on one shape and invite the drift `boot-config.ts` was just taken off.
*/
export {
  DEFAULT_PALETTE,
  blendColors,
  mixColor,
  parseBootConfig,
  toCssColor,
  toPhaserColor,
  type BootConfig,
} from './boot-config';

/*
  Task 1.19: the renderer capability probe and the visual tiers.

  Exported from the barrel because two audiences outside this directory need
  them. `app/bootstrap` reads `GameRenderer.renderProfile` to report the tier
  the player is actually getting, and the unit suites import the pure policy
  modules directly — the seam between measurement and policy is the point, so
  the policy is reachable without constructing a Phaser game.

  `game-renderer.ts` remains the only file here that imports Phaser or touches
  the DOM; everything below runs under `environment: 'node'`.
*/
export {
  classifyRasterizer,
  describeRenderer,
  identifyRenderer,
  readUnmaskedDeviceStrings,
  UNMASKED_RENDERER_WEBGL,
  UNMASKED_VENDOR_WEBGL,
  type DebugInfoContext,
  type Rasterizer,
  type RendererIdentity,
  type RendererKind,
} from './renderer-identity';

export {
  createFrameCostRecorder,
  createFrameTimer,
  percentile,
  summariseFrames,
  DEFAULT_WARMUP_FRAMES,
  DEFAULT_WINDOW_FRAMES,
  MAX_PLAUSIBLE_INTERVAL_MS,
  type FrameCostRecorder,
  type FrameCostSummary,
  type FrameSample,
  type FrameTimer,
} from './frame-cost';

export {
  classifyFormFactor,
  createTierTracker,
  isPromotion,
  minTier,
  particleCeilingFor,
  provisionalTier,
  resolveRenderProfile,
  stepUp,
  thresholdsFor,
  tierCeilingFor,
  tierFromFrameCost,
  DEFAULT_PROMOTE_AFTER_WINDOWS,
  LARGE_PARTICLE_CEILING,
  PHONE_PARTICLE_CEILING,
  PHONE_SHORT_SIDE_CSS_PX,
  TIER_ORDER,
  type FormFactor,
  type MotionLevel,
  type RenderProfile,
  type RenderProfileInput,
  type TierDecision,
  type TierThresholds,
  type TierTracker,
  type VisualTier,
} from './visual-tier';

export {
  applyEffect,
  createEffectRegistry,
  defineEffect,
  selectEffectPath,
  type EffectApply,
  type EffectMotion,
  type EffectPath,
  type EffectRegistry,
  type VisualEffect,
  type VisualEffectDefinition,
} from './visual-effects';

export {
  applyTierMarkers,
  prefersReducedMotion,
  readFormFactor,
  resolveMotionLevel,
  startRenderTierProbe,
  type FrameSignals,
  type MediaQueryLike,
  type RenderTierProbe,
  type RenderTierProbeOptions,
  type TierMarkerTarget,
} from './render-tier-probe';

/*
  The `?e2e=1` scene probe (OQ-TEST-1). Exported so the end-to-end suite can
  import the attribute names and the global's name rather than re-typing them —
  a shared contract restated in a test is a contract that drifts.
*/
export {
  SCENE_PROBE_GLOBAL,
  SCENE_PROBE_PARAM,
  SCENE_PROBE_TEST_ID,
  SNAPSHOT_THROTTLE_MS,
  DEFAULT_TRACE_EVENTS,
  DEFAULT_TRACE_FRAMES,
  createSceneProbe,
  formatProbeNumber,
  isSceneProbeEnabled,
  profileToSnapshot,
  sceneProbeHandle,
  snapshotToAttributes,
  type EventTraceEntry,
  type FrameTraceEntry,
  type ProbeElement,
  type SceneProbe,
  type SceneProbeHandle,
  type SceneSnapshot,
} from './scene-probe';

/*
  Tasks 1.13 and 1.14: the level scene and locomotion.

  `app/bootstrap` reaches for `GameRenderer.loadLevel` and nothing below;
  everything else here is exported because a unit suite imports it directly. The
  pure modules — the document parser, the ground polyline, the camera arithmetic,
  the tier-gated effects and the locomotion strategy — run under
  `environment: 'node'` with no Phaser and no DOM, which is what lets
  TN-LEVEL-03's feel and TN-LEVEL-04's framing be asserted as properties of a
  function rather than sampled through a browser.

  `level-scene.ts` is not exported: it is the only new file that imports Phaser,
  it is constructed by `game-renderer.ts`, and nothing outside this directory has
  any business holding a scene.
*/
export {
  LOCOMOTION_MODES,
  MAX_DECODED_TEXTURE_BYTES,
  parseLevelDocument,
  refuseOverBudget,
  type SceneLevel,
} from './level-document';

export {
  MAX_GRADIENT,
  groundYAt,
  levelBounds,
  slopeAt,
  type LevelBounds,
} from './ground-profile';

export {
  bundledLevelCatalog,
  firstLevelId,
  hasLevel,
  interpretLevelModule,
  levelIds,
  loadLevel,
  type LevelCatalog,
} from './level-catalog';

export {
  followCamera,
  followLerpFor,
  desiredScroll,
  scaledViewport,
  screenFraction,
  scrollBounds,
  type CameraFollowInput,
  type CameraViewport,
} from './level-camera';

export {
  PINNED_SCROLL_FACTOR,
  createLevelEffects,
  particleBudget,
  selectLayers,
  type EmitterTarget,
  type LevelEffects,
  type ScrollTarget,
  type TintTarget,
} from './level-effects';

export {
  GRAVITY_PX_S2,
  MAX_STEP_SECONDS,
  MOVE_DEADZONE,
  applyBounds,
  createLocomotion,
  createLocomotionFactory,
  type MovementBounds,
} from './locomotion';

export {
  PLAYABLE_ATTRIBUTES,
  PLAYABLE_TEST_ID,
  createPlayableMarker,
  type MarkerElement,
  type MarkerHost,
  type PlayableMarker,
} from './playable-marker';

/*
  Task 1.12's other half: the names the level publishes.

  Exported because `app/bootstrap` binds them to the typed event bus, which is
  the only way `app/ui` can hear about a level without importing an adapter
  (ADR-0005). The scene itself stays unexported; what leaves this directory is
  the vocabulary, not the thing that speaks it.
*/
export {
  SCENE_EVENT_NAMES,
  isSceneEventName,
  type SceneEventListener,
  type SceneEventName,
} from './level-events';

/*
  Task 1.12: the sprite-atlas half of `ICharacterRenderer`.

  The Rive half is `app/adapters/rive`, and the two never import each other — the
  composition root picks one. Both answer `skinSlots`/`skinOptions` out of the
  same `CharacterRendererSpec.slots`, so "identical slot names" is structural
  rather than a convention two files have to keep.
*/
export {
  DEFAULT_FPS,
  EXPRESSION_LAYER,
  IDLE_CLIP,
  MAX_CLIP_FRAMES,
  createSpriteCharacterRenderer,
  createSpriteCharacterRendererFactory,
  selectClip,
  spriteFrameName,
  type SpriteCharacterRendererOptions,
  type SpriteFrameSource,
  type SpriteLayerHost,
  type SpriteLayerObject,
} from './sprite-character-renderer';

/*
  What a level loads, and the reason this module exists.

  The deployed Ottawa level drew no art at all: nothing ever queued a texture,
  every parallax band took `level-scene.ts`'s placeholder, and the scene reported
  itself ready. Exported so the selection rules — scale resolved per key, so a
  pinned `@1x` landmark is honoured; an atlas without its frame data refused —
  are unit tested with no browser and no network.
*/
export {
  SUPPORTED_MANIFEST_VERSION,
  atlasKeyOf,
  keysIn,
  parseAssetManifest,
  preferredAssetScale,
  selectLevelAssets,
  type AssetManifest,
  type AssetManifestFile,
  type LoadRequest,
} from './level-assets';
