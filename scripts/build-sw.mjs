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
  // index.html is deliberately NOT precached: navigations are network-first so a stale app shell can never point at
  // hashed assets that a newer deploy removed (the classic 'site does not load after a deploy' failure on phones).
  globPatterns: ['assets/*.{js,css}', 'audio/*.wav', 'sky/*.hdr', 'basis/*', 'draco/*'],
  globIgnores: ['404.html', 'index.html'],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  modifyURLPrefix: { '': config.basePath },
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  sourcemap: false,
  runtimeCaching: [
    { urlPattern: ({ request }) => request.mode === 'navigate', handler: 'NetworkFirst', options: { cacheName: 'truenorth-shell', networkTimeoutSeconds: 4 } },
    { urlPattern: /\/manifest\.json$/, handler: 'NetworkFirst', options: { cacheName: 'truenorth-shell' } },
    { urlPattern: /\/(textures|models)\/.*\.(ktx2|glb)$/, handler: 'CacheFirst', options: { cacheName: 'truenorth-assets', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
    { urlPattern: /\/models\/.*\.(glb|ktx2)$/, handler: 'CacheFirst', options: { cacheName: 'truenorth-models', expiration: { maxEntries: 120 } } },
  ],
});
for (const w of warnings) console.warn(w);
console.log(`sw.js: precaching ${count} files, ${(size / 1048576).toFixed(2)} MB`);
