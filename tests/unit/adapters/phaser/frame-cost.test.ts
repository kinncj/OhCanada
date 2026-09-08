/**
 * The measurement, and specifically the three things that make an early frame
 * measurement lie: the warm-up, an outlier, and a gap that is not a frame.
 *
 * Every timestamp here is supplied by the test, so the sequencing rules are
 * exercised in milliseconds of wall clock rather than in seconds of waiting for
 * a real browser to produce 40 frames.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WARMUP_FRAMES,
  DEFAULT_WINDOW_FRAMES,
  MAX_PLAUSIBLE_INTERVAL_MS,
  createFrameCostRecorder,
  createFrameTimer,
  percentile,
  summariseFrames,
  type FrameSample,
} from '@adapters/phaser/frame-cost';

const sample = (costMs: number, intervalMs = 16.7): FrameSample => ({ costMs, intervalMs });

describe('percentile', () => {
  it('is nearest-rank, so it always reports a value some frame actually took', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    expect(percentile(values, 0.5)).toBe(5);
    expect(percentile(values, 0.95)).toBe(10);
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 1)).toBe(10);
  });

  it('does not need its input sorted', () => {
    expect(percentile([9, 1, 5, 3, 7], 0.5)).toBe(5);
  });

  it('answers 0 for an empty window and clamps a nonsense percentile', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([4, 8], Number.NaN)).toBe(4);
    expect(percentile([4, 8], 12)).toBe(8);
    expect(percentile([4, 8], -3)).toBe(4);
  });
});

describe('summariseFrames', () => {
  it('reports a median that a single catastrophic frame cannot move', () => {
    /* Twenty-nine 8 ms frames and one 400 ms GC pause: the mean is 21 ms and
       would demote a healthy device a whole tier; the median is 8 ms. */
    const samples = [...Array.from({ length: 29 }, () => sample(8)), sample(400)];

    const summary = summariseFrames(samples);

    expect(summary).not.toBeNull();
    expect(summary?.costP50).toBe(8);
    expect(summary?.worstCostMs).toBe(400);

    const mean = samples.reduce((total, s) => total + s.costMs, 0) / samples.length;
    expect(mean, 'the premise: a mean really would be wrecked here').toBeGreaterThan(20);
  });

  it('still lets p95 see consistently spiky frames', () => {
    const samples = Array.from({ length: 20 }, (_unused, index) =>
      sample(index < 16 ? 8 : 30),
    );

    const summary = summariseFrames(samples);

    expect(summary?.costP50).toBe(8);
    expect(summary?.costP95).toBe(30);
  });

  it('returns null for an empty window: an unmeasured tier is not a tier', () => {
    expect(summariseFrames([])).toBeNull();
  });
});

