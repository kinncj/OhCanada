import Phaser from 'phaser';

import type { ThemeColours } from '@application/ports';

import { BootScene, HORIZON_FRACTION } from './boot-scene';
import { blendColors, toCssColor, toPhaserColor } from './boot-config';
import type { BootConfig } from './boot-config';
import {
  parseAssetManifest,
  preferredAssetScale,
  selectLevelAssets,
  type AssetManifest,
  type LoadRequest,
} from './level-assets';
import { bundledLevelCatalog, type LevelCatalog } from './level-catalog';
import type { SceneLevel } from './level-document';
import type { SceneEventListener } from './level-events';
import { LevelScene } from './level-scene';
import { createPlayableMarker, type MarkerHost, type PlayableMarker } from './playable-marker';
import { appErr, ok, type Result } from '@common/result';
import { LAND_SHADE, landBand } from './horizon-profile';
import {
  identifyRenderer,
  type DebugInfoContext,
  type RendererIdentity,
  type RendererKind,
} from './renderer-identity';
import {
  readFormFactor,
  resolveMotionLevel,
  startRenderTierProbe,
  type FrameSignals,
  type RenderTierProbe,
} from './render-tier-probe';
import { backingScaleFor } from './visual-tier';
import type { RenderProfile, TierDecision } from './visual-tier';
import {
  SCENE_PROBE_GLOBAL,
  SCENE_PROBE_TEST_ID,
  createSceneProbe,
  isSceneProbeEnabled,
  profileToSnapshot,
  sceneProbeHandle,
  type SceneProbe,
  type SceneProbeHandle,
} from './scene-probe';

/**
 * GameRenderer — the Phaser adapter's whole surface to the composition root.
 *
 * `app/bootstrap` constructs one of these and never touches `Phaser` itself, so
 * swapping the renderer is a one-directory change (ADR-0005). It owns:
 *
 *   - the 1080x1920 design resolution, read from `content/game.config.json`;
 *   - `Scale.FIT` + `CENTER_BOTH`, which is the entire responsive story (ADR-0002);
 *   - `aria-hidden="true"` on the canvas, set in `postBoot` — before the first
 *     frame, so assistive technology never sees the element at all. Everything a
 *     player needs to hear goes through the DOM live region instead (CLAUDE.md).
 *
 * ## How the desktop side panels are made
 *
 * They are not drawn. The canvas is FIT-scaled inside `#game` and never
 * stretched, which on a wide window leaves letterbox space on the left and the
 * right. That space is the *page*, and the page background is painted with the
 * same `palette.sky` -> `palette.ground` vertical gradient the scene draws
 * (`cssVariables()` below hands the two colours to `index.html`'s
 * `linear-gradient(180deg, var(--tn-sky), var(--tn-ground))`). Because both
 * gradients run top-to-bottom over the same box height, the sky and ground read
 * as continuing past the edges of the canvas instead of stopping at it. Cost:
 * zero draw calls, zero overdraw, and no second camera to keep in tune.
 *
 * The land at the horizon rides on the same mechanism. `cssVariables()` also
 * hands out the land's colour and the three heights it occupies, and the page
 * lays a second gradient over the first from them — so the hills continue into
 * the panels instead of ending on a hard vertical edge, which turned the canvas
 * into a framed picture on a wide window. Still zero draw calls: the panels are
 * CSS, and the scene never learns that they exist.
 *
 * ## The renderer is measured, not assumed (task 1.19)
 *
 * `type` stays `Phaser.AUTO`. What changes is that the choice is no longer
 * *believed*: `postBoot` reads the renderer Phaser actually built and, when it
 * is WebGL, the device string behind `WEBGL_debug_renderer_info`, and then
 * `render-tier-probe.ts` measures the real per-frame cost and picks a visual
 * tier from that number. A device that advertises WebGL and rasterises on the
 * CPU — llvmpipe, SwiftShader, a VM, a remote desktop, hardware acceleration
 * turned off — gets fewer layers, fewer particles and no Filters, not a
 * different renderer and not a black canvas.
 *
 * This file is the *only* one in the probe that touches Phaser or the DOM, and
 * it is deliberately thin: it translates `Phaser.WEBGL`/`Phaser.CANVAS` into a
 * string union, turns two game events into a pair of callbacks, and reads three
 * media queries. Everything that decides anything is in the pure modules beside
 * it, which is what lets the policy be unit tested with no browser.
 */

