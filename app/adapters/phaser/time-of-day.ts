/**
 * The world's own clock, as a modulation of the level's authored palette.
 *
 * A level opened at 21:00 reads as evening; one opened at 08:00 reads as
 * morning. The whole feature is the device clock and five colour blends — no
 * network, no location, no permission prompt, nothing to consent to.
 *
 * ## Why it tints rather than authoring a second palette
 *
 * Each level document carries one `theme`, and those five colours were derived
 * from measured references (`assets/style/<level>.md`). A night palette would be
 * a second set of authored colours nobody measured, per level, and it would drift
 * from the first the moment either changed. So there is one authored palette and
 * this modulates it, with a ceiling — {@link MAX_NIGHT_BLEND} — that
 * `tests/unit/adapters/phaser/time-of-day.test.ts` asserts across the whole day
 * rather than at the one phase somebody looked at. The art still has to read;
 * a heavy blue wash would throw away the thing the references were for.
 *
 * `ink` and `inkMuted` are deliberately **not** tinted. They are what on-canvas
 * contrast is measured against, and dimming them would trade an easter egg for a
 * legibility defect (CLAUDE.md, Accessibility).
 *
 * ## Cost
 *
 * Zero per frame. The phase is recomputed on a {@link PHASE_REFRESH_MS} timer,
 * the palette is five blends, and the scene repaints only when a channel
 * actually changed — most refreshes produce the same 8-bit colours and do
 * nothing at all. No texture is created, so the decoded-texture budget
 * (ADR-0013) is untouched, and no draw is added, so the visual tier measures the
 * same frame it measured before.
 *
 * ## The clock is an untrusted input
 *
 * A device with a dead RTC, a spoofed clock, an `Invalid Date`, a timezone
 * change halfway through a session and the roll over midnight all arrive here.
 * {@link dayPhase} answers an unreadable clock with midday — the phase the art
 * was drawn under — rather than throwing, and {@link easePhase} bounds how fast
 * the phase may move so a timezone change drifts instead of cutting.
 *
 * ## The weather seam, and the call site that does not exist
 *
 * {@link SkyConditions} is an object rather than a bare `phase: number`
 * precisely so that a future "it is snowing where you are" has a field to arrive
 * in and this signature does not change when it does. **Nothing fetches
 * weather and nothing here will.** Live weather needs a third-party request that
 * hands the player's IP — so roughly their location — to somebody else, and
 * CLAUDE.md is local only: no accounts, no server, no analytics. For an app
 * aimed at newcomers that default is the point rather than a technicality. If it
 * is ever built it is an explicit opt-in setting owned by `app/ui` and
 * `app/bootstrap`, it arrives as one more field on this interface, and this file
 * still makes no request.
 */

import type { ThemeColours } from '@application/ports';

import { blendColors, toCssColor, toPhaserColor } from './boot-config';

/**
 * What the sky is doing, as data.
 *
 * One field today. See the header for why it is a record and not a number.
 */
export interface SkyConditions {
  /** 0 at local midnight, 0.5 at local noon. Values outside 0..1 wrap. */
  readonly phase: number;
}

/** How often the scene re-reads the clock. */
export const PHASE_REFRESH_MS = 5_000;

/**
 * The furthest the phase may move in one refresh.
 *
 * Chosen against the two things it has to separate: a natural refresh moves the
 * phase by `PHASE_REFRESH_MS / 86 400 000` — far inside this — while a timezone
 * change moves it by up to half a day, which has to be spread over minutes
 * instead of cutting between two frames.
 */
export const MAX_PHASE_STEP = 0.002;

/**
 * The most of a colour's journey to an anchor the tint may ever take.
 *
 * The number the ceiling test asserts. Raising it is a visible art-direction
 * decision, which is why it is one exported constant and not five literals
 * buried in a blend.
 */
export const MAX_NIGHT_BLEND = 0.45;

/**
 * Where each palette colour is pulled toward at night, and how far.
 *
 * Two anchors, not per-level: a deep indigo for night and a low warm sun for the
 * two horizon crossings. They are engine constants because they describe
 * *light*, which is the same everywhere, while the palette describes the *place*,
 * which is not.
 */
const NIGHT_ANCHOR = 0x101a33;
const GOLDEN_ANCHOR = 0xffb066;

