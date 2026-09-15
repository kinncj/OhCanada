/**
 * A character as a still picture (ADR-0041): the level's puppet, painted once
 * into a canvas that never reaches the page, and handed back as a URL.
 *
 * What would be wrong if this file lied:
 *
 *  1. **not the level's art** — a picture drawn from anything but the atlas page
 *     the level loads, or dressed by a rule the level does not use;
 *  2. **a leak** — a decoded atlas page or a backing store kept after the
 *     picture exists, on any path, failures included;
 *  3. **a crop that cuts a face** — a portrait window that leaves part of a
 *     head, a hat or a face outside it.
 *
 * Driven by the real `content/characters/rig.json`, as the preview's suite is.
 */

import { describe, expect, it, vi } from 'vitest';

import type { RigDocument } from '@application/ports';
import {
  FIGURE_WINDOW,
  PORTRAIT_WINDOW,
  STILL_MAX_PX,
  paintCharacterStills,
  stillSize,
  type CharacterStillDeps,
  type StillSurface,
} from '@adapters/phaser/character-still';
import type { PreviewContext2D } from '@adapters/phaser/character-preview';
import { parseAssetManifest, type AssetManifest } from '@adapters/phaser/level-assets';
import rigJson from '@content/characters/rig.json';

const RIG = rigJson as unknown as RigDocument;
const RIG_FRAMES = Object.keys(RIG.frames);

