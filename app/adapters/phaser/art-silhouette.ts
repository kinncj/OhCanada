/**
 * Where a subject's art is drawn, band by band. ADR-0049.
 *
 * ## The defect
 *
 * A mark sat a fixed distance above the top of its subject's **rectangle**: the
 * texture's bounds for a landmark, `characterSpace` for a character. Neither is
 * the art. `characterSpace` starts 40 px above the crown, so the guide's ring hung
 * about 90 px over his head; a grain elevator's texture starts 520 px above the
 * roof under its centre, because its tallest part is off to one side; and a
 * landmark lower than the player put its mark exactly where the player's face is
 * when a stop holds them there. At 390 × 844 each read as a hollow ring floating
 * in empty sky.
 *
 * ## What this is
 *
 * The top of the drawn art in every band of {@link SILHOUETTE_STEP_PX} columns, and
 * the lowest row it reaches. A landmark's comes from its texture's own alpha,
 * read once when the level is built; a character's from the rig's frame windows
 * (`figure-extent.ts`). Both are world coordinates by the time anything asks.
 *
 * Pure: no Phaser, no DOM. `level-scene.ts` hands it pixels.
 */

/** An alpha at or above this is art. Anti-aliased fringes below it are not. */
export const SILHOUETTE_ALPHA_MIN = 16;

/** Columns per band. Small against any mark, and a quarter of the work of every column. */
export const SILHOUETTE_STEP_PX = 4;

export interface ArtSilhouette {
  /** World x of the first band's left edge. */
  readonly x: number;
  /** Width of each band. */
  readonly step: number;
  /** For each band, the world y of the highest art in it, or `null` for a band with none. */
  readonly tops: readonly (number | null)[];
  /** World y of the lowest edge the art reaches. */
  readonly bottom: number;
}

/** An axis-aligned box in world space. */
export interface ArtBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SilhouetteOptions {
  readonly step?: number;
  readonly alphaMin?: number;
}

/**
 * The silhouette of an RGBA image, in its own pixels (top-left at 0, 0).
 *
 * `null` for an image with no size, a buffer too short for it, or nothing drawn.
 */
export function silhouetteFromRgba(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: SilhouetteOptions = {},
): ArtSilhouette | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (pixels.length < width * height * 4) return null;
  const step = Math.max(1, Math.floor(options.step ?? SILHOUETTE_STEP_PX));
  const alphaMin = options.alphaMin ?? SILHOUETTE_ALPHA_MIN;

  const tops: (number | null)[] = new Array<number | null>(Math.ceil(width / step)).fill(null);
  let lowest = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if ((pixels[(row + x) * 4 + 3] ?? 0) < alphaMin) continue;
      const band = Math.floor(x / step);
      if (tops[band] === null) tops[band] = y;
      lowest = y;
    }
  }
  if (lowest < 0) return null;
  return { x: 0, step, tops, bottom: lowest + 1 };
}

/** A silhouette in an image's own pixels, placed in the world at `(x, y)` and drawn `scale` times its size. */
export function placeSilhouette(
  local: ArtSilhouette,
  placement: { readonly x: number; readonly y: number; readonly scale: number },
): ArtSilhouette {
  const { x, y, scale } = placement;
  return {
    x: x + local.x * scale,
    step: local.step * scale,
    tops: local.tops.map((top) => (top === null ? null : y + top * scale)),
    bottom: y + local.bottom * scale,
  };
}

/**
 * The silhouette of a set of boxes: the top of whichever box is highest in each
 * band. `null` for no boxes, or boxes with no width.
 */
export function silhouetteFromBoxes(
  boxes: readonly ArtBox[],
  step: number = SILHOUETTE_STEP_PX,
): ArtSilhouette | null {
  const solid = boxes.filter((box) => box.width > 0 && box.height > 0);
  if (solid.length === 0) return null;
  const stride = Math.max(1, step);
  const left = Math.floor(Math.min(...solid.map((box) => box.x)));
  const right = Math.ceil(Math.max(...solid.map((box) => box.x + box.width)));
  const tops: (number | null)[] = [];
  for (let from = left; from < right; from += stride) {
    const to = from + stride;
    let top: number | null = null;
    for (const box of solid) {
      if (box.x >= to || box.x + box.width <= from) continue;
      if (top === null || box.y < top) top = box.y;
    }
    tops.push(top);
  }
  return { x: left, step: stride, tops, bottom: Math.max(...solid.map((box) => box.y + box.height)) };
}

/** A rectangle taken as solid art: what a subject with no measured silhouette falls back to. */
export function silhouetteOfRect(rect: ArtBox): ArtSilhouette {
  return { x: rect.x, step: Math.max(1, rect.width), tops: [rect.y], bottom: rect.y + rect.height };
}

/** The highest art whose band overlaps `[from, to)`, or `null` when none of it does. */
export function topWithin(silhouette: ArtSilhouette, from: number, to: number): number | null {
  let top: number | null = null;
  silhouette.tops.forEach((bandTop, index) => {
    if (bandTop === null) return;
    const left = silhouette.x + index * silhouette.step;
    if (left >= to || left + silhouette.step <= from) return;
    if (top === null || bandTop < top) top = bandTop;
  });
  return top;
}

/** Where the art is at all: its first and last drawn band, its highest art and its base. */
export function silhouetteBounds(
  silhouette: ArtSilhouette,
): { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } | null {
  let first = -1;
  let last = -1;
  let top = Number.POSITIVE_INFINITY;
  silhouette.tops.forEach((bandTop, index) => {
    if (bandTop === null) return;
    if (first < 0) first = index;
    last = index;
    top = Math.min(top, bandTop);
  });
  if (first < 0) return null;
  return {
    left: silhouette.x + first * silhouette.step,
    right: silhouette.x + (last + 1) * silhouette.step,
    top,
    bottom: silhouette.bottom,
  };
}
