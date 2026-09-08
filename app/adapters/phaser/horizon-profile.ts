/**
 * The shape and shade of the land at the horizon.
 *
 * ADR-0002 fixes *where* the horizon sits — two-thirds down, playfield above,
 * HUD and cards below. It says nothing about what the horizon looks like, and
 * slice 0 drew it as a straight, full-width, high-contrast rule across an
 * otherwise empty screen. On a page with a title, a version number and nothing
 * else, that is the visual grammar of a loading bar: two players reported the
 * site as "stuck at the loading screen" from different devices while the build
 * was in fact healthy. The screen was working and saying it had failed.
 *
 * So the horizon keeps its position and loses its straightness. This module is
 * the profile: a fixed, deterministic ridge of rolling hills that oscillates
 * about the two-thirds line, plus the conifers that stand on it. A line with
 * hills and trees on it cannot be mistaken for a progress track, and unlike a
 * bar it is legible as scenery at a glance.
 *
 * Pure geometry — no Phaser, no DOM, no randomness. Deterministic because the
 * end-to-end suite screenshots this and asserts the crest varies across the
 * width (`tests/e2e/boot.spec.ts`); a per-boot random ridge would make that
 * assertion flaky and the composition unreviewable.
 *
 * Design-space pixels throughout (1080x1920). Nothing here reads the config: the
 * ridge is *shape*, the palette is data, and the two are combined by the scene.
 * The one non-geometric constant that lives here, `LAND_SHADE`, is here because
 * both the scene and `GameRenderer.cssVariables()` need it and neither can be
 * loaded outside a browser — keeping it in a pure module is what lets a unit
 * test hold `index.html`'s pre-boot copy of the land colour to it.
 */

/** How many points the ridge is sampled at across the full width. */
export const RIDGE_SAMPLES = 145;

/**
 * A hill, as a raised cosine: smooth, finite support, and it sums with its
 * neighbours into a compound ridge without any of them needing to know about
 * the others. `height` is the crest above the local baseline, in design pixels.
 */
interface Hill {
  readonly centre: number;
  readonly halfWidth: number;
  readonly height: number;
}

/**
 * Three overlapping hills: a broad shoulder on the left, a lower one right of
 * centre, and a small one running off the right edge. Chosen so no two crests
 * share a height and the profile is asymmetric — a symmetric ridge still reads
 * as a widget.
 */
const HILLS: readonly Hill[] = [
  { centre: 0.19, halfWidth: 0.3, height: 168 },
  { centre: 0.63, halfWidth: 0.22, height: 112 },
  { centre: 0.95, halfWidth: 0.18, height: 70 },
];

/** A slow ripple over the hills, so the stretches between them are not flat either. */
const RIPPLE_AMPLITUDE = 14;
const RIPPLE_CYCLES = 5.5;
const RIPPLE_PHASE = 0.85;

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** 1 at the centre, 0 at `halfWidth` and beyond, smooth in between. */
function raisedCosine(t: number, centre: number, halfWidth: number): number {
  const distance = Math.abs(t - centre) / halfWidth;
  return distance >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * distance));
}

function rawHeight(t: number): number {
  let height = 0;
  for (const hill of HILLS) height += hill.height * raisedCosine(t, hill.centre, hill.halfWidth);
  return height + RIPPLE_AMPLITUDE * Math.sin((t * RIPPLE_CYCLES + RIPPLE_PHASE) * Math.PI * 2);
}

/**
 * The mean of `rawHeight` across the width, measured rather than hand-computed.
 *
 * Subtracting it is what keeps ADR-0002's composition rule true: the land rises
 * above the two-thirds line and dips below it, and *averages out on it*. Edit
 * the hills above and the ridge re-centres itself; a hard-coded constant would
 * silently drift the playfield/HUD split instead.
 */
const RIDGE_BASELINE = ((): number => {
  let total = 0;
  for (let index = 0; index < RIDGE_SAMPLES; index += 1) {
    total += rawHeight(index / (RIDGE_SAMPLES - 1));
  }
  return total / RIDGE_SAMPLES;
})();

/**
 * Height of the land above the horizon line at `t` (0 = left edge, 1 = right),
 * in design pixels. Negative where the ridge dips below the line.
 */
export function ridgeHeightAt(t: number): number {
  return rawHeight(clamp01(t)) - RIDGE_BASELINE;
}

const extremes = ((): { readonly rise: number; readonly drop: number } => {
  let rise = 0;
  let drop = 0;
  for (let index = 0; index < RIDGE_SAMPLES; index += 1) {
    const height = ridgeHeightAt(index / (RIDGE_SAMPLES - 1));
    rise = Math.max(rise, height);
    drop = Math.max(drop, -height);
  }
  return { rise, drop };
})();

