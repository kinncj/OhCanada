#!/usr/bin/env node
/**
 * verify-art — the harness for blind art identification. NOT the identifier.
 *
 * WHAT THIS PROVES
 *
 *   That a STATED VERDICT MATCHES A CONTRACT. Given an identifier's verdicts,
 *   this joins them to a keymap the identifier never read and scores them
 *   against `assets/refs/references.json`: the unprompted answer must contain
 *   one of `expectedBlindAnswer`, every `mustBeRight` feature must have been
 *   audited and found present, and nothing from `neverAdd` may be present.
 *
 *   And, on every run whether or not anyone is identifying anything: that an
 *   anonymised hand-off can still be BUILT from today's tree. Every subject
 *   rasterises, every composite assembles, no render source draws text, no
 *   handed-over file carries a leaking token, no PNG carries metadata, and every
 *   opaque name is sixteen hex characters and nothing else.
 *
 * WHAT THIS DOES NOT PROVE
 *
 *   THAT THE VERDICT WAS MADE BLIND. Only the hand-off can give that, and only
 *   if it held. The hand-off holds when the identifier is handed one directory
 *   of hashed filenames and does not go looking for the source tree, the
 *   contract or the keymap. No amount of scoring downstream can recover it, and
 *   the reason this file exists is that A LEAKED RUN LOOKS EXACTLY LIKE A CLEAN
 *   ONE IN THE OUTPUT. On 2026-09-08 the first pass could not run blind — it had
 *   to locate the renders to rasterise them, and the source listing spells one
 *   subject out in a filename — and it marked every verdict untrusted rather
 *   than report a pass it could not stand behind.
 *
 * THIS FILE IS PART OF THE LEAK SURFACE, AND NAMES NO SUBJECT
 *
 *   The second run leaked through the OPERATOR-FACING TEXT rather than the
 *   images: `art-handoff` printed two of the three subject ids in its progress
 *   output, `--help` named a third in an option description, and this header
 *   named a render's source file. The identifier had read all of it before it
 *   saw a pixel, so the run was not open-set and the verifier honestly
 *   downgraded its own verdicts to `trusted-with-caveat`. So no subject id, no
 *   render source filename and no candidate answer appears in this file or in
 *   anything it prints, and a test asserts it against the real contract.
 *
 *   scripts/lib/art-handoff.mjs cannot be scrubbed to nothing — its recipe table
 *   is KEYED by subject id, which is code, not prose. Its prose names none, and
 *   an identifier has no more business opening it than opening the contract.
 *
 *   `--quiet` goes further and prints counts, totals and the run id with no
 *   subject id at all, so the harness is safe to run AS the identifier when
 *   there is no second party. The loud mode is for whoever runs it FOR someone.
 *
 *   The one sliver of blindness this can prove is the commitment: `commit`
 *   records the hash of the answers before `reveal` opens the keymap, and
 *   `score` re-checks it. That says the answers were not revised once the answer
 *   key was open. It says nothing about what was read before they were written.
 *
 * WHY THERE IS NO IDENTIFIER IN HERE
 *
 *   Naming what a render depicts is the art-verifier's judgement and cannot be
 *   automated; that is the whole point of the role. A `verify-art` that scored
 *   its own answers would be the machine equivalent of the author verifying
 *   their own question, which ADR-0003 exists to forbid. So the seam is data: a
 *   verdict comes IN.
 *
 * THE STAGES, and which of them the identifier may run
 *
 *   handoff   builds the images and the keymap.        NOT the identifier.
 *   (identify) the identifier reads only <out>/handoff and writes answers.json.
 *   commit    records the hash of answers.json.        NOT the identifier.
 *   reveal    prints the mapping.                      after commit only.
 *   score     joins and scores.                        NOT the identifier.
 *
 * TODAY'S DEFAULT (`make verify-art`, and CI)
 *
 *   No harness-shaped verdict record exists yet — docs/art-verification.json
 *   holds the hand pass, which says of itself `blindnessHeld: false`. So the
 *   default run builds and leak-checks the hand-off, and reports
 *   `identification: NOT ESTABLISHED` in the same breath as it reports OK. It
 *   does not print a bare "OK", because that is the shape of the lie this whole
 *   task is about. `--require-identification` turns the missing record into a
 *   failure, and is how this becomes fully gating once a clean run is recorded.
 */

