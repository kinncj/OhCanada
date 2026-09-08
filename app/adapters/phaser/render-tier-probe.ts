/**
 * The wiring between the measurement (`frame-cost.ts`) and the policy
 * (`visual-tier.ts`), plus the small amount of browser reading the probe needs.
 *
 * Everything the browser supplies arrives as a parameter — frame-boundary
 * callbacks, a `MediaQueryList`-shaped object, a screen size, an element with a
 * `dataset` — so this file imports neither Phaser nor the DOM and every path
 * through it runs under `environment: 'node'`. `game-renderer.ts` is the only
 * file that knows these things come from `Phaser.Core.Events` and `window`, and
 * it is the only file excluded from the coverage gate. That is the seam the task
 * asks for: the measurement is injected, the policy is pure, and the glue in
 * between is still testable.
 */

import type { GraphicsPresets } from '@application/ports';

import {
  createFrameCostRecorder,
  createFrameTimer,
  type FrameCostRecorder,
  type FrameCostSummary,
} from './frame-cost';
import { describeRenderer, type RendererIdentity } from './renderer-identity';
import {
  classifyFormFactor,
  createTierTracker,
  resolveRenderProfile,
  type FormFactor,
  type MotionLevel,
  type RenderProfile,
  type TierDecision,
} from './visual-tier';

/**
 * The frame boundaries, as a subscription pair.
 *
 * Two signals rather than one rAF callback because the two numbers this probe
 * needs are different (see `frame-cost.ts`): the gap between frame *starts* is
 * cadence, and the span from frame start to frame end is work. A single rAF
 * handler can only ever see the first.
 *
 * Both `on*` methods return an unsubscribe, because the probe outlives no game
 * and must detach cleanly on `destroy()` — a listener left on a destroyed game
 * is how a "one level unloaded, the next runs at half speed" bug starts.
 */
export interface FrameSignals {
  onFrameStart(listener: (nowMs: number) => void): () => void;
  onFrameEnd(listener: (nowMs: number) => void): () => void;
}

/** Just enough of `MediaQueryList` to read a preference without a DOM. */
export interface MediaQueryLike {
  readonly matches: boolean;
}

/** Just enough of an `HTMLElement` to publish the decision onto it. */
export interface TierMarkerTarget {
  readonly dataset: Record<string, string | undefined>;
}

/**
 * `prefers-reduced-motion: reduce`, defaulting to "not asked for" when the
 * browser cannot answer.
 *
 * The default is deliberate and it is the *only* safe one here: `matchMedia`
 * being unavailable means the question was never put to the user, not that they
 * answered yes. Defaulting to reduced would strip motion from every player on a
 * browser without `matchMedia`, which is a worse accessibility outcome than the
 * one it is trying to protect. The setting is also expected to become a
 * player-facing toggle in the settings screen (CLAUDE.md, Accessibility); that
 * toggle overrides this, never the other way round.
 */
export function prefersReducedMotion(query: MediaQueryLike | null | undefined): boolean {
  return query?.matches === true;
}

/**
 * The player's motion preference, as one value.
 *
 * `override` is the settings toggle: when the player has expressed a choice it
 * wins over the media query in both directions, because an explicit answer
 * beats an inferred one.
 */
export function resolveMotionLevel(input: {
  readonly mediaQuery?: MediaQueryLike | null;
  readonly override?: boolean | undefined;
}): MotionLevel {
  if (input.override !== undefined) return input.override ? 'reduced' : 'full';
  return prefersReducedMotion(input.mediaQuery) ? 'reduced' : 'full';
}

/**
 * Read the form factor from what the page can observe: the short side of the
 * viewport in CSS pixels, and whether the primary pointer is coarse.
 *
 * `(pointer: coarse)` rather than a touch-events check: a laptop with a
 * touchscreen reports touch support and is not a phone, but its *primary*
 * pointer is fine.
 */
export function readFormFactor(input: {
  readonly widthCssPx: number;
  readonly heightCssPx: number;
  readonly coarsePointerQuery?: MediaQueryLike | null;
}): FormFactor {
  return classifyFormFactor({
    shortSideCssPx: Math.min(input.widthCssPx, input.heightCssPx),
    coarsePointer: input.coarsePointerQuery?.matches === true,
  });
}

export interface RenderTierProbeOptions {
  readonly identity: RendererIdentity;
  readonly presets: GraphicsPresets;
  /** `budgets.frameTimeMs` from `content/game.config.json`. */
  readonly frameTimeMs: number;
  readonly signals: FrameSignals;
  readonly motion: MotionLevel;
  readonly formFactor: FormFactor;
  /** Called on the provisional profile and again whenever the tier changes. */
  readonly onProfile?: (profile: RenderProfile, decision: TierDecision) => void;
  /** Element the decision is published onto, usually the canvas. */
  readonly marker?: TierMarkerTarget | null;
  readonly recorder?: FrameCostRecorder;
  readonly promoteAfterWindows?: number;
}

