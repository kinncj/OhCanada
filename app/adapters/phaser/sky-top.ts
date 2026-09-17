/**
 * The colour of the canvas, row by row, as the page needs it (ADR-0044).
 *
 * On a phone taller than 9:16, `Scale.FIT` leaves a band of page above the
 * canvas — 75 CSS px at 390 x 844 — and the page paints it one flat colour. That
 * colour used to be `--tn-sky`, the level's theme sky **under the time-of-day
 * tint**. The canvas's first row is not that colour: every level's backmost
 * layer is an opaque sky image that starts at world row 0, and layer textures are
 * never tinted. So the band was the tinted sky over an untinted one, a hard
 * horizontal edge that grew toward night.
 *
 * The answer here is not "stop tinting" and not "tint the band too". It is: work
 * out what the canvas actually draws on its first row, and hand that to the page.
 * Pure on purpose, so every case below is a unit test rather than a screenshot
 * taken at the right hour:
 *
 *   - the backdrop is the sky gradient's first band, which is the tinted
 *     `palette.sky` — what shows when no layer reaches row 0, including a tier
 *     that switched every layer off;
 *   - each visible layer that covers row 0 is laid over it in depth order, with
 *     its own alpha, so a translucent layer mixes and an opaque one replaces;
 *   - which of a layer's rows is on screen row 0 follows its vertical parallax,
 *     exactly as Phaser places it: `offset.y - cameraY * scrollFactor.y`.
 *
 * A layer's row is reduced to one colour by {@link meanRowColour}. Every shipped
 * sky's first row is a single colour (measured: spread 0 on all ten), so the
 * mean is exact; a row that is not uniform gets the flat colour whose composite
 * equals the mean composite, which is the least wrong one flat band can be.
 *
 * Nothing here reads the render tier, the render scale or the motion setting,
 * and that is the point: those change *how* the first row is drawn — fewer
 * layers, fewer pixels, a still parallax — and the inputs already carry the
 * consequence (a layer is visible or it is not; a uniform row is the same colour
 * at any scale and at any horizontal offset).
 *
 * ## Every row, not only the first (the desktop side panels)
 *
 * A fourth live-site audit found the same defect one axis over. On a window
 * wider than 9:16 the letterbox is not a band above the canvas but a panel down
 * each side, and CLAUDE.md says those panels extend the level's sky and ground
 * (ADR-0002). Row 0 was exact — that is ADR-0044 working — and the page then ran
 * a **straight ramp** from it to the tinted theme ground over the whole height.
 * A level's sky is not on that line. Measured on the shipped build at 1440 x 900,
 * the per-channel step between the panel and the canvas beside it was 0 at the
 * top row and grew to 25 on Halifax and 33 on the North by mid-screen: a seam
 * down both edges of the playfield, on every desktop session.
 *
 * The cause is not the time-of-day tint. `--tn-sky` is tinted and `--tn-sky-top`
 * is measured, and both were right. The cause is that **two stops cannot
 * describe a sky with hills and a skyline in it** — the ramp interpolated
 * straight through the citadel band, the uptown roofs and the quayside.
 *
 * So the same question is asked of more than one row. {@link canvasSkyProfile}
 * samples what the canvas draws down to where the land band takes over, drops
 * every sample a straight line already predicts within a tolerance, and returns
 * what is left as gradient stops. A flat sky costs two stops, an even ramp costs
 * two, and a level with bands keeps a stop either side of each edge.
 *
 * Still zero draw calls, zero overdraw and no texture: the panels are CSS, and
 * the scene never learns that they exist. The whole added cost is one one-row
 * read per sampled row per layer, once per level, cached — see
 * `LevelScene.#textureRowColour`.
 */

import { toCssColor, toPhaserColor } from './boot-config';

/** A colour with straight (not premultiplied) alpha. Channels are 0..255. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** One parallax layer, as the first row of the canvas sees it. */
export interface SkyTopLayer {
  /** Draw order: a higher depth is laid over a lower one. */
  readonly depth: number;
  /** A layer the tier switched off draws nothing. */
  readonly visible: boolean;
  /** The world row of the layer's first row. */
  readonly offsetY: number;
  /** Vertical parallax rate: Phaser's `scrollFactor.y` for this layer. */
  readonly scrollFactorY: number;
  /** How many rows the layer covers. */
  readonly height: number;
  /** One colour for one of the layer's rows, or `null` when it cannot be read. */
  readonly rowColour: (row: number) => Rgba | null;
}

