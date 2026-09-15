/**
 * The creator's picture (ADR-0040): the level's sprite puppet, painted into a
 * 2D canvas.
 *
 * Three claims are tested here, and each one is what would be wrong if this file
 * lied about being "the same art the level draws":
 *
 *  1. **It is Phaser's arithmetic.** A part's origin and scale are measured
 *     against the untrimmed frame, the trimmed pixels start `trimX` into it, and
 *     `flipX` mirrors the art inside its frame box rather than about the origin
 *     (`TransformerImage.run`). Mirroring about the origin is the detached-arm
 *     defect `sprite-character-renderer.ts` already records once.
 *  2. **It is the level's atlas**, found by the frames on it and resolved per key
 *     by the same `bestScale` the level uses.
 *  3. **It lets go.** No frame is requested under reduced motion, and destroy
 *     stops the loop, releases the decoded page and empties the canvas.
 *
 * Driven by the real `content/characters/rig.json`, as the puppet's own suite
 * is: the frames the picture reports are the templates the rig resolves.
 */

import { describe, expect, it, vi } from 'vitest';

import type { RigDocument } from '@application/ports';
import {
  PREVIEW_FRAME_INTERVAL_MS,
  PREVIEW_WINDOW,
  characterAtlasRequest,
  createCanvasPartHost,
  createCharacterPreview,
  fitView,
  paintParts,
  parseAtlasFrames,
  skinsFor,
  type AtlasFrame,
  type CanvasPart,
  type PreviewContext2D,
  type PreviewImage,
  type PreviewStatus,
} from '@adapters/phaser/character-preview';
import { parseAssetManifest, type AssetManifest } from '@adapters/phaser/level-assets';
import rigJson from '@content/characters/rig.json';

const RIG = rigJson as unknown as RigDocument;
const RIG_FRAMES = Object.keys(RIG.frames);

const SELECTION = {
  skin: 'skin-2',
  hairShape: 'crop',
  hairColour: 'brown',
  headCovering: 'none',
  feature: 'none',
  presentation: 'feminine',
} as const;

/* ------------------------------------------------------------- fixtures --- */

