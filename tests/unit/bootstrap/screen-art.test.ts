import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  FIGURE_WINDOW,
  PORTRAIT_WINDOW,
  STILL_MAX_PX,
  type CharacterStillRequest,
} from '@adapters/phaser/character-still';

import {
  assetsBaseUrl,
  createScreenArt,
  FIGURE_CSS_PX,
  isLandmarkArt,
  PORTRAIT_CSS_PX,
  stampLandmark,
  type PaintStills,
} from '../../../app/bootstrap/screen-art';

/**
 * ADR-0041: where the DOM screens' pictures come from.
 *
 * What would be wrong if this file lied: a picture that is not the level's own
 * art (an atlas page offered as an image, the wrong scale), a stamp that is not
 * the level's landmark, a character painted again on every dialogue, or a page
 * with no network asked for anything at all.
 */

const MANIFEST = {
  version: 2,
  files: [
    {
      path: 'img/halifax-landmark-town-clock@1x.030021fe.webp',
      kind: 'image',
      scale: 1,
      keys: ['halifax-landmark-town-clock'],
      levels: ['halifax'],
    },
    {
      path: 'img/halifax-prop-harbour-tug@1x.19849214.webp',
      kind: 'image',
      scale: 1,
      keys: ['halifax-prop-harbour-tug'],
      levels: ['halifax'],
    },
    {
      path: 'atlas/halifax@2x.cc00cc00.webp',
      kind: 'atlas',
      scale: 2,
      keys: ['halifax-prop-harbour-tug'],
      levels: ['halifax'],
    },
    { path: 'img/a-landmark-both@1x.aa00aa00.webp', kind: 'image', scale: 1, keys: ['a-landmark-both'], levels: ['a'] },
    { path: 'img/a-landmark-both@2x.bb00bb00.webp', kind: 'image', scale: 2, keys: ['a-landmark-both'], levels: ['a'] },
  ],
} as const;

interface Stage {
  readonly art: ReturnType<typeof createScreenArt>;
  readonly fetch: ReturnType<typeof vi.fn>;
  readonly paint: ReturnType<typeof vi.fn>;
  readonly report: ReturnType<typeof vi.fn>;
  readonly revoke: ReturnType<typeof vi.fn>;
}

function stage(
  options: {
    readonly noFetch?: boolean;
    readonly status?: number;
    readonly ratio?: number;
    readonly paint?: PaintStills;
  } = {},
): Stage {
  const fetch = vi.fn((_url: string) =>
    Promise.resolve({
      ok: (options.status ?? 200) < 300,
      status: options.status ?? 200,
      json: () => Promise.resolve(MANIFEST as unknown),
    }),
  );
  let painted = 0;
  const paint = vi.fn<PaintStills>(
    options.paint ??
      ((requests) =>
        Promise.resolve(
          requests.map((request) => {
            painted += 1;
            return `blob:still-${String(request.characterId ?? 'player')}-${String(painted)}`;
          }),
        )),
  );
  const report = vi.fn();
  const revoke = vi.fn();
  const art = createScreenArt({
    fetch: options.noFetch === true ? undefined : fetch,
    baseUrl: '/OhCanada/',
    devicePixelRatio: () => options.ratio ?? 3,
    document: undefined,
    paint,
    report,
    revoke,
  });
  return { art, fetch, paint, report, revoke };
}

describe('a page with no network', () => {
  it('asks for nothing and draws nothing, and says nothing is wrong', async () => {
    const { art, paint, report } = stage({ noFetch: true });
    await art.prime();
    await art.paintPortraits(['guide']);

    expect(art.pictureOf('halifax-landmark-town-clock')).toBeNull();
    expect(art.stampOf([{ artKey: 'halifax-landmark-town-clock' }])).toBeNull();
    expect(art.portraitOf('guide')).toBeNull();
    expect(await art.figure({ skin: 'skin-2' })).toBeNull();
    expect(paint).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });
});

describe("a level's pictures", () => {
  it('are read from the one manifest, once, at the deploy’s base path', async () => {
    const { art, fetch } = stage();
    await Promise.all([art.prime(), art.prime()]);
    await art.prime();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/OhCanada/manifest.json');
  });

  it('are nothing until the manifest is read', async () => {
    const { art } = stage();
    expect(art.pictureOf('halifax-landmark-town-clock')).toBeNull();
    await art.prime();
    expect(art.pictureOf('halifax-landmark-town-clock')).toBe(
      '/OhCanada/img/halifax-landmark-town-clock@1x.030021fe.webp',
    );
  });

  it('are the image the level loads, never an atlas page carrying the same key', async () => {
    const { art } = stage();
    await art.prime();
    expect(art.pictureOf('halifax-prop-harbour-tug')).toBe(
      '/OhCanada/img/halifax-prop-harbour-tug@1x.19849214.webp',
    );
  });

  it('are at the scale the level would choose', async () => {
    const sharp = stage({ ratio: 3 });
    await sharp.art.prime();
    expect(sharp.art.pictureOf('a-landmark-both')).toBe('/OhCanada/img/a-landmark-both@2x.bb00bb00.webp');

    const plain = stage({ ratio: 1 });
    await plain.art.prime();
    expect(plain.art.pictureOf('a-landmark-both')).toBe('/OhCanada/img/a-landmark-both@1x.aa00aa00.webp');
  });

  it('are nothing for a key the manifest does not have', async () => {
    const { art } = stage();
    await art.prime();
    expect(art.pictureOf('halifax-landmark-nowhere')).toBeNull();
    expect(art.pictureOf('')).toBeNull();
    expect(art.pictureOf(undefined)).toBeNull();
  });

  it('are nothing, said once as a warning, when the manifest cannot be read', async () => {
    const { art, report } = stage({ status: 404 });
    await art.prime();
    await art.prime();
    expect(art.pictureOf('halifax-landmark-town-clock')).toBeNull();
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0])).toContain('404');
  });
});

