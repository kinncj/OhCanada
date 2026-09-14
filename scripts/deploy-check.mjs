#!/usr/bin/env node
/**
 * deploy-check — the last gate before an artefact is uploaded to Pages.
 *
 * Fails when:
 *   1. dist/ is missing, empty, or missing a required file;
 *   2. any built file exceeds the GitHub Pages 100 MB per-file cap (ADR-0006);
 *   3. the initial payload exceeds `budgets.initialPayloadBytes`, or the whole
 *      deployable artefact exceeds `budgets.totalPayloadBytes` (CLAUDE.md,
 *      "Budgets (CI fails on breach)") — see INITIAL PAYLOAD below;
 *   4. `basePath` in content/game.config.json does not match the repository
 *      the site is published from (a wrong base ships a blank page);
 *   5. dist/sw.js is not the file `featureFlags.serviceWorker` selects, or is
 *      that file and is wrong — see SERVICE WORKER below and ADR-0034. Off, it
 *      is the tombstone (infra/pages/sw.js), which must unregister itself, must
 *      never gain a fetch handler, and nothing may register. On, it is the
 *      Workbox worker, whose precache must be exactly this build's shell and
 *      code and fit the initial payload budget, and whose level art must be
 *      exactly the files dist/manifest.json names. In both modes nothing the
 *      page statically loads may reference it;
 *   6. a level in dist/manifest.json exceeds `budgets.levelPayloadBytes`, or the
 *      manifest and the files in dist/ have stopped agreeing. `make assets` is
 *      where that gate is authoritative; this is the same rules applied to the
 *      artefact that actually ships;
 *   7. a level in dist/manifest.json exceeds its decoded-texture budget, or a
 *      full-screen parallax layer ships above 1x (scripts/lib/texture-memory.mjs).
 *      Same reasoning as 6, different quantity: 6 is what a player downloads,
 *      7 is what the GPU holds, and 7 is the one that ends in a lost context;
 *   8. the web app manifest is missing, is not linked from dist/index.html, or
 *      disagrees with the config — name, `id`, `start_url` and `scope` at
 *      `basePath`, portrait, the theme colour — or its icons are not a 192 and a
 *      512 PNG (one of them maskable) whose pixels are the size they claim.
 *      Those are the parts of Chromium's install criteria a file can hold.
 *
 * It used to also check that .github/workflows/ matched a mirror of it under
 * infra/github/workflows/. That mirror is gone — see infra/README.md. GitHub
 * only ever executes .github/workflows/, so the second copy was inert, and this
 * check existed solely to police a duplicate that did nothing. Deleting the
 * duplicate deletes the reason for the check.
 *
 * The payload budget lives here rather than in a Playwright test because it is a
 * property of the artefact, not of a page load: it must hold before anything is
 * uploaded, it must not depend on a browser or a network, and it must be
 * impossible to satisfy by measuring nothing. `tests/perf/budgets.spec.ts`
 * measures what a real browser actually transfers, which is a different (and
 * weaker, because it is racy) question.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MANIFEST_NAME, checkLevelPayload } from './lib/level-payload.mjs';
import {
  CONTENT_HASHED,
  ICON_DIR,
  LEVEL_ART_SENTINEL,
  PRECACHE_SENTINEL,
  SERVICE_WORKER_FILE,
  WARM_MESSAGE,
  WEB_MANIFEST_FILE,
  WORKER_BANNER,
  readInjected,
  registrationScript,
  serviceWorkerEnabled,
} from './lib/pwa.mjs';
import { checkTextureMemory } from './lib/texture-memory.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT, 'dist');
const CONFIG_FILE = join(ROOT, 'content', 'game.config.json');
const SW_FILE = join(DIST_DIR, SERVICE_WORKER_FILE);
const WEB_MANIFEST = join(DIST_DIR, WEB_MANIFEST_FILE);

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const REQUIRED_DIST_FILES = ['index.html', SERVICE_WORKER_FILE, WEB_MANIFEST_FILE];

const failures = [];
const fail = (message) => failures.push(message);

let payloadSummary = 'initial payload not measured';
let workerSummary = 'service worker not checked';
let manifestSummary = 'web app manifest not checked';

const rel = (absolute) => relative(ROOT, absolute).split(sep).join('/');
const distRel = (absolute) => relative(DIST_DIR, absolute).split(sep).join('/');

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

// ---------------------------------------------------------------- config ---

/** Read once: the base path check, the payload budgets and the worker mode all need it. */
let config = null;
if (!existsSync(CONFIG_FILE)) {
  fail('content/game.config.json is missing; base path and budgets cannot be checked.');
} else {
  try {
    config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    fail(`content/game.config.json is not valid JSON (${error.message}).`);
  }
}

