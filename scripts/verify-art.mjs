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
 *   scripts/lib/art-handoff.mjs CANNOT be scrubbed to nothing and this file no
 *   longer pretends otherwise. Its recipe table is KEYED by subject id, and its
 *   comments record per-subject measurements, so its prose names subjects and
 *   quotes accepted answers by construction. Measured: 64 leaking tokens in its
 *   comments alone.
 *
 *   SO THE RULE IS NOT "THE LIBRARY IS CLEAN". It is that THE IDENTIFIER NEVER
 *   OPENS IT, exactly as it never opens the contract — and the blind path is
 *   built so that it never needs to: one command, one directory, and a briefing
 *   inside that directory. What IS asserted clean is everything the identifier
 *   sees while running: this file, the Makefile, `--help`, the hand-off
 *   directory, and EVERY MESSAGE THE HARNESS PRINTS, refusals included. See
 *   docs/art-verification-method.md, "Where the answers live".
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
 *   docs/art-verification.json now holds a harness-shaped record from a run that
 *   was made blind, so the default run builds and leak-checks the hand-off AND
 *   scores that record. It still never prints a bare "OK", because that is the
 *   shape of the lie this whole task is about: every run says in the same breath
 *   what it did not establish.
 *
 *   It exits 1 while any recorded verdict is about art that has since been
 *   redrawn, whatever else passed. That is the gate working, not the gate
 *   broken: a re-run is owed for those subjects and no output may imply
 *   otherwise. `--require-identification` goes further and makes an entry the
 *   record's own hand-off could not answer, or a subject it never covered, a
 *   failure too.
 */

import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildHandoff,
  isRendered,
  levelOffsetDrift,
  loadContract,
  posedModesWithoutSubject,
  readKeymap,
  sha256Of,
  sourceDigestReader,
} from './lib/art-handoff.mjs';
import { scoreRun } from './lib/art-score.mjs';

