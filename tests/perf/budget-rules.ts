import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { CensusContext, CensusFrame, CensusSnapshot } from './gl-census';
import { atMost, notMeasured, type Verdict } from './verdict';

/**
 * How a census becomes a verdict. One module, imported by the budget suite AND
 * by the calibration suite, so the code that is proved on synthetic scenes with
 * known answers is the code that judges the game - not a copy of it.
 *
 * Every rule below has the same three exits, in the same order:
 *
 *   1. could the number be taken at all? If not, NOT MEASURED, with the reason;
 *   2. is the number the identity of its fold? A covered area of 0 or a texture
 *      total of 0 bytes is "nothing happened", not "under budget" (ADR-0024);
 *   3. only then compare it to the limit.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MIB = 1_048_576;

/** CLAUDE.md, Budgets: "Overdraw <= 4x screen area per frame." */
export const OVERDRAW_LIMIT_SCREENS = 4;
/** CLAUDE.md, Budgets: "Decoded texture memory <= 64 MB per level on iPhone." Read as MiB, as the build gate does. */
export const TEXTURE_CEILING_BYTES = 64 * MIB;

export const OVERDRAW_BUDGET = 'overdraw <= 4x screen area per frame';
export const TEXTURE_BUDGET = 'decoded texture memory held by the GPU <= the level budget (64 MiB ceiling)';

/** The one context that draws to the page. Anything else is ambiguous and says so. */
export function drawingContext(snapshot: CensusSnapshot): CensusContext | string {
  const drawing = snapshot.contexts.filter((c) => c.attached && c.framesSeen > 0);
  if (drawing.length === 0) {
    const seen = snapshot.contexts.length;
    return seen === 0
      ? 'the page created no WebGL context, so the census saw no GPU work at all'
      : `the page created ${String(seen)} WebGL context(s) and none attached to the document drew a frame`;
  }
  if (drawing.length > 1) {
    return `${String(drawing.length)} attached WebGL contexts drew frames, so "screen area" has no single meaning`;
  }
  return drawing[0] as CensusContext;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};

export function overdrawVerdict(
  snapshot: CensusSnapshot,
  options: { readonly minFrames: number; readonly context?: string },
): Verdict {
  const context = drawingContext(snapshot);
  if (typeof context === 'string') return notMeasured(OVERDRAW_BUDGET, context);

  const frames: CensusFrame[] = snapshot.frames.filter((f) => f.context === context.index && f.draws > 0);
  if (frames.length < options.minFrames) {
    return notMeasured(
      OVERDRAW_BUDGET,
      `only ${String(frames.length)} frame(s) with draw calls were recorded, and ${String(options.minFrames)} ` +
        'are needed before a worst frame means anything',
    );
  }

  const undecoded = frames.flatMap((f) => f.undecoded);
  if (undecoded.length > 0) {
    const distinct = [...new Set(undecoded.map((u) => u.replace(/^draw \d+: /, '')))];
    return notMeasured(
      OVERDRAW_BUDGET,
      `${String(undecoded.length)} draw(s) could not be decoded to an area (${distinct.slice(0, 3).join('; ')}), ` +
        'so the covered area would be an undercount',
    );
  }

  const stale = frames.reduce((total, f) => total + f.staleReads, 0);
  if (stale > 0) {
    return notMeasured(
      OVERDRAW_BUDGET,
      `${String(stale)} draw(s) read positions from a dynamic buffer that nothing wrote that frame - the ` +
        'census has lost track of vertex state (the defect gl-census.ts describes), so its area is invented',
    );
  }

  if (frames.some((f) => f.screenPx <= 0)) {
    return notMeasured(OVERDRAW_BUDGET, 'a frame began with a zero-area viewport, so there is no screen to divide by');
  }

  const ratios = frames.map((f) => f.areaPx / f.screenPx);
  const worst = Math.max(...ratios);
  if (worst === 0) {
    return notMeasured(
      OVERDRAW_BUDGET,
      'every recorded frame covered zero pixels: nothing was drawn on screen, and nothing is not under budget',
    );
  }

  const worstFrame = frames[ratios.indexOf(worst)] as CensusFrame;
  const offscreen = Math.max(...frames.map((f) => f.offscreenAreaPx / f.screenPx));
  return atMost(
    OVERDRAW_BUDGET,
    worst,
    OVERDRAW_LIMIT_SCREENS,
    'x screen',
    `worst of ${String(frames.length)} frames, median ${median(ratios).toFixed(3)}x; ` +
      `${String(worstFrame.draws)} draw calls, ${String(worstFrame.triangles)} triangles in the worst frame; ` +
      `${offscreen.toFixed(3)}x screen drawn into framebuffer objects (reported, not counted as screen); ` +
      `${String(context.canvasWidth)}x${String(context.canvasHeight)} canvas, ${String(context.maxTextureUnits)} texture units` +
      (options.context === undefined ? '' : `; ${options.context}`),
  );
}