// ------------------------------------------------------------------ dist ---

let distFiles = [];

if (!existsSync(DIST_DIR)) {
  fail('dist/ does not exist. Run `make build` before deploy-check.');
} else {
  distFiles = walk(DIST_DIR);
  if (distFiles.length === 0) fail('dist/ is empty; there is nothing to deploy.');

  for (const required of REQUIRED_DIST_FILES) {
    if (!existsSync(join(DIST_DIR, required))) fail(`dist/${required} is missing.`);
  }

  for (const file of distFiles) {
    const { size } = statSync(file);
    if (size > MAX_FILE_BYTES) {
      fail(`${rel(file)} is ${mib(size)}; GitHub Pages rejects files over 100 MiB.`);
    }
  }
}

// -------------------------------------------------- initial payload budget ---

/**
 * WHAT "INITIAL PAYLOAD" MEANS HERE
 *
 * The bytes a browser must download before the game can start, on a cold cache,
 * with no user interaction:
 *
 *   - `dist/index.html` itself (it carries inline CSS and the pre-boot script);
 *   - every same-origin resource the HTML statically references through
 *     `<script src>`, `<link rel="modulepreload">`, `<link rel="preload">` and
 *     `<link rel="stylesheet">`;
 *   - every chunk those chunks reach by *static* ES import, transitively.
 *
 * Deliberately NOT counted:
 *
 *   - `.map` files. A browser fetches them only when DevTools is open, so they
 *     cost a player nothing. They still count against the per-file 100 MB cap
 *     and the repository size, which are checked separately.
 *   - `import()` calls. Dynamic imports are the mechanism by which a level is
 *     loaded on demand; charging them to the initial payload would make the
 *     budget punish the very split it exists to encourage. Per-level weight is
 *     `budgets.levelPayloadBytes`, enforced by scripts/lib/level-payload.mjs
 *     over `assets/dist/manifest.json` and re-checked against `dist/` at the
 *     bottom of this file. Until 2026-09-08 this comment said "a different
 *     gate" and that gate did not exist, which made a budget nothing read look
 *     enforced; it exists now (slice 1, task 1.10).
 *   - Anything reached only at runtime (fetched JSON, atlases, audio). Those
 *     are level payload too.
 *   - Images or fonts referenced by `<link rel="icon">` and friends: not on the
 *     critical path to first frame. The web app manifest and its icons are in
 *     this group: a browser reads them to offer an install, not to start.
 *   - What the service worker precaches when it installs (ADR-0034). It
 *     registers on `load`, after the game has what it needs, and most of what it
 *     stores is the same bytes the page just fetched. It is weighed separately,
 *     against the same budget, under SERVICE WORKER below, because a precache
 *     that grew without limit would be a second initial payload nobody counted.
 *
 * The number is RAW bytes, not gzip. Pages serves gzip/brotli and the gzip
 * figure is printed for information, but the budget in CLAUDE.md is a payload
 * budget and raw bytes are what must be parsed, compiled and held in memory on
 * the phone this game targets. Raw is the conservative reading.
 *
 * A gate that measures nothing passes everything, so this section fails when
 * the reachable set turns out to be HTML alone: that means the extraction below
 * stopped understanding the build output, not that the app got smaller.
 */

