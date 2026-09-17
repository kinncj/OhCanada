/**
 * The policy: what a measurement means, what a device string is allowed to
 * decide, and what reduced motion is allowed to override.
 *
 * Three claims here are contracts rather than implementation details, and each
 * has a test named after it:
 *
 *   1. the tier comes from a measured frame cost, not from a capability bit;
 *   2. `unknown` is not treated as `hardware`, and it is not treated as broken;
 *   3. reduced motion is never undone by a good measurement.
 *
 * The presets come from the shipped `content/game.config.json`, not from
 * literals, so a re-tuned preset is checked against CLAUDE.md's budgets here
 * rather than in a reviewer's head.
 */

import { describe, expect, it } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { GraphicsPresets } from '@application/ports';

import type { FrameCostSummary } from '@adapters/phaser/frame-cost';
import { identifyRenderer, type RendererIdentity } from '@adapters/phaser/renderer-identity';
import {
  backingScaleFor,
  classifyFormFactor,
  createTierTracker,
  DEFAULT_PROMOTE_AFTER_WINDOWS,
  isPromotion,
  LARGE_PARTICLE_CEILING,
  MAX_FAILED_ATTEMPTS,
  MIN_BACKING_SCALE,
  minTier,
  particleCeilingFor,
  PHONE_PARTICLE_CEILING,
  PROBATION_WINDOWS,
  provisionalTier,
  resolveRenderProfile,
  stepDown,
  stepUp,
  thresholdsFor,
  TIER_ORDER,
  tierCeilingFor,
  tierFromFrameCost,
  type TierTracker,
  type VisualTier,
} from '@adapters/phaser/visual-tier';

const PRESETS = (gameConfigJson as { graphicsPresets: GraphicsPresets }).graphicsPresets;
const FRAME_BUDGET_MS = (gameConfigJson as { budgets: { frameTimeMs: number } }).budgets
  .frameTimeMs;
const THRESHOLDS = thresholdsFor(FRAME_BUDGET_MS);

/** A WebGL identity whose device string is whatever the test needs it to be. */
const webglWith = (device: string | null): RendererIdentity =>
  identifyRenderer('webgl', {
    getExtension: () => (device === null ? null : {}),
    getParameter: () => device,
  });

const HARDWARE = webglWith('Apple GPU');
const SOFTWARE = webglWith('Google SwiftShader');
const ANONYMOUS = webglWith(null);
const CANVAS = identifyRenderer('canvas', null);

const summary = (
  costP50: number,
  costP95 = costP50,
  intervalP50 = 16.7,
): FrameCostSummary => ({
  samples: 30,
  costP50,
  costP95,
  intervalP50,
  worstCostMs: costP95,
});

describe('the shipped presets are the budgets in CLAUDE.md', () => {
  it('caps particles at the phone budget by the medium preset and the large one at high', () => {
    expect(PRESETS.medium.particles).toBeLessThanOrEqual(PHONE_PARTICLE_CEILING);
    expect(PRESETS.high.particles).toBeLessThanOrEqual(LARGE_PARTICLE_CEILING);
    expect(PRESETS.low.particles).toBeLessThanOrEqual(PRESETS.medium.particles);
  });

  it('spends post-processing only at the top tier, since Filters are the expensive part', () => {
    expect(PRESETS.low.postProcessing).toBe(false);
    expect(PRESETS.medium.postProcessing).toBe(false);
    expect(PRESETS.high.postProcessing).toBe(true);
  });

  it('gives fewer parallax layers as the tier drops, which is what "degrade" means', () => {
    expect(PRESETS.low.parallaxLayers).toBeLessThan(PRESETS.medium.parallaxLayers);
    expect(PRESETS.medium.parallaxLayers).toBeLessThan(PRESETS.high.parallaxLayers);
  });
});

describe('thresholdsFor', () => {
  it('derives every boundary from the one budget CLAUDE.md states', () => {
    expect(THRESHOLDS.mediumCostP50Ms).toBe(FRAME_BUDGET_MS);
    expect(THRESHOLDS.highCostP50Ms).toBe(FRAME_BUDGET_MS / 2);
    /* CLAUDE.md's floor for a 2021 Android mid-range is 30 fps = 33.3 ms. */
    expect(THRESHOLDS.mediumIntervalP50Ms).toBeGreaterThanOrEqual(1000 / 30);
    expect(THRESHOLDS.highIntervalP50Ms).toBeLessThan(THRESHOLDS.mediumIntervalP50Ms);
  });

  it('falls back to 16.7 ms rather than producing a threshold of zero', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(thresholdsFor(bad).mediumCostP50Ms).toBe(16.7);
    }
  });
});

