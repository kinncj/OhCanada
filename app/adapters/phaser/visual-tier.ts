/**
 * The policy half of the renderer probe: which visual tier, given what we
 * measured and what the device admitted to being.
 *
 * Pure. It takes a `RendererIdentity` (a fact plus a hint), a `FrameCostSummary`
 * (a measurement) and the player's motion preference, and returns a tier and a
 * `RenderProfile`. No Phaser, no DOM, no clock — so every rule below is unit
 * testable, and the seam between "how the numbers were obtained" and "what they
 * mean" stays visible.
 *
 * ## Degrade the tier, never the renderer
 *
 * Nothing here can choose a renderer. `Phaser.AUTO` already fell back to Canvas
 * if WebGL was unavailable, and forcing Canvas on a slow-but-working WebGL
 * device would make things worse, not better. What degrades is the *content of
 * the frame*: fewer parallax layers, fewer particles, no Filters, no
 * squash-and-stretch. The three tiers are `content/game.config.json`'s
 * `graphicsPresets`, not numbers invented here, so re-tuning them is a content
 * edit — and they already carry CLAUDE.md's budget: 400 particles at medium
 * (the phone ceiling), 1500 at high (the iPad/desktop ceiling), post-processing
 * at high only.
 *
 * ## Reduced motion is a different axis, and it is never overridden
 *
 * CLAUDE.md requires reduced motion to disable parallax easing, particles and
 * squash-and-stretch. That is not the low tier: a player on a fast machine who
 * asks for reduced motion should still get six crisp parallax layers, they
 * should just not *move* independently. So `motion` is carried alongside the
 * tier and applied on top of the preset, and no amount of good frame cost can
 * turn it back on. `resolveRenderProfile` is the only place the two meet, and
 * the tier tracker below has no access to the motion preference at all — which
 * is the structural reason a good measurement cannot silently upgrade a player
 * who asked for stillness.
 */

import type { GraphicsPreset, GraphicsPresets } from '@application/ports';

import type { FrameCostSummary } from './frame-cost';
import type { RendererIdentity } from './renderer-identity';

/** The three presets `content/game.config.json` declares. Same names, same order. */
export type VisualTier = 'low' | 'medium' | 'high';

/** Lowest first. Used for clamping and for "is this a promotion". */
export const TIER_ORDER: readonly VisualTier[] = ['low', 'medium', 'high'];

export type MotionLevel = 'full' | 'reduced';

/** Which particle ceiling applies, per CLAUDE.md's Budgets. */
export type FormFactor = 'phone' | 'large';

/** CLAUDE.md: "Particles <= 400 phone, <= 1500 iPad/desktop." */
export const PHONE_PARTICLE_CEILING = 400;
export const LARGE_PARTICLE_CEILING = 1500;

const rank = (tier: VisualTier): number => TIER_ORDER.indexOf(tier);

/** The lower of two tiers. */
export const minTier = (a: VisualTier, b: VisualTier): VisualTier => (rank(a) <= rank(b) ? a : b);

/** True when `candidate` sits above `current` in `TIER_ORDER`. */
export const isPromotion = (current: VisualTier, candidate: VisualTier): boolean =>
  rank(candidate) > rank(current);

/** One step up, or the same tier at the top. */
export const stepUp = (tier: VisualTier): VisualTier =>
  TIER_ORDER[Math.min(TIER_ORDER.length - 1, rank(tier) + 1)] ?? tier;

/**
 * Where the tier boundaries sit, derived from the one budget CLAUDE.md states:
 * frame time <= 16.7 ms at the *medium* preset.
 *
 * Everything else is a ratio of that number rather than a second constant, so
 * changing the budget in `content/game.config.json` moves all five thresholds
 * together and no tier can drift away from the budget it was written against.
 *
 *   - `highCostP50Ms` — half the budget. High turns on post-processing, 1500
 *     particles and six parallax layers; a device only gets it if the engine is
 *     currently using less than half a frame, because everything high adds has
 *     to fit in the half that is left.
 *   - `highCostP95Ms` — the whole budget. A device whose *typical* frame is
 *     cheap but whose bad frames already fill the budget has no headroom to give
 *     away, and the player sees the bad frames.
 *   - `highIntervalP50Ms` — the budget plus 15%. Proof the browser is actually
 *     delivering a 60 Hz cadence and not merely computing cheap frames slowly.
 *   - `mediumCostP50Ms` — the budget itself. This is CLAUDE.md's sentence.
 *   - `mediumIntervalP50Ms` — 2.2x the budget, i.e. ~36.7 ms. CLAUDE.md's floor
 *     for a 2021 Android mid-range is 30 fps (33.3 ms); the extra 10% is slack
 *     for a 30 Hz-capped or 40 Hz-adaptive display, which is a cadence choice by
 *     the compositor rather than a failure by the device.
 */
