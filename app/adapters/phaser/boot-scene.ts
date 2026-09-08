import Phaser from 'phaser';

import { mixColor, toPhaserColor, type BootConfig } from './boot-config';

/**
 * The slice-0 playfield: an empty portrait scene that proves the scale contract.
 *
 * There is no gameplay here and there will never be any. Once slice 1 lands,
 * BootScene hands over to the level scene; what it owns permanently is the
 * composition ADR-0002 fixes for every level:
 *
 *   - 1080x1920 design space, sky at the top, ground at the bottom;
 *   - the horizon at two-thirds height — playfield above it, HUD and question
 *     cards below it, inside thumb reach;
 *   - a background that costs exactly one screen of fill, so the 4x overdraw
 *     budget is spent on gameplay and not on the sky.
 */

/** Where the playfield ends and the HUD third begins. ADR-0002, "Composition". */
export const HORIZON_FRACTION = 2 / 3;

/** Horizontal bands used to fake a vertical gradient. See `mixColor` for why. */
const GRADIENT_BANDS = 96;

/** Design-space margin the debug guides mark as "keep titles inside this". */
const TITLE_SAFE_MARGIN = 48;

const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export interface BootSceneOptions {
  readonly config: BootConfig;
  /** Called once the first frame's contents exist. Drives the composition root's ready signal. */
  readonly onReady?: () => void;
}

export class BootScene extends Phaser.Scene {
  static readonly KEY = 'boot';

  readonly #options: BootSceneOptions;
  #debugReadout: Phaser.GameObjects.Text | null = null;

  constructor(options: BootSceneOptions) {
    super(BootScene.KEY);
    this.#options = options;
  }

  create(): void {
    const { config } = this.#options;
    const width = config.designWidth;
    const height = config.designHeight;
    const horizonY = Math.round(height * HORIZON_FRACTION);

    this.#paintBackground(width, height);
    this.#paintHorizon(width, horizonY);
    this.#paintTitle(width, height);

    if (config.debugOverlay) {
      this.#paintDebugGuides(width, height, horizonY);
      this.scale.on(Phaser.Scale.Events.RESIZE, this.#refreshDebugReadout, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off(Phaser.Scale.Events.RESIZE, this.#refreshDebugReadout, this);
      });
    }

    this.#options.onReady?.();
  }

  /**
   * Sky -> ground in `GRADIENT_BANDS` horizontal strips inside a single Graphics
   * object. One screen of fill, no texture, no shader, and identical output on
   * the WebGL and Canvas renderers.
   */
  #paintBackground(width: number, height: number): void {
    const { palette } = this.#options.config;
    const graphics = this.add.graphics();
    const bandHeight = height / GRADIENT_BANDS;

    for (let band = 0; band < GRADIENT_BANDS; band += 1) {
      const position = band / (GRADIENT_BANDS - 1);
      graphics.fillStyle(mixColor(palette.sky, palette.ground, position), 1);
      // +1 on the height so neighbouring bands overlap by a sub-pixel and no
      // seam shows through after FIT rounds the display size.
      graphics.fillRect(0, Math.floor(band * bandHeight), width, Math.ceil(bandHeight) + 1);
    }
    graphics.setDepth(0);
  }

  /** The two-thirds rule, drawn so a designer can see it without opening the ADR. */
  #paintHorizon(width: number, horizonY: number): void {
    const { palette } = this.#options.config;
    const horizon = this.add.graphics();

    horizon.fillStyle(toPhaserColor(palette.horizon), 0.12);
    horizon.fillRect(0, horizonY - 24, width, 24);
    horizon.fillStyle(toPhaserColor(palette.horizon), 0.85);
    horizon.fillRect(0, horizonY - 3, width, 6);
    horizon.setDepth(1);
  }

  /** App title and version, centred: the label that proves what scale you are seeing. */
  #paintTitle(width: number, height: number): void {
    const { config } = this.#options;
    const centreX = width / 2;
    const centreY = height / 2;

    this.add
      .text(centreX, centreY - 40, config.title, {
        fontFamily: FONT_STACK,
        fontSize: '104px',
        fontStyle: '700',
        color: config.palette.ink,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(centreX, centreY + 60, `v${config.version}`, {
        fontFamily: FONT_STACK,
        fontSize: '44px',
        color: config.palette.inkMuted,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  /**
   * Safe-area and composition guides. `featureFlags.debugOverlay` only.
   *
   * The CSS insets are applied to the canvas *host* (see `index.html`), so inside
   * design space they are always zero — the guides therefore mark the design
   * bounds, the title-safe margin and the thirds, and the readout prints the
   * insets the browser actually reported so a notch can be checked on device.
   */
  #paintDebugGuides(width: number, height: number, horizonY: number): void {
    const guides = this.add.graphics().setDepth(10);
    const guideColor = toPhaserColor(this.#options.config.palette.horizon);

    guides.lineStyle(4, guideColor, 0.55);
    guides.strokeRect(2, 2, width - 4, height - 4);

    guides.lineStyle(2, guideColor, 0.35);
    guides.strokeRect(
      TITLE_SAFE_MARGIN,
      TITLE_SAFE_MARGIN,
      width - TITLE_SAFE_MARGIN * 2,
      height - TITLE_SAFE_MARGIN * 2,
    );

    for (const y of [Math.round(height / 3), horizonY]) {
      guides.lineStyle(2, guideColor, 0.35);
      guides.lineBetween(0, y, width, y);
    }
    guides.lineStyle(2, guideColor, 0.2);
    guides.lineBetween(width / 2, 0, width / 2, height);

    this.#debugReadout = this.add
      .text(TITLE_SAFE_MARGIN + 12, TITLE_SAFE_MARGIN + 12, '', {
        fontFamily: FONT_STACK,
        fontSize: '28px',
        color: this.#options.config.palette.ink,
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 12, y: 8 },
      })
      .setDepth(11);

    this.#refreshDebugReadout();
  }

  #refreshDebugReadout(): void {
    if (this.#debugReadout === null) return;
    const { displaySize, gameSize, displayScale } = this.scale;
    this.#debugReadout.setText(
      [
        `design ${gameSize.width}x${gameSize.height}`,
        `canvas ${Math.round(displaySize.width)}x${Math.round(displaySize.height)}`,
        `scale  ${(1 / displayScale.x).toFixed(3)}`,
        `safe   ${readSafeAreaInsets()}`,
      ].join('\n'),
    );
  }
}

/** The `env(safe-area-inset-*)` values, mirrored onto `:root` by `index.html`. */
function readSafeAreaInsets(): string {
  if (typeof document === 'undefined') return 'n/a';
  const style = getComputedStyle(document.documentElement);
  const read = (side: string): string =>
    style.getPropertyValue(`--tn-safe-${side}`).trim() || '0px';
  return `${read('top')} ${read('right')} ${read('bottom')} ${read('left')}`;
}
