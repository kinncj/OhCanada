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
 *
 * A VERDICT IS ABOUT A PICTURE, AND THE PICTURE MOVES
 *
 * Everything above scores a verdict against the CONTRACT. None of it asked the
 * prior question: is the verdict still about the art that is in the tree today?
 * It was not asked, and the answer was assumed to be yes, and the dangerous
 * direction is precise --
 *
 *     A RECORD THAT PASSED STAYS PASSING AFTER THE ART IT DESCRIBES IS REDRAWN.
 *
 * -- because nothing in the record changes when the SVG under it does. The green
 * tick is about a picture nobody can see any more, and it is indistinguishable
 * in the output from a green tick about the picture on disk. That is the same
 * shape as every other failure this harness exists to refuse: SILENT GREENNESS.
 *
 * So every keymap entry now carries `sourceSha256`, the digest of the SVG bytes
 * it was drawn from, and this scorer re-derives them. An entry whose art has
 * moved -- redrawn, deleted, or never digested in the first place -- is STALE
 * ART: it is not scored, it cannot pass, and it does not quietly vanish.
 *
 * TWO KINDS OF STALE, AND THEY EXIT DIFFERENTLY, WHICH IS THE POINT
 *
 *   `stale`     THE CONTRACT MOVED. The art is unchanged and the record is a
 *               true statement about it, just an incomplete one: a feature
 *               gained `requiresComparisonFigure` after the run. Advisory by
 *               default, fatal under `--require-identification`.
 *
 *   `staleArt`  THE ART MOVED. The record is not a statement about today's art
 *               AT ALL. ALWAYS FATAL. There is no run in which the right answer
 *               is to print this and exit 0, because the only thing exit 0 can
 *               mean here is "the verdicts on file hold", and they do not hold;
 *               nobody has looked.
 *
 * The line between "a missing record is tolerated" and "a stale record is not"
 * is worth stating, because it looks inconsistent and is not: A MISSING RECORD
 * MAKES NO CLAIM, and this gate does not yet require a claim -- that is what
 * `--require-identification` is for. A STALE RECORD MAKES A CLAIM THAT IS NO
 * LONGER TRUE, and refusing false claims is the gate's whole job.
 *
 * AND STALENESS MUST NOT LAUNDER A FINDING. A subject whose record FAILED and
 * whose art has since been redrawn has not been forgiven; it has been left
 * unexamined. Downgrading `FAIL` to `STALE` and dropping the reason would read
 * as an improvement and would be the second silent pass, hidden inside the fix
 * for the first. So the recorded findings travel WITH the stale entry, restated
 * as unresolved, and the report says "was failing, and is now unverified".
 */

import { normalise } from './art-handoff.mjs';

/** ` foo ` padding so "canal" does not match inside "canalisation". */
const padded = (value) => ` ${normalise(value)} `;

/**
 * HOW MANY WORDS AN ANSWER MAY INSERT INTO AN EXPECTED PHRASE AND STILL MATCH.
 *
 * A contiguous substring match cannot accept a correct answer phrased with an
 * extra adjective, and that is not hypothetical: `rideau-canal-skateway`'s
 * contract was amended to accept a GENERIC answer, and a genuinely blind run
 * answered "an outdoor public skating rink on a frozen CITY canal". All four
 * generic phrases failed - "an outdoor skating rink on a frozen canal" is not a
 * substring of it - and the subject passed only because the verifier
 * volunteered "Rideau Canal", the place name the amendment makes optional. A
 * verifier obeying the contract exactly would have been marked wrong. The
 * contract was doing the right thing and the matcher was not.
 *
 * So a candidate matches when its words appear IN ORDER, with at most this many
 * of the answer's own words between any two of them. Order is kept because it
 * is what distinguishes a phrase from a bag of words; the gap is bounded
 * because an unbounded one would let a candidate match words scattered across
 * an unrelated paragraph, which is a different and worse failure than the one
 * being fixed.
 *
 * Two, measured against the case that produced it - one insertion per gap
 * ("public" after "outdoor", "city" after "frozen") - with one word of headroom
 * for the same shape twice ("a large frozen city canal"). It is not a threshold
 * anyone should tune upward without a run that needed it: at three, "rideau" and
 * "canal" match across "the Rideau is definitely not a canal".
 */
