import Phaser from 'phaser';

import { blendColors, mixColor, toPhaserColor, type BootConfig } from './boot-config';
import {
  CONIFERS,
  LAND_FADE_DEPTH,
  LAND_SHADE,
  landSkirtTop,
  ridgePoints,
  type RidgePoint,
} from './horizon-profile';

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
 *
 * ## Why the horizon is a ridge and not a rule
 *
 * It used to be a straight, full-width, high-contrast bar across an otherwise
 * empty screen, under a title and a version number. That is the visual grammar
 * of a stalled loader, and it was read as exactly that: two reports of "stuck at
 * the loading screen" from different devices, against a build with no console
 * errors and no failed requests. The composition rule is not the problem — the
 * *straightness* was. `horizon-profile.ts` now supplies rolling hills that
 * average out on the two-thirds line, with conifers standing on them, so the
 * edge reads as land. Nothing on this canvas may look like a progress
 * indicator; that is a permanent constraint, not a slice-0 workaround.
 *
 * What the screen *says* is not painted here at all. The canvas is
 * `aria-hidden` by contract, so the sentence explaining that this is a
 * foundation build with nothing to play yet is DOM (`app/ui/build-status.ts`),
 * where a screen reader can reach it.
 */

/** Where the playfield ends and the HUD third begins. ADR-0002, "Composition". */
export const HORIZON_FRACTION = 2 / 3;

/** Horizontal bands used to fake a vertical gradient. See `mixColor` for why. */
const GRADIENT_BANDS = 96;

/** Design-space margin the debug guides mark as "keep titles inside this". */
const TITLE_SAFE_MARGIN = 48;

/** How far the title block sits down the screen. Above the hills, clear of them. */
const TITLE_FRACTION = 0.36;

/** Row height of the land fade. Coarser than the sky: the colour change is slower. */
const LAND_BAND = 10;

/** The lit crest along the top of the land, in design pixels. */
const CREST_WIDTH = 7;

/** A soft glow above the crest, so the land sits in the air instead of being pasted on. */
const CREST_HAZE_DEPTH = 34;

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
    this.#paintLand(width, height, horizonY);
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

  /**
   * The land: hills at the two-thirds line, a skirt fading back into the
   * gradient, conifers for scale, and a lit crest along the top edge.
   *
   * Painted in one Graphics object, in five passes, back to front. Total cost is
   * roughly a third of a screen of extra fill on top of the background's one,
   * so the whole boot scene stays near 1.3x of the <= 4x overdraw budget
   * (CLAUDE.md, Budgets) and there is nothing to animate, so it is drawn once.
   */
  #paintLand(width: number, height: number, horizonY: number): void {
    const { palette } = this.#options.config;
    const land = this.add.graphics().setDepth(1);

    const ridge = ridgePoints(width, horizonY);
    const crestColor = toPhaserColor(palette.horizon);
    const landColor = blendColors(toPhaserColor(palette.ground), 0x000000, LAND_SHADE);

    /* Below every dip of the ridge, so the hill body and the skirt never gap. */
    const skirtTop = landSkirtTop(horizonY);
    const skirtEnd = Math.min(height, skirtTop + LAND_FADE_DEPTH);

    /* 1. Haze above the crest: light hanging over the hills, not a second rule. */
    land.fillStyle(crestColor, 0.1);
    fillBetween(land, offsetRidge(ridge, -CREST_HAZE_DEPTH), ridge);

    /*
     * 2. The skirt. Each row blends the land silhouette back towards the colour
     * the sky-to-ground gradient has at that row, reaching it exactly at
     * `skirtEnd` — so the land dissolves into the background instead of ending
     * on an edge, and the bottom of the canvas is still `palette.ground` for the
     * desktop side panels to meet. See LAND_FADE_DEPTH.
     */
    for (let y = skirtTop; y < skirtEnd; y += LAND_BAND) {
      const backdrop = mixColor(palette.sky, palette.ground, y / height);
      land.fillStyle(blendColors(landColor, backdrop, (y - skirtTop) / (skirtEnd - skirtTop)), 1);
      land.fillRect(0, y, width, LAND_BAND + 1);
    }

    /* 3. The hills themselves, from the ridge down to the top of the skirt. */
    land.fillStyle(landColor, 1);
    land.beginPath();
    land.moveTo(0, skirtTop);
    tracePath(land, ridge, false);
    land.lineTo(width, skirtTop);
    land.closePath();
    land.fillPath();

    /* 4. Conifers, standing on the land and rising into the sky. */
    for (const tree of CONIFERS) {
      const baseY = ridgeYAt(ridge, tree.t) + 6;
      const x = tree.t * width;
      land.fillTriangle(
        x - tree.halfWidth,
        baseY,
        x + tree.halfWidth,
        baseY,
        x,
        baseY - tree.height,
      );
      land.fillTriangle(
        x - tree.halfWidth * 0.72,
        baseY - tree.height * 0.42,
        x + tree.halfWidth * 0.72,
        baseY - tree.height * 0.42,
        x,
        baseY - tree.height * 1.2,
      );
    }

    /*
     * 5. The lit crest, last so it survives the trees. This is the descendant of
     * the old horizon rule and it carries the same `palette.horizon` colour, but
     * it follows the land, which is the whole point: a line that rises and falls
     * across the width cannot be read as a progress bar.
     */
    land.lineStyle(CREST_WIDTH, crestColor, 0.9);
    land.beginPath();
    tracePath(land, ridge);
    land.strokePath();
  }

  /**
   * App title and version: the label that proves what scale you are seeing.
   *
   * Sits at `TITLE_FRACTION` rather than dead centre so it reads as a sky-borne
   * title over a landscape, and so it is clear of the hills below it. The
   * sentence that tells a visitor what state the build is in is *not* here — it
   * is DOM (`app/ui/build-status.ts`), because the canvas is `aria-hidden`.
   */
  #paintTitle(width: number, height: number): void {
    const { config } = this.#options;
    const centreX = width / 2;
    const centreY = Math.round(height * TITLE_FRACTION);

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

