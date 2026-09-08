/**
 * The measurement half of the renderer probe: how expensive is a frame, really.
 *
 * Two numbers are sampled per frame, and keeping them apart is the point of this
 * file:
 *
 *   - **cost** — `POST_RENDER now` minus `PRE_STEP now`: the wall-clock time the
 *     engine spent stepping and drawing that frame. This is work.
 *   - **interval** — `PRE_STEP now` minus the previous `PRE_STEP now`: the
 *     cadence the browser actually delivered. This is vsync.
 *
 * Measuring only the interval, which is what a naive `requestAnimationFrame`
 * delta gives you, cannot answer the question this task asks. A healthy 60 Hz
 * display pins the interval at ~16.7 ms whether the GPU is idle or saturated, so
 * an interval-only probe reports the same number for a phone with 90% headroom
 * and one with 2%, and would place both in the same tier. Cost has no such
 * ceiling: on llvmpipe or SwiftShader the raster work lands inside the render
 * call and the cost climbs while the interval is still capped, right up until
 * frames start being missed. Cost is therefore what decides the tier, and
 * interval is what proves the device is holding a cadence at all — a machine
 * whose interval sits at 50 ms is dropping frames no matter how cheap each one
 * looks.
 *
 * ## The sequencing problem, and what was chosen
 *
 * The first frames are the most expensive and the least representative: shader
 * and pipeline compilation, the first texture uploads, font rasterisation, the
 * first GC, and on a cold tab the browser still parsing and laying out. A probe
 * that starts averaging at frame 0 places every device in the lowest tier.
 * Three defences, all here rather than in the policy:
 *
 *   1. **A warm-up discard.** The first `warmupFrames` completed frames are
 *      thrown away unmeasured. They are real cost, but they are one-off cost.
 *   2. **A median, not a mean.** A single 400 ms GC pause moves a 30-sample mean
 *      by 13 ms — enough on its own to demote a healthy device a whole tier. It
 *      moves the median by nothing. `costP95` is kept alongside as a separate,
 *      looser guard so that consistently spiky frames still count against a
 *      device: the median says "the normal frame", p95 says "the bad frame".
 *   3. **A re-evaluation window.** The recorder emits a summary every
 *      `windowFrames` frames, for as long as it is running, rather than deciding
 *      once and stopping. The first window is a starting point, not a verdict;
 *      `visual-tier.ts` applies hysteresis across windows so a device that warms
 *      up gets promoted and one that thermally throttles gets demoted.
 *
 * Pure: no timers, no `performance`, no rAF, no Phaser. Timestamps arrive as
 * arguments, which is what makes every branch of the sequencing logic above
 * testable without a browser and without waiting 30 real frames.
 */

/** One frame's worth of measurement. Both in milliseconds. */
export interface FrameSample {
  /** Engine work: step plus render. Bounded below by 0, never by vsync. */
  readonly costMs: number;
  /** Delivered cadence: the gap since the previous frame started. */
  readonly intervalMs: number;
}

export interface FrameCostSummary {
  /** How many samples this summary is made of, after the warm-up discard. */
  readonly samples: number;
  /** Median engine cost. The number the tier is chosen from. */
  readonly costP50: number;
  /** 95th-percentile engine cost. The spiky-frame guard. */
  readonly costP95: number;
  /** Median delivered frame interval. The "is it holding a cadence" check. */
  readonly intervalP50: number;
  /** The single worst frame in the window. Diagnostic only; never a decision. */
  readonly worstCostMs: number;
}

/**
 * Frames discarded before anything is measured.
 *
 * Ten rather than one: on a cold WebGL context the pipeline warm-up is spread
 * over the first handful of frames, not concentrated in the first, and Phaser's
 * scale manager settles its display size in the first few too. Ten frames is
 * ~170 ms at 60 Hz, which is invisible against the 6 s time-to-play budget.
 */
export const DEFAULT_WARMUP_FRAMES = 10;

/**
 * Frames per measurement window.
 *
 * Thirty is the same floor `tests/perf/budgets.spec.ts` uses before it will call
 * a sample a measurement, and it is the smallest window where a median is not
 * itself noise. At 60 Hz a window is half a second, so a device that degrades
 * mid-level is caught within one.
 */
export const DEFAULT_WINDOW_FRAMES = 30;

/**
 * Nearest-rank percentile over an unsorted list. `p` is 0..1.
 *
 * Nearest-rank rather than an interpolating percentile because these samples are
 * a small window of real observations, and reporting a frame time that no frame
 * actually took would make the debug readout unfalsifiable against a trace.
 * Returns 0 for an empty list; callers never summarise an empty window.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  const rank = Math.ceil(clamped * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
}

/** Summarise a window. `null` for an empty window — an unmeasured tier is not a tier. */
export function summariseFrames(samples: readonly FrameSample[]): FrameCostSummary | null {
  if (samples.length === 0) return null;
  const costs = samples.map((sample) => sample.costMs);
  const intervals = samples.map((sample) => sample.intervalMs);

  return {
    samples: samples.length,
    costP50: percentile(costs, 0.5),
    costP95: percentile(costs, 0.95),
    intervalP50: percentile(intervals, 0.5),
    worstCostMs: costs.reduce((worst, cost) => Math.max(worst, cost), 0),
  };
}