describe('tierFromFrameCost', () => {
  it('gives high only to a device using less than half a frame, at a 60 Hz cadence', () => {
    expect(tierFromFrameCost(summary(4, 9, 16.7), THRESHOLDS)).toBe('high');
  });

  it('refuses high to a device whose typical frame is cheap but whose bad frames are not', () => {
    expect(tierFromFrameCost(summary(4, 25, 16.7), THRESHOLDS)).toBe('medium');
  });

  it('refuses high to a device that computes cheap frames but does not deliver 60 Hz', () => {
    /* 2 ms of work at 30 fps: the browser is not scheduling frames, so there is
       no headroom to spend on post-processing however cheap the work looks. */
    expect(tierFromFrameCost(summary(2, 3, 33.3), THRESHOLDS)).toBe('medium');
  });

  it('drops to low when a frame costs more than the whole budget', () => {
    expect(tierFromFrameCost(summary(24, 30, 16.7), THRESHOLDS)).toBe('low');
  });

  it('drops to low when the cadence falls under 30 fps, however cheap the work', () => {
    expect(tierFromFrameCost(summary(3, 4, 60), THRESHOLDS)).toBe('low');
  });
});

describe('tierCeilingFor / provisionalTier', () => {
  it('caps the Canvas renderer at low: it has no Filter pipeline at all', () => {
    expect(tierCeilingFor(CANVAS)).toBe('low');
    expect(provisionalTier(CANVAS)).toBe('low');
  });

  it('caps a named software rasteriser at medium, and starts it at low', () => {
    expect(tierCeilingFor(SOFTWARE)).toBe('medium');
    expect(provisionalTier(SOFTWARE)).toBe('low');
  });

  it('does not cap a device that would not name itself, and does not start it high', () => {
    expect(
      tierCeilingFor(ANONYMOUS),
      'a browser hiding the device string is a privacy setting, not a slow GPU',
    ).toBe('high');
    expect(provisionalTier(ANONYMOUS)).toBe('medium');
  });

  it('starts hardware WebGL at the preset the frame-time budget is written against', () => {
    expect(provisionalTier(HARDWARE)).toBe('medium');
    expect(tierCeilingFor(HARDWARE)).toBe('high');
  });

  it.each(['headless', 'unknown'] as const)('caps %s at low', (kind) => {
    expect(tierCeilingFor(identifyRenderer(kind, null))).toBe('low');
  });
});

describe('createTierTracker', () => {
  it('starts unmeasured, and says so', () => {
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });

    expect(tracker.decision.measured).toBe(false);
    expect(tracker.decision.windows).toBe(0);
    expect(tracker.decision.tier).toBe('medium');
    expect(tracker.decision.reasons.join(' ')).toContain('until frames are measured');
  });

  it('demotes on the first bad window, because the player is already seeing it', () => {
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });

    const decision = tracker.observe(summary(40, 60, 45));

    expect(decision.tier).toBe('low');
    expect(decision.measured).toBe(true);
    expect(decision.reasons.join(' ')).toContain('demoted');
  });

  it('promotes only after two agreeing windows, and only one step', () => {
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });
    const good = summary(3, 6, 16.7);

    expect(tracker.observe(good).tier, 'one good window is not enough').toBe('medium');
    expect(tracker.observe(good).tier).toBe('high');
  });

  it('resets the promotion counter when a window disagrees, so it cannot oscillate up', () => {
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });

    tracker.observe(summary(3, 6, 16.7));
    tracker.observe(summary(14, 16, 16.7));
    expect(tracker.observe(summary(3, 6, 16.7)).tier).toBe('medium');
  });

  it('is a measurement, not a verdict: a device that throttles later is demoted later', () => {
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });
    tracker.observe(summary(3, 6, 16.7));
    tracker.observe(summary(3, 6, 16.7));
    expect(tracker.decision.tier).toBe('high');

    const throttled = tracker.observe(summary(30, 40, 33));

    expect(throttled.tier).toBe('low');
    expect(throttled.windows).toBe(3);
  });

  it('holds a named software rasteriser at its ceiling however well it measures', () => {
    const tracker = createTierTracker({ identity: SOFTWARE, frameTimeMs: FRAME_BUDGET_MS });
    const good = summary(1, 2, 16.7);

    tracker.observe(good);
    tracker.observe(good);
    tracker.observe(good);
    tracker.observe(good);

    expect(tracker.decision.tier).toBe('medium');
    expect(tracker.decision.reasons.join(' ')).toContain('capped at "medium"');
  });

  it('lets a measurement, not a device string, place an anonymous device at high', () => {
    const tracker = createTierTracker({ identity: ANONYMOUS, frameTimeMs: FRAME_BUDGET_MS });
    const good = summary(3, 6, 16.7);

    tracker.observe(good);

    expect(tracker.observe(good).tier).toBe('high');
  });

  it('also lets a measurement demote an anonymous device that is in fact software', () => {
    const tracker = createTierTracker({ identity: ANONYMOUS, frameTimeMs: FRAME_BUDGET_MS });

    expect(tracker.observe(summary(55, 70, 60)).tier).toBe('low');
  });

  it('records the numbers it decided from, so a decision can be argued with', () => {
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });

    const reasons = tracker.observe(summary(12.25, 15.5, 16.7)).reasons.join(' ');

    expect(reasons).toContain('12.25');
    expect(reasons).toContain('15.50');
    expect(reasons).toContain('30 frames');
  });
});

