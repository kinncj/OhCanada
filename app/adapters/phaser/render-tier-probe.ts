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
import type { RendererIdentity } from './renderer-identity';
import {
  classifyFormFactor,
  createTierTracker,
  resolveRenderProfile,
  type FormFactor,
  type MotionLevel,
  type RenderProfile,
  type TierDecision,
  type VisualTier,
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
 *
 * **Not what the renderer uses.** A setting that is off must not hand motion
 * back to a player whose system asked for stillness, so `GameRenderer` resolves
 * the axis with {@link motionLevelFor}. Kept for its callers outside the
 * renderer and for its tests; do not wire it to the settings toggle.
 */
export function resolveMotionLevel(input: {
  readonly mediaQuery?: MediaQueryLike | null;
  readonly override?: boolean | undefined;
}): MotionLevel {
  if (input.override !== undefined) return input.override ? 'reduced' : 'full';
  return prefersReducedMotion(input.mediaQuery) ? 'reduced' : 'full';
}

/**
 * The motion the renderer draws with: the in-game "Less movement" setting **or**
 * the operating system's preference, and either one is enough.
 *
 * The same rule `app/ui/settings.ts` applies to the page (`resolveMotion`), and
 * deliberately not {@link resolveMotionLevel}'s override, which lets a setting
 * that is off hand motion back to a player whose system asked for stillness.
 * Nothing in this game turns stillness off once something has asked for it
 * (`TN-CREATOR-07`: "the in-game setting has the same effect as the browser
 * setting").
 *
 * This is the function whose absence was the defect: the renderer read the
 * media query alone, so a player who turned "Less movement" on in Settings kept
 * 400 snowflakes and eased parallax, before and after a reload.
 */
export function motionLevelFor(input: {
  readonly setting: boolean;
  readonly mediaQuery?: MediaQueryLike | null;
}): MotionLevel {
  return input.setting || prefersReducedMotion(input.mediaQuery) ? 'reduced' : 'full';
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
  /**
   * Elements the decision is published onto.
   *
   * More than one, because it has to be readable in two places for two reasons.
   * The canvas is where the classification belongs semantically — it describes
   * how *that* surface is being drawn — and it is what this suite's e2e tests
   * read. `<html>` is where a person filing a bug report will find it, beside
   * `data-tn-boot`, `data-tn-level` and `data-tn-paused`; ADR-0011 kept these
   * attributes on the grounds that "a player reporting 'it's slow' with the tier
   * already in the DOM turns an unreproducible complaint into a triaged one",
   * and that only works if looking at `<html>` — the first thing anyone looks at
   * — answers the question. It was on the canvas alone, and three people on
   * three devices read `data-tn-tier` as absent.
   */
  readonly marker?: TierMarkerTarget | readonly TierMarkerTarget[] | null;
  readonly recorder?: FrameCostRecorder;
  readonly promoteAfterWindows?: number;
  /**
   * A tier to hold instead of measuring one, or `null` to measure.
   *
   * **Test instrumentation only.** `game-renderer.ts` passes a value only when
   * the scene probe is installed (`?e2e=1`) and the page also asked for a tier
   * (`tierOverrideFrom` in `scene-probe.ts`); on every other load this is
   * `null`. It exists so the perf suite can count the work of every tier on a
   * runner whose measured tier is never `high`.
   *
   * A pinned tier ignores the device ceiling, because measuring `high` on a
   * software rasteriser is the point. It does not ignore reduced motion: the
   * profile is still built by `resolveRenderProfile`. And it is published as
   * *not measured*, so nothing can mistake it for a device's verdict.
   */
  readonly pinnedTier?: VisualTier | null;
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
  /**
   * The player changed the motion axis: rebuild the profile at the tier in
   * force and publish it at once.
   *
   * No measurement is involved and none is thrown away — motion is a separate
   * axis from the tier (ADR-0011), so the tier stays exactly where it was and a
   * later window re-derives its profile under the motion set here. A value equal
   * to the current one does nothing, and a stopped probe publishes nothing: its
   * game has gone and a listener on it would touch a destroyed level.
   */
  setMotion(motion: MotionLevel): void;
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
 * console hook. `tests/perf/frame-time.device.ts` reports the tier its
 * frame-time measurement was taken at, which is the difference between "16 ms"
 * and "16 ms, at high, on this GPU"; `tests/perf/budgets.spec.ts` attributes
 * each overdraw frame to the tier in effect on a runner that rasterises on
 * SwiftShader, so that distinction is live on every run.
 */
export function applyTierMarkers(
  target: TierMarkerTarget | readonly TierMarkerTarget[] | null | undefined,
  profile: RenderProfile,
  decision: TierDecision,
  identity: RendererIdentity,
): void {
  if (target === null || target === undefined) return;
  for (const one of Array.isArray(target) ? (target as readonly TierMarkerTarget[]) : [target as TierMarkerTarget]) {
    const dataset = one.dataset;
    dataset['tnTier'] = profile.tier;
    dataset['tnTierMeasured'] = String(decision.measured);
    dataset['tnMotion'] = profile.motion;
    dataset['tnFormFactor'] = profile.formFactor;
    dataset['tnRenderer'] = identity.kind;
    dataset['tnRasterizer'] = identity.rasterizer;
    dataset['tnFilters'] = String(profile.filters);
    /*
     * Classifications only. ADR-0011 is explicit: "`UNMASKED_RENDERER_WEBGL` is
     * read, reduced to one of three words, and discarded — it is never written
     * to the DOM. Publishing the raw string would add a fingerprinting surface
     * to a site that collects nothing." This attribute used to carry
     * `describeRenderer(identity)`, which interpolates that exact string, so the
     * deployed page published the GPU model of every visitor. The raw string is
     * still in `identity.note` for the console, where a person reads it and a
     * script does not.
     */
    dataset['tnDevice'] = `${identity.kind}/${identity.rasterizer}/${profile.formFactor}`;
  }
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
  const pinned = options.pinnedTier ?? null;

  let decision: TierDecision =
    pinned === null
      ? tracker.decision
      : {
          tier: pinned,
          measured: false,
          windows: 0,
          reasons: [
            `pinned at "${pinned}" by the scene probe's tier override (?e2e=1&tier=): no ` +
              'measurement moves it and the device ceiling does not apply. Test instrumentation, ' +
              'never a player.',
          ],
        };
  /* Mutable, because the player can change it while the level runs. */
  let motion: MotionLevel = options.motion;
  let profile = buildProfile(decision.tier);
  let lastWindow: FrameCostSummary | null = null;
  let stopped = false;

  function buildProfile(tier: RenderProfile['tier']): RenderProfile {
    return resolveRenderProfile({
      tier,
      motion,
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
    /* Still measured, so `lastWindow` shows what the pinned tier costs; never
       decided from. */
    if (pinned !== null) return;
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
    setMotion(next): void {
      if (next === motion) return;
      motion = next;
      profile = buildProfile(decision.tier);
      if (stopped) return;
      publish();
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      offStart();
      offEnd();
    },
  };
}
