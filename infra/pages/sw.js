/*
 * TOMBSTONE SERVICE WORKER — it exists only to delete itself.
 *
 * DO NOT REGISTER THIS FILE. Nothing in app/ references it and nothing should.
 *
 * IT IS NOW ALSO THE KILL SWITCH FOR THE F3 WORKER (ADR-0034). `<base>sw.js` is
 * the Workbox worker built from infra/pages/service-worker.js while
 * `featureFlags.serviceWorker` in content/game.config.json is on, and THIS file
 * while it is off - with no registration in the page. Turning the flag off
 * therefore reaches every device holding the worker on its next update check,
 * and the clean-up below already covers every cache that worker creates: its
 * level caches are `truenorth-level-*` and its precache name contains the
 * registration scope. Change that filter and the kill switch stops working.
 *
 * WHY IT IS HERE
 * The archived 3D build (archive/v0.1) shipped a real Workbox worker at
 * /OhCanada/sw.js — deploy run 34222875457 logged "precaching 97 files,
 * 14.71 MB" and ./sw.js is in that run's uploaded artifact. Slice 0 does not
 * emit one, so the URL started returning 404. Per the Service Worker spec, when
 * an update check cannot fetch the script the existing registration is RETAINED,
 * not discarded. Every browser that loaded the old site before the eviction
 * build went live therefore holds a registration that can never self-heal:
 * slice 0 ships no eviction code, and a 404 will not remove it.
 *
 * That old worker is NetworkFirst for navigations with a 4 second timeout, so
 * it is not fatal — on a healthy connection the live page loads. But past 4
 * seconds it falls back to its cached shell, which points at hashed bundles
 * that no longer exist, and the user gets the old 3D loader stuck at 0%. It
 * also holds ~15 MB of dead storage indefinitely.
 *
 * Serving a real script here makes the update check succeed. This worker then
 * replaces the old one, clears its caches, unregisters itself and reloads the
 * open pages. One visit and the device is clean, with nothing for the user to
 * do. There is deliberately NO fetch handler: this worker must never serve a
 * byte from cache. While the flag is off, scripts/deploy-check.mjs fails the
 * build if one appears, if this file goes missing from dist/, or if anything
 * still registers a worker — it looks unused, and it is not.
 *
 * Kept small and dependency-free on purpose: the people who need it are, by
 * definition, the ones whose connection was too slow to beat a 4 second
 * timeout.
 */

self.addEventListener('install', () => {
  // Do not wait for the old worker's clients to close; we are here to evict it.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Take control of already-open pages so client.navigate() below is allowed.
      try {
        await self.clients.claim();
      } catch {
        /* keep going: the cache purge matters more than the reload */
      }

      /*
       * Delete only OUR caches. github.io is a single origin shared by every
       * project on the account, so caches.keys() also returns caches belonging
       * to other repositories published under kinncj.github.io. Wiping those
       * would be a side effect we have no business causing.
       *
       * The old build's runtime caches were named explicitly, so Workbox used
       * those names verbatim; its precache name embeds the registration scope.
       */
      const scope = self.registration.scope;
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith('truenorth-') || name.includes(scope))
            .map((name) => caches.delete(name)),
        );
      } catch {
        /* ignore */
      }

      try {
        await self.registration.unregister();
      } catch {
        /* ignore */
      }

      // Reload open pages so the user lands on the live site without acting.
      // Runs once per registration, so it cannot loop.
      try {
        const windows = await self.clients.matchAll({ type: 'window' });
        for (const client of windows) {
          try {
            await client.navigate(client.url);
          } catch {
            /* their next reload gets the live site anyway: the caches are gone */
          }
        }
      } catch {
        /* ignore */
      }
    })(),
  );
});