/** One change of the visual tier, as the page published it, at `performance.now()`. */
export interface TierChange {
  readonly t: number;
  readonly tier: string;
}

/**
 * Overdraw attributed frame by frame to the tier in effect when each frame began.
 *
 * Why not "wait for the tier to settle, then sample": on this runner it did not
 * settle. Measured 2026-09-13, at normal speed and at 4x CPU throttle alike, the
 * tier tracker ran a fixed cycle - `low` for 71 frames, `medium` for 41, forever.
 * The tracker now closes a tier after two failed attempts
 * (`createTierTracker`), so that host visits `medium` twice and then holds
 * `low`, and WHEN it settles still depends on how fast the runner is. A
 * settle-first design reported NOT MEASURED on every run, which is honest and
 * useless. Covered area is exact per frame, so it never needed a stable tier;
 * it needed each frame to be ATTRIBUTABLE to one. So every tier a host passes
 * through is judged, and a run pinned to one tier (`?e2e=1&tier=`) is the same
 * computation with one entry in `changes`.
 *
 * `edgeFrames` are dropped from both ends of every run of one tier: the frame on
 * which a profile is applied may still carry the previous tier's geometry.
 * Each tier with `minFrames` usable frames is judged by `overdrawVerdict` - the
 * calibrated rule - and the worst tier decides. If ANY tier's frames fail to
 * decode, the whole verdict is NOT MEASURED: an instrument that lost track on
 * one tier is not trusted on the other.
 */
export function overdrawByTier(
  snapshot: CensusSnapshot,
  changes: readonly TierChange[],
  options: { readonly minFrames: number; readonly edgeFrames: number; readonly context?: string },
): Verdict {
  const context = drawingContext(snapshot);
  if (typeof context === 'string') return notMeasured(OVERDRAW_BUDGET, context);
  if (changes.length === 0) {
    return notMeasured(OVERDRAW_BUDGET, 'the scene probe published no tier, so no frame can be attributed to one');
  }

  const ordered = [...changes].sort((a, b) => a.t - b.t);
  const tierAt = (t: number): string | null => {
    let found: string | null = null;
    for (const change of ordered) {
      if (change.t <= t) found = change.tier;
      else break;
    }
    return found;
  };

  const frames = snapshot.frames
    .filter((f) => f.context === context.index && f.draws > 0)
    .sort((a, b) => a.startedAt - b.startedAt);

  const runs: { tier: string; frames: CensusFrame[] }[] = [];
  for (const frame of frames) {
    const tier = tierAt(frame.startedAt);
    if (tier === null) continue;
    const last = runs.at(-1);
    if (last !== undefined && last.tier === tier) last.frames.push(frame);
    else runs.push({ tier, frames: [frame] });
  }

  const usable = new Map<string, CensusFrame[]>();
  const runLengths = new Map<string, number[]>();
  for (const run of runs) {
    runLengths.set(run.tier, [...(runLengths.get(run.tier) ?? []), run.frames.length]);
    const inner = run.frames.slice(options.edgeFrames, run.frames.length - options.edgeFrames);
    usable.set(run.tier, [...(usable.get(run.tier) ?? []), ...inner]);
  }

  const judged: { tier: string; verdict: Verdict; frames: number }[] = [];
  for (const [tier, tierFrames] of usable) {
    if (tierFrames.length < options.minFrames) continue;
    const verdict = overdrawVerdict({ contexts: snapshot.contexts, frames: tierFrames }, { minFrames: options.minFrames });
    if (verdict.status === 'not-measured') {
      return notMeasured(OVERDRAW_BUDGET, `at tier "${tier}": ${verdict.detail}`);
    }
    judged.push({ tier, verdict, frames: tierFrames.length });
  }

  const cycle = [...runLengths]
    .map(([tier, lengths]) => `${tier} ${String(lengths.length)} run(s) of ${String(Math.min(...lengths))}-${String(Math.max(...lengths))} frames`)
    .join(', ');
  if (judged.length === 0) {
    return notMeasured(
      OVERDRAW_BUDGET,
      `no tier kept ${String(options.minFrames)} usable frames once ${String(options.edgeFrames)} were dropped from each end of every run (${cycle || 'no attributable frames'})`,
    );
  }

  const worst = judged.reduce((a, b) => ((b.verdict.measured ?? 0) > (a.verdict.measured ?? 0) ? b : a));
  const perTier = judged
    .map((j) => `${j.tier} ${(j.verdict.measured ?? 0).toFixed(3)}x over ${String(j.frames)} frames`)
    .join('; ');
  const visited = new Set(runs.map((r) => r.tier));
  const unvisited = ['low', 'medium', 'high'].filter((tier) => !visited.has(tier));
  return {
    ...worst.verdict,
    detail:
      `worst tier "${worst.tier}". Per tier: ${perTier}. Tier changes in the window: ${String(Math.max(0, runs.length - 1))} (${cycle}). ` +
      `${unvisited.length === 0 ? 'Every tier was visited' : `NOT EXERCISED on this host: ${unvisited.join(', ')}`}. ` +
      `Worst frame: ${worst.verdict.detail}${options.context === undefined ? '' : `; ${options.context}`}`,
  };
}