/** Absolute path inside dist/ for a URL found in the HTML or in a chunk, or null. */
function resolveDistUrl(url, fromDir, basePath) {
  if (typeof url !== 'string' || url.length === 0) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return null; // external
  const clean = url.split('#')[0].split('?')[0];
  if (clean.length === 0) return null;

  let absolute;
  if (clean.startsWith('/')) {
    const withoutBase =
      basePath && basePath !== '/' && clean.startsWith(basePath)
        ? clean.slice(basePath.length)
        : clean.replace(/^\//, '');
    absolute = join(DIST_DIR, withoutBase);
  } else {
    absolute = resolve(fromDir, clean);
  }

  const inside = relative(DIST_DIR, absolute);
  if (inside.startsWith('..') || inside.startsWith(sep + '..')) return null;
  return existsSync(absolute) && statSync(absolute).isFile() ? absolute : null;
}

/** `<script src>` / `<link href>` for the rels that block or preload the boot. */
function entryUrlsFromHtml(html) {
  const urls = [];
  const attr = (tag, name) => {
    const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
    return match ? (match[2] ?? match[3] ?? match[4]) : null;
  };

  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'src');
    if (src) urls.push(src);
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const as = (attr(tag, 'as') ?? '').toLowerCase();
    const blocking =
      rel === 'stylesheet' ||
      rel === 'modulepreload' ||
      (rel === 'preload' && (as === 'script' || as === 'style' || as === ''));
    if (!blocking) continue;
    const href = attr(tag, 'href');
    if (href) urls.push(href);
  }

  return urls;
}

/**
 * Static import specifiers in a Rollup ES chunk: `import"./a.js"`,
 * `import{x}from"./a.js"`, `export*from"./a.js"`. `import("./a.js")` does not
 * match - the quote never directly follows `import` - which is what makes this
 * "statically reachable" and not "everything".
 */
