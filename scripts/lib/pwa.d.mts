/**
 * Types for `scripts/lib/pwa.mjs`, hand-written, for the reason `claims.d.mts`
 * gives: the module is `.mjs` because `scripts/deploy-check.mjs`, a plain Node
 * script, reads the same constants the plugin writes with, and `vite.config.ts`
 * - TypeScript under `strict` with `allowJs` off - installs the plugin. Only
 * what TypeScript calls is declared.
 */

import type { Plugin } from 'vite';

export interface ProgressiveWebAppOptions {
  /** The repository root: content/game.config.json, assets/src/icons and infra/pages are read from it. */
  readonly root: string;
}

/** The build-only plugin that writes the web app manifest, the icons and dist/sw.js (ADR-0034). */
export declare function progressiveWebApp(options: ProgressiveWebAppOptions): Plugin;
