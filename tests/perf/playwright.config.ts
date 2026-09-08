import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/**
 * Performance suite: frame time, payload weight and time-to-play budgets.
 *
 * Serves the production build with `vite preview` on port 4174 so the suite
 * exercises the same artefact GitHub Pages serves, base path included.
 * The viewport is a portrait phone (390x844 CSS px): TrueNorth is portrait-only
 * (ADR-0002) and no suite may ever assert a landscape layout.
 */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = 4174;
const BASE_PATH = '/OhCanada/';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: fileURLToPath(new URL('../../test-results/perf', import.meta.url)),
  reporter: [
    ['list'],
    [
      'html',
      {
        open: 'never',
        outputFolder: fileURLToPath(
          new URL('../../playwright-report/perf', import.meta.url),
        ),
      },
    ],
  ],

  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-portrait',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],

  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: REPO_ROOT,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
