/**
 * THE PROGRESSIVE WEB APP, BUILT - slice F3, ADR-0034.
 *
 * One Vite plugin, build only, that turns dist/ into something a browser can
 * install and play offline, plus the handful of facts scripts/deploy-check.mjs
 * needs to check that it did. What it writes:
 *
 *   dist/manifest.webmanifest   name, portrait, colours from the config's
 *                               `theme`, `start_url` and `scope` at `basePath`;
 *   dist/icons/*.png            rasterised from assets/src/icons/, which is
 *                               credited in assets/credits.json and
 *                               palette-linted here before a pixel is drawn;
 *   dist/index.html             gains the manifest link, the iOS home-screen
 *                               icon and - when the worker is on - an inline
 *                               registration script;
 *   dist/sw.js                  EITHER the Workbox worker bundled from
 *                               infra/pages/service-worker.js, OR the tombstone
 *                               infra/pages/sw.js, chosen by
 *                               `featureFlags.serviceWorker` in
 *                               content/game.config.json.
 *
 * THAT FLAG IS THE KILL SWITCH. Off, the build ships the tombstone at the same
 * URL and no registration: every browser holding the worker fetches the
 * tombstone on its next update check, which deletes this project's caches,
 * unregisters itself and reloads the page onto the network. It is the same file
 * that already cleared the archived 3D build's worker (docs/runbook.md 3b), so
 * the way out of a bad worker is a path that has run in production.
 *
 * WHY `.mjs` AND NOT A TYPESCRIPT PLUGIN. deploy-check.mjs is a plain Node
 * script and must read the same constants the plugin writes with - the file
 * names, the sentinels, the message the page sends the worker - or the checker
 * and the producer can drift apart. vite.config.ts imports the plugin through
 * `pwa.d.mts`, the `claims.d.mts` arrangement.
 *
 * HEAVY IMPORTS ARE DYNAMIC. vite.config.ts is also loaded by the dev servers
 * the a11y and perf harnesses run; `vite`, `sharp` and `workbox-build` are
 * imported inside the build hooks so a dev server never pays for them.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { lintPalette } from './palette-lint.mjs';

export const SERVICE_WORKER_FILE = 'sw.js';
export const WEB_MANIFEST_FILE = 'manifest.webmanifest';
/** The asset pipeline's manifest (scripts/assets.mjs), copied into dist/ by Vite's publicDir. */
export const ASSET_MANIFEST_FILE = 'manifest.json';
export const ICON_SOURCE_DIR = 'assets/src/icons';
export const ICON_SOURCE = `${ICON_SOURCE_DIR}/truenorth-app-icon.svg`;
export const ICON_DIR = 'icons';
/** 180 is the iOS home-screen icon; 192 and 512 are what Chromium's install criteria ask for. */
export const ICON_SIZES = Object.freeze([180, 192, 512]);
export const WORKER_SOURCE = 'infra/pages/service-worker.js';
export const TOMBSTONE_SOURCE = 'infra/pages/sw.js';
/** First bytes of a built worker. The tombstone does not start with them. */
export const WORKER_BANNER = '/* TrueNorth service worker';
/** Must equal `WARM_MESSAGE` in infra/pages/service-worker.js; deploy-check holds them together. */
export const WARM_MESSAGE = 'truenorth:warm';
/**
 * The field of that message that asks the worker to cache every level's art, not
 * only the page's (ADR-0034, amended 2026-09-15). Must equal `WARM_EVERY_LEVEL` in
 * infra/pages/service-worker.js; deploy-check holds them together.
 */
export const WARM_EVERY_LEVEL = 'everyLevel';
export const PRECACHE_SENTINEL = 'tn:precache';
export const LEVEL_ART_SENTINEL = 'tn:level-art';

/**
 * A Vite chunk or asset (`name-XXXXXXXX.ext`, eight base64url characters) or an
 * icon from this file (`name.xxxxxxxx.png`, eight hex). Such a URL can never
 * change content, so the precache fetches it without a cache-busting revision
 * and the browser's HTTP cache - which already holds most of it from the page
 * load - can answer.
 */
export const CONTENT_HASHED = /(?:-[\w-]{8}|\.[0-9a-f]{8})\.[a-z0-9]+$/;

/** The flag, read one way everywhere. Anything but a literal `true` is off. */
export function serviceWorkerEnabled(config) {
  return config?.featureFlags?.serviceWorker === true;
}