/**
 * CLAUDE.md, Budgets: "Particles <= 400 phone, <= 1500 iPad/desktop."
 *
 * Restated rather than imported from `visual-tier.ts`: the adapter's own
 * ceilings are the thing under test, and a limit read from the code it limits
 * moves with that code.
 */
export const PARTICLE_LIMIT_PHONE = 400;
export const PARTICLE_LIMIT_LARGE = 1500;
export const PARTICLE_BUDGET = 'particles emitted <= 400 on a phone, <= 1500 on iPad and desktop';

/** What the page said about particles while it was watched. Attribute text, as read. */
export interface ParticleObservation {
  /** Every value `data-particles` - the EMITTED count - took, oldest first. */
  readonly emitted: readonly string[];
  /** `data-particle-allowance`: what the tier allowed. Context, never the number judged. */
  readonly allowance: string | null;
  readonly tier: string | null;
  readonly tierPinned: string | null;
  /** The canvas's `data-tn-form-factor`: which of the two limits applies. */
  readonly formFactor: string | null;
  readonly motion: string | null;
}

/**
 * The emitted particle count against the budget for the form factor the page
 * classified itself as.
 *
 * The same three exits as the rules above:
 *
 *   1. no form factor, no emitted count, or an emitted count that is not a
 *      count: NOT MEASURED;
 *   2. zero emitted: NOT MEASURED. The largest of the readings is a max, which
 *      is safe as a fold, but zero here means the level drew no weather at all -
 *      a level declaring `weather: "none"` (so this lane runs on a snowing one),
 *      snow off below `medium`, reduced motion on, or the scene never wrote the
 *      attribute's number - and none of those is a budget holding (ADR-0024);
 *   3. only then the largest emitted count against the limit.
 *
 * The allowance is reported and never judged. It is clamped to the device
 * ceiling by construction, so holding it to the budget is a tautology - that
 * was the defect when `data-particles` had two writers.
 */
export function particleVerdict(observation: ParticleObservation): Verdict {
  const { formFactor } = observation;
  const limit = formFactor === 'phone' ? PARTICLE_LIMIT_PHONE : formFactor === 'large' ? PARTICLE_LIMIT_LARGE : null;
  if (limit === null) {
    return notMeasured(
      PARTICLE_BUDGET,
      `the page published no form factor (data-tn-form-factor read ${String(formFactor)}), so there is no limit to hold it to`,
    );
  }

  const readings = observation.emitted.filter((value) => value !== 'unknown');
  const malformed = readings.filter((value) => !/^\d+$/.test(value));
  if (malformed.length > 0) {
    return notMeasured(
      PARTICLE_BUDGET,
      `data-particles read ${[...new Set(malformed)].slice(0, 3).join(', ')}, which is not a count`,
    );
  }
  if (readings.length === 0) {
    return notMeasured(
      PARTICLE_BUDGET,
      'the scene probe never published an emitted particle count (data-particles stayed unknown), so no level emitted anything this run could see',
    );
  }

  const at =
    `tier "${String(observation.tier)}"${observation.tierPinned === 'true' ? ' (pinned)' : ''}, ` +
    `allowance ${String(observation.allowance)}, motion ${String(observation.motion)}`;
  const worst = Math.max(...readings.map(Number));
  if (worst === 0) {
    return notMeasured(
      PARTICLE_BUDGET,
      `the level emitted no particles at ${at}: zero emitted is nothing to measure, not a budget held`,
    );
  }

  return atMost(
    PARTICLE_BUDGET,
    worst,
    limit,
    'particles',
    `largest emitted count over ${String(readings.length)} reading(s) at ${at}; form factor "${formFactor}" as the ` +
      `page classified it, so the ${String(limit)} limit applies`,
  );
}

