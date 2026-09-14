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
  type RenderTierProbe,
  type RenderTierProbeOptions,
  type TierMarkerTarget,
} from '@adapters/phaser/render-tier-probe';
import { resolveRenderProfile, type VisualTier } from '@adapters/phaser/visual-tier';

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

  it('publishes a classification as the device, never the raw GPU string', () => {
    const target = marker();
    const profile = resolveRenderProfile({
      tier: 'medium',
      motion: 'full',
      formFactor: 'phone',
      presets: PRESETS,
      filtersAvailable: true,
    });
    const named = identifyRenderer('webgl', {
      getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 }),
      getParameter: (parameter: number) =>
        parameter === 0x9246 ? 'ANGLE (NVIDIA, GeForce RTX 4090, OpenGL 4.6)' : 'NVIDIA',
    } as never);

    applyTierMarkers(
      target,
      profile,
      { tier: 'medium', measured: true, windows: 2, reasons: [] },
      named,
    );

    /*
     * ADR-0011, verbatim: "`UNMASKED_RENDERER_WEBGL` is read, reduced to one of
     * three words, and discarded — it is never written to the DOM. Publishing
     * the raw string would add a fingerprinting surface to a site that collects
     * nothing." This attribute carried `describeRenderer(identity)`, which
     * interpolates that string, so the deployed page published every visitor's
     * GPU model. The rule is asserted against the whole dataset rather than
     * against `tnDevice` alone, so a future attribute cannot reintroduce it.
     */
    for (const [name, value] of Object.entries(target.dataset)) {
      expect(String(value), `${name} carries the raw device string`).not.toContain('GeForce');
      expect(String(value), `${name} carries the raw device string`).not.toContain('ANGLE');
    }
    expect(target.dataset['tnDevice']).toBe('webgl/hardware/phone');
  });

  it('publishes onto every target it is given, so <html> carries the tier too', () => {
    const canvas = marker();
    const html = marker();
    const profile = resolveRenderProfile({
      tier: 'high',
      motion: 'full',
      formFactor: 'large',
      presets: PRESETS,
      filtersAvailable: true,
    });

    applyTierMarkers(
      [canvas, html],
      profile,
      { tier: 'high', measured: true, windows: 3, reasons: [] },
      CANVAS,
    );

    /* `<html>` is where a bug report looks, beside `data-tn-boot` and
       `data-tn-level`. On the canvas alone it read as absent on three devices,
       which is the diagnostic ADR-0011 kept these attributes for, not working. */
    expect(html.dataset['tnTier']).toBe('high');
    expect(canvas.dataset['tnTier']).toBe('high');
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

describe('a tier change that changes the cost of the frames it is measured from', () => {
  /**
   * The feedback loop `renderScale` introduced, and the guard against it.
   *
   * Before the pixel count was tier-controlled, promoting a device changed how
   * many parallax layers and particles it drew — a real but modest cost change.
   * Promotion now also grows the **drawing buffer**: Ottawa going from `low` to
   * `medium` takes it from 810x1440 to 1080x1920, 1.78x the fragments. So the
   * decision alters the very quantity the next window measures, and the frames
   * immediately after the resize also pay to reallocate the framebuffer.
   *
   * Charged to the new tier, those frames demote it; the demotion resizes back;
   * the cheap frames promote it again. A deploy failed three times reporting
   * `tier "medium"` at 64 ms — a tier whose own definition allows 16.7 — which
   * is what being caught mid-cycle looks like.
   *
   * `GameRenderer` therefore re-arms the warm-up after a resize, the way it has
   * always done after a resume, because a resize is a gap and not a slow frame.
   * These two cases pin the halves of that: the discard must swallow the
   * reallocation, and it must not swallow a device that is genuinely slow.
   */
  it('does not demote on the frames that paid for the resize', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 2, windowFrames: 4 }),
      }),
    );

    /* Settle high on cheap frames. */
    fake.run(2 + 1 + 4 + 4, 3);
    expect(probe.profile.tier).toBe('high');

    /* The resize lands. `GameRenderer` calls this; here it is called directly,
       because what is being pinned is that a reset makes the expensive frames
       after it unmeasured rather than damning. */
    probe.reset();
    fake.run(2, 400);

    expect(
      probe.profile.tier,
      'the frames that reallocated the framebuffer were charged to the tier that caused ' +
        'the reallocation, which is how a tracker oscillates instead of converging',
    ).toBe('high');
  });

  it('still demotes a device that is slow after the warm-up, not just during it', () => {
    const fake = fakeSignals();
    const probe = startRenderTierProbe(
      probeOptions({
        signals: fake.signals,
        recorder: createFrameCostRecorder({ warmupFrames: 2, windowFrames: 4 }),
      }),
    );
    fake.run(2 + 1 + 4 + 4, 3);
    expect(probe.profile.tier).toBe('high');

    probe.reset();
    /* Past the discard, and still expensive: this is a real device, and the
       whole mechanism exists to take it down a tier. */
    fake.run(2 + 1 + 4, 400);

    expect(
      probe.profile.tier,
      'the reset swallowed a genuinely slow device, so nothing can ever be demoted after a ' +
        'resize — which is worse than the oscillation it was added to stop',
    ).toBe('low');
  });
});

/**
 * Frame by frame, with the default warm-up and window and the resize reset
 * `GameRenderer` performs on every tier change — so the run lengths below are
 * the ones a browser produces, not a model of them.
 */