describe('the tier settles instead of cycling', () => {
  /*
   * What this section is written against. CI's GPU census, 2026-09-13: on
   * SwiftShader the tracker ran `low` for 71 frames and `medium` for 41, forever,
   * at normal speed and at 4x CPU throttle alike.
   *
   * Those two numbers are the old rule's arithmetic to the frame: one frame with
   * no interval, ten warm-up frames, then two 30-frame windows to promote (71) or
   * one to demote (41). So EVERY window at `low` passed and EVERY window at
   * `medium` failed. That is not noise around a threshold, which a wider band
   * would absorb. It is the tier change moving the measured quantity across the
   * threshold: a promotion is judged on frames drawn at `low`, the demotion on
   * frames drawn at `medium`, and on that phone viewport `medium` draws four
   * times the fragments. No threshold measured at one tier predicts another, so
   * the rule has to remember how trying the other tier went.
   *
   * The host below is that pattern: its cost is a function of the tier it is
   * drawing at, not a fixed number.
   */
  const SWIFTSHADER_HOST: Readonly<Record<VisualTier, ReturnType<typeof summary>>> = {
    /* Cheap enough to argue for medium, not for high. */
    low: summary(9, 14, 22),
    /* Over the whole budget at a sub-30 fps cadence: demote. */
    medium: summary(38, 55, 60),
    high: summary(38, 55, 60),
  };

  /** Feed `windows` windows, each measured at the tier the tracker is on. Index 0 is the start. */
  function drive(
    tracker: TierTracker,
    host: (tier: VisualTier) => ReturnType<typeof summary>,
    windows: number,
  ): VisualTier[] {
    const tiers: VisualTier[] = [tracker.decision.tier];
    for (let window = 0; window < windows; window += 1) {
      tiers.push(tracker.observe(host(tracker.decision.tier)).tier);
    }
    return tiers;
  }

  const changesIn = (tiers: readonly VisualTier[]): number =>
    tiers.reduce((count, tier, index) => (index > 0 && tier !== tiers[index - 1] ? count + 1 : count), 0);

  it.each([
    ['a named software rasteriser', SOFTWARE],
    ['a software rasteriser that hides its name, which starts at medium', ANONYMOUS],
  ] as const)('settles at low for %s, after two failed attempts at medium', (_name, identity) => {
    const tracker = createTierTracker({ identity, frameTimeMs: FRAME_BUDGET_MS });

    const tiers = drive(tracker, (tier) => SWIFTSHADER_HOST[tier], 200);

    expect(
      changesIn(tiers),
      `the tier kept moving: ${tiers.slice(0, 16).join(' ')} ...`,
    ).toBeLessThanOrEqual(2 * MAX_FAILED_ATTEMPTS);
    expect(new Set(tiers.slice(20)), 'the tier was still moving twenty windows in').toEqual(
      new Set(['low']),
    );
    expect(tracker.ceiling).toBe('low');
    expect(tracker.decision.reasons.join(' ')).toContain('closed for this session');
  });

  it('asks for twice the sustained headroom before retrying a tier that just failed', () => {
    const tracker = createTierTracker({ identity: SOFTWARE, frameTimeMs: FRAME_BUDGET_MS });
    /* low, promoted to medium, failed straight back to low. */
    drive(tracker, (tier) => SWIFTSHADER_HOST[tier], 3);
    expect(tracker.decision.tier).toBe('low');

    const retry = 2 * DEFAULT_PROMOTE_AFTER_WINDOWS;
    for (let window = 1; window < retry; window += 1) {
      expect(tracker.observe(SWIFTSHADER_HOST.low).tier, `retry window ${window}/${retry}`).toBe('low');
    }
    expect(tracker.observe(SWIFTSHADER_HOST.low).tier).toBe('medium');
  });

  it('still takes a fast machine to high, and keeps it there', () => {
    const FAST_HOST: Readonly<Record<VisualTier, ReturnType<typeof summary>>> = {
      low: summary(2, 4),
      medium: summary(3, 6),
      /* Dearer than medium, still inside what high allows. */
      high: summary(6, 11),
    };
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });

    const tiers = drive(tracker, (tier) => FAST_HOST[tier], 500);

    expect(tiers.at(-1)).toBe('high');
    expect(changesIn(tiers), 'a fast machine should promote once and hold').toBe(1);
    expect(tracker.ceiling).toBe('high');
  });

  it('does not close a tier over a stall that came after the tier had held', () => {
    /* A notification, a level load, a background tab: the tier had proven
       itself, so dropping is a change in conditions and not a failed attempt. */
    const tracker = createTierTracker({ identity: HARDWARE, frameTimeMs: FRAME_BUDGET_MS });
    const fast = summary(4, 8);
    const stall = summary(25, 40, 33);

    for (let stalls = 0; stalls < 3; stalls += 1) {
      for (let window = 0; window < PROBATION_WINDOWS + 40; window += 1) tracker.observe(fast);
      expect(tracker.decision.tier, `before stall ${stalls + 1}`).toBe('high');
      expect(tracker.observe(stall).tier, 'a genuinely slow window still demotes at once').toBe('low');
    }
    for (let window = 0; window < PROBATION_WINDOWS + 40; window += 1) tracker.observe(fast);

    expect(tracker.decision.tier).toBe('high');
    expect(tracker.ceiling).toBe('high');
  });

  it('makes a host that fails a tier only after holding it retry less and less often', () => {
    /* The borderline device: holds medium past its probation, then fails, every
       time. It is never closed, so what stops the cycle is the doubling. */
    const tracker = createTierTracker({ identity: SOFTWARE, frameTimeMs: FRAME_BUDGET_MS });
    const holdFor = PROBATION_WINDOWS + 5;
    let windowsAtMedium = 0;

    const tiers = drive(
      tracker,
      (tier) => {
        if (tier !== 'medium') {
          windowsAtMedium = 0;
          return SWIFTSHADER_HOST.low;
        }
        windowsAtMedium += 1;
        return windowsAtMedium > holdFor ? SWIFTSHADER_HOST.medium : SWIFTSHADER_HOST.low;
      },
      4000,
    );

    const promotions = tiers.flatMap((tier, index) =>
      index > 0 && tier === 'medium' && tiers[index - 1] === 'low' ? [index] : [],
    );
    const gaps = promotions.slice(1).map((at, index) => at - (promotions[index] ?? 0));
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index], `retry gaps ${gaps.join(', ')}`).toBeGreaterThanOrEqual(gaps[index - 1] ?? 0);
    }
    /* The old rule's cycle here is 28 windows: ~285 changes in 4000. */
    expect(changesIn(tiers)).toBeLessThan(30);
    expect(changesIn(tiers.slice(-1000)), 'still cycling at the end of the run').toBeLessThanOrEqual(2);
    expect(tracker.ceiling, 'a tier held past probation is not closed').toBe('medium');
  });
});

