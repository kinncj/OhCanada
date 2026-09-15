/**
 * The colour of the canvas's first row, as the page needs it (ADR-0044).
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
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/** A channel as a byte. A channel that is not a number reads as 0, not as `NaN` in a colour. */
const clampChannel = (value: number): number =>
  Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0;

/**
 * Which of a layer's rows is drawn on the canvas's first row, or `null` when the
 * layer does not reach it.
 *
 * Phaser draws a game object at screen `y - cameraY * scrollFactorY`, so screen
 * row 0 is layer row `cameraY * scrollFactorY - offsetY`.
 */
export function layerRowAtCanvasTop(layer: SkyTopLayer, cameraY: number): number | null {
  const height = finiteOr(layer.height, 0);
  if (height <= 0) return null;
  const row = Math.floor(
    finiteOr(cameraY, 0) * finiteOr(layer.scrollFactorY, 1) - finiteOr(layer.offsetY, 0),
  );
  return row >= 0 && row < height ? row : null;
}

/**
 * The colour of the canvas's first row, `#rrggbb`.
 *
 * Always opaque: the backdrop is, and laying any colour over an opaque one
 * leaves it opaque. A backdrop that is not a `#rrggbb` literal is returned as it
 * came, because a page colour is not worth a failed level.
 */
export function canvasTopColour(input: CanvasTopInput): string {
  if (!/^#[0-9a-f]{6}$/iu.test(input.backdrop)) return input.backdrop;
  const base = toPhaserColor(input.backdrop);
  let r = (base >> 16) & 0xff;
  let g = (base >> 8) & 0xff;
  let b = base & 0xff;

  const ordered = input.layers
    .map((layer, index) => ({ layer, index }))
    .sort((one, other) => one.layer.depth - other.layer.depth || one.index - other.index);

  for (const { layer } of ordered) {
    if (!layer.visible) continue;
    const row = layerRowAtCanvasTop(layer, input.cameraY);
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
