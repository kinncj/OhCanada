import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolvePath = (segment: string): string =>
  fileURLToPath(new URL(segment, import.meta.url));

export default defineConfig({
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
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',

      /**
       * What is measured, and why.
       *
       * CLAUDE.md sets the floor at "domain + application ≥ 90%", but
       * `app/domain` and `app/application` are almost entirely `interface` and
       * `type` declarations that erase to nothing: 12 of the 14 files here
       * report `LF:0`. A percentage over an empty measurement is 0/0, which v8
       * reports as 100% and which clears any threshold. That is how this gate
       * came to be green while measuring 58 lines of `common/`.
       *
       * So the set below is "every module that is pure enough to be exercised
       * under `environment: 'node'`", not "every layer the architecture names":
       * the ports (for when they grow runtime code), `common/`, the pure UI
       * helpers and the pure parts of the adapters. Browser entry points are
       * excluded by name below - they are proven by the Playwright suites, not
       * here, and listing them would only re-create the vacuum in reverse.
       *
       * `app/adapters/**` rather than a suffix glob: the first adapter module
       * that was pure but not named `*-config.ts` (the horizon profile) would
       * otherwise have been tested and unmeasured, which is the same lie as an
       * `include` that matches nothing, told one file at a time.
       *
       * `scripts/coverage-floor.mjs` runs straight after `vitest` and fails if
       * this set ever collapses back to (almost) nothing, so an `include` that
       * silently stops matching can no longer pass as 100%.
       */
      include: [
        'app/domain/**',
        'app/application/**',
        'app/ui/**',
        'app/adapters/**',
        'common/**',
      ],
      exclude: [
        // Browser entry points: they construct Phaser or touch `window` at
        // import time, so `environment: 'node'` cannot load them at all.
        'app/bootstrap/main.ts',
        'app/adapters/phaser/boot-scene.ts',
        'app/adapters/phaser/game-renderer.ts',
        // Same reason, and the same discipline: `level-scene.ts` imports Phaser
        // at module scope, so `environment: 'node'` cannot load it. Everything
        // it would otherwise decide has been pushed into the pure modules beside
        // it - `level-document`, `ground-profile`, `level-camera`,
        // `level-effects`, `locomotion`, `playable-marker`, `level-catalog` -
        // which ARE measured here. If this file starts growing rules rather than
        // wiring, that is the signal to move them out, not to widen this list.
        'app/adapters/phaser/level-scene.ts',
        // Re-export barrels. They hold no logic, and the modules behind them are
        // imported directly by their own suites, so counting the barrel would
        // only measure whether a test happened to go through the front door.
        'app/adapters/*/index.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