describe('tier arithmetic', () => {
  it('orders the tiers the way the presets are named', () => {
    expect(TIER_ORDER).toEqual(['low', 'medium', 'high']);
    expect(minTier('high', 'low')).toBe('low');
    expect(minTier('medium', 'medium')).toBe('medium');
    expect(isPromotion('low', 'high')).toBe(true);
    expect(isPromotion('high', 'low')).toBe(false);
    expect(stepUp('low')).toBe('medium');
    expect(stepUp('high')).toBe('high');
    expect(stepDown('high')).toBe('medium');
    expect(stepDown('low')).toBe('low');
  });
});

describe('classifyFormFactor', () => {
  it('puts a coarse pointer on a small screen on the phone particle budget', () => {
    /* iPhone 15 Pro Max in portrait is 430 CSS px across. */
    expect(classifyFormFactor({ shortSideCssPx: 430, coarsePointer: true })).toBe('phone');
    expect(particleCeilingFor('phone')).toBe(PHONE_PARTICLE_CEILING);
  });

  it('puts a tablet on the large budget: an iPad is not a phone', () => {
    /* iPad mini is 744 CSS px across in portrait, the narrowest current iPad. */
    expect(classifyFormFactor({ shortSideCssPx: 744, coarsePointer: true })).toBe('large');
    expect(particleCeilingFor('large')).toBe(LARGE_PARTICLE_CEILING);
  });

  it('never calls a fine pointer a phone, however narrow the window', () => {
    expect(classifyFormFactor({ shortSideCssPx: 320, coarsePointer: false })).toBe('large');
  });

  it('assumes the tighter budget when the screen size is unreadable', () => {
    expect(classifyFormFactor({ shortSideCssPx: Number.NaN, coarsePointer: true })).toBe('phone');
    expect(classifyFormFactor({ shortSideCssPx: 0, coarsePointer: true })).toBe('phone');
  });
});

