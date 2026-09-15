/**
 * The pictures the DOM screens draw, resolved (ADR-0041).
 *
 * `app/ui` is handed URLs and draws them as decoration; this is where those
 * URLs come from, and the one place that decides what each screen shows:
 *
 *  - **the landmark card** shows the landmark's own art: the image the level
 *    already loaded for that point of interest's `artKey`, found in
 *    `manifest.json` at the scale the level chose — so it is a cache hit;
 *  - **the completion card's stamp** is pressed in the shape of the level's hero
 *    landmark: the first point of interest whose art the pipeline names a
 *    landmark (`<level>-landmark-<name>`), or the first point of interest when
 *    none is;
 *  - **the dialogue** shows a character's face, painted from the level's own
 *    puppet at a head crop, or a landmark's art when the speaker is a landmark;
 *  - **the title screen** shows the player's character, painted whole.
 *
 * ## Cost
 *
 * Nothing here is on the initial payload except this code. The manifest is the
 * file the renderer reads; the landmark images and the character atlas page are
 * files the level loads. A still is painted once, from the atlas page the level
 * would load, and the decoded page is released as soon as it is painted
 * (`app/adapters/phaser/character-still.ts`). What is kept is a handful of small
 * PNG object URLs: one per character a level places, and the player's figure.
 *
 * ## When there is nothing to draw
 *
 * No `fetch`, an unreadable manifest, an atlas that never arrives: every answer
 * is `null`, and a screen given `null` draws no picture. The failure is told on
 * the console as a warning, once, and never becomes an error a player sees —
 * the words were always the whole of every screen.
 *
 * The adapters are imported from their files and not from the `@adapters/phaser`
 * barrel, as `tests/a11y/harness.ts` does: nothing here needs Phaser, and a suite
 * that stands in for the renderer barrel should not also stand in for this.
 */

import rigJson from '@content/characters/rig.json';

import type { RigDocument } from '@application/ports';
import {
  FIGURE_WINDOW,
  PORTRAIT_WINDOW,
  STILL_MAX_PX,
  createBrowserStillSurface,
  loadStillImage,
  paintCharacterStills,
  type CharacterStillRequest,
} from '@adapters/phaser/character-still';
import {
  bestScale,
  parseAssetManifest,
  preferredAssetScale,
  type AssetManifest,
} from '@adapters/phaser/level-assets';

const RIG = rigJson as unknown as RigDocument;

/** The part of a `fetch` response this reads. */
export interface ArtResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type PaintStills = (
  requests: readonly CharacterStillRequest[],
  manifest: AssetManifest,
) => Promise<readonly (string | null)[]>;

export interface ScreenArtDeps {
  /** The page's `fetch`. Absent draws no picture anywhere, which is a real answer. */
  readonly fetch: ((url: string) => Promise<ArtResponse>) | undefined;
  /** Where `manifest.json` and everything it names are served (ADR-0006). */
  readonly baseUrl: string;
  readonly devicePixelRatio: () => number;
  readonly document: Document | undefined;
  readonly rig?: RigDocument;
  /** What paints a still. Defaults to the level's sprite puppet. */
  readonly paint?: PaintStills;
  /** Let go of an object URL. Defaults to `URL.revokeObjectURL`. */
  readonly revoke?: (url: string) => void;
  /** Defaults to `console.warn`. */
  readonly report?: (message: string) => void;
  /**
   * A level's points of interest, for the stamp of a level that is not the one
   * loaded (ADR-0045: the passport draws every earned stamp). `null` for a level
   * with no document. Absent, no other level's stamp is ever drawn.
   */
  readonly levelPois?: (levelId: string) => Promise<readonly { readonly artKey: string }[] | null>;
}