export interface CanvasTopInput {
  /** The sky gradient's first band, `#rrggbb`: what shows through everything. */
  readonly backdrop: string;
  readonly layers: readonly SkyTopLayer[];
  /** The camera's vertical scroll, in design pixels. */
  readonly cameraY: number;
  /**
   * The sky gradient at a given canvas row, `#rrggbb`, when it is not flat.
   *
   * What shows wherever no layer covers a row: between two bands, below a short
   * one, and everywhere at a tier that switched layers off. {@link backdrop} is
   * that gradient's *first* band, which is the only row ADR-0044 ever asked
   * about — but the gradient runs sky to ground down the whole screen, so one
   * colour is the right answer for row 0 and the wrong one for every row after.
   *
   * Measured: on a build with no level art every band is a short placeholder and
   * most rows fall through to this, and the panel drew flat `palette.sky` beside
   * a canvas running a 64-step ramp.
   *
   * Optional, and `backdrop` is the fallback, so the row-0 case and its tests are
   * untouched.
   */
  readonly backdropAt?: (screenRow: number) => string;
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/** A channel as a byte. A channel that is not a number reads as 0, not as `NaN` in a colour. */
const clampChannel = (value: number): number =>
  Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0;

/**
 * Which of a layer's rows is drawn on canvas row `screenRow`, or `null` when the
 * layer does not cover that row.
 *
 * Phaser draws a game object at screen `y - cameraY * scrollFactorY`, so the
 * layer row on screen row `s` is `s - offsetY + cameraY * scrollFactorY`.
 *
 * One layer row per screen row, with no scale term, because `#buildLayers` sizes
 * every band's quad to its own texture and never scales it. Parallax moves where
 * a layer *starts*; it does not change how fast the layer's own rows go past.
 */
export function layerRowAtCanvasRow(
  layer: SkyTopLayer,
  screenRow: number,
  cameraY: number,
): number | null {
  const height = finiteOr(layer.height, 0);
  if (height <= 0) return null;
  const row = Math.floor(
    finiteOr(screenRow, 0) +
      finiteOr(cameraY, 0) * finiteOr(layer.scrollFactorY, 1) -
      finiteOr(layer.offsetY, 0),
  );
  return row >= 0 && row < height ? row : null;
}

/**
 * Which of a layer's rows is drawn on the canvas's first row (ADR-0044).
 *
 * The `screenRow = 0` case of {@link layerRowAtCanvasRow}, kept under its own
 * name because ADR-0044 names it and the band above a letterboxed canvas is
 * still a question about row 0 alone.
 */
export function layerRowAtCanvasTop(layer: SkyTopLayer, cameraY: number): number | null {
  return layerRowAtCanvasRow(layer, 0, cameraY);
}

/**
 * The colour of canvas row `screenRow`, `#rrggbb`.
 *
 * Always opaque: the backdrop is, and laying any colour over an opaque one
 * leaves it opaque. A backdrop that is not a `#rrggbb` literal is returned as it
 * came, because a page colour is not worth a failed level.
 */
export function canvasRowColour(input: CanvasTopInput, screenRow: number): string {
  const under = input.backdropAt?.(screenRow) ?? input.backdrop;
  const backdrop = /^#[0-9a-f]{6}$/iu.test(under) ? under : input.backdrop;
  if (!/^#[0-9a-f]{6}$/iu.test(backdrop)) return backdrop;
  const base = toPhaserColor(backdrop);
  let r = (base >> 16) & 0xff;
  let g = (base >> 8) & 0xff;
  let b = base & 0xff;

  const ordered = input.layers
    .map((layer, index) => ({ layer, index }))
    .sort((one, other) => one.layer.depth - other.layer.depth || one.index - other.index);

  for (const { layer } of ordered) {
    if (!layer.visible) continue;
    const row = layerRowAtCanvasRow(layer, screenRow, input.cameraY);
    if (row === null) continue;
    const colour = layer.rowColour(row);
    if (colour === null) continue;
    const alpha = Math.min(1, Math.max(0, finiteOr(colour.a, 0) / 255));
    if (alpha === 0) continue;
    r = clampChannel(colour.r) * alpha + r * (1 - alpha);
    g = clampChannel(colour.g) * alpha + g * (1 - alpha);
    b = clampChannel(colour.b) * alpha + b * (1 - alpha);
  }

  return toCssColor((clampChannel(r) << 16) | (clampChannel(g) << 8) | clampChannel(b));
}

/**
 * The colour of the canvas's first row, `#rrggbb` (ADR-0044).
 *
 * The `screenRow = 0` case of {@link canvasRowColour}, under the name ADR-0044
 * gave it: the band above a letterboxed canvas is painted with this one colour.
 */
export function canvasTopColour(input: CanvasTopInput): string {
  return canvasRowColour(input, 0);
}

/**
 * One row of RGBA bytes — `ImageData.data` for a one-row read — as one colour.
 *
 * Colour is averaged **weighted by alpha** and alpha is averaged plainly, so that
 * laying the result over a flat backdrop gives exactly the mean of laying each
 * pixel over it. A plain mean would let a transparent pixel's meaningless colour
 * tint the band. `null` for an empty or ragged row: nothing was read.
 */
export function meanRowColour(pixels: ArrayLike<number>): Rgba | null {
  const count = Math.floor(pixels.length / 4);
  if (count === 0 || pixels.length % 4 !== 0) return null;

  let alphaSum = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const offset = pixel * 4;
    const alpha = finiteOr(pixels[offset + 3] ?? 0, 0);
    alphaSum += alpha;
    rSum += finiteOr(pixels[offset] ?? 0, 0) * alpha;
    gSum += finiteOr(pixels[offset + 1] ?? 0, 0) * alpha;
    bSum += finiteOr(pixels[offset + 2] ?? 0, 0) * alpha;
  }

  if (alphaSum === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: rSum / alphaSum,
    g: gSum / alphaSum,
    b: bSum / alphaSum,
    a: alphaSum / count,
  };
}

/**
 * One row of RGBA bytes as its **dominant** colour: the per-channel median of
 * the pixels that are actually drawn.
 *
 * {@link meanRowColour} is right for a row that is one colour, which is what
 * ADR-0044 measured of every shipped sky's first row. It is wrong for a row with
 * something ON it. A Halifax sky row crossing three clouds averages to a pale
 * blue that is neither the sky nor the cloud, and a panel painted with a stack of
 * such averages reads as a horizontal smear of the level rather than as its sky —
 * measured, and looked at, before this function existed.
 *
 * The median is the colour most of the row actually is: clouds under half the
 * width leave the sky exactly, and a band that fills the row reports itself. A
 * pixel less than half opaque is not counted as drawn, so antialiased cloud
 * edges cannot vote. Alpha is still the plain mean, so a row that is mostly
 * empty still reports as mostly empty and the caller looks underneath.
 *
 * `null` for an empty or ragged read, exactly as the mean is.
 */
export function medianRowColour(pixels: ArrayLike<number>): Rgba | null {
  const count = Math.floor(pixels.length / 4);
  if (count === 0 || pixels.length % 4 !== 0) return null;

  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  let alphaSum = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const offset = pixel * 4;
    const alpha = finiteOr(pixels[offset + 3] ?? 0, 0);
    alphaSum += alpha;
    if (alpha < 128) continue;
    reds.push(finiteOr(pixels[offset] ?? 0, 0));
    greens.push(finiteOr(pixels[offset + 1] ?? 0, 0));
    blues.push(finiteOr(pixels[offset + 2] ?? 0, 0));
  }

