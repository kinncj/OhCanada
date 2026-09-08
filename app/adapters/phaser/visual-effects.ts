/**
 * The Filter seam: every visual effect declares a path that uses no Filter, and
 * that path is the one that must look right.
 *
 * ### Why this exists before there is a single effect to run it
 *
 * Phaser 4's Filter pipeline is WebGL-only. On the Canvas renderer a Filter is
 * not an error and not a warning — it simply does nothing, and the level renders
 * *wrong* rather than failing. That is the worst possible failure shape: it
 * cannot be caught by a try/catch, it does not appear in a console, and it
 * reaches the player as "the water looks flat on my laptop" long after anyone
 * could connect it to a renderer choice.
 *
 * The tempting order of work is to build effects first and add fallbacks when a
 * Canvas device shows up. That order does not converge: by the time the first
 * report arrives, five effects assume a Filter and the fallback is a rewrite.
 * So the seam is built first, and it is built so that the *type checker* refuses
 * a Filter-only effect: `plain` is a required member of `VisualEffect` and
 * `filtered` is the optional one. You cannot declare an effect that only exists
 * with Filters; the shape of the declaration will not let you.
 *
 * Three gates, deliberately overlapping, because each catches what the others
 * cannot:
 *
 *   1. **The type.** `plain` is required. Catches the honest mistake at compile
 *      time, which is where nearly all of them will happen.
 *   2. **`defineEffect`.** Throws when `plain` is not a function. Catches an
 *      effect built by `JSON.parse`, by a helper typed `any`, or by a future
 *      data-driven effect table where the compiler has no opinion. A programmer
 *      error, so it throws rather than returning `Result` (see `common/result.ts`).
 *   3. **A source gate** (`tests/unit/adapters/phaser/filters-have-a-plain-path.test.ts`).
 *      Scans this adapter for any use of Phaser's Filter API outside this file's
 *      `filtered` callbacks. Catches the case neither of the others can: a scene
 *      reaching for `setPostPipeline`/`filters.internal.addBlur` directly and
 *      never going through an effect at all. That is the actual way Filters
 *      become load-bearing, and it is the one task 1.13 is most likely to do.
 *
 * Pure: the effect callbacks are supplied by the scene and this module only
 * decides which one to call, so the decision is testable with no browser and no
 * Filter.
 */

import type { RenderProfile, VisualTier } from './visual-tier';

/**
 * Whether an effect is motion or is merely drawn.
 *
 * `'decorative'` effects are skipped entirely under reduced motion — CLAUDE.md
 * names parallax easing, particles and squash-and-stretch. `'still'` effects are
 * shape and colour that do not animate (a vignette, a colour grade, a rim
 * light); they are kept, because reduced motion is a request about movement, not
 * a request for a plainer game.
 */
export type EffectMotion = 'still' | 'decorative';

/** Which of an effect's two implementations ran, or that neither did. */
export type EffectPath = 'filtered' | 'plain' | 'skipped';

/**
 * How an effect is applied to something. `TTarget` is whatever the scene passes
 * — a Graphics object, a Container, a camera — so this module never imports
 * Phaser and never learns what an effect operates on.
 */
export type EffectApply<TTarget> = (target: TTarget, profile: RenderProfile) => void;

export interface VisualEffectDefinition<TTarget> {
  /** Stable id. Appears in the debug overlay and in the registry gate's failure text. */
  readonly id: string;
  /** What the player is supposed to perceive. Read by a reviewer judging the fallback. */
  readonly intent: string;
  /** Lowest tier at which this effect runs at all. Below it, the effect is skipped. */
  readonly minTier: VisualTier;
  readonly motion: EffectMotion;
  /**
   * The path with no Filter. **Required**, and it must stand on its own: this is
   * what a Canvas renderer, a software rasteriser and the low tier all get, and
   * it is what the art is reviewed against.
   */
  readonly plain: EffectApply<TTarget>;
  /**
   * The Filter-based enhancement. Optional, and only ever reached when the
   * profile grants Filters. An effect that has one must still look correct
   * without it — not identical, correct.
   *
   * Spelled `| undefined` as well as `?` on purpose: `exactOptionalPropertyTypes`
   * otherwise rejects an explicit `filtered: undefined`, and "this effect has no
   * Filter path" is a statement an author should be able to write down rather
   * than express by omission.
   */
  readonly filtered?: EffectApply<TTarget> | undefined;
}

export interface VisualEffect<TTarget> extends VisualEffectDefinition<TTarget> {
  /** Marks a definition that went through `defineEffect`, for the registry. */
  readonly hasPlainPath: true;
}

const TIER_RANK: Readonly<Record<VisualTier, number>> = { low: 0, medium: 1, high: 2 };