export interface ScreenArt {
  /** Read the manifest. Idempotent; resolves whether or not it could be read. */
  prime(): Promise<void>;
  /** The level's image for this `artKey`, or `null` until the manifest is read or when there is none. */
  pictureOf(artKey: string | null | undefined): string | null;
  /** The picture the level's stamp is pressed in the shape of. */
  stampOf(pois: readonly { readonly artKey: string }[]): string | null;
  /**
   * The same picture for a level by id, once {@link ScreenArt.learnStamps} has
   * read that level; `null` before, and when it has none.
   */
  stampOfLevel(levelId: string): string | null;
  /**
   * Read these levels' stamps, each once. Resolves `true` when a picture was
   * learned that was not known before, so a caller knows to redraw.
   */
  learnStamps(levelIds: readonly string[]): Promise<boolean>;
  /** A character's face, once painted; `null` before, and when it could not be. */
  portraitOf(characterId: string): string | null;
  /** Paint the faces of these characters, in the background. Each is painted once. */
  paintPortraits(characterIds: readonly string[]): Promise<void>;
  /** The player's character, whole, in this appearance. */
  figure(selection: Readonly<Record<string, string>>): Promise<string | null>;
}

/** The dialogue's portrait: `.tn-dialogue__portrait`, 5rem square at 100 % text. */
export const PORTRAIT_CSS_PX = 80;

/** The tallest the title screen draws its figure, in CSS px. */
export const FIGURE_CSS_PX = 360;

/** The pipeline names a landmark's art `<level>-landmark-<name>` (`scripts/assets.mjs`). */
export function isLandmarkArt(artKey: string): boolean {
  return /(^|-)landmark-/u.test(artKey);
}

