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