export interface TierThresholds {
  readonly highCostP50Ms: number;
  readonly highCostP95Ms: number;
  readonly highIntervalP50Ms: number;
  readonly mediumCostP50Ms: number;
  readonly mediumIntervalP50Ms: number;
}

export function thresholdsFor(frameTimeMs: number): TierThresholds {
  const budget = Number.isFinite(frameTimeMs) && frameTimeMs > 0 ? frameTimeMs : 16.7;
  return {
    highCostP50Ms: budget * 0.5,
    highCostP95Ms: budget,
    highIntervalP50Ms: budget * 1.15,
    mediumCostP50Ms: budget,
    mediumIntervalP50Ms: budget * 2.2,
  };
}

/**
 * Never render below a quarter of the design resolution.
 *
 * A floor rather than trust: `renderScale` and `maxPixelRatio` are content
 * (`content/game.config.json`), a measurement feeds the tier that picks them,
 * and the product of a bad edit and an unlucky display could otherwise ask for a
 * canvas a few pixels wide. 0.25 of 1080x1920 is 270x480, which is ugly and is
 * still a game.
 */
export const MIN_BACKING_SCALE = 0.25;

export interface BackingScaleInput {
  /** `preset.renderScale` — the tier's own multiplier. */
  readonly renderScale: number;
  /** `preset.maxPixelRatio` — canvas pixels per CSS pixel, at most. */
  readonly maxPixelRatio: number;
  /** The design resolution's width, 1080. */
  readonly designWidth: number;
  /** What the canvas is *displayed* at, in CSS pixels, after `Scale.FIT`. */
  readonly displayWidthCss: number;
}

/**
 * How many canvas pixels to draw, as a fraction of the design resolution.
 *
 * ### Why this exists
 *
 * `graphicsPresets` declares `renderScale` and `maxPixelRatio` at every tier and
 * **nothing applied either of them**. The tier degraded particle count and
 * parallax layer count and never the one quantity that dominates on a software
 * rasteriser: the number of fragments. ADR-0011 says "what degrades is the
 * visual tier" and names render scale and pixel ratio as part of it; until now
 * that was two numbers a human read.
 *
 * ### The two limits, and why `maxPixelRatio` is the sharper one
 *
 * `Scale.FIT` keeps the canvas *backing store* at the design resolution and
 * stretches it with CSS, so a 1080-wide canvas shown 390 CSS pixels wide is
 * already drawing 2.77 canvas pixels for every CSS pixel — a pixel ratio nobody
 * asked for and the device may not be able to afford. `maxPixelRatio` is the cap
 * on exactly that number, so it is expressed here as the factor that brings the
 * *natural* ratio down to it. `renderScale` is the tier's flat multiplier on top.
 * The smaller wins, because both are ceilings.
 *
 * Never above 1: a preset may ask for fewer pixels than the design resolution,
 * never for more. Supersampling is not a thing this project has decided to do,
 * and a `renderScale` above 1 in a content file should not silently become one.
 */
