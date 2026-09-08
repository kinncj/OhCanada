import Phaser from 'phaser';

import type { ThemeColours } from '@application/ports';

import { BootScene } from './boot-scene';
import type { BootConfig } from './boot-config';

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
 */

export interface GameRendererOptions {
  /** The element the canvas is inserted into. Sized and safe-area padded by CSS. */
  readonly parent: HTMLElement;
  readonly config: BootConfig;
}

export class GameRenderer {
  readonly #game: Phaser.Game;
  readonly #config: BootConfig;
  readonly #ready: Promise<void>;

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
   * Custom properties the page uses to extend sky and ground into the side
   * panels. Returned as data so `app/bootstrap` applies them and the adapter
   * stays out of the page's styling.
   */
  cssVariables(): Readonly<Record<string, string>> {
    return {
      '--tn-sky': this.#config.palette.sky,
      '--tn-ground': this.#config.palette.ground,
      '--tn-horizon': this.#config.palette.horizon,
    };
  }

  /** Landscape on a phone pauses the game behind the rotate overlay (ADR-0002). */
  pause(): void {
    if (this.#game.scene.isActive(BootScene.KEY)) {
      this.#game.scene.pause(BootScene.KEY);
    }
  }

  resume(): void {
    if (this.#game.scene.isPaused(BootScene.KEY)) {
      this.#game.scene.resume(BootScene.KEY);
    }
  }

  destroy(): void {
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
