/**
 * Every effect has a path that uses no Filter, and that path is what a Canvas
 * device, a software rasteriser and the low tier actually get.
 *
 * The tests below use fake effects rather than the real registry, and that is
 * deliberate: today the registry is empty (slice 0 draws a gradient and some
 * hills, no effects), and a suite that iterated an empty registry would report
 * a green tick for having checked nothing. What is asserted here is the
 * *machinery* — the selection rules and the two runtime guards — and the
 * companion suite `filters-have-a-plain-path.test.ts` is what stops task 1.13
 * from reaching for a Filter without going through it. Between them there is no
 * gap: you cannot declare a Filter-only effect (this file), and you cannot skip
 * declaring one (that file).
 */

import { describe, expect, it, vi } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { GraphicsPresets } from '@application/ports';

import {
  applyEffect,
  createEffectRegistry,
  defineEffect,
  selectEffectPath,
  type EffectApply,
  type VisualEffectDefinition,
} from '@adapters/phaser/visual-effects';
import {
  resolveRenderProfile,
  type MotionLevel,
  type RenderProfile,
  type VisualTier,
} from '@adapters/phaser/visual-tier';

const PRESETS = (gameConfigJson as { graphicsPresets: GraphicsPresets }).graphicsPresets;

const profile = (
  tier: VisualTier,
  motion: MotionLevel = 'full',
  filtersAvailable = true,
): RenderProfile =>
  resolveRenderProfile({ tier, motion, formFactor: 'large', presets: PRESETS, filtersAvailable });

/** A target that records which path drew it. Stands in for a Phaser object. */
interface Marks {
  drawn: string[];
}

/**
 * `filtered` is spelled `| undefined` rather than `?` because
 * `exactOptionalPropertyTypes` makes the two different: passing
 * `{ filtered: undefined }` is how a test says "this effect has no Filter path",
 * and an optional property would reject it.
 */
type GlowOverrides = Partial<Omit<VisualEffectDefinition<Marks>, 'filtered'>> & {
  filtered?: EffectApply<Marks> | undefined;
};

const glow = (overrides: GlowOverrides = {}) =>
  defineEffect<Marks>({
    id: 'crest-glow',
    intent: 'light hanging over the hills, so the land sits in the air',
    minTier: 'low',
    motion: 'still',
    plain: (target) => target.drawn.push('plain'),
    filtered: (target) => target.drawn.push('filtered'),
    ...overrides,
  });

describe('defineEffect', () => {
  it('refuses an effect with no no-Filter path, and says why', () => {
    expect(() =>
      defineEffect({
        id: 'bloom',
        intent: 'nope',
        minTier: 'high',
        motion: 'still',
      } as unknown as VisualEffectDefinition<Marks>),
    ).toThrow(/Filter-only effect does not fail, it silently renders the level wrong/u);
  });

  it('refuses a filtered path that is not callable', () => {
    expect(() =>
      defineEffect({
        id: 'bloom',
        intent: 'nope',
        minTier: 'high',
        motion: 'still',
        plain: () => undefined,
        filtered: 'Phaser.Filters.Blur' as unknown as () => void,
      } as VisualEffectDefinition<Marks>),
    ).toThrow(/`filtered` must be a function/u);
  });

  it('refuses an unnamed effect, because the registry gate reports by id', () => {
    expect(() =>
      defineEffect({
        id: '  ',
        intent: 'nope',
        minTier: 'low',
        motion: 'still',
        plain: () => undefined,
      }),
    ).toThrow(/`id` must be a non-empty string/u);
  });

  it('accepts an effect that only ever has a plain path', () => {
    const effect = defineEffect<Marks>({
      id: 'ridge-haze',
      intent: 'a soft band above the crest',
      minTier: 'low',
      motion: 'still',
      plain: (target) => target.drawn.push('plain'),
    });

    expect(effect.hasPlainPath).toBe(true);
    expect(effect.filtered).toBeUndefined();
  });
});