export function backingScaleFor(input: BackingScaleInput): number {
  const requested = finiteOr(input.renderScale, 1);
  const design = finiteOr(input.designWidth, 0);
  const display = finiteOr(input.displayWidthCss, 0);
  const ratioCap = finiteOr(input.maxPixelRatio, 0);

  /* No display to measure against (a headless boot, a canvas not yet laid out):
     the pixel-ratio cap has nothing to bite on, so only the flat scale applies.
     Guessing a display size here would guess the cap. */
  const natural = design > 0 && display > 0 ? design / display : 0;
  const byRatio = natural > 0 && ratioCap > 0 ? ratioCap / natural : Number.POSITIVE_INFINITY;

  return clamp(Math.min(requested, byRatio), MIN_BACKING_SCALE, 1);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * The highest tier this renderer may ever reach, whatever it measures.
 *
 * This is the only place the device's self-description constrains the outcome,
 * and it constrains a *ceiling*, never the tier itself — the tier is still
 * chosen by measurement underneath it.
 *
 *   - Canvas caps at low. Phaser 4's Canvas renderer has no Filter pipeline, so
 *     `postProcessing: true` would be a silent no-op rather than an effect, and
 *     every sprite goes through 2D context calls that do not batch.
 *   - A *named* software rasteriser caps at medium. It may well measure cheaply
 *     against an almost empty scene, but high switches on post-processing and
 *     1500 particles, and there is no CPU rasteriser that sustains those at
 *     1080x1920. Naming the device is allowed to remove an option; it is not
 *     allowed to choose one.
 *   - `'unknown'` does *not* cap. A browser hiding `WEBGL_debug_renderer_info`
 *     is a privacy setting, not a slow GPU, and refusing high to every
 *     Firefox-with-resistFingerprinting user would be treating "unknown" as
 *     "bad" — the mirror of the mistake this task exists to fix. Caution for
 *     the unknown device lives in `provisionalTier` and in the promotion
 *     hysteresis instead: it starts lower and has to earn its way up.
 */
export function tierCeilingFor(identity: RendererIdentity): VisualTier {
  if (identity.kind !== 'webgl') return 'low';
  return identity.rasterizer === 'software' ? 'medium' : 'high';
}

/**
 * The tier to draw with before a single frame has been measured.
 *
 * Something has to be rendered before there is anything to measure, so this is
 * unavoidably a guess — but it is a guess with a short life: the first window
 * closes ~40 frames in and replaces it. Hardware and unknown WebGL start at
 * medium, which is the preset CLAUDE.md's frame-time budget is written against;
 * everything else starts at low, because starting too high shows a player a
 * stutter and starting too low shows them half a second of slightly plainer
 * scenery.
 */
export function provisionalTier(identity: RendererIdentity): VisualTier {
  if (identity.kind !== 'webgl') return 'low';
  return identity.rasterizer === 'software' ? 'low' : 'medium';
}

/** The tier a single measurement window argues for, before any ceiling or hysteresis. */
export function tierFromFrameCost(
  summary: FrameCostSummary,
  thresholds: TierThresholds,
): VisualTier {
  if (
    summary.costP50 <= thresholds.highCostP50Ms &&
    summary.costP95 <= thresholds.highCostP95Ms &&
    summary.intervalP50 <= thresholds.highIntervalP50Ms
  ) {
    return 'high';
  }
  if (
    summary.costP50 <= thresholds.mediumCostP50Ms &&
    summary.intervalP50 <= thresholds.mediumIntervalP50Ms
  ) {
    return 'medium';
  }
  return 'low';
}

export interface TierDecision {
  readonly tier: VisualTier;
  /** False while the tier is still the provisional guess. Read by tests and the overlay. */
  readonly measured: boolean;
  /** How many measurement windows have contributed. */
  readonly windows: number;
  /** Plain-English trail, in order, for the debug overlay and bug reports. */
  readonly reasons: readonly string[];
}

/**
 * Windows of agreement required before a tier goes *up*.
 *
 * Asymmetric on purpose. A demotion is a response to something the player is
 * already seeing, so it happens on the first bad window. A promotion is a bet
 * that the good window will repeat, and getting it wrong costs a visible pop
 * followed by a stutter followed by a demotion — so it takes two consecutive
 * windows and moves one step at a time. This is also what keeps a device that
 * simply finished warming up from oscillating across a threshold.
 */
export const DEFAULT_PROMOTE_AFTER_WINDOWS = 2;

export interface TierTrackerOptions {
  readonly identity: RendererIdentity;
  /** `budgets.frameTimeMs` from `content/game.config.json`. */
  readonly frameTimeMs: number;
  readonly promoteAfterWindows?: number;
}

export interface TierTracker {
  readonly decision: TierDecision;
  readonly ceiling: VisualTier;
  readonly thresholds: TierThresholds;
  /** Feed one completed measurement window. Returns the decision after it. */
  observe(summary: FrameCostSummary): TierDecision;
}

/**
 * The re-evaluation state machine: provisional tier, then one decision per
 * measurement window, demoting at once and promoting only on agreement.
 */
export function createTierTracker(options: TierTrackerOptions): TierTracker {
  const ceiling = tierCeilingFor(options.identity);
  const thresholds = thresholdsFor(options.frameTimeMs);
  const promoteAfter = Math.max(
    1,
    Math.floor(options.promoteAfterWindows ?? DEFAULT_PROMOTE_AFTER_WINDOWS),
  );

  let tier = minTier(provisionalTier(options.identity), ceiling);
  let windows = 0;
  let agreeingPromotions = 0;
  let decision: TierDecision = {
    tier,
    measured: false,
    windows: 0,
    reasons: [
      `${identityReason(options.identity)}; starting at "${tier}" until frames are measured.`,
    ],
  };

  return {
    get decision(): TierDecision {
      return decision;
    },
    ceiling,
    thresholds,

    observe(summary: FrameCostSummary): TierDecision {
      windows += 1;
      const measuredTier = tierFromFrameCost(summary, thresholds);
      const candidate = minTier(measuredTier, ceiling);
      const reasons: string[] = [
        `window ${windows}: cost p50 ${summary.costP50.toFixed(2)} ms, ` +
          `p95 ${summary.costP95.toFixed(2)} ms, interval p50 ${summary.intervalP50.toFixed(2)} ms ` +
          `over ${summary.samples} frames`,
      ];

      if (candidate === tier) {
        agreeingPromotions = 0;
        reasons.push(`holding "${tier}".`);
      } else if (isPromotion(tier, candidate)) {
        agreeingPromotions += 1;
        if (agreeingPromotions >= promoteAfter) {
          tier = stepUp(tier);
          agreeingPromotions = 0;
          reasons.push(`promoted to "${tier}" after ${promoteAfter} agreeing windows.`);
        } else {
          reasons.push(
            `"${candidate}" is available but held at "${tier}": ` +
              `${agreeingPromotions}/${promoteAfter} agreeing windows.`,
          );
        }
      } else {
        agreeingPromotions = 0;
        tier = candidate;
        reasons.push(`demoted to "${tier}" on the first window that asked for it.`);
      }

      if (candidate !== measuredTier) {
        reasons.push(`capped at "${ceiling}": ${options.identity.note}`);
      }

      decision = { tier, measured: true, windows, reasons };
      return decision;
    },
  };
}

function identityReason(identity: RendererIdentity): string {
  return `${identity.kind} renderer, rasteriser ${identity.rasterizer} (${identity.note})`;
}

/**
 * Which particle ceiling a device is held to, from what the page can actually
 * observe. Never the user-agent string: it lies, and it is the wrong question.
 *
 * A phone is a coarse pointer on a screen whose short side is under 600 CSS px.
 * That puts every iPhone (430 px at the widest) on the 400-particle budget and
 * every iPad (744 px at the narrowest) on the 1500 one, which is the split
 * CLAUDE.md names, without asking the browser to identify itself.
 */
export const PHONE_SHORT_SIDE_CSS_PX = 600;

export function classifyFormFactor(input: {
  readonly shortSideCssPx: number;
  readonly coarsePointer: boolean;
}): FormFactor {
  if (!input.coarsePointer) return 'large';
  if (!Number.isFinite(input.shortSideCssPx) || input.shortSideCssPx <= 0) return 'phone';
  return input.shortSideCssPx < PHONE_SHORT_SIDE_CSS_PX ? 'phone' : 'large';
}

export const particleCeilingFor = (formFactor: FormFactor): number =>
  formFactor === 'phone' ? PHONE_PARTICLE_CEILING : LARGE_PARTICLE_CEILING;

/**
 * Everything a scene needs to know about how much to draw. The only object the
 * rest of the adapter reads; nothing downstream re-derives a tier.
 */
export interface RenderProfile {
  readonly tier: VisualTier;
  readonly motion: MotionLevel;
  readonly formFactor: FormFactor;
  /** The preset as authored, before the motion and particle ceilings are applied. */
  readonly preset: GraphicsPreset;
  /**
   * May a Filter be used at all? False on Canvas (there is no Filter pipeline),
   * false below high (`postProcessing`), false is also always survivable —
   * see `visual-effects.ts`, every effect has a no-Filter path.
   */
  readonly filters: boolean;
  readonly renderScale: number;
  readonly maxPixelRatio: number;
  /** Already clamped to the tier preset, the device ceiling and reduced motion. */
  readonly particles: number;
  readonly parallaxLayers: number;
  /** Layers may ease independently of the camera. Off under reduced motion. */
  readonly parallaxEasing: boolean;
  /** Character squash-and-stretch. Off under reduced motion. */
  readonly squashStretch: boolean;
}

export interface RenderProfileInput {
  readonly tier: VisualTier;
  readonly motion: MotionLevel;
  readonly formFactor: FormFactor;
  readonly presets: GraphicsPresets;
  /** From `RendererIdentity.filtersAvailable`: Canvas has no Filter pipeline. */
  readonly filtersAvailable: boolean;
}

/**
 * Tier + motion + device ceiling -> the numbers a scene draws with.
 *
 * Order matters and is asserted by test: the preset is read, the particle count
 * is clamped to the device's budget, and *then* reduced motion is applied. A
 * reduced-motion player ends at zero particles and one parallax layer at every
 * tier, so no measurement can hand them motion back.
 *
 * One parallax layer rather than zero: a level still needs a backdrop, and a
 * single layer at camera speed does not parallax. "Reduced motion", not "no
 * scenery".
 */
export function resolveRenderProfile(input: RenderProfileInput): RenderProfile {
  const preset = input.presets[input.tier];
  const reduced = input.motion === 'reduced';
  const particleCeiling = particleCeilingFor(input.formFactor);

  return {
    tier: input.tier,
    motion: input.motion,
    formFactor: input.formFactor,
    preset,
    filters: input.filtersAvailable && preset.postProcessing,
    renderScale: preset.renderScale,
    maxPixelRatio: preset.maxPixelRatio,
    particles: reduced ? 0 : Math.max(0, Math.min(preset.particles, particleCeiling)),
    parallaxLayers: reduced ? Math.min(1, preset.parallaxLayers) : preset.parallaxLayers,
    parallaxEasing: !reduced,
    squashStretch: !reduced,
  };
}