/** How far the highest crest stands above the horizon line, in design pixels. */
export const RIDGE_MAX_RISE = extremes.rise;
/** How far the deepest dip falls below it. The land skirt starts under this. */
export const RIDGE_MAX_DROP = extremes.drop;

export interface RidgePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The ridge as points in design space, left edge to right edge inclusive.
 * The scene fills below them and strokes along them; it never needs the maths.
 */
export function ridgePoints(
  width: number,
  horizonY: number,
  samples: number = RIDGE_SAMPLES,
): readonly RidgePoint[] {
  const count = Math.max(2, Math.floor(samples));
  const points: RidgePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    points.push({ x: t * width, y: horizonY - ridgeHeightAt(t) });
  }
  return points;
}

/**
 * A conifer standing on the ridge. `t` is its position across the width,
 * `height` how far it rises above the land at that point, `halfWidth` half its
 * base — all design pixels except `t`.
 *
 * They exist for one reason: scale. Hills alone can still be read as a graph;
 * hills with trees on them are a landscape. Deliberately generic evergreens —
 * no landmark is being depicted, so nothing here needs reference accuracy
 * (CLAUDE.md, Art).
 */
export interface Conifer {
  readonly t: number;
  readonly height: number;
  readonly halfWidth: number;
}

export const CONIFERS: readonly Conifer[] = [
  { t: 0.06, height: 54, halfWidth: 15 },
  { t: 0.115, height: 78, halfWidth: 20 },
  { t: 0.155, height: 44, halfWidth: 13 },
  { t: 0.31, height: 62, halfWidth: 17 },
  { t: 0.35, height: 40, halfWidth: 12 },
  { t: 0.52, height: 70, halfWidth: 19 },
  { t: 0.57, height: 46, halfWidth: 13 },
  { t: 0.72, height: 58, halfWidth: 16 },
  { t: 0.86, height: 84, halfWidth: 21 },
  { t: 0.905, height: 50, halfWidth: 14 },
];

/**
 * How much black is mixed into `palette.ground` to make the land silhouette.
 *
 * A shade of the ground rather than a colour of its own, so a level that
 * re-themes its ground re-themes its hills with it and no second colour has to
 * be authored (`game.config.schema.json#/$defs/theme` is reused per level).
 */
export const LAND_SHADE = 0.55;

/**
 * How far below the ridge the land has faded back into the sky-to-ground
 * gradient, in design pixels.
 *
 * The fade is not decoration. The canvas is FIT-scaled and centred, and the page
 * behind it paints the same gradient into the desktop side panels
 * (`GameRenderer`). If the land stayed opaque to the bottom edge, the last stop
 * of the canvas would no longer be `palette.ground` and the letterbox seam would
 * show. Fading it out well above the bottom keeps the canvas and the panels
 * ending on the same colour, and leaves the lower third clear for the HUD and
 * question cards ADR-0002 puts there.
 */
export const LAND_FADE_DEPTH = 430;

/**
 * Where the land sits on the page, as fractions of the design height.
 *
 * The page repaints this band behind the canvas so the hills continue into the
 * desktop side panels instead of stopping at the letterbox edge (CLAUDE.md:
 * "side panels extend the level's sky/ground"). It is exact wherever it is
 * visible: side panels only exist when the viewport is wider than 9:16, and a
 * viewport wider than 9:16 is height-constrained under `Scale.FIT`, so the
 * canvas is exactly as tall as the page and these fractions line up. On a
 * portrait phone the canvas is full width, the band is hidden behind it, and
 * the alignment does not matter.
 *
 * `crest` is the mean of the ridge at the two edges: a single CSS stop cannot
 * follow a ridge that meets the left and right frames at different heights, and
 * the residual step is a few pixels of a colour that is nearly the background.
 */
export function landBand(
  designHeight: number,
  horizonFraction: number,
): { readonly crest: number; readonly skirt: number; readonly end: number } {
  const horizonY = Math.round(designHeight * horizonFraction);
  const edgeHeight = (ridgeHeightAt(0) + ridgeHeightAt(1)) / 2;
  const skirtY = landSkirtTop(horizonY);

  return {
    crest: (horizonY - edgeHeight) / designHeight,
    skirt: skirtY / designHeight,
    end: Math.min(1, (skirtY + LAND_FADE_DEPTH) / designHeight),
  };
}

/** The first row below every dip of the ridge, where the hill body meets the fade. */
export function landSkirtTop(horizonY: number): number {
  return Math.ceil(horizonY + RIDGE_MAX_DROP) + 1;
}