/**
 * Turns raw frame-boundary timestamps into samples.
 *
 * Separate from the recorder because the failure modes are different: this is
 * where a missing `begin`, a duplicated `end`, a non-finite timestamp or a clock
 * that went backwards are dropped, and none of those should be able to reach the
 * statistics. A dropped frame is better than a fabricated one.
 */
export interface FrameTimer {
  /** Called at the start of the engine's step. */
  begin(nowMs: number): void;
  /** Called after the engine's render. `null` when this frame cannot be trusted. */
  end(nowMs: number): FrameSample | null;
  reset(): void;
}

/**
 * Above this interval, the gap was not a frame.
 *
 * A backgrounded tab, the rotate overlay pausing the game, a breakpoint in the
 * debugger and a laptop lid closing all produce one enormous interval on resume.
 * Recording it would demote a healthy device to the lowest tier for a gap in
 * which nothing was drawn at all.
 *
 * The second clause is what keeps this from hiding a genuinely terrible device:
 * the sample is only dropped when the engine was *not* the one spending the
 * time (`costMs` under half the interval). A device that really does take 1.2 s
 * to render a frame spends that time inside the render call, so its cost tracks
 * its interval, and it is measured and demoted exactly as it should be.
 */
export const MAX_PLAUSIBLE_INTERVAL_MS = 1_000;

export function createFrameTimer(): FrameTimer {
  let startedAt: number | null = null;
  let previousStart: number | null = null;

  return {
    begin(nowMs: number): void {
      /* A second `begin` without an `end` abandons the first: the frame it
         opened was never rendered, so it has no cost worth recording. */
      startedAt = Number.isFinite(nowMs) ? nowMs : null;
    },

    end(nowMs: number): FrameSample | null {
      const began = startedAt;
      startedAt = null;
      /* No matching begin, or a clock that is not a clock: not a frame. */
      if (began === null || !Number.isFinite(nowMs)) return null;
      /* The first frame has no previous start, so it has no interval to report. */
      if (previousStart === null) {
        previousStart = began;
        return null;
      }
      const costMs = nowMs - began;
      const intervalMs = began - previousStart;
      previousStart = began;
      /* A backwards clock is dropped, not clamped: it is not a slow frame. */
      if (costMs < 0 || intervalMs <= 0) return null;
      /* A gap rather than a frame — see MAX_PLAUSIBLE_INTERVAL_MS. */
      if (intervalMs > MAX_PLAUSIBLE_INTERVAL_MS && costMs < intervalMs / 2) return null;
      return { costMs, intervalMs };
    },

    reset(): void {
      startedAt = null;
      previousStart = null;
    },
  };
}

export interface FrameCostRecorderOptions {
  readonly warmupFrames?: number;
  readonly windowFrames?: number;
}

export interface FrameCostRecorder {
  /** Warm-up frames still to be discarded. Zero once measurement has begun. */
  readonly warmupRemaining: number;
  /** Samples collected towards the current window. */
  readonly pending: number;
  /** How many windows have completed. The re-evaluation counter. */
  readonly windows: number;
  /** The most recent completed window, or `null` before the first one closes. */
  readonly latest: FrameCostSummary | null;
  /** Feed one frame. Returns a summary only on the frame that completes a window. */
  record(sample: FrameSample): FrameCostSummary | null;
  /** Drop the current window and re-arm the warm-up. Used when the tab resumes. */
  reset(): void;
}

/**
 * A rolling window recorder: discard the warm-up, then emit a summary every
 * `windowFrames` frames.
 *
 * Non-finite and negative costs are rejected here as well as in the timer —
 * this is the last gate before the statistics, and a `NaN` reaching `percentile`
 * would silently poison a sort and hand back a plausible-looking number.
 */
export function createFrameCostRecorder(
  options: FrameCostRecorderOptions = {},
): FrameCostRecorder {
  const warmupFrames = Math.max(0, Math.floor(options.warmupFrames ?? DEFAULT_WARMUP_FRAMES));
  const windowFrames = Math.max(1, Math.floor(options.windowFrames ?? DEFAULT_WINDOW_FRAMES));

  let warmupRemaining = warmupFrames;
  let window: FrameSample[] = [];
  let windows = 0;
  let latest: FrameCostSummary | null = null;

  return {
    get warmupRemaining(): number {
      return warmupRemaining;
    },
    get pending(): number {
      return window.length;
    },
    get windows(): number {
      return windows;
    },
    get latest(): FrameCostSummary | null {
      return latest;
    },

    record(sample: FrameSample): FrameCostSummary | null {
      if (
        !Number.isFinite(sample.costMs) ||
        !Number.isFinite(sample.intervalMs) ||
        sample.costMs < 0 ||
        sample.intervalMs <= 0
      ) {
        return null;
      }

      if (warmupRemaining > 0) {
        warmupRemaining -= 1;
        return null;
      }

      window.push(sample);
      if (window.length < windowFrames) return null;

      const summary = summariseFrames(window);
      window = [];
      windows += 1;
      latest = summary;
      return summary;
    },

    reset(): void {
      warmupRemaining = warmupFrames;
      window = [];
      latest = null;
    },
  };
}
