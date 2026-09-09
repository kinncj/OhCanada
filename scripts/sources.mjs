#!/usr/bin/env node
/**
 * sources — re-derive each cached extraction from the document it came from, and
 * check the digest the question bank is granted against.
 *
 * WHAT THIS CLOSES. `content/sources/<id>.json` records `extractedTextSha256`,
 * and every question's `source.sourceHash` IS that digest. Until 2026-09-09 the
 * register recorded nothing about how the extraction was made: no tool, no
 * version, no command. So a contributor could download the correct PDF, match
 * its `sha256` byte for byte, and still be unable to produce a `.txt` that
 * hashes to the recorded value — which means the verbatim check, the
 * quote-contiguity check and the evidence check could not run at all. ADR-0003
 * says a claim about a source must be re-derivable from the cached bytes; it was
 * re-derivable only on a machine that already had the file. `extraction` on the
 * register is the missing record and this is the command that proves it is true.
 *
 * IT RUNS A COMMAND OUT OF A CONTENT FILE, and that is worth saying plainly
 * rather than burying. The command is `extraction.command`, run through `sh -c`
 * from the repository root. Three things bound it:
 *
 *   1. The command must write the extraction to STDOUT. Nothing here passes it
 *      an output path, so a re-run is hashed and compared without overwriting
 *      the working copy, and `--write` is the only way bytes reach content/.
 *   2. Output redirection, command separators and substitutions are REFUSED,
 *      here and in `content/schemas/source.schema.json`. A pipeline is allowed;
 *      `>`, `;`, `&&`, `||`, backticks and `$(...)` are not.
 *   3. It is not in CI and not in the deploy. The documents are git-ignored
 *      (Crown copyright, ADR-0004), so there is nothing for it to read there —
 *      and a workflow that executed a string out of a content file would be a
 *      supply-chain hole in exchange for a check that cannot run.
 *
 * WHAT A FAILURE MEANS, in the one case that matters. If a recorded command runs
 * and its output does NOT hash to `extractedTextSha256`, the fix is never to
 * re-hash the register to match. 389 questions were verified against that digest
 * and re-hashing would silently re-point every one of them at bytes no verifier
 * read. Report it, find the version or the flag that accounts for the
 * difference, or quarantine.
 *
 * Usage:
 *   node scripts/sources.mjs [options]
 *
 *   --root <dir>        run over another tree (the fixtures drive this CLI)
 *   --only <id>         one register
 *   --write             write a re-derived extraction into content/sources/
 *                       when, and only when, it matches the recorded digest
 *   --require-recorded  fail on a register that declares its extraction
 *                       unrecorded, instead of reporting it
 *   --require-source    fail when the source document is absent, instead of
 *                       reporting which registers could not be re-run
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);

const HELP = `sources — re-derive each cached extraction and check its digest

Usage: node scripts/sources.mjs [options]

  --root <dir>        run over another tree
  --only <id>         one register
  --write             write a re-derived extraction into content/sources/ when it
                      matches the digest the register records
  --require-recorded  fail on an extraction whose command was never recorded
  --require-source    fail when the source document is absent
  -h, --help

The source documents are git-ignored, so this target cannot run in CI. It is for
a verifier's machine and for anyone who wants to check the digest 389 questions
are granted against.
`;

if (argv.some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

const flagValue = (name) => {
  const at = argv.indexOf(name);
  if (at === -1) return null;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`sources: ${name} needs a value`);
    process.exit(2);
  }
  return value;
};

const ROOT =
  flagValue('--root') === null
    ? fileURLToPath(new URL('..', import.meta.url))
    : resolve(flagValue('--root'));
const ONLY = flagValue('--only');
const WRITE = argv.includes('--write');
const REQUIRE_RECORDED = argv.includes('--require-recorded');
const REQUIRE_SOURCE = argv.includes('--require-source');

const SOURCES_DIR = join(ROOT, 'content', 'sources');

const failures = [];
const fail = (message) => failures.push(message);
const say = (message) => console.log(`sources: ${message}`);

const str = (value) => (typeof value === 'string' ? value : null);
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * The same refusal the schema makes, restated at the point of execution.
 * Defence in depth on purpose: the schema is what a contributor's editor and
 * `make validate-content` enforce, and this is what stands between a register
 * edited outside either and `sh -c`.
 */
