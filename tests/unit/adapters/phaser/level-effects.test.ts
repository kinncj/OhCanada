/**
 * Where ADR-0011 stops being theory.
 *
 * The renderer probe measured a frame cost and chose a tier, and until now
 * nothing spent it: the effect registry was empty because slice 0 had nothing to
 * degrade. This suite asserts the two things a level actually gives it to do —
 * fewer parallax layers and fewer particles — and it asserts them against the
 * three real presets in `content/game.config.json` rather than against numbers
 * invented here, so re-tuning a tier is a content edit and this still holds.
 *
 * It also asserts the shape ADR-0011 requires of every effect: a `plain` path
 * that stands on its own. `plan()` answers "what would this device draw" without
 * drawing it, which is the only way to check the no-Filter behaviour on a
 * machine with no GPU.
 */

import { describe, expect, it } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { GraphicsPresets, ParallaxLayer } from '@application/ports';

import {
  createLevelEffects,
  particleBudget,
  selectLayers,
  type EmitterTarget,
  type ScrollTarget,
  type TintTarget,
} from '@adapters/phaser/level-effects';
import { applyEffect } from '@adapters/phaser/visual-effects';
import {
  PHONE_PARTICLE_CEILING,
  resolveRenderProfile,
  type RenderProfile,
  type VisualTier,
} from '@adapters/phaser/visual-tier';

const PRESETS = (gameConfigJson as { graphicsPresets: GraphicsPresets }).graphicsPresets;

const profileFor = (
  tier: VisualTier,
  motion: 'full' | 'reduced' = 'full',
  formFactor: 'phone' | 'large' = 'phone',
): RenderProfile =>
  resolveRenderProfile({ tier, motion, formFactor, presets: PRESETS, filtersAvailable: true });

const layer = (key: string, depth: number): ParallaxLayer => ({
  key,
  depth,
  scrollFactor: { x: depth / 100, y: depth / 200 },
  offset: { x: 0, y: depth * 10 },
  repeatX: true,
});

const SIX: readonly ParallaxLayer[] = [
  layer('far-hills', 10),
  layer('skyline', 20),
  layer('bridge', 30),
  layer('treeline', 40),
  layer('canal-bank', 50),
  layer('snowbank', 60),
];

describe('selectLayers', () => {
  it('keeps the highest depths, which is what the schema says', () => {
    expect(selectLayers(SIX, 2).map((entry) => entry.key)).toEqual(['canal-bank', 'snowbank']);
  });

  it('returns them in draw order, lowest depth first', () => {
    const kept = selectLayers(SIX, 4);
    expect(kept.map((entry) => entry.depth)).toEqual([30, 40, 50, 60]);
  });

  it('keeps everything when the budget is larger than the level', () => {
    expect(selectLayers(SIX, 12)).toHaveLength(6);
  });

  it('keeps nothing at zero, and does not throw doing it', () => {
    expect(selectLayers(SIX, 0)).toEqual([]);
    expect(selectLayers(SIX, -3)).toEqual([]);
  });

  it('sorts a document that authored its layers out of order', () => {
    const shuffled = [layer('b', 20), layer('a', 10), layer('c', 30)];
    expect(selectLayers(shuffled, 2).map((entry) => entry.key)).toEqual(['b', 'c']);
  });

  it.each([
    ['low', 2],
    ['medium', 4],
    ['high', 6],
  ] as const)('draws %s tier at the preset count (%i)', (tier, expected) => {
    expect(PRESETS[tier].parallaxLayers).toBe(expected);
    expect(selectLayers(SIX, profileFor(tier).parallaxLayers)).toHaveLength(expected);
  });

  it('draws one layer under reduced motion at every tier — scenery, not parallax', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      expect(selectLayers(SIX, profileFor(tier, 'reduced').parallaxLayers)).toHaveLength(1);
    }
  });
});

describe('particleBudget', () => {
  it('never exceeds the phone ceiling CLAUDE.md sets', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      expect(particleBudget(profileFor(tier), 10_000)).toBeLessThanOrEqual(PHONE_PARTICLE_CEILING);
    }
  });

  it('is zero under reduced motion', () => {
    expect(particleBudget(profileFor('high', 'reduced'), 400)).toBe(0);
  });

  it('honours a level that asks for fewer than the budget allows', () => {
    expect(particleBudget(profileFor('high', 'full', 'large'), 120)).toBe(120);
  });

  it('is zero rather than NaN for a nonsense request', () => {
    expect(particleBudget(profileFor('high'), Number.NaN)).toBe(0);
    expect(particleBudget(profileFor('high'), -5)).toBe(0);
  });
});

