/**
 * scripts/lib/atlas-pack.mjs (ADR-0032): how `make assets` lays sprites out on an
 * atlas page and fills the pixels round each one.
 *
 * Two defects this module replaced, and every case below is one of them:
 *
 * - THE HAIRLINES. free-tex-packer-core's `extrude` ringed every trimmed frame
 *   with a colour taken from the whole source image, never from the frame's
 *   edge: 48 905 of 49 312 ring pixels on the shipped `shared@2x` page were a
 *   colour the edge beside them did not have. Linear filtering drew that ring
 *   as a faint rectangle round every character part. The first block asserts
 *   the ring is the edge, pixel for pixel, and that `checkPage` - which
 *   `make assets` runs on every encoded page - catches the old ring.
 *
 * - THE CHAOS (OQ-RIG-1). The same 80 frames came out 1312 to 2048 px tall under
 *   a 3 % change, because a greedy pass in a fixed 2048 px bin was cropped to
 *   what it touched. The last block asserts the page is chosen: dense, stable
 *   under drift, and independent of input order.
 *
 * Pixels in, pixels out: nothing here touches sharp or the file system, so the
 * assertions are about bytes this file wrote.
 */

import { describe, expect, it } from 'vitest';

import { checkPage, packAtlas, planAtlas, trimBox } from '../../../scripts/lib/atlas-pack.mjs';

const OPTIONS = { maxPx: 2048, padding: 2, extrude: 1 } as const;

interface Sprite {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly rgba: Buffer;
}

/**
 * A w x h sprite, transparent except for a rectangle inset by `margin`.
 *
 * Every art pixel is a different colour and a partial alpha, so an extrusion
 * that repeated ONE colour round a frame - the old defect, in its general form -
 * cannot pass by accident.
 */
function painted(key: string, w: number, h: number, margin: number): Sprite {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = margin; y < h - margin; y++) {
    for (let x = margin; x < w - margin; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = (x * 37) % 256;
      rgba[i + 1] = (y * 53) % 256;
      rgba[i + 2] = (key.length * 29) % 256;
      rgba[i + 3] = 128 + ((x + y) % 128);
    }
  }
  return { key, width: w, height: h, rgba };
}

const pixel = (rgba: Uint8Array, width: number, x: number, y: number): string =>
  Array.from(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)).join(',');

