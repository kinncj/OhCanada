/**
 * THE COMPARISON STEP: join an identifier's verdicts to the keymap it never
 * read, and score them against the contract.
 *
 * WHAT A PASS HERE MEANS, EXACTLY
 *
 * That a STATED VERDICT MATCHES THE CONTRACT in assets/refs/references.json:
 * the unprompted answer contains one of `expectedBlindAnswer`, every
 * `mustBeRight` feature was audited and found present, and nothing from
 * `neverAdd` was found.
 *
 * IT DOES NOT MEAN THE VERDICT WAS MADE BLIND. Nothing downstream of the
 * hand-off can establish that. The hand-off gives it, and only if it held: the
 * identifier was handed a directory of hashes and did not go and look at the
 * source tree. This file can prove one narrow piece of it — that the blind
 * answers were fixed BEFORE the mapping was revealed — and it does, via the
 * commitment in `committedAnswersSha256`. That is a real property and a small
 * one. It says the answers were not revised once the answer key was open. It
 * says nothing about what the identifier read before it wrote them.
 *
 * Say so in the output, every time. The failure mode this whole task exists to
 * prevent is that a leaked run looks exactly like a clean one, and the only
 * defence against that in the report is to keep stating what the report is not.
 *
 * THE ANTI-VACUUM FLOOR, in three places, because there are three ways to score
 * nothing and print a tick:
 *   - zero renders in the keymap fails;
 *   - zero GATING renders fails (a hand-off of nothing but 140 px thumbnails
 *     and masked probes decides nothing, and every one of those is diagnostic);
 *   - a `mustBeRight` feature that the audit neither lists as present nor as
 *     absent fails. An empty audit is not a clean audit.
 *
 * PRESENT, ABSENT, AND UNCHECKABLE -- THREE STATES, NOT TWO
 *
 * A feature can be one the hand-off did not make answerable. The character
 * subject's "cartoon proportions identical to every other character" is the
 * case that forced this: on the first run through the harness it was scored
 * PRESENT, and it was in fact present, but the hand-off held one figure and the
 * verifier had confirmed it from `rig-contract.json` -- "a code-level check
 * wearing an art verifier's clothes". A right answer arrived at by accident.
 *
 * So the contract marks such an entry `requiresComparisonFigure`, this scorer
 * checks the KEYMAP for the figure that makes it answerable, and where the
 * figure is missing the entry is UNCHECKABLE: not present, not absent, and not
 * a pass. In art's words, and it is the right instinct: a wrong verdict recorded
 * as absent is better than a right one recorded by accident.
 */

import { normalise } from './art-handoff.mjs';

/** ` foo ` padding so "canal" does not match inside "canalisation". */
const padded = (value) => ` ${normalise(value)} `;

const matchesExpected = (answer, expected) => {
  const haystack = padded(answer);
  return expected.some((candidate) => haystack.includes(padded(candidate)));
};

/**
 * @param keymap  what buildHandoff wrote. The identifier never reads this.
 * @param answers what the identifier wrote, keyed by opaque render name.
 * @param audit   the informed pass, keyed by subject id, made AFTER reveal.
 */
