/**
 * The Phaser adapter's public surface. `app/bootstrap` imports from here and
 * from nowhere else inside this directory (ADR-0005).
 */

export { GameRenderer, type GameRendererOptions } from './game-renderer';
export { BootScene, HORIZON_FRACTION } from './boot-scene';
/*
  No palette type is re-exported: the palette is the port's `ThemeColours`
  (`@application/ports`), and re-exporting it from here would put a second name
  on one shape and invite the drift `boot-config.ts` was just taken off.
*/
export {
  DEFAULT_PALETTE,
  blendColors,
  mixColor,
  parseBootConfig,
  toCssColor,
  toPhaserColor,
  type BootConfig,
} from './boot-config';
