/*
 * TRUENORTH SERVICE WORKER - the source of dist/sw.js. ADR-0034 is the decision;
 * read it before changing what any route below answers.
 *
 * NOT SERVED AS WRITTEN. scripts/lib/pwa.mjs bundles this file with Vite at the
 * end of `vite build`, as one classic script (a module worker is not available
 * in every browser this game targets), and writes two build-time values where
 * the placeholders stand:
 *
 *   self.__WB_MANIFEST    the precache: index.html, manifest.json, the web app
 *                         manifest, the icons and EVERY code chunk under
 *                         assets/, from workbox-build's getManifest over dist/;
 *   self.__TN_LEVEL_ART   every file dist/manifest.json names, with the levels
 *                         that draw it.
 *
 * scripts/deploy-check.mjs reads both back out of the built worker and checks
 * them against dist/ before anything ships.
 *
 * FOUR KINDS OF REQUEST, AND NOTHING ELSE IS ANSWERED
 *
 *   1. A navigation inside the scope: the network, always first. Only when the
 *      network THROWS - offline, not a 404 - the precached index.html. There is
 *      no timeout, deliberately. The archived 3D build's worker fell back to a
 *      cached shell after 4 s, and that shell pointed at bundles that no longer
 *      existed (docs/runbook.md 3b). A slow load is better than a stale one.
 *   2. manifest.json: the same rule. It is not content-hashed and it names every
 *      content-hashed art file, so a stale copy is a stale build.
 *   3. Anything in the precache: from the precache. Every entry is either
 *      content-hashed (the code, the icons) or carries a revision (index.html,
 *      the two manifests), so "cache first" cannot serve something out of date
 *      for the build this worker belongs to.
 *   4. Level art: from truenorth-level-<id>, else the network. The first file a
 *      level fetches starts caching the REST of that level in the background -
 *      both scales, so a device whose pixel ratio changes while offline still
 *      has what it asks for. That is "Workbox per level" (ADR-0006). And once
 *      this worker controls a page, the page asks it to cache every other level
 *      too, in the background, so a level never played online still opens
 *      offline (ADR-0034, amended 2026-09-15; see the message listener).
 *
 * Everything else - every cross-origin request, and any same-origin URL that is
 * none of the above - matches no route, so the browser fetches it exactly as it
 * would with no worker at all. Nothing cross-origin is ever cached.
 *
 * WHAT IT NEVER TOUCHES: IndexedDB and localStorage, where saves live
 * (ADR-0026). Its clean-up deletes Cache Storage entries only, and only caches
 * this project owns.
 */

import { cacheNames, clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

/** The registration scope, `/OhCanada/` on Pages. Every route is confined to it. */
const SCOPE = new URL(self.registration.scope);
const SCOPE_PATH = SCOPE.pathname;

/**
 * The one message a page sends: the resource URLs it fetched before this worker
 * controlled it. Same string as `WARM_MESSAGE` in scripts/lib/pwa.mjs, which
 * writes the sender; deploy-check fails if the two stop agreeing.
 */
const WARM_MESSAGE = 'truenorth:warm';

/**
 * The field of that message that asks for every level's art, not only the
 * page's (ADR-0034, amended 2026-09-15). Same string as `WARM_EVERY_LEVEL` in
 * scripts/lib/pwa.mjs; deploy-check fails if the two stop agreeing.
 */
const WARM_EVERY_LEVEL = 'everyLevel';

/**
 * `truenorth-` is the prefix the archived 3D build used for its runtime caches
 * too (`truenorth-shell`, `truenorth-assets`, `truenorth-models`). Sharing it is
 * what lets the clean-up at `activate` remove those: any `truenorth-` cache this
 * build does not name is by definition not this build's.
 */
const LEVEL_CACHE_PREFIX = 'truenorth-level-';
/** Art more than one level draws (the shared character atlas). No level id may be `shared`: scripts/assets.mjs reserves it. */
const SHARED_ART_CACHE = `${LEVEL_CACHE_PREFIX}shared`;

/** Scope-relative path -> the levels that draw it. Written in at build time. */
const LEVEL_ART = self.__TN_LEVEL_ART;

const artLevelsByPath = new Map();
const artCacheByPath = new Map();
const artPathsByLevel = new Map();
for (const [path, levels] of Object.entries(LEVEL_ART)) {
  artLevelsByPath.set(path, levels);
  artCacheByPath.set(path, levels.length === 1 ? `${LEVEL_CACHE_PREFIX}${levels[0]}` : SHARED_ART_CACHE);
  for (const level of levels) {
    if (!artPathsByLevel.has(level)) artPathsByLevel.set(level, []);
    artPathsByLevel.get(level).push(path);
  }
}
const ART_CACHES = new Set(artCacheByPath.values());

/** The scope-relative path of a same-origin URL inside the scope, or null for anything else. */
function scopedPath(url) {
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return null;
  return url.pathname.slice(SCOPE_PATH.length);
}

/** One cache key per art file, whatever query string a loader added. */
const artKey = (path) => new URL(path, SCOPE).href;

/* ------------------------------------------------------------- lifecycle --- */

/*
 * A new build takes over as soon as it has installed, and claims the pages that
 * are open. Waiting for every tab to close is how a player gets stuck on old
 * code, and nothing in this worker needs the wait: the precache is keyed by
 * content hash and revision, so the new build's entries never collide with the
 * files an old page already has in memory. What an old page can still hit is a
 * lazy chunk the new deploy deleted, which is a 404 with or without a worker;
 * the app's update notice (ADR-0034, "Update flow") is what asks it to reload.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});
clientsClaim();
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
  event.waitUntil(removeWhatThisBuildDoesNotOwn());
});

/**
 * Delete every cache this project owns that this build does not name, then
 * every entry in a level cache that is not one of this build's files. The level
 * caches therefore never hold more than the art the current build ships.
 *
 * "Owns" is the tombstone's rule (infra/pages/sw.js): a `truenorth-` prefix, or
 * the registration scope in the name, which is how Workbox names a precache.
 * kinncj.github.io is one origin shared by every project on the account, so
 * `caches.keys()` returns other repositories' caches as well; those are never
 * touched.
 */
async function removeWhatThisBuildDoesNotOwn() {
  const names = await caches.keys();
  const ours = (name) => name.startsWith('truenorth-') || name.includes(self.registration.scope);
  await Promise.all(
    names
      .filter((name) => ours(name) && name !== cacheNames.precache && !ART_CACHES.has(name))
      .map((name) => caches.delete(name)),
  );
  for (const name of ART_CACHES) {
    if (!names.includes(name)) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (artCacheByPath.get(scopedPath(new URL(request.url))) !== name) await cache.delete(request);
    }
  }
}

