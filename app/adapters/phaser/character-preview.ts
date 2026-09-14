/**
 * The character creator's picture: the level's own puppet, drawn into a small
 * 2D canvas rather than into a second game (ADR-0040).
 *
 * ## The defect this closes
 *
 * The creator offered six groups of choices and 1 440 appearances and showed the
 * player none of them. "Your character" was a sentence — "Skin tone: 2, light.
 * Hair: Short. …" — and `app/ui/character-creator.ts` carried a comment about
 * "the renderer that will drive the preview" that nothing drove. A player chose
 * a face, a hair shape and a colour and met the result for the first time on the
 * ice.
 *
 * ## Why a 2D canvas and not a Phaser game
 *
 * The puppet in `sprite-character-renderer.ts` is already pure: it resolves the
 * rig's frame templates, selects a state and places twenty-odd parts through a
 * seven-method {@link SpritePartObject} a host supplies. The level's host is
 * `this.add.image`. This file is a second host, one that records what the puppet
 * asked for and paints it with `drawImage`. So the picture is **the same art, the
 * same templates, the same pivots and the same idle keyframes the level draws**,
 * and none of it is reimplemented here.
 *
 * A second `Phaser.Game` would have drawn it too, and would have been a second
 * WebGL context alive beside the first on a phone, a second boot and a second
 * texture manager, for a picture 118 CSS px wide. A 2D context on a canvas that
 * size costs about one megabyte of backing store at device pixel ratio 3.
 *
 * ## Phaser's image, transcribed
 *
 * "What you see is what the level draws" is only true if a part lands where
 * Phaser puts it, and three details of Phaser 4's `TransformerImage` decide that:
 *
 *  - a part's size and origin are measured against the frame's **untrimmed**
 *    size (`realWidth`), and the trimmed pixels start `trimX` into it;
 *  - `setDisplaySize` is a scale, `displayWidth / realWidth`, which is what puts
 *    a @2x atlas at 1x character size;
 *  - `flipX` mirrors the art **inside its frame box**, not about the origin:
 *    Phaser adds `2 * displayOriginX - realWidth` to the quad's left edge and
 *    negates the scale. Mirroring about the origin instead is the "detached arm
 *    floating beside the body" defect the puppet's header already describes.
 *
 * The translate-rotate-scale order is Phaser's `applyITRS`. {@link paintParts}
 * is those rules and nothing else, and is tested against them.
 *
 * ## Cost and lifetime
 *
 * The atlas is the one the level loads — `shared@<scale>x`, chosen by the same
 * `preferredAssetScale` and the same per-key {@link bestScale} — so on a player's
 * way into a level it is a cache hit, not a second download. It is fetched when
 * the creator mounts, never on the title screen, so it is outside the initial
 * payload. The decoded image, the canvas's backing store and the animation frame
 * are released in {@link CharacterPreview.destroy}, which the creator calls when
 * it closes.
 *
 * Under reduced motion no frame is ever requested: the puppet is built at rest
 * and painted once per change.
 *
 * No Phaser import. Everything that can be pure is exported and unit tested.
 */

import type {
  CharacterRendererSpec,
  RigArtboard,
  RigDocument,
  RigPart,
  RigSlot,
} from '@application/ports';

import { playerArtboard } from './character-cast';
import {
  atlasKeyOf,
  bestScale,
  parseAssetManifest,
  preferredAssetScale,
  type AssetManifest,
  type AssetManifestFile,
} from './level-assets';
import {
  createSpriteCharacterRenderer,
  type SpriteCharacterRenderer,
  type SpritePartHost,
  type SpritePartObject,
} from './sprite-character-renderer';

export type PreviewMotion = 'reduced' | 'full';
export type PreviewState = 'loading' | 'ready' | 'failed';

/** How far the picture got, and what it is drawing. */
export interface PreviewStatus {
  readonly state: PreviewState;
  /**
   * The atlas frames on the picture, back to front.
   *
   * The probe the e2e suite reads: pixels are not comparable across GPUs, and
   * SwiftShader least of all, but "choosing coily hair put
   * `character-hair-coil-black` on the picture" is a string.
   */
  readonly frames: readonly string[];
}

/* ------------------------------------------------------------ the atlas --- */