describe('the level registers effects, each with a path that needs no Filter', () => {
  const effects = createLevelEffects({ layers: SIX, requestedParticles: 420 });

  it('registers every effect this level needs', () => {
    expect([...effects.registry.ids()].sort()).toEqual(
      ['level.horizon-haze', 'level.surface-sheen', 'level.parallax-drift', 'level.snowfall'].sort(),
    );
  });

  it('every one of them has a plain path — the registry refuses anything else', () => {
    for (const effect of effects.registry.all()) {
      expect(effect.hasPlainPath).toBe(true);
      expect(typeof effect.plain).toBe('function');
    }
  });

  it('none of them needs a Filter, so the Canvas tier draws the same picture', () => {
    for (const effect of effects.registry.all()) {
      expect(effect.filtered).toBeUndefined();
    }
  });

  it('degrades as the tier falls, and the plan says exactly how', () => {
    const pathsAt = (tier: VisualTier): Record<string, string> =>
      Object.fromEntries(
        effects.registry.plan(profileFor(tier)).map((entry) => [entry.id, entry.path]),
      );

    expect(pathsAt('high')).toEqual({
      'level.parallax-drift': 'plain',
      'level.snowfall': 'plain',
      'level.horizon-haze': 'plain',
      'level.surface-sheen': 'plain',
    });
    expect(pathsAt('medium')['level.surface-sheen']).toBe('skipped');
    expect(pathsAt('low')).toEqual({
      'level.parallax-drift': 'plain',
      'level.snowfall': 'skipped',
      'level.horizon-haze': 'skipped',
      'level.surface-sheen': 'skipped',
    });
  });

  it('reduced motion skips the decorative effects and keeps the still ones', () => {
    const plan = Object.fromEntries(
      effects.registry.plan(profileFor('high', 'reduced')).map((entry) => [entry.id, entry.path]),
    );
    expect(plan['level.parallax-drift']).toBe('skipped');
    expect(plan['level.snowfall']).toBe('skipped');
    /* Reduced motion is a request about movement, not a request for a plainer
       game: the two `still` effects survive it. */
    expect(plan['level.horizon-haze']).toBe('plain');
    expect(plan['level.surface-sheen']).toBe('plain');
  });
});

describe('applying the effects does what the plan said', () => {
  const effects = createLevelEffects({ layers: SIX, requestedParticles: 420 });

  const scrollTarget = (layerKey: string): ScrollTarget & { layerKey: string; seen: number[][] } => {
    const seen: number[][] = [];
    return {
      layerKey,
      seen,
      setScrollFactor(x: number, y: number) {
        seen.push([x, y]);
      },
    };
  };

  it('gives a layer the scroll factor the level authored', () => {
    const target = scrollTarget('skyline');
    expect(applyEffect(effects.parallaxDrift, target, profileFor('high'))).toBe('plain');
    expect(target.seen).toEqual([[0.2, 0.1]]);
  });

  it('touches nothing for a key the level never declared', () => {
    const target = scrollTarget('not-a-layer');
    applyEffect(effects.parallaxDrift, target, profileFor('high'));
    expect(target.seen).toEqual([]);
  });

  it('leaves a layer pinned under reduced motion, because the effect never runs', () => {
    const target = scrollTarget('skyline');
    expect(applyEffect(effects.parallaxDrift, target, profileFor('high', 'reduced'))).toBe(
      'skipped',
    );
    expect(target.seen, 'reduced motion still applied a parallax factor').toEqual([]);
  });

  it('emits the tier-clamped number of flakes, and starts them', () => {
    let quantity = -1;
    let started = false;
    const emitter: EmitterTarget = {
      setQuantity(value) {
        quantity = value;
      },
      start() {
        started = true;
      },
    };

    applyEffect(effects.snowfall, emitter, profileFor('medium'));
    expect(quantity).toBe(PRESETS.medium.particles);
    expect(started).toBe(true);
  });

  it('never starts the snow at the low tier', () => {
    let started = false;
    const emitter: EmitterTarget = { setQuantity() {}, start() { started = true; } };
    expect(applyEffect(effects.snowfall, emitter, profileFor('low'))).toBe('skipped');
    expect(started).toBe(false);
  });

  it('never starts the snow under reduced motion', () => {
    let started = false;
    const emitter: EmitterTarget = { setQuantity() {}, start() { started = true; } };
    expect(applyEffect(effects.snowfall, emitter, profileFor('high', 'reduced'))).toBe('skipped');
    expect(started).toBe(false);
  });

  it('the still overlays set an alpha at the tier that affords them', () => {
    const alphas: number[] = [];
    const target: TintTarget = { setAlpha: (alpha) => alphas.push(alpha) };
    applyEffect(effects.surfaceSheen, target, profileFor('high'));
    applyEffect(effects.horizonHaze, target, profileFor('medium'));
    expect(alphas).toHaveLength(2);
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe('a level with one layer is still a level', () => {
  it('does not divide by zero deriving a placeholder shade', () => {
    const single = createLevelEffects({ layers: [layer('only', 1)], requestedParticles: 0 });
    expect(single.registry.size).toBe(4);
    expect(selectLayers([layer('only', 1)], 6)).toHaveLength(1);
  });
});
