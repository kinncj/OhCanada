/**
 * worker-budget - the service worker's two downloads, each held to its own
 * budget (ADR-0075, amending ADR-0034).
 *
 *   1. The precache the worker installs: code, content, fonts, the shell. Held
 *      to `budgets.initialPayloadBytes`, as it always was.
 *   2. Every level's art, both scales, which the worker caches in the
 *      background once it controls a page. Held to
 *      `budgets.backgroundCacheBytes`.
 *
 * They are NOT added together. Until ADR-0075 they were, under
 * `initialPayloadBytes`, and that sum had two owners and so none: a lesson
 * commit could fail on a message telling art to get smaller. Each clause here
 * names one key, and the background one names who pays - the three heaviest
 * levels by their own art, and the shared files' total.
 *
 * The module is pure in the sense that matters for a gate: it reads only the
 * files it is told about, under the `distDir` it is given, and returns its
 * findings instead of printing them or exiting. `scripts/deploy-check.mjs`
 * pushes `failures` through its own `fail`, and
 * `tests/unit/infra/worker-budget-gate.test.ts` drives this same function over
 * a scratch dist/ of files of exact sizes. The same pattern as
 * `checkTextureMemory`: the test drives the function the build does.
 *
 * What it does not do is validate the worker: paths outside dist/, files that
 * are missing, art the asset manifest does not ship. deploy-check fails those
 * with their own messages. A path that is not a file inside `distDir` is simply
 * not sized here.
 *
 * Sizes are what is on disk. Nothing a manifest or dist/sw.js claims about a
 * file's size is read, so a stale claim cannot satisfy the gate. Each file is
 * counted once, however many levels name it: that is what a device stores.
 */

import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** The key ADR-0075 adds to `content/game.config.json#/budgets`. */
export const BACKGROUND_BUDGET_KEY = 'backgroundCacheBytes';

export const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
export const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

const isBudget = (value) => typeof value === 'number' && Number.isInteger(value) && value > 0;

/**
 * The failure for a missing, non-integer or non-positive
 * `budgets.backgroundCacheBytes`, or null when the key is usable. Exported
 * because deploy-check requires the key with the worker off as well, where
 * nothing is measured against it.
 */
export function backgroundBudgetKeyFailure(budgets) {
  const value = budgets !== null && typeof budgets === 'object' ? budgets[BACKGROUND_BUDGET_KEY] : undefined;
  if (isBudget(value)) return null;
  return (
    `content/game.config.json has no positive numeric "budgets.${BACKGROUND_BUDGET_KEY}"; ` +
    'the background level cache cannot be checked.'
  );
}

/** The on-disk size of `path` under `distDir`, or null when it is not a file inside it. */
function sizeInDist(distDir, path) {
  if (typeof path !== 'string' || path.length === 0) return null;
  const root = resolve(distDir);
  const file = resolve(root, path);
  const inside = relative(root, file);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return null;
  if (!existsSync(file)) return null;
  const stat = statSync(file);
  return stat.isFile() ? stat.size : null;
}

/**
 * @param {object} input
 * @param {string} input.distDir the built site
 * @param {readonly string[]} input.precacheUrls dist-relative URLs the worker precaches
 * @param {Readonly<Record<string, readonly string[]>>} input.levelArt dist-relative path -> the levels that draw it
 * @param {Record<string, unknown> | undefined} input.budgets `content/game.config.json#/budgets`
 * @returns {{ precacheBytes: number, artBytes: number, failures: string[] }}
 */
export function checkWorkerBudgets({ distDir, precacheUrls, levelArt, budgets }) {
  const failures = [];

  // ---- the precache: sized from disk, each file once
  const precached = new Set();
  let precacheBytes = 0;
  for (const url of Array.isArray(precacheUrls) ? precacheUrls : []) {
    if (precached.has(url)) continue;
    const size = sizeInDist(distDir, url);
    if (size === null) continue;
    precached.add(url);
    precacheBytes += size;
  }

  const initial = budgets?.initialPayloadBytes;
  if (typeof initial === 'number' && Number.isFinite(initial) && initial > 0 && precacheBytes > initial) {
    failures.push(
      `dist/sw.js precaches ${mib(precacheBytes)} over ${precached.size} file(s); the ceiling is ` +
        `budgets.initialPayloadBytes, ${mib(initial)}. A first visit downloads all of it.`,
    );
  }

  // ---- the level art: sized from disk, each file once, however many levels name it
  const art = levelArt !== null && typeof levelArt === 'object' && !Array.isArray(levelArt) ? levelArt : {};
  let artBytes = 0;
  let artFiles = 0;
  let sharedBytes = 0;
  let sharedFiles = 0;
  const levels = new Set();
  /** @type {Map<string, number>} a level's own art: files no other level draws */
  const ownBytes = new Map();
  for (const [path, owners] of Object.entries(art)) {
    const names = [...new Set(Array.isArray(owners) ? owners.filter((o) => typeof o === 'string') : [])];
    for (const name of names) levels.add(name);
    const size = sizeInDist(distDir, path);
    if (size === null) continue;
    artFiles += 1;
    artBytes += size;
    if (names.length === 1) {
      ownBytes.set(names[0], (ownBytes.get(names[0]) ?? 0) + size);
    } else {
      sharedFiles += 1;
      sharedBytes += size;
    }
  }

  const keyFailure = backgroundBudgetKeyFailure(budgets);
  if (keyFailure !== null) {
    failures.push(keyFailure);
  } else {
    const budget = budgets[BACKGROUND_BUDGET_KEY];
    if (artBytes > budget) {
      const heaviest = [...ownBytes.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([level, bytes]) => `${level} ${kb(bytes)}`);
      failures.push(
        `dist/sw.js caches every level's art in the background, ${artFiles} file(s) over ${levels.size} ` +
          `level(s), ${kb(artBytes)}; the budget is budgets.${BACKGROUND_BUDGET_KEY}, ${mib(budget)} ` +
          `(${budget} B). The heaviest levels by their own art are ` +
          `${heaviest.length > 0 ? heaviest.join(', ') : 'none (no level has art of its own)'}, and ` +
          `${sharedFiles} file(s) shared by more than one level come to ${kb(sharedBytes)}. ` +
          'Make the heaviest level\'s art smaller, or change the budget in an ADR (ADR-0075).',
      );
    }
  }

  return { precacheBytes, artBytes, failures };
}
