import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const gameConfig = JSON.parse(readFileSync(new URL('./content/game.config.json', import.meta.url), 'utf8')) as {
  basePath: string;
  version: string;
};

export default defineConfig({
  base: gameConfig.basePath,
  define: {
    __APP_VERSION__: JSON.stringify(gameConfig.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
  publicDir: 'assets/dist',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('rapier3d-compat')) return 'rapier';
          if (id.includes('node_modules/yuka')) return 'yuka';
          if (id.includes('node_modules/ajv')) return 'ajv';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