/** The point of interest a level's stamp is pressed in the shape of. */
export function stampLandmark<T extends { readonly artKey: string }>(pois: readonly T[]): T | null {
  return pois.find((poi) => isLandmarkArt(poi.artKey)) ?? pois[0] ?? null;
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * The deploy's base path, as `game-renderer.ts` reads it (ADR-0006):
 * `/OhCanada/` on Pages, `/` in a dev server.
 */
export function assetsBaseUrl(): string {
  const base: unknown = import.meta.env.BASE_URL;
  return typeof base === 'string' && base.length > 0 ? base : '/';
}

export function createScreenArt(deps: ScreenArtDeps): ScreenArt {
  const rig = deps.rig ?? RIG;
  const report =
    deps.report ??
    ((message: string): void => {
      console.warn(`[screen-art] ${message}`);
    });
  const revoke =
    deps.revoke ??
    ((url: string): void => {
      deps.document?.defaultView?.URL.revokeObjectURL(url);
    });

  let manifest: AssetManifest | null = null;
  let reading: Promise<void> | null = null;
  const portraits = new Map<string, string | null>();
  /** A level's stamp picture by id, once read; `null` for a level with none. */
  const levelStamps = new Map<string, string | null>();
  const painting = new Map<string, Promise<void>>();
  let figureKey: string | null = null;
  let figureUrl: string | null = null;
  let figureWork: Promise<string | null> | null = null;

  /** The device pixel ratio a picture is painted for: 1 to 3. */
  const ratio = (): number => {
    const value = deps.devicePixelRatio();
    return Number.isFinite(value) && value > 0 ? Math.min(3, Math.max(1, value)) : 1;
  };

  const paint: PaintStills = deps.paint ?? paintWithPuppet;

  function paintWithPuppet(
    requests: readonly CharacterStillRequest[],
    current: AssetManifest,
  ): Promise<readonly (string | null)[]> {
    const doc = deps.document;
    const fetchImpl = deps.fetch;
    if (doc === undefined || fetchImpl === undefined) {
      return Promise.resolve(requests.map(() => null));
    }
    return paintCharacterStills(requests, {
      rig,
      manifest: current,
      baseUrl: deps.baseUrl,
      scale: preferredAssetScale(ratio()),
      fetchJson: async (url) => {
        const response = await fetchImpl(url);
        if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`);
        return response.json();
      },
      loadImage: (url) => loadStillImage(doc, url),
      createSurface: createBrowserStillSurface(doc),
      report,
    });
  }

  function prime(): Promise<void> {
    reading ??= read();
    return reading;
  }

  async function read(): Promise<void> {
    const fetchImpl = deps.fetch;
    if (fetchImpl === undefined) return;
    try {
      const response = await fetchImpl(`${deps.baseUrl}manifest.json`);
      if (!response.ok) throw new Error(`manifest.json answered ${String(response.status)}`);
      const parsed = parseAssetManifest(await response.json());
      if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
      manifest = parsed.value;
    } catch (cause) {
      report(`the asset manifest could not be read, so the screens draw no pictures. ${messageOf(cause)}`);
    }
  }

  function pictureOf(artKey: string | null | undefined): string | null {
    if (manifest === null || artKey === null || artKey === undefined || artKey === '') return null;
    const candidates = manifest.files.filter(
      (file) => file.kind === 'image' && file.keys.includes(artKey),
    );
    const chosen = bestScale(candidates, preferredAssetScale(ratio()));
    return chosen === undefined ? null : `${deps.baseUrl}${chosen.path}`;
  }

  return {
    prime,
    pictureOf,

    stampOf(pois): string | null {
      /* Nothing to press without the manifest, and nothing is read until there is. */
      if (manifest === null) return null;
      return pictureOf(stampLandmark(pois)?.artKey);
    },

    stampOfLevel(levelId): string | null {
      return levelStamps.get(levelId) ?? null;
    },

    async learnStamps(levelIds): Promise<boolean> {
      const read = deps.levelPois;
      if (read === undefined) return false;
      await prime();
      if (manifest === null) return false;
      let learned = false;
      for (const id of new Set(levelIds)) {
        if (levelStamps.has(id)) continue;
        try {
          /* The same rule as the completion card's, over the level's own
             points of interest, so the passport presses the same stamp. */
          const pois = await read(id);
          const src = pois === null ? null : pictureOf(stampLandmark(pois)?.artKey);
          levelStamps.set(id, src);
          if (src !== null) learned = true;
        } catch (cause) {
          /* Not remembered: a document that did not arrive this time may next. */
          report(`the stamp for "${id}" could not be read. ${messageOf(cause)}`);
        }
      }
      return learned;
    },

    portraitOf(characterId): string | null {
      return portraits.get(characterId) ?? null;
    },

    async paintPortraits(characterIds): Promise<void> {
      await prime();
      const current = manifest;
      if (current === null) return;

      const unique = [...new Set(characterIds)];
      const pending = unique
        .map((id) => painting.get(id))
        .filter((work): work is Promise<void> => work !== undefined);
      const wanted = unique.filter((id) => !portraits.has(id) && !painting.has(id));

      if (wanted.length > 0) {
        const side = Math.min(STILL_MAX_PX, Math.round(PORTRAIT_CSS_PX * ratio()));
        const work = paint(
          wanted.map((id) => ({
            characterId: id,
            window: PORTRAIT_WINDOW,
            widthPx: side,
            heightPx: side,
          })),
          current,
        )
          .then((urls) => {
            wanted.forEach((id, index) => portraits.set(id, urls[index] ?? null));
          })
          .catch((cause: unknown) => {
            report(`no portrait could be painted. ${messageOf(cause)}`);
            for (const id of wanted) portraits.set(id, null);
          })
          .finally(() => {
            for (const id of wanted) painting.delete(id);
          });
        for (const id of wanted) painting.set(id, work);
        pending.push(work);
      }
      await Promise.all(pending);
    },

    figure(selection): Promise<string | null> {
      const key = JSON.stringify(
        Object.entries(selection).sort(([a], [b]) => a.localeCompare(b)),
      );
      if (key === figureKey && figureWork !== null) return figureWork;
      figureKey = key;
      figureWork = (async (): Promise<string | null> => {
        await prime();
        const current = manifest;
        if (current === null) return null;
        const height = Math.min(STILL_MAX_PX, Math.round(FIGURE_CSS_PX * ratio()));
        const width = Math.round((height * FIGURE_WINDOW.w) / FIGURE_WINDOW.h);
        const [url] = await paint(
          [{ characterId: null, skins: selection, window: FIGURE_WINDOW, widthPx: width, heightPx: height }],
          current,
        ).catch((cause: unknown) => {
          report(`the player's figure could not be painted. ${messageOf(cause)}`);
          return [null];
        });
        const painted = url ?? null;
        /* A newer appearance was asked for while this one was painting: this
           picture is nobody's, so it is let go rather than kept. */
        if (figureKey !== key) {
          if (painted !== null) revoke(painted);
          return null;
        }
        if (figureUrl !== null && figureUrl !== painted) revoke(figureUrl);
        figureUrl = painted;
        return painted;
      })();
      return figureWork;
    },
  };
}