/* ---------------------------------------------------------------- routes --- */

/** The network; only when it throws, this build's precached copy of `fallback`. */
async function networkThenPrecache(request, fallback) {
  try {
    return await fetch(request);
  } catch (error) {
    const copy = await matchPrecache(fallback);
    if (copy !== undefined) return copy;
    throw error;
  }
}

/* Registered BEFORE the precache, because the router answers with the first
   route that matches and the precache would otherwise answer `/OhCanada/` from
   its copy of index.html. That is the stale shell this worker exists not to be. */
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && scopedPath(url) !== null,
  ({ request }) => networkThenPrecache(request, 'index.html'),
);

registerRoute(
  ({ url }) => scopedPath(url) === 'manifest.json',
  ({ request }) => networkThenPrecache(request, 'manifest.json'),
);

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => artCacheByPath.has(scopedPath(url)),
  async ({ request, url, event }) => {
    const path = scopedPath(url);
    const owners = artLevelsByPath.get(path);
    /* Before the first await: `waitUntil` is only accepted while the fetch
       event is still being dispatched. A shared file starts nothing - it would
       otherwise cache all ten levels the first time any one of them loads. */
    if (event !== undefined && owners.length === 1) event.waitUntil(warmLevel(owners[0]));

    const key = artKey(path);
    const cache = await caches.open(artCacheByPath.get(path));
    const cached = await cache.match(key);
    if (cached !== undefined) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(key, response.clone());
    return response;
  },
);

/* ---------------------------------------------------- caching a level whole --- */

/** Levels whose every file is in Cache Storage, as far as this worker's lifetime has seen. */
const warmed = new Set();
/** One fill per level at a time. */
const warming = new Map();

function warmLevel(level) {
  if (warmed.has(level)) return Promise.resolve();
  let pending = warming.get(level);
  if (pending === undefined) {
    pending = fillLevel(level)
      .then((complete) => {
        if (complete) warmed.add(level);
      })
      .finally(() => warming.delete(level));
    warming.set(level, pending);
  }
  return pending;
}

/**
 * Cache every file `level` draws that is not cached yet, one at a time so the
 * level's own load is not competing with a burst. Resolves `true` when nothing
 * is missing. A file that cannot be fetched now (offline, or gone in a newer
 * deploy) is left for the next time the level is played.
 */
async function fillLevel(level) {
  let complete = true;
  for (const path of artPathsByLevel.get(level) ?? []) {
    const key = artKey(path);
    const cache = await caches.open(artCacheByPath.get(path));
    if ((await cache.match(key)) !== undefined) continue;
    try {
      const response = await fetch(key, { credentials: 'same-origin' });
      if (response.ok) await cache.put(key, response);
      else complete = false;
    } catch {
      complete = false;
    }
  }
  return complete;
}

/*
 * Two gaps, one message.
 *
 * The first visit's gap. A page that loaded before this worker took control
 * fetched its art past the worker, so nothing above saw it. The registration
 * script sends the page's resource URLs the moment control arrives, and every
 * level they belong to is cached whole, first.
 *
 * The first-offline gap (ADR-0034, amended 2026-09-15). A level never played
 * online had no art cached, so opening it offline drew flat bands. So the same
 * message - sent on the first control and on every later load of a controlled
 * page - carries `everyLevel`, and when it is true every level this build ships
 * is cached after the page's own, one level and one file at a time so a level
 * being played is never competing with a burst. It is all the level art there
 * is, both scales, and deploy-check holds it and the precache together under the
 * initial payload ceiling. The page sends `false` when the browser asks to save
 * data, and then a level is cached only when it is played, as before.
 *
 * URLs outside the scope, and files this build does not ship, are ignored -
 * which is also why a message from any other page on the shared origin can do
 * nothing but cache TrueNorth's own art.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === null || typeof data !== 'object' || data.type !== WARM_MESSAGE || !Array.isArray(data.urls)) {
    return;
  }
  const levels = new Set();
  for (const raw of data.urls) {
    if (typeof raw !== 'string') continue;
    let url;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    const owners = artLevelsByPath.get(scopedPath(url));
    if (owners !== undefined && owners.length === 1) levels.add(owners[0]);
  }
  event.waitUntil(warmInTurn([...levels], data[WARM_EVERY_LEVEL] === true));
});

/** The page's own levels, then - when asked - every level this build ships, one at a time. */
async function warmInTurn(first, everyLevel) {
  for (const level of first) await warmLevel(level);
  if (!everyLevel) return;
  for (const level of artPathsByLevel.keys()) await warmLevel(level);
}