import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildHandoff,
  loadContract,
  readKeymap,
  sha256Of,
} from './lib/art-handoff.mjs';
import { scoreRun } from './lib/art-score.mjs';

const HELP = `verify-art — harness for blind art identification (it is not the identifier)

Usage:
  node scripts/verify-art.mjs [gate] [options]      build + leak-check, then score any record
  node scripts/verify-art.mjs handoff  --out DIR    build an anonymised hand-off and keep it
  node scripts/verify-art.mjs commit   --keymap K --answers A
  node scripts/verify-art.mjs reveal   --keymap K
  node scripts/verify-art.mjs score    --keymap K --answers A --audit U
  node scripts/verify-art.mjs score    --record R

Options:
  --root DIR                repository root (default: this script's repository)
  --out DIR                 hand-off root; images go to DIR/handoff, keymap to DIR/keymap.json
  --keymap PATH             keymap path. Pass one OUTSIDE --out for a stronger hand-off.
  --record PATH             a verdict record with a \`handoffRun\` block
                            (default: docs/art-verification.json)
  --seed STRING             deterministic salt. FOR TESTS ONLY: a seeded run has
                            reproducible opaque names, which is the thing they exist not to be.
  --variants N              figures per composite-character subject, each with a
                            different skin and hair choice (default 2)
  --force                   clear a non-empty --out/handoff instead of refusing it
  --quiet                   print counts, totals and the run id only, naming no
                            subject. Use this when you are the identifier.
  --no-ladder               skip the size-ladder probes
  --require-identification  fail when no harness-shaped verdict record can be scored
  --keep                    in gate mode, keep the scratch hand-off and print where it is
  --help, -h                this text

Exit 0 only when the hand-off builds, nothing leaks into it, the contract is
coherent, at least one subject is renderable, and every verdict that was
supplied matches the contract.
`;