/** The ridge shifted vertically, used as the far side of the haze band. */
function offsetRidge(points: readonly RidgePoint[], dy: number): readonly RidgePoint[] {
  return points.map((point) => ({ x: point.x, y: point.y + dy }));
}

/**
 * Fill the band between two profiles: `upper` left to right, `lower` back again.
 * Both are sampled at the same x positions, so the ends close flat.
 */
function fillBetween(
  graphics: Phaser.GameObjects.Graphics,
  upper: readonly RidgePoint[],
  lower: readonly RidgePoint[],
): void {
  const first = upper[0];
  if (first === undefined || lower.length === 0) return;

  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  tracePath(graphics, upper, false);
  for (let index = lower.length - 1; index >= 0; index -= 1) {
    const point = lower[index];
    if (point !== undefined) graphics.lineTo(point.x, point.y);
  }
  graphics.closePath();
  graphics.fillPath();
}

/** Walk a profile as a path. `open` starts it with a `moveTo`; otherwise it continues one. */
function tracePath(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly RidgePoint[],
  open = true,
): void {
  points.forEach((point, index) => {
    if (index === 0 && open) graphics.moveTo(point.x, point.y);
    else graphics.lineTo(point.x, point.y);
  });
}

/**
 * Where the sampled ridge sits at `t`, by nearest sample.
 *
 * The conifers read the *drawn* profile rather than calling `ridgeHeightAt`
 * again, so a tree can never float above or sink into the hill it is standing
 * on if the sample count changes.
 */
function ridgeYAt(points: readonly RidgePoint[], t: number): number {
  const index = Math.round(Math.min(1, Math.max(0, t)) * (points.length - 1));
  return points[index]?.y ?? 0;
}

/** The `env(safe-area-inset-*)` values, mirrored onto `:root` by `index.html`. */
function readSafeAreaInsets(): string {
  if (typeof document === 'undefined') return 'n/a';
  const style = getComputedStyle(document.documentElement);
  const read = (side: string): string =>
    style.getPropertyValue(`--tn-safe-${side}`).trim() || '0px';
  return `${read('top')} ${read('right')} ${read('bottom')} ${read('left')}`;
}