const HELP = `verify-art — harness for blind art identification (it is not the identifier)

Usage:
  node scripts/verify-art.mjs [gate] [options]      build + leak-check, then score any record
  node scripts/verify-art.mjs handoff  --out DIR    build an anonymised hand-off and keep it
  node scripts/verify-art.mjs answer   --handoff DIR --render NAME --answer TEXT
  node scripts/verify-art.mjs commit   --keymap K --answers A
  node scripts/verify-art.mjs reveal   --keymap K
  node scripts/verify-art.mjs score    --keymap K --answers A --audit U
  node scripts/verify-art.mjs score    --record R
  node scripts/verify-art.mjs record   --keymap K --answers A --audit U --out FILE

Options:
  --replace                 in \`record\`: overwrite a record that is about a DIFFERENT
                            run, discarding its prose. Without it, \`record\` refuses
                            rather than leave one run's verdicts beside another's.
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
  /*
   * AN EMPTY `renders` THAT IS STILL A PICTURE.
   *
   * A subject composed from the rig needs no file list, so an empty `renders`
   * does not stop it being built. Four subjects in the contract once said the
   * opposite in their own `renderRecipe` -- "UNBUILT, AND NOT BY DECISION - THE
   * HARNESS CANNOT BUILD IT YET" -- because when it was written the harness had
   * no builder for a posed, mounted figure. That deadlock is closed and the
   * recipes now say so. Printed rather than left silent all the same, because an
   * empty `renders` reads as "nothing handed over" to anyone who does not know
   * the subject is rig-driven.
   */
  const builtFromRig = keymap.builtFromRig ?? [];
  if (builtFromRig.length > 0) {
    console.log(
      `verify-art: ${builtFromRig.length} subject(s) were BUILT FROM THE RIG CONTRACT with an ` +
        `empty \`renders\` - the picture is composed from content/characters/rig.json, so ` +
        `the file list is documentation and not an input. The renders are real and were ` +
        `handed over.` +
        (quiet ? '' : ` (${builtFromRig.join(', ')})`),
    );
  }
  /*
   * A COMPOSITE BUILT TO AN OFFSET ITS LEVEL NO LONGER USES.
   *
   * Eight entries in the recipe table say in a comment that they were confirmed
   * against a level document. A comment is not re-read, and on the run this was
   * first derived it found two: one composite whose level had never matched the
   * number it was built to, and one that landed with the level and the contract
   * disagreeing by 40 px. Advisory, because which of the two files is wrong is
   * not knowable from here - only that they disagree, and by how much.
   */
  const drift = keymap.levelOffsetDrift ?? [];
  if (drift.length > 0) {
    console.log(
      `verify-art: ${drift.length} parallax composite(s) are built to an offset their LEVEL ` +
        `DOCUMENT DOES NOT AGREE WITH. The render is then a picture of an arrangement the game ` +
        `does not use, and no verdict about it can say so. Not a build failure: which of the two ` +
        `files moved is not knowable here. Reconcile content/levels/*.json with the ` +
        `renderRecipe, then re-record.`,
    );
    for (const row of quiet ? [] : drift) {
      console.log(
        `verify-art:   OFFSET DRIFT ${row.subjectId} - built at ${row.built}, ` +
          `${row.level} in the level document (${row.detail}).`,
      );
    }
  }
  const orphanModes = keymap.posedModesWithoutSubject ?? [];
  if (orphanModes.length > 0) {
    console.log(
      `verify-art: ${orphanModes.length} locomotion mode(s) have poses in the rig contract and ` +
        `NO SUBJECT in references.json. Nothing is handed over for them and no verdict can ` +
        `cover them, so this run verifies the modes it knows about and would print the same ` +
        `summary if it knew about fewer. Not a build failure - the gap is in the contract, ` +
        `which is art's file - but it is not nothing either.`,
    );
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

/* ------------------------------------------------------------------ *
 * ONE DOCUMENT, ONE RUN.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. `record` used to rewrite only `runIntegrity`
 * and `handoffRun` and to merge everything else forward, so a record pointed at
 * an older file kept THAT RUN'S `results` table, scope and narrative beside the
 * NEW run's integrity block. It happened: a file stating 35/17/2 with one
 * subject `not-checked` and `blindIdentification: "undefined"` sat beside a
 * hand-off run that scored 42/12/0, and the verifier had to rebuild the table by
 * hand rather than ship the contradiction.
 *
 * THAT IS WORSE THAN AN OUTRIGHT FAILURE, which is why it is worth this much
 * code. A reader -- or a gate -- takes the verdict table at face value. A
 * document that fails loudly gets fixed; a document that asserts one run's
 * verdicts under another run's proof of blindness looks verified and is not, and
 * it reads in the output exactly like a record that was made properly. Same
 * shape as every other thing this harness refuses: SILENT GREENNESS.
 *
 * SO THE VERDICTS ARE NO LONGER SOMETHING ANYONE WRITES. `scope` and `results`
 * are DERIVED, on every `record`, from `scoreRun` over the run being recorded --
 * the same function, over the same inputs, that `score --record` uses. They
 * cannot describe a different run than `handoffRun` does because they are
 * computed from it, which is also the whole of why `score --record` and `record`
 * now agree: there is one comparison and both commands call it.
 *
 * WHAT IS NOT DERIVABLE IS THE PROSE -- findings, caveats, what the run did and
 * did not establish -- and it belongs to whoever wrote it about the run they
 * wrote it about. It is carried forward ONLY when the file on disk is
 * demonstrably about this same run. Otherwise `record` REFUSES.
 *
 * REFUSES RATHER THAN REWRITES, and the choice is deliberate. Both were open,
 * and a silent whole-file rewrite trades a record that contradicts itself for a
 * record that has quietly lost another agent's reasoning -- the reason `record`
 * merged in the first place. A refusal is the only option that destroys nothing
 * and hides nothing: it names both run ids and every prose key that would have
 * been orphaned, and `--replace` performs the whole rewrite once a human has
 * read that sentence and decided. The wrong thing to be is convenient.
 * ------------------------------------------------------------------ */

/** What `record` writes from the run. Every other key in the file is prose. */
const DERIVED_KEYS = ['derivedFrom', 'scope', 'results', 'runIntegrity', 'handoffRun'];

/**
 * Which run a document on disk is about, from the strongest evidence it carries.
 * `derivedFrom` is this command's own stamp; the other two are what records
 * written before the stamp existed have.
 */
const runIdOf = (record) =>
  record?.derivedFrom?.handoffRunId ??
  record?.runIntegrity?.handoffRunId ??
  record?.handoffRun?.keymap?.runId ??
  null;

/**
 * Does this document describe ONE run? Called by every command that reads a
 * record, because the mixing is only cheap to catch at the moment of reading.
 *
 * FATAL ONLY ON A STAMP THAT DISAGREES. A record whose `derivedFrom` names one
 * run while its `handoffRun` carries another has been edited into a state
 * `record` cannot produce, and there is no reading of it that is safe: one of the
 * two halves is a lie and nothing here can tell which.
 *
 * A NOTE, NOT A FAILURE, for a table nobody derived. Hand-written `results`
 * predate this rule and are not thereby wrong -- but a reader cannot tell a
 * hand-written table from a derived one by looking, so the difference is said
 * out loud instead of assumed.
 */
function checkRecordCoherence(record, recordPath) {
  const stamped = record?.derivedFrom?.handoffRunId;
  const bundled = record?.handoffRun?.keymap?.runId;
  if (stamped !== undefined && bundled !== undefined && stamped !== bundled) {
    die(
      `${recordPath} MIXES TWO RUNS: its derived verdicts are stamped from run ${stamped} and ` +
        `the hand-off bundled in it is run ${bundled}. One of the two is not about this ` +
        `document's art, and nothing here can tell which, so neither can be read. A record ` +
        `states the verdicts of exactly one run. Re-make it with \`verify-art record\`.`,
    );
  }
  if (Array.isArray(record?.results) && record.results.length > 0 && stamped === undefined) {
    console.warn(
      `verify-art: NOTE - ${recordPath} carries a \`results\` table that \`verify-art record\` ` +
        `did not derive, so nothing ties those rows to the hand-off bundled beside them. What ` +
        `is scored below is the \`handoffRun\` block; the table is read by people, and it is ` +
        `on them. \`verify-art record\` derives it and stamps it.`,
    );
  }
}

/**
 * The verdict table, computed from the run rather than written about it.
 *
 * FOUR VERDICTS, not two, for the reason the score table prints three states:
 * "checked and it held", "checked and it did not", and "not checked" are
 * different facts and a reader acts on each differently. The fourth is the
 * offset drift below.
 */
function deriveResults({ result, keymap, answers, audit, driftBySubject }) {
  const answerOf = new Map((answers?.identifications ?? []).map((item) => [item.render, item]));
  const auditOf = new Map((audit?.audits ?? []).map((item) => [item.subjectId, item]));
  // The scorer's own words, routed to the subject they name. Every line it emits
  // is written `<id>: ...`, so no finding is re-phrased here -- a second copy of
  // a finding is a second thing to drift.
  const findingsFor = (id) =>
    [...result.failures, ...result.staleArt, ...result.stale].filter((line) =>
      line.startsWith(`${id}: `),
    );

  return result.scored.map((row) => {
    const drift = driftBySubject.get(row.subjectId);
    const gating = (keymap.entries ?? []).filter(
      (entry) => entry.subjectId === row.subjectId && entry.gating,
    );
    const verdict = drift
      ? 'not-checked-against-the-level-the-game-draws'
      : row.state === 'pass'
        ? 'pass'
        : row.state === 'stale'
          ? 'not-checked-against-current-art'
          : 'fail';

    const out = {
      subjectId: row.subjectId,
      verdict,
      identificationMatched: row.identified,
      // VERBATIM out of the frozen answers, and quoted rather than summarised.
      // The answers themselves stay in `handoffRun` untouched; this is a copy for
      // a reader, regenerated on every `record`, so it cannot drift from them.
      blindIdentification: gating.map((entry) => ({
        render: entry.render,
        answer: String(answerOf.get(entry.render)?.answer ?? ''),
      })),
      featuresRequired: row.featuresRequired,
      featuresPresent: row.featuresPresent,
      featuresUncheckable: row.featuresUncheckable,
      forbiddenPresent: auditOf.get(row.subjectId)?.forbiddenPresent ?? [],
      diagnosticProbesMatched: `${row.diagnosticMatched}/${row.diagnosticRenders}`,
      rendersNotCheckedAgainstCurrentArt: row.staleRenders,
      findings: findingsFor(row.subjectId),
    };
    if (drift) {
      out.whyThereIsNoVerdict =
        `NOT CHECKED AGAINST THE ARRANGEMENT THE GAME DRAWS. The composite handed over was ` +
        `built with its near tile ${drift.built} px from its far tile, and ` +
        `content/levels puts them ${drift.level} px apart (${drift.detail}). The verifier was ` +
        `shown a picture this level does not compose, so whatever it said is not a statement ` +
        `about what the game draws. Which of the two files moved is not knowable from here. ` +
        `Reconcile the level document with the renderRecipe, then re-run and re-record.`;
    }
    return out;
  });
}

/** Counted off the derived rows, so no total can disagree with the table above it. */
function deriveScope({ rows, result, keymap, references, rig, drift }) {
  const totals = result.totals;
  const count = (verdict) => rows.filter((row) => row.verdict === verdict).length;
  return {
    handoffRunId: keymap.runId,
    subjectsInContract: (references.subjects ?? []).length,
    subjectsWithRenders: (references.subjects ?? []).filter(isRendered).length,
    subjectsUnrenderedByDecision: (keymap.unrendered ?? []).map((entry) => entry.subjectId),
    renders: totals.renders,
    gatingRenders: totals.gatingRenders,
    diagnosticRenders: totals.diagnosticRenders,
    subjectsScored: rows.length,
    subjectsPassed: count('pass'),
    subjectsFailed: count('fail'),
    subjectsNotCheckedAgainstCurrentArt: count('not-checked-against-current-art'),
    subjectsNotCheckedAgainstTheLevel: count('not-checked-against-the-level-the-game-draws'),
    subjectsNeverChecked: totals.subjectsNotInRecord,
    mustBeRightConfirmedPresent: totals.featuresChecked,
    featuresUncheckable: totals.featuresUncheckable,
    /*
     * THE RECORD STATES ITS OWN BLIND SPOTS, because a scope that lists only what
     * was checked reads as a scope that covers everything. Both of these are
     * gaps in OTHER agents' files -- a level document and the contract -- and
     * neither is this command's to fix. What it can refuse to do is stay quiet
     * about them while filing verdicts next door.
     */
    compositesBuiltToAnOffsetTheLevelDisputes: drift.map((row) => row.subjectId),
    locomotionModesWithNoSubjectInTheContract: posedModesWithoutSubject(rig, references),
    countsAreDerived:
      'Every number in this block is computed by scripts/lib/art-score.mjs from the ' +
      '`handoffRun` beside it, by `verify-art record`, and is recomputed whole on every ' +
      'record. Nobody types these, and they cannot describe a different run than `handoffRun` ' +
      'does. `make verify-art` reports the same figures.',
  };
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

/* ------------------------------------------------------------------ *
 * answer — write ONE verdict against the artefact it is about.
 *
 * WHY THIS EXISTS: A HASH TYPED BY HAND IS A HASH TYPED WRONG EVENTUALLY.
 *
 * `answers.json` is keyed by opaque render name, and the template ships with
 * every name already filled in, so the intended use was always "fill in the
 * blanks in place". Nothing ENFORCED that. A verifier that wrote the file
 * itself - which is what happened - was hand-maintaining a table of sixteen-hex
 * strings, and on the last real run two subjects were written against each
 * other's hashes. That transposition voided a verdict that had been made
 * correctly: the identification was right and it was filed against the wrong
 * picture, which scores as two wrong answers and is indistinguishable in the
 * record from a verifier that simply could not identify either.
 *
 * So the harness does the matching. `--render` names a file the verifier was
 * actually shown, this resolves it inside the hand-off directory, and a name
 * that is not there is REFUSED rather than appended. There is no table to
 * transpose, because there is no table: there is one file, and the harness
 * finds the row.
 *
 * It refuses after `commit` for the same reason `commit` refuses twice: the
 * blind pass is written once.
 * ------------------------------------------------------------------ */
if (command === 'answer') {
  const handoffDir = option('--handoff');
  const render = option('--render');
  const text = option('--answer');
  if (!handoffDir || !render || text === null) {
    die('answer needs --handoff DIR, --render NAME and --answer TEXT');
  }
  const dir = resolve(handoffDir);
  const name = String(render).split(/[\\/]/).pop();
  const answersPath = join(dir, 'answers.json');
  if (!existsSync(answersPath)) die(`${answersPath} does not exist; is --handoff the hand-off directory?`);
  if (!existsSync(join(dir, name))) {
    die(
      `${name} is not a render in this hand-off. A verdict is recorded against the artefact ` +
        `it is about, and this one names a file you were not shown.`,
    );
  }
  const answers = readJson(answersPath);
  const row = (answers.identifications ?? []).find((item) => item.render === name);
  if (!row) die(`${name} is in the directory and not in answers.json; the hand-off is inconsistent`);
  if (String(row.answer ?? '').trim() !== '') {
    die(
      `${name} already carries an answer. The blind pass is written once: a second answer ` +
        `for one picture is a revision, and a revision is what the commitment exists to catch.`,
    );
  }
  row.answer = text;
  const cues = option('--cues');
  const moreCertain = option('--more-certain');
  const confidence = option('--confidence');
  if (cues !== null) row.cues = cues;
  if (moreCertain !== null) row.moreCertain = moreCertain;
  if (confidence !== null) row.confidence = Number(confidence);
  writeFileSync(answersPath, `${JSON.stringify(answers, null, 2)}\n`);
  const left = (answers.identifications ?? []).filter(
    (item) => String(item.answer ?? '').trim() === '',
  ).length;
  // A COUNT AND NOT A LIST. Which pictures are still unanswered is a fact about
  // this run that names nothing; listing them would be listing renders, which is
  // harmless, but the count is what the verifier needs and it cannot grow into a
  // leak later.
  console.log(`verify-art: recorded. ${left} render(s) still unanswered.`);
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
    // Before a single verdict is read: does this document describe one run? A
    // record that states one run's verdicts beside another's hand-off cannot be
    // scored into anything meaningful, and scoring it anyway would put this
    // command's name on the result.
    checkRecordCoherence(record, recordPath);
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

/* ------------------------------------------------------------------ *
 * record — bundle a LIVE run into the verdict record, verbatim.
 *
 * The other half of the mis-keying fix. Scoring a live run proves the verdict
 * holds; getting it into docs/art-verification.json was then a copy-and-paste
 * job over a keymap, an answers file and an audit, which is the second place a
 * hash gets transposed by hand. This copies all three verbatim and refuses a
 * run whose commitment does not hold, so what lands in the record is what was
 * scored rather than a retyping of it.
 *
 * IT NO LONGER MERGES BLINDLY, and the note that used to stand here -- "only
 * `handoffRun` and the integrity block are written" -- WAS THE DEFECT stated as
 * a feature. See "ONE DOCUMENT, ONE RUN" above for what replaced it: the
 * verdicts and the scope are derived from this run, and the prose is carried
 * only when the file on disk is about this run too.
 * ------------------------------------------------------------------ */
if (command === 'record') {
  const keymapPath = option('--keymap');
  const answersPath = option('--answers');
  const auditPath = option('--audit');
  const out = option('--out', join(root, 'docs', 'art-verification.json'));
  const replace = flag('--replace');
  if (!keymapPath || !answersPath || !auditPath) {
    die('record needs --keymap, --answers and --audit');
  }
  const keymap = readKeymap(keymapPath);
  /*
   * THE COMMITMENT IS UNCHANGED AND STAYS WHERE IT IS. Everything this command
   * now derives is derived AFTER these two refusals, never instead of them: a
   * verdict is bound to the artefact that was shown, and a run whose answers
   * moved after they were frozen may not be recorded at all, whatever else
   * about it is coherent.
   */
  if (!keymap.committedAnswersSha256) {
    die(
      'this run was never committed, so nothing shows the answers predate the reveal. ' +
        'Run `verify-art commit` before recording.',
    );
  }
  const now = sha256Of(readFileSync(answersPath));
  if (now !== keymap.committedAnswersSha256) {
    die('the answers changed after they were committed; this run may not be recorded');
  }

  const outPath = resolve(out);
  const existing = existsSync(outPath) ? readJson(outPath) : {};
  const onFile = runIdOf(existing);
  const prose = Object.keys(existing).filter((key) => !DERIVED_KEYS.includes(key));
  const sameRun = onFile !== null && onFile === keymap.runId;
  // A document that carries verdicts or reasoning, and is not about this run.
  const wouldMix =
    !sameRun &&
    (prose.length > 0 ||
      existing.handoffRun !== undefined ||
      (Array.isArray(existing.results) && existing.results.length > 0));

  if (wouldMix && !replace) {
    die(
      `${outPath} is a record of ${onFile === null ? 'a run it does not name' : `run ${onFile}`} ` +
        `and this is run ${keymap.runId}. REFUSING, because the two ways of going on are both ` +
        `worse than stopping: merging leaves that run's verdicts standing beside this run's ` +
        `proof of blindness, which is a document that looks verified and is not, and rewriting ` +
        `silently discards ${prose.length} prose field(s) somebody wrote about a run they had ` +
        `read${prose.length > 0 ? ` (${prose.join(', ')})` : ''}` +
        `${Array.isArray(existing.results) ? `, and ${existing.results.length} verdict row(s)` : ''}. ` +
        `A record states the verdicts of exactly one run. Either record to a fresh --out, or ` +
        `pass --replace to write this run's record over that one once you have read what is ` +
        `in it. Nothing is deleted for you.`,
    );
  }

  const { assets, references, rig } = loadContract({ root });
  const answers = readJson(answersPath);
  const audit = readJson(auditPath);
  // THE SAME COMPARISON `score --record` MAKES, over the same inputs. This is
  // what makes the two commands agree: not two implementations kept in step, but
  // one function with two callers. The verifier reported reconciling them by
  // hand, which is the symptom of there having been two.
  const result = scoreRun({
    references,
    keymap,
    answers,
    audit,
    currentDigest: sourceDigestReader({ assets }),
  });

  const drift = levelOffsetDrift({ root, references });
  const covered = new Set((keymap.entries ?? []).map((entry) => entry.subjectId));
  const driftBySubject = new Map(
    drift.filter((row) => covered.has(row.subjectId)).map((row) => [row.subjectId, row]),
  );

  const rows = deriveResults({ result, keymap, answers, audit, driftBySubject });
  const scope = deriveScope({ rows, result, keymap, references, rig, drift });

  const document = {
    // Carried only when this file is already about this run. Where it is not,
    // the refusal above has already run and `--replace` means "start clean".
    ...(sameRun && !replace ? existing : {}),
    derivedFrom: {
      handoffRunId: keymap.runId,
      committedAnswersSha256: keymap.committedAnswersSha256,
      recordedAt: new Date().toISOString(),
      by: 'verify-art record',
      derives: ['scope', 'results', 'runIntegrity', 'handoffRun'],
      note:
        'The stamp that makes a mixed record detectable. `scope` and `results` are computed ' +
        'from the `handoffRun` in this file and describe no other run; any command that reads ' +
        'this record refuses it outright if this id and `handoffRun.keymap.runId` disagree.',
    },
    runIntegrity: {
      ...(sameRun && !replace ? (existing.runIntegrity ?? {}) : {}),
      handoffRunId: keymap.runId,
      commitmentProven: true,
      committedAnswersSha256: keymap.committedAnswersSha256,
    },
    scope,
    results: rows,
    handoffRun: { keymap, answers, audit },
  };

  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(
    `verify-art: wrote run ${keymap.runId} into ${outPath} - ${keymap.entries.length} render(s) ` +
      `copied verbatim, and ${rows.length} verdict row(s) DERIVED from them. Nothing was ` +
      `retyped and no number in this file was typed by anybody.`,
  );
  if (replace && wouldMix) {
    console.log(
      `verify-art: --replace - the previous record${onFile === null ? '' : ` (run ${onFile})`} ` +
        `was overwritten whole, including ${prose.length} prose field(s)` +
        `${prose.length > 0 ? `: ${prose.join(', ')}` : ''}. It is in git, and it is not in ` +
        `this file any more.`,
    );
  }
  if (driftBySubject.size > 0) {
    console.log(
      `verify-art: ${driftBySubject.size} subject(s) in this run were composited to an offset ` +
        `their LEVEL DOCUMENT DOES NOT AGREE WITH, so the verifier was shown an arrangement the ` +
        `game does not draw. They are recorded with NO VERDICT rather than with the one that ` +
        `was reached, and they are counted as passing nothing. Which of the two files moved is ` +
        `not knowable here: reconcile content/levels/*.json with the renderRecipe, then re-run.`,
    );
  }
  /*
   * PRINTED, AND THEN OBEYED. The record is on disk before this runs -- a record
   * of failures is exactly what a failing run is owed, and withholding it would
   * be the quietest way to lose one. The exit code is then the VERDICT in the
   * file, not a report on whether the file was written, and the line below says
   * which it is so nobody reads a red exit as a failed write.
   */
  console.log(`verify-art: the record is written. What follows is what it says.`);
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
    checkRecordCoherence(record, recordPath);
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