describe('resolveRenderProfile', () => {
  const profileFor = (
    tier: VisualTier,
    overrides: Partial<Parameters<typeof resolveRenderProfile>[0]> = {},
  ) =>
    resolveRenderProfile({
      tier,
      motion: 'full',
      formFactor: 'large',
      presets: PRESETS,
      filtersAvailable: true,
      ...overrides,
    });

  it('reads the numbers straight out of the shipped presets', () => {
    const profile = profileFor('medium');

    expect(profile.particles).toBe(PRESETS.medium.particles);
    expect(profile.parallaxLayers).toBe(PRESETS.medium.parallaxLayers);
    expect(profile.renderScale).toBe(PRESETS.medium.renderScale);
    expect(profile.maxPixelRatio).toBe(PRESETS.medium.maxPixelRatio);
  });

  it('holds a phone to 400 particles even at the top tier', () => {
    const phone = profileFor('high', { formFactor: 'phone' });
    const desktop = profileFor('high', { formFactor: 'large' });

    expect(phone.particles).toBe(PHONE_PARTICLE_CEILING);
    expect(desktop.particles).toBeGreaterThan(PHONE_PARTICLE_CEILING);
    expect(desktop.particles).toBeLessThanOrEqual(LARGE_PARTICLE_CEILING);
  });

  it('never grants Filters on a renderer that has no Filter pipeline', () => {
    expect(profileFor('high', { filtersAvailable: false }).filters).toBe(false);
    expect(profileFor('high', { filtersAvailable: true }).filters).toBe(true);
  });

  it('never grants Filters below the tier that pays for them', () => {
    expect(profileFor('low').filters).toBe(false);
    expect(profileFor('medium').filters).toBe(false);
  });

  it('strips motion at every tier when the player asked for reduced motion', () => {
    for (const tier of TIER_ORDER) {
      const profile = profileFor(tier, { motion: 'reduced' });

      expect(profile.particles, `${tier}: particles survived reduced motion`).toBe(0);
      expect(profile.parallaxEasing).toBe(false);
      expect(profile.squashStretch).toBe(false);
      /* And the scenery is NOT one of the things reduced motion takes: the band
         count is the tier's, unchanged. CLAUDE.md names easing, particles and
         squash-and-stretch, and a band is none of them. */
      expect(
        profile.parallaxLayers,
        `${tier}: reduced motion deleted parallax bands. That is the defect a live audit found: ` +
          `"Less movement" emptied the world — Halifax lost its houses, trees and harbour, ` +
          `Toronto its skyline — because one layer is one band, the sky.`,
      ).toBe(PRESETS[tier].parallaxLayers);
    }
  });

  it('keeps the tier when motion is reduced: stillness is not lower quality', () => {
    const still = profileFor('high', { motion: 'reduced' });

    expect(still.tier).toBe('high');
    expect(
      still.renderScale,
      'a reduced-motion player still gets a full-resolution, filtered picture',
    ).toBe(PRESETS.high.renderScale);
    expect(still.filters).toBe(true);
  });

  it('draws the same world still as it draws moving: every band the tier allows', () => {
    /* The whole picture, held still — not a backdrop with the level taken out of
       it. Stillness is `parallaxEasing`, which the scene honours by leaving every
       band pinned to the world (`level-effects.ts`, PINNED_SCROLL_FACTOR). */
    for (const tier of TIER_ORDER) {
      expect(profileFor(tier, { motion: 'reduced' }).parallaxLayers).toBe(
        profileFor(tier, { motion: 'full' }).parallaxLayers,
      );
    }
  });

  it('keeps the authored preset visible alongside the applied numbers', () => {
    const profile = profileFor('high', { motion: 'reduced', formFactor: 'phone' });

    expect(profile.preset.particles).toBe(PRESETS.high.particles);
    expect(profile.particles).toBe(0);
  });
});