describe("a level's stamp", () => {
  it('is pressed in the shape of its first landmark, not of the first thing placed', async () => {
    const { art } = stage();
    await art.prime();
    expect(
      art.stampOf([{ artKey: 'halifax-prop-harbour-tug' }, { artKey: 'halifax-landmark-town-clock' }]),
    ).toBe('/OhCanada/img/halifax-landmark-town-clock@1x.030021fe.webp');
  });

  it('falls back to the first thing placed, and is nothing for a level that places nothing', () => {
    expect(stampLandmark([{ artKey: 'x-prop-a' }, { artKey: 'x-prop-b' }])?.artKey).toBe('x-prop-a');
    expect(stampLandmark([])).toBeNull();
  });

  it('reads the pipeline’s own name for a landmark', () => {
    expect(isLandmarkArt('halifax-landmark-town-clock')).toBe(true);
    expect(isLandmarkArt('the-north-landmark-sternwheeler')).toBe(true);
    expect(isLandmarkArt('halifax-prop-market-stall')).toBe(false);
    expect(isLandmarkArt('halifax-layer-10-sky')).toBe(false);
  });

  it('is one landmark on every level the game ships', () => {
    const directory = fileURLToPath(new URL('../../../content/levels/', import.meta.url));
    const levels = readdirSync(directory).filter((name) => name.endsWith('.json'));
    expect(levels.length, 'no level documents were read').toBeGreaterThan(0);
    for (const name of levels) {
      const level = JSON.parse(readFileSync(`${directory}${name}`, 'utf8')) as {
        readonly pois: readonly { readonly artKey: string }[];
      };
      const hero = stampLandmark(level.pois);
      expect(hero, `${name} has no stamp`).not.toBeNull();
      expect(isLandmarkArt(hero?.artKey ?? ''), `${name}'s stamp is not a landmark`).toBe(true);
    }
  });
});

describe('a speaker’s face', () => {
  it('is painted once per character, at the portrait’s size for this screen', async () => {
    const { art, paint } = stage({ ratio: 3 });
    await Promise.all([
      art.paintPortraits(['guide', 'guide']),
      art.paintPortraits(['guide']),
    ]);
    await art.paintPortraits(['guide']);

    expect(paint).toHaveBeenCalledTimes(1);
    const requests = paint.mock.calls[0]?.[0] as readonly CharacterStillRequest[];
    const side = PORTRAIT_CSS_PX * 3;
    expect(requests).toEqual([{ characterId: 'guide', window: PORTRAIT_WINDOW, widthPx: side, heightPx: side }]);
    expect(art.portraitOf('guide')).toMatch(/^blob:still-guide-/u);
    expect(art.portraitOf('officer')).toBeNull();
  });

  it('is nothing, and is not painted again, when it could not be painted', async () => {
    const { art, paint } = stage({ paint: (requests) => Promise.resolve(requests.map(() => null)) });
    await art.paintPortraits(['officer']);
    await art.paintPortraits(['officer']);
    expect(art.portraitOf('officer')).toBeNull();
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it('is nothing when the painter throws, and says so', async () => {
    const { art, report } = stage({ paint: () => Promise.reject(new Error('no atlas')) });
    await art.paintPortraits(['officer']);
    expect(art.portraitOf('officer')).toBeNull();
    expect(report).toHaveBeenCalledWith(expect.stringContaining('no atlas'));
  });
});

describe('the player’s figure', () => {
  it('is the player, whole, in the appearance asked for, never larger than a still may be', async () => {
    const { art, paint } = stage({ ratio: 3 });
    const url = await art.figure({ skin: 'skin-4', hairShape: 'coil' });

    expect(url).toMatch(/^blob:still-player-/u);
    const [request] = paint.mock.calls[0]?.[0] as readonly CharacterStillRequest[];
    const height = Math.min(STILL_MAX_PX, FIGURE_CSS_PX * 3);
    expect(request).toEqual({
      characterId: null,
      skins: { skin: 'skin-4', hairShape: 'coil' },
      window: FIGURE_WINDOW,
      widthPx: Math.round((height * FIGURE_WINDOW.w) / FIGURE_WINDOW.h),
      heightPx: height,
    });
  });

  it('is painted once for one appearance, however often it is asked for', async () => {
    const { art, paint } = stage();
    const first = art.figure({ skin: 'skin-2', hairShape: 'crop' });
    const second = art.figure({ hairShape: 'crop', skin: 'skin-2' });
    expect(await first).toBe(await second);
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it('lets go of the last picture when the appearance changes', async () => {
    const { art, revoke } = stage();
    const before = await art.figure({ skin: 'skin-2' });
    const after = await art.figure({ skin: 'skin-5' });
    expect(after).not.toBe(before);
    expect(revoke).toHaveBeenCalledWith(before);
  });

  it('is nothing when it cannot be painted', async () => {
    const { art, report } = stage({ paint: () => Promise.reject(new Error('decode failed')) });
    expect(await art.figure({ skin: 'skin-2' })).toBeNull();
    expect(report).toHaveBeenCalledWith(expect.stringContaining('decode failed'));
  });
});

describe('where the pictures are served', () => {
  it('is the deploy’s base path, ending in a slash', () => {
    expect(assetsBaseUrl()).toMatch(/^\/(.*\/)?$/u);
  });
});