const MAX_INSERTED_WORDS = 2;

/**
 * Does `candidate`'s word sequence occur in `answer` in order, with no gap
 * wider than MAX_INSERTED_WORDS? Greedy from each possible start, which is
 * correct here because a wider gap can only be MORE permissive: if a later
 * occurrence of a word would match, an earlier one inside the gap budget does
 * too, and the loop restarts at every candidate start position.
 */
const containsInOrder = (answerWords, candidateWords) => {
  if (candidateWords.length === 0) return false;
  for (let start = 0; start <= answerWords.length - candidateWords.length; start += 1) {
    if (answerWords[start] !== candidateWords[0]) continue;
    let at = start + 1;
    let matched = 1;
    while (matched < candidateWords.length && at < answerWords.length) {
      const found = answerWords.indexOf(candidateWords[matched], at);
      if (found === -1 || found - at > MAX_INSERTED_WORDS) break;
      at = found + 1;
      matched += 1;
    }
    if (matched === candidateWords.length) return true;
  }
  return false;
};

const wordsOf = (value) => normalise(value).split(' ').filter((word) => word !== '');

const matchesExpected = (answer, expected) => {
  const haystack = padded(answer);
  const answerWords = wordsOf(answer);
  return expected.some(
    (candidate) =>
      // The exact phrase first, so the common case costs one string search and
      // reads the way the contract is written.
      haystack.includes(padded(candidate)) || containsInOrder(answerWords, wordsOf(candidate)),
  );
};

/**
 * Does this entry still describe the art that is in the tree today?
 *
 * FOUR ANSWERS, and only one of them is "yes". The three noes are kept apart
 * because they need different words in the report and one of them is the floor:
 *
 *   current      every source digest recorded matches the file on disk.
 *   moved        at least one source was REDRAWN, or is GONE, or was never
 *                digested. The verdict is about a picture that is not there.
 *   unrecorded   the entry carries no digests at all -- it predates the check.
 *                THIS MUST NOT REDUCE TO A PASS. "The record never said what it
 *                was looking at" is not evidence that it was looking at this.
 *   unreadable   the caller supplied no way to read today's art. Fail-safe on
 *                purpose: a scorer wired up wrong reports everything stale and
 *                is impossible to miss, rather than reporting everything fine.
 */
function artStateOf(entry, currentDigest) {
  const sources = [...new Set(entry.sources ?? [])];
  if (sources.length === 0) {
    return {
      state: 'unrecorded',
      why: 'the entry names no source files, so there is nothing to re-derive',
    };
  }
  if (typeof currentDigest !== 'function') {
    return { state: 'unreadable', why: 'the scorer was given no reader for the art on disk' };
  }
  const recorded = entry.sourceSha256;
  if (recorded === null || typeof recorded !== 'object') {
    return { state: 'unrecorded', why: 'the entry carries no `sourceSha256`' };
  }

  const redrawn = [];
  const gone = [];
  const undigested = [];
  for (const rel of sources) {
    const was = recorded[rel];
    if (typeof was !== 'string') {
      undigested.push(rel);
      continue;
    }
    const now = currentDigest(rel);
    if (now === null) gone.push(rel);
    else if (now !== was) redrawn.push(rel);
  }
  if (redrawn.length + gone.length + undigested.length > 0) {
    return { state: 'moved', redrawn, gone, undigested };
  }
  return { state: 'current' };
}

const list = (values) => [...values].sort().join(', ');

/**
 * One line per stale SUBJECT rather than per render, because "three renders of
 * one redrawn tile" is one fact, and a report that repeats it three times is a
 * report a reader skims.
 *
 * `recorded` is what this record ACTUALLY SAID about the subject: the findings
 * that would have been failures had the art still been there. They are carried
 * into the stale line, loudly, so that redrawing art can never be a way to make
 * a defect stop being printed.
 */