export interface GameRendererOptions {
  /** The element the canvas is inserted into. Sized and safe-area padded by CSS. */
  readonly parent: HTMLElement;
  readonly config: BootConfig;
  /**
   * The page's query string, for the `?e2e=1` scene probe. Defaults to
   * `window.location.search`; present as an option so a test can drive it.
   */
  readonly search?: string;
  /**
   * Where level documents come from. Defaults to the bundler glob over
   * `content/levels/`; injectable so the failure path can be driven.
   */
  readonly levels?: LevelCatalog;
  /**
   * Every fact the open level publishes: `level/ready`, `player/moved`,
   * `poi/entered` and the rest of `level-events.ts`.
   *
   * The adapter's whole outbound edge. `app/bootstrap` binds it to the typed
   * event bus and the DOM layer subscribes there, so the HUD and the live region
   * hear about the level without this directory knowing they exist (ADR-0005).
   */
  readonly onLevelEvent?: SceneEventListener;
  /**
   * Where `assets/dist/manifest.json` is served from, and how to fetch it.
   *
   * Defaults to `<base>manifest.json` through the page's `fetch`. Injectable so
   * the failure path — no manifest, an unreadable one, a version this build does
   * not read — can be driven without a network.
   */
  readonly assetsBaseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
  /** Overrides `devicePixelRatio` when choosing between the 1x and 2x sets. */
  readonly devicePixelRatio?: number;
}

export class GameRenderer {
  readonly #game: Phaser.Game;
  readonly #options: GameRendererOptions;
  readonly #config: BootConfig;
  readonly #ready: Promise<void>;
  readonly #catalog: LevelCatalog;
  #probe: RenderTierProbe | null = null;
  #scene: SceneProbe | null = null;
  #level: LevelScene | null = null;
  #levelDocument: SceneLevel | null = null;
  #marker: PlayableMarker | null = null;
  /** One manifest fetch per session, shared by every level that opens after. */
  #manifest: Promise<Result<AssetManifest>> | null = null;
  /**
   * Mirrors the rotate overlay, because `postBoot` is async: on a landscape
   * first load the overlay calls `pause()` before the probe exists, and
   * publishing a literal `false` below would have the probe report a running
   * game behind a "please rotate" dialog.
   */
  #paused = false;

