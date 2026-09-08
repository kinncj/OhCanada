#!/usr/bin/env node
/**
 * check-texture-memory — enforce the per-level DECODED texture budget over an
 * asset manifest. The rules, and why each one exists, are in
 * scripts/lib/texture-memory.mjs.
 *
 * This is the budget whose breach is invisible until a device dies: the previous
 * incarnation of this project lost a WebGL context around 538 MB of decoded
 * textures on an iPhone that had reported every capability as available, and the
 * transfer payload was fine the whole time.
 *
 * `make assets` runs this at the end of every build, so the gate cannot be
 * skipped by anyone who builds assets. It is exposed separately (`make
 * check-textures`) for two reasons: to re-check `dist/` after `make build`
 * without rebuilding, and so tests/unit/infra/texture-memory-gate.test.ts can
 * drive the real CLI — argv, exit code, stdout, stderr — over scratch trees
 * rather than re-implementing the sums and proving the copy agrees with the copy.
 */

import { fileURLToPath } from 'node:url';

import { checkTextureMemory } from './lib/texture-memory.mjs';

const HELP = `check-texture-memory — enforce the per-level decoded texture budget

Usage: node scripts/check-texture-memory.mjs [options]

  --root <dir>   repository root (default: the repository this script lives in)
  --dir <dir>    directory holding manifest.json (default: <root>/assets/dist)
  --source <s>   how to name <dir> in messages (default: assets/dist)
  --help, -h     this text

Exit code 0 only when every level's textures, resolved per device scale and
measured from the files' own headers at 4 bytes per pixel, fit the lower of that
level's textureBudgetBytes and the 64 MiB per-level ceiling in CLAUDE.md, AND no
full-screen parallax layer ships above 1x. A manifest that maps files to zero
levels, or that omits decodedBytes, FAILS: "measured nothing" is not "everything
fits".
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

const { failures, summary } = checkTextureMemory({ root, dir, source });

if (failures.length > 0) {
  console.error('texture-memory: FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`texture-memory: ${failures.length} failure(s).`);
  process.exit(1);
}

console.log(`texture-memory: OK - ${summary}`);
