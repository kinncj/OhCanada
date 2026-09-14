import { defineConfig } from '@playwright/test';

import base from './playwright.config';

/**
 * The DEVICE lane: frame time and per-character cost, measured where they mean
 * something, which is not a CI runner.
 *
 * `make test-perf-device` runs this, by hand, on a machine with a real GPU -
 * the protocol and the record format are in tests/perf/README.md. It is not in
 * any workflow and must not be: a GitHub runner has no GPU, rasterises on
 * SwiftShader, and a millisecond measured there is the cost of a CPU pretending
 * to be a GPU. This lane asserted exactly that for a slice and a half, failed or
 * reported on every run, and never once described the build.
 *
 * Differences from the CI lane, each deliberate:
 *
 *   - `*.device.ts`, not `*.spec.ts`, so neither lane can pick up the other's
 *     tests by accident;
 *   - NO SwiftShader flags. The CI config forces ANGLE onto SwiftShader so that
 *     a runner renders at all; here that would guarantee the measurement is of
 *     the wrong thing. The device tests detect a software rasteriser and settle
 *     NOT MEASURED on one, so running this lane on the wrong host is a loud,
 *     named non-result rather than a number;
 *   - headed by default, because a headless browser on some platforms falls
 *     back to software rendering even when a GPU is present.
 */
const baseUse = base.use ?? {};

export default defineConfig({
  ...base,
  testMatch: '**/*.device.ts',
  retries: 0,
  ...(base.outputDir === undefined ? {} : { outputDir: base.outputDir.replace(/perf$/, 'perf-device') }),
  reporter: [['list'], ['./perf-reporter.ts']],
  use: { ...baseUse, headless: process.env.TN_PERF_DEVICE_HEADLESS === '1' },
  projects: [
    {
      name: 'device-portrait',
      use: {
        ...baseUse,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        headless: process.env.TN_PERF_DEVICE_HEADLESS === '1',
      },
    },
  ],
});
