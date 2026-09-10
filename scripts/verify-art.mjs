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
 *   And that the verdict is STILL ABOUT THE ART IN THE TREE. Every keymap entry
 *   records the digest of the SVG bytes it was drawn from; scoring re-derives
 *   them. A verdict whose art has been redrawn under it is STALE, is not scored,
 *   and FAILS -- because a record that stayed green while the art moved is a
 *   verification of a picture nobody can see any more, and it reads in the
 *   output exactly like a verification of the picture on disk.
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
  sourceDigestReader,
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
coherent, at least one subject is renderable, every verdict that was supplied
matches the contract, AND every verdict is still about the art that is in the
tree today. A verdict whose art has been redrawn under it exits 1 with or
without --require-identification: nobody has looked at the new picture, so
there is nothing for exit 0 to mean.
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

  /* ---------------------------------------------------------------- *
   * NOT APPLICABLE, WHICH IS NEITHER A PASS NOR A FAILURE
   * ---------------------------------------------------------------- */
  /*
   * One artboard in the contract is not a person. Its fills are hide and felt
   * rather than a `skin-1`..`skin-6` ramp, and the corresponding row of
   * docs/content-review.md 6.2 -- "every skin fill is a skin ramp entry" --
   * GENUINELY CANNOT APPLY TO IT. art recorded that as an exemption for one
   * non-human artboard, so a verifier scores it NOT APPLICABLE rather than
   * FAILED, and the harness has to be able to say the difference out loud.
   *
   * TWO THINGS FOLLOW, and the first is the one that would otherwise be silent:
   *
   *   - the slots that cannot apply DO NOT COUNT AS COVERAGE. They take the
   *     rig's fallback, so counting them here would report one more tone
   *     exercised than any run exercised, on an artboard where the tone is
   *     drawn and then painted over. That is a green number about something
   *     nobody can see, which is the shape of every failure this harness
   *     exists to refuse.
   *   - and they are PRINTED, under their own word. Silence would read as
   *     "nothing to say about that artboard", which is what a failure that was
   *     never checked also looks like.
   *
   * The hand-off does not take the exemption on trust: scripts/lib/art-handoff.mjs
   * re-derives it from the rig's z order and part windows on every run, and a
   * claim that has stopped holding is a build failure, not a quieter line here.
   *
   * ONE FIGURE, ONE ROW. `probe === 'full'` because the size-ladder rungs are
   * the SAME figure at smaller sizes; counting each of them as a character
   * figure reported three times as many as any run built.
   */
  const figures = keymap.entries.filter((e) => e.probe === 'full' && e.slots?.skin !== undefined);
  const inertOf = (entry) => entry.slots?.inertSlots ?? [];
  const varying = figures.filter((entry) => !inertOf(entry).includes('skin'));
  const skins = new Set(varying.map((e) => e.slots.skin));
  const hairs = new Set(varying.map((e) => `${e.slots.hairShape}-${e.slots.hairColour}`));

  const notApplicable = new Map();
  for (const entry of keymap.entries) {
    if (inertOf(entry).length === 0) continue;
    const seen = notApplicable.get(entry.subjectId) ?? new Set();
    for (const slot of inertOf(entry)) seen.add(slot);
    notApplicable.set(entry.subjectId, seen);
  }
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
      `verify-art: ${figures.length} character figure(s), ${varying.length} of them with a ` +
        `skin ramp to vary: ${skins.size} skin tone(s) and ${hairs.size} hair ` +
        `combination(s) this run` +
        (quiet ? '.' : ` (${[...skins].join(', ')}; ${[...hairs].join(', ')}).`),
    );
  }
  if (notApplicable.size > 0) {
    const slots = new Set([...notApplicable.values()].flatMap((set) => [...set]));
    console.log(
      `verify-art: ${notApplicable.size} artboard(s) carry ${slots.size} slot(s) that are NOT ` +
        `APPLICABLE - drawn and then wholly covered by a later part of that costume, ` +
        `re-derived from the rig's z order and part windows this run. Neither a pass nor a ` +
        `failure: a check that CANNOT apply (docs/content-review.md 6.2, "every skin fill is ` +
        `a skin-1..skin-6 ramp entry") is scored n/a, and it is counted in no total above.`,
    );
    for (const [subjectId, slotNames] of quiet ? [] : notApplicable) {
      console.log(`verify-art:   N/A ${subjectId} - ${[...slotNames].sort().join(', ')}.`);
    }
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
    // "in this record" NAMES THE DENOMINATOR, and it is there because the two
    // numbers collided the day the contract outgrew the record twice over: the
    // line read "scored 7/10 subject(s) ... 10 in the contract and not in this
    // record at all", and the two tens are different sets that happen to be the
    // same size. The whole point of printing both is that the DIFFERENCE is the
    // finding, which a reader cannot see if the ratio's denominator is unnamed.
    `verify-art: scored ${t.subjectsPassed}/${t.subjectsScored} subject(s) in this record, over ` +
      `${t.rendersScored}/${t.renders} render(s) whose art is unchanged since the verdict, ` +
      `${t.gatingRenders} gating and ${t.diagnosticRenders} diagnostic, ` +
      `${t.featuresChecked} mustBeRight feature(s) confirmed present, ` +
      `${t.featuresUncheckable} uncheckable, ` +
      `${t.rendersStaleArt} NOT re-checked because the art moved, ` +
      `${t.subjectsUnrendered} unrendered by decision, ` +
      // Beside the scored count and not folded into it: a record can score
      // every subject it holds and still be a record about most of the art.
      `${t.subjectsNotInRecord} in the contract and not in this record at all.`,
  );
  // Scoring happens after the reveal, so naming subjects here is not a leak --
  // but `--quiet` is asked for by an identifier who may still be mid-run, so it
  // is honoured everywhere rather than only where it is strictly needed.
  for (const row of quiet ? [] : result.scored) {
    // THREE LABELS, NOT TWO. `PASS`/`FAIL` alone cannot say "nobody looked", and
    // a subject printed FAIL reads as a judgement that was made. STALE says a
    // judgement was NOT made -- and where the last one that WAS made was a
    // failure, the row says so, because a redraw must never be a way to stop a
    // defect printing.
    if (row.state === 'stale') {
      // A STALE ROW REPORTS THE CLAIM, NOT A RESULT, and every number on it is
      // phrased as something the record SAID. Printing "7/7 features present"
      // beside the word STALE is a green number about art nobody has looked at,
      // and a reader skimming a column of ratios would take it for a pass.
      console.log(
        `verify-art:   STALE ${row.subjectId} - NOT re-checked: ${row.staleRenders} of its ` +
          `render(s) are of art that has moved. On record it CLAIMED ` +
          `${row.claimedGatingMatched}/${row.claimedGatingRenders} gating render(s) identified and ` +
          `${row.featuresPresent}/${row.featuresRequired} features present; none of that was ` +
          `re-checked, so none of it counts` +
          (row.recordedFindings > 0
            ? `. AND THE LAST VERDICT ON IT FAILED (${row.recordedFindings} finding(s), listed above), ` +
              `which going stale does not resolve.`
            : '.'),
      );
      continue;
    }
    console.log(
      `verify-art:   ${row.state === 'pass' ? 'PASS' : 'FAIL'} ${row.subjectId} - ` +
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

/**
 * Print a score, then decide the exit code from it.
 *
 * ORDER MATTERS AND IS THE REASON THIS IS A FUNCTION. `report()` exits where it
 * prints, so a failure list printed first meant the reader never saw the score
 * table or the staleness that explains it -- they saw "no feature audit came
 * back" against a subject whose art had been redrawn under the record anyway,
 * with no way to tell which of the two was their problem. Everything is
 * printed, and only then is the process ended.
 *
 * THE EXIT RULE, in one place so no caller re-derives it:
 *
 *   failures  -> 1, always.
 *   staleArt  -> 1, always. The record claims something about art that is no
 *                longer in the tree. Exit 0 would mean "the verdicts on file
 *                hold"; they do not hold, because nobody has looked at the new
 *                picture. `--require-identification` does not enter into it:
 *                that flag is about whether a claim is REQUIRED, and this is
 *                about a claim that is WRONG.
 *   stale     -> 0, unless --require-identification. The art is unchanged and
 *                the record is true about it, merely incomplete against a
 *                contract that has since asked for more.
 *   uncovered -> 0, unless --require-identification. Same rule and same reason:
 *                a record that never covered a subject makes no claim about it.
 *                Reported SEPARATELY from `stale`, because the two need
 *                different sentences and this function used to print one
 *                sentence over both -- see the note on the channel in
 *                lib/art-score.mjs.
 */
function reportScore(result, { strict }) {
  // stderr, because it is fatal, and before the failure list because it is why
  // several of those failures are not the reader's real problem.
  for (const line of result.staleArt) console.error(`verify-art: STALE ART - ${line}`);
  for (const line of result.stale) console.log(`verify-art: STALE - ${line}`);
  if (result.uncovered.length > 0) {
    // The subject ids are suppressed under --quiet for the reason printScore
    // gives below: the flag is asked for by an identifier who may still be
    // mid-run, and a list of the subjects nobody has checked is a list of
    // subjects. The COUNT is the part an operator needs and it names nothing.
    for (const line of quiet ? [] : result.uncovered) {
      console.log(`verify-art: NEVER CHECKED - ${line}`);
    }
    console.log(
      `verify-art: ${result.uncovered.length} subject(s) NEVER CHECKED - the contract renders ` +
        `them and this record covers them with nothing at all. NOT the same as a record whose ` +
        `art has since moved, and the difference is the whole reason both are printed: that ` +
        `record WAS looked at and its picture has since changed, and these have never been ` +
        `looked at through this harness by anybody. ` +
        `Neither is a pass. A record is scored out of its own manifest, so it cannot ` +
        `report this on its own; it is counted beside the scored total because the DIFFERENCE ` +
        `is the finding. Re-run the hand-off and record a verdict that covers them.` +
        (quiet ? ' (--quiet: the subjects are not named.)' : ''),
    );
  }
  printScore(result);

  if (result.failures.length > 0) {
    console.error('verify-art: FAILED');
    for (const failure of result.failures) console.error(`  - ${failure}`);
    console.error(`verify-art: ${result.failures.length} failure(s).`);
  }
  if (result.staleArt.length > 0) {
    console.error(
      `verify-art: FAILED - ${result.staleArt.length} subject(s) STALE. Their art was redrawn, ` +
        `deleted or never digested after the verdict was recorded, so those verdicts have NOT ` +
        `been re-checked and cannot pass. This is a failure and not a caveat: a record that ` +
        `stayed green while the art moved under it is the exact silent pass this harness ` +
        `exists to refuse. Re-run the hand-off and record a fresh verdict.`,
    );
  }
  if (result.fatal) process.exit(1);
  // TWO QUANTITIES IN THE MESSAGE, because "not established" has two causes here
  // and the fix differs: an entry the record's hand-off could not show needs the
  // SAME subject re-run against a current hand-off; a subject the record never
  // covered needs a run that includes a subject nobody has ever handed over.
  if (result.stale.length + result.uncovered.length > 0 && strict) {
    die(
      `--require-identification: NOT ESTABLISHED - ${result.stale.length} entr(y/ies) the ` +
        `record's own hand-off could not answer, and ${result.uncovered.length} subject(s) the ` +
        `record never covered at all.`,
    );
  }
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
  const { assets, references } = loadContract({ root });
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

  const result = scoreRun({
    references,
    keymap,
    answers,
    audit,
    // Read through the SAME reader the hand-off wrote the digests with. Two
    // copies of "hash the source" would eventually disagree, and the disagreement
    // would look exactly like a redraw.
    currentDigest: sourceDigestReader({ assets }),
  });
  reportScore(result, { strict: flag('--require-identification') });
  process.exit(0);
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
    const { assets, references } = loadContract({ root });
    const run = record.handoffRun;
    const result = scoreRun({
      references,
      keymap: run.keymap,
      answers: run.answers,
      audit: run.audit,
      currentDigest: sourceDigestReader({ assets }),
    });
    if (result.stale.length > 0 && !strict) {
      // Scored clean on everything the record COULD answer, and the contract has
      // since asked for something its hand-off did not contain. Neither a pass
      // nor a failure, and reported as loudly as either.
      //
      // COUNTS `stale` ONLY. It used to count the subjects the record never
      // covered as well, because they shared a channel, and then said of them
      // that they "could not be checked by the hand-off it was made from" -- of
      // four subjects that postdate the record entirely and that no hand-off
      // ever held. reportScore prints those under their own heading.
      console.log(
        `verify-art: ${recordPath} is STALE: ${result.stale.length} entr(y/ies) could not be ` +
          `checked by the hand-off it was made from; identification is NOT ESTABLISHED for those.`,
      );
    }
    reportScore(result, { strict });
  }
}

console.log(
  'verify-art: OK - the anonymised hand-off builds and nothing leaks into it. ' +
    'That is what this gate establishes. Blindness itself is a property of how the ' +
    'hand-off is USED, and no output can prove it after the fact.',
);
process.exit(0);