/**
 * Read back a JSON block this module wrote into the worker between
 * `/*<sentinel>*\/` and `/*<sentinel>:end*\/`. Returns `{ value }` or `{ error }`,
 * never throws: deploy-check reports every problem, not the first.
 */
export function readInjected(source, sentinel) {
  const open = `/*${sentinel}*/`;
  const close = `/*${sentinel}:end*/`;
  const first = source.indexOf(open);
  if (first === -1) return { error: `no ${open} block` };
  if (source.indexOf(open, first + open.length) !== -1) return { error: `more than one ${open} block` };
  const end = source.indexOf(close, first);
  if (end === -1) return { error: `${open} is never closed by ${close}` };
  try {
    return { value: JSON.parse(source.slice(first + open.length, end)) };
  } catch (error) {
    return { error: `${open} does not hold JSON (${error.message})` };
  }
}

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every file the asset manifest names, with the levels that draw it, keys
 * sorted so the worker's bytes depend on the build and not on directory order.
 * A file with no level is kept with an empty list rather than dropped, so
 * deploy-check's set comparison with the manifest sees it and fails loudly.
 */
export function levelArtFrom(assetManifest) {
  const files = Array.isArray(assetManifest?.files) ? assetManifest.files : [];
  const art = {};
  for (const file of [...files].sort((a, b) => byString(String(a?.path), String(b?.path)))) {
    if (typeof file?.path !== 'string') continue;
    const levels = Array.isArray(file.levels) ? file.levels.filter((level) => typeof level === 'string') : [];
    art[file.path] = [...levels].sort(byString);
  }
  return art;
}

/**
 * The inline script dist/index.html runs. Registers on `load`, so the worker's
 * precache never competes with the first paint for the network, with
 * `updateViaCache: 'none'` so an update check always reaches Pages rather than
 * the 10-minute HTTP cache it serves sw.js with.
 *
 * When control arrives on a page that had none - a first visit - it hands the
 * worker the URLs the page already fetched, so a level opened before the worker
 * took over is cached whole all the same.
 *
 * Every page the worker already controls says so again on `load`, and both
 * messages carry `everyLevel`: the worker then caches every level's art after
 * the page's own, so a level never played online still opens offline (ADR-0034,
 * amended 2026-09-15). A browser that asks to save data sends `false`, and a
 * level is then cached only when it is played.
 *
 * It tolerates `register` resolving to nothing: that is what Playwright's
 * `serviceWorkers: 'block'` stubs it with, and every browser suite but the
 * offline and update specs runs that way (ADR-0034). A page with no controller
 * sends nothing.
 */
export function registrationScript(basePath) {
  const url = JSON.stringify(`${basePath}${SERVICE_WORKER_FILE}`);
  const scope = JSON.stringify(basePath);
  const warm = JSON.stringify(WARM_MESSAGE);
  const every = JSON.stringify(WARM_EVERY_LEVEL);
  return [
    '(function () {',
    '  var sw = navigator.serviceWorker;',
    '  if (!sw) return;',
    '  var firstControl = !sw.controller;',
    '  var connection = navigator.connection;',
    '  var everyLevel = !(connection && connection.saveData === true);',
    '  function warm(urls) {',
    '    if (!sw.controller) return;',
    `    var message = { type: ${warm}, urls: urls };`,
    `    message[${every}] = everyLevel;`,
    '    sw.controller.postMessage(message);',
    '  }',
    "  sw.addEventListener('controllerchange', function () {",
    '    if (!firstControl || !sw.controller) return;',
    '    firstControl = false;',
    "    warm(performance.getEntriesByType('resource').map(function (entry) { return entry.name; }));",
    '  });',
    "  addEventListener('load', function () {",
    `    var registering = sw.register(${url}, { scope: ${scope}, updateViaCache: 'none' });`,
    "    if (registering && typeof registering.catch === 'function') registering.catch(function () {});",
    '    if (!firstControl) warm([]);',
    '  });',
    '})();',
  ].join('\n');
}

/**
 * The web app manifest. No `description`: it would be player-facing words in
 * one language, and CLAUDE.md ships EN and FR or nothing. The name is the
 * product name, the same in both.
 */