/** Per-colour share of {@link MAX_NIGHT_BLEND}. The sky moves most; the ground least. */
const NIGHT_SHARE: Readonly<Record<'sky' | 'ground' | 'horizon', number>> = {
  sky: 1,
  ground: 0.62,
  horizon: 0.5,
};

/** Per-colour warmth at the horizon crossings. Small: this is a wash, not a filter. */
const GOLDEN_SHARE: Readonly<Record<'sky' | 'ground' | 'horizon', number>> = {
  sky: 0.16,
  ground: 0.1,
  horizon: 0.2,
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** `x mod 1`, positive. `-0.2` is `0.8`, which is what a clock means by it. */
const wrap01 = (value: number): number => ((value % 1) + 1) % 1;

/**
 * The local time of day as a fraction, 0 at midnight.
 *
 * Local, not UTC: the feature is "the player's evening", and a player in
 * Vancouver and one in Halifax do not share one. An unreadable clock answers
 * 0.5 — full daylight, which is what the art was drawn under and the most
 * legible thing to show somebody whose device is simply wrong.
 */
export function dayPhase(now: Date | number): number {
  const date = typeof now === 'number' ? new Date(now) : now;
  const time = date.getTime();
  if (!Number.isFinite(time)) return 0.5;
  const seconds =
    date.getHours() * 3600 +
    date.getMinutes() * 60 +
    date.getSeconds() +
    date.getMilliseconds() / 1000;
  return wrap01(seconds / 86_400);
}

/**
 * How much light there is, 0 at solar midnight and 1 at noon.
 *
 * A raised cosine, which is continuous across midnight by construction — the
 * property that makes 23:59 to 00:01 a two-minute change rather than the
 * discontinuity a piecewise table of "morning / afternoon / evening" would give.
 */
export function daylight(phase: number): number {
  const p = wrap01(Number.isFinite(phase) ? phase : 0.5);
  return clamp01((1 - Math.cos(2 * Math.PI * p)) / 2);
}

/**
 * How close this is to a horizon crossing, 0 at noon and at midnight.
 *
 * Measured in *light* rather than in hours, so it peaks wherever the sun is
 * actually crossing rather than at a fixed 06:00 and 18:00.
 */
export function goldenness(phase: number): number {
  const light = daylight(phase);
  return clamp01(1 - Math.abs(light - 0.5) / 0.25);
}

/**
 * The authored palette under this sky.
 *
 * Night first, then warmth over it: the golden wash belongs on top of the
 * darkening, the way low sun sits on a dimming sky rather than under it.
 */
export function tintPalette(palette: ThemeColours, conditions: SkyConditions): ThemeColours {
  const night = 1 - daylight(conditions.phase);
  const golden = goldenness(conditions.phase);

  const shade = (hex: string, key: 'sky' | 'ground' | 'horizon'): string => {
    const base = toPhaserColor(hex);
    const darkened = blendColors(base, NIGHT_ANCHOR, night * MAX_NIGHT_BLEND * NIGHT_SHARE[key]);
    return toCssColor(blendColors(darkened, GOLDEN_ANCHOR, golden * GOLDEN_SHARE[key]));
  };

  return {
    sky: shade(palette.sky, 'sky'),
    ground: shade(palette.ground, 'ground'),
    horizon: shade(palette.horizon, 'horizon'),
    /* Untinted on purpose. See the header. */
    ink: palette.ink,
    inkMuted: palette.inkMuted,
  };
}

/**
 * Move `current` toward `target` by at most `maxStep`, the short way round.
 *
 * A day is a circle, so 0.999 to 0.001 is 0.002 and not 0.998. That single line
 * is what makes midnight a non-event; the bound is what makes a timezone change
 * one too.
 */
export function easePhase(current: number, target: number, maxStep: number): number {
  if (!Number.isFinite(target)) return Number.isFinite(current) ? wrap01(current) : 0.5;
  const to = wrap01(target);
  if (!Number.isFinite(current)) return to;
  const from = wrap01(current);
  const step = Number.isFinite(maxStep) && maxStep > 0 ? maxStep : 1;

  /* Signed distance in -0.5 .. 0.5: the short way, whichever way that is. */
  let delta = to - from;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;

  if (Math.abs(delta) <= step) return to;
  return wrap01(from + Math.sign(delta) * step);
}