function staleArtMessage({ id, staleRenders, states, totalRenders, recorded }) {
  const redrawn = new Set();
  const gone = new Set();
  const undigested = new Set();
  const reasons = new Set();
  for (const entry of staleRenders) {
    const state = states.get(entry.render);
    for (const rel of state.redrawn ?? []) redrawn.add(rel);
    for (const rel of state.gone ?? []) gone.add(rel);
    for (const rel of state.undigested ?? []) undigested.add(rel);
    if (state.why) reasons.add(state.why);
  }

  const parts = [];
  if (redrawn.size > 0) parts.push(`REDRAWN since the verdict was recorded: ${list(redrawn)}`);
  if (gone.size > 0) parts.push(`GONE from the tree: ${list(gone)}`);
  if (undigested.size > 0) {
    parts.push(`recorded with no digest, so nothing shows they are unchanged: ${list(undigested)}`);
  }
  for (const why of reasons) parts.push(why);

  // Two different sentences, because they are two different facts and a reader
  // acts on them differently. "The art was redrawn" is a thing that HAPPENED.
  // "No digest was recorded" is a thing that was NEVER KNOWN -- the art may be
  // untouched -- and stating it as a redraw would be inventing a change.
  const consequence =
    redrawn.size + gone.size > 0
      ? `A verdict about a picture that changed underneath it has not been verified.`
      : `Nothing in this record shows the verdict is about the art in the tree today, and a ` +
        `verdict that cannot be tied to what it looked at has not been verified.`;

  let text =
    `${id}: ${staleRenders.length} of ${totalRenders} render(s) NOT RE-CHECKED — ${parts.join('; ')}. ` +
    `${consequence} It is not a pass, it does not become one by ageing, and the only thing that ` +
    `clears it is a new run against a current hand-off.`;

  if (recorded.length > 0) {
    text +=
      `\n      AND THE VERDICT ON RECORD FOR THIS SUBJECT WAS A FAILURE, WHICH GOING STALE DOES ` +
      `NOT RESOLVE:\n` +
      recorded.map((finding) => `        - ${finding}`).join('\n') +
      `\n      The art may since have been fixed. NOBODY HAS LOOKED. Read this as "was failing, ` +
      `and is now unverified", not as "was failing, now stale".`;
  }
  return text;
}

/**
 * @param keymap  what buildHandoff wrote. The identifier never reads this.
 * @param answers what the identifier wrote, keyed by opaque render name.
 * @param audit   the informed pass, keyed by subject id, made AFTER reveal.
 */
