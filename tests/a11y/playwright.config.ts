import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/**
 * Accessibility suite: axe-core over every DOM screen.
 *
 * Serves the production build with `vite preview` on port 4175 so the suite
 * exercises the same artefact GitHub Pages serves, base path included.
 * The viewport is a portrait phone (390x844 CSS px): TrueNorth is portrait-only
 * (ADR-0002) and no suite may ever assert a landscape layout.
 */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = 4175;
/**
 * The screen harness (`tests/a11y/harness.html`) is served by a *dev* server,
 * not by `vite preview`.
 *
 * `vite preview` serves `dist/`, and `dist/` contains exactly what
 * `vite.config.ts` declares as a build input — one page, `index.html`. Slice 1's
 * DOM screens are not wired into the boot sequence yet (`app/bootstrap` belongs
 * to another agent and the level scene is in flight), so scanning them through
 * the production artefact would mean either editing that agent's file or
 * scanning nothing at all. The `fixme` scans this replaces did the latter.
 *
 * The dev server is the same Vite, the same aliases and the same TypeScript, so
 * what axe sees is the real component. What it does *not* prove is that the
 * screens survive a production build; that becomes true, and this server goes
 * away, when task 1.20 wires them into `app/bootstrap`.
 *
 * **Half of that is now done, and this note says which half.** `app/ui/shell.ts`
 * exists: one entry point that mounts the title screen, the creator and the
 * level select, and `tests/a11y/shell.spec.ts` scans the whole page it builds
 * with `region` and `landmark-one-main` enabled and nothing disabled. What is
 * still missing is the *call*: `app/bootstrap/main.ts` does not construct the
 * shell yet, so `dist/` is still the foundation shell and the `vite preview`
 * server below still serves a page with no screens on it. `OQ-TEST-2`'s
 * whole-page scan against `dist/` is written out at the bottom of
 * `shell.spec.ts` and is `test.fixme` for exactly that reason: when the
 * composition root calls `createShell`, deleting `.fixme` is the whole change,
 * and until then no report may describe this suite as proving the shipped page.
 */
const HARNESS_PORT = 4176;
const BASE_PATH = '/OhCanada/';
export const HARNESS_URL = `http://127.0.0.1:${HARNESS_PORT}${BASE_PATH}tests/a11y/harness.html`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Stop after five failures on CI. This is the only setting here that bounds
  // the WORST case rather than the average: a systemic breakage - the app not
  // booting at all - fails every test in the suite and produces a full artefact
  // set for each one, which is what a 524 MB report actually was. The sixth
  // failure of a suite that is uniformly broken teaches nobody anything the
  // first did not. Trade: a run that stops early reports an INCOMPLETE failure
  // list, so "5 failed" may not mean "only 5 are broken". Read the report as a
  // sample, not a census, and re-run locally once the first cause is fixed.
  // Local runs are uncapped - there is no artefact to download and no reason to
  // hide failures from the person who can act on them immediately. Spread rather
  // than `maxFailures: process.env.CI ? 5 : undefined`, because tsconfig.json
  // sets `exactOptionalPropertyTypes` and an explicit `undefined` is not the
  // same as an omitted key under that rule. Same shape as `workers` below.
  ...(process.env.CI ? { maxFailures: 5 } : {}),
  ...(process.env.CI ? { workers: 1 } : {}),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: fileURLToPath(new URL('../../test-results/a11y', import.meta.url)),
  reporter: [
    ['list'],
    [
      'html',
      {
        open: 'never',
        outputFolder: fileURLToPath(
          new URL('../../playwright-report/a11y', import.meta.url),
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
    // ARTEFACT WEIGHT — see docs/runbook.md 3, "bound the cost of a failing run".
    // Locally these stay as they were: disk is free and a first failure should be
    // fully debuggable without re-running it. On CI they are bounded, because a
    // broadly failing run used to produce a half-gigabyte report that someone then
    // has to download to read. `on-first-retry` pairs with the `retries: 1` above,
    // so anything that fails on CI is still traced - on its retry, not its first
    // attempt. Video is off on CI: a trace already carries a screencast timeline
    // and DOM snapshots, so it is the one artefact that is nearly all duplicate.
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'off' : 'retain-on-failure',
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

  webServer: [
    {
      command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
      cwd: REPO_ROOT,
      url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${HARNESS_PORT} --strictPort --host 127.0.0.1`,
      cwd: REPO_ROOT,
      url: HARNESS_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
