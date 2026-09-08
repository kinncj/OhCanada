/**
 * The glue: frame signals in, a profile and a set of data attributes out.
 *
 * The signals are fakes, so a decision that would take ~40 real frames on a real
 * device is driven here in a loop. That is the point of the seam — the
 * measurement is injected, so the sequencing (warm-up, first window, promotion,
 * demotion, pause) is testable without a browser and without waiting.
 */

import { describe, expect, it, vi } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { GraphicsPresets } from '@application/ports';

import { createFrameCostRecorder } from '@adapters/phaser/frame-cost';
import { identifyRenderer } from '@adapters/phaser/renderer-identity';
import {
  applyTierMarkers,
  prefersReducedMotion,
  readFormFactor,
  resolveMotionLevel,
  startRenderTierProbe,
  type FrameSignals,
  type RenderTierProbeOptions,
  type TierMarkerTarget,
} from '@adapters/phaser/render-tier-probe';
import { resolveRenderProfile } from '@adapters/phaser/visual-tier';

const PRESETS = (gameConfigJson as { graphicsPresets: GraphicsPresets }).graphicsPresets;
const FRAME_BUDGET_MS = (gameConfigJson as { budgets: { frameTimeMs: number } }).budgets
  .frameTimeMs;

const HARDWARE = identifyRenderer('webgl', {
  getExtension: () => ({}),
  getParameter: () => 'Apple GPU',
});
const CANVAS = identifyRenderer('canvas', null);

/** A driveable pair of frame signals, plus a clock the test advances. */
function fakeSignals(): {
  signals: FrameSignals;
  /** Run `count` frames, each costing `costMs` inside an `intervalMs` cadence. */
  run(count: number, costMs: number, intervalMs?: number): void;
  readonly listeners: number;
} {
  const starts: ((now: number) => void)[] = [];
  const ends: ((now: number) => void)[] = [];
  let now = 1_000;

  return {
    signals: {
      onFrameStart(listener) {
        starts.push(listener);
        return () => {
          starts.splice(starts.indexOf(listener), 1);
        };
      },
      onFrameEnd(listener) {
        ends.push(listener);
        return () => {
          ends.splice(ends.indexOf(listener), 1);
        };
      },
    },
    run(count, costMs, intervalMs = 16.7) {
      for (let frame = 0; frame < count; frame += 1) {
        for (const listener of [...starts]) listener(now);
        for (const listener of [...ends]) listener(now + costMs);
        now += intervalMs;
      }
    },
    get listeners(): number {
      return starts.length + ends.length;
    },
  };
}

const marker = (): TierMarkerTarget => ({ dataset: {} });

const probeOptions = (
  overrides: Partial<RenderTierProbeOptions> = {},
): RenderTierProbeOptions => ({
  identity: HARDWARE,
  presets: PRESETS,
  frameTimeMs: FRAME_BUDGET_MS,
  signals: fakeSignals().signals,
  motion: 'full',
  formFactor: 'large',
  ...overrides,
});

describe('prefersReducedMotion', () => {
  it('reads the media query when there is one', () => {
    expect(prefersReducedMotion({ matches: true })).toBe(true);
    expect(prefersReducedMotion({ matches: false })).toBe(false);
  });

  it('does not assume "yes" when the browser cannot answer', () => {
    /* Defaulting to reduced would strip motion from every player on a browser
       without matchMedia, which is a worse outcome than the one it protects. */
    expect(prefersReducedMotion(null)).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
  });
});

describe('resolveMotionLevel', () => {
  it('follows the media query when the player has expressed no choice', () => {
    expect(resolveMotionLevel({ mediaQuery: { matches: true } })).toBe('reduced');
    expect(resolveMotionLevel({ mediaQuery: { matches: false } })).toBe('full');
  });

  it('lets an explicit setting win in both directions', () => {
    expect(resolveMotionLevel({ mediaQuery: { matches: false }, override: true })).toBe(
      'reduced',
    );
    expect(resolveMotionLevel({ mediaQuery: { matches: true }, override: false })).toBe('full');
  });
});

describe('readFormFactor', () => {
  it('measures the short side, so orientation cannot change the budget', () => {
    expect(
      readFormFactor({
        widthCssPx: 390,
        heightCssPx: 844,
        coarsePointerQuery: { matches: true },
      }),
    ).toBe('phone');
    expect(
      readFormFactor({
        widthCssPx: 844,
        heightCssPx: 390,
        coarsePointerQuery: { matches: true },
      }),
    ).toBe('phone');
  });

  it('does not call a narrow desktop window a phone', () => {
    expect(
      readFormFactor({ widthCssPx: 400, heightCssPx: 900, coarsePointerQuery: null }),
    ).toBe('large');
  });
});

