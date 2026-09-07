#!/usr/bin/env node
/** Generates dist/sw.js with Workbox (offline play after first load) and dist/404.html for GitHub Pages. */
import { generateSW } from 'workbox-build';
import { copyFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const config = JSON.parse(readFileSync(join(root, 'content', 'game.config.json'), 'utf8'));
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html missing — run vite build first');

copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));

const { count, size, warnings } = await generateSW({
  swDest: join(dist, 'sw.js'),
  globDirectory: dist,
  globPatterns: ['index.html', 'assets/*.{js,css}', 'audio/*.wav', 'sky/*.hdr', 'manifest.json', 'basis/*', 'draco/*', 'textures/**/*', 'models/characters/*.glb'],
  globIgnores: ['404.html'],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  modifyURLPrefix: { '': config.basePath },
  navigateFallback: `${config.basePath}index.html`,
  navigateFallbackDenylist: [/\/sw\.js$/],
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  sourcemap: false,
  runtimeCaching: [
    { urlPattern: /\/models\/.*\.(glb|ktx2)$/, handler: 'CacheFirst', options: { cacheName: 'truenorth-models', expiration: { maxEntries: 120 } } },
  ],
});
for (const w of warnings) console.warn(w);
console.log(`sw.js: precaching ${count} files, ${(size / 1048576).toFixed(2)} MB`);
