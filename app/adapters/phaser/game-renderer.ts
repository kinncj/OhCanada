import Phaser from 'phaser';

import type { ThemeColours } from '@application/ports';

import { BootScene, HORIZON_FRACTION } from './boot-scene';
import { blendColors, toCssColor, toPhaserColor } from './boot-config';
import type { BootConfig } from './boot-config';
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
}

export class GameRenderer {
  readonly #game: Phaser.Game;
  readonly #config: BootConfig;
  readonly #ready: Promise<void>;
  #probe: RenderTierProbe | null = null;
  #scene: SceneProbe | null = null;
  /**
   * Mirrors the rotate overlay, because `postBoot` is async: on a landscape
   * first load the overlay calls `pause()` before the probe exists, and
   * publishing a literal `false` below would have the probe report a running
   * game behind a "please rotate" dialog.
   */
  #paused = false;

  constructor(options: GameRendererOptions) {
    this.#config = options.config;

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
          this.#probe = startRendererProbe(game, options.config, this.#scene);
          this.#scene?.publish({ paused: this.#paused });
        },
      },
    });
  }

  /** Resolves once the boot scene has built its first frame's contents. */
  get ready(): Promise<void> {
    return this.#ready;
  }

  get palette(): ThemeColours {
    return this.#config.palette;
  }

  get canvas(): HTMLCanvasElement | null {
    return this.#game.canvas ?? null;
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
   * Custom properties the page uses to extend sky and ground into the side
   * panels. Returned as data so `app/bootstrap` applies them and the adapter
   * stays out of the page's styling.
   */
  cssVariables(): Readonly<Record<string, string>> {
    const band = landBand(this.#config.designHeight, HORIZON_FRACTION);
    const percent = (fraction: number): string => `${(fraction * 100).toFixed(3)}%`;

    return {
      '--tn-sky': this.#config.palette.sky,
      '--tn-ground': this.#config.palette.ground,
      '--tn-horizon': this.#config.palette.horizon,
      /* A shade of the ground, computed once here so the page and the scene
         cannot disagree about the colour of the same hill. */
      '--tn-land': toCssColor(
        blendColors(toPhaserColor(this.#config.palette.ground), 0x000000, LAND_SHADE),
      ),
      '--tn-land-crest': percent(band.crest),
      '--tn-land-skirt': percent(band.skirt),
      '--tn-land-end': percent(band.end),
    };
  }

  /** Landscape on a phone pauses the game behind the rotate overlay (ADR-0002). */
  pause(): void {
    if (this.#game.scene.isActive(BootScene.KEY)) {
      this.#game.scene.pause(BootScene.KEY);
    }
    this.#paused = true;
    this.#scene?.publish({ paused: true });
  }

  resume(): void {
    if (this.#game.scene.isPaused(BootScene.KEY)) {
      this.#game.scene.resume(BootScene.KEY);
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
    marker: game.canvas ?? null,
    /* One mechanism, not two: the tier the renderer probe measured is published
       through the same element a locomotion scenario reads. */
    onProfile: (profile) => {
      scene?.publish({ ...profileToSnapshot(profile), renderer: identity.kind });
    },
  });
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

function removeSceneProbeGlobal(): void {
  if (typeof window === 'undefined') return;
  delete (window as unknown as Record<string, unknown>)[SCENE_PROBE_GLOBAL];
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