  if (reds.length === 0) return { r: 0, g: 0, b: 0, a: alphaSum / count };

  const middle = (values: number[]): number => {
    values.sort((one, other) => one - other);
    return values[Math.floor(values.length / 2)] ?? 0;
  };

  return {
    r: middle(reds),
    g: middle(greens),
    b: middle(blues),
    a: alphaSum / count,
  };
}

/* ------------------------------------------------- the side panels' profile */

/** One stop of the page's sky ramp. */
export interface SkyStop {
  /** Where it sits down the canvas: 0 at the first row, 1 at the last. */
  readonly at: number;
  /** `#rrggbb`, the colour the canvas draws on that row. */
  readonly colour: string;
}

export interface SkyProfileOptions {
  /** The design height the canvas is drawn at, so `at` is a fraction of it. */
  readonly height: number;
  /**
   * The last row worth asking about, in design pixels: where the level's own
   * mid-ground begins.
   *
   * **The sky, and not the whole picture.** CLAUDE.md says the panels extend the
   * level's sky and ground, and those are the two parts of the screen that are
   * flat enough for one colour per row to be true. Between them sit the hills,
   * the skyline, the treeline and the river — rows with structure across them,
   * which no single colour describes. Profiling those too was built, measured and
   * looked at: the panels became a horizontal smear of the level, worse than the
   * ramp they replaced. So the profile stops where the mid-ground starts, and the
   * page's own flat land band — which already measures a step of 0 against the
   * canvas — carries the bottom.
   */
  readonly until: number;
  /**
   * How many rows are read before the straight stretches are dropped.
   *
   * 33 over a sky of about 1280 design rows is a sample every 40 px, which is
   * finer than any edge in the shipped art is soft. It is a ceiling on the work
   * and not a floor on the answer: a flat sky still comes back as two stops.
   */
  readonly samples?: number;
  /**
   * How far a sample may sit from the straight line between its neighbours and
   * still be dropped, per channel.
   *
   * 3, against ADR-0044's finding that a 5-to-7 step at a letterbox edge is
   * visible on a large flat area. Lower would keep stops nobody can see; higher
   * would re-introduce the seam this exists to remove.
   */
  readonly tolerance?: number;
}