function manifestOf(files: readonly Record<string, unknown>[]): AssetManifest {
  const parsed = parseAssetManifest({ version: 2, files });
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

/** A shared character page at both scales, as `scripts/assets.mjs` writes it. */
const MANIFEST = manifestOf([
  { path: 'atlas/shared@1x.aaaa1111.webp', kind: 'atlas', scale: 1, keys: RIG_FRAMES, levels: ['halifax'] },
  {
    path: 'atlas/shared@1x.bbbb2222.json',
    kind: 'atlas-data',
    scale: 1,
    keys: [],
    levels: ['halifax'],
    atlas: 'atlas/shared@1x.aaaa1111.webp',
  },
  { path: 'atlas/shared@2x.cccc3333.webp', kind: 'atlas', scale: 2, keys: RIG_FRAMES, levels: ['halifax'] },
  {
    path: 'atlas/shared@2x.dddd4444.json',
    kind: 'atlas-data',
    scale: 2,
    keys: [],
    levels: ['halifax'],
    atlas: 'atlas/shared@2x.cccc3333.webp',
  },
]);

/** Every rig frame packed at 2x, trimmed by a two-pixel margin as the packer does. */
function atlasData(): unknown {
  return {
    textures: [
      {
        image: 'shared@2x.cccc3333.webp',
        frames: Object.entries(RIG.frames).map(([filename, window], index) => ({
          filename,
          rotated: false,
          trimmed: true,
          sourceSize: { w: window.w * 2, h: window.h * 2 },
          spriteSourceSize: { x: 2, y: 2, w: window.w * 2 - 4, h: window.h * 2 - 4 },
          frame: { x: index * 3, y: 0, w: window.w * 2 - 4, h: window.h * 2 - 4 },
        })),
      },
    ],
    meta: {},
  };
}

interface Surface extends StillSurface {
  readonly draws: () => number;
}

function surface(options: { readonly noContext?: boolean; readonly url?: Promise<string | null> } = {}): Surface {
  let draws = 0;
  const context: PreviewContext2D = {
    setTransform: () => undefined,
    clearRect: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    drawImage: () => {
      draws += 1;
    },
  };
  return {
    context: options.noContext === true ? null : context,
    toUrl: () => options.url ?? Promise.resolve('blob:painted'),
    release: vi.fn(),
    draws: () => draws,
  };
}

function deps(overrides: Partial<CharacterStillDeps> = {}) {
  const surfaces: Surface[] = [];
  const released = vi.fn();
  const fetched: string[] = [];
  const base: CharacterStillDeps = {
    rig: RIG,
    manifest: MANIFEST,
    baseUrl: '/OhCanada/',
    scale: 2,
    fetchJson: (url) => {
      fetched.push(url);
      return Promise.resolve(atlasData());
    },
    loadImage: vi.fn(() => Promise.resolve({ source: {} as CanvasImageSource, release: released })),
    createSurface: vi.fn(() => {
      const next = surface();
      surfaces.push(next);
      return next;
    }),
    report: vi.fn(),
  };
  return { deps: { ...base, ...overrides }, surfaces, released, fetched };
}

describe('a still picture of a character', () => {
  it("is painted from the atlas page the level loads, at the level's scale", async () => {
    const stage = deps();
    const urls = await paintCharacterStills(
      [{ characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: 240, heightPx: 240 }],
      stage.deps,
    );

    expect(urls).toEqual(['blob:painted']);
    expect(stage.fetched).toEqual(['/OhCanada/atlas/shared@2x.dddd4444.json']);
    expect(stage.deps.loadImage).toHaveBeenCalledWith('/OhCanada/atlas/shared@2x.cccc3333.webp');
    expect(stage.deps.createSurface).toHaveBeenCalledWith(240, 240);
    expect(stage.surfaces[0]?.draws()).toBeGreaterThan(0);
  });

  it('dresses the player when no character is named, in the appearance asked for', async () => {
    const stage = deps();
    const urls = await paintCharacterStills(
      [
        {
          characterId: null,
          skins: { skin: 'skin-5', hairShape: 'coil', hairColour: 'black' },
          window: FIGURE_WINDOW,
          widthPx: 240,
          heightPx: 470,
        },
      ],
      stage.deps,
    );
    expect(urls).toEqual(['blob:painted']);
    expect(stage.deps.report).not.toHaveBeenCalled();
  });

  it('reads the atlas once and decodes it once for many pictures, then lets it go once', async () => {
    const stage = deps();
    const urls = await paintCharacterStills(
      [
        { characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: 120, heightPx: 120 },
        { characterId: 'officer', window: PORTRAIT_WINDOW, widthPx: 120, heightPx: 120 },
        { characterId: null, window: FIGURE_WINDOW, widthPx: 200, heightPx: 400 },
      ],
      stage.deps,
    );

    expect(urls).toHaveLength(3);
    expect(stage.fetched).toHaveLength(1);
    expect(stage.deps.loadImage).toHaveBeenCalledTimes(1);
    expect(stage.released).toHaveBeenCalledTimes(1);
    /* Every backing store was let go as soon as its picture existed. */
    for (const painted of stage.surfaces) expect(painted.release).toHaveBeenCalledTimes(1);
  });

  it('is nothing in place for an artboard the rig does not have, and the rest are still painted', async () => {
    const stage = deps();
    const urls = await paintCharacterStills(
      [
        { characterId: 'nobody-the-rig-names', window: PORTRAIT_WINDOW, widthPx: 80, heightPx: 80 },
        { characterId: 'officer', window: PORTRAIT_WINDOW, widthPx: 80, heightPx: 80 },
      ],
      stage.deps,
    );
    expect(urls).toEqual([null, 'blob:painted']);
    expect(stage.deps.report).toHaveBeenCalledWith(expect.stringContaining('nobody-the-rig-names'));
  });

  it('is nothing, with nothing decoded, when the frame data cannot be read', async () => {
    const stage = deps({ fetchJson: () => Promise.reject(new Error('404')) });
    const urls = await paintCharacterStills(
      [{ characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: 80, heightPx: 80 }],
      stage.deps,
    );
    expect(urls).toEqual([null]);
    expect(stage.deps.loadImage).not.toHaveBeenCalled();
    expect(stage.deps.report).toHaveBeenCalledWith(expect.stringContaining('404'));
  });

  it('lets go of the decoded page when painting fails part-way', async () => {
    const stage = deps({
      createSurface: () => surface({ url: Promise.reject(new Error('toBlob failed')) }),
    });
    const urls = await paintCharacterStills(
      [{ characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: 80, heightPx: 80 }],
      stage.deps,
    );
    expect(urls).toEqual([null]);
    expect(stage.released).toHaveBeenCalledTimes(1);
  });

  it('is nothing, and says so, when the browser gives it no 2D canvas', async () => {
    const painted = surface({ noContext: true });
    const stage = deps({ createSurface: () => painted });
    const urls = await paintCharacterStills(
      [{ characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: 80, heightPx: 80 }],
      stage.deps,
    );
    expect(urls).toEqual([null]);
    expect(painted.release).toHaveBeenCalledTimes(1);
    expect(stage.deps.report).toHaveBeenCalledWith(expect.stringContaining('2D canvas'));
  });

  it('is nothing for every request when no atlas page carries the rig', async () => {
    const stage = deps({ manifest: manifestOf([]) });
    const urls = await paintCharacterStills(
      [{ characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: 80, heightPx: 80 }],
      stage.deps,
    );
    expect(urls).toEqual([null]);
    expect(stage.deps.loadImage).not.toHaveBeenCalled();
  });

  it('asks for nothing when there is nothing to paint', async () => {
    const stage = deps();
    expect(await paintCharacterStills([], stage.deps)).toEqual([]);
    expect(stage.fetched).toEqual([]);
  });
});

describe('the size of a still', () => {
  it('is whole pixels, never below one and never above the ceiling', () => {
    expect(stillSize({ widthPx: 240.4, heightPx: 239.6 })).toEqual({ width: 240, height: 240 });
    expect(stillSize({ widthPx: 4096, heightPx: 0.2 })).toEqual({ width: STILL_MAX_PX, height: 1 });
    expect(stillSize({ widthPx: Number.NaN, heightPx: Number.POSITIVE_INFINITY })).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe('where the camera stands', () => {
  const inside = (
    frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    window: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  ): boolean =>
    frame.x >= window.x &&
    frame.y >= window.y &&
    frame.x + frame.w <= window.x + window.w &&
    frame.y + frame.h <= window.y + window.h;

  it('frames every head, hat and face the rig draws, whole, in a square', () => {
    expect(PORTRAIT_WINDOW.w).toBe(PORTRAIT_WINDOW.h);
    const faces = Object.entries(RIG.frames).filter(([name]) =>
      /^character-(head|hat|face)-/u.test(name),
    );
    expect(faces.length, 'the rig declares no head frames').toBeGreaterThan(0);
    const cut = faces
      .filter(([, window]) => !inside(window, PORTRAIT_WINDOW))
      .map(([name]) => name);
    expect(cut, `the portrait crops ${cut.join(', ')}`).toEqual([]);
  });

  it('frames the whole figure, crown to soles', () => {
    expect(FIGURE_WINDOW.y).toBeLessThanOrEqual(0);
    expect(FIGURE_WINDOW.y + FIGURE_WINDOW.h).toBeGreaterThanOrEqual(RIG.characterSpace.soleY);
    expect(FIGURE_WINDOW.x).toBeLessThanOrEqual(0);
    expect(FIGURE_WINDOW.x + FIGURE_WINDOW.w).toBeGreaterThanOrEqual(RIG.characterSpace.width);
  });
});
