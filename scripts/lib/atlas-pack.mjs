/**
 * atlas-pack — how `make assets` lays sprites out on an atlas page, and how it
 * fills the pixels round each one (ADR-0033).
 *
 * It replaces free-tex-packer-core, which did two things wrong, both measured on
 * the shared character atlas of a real build:
 *
 * 1. THE HAIRLINES. Its `extrude` option did not extrude. It shrank a copy of the
 *    WHOLE source image to one pixel — the image's average colour — and then
 *    tried to paint the source's column 0 / row 0 over it. On a trimmed sprite
 *    that column and row are transparent (that is why they were trimmed), and its
 *    blit skips transparent pixels, so what stayed was the average colour. Every
 *    frame on the page sat inside a 1 px rectangle of that colour: 80 frames of 80,
 *    49 312 ring pixels of 49 312 at 2x, 48 905 of them a colour the edge pixel
 *    beside them does not have, at alpha up to 255. Linear filtering samples half
 *    a texel past a quad's edge, so every character part drew that rectangle
 *    faintly round itself, and a rotated limb drew all four sides of it.
 *
 *    Here extrusion means what it says: the ring is the frame's own edge pixel,
 *    repeated outward. `checkPage` re-reads a page and fails the build if any ring
 *    pixel is not its neighbouring edge pixel, or if anything but transparency sits
 *    in the gap between two frames.
 *
 * 2. THE CHAOS (OQ-RIG-1). It packed greedily into a fixed 2048 x 2048 bin and
 *    cropped the page to whatever the greedy pass happened to touch. Nothing in it
 *    tried to keep the page small, so the same 80 frames came out anywhere from
 *    1312 to 2048 px tall under a 3 % size change, and because the shared atlas is
 *    charged to every level, a 1 px art edit could move ten levels' texture
 *    budgets by several MiB.
 *
 *    Here the page is chosen, not stumbled on: every insertion order in ORDERS x
 *    every placement rule in METHODS x a fixed ladder of page widths is laid out
 *    with MaxRects, and the smallest page AREA wins. Decoded texture memory is
 *    width x height x 4, so area is the only quantity the budget sees. Any single
 *    greedy layout is still chaotic; the minimum over a few hundred of them is
 *    not, and that is the whole trick. Everything is ordered by explicit keys, so
 *    the same frames give the same page byte for byte on any machine.
 *
 * WHAT A PAGE LOOKS LIKE
 *
 *   | pad | ext | frame | ext | pad | ext | frame | ext | pad |
 *
 * `padding` transparent pixels at every page edge and between any two extruded
 * frames; `extrude` pixels of the frame's own edge round each frame. A frame's
 * `frame` rectangle in the JSON is the art only, never the ring.
 *
 * Nothing is rotated. Phaser can draw a rotated frame, but the character
 * renderer rotates parts about authored pivots, and a frame that is secretly
 * rotated is a second coordinate system to get wrong for a few percent of area.
 *
 * No Phaser, no sharp, no file system: pixels in, pixels out, so the unit tests
 * can drive it with buffers they wrote.
 */

import { createHash } from 'node:crypto';

export const PACKER_ID = 'scripts/lib/atlas-pack.mjs';
export const PACKER_VERSION = '1';

/**
 * Plain code-unit comparison. `localeCompare` depends on the ICU data of the
 * machine running the build, and a layout that depends on the machine is not
 * deterministic.
 */
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Insertion orders. The last tie-break is always the key. */
const ORDERS = [
  ['height', (a, b) => b.h - a.h || b.w - a.w],
  ['area', (a, b) => b.w * b.h - a.w * a.h || b.h - a.h || b.w - a.w],
  ['long-side', (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h)],
];

/** MaxRects placement rules. */
const METHODS = ['best-short-side-fit', 'bottom-left'];

/** Page widths are tried on this grid, plus the narrowest and widest possible. */
const WIDTH_STEP = 16;

/**
 * One MaxRects bin (Jylänki, "A Thousand Ways to Pack the Bin", 2010): the free
 * space is a list of maximal rectangles that may overlap, split round every
 * placement and pruned of any rectangle contained in another.
 */
class MaxRectsBin {
  constructor(width, height) {
    this.free = [{ x: 0, y: 0, w: width, h: height }];
  }

