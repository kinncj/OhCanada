import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/**
 * The CI performance lane: budgets a GPU-less runner can measure exactly -
 * overdraw and texture memory counted at the WebGL API (`gl-census.ts`, proved
 * by `calibration.spec.ts`), the payload a browser transfers, and a time-to-playable
 * tripwire. Frame time is NOT here: it is the device lane,
 * `playwright.device.config.ts`, which extends this file and runs `*.device.ts`
 * on real hardware only (tests/perf/README.md).
 *
 * Serves the production build with `vite preview` on port 4174 so the suite
 * exercises the same artefact GitHub Pages serves, base path included.
 * The viewport is a portrait phone (390x844 CSS px): TrueNorth is portrait-only
 * (ADR-0002) and no suite may ever assert a landscape layout.
 */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = 4174;
/**
 * The character-cost harness (`tests/perf/character-harness.ts`) is served by a
 * *dev* server, not by `vite preview`, for the reason `tests/a11y`'s harness is:
 * `dist/` contains exactly what `vite.config.ts` declares as a build input, and
 * that is one page. Characters are not placed in a level yet — task 1.13 does
 * that when the atlas lands — so measuring them through the production artefact
 * would mean measuring a page with no characters on it.
 *
 * It is the same Vite, the same aliases and the same TypeScript, so what is
 * measured is the real adapter compiled the real way. What it does not prove is
 * that the numbers survive a production build's minification; that becomes true,
 * and this server goes away, when a level draws characters.
 */
const HARNESS_PORT = 4177;
const BASE_PATH = '/OhCanada/';
export const CHARACTER_HARNESS_URL =
  `http://127.0.0.1:${HARNESS_PORT}${BASE_PATH}tests/perf/character-harness.html`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // NO RETRIES, on CI included, and it is not stinginess. Everything this lane
  // asserts is a count - covered pixels, uploaded bytes, bytes transferred - that
  // is identical from one run of a build to the next (overdraw read the same to
  // 1e-6 across 74 frames). A count that differs on retry is not flake to be
  // absorbed; it is the census losing track of state, and a retry that passed
  // would hide it. One attempt also means the reporter has exactly one verdict
  // per budget to print.
  retries: 0,
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
  // ONE WORKER, ALWAYS. The counts would survive parallel browsers; two things
  // here would not. The time-to-playable tripwire is wall clock, and the overdraw
  // test waits for the visual tier to hold still - three other Chromium
  // instances on the same CPU would demote it mid-sample for reasons that have
  // nothing to do with the build. The device lane inherits this, where frame
  // time makes it non-negotiable.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: fileURLToPath(new URL('../../test-results/perf', import.meta.url)),
  reporter: [
    ['list'],
    // Held, breached, NOT MEASURED, and NOT CHECKED HERE - four sections, on
    // every run. Playwright alone can only say pass or fail (ADR-0024).
    ['./perf-reporter.ts'],
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
    // NO SERVICE WORKER, ON PURPOSE (slice F3, ADR-0034). The initial-payload and
    // time-to-playable budgets are about a FIRST load on a cold cache. A
    // registered worker precaches the shell in the background after `load` -
    // bytes nobody waits for, which `page.on('response')` does not attribute to
    // the page anyway - and answers later navigations from Cache Storage, which
    // would make a second `goto` in a test cheaper than any first visit. `block`
    // keeps every number in this lane a measurement of that first load, exactly
    // as it was before the worker existed. What the worker adds on install is
    // weighed on disk by scripts/deploy-check.mjs against the same 8 MiB. The
    // device lane inherits this through `base.use`.
    serviceWorkers: 'block',
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
      url: CHARACTER_HARNESS_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