export interface RenderTierProbe {
  readonly profile: RenderProfile;
  readonly decision: TierDecision;
  readonly identity: RendererIdentity;
  /** The most recent completed measurement window, or `null` before the first. */
  readonly lastWindow: FrameCostSummary | null;
  /**
   * Throw away the current window and re-arm the warm-up.
   *
   * Called when the game is paused and resumed (the rotate overlay does exactly
   * this). The frames straight after a resume are warm-up frames again — the
   * compositor has to re-acquire the surface — and the tier already decided is
   * kept, so a player who rotated their phone does not come back to a demotion
   * they earned by rotating their phone.
   */
  reset(): void;
  /** Detach from the frame signals. Idempotent. */
  stop(): void;
}

/**
 * Data attributes the probe publishes.
 *
 * They go on the canvas rather than on `<html>` because the canvas belongs to
 * this adapter and `app/bootstrap` owns the document's `data-tn-*` namespace;
 * an adapter reaching for `documentElement` would invert the composition root.
 * `aria-hidden` on the canvas is unaffected — a data attribute is invisible to
 * assistive technology, and this is diagnostic data, not content.
 *
 * They exist so a Playwright run can read what a real browser decided without a
 * console hook. `tests/perf/budgets.spec.ts` will be able to report the tier its
 * frame-time measurement was taken at, which is the difference between "16 ms"
 * and "16 ms, at low, on SwiftShader" — and the perf suite does run Chromium on
 * SwiftShader, so that distinction is live today.
 */
export function applyTierMarkers(
  target: TierMarkerTarget | null | undefined,
  profile: RenderProfile,
  decision: TierDecision,
  identity: RendererIdentity,
): void {
  if (target === null || target === undefined) return;
  const dataset = target.dataset;
  dataset['tnTier'] = profile.tier;
  dataset['tnTierMeasured'] = String(decision.measured);
  dataset['tnMotion'] = profile.motion;
  dataset['tnFormFactor'] = profile.formFactor;
  dataset['tnRenderer'] = identity.kind;
  dataset['tnRasterizer'] = identity.rasterizer;
  dataset['tnFilters'] = String(profile.filters);
  dataset['tnDevice'] = describeRenderer(identity);
}

/**
 * Start measuring, and keep measuring.
 *
 * Returns immediately with the *provisional* profile — something has to be drawn
 * before there is anything to measure — and updates it as windows close. The
 * probe does not stop after the first decision: a device that warms up gets
 * promoted, and one that throttles, loses its GPU process or is backgrounded and
 * resumed gets demoted, without anyone having to reload.
 */
export function startRenderTierProbe(options: RenderTierProbeOptions): RenderTierProbe {
  const tracker = createTierTracker({
    identity: options.identity,
    frameTimeMs: options.frameTimeMs,
    ...(options.promoteAfterWindows === undefined
      ? {}
      : { promoteAfterWindows: options.promoteAfterWindows }),
  });
  const recorder = options.recorder ?? createFrameCostRecorder();
  const timer = createFrameTimer();

  let decision = tracker.decision;
  let profile = buildProfile(decision.tier);
  let lastWindow: FrameCostSummary | null = null;
  let stopped = false;

  function buildProfile(tier: RenderProfile['tier']): RenderProfile {
    return resolveRenderProfile({
      tier,
      motion: options.motion,
      formFactor: options.formFactor,
      presets: options.presets,
      filtersAvailable: options.identity.filtersAvailable,
    });
  }

  function publish(): void {
    applyTierMarkers(options.marker, profile, decision, options.identity);
    options.onProfile?.(profile, decision);
  }

  const offStart = options.signals.onFrameStart((nowMs) => {
    timer.begin(nowMs);
  });

  const offEnd = options.signals.onFrameEnd((nowMs) => {
    const sample = timer.end(nowMs);
    if (sample === null) return;
    const summary = recorder.record(sample);
    if (summary === null) return;

    lastWindow = summary;
    const previousTier = decision.tier;
    decision = tracker.observe(summary);
    /* Republish on every window: `measured` and the reasons change even when the
       tier does not, and a debug overlay that only updates on a tier change
       cannot show that the probe is still running. */
    if (decision.tier !== previousTier) profile = buildProfile(decision.tier);
    publish();
  });

  publish();

  return {
    get profile(): RenderProfile {
      return profile;
    },
    get decision(): TierDecision {
      return decision;
    },
    identity: options.identity,
    get lastWindow(): FrameCostSummary | null {
      return lastWindow;
    },
    reset(): void {
      timer.reset();
      recorder.reset();
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      offStart();
      offEnd();
    },
  };
}