const argv = process.argv.slice(2);
if (argv.some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

const flag = (name) => argv.includes(name);
// `lastIndexOf`, so a later flag overrides an earlier one. `indexOf` was here
// first and a caller that appended `--seed` to a command line that already had
// one got the FIRST value, silently -- which in a harness whose whole job is
// unlinkable naming meant two "different" runs quietly shared a salt. Found by
// the test that asserts two runs name the same picture differently.
const option = (name, fallback = null) => {
  const at = argv.lastIndexOf(name);
  return at !== -1 && at + 1 < argv.length ? argv[at + 1] : fallback;
};

const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'gate';
const root = resolve(option('--root', fileURLToPath(new URL('..', import.meta.url))));
const seed = option('--seed');
const variants = Number(option('--variants', '2'));
const sizeLadder = !flag('--no-ladder');
const force = flag('--force');
const quiet = flag('--quiet');

const die = (message) => {
  console.error(`verify-art: ${message}`);
  process.exit(1);
};

const report = (failures) => {
  if (failures.length === 0) return;
  console.error('verify-art: FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`verify-art: ${failures.length} failure(s).`);
  process.exit(1);
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/**
 * Numbers, not adjectives -- the other gates in this repo report figures.
 *
 * `quiet` drops every figure that is a NAME. What survives is genuinely
 * informative and says nothing about what is in the pictures: how many renders,
 * how many subjects, how many gate, how many are diagnostic, how many megapixels,
 * how many distinct skin and hair choices the character variation produced, and
 * how many subjects are unrendered. An operator can tell a good run from a
 * broken one on those alone, which is the whole requirement.
 */
function printHandoffSummary(keymap, { where = null } = {}) {
  const subjects = new Set(keymap.entries.map((e) => e.subjectId));
  const gating = keymap.entries.filter((e) => e.gating);
  const figures = keymap.entries.filter((e) => e.slots?.skin !== undefined);
  const skins = new Set(figures.map((e) => e.slots.skin));
  const hairs = new Set(figures.map((e) => `${e.slots.hairShape}-${e.slots.hairColour}`));
  const px = keymap.entries.reduce((sum, e) => sum + e.width * e.height, 0);
  const bytes = keymap.entries.reduce((sum, e) => sum + (e.bytes ?? 0), 0);

  console.log(
    `verify-art: hand-off run ${keymap.runId} - ${keymap.entries.length} render(s) over ` +
      `${subjects.size} subject(s): ${gating.length} gating, ` +
      `${keymap.entries.length - gating.length} diagnostic, ` +
      `${(px / 1e6).toFixed(1)} Mpx, ${(bytes / 1e6).toFixed(1)} MB on disk.`,
  );
  if (figures.length > 0) {
    console.log(
      `verify-art: ${figures.length} character figure(s), ${skins.size} skin tone(s) and ` +
        `${hairs.size} hair combination(s) this run` +
        (quiet ? '.' : ` (${[...skins].join(', ')}; ${[...hairs].join(', ')}).`),
    );
  }
  if (quiet) {
    if (keymap.unrendered.length > 0) {
      console.log(
        `verify-art: ${keymap.unrendered.length} subject(s) UNRENDERED by decision - ` +
          `neither a pass nor a failure, and not handed over.`,
      );
    }
  } else {
    for (const entry of keymap.unrendered) {
      console.log(
        `verify-art: ${entry.subjectId} is UNRENDERED by decision - not a pass and not a failure.`,
      );
    }
  }
  console.log(
    'verify-art: anonymisation held - every render name is 16 hex characters, no ' +
      'handed-over file carries a leaking token, no PNG carries metadata, every ' +
      "render is length-padded so file size cannot relink it, and the keymap is " +
      "outside the identifier's working directory.",
  );
  if (where) console.log(`verify-art: hand-off at ${where}`);
  if (quiet) {
    console.log(
      'verify-art: quiet mode - nothing above names a subject, so this is safe to run ' +
        'as the identifier. What is still on you: do not open the keymap, the source ' +
        'tree, the contract, or the source of this harness, until after `commit`.',
    );
  }
}

function printScore(result) {
  const t = result.totals;
  console.log(
    `verify-art: scored ${t.subjectsPassed}/${t.subjectsScored} subject(s), ` +
      `${t.gatingRenders} gating and ${t.diagnosticRenders} diagnostic render(s), ` +
      `${t.featuresChecked} mustBeRight feature(s) confirmed present, ` +
      `${t.featuresUncheckable} uncheckable, ` +
      `${t.subjectsUnrendered} unrendered by decision.`,
  );
  // Scoring happens after the reveal, so naming subjects here is not a leak --
  // but `--quiet` is asked for by an identifier who may still be mid-run, so it
  // is honoured everywhere rather than only where it is strictly needed.
  for (const row of quiet ? [] : result.scored) {
    console.log(
      `verify-art:   ${row.pass ? 'PASS' : 'FAIL'} ${row.subjectId} - ` +
        `identified on ${row.gatingRenders} gating render(s), ` +
        `${row.featuresPresent}/${row.featuresRequired} features present, ` +
        `${row.featuresUncheckable} uncheckable, ` +
        `${row.diagnosticMatched}/${row.diagnosticRenders} diagnostic probe(s) still identified.`,
    );
  }
  console.log(
    'verify-art: this scores a STATED verdict against the contract. It does not ' +
      'establish that the verdict was made blind; only the hand-off gives that.',
  );
}

/* ------------------------------------------------------------------ */

if (command === 'handoff') {
  const out = option('--out');
  if (!out) die('handoff needs --out DIR');
  const outDir = resolve(out);
  const handoffDir = join(outDir, 'handoff');
  const keymapPath = resolve(option('--keymap', join(outDir, 'keymap.json')));

  const { keymap, failures } = await buildHandoff({
    root,
    handoffDir,
    keymapPath,
    seed,
    variants,
    sizeLadder,
    force,
    // The operator named this directory, so it is the identifier's working
    // area and a previous run's artefacts in it are reachable during this
    // run's blind phase. The gate path below passes nothing: its parent is the
    // system temp directory.
    workingArea: outDir,
  });
  report(failures);
  printHandoffSummary(keymap, { where: handoffDir });
  console.log(`verify-art: keymap at ${keymapPath} - DO NOT HAND THIS OVER.`);
  console.log(
    `verify-art: hand over ${handoffDir} and nothing else. Next: the identifier fills ` +
      `${join(handoffDir, 'answers.json')}, then \`verify-art commit\`.`,
  );
  process.exit(0);
}

if (command === 'commit') {
  const keymapPath = option('--keymap');
  const answersPath = option('--answers');
  if (!keymapPath || !answersPath) die('commit needs --keymap and --answers');
  const keymap = readKeymap(keymapPath);
  if (keymap.committedAnswersSha256) die('this run is already committed; answers are frozen');
  const hash = sha256Of(readFileSync(answersPath));
  const answers = readJson(answersPath);
  const missing = keymap.entries.filter(
    (entry) =>
      !(answers.identifications ?? []).some(
        (item) => item.render === entry.render && String(item.answer ?? '').trim() !== '',
      ),
  );
  if (missing.length > 0) {
    die(
      `${missing.length} render(s) have no answer. Commit freezes the blind pass, so ` +
        `it may not freeze a half-finished one.`,
    );
  }
  keymap.committedAnswersSha256 = hash;
  keymap.committedAt = new Date().toISOString();
  writeFileSync(keymapPath, `${JSON.stringify(keymap, null, 2)}\n`);
  console.log(`verify-art: committed ${keymap.entries.length} answer(s), sha256 ${hash}.`);
  console.log('verify-art: the blind pass is frozen. `verify-art reveal` now opens the keymap.');
  process.exit(0);
}

if (command === 'reveal') {
  const keymapPath = option('--keymap');
  if (!keymapPath) die('reveal needs --keymap');
  const keymap = readKeymap(keymapPath);
  if (!keymap.committedAnswersSha256) {
    die('nothing is committed. Reveal before commit would make the blind pass unfalsifiable.');
  }
  keymap.revealedAt = keymap.revealedAt ?? new Date().toISOString();
  writeFileSync(keymapPath, `${JSON.stringify(keymap, null, 2)}\n`);
  for (const entry of keymap.entries) {
    console.log(`${entry.render}  ${entry.subjectId}  ${entry.probe}`);
  }
  for (const entry of keymap.unrendered) console.log(`(no render)  ${entry.subjectId}`);
  process.exit(0);
}

if (command === 'score') {
  const { references } = loadContract({ root });
  let keymap;
  let answers;
  let audit;

  const recordPath = option('--record');
  if (recordPath) {
    const record = readJson(recordPath);
    const run = record.handoffRun;
    if (!run) die(`${recordPath} carries no \`handoffRun\` block`);
    ({ keymap, answers, audit } = run);
    // A bundled record carries its own keymap, so the commitment in it is
    // SELF-ATTESTED: whoever wrote the record could have written a matching hash.
    // The commitment only binds a LIVE run, where the keymap was written by this
    // harness before the answers existed. Saying so is cheaper than letting the
    // stronger property be assumed.
    console.warn(
      'verify-art: NOTE - a bundled record attests to itself. The commitment binds ' +
        'a live run (--keymap/--answers), not a record checked into the tree; what ' +
        'is checked here is internal consistency, not provenance.',
    );
  } else {
    const keymapPath = option('--keymap');
    const answersPath = option('--answers');
    const auditPath = option('--audit');
    if (!keymapPath || !answersPath || !auditPath) {
      die('score needs --keymap, --answers and --audit, or a bundled --record');
    }
    keymap = readKeymap(keymapPath);
    answers = readJson(answersPath);
    audit = readJson(auditPath);
    if (keymap.committedAnswersSha256) {
      const now = sha256Of(readFileSync(answersPath));
      if (now !== keymap.committedAnswersSha256) {
        die(
          'the answers changed after they were committed. The blind pass is written ' +
            'once and not edited afterwards; a revision made with the answer key open ' +
            'is not a blind answer.',
        );
      }
    } else {
      console.warn(
        'verify-art: WARNING - this run was never committed, so nothing shows the ' +
          'answers predate the reveal.',
      );
    }
  }

  const result = scoreRun({ references, keymap, answers, audit });
  report(result.failures);
  for (const entry of result.stale) console.log(`verify-art: STALE - ${entry}`);
  printScore(result);
  process.exit(result.stale.length > 0 && flag('--require-identification') ? 1 : 0);
}

if (command !== 'gate') die(`unknown command "${command}". Try --help.`);

/* ------------------------------------------------------------------ *
 * gate — what `make verify-art` and CI run.
 * ------------------------------------------------------------------ */

// Two separate scratch roots, not two subdirectories of one. The keymap must not
// be a sibling an idle `ls ..` would find.
const handoffRoot = mkdtempSync(join(tmpdir(), 'verify-art-handoff-'));
const keymapRoot = mkdtempSync(join(tmpdir(), 'verify-art-keymap-'));
const handoffDir = join(handoffRoot, 'handoff');
const keymapPath = join(keymapRoot, 'keymap.json');

let keymap;
let failures;
try {
  ({ keymap, failures } = await buildHandoff({
    root,
    handoffDir,
    keymapPath,
    seed,
    variants,
    sizeLadder,
    force: true, // a fresh mkdtemp, so there is never anything to refuse
  }));
} catch (error) {
  if (!flag('--keep')) {
    rmSync(handoffRoot, { recursive: true, force: true });
    rmSync(keymapRoot, { recursive: true, force: true });
  }
  die(`the hand-off could not be built: ${error.message}`);
}

if (failures.length > 0) {
  if (!flag('--keep')) {
    rmSync(handoffRoot, { recursive: true, force: true });
    rmSync(keymapRoot, { recursive: true, force: true });
  }
  report(failures);
}

printHandoffSummary(keymap, { where: flag('--keep') ? handoffDir : null });
if (!flag('--keep')) {
  rmSync(handoffRoot, { recursive: true, force: true });
  rmSync(keymapRoot, { recursive: true, force: true });
}

const recordPath = resolve(option('--record', join(root, 'docs', 'art-verification.json')));
const strict = flag('--require-identification');

if (!existsSync(recordPath)) {
  const message = `no verdict record at ${recordPath}; identification is NOT ESTABLISHED.`;
  if (strict) die(message);
  console.log(`verify-art: ${message}`);
} else {
  const record = readJson(recordPath);
  if (!record.handoffRun) {
    // docs/art-verification.json today is the hand pass, and it says of itself
    // `blindnessHeld: false`. Reading it and reporting what it says is more
    // honest than either scoring it (it is not keyed to a hand-off) or ignoring
    // it (it is the only art verification that exists).
    const held = record.runIntegrity?.blindnessHeld;
    const message =
      `${recordPath} predates this harness (no \`handoffRun\` block` +
      (held === false ? ', and reports `blindnessHeld: false`' : '') +
      '); identification is NOT ESTABLISHED.';
    if (strict) die(message);
    console.log(`verify-art: ${message}`);
  } else {
    const { references } = loadContract({ root });
    const run = record.handoffRun;
    const result = scoreRun({
      references,
      keymap: run.keymap,
      answers: run.answers,
      audit: run.audit,
    });
    report(result.failures);
    if (result.stale.length > 0) {
      // Scored clean on everything the record COULD answer, and the contract has
      // since asked for something its hand-off did not contain. Neither a pass
      // nor a failure, and reported as loudly as either.
      for (const entry of result.stale) console.log(`verify-art: STALE - ${entry}`);
      const message =
        `${recordPath} is STALE: ${result.stale.length} entr(y/ies) could not be checked ` +
        `by the hand-off it was made from; identification is NOT ESTABLISHED for those.`;
      if (strict) die(message);
      console.log(`verify-art: ${message}`);
    }
    printScore(result);
  }
}

console.log(
  'verify-art: OK - the anonymised hand-off builds and nothing leaks into it. ' +
    'That is what this gate establishes. Blindness itself is a property of how the ' +
    'hand-off is USED, and no output can prove it after the fact.',
);
process.exit(0);
