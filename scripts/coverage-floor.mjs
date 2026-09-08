#!/usr/bin/env node
/**
 * coverage-floor - makes the coverage percentage mean something.
 *
 * A percentage is a ratio, and v8 reports the empty ratio 0/0 as 100%. Vitest's
 * `thresholds` are therefore satisfied by measuring nothing at all: point
 * `coverage.include` at a glob that matches no executable code and the gate goes
 * green. That is exactly what happened here - `app/domain/**` and
 * `app/application/**` are 12 type-only files with `LF:0`, so a "90% of domain
 * and application" gate was really "100% of the empty set", and the only lines
 * it could see were 58 lines of `common/`.
 *
 * This script reads the lcov report vitest just wrote and asserts the
 * measurement had a body: enough files with executable lines, and enough
 * executable lines in total. It cannot tell you the code is well tested - the
 * thresholds do that - but it can tell you the thresholds were asked a real
 * question.
 *
 * Run as the second half of `npm test`, so `vitest --coverage && this` means
 * "the percentages passed AND they were computed over something".
 *
 * When the measured set legitimately grows, raise MIN_MEASURED_LINES. It is a
 * ratchet, not a target.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LCOV = join(ROOT, 'coverage', 'lcov.info');

/**
 * Current measurement: 211 executable lines across 6 files (boot-config,
 * event-bus, result, viewport-mode, focus-trap, live-region). The floor sits
 * well below that so ordinary churn does not trip it, and far above the 0 that
 * a broken `include` produces. Raise it when the measured set grows: it is a
 * ratchet against collapse, not a target to hit.
 */
const MIN_MEASURED_LINES = 150;
const MIN_MEASURED_FILES = 4;

if (!existsSync(LCOV)) {
  console.error(
    'coverage-floor: FAILED - coverage/lcov.info does not exist.\n' +
      '  Run `vitest run --coverage` first; `lcov` must stay in coverage.reporter.',
  );
  process.exit(1);
}

const lcov = readFileSync(LCOV, 'utf8');

/** One record per source file: `SF:<path>` ... `LF:<n>` (lines found). */
const records = [];
let currentFile = null;

for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) currentFile = line.slice(3).trim();
  else if (line.startsWith('LF:') && currentFile !== null) {
    records.push({ file: currentFile, found: Number.parseInt(line.slice(3), 10) || 0 });
  } else if (line.startsWith('end_of_record')) currentFile = null;
}

const executable = records.filter((r) => r.found > 0);
const totalLines = executable.reduce((sum, r) => sum + r.found, 0);

const failures = [];

if (records.length === 0) {
  failures.push(
    'the lcov report contains no files at all - coverage.include matched nothing.',
  );
}

if (executable.length < MIN_MEASURED_FILES) {
  failures.push(
    `only ${executable.length} file(s) had executable lines; at least ${MIN_MEASURED_FILES} expected. ` +
      'Either coverage.include stopped matching, or real modules turned type-only.',
  );
}

if (totalLines < MIN_MEASURED_LINES) {
  failures.push(
    `only ${totalLines} executable line(s) were measured; at least ${MIN_MEASURED_LINES} expected. ` +
      'A coverage percentage over this little code is not evidence of anything.',
  );
}

if (failures.length > 0) {
  console.error('coverage-floor: FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\n  Measured files:\n' +
      (records.length === 0
        ? '    (none)\n'
        : records.map((r) => `    ${r.file} (LF:${r.found})`).join('\n') + '\n'),
  );
  process.exit(1);
}

console.log(
  `coverage-floor: OK - ${totalLines} executable line(s) across ${executable.length} file(s) ` +
    `(${records.length - executable.length} type-only), floor ${MIN_MEASURED_LINES}.`,
);
