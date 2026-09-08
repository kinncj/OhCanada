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
 *   5. .github/workflows/*.yml has drifted from infra/github/workflows/*.yml
 *      — infra/ is the source of truth and .github/ is its checked-in copy.
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

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT, 'dist');
const CONFIG_FILE = join(ROOT, 'content', 'game.config.json');
const INFRA_WORKFLOWS = join(ROOT, 'infra', 'github', 'workflows');
const REPO_WORKFLOWS = join(ROOT, '.github', 'workflows');

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const REQUIRED_DIST_FILES = ['index.html'];

const failures = [];
const fail = (message) => failures.push(message);

let payloadSummary = 'initial payload not measured';

const rel = (absolute) => relative(ROOT, absolute).split(sep).join('/');

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

/** Read once: both the base path check and the payload budgets need it. */
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
 *     `budgets.levelPayloadBytes` and is a different gate.
 *   - Anything reached only at runtime (fetched JSON, atlases, audio). Those
 *     are level payload too.
 *   - Images or fonts referenced by `<link rel="icon">` and friends: not on the
 *     critical path to first frame.
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

// ------------------------------------------------------------- workflows ---

const infraWorkflows = existsSync(INFRA_WORKFLOWS)
  ? readdirSync(INFRA_WORKFLOWS).filter((f) => f.endsWith('.yml')).sort()
  : [];
const repoWorkflows = existsSync(REPO_WORKFLOWS)
  ? readdirSync(REPO_WORKFLOWS).filter((f) => f.endsWith('.yml')).sort()
  : [];

if (infraWorkflows.length === 0) {
  fail('infra/github/workflows/ has no .yml files; the pipeline source of truth is missing.');
}

for (const name of infraWorkflows) {
  if (!repoWorkflows.includes(name)) {
    fail(`.github/workflows/${name} is missing. Copy it from infra/github/workflows/.`);
    continue;
  }
  const source = readFileSync(join(INFRA_WORKFLOWS, name), 'utf8');
  const copy = readFileSync(join(REPO_WORKFLOWS, name), 'utf8');
  if (source !== copy) {
    fail(
      `.github/workflows/${name} differs from infra/github/workflows/${name}. ` +
        'Edit the infra copy, then run `make sync-workflows`. (A Dependabot action ' +
        'bump edits only the .github copy, so it will land here first.)',
    );
  }
}

for (const name of repoWorkflows) {
  if (!infraWorkflows.includes(name)) {
    fail(`.github/workflows/${name} has no source in infra/github/workflows/.`);
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
    `${payloadSummary}, base path and ${infraWorkflows.length} workflow(s) in sync.`,
);