  /** The best position for a w x h rectangle under `method`, or null. */
  find(w, h, method) {
    let best = null;
    let first = Infinity;
    let second = Infinity;
    for (const r of this.free) {
      if (r.w < w || r.h < h) continue;
      let a;
      let b;
      if (method === 'bottom-left') {
        a = r.y + h;
        b = r.x;
      } else {
        const across = r.w - w;
        const down = r.h - h;
        a = Math.min(across, down);
        b = Math.max(across, down);
      }
      // Ties go to the top-left-most position, so the result never depends on
      // the order the free list happens to be in.
      if (
        a < first ||
        (a === first && b < second) ||
        (a === first && b === second && best !== null && (r.y < best.y || (r.y === best.y && r.x < best.x)))
      ) {
        first = a;
        second = b;
        best = { x: r.x, y: r.y, w, h };
      }
    }
    return best;
  }

  place(node) {
    const split = [];
    for (const r of this.free) {
      if (node.x >= r.x + r.w || node.x + node.w <= r.x || node.y >= r.y + r.h || node.y + node.h <= r.y) {
        split.push(r);
        continue;
      }
      if (node.x > r.x) split.push({ x: r.x, y: r.y, w: node.x - r.x, h: r.h });
      if (node.x + node.w < r.x + r.w) split.push({ x: node.x + node.w, y: r.y, w: r.x + r.w - node.x - node.w, h: r.h });
      if (node.y > r.y) split.push({ x: r.x, y: r.y, w: r.w, h: node.y - r.y });
      if (node.y + node.h < r.y + r.h) split.push({ x: r.x, y: node.y + node.h, w: r.w, h: r.y + r.h - node.y - node.h });
    }
    this.free = prune(split);
  }
}

/** Drop every free rectangle contained in another; of identical ones keep the first. */
function prune(rects) {
  const redundant = (a, i) =>
    rects.some((b, j) => {
      if (i === j) return false;
      if (!(a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h)) return false;
      const same = a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
      return !same || j < i;
    });
  return rects.filter((a, i) => !redundant(a, i));
}

/**
 * Lay `cells` (already in insertion order) into a binW x binH bin.
 *
 * `giveUpAt` is the area of the best page found so far: a layout's used area only
 * grows, so once it reaches that the layout cannot win and is abandoned. With
 * `mustFitAll`, the first cell that does not fit abandons it too.
 */
function layout(cells, binW, binH, method, padding, giveUpAt, mustFitAll) {
  const bin = new MaxRectsBin(binW, binH);
  const placed = [];
  let usedW = 0;
  let usedH = 0;
  for (const cell of cells) {
    const at = bin.find(cell.w, cell.h, method);
    if (at === null) {
      if (mustFitAll) return null;
      continue;
    }
    bin.place(at);
    placed.push({ cell, x: at.x, y: at.y });
    usedW = Math.max(usedW, at.x + cell.w);
    usedH = Math.max(usedH, at.y + cell.h);
    if ((usedW + padding) * (usedH + padding) >= giveUpAt) return null;
  }
  return { placed, width: usedW + padding, height: usedH + padding };
}

const ordered = (cells, compare) => [...cells].sort((a, b) => compare(a, b) || byKey(a.key, b.key));

/** The page widths tried for a set whose widest cell is `narrowest`. */
function widthLadder(narrowest, widest) {
  const widths = [narrowest];
  for (let w = Math.ceil((narrowest + 1) / WIDTH_STEP) * WIDTH_STEP; w < widest; w += WIDTH_STEP) widths.push(w);
  if (widest > narrowest) widths.push(widest);
  return widths;
}

/** The smallest-area single page holding every cell, or null if none fits. */
function smallestPage(cells, inner, padding) {
  const narrowest = Math.max(...cells.map((c) => c.w));
  const shortest = Math.max(...cells.map((c) => c.h));
  const cellArea = cells.reduce((sum, c) => sum + c.w * c.h, 0);
  let best = null;
  let bestArea = Infinity;
  for (const [order, compare] of ORDERS) {
    const sequence = ordered(cells, compare);
    for (const method of METHODS) {
      for (const width of widthLadder(narrowest, inner)) {
        if (Math.max(shortest, Math.ceil(cellArea / width)) > inner) continue;
        const result = layout(sequence, width, inner, method, padding, bestArea, true);
        if (result === null) continue;
        best = { ...result, order, method, binWidth: width };
        bestArea = result.width * result.height;
      }
    }
  }
  return best;
}

/**
 * Plan the pages for a set of rectangles. Geometry only, no pixels.
 *
 * @param {ReadonlyArray<{ key: string, w: number, h: number }>} rects  the art's own size, trimmed
 * @param {{ maxPx: number, padding: number, extrude: number }} options
 * @returns {Array<{ width: number, height: number, order: string, method: string,
 *   frames: Array<{ key: string, x: number, y: number, w: number, h: number }> }>}
 *   frames sorted by key; x/y are where the art starts, inside its ring
 */