const FORBIDDEN = /[>;`]|\$\(|\|\||&&/;

const tally = { registers: 0, recorded: 0, reproduced: 0, unrecorded: 0, notRun: 0, written: 0 };

const manifests = existsSync(SOURCES_DIR)
  ? readdirSync(SOURCES_DIR)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => ({ name, path: join(SOURCES_DIR, name) }))
  : [];

if (manifests.length === 0) {
  console.error(
    `sources: ${relative(ROOT, SOURCES_DIR) || SOURCES_DIR} holds no source register. There is ` +
      `nothing to re-derive, which is not the same as everything being reproducible — a run over ` +
      `an empty directory must not read as a pass (ADR-0024).`,
  );
  process.exit(1);
}

for (const { name, path } of manifests) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${name}: is not parseable JSON — ${String(error)}`);
    continue;
  }
  const id = str(manifest.id) ?? name.replace(/\.json$/u, '');
  if (ONLY !== null && id !== ONLY) continue;

  const extractedText = str(manifest.extractedText);
  if (extractedText === null) {
    say(`${id}: no extraction (the register cites the document itself), nothing to re-derive.`);
    continue;
  }
  tally.registers += 1;

  const declared = str(manifest.extractedTextSha256);
  const extraction = isObject(manifest.extraction) ? manifest.extraction : null;

  if (extraction === null) {
    fail(
      `${id}: declares extractedText "${extractedText}" and no "extraction" block, so nothing ` +
        `records how those bytes were produced and ${declared ?? 'its digest'} cannot be ` +
        `reproduced by anyone who does not already have the file. ` +
        `content/schemas/source.schema.json requires one — run make validate-content.`,
    );
    continue;
  }

  if (extraction.unrecorded === true) {
    tally.unrecorded += 1;
    const message =
      `${id}: NOT REPRODUCIBLE — the register declares the extraction unrecorded. ` +
      `${str(extraction.reason) ?? '(no reason given)'}`;
    if (REQUIRE_RECORDED) fail(message);
    else say(message);
    continue;
  }

  tally.recorded += 1;
  const tool = str(extraction.tool) ?? '(unnamed tool)';
  const version = str(extraction.version) ?? '(unrecorded version)';
  const command = str(extraction.command);
  if (command === null) {
    fail(`${id}: the extraction block records no command.`);
    continue;
  }
  if (FORBIDDEN.test(command)) {
    fail(
      `${id}: the recorded command contains an output redirection, a command separator or a ` +
        `substitution, and will not be run: ${command}. The command must read the source document ` +
        `and write the extraction to stdout, so that a re-run can be hashed without being able to ` +
        `write anywhere.`,
    );
    continue;
  }

  const file = str(manifest.file);
  const filePath = file === null ? null : join(SOURCES_DIR, file);
  if (filePath === null || !existsSync(filePath)) {
    tally.notRun += 1;
    const message =
      `${id}: cannot re-run the extraction — ${file === null ? 'the register names no file' : `content/sources/${file} is not on disk`}. ` +
      `The documents are git-ignored (Crown copyright, ADR-0004), so this is expected in a fresh ` +
      `checkout and in CI. Fetch it from ${str(manifest.url) ?? 'the url in the register'}, check ` +
      `its sha256, and run this again. The command that would have run: ${command}`;
    if (REQUIRE_SOURCE) fail(message);
    else say(message);
    continue;
  }

  // The document first. A command re-derived from the wrong edition would
  // produce a digest mismatch that reads as a broken extractor, and the register
  // already says what to do here: stop.
  const fileSha = sha256(readFileSync(filePath));
  const declaredFileSha = str(manifest.sha256);
  if (declaredFileSha !== null && fileSha !== declaredFileSha) {
    fail(
      `${id}: content/sources/${String(file)} hashes to ${fileSha} and the register declares ` +
        `${declaredFileSha}. Either the document changed or this is a different edition, and in ` +
        `both cases every claim verified against the old digest is due for re-checking. Do not ` +
        `re-hash the register to match — that re-points the claims at bytes nobody read.`,
    );
    continue;
  }

  // What extractor is actually here? Reported whether or not the digests agree:
  // when they do, it is evidence the recorded digest survives this version; when
  // they do not, it is the first thing to compare.
  const versionCommand = str(extraction.versionCommand);
  let localVersion = null;
  if (versionCommand !== null && !FORBIDDEN.test(versionCommand)) {
    const probe = spawnSync('sh', ['-c', versionCommand], { cwd: ROOT, encoding: 'utf8' });
    localVersion = `${probe.stdout ?? ''}${probe.stderr ?? ''}`.split('\n')[0]?.trim() ?? null;
  }

  const run = spawnSync('sh', ['-c', command], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) {
    fail(
      `${id}: the recorded command exited ${String(run.status)} — ${command}\n` +
        `      ${String(run.stderr ?? '').split('\n').slice(0, 3).join('\n      ')}\n` +
        `      Recorded tool: ${tool} ${version}${localVersion === null ? '' : `; here: ${localVersion}`}`,
    );
    continue;
  }

  const produced = run.stdout;
  const producedSha = sha256(produced);
  if (declared !== null && producedSha !== declared) {
    fail(
      `${id}: the recorded command produced ${String(produced.length)} byte(s) hashing to ` +
        `${producedSha}, and the register declares extractedTextSha256 ${declared}. ` +
        `Recorded tool: ${tool} ${version}${localVersion === null ? '' : `; here: ${localVersion}`}. ` +
        `The document itself matched its sha256, so this is the EXTRACTOR disagreeing, not the ` +
        `source moving. DO NOT re-hash the register: every claim carrying that digest was granted ` +
        `against the old bytes, and re-hashing re-points all of them at bytes no verifier read. ` +
        `Find the version or the flag that accounts for the difference and record it, or say so.`,
    );
    continue;
  }

  tally.reproduced += 1;
  const target = join(SOURCES_DIR, extractedText);
  const onDisk = existsSync(target) ? sha256(readFileSync(target)) : null;
  if (WRITE && onDisk !== producedSha) {
    writeFileSync(target, produced);
    tally.written += 1;
  }
  say(
    `${id}: reproduced — ${tool} ${version}${localVersion === null ? '' : ` (here: ${localVersion})`} ` +
      `-> ${producedSha.slice(0, 16)}… matches the register` +
      `${WRITE && onDisk !== producedSha ? `, written to content/sources/${extractedText}` : ''}` +
      `${!WRITE && onDisk !== producedSha ? `; content/sources/${extractedText} on disk differs — pass --write to replace it` : ''}.`,
  );
}

say(
  `${String(tally.registers)} register(s) with an extraction — ${String(tally.recorded)} record a ` +
    `command, of which ${String(tally.reproduced)} reproduced the recorded digest here and ` +
    `${String(tally.notRun)} could not be run because the document is absent; ` +
    `${String(tally.unrecorded)} declare NO command and cannot be reproduced by anyone.` +
    `${tally.written > 0 ? ` ${String(tally.written)} file(s) written.` : ''}`,
);
if (tally.registers > 0 && tally.reproduced === 0) {
  say(
    `NOTHING WAS RE-DERIVED on this run, so nothing above is evidence that any digest is ` +
      `reproducible. That is the CI and fresh-checkout case; on a machine with the documents it is a ` +
      `finding.`,
  );
}

if (failures.length > 0) {
  console.error('');
  for (const message of failures) console.error(`sources: FAIL: ${message}`);
  console.error('');
  console.error(`sources: ${String(failures.length)} failure(s).`);
  process.exit(1);
}

say('OK.');
