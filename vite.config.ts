import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

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

/**
 * Copy infra/pages/sw.js to dist/sw.js, verbatim and un-hashed.
 *
 * It has to land on exactly `<base>sw.js` because that is the URL the archived
 * 3D build registered, and a browser's update check for a live registration
 * fetches that one URL. A content hash would defeat the entire point. Read
 * infra/pages/sw.js before touching this — it is a tombstone, not a feature.
 *
 * `publicDir` would have been the shorter route, but publicDir here is
 * `assets/dist`, which `make assets` generates and which slice 1's art pipeline
 * will own and clean. A hand-written file parked in a generated directory is a
 * file that disappears in a rebuild. Emitting it from the bundle keeps the
 * source in infra/, where it belongs, and independent of that pipeline.
 */
function tombstoneServiceWorker(): Plugin {
  return {
    name: 'truenorth:tombstone-service-worker',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: readFileSync(resolvePath('./infra/pages/sw.js'), 'utf8'),
      });
    },
  };
}

export default defineConfig({
  root: rootDir,
  base: gameConfig.basePath,
  publicDir: 'assets/dist',
  plugins: [tombstoneServiceWorker()],
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
        manualChunks(id: string): string | undefined {
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
