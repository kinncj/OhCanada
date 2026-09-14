#!/usr/bin/env node
/**
 * record-perf-device - turn one run of the DEVICE perf lane into a dated record.
 *
 * The CI perf job cannot measure frame time (a runner has no GPU), so it prints
 * "NOT CHECKED HERE" and the last device pass on every run. This script is how a
 * device pass comes to exist: run `make test-perf-device` on real hardware, then
 *
 *     make record-perf-device DEVICE="Framework 13, Radeon 780M, Chromium 141"
 *
 * and commit tests/perf/device-record.json. Passes are APPENDED, newest first,
 * never edited: a record that could be rewritten after the fact is the thing
 * the blind-art protocol refuses too.
 *
 * It refuses, rather than writes, when the run cannot be a device pass:
 *
 *   - no verdict file, or one that settled zero budgets (ADR-0024);
 *   - a CI-lane verdict file - the engine-cost budget is absent, so this is
 *     `make test-perf` output and says nothing about frame time;
 *   - a run the lane itself refused because the host rasterises in software.
 *     A refused run is not a pass, and recording it would put a device name
 *     beside a measurement that was never taken;
 *   - DEVICE empty. An unnamed device is not a record of anything.
 *
 * It records what it cannot vouch for, instead of hiding it: the commit, and
 * whether the working tree was DIRTY when the run was recorded.
 *
 * A laptop pass is not an iPhone 13 pass. A pass taken by hand on a phone uses
 * the same record shape with `method: "manual"`; tests/perf/README.md says how.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERDICTS = `${ROOT}test-results/perf-verdicts.json`;
const RECORD = `${ROOT}tests/perf/device-record.json`;
const ENGINE_BUDGET = /^engine cost per frame/;

const argv = process.argv.slice(2);
const option = (name) => {
  const at = argv.indexOf(name);
  return at !== -1 && at + 1 < argv.length ? argv[at + 1] : undefined;
};
const refuse = (why) => {
  console.error(`record-perf-device: REFUSED - ${why}`);
  console.error('record-perf-device: nothing was written.');
  process.exit(1);
};
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const device = (option('--device') ?? '').trim();
if (device === '') refuse('DEVICE is empty. Name the hardware: make record-perf-device DEVICE="<machine, GPU, browser>"');
if (!existsSync(VERDICTS)) refuse(`${VERDICTS} does not exist. Run make test-perf-device first.`);

let run;
try {
  run = JSON.parse(readFileSync(VERDICTS, 'utf8'));
} catch (error) {
  refuse(`${VERDICTS} did not parse (${String(error)})`);
}

const results = [...(run.held ?? []), ...(run.breached ?? []), ...(run.notMeasured ?? [])].map((row) => ({
  test: row.test,
  ...row.verdict,
}));
if (results.length === 0) refuse('the run settled zero budgets, which is not a measurement of anything (ADR-0024)');

const engine = results.find((r) => ENGINE_BUDGET.test(r.budget ?? ''));
if (engine === undefined) {
  refuse('no engine-cost verdict in the run: this is CI-lane output (make test-perf), not the device lane');
}
const software = results.find((r) => r.status === 'not-measured' && /rasterises in software/.test(r.detail ?? ''));
if (software !== undefined) {
  refuse(`the lane refused this host: ${software.detail}`);
}

const renderer = /on (ANGLE \(.*?\)|[^;]+?);/.exec(engine.detail ?? '')?.[1] ?? 'not reported';
const pass = {
  recordedOn: new Date().toISOString().slice(0, 10),
  method: 'make test-perf-device',
  device,
  renderer,
  commit: git('rev-parse', 'HEAD') || 'unknown',
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  recordedBy: git('config', 'user.name') || 'unknown',
  note: option('--note') ?? '',
  results,
};

let record = { $comment: 'Device perf passes, newest first. Appended by scripts/record-perf-device.mjs; never edited. Shape and protocol: tests/perf/README.md.', passes: [] };
if (existsSync(RECORD)) {
  try {
    record = JSON.parse(readFileSync(RECORD, 'utf8'));
    if (!Array.isArray(record.passes)) refuse(`${RECORD} has no passes[] array; fix it by hand rather than letting this overwrite it`);
  } catch (error) {
    refuse(`${RECORD} did not parse (${String(error)}); fix it by hand rather than letting this overwrite it`);
  }
}
record.passes.unshift(pass);
writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`);

const counts = ['held', 'breached', 'not-measured']
  .map((status) => `${results.filter((r) => r.status === status).length} ${status}`)
  .join(', ');
console.log(`record-perf-device: recorded ${pass.recordedOn} on ${device} (${renderer}) at ${pass.commit.slice(0, 12)}${pass.dirty ? ' with a DIRTY tree' : ''}: ${counts}.`);
console.log(`record-perf-device: ${record.passes.length} pass(es) in tests/perf/device-record.json. Commit it.`);
