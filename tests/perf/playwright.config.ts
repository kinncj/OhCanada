import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: process.env.CI ? 900_000 : 600_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173/OhCanada/',
    viewport: process.env.CI ? { width: 1280, height: 720 } : { width: 1920, height: 1080 },
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