  constructor(options: GameRendererOptions) {
    this.#options = options;
    this.#config = options.config;
    this.#catalog = options.levels ?? bundledLevelCatalog;

    let resolveReady: () => void = () => undefined;
    this.#ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    this.#game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: options.parent,
      title: options.config.title,
      version: options.config.version,
      banner: false,
      backgroundColor: options.config.backgroundColor,
      /**
       * The art direction is bold rounded vector-ish shapes, not pixel art
       * (CLAUDE.md, Art), so textures are filtered and the canvas is antialiased.
       */
      pixelArt: false,
      antialias: true,
      roundPixels: false,
      disableContextMenu: true,
      /** Slice 0 has no audio; leaving it off avoids an unused AudioContext. */
      audio: { noAudio: true },
      dom: { createContainer: false },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: options.config.designWidth,
        height: options.config.designHeight,
        /** We own the page layout; Phaser must not rewrite html/body heights. */
        expandParent: false,
        autoRound: true,
      },
      render: { powerPreference: 'high-performance' },
      scene: [new BootScene({ config: options.config, onReady: resolveReady })],
      callbacks: {
        postBoot: (game) => {
          hideCanvasFromAssistiveTech(game.canvas);
          /* `?e2e=1` only. A normal load creates no element and installs no
             global, so the probe costs one query-string read and nothing else. */
          this.#scene = installSceneProbe(
            options.parent,
            options.search ?? readLocationSearch(),
          );
          this.#marker = installPlayableMarker(options.parent);
          this.#probe = startRendererProbe(game, options.config, this.#scene, (profile) => {
            this.#level?.applyProfile(profile);
          });
          this.#scene?.publish({ paused: this.#paused });
        },
      },
    });
  }

  /** Resolves once the boot scene has built its first frame's contents. */
  get ready(): Promise<void> {
    return this.#ready;
  }

  /**
   * The palette the canvas is actually painted with: the open level's theme when
   * one is open, `game.config.json`'s otherwise. The page reads this through
   * `cssVariables()`, so the letterboxed panels and the canvas cannot drift.
   */
  get palette(): ThemeColours {
    return this.#levelDocument?.palette ?? this.#config.palette;
  }

  get canvas(): HTMLCanvasElement | null {
    return this.#game.canvas ?? null;
  }

  /**
   * The open level's document, or `null`.
   *
   * Read-only, and it is the *parsed* document rather than the raw JSON, so the
   * composition root gets the level's own localised strings — its title, its
   * points of interest and their blurbs — without re-parsing content the adapter
   * has already validated. ADR-0010: a level's strings travel with the level.
   */
  get level(): SceneLevel | null {
    return this.#levelDocument;
  }

  /**
   * How much this device is being asked to draw, right now.
   *
   * `null` until `postBoot` has run. Scenes read this instead of asking the
   * renderer what it is: the whole point of the tier is that "WebGL" and "fast"
   * are different questions, and a scene should only ever ask the second.
   */
  get renderProfile(): RenderProfile | null {
    return this.#probe?.profile ?? null;
  }

  /** The tier, why it was chosen, and whether anything has been measured yet. */
  get tierDecision(): TierDecision | null {
    return this.#probe?.decision ?? null;
  }

  /** What Phaser actually built, and what the GL device called itself. */
  get rendererIdentity(): RendererIdentity | null {
    return this.#probe?.identity ?? null;
  }

  /**
   * The `?e2e=1` scene probe, or `null` on a normal load.
   *
   * The level scene (task 1.13) and the locomotion strategy (1.14) publish the
   * player's position, speed and facing through this — `recordFrame` every
   * frame, `publish` for the discrete state — so the momentum scenarios in
   * `docs/stories/TN-LEVEL-ottawa.md` can fail. Nothing about gameplay may read
   * it: it is an output, and `SceneProbeHandle` is read-only for the same reason.
   */
  get sceneProbe(): SceneProbe | null {
    return this.#scene;
  }

  /**
   * Open a level.
   *
   * The whole of task 1.13 from the outside: the document is fetched from
   * `content/levels/<id>.json`, parsed, refused if it will not fit the texture
   * budget, and handed to one scene that builds itself out of it. Nothing about
   * this method, or the scene behind it, names a level — adding Quebec City is
   * the JSON file and nothing else.
   *
   * `Result` rather than a throw, and the previous scene is stopped only once
   * the new document has parsed: a level that fails to load leaves the player
   * where they were with an error to act on, not on a black canvas
   * (TN-LEVEL-02).
   */
  async loadLevel(id: string): Promise<Result<void>> {
    const document = await this.#catalog.load(id);
    if (!document.ok) return document;

    /*
     * Resolve the level's textures BEFORE the scene is constructed.
     *
     * This is the line whose absence shipped an Ottawa level that drew no art at
     * all: `level-scene.ts` asks `textures.exists(key)` and falls back to a flat
     * band, nothing had ever queued a load, and so every layer took the fallback
     * silently and permanently. A manifest that will not load is NOT a level
     * failure — the level still opens on placeholder bands, which is what a
     * build with no art has always done — but it is no longer invisible: the
     * scene publishes `data-layers-textured`, and `tests/e2e/level-art.spec.ts`
     * fails when it is short of `data-layers`.
     */
    const assets = await this.#resolveAssets(id);

    const marker = this.#marker;
    marker?.hide();

    if (this.#game.scene.getScene(LevelScene.KEY) !== null) {
      this.#game.scene.remove(LevelScene.KEY);
    }
    if (this.#game.scene.isActive(BootScene.KEY)) this.#game.scene.stop(BootScene.KEY);

    const scene = new LevelScene({
      level: document.value,
      designWidth: this.#config.designWidth,
      designHeight: this.#config.designHeight,
      probe: this.#scene,
      marker,
      profile: this.renderProfile,
      assets,
      ...(this.#options.onLevelEvent === undefined
        ? {}
        : { onEvent: this.#options.onLevelEvent }),
    });
    this.#level = scene;
    this.#levelDocument = document.value;

    try {
      this.#game.scene.add(LevelScene.KEY, scene, true);
    } catch (cause) {
      this.#level = null;
      this.#levelDocument = null;
      return appErr('io', 'renderer.level.startFailed', `level "${id}" failed to start.`, { level: id }, cause);
    }
    if (this.#paused) this.#game.scene.pause(LevelScene.KEY);
    return ok();
  }

  /**
   * The manifest, once per session, turned into this level's load list.
   *
   * Every failure lands in the same place — an empty list and one console line —
   * because every one of them means the same thing to a player: the level draws
   * its placeholder bands. What must never happen is that it means *nothing* to
   * anybody, which is what it meant before.
   */
  async #resolveAssets(id: string): Promise<readonly LoadRequest[]> {
    const base = this.#options.assetsBaseUrl ?? assetsBaseUrl();
    const fetchImpl = this.#options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (fetchImpl === undefined) return [];

    try {
      this.#manifest ??= (async () => {
        const response = await fetchImpl(`${base}manifest.json`);
        if (!response.ok) {
          throw new Error(`manifest.json returned ${String(response.status)}`);
        }
        return parseAssetManifest(await response.json());
      })();
      const manifest = await this.#manifest;
      if (!manifest.ok) {
        console.error(`[renderer] ${manifest.error.code}: ${manifest.error.message}`);
        return [];
      }
      const scale = preferredAssetScale(
        this.#options.devicePixelRatio ??
          (typeof window === 'undefined' ? 1 : window.devicePixelRatio),
      );
      const requests = selectLevelAssets(manifest.value, id, { scale, baseUrl: base });
      if (requests.length === 0) {
        console.error(
          `[renderer] the asset manifest lists nothing for level "${id}"; every layer will ` +
            `draw its placeholder band.`,
        );
      }
      return requests;
    } catch (cause) {
      /* The level is still playable on placeholders, so this is reported and not
         returned: a level a player can walk beats a blank page. */
      console.error(`[renderer] could not read the asset manifest.`, cause);
      return [];
    }
  }

  /** The ids of every authored level, derived from `content/levels/`. */
  levelIds(): readonly string[] {
    return this.#catalog.ids();
  }

  /**
   * Custom properties the page uses to extend sky and ground into the side
   * panels. Returned as data so `app/bootstrap` applies them and the adapter
   * stays out of the page's styling.
   */
  cssVariables(): Readonly<Record<string, string>> {
    const percent = (fraction: number): string => `${(fraction * 100).toFixed(3)}%`;
    const level = this.#levelDocument;
    const palette = level?.palette ?? this.#config.palette;

    /*
     * The land band is the *boot screen's* hills, and only the boot screen's.
     *
     * `--tn-land-*` exists so the rolling horizon `boot-scene.ts` paints
     * continues into the desktop side panels instead of ending on a hard
     * vertical edge. A level's ground is a polyline that rises and falls along
     * its own length, so there is no one height those three stops could take
     * that would match it — and leaving slice 0's numbers in place frames a
     * running level in scenery from a screen that is no longer on the canvas.
     *
     * So with a level open the band collapses to nothing and the panels are what
     * ADR-0002 actually asks for and nothing more: the level's own sky-to-ground
     * gradient, continuing past the letterbox edge. Still zero draw calls.
     */
    const band = level === null ? landBand(this.#config.designHeight, HORIZON_FRACTION) : null;

    return {
      '--tn-sky': palette.sky,
      '--tn-ground': palette.ground,
      '--tn-horizon': palette.horizon,
      /* A shade of the ground, computed once here so the page and the scene
         cannot disagree about the colour of the same hill. */
      '--tn-land': toCssColor(blendColors(toPhaserColor(palette.ground), 0x000000, LAND_SHADE)),
      '--tn-land-crest': band === null ? '100%' : percent(band.crest),
      '--tn-land-skirt': band === null ? '100%' : percent(band.skirt),
      '--tn-land-end': band === null ? '100%' : percent(band.end),
    };
  }

  /** Landscape on a phone pauses the game behind the rotate overlay (ADR-0002). */
  pause(): void {
    for (const key of [BootScene.KEY, LevelScene.KEY]) {
      if (this.#game.scene.isActive(key)) this.#game.scene.pause(key);
    }
    this.#paused = true;
    this.#scene?.publish({ paused: true });
  }

  resume(): void {
    for (const key of [BootScene.KEY, LevelScene.KEY]) {
      if (this.#game.scene.isPaused(key)) this.#game.scene.resume(key);
    }
    /* The frames either side of a pause are a gap, not slow frames. Re-arm the
       warm-up so rotating a phone cannot cost a player a visual tier. */
    this.#probe?.reset();
    this.#paused = false;
    this.#scene?.publish({ paused: false });
  }

  destroy(): void {
    /* Before `game.destroy`: the probe holds listeners on `game.events`, and a
       listener on a destroyed game is how a level unload leaks into the next. */
    this.#probe?.stop();
    this.#probe = null;
    this.#marker?.hide();
    this.#marker = null;
    this.#level = null;
    this.#levelDocument = null;
    this.#scene?.destroy();
    this.#scene = null;
    removeSceneProbeGlobal();
    this.#game.destroy(true);
  }
}

/**
 * The canvas is invisible to assistive technology by contract. It also must not
 * be reachable by keyboard, or a screen-reader user would land inside an
 * `aria-hidden` subtree (axe: `aria-hidden-focus`).
 */
function hideCanvasFromAssistiveTech(canvas: HTMLCanvasElement | null): void {
  if (canvas === null) return;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.removeAttribute('tabindex');
}

/**
 * Everything the probe needs from Phaser and the DOM, in one place.
 *
 * Kept as a free function rather than a method so the translation is obvious and
 * greppable: three casts, two event subscriptions, three media queries, and no
 * decisions. Every decision it feeds is in `render-tier-probe.ts` and the pure
 * modules under it.
 */
function startRendererProbe(
  game: Phaser.Game,
  config: BootConfig,
  scene: SceneProbe | null,
  onProfileChanged: (profile: RenderProfile) => void,
): RenderTierProbe {
  const identity = identifyRenderer(rendererKindOf(game), webglContextOf(game));

  return startRenderTierProbe({
    identity,
    presets: config.graphicsPresets,
    frameTimeMs: config.frameTimeMs,
    signals: frameSignalsFor(game),
    motion: resolveMotionLevel({ mediaQuery: mediaQuery('(prefers-reduced-motion: reduce)') }),
    formFactor: readFormFactor({
      widthCssPx: window.innerWidth,
      heightCssPx: window.innerHeight,
      coarsePointerQuery: mediaQuery('(pointer: coarse)'),
    }),
    /* Both: the canvas carries the classification of the surface it describes,
       and `<html>` is where a bug report will look for it, beside the other
       `data-tn-*` state. See `RenderTierProbeOptions.marker`. */
    marker: [game.canvas, typeof document === 'undefined' ? null : document.documentElement].filter(
      (element): element is HTMLElement => element !== null && element !== undefined,
    ),
    /* One mechanism, not two: the tier the renderer probe measured is published
       through the same element a locomotion scenario reads. */
    onProfile: (profile) => {
      /*
       * Fewer pixels, before anything is told about the new tier.
       *
       * `renderScale` and `maxPixelRatio` were resolved into `RenderProfile` and
       * applied by nothing: the tier degraded particle count and parallax layer
       * count and never the fragment count, which is the dominant cost on the
       * exact devices ADR-0011 exists to keep playable. `Scale.FIT` keeps the
       * canvas *backing store* at the design resolution and stretches it with
       * CSS, so this resizes the buffer and lets CSS stretch a smaller one — the
       * letterbox, the aspect ratio and the world the camera sees are all
       * unchanged, there are simply fewer fragments to shade.
       *
       * Before `onProfileChanged`, because the scene re-derives its camera zoom
       * from the scale manager and must read the new size, not the old one.
       */
      applyBackingScale(game, config, profile);
      scene?.publish({ ...profileToSnapshot(profile), renderer: identity.kind });
      /* The level re-derives everything the tier controls from the new profile:
         how many parallax layers are drawn and how much snow falls. This is the
         line that makes ADR-0011 something a player can see. */
      onProfileChanged(profile);
    },
  });
}

/**
 * Resize the drawing buffer to what the tier asks for.
 *
 * Guarded on an actual change: `resize` fires `RESIZE`, which re-sizes every
 * camera in every scene, and doing that on every closed measurement window
 * would be work the measurement then reports.
 */
function applyBackingScale(game: Phaser.Game, config: BootConfig, profile: RenderProfile): void {
  const scale = backingScaleFor({
    renderScale: profile.renderScale,
    maxPixelRatio: profile.maxPixelRatio,
    designWidth: config.designWidth,
    displayWidthCss: game.scale.displaySize.width,
  });

  const width = Math.round(config.designWidth * scale);
  const height = Math.round(config.designHeight * scale);
  if (game.scale.gameSize.width === width && game.scale.gameSize.height === height) return;
  game.scale.resize(width, height);
}

/**
 * Create `data-testid="scene-state"`, or nothing at all.
 *
 * `hidden` and `aria-hidden` because it carries no player-facing content: axe
 * must not see it, a screen reader must not read it, and it must not appear in
 * the accessibility tree next to the live region that is the one channel a
 * screen-reader user has (CLAUDE.md).
 */
function installSceneProbe(host: HTMLElement, search: string): SceneProbe | null {
  if (!isSceneProbeEnabled(search)) return null;
  if (typeof document === 'undefined') return null;

  const element = document.createElement('div');
  element.setAttribute('data-testid', SCENE_PROBE_TEST_ID);
  element.setAttribute('aria-hidden', 'true');
  element.hidden = true;
  host.append(element);

  const probe = createSceneProbe({ element, now: () => performance.now() });
  (window as unknown as Record<string, SceneProbeHandle>)[SCENE_PROBE_GLOBAL] =
    sceneProbeHandle(probe);
  return probe;
}

/**
 * Create the `data-testid="playable"` element, hidden from assistive technology
 * and not yet attached: `LevelScene` shows it on the first playable frame and
 * hides it on shutdown, so its presence is the statement the stories rely on
 * rather than a flag somebody remembered to set.
 */
function installPlayableMarker(host: HTMLElement): PlayableMarker | null {
  if (typeof document === 'undefined') return null;
  /* `MarkerHost.append` is narrower than `Element.append`'s variadic
     `(string | Node)[]`, which TypeScript reads as an incompatible parameter.
     The element passed is the `HTMLDivElement` created on the next line, so the
     narrowing is sound; the cast records that rather than widening the seam and
     letting anything with an `append` be a host. */
  return createPlayableMarker(host as unknown as MarkerHost, document.createElement('div'));
}

function removeSceneProbeGlobal(): void {
  if (typeof window === 'undefined') return;
  delete (window as unknown as Record<string, unknown>)[SCENE_PROBE_GLOBAL];
}

/**
 * Where `assets/dist/manifest.json` and everything it names are served from.
 *
 * `assets/dist` is Vite's `publicDir`, so its contents land at the deploy's base
 * path verbatim. `import.meta.env.BASE_URL` is that path — `/OhCanada/` on
 * Pages, `/` in a dev server — and reading it here rather than hardcoding a
 * slash is what keeps ADR-0006's sub-path deploy working.
 */
function assetsBaseUrl(): string {
  const base = import.meta.env.BASE_URL;
  return typeof base === 'string' && base.length > 0 ? base : '/';
}

/** The query string, when there is a `location` to read it from. */
function readLocationSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

/**
 * Which renderer Phaser built — read from the renderer instance, never from
 * `game.config.renderType`, which is still `Phaser.AUTO` after the fallback has
 * already happened. That distinction is the entire defect this task names.
 */
function rendererKindOf(game: Phaser.Game): RendererKind {
  const type = (game.renderer as { type?: number } | null | undefined)?.type;
  if (type === Phaser.WEBGL) return 'webgl';
  if (type === Phaser.CANVAS) return 'canvas';
  if (type === Phaser.HEADLESS) return 'headless';
  return 'unknown';
}

/** The live GL context, or `null` for any other renderer or a lost context. */
function webglContextOf(game: Phaser.Game): DebugInfoContext | null {
  const gl = (game.renderer as { gl?: unknown } | null | undefined)?.gl;
  return typeof gl === 'object' && gl !== null ? (gl as DebugInfoContext) : null;
}

/**
 * `PRE_STEP` to `POST_RENDER` is the engine's whole frame: global managers,
 * every scene's update, then the render pass. `performance.now()` is read inside
 * the handlers rather than using the timestamp Phaser passes, because the
 * argument is the rAF timestamp — the moment the browser *scheduled* the frame,
 * not the moment the engine started working — and the gap between the two is
 * exactly the scheduling delay we do not want counted as engine cost.
 */
function frameSignalsFor(game: Phaser.Game): FrameSignals {
  return {
    onFrameStart(listener) {
      const handler = (): void => listener(performance.now());
      game.events.on(Phaser.Core.Events.PRE_STEP, handler);
      return () => {
        game.events.off(Phaser.Core.Events.PRE_STEP, handler);
      };
    },
    onFrameEnd(listener) {
      const handler = (): void => listener(performance.now());
      game.events.on(Phaser.Core.Events.POST_RENDER, handler);
      return () => {
        game.events.off(Phaser.Core.Events.POST_RENDER, handler);
      };
    },
  };
}

/** `matchMedia`, tolerating a browser or a test environment that has none. */
function mediaQuery(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}