/** mulberry32: a seeded generator, so "random" sizes are the same on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random: () => number, lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));

describe('atlas-pack rings every frame with its own edge pixels', () => {
  it('repeats each edge pixel outward, corners included, and leaves the padding empty', () => {
    const pages = packAtlas([painted('arm', 30, 20, 3), painted('boot', 12, 40, 0), painted('hat', 25, 25, 5)], OPTIONS);
    expect(pages).toHaveLength(1);
    const page = pages[0];
    if (page === undefined) throw new Error('no page');
    expect(page.frames.map((f) => f.filename)).toEqual(['arm', 'boot', 'hat']);

    for (const { filename, frame } of page.frames) {
      const foreign: string[] = [];
      for (let y = frame.y - 1; y <= frame.y + frame.h; y++) {
        for (let x = frame.x - 1; x <= frame.x + frame.w; x++) {
          const inside = x >= frame.x && x < frame.x + frame.w && y >= frame.y && y < frame.y + frame.h;
          if (inside) continue;
          const ex = Math.min(Math.max(x, frame.x), frame.x + frame.w - 1);
          const ey = Math.min(Math.max(y, frame.y), frame.y + frame.h - 1);
          if (pixel(page.rgba, page.width, x, y) !== pixel(page.rgba, page.width, ex, ey)) foreign.push(`(${x},${y})`);
        }
      }
      expect(foreign, `${filename}: ring pixels that are not the edge beside them`).toEqual([]);
      // Two pixels out is padding on every side.
      expect(pixel(page.rgba, page.width, frame.x - 2, frame.y).endsWith(',0'), filename).toBe(true);
      expect(pixel(page.rgba, page.width, frame.x + frame.w + 1, frame.y + frame.h + 1).endsWith(',0'), filename).toBe(true);
    }
    expect(checkPage(page, { extrude: OPTIONS.extrude })).toEqual([]);
  });

  it('reports the ring the old packer painted: a colour the edge does not have', () => {
    const [page] = packAtlas([painted('deck', 40, 12, 4)], OPTIONS);
    if (page === undefined) throw new Error('no page');
    const frame = page.frames[0]?.frame;
    if (frame === undefined) throw new Error('no frame');
    // The skateboard deck's measured ring on the shipped page: rgba(76,63,62,81).
    for (let x = frame.x; x < frame.x + frame.w; x++) {
      page.rgba.set([76, 63, 62, 81], ((frame.y - 1) * page.width + x) * 4);
    }
    const failures = checkPage(page, { extrude: OPTIONS.extrude });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(`deck: ${String(frame.w)} pixel(s) of its 1 px ring are not the edge pixel beside them`);
    expect(failures[0]).toContain('hairline rectangle');
  });

  it('reports anything in the padding, which is where a neighbour bleeds from', () => {
    const [page] = packAtlas([painted('mitt', 16, 16, 2)], OPTIONS);
    if (page === undefined) throw new Error('no page');
    page.rgba.set([255, 255, 255, 255], 0);
    const failures = checkPage(page, { extrude: OPTIONS.extrude });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('1 non-transparent pixel(s) lie outside every frame and its ring, first at (0, 0)');
  });

  it('trims the transparent margin and records where the art sat in its source', () => {
    const source = painted('sign', 50, 30, 6);
    const [page] = packAtlas([source], OPTIONS);
    if (page === undefined) throw new Error('no page');
    expect(page.frames).toEqual([
      {
        filename: 'sign',
        rotated: false,
        trimmed: true,
        sourceSize: { w: 50, h: 30 },
        spriteSourceSize: { x: 6, y: 6, w: 38, h: 18 },
        frame: { x: 3, y: 3, w: 38, h: 18 },
      },
    ]);
    // padding + extrude + art + extrude + padding, on both axes.
    expect([page.width, page.height]).toEqual([44, 24]);
    for (let j = 0; j < 18; j++) {
      for (let i = 0; i < 38; i++) {
        if (pixel(page.rgba, page.width, 3 + i, 3 + j) !== pixel(source.rgba, 50, 6 + i, 6 + j)) {
          throw new Error(`art pixel (${String(i)}, ${String(j)}) was not copied verbatim`);
        }
      }
    }
    expect(trimBox(Buffer.alloc(8 * 8 * 4), 8, 8)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('shares one rectangle between byte-identical sources', () => {
    const left = painted('left', 20, 20, 2);
    const [page] = packAtlas([left, { ...left, key: 'right' }], OPTIONS);
    if (page === undefined) throw new Error('no page');
    expect(page.frames.map((f) => f.filename)).toEqual(['left', 'right']);
    expect(page.frames[0]?.frame).toEqual(page.frames[1]?.frame);
  });
});

describe('atlas-pack chooses the page, and chooses it the same way every time (OQ-RIG-1)', () => {
  /** 80 frames the size of character parts at 2x, the set the shared atlas holds. */
  const random = seeded(80);
  const parts = Array.from({ length: 80 }, (_, i) => ({
    key: `part-${String(i).padStart(2, '0')}`,
    w: between(random, 20, 240),
    h: between(random, 20, 420),
  }));
  const area = (pages: readonly { readonly width: number; readonly height: number }[]): number =>
    pages.reduce((sum, p) => sum + p.width * p.height, 0);

  it('gives the same page, byte for byte, whatever order the sprites arrive in', () => {
    const r = seeded(7);
    const sprites = Array.from({ length: 12 }, (_, i) =>
      painted(`s${String(i).padStart(2, '0')}`, between(r, 4, 60), between(r, 4, 60), between(r, 0, 1)),
    );
    const forward = packAtlas(sprites, OPTIONS);
    const backward = packAtlas([...sprites].reverse(), OPTIONS);
    expect(backward.map((p) => [p.width, p.height, p.frames])).toEqual(forward.map((p) => [p.width, p.height, p.frames]));
    expect(backward.every((p, i) => p.rgba.equals(forward[i]?.rgba ?? Buffer.alloc(0)))).toBe(true);
    expect(JSON.stringify(planAtlas([...parts].reverse(), OPTIONS))).toBe(JSON.stringify(planAtlas(parts, OPTIONS)));
  });

  it('packs 80 character-sized frames on one page, apart, inside the cap, and at least 85 % full', () => {
    // Measured 93.9 %. The old packer left the shipped page 81.9 % full.
    const plan = planAtlas(parts, OPTIONS);
    expect(plan).toHaveLength(1);
    const page = plan[0];
    if (page === undefined) throw new Error('no page');
    expect(page.width).toBeLessThanOrEqual(2048);
    expect(page.height).toBeLessThanOrEqual(2048);
    expect(page.frames.map((f) => f.key)).toEqual(parts.map((p) => p.key));

    const reach = OPTIONS.extrude + OPTIONS.padding;
    for (const f of page.frames) {
      expect(f.x - reach, f.key).toBeGreaterThanOrEqual(0);
      expect(f.y - reach, f.key).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w + reach, f.key).toBeLessThanOrEqual(page.width);
      expect(f.y + f.h + reach, f.key).toBeLessThanOrEqual(page.height);
    }
    // Two extruded frames never come closer than the padding.
    const e = OPTIONS.extrude;
    const tooClose: string[] = [];
    page.frames.forEach((a, i) => {
      for (const b of page.frames.slice(i + 1)) {
        const apartX = a.x + a.w + e + OPTIONS.padding <= b.x - e || b.x + b.w + e + OPTIONS.padding <= a.x - e;
        const apartY = a.y + a.h + e + OPTIONS.padding <= b.y - e || b.y + b.h + e + OPTIONS.padding <= a.y - e;
        if (!apartX && !apartY) tooClose.push(`${a.key}/${b.key}`);
      }
    });
    expect(tooClose).toEqual([]);

    const cells = parts.reduce((sum, p) => sum + (p.w + 2 * e + OPTIONS.padding) * (p.h + 2 * e + OPTIONS.padding), 0);
    expect(cells / area(plan)).toBeGreaterThanOrEqual(0.85);
  });

  it('moves the page by under 5 % of its area when every frame drifts by up to 2 px', () => {
    // The property the old packer lacked. Measured here: at most 1.6 % over these
    // twelve drifts. The old packer, over forty drifts of the real shared frames:
    // 10.03 to 16.00 MiB, a 60 % swing.
    const drift = seeded(1000);
    const areas = [area(planAtlas(parts, OPTIONS))];
    for (let trial = 0; trial < 12; trial++) {
      const moved = parts.map((p) => ({ key: p.key, w: p.w + between(drift, -2, 2), h: p.h + between(drift, -2, 2) }));
      areas.push(area(planAtlas(moved, OPTIONS)));
    }
    const smallest = Math.min(...areas);
    expect((Math.max(...areas) - smallest) / smallest).toBeLessThan(0.05);
  });

  it('spills onto another page only when one cannot hold the set, each page as small as it can be', () => {
    const plan = planAtlas(
      Array.from({ length: 5 }, (_, i) => ({ key: `k${String(i)}`, w: 40, h: 40 })),
      { maxPx: 64, padding: 2, extrude: 1 },
    );
    expect(plan.map((p) => [p.width, p.height])).toEqual([
      [46, 46],
      [46, 46],
      [46, 46],
      [46, 46],
      [46, 46],
    ]);
    expect(plan.flatMap((p) => p.frames.map((f) => f.key))).toEqual(['k0', 'k1', 'k2', 'k3', 'k4']);
  });

  it('refuses a frame too large for a page, and a key packed twice, rather than dropping either', () => {
    expect(() => planAtlas([{ key: 'wide', w: 2045, h: 10 }], OPTIONS)).toThrow(/"wide" is 2045x10.*does not fit a 2048 px page/);
    expect(() =>
      planAtlas(
        [
          { key: 'twice', w: 10, h: 10 },
          { key: 'twice', w: 12, h: 12 },
        ],
        OPTIONS,
      ),
    ).toThrow(/the key "twice" is packed twice/);
  });
});