describe('createFrameTimer', () => {
  it('measures engine cost and the delivered interval as separate numbers', () => {
    const timer = createFrameTimer();

    timer.begin(1000);
    expect(timer.end(1004), 'the first frame has no previous start to measure from').toBeNull();

    timer.begin(1016.7);
    const second = timer.end(1020.7);

    expect(second?.costMs).toBeCloseTo(4, 6);
    expect(second?.intervalMs).toBeCloseTo(16.7, 6);
  });

  it('reports a cost far below the interval when the device is idle at vsync', () => {
    /* This is the case an interval-only probe cannot see: 2 ms of work inside a
       16.7 ms vsync frame. Cost is what has headroom; interval is what is capped. */
    const timer = createFrameTimer();
    timer.begin(0);
    timer.end(2);
    timer.begin(16.7);
    const sampled = timer.end(18.7);

    expect(sampled?.costMs).toBeCloseTo(2, 6);
    expect(sampled?.intervalMs).toBeCloseTo(16.7, 6);
  });

  it('drops a frame with no matching begin', () => {
    const timer = createFrameTimer();

    expect(timer.end(10)).toBeNull();
  });

  it('drops non-finite timestamps rather than turning them into NaN samples', () => {
    const timer = createFrameTimer();

    timer.begin(Number.NaN);
    expect(timer.end(10)).toBeNull();

    timer.begin(10);
    expect(timer.end(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('abandons a frame that began twice without rendering', () => {
    const timer = createFrameTimer();
    timer.begin(0);
    timer.end(4);

    timer.begin(16);
    timer.begin(32);
    const sampled = timer.end(36);

    expect(sampled?.costMs).toBe(4);
  });

  it('drops a resume gap: a paused tab is not a slow frame', () => {
    const timer = createFrameTimer();
    timer.begin(0);
    timer.end(4);

    timer.begin(MAX_PLAUSIBLE_INTERVAL_MS + 5_000);
    expect(timer.end(MAX_PLAUSIBLE_INTERVAL_MS + 5_004)).toBeNull();
  });

  it('does NOT drop a genuinely catastrophic frame, because the cost tracks the gap', () => {
    /* The device really did spend 1.2 s inside the render call. That is a
       measurement, not a gap, and hiding it would be the failure this whole
       task exists to prevent. */
    const timer = createFrameTimer();
    timer.begin(0);
    timer.end(1_200);

    timer.begin(1_300);
    const sampled = timer.end(2_500);

    expect(sampled).toEqual({ costMs: 1_200, intervalMs: 1_300 });
  });

  it('drops a backwards clock instead of clamping it', () => {
    const timer = createFrameTimer();
    timer.begin(100);
    timer.end(104);

    timer.begin(90);
    expect(timer.end(94)).toBeNull();
  });

  it('forgets everything on reset', () => {
    const timer = createFrameTimer();
    timer.begin(0);
    timer.end(4);
    timer.reset();

    timer.begin(16);
    expect(timer.end(20), 'after a reset the next frame is a first frame again').toBeNull();
  });
});

describe('createFrameCostRecorder', () => {
  it('throws away the warm-up frames, which are the expensive unrepresentative ones', () => {
    const recorder = createFrameCostRecorder({ warmupFrames: 3, windowFrames: 2 });

    expect(recorder.record(sample(500))).toBeNull();
    expect(recorder.record(sample(400))).toBeNull();
    expect(recorder.record(sample(300))).toBeNull();
    expect(recorder.warmupRemaining).toBe(0);

    expect(recorder.record(sample(6))).toBeNull();
    const summary = recorder.record(sample(6));

    expect(summary?.costP50).toBe(6);
    expect(
      summary?.worstCostMs,
      'a warm-up frame reached the statistics',
    ).toBe(6);
  });

  it('emits one summary per window and keeps going, so the tier can be revisited', () => {
    const recorder = createFrameCostRecorder({ warmupFrames: 0, windowFrames: 2 });

    expect(recorder.record(sample(4))).toBeNull();
    expect(recorder.record(sample(4))?.costP50).toBe(4);
    expect(recorder.windows).toBe(1);

    expect(recorder.record(sample(40))).toBeNull();
    expect(recorder.record(sample(40))?.costP50).toBe(40);
    expect(recorder.windows).toBe(2);
    expect(recorder.latest?.costP50).toBe(40);
  });

  it('refuses to let a NaN or a negative cost reach the statistics', () => {
    const recorder = createFrameCostRecorder({ warmupFrames: 0, windowFrames: 1 });

    expect(recorder.record(sample(Number.NaN))).toBeNull();
    expect(recorder.record(sample(-1))).toBeNull();
    expect(recorder.record(sample(4, 0))).toBeNull();
    expect(recorder.record(sample(4, Number.POSITIVE_INFINITY))).toBeNull();
    expect(recorder.pending).toBe(0);

    expect(recorder.record(sample(4))?.samples).toBe(1);
  });

  it('re-arms the warm-up on reset, for the frames after a pause', () => {
    const recorder = createFrameCostRecorder({ warmupFrames: 2, windowFrames: 1 });
    recorder.record(sample(9));
    recorder.record(sample(9));
    expect(recorder.record(sample(5))?.costP50).toBe(5);

    recorder.reset();

    expect(recorder.warmupRemaining).toBe(2);
    expect(recorder.latest).toBeNull();
    expect(recorder.record(sample(900))).toBeNull();
    expect(recorder.record(sample(900))).toBeNull();
  });

  it('defaults to a warm-up and a window that are long enough to mean something', () => {
    const recorder = createFrameCostRecorder();

    expect(recorder.warmupRemaining).toBe(DEFAULT_WARMUP_FRAMES);
    expect(
      DEFAULT_WINDOW_FRAMES,
      'tests/perf/budgets.spec.ts refuses to call fewer than 30 frames a measurement',
    ).toBeGreaterThanOrEqual(30);

    for (let frame = 0; frame < DEFAULT_WARMUP_FRAMES + DEFAULT_WINDOW_FRAMES - 1; frame += 1) {
      expect(recorder.record(sample(5))).toBeNull();
    }
    expect(recorder.record(sample(5))?.samples).toBe(DEFAULT_WINDOW_FRAMES);
  });

  it('clamps nonsense options rather than dividing by zero', () => {
    const recorder = createFrameCostRecorder({ warmupFrames: -5, windowFrames: 0 });

    expect(recorder.warmupRemaining).toBe(0);
    expect(recorder.record(sample(7))?.samples).toBe(1);
  });
});