export function scoreRun({ references, keymap, answers, audit }) {
  const failures = [];
  /**
   * STALE, as distinct from WRONG.
   *
   * A recorded run is scored against today's contract, and the contract moves.
   * When a feature gains `requiresComparisonFigure`, every run made before that
   * day was handed a set of images that could not answer it -- through no fault
   * of the run. Calling that a failure blames a verdict for a rule that postdates
   * it; calling it a pass is the vacuum this file exists to refuse. It is neither:
   * the record is STALE and must be re-made against the current hand-off.
   *
   * Kept deliberately narrow. Only the "the hand-off could not answer this"
   * branch lands here. An identifier that HAD the figure and still could not
   * answer is a real finding and stays in `failures`, and so does everything
   * else. A fresh run always carries the figure -- `buildHandoff` fails outright
   * if it cannot build one -- so this cannot excuse a current run.
   */
  const stale = [];
  const subjects = new Map((references.subjects ?? []).map((s) => [s.id, s]));
  const unrendered = new Set((keymap.unrendered ?? []).map((u) => u.subjectId));

  const entries = keymap.entries ?? [];
  if (entries.length === 0) {
    failures.push(
      'the keymap holds zero renders. ANTI-VACUUM FLOOR: a run with nothing in ' +
        'it scores a clean sweep of nothing.',
    );
  }
  const gating = entries.filter((entry) => entry.gating);
  if (entries.length > 0 && gating.length === 0) {
    failures.push(
      'the keymap holds no gating render. Size-ladder and masked probes are ' +
        'diagnostic by design, so a run of only those decides nothing.',
    );
  }

  if (answers.runId !== keymap.runId) {
    failures.push(
      `the answers are for run ${answers.runId ?? '(none)'} and the keymap is run ` +
        `${keymap.runId}. A verdict from one hand-off cannot score another.`,
    );
  }
  if (audit && audit.runId !== undefined && audit.runId !== keymap.runId) {
    failures.push(`the feature audit is for run ${audit.runId}, not ${keymap.runId}`);
  }

  /* ---------------- identification ---------------- */

  const byRender = new Map(entries.map((entry) => [entry.render, entry]));
  const answered = new Map();

  for (const item of answers.identifications ?? []) {
    if (!byRender.has(item.render)) {
      // The named failure mode: a verdict about something that was never handed
      // over. Either the identifier invented a render or it answered a stale run.
      failures.push(
        `verdict for "${item.render}", which is not in the keymap. A verdict for a ` +
          `render that was never handed over cannot be scored against anything.`,
      );
      continue;
    }
    if (answered.has(item.render)) {
      failures.push(`two verdicts for the same render "${item.render}"`);
      continue;
    }
    answered.set(item.render, item);
  }

  const identification = [];
  for (const entry of entries) {
    const item = answered.get(entry.render);
    if (!item) {
      failures.push(`no verdict for render "${entry.render}" (${entry.probe}); the run is incomplete`);
      continue;
    }
    const answer = String(item.answer ?? '').trim();
    if (answer === '') {
      failures.push(`empty verdict for render "${entry.render}"; an unanswered render is not a pass`);
      continue;
    }
    const subject = subjects.get(entry.subjectId);
    if (!subject) {
      failures.push(`the keymap maps "${entry.render}" to unknown subject "${entry.subjectId}"`);
      continue;
    }
    const hit = matchesExpected(answer, subject.expectedBlindAnswer ?? []);
    identification.push({
      render: entry.render,
      subjectId: entry.subjectId,
      probe: entry.probe,
      gating: entry.gating,
      matched: hit,
      answer,
      confidence: item.confidence ?? null,
    });
    if (entry.gating && !hit) {
      failures.push(
        `${entry.subjectId}: the unprompted answer did not name the subject. ` +
          `Said "${answer}"; needed one of ${JSON.stringify(subject.expectedBlindAnswer)}.`,
      );
    }
  }

  /* ---------------- feature audit ---------------- */

  const audited = new Map();
  for (const item of audit?.audits ?? []) {
    const id = item.subjectId;
    if (unrendered.has(id)) {
      // A subject with an empty `renders` is unrendered ON PURPOSE. An audit of it is an
      // audit of an image nobody was shown, and recording it as a pass would be
      // the quietest possible way to claim a verification that never happened.
      failures.push(
        `${id}: a feature audit was submitted for a subject with no render. It is ` +
          `unrendered by decision — neither a pass nor a failure — and there was ` +
          `nothing to look at.`,
      );
      continue;
    }
    if (!subjects.has(id)) {
      failures.push(`feature audit for unknown subject "${id}"`);
      continue;
    }
    if (audited.has(id)) failures.push(`${id}: two feature audits`);
    audited.set(id, item);
  }

  const scored = [];
  const wanted = [...new Set(entries.map((entry) => entry.subjectId))];
  let featuresChecked = 0;

  for (const id of wanted) {
    const subject = subjects.get(id);
    if (!subject) continue;
    const item = audited.get(id);
    if (!item) {
      failures.push(`${id}: renders were handed over and no feature audit came back`);
      continue;
    }
    const present = new Set((item.featuresPresent ?? []).map(normalise));
    const absent = new Set((item.featuresAbsent ?? []).map(normalise));
    const declaredUncheckable = new Set((item.featuresUncheckable ?? []).map(normalise));
    const forbidden = item.forbiddenPresent ?? [];
    const entriesById = subject.mustBeRight ?? [];
    const required = entriesById.map((entry) => entry.feature);
    const known = new Set(required.map(normalise));
    let ok = true;
    let presentCount = 0;
    let uncheckableCount = 0;

    // Does the hand-off contain what a feature needs in order to be answerable?
    // Read off the KEYMAP, which records what was actually handed over, not off
    // the contract, which records what should have been.
    const hasComparison = entries.some(
      (entry) => entry.subjectId === id && entry.probe === 'comparison',
    );

    for (const contractEntry of entriesById) {
      const feature = contractEntry.feature;
      const key = normalise(feature);
      const isPresent = present.has(key);
      const isAbsent = absent.has(key);
      const saidUncheckable = declaredUncheckable.has(key);
      const wasAnswerable = !contractEntry.requiresComparisonFigure || hasComparison;

      if (!wasAnswerable) {
        // Whatever the audit says, this could not have been checked from the
        // pictures. Recording it present would be recording a right answer by
        // accident, which is the whole reason this state exists.
        uncheckableCount += 1;
        ok = false;
        stale.push(
          `${id}: "${feature}" is UNCHECKABLE in this record` +
            (isPresent ? ' — and is recorded PRESENT, which it cannot have been' : '') +
            `. It needs a comparison figure and this run's hand-off held none, because the ` +
            `run predates the requirement. Not a failure of the art and not a pass: the ` +
            `record is stale and must be re-made against a current hand-off, which supplies one.`,
        );
        continue;
      }

      if (saidUncheckable) {
        // The identifier had what it needed and still could not answer. That is
        // a real finding and it is not a pass.
        uncheckableCount += 1;
        ok = false;
        failures.push(
          `${id}: the audit reports "${feature}" as UNCHECKABLE, and the hand-off did ` +
            `contain what it needs. Not a pass: an entry nobody could judge is not an ` +
            `entry that held.`,
        );
        continue;
      }

      if (isPresent && isAbsent) {
        failures.push(`${id}: "${feature}" is listed as both present and absent`);
        ok = false;
      } else if (!isPresent && !isAbsent) {
        failures.push(
          `${id}: "${feature}" is in mustBeRight and the audit classified it as ` +
            `neither present nor absent. An unmentioned feature is unchecked, not fine.`,
        );
        ok = false;
      } else if (isAbsent) {
        failures.push(`${id}: required feature "${feature}" is missing from the render`);
        ok = false;
      } else {
        featuresChecked += 1;
        presentCount += 1;
      }
    }
    for (const claimed of [...present, ...absent, ...declaredUncheckable]) {
      if (!known.has(claimed)) {
        failures.push(
          `${id}: the audit names "${claimed}", which is not a mustBeRight feature of ` +
            `this subject. A verdict about a feature the contract does not carry ` +
            `scores nothing and hides a typo in one that does.`,
        );
        ok = false;
      }
    }
    for (const entry of forbidden) {
      failures.push(`${id}: forbidden feature present — "${entry}" (neverAdd)`);
      ok = false;
    }

    const idents = identification.filter((row) => row.subjectId === id);
    const gatingIdents = idents.filter((row) => row.gating);
    const identified = gatingIdents.length > 0 && gatingIdents.every((row) => row.matched);
    scored.push({
      subjectId: id,
      identified,
      gatingRenders: gatingIdents.length,
      diagnosticRenders: idents.length - gatingIdents.length,
      diagnosticMatched: idents.filter((row) => !row.gating && row.matched).length,
      featuresRequired: required.length,
      featuresPresent: presentCount,
      featuresUncheckable: uncheckableCount,
      forbiddenFound: forbidden.length,
      pass: ok && identified,
    });
  }

  return {
    failures,
    stale,
    scored,
    identification,
    unrendered: [...unrendered],
    totals: {
      renders: entries.length,
      gatingRenders: gating.length,
      diagnosticRenders: entries.length - gating.length,
      subjectsScored: scored.length,
      subjectsPassed: scored.filter((row) => row.pass).length,
      subjectsUnrendered: unrendered.size,
      featuresChecked,
      featuresUncheckable: scored.reduce((sum, row) => sum + row.featuresUncheckable, 0),
    },
  };
}
