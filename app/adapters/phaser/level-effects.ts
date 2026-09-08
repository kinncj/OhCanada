/**
 * What the visual tier actually costs a level.
 *
 * ADR-0011 chose a tier from a measured frame cost and then had nothing to spend
 * it on: slice 0 drew a gradient and some hills, so the registry in
 * `visual-effects.ts` was empty and the profile was a number nobody read. A level
 * with six parallax layers and falling snow is the first thing that can be
 * degraded, and this module is where the tier stops being theory:
 *
 *   - `selectLayers` drops parallax layers to `RenderProfile.parallaxLayers`;
 *   - `particleBudget` clamps the weather to `RenderProfile.particles`, which is
 *     already the lower of the preset and the device's ceiling (400 on a phone,
 *     1500 on an iPad or desktop — CLAUDE.md, Budgets);
 *   - `createLevelEffects` registers this level's four effects, each with the
 *     no-Filter path `defineEffect` insists on, so `plan()` can be asserted on a
 *     machine with no GPU.
 *
 * Nothing here imports Phaser. Every effect operates on a structural target — an
 * object with the two or three methods that effect needs — so the whole tier
 * policy for a level is unit tested under `environment: 'node'` and the scene is
 * left holding nothing but the wiring.
 *
 * No effect declares a `filtered` path, and that is a decision rather than an
 * omission. Everything this level needs is shape, colour and count; a Filter
 * would buy a bloom on the ground and cost the Canvas and software-rasteriser tiers
 * a silently different picture. When one is added it goes in the `filtered`
 * callback of an effect that already looks correct without it, which is the only
 * place `filters-have-a-plain-path.test.ts` permits Phaser's Filter API at all.
 */

import type { ParallaxLayer } from '@application/ports';

import { createEffectRegistry, defineEffect, type EffectRegistry } from './visual-effects';
import type { RenderProfile } from './visual-tier';

/**
 * The layers this profile may draw, in draw order.
 *
 * `level.schema.json` fixes the rule: "The graphics preset's parallaxLayers
 * count keeps the highest-depth layers and drops the rest, so decoration must
 * sit at a lower depth than anything load-bearing." Highest depth is nearest the
 * player, so a low-tier device keeps the ground and the nearest band and loses
 * the far ones — the reading that keeps a level playable rather than pretty.
 *
 * Returned sorted ascending, because that is the order they are added in and a
 * scene should not have to sort what it was handed.
 */
export function selectLayers(
  layers: readonly ParallaxLayer[],
  maxLayers: number,
): readonly ParallaxLayer[] {
  const keep = Math.max(0, Math.floor(maxLayers));
  const byDepth = [...layers].sort((a, b) => a.depth - b.depth);
  return keep >= byDepth.length ? byDepth : byDepth.slice(byDepth.length - keep);
}

/**
 * How many particles this level may emit.
 *
 * `RenderProfile.particles` has already been through the preset and the device
 * ceiling and is 0 under reduced motion, so this is only the level's own wish
 * meeting that budget. Floored at 0 rather than trusted: a negative or
 * fractional request would reach a Phaser emitter as `NaN` quantity.
 */
export function particleBudget(profile: RenderProfile, requested: number): number {
  if (!Number.isFinite(requested) || requested <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(requested), profile.particles));
}

/** The parallax layer as an effect sees it. Phaser's TileSprite satisfies this. */
export interface ScrollTarget {
  setScrollFactor(x: number, y: number): unknown;
}

/** A particle emitter as an effect sees it. */
export interface EmitterTarget {
  setQuantity(quantity: number): unknown;
  start(): unknown;
}

/** Anything with an alpha: the surface sheen and the horizon haze are both overlays. */
export interface TintTarget {
  setAlpha(alpha: number): unknown;
}

