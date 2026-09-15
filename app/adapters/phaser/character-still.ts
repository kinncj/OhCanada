/**
 * A character as a still picture: the level's own puppet, painted once into an
 * offscreen canvas and handed back as an image URL (ADR-0041).
 *
 * ## What it is for
 *
 * The dialogue shows who is speaking and the title screen shows the player's
 * character. Both are pictures of a character standing still, and both are the
 * character the level draws: the same atlas page, the same frame templates,
 * pivots and rest pose. So this is ADR-0040's seam used a second way — the
 * creator's picture keeps its canvas because it breathes and follows every
 * choice; these hold still, so they are painted once and the canvas is let go.
 *
 * ## Why an image and not a canvas on the page
 *
 * A picture that never changes has no reason to keep a backing store, a decoded
 * atlas page or a frame loop alive. Painting into a canvas that is never put on
 * the page and handing back `toBlob`'s object URL leaves one small PNG and an
 * `<img>` — nothing else. It also keeps the page's `<canvas>` count what the
 * browser suites expect: the game's, and the creator's while it is open.
 *
 * ## Cost and lifetime
 *
 * One call loads the atlas page the level loads — found by the rig's frames, at
 * the scale the level would choose, so it is a cache hit — paints every picture
 * asked for, and releases the decoded page before it returns. The caller owns
 * the URLs it gets back and revokes them.
 *
 * No Phaser import. The arithmetic is `character-preview.ts`'s, which is
 * Phaser's image transform transcribed and tested there.
 */

import type { RigDocument } from '@application/ports';

import { artboardFor, playerArtboard } from './character-cast';
import {
  characterAtlasRequest,
  createCanvasPartHost,
  fitView,
  paintParts,
  parseAtlasFrames,
  skinsFor,
  type AtlasFrame,
  type PreviewContext2D,
  type PreviewImage,
  type PreviewWindow,
} from './character-preview';
import type { AssetManifest } from './level-assets';
import {
  createSpriteCharacterRenderer,
  type SpriteCharacterRenderer,
} from './sprite-character-renderer';

/**
 * A speaker's face: the head and the top of the shoulders.
 *
 * In character space, where every head is drawn the same size (the 6-head
 * canon): the tallest thing on any head is the officer's hat at y 2 and the
 * widest is the beaver's head shell, x 66–182. A square from just above the hat
 * to the collar holds every face the game draws without cropping one.
 */
export const PORTRAIT_WINDOW: PreviewWindow = { x: 42, y: -4, w: 164, h: 164 };

/**
 * The whole figure, crown to soles, with the width of a raised arm either side.
 * `rig.characterSpace` is 240 × 470 with the soles at 460.
 */
export const FIGURE_WINDOW: PreviewWindow = { x: 0, y: -6, w: 240, h: 470 };

/** A painted picture is never larger than this on a side, whatever was asked. */
export const STILL_MAX_PX = 1024;

export interface CharacterStillRequest {
  /** The artboard to dress: a character id the rig names, or `null` for the player. */
  readonly characterId: string | null;
  /** Slot -> option. Absent dresses the artboard's own skins and each slot's fallback. */
  readonly skins?: Readonly<Record<string, string>>;
  readonly window: PreviewWindow;
  /** The picture's size in device pixels. */
  readonly widthPx: number;
  readonly heightPx: number;
}

/** A canvas-shaped thing to paint into, and the way to turn it into a URL. */
export interface StillSurface {
  readonly context: PreviewContext2D | null;
  toUrl(): Promise<string | null>;
  release(): void;
}

export interface CharacterStillDeps {
  /** `content/characters/rig.json`, handed in by the composition root (ADR-0022). */
  readonly rig: RigDocument;
  /** The asset manifest, already read. */
  readonly manifest: AssetManifest;
  /** Where the manifest's paths are served from. */
  readonly baseUrl: string;
  /** `preferredAssetScale(devicePixelRatio)`: the scale the level would load. */
  readonly scale: number;
  readonly fetchJson: (url: string) => Promise<unknown>;
  readonly loadImage: (url: string) => Promise<PreviewImage>;
  readonly createSurface: (widthPx: number, heightPx: number) => StillSurface;
  /** Where a failure is told. Never silent. */
  readonly report: (message: string) => void;
}

/**
 * Paint each request, in order. A request that cannot be painted is `null` in
 * its place, and so is every request when the atlas cannot be read.
 */
