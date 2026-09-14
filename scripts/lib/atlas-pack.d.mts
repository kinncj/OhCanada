/**
 * Types for `scripts/lib/atlas-pack.mjs`, hand-written.
 *
 * The module is `.mjs` because `scripts/assets.mjs` runs it with no build step;
 * the unit tests are TypeScript under `strict` with `allowJs` off and cannot
 * import it without this file. A signature change must touch both, and
 * `make typecheck` fails until it does.
 */

export declare const PACKER_ID: string;
export declare const PACKER_VERSION: string;

export interface PackOptions {
  /** The longest side a page may have, in pixels. */
  readonly maxPx: number;
  /** Transparent pixels at every page edge and between two extruded frames. */
  readonly padding: number;
  /** Pixels of each frame's own edge repeated outward round it. */
  readonly extrude: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PlannedFrame extends Box {
  readonly key: string;
}

export interface PlannedPage {
  readonly width: number;
  readonly height: number;
  /** Which insertion order won, for the build log. */
  readonly order: string;
  /** Which MaxRects placement rule won, for the build log. */
  readonly method: string;
  /** Sorted by key. `x`/`y` are where the art starts, inside its ring. */
  readonly frames: readonly PlannedFrame[];
}

export declare function planAtlas(
  rects: readonly { readonly key: string; readonly w: number; readonly h: number }[],
  options: PackOptions,
): PlannedPage[];

export declare function trimBox(rgba: Uint8Array, width: number, height: number): Box;

/** One frame in Phaser's multi-texture atlas JSON. */
export interface AtlasFrame {
  readonly filename: string;
  readonly rotated: false;
  readonly trimmed: boolean;
  readonly sourceSize: { readonly w: number; readonly h: number };
  readonly spriteSourceSize: Box;
  readonly frame: Box;
}

export interface PackedPage {
  readonly width: number;
  readonly height: number;
  /** Straight RGBA, width x height x 4 bytes. */
  readonly rgba: Buffer;
  readonly order: string;
  readonly method: string;
  /** Sorted by filename. */
  readonly frames: AtlasFrame[];
}

export declare function packAtlas(
  sprites: readonly { readonly key: string; readonly width: number; readonly height: number; readonly rgba: Buffer }[],
  options: PackOptions,
): PackedPage[];

export declare function checkPage(
  page: {
    readonly rgba: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly frames: readonly Pick<AtlasFrame, 'filename' | 'frame'>[];
  },
  options: { readonly extrude: number; readonly limit?: number },
): string[];