describe('applyTierMarkers', () => {
  it('publishes the decision where a browser test can read it', () => {
    const target = marker();
    const profile = resolveRenderProfile({
      tier: 'low',
      motion: 'reduced',
      formFactor: 'phone',
      presets: PRESETS,
      filtersAvailable: false,
    });

    applyTierMarkers(
      target,
      profile,
      { tier: 'low', measured: true, windows: 2, reasons: [] },
      CANVAS,
    );

    expect(target.dataset).toMatchObject({
      tnTier: 'low',
      tnTierMeasured: 'true',
      tnMotion: 'reduced',
      tnFormFactor: 'phone',
      tnRenderer: 'canvas',
      tnRasterizer: 'unknown',
      tnFilters: 'false',
    });
  });

  it('is a no-op without a target, so a headless game does not crash on boot', () => {
    const profile = resolveRenderProfile({
      tier: 'low',
      motion: 'full',
      formFactor: 'large',
      presets: PRESETS,
      filtersAvailable: false,
    });

    expect(() =>
      applyTierMarkers(null, profile, { tier: 'low', measured: false, windows: 0, reasons: [] }, CANVAS),
    ).not.toThrow();
  });
});

describe('startRenderTierProbe', () => {
  it('returns a provisional profile immediately, before any frame is measured', () => {
    const probe = startRenderTierProbe(probeOptions());

    expect(probe.decision.measured).toBe(false);
    expect(probe.profile.tier).toBe('medium');
    expect(probe.lastWindow).toBeNull();
  });

  it('publishes the provisional decision at once, so the canvas is never unlabelled', () => {
    const target = marker();
    startRenderTierProbe(probeOptions({ marker: target }));

    expect(target.dataset['tnTier']).toBe('medium');
    expect(target.dataset['tnTierMeasured']).toBe('false');
  });

  it('promotes a fast device once two windows agree, and says it measured it', () => {
    const fake = fakeSignals();
    const target = marker();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        marker: target,
        recorder: createFrameCostRecorder({ warmupFrames: 2, windowFrames: 4 }),
      }),
    );

    fake.run(2 + 1 + 4 + 4, 3);

    expect(probe.decision.measured).toBe(true);
    expect(probe.profile.tier).toBe('high');
    expect(target.dataset['tnTier']).toBe('high');
    expect(target.dataset['tnFilters']).toBe('true');
    expect(probe.lastWindow?.costP50).toBe(3);
  });

  it('demotes a software rasteriser on the frames it actually renders', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 2, windowFrames: 4 }),
      }),
    );

    /* 40 ms of engine work inside a 45 ms cadence: what llvmpipe looks like. */
    fake.run(2 + 1 + 4, 40, 45);

    expect(probe.profile.tier).toBe('low');
    expect(probe.profile.particles).toBe(PRESETS.low.particles);
    expect(probe.profile.parallaxLayers).toBe(PRESETS.low.parallaxLayers);
    expect(probe.profile.filters).toBe(false);
  });

  it('throws away the warm-up frames rather than demoting on them', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 4, windowFrames: 4 }),
      }),
    );

    /* Four brutal warm-up frames (shader compilation), then four cheap ones. */
    fake.run(1, 3);
    fake.run(4, 300, 320);
    fake.run(4, 3);

    expect(probe.decision.measured).toBe(true);
    expect(probe.profile.tier).not.toBe('low');
  });

  it('never upgrades a reduced-motion player, however fast the device measures', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        motion: 'reduced',
        recorder: createFrameCostRecorder({ warmupFrames: 0, windowFrames: 4 }),
      }),
    );

    fake.run(1 + 4 + 4, 1);

    expect(probe.profile.tier, 'the measurement still earns the visual tier').toBe('high');
    expect(probe.profile.motion).toBe('reduced');
    expect(probe.profile.particles).toBe(0);
    expect(probe.profile.parallaxEasing).toBe(false);
    expect(probe.profile.squashStretch).toBe(false);
  });

  it('never grants Filters on Canvas, however fast it measures', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        identity: CANVAS,
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 0, windowFrames: 4 }),
      }),
    );

    fake.run(1 + 4 + 4 + 4, 1);

    expect(probe.profile.tier).toBe('low');
    expect(probe.profile.filters).toBe(false);
  });

  it('reports every window, not only the ones that change the tier', () => {
    const fake = fakeSignals();
    const onProfile = vi.fn();
    startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        onProfile,
        recorder: createFrameCostRecorder({ warmupFrames: 0, windowFrames: 4 }),
      }),
    );

    fake.run(1 + 4 + 4, 12);

    /* Once for the provisional profile, then once per completed window. */
    expect(onProfile).toHaveBeenCalledTimes(3);
    expect(onProfile.mock.calls.at(-1)?.[1].windows).toBe(2);
  });

  it('re-arms the warm-up on reset, so a rotate-and-return costs no tier', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 2, windowFrames: 4 }),
      }),
    );

    fake.run(1 + 2 + 4 + 4, 3);
    expect(probe.profile.tier).toBe('high');

    probe.reset();
    /* Two expensive re-acquisition frames after the resume: warm-up eats them. */
    fake.run(2, 200, 210);

    expect(probe.profile.tier, 'a paused tab demoted a healthy device').toBe('high');
  });

  it('detaches from the frame signals when it is stopped', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(probeOptions({ signals: fake.signals }));

    expect(fake.listeners).toBe(2);
    probe.stop();
    probe.stop();

    expect(fake.listeners).toBe(0);
  });

  it('stops measuring once stopped, so a destroyed game cannot move the tier', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 0, windowFrames: 2 }),
      }),
    );

    probe.stop();
    fake.run(20, 90, 100);

    expect(probe.decision.measured).toBe(false);
  });
});
