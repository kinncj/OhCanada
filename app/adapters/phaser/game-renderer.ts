import Phaser from 'phaser';

import type { RigDocument, ThemeColours } from '@application/ports';

import { BootScene, HORIZON_FRACTION } from './boot-scene';
import { blendColors, toCssColor, toPhaserColor } from './boot-config';
import type { BootConfig } from './boot-config';
import {
  artUrlsOf,
  parseAssetManifest,
  preferredAssetScale,
  selectLevelAssets,
  type AssetManifest,
  type LoadRequest,
} from './level-assets';
import { bundledLevelCatalog, type LevelCatalog } from './level-catalog';
import type { SceneLevel } from './level-document';
import { censusIsRemarkable, describeCensus } from './verified-claim';
import type { SceneEventListener, SceneMilestoneListener } from './level-events';
import { dayPhase, tintPalette } from './time-of-day';
import { LevelScene } from './level-scene';
import { createPlayableMarker, type MarkerHost, type PlayableMarker } from './playable-marker';
import { appErr, ok, type Result } from '@common/result';
import { GROUND_FILL_SHADE, LAND_SHADE, landBand, levelLandBand } from './horizon-profile';
import { skyStopList, type SkyStop } from './sky-top';
import {
  identifyRenderer,
  type DebugInfoContext,
  type RendererIdentity,
  type RendererKind,
} from './renderer-identity';
import {
  motionLevelFor,
  readFormFactor,
  startRenderTierProbe,
  type FrameSignals,
  type RenderTierProbe,
} from './render-tier-probe';
import { backingScaleFor } from './visual-tier';
import type { MotionLevel, RenderProfile, TierDecision, VisualTier } from './visual-tier';
import {
  SCENE_PROBE_GLOBAL,
  SCENE_PROBE_TEST_ID,
  createSceneProbe,
  isSceneProbeEnabled,
  profileToSnapshot,
  sceneProbeHandle,
  tierOverrideFrom,
  type SceneProbe,
  type SceneProbeHandle,
} from './scene-probe';
import { pinTextureUnitsPerBatch } from './texture-batching';

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
   * The moments a level *finishes* something: `quest/completed`,
   * `level/completed`, and `level/exitReached` — the player arriving at the end
   * of the world, which is the only one of the three the scene observes for
   * itself. It is a position and not an achievement; what it is worth is the
   * composition root's to decide.
   *
   * A channel of its own rather than two more `onLevelEvent` names, because the
   * scene's event union is type-checked against `app/ui`'s in the composition
   * root and the UI has no copy for a finished quest yet — see
   * `level-events.ts`. Binding it is one line when the words exist.
   */
  readonly onLevelMilestone?: SceneMilestoneListener;
  /**
   * The level's first playable frame exists.
   *
   * **Not the same moment as `loadLevel` resolving, and that difference is a
   * defect somebody is currently working around.** `loadLevel` returns once the
   * document has parsed and the scene has been handed to Phaser; Phaser then
   * boots it, drains its loader and calls `create` one or more frames later.
   * Everything that makes the level playable — the camera, the affordances and,
   * since the dropped-first-keypress fix, the keyboard keys themselves — happens
   * in `create`. So a caller that writes "ready" when `loadLevel` resolves is
   * announcing a level the player cannot yet touch, and the first key they press
   * in that window reaches nothing.
   *
   * `LevelScene` has always published this; nothing carried it out of the
   * adapter. **No caller yet** — `app/bootstrap` owns the attribute and another
   * agent owns that file — so it is reported rather than half-applied, exactly
   * as `setPlayerAppearance` and `onLevelMilestone` were: the one line is
   * `root.dataset['tnLevel'] = 'ready'`, moved out of `load()` and into here.
   */
  readonly onLevelReady?: (levelId: string) => void;
  /**
   * {@link GameRenderer.cssVariables} would now answer differently, with no
   * level change to prompt a caller to ask.
   *
   * The open level reports the colour of the canvas's first row, and the band of
   * page above a letterboxed canvas is painted with it (ADR-0044). That colour is
   * known only once the level's textures exist, and it moves when the tier
   * switches a layer off or the time-of-day tint repaints a sky that shows. The
   * composition root re-applies the variables; the adapter still never touches
   * the page's styling itself.
   */
  readonly onPageThemeChange?: () => void;
  /**
   * The device clock, injectable so a test can put the level at any hour.
   *
   * A level's sky follows the real time of day (`time-of-day.ts`). Local only:
   * this is the whole of "the game follows the real world" and it makes no
   * request of anything.
   */
  readonly now?: () => Date;
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
  /**
   * Where {@link GameRenderer.missingLevelArt} looks for a level's files. Defaults
   * to the page's Cache Storage, which the service worker fills (ADR-0034); `null`
   * says there is none. Injectable so the offline answer can be driven without a
   * worker.
   */
  readonly artCache?: LevelArtStore | null;
}