/** One packed frame, in the terms Phaser's image uses. */
export interface AtlasFrame {
  /** Where the trimmed pixels are on the page. */
  readonly cutX: number;
  readonly cutY: number;
  readonly cutW: number;
  readonly cutH: number;
  /** Where those pixels start inside the untrimmed source. */
  readonly trimX: number;
  readonly trimY: number;
  /** The untrimmed source's size: Phaser's `realWidth` and `realHeight`. */
  readonly realW: number;
  readonly realH: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberAt = (record: unknown, key: string): number | null => {
  if (!isRecord(record)) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/**
 * Read a packer's frame data: the Phaser 3 multi-atlas shape
 * (`textures[0].frames[]`) that `scripts/assets.mjs` emits, or a bare
 * `frames[]`.
 *
 * `null` when there is nothing readable, rather than an empty map: an empty map
 * would build a puppet that draws nothing and calls itself ready. A rotated
 * frame is left out — the packer is told `allowRotation: false`, and a picture
 * drawn sideways would be worse than a part that is missing.
 */
export function parseAtlasFrames(source: unknown): ReadonlyMap<string, AtlasFrame> | null {
  if (!isRecord(source)) return null;
  const textures = source['textures'];
  const firstTexture = Array.isArray(textures) ? (textures[0] as unknown) : undefined;
  const list = Array.isArray(source['frames'])
    ? source['frames']
    : isRecord(firstTexture) && Array.isArray(firstTexture['frames'])
      ? firstTexture['frames']
      : null;
  if (list === null) return null;

  const frames = new Map<string, AtlasFrame>();
  for (const entry of list as readonly unknown[]) {
    if (!isRecord(entry) || typeof entry['filename'] !== 'string') continue;
    if (entry['rotated'] === true) continue;
    const cut = entry['frame'];
    const cutX = numberAt(cut, 'x');
    const cutY = numberAt(cut, 'y');
    const cutW = numberAt(cut, 'w');
    const cutH = numberAt(cut, 'h');
    if (cutX === null || cutY === null || cutW === null || cutH === null) continue;
    const trimmed = entry['trimmed'] === true;
    const sprite = entry['spriteSourceSize'];
    const real = entry['sourceSize'];
    frames.set(entry['filename'], {
      cutX,
      cutY,
      cutW,
      cutH,
      trimX: trimmed ? (numberAt(sprite, 'x') ?? 0) : 0,
      trimY: trimmed ? (numberAt(sprite, 'y') ?? 0) : 0,
      realW: trimmed ? (numberAt(real, 'w') ?? cutW) : cutW,
      realH: trimmed ? (numberAt(real, 'h') ?? cutH) : cutH,
    });
  }
  return frames.size === 0 ? null : frames;
}

export interface CharacterAtlasRequest {
  /** The texture key the level would load the page under: `shared`. */
  readonly key: string;
  readonly textureUrl: string;
  readonly dataUrl: string;
}

/**
 * The atlas page that carries the rig's frames, at the scale the level would
 * load it.
 *
 * Found by content rather than by name: the page whose manifest `keys` include
 * the rig's frames, grouped by texture key the way `selectLevelAssets` groups
 * them, and resolved per key by the same {@link bestScale}. The key carrying
 * the most rig frames wins, which today is the only one. `null` when no page
 * carries any, or the chosen page has no frame data.
 */
export function characterAtlasRequest(
  manifest: AssetManifest,
  rig: RigDocument,
  options: { readonly scale: number; readonly baseUrl: string },
): CharacterAtlasRequest | null {
  const wanted = new Set(Object.keys(rig.frames));
  const byKey = new Map<string, { files: AssetManifestFile[]; hits: number }>();
  for (const file of manifest.files) {
    if (file.kind !== 'atlas') continue;
    const hits = file.keys.filter((key) => wanted.has(key)).length;
    if (hits === 0) continue;
    const key = atlasKeyOf(file.path);
    if (key === null) continue;
    const group = byKey.get(key) ?? { files: [], hits: 0 };
    group.files.push(file);
    group.hits = Math.max(group.hits, hits);
    byKey.set(key, group);
  }

  const ranked = [...byKey.entries()].sort(
    (a, b) => b[1].hits - a[1].hits || a[0].localeCompare(b[0]),
  );
  const first = ranked[0];
  if (first === undefined) return null;
  const [key, group] = first;
  const chosen = bestScale(group.files, options.scale);
  if (chosen === undefined) return null;
  const data = manifest.files.find((file) => file.kind === 'atlas-data' && file.atlas === chosen.path);
  if (data === undefined) return null;
  return {
    key,
    textureUrl: `${options.baseUrl}${chosen.path}`,
    dataUrl: `${options.baseUrl}${data.path}`,
  };
}

/* ------------------------------------------------------ the canvas host --- */

/** What the puppet asked one part to be, recorded rather than drawn. */
export interface CanvasPart {
  readonly name: string;
  /** Creation order, so equal depths keep the order Phaser's stable sort keeps. */
  readonly order: number;
  frame: string | null;
  originX: number;
  originY: number;
  x: number;
  y: number;
  displayW: number | null;
  displayH: number | null;
  angle: number;
  flipX: boolean;
  depth: number;
  visible: boolean;
  destroyed: boolean;
}

export interface CanvasPartHost extends SpritePartHost {
  /** The live, visible, textured parts, back to front. */
  drawn(): readonly CanvasPart[];
}

export function createCanvasPartHost(): CanvasPartHost {
  let parts: CanvasPart[] = [];
  let created = 0;

  return {
    createPart(part: RigPart): SpritePartObject {
      /* Parts are rebuilt on every choice, so the dead ones are dropped here
         rather than accumulating for as long as the creator is open. */
      parts = parts.filter((existing) => !existing.destroyed);
      const record: CanvasPart = {
        name: part.name,
        order: created,
        frame: null,
        /* Phaser's image default, which the puppet overwrites before a paint. */
        originX: 0.5,
        originY: 0.5,
        x: 0,
        y: 0,
        displayW: null,
        displayH: null,
        angle: 0,
        flipX: false,
        depth: 0,
        visible: true,
        destroyed: false,
      };
      created += 1;
      parts.push(record);
      return {
        setTexture: (_key: string, frame: string) => {
          record.frame = frame;
        },
        setOrigin: (x: number, y: number) => {
          record.originX = x;
          record.originY = y;
        },
        setPosition: (x: number, y: number) => {
          record.x = x;
          record.y = y;
        },
        setDisplaySize: (width: number, height: number) => {
          record.displayW = width;
          record.displayH = height;
        },
        setAngle: (degrees: number) => {
          record.angle = degrees;
        },
        setFlipX: (flip: boolean) => {
          record.flipX = flip;
        },
        setDepth: (depth: number) => {
          record.depth = depth;
        },
        setVisible: (visible: boolean) => {
          record.visible = visible;
        },
        destroy: () => {
          record.destroyed = true;
        },
      };
    },

    drawn(): readonly CanvasPart[] {
      parts = parts.filter((part) => !part.destroyed);
      return parts
        .filter((part) => part.visible && part.frame !== null)
        .sort((a, b) => a.depth - b.depth || a.order - b.order);
    },
  };
}

/** The part of `CanvasRenderingContext2D` a paint uses, so a test can stand in for it. */
export interface PreviewContext2D {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(x: number, y: number): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

/** Character space to canvas pixels: a uniform scale and an offset. */
export interface PreviewView {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * How far inside a frame's cut rectangle a draw samples, in texels.
 *
 * The packer extrudes each frame by one texel, and on the shipped page that ring
 * is not a copy of the frame's edge: beside `character-head-skin-2`'s transparent
 * left column sits a texel at alpha 186. A 2D canvas scaling a sub-rectangle is
 * allowed to sample past it, and at the preview's size it did, drawing a faint
 * one-pixel box round every part. Half a texel in, bilinear sampling never
 * reaches the ring; the half-texel lost is the frame's own transparent margin.
 */
export const SOURCE_INSET_TEXELS = 0.5;

/**
 * Paint recorded parts the way Phaser 4 draws an image. See the header for the
 * three rules; the arithmetic below is `TransformerImage.run`, line for line,
 * with the source inset by {@link SOURCE_INSET_TEXELS} and the destination by
 * the same amount, so every texel still lands where Phaser puts it.
 *
 * Returns how many parts were drawn. A part whose frame is not on the page draws
 * nothing, which is the rig's own rule for a "none" option.
 */
export function paintParts(
  context: PreviewContext2D,
  parts: readonly CanvasPart[],
  frames: ReadonlyMap<string, AtlasFrame>,
  image: CanvasImageSource,
  view: PreviewView,
): number {
  let drawn = 0;
  for (const part of parts) {
    const frame = part.frame === null ? undefined : frames.get(part.frame);
    if (frame === undefined || !(frame.realW > 0) || !(frame.realH > 0)) continue;

    const scaleX = (part.displayW ?? frame.realW) / frame.realW;
    const scaleY = (part.displayH ?? frame.realH) / frame.realH;
    const originX = part.originX * frame.realW;
    const originY = part.originY * frame.realH;

    let left = -originX + frame.trimX;
    const top = -originY + frame.trimY;
    if (part.flipX) left += -frame.realW + originX * 2;

    context.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
    context.translate(part.x, part.y);
    context.rotate((part.angle * Math.PI) / 180);
    context.scale(scaleX * (part.flipX ? -1 : 1), scaleY);
    const inset = frame.cutW > 1 && frame.cutH > 1 ? SOURCE_INSET_TEXELS : 0;
    context.drawImage(
      image,
      frame.cutX + inset,
      frame.cutY + inset,
      frame.cutW - inset * 2,
      frame.cutH - inset * 2,
      left + inset,
      top + inset,
      frame.cutW - inset * 2,
      frame.cutH - inset * 2,
    );
    drawn += 1;
  }
  return drawn;
}

/** A region of character space, `rig.characterSpace` units. */
export interface PreviewWindow {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * What the picture shows: the figure from just above the crown to mid-thigh.
 *
 * Every choice the creator offers is on the head — skin on the face and neck,
 * both hair slots, the toque, the glasses, and presentation in the face — and
 * the costume is fixed. A full-length figure in a box a phone can afford puts
 * the face at about twenty pixels; this window gives the head half as much
 * again, and still shows a person standing in a parka rather than a floating
 * head. The level draws the same parts from the same frames; this is where the
 * camera stands.
 */
export const PREVIEW_WINDOW: PreviewWindow = { x: 18, y: -8, w: 204, h: 352 };

/**
 * Fit a window into a canvas: uniform scale, centred across, feet-side edge on
 * the canvas's bottom edge so a crop never floats.
 */
export function fitView(widthPx: number, heightPx: number, window: PreviewWindow): PreviewView {
  if (!(widthPx > 0) || !(heightPx > 0) || !(window.w > 0) || !(window.h > 0)) {
    return { scale: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(widthPx / window.w, heightPx / window.h);
  return {
    scale,
    offsetX: (widthPx - window.w * scale) / 2 - window.x * scale,
    offsetY: heightPx - window.h * scale - window.y * scale,
  };
}

/**
 * A selection reduced to what the rig can dress: declared, not reserved, and an
 * option the slot has. The puppet refuses a spec naming anything else, and a
 * picture that refused to draw over one stale key would be a worse answer than
 * a picture missing that key.
 */
export function skinsFor(
  rig: RigDocument,
  selection: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const slots = rig.slots as unknown as Readonly<Record<string, RigSlot | undefined>>;
  const skins: Record<string, string> = {};
  for (const [name, option] of Object.entries(selection)) {
    const slot = slots[name];
    if (slot === undefined || slot.status === 'reserved' || !slot.options.includes(option)) continue;
    skins[name] = option;
  }
  return skins;
}

/* ------------------------------------------------------------ the picture --- */

/** A decoded image, and how to let go of it. */
export interface PreviewImage {
  readonly source: CanvasImageSource;
  release(): void;
}

interface PreviewResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export interface CharacterPreviewDeps {
  /** `content/characters/rig.json`, handed in by the composition root (ADR-0022). */
  readonly rig: RigDocument;
  /** Where `manifest.json` is served. Defaults to the build's base path. */
  readonly assetsBaseUrl?: string;
  readonly fetch?: (url: string) => Promise<PreviewResponse>;
  readonly devicePixelRatio?: () => number;
  readonly loadImage?: (url: string) => Promise<PreviewImage>;
  readonly requestFrame?: (callback: (now: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
  /** Where a failure is told. Defaults to `console.error`: never silent. */
  readonly report?: (message: string) => void;
}

export interface CharacterPreviewRequest {
  readonly selection: Readonly<Record<string, string>>;
  readonly motion: PreviewMotion;
  readonly onStatus: (status: PreviewStatus) => void;
}

export interface CharacterPreview {
  /** Dress the picture in this selection. Cheap when nothing changed. */
  draw(selection: Readonly<Record<string, string>>): void;
  setMotion(motion: PreviewMotion): void;
  /** Stop the frame loop and let go of the image, the canvas and the puppet. Idempotent. */
  destroy(): void;
}

/** The idle breathes; thirty paints a second is all a 2.4 s cycle needs. */
export const PREVIEW_FRAME_INTERVAL_MS = 1000 / 30;

/** A backing store is never larger than this on a side, whatever the box. */
export const PREVIEW_MAX_CANVAS_PX = 1024;

/** The longest gap one frame may advance the idle, so a background tab does not jump. */
const MAX_STEP_MS = 250;

export function createCharacterPreview(
  host: HTMLElement,
  request: CharacterPreviewRequest,
  deps: CharacterPreviewDeps,
): CharacterPreview {
  const doc = host.ownerDocument;
  const rig = deps.rig;
  const baseUrl = deps.assetsBaseUrl ?? defaultBaseUrl();
  const fetchJson =
    deps.fetch ?? ((url: string): Promise<PreviewResponse> => globalThis.fetch(url));
  const ratio =
    deps.devicePixelRatio ??
    ((): number => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  const loadImage = deps.loadImage ?? ((url: string) => loadImageElement(doc, url));
  const requestFrame =
    deps.requestFrame ?? ((callback: (now: number) => void) => globalThis.requestAnimationFrame(callback));
  const cancelFrame = deps.cancelFrame ?? ((handle: number) => globalThis.cancelAnimationFrame(handle));
  const report =
    deps.report ??
    ((message: string): void => {
      console.error(`[creator-preview] ${message}`);
    });

  let selection = request.selection;
  let motion = request.motion;
  let disposed = false;
  let failed = false;
  let atlas: { key: string; frames: ReadonlyMap<string, AtlasFrame>; image: PreviewImage } | null =
    null;
  let parts: CanvasPartHost | null = null;
  let puppet: SpriteCharacterRenderer | null = null;
  let dressed: Readonly<Record<string, string>> = {};
  let handle: number | null = null;
  let lastTick: number | null = null;
  let owed = 0;
  let published: string | null = null;

  const canvas = doc.createElement('canvas');
  /* Decoration. The words beside it are the preview a screen reader reads. */
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const context = canvas.getContext('2d');
  /* Bilinear, and no mipmaps: a mipmapped draw of a sub-rectangle averages in
     texels from neighbouring frames, whatever the inset. */
  if (context !== null) context.imageSmoothingQuality = 'low';

  const View = doc.defaultView as (Window & typeof globalThis) | null;
  const observer =
    View !== null && typeof View.ResizeObserver === 'function'
      ? new View.ResizeObserver(() => {
          if (resize()) render();
        })
      : null;
  observer?.observe(host);

  tell('loading', []);
  if (context === null) fail('this browser gave the preview no 2D canvas.');
  else void load();

  return {
    draw(next): void {
      if (disposed) return;
      selection = next;
      if (puppet === null) return;
      const skins = skinsFor(rig, next);
      for (const [slot, option] of Object.entries(skins)) {
        if (dressed[slot] === option) continue;
        const changed = puppet.setSkin(slot, option);
        if (!changed.ok) report(`${changed.error.code}: ${changed.error.message}`);
      }
      dressed = skins;
      resize();
      render();
      publish();
    },

    setMotion(next): void {
      if (disposed || next === motion) return;
      motion = next;
      if (next === 'reduced') {
        stop();
        /* At rest, not frozen mid-breath: a still pose is the first key. */
        build();
      } else {
        schedule();
      }
    },

    destroy(): void {
      if (disposed) return;
      disposed = true;
      stop();
      observer?.disconnect();
      puppet?.dispose();
      puppet = null;
      parts = null;
      atlas?.image.release();
      atlas = null;
      /* A zero-sized canvas holds no backing store, whoever still references it. */
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    },
  };

  async function load(): Promise<void> {
    try {
      const manifestResponse = await fetchJson(`${baseUrl}manifest.json`);
      if (!manifestResponse.ok) {
        throw new Error(`manifest.json answered ${String(manifestResponse.status)}`);
      }
      const manifest = parseAssetManifest(await manifestResponse.json());
      if (!manifest.ok) throw new Error(`${manifest.error.code}: ${manifest.error.message}`);
      if (disposed) return;

      const wanted = characterAtlasRequest(manifest.value, rig, {
        scale: preferredAssetScale(ratio()),
        baseUrl,
      });
      if (wanted === null) {
        throw new Error("the asset manifest lists no atlas page carrying the rig's frames");
      }

      /* The frame data first and the image second, so a failure between the two
         never leaves a decoded page nobody will release. */
      const dataResponse = await fetchJson(wanted.dataUrl);
      if (!dataResponse.ok) {
        throw new Error(`${wanted.dataUrl} answered ${String(dataResponse.status)}`);
      }
      const frames = parseAtlasFrames(await dataResponse.json());
      if (frames === null) throw new Error(`${wanted.dataUrl} carries no readable frames`);
      if (disposed) return;

      const image = await loadImage(wanted.textureUrl);
      if (disposed) {
        image.release();
        return;
      }
      atlas = { key: wanted.key, frames, image };
      build();
    } catch (cause) {
      fail(
        `the character art could not be loaded, so the preview is words only. ` +
          `${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  /** A fresh puppet at rest, in the current selection. */
  function build(): void {
    if (disposed || failed || atlas === null) return;
    const artboard = playerArtboard(rig);
    if (artboard === null) {
      fail('the rig has no player artboard to dress.');
      return;
    }
    const loaded = atlas;
    const nextParts = createCanvasPartHost();
    const skins = skinsFor(rig, selection);
    const built = createSpriteCharacterRenderer(specFor(rig, artboard, skins), {
      textureKey: loaded.key,
      frames: { hasFrame: (key, frame) => key === loaded.key && loaded.frames.has(frame) },
      host: nextParts,
    });
    if (!built.ok) {
      fail(`${built.error.code}: ${built.error.message}`);
      return;
    }
    puppet?.dispose();
    puppet = built.value;
    parts = nextParts;
    dressed = skins;
    /* The feet on the sole line, so every part lands at its character-space
       coordinates and PREVIEW_WINDOW means what it says. */
    puppet.setPosition(rig.characterSpace.centreX, rig.characterSpace.soleY);
    resize();
    render();
    publish();
    schedule();
  }

  function resize(): boolean {
    const k = ratio();
    const width = Math.min(PREVIEW_MAX_CANVAS_PX, Math.max(0, Math.round(host.clientWidth * k)));
    const height = Math.min(PREVIEW_MAX_CANVAS_PX, Math.max(0, Math.round(host.clientHeight * k)));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    /* Resizing a canvas resets its context state. */
    if (context !== null) context.imageSmoothingQuality = 'low';
    return true;
  }

  function render(): void {
    if (disposed || context === null || atlas === null || parts === null) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintParts(
      context,
      parts.drawn(),
      atlas.frames,
      atlas.image.source,
      fitView(canvas.width, canvas.height, PREVIEW_WINDOW),
    );
  }

  function publish(): void {
    if (parts === null) return;
    const frames = parts.drawn().map((part) => part.frame ?? '');
    const key = frames.join(' ');
    if (key === published) return;
    published = key;
    tell('ready', frames);
  }

  function schedule(): void {
    if (disposed || failed || motion === 'reduced' || puppet === null || handle !== null) return;
    handle = requestFrame(tick);
  }

  function tick(now: number): void {
    handle = null;
    if (disposed || motion === 'reduced' || puppet === null) return;
    const step = lastTick === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - lastTick));
    lastTick = now;
    owed += step;
    if (owed >= PREVIEW_FRAME_INTERVAL_MS) {
      puppet.update(owed);
      owed = 0;
      render();
    }
    schedule();
  }

  function stop(): void {
    if (handle !== null) cancelFrame(handle);
    handle = null;
    lastTick = null;
    owed = 0;
  }

  function fail(message: string): void {
    if (disposed || failed) return;
    failed = true;
    stop();
    puppet?.dispose();
    puppet = null;
    parts = null;
    atlas?.image.release();
    atlas = null;
    report(message);
    tell('failed', []);
  }

  function tell(state: PreviewState, frames: readonly string[]): void {
    if (disposed) return;
    request.onStatus({ state, frames });
  }
}

function specFor(
  rig: RigDocument,
  artboard: RigArtboard,
  skins: Readonly<Record<string, string>>,
): CharacterRendererSpec {
  return {
    characterId: artboard.characterId,
    artboard: artboard.artboard,
    stateMachine: artboard.stateMachine,
    rig,
    skins,
    widthPx: rig.characterSpace.width,
    heightPx: rig.characterSpace.height,
  };
}

/** An `<img>` decoded off the main thread, released by dropping its source. */
async function loadImageElement(doc: Document, url: string): Promise<PreviewImage> {
  const image = doc.createElement('img');
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return {
    source: image,
    release: () => {
      /* `removeAttribute`, never `src = ''`: an empty src is a request for the
         page itself in some engines. */
      image.removeAttribute('src');
    },
  };
}

/** The deploy's base path, as `game-renderer.ts` reads it (ADR-0006). */
function defaultBaseUrl(): string {
  const base = import.meta.env.BASE_URL;
  return typeof base === 'string' && base.length > 0 ? base : '/';
}
