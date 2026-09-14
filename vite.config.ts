import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

import { progressiveWebApp } from './scripts/lib/pwa.mjs';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * `base` is read from content/game.config.json (ADR-0006) so renaming the
 * repository or moving to a custom domain is a one-line content change.
 */
interface GameConfigBase {
  readonly basePath: string;
}

const gameConfig = JSON.parse(
  readFileSync(new URL('./content/game.config.json', import.meta.url), 'utf8'),
) as GameConfigBase;

const resolvePath = (segment: string): string =>
  fileURLToPath(new URL(segment, import.meta.url));

export default defineConfig({
  root: rootDir,
  base: gameConfig.basePath,
  publicDir: 'assets/dist',
  /**
   * Slice F3, ADR-0034: the web app manifest, the icons, and `<base>sw.js` -
   * the Workbox worker when `featureFlags.serviceWorker` is on, the tombstone
   * (infra/pages/sw.js) when it is off. Build only; a dev server gets none of it.
   *
   * `sw.js` stays un-hashed at exactly `<base>sw.js` in both modes: that is the
   * URL every existing registration's update check fetches, including the
   * archived 3D build's (docs/runbook.md 3b), so it is the only URL through
   * which a worker can ever be replaced or removed.
   */
  plugins: [progressiveWebApp({ root: rootDir })],
  resolve: {
    alias: {
      '@domain': resolvePath('./app/domain'),
      '@application': resolvePath('./app/application'),
      '@adapters': resolvePath('./app/adapters'),
      '@ui': resolvePath('./app/ui'),
      '@common': resolvePath('./common'),
      '@content': resolvePath('./content'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    /**
     * Full source maps for every chunk, vendor included.
     *
     * They are 10.9 MiB of the 11.8 MiB `dist/` and they cost a player nothing:
     * a browser fetches a `.map` only when DevTools is open, and
     * `scripts/deploy-check.mjs` excludes `.map` files from the payload budgets
     * for exactly that reason. This is an open-source project - being
     * debuggable in the field is worth more than bytes in the artefact.
     *
     * `'hidden'` for the vendor chunk only was considered and is not possible
     * cleanly: `build.sourcemap` (and Rollup's `output.sourcemap` beneath it) is
     * a per-output option, not a per-chunk one, so splitting it would mean a
     * plugin that strips `sourceMappingURL` comments out of named chunks in
     * `generateBundle`. That buys zero bytes - `'hidden'` still emits the map -
     * in exchange for a non-obvious build behaviour. Not worth it.
     */
    sourcemap: true,
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
      output: {
        /**
         * Two groupings, for two different reasons.
         *
         * **Vendors**, so Phaser and Rive are cached across deploys instead of
         * re-downloaded with every application edit.
         *
         * **The question bank, by subject.** `app/adapters/content` globs
         * `content/questions/<subject>/*.json` lazily, and without this line
         * Rollup emits one chunk per document: 237 files, so opening a history
         * drill would cost 96 requests for 2.6 kB each. Grouping by directory
         * makes it one request per subject and keeps the whole bank off the
         * initial payload, which is what the 8 MB / 6 s budgets are about. The
         * subject is taken from the path, not from a list, so a new
         * `content/questions/<subject>/` directory chunks itself with no edit
         * here — the same "a subject is a directory" rule the adapter runs on.
         */
        manualChunks(id: string): string | undefined {
          const bank = /[/\\]content[/\\]questions[/\\]([^/\\]+)[/\\][^/\\]+\.json$/.exec(id);
          if (bank !== null) return `questions-${bank[1]}`;
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('phaser')) return 'phaser';
          if (id.includes('@rive-app')) return 'rive';
          if (id.includes('ajv')) return 'ajv';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