export function planAtlas(rects, { maxPx, padding, extrude }) {
  const keys = new Set();
  const inner = maxPx - padding;
  const cells = rects.map((r) => {
    if (keys.has(r.key)) throw new Error(`atlas-pack: the key "${r.key}" is packed twice.`);
    keys.add(r.key);
    if (!(Number.isInteger(r.w) && Number.isInteger(r.h) && r.w > 0 && r.h > 0)) {
      throw new Error(`atlas-pack: "${r.key}" is ${r.w}x${r.h}; a frame needs a positive integer size.`);
    }
    const cell = { key: r.key, w: r.w + 2 * extrude + padding, h: r.h + 2 * extrude + padding, rect: r };
    if (cell.w > inner || cell.h > inner) {
      throw new Error(
        `atlas-pack: "${r.key}" is ${r.w}x${r.h}, which with ${extrude} px of extrusion and ${padding} px of ` +
          `padding does not fit a ${maxPx} px page.`,
      );
    }
    return cell;
  });

  const pages = [];
  let remaining = cells;
  while (remaining.length > 0) {
    let page = smallestPage(remaining, inner, padding);
    if (page === null) {
      // More than a page. Fill one page as full as the first rule fills it, then
      // shrink that page to its own smallest area. The shrink always succeeds: the
      // full-page layout of the same set is one of the candidates it tries.
      const [, compare] = ORDERS[0];
      const full = layout(ordered(remaining, compare), inner, inner, METHODS[0], padding, Infinity, false);
      page = smallestPage(
        full.placed.map((p) => p.cell),
        inner,
        padding,
      );
    }
    pages.push(page);
    const taken = new Set(page.placed.map((p) => p.cell.key));
    remaining = remaining.filter((c) => !taken.has(c.key));
  }

  return pages.map((page) => ({
    width: page.width,
    height: page.height,
    order: page.order,
    method: page.method,
    frames: page.placed
      .map(({ cell, x, y }) => ({ key: cell.key, x: padding + x + extrude, y: padding + y + extrude, w: cell.rect.w, h: cell.rect.h }))
      .sort((a, b) => byKey(a.key, b.key)),
  }));
}

