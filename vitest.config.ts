import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@domain': fileURLToPath(new URL('./app/domain', import.meta.url)),
      '@application': fileURLToPath(new URL('./app/application', import.meta.url)),
      '@adapters': fileURLToPath(new URL('./app/adapters', import.meta.url)),
      '@ui': fileURLToPath(new URL('./app/ui', import.meta.url)),
      '@common': fileURLToPath(new URL('./common', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['app/domain/**/*.ts', 'app/application/**/*.ts', 'common/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      reporter: ['text-summary', 'lcov'],
    },
  },
});