function manifestOf(files: readonly Record<string, unknown>[]): AssetManifest {
  const parsed = parseAssetManifest({ version: 2, files });
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

/** The shape `scripts/assets.mjs` writes: a shared page at both scales, and a level page. */
const MANIFEST_FILES: readonly Record<string, unknown>[] = [
  { path: 'atlas/shared@1x.aaaa1111.webp', kind: 'atlas', scale: 1, keys: RIG_FRAMES, levels: ['ottawa'] },
  {
    path: 'atlas/shared@1x.bbbb2222.json',
    kind: 'atlas-data',
    scale: 1,
    keys: [],
    levels: ['ottawa'],
    atlas: 'atlas/shared@1x.aaaa1111.webp',
  },
  { path: 'atlas/shared@2x.cccc3333.webp', kind: 'atlas', scale: 2, keys: RIG_FRAMES, levels: ['ottawa'] },
  {
    path: 'atlas/shared@2x.dddd4444.json',
    kind: 'atlas-data',
    scale: 2,
    keys: [],
    levels: ['ottawa'],
    atlas: 'atlas/shared@2x.cccc3333.webp',
  },
  { path: 'atlas/ottawa@2x.eeee5555.webp', kind: 'atlas', scale: 2, keys: ['parliament'], levels: ['ottawa'] },
  {
    path: 'atlas/ottawa@2x.ffff6666.json',
    kind: 'atlas-data',
    scale: 2,
    keys: [],
    levels: ['ottawa'],
    atlas: 'atlas/ottawa@2x.eeee5555.webp',
  },
];

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

type Op = readonly [string, ...unknown[]];

function recordingContext(): PreviewContext2D & { ops: Op[]; imageSmoothingQuality: string } {
  const ops: Op[] = [];
  return {
    ops,
    imageSmoothingQuality: 'low',
    setTransform: (...args: number[]) => void ops.push(['setTransform', ...args]),
    clearRect: (...args: number[]) => void ops.push(['clearRect', ...args]),
    translate: (...args: number[]) => void ops.push(['translate', ...args]),
    rotate: (...args: number[]) => void ops.push(['rotate', ...args]),
    scale: (...args: number[]) => void ops.push(['scale', ...args]),
    drawImage: (_image: unknown, ...args: number[]) => void ops.push(['drawImage', ...args]),
  };
}

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

async function flush(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

interface Stage {
  readonly statuses: PreviewStatus[];
  readonly context: ReturnType<typeof recordingContext>;
  readonly canvas: { width: number; height: number; removed: number; attributes: Map<string, string> };
  readonly frames: Map<number, (now: number) => void>;
  readonly cancelled: number[];
  readonly released: ReturnType<typeof vi.fn>;
  readonly loadImage: ReturnType<typeof vi.fn>;
  readonly report: ReturnType<typeof vi.fn>;
  readonly fetched: string[];
  readonly preview: ReturnType<typeof createCharacterPreview>;
  draws(): number;
  runFrame(now: number): void;
}

function stage(
  options: {
    readonly motion?: 'reduced' | 'full';
    readonly routes?: Readonly<Record<string, ReturnType<typeof response>>>;
    readonly image?: () => Promise<PreviewImage>;
    readonly noContext?: boolean;
    readonly costume?: string;
  } = {},
): Stage {
  const statuses: PreviewStatus[] = [];
  const context = recordingContext();
  const attributes = new Map<string, string>();
  const canvas = {
    width: 0,
    height: 0,
    removed: 0,
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    getContext: () => (options.noContext === true ? null : context),
    remove(): void {
      this.removed += 1;
    },
  };
  const host = {
    ownerDocument: { createElement: () => canvas, defaultView: null },
    clientWidth: 118,
    clientHeight: 188,
    append: vi.fn(),
  };
  const routes: Record<string, ReturnType<typeof response>> = {
    '/OhCanada/manifest.json': response({ version: 2, files: MANIFEST_FILES }),
    '/OhCanada/atlas/shared@2x.dddd4444.json': response(atlasData()),
    ...options.routes,
  };
  const fetched: string[] = [];
  const frames = new Map<number, (now: number) => void>();
  const cancelled: number[] = [];
  let nextHandle = 1;
  const released = vi.fn();
  const loadImage = vi.fn(
    options.image ??
      (() => Promise.resolve({ source: {} as CanvasImageSource, release: released })),
  );
  const report = vi.fn();

  const preview = createCharacterPreview(
    host as unknown as HTMLElement,
    { selection: SELECTION, motion: options.motion ?? 'full', onStatus: (status) => void statuses.push(status) },
    {
      rig: RIG,
      ...(options.costume === undefined ? {} : { costume: options.costume }),
      assetsBaseUrl: '/OhCanada/',
      devicePixelRatio: () => 3,
      fetch: (url) => {
        fetched.push(url);
        return Promise.resolve(routes[url] ?? response(null, 404));
      },
      loadImage,
      requestFrame: (callback) => {
        const handle = nextHandle;
        nextHandle += 1;
        frames.set(handle, callback);
        return handle;
      },
      cancelFrame: (handle) => {
        cancelled.push(handle);
        frames.delete(handle);
      },
      report,
    },
  );

  return {
    statuses,
    context,
    canvas,
    frames,
    cancelled,
    released,
    loadImage,
    report,
    fetched,
    preview,
    draws: () => context.ops.filter((op) => op[0] === 'drawImage').length,
    runFrame(now) {
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pending) callback(now);
    },
  };
}

const last = (statuses: readonly PreviewStatus[]): PreviewStatus | undefined => statuses.at(-1);

/* ------------------------------------------------------------ the atlas --- */

describe('reading a packed page', () => {
  it('reads the Phaser 3 multi-atlas shape the asset pipeline writes, trim and all', () => {
    const frames = parseAtlasFrames({
      textures: [
        {
          frames: [
            {
              filename: 'character-head-skin-2',
              rotated: false,
              trimmed: true,
              sourceSize: { w: 186, h: 176 },
              spriteSourceSize: { x: 2, y: 2, w: 181, h: 172 },
              frame: { x: 1682, y: 3, w: 181, h: 172 },
            },
          ],
        },
      ],
    });

    expect(frames?.get('character-head-skin-2')).toEqual({
      cutX: 1682,
      cutY: 3,
      cutW: 181,
      cutH: 172,
      trimX: 2,
      trimY: 2,
      realW: 186,
      realH: 176,
    } satisfies AtlasFrame);
  });

  it('treats an untrimmed frame as its own source, and a bare frames[] as well', () => {
    const frames = parseAtlasFrames({
      frames: [{ filename: 'a', frame: { x: 1, y: 2, w: 3, h: 4 } }],
    });
    expect(frames?.get('a')).toEqual({ cutX: 1, cutY: 2, cutW: 3, cutH: 4, trimX: 0, trimY: 0, realW: 3, realH: 4 });
  });

  it('leaves out a rotated or malformed frame, and answers null rather than an empty page', () => {
    const frames = parseAtlasFrames({
      frames: [
        { filename: 'sideways', rotated: true, frame: { x: 0, y: 0, w: 1, h: 1 } },
        { filename: 'no-rect' },
        { filename: 'kept', frame: { x: 0, y: 0, w: 1, h: 1 } },
      ],
    });
    expect([...(frames?.keys() ?? [])]).toEqual(['kept']);
    expect(parseAtlasFrames({ frames: [{ filename: 'no-rect' }] })).toBeNull();
    expect(parseAtlasFrames('not a page')).toBeNull();
    expect(parseAtlasFrames({ textures: [] })).toBeNull();
  });
});

describe('finding the character atlas in the manifest', () => {
  it("picks the page carrying the rig's frames, at the scale the level would load", () => {
    const manifest = manifestOf(MANIFEST_FILES);

    expect(characterAtlasRequest(manifest, RIG, { scale: 2, baseUrl: '/OhCanada/' })).toEqual({
      key: 'shared',
      textureUrl: '/OhCanada/atlas/shared@2x.cccc3333.webp',
      dataUrl: '/OhCanada/atlas/shared@2x.dddd4444.json',
    });
    expect(characterAtlasRequest(manifest, RIG, { scale: 1, baseUrl: '/' })?.textureUrl).toBe(
      '/atlas/shared@1x.aaaa1111.webp',
    );
  });

  it('takes the only scale there is, as the level does, rather than drawing nothing', () => {
    const manifest = manifestOf(MANIFEST_FILES.filter((file) => file['scale'] === 2));
    expect(characterAtlasRequest(manifest, RIG, { scale: 1, baseUrl: '/' })?.textureUrl).toBe(
      '/atlas/shared@2x.cccc3333.webp',
    );
  });

  it('answers null when no page carries the rig, or the page has no frame data', () => {
    const levelOnly = manifestOf(MANIFEST_FILES.filter((file) => String(file['path']).includes('ottawa')));
    expect(characterAtlasRequest(levelOnly, RIG, { scale: 2, baseUrl: '/' })).toBeNull();

    const noData = manifestOf(MANIFEST_FILES.filter((file) => file['kind'] === 'atlas'));
    expect(characterAtlasRequest(noData, RIG, { scale: 2, baseUrl: '/' })).toBeNull();
  });
});

/* ------------------------------------------------------ Phaser's arithmetic --- */

const FRAME: AtlasFrame = { cutX: 10, cutY: 20, cutW: 30, cutH: 40, trimX: 2, trimY: 3, realW: 36, realH: 48 };

function part(overrides: Partial<CanvasPart> = {}): CanvasPart {
  return {
    name: 'arm-upper-l',
    order: 0,
    frame: 'f',
    originX: 0.25,
    originY: 0.5,
    x: 100,
    y: 200,
    /* A @2x frame drawn at 1x character size. */
    displayW: 18,
    displayH: 24,
    angle: 90,
    flipX: false,
    depth: 4,
    visible: true,
    destroyed: false,
    ...overrides,
  };
}

/** The x-range the drawn pixels cover in the part's own (unscaled) space. */
function coveredX(ops: readonly Op[]): readonly [number, number] {
  const scale = ops.find((op) => op[0] === 'scale') as readonly [string, number, number];
  const draw = ops.find((op) => op[0] === 'drawImage') as readonly [string, ...number[]];
  const left = draw[5] ?? 0;
  const width = draw[7] ?? 0;
  const sign = Math.sign(scale[1]);
  const a = left * sign;
  const b = (left + width) * sign;
  return [Math.min(a, b), Math.max(a, b)];
}

describe("painting a part the way Phaser 4's image does", () => {
  it('translates, rotates, then scales by display size over the untrimmed frame', () => {
    const context = recordingContext();
    const drawn = paintParts(context, [part()], new Map([['f', FRAME]]), {} as CanvasImageSource, {
      scale: 2,
      offsetX: 5,
      offsetY: 7,
    });

    expect(drawn).toBe(1);
    expect(context.ops).toEqual([
      ['setTransform', 2, 0, 0, 2, 5, 7],
      ['translate', 100, 200],
      /* Degrees to radians the way the adapter writes it, so equality is exact. */
      ['rotate', (90 * Math.PI) / 180],
      ['scale', 0.5, 0.5],
      /* -originX + trimX = -9 + 2; -originY + trimY = -24 + 3; then half a
         texel in on every side, source and destination alike. */
      ['drawImage', 10.5, 20.5, 29, 39, -6.5, -20.5, 29, 39],
    ]);
  });

  it('samples half a texel inside the cut, so the packer\'s extrude ring is never drawn', () => {
    /* The ring round a packed frame is not a copy of its edge on the shipped
       page, and sampling it drew a faint box round every part of the picture. */
    const context = recordingContext();
    paintParts(context, [part({ angle: 0 })], new Map([['f', FRAME]]), {} as CanvasImageSource, {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    const draw = context.ops.find((op) => op[0] === 'drawImage') as readonly [string, ...number[]];
    const [sx, sy, sw, sh, dx, dy, dw, dh] = draw.slice(1) as number[];
    expect(sx).toBeGreaterThan(FRAME.cutX);
    expect((sx ?? 0) + (sw ?? 0)).toBeLessThan(FRAME.cutX + FRAME.cutW);
    expect(sy).toBeGreaterThan(FRAME.cutY);
    expect((sy ?? 0) + (sh ?? 0)).toBeLessThan(FRAME.cutY + FRAME.cutH);
    /* One texel of source is one unit of destination, before the part's scale. */
    expect([dw, dh]).toEqual([sw, sh]);
    expect((dx ?? 0) - (sx ?? 0)).toBe(-9 + 2 - FRAME.cutX);
    expect((dy ?? 0) - (sy ?? 0)).toBe(-24 + 3 - FRAME.cutY);
  });

  it('mirrors the art inside its frame box, not about the origin', () => {
    const plain = recordingContext();
    const flipped = recordingContext();
    const frames = new Map([['f', FRAME]]);
    const view = { scale: 1, offsetX: 0, offsetY: 0 };
    paintParts(plain, [part()], frames, {} as CanvasImageSource, view);
    paintParts(flipped, [part({ flipX: true })], frames, {} as CanvasImageSource, view);

    /* The frame box runs from -originX to realW - originX: -9 to 27, centre 9.
       The cut covers -7 to 23, less half a texel each side. */
    const [plainLeft, plainRight] = coveredX(plain.ops);
    const [flipLeft, flipRight] = coveredX(flipped.ops);
    expect([plainLeft, plainRight]).toEqual([-6.5, 22.5]);
    expect([flipLeft, flipRight]).toEqual([18 - plainRight, 18 - plainLeft]);
    /* About the origin it would have been [-22.5, 6.5], which is the detached arm. */
    expect([flipLeft, flipRight]).not.toEqual([-plainRight, -plainLeft]);
  });

  it('draws nothing for a part whose frame is not on the page', () => {
    const context = recordingContext();
    expect(
      paintParts(context, [part({ frame: 'missing' })], new Map([['f', FRAME]]), {} as CanvasImageSource, {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toBe(0);
    expect(context.ops).toEqual([]);
  });
});

describe('the canvas host', () => {
  it('records what the puppet asks for and hands back live parts back to front', () => {
    const host = createCanvasPartHost();
    const rigPart = RIG.parts[0];
    if (rigPart === undefined) throw new Error('the rig has no parts');

    const front = host.createPart(rigPart);
    const back = host.createPart(rigPart);
    const hidden = host.createPart(rigPart);
    const gone = host.createPart(rigPart);
    for (const [object, frame, depth] of [
      [front, 'front', 9],
      [back, 'back', 1],
      [hidden, 'hidden', 5],
      [gone, 'gone', 5],
    ] as const) {
      object.setTexture('shared', frame);
      object.setDepth(depth);
    }
    front.setOrigin(0.1, 0.9);
    front.setPosition(3, 4);
    front.setDisplaySize(10, 20);
    front.setAngle(15);
    front.setFlipX(true);
    hidden.setVisible(false);
    gone.destroy();

    const drawn = host.drawn();
    expect(drawn.map((entry) => entry.frame)).toEqual(['back', 'front']);
    expect(drawn[1]).toMatchObject({ originX: 0.1, originY: 0.9, x: 3, y: 4, displayW: 10, displayH: 20, angle: 15, flipX: true });
  });
});

describe('what the picture shows', () => {
  it('fits a window centred across, with its lower edge on the canvas floor', () => {
    const view = fitView(200, 400, { x: 0, y: 0, w: 100, h: 100 });
    expect(view).toEqual({ scale: 2, offsetX: 0, offsetY: 200 });
    expect(fitView(0, 400, PREVIEW_WINDOW).scale).toBe(0);
  });

  it('keeps every part a choice changes inside the window, at rest', () => {
    /* All six choices are on the head, and the window is cropped for that. A
       crop that cut off the toque or the ends of long hair would hide a choice. */
    const chosen = /^character-(head-skin|neck|hair|face|head-covering|feature)-/u;
    const outside = Object.entries(RIG.frames)
      .filter(([name]) => chosen.test(name))
      .filter(
        ([, window]) =>
          window.x < PREVIEW_WINDOW.x ||
          window.y < PREVIEW_WINDOW.y ||
          window.x + window.w > PREVIEW_WINDOW.x + PREVIEW_WINDOW.w ||
          window.y + window.h > PREVIEW_WINDOW.y + PREVIEW_WINDOW.h,
      )
      .map(([name]) => name);
    expect(Object.keys(RIG.frames).filter((name) => chosen.test(name)).length).toBeGreaterThan(20);
    expect(outside).toEqual([]);
  });

  it('shows the whole figure, crown to boots, in either costume the levels dress the player in', () => {
    /* The audit's picture stopped at the thighs. Every frame the player's figure
       draws at rest — head, hair, coverings, and each costume's body, arms,
       hands, legs and boots — sits inside the window, on the side it was drawn
       for and mirrored for the other, and the window reaches the soles. */
    const worn = /^character-(torso|arm-upper|arm-lower|hand|bare-hand|leg-upper|leg-lower|foot-l|foot-r)-(parka|jacket)\b/u;
    const head = /^character-(head-skin|neck|hair|face|head-covering|feature)-/u;
    const figure = Object.entries(RIG.frames).filter(
      ([name]) => worn.test(name) || head.test(name) || name === 'character-ground-shadow',
    );
    expect(figure.filter(([name]) => name.includes('-jacket')).length).toBeGreaterThan(5);
    expect(figure.some(([name]) => name.startsWith('character-foot-'))).toBe(true);

    const centre = RIG.characterSpace.centreX;
    const inside = (frame: { x: number; y: number; w: number; h: number }): boolean =>
      frame.x >= PREVIEW_WINDOW.x &&
      frame.y >= PREVIEW_WINDOW.y &&
      frame.x + frame.w <= PREVIEW_WINDOW.x + PREVIEW_WINDOW.w &&
      frame.y + frame.h <= PREVIEW_WINDOW.y + PREVIEW_WINDOW.h;
    const outside = figure
      .filter(([, frame]) => !inside(frame) || !inside({ ...frame, x: 2 * centre - frame.x - frame.w }))
      .map(([name]) => name);
    expect(outside).toEqual([]);
    expect(PREVIEW_WINDOW.y + PREVIEW_WINDOW.h).toBeGreaterThanOrEqual(RIG.characterSpace.soleY);
    expect(PREVIEW_WINDOW.x + PREVIEW_WINDOW.w / 2).toBe(centre);
  });

  it('dresses only what the rig can: declared slots, offered options, nothing reserved', () => {
    const rig = {
      ...RIG,
      slots: { ...RIG.slots, presentation: { options: [], fallback: null, playerSelectable: false, status: 'reserved' } },
    } as unknown as RigDocument;

    expect(skinsFor(rig, { ...SELECTION, nonsense: 'x', hairColour: 'green' })).toEqual({
      skin: 'skin-2',
      hairShape: 'crop',
      headCovering: 'none',
      feature: 'none',
    });
  });
});

/* ------------------------------------------------------------ the picture --- */

describe('the picture, from load to release', () => {
  it('loads the level atlas and reports the frames the rig resolves for this selection', async () => {
    const { statuses, fetched, loadImage, canvas } = stage();
    expect(statuses[0]).toEqual({ state: 'loading', frames: [] });
    expect(canvas.attributes.get('aria-hidden')).toBe('true');

    await flush();

    expect(fetched).toEqual(['/OhCanada/manifest.json', '/OhCanada/atlas/shared@2x.dddd4444.json']);
    expect(loadImage).toHaveBeenCalledWith('/OhCanada/atlas/shared@2x.cccc3333.webp');
    const ready = last(statuses);
    expect(ready?.state).toBe('ready');
    const frames = ready?.frames ?? [];
    for (const expected of [
      'character-torso-parka',
      'character-head-skin-2',
      'character-hair-crop-brown',
      'character-face-neutral-feminine',
    ]) {
      expect(frames, expected).toContain(expected);
    }
    expect(frames.some((frame) => frame.startsWith('character-head-covering-'))).toBe(false);
    expect(frames.some((frame) => frame.startsWith('character-feature-'))).toBe(false);
    /* Back to front, by the rig's z. */
    expect(frames.indexOf('character-torso-parka')).toBeLessThan(frames.indexOf('character-head-skin-2'));
    expect(frames.indexOf('character-head-skin-2')).toBeLessThan(frames.indexOf('character-hair-crop-brown'));
    /* A backing store at the device's ratio. */
    expect([canvas.width, canvas.height]).toEqual([354, 564]);
  });

  it('changes what is drawn when a choice changes, and says nothing when none did', async () => {
    const { statuses, preview } = stage();
    await flush();
    const before = statuses.length;

    preview.draw({ ...SELECTION, hairShape: 'coil', headCovering: 'toque', feature: 'glasses' });
    const frames = last(statuses)?.frames ?? [];
    expect(frames).toContain('character-hair-coil-brown');
    expect(frames).not.toContain('character-hair-crop-brown');
    expect(frames).toContain('character-head-covering-toque');
    expect(frames).toContain('character-feature-glasses');
    expect(frames).toContain('character-head-skin-2');

    const after = statuses.length;
    expect(after).toBe(before + 1);
    preview.draw({ ...SELECTION, hairShape: 'coil', headCovering: 'toque', feature: 'glasses' });
    expect(statuses.length).toBe(after);
  });

  it('wears the costume it is handed, and no selection can change it', async () => {
    /* The composition root dresses the creator's picture in the jacket; the
       costume is not a player's choice, so a selection naming one is ignored. */
    const { statuses, preview } = stage({ costume: 'jacket' });
    await flush();
    const frames = last(statuses)?.frames ?? [];
    expect(frames).toContain('character-torso-jacket');
    expect(frames).toContain('character-bare-hand-jacket-skin-2');
    expect(frames).not.toContain('character-torso-parka');

    preview.draw({ ...SELECTION, skin: 'skin-5', costume: 'parka' });
    const after = last(statuses)?.frames ?? [];
    expect(after).toContain('character-torso-jacket');
    expect(after).toContain('character-bare-hand-jacket-skin-5');
    expect(after).not.toContain('character-torso-parka');
  });

  it('keeps the latest choice made while the art was still loading', async () => {
    const { statuses, preview } = stage();
    preview.draw({ ...SELECTION, skin: 'skin-6' });
    await flush();
    expect(last(statuses)?.frames).toContain('character-head-skin-6');
  });

  it('breathes at no more than thirty paints a second under full motion', async () => {
    const { frames, runFrame, draws } = stage({ motion: 'full' });
    await flush();
    expect(frames.size).toBe(1);

    runFrame(1000);
    const first = draws();
    runFrame(1000 + PREVIEW_FRAME_INTERVAL_MS / 3);
    expect(draws(), 'painted before a frame interval had passed').toBe(first);
    runFrame(1000 + PREVIEW_FRAME_INTERVAL_MS + 1);
    expect(draws()).toBeGreaterThan(first);
    expect(frames.size).toBe(1);
  });

  it('requests no frame at all under reduced motion, and stills to rest when asked', async () => {
    const still = stage({ motion: 'reduced' });
    await flush();
    expect(last(still.statuses)?.state).toBe('ready');
    expect(still.frames.size).toBe(0);
    expect(still.draws()).toBeGreaterThan(0);

    const moving = stage({ motion: 'full' });
    await flush();
    moving.runFrame(0);
    moving.runFrame(500);
    moving.preview.setMotion('reduced');
    expect(moving.cancelled.length).toBe(1);
    expect(moving.frames.size).toBe(0);

    moving.preview.setMotion('full');
    expect(moving.frames.size).toBe(1);
  });

  it('fails to words when the manifest is not there, and requests nothing more', async () => {
    const { statuses, report, loadImage, frames } = stage({
      routes: { '/OhCanada/manifest.json': response(null, 404) },
    });
    await flush();

    expect(last(statuses)).toEqual({ state: 'failed', frames: [] });
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0])).toContain('manifest.json answered 404');
    expect(loadImage).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('fails to words when the page does not decode', async () => {
    const { statuses, report } = stage({ image: () => Promise.reject(new Error('decode failed')) });
    await flush();
    expect(last(statuses)?.state).toBe('failed');
    expect(String(report.mock.calls[0]?.[0])).toContain('decode failed');
  });

  it('fails to words when the browser has no 2D canvas', () => {
    const { statuses, fetched } = stage({ noContext: true });
    expect(last(statuses)?.state).toBe('failed');
    expect(fetched).toEqual([]);
  });

  it('lets go of everything on destroy, and says nothing afterwards', async () => {
    const { statuses, preview, frames, cancelled, released, canvas, runFrame, draws } = stage();
    await flush();
    const told = statuses.length;
    const painted = draws();

    preview.destroy();
    expect(cancelled.length).toBe(1);
    expect(frames.size).toBe(0);
    expect(released).toHaveBeenCalledTimes(1);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(canvas.removed).toBe(1);

    preview.draw({ ...SELECTION, skin: 'skin-5' });
    preview.setMotion('reduced');
    runFrame(5000);
    preview.destroy();
    expect(statuses.length).toBe(told);
    expect(draws()).toBe(painted);
    expect(released).toHaveBeenCalledTimes(1);
  });

  it('releases a page that arrives after the creator closed, and never reports it ready', async () => {
    let arrive: (image: PreviewImage) => void = () => undefined;
    const release = vi.fn();
    const { statuses, preview } = stage({
      image: () =>
        new Promise<PreviewImage>((resolve) => {
          arrive = resolve;
        }),
    });
    await flush();
    preview.destroy();
    arrive({ source: {} as CanvasImageSource, release });
    await flush();

    expect(release).toHaveBeenCalledTimes(1);
    expect(statuses.map((status) => status.state)).toEqual(['loading']);
  });

  it("uses the page's own fetch, frame clock, pixel ratio, image and console when nothing is injected", async () => {
    /* What the composition root actually wires: only the rig. Everything else
       is the browser's, read at the moment it is needed. */
    const context = recordingContext();
    const canvas = {
      width: 0,
      height: 0,
      setAttribute: vi.fn(),
      getContext: () => context,
      remove: vi.fn(),
    };
    const image = {
      decoding: 'auto',
      src: '',
      decode: vi.fn(() => Promise.resolve()),
      removeAttribute: vi.fn(),
    };
    let onResize: (() => void) | null = null;
    const disconnect = vi.fn();
    class FakeResizeObserver {
      constructor(callback: () => void) {
        onResize = callback;
      }
      observe(): void {}
      disconnect(): void {
        disconnect();
      }
    }
    const host = {
      ownerDocument: {
        createElement: (tag: string) => (tag === 'img' ? image : canvas),
        defaultView: { ResizeObserver: FakeResizeObserver },
      },
      clientWidth: 118,
      clientHeight: 188,
      append: vi.fn(),
    };
    /* Vitest's base path is `/`, which is where the default reads manifest.json. */
    const routes: Record<string, ReturnType<typeof response>> = {
      '/manifest.json': response({ version: 2, files: MANIFEST_FILES }),
      '/atlas/shared@1x.bbbb2222.json': response(atlasData()),
    };
    const fetched: string[] = [];
    const frames: ((now: number) => void)[] = [];
    const cancelled: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        fetched.push(url);
        return Promise.resolve(routes[url] ?? response(null, 404));
      }),
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: (now: number) => void) => {
        frames.push(callback);
        return frames.length;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((handle: number) => {
        cancelled.push(handle);
      }),
    );
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const statuses: PreviewStatus[] = [];
      const preview = createCharacterPreview(
        host as unknown as HTMLElement,
        { selection: SELECTION, motion: 'full', onStatus: (status) => void statuses.push(status) },
        { rig: RIG },
      );
      await flush();

      expect(fetched).toEqual(['/manifest.json', '/atlas/shared@1x.bbbb2222.json']);
      expect(image.src).toBe('/atlas/shared@1x.aaaa1111.webp');
      expect(image.decoding).toBe('async');
      expect(last(statuses)?.state).toBe('ready');
      expect([canvas.width, canvas.height]).toEqual([118, 188]);
      expect(frames).toHaveLength(1);

      host.clientWidth = 150;
      (onResize as (() => void) | null)?.();
      expect(canvas.width).toBe(150);

      preview.destroy();
      expect(cancelled).toEqual([1]);
      expect(image.removeAttribute).toHaveBeenCalledWith('src');
      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(canvas.remove).toHaveBeenCalledTimes(1);
      expect(errors).not.toHaveBeenCalled();

      /* And a failure is said on the console, never swallowed. */
      routes['/manifest.json'] = response(null, 500);
      createCharacterPreview(
        host as unknown as HTMLElement,
        { selection: SELECTION, motion: 'full', onStatus: () => undefined },
        { rig: RIG },
      );
      await flush();
      expect(errors).toHaveBeenCalledTimes(1);
      expect(String(errors.mock.calls[0]?.[0])).toMatch(/^\[creator-preview\] .*manifest\.json answered 500/u);
    } finally {
      vi.unstubAllGlobals();
      errors.mockRestore();
    }
  });
});