/** The part of Cache Storage {@link GameRenderer.missingLevelArt} reads. */
export interface LevelArtStore {
  match(url: string): Promise<unknown>;
}

/** The page's Cache Storage, or `null` in a browser (or an insecure page) that has none. */
function browserArtStore(): LevelArtStore | null {
  if (typeof caches === 'undefined') return null;
  return { match: (url: string): Promise<unknown> => caches.match(url) };
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
  /**
   * What the open level draws down its sky, as it last reported it, or `null`
   * before it has (ADR-0044).
   *
   * The first stop is the canvas's first row, which the band above a letterboxed
   * canvas takes; the list is what the desktop side panels take.
   */
  #skyBand: readonly SkyStop[] | null = null;
  /** One manifest fetch per session, shared by every level that opens after. */
  #manifest: Promise<Result<AssetManifest>> | null = null;
  /** One rig fetch per session, shared by every level that opens after. */
  #rig: Promise<RigDocument> | null = null;
  /**
   * Mirrors the rotate overlay, because `postBoot` is async: on a landscape
   * first load the overlay calls `pause()` before the probe exists, and
   * publishing a literal `false` below would have the probe report a running
   * game behind a "please rotate" dialog.
   */
  #paused = false;
  /** The accessibility auto-move option, remembered across level changes. */
  #autoMove = false;
  /**
   * The in-game "Less movement" setting, remembered across level changes and
   * across the gap before `postBoot` — the save is read asynchronously, so the
   * composition root may say this before the probe exists.
   */
  #reducedMotionSetting = false;
  /** `prefers-reduced-motion: reduce`, watched so a system change applies live. */
  #motionQuery: MediaQueryList | null = null;
  readonly #onMotionQueryChange = (): void => {
    this.#probe?.setMotion(this.#motionLevel());
  };
  /**
   * The appearance the player chose, remembered across level changes.
   *
   * The session owns it and a scene is per level, exactly as `#autoMove` is.
   * Empty dresses the player in the rig artboard's own skins, which is a
   * complete character rather than a naked one — so a build that never calls
   * {@link setPlayerAppearance} still draws a player.
   */
  #playerSkins: Readonly<Record<string, string>> = {};

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
      /**
       * Three touch pointers, not Phaser's default of one.
       *
       * The default silently discards every finger after the first: Phaser
       * allocates `activePointers + 1` `Pointer` objects and a touch with no
       * pointer to land on emits no event at all. That made "two fingers never
       * ask for two directions" true by accident rather than by rule, which is
       * the worst way for a rule to be true — nothing exercised the ordering in
       * `touch-controls.ts` and nothing would have noticed when it broke.
       *
       * Three is a thumb, a second thumb and a resting palm. Traversal is
       * one-thumb by design (CLAUDE.md) so nothing needs more, and the count is
       * an allocation of three objects at boot rather than a per-frame cost.
       */
      input: { activePointers: 3 },
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
          /* One texture per WebGL batch on every device, before the first
             frame (ADR-0047, `texture-batching.ts`). Phaser's batch shader picks
             a quad's texture with an exact float comparison, and a fragment that
             matches none draws transparent: the player drew with holes on every
             level whose character atlas landed off unit 0. Phones already run
             this path; this puts desktops and iPads on it too. */
          const textureUnitsPerBatch = pinTextureUnitsPerBatch(game.renderer);
          const search = options.search ?? readLocationSearch();
          /* `?e2e=1` only. A normal load creates no element and installs no
             global, so the probe costs one query-string read and nothing else. */
          this.#scene = installSceneProbe(options.parent, search);
          /* The renderer's own read-back, not the constant: a renderer that kept
             its own limit is published as it is. Absent on a Canvas renderer. */
          if (textureUnitsPerBatch !== null) this.#scene?.publish({ textureUnitsPerBatch });
          this.#marker = installPlayableMarker(options.parent);
          /* The perf suite's tier override, fenced twice: `tierOverrideFrom`
             reads `tier` only behind the same `?e2e=1` gate, and it is not even
             asked unless that gate actually installed the probe. An ordinary
             load passes `null` and the tier is measured, as for every player. */
          const pinnedTier = this.#scene === null ? null : tierOverrideFrom(search);
          this.#motionQuery = mediaQuery('(prefers-reduced-motion: reduce)');
          this.#motionQuery?.addEventListener?.('change', this.#onMotionQueryChange);
          this.#probe = startRendererProbe(game, options.config, this.#scene, pinnedTier, this.#motionLevel(), (profile) => {
            /*
             * Fewer pixels first, then tell the scene — it re-derives its camera
             * zoom from the scale manager and must read the new size.
             *
             * A resize is a **gap, not a slow frame**: the same class of event
             * as a resume, which has re-armed the warm-up since slice 0. It
             * matters more now than it did. Before `renderScale` was wired a
             * tier change altered particle and layer counts, which move the cost
             * a little; it now changes the **pixel count** — promoting Ottawa
             * from low to medium grows the drawing buffer from 810x1440 to
             * 1080x1920, 1.78x the fragments — so the measurement feeds back
             * into the thing being measured. The frames right after a resize
             * also pay for reallocating the framebuffer, and charging those to
             * the new tier is how a tracker oscillates: promote, measure the
             * reallocation, demote, promote again. Discarding them lets each
             * tier be judged on frames it actually drew.
             */
            if (applyBackingScale(game, options.config, profile)) this.#probe?.reset();
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
    const document = await this.#catalog.load(id, this.#config.locomotionModes);
    if (!document.ok) return document;

    /*
     * What ADR-0003's filter did to this level (ADR-0024).
     *
     * Two states get a line: a claim was refused, or **nothing was examined**.
     * The second is the one this exists for — every level carries at least a
     * territorial claim, so zero examined is the filter having stopped matching
     * the blocks it reads, which is exactly the failure that used to look like
     * success. A level in good order says nothing here and still publishes all
     * three numbers to the scene probe (`data-claims-*`), so "0 refused of 4
     * examined" stays readable from outside without a warning every load.
     */
    if (censusIsRemarkable(document.value.claims)) {
      console.warn(`verified-claim: ${describeCensus(String(id), document.value.claims)}`);
    }

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
    const rig = await this.#resolveRig();

    const marker = this.#marker;
    marker?.hide();

    if (this.#game.scene.getScene(LevelScene.KEY) !== null) {
      this.#game.scene.remove(LevelScene.KEY);
    }
    if (this.#game.scene.isActive(BootScene.KEY)) this.#game.scene.stop(BootScene.KEY);

    /* The previous level's sky is not this one's. Until the new scene reports,
       the page falls back to the tinted theme sky and a plain ramp. */
    this.#skyBand = null;
    const scene = new LevelScene({
      level: document.value,
      designWidth: this.#config.designWidth,
      designHeight: this.#config.designHeight,
      probe: this.#scene,
      onSkyBand: (stops: readonly SkyStop[]) => {
        /* A scene that has since been replaced does not speak for the canvas. */
        if (this.#level !== scene) return;
        this.#skyBand = stops;
        this.#options.onPageThemeChange?.();
      },
      marker,
      profile: this.renderProfile,
      assets,
      rig,
      playerSkins: this.#playerSkins,
      ...(this.#options.now === undefined ? {} : { now: this.#options.now }),
      ...(this.#options.onLevelEvent === undefined
        ? {}
        : { onEvent: this.#options.onLevelEvent }),
      ...(this.#options.onLevelMilestone === undefined
        ? {}
        : { onMilestone: this.#options.onLevelMilestone }),
      onReady: (levelId: string) => {
        /*
         * Building a level is a gap, not a slow frame — the same class of event
         * as a resume or a resize, which already re-arm the warm-up. It matters
         * more than it did: a demotion soon after a tier was entered now counts
         * as a failed attempt at that tier, and two close it for the session
         * (`createTierTracker`). The frames that construct the scene and upload
         * its first textures must not be the evidence for that.
         */
        this.#probe?.reset();
        this.#options.onLevelReady?.(levelId);
      },
    });
    this.#level = scene;
    /* Before `scene.add`, so the option is in force on the level's first frame
       rather than one frame after it. */
    scene.setAutoMove(this.#autoMove);
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
    const requests = await this.#requestsFor(id);
    /* The level is still playable on placeholders, so a failure is reported (by
       `#requestsFor`) and not returned: a level a player can walk beats a blank
       page. */
    if (!requests.ok) return [];
    if (requests.value.length === 0) {
      console.error(
        `[renderer] the asset manifest lists nothing for level "${id}"; every layer will ` +
          `draw its placeholder band.`,
      );
    }
    return requests.value;
  }

  /**
   * This level's load list as a `Result`, for the one caller that must not read
   * "the manifest would not load" as "the level draws nothing":
   * {@link GameRenderer.missingLevelArt}. It logs exactly what `#resolveAssets`
   * always logged, and `#resolveAssets` turns its error into the empty list the
   * scene has always opened on.
   */
  async #requestsFor(id: string): Promise<Result<readonly LoadRequest[]>> {
    const base = this.#options.assetsBaseUrl ?? assetsBaseUrl();
    const fetchImpl = this.#options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (fetchImpl === undefined) {
      return appErr(
        'unsupported',
        'renderer.assets.noFetch',
        'this page has no fetch to read the asset manifest with.',
        { level: id },
      );
    }

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
        return manifest;
      }
      const scale = preferredAssetScale(
        this.#options.devicePixelRatio ??
          (typeof window === 'undefined' ? 1 : window.devicePixelRatio),
      );
      return ok(selectLevelAssets(manifest.value, id, { scale, baseUrl: base }));
    } catch (cause) {
      console.error(`[renderer] could not read the asset manifest.`, cause);
      return appErr(
        'io',
        'renderer.assets.manifestUnreadable',
        'the asset manifest could not be read.',
        { level: id },
        cause,
      );
    }
  }

  /**
   * The files this level would draw on this device that the browser's cache
   * cannot answer for — `LevelArtCache` (ADR-0034, amended 2026-09-15).
   *
   * `app/bootstrap` asks only while the browser reports no network, and before
   * {@link GameRenderer.loadLevel}: a level whose art is not all here would open
   * on placeholder bands, which is what the second live-site audit found Halifax
   * doing. The files are the ones the scene would queue — this device's scale,
   * and a pinned file at the scale it was pinned to — so the other scale is never
   * reported missing and nothing the scene asks for is left out.
   *
   * An error, never `[]`, when it cannot tell: no Cache Storage, a manifest that
   * will not read, or a cache that throws (ADR-0024).
   */
  async missingLevelArt(id: string): Promise<Result<readonly string[]>> {
    const store = this.#options.artCache === undefined ? browserArtStore() : this.#options.artCache;
    if (store === null) {
      return appErr(
        'unsupported',
        'renderer.art.noCache',
        `there is no cache to open level "${id}" from.`,
        { level: id },
      );
    }
    const requests = await this.#requestsFor(id);
    if (!requests.ok) return requests;

    try {
      const missing: string[] = [];
      for (const url of artUrlsOf(requests.value)) {
        if ((await store.match(url)) === undefined) missing.push(url);
      }
      return ok(missing);
    } catch (cause) {
      return appErr(
        'io',
        'renderer.art.cacheUnreadable',
        `the cache could not be read for level "${id}".`,
        { level: id },
        cause,
      );
    }
  }

  /**
   * The shared character rig, once per session.
   *
   * Imported dynamically rather than statically: it is 72 kB of JSON that a page
   * with no level open never needs, and the initial payload budget is 8 MB with
   * a 6 s time-to-play target (CLAUDE.md). A level that opens pays for it once.
   *
   * `null` on failure rather than a level failure: a character drawn as a
   * placeholder is a worse level, not a broken one, and `data-actors-drawn` is
   * what makes the difference visible instead of silent.
   */
  async #resolveRig(): Promise<RigDocument | null> {
    try {
      this.#rig ??= import('@content/characters/rig.json').then(
        (module) => (module.default ?? module) as unknown as RigDocument,
      );
      return await this.#rig;
    } catch (cause) {
      console.error('[renderer] could not load the character rig.', cause);
      return null;
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
    /*
     * The panels follow the same sky the scene does.
     *
     * `time-of-day.ts` tints the level's palette from the device clock, and the
     * desktop side panels are that palette as a CSS gradient (see the header).
     * Tinting one and not the other would put a daylight page around an evening
     * canvas, which is the framed-picture effect these variables exist to
     * remove. The boot screen has no level and keeps the config palette.
     */
    const palette =
      level === null
        ? this.#config.palette
        : tintPalette(level.palette, { phase: dayPhase(this.#now()) });

    /*
     * The land band is whichever ground is on the canvas: the boot screen's
     * hills, or the open level's own.
     *
     * It used to collapse to nothing with a level open, on the argument that a
     * level's ground is a polyline and no single stop can follow it. True, and
     * it left the panels as the sky-to-ground ramp alone — a smooth blue-grey
     * wash beside a canvas with a crisp horizon two-thirds down, which a
     * live-site audit read as a framed picture and CLAUDE.md forbids in one
     * sentence: "side panels extend the level's sky/ground".
     *
     * `levelLandBand` gives that polyline's mean height instead, which is exact
     * on every flat level and much closer than nothing on the one that rolls,
     * and the band runs opaque from there to the last row because a level's
     * ground does too. Still zero draw calls: the panels are CSS.
     */
    const band =
      level === null
        ? landBand(this.#config.designHeight, HORIZON_FRACTION)
        : levelLandBand(level.ground, this.#config.designHeight);

    return {
      /* The theme sky under the current light: the ramp's colour, the browser
         chrome's, and what the e2e day-and-night checks read. Not the band above
         the canvas any more — see `--tn-sky-top`. */
      '--tn-sky': palette.sky,
      /*
       * What the canvas draws on its first row, which the band of page above a
       * letterboxed canvas is painted with (ADR-0044).
       *
       * Not `--tn-sky`. Every level's backmost layer is an opaque sky image that
       * starts at world row 0 and is never tinted, so under any light but noon
       * the tinted sky is a visible step away from the canvas under it — 36 to
       * 59 per channel at 19:00. The scene works the colour out from what it
       * draws; until it has, and on the boot screen, whose gradient starts on
       * the untinted config sky, the two are the same answer.
       */
      '--tn-sky-top':
        level === null ? palette.sky : (this.#skyBand?.[0]?.colour ?? palette.sky),
      /*
       * What the canvas draws down the rest of its sky, as gradient stops the
       * page splices into the middle of that ramp.
       *
       * The fourth live-site audit's finding: `--tn-sky-top` made the panel exact
       * on row 0 and the ramp then ran straight from there to `--tn-ground`,
       * through the hill line and the skyline without touching either. The step
       * between panel and canvas grew from 0 at the top to 25 on Halifax and 33
       * on the North by mid-screen — a seam down both edges of the playfield.
       *
       * A single space, not an empty string, when there is nothing to say: the
       * page reads this in the middle of a stop list, and an unset custom
       * property there is invalid at computed-value time and takes the whole
       * gradient with it. The boot screen has no level and says nothing, which
       * leaves exactly the two-stop ramp that shipped before.
       */
      '--tn-sky-stops': level === null ? ' ' : skyStopList(this.#skyBand ?? []),
      '--tn-ground': palette.ground,
      '--tn-horizon': palette.horizon,
      /* A shade of the ground, computed once here so the page and the scene
         cannot disagree about the colour of the same hill — or, with a level
         open, of the same ground: `#paintGround` uses `GROUND_FILL_SHADE` and
         the boot scene's silhouette uses the deeper `LAND_SHADE`, so the panel
         takes whichever of the two is actually on the canvas. */
      '--tn-land': toCssColor(
        blendColors(
          toPhaserColor(palette.ground),
          0x000000,
          level === null ? LAND_SHADE : GROUND_FILL_SHADE,
        ),
      ),
      '--tn-land-crest': percent(band.crest),
      '--tn-land-skirt': percent(band.skirt),
      '--tn-land-end': percent(band.end),
    };
  }

  /**
   * Auto-move: the player never has to hold a direction (CLAUDE.md, Traversal).
   *
   * Remembered here as well as pushed at the scene, because a player who turns
   * the option on and then changes level would otherwise lose it — the setting
   * belongs to the session and the scene is per level.
   *
   * **This has no caller yet, and that is the one thing about it worth
   * reporting rather than leaving to be discovered.** `app/ui/settings-screen.ts`
   * already offers the toggle and `app/ui/settings.ts` already persists it as
   * `SettingsDocument.autoMove`; what is missing is the line in the composition
   * root that joins the two, and `app/bootstrap` was being edited by another
   * agent when this landed. The capability is here so that wire is one line.
   */
  setAutoMove(enabled: boolean): void {
    this.#autoMove = enabled;
    this.#level?.setAutoMove(enabled);
  }

  /**
   * The in-game "Less movement" setting (CLAUDE.md, Accessibility: reduced motion
   * disables parallax easing, particles and squash-and-stretch).
   *
   * **This had no equivalent, and that was the defect.** The render profile took
   * its motion from `prefers-reduced-motion` alone, once, at boot, so turning the
   * setting on in Settings changed the page's `data-tn-motion` and nothing the
   * canvas draws: Ottawa kept 400 snowflakes and eased parallax, and a reload
   * did not help because nothing on this side ever read the save. Worse, the
   * probe republishes `data-tn-motion` onto `<html>` on every measurement window,
   * so the page's own reduced-motion rules were switched back off a second later.
   *
   * The setting **or** the system preference asks for stillness, and either is
   * enough ({@link motionLevelFor}). Applied at once to the open level through
   * the same `onProfile` path a tier change takes, so particles, parallax easing
   * and the rig's `reducedMotion` input all follow in one step.
   */
  setReducedMotion(requested: boolean): void {
    this.#reducedMotionSetting = requested;
    this.#probe?.setMotion(this.#motionLevel());
  }

  /** The motion axis as the setting and the system answer it together, right now. */
  #motionLevel(): MotionLevel {
    return motionLevelFor({
      setting: this.#reducedMotionSetting,
      mediaQuery: this.#motionQuery ?? mediaQuery('(prefers-reduced-motion: reduce)'),
    });
  }

  /** The device clock, or the injected one. */
  #now(): Date {
    return this.#options.now?.() ?? new Date();
  }

  /**
   * Dress the player, from the character creator.
   *
   * **No caller yet, and reported rather than left to be discovered.** The
   * creator is `app/ui/character-creator.ts` and the join between it and this
   * belongs in `app/bootstrap`, which another agent owns. Until it exists the
   * player wears the rig artboard's own skins — a complete character, not a
   * missing one — so nothing is broken while the wire is missing, which is the
   * property that lets the wire be one line.
   *
   * Takes effect at the next level open. Re-dressing a character mid-level is
   * `ICharacterRenderer.setSkin`, which rebuilds the part list, and there is no
   * screen that would ask for it while a level is running.
   */
  setPlayerAppearance(skins: Readonly<Record<string, string>>): void {
    this.#playerSkins = { ...skins };
  }

  /**
   * Tell the open level that the domain finished a quest.
   *
   * Inbound because an adapter does not know what a quest is (ADR-0005): the
   * domain earns the stamp, the composition root hears it, and the world is told
   * so it can stop advertising something the player has already done.
   *
   * **No caller yet** — same reason as {@link setAutoMove}: `app/bootstrap` is
   * owned by another agent. `app/application/use-cases/stamp-opens-the-next-level`
   * is where the fact is produced.
   */
  markQuestComplete(subjectId: string): void {
    this.#level?.markCompleted(subjectId);
  }

  /**
   * Tell the open level that the player engaged this subject.
   *
   * The interact prompt engages in `app/bootstrap` without passing through the
   * scene (`TN-LEVEL-05`), so without this the stop that brought the player to
   * rest there never heard about it: the card closed on a player still held at
   * the landmark, and one who could not steer — auto-move, one switch — could
   * not leave it. ADR-0032. Idempotent, and a no-op with no level open.
   */
  markEngaged(subjectId: string): void {
    this.#level?.markEngaged(subjectId);
  }

  /** Tell the open level that its stamp was earned. See {@link markQuestComplete}. */
  markLevelComplete(): void {
    this.#level?.markLevelComplete();
  }

  get autoMove(): boolean {
    return this.#autoMove;
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
    this.#motionQuery?.removeEventListener?.('change', this.#onMotionQueryChange);
    this.#motionQuery = null;
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
  pinnedTier: VisualTier | null,
  motion: MotionLevel,
  onProfileChanged: (profile: RenderProfile) => void,
): RenderTierProbe {
  const identity = identifyRenderer(rendererKindOf(game), webglContextOf(game));

  return startRenderTierProbe({
    identity,
    presets: config.graphicsPresets,
    frameTimeMs: config.frameTimeMs,
    signals: frameSignalsFor(game),
    pinnedTier,
    /* The setting and the system preference together (`motionLevelFor`), and
       changed later through `RenderTierProbe.setMotion`. */
    motion,
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
      /* The allowance only: the emitted count is the level scene's to write. */
      scene?.publish({
        ...profileToSnapshot(profile),
        renderer: identity.kind,
        tierPinned: pinnedTier !== null,
      });
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
 * would be work the measurement then reports. Returns whether it resized, so
 * the caller can discard the frames that paid for it.
 */
function applyBackingScale(
  game: Phaser.Game,
  config: BootConfig,
  profile: RenderProfile,
): boolean {
  const scale = backingScaleFor({
    renderScale: profile.renderScale,
    maxPixelRatio: profile.maxPixelRatio,
    designWidth: config.designWidth,
    displayWidthCss: game.scale.displaySize.width,
  });

  const width = Math.round(config.designWidth * scale);
  const height = Math.round(config.designHeight * scale);
  if (game.scale.gameSize.width === width && game.scale.gameSize.height === height) return false;
  game.scale.resize(width, height);
  return true;
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
