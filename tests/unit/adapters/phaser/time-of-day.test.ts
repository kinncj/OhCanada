/**
 * The easter egg, and the two things that keep it from being a gimmick.
 *
 * The user asked for a game that follows the real world. The honest, local,
 * privacy-free half of that is the device clock: a level opened at 21:00 reads
 * as evening and one opened at 08:00 reads as morning. What must NOT happen is
 * that the tint replaces the art direction — the palettes were derived from
 * measured references (`assets/style/*-level.md`), so this modulates them and
 * has a stated ceiling it cannot cross, asserted below.
 *
 * The second half is that a clock is an untrusted input. A device set to the
 * wrong year, a `NaN` date, a timezone change halfway through a session and the
 * roll over midnight all arrive here, and every one of them has to leave a
 * playable scene rather than a black one or a jump.
 */

import { describe, expect, it } from 'vitest';

import type { ThemeColours } from '@application/ports';

import { toPhaserColor } from '@adapters/phaser/boot-config';
import {
  MAX_NIGHT_BLEND,
  MAX_PHASE_STEP,
  PHASE_REFRESH_MS,
  dayPhase,
  daylight,
  easePhase,
  goldenness,
  tintPalette,
} from '@adapters/phaser/time-of-day';

/** Ottawa's, as a representative authored palette. Any five colours would do. */
const PALETTE: ThemeColours = {
  sky: '#8fb8d8',
  ground: '#e6eef4',
  horizon: '#ffd9a0',
  ink: '#12222e',
  inkMuted: '#5b7183',
};

const at = (hours: number, minutes = 0): Date => {
  const date = new Date(2026, 0, 15, hours, minutes, 0, 0);
  return date;
};

/** Channel distance, 0..255 per channel, summed. What "how far did it move" means. */
const distance = (from: string, to: string): number => {
  const a = toPhaserColor(from);
  const b = toPhaserColor(to);
  return (
    Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)) +
    Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)) +
    Math.abs((a & 0xff) - (b & 0xff))
  );
};

describe('dayPhase', () => {
  it('is 0 at local midnight and 0.5 at local noon', () => {
    expect(dayPhase(at(0, 0))).toBeCloseTo(0, 6);
    expect(dayPhase(at(12, 0))).toBeCloseTo(0.5, 6);
  });

  it('is monotonic through the day and wraps rather than exceeding 1', () => {
    const samples = [0, 3, 6, 9, 12, 15, 18, 21, 23].map((hour) => dayPhase(at(hour)));
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThan(samples[index - 1] as number);
    }
    expect(samples.at(-1)).toBeLessThan(1);
  });

  it('reads local time, not UTC', () => {
    /* The whole point is "the player's evening", so the hour that matters is the
       one on the device. Asserted by construction: the `Date` above is built
       from local components, so a UTC reader would disagree wherever the
       machine is not on UTC — and would agree here only by coincidence. */
    const noon = at(12, 0);
    expect(dayPhase(noon)).toBeCloseTo(
      (noon.getHours() * 3600 + noon.getMinutes() * 60 + noon.getSeconds()) / 86_400,
      6,
    );
  });

  it('answers a wildly wrong or unreadable clock with the neutral, legible phase', () => {
    /* A device with no battery-backed clock, a spoofed one, or an `Invalid
       Date`. The scene still has to be playable, and the most legible answer is
       full daylight, which is what the art was drawn under. */
    expect(dayPhase(new Date(Number.NaN))).toBe(0.5);
    expect(dayPhase(Number.NaN)).toBe(0.5);
    /* A clock set to 1904 is not an error — it is a time — and it produces a
       phase like any other rather than a special case. */
    expect(dayPhase(new Date(1904, 5, 6, 12, 0, 0))).toBeCloseTo(0.5, 6);
  });
});