/**
 * Which implementation this profile calls for.
 *
 * Order is the contract, and it is asserted by test:
 *   1. below `minTier` -> `'skipped'`;
 *   2. decorative under reduced motion -> `'skipped'`;
 *   3. Filters granted and a `filtered` path exists -> `'filtered'`;
 *   4. otherwise -> `'plain'`.
 *
 * Note what is missing: there is no branch that returns `'filtered'` when
 * `profile.filters` is false, and no branch that returns `'skipped'` because an
 * effect lacks a `filtered` path. A device without Filters always gets the
 * effect; it gets it plainly.
 */
export function selectEffectPath<TTarget>(
  effect: VisualEffectDefinition<TTarget>,
  profile: RenderProfile,
): EffectPath {
  if (TIER_RANK[profile.tier] < TIER_RANK[effect.minTier]) return 'skipped';
  if (effect.motion === 'decorative' && profile.motion === 'reduced') return 'skipped';
  if (profile.filters && effect.filtered !== undefined) return 'filtered';
  return 'plain';
}

/**
 * The only supported way to build an effect.
 *
 * Throws rather than returning `Result`: an effect with no plain path is a
 * programmer error caught at construction, not an expected failure a player
 * could ever act on, and `common/result.ts` reserves exceptions for exactly
 * that. It happens at module scope, so it fails the build's first frame rather
 * than a level three hours in.
 */
export function defineEffect<TTarget>(
  definition: VisualEffectDefinition<TTarget>,
): VisualEffect<TTarget> {
  if (typeof definition.id !== 'string' || definition.id.trim().length === 0) {
    throw new TypeError('visual effect: `id` must be a non-empty string.');
  }
  if (typeof definition.plain !== 'function') {
    throw new TypeError(
      `visual effect "${definition.id}": \`plain\` must be a function. Every effect needs a ` +
        `path that uses no Filter — Phaser's Filters are WebGL-only and do nothing at all on ` +
        `the Canvas renderer, so a Filter-only effect does not fail, it silently renders the ` +
        `level wrong.`,
    );
  }
  if (definition.filtered !== undefined && typeof definition.filtered !== 'function') {
    throw new TypeError(
      `visual effect "${definition.id}": \`filtered\` must be a function when present.`,
    );
  }
  return { ...definition, hasPlainPath: true };
}

/** Apply an effect under a profile. Returns the path taken, so a test can assert it. */
export function applyEffect<TTarget>(
  effect: VisualEffect<TTarget>,
  target: TTarget,
  profile: RenderProfile,
): EffectPath {
  const path = selectEffectPath(effect, profile);
  if (path === 'filtered') effect.filtered?.(target, profile);
  else if (path === 'plain') effect.plain(target, profile);
  return path;
}

export interface EffectRegistry {
  readonly size: number;
  /** Every registered effect, in registration order. */
  all(): readonly VisualEffect<never>[];
  ids(): readonly string[];
  register<TTarget>(effect: VisualEffect<TTarget>): VisualEffect<TTarget>;
  /** What each effect would do under this profile. The debug overlay's table. */
  plan(profile: RenderProfile): readonly { readonly id: string; readonly path: EffectPath }[];
}

/**
 * A scene's effects, in one place a test can enumerate.
 *
 * `plan()` is the piece that matters beyond bookkeeping: it answers "what would
 * this device actually draw" without drawing it, so the no-Filter behaviour of
 * every effect a level registers can be asserted in a unit test, on a machine
 * with no GPU, before the level ever runs.
 */
export function createEffectRegistry(): EffectRegistry {
  const effects: VisualEffect<never>[] = [];

  return {
    get size(): number {
      return effects.length;
    },
    all(): readonly VisualEffect<never>[] {
      return [...effects];
    },
    ids(): readonly string[] {
      return effects.map((effect) => effect.id);
    },
    register<TTarget>(effect: VisualEffect<TTarget>): VisualEffect<TTarget> {
      if (effect.hasPlainPath !== true || typeof effect.plain !== 'function') {
        throw new TypeError(
          `visual effect "${String(effect.id)}" was not built by defineEffect, so nothing has ` +
            `checked that it has a no-Filter path. Use defineEffect.`,
        );
      }
      if (effects.some((existing) => existing.id === effect.id)) {
        throw new TypeError(`visual effect "${effect.id}" is registered twice.`);
      }
      effects.push(effect as unknown as VisualEffect<never>);
      return effect;
    },
    plan(profile: RenderProfile) {
      return effects.map((effect) => ({
        id: effect.id,
        path: selectEffectPath(effect, profile),
      }));
    },
  };
}