/**
 * How much of a layer's authored scroll factor survives at each tier.
 *
 * Not a second tuning system: the layer's `scrollFactor` in the level file is
 * the answer, and this is only the *absence* of it. A skipped `parallax-drift`
 * leaves the scene's own default of 1, which is "pinned to the world" — scenery
 * that scrolls with the camera and does not part from it. That is what reduced
 * motion means here: no independent movement, still a backdrop.
 */
export const PINNED_SCROLL_FACTOR = 1;

export interface LevelEffects {
  readonly registry: EffectRegistry;
  readonly parallaxDrift: ReturnType<typeof defineParallaxDrift>;
  readonly snowfall: ReturnType<typeof defineSnowfall>;
  readonly surfaceSheen: ReturnType<typeof defineSurfaceSheen>;
  readonly horizonHaze: ReturnType<typeof defineHorizonHaze>;
}

function defineParallaxDrift(layers: readonly ParallaxLayer[]) {
  /* Keyed by texture key so the effect can be applied per layer without the
     scene passing the layer's own record back in — the effect is the policy,
     the level document is the data. */
  const byKey = new Map(layers.map((layer) => [layer.key, layer]));

  return defineEffect<ScrollTarget & { readonly layerKey: string }>({
    id: 'level.parallax-drift',
    intent:
      'Background bands move at their own rate so the backdrop reads as having depth. Skipped ' +
      'under reduced motion, which leaves every band pinned to the world: the scenery is still ' +
      'there, it just no longer moves independently of the camera (CLAUDE.md, Accessibility).',
    minTier: 'low',
    motion: 'decorative',
    plain: (target) => {
      const layer = byKey.get(target.layerKey);
      if (layer === undefined) return;
      target.setScrollFactor(layer.scrollFactor.x, layer.scrollFactor.y);
    },
  });
}

function defineSnowfall(requested: number) {
  return defineEffect<EmitterTarget>({
    id: 'level.snowfall',
    intent:
      'Weather falling across the play area. Decorative and cheap to lose: skipped entirely ' +
      'under reduced motion and below the medium tier, because it is the one thing on screen ' +
      'whose cost scales with a count somebody can turn down.',
    minTier: 'medium',
    motion: 'decorative',
    plain: (target, profile) => {
      target.setQuantity(particleBudget(profile, requested));
      target.start();
    },
  });
}

function defineSurfaceSheen() {
  return defineEffect<TintTarget>({
    id: 'level.surface-sheen',
    intent:
      'A pale band along the ground so the surface reads as a surface rather than as a slab of ' +
      'colour. `still`: it does not animate, so reduced motion keeps it — reduced motion is a ' +
      'request about movement, not a request for a plainer game.',
    minTier: 'high',
    motion: 'still',
    plain: (target) => {
      target.setAlpha(0.35);
    },
  });
}

function defineHorizonHaze() {
  return defineEffect<TintTarget>({
    id: 'level.horizon-haze',
    intent:
      'Light hanging over the far backdrop, so the distance has air in it. `still`, and the ' +
      'first thing a low-tier device loses after the weather.',
    minTier: 'medium',
    motion: 'still',
    plain: (target) => {
      target.setAlpha(0.18);
    },
  });
}

/**
 * This level's effects, registered in one place a test can enumerate.
 *
 * Built per level rather than at module scope because two of them close over the
 * level's own data — the layer table and the requested particle count — which is
 * the point: the effects are the engine's vocabulary, the numbers are the
 * level's.
 */
export function createLevelEffects(options: {
  readonly layers: readonly ParallaxLayer[];
  readonly requestedParticles: number;
}): LevelEffects {
  const registry = createEffectRegistry();
  const parallaxDrift = registry.register(defineParallaxDrift(options.layers));
  const snowfall = registry.register(defineSnowfall(options.requestedParticles));
  const horizonHaze = registry.register(defineHorizonHaze());
  const surfaceSheen = registry.register(defineSurfaceSheen());

  return { registry, parallaxDrift, snowfall, surfaceSheen, horizonHaze };
}