function staticImportsOf(source) {
  const specifiers = [];
  for (const pattern of [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

const INDEX_HTML = join(DIST_DIR, 'index.html');

if (distFiles.length > 0 && existsSync(INDEX_HTML) && config !== null) {
  const basePath = typeof config.basePath === 'string' ? config.basePath : '/';
  const budgets = config.budgets ?? {};

  const reachable = new Set([INDEX_HTML]);
  const queue = [];

  const html = readFileSync(INDEX_HTML, 'utf8');
  for (const url of entryUrlsFromHtml(html)) {
    const file = resolveDistUrl(url, dirname(INDEX_HTML), basePath);
    if (file && !file.endsWith('.map') && !reachable.has(file)) {
      reachable.add(file);
      if (file.endsWith('.js') || file.endsWith('.mjs')) queue.push(file);
    }
  }

  const entryCount = reachable.size - 1;

  while (queue.length > 0) {
    const chunk = queue.pop();
    for (const specifier of staticImportsOf(readFileSync(chunk, 'utf8'))) {
      const file = resolveDistUrl(specifier, dirname(chunk), basePath);
      if (!file || file.endsWith('.map') || reachable.has(file)) continue;
      reachable.add(file);
      if (file.endsWith('.js') || file.endsWith('.mjs')) queue.push(file);
    }
  }

  // Either sw.js - the worker or the tombstone - is reached by a browser's
  // registration and update check, never by the page's own loading, so it must
  // not be charged to the budget for bytes the page needs before it can start.
  // If it ever turns up here, something imported it.
  if (reachable.has(SW_FILE)) {
    fail(
      'dist/sw.js is in the initial payload: something in dist/index.html or a chunk ' +
        'statically references it. Nothing may import the service worker - it is registered ' +
        'by URL, see ADR-0034 and infra/pages/sw.js.',
    );
  }

  const initialFiles = [...reachable].sort();
  const initialBytes = initialFiles.reduce((sum, file) => sum + statSync(file).size, 0);
  const initialGzipBytes = initialFiles.reduce(
    (sum, file) => sum + gzipSync(readFileSync(file)).length,
    0,
  );

  if (entryCount === 0) {
    fail(
      'the initial payload resolved to index.html alone: no script, stylesheet or ' +
        'modulepreload in dist/index.html pointed at a file in dist/. Either the build ' +
        'emitted nothing, or entryUrlsFromHtml() no longer understands the output - ' +
        'do not read this as "the payload is small".',
    );
  }

  const initialBudget = budgets.initialPayloadBytes;
  if (typeof initialBudget !== 'number' || !Number.isFinite(initialBudget) || initialBudget <= 0) {
    fail(
      'content/game.config.json has no positive numeric "budgets.initialPayloadBytes"; ' +
        'the initial payload budget cannot be enforced.',
    );
  } else if (initialBytes > initialBudget) {
    fail(
      `initial payload is ${mib(initialBytes)} (${initialBytes} B) over ${initialFiles.length} ` +
        `file(s); the budget is ${mib(initialBudget)} (${initialBudget} B). ` +
        `Largest: ${initialFiles
          .map((f) => ({ f, size: statSync(f).size }))
          .sort((a, b) => b.size - a.size)
          .slice(0, 3)
          .map(({ f, size }) => `${rel(f)} ${kb(size)}`)
          .join(', ')}. Split it, lazy-load it, or change the budget in an ADR.`,
    );
  }

  // Total deployable weight, on the same "a player may fetch this" basis.
  const payloadFiles = distFiles.filter((file) => !file.endsWith('.map'));
  const totalBytes = payloadFiles.reduce((sum, file) => sum + statSync(file).size, 0);
  const totalBudget = budgets.totalPayloadBytes;
  if (typeof totalBudget === 'number' && Number.isFinite(totalBudget) && totalBudget > 0) {
    if (totalBytes > totalBudget) {
      fail(
        `dist/ carries ${mib(totalBytes)} of fetchable payload (source maps excluded); ` +
          `the budget is ${mib(totalBudget)}.`,
      );
    }
  }

  payloadSummary =
    `initial payload ${kb(initialBytes)} raw / ${kb(initialGzipBytes)} gzip ` +
    `across ${initialFiles.length} file(s) against ${mib(initialBudget ?? 0)}, ` +
    `${mib(totalBytes)} fetchable in dist/`;
} else if (distFiles.length > 0) {
  fail('dist/index.html is missing or the config is unreadable; the payload budget was not checked.');
}

// --------------------------------------------------------- service worker ---

/**
 * dist/sw.js IS ONE OF TWO FILES, AND THE CONFIG SAYS WHICH (ADR-0034).
 *
 * `featureFlags.serviceWorker` on: the Workbox worker scripts/lib/pwa.mjs
 * bundles from infra/pages/service-worker.js. Off: the tombstone,
 * infra/pages/sw.js. They share one URL because every live registration's
 * update check fetches exactly that URL - the archived 3D build's included -
 * so the flag is also the kill switch: turn it off, and the next update check
 * on every device replaces the worker with the file that deletes its caches and
 * unregisters it.
 *
 * Each mode is checked for the mistake that would make it the other one. A
 * tombstone that gains a `fetch` handler can pin a device to a stale shell,
 * which is the whole problem it was written to end. A worker that calls
 * `registration.unregister()` removes itself from every device on its next
 * visit. Either shipped under the wrong flag is a silent reversal of a decision.
 *
 * WHAT THE WORKER IS CHECKED FOR, AND WHY EACH ONE
 *
 *   - Its precache, read back out of the file, names only dist-relative files
 *     that exist, never a source map and never itself. An absolute or
 *     cross-origin URL would put something in Cache Storage this build does not
 *     control, and a missing file fails the install on every device.
 *   - It contains index.html, both manifests, and EVERY file under assets/ and
 *     icons/. A chunk left out is a screen that fails offline - the question
 *     bank for a subject nobody has opened, say - and nothing else would notice.
 *   - An entry with no revision must carry a content hash in its name, or a
 *     changed file would never reach a device that already has it.
 *   - The precache fits `budgets.initialPayloadBytes`. It is not the initial
 *     payload (see above), but it is what a first visit ends up downloading,
 *     and it gets the same ceiling rather than none.
 *   - Its level art is exactly the set dist/manifest.json names, with the same
 *     levels per file. A file missing there is art that is never cached for
 *     offline play; an extra one is a file that no longer ships.
 *   - dist/index.html carries the registration script pwa.mjs writes, word for
 *     word, and both it and the worker name the same warm-up message.
 */
if (config !== null && existsSync(SW_FILE)) {
  const worker = readFileSync(SW_FILE, 'utf8');
  const html = existsSync(INDEX_HTML) ? readFileSync(INDEX_HTML, 'utf8') : '';
  const basePath = typeof config.basePath === 'string' ? config.basePath : '/';
  const hasFetchHandler = /addEventListener\s*\(\s*['"`]fetch['"`]/.test(worker) || /\bonfetch\s*=/.test(worker);
  const unregisters = /registration\.unregister\s*\(/.test(worker);

  if (!serviceWorkerEnabled(config)) {
    if (hasFetchHandler) {
      fail(
        'dist/sw.js registers a fetch handler while featureFlags.serviceWorker is off. In that mode it ' +
          'must be the tombstone, which never serves a response - it exists only to unregister itself ' +
          'and clear its caches (infra/pages/sw.js).',
      );
    }
    if (!unregisters) {
      fail(
        'dist/sw.js never calls registration.unregister(); a tombstone worker that does not remove ' +
          'itself just replaces one permanent worker with another.',
      );
    }
    // The kill switch is only off if nothing registers a worker: not the page,
    // and not a chunk (app/bootstrap may come to own registration). Two shapes,
    // because a registration rarely spells `serviceWorker.register(` in full -
    // the script pwa.mjs writes holds the container in a variable - so a call
    // passing a `sw.js` URL counts as well. Measured: with only the first
    // pattern, a tombstone build still carrying that script passed this check.
    const registersAWorker = (text) =>
      /serviceWorker\s*\.\s*register\s*\(/.test(text) ||
      /\bregister\s*\(\s*["'`][^"'`]*\bsw\.js["'`]/.test(text) ||
      text.includes(registrationScript(basePath));
    const registering = [INDEX_HTML, ...distFiles.filter((f) => /\.m?js$/.test(f) && f !== SW_FILE)]
      .filter((file) => existsSync(file) && registersAWorker(readFileSync(file, 'utf8')))
      .map((file) => `dist/${distRel(file)}`);
    if (registering.length > 0) {
      fail(
        `featureFlags.serviceWorker is off, and ${registering.join(', ')} still register(s) a service worker. ` +
          'Off means the tombstone is served and nothing installs anything; a registration here would ' +
          'install the tombstone on devices that never had a worker.',
      );
    }
    workerSummary = 'service worker OFF: tombstone sw.js present and inert, nothing registers it';
  } else {
    if (!worker.startsWith(WORKER_BANNER)) {
      fail(
        'dist/sw.js does not start with the banner scripts/lib/pwa.mjs writes, although ' +
          'featureFlags.serviceWorker is on. It is not the worker that build produces.',
      );
    }
    if (unregisters) {
      fail(
        'dist/sw.js calls registration.unregister() although featureFlags.serviceWorker is on. That is ' +
          'the tombstone shipped by mistake, and it would remove the worker from every device on its next visit.',
      );
    }
    if (!hasFetchHandler) {
      fail('dist/sw.js registers no fetch handler, so it can serve nothing offline.');
    }
    for (const placeholder of ['__WB_MANIFEST', '__TN_LEVEL_ART']) {
      if (worker.includes(placeholder)) {
        fail(`dist/sw.js still contains ${placeholder}; the build did not write the value it stands for.`);
      }
    }
    if (!worker.includes(WARM_MESSAGE)) {
      fail(
        `dist/sw.js does not know the "${WARM_MESSAGE}" message the page sends it; infra/pages/service-worker.js ` +
          'and scripts/lib/pwa.mjs have stopped agreeing, and a first visit would cache no level whole.',
      );
    }
    if (!html.includes(registrationScript(basePath))) {
      fail(
        'dist/index.html does not carry the registration script scripts/lib/pwa.mjs writes, so no ' +
          `browser would register ${basePath}${SERVICE_WORKER_FILE}.`,
      );
    }

    // ---- the precache
    const precache = readInjected(worker, PRECACHE_SENTINEL);
    const budget = config.budgets?.initialPayloadBytes;
    let precacheFiles = 0;
    let precacheBytes = 0;
    if (precache.error !== undefined) {
      fail(`dist/sw.js: ${precache.error}; the worker's precache cannot be checked.`);
    } else if (!Array.isArray(precache.value) || precache.value.length === 0) {
      fail('dist/sw.js precaches nothing, so nothing about the game would work offline.');
    } else {
      const precached = new Set();
      for (const entry of precache.value) {
        const url = entry?.url;
        if (typeof url !== 'string' || url.length === 0) {
          fail(`dist/sw.js has a precache entry with no url: ${JSON.stringify(entry)}.`);
          continue;
        }
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.split('/').includes('..')) {
          fail(
            `dist/sw.js precaches "${url}", which is not a path inside dist/. The worker may cache only ` +
              'this build, and never anything cross-origin.',
          );
          continue;
        }
        if (url.endsWith('.map')) fail(`dist/sw.js precaches the source map ${url}; a player never needs one.`);
        if (url === SERVICE_WORKER_FILE) fail('dist/sw.js precaches itself.');
        const file = join(DIST_DIR, url);
        if (!existsSync(file) || !statSync(file).isFile()) {
          fail(`dist/sw.js precaches ${url}, which is not in dist/; the install would fail on every device.`);
          continue;
        }
        if (entry.revision === null && !CONTENT_HASHED.test(url)) {
          fail(
            `dist/sw.js precaches ${url} with no revision, and its name carries no content hash, so a ` +
              'changed file would never reach a device that already has it.',
          );
        }
        precached.add(url);
        precacheBytes += statSync(file).size;
      }
      precacheFiles = precached.size;

      const mustPrecache = ['index.html', WEB_MANIFEST_FILE];
      if (existsSync(join(DIST_DIR, MANIFEST_NAME))) mustPrecache.push(MANIFEST_NAME);
      for (const file of distFiles) {
        const path = distRel(file);
        if ((path.startsWith('assets/') || path.startsWith(`${ICON_DIR}/`)) && !path.endsWith('.map')) {
          mustPrecache.push(path);
        }
      }
      const absent = mustPrecache.filter((path) => !precached.has(path));
      if (absent.length > 0) {
        fail(
          `dist/sw.js does not precache ${absent.length} file(s) the game needs offline: ` +
            `${absent.slice(0, 8).join(', ')}${absent.length > 8 ? ', ...' : ''}.`,
        );
      }

      if (typeof budget === 'number' && Number.isFinite(budget) && budget > 0 && precacheBytes > budget) {
        fail(
          `dist/sw.js precaches ${mib(precacheBytes)} over ${precacheFiles} file(s); the ceiling is ` +
            `budgets.initialPayloadBytes, ${mib(budget)}. A first visit downloads all of it.`,
        );
      }
    }

    // ---- the level art
    const art = readInjected(worker, LEVEL_ART_SENTINEL);
    let artFiles = 0;
    let artLevels = 0;
    if (art.error !== undefined) {
      fail(`dist/sw.js: ${art.error}; the level art it caches cannot be checked.`);
    } else if (art.value === null || typeof art.value !== 'object' || Array.isArray(art.value)) {
      fail('dist/sw.js carries level art that is not an object of path -> levels.');
    } else {
      const assetManifestFile = join(DIST_DIR, MANIFEST_NAME);
      let shipped = null;
      if (existsSync(assetManifestFile)) {
        try {
          const files = JSON.parse(readFileSync(assetManifestFile, 'utf8'))?.files;
          shipped = new Map(
            (Array.isArray(files) ? files : [])
              .filter((file) => typeof file?.path === 'string')
              .map((file) => [file.path, Array.isArray(file.levels) ? [...file.levels].sort() : []]),
          );
        } catch (error) {
          fail(`dist/${MANIFEST_NAME} is not valid JSON (${error.message}); the worker's level art cannot be checked.`);
        }
      }
      const cached = Object.entries(art.value);
      artFiles = cached.length;
      if (shipped !== null) {
        if (shipped.size === 0) {
          fail(`dist/${MANIFEST_NAME} names no files, so the worker caches no level art and offline play measures nothing.`);
        }
        const neverCached = [...shipped.keys()].filter((path) => !Object.hasOwn(art.value, path));
        if (neverCached.length > 0) {
          fail(
            `dist/sw.js will never cache ${neverCached.length} file(s) dist/${MANIFEST_NAME} ships: ` +
              `${neverCached.slice(0, 6).join(', ')}${neverCached.length > 6 ? ', ...' : ''}.`,
          );
        }
        const levels = new Set();
        for (const [path, owners] of cached) {
          const expected = shipped.get(path);
          if (expected === undefined) {
            fail(`dist/sw.js caches ${path} as level art, and dist/${MANIFEST_NAME} does not ship it.`);
            continue;
          }
          if (!Array.isArray(owners) || owners.length === 0 || JSON.stringify([...owners].sort()) !== JSON.stringify(expected)) {
            fail(
              `dist/sw.js files ${path} under ${JSON.stringify(owners)}; dist/${MANIFEST_NAME} says ` +
                `${JSON.stringify(expected)}. A level would be cached without it, or with another level's art.`,
            );
          }
          if (!existsSync(join(DIST_DIR, path))) fail(`dist/sw.js caches ${path} as level art and it is not in dist/.`);
          for (const owner of Array.isArray(owners) ? owners : []) levels.add(owner);
        }
        artLevels = levels.size;
      } else if (artFiles > 0) {
        fail(`dist/sw.js caches ${artFiles} level art file(s) and dist/${MANIFEST_NAME} does not exist to ship them.`);
      }
    }

    workerSummary =
      `service worker ON: precache ${precacheFiles} file(s), ${kb(precacheBytes)} against ` +
      `${mib(typeof budget === 'number' ? budget : 0)}; ${artFiles} level art file(s) over ${artLevels} ` +
      'level(s) cached per level on first play';
  }
}

// ------------------------------------------------------- web app manifest ---

/** Width and height from a PNG's IHDR, or null for anything that is not a PNG. */
function pngSize(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 24 || bytes.toString('latin1', 1, 4) !== 'PNG' || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

if (config !== null && existsSync(WEB_MANIFEST)) {
  const basePath = config.basePath;
  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(WEB_MANIFEST, 'utf8'));
  } catch (error) {
    fail(`dist/${WEB_MANIFEST_FILE} is not valid JSON (${error.message}).`);
  }

  const html = existsSync(INDEX_HTML) ? readFileSync(INDEX_HTML, 'utf8') : '';
  if (!html.includes(`<link rel="manifest" href="${basePath}${WEB_MANIFEST_FILE}">`)) {
    fail(`dist/index.html does not link ${basePath}${WEB_MANIFEST_FILE}, so no browser will offer to install the game.`);
  }

  if (manifest !== null) {
    const must = (key, value, why) => {
      if (manifest[key] !== value) {
        fail(`dist/${WEB_MANIFEST_FILE} has ${key} ${JSON.stringify(manifest[key])}; it must be ${JSON.stringify(value)} - ${why}.`);
      }
    };
    must('name', config.title, 'the name comes from content/game.config.json');
    must('id', basePath, 'an installed app is identified by it, so it must not move');
    must('start_url', basePath, 'a wrong start_url opens a blank page from the home screen (ADR-0006)');
    must('scope', basePath, 'outside the scope an installed app drops back into a browser tab');
    must('orientation', 'portrait', 'TrueNorth is portrait-only (ADR-0002)');
    if (typeof config.theme?.sky === 'string') {
      must('theme_color', config.theme.sky, 'the browser chrome matches the pre-boot sky (index.html theme-color)');
    }
    if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
      fail(`dist/${WEB_MANIFEST_FILE} has display ${JSON.stringify(manifest.display)}; Chromium installs only standalone, fullscreen or minimal-ui.`);
    }

    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    const good = [];
    for (const icon of icons) {
      const where = `dist/${WEB_MANIFEST_FILE} icon ${JSON.stringify(icon?.src)}`;
      if (typeof icon?.src !== 'string' || !icon.src.startsWith(basePath)) {
        fail(`${where} is not a path under ${basePath}.`);
        continue;
      }
      const file = join(DIST_DIR, icon.src.slice(basePath.length));
      if (!existsSync(file)) {
        fail(`${where} is not in dist/.`);
        continue;
      }
      const size = pngSize(file);
      const declared = /^(\d+)x(\d+)$/.exec(String(icon.sizes));
      if (icon.type !== 'image/png' || size === null) {
        fail(`${where} is not a PNG, or does not say it is one.`);
        continue;
      }
      if (declared === null || Number(declared[1]) !== size.width || Number(declared[2]) !== size.height) {
        fail(`${where} declares sizes ${JSON.stringify(icon.sizes)} and is ${size.width}x${size.height}.`);
        continue;
      }
      good.push({ width: size.width, purposes: String(icon.purpose ?? 'any').split(/\s+/) });
    }
    if (!good.some((icon) => icon.width === 192 && icon.purposes.includes('any'))) {
      fail(`dist/${WEB_MANIFEST_FILE} has no 192x192 PNG icon; Chromium's install criteria ask for one.`);
    }
    if (!good.some((icon) => icon.width === 512 && icon.purposes.includes('any'))) {
      fail(`dist/${WEB_MANIFEST_FILE} has no 512x512 PNG icon; Chromium's install criteria and splash screen ask for one.`);
    }
    if (!good.some((icon) => icon.purposes.includes('maskable'))) {
      fail(`dist/${WEB_MANIFEST_FILE} has no maskable icon, so Android would shrink the icon into a white disc.`);
    }
    manifestSummary = `web app manifest installable (${good.length} icon(s) checked)`;
  }
}

// ------------------------------------------------- per-level payload budget ---

/**
 * `make assets` already ran this gate over `assets/dist`. This is the same
 * rules applied to what actually shipped: Vite copies `publicDir` into `dist/`
 * verbatim, so a manifest that agreed with `assets/dist` and disagrees with
 * `dist/` means the copy went wrong, and a per-file budget check that never
 * looks at the artefact is checking the wrong tree.
 *
 * It is conditional on the manifest being present, and that is NOT a vacuum:
 * `make assets` runs the same check unconditionally and fails the build without
 * it, and `deploy-pages.yml` runs `make assets` before `make build`. What this
 * conditional buys is that `make build` on its own - which the e2e, perf and
 * a11y suites all do - does not demand an asset build that has nothing to do
 * with the page under test. If assets ever stop being copied into `dist/`, the
 * gate that notices is the one in `make assets`, not this one.
 *
 * `scanRoot: false` because the root of `dist/` is Vite's output, not the
 * pipeline's; the manifest's own output directories are still walked in full,
 * so no shipped asset goes unclaimed either way.
 */
if (distFiles.length > 0 && existsSync(join(DIST_DIR, MANIFEST_NAME))) {
  const level = checkLevelPayload({ root: ROOT, dir: DIST_DIR, scanRoot: false, source: 'dist' });
  for (const failure of level.failures) fail(failure);
  if (level.summary !== null) payloadSummary += `, ${level.summary}`;

  // And the decoded-texture budget over the same artefact. Transfer bytes and
  // VRAM bytes are different quantities measured over the same files: this one
  // is the one whose breach is invisible until a device loses its WebGL context,
  // so the artefact that actually ships is checked for it too, not just the
  // tree `make assets` produced.
  const textures = checkTextureMemory({ root: ROOT, dir: DIST_DIR, source: 'dist' });
  for (const failure of textures.failures) fail(failure);
  if (textures.summary !== null) payloadSummary += `, ${textures.summary}`;
}

// -------------------------------------------------------------- base path ---

function repositoryName() {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY.split('/').pop();
  }
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const url = pkg?.repository?.url ?? '';
    const match = /([^/:]+?)(?:\.git)?$/.exec(url);
    if (match) return match[1];
  } catch {
    /* fall through */
  }
  return null;
}

if (config !== null) {
  const basePath = config.basePath;

  if (typeof basePath !== 'string') {
    fail('content/game.config.json has no string "basePath".');
  } else if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
    fail(`basePath "${basePath}" must start and end with "/".`);
  } else {
    const repo = repositoryName();
    const expected = repo ? `/${repo}/` : null;
    if (expected && basePath !== expected) {
      fail(
        `basePath is "${basePath}" but this repository publishes at "${expected}". ` +
          'Fix content/game.config.json or add an ADR for a custom domain.',
      );
    }
  }
}

// ---------------------------------------------------------------- report ---

if (failures.length > 0) {
  console.error('deploy-check: FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`deploy-check: ${failures.length} failure(s).`);
  process.exit(1);
}

const distBytes = distFiles.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  `deploy-check: OK - ${distFiles.length} file(s), ${mib(distBytes)} on disk in dist/, ` +
    `${payloadSummary}, base path correct, ${workerSummary}, ${manifestSummary}.`,
);