export async function paintCharacterStills(
  requests: readonly CharacterStillRequest[],
  deps: CharacterStillDeps,
): Promise<readonly (string | null)[]> {
  const none = (): readonly null[] => requests.map(() => null);
  if (requests.length === 0) return [];

  const wanted = characterAtlasRequest(deps.manifest, deps.rig, {
    scale: deps.scale,
    baseUrl: deps.baseUrl,
  });
  if (wanted === null) {
    deps.report("the asset manifest lists no atlas page carrying the rig's frames.");
    return none();
  }

  let image: PreviewImage | null = null;
  try {
    const frames = parseAtlasFrames(await deps.fetchJson(wanted.dataUrl));
    if (frames === null) throw new Error(`${wanted.dataUrl} carries no readable frames`);
    image = await deps.loadImage(wanted.textureUrl);

    const painted: (string | null)[] = [];
    for (const request of requests) {
      painted.push(await paintOne(request, wanted.key, frames, image, deps));
    }
    return painted;
  } catch (cause) {
    deps.report(
      `the character art could not be loaded, so no still was painted. ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
    return none();
  } finally {
    /* Released on every path: a decoded atlas page is ten megabytes at 2x. */
    image?.release();
  }
}

/** The side lengths a request is painted at: whole pixels, at least 1, at most {@link STILL_MAX_PX}. */
export function stillSize(request: Pick<CharacterStillRequest, 'widthPx' | 'heightPx'>): {
  readonly width: number;
  readonly height: number;
} {
  const side = (value: number): number =>
    Number.isFinite(value) ? Math.min(STILL_MAX_PX, Math.max(1, Math.round(value))) : 1;
  return { width: side(request.widthPx), height: side(request.heightPx) };
}

async function paintOne(
  request: CharacterStillRequest,
  textureKey: string,
  frames: ReadonlyMap<string, AtlasFrame>,
  image: PreviewImage,
  deps: CharacterStillDeps,
): Promise<string | null> {
  const rig = deps.rig;
  const artboard =
    request.characterId === null ? playerArtboard(rig) : artboardFor(rig, request.characterId);
  if (artboard === null) {
    deps.report(`the rig has no artboard for "${String(request.characterId ?? 'the player')}".`);
    return null;
  }

  const parts = createCanvasPartHost();
  const built = createSpriteCharacterRenderer(
    {
      characterId: artboard.characterId,
      artboard: artboard.artboard,
      stateMachine: artboard.stateMachine,
      rig,
      skins: skinsFor(rig, request.skins ?? {}),
      widthPx: rig.characterSpace.width,
      heightPx: rig.characterSpace.height,
    },
    {
      textureKey,
      frames: { hasFrame: (key, frame) => key === textureKey && frames.has(frame) },
      host: parts,
    },
  );
  if (!built.ok) {
    deps.report(`${built.error.code}: ${built.error.message}`);
    return null;
  }

  const puppet: SpriteCharacterRenderer = built.value;
  try {
    /* Feet on the sole line, so the window is in character space. */
    puppet.setPosition(rig.characterSpace.centreX, rig.characterSpace.soleY);
    const { width, height } = stillSize(request);
    const surface = deps.createSurface(width, height);
    try {
      if (surface.context === null) {
        deps.report('this browser gave the still no 2D canvas.');
        return null;
      }
      const drawn = paintParts(
        surface.context,
        parts.drawn(),
        frames,
        image.source,
        fitView(width, height, request.window),
      );
      if (drawn === 0) return null;
      return await surface.toUrl();
    } finally {
      surface.release();
    }
  } finally {
    puppet.dispose();
  }
}

/** A canvas that is never put on the page, turned into an object URL. */
export function createBrowserStillSurface(doc: Document) {
  return (widthPx: number, heightPx: number): StillSurface => {
    const canvas = doc.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext('2d');
    /* Bilinear, and no mipmaps, as the creator's picture draws (ADR-0040). */
    if (context !== null) context.imageSmoothingQuality = 'low';
    return {
      context,
      toUrl: () =>
        new Promise<string | null>((resolve) => {
          const View = doc.defaultView;
          if (typeof canvas.toBlob !== 'function' || View === null) {
            resolve(null);
            return;
          }
          canvas.toBlob((blob) => {
            resolve(blob === null ? null : View.URL.createObjectURL(blob));
          }, 'image/png');
        }),
      release: () => {
        /* A zero-sized canvas holds no backing store. */
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  };
}

/** An `<img>` decoded off the main thread, released by dropping its source. */
export async function loadStillImage(doc: Document, url: string): Promise<PreviewImage> {
  const image = doc.createElement('img');
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return {
    source: image,
    release: () => {
      image.removeAttribute('src');
    },
  };
}