const DEFAULT_SAMPLES = 33;
const DEFAULT_TOLERANCE = 3;

/**
 * How many samples the running median looks at. Odd, so it has a middle.
 *
 * Five, measured rather than chosen: three rejected two of the North's three
 * cirrus bands and left the thickest one, which spans two adjacent samples, so
 * the median of a triple was still cloud. Five rejects a run of two. A band
 * thicker than that covers a third of the profile's window and is no longer
 * decoration in any useful sense — it is what the sky looks like there.
 */
const DESPIKE_WINDOW = 5;

/**
 * A sampled row that the rows around it disagree with is decoration, not sky,
 * and is replaced by what they agree on.
 *
 * A running median down the profile. It removes a short spike and leaves a real
 * edge untouched, which is exactly the difference between a cloud and a horizon:
 * at a genuine step the samples read sky, sky, sky, hill, hill, hill, and the
 * median at each position is still sky, sky, sky, hill, hill, hill. At a cloud
 * one or two samples disagree with everything around them and are outvoted.
 *
 * Measured on the North, whose cirrus bands cover more than half the width of
 * three rows: without this the panel grew three pale streaks the canvas beside
 * it did not have, plainly visible at 1440 x 900.
 *
 * The first and last samples are never replaced. The first is the canvas's own
 * first row, which ADR-0044 hands to the band above a letterboxed canvas; the
 * last meets the mid-ground and is the colour the ramp leaves on.
 */
function despike(
  channels: readonly (readonly [number, number, number])[],
  window: number = DESPIKE_WINDOW,
): (readonly [number, number, number])[] {
  const half = Math.floor(Math.max(3, window) / 2);

  return channels.map((here, index): readonly [number, number, number] => {
    if (index === 0 || index === channels.length - 1) return here;

    const seen: (readonly [number, number, number])[] = [];
    for (let at = index - half; at <= index + half; at += 1) {
      const sample = channels[at];
      if (sample !== undefined) seen.push(sample);
    }
    if (seen.length < 3) return here;

    const middle = (channel: 0 | 1 | 2): number => {
      const values = seen.map((sample) => sample[channel]).sort((one, other) => one - other);
      return values[Math.floor(values.length / 2)] ?? 0;
    };
    return [middle(0), middle(1), middle(2)];
  });
}