export function webManifest(config, icons) {
  const basePath = config?.basePath;
  const sky = config?.theme?.sky;
  if (typeof basePath !== 'string' || typeof config?.title !== 'string' || typeof sky !== 'string') {
    throw new Error(
      'content/game.config.json needs a string "basePath", "title" and "theme.sky" to write ' +
        `${WEB_MANIFEST_FILE}; the manifest's scope, name and colours come from them.`,
    );
  }
  const src = (size) => {
    const icon = icons.find((candidate) => candidate.size === size);
    if (icon === undefined) throw new Error(`no ${size} px icon was rendered from ${ICON_SOURCE}`);
    return `${basePath}${icon.fileName}`;
  };
  return {
    id: basePath,
    name: config.title,
    short_name: config.title,
    start_url: basePath,
    scope: basePath,
    display: 'standalone',
    orientation: 'portrait',
    background_color: sky,
    theme_color: sky,
    icons: [
      { src: src(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: src(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: src(512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** The tags Vite writes into dist/index.html. */
export function indexHtmlTags({ basePath, enabled, icons }) {
  const tags = [
    { tag: 'link', attrs: { rel: 'manifest', href: `${basePath}${WEB_MANIFEST_FILE}` }, injectTo: 'head' },
  ];
  const touch = icons.find((icon) => icon.size === 180);
  if (touch !== undefined) {
    tags.push({ tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${basePath}${touch.fileName}` }, injectTo: 'head' });
  }
  if (enabled) tags.push({ tag: 'script', children: registrationScript(basePath), injectTo: 'body' });
  return tags;
}

/** Rasterise the icon at every size, content-hashed like every other shipped file. */
async function renderIcons(root) {
  const { default: sharp } = await import('sharp');
  const svg = readFileSync(join(root, ICON_SOURCE));
  const viewBox = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg.toString('utf8'));
  const width = viewBox === null ? Number.NaN : Number(viewBox[1]);
  if (!(width > 0) || Number(viewBox?.[2]) !== width) {
    throw new Error(`${ICON_SOURCE} must declare a square viewBox; an icon is drawn square.`);
  }
  const icons = [];
  for (const size of ICON_SIZES) {
    /* Density, not a resize of one large render: librsvg re-renders the vector
       at each size, the same way scripts/assets.mjs rasterises level art. */
    const png = await sharp(svg, { density: (72 * size) / width })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
    icons.push({ size, fileName: `${ICON_DIR}/truenorth-${size}.${hash}.png`, png });
  }
  return icons;
}

function injectOnce(code, placeholder, value) {
  const parts = code.split(placeholder);
  if (parts.length !== 2) {
    throw new Error(
      `${WORKER_SOURCE}: the bundled worker must contain ${placeholder} exactly once, and it contains it ` +
        `${parts.length - 1} time(s). The build writes the value in there; without it the worker has nothing to serve.`,
    );
  }
  return parts.join(value);
}

/**
 * Bundle the worker, compute the precache over what `vite build` just wrote,
 * and write dist/sw.js. Runs in `closeBundle`, after dist/ - publicDir copy
 * included - is on disk.
 */
async function buildServiceWorker({ root, outDir, config }) {
  const [{ build }, { getManifest }] = await Promise.all([import('vite'), import('workbox-build')]);

  const hasAssetManifest = existsSync(join(outDir, ASSET_MANIFEST_FILE));
  const art = hasAssetManifest
    ? levelArtFrom(JSON.parse(readFileSync(join(outDir, ASSET_MANIFEST_FILE), 'utf8')))
    : {};

  /* `manifest.json` only when `make assets` produced one: workbox-build warns
     about a pattern that matches nothing, and a warning here fails the build. */
  const globPatterns = ['index.html', WEB_MANIFEST_FILE, 'assets/**/*', `${ICON_DIR}/**/*`];
  if (hasAssetManifest) globPatterns.push(ASSET_MANIFEST_FILE);

  const precache = await getManifest({
    globDirectory: outDir,
    globPatterns,
    globIgnores: ['**/*.map'],
    dontCacheBustURLsMatching: CONTENT_HASHED,
    maximumFileSizeToCacheInBytes: config.budgets.initialPayloadBytes,
  });
  if (precache.warnings.length > 0) {
    throw new Error(`workbox-build refused part of the precache:\n  - ${precache.warnings.join('\n  - ')}`);
  }
  const entries = [...precache.manifestEntries].sort((a, b) => byString(a.url, b.url));

  const result = await build({
    configFile: false,
    root,
    logLevel: 'warn',
    publicDir: false,
    mode: 'production',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      copyPublicDir: false,
      emptyOutDir: false,
      /* Readable on purpose, like the source maps beside it: this is the one
         file a player's browser keeps running between visits, and anyone
         debugging it should be able to read what it does. */
      minify: false,
      sourcemap: false,
      target: 'es2022',
      reportCompressedSize: false,
      lib: {
        entry: join(root, WORKER_SOURCE),
        formats: ['iife'],
        name: 'truenorthServiceWorker',
        fileName: () => SERVICE_WORKER_FILE,
      },
    },
  });
  const chunk = (Array.isArray(result) ? result : [result])
    .flatMap((output) => ('output' in output ? output.output : []))
    .find((file) => file.type === 'chunk' && file.fileName === SERVICE_WORKER_FILE);
  if (chunk === undefined) throw new Error(`bundling ${WORKER_SOURCE} produced no ${SERVICE_WORKER_FILE}`);

  let code = injectOnce(
    chunk.code,
    'self.__WB_MANIFEST',
    `/*${PRECACHE_SENTINEL}*/${JSON.stringify(entries)}/*${PRECACHE_SENTINEL}:end*/`,
  );
  code = injectOnce(
    code,
    'self.__TN_LEVEL_ART',
    `/*${LEVEL_ART_SENTINEL}*/${JSON.stringify(art)}/*${LEVEL_ART_SENTINEL}:end*/`,
  );

  const banner =
    `${WORKER_BANNER}, built by scripts/lib/pwa.mjs from ${WORKER_SOURCE} (ADR-0034).\n` +
    '   The precache and the level art are written in below; scripts/deploy-check.mjs reads them back. */\n';
  writeFileSync(join(outDir, SERVICE_WORKER_FILE), `${banner}${code}`);

  return { precacheFiles: entries.length, precacheBytes: precache.size, artFiles: Object.keys(art).length };
}

/** The plugin vite.config.ts installs. */
export function progressiveWebApp({ root }) {
  const config = JSON.parse(readFileSync(join(root, 'content', 'game.config.json'), 'utf8'));
  const basePath = config.basePath;
  const enabled = serviceWorkerEnabled(config);
  let outDir = join(root, 'dist');
  let logger = null;
  let icons = [];

  return {
    name: 'truenorth:progressive-web-app',
    apply: 'build',

    configResolved(resolved) {
      outDir = resolve(resolved.root, resolved.build.outDir);
      logger = resolved.logger;
    },

    async buildStart() {
      const lint = lintPalette({ root, svgDir: join(root, ICON_SOURCE_DIR) });
      if (lint.failures.length > 0) {
        throw new Error(`${ICON_SOURCE_DIR} failed the palette lint:\n  - ${lint.failures.join('\n  - ')}`);
      }
      icons = await renderIcons(root);
    },

    generateBundle() {
      for (const icon of icons) this.emitFile({ type: 'asset', fileName: icon.fileName, source: icon.png });
      this.emitFile({
        type: 'asset',
        fileName: WEB_MANIFEST_FILE,
        source: `${JSON.stringify(webManifest(config, icons), null, 2)}\n`,
      });
      if (!enabled) {
        this.emitFile({
          type: 'asset',
          fileName: SERVICE_WORKER_FILE,
          source: readFileSync(join(root, TOMBSTONE_SOURCE), 'utf8'),
        });
      }
    },

    transformIndexHtml: {
      order: 'post',
      handler: () => indexHtmlTags({ basePath, enabled, icons }),
    },

    async closeBundle() {
      if (!enabled) {
        logger?.info('service worker: OFF (featureFlags.serviceWorker) - shipped the tombstone sw.js');
        return;
      }
      /* closeBundle also runs after a build that failed to write. Writing a
         worker then would only bury the real error under a second one; the
         missing sw.js fails deploy-check instead. */
      if (!existsSync(join(outDir, 'index.html'))) return;
      const built = await buildServiceWorker({ root, outDir, config });
      logger?.info(
        `service worker: precache ${built.precacheFiles} file(s), ${(built.precacheBytes / 1000).toFixed(1)} kB; ` +
          `${built.artFiles} level art file(s), every level cached in the background once the worker controls a page`,
      );
    },
  };
}