describe('backingScaleFor — the pixel count the tier degrades', () => {
  /*
   * `renderScale` and `maxPixelRatio` sat in `RenderProfile` and in
   * `content/game.config.json` and were applied by nothing, so the tier
   * degraded particles and parallax layers and never the fragment count — the
   * dominant cost on exactly the software rasterisers ADR-0011 exists to keep
   * playable. These are the rules that turned two read-only numbers into the
   * size of the drawing buffer.
   */
  const design = 1080;

  it('takes the tier multiplier when the pixel ratio is not the binding limit', () => {
    /* A 1080-wide canvas shown 1080 CSS px wide is already 1:1, so a cap of 2
       has nothing to bite on and `renderScale` decides alone. */
    expect(
      backingScaleFor({
        renderScale: 0.75,
        maxPixelRatio: 2,
        designWidth: design,
        displayWidthCss: 1080,
      }),
    ).toBeCloseTo(0.75, 5);
  });

  it('takes the pixel-ratio cap when it is the sharper of the two', () => {
    /* The perf suite's phone: 1080 design pixels shown across 390 CSS pixels is
       a natural ratio of 2.77, and the low preset says at most 1. That is a 7.7x
       reduction in fragments and it is what the preset has always asked for. */
    const scale = backingScaleFor({
      renderScale: 0.75,
      maxPixelRatio: 1,
      designWidth: design,
      displayWidthCss: 390,
    });
    expect(scale).toBeCloseTo(390 / 1080, 5);
    expect(scale).toBeLessThan(0.75);
  });

  it('never draws more pixels than the design resolution', () => {
    /* A content edit asking for 2x must not silently turn on supersampling —
       that is a decision this project has not taken. */
    expect(
      backingScaleFor({
        renderScale: 2,
        maxPixelRatio: 4,
        designWidth: design,
        displayWidthCss: 1080,
      }),
    ).toBe(1);
  });

  it('never falls below the floor, whatever the numbers say', () => {
    expect(
      backingScaleFor({
        renderScale: 0.01,
        maxPixelRatio: 0.01,
        designWidth: design,
        displayWidthCss: 4000,
      }),
    ).toBe(MIN_BACKING_SCALE);
  });

  it('applies only the tier multiplier when there is no display to measure', () => {
    /* A headless boot, or a canvas that has not been laid out yet. Guessing a
       display size here would be guessing the cap. */
    expect(
      backingScaleFor({
        renderScale: 0.75,
        maxPixelRatio: 1,
        designWidth: design,
        displayWidthCss: 0,
      }),
    ).toBeCloseTo(0.75, 5);
  });

  it('survives numbers that are not numbers', () => {
    expect(
      backingScaleFor({
        renderScale: Number.NaN,
        maxPixelRatio: Number.NaN,
        designWidth: Number.NaN,
        displayWidthCss: Number.NaN,
      }),
    ).toBe(1);
  });

  it('leaves the high tier at full resolution, which is what "high" means', () => {
    const high = PRESETS.high;
    expect(
      backingScaleFor({
        renderScale: high.renderScale,
        maxPixelRatio: high.maxPixelRatio,
        designWidth: design,
        displayWidthCss: 1080,
      }),
    ).toBe(1);
  });
});