export function scoreRun({ references, keymap, answers, audit, currentDigest = null }) {
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
  /**
   * STALE ART, as distinct from both. See the header: the CONTRACT moving is
   * `stale` and is advisory; the ART moving is this, and it is always fatal.
   * Kept as a separate channel rather than folded into `failures` for one
   * reason -- a reader has to be able to tell "this was checked and it failed"
   * from "this was never checked again", and one list cannot say both.
   */
  const staleArt = [];
  const subjects = new Map((references.subjects ?? []).map((s) => [s.id, s]));
  const unrendered = new Set((keymap.unrendered ?? []).map((u) => u.subjectId));

  const entries = keymap.entries ?? [];

  /* ---------------- is this still the art the verdict was about? ---------------- */

  const states = new Map(entries.map((entry) => [entry.render, artStateOf(entry, currentDigest)]));
  const isCurrent = (entry) => states.get(entry.render).state === 'current';
  /**
   * THE LIVE SET: entries that still describe today's art. Every floor below is
   * drawn over THIS and not over `entries`, and that is the load-bearing part of
   * ADR-0024 here. A keymap of twenty entries whose art has all been redrawn is
   * the same vacuum as a keymap of none -- it just has a fuller-looking manifest
   * to hide in, which makes it the more dangerous of the two.
   */
  const live = entries.filter(isCurrent);

  if (entries.length === 0) {
    failures.push(
      'the keymap holds zero renders. ANTI-VACUUM FLOOR: a run with nothing in ' +
        'it scores a clean sweep of nothing.',
    );
  } else if (live.length === 0) {
    failures.push(
      `ANTI-VACUUM FLOOR: not one of the ${entries.length} render(s) in this keymap can be ` +
        `shown to describe the art in the tree today, so there is nothing here to score. A ` +
        `record that scores nothing is not a record that passed.`,
    );
  }

  const gating = entries.filter((entry) => entry.gating);
  const liveGating = live.filter((entry) => entry.gating);
  if (entries.length > 0 && gating.length === 0) {
    failures.push(
      'the keymap holds no gating render. Size-ladder and masked probes are ' +
        'diagnostic by design, so a run of only those decides nothing.',
    );
  } else if (live.length > 0 && liveGating.length === 0) {
    failures.push(
      `ANTI-VACUUM FLOOR: every gating render in this keymap describes art that has since ` +
        `changed. What is left is ${live.length} diagnostic render(s), which are diagnostic ` +
        `by design and decide nothing on their own.`,
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
  /**
   * Gating misses on art that has MOVED. Not pushed to `failures` here: they are
   * not statements about today's art. They are not dropped either -- they are
   * this record's findings, and they are carried into the subject's stale line
   * below so that a redraw can never be a way to make a miss stop printing.
   */
  const missedOnStaleArt = new Map();

  for (const entry of entries) {
    const current = isCurrent(entry);
    const item = answered.get(entry.render);
    if (!item) {
      // Only for live art. An incomplete verdict about a picture that no longer
      // exists is one complaint too many: the entry is void either way, and the
      // stale line already says so in the words that lead to the fix.
      if (current) {
        failures.push(`no verdict for render "${entry.render}" (${entry.probe}); the run is incomplete`);
      }
      continue;
    }
    const answer = String(item.answer ?? '').trim();
    if (answer === '') {
      if (current) {
        failures.push(`empty verdict for render "${entry.render}"; an unanswered render is not a pass`);
      }
      continue;
    }
    const subject = subjects.get(entry.subjectId);
    if (!subject) {
      // Kept regardless of staleness: a keymap that maps a render to a subject
      // the contract does not carry is broken as a RECORD, not as a picture.
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
      // Carried on the row so a reader of the returned object can tell a verdict
      // that was scored from one that was merely recorded.
      artCurrent: current,
      answer,
      confidence: item.confidence ?? null,
    });
    if (entry.gating && !hit) {
      const finding =
        `${entry.subjectId}: the unprompted answer did not name the subject. ` +
        `Said "${answer}"; needed one of ${JSON.stringify(subject.expectedBlindAnswer)}.`;
      if (current) failures.push(finding);
      else missedOnStaleArt.set(entry.subjectId, [...(missedOnStaleArt.get(entry.subjectId) ?? []), finding]);
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

    const mine = entries.filter((entry) => entry.subjectId === id);
    const staleRenders = mine.filter((entry) => !isCurrent(entry));
    // What the RECORD says, current or not. A stale row reports these instead of
    // the scored figures, so the reader sees the claim that was made without the
    // report appearing to stand behind it.
    const claimed = identification.filter((row) => row.subjectId === id && row.gating);
    const claimedMatched = claimed.filter((row) => row.matched).length;
    /**
     * Everything this record SAID about the subject that would have been a
     * failure. On live art it goes straight to `failures`, exactly as before. On
     * stale art it travels into the stale line instead of being dropped, because
     * "the art was redrawn" answers *whether we know*, not *what we found*.
     */
    const recorded = [...(missedOnStaleArt.get(id) ?? [])];
    const emit = () => {
      if (staleRenders.length === 0) {
        failures.push(...recorded);
        return;
      }
      staleArt.push(
        staleArtMessage({
          id,
          staleRenders,
          states,
          totalRenders: mine.length,
          recorded,
        }),
      );
    };

    const item = audited.get(id);
    if (!item) {
      recorded.push(`${id}: renders were handed over and no feature audit came back`);
      emit();
      // A ROW, not a `continue`. The subject was handed over, so it is part of
      // what this run was asked about, and a subject that is absent from the
      // table is a subject a reader does not know to look for -- the same vacuum
      // as a count of zero, one level up. It scores nothing and says so.
      scored.push({
        subjectId: id,
        identified: false,
        gatingRenders: 0,
        diagnosticRenders: 0,
        diagnosticMatched: 0,
        featuresRequired: (subject.mustBeRight ?? []).length,
        featuresPresent: 0,
        featuresUncheckable: 0,
        forbiddenFound: 0,
        claimedGatingRenders: claimed.length,
        claimedGatingMatched: claimedMatched,
        staleRenders: staleRenders.length,
        state: staleRenders.length > 0 ? 'stale' : 'fail',
        recordedFindings: recorded.length,
        pass: false,
      });
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
        recorded.push(
          `${id}: the audit reports "${feature}" as UNCHECKABLE, and the hand-off did ` +
            `contain what it needs. Not a pass: an entry nobody could judge is not an ` +
            `entry that held.`,
        );
        continue;
      }

      if (isPresent && isAbsent) {
        recorded.push(`${id}: "${feature}" is listed as both present and absent`);
        ok = false;
      } else if (!isPresent && !isAbsent) {
        recorded.push(
          `${id}: "${feature}" is in mustBeRight and the audit classified it as ` +
            `neither present nor absent. An unmentioned feature is unchecked, not fine.`,
        );
        ok = false;
      } else if (isAbsent) {
        recorded.push(`${id}: required feature "${feature}" is missing from the render`);
        ok = false;
      } else {
        presentCount += 1;
      }
    }
    for (const claimed of [...present, ...absent, ...declaredUncheckable]) {
      if (!known.has(claimed)) {
        recorded.push(
          `${id}: the audit names "${claimed}", which is not a mustBeRight feature of ` +
            `this subject. A verdict about a feature the contract does not carry ` +
            `scores nothing and hides a typo in one that does.`,
        );
        ok = false;
      }
    }
    for (const entry of forbidden) {
      recorded.push(`${id}: forbidden feature present — "${entry}" (neverAdd)`);
      ok = false;
    }
    emit();
    // "Confirmed present" is a claim about a picture. A subject whose art has
    // moved contributes NOTHING to that total, however clean its audit reads:
    // counting it would put a green number in the summary line for art nobody
    // has looked at, which is this whole change in miniature.
    if (staleRenders.length === 0) featuresChecked += presentCount;

    // Identification counts only what was scored, so a subject all of whose
    // gating renders went stale cannot be `identified` even before the explicit
    // clause below -- `gatingIdents.length > 0` fails first. The clause is there
    // anyway, for the subject whose GATING render is current and whose
    // diagnostic one is not: still not a pass, because part of the record it
    // rests on is about art that has gone.
    const idents = identification.filter((row) => row.subjectId === id && row.artCurrent);
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
      claimedGatingRenders: claimed.length,
      claimedGatingMatched: claimedMatched,
      staleRenders: staleRenders.length,
      // Three words, not two. A reader must be able to tell "checked, and it
      // held" from "checked, and it did not" from "not checked at all", and
      // `pass: false` collapses the last two into the middle one.
      state: staleRenders.length > 0 ? 'stale' : ok && identified ? 'pass' : 'fail',
      // Carried so the report can say, on a stale row, that the last verdict
      // anyone recorded was a failure. Losing this is how a redraw would launder
      // a defect into silence.
      recordedFindings: recorded.length,
      pass: ok && identified && staleRenders.length === 0,
    });
  }

  return {
    failures,
    stale,
    staleArt,
    /**
     * The single question a caller should ask about the exit code, so that no
     * caller has to remember that one of the two stale channels is fatal and the
     * other is not. `stale` is deliberately absent from this: it is advisory
     * unless the caller asked for `--require-identification`, and only the
     * caller knows whether it did.
     */
    fatal: failures.length > 0 || staleArt.length > 0,
    scored,
    identification,
    unrendered: [...unrendered],
    totals: {
      renders: entries.length,
      gatingRenders: gating.length,
      diagnosticRenders: entries.length - gating.length,
      // What was actually scored, beside what was merely present. Two numbers
      // because their DIFFERENCE is the finding: a run whose keymap is full and
      // whose live set is empty reads as busy and decided nothing.
      rendersScored: live.length,
      rendersStaleArt: entries.length - live.length,
      subjectsScored: scored.length,
      subjectsPassed: scored.filter((row) => row.pass).length,
      subjectsStaleArt: scored.filter((row) => row.state === 'stale').length,
      subjectsUnrendered: unrendered.size,
      featuresChecked,
      featuresUncheckable: scored.reduce((sum, row) => sum + row.featuresUncheckable, 0),
    },
  };
}