/** The bounding box of every pixel with alpha > 0, or a 1 x 1 box for an empty image. */
export function trimBox(rgba, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (rgba[row + x * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/** Copy a trimmed box onto a page at (dx, dy) and extrude its edge pixels by `extrude`. */
function blitExtruded(page, pageWidth, source, sourceWidth, box, dx, dy, extrude) {
  for (let r = 0; r < box.h; r++) {
    const from = ((box.y + r) * sourceWidth + box.x) * 4;
    const to = ((dy + r) * pageWidth + dx) * 4;
    source.copy(page, to, from, from + box.w * 4);
    for (let e = 1; e <= extrude; e++) {
      source.copy(page, to - e * 4, from, from + 4);
      source.copy(page, to + (box.w - 1 + e) * 4, from + (box.w - 1) * 4, from + box.w * 4);
    }
  }
  const rowAt = (y) => (y * pageWidth + dx - extrude) * 4;
  const bytes = (box.w + 2 * extrude) * 4;
  for (let e = 1; e <= extrude; e++) {
    page.copy(page, rowAt(dy - e), rowAt(dy), rowAt(dy) + bytes);
    page.copy(page, rowAt(dy + box.h - 1 + e), rowAt(dy + box.h - 1), rowAt(dy + box.h - 1) + bytes);
  }
}

/**
 * Pack sprites into atlas pages, pixels included.
 *
 * @param {ReadonlyArray<{ key: string, width: number, height: number, rgba: Buffer }>} sprites
 *   straight (not premultiplied) RGBA, width x height x 4 bytes
 * @param {{ maxPx: number, padding: number, extrude: number }} options
 * @returns {Array<{ width: number, height: number, rgba: Buffer, order: string, method: string,
 *   frames: Array<{ filename: string, rotated: false, trimmed: boolean,
 *     sourceSize: { w: number, h: number },
 *     spriteSourceSize: { x: number, y: number, w: number, h: number },
 *     frame: { x: number, y: number, w: number, h: number } }> }>}
 */
export function packAtlas(sprites, options) {
  const { extrude } = options;
  const sorted = [...sprites].sort((a, b) => byKey(a.key, b.key));

  // Byte-identical sources share one rectangle, as they did under the old packer.
  const firstByDigest = new Map();
  const unique = [];
  const aliasOf = new Map();
  for (const sprite of sorted) {
    if (sprite.rgba.length !== sprite.width * sprite.height * 4) {
      throw new Error(`atlas-pack: "${sprite.key}" has ${sprite.rgba.length} bytes for ${sprite.width}x${sprite.height} RGBA.`);
    }
    const digest = createHash('sha256').update(`${sprite.width}x${sprite.height}:`).update(sprite.rgba).digest('hex');
    const first = firstByDigest.get(digest);
    if (first !== undefined) {
      aliasOf.set(sprite.key, first.key);
      continue;
    }
    const box = trimBox(sprite.rgba, sprite.width, sprite.height);
    const entry = { ...sprite, box };
    firstByDigest.set(digest, entry);
    unique.push(entry);
  }

  const byName = new Map(unique.map((u) => [u.key, u]));
  const plan = planAtlas(
    unique.map((u) => ({ key: u.key, w: u.box.w, h: u.box.h })),
    options,
  );

  const pageOf = new Map();
  const pages = plan.map((page, index) => {
    const rgba = Buffer.alloc(page.width * page.height * 4);
    const frames = [];
    for (const f of page.frames) {
      const sprite = byName.get(f.key);
      blitExtruded(rgba, page.width, sprite.rgba, sprite.width, sprite.box, f.x, f.y, extrude);
      pageOf.set(f.key, { index, f, sprite });
    }
    return { width: page.width, height: page.height, rgba, order: page.order, method: page.method, frames };
  });

  for (const sprite of sorted) {
    const target = aliasOf.get(sprite.key) ?? sprite.key;
    const { index, f, sprite: source } = pageOf.get(target);
    const box = source.box;
    pages[index].frames.push({
      filename: sprite.key,
      rotated: false,
      trimmed: box.w !== source.width || box.h !== source.height,
      sourceSize: { w: source.width, h: source.height },
      spriteSourceSize: { x: box.x, y: box.y, w: box.w, h: box.h },
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
    });
  }
  for (const page of pages) page.frames.sort((a, b) => byKey(a.filename, b.filename));
  return pages;
}

/**
 * Re-read a page and report every pixel that would draw something the art does
 * not have: a ring pixel that is not the edge pixel beside it, or a
 * non-transparent pixel outside every frame's ring.
 *
 * Two fully transparent pixels count as equal whatever their colour channels say,
 * because lossless WebP may rewrite the RGB of alpha-0 pixels and the texture is
 * uploaded premultiplied, where those channels become 0 anyway.
 *
 * @returns {string[]} failures, empty when the page is clean
 */
export function checkPage({ rgba, width, height, frames }, { extrude, limit = 5 }) {
  const failures = [];
  const at = (x, y) => (y * width + x) * 4;
  const same = (i, j) =>
    (rgba[i + 3] === 0 && rgba[j + 3] === 0) ||
    (rgba[i] === rgba[j] && rgba[i + 1] === rgba[j + 1] && rgba[i + 2] === rgba[j + 2] && rgba[i + 3] === rgba[j + 3]);

  const covered = new Uint8Array(width * height);
  const seen = new Set();
  for (const { filename, frame } of frames) {
    const id = `${frame.x},${frame.y},${frame.w},${frame.h}`;
    if (seen.has(id)) continue;
    seen.add(id);
    let bad = 0;
    for (let y = frame.y - extrude; y < frame.y + frame.h + extrude; y++) {
      for (let x = frame.x - extrude; x < frame.x + frame.w + extrude; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          failures.push(`${filename}: its ${extrude} px ring runs off the ${width}x${height} page at (${x}, ${y}).`);
          return failures;
        }
        covered[y * width + x] = 1;
        const inside = x >= frame.x && x < frame.x + frame.w && y >= frame.y && y < frame.y + frame.h;
        if (inside) continue;
        const ex = Math.min(Math.max(x, frame.x), frame.x + frame.w - 1);
        const ey = Math.min(Math.max(y, frame.y), frame.y + frame.h - 1);
        if (!same(at(x, y), at(ex, ey))) bad += 1;
      }
    }
    if (bad > 0 && failures.length < limit) {
      failures.push(
        `${filename}: ${bad} pixel(s) of its ${extrude} px ring are not the edge pixel beside them. ` +
          'Linear filtering samples half a texel past a frame, so that ring draws as a hairline rectangle round the sprite.',
      );
    }
  }
  let stray = 0;
  let example = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (covered[y * width + x] === 1 || rgba[at(x, y) + 3] === 0) continue;
      stray += 1;
      example ??= `(${x}, ${y})`;
    }
  }
  if (stray > 0) {
    failures.push(
      `${stray} non-transparent pixel(s) lie outside every frame and its ring, first at ${example}. ` +
        'The padding between frames must be empty or a neighbour bleeds into the next frame.',
    );
  }
  return failures;
}