function runTierDependentHost(options: {
  readonly costs: Readonly<Record<VisualTier, { readonly costMs: number; readonly intervalMs: number }>>;
  readonly frames: number;
  readonly overrides?: Partial<RenderTierProbeOptions>;
}): { readonly probe: RenderTierProbe; readonly runs: { tier: VisualTier; frames: number }[] } {
  const fake = fakeSignals();
  /* The probe publishes its provisional profile before it returns, so the
     callback reaches it through a holder rather than the return value. */
  const started: { probe?: RenderTierProbe } = {};
  let applied: VisualTier | null = null;
  const probe = startRenderTierProbe(
    probeOptions({
      signals: fake.signals,
      ...options.overrides,
      onProfile: (profile) => {
        /* What GameRenderer does: a new tier resizes the drawing buffer, and a
           resize re-arms the warm-up. */
        if (applied !== null && profile.tier !== applied) started.probe?.reset();
        applied = profile.tier;
      },
    }),
  );
  started.probe = probe;

  const runs: { tier: VisualTier; frames: number }[] = [];
  for (let frame = 0; frame < options.frames; frame += 1) {
    const { costMs, intervalMs } = options.costs[probe.profile.tier];
    fake.run(1, costMs, intervalMs);
    const tier = probe.profile.tier;
    const last = runs.at(-1);
    if (last?.tier === tier) last.frames += 1;
    else runs.push({ tier, frames: 1 });
  }
  return { probe, runs };
}

const SWIFTSHADER = identifyRenderer('webgl', {
  getExtension: () => ({}),
  getParameter: () => 'Google SwiftShader',
});

describe('the host CI measured cycling low 71 frames, medium 41, forever', () => {
  /* Cheap at low; over the budget at medium, which on the perf suite's phone
     viewport draws four times low's fragments. */
  const SWIFTSHADER_COSTS = {
    low: { costMs: 9, intervalMs: 22 },
    medium: { costMs: 38, intervalMs: 60 },
    high: { costMs: 38, intervalMs: 60 },
  } as const;

  it('reproduces the measured cycle once, then settles at low for the session', () => {
    const { probe, runs } = runTierDependentHost({
      costs: SWIFTSHADER_COSTS,
      frames: 3_000,
      overrides: { identity: SWIFTSHADER },
    });

    const shape = runs.map((run) => `${run.tier} ${String(run.frames)}`).join(', ');
    /* The first two runs are the old cycle's, frame for frame (the census
       attributes the switching frame to the earlier run, hence 70 against 71).
       What changed is that the cycle does not repeat. */
    expect(runs[0]?.frames, shape).toBeGreaterThanOrEqual(70);
    expect(runs[0]?.frames, shape).toBeLessThanOrEqual(71);
    expect(runs[1], shape).toEqual({ tier: 'medium', frames: 41 });
    expect(runs.map((run) => run.tier), shape).toEqual(['low', 'medium', 'low', 'medium', 'low']);
    expect(runs.at(-1)?.frames, shape).toBeGreaterThan(2_500);
    expect(probe.decision.reasons.join(' ')).toContain('closed for this session');
  });

  it('takes a fast host to high and holds it there, frame by frame', () => {
    const { probe, runs } = runTierDependentHost({
      costs: {
        low: { costMs: 2, intervalMs: 16.7 },
        medium: { costMs: 3, intervalMs: 16.7 },
        high: { costMs: 6, intervalMs: 16.7 },
      },
      frames: 3_000,
    });

    expect(runs.map((run) => run.tier)).toEqual(['medium', 'high']);
    expect(probe.profile.tier).toBe('high');
    expect(probe.decision.measured).toBe(true);
  });
});

describe('a pinned tier, which only the scene probe can ask for', () => {
  const SLOW = {
    low: { costMs: 40, intervalMs: 45 },
    medium: { costMs: 40, intervalMs: 45 },
    high: { costMs: 40, intervalMs: 45 },
  } as const;

  it('holds on frames that would demote it, above the device ceiling, and says it was not measured', () => {
    const target = marker();
    const { probe, runs } = runTierDependentHost({
      costs: SLOW,
      frames: 500,
      overrides: { identity: SWIFTSHADER, pinnedTier: 'high', marker: target },
    });

    expect(runs).toEqual([{ tier: 'high', frames: 500 }]);
    expect(probe.decision.measured, 'a pinned tier must not read as a measured one').toBe(false);
    expect(probe.decision.reasons.join(' ')).toContain('pinned');
    expect(target.dataset['tnTier']).toBe('high');
    expect(target.dataset['tnTierMeasured']).toBe('false');
    expect(probe.lastWindow, 'frames are still measured, for the record').not.toBeNull();
  });

  it('still strips motion under reduced motion, whatever tier is pinned', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      const { probe } = runTierDependentHost({
        costs: SLOW,
        frames: 100,
        overrides: { pinnedTier: tier, motion: 'reduced' },
      });

      expect(probe.profile.tier).toBe(tier);
      expect(probe.profile.particles, `${tier}: particles survived reduced motion`).toBe(0);
      expect(probe.profile.parallaxEasing).toBe(false);
      expect(probe.profile.squashStretch).toBe(false);
    }
  });

  it('is measured as always when nothing is pinned, which is what every player gets', () => {
    const { probe } = runTierDependentHost({
      costs: SLOW,
      frames: 200,
      overrides: { identity: SWIFTSHADER, pinnedTier: null },
    });

    expect(probe.decision.measured).toBe(true);
    expect(probe.profile.tier).toBe('low');
  });
});