const channelsOf = (colour: string): readonly [number, number, number] => {
  const value = toPhaserColor(colour);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

/**
 * What the canvas draws from its first row down to `until`, as gradient stops.
 *
 * The rows are read evenly and then **simplified**: a sample a straight line
 * between the stops either side of it already predicts, to within `tolerance` on
 * every channel, is dropped, because CSS interpolates it back. What survives is
 * the stops a straight line cannot predict — the top and bottom of each band,
 * and the corners of a sky that curves.
 *
 * That is why the answer is small. A flat sky is two stops; an even ramp is two;
 * a level with a hill line and a skyline is a handful. The page gets the level's
 * own vertical structure rather than a ramp drawn through it, and the number of
 * stops is a property of the art rather than of this function.
 *
 * Empty for a canvas with no height and for a backdrop the page could not parse:
 * the caller then falls back to the plain ramp, which is what shipped before.
 */
export function canvasSkyProfile(
  input: CanvasTopInput,
  options: SkyProfileOptions,
): readonly SkyStop[] {
  const height = finiteOr(options.height, 0);
  const until = Math.min(finiteOr(options.until, 0), height);
  if (height <= 0 || until <= 0) return [];
  if (!/^#[0-9a-f]{6}$/iu.test(input.backdrop)) return [];

  const samples = Math.max(2, Math.floor(finiteOr(options.samples ?? DEFAULT_SAMPLES, DEFAULT_SAMPLES)));
  const tolerance = Math.max(0, finiteOr(options.tolerance ?? DEFAULT_TOLERANCE, DEFAULT_TOLERANCE));

  const rows: number[] = [];
  const read: (readonly [number, number, number])[] = [];
  for (let index = 0; index < samples; index += 1) {
    const row = (until * index) / (samples - 1);
    const colour = canvasRowColour(input, row);
    if (!/^#[0-9a-f]{6}$/iu.test(colour)) return [];
    rows.push(row);
    read.push(channelsOf(colour));
  }

  const channels = despike(read);
  const colours = channels.map(([r, g, b]) => toCssColor((r << 16) | (g << 8) | b));

  /* Ramer-Douglas-Peucker on the colour curve, with the samples evenly spaced so
     the index is the position. Recursive over at most `samples` points. */
  const keep = new Set<number>([0, samples - 1]);
  const split = (low: number, high: number): void => {
    if (high - low < 2) return;
    const from = channels[low];
    const to = channels[high];
    if (from === undefined || to === undefined) return;

    let worst = -1;
    let worstError = -1;
    for (let index = low + 1; index < high; index += 1) {
      const here = channels[index];
      if (here === undefined) continue;
      const t = (index - low) / (high - low);
      let error = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const predicted = (from[channel] ?? 0) + ((to[channel] ?? 0) - (from[channel] ?? 0)) * t;
        error = Math.max(error, Math.abs((here[channel] ?? 0) - predicted));
      }
      if (error > worstError) {
        worstError = error;
        worst = index;
      }
    }

    if (worst < 0 || worstError <= tolerance) return;
    keep.add(worst);
    split(low, worst);
    split(worst, high);
  };
  split(0, samples - 1);

  return [...keep]
    .sort((one, other) => one - other)
    .flatMap((index): SkyStop[] => {
      const row = rows[index];
      const colour = colours[index];
      if (row === undefined || colour === undefined) return [];
      return [{ at: row / height, colour }];
    });
}

/**
 * The stops as a CSS gradient stop list, for `--tn-sky-stops`.
 *
 * Positioned against the **canvas box** rather than the page, because a phone
 * taller than 9:16 letterboxes the other way: the ramp runs over the canvas and
 * the bands above and below it are flat (ADR-0044). `--tn-canvas-top` and
 * `--tn-canvas-height` are `index.html`'s, and they are declared on `:root` so
 * that this list — which `app/bootstrap` sets on `:root` — can substitute them.
 *
 * Ends on a comma, and is a single space when there is nothing to say, because
 * it is spliced into the middle of a gradient that has stops either side of it.
 * A stop the page could not parse is dropped rather than written out: one bad
 * token makes the whole gradient invalid, and a missing stop is a slightly wrong
 * panel where a missing gradient is no panel at all.
 */
export function skyStopList(stops: readonly SkyStop[]): string {
  /* Five decimals of a 1920-row design space is a hundredth of a row. */
  const position = (at: number): string => String(Number(at.toFixed(5)));

  const written = stops
    .filter(
      (stop) =>
        /^#[0-9a-f]{6}$/iu.test(stop.colour) &&
        Number.isFinite(stop.at) &&
        stop.at >= 0 &&
        stop.at <= 1,
    )
    .map(
      (stop) =>
        `${stop.colour} calc(var(--tn-canvas-top) + ${position(stop.at)} * var(--tn-canvas-height)), `,
    )
    .join('');

  return written === '' ? ' ' : written;
}
