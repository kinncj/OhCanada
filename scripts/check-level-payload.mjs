#!/usr/bin/env node
/**
 * check-level-payload — enforce `budgets.levelPayloadBytes` over an asset
 * manifest. The rules, and why each one exists, are in scripts/lib/level-payload.mjs.
 *
 * `make assets` runs this at the end of every build, so the gate cannot be
 * skipped by anyone who builds assets. It is exposed separately (`make
 * check-assets`) for two reasons: to re-check `dist/` after `make build` without
 * rebuilding, and so tests/unit/infra/level-payload-gate.test.ts can drive the
 * real CLI — argv, exit code, stdout, stderr — over scratch trees rather than
 * re-implementing the walk and proving the copy agrees with the copy.
 */

import { fileURLToPath } from 'node:url';

import { checkLevelPayload } from './lib/level-payload.mjs';

const HELP = `check-level-payload — enforce the per-level payload budget

Usage: node scripts/check-level-payload.mjs [options]

  --root <dir>   repository root (default: the repository this script lives in)
  --dir <dir>    directory holding manifest.json (default: <root>/assets/dist)
  --source <s>   how to name <dir> in messages (default: derived from --dir)
  --no-scan-root do not treat stray files at the root of <dir> as unclaimed
                 payload. Used for dist/, whose root is Vite's output.
  --help, -h     this text

Exit code 0 only when every level fits budgets.levelPayloadBytes AND the
manifest, the files on disk and content/levels/ all agree. A manifest that maps
files to zero levels FAILS: "measured nothing" is not "everything passed".
`;

const argv = process.argv.slice(2);
if (argv.some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at !== -1 && at + 1 < argv.length ? argv[at + 1] : fallback;
};

const root = option('--root', fileURLToPath(new URL('..', import.meta.url)));
const dir = option('--dir', `${root.replace(/\/$/, '')}/assets/dist`);
// Only a label for messages. It is not derived from --dir: a guess that got it
// wrong would name the wrong tree in every failure it printed.
const source = option('--source', 'assets/dist');
const scanRoot = !argv.includes('--no-scan-root');

const { failures, summary } = checkLevelPayload({ root, dir, scanRoot, source });

if (failures.length > 0) {
  console.error('level-payload: FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`level-payload: ${failures.length} failure(s).`);
  process.exit(1);
}

console.log(`level-payload: OK - ${summary}`);