describe('selectEffectPath', () => {
  it('uses the Filter path only when the profile grants Filters', () => {
    expect(selectEffectPath(glow(), profile('high'))).toBe('filtered');
    expect(selectEffectPath(glow(), profile('medium'))).toBe('plain');
  });

  it('falls back to plain on a renderer with no Filter pipeline, never to nothing', () => {
    expect(selectEffectPath(glow(), profile('high', 'full', false))).toBe('plain');
  });

  it('falls back to plain for an effect that never had a Filter path', () => {
    expect(selectEffectPath(glow({ filtered: undefined }), profile('high'))).toBe('plain');
  });

  it('skips an effect below its minimum tier', () => {
    expect(selectEffectPath(glow({ minTier: 'medium' }), profile('low'))).toBe('skipped');
    expect(selectEffectPath(glow({ minTier: 'medium' }), profile('medium'))).toBe('plain');
  });

  it('skips a decorative effect under reduced motion at every tier', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      expect(selectEffectPath(glow({ motion: 'decorative' }), profile(tier, 'reduced'))).toBe(
        'skipped',
      );
    }
  });

  it('keeps a still effect under reduced motion: stillness is not plainness', () => {
    expect(selectEffectPath(glow({ motion: 'still' }), profile('high', 'reduced'))).toBe(
      'filtered',
    );
  });
});

describe('applyEffect', () => {
  it('runs exactly one path and reports which', () => {
    const target: Marks = { drawn: [] };

    expect(applyEffect(glow(), target, profile('high'))).toBe('filtered');
    expect(target.drawn).toEqual(['filtered']);

    target.drawn = [];
    expect(applyEffect(glow(), target, profile('low'))).toBe('plain');
    expect(target.drawn).toEqual(['plain']);
  });

  it('draws nothing at all when the effect is skipped', () => {
    const target: Marks = { drawn: [] };
    const plain = vi.fn();

    applyEffect(
      glow({ motion: 'decorative', plain }),
      target,
      profile('high', 'reduced'),
    );

    expect(plain).not.toHaveBeenCalled();
    expect(target.drawn).toEqual([]);
  });
});

describe('createEffectRegistry', () => {
  it('plans what a device would draw without drawing it', () => {
    const registry = createEffectRegistry();
    registry.register(glow());
    registry.register(glow({ id: 'snow', motion: 'decorative', filtered: undefined }));
    registry.register(glow({ id: 'bloom', minTier: 'high' }));

    expect(registry.plan(profile('high'))).toEqual([
      { id: 'crest-glow', path: 'filtered' },
      { id: 'snow', path: 'plain' },
      { id: 'bloom', path: 'filtered' },
    ]);

    expect(registry.plan(profile('low'))).toEqual([
      { id: 'crest-glow', path: 'plain' },
      { id: 'snow', path: 'plain' },
      { id: 'bloom', path: 'skipped' },
    ]);
  });

  it('never plans a Filter path for a Canvas renderer', () => {
    const registry = createEffectRegistry();
    registry.register(glow());
    registry.register(glow({ id: 'bloom', minTier: 'low' }));

    const paths = registry.plan(profile('high', 'full', false)).map((entry) => entry.path);

    expect(paths).not.toContain('filtered');
    expect(paths).toEqual(['plain', 'plain']);
  });

  it('rejects an effect that did not go through defineEffect', () => {
    const registry = createEffectRegistry();
    const smuggled = {
      id: 'bloom',
      intent: 'nope',
      minTier: 'high',
      motion: 'still',
      filtered: () => undefined,
    };

    expect(() => registry.register(smuggled as never)).toThrow(/was not built by defineEffect/u);
  });

  it('rejects a duplicate id, so `plan` cannot silently report one of two effects', () => {
    const registry = createEffectRegistry();
    registry.register(glow());

    expect(() => registry.register(glow())).toThrow(/registered twice/u);
    expect(registry.size).toBe(1);
    expect(registry.ids()).toEqual(['crest-glow']);
  });

  it('hands back a copy, so a caller cannot mutate the registry through it', () => {
    const registry = createEffectRegistry();
    registry.register(glow());

    (registry.all() as unknown[]).length = 0;

    expect(registry.size).toBe(1);
  });
});