describe('daylight and goldenness', () => {
  it('peaks at noon, bottoms at midnight and is continuous across midnight', () => {
    expect(daylight(0.5)).toBeCloseTo(1, 3);
    expect(daylight(0)).toBeCloseTo(0, 3);
    expect(Math.abs(daylight(0.999) - daylight(0.001))).toBeLessThan(0.01);
  });

  it('puts 08:00 in the light and 21:00 in the dark', () => {
    expect(daylight(dayPhase(at(8)))).toBeGreaterThan(0.6);
    expect(daylight(dayPhase(at(21)))).toBeLessThan(0.3);
  });

  it('warms only near the horizon crossings', () => {
    expect(goldenness(0.25)).toBeGreaterThan(0.9);
    expect(goldenness(0.75)).toBeGreaterThan(0.9);
    expect(goldenness(0.5)).toBe(0);
    expect(goldenness(0)).toBe(0);
  });

  it('never leaves 0..1, whatever it is given', () => {
    for (const phase of [-3, -0.2, 1.4, 7, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(daylight(phase)).toBeGreaterThanOrEqual(0);
      expect(daylight(phase)).toBeLessThanOrEqual(1);
      expect(goldenness(phase)).toBeGreaterThanOrEqual(0);
      expect(goldenness(phase)).toBeLessThanOrEqual(1);
    }
  });
});

describe('tintPalette', () => {
  it('leaves the authored palette alone at midday', () => {
    const tinted = tintPalette(PALETTE, { phase: 0.5 });
    expect(tinted.sky).toBe(PALETTE.sky);
    expect(tinted.ground).toBe(PALETTE.ground);
  });

  it('darkens the sky at night and lightens it again by morning', () => {
    const night = tintPalette(PALETTE, { phase: 0 });
    const morning = tintPalette(PALETTE, { phase: dayPhase(at(8)) });
    expect(distance(night.sky, PALETTE.sky)).toBeGreaterThan(
      distance(morning.sky, PALETTE.sky),
    );
  });

  it('never moves a colour further than the stated ceiling', () => {
    /**
     * The art direction is the thing being protected. `MAX_NIGHT_BLEND` is a
     * blend fraction toward one fixed anchor, so the furthest any channel can
     * travel is that fraction of the distance to the anchor — and this asserts
     * it over the whole day rather than at the one phase somebody looked at.
     */
    for (let step = 0; step <= 96; step += 1) {
      const phase = step / 96;
      const tinted = tintPalette(PALETTE, { phase });
      for (const key of ['sky', 'ground', 'horizon'] as const) {
        const moved = distance(tinted[key], PALETTE[key]);
        expect(
          moved / (3 * 255),
          `${key} moved ${String(moved)} channel steps at phase ${phase.toFixed(3)}, which is ` +
            'more than a modulation of an authored palette — it is a repaint of it.',
        ).toBeLessThanOrEqual(MAX_NIGHT_BLEND);
      }
    }
  });

  it('does not touch the two ink colours', () => {
    /* Ink is what on-canvas contrast is measured against; a tint that dimmed it
       would trade an easter egg for a legibility defect. */
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      const tinted = tintPalette(PALETTE, { phase });
      expect(tinted.ink).toBe(PALETTE.ink);
      expect(tinted.inkMuted).toBe(PALETTE.inkMuted);
    }
  });

  it('is a pure function of the conditions it is given', () => {
    expect(tintPalette(PALETTE, { phase: 0.2 })).toEqual(tintPalette(PALETTE, { phase: 0.2 }));
  });
});

describe('easePhase', () => {
  it('takes the short way round midnight rather than the long way through noon', () => {
    /* 23:59 to 00:01 is two minutes, not twenty-three hours and fifty-eight.
       The target is far enough away that the step does not simply arrive, so the
       assertion is about the *direction* travelled and not about the distance. */
    const next = easePhase(0.999, 0.02, MAX_PHASE_STEP);
    expect(next).toBeLessThan(0.5);
    expect(next).toBeCloseTo(0.001, 6);
    /* And a step that can arrive, arrives. */
    expect(easePhase(0.999, 0.001, MAX_PHASE_STEP)).toBeCloseTo(0.001, 6);
  });

  it('bounds a timezone change so the sky drifts instead of jumping', () => {
    /* A three-hour jump is 0.125 of a day and would be a visible cut. */
    const next = easePhase(0.5, 0.625, MAX_PHASE_STEP);
    expect(next - 0.5).toBeLessThanOrEqual(MAX_PHASE_STEP + 1e-9);
    expect(next).toBeGreaterThan(0.5);
  });

  it('converges, and in a bounded number of refreshes', () => {
    let phase = 0.5;
    let steps = 0;
    while (Math.abs(phase - 0.625) > 1e-6 && steps < 10_000) {
      phase = easePhase(phase, 0.625, MAX_PHASE_STEP);
      steps += 1;
    }
    expect(phase).toBeCloseTo(0.625, 5);
    const minutes = (steps * PHASE_REFRESH_MS) / 60_000;
    expect(
      minutes,
      'a timezone change takes longer than a session to settle, which is a stuck sky rather ' +
        'than a smooth one',
    ).toBeLessThan(10);
  });

  it('holds still when it is already there, and survives nonsense', () => {
    expect(easePhase(0.25, 0.25, MAX_PHASE_STEP)).toBeCloseTo(0.25, 9);
    expect(easePhase(Number.NaN, 0.25, MAX_PHASE_STEP)).toBe(0.25);
    expect(easePhase(0.25, Number.NaN, MAX_PHASE_STEP)).toBe(0.25);
  });

  it('refreshes often enough that a natural minute is never a visible step', () => {
    /* One refresh of real time moves the phase by this much; it must be far
       inside the bound, or the bound would be throttling the actual clock. */
    const natural = PHASE_REFRESH_MS / 86_400_000;
    expect(natural).toBeLessThan(MAX_PHASE_STEP / 4);
  });
});
