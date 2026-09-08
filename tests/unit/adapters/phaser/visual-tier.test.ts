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
  LARGE_PARTICLE_CEILING,
  PHONE_PARTICLE_CEILING,
  TIER_ORDER,
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

describe('tier arithmetic', () => {
  it('orders the tiers the way the presets are named', () => {
    expect(TIER_ORDER).toEqual(['low', 'medium', 'high']);
    expect(minTier('high', 'low')).toBe('low');
    expect(minTier('medium', 'medium')).toBe('medium');
    expect(isPromotion('low', 'high')).toBe(true);
    expect(isPromotion('high', 'low')).toBe(false);
    expect(stepUp('low')).toBe('medium');
    expect(stepUp('high')).toBe('high');
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
      expect(profile.parallaxLayers).toBeLessThanOrEqual(1);
      expect(profile.parallaxEasing).toBe(false);
      expect(profile.squashStretch).toBe(false);
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

  it('leaves a backdrop rather than no scenery: one layer, not zero', () => {
    expect(profileFor('high', { motion: 'reduced' }).parallaxLayers).toBe(1);
  });

  it('keeps the authored preset visible alongside the applied numbers', () => {
    const profile = profileFor('high', { motion: 'reduced', formFactor: 'phone' });

    expect(profile.preset.particles).toBe(PRESETS.high.particles);
    expect(profile.particles).toBe(0);
  });
});
