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
 * A band with no texture yet is drawn as a placeholder this tall.
 *
 * Exported so `level-scene.ts` draws the same height this module ranks by: a
 * placeholder measured one way and selected another would drop the wrong bands
 * on a build whose art has not landed.
 */
export const PLACEHOLDER_BAND_HEIGHT = 230;

/** What a layer has to cover, and how to find out how big it is. */
export interface LayerViewport {
  readonly width: number;
  readonly height: number;
  /**
   * The highest point of the ground polyline.
   *
   * Anything below it is behind the ground and cannot be seen, which is the
   * whole reason the old rule chose so badly: Ottawa's canal wall sits at
   * `offset.y` 1120 under a ground line at ~1210, so nine tenths of it is
   * painted over — and it was one of the two bands the low tier kept.
   */
  readonly horizonY: number;
  /** The layer's drawn size, or `null` when no texture has been loaded for it. */
  readonly sizeOf: (key: string) => { readonly width: number; readonly height: number } | null;
}

/**
 * How much of the screen this layer actually covers, in design pixels squared.
 *
 * A repeating band tiles across the whole viewport however wide its texture is;
 * a single image covers at most its own width. Vertically it is clipped to the
 * viewport at the top and to the **ground** at the bottom, because a band under
 * the ground polygon is not visible however tall it is.
 */
export function layerCoverage(layer: ParallaxLayer, viewport: LayerViewport): number {
  const size = viewport.sizeOf(layer.key);
  const height = size?.height ?? PLACEHOLDER_BAND_HEIGHT;
  const width = size?.width ?? viewport.width;

  const floor =
    viewport.horizonY > 0 && viewport.horizonY < viewport.height
      ? viewport.horizonY
      : viewport.height;
  const top = Math.max(0, layer.offset.y);
  const bottom = Math.min(floor, layer.offset.y + height);
  const visibleHeight = Math.max(0, bottom - top);
  const visibleWidth = layer.repeatX ? viewport.width : Math.min(width, viewport.width);

  return Math.max(0, visibleWidth) * visibleHeight;
}

/**
 * The layers this profile may draw, in draw order.
 *
 * ### The rule, and the one it replaced
 *
 * **Keep the layers that cover the most screen.** The rule before was "keep the
 * highest-depth layers", which is nearest-first, and it is a good convention in
 * a game whose camera looks *into* a scene. This is a portrait side-scroller
 * where the far layers **are** the picture, and the result was that the tier
 * which exists to protect a weaker device is the one that made the level
 * unrecognisable: Ottawa at `medium` dropped the sky and Parliament's silhouette
 * and kept the canal wall, nine tenths of which is behind the ground. At `low`
 * it kept two bands that are both largely occluded, and the screen was a
 * gradient with a rectangle on it.
 *
 * Reversing the depth order would have been the same mistake with the sign
 * flipped — it would drop the ground on a level whose foreground carries its
 * identity. Coverage is the criterion that gets Ottawa right *for the reason
 * that generalises*, and it needs no per-level tuning: a band under the ground
 * ranks low because it cannot be seen, wherever it sits in the stack.
 *
 * Ties go to the nearer band, so a level whose layers genuinely cover the same
 * area still degrades front to back.
 *
 * Returned sorted ascending by depth, because that is the order they are added
 * in and a scene should not have to sort what it was handed.
 *
 * **Reported, not worked around:** `content/schemas/level.schema.json` describes
 * the old rule in `ParallaxLayer.depth` ("keeps the highest-depth layers and
 * drops the rest"), and so does the mirroring comment in
 * `app/application/ports/content-repository.ts`. Both are now stale and belong
 * to their owners to correct. Neither is load-bearing on this code — the shapes
 * are unchanged, so no gate reads them — which is precisely why they would rot
 * quietly if nobody said so.
 */
export function selectLayers(
  layers: readonly ParallaxLayer[],
  maxLayers: number,
  viewport: LayerViewport,
): readonly ParallaxLayer[] {
  const keep = Math.max(0, Math.floor(maxLayers));
  const byDepth = [...layers].sort((a, b) => a.depth - b.depth);
  if (keep >= byDepth.length) return byDepth;

  const ranked = [...byDepth].sort((a, b) => {
    const difference = layerCoverage(b, viewport) - layerCoverage(a, viewport);
    return difference !== 0 ? difference : b.depth - a.depth;
  });
  const kept = new Set(ranked.slice(0, keep).map((layer) => layer.key));
  return byDepth.filter((layer) => kept.has(layer.key));
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
