import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** Smoke suite runs against the production build served by `vite preview` (base path /OhCanada/). */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173/OhCanada/',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: 'http://localhost:4173/OhCanada/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