interface ManifestLevel {
  readonly decodedByScale?: Readonly<Record<string, number>>;
}

/** The build gate's own prices for a level, read from the manifest the build wrote. */
export function manifestPrices(levelId: string, manifestPath = `${REPO_ROOT}assets/dist/manifest.json`): Readonly<Record<string, number>> | string {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { levels?: Record<string, ManifestLevel> };
    const prices = manifest.levels?.[levelId]?.decodedByScale;
    return prices === undefined ? `the manifest has no decodedByScale for "${levelId}"` : prices;
  } catch (error) {
    return `the manifest could not be read (${String(error)})`;
  }
}

/** The lower of the level document's `textureBudgetBytes` and the CLAUDE.md ceiling, as the build gate applies it. */
export function levelTextureLimit(levelId: string): { readonly bytes: number; readonly source: string } {
  try {
    const level = JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${levelId}.json`, 'utf8')) as {
      textureBudgetBytes?: number;
    };
    const declared = level.textureBudgetBytes;
    if (typeof declared === 'number' && declared > 0 && declared < TEXTURE_CEILING_BYTES) {
      return { bytes: declared, source: `content/levels/${levelId}.json textureBudgetBytes` };
    }
  } catch {
    /* fall through to the ceiling, and say so */
  }
  return { bytes: TEXTURE_CEILING_BYTES, source: 'the CLAUDE.md 64 MiB ceiling' };
}

export function textureVerdict(
  snapshot: CensusSnapshot,
  limit: { readonly bytes: number; readonly source: string },
  prices: Readonly<Record<string, number>> | string,
): Verdict {
  if (snapshot.contexts.length === 0) {
    return notMeasured(TEXTURE_BUDGET, 'the page created no WebGL context, so no texture was ever counted');
  }
  const unsized = snapshot.contexts.flatMap((c) => c.unsizedUploads);
  if (unsized.length > 0) {
    return notMeasured(
      TEXTURE_BUDGET,
      `${String(unsized.length)} allocation(s) could not be sized (${[...new Set(unsized)].slice(0, 3).join('; ')}), ` +
        'so any total would be an undercount',
    );
  }

  /* GPU memory belongs to the device, not to a canvas, so every context counts. */
  const peak = snapshot.contexts.reduce((total, c) => total + c.peakTextureBytes, 0);
  const renderbuffers = snapshot.contexts.reduce((total, c) => total + c.renderbufferBytes, 0);
  const live = snapshot.contexts.reduce((total, c) => total + c.liveTextures, 0);
  if (peak === 0) {
    return notMeasured(
      TEXTURE_BUDGET,
      'zero texture bytes were uploaded: the level drew no art, and 0 bytes is not under budget',
    );
  }

  let reconciliation: string;
  if (typeof prices === 'string') {
    reconciliation = `not reconciled with the build gate: ${prices}`;
  } else {
    const [scale, priced] = Object.entries(prices).reduce<[string, number]>(
      (best, entry) => (Math.abs(entry[1] - peak) < Math.abs(best[1] - peak) ? entry : best),
      ['?', Number.POSITIVE_INFINITY],
    );
    const unpriced = peak - priced;
    reconciliation =
      `the build gate prices this level at ${(priced / MIB).toFixed(3)} MiB for a ${scale}x device; ` +
      (unpriced >= 0
        ? `${String(unpriced)} B the GPU holds are priced by no build gate`
        : `the GPU holds ${String(-unpriced)} B LESS than the manifest prices, so some priced art never uploaded`);
  }

  return atMost(
    TEXTURE_BUDGET,
    peak / MIB,
    limit.bytes / MIB,
    'MiB',
    `peak across ${String(snapshot.contexts.length)} context(s), ${String(live)} live texture(s); ` +
      `limit from ${limit.source}; ${reconciliation}; renderbuffers ${(renderbuffers / MIB).toFixed(3)} MiB on top`,
  );
}
