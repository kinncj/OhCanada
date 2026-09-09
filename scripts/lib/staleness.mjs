/**
 * ADR-0016 §2 and §3, as one implementation.
 *
 * Two gates ask the same three questions about a question and its source
 * register:
 *
 *   1. Which staleness flags cover this claim? (`applicableFlags`)
 *   2. Does any answer depend on a term one of those flags bans? (§3,
 *      `bannedTermFaults`)
 *   3. Which row of §2's re-check table is this claim's chapter on, given the
 *      register's `liveChecks[]` and the answer to (2)? (`dispositionRow`)
 *
 * The gates are `scripts/verify-content.mjs` and
 * `tests/unit/contracts/questions-cite-a-cached-source.test.ts`. Until this file
 * existed they each carried their own copy, written line by line against the
 * other, and ADR-0016 recorded that as a named boundary defect with an
 * obligation to extract exactly this module. The dangerous direction was
 * specific: if one copy tightened row 2 and the other did not, the second would
 * exempt questions from a demand the first still held, and BOTH files would
 * pass. This module is that obligation discharged; the two copies of
 * `applicableFlags` are gone with it.
 *
 * WHY IT IS `.mjs` AND NOT `.ts`. It is neither domain nor application — it is
 * build-time content tooling, and one of its two callers is a Node script that
 * runs with no build step (CLAUDE.md/ADR-0005 keep `app/` free of this). The
 * hand-written `staleness.d.mts` beside it is what lets the TypeScript contract
 * test import it under `strict` without `allowJs`; if a signature here changes
 * and that file does not follow, `make typecheck` fails, which is the point.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DECIDE. ADR-0016 records one divergence
 * found while the second copy was being written, and it is still open:
 * `dispositionRow` reads only `liveChecks[].finding` and never
 * `pages[].agreesWithCache`, so a check recording `finding: "source-unrevised"`
 * on an entry whose page says `agreesWithCache: false` grants row 2, and the
 * schema permits that combination. It is probably a real gap — `agreesWithCache`
 * is the per-chapter evidence and `finding` is the per-check summary, and on a
 * multi-chapter check the summary can be true of one chapter and false of
 * another. It is a decision about §2's table, it belongs to whoever owns the
 * ADR, and extracting the rule into one file is NOT the moment to make it
 * quietly. Behaviour here is byte-for-byte the behaviour both copies had.
 */

/**
 * ADR-0003 and ADR-0016: 180 days is the age at which a granted status stops
 * being trusted. On row 1 the clock is the question's `source.asOf`; on row 2 it
 * is the register's `liveChecks[].checkedAt`. One number, because it is one
 * rule.
 */
export const STALE_AFTER_DAYS = 180;

const str = (value) => (typeof value === 'string' ? value : null);
const int = (value) => (typeof value === 'number' && Number.isInteger(value) ? value : null);

/**
 * A banned term appears in text when it appears as a WHOLE word,
 * case-insensitively.
 *
 * Whole-word rather than substring, because the terms are ordinary English and
 * French words: a substring match on "53" hits "1953" and "253", and one on
 * "Elizabeth" is fine but one on "Queen" would hit "Queensland". The register
 * chooses the terms and a term that still over-fires is refined there, which is
 * the safe direction — a build failure and one edit, against shipping a wrong
 * fact to somebody studying for a citizenship test.
 *
 * "Whole word" is bounded by anything that is not a letter or a digit. The
 * apostrophe is deliberately a BOUNDARY and not word-like, which the fixtures
 * caught: treating it as word-like made French elision ("l'Elizabeth") miss,
 * and — far worse — made the English possessive ("Elizabeth's reign") miss too.
 * Both failures are in the dangerous direction, letting a banned term ship by
 * being adjacent to punctuation. Letters are matched by Unicode property, so
 * accented French is a word and "Elisabeth" is one word, not two.
 *
 * The term itself may contain spaces ("Her Majesty", "53 other nations"), which
 * is why this is a boundary check around a literal rather than a token set.
 */
const WORDLIKE = /[\p{L}\p{N}]/u;

export const mentionsTerm = (text, term) => {
  const haystack = text.toLocaleLowerCase();
  const needle = term.trim().toLocaleLowerCase();
  if (needle === '') return false;
  for (let from = 0; ; ) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? '' : haystack.charAt(at - 1);
    const after = haystack.charAt(at + needle.length);
    if (!WORDLIKE.test(before) && !WORDLIKE.test(after)) return true;
    from = at + 1;
  }
};

/**
 * Every player-readable string of a question that an answer could hide a stale
 * fact in.
 *
 * The PROMPT is deliberately not included. A question may legitimately ask about
 * a stale topic — the wrongness is in asserting a stale value as an answer, not
 * in naming the subject. Options and explanation are what a player is told is
 * TRUE.
 */
export const answerText = (question) => {
  const from = (value) =>
    value === null || typeof value !== 'object'
      ? []
      : [str(value.en), str(value.fr)].filter((text) => text !== null);
  const options = Array.isArray(question.options) ? question.options : [];
  return [...options.flatMap(from), ...from(question.explanation ?? null)];
};

/**
 * The staleness flags covering a claim, at the finest grain the flag offers.
 *
 * Page grain is preferred and chapter grain is the fallback, which is the whole
 * point: a flag on two facts in a long chapter used to force all 57 authored
 * questions volatile, and a flag that fires on everything carries the same
 * information as one that fires on nothing. A page-grain flag on a question with
 * no page cannot be ruled out, so it still applies — the missing page is its own
 * fault, reported separately by the contract gate.
 */
export const applicableFlags = (manifest, chapter, page) =>
  (manifest.knownStaleness ?? []).filter((flag) => {
    if (!(flag.affects ?? []).some((affected) => str(affected) === chapter)) return false;
    const flagPages = (flag.pages ?? []).flatMap((value) => {
      const parsed = int(value);
      return parsed === null ? [] : [parsed];
    });
    if (str(flag.grain) !== 'pages' || flagPages.length === 0) return true;
    return page === null || flagPages.includes(page);
  });

/**
 * ADR-0016 §3: no shipped answer may depend on a fact the source will never
 * correct.
 *
 * When a flag declares `upstream: "does-not-revise"`, the live page states the
 * same wrong thing the cache does, so re-verification can only ever return
 * "unchanged". The mitigation that works is the one the author used unprompted —
 * write the answers so that none of them depends on the stale fact — and this is
 * what makes that a checked property instead of an unrecorded judgement.
 *
 * A VIOLATED BAN IS A DEFECT IN THE ANSWER. It is not a reason to demand
 * `volatile`, and it is not a state a re-check can clear. That is why this
 * returns faults of its own rather than only feeding `dispositionRow`: from the
 * day §3 landed until 2026-09-09 the only consequence of breaking a ban inside
 * `verify-content` was a demotion from row 2 to row 1, and row 1 fails only a
 * volatile claim whose `asOf` has passed 180 days — so a banned term could be
 * injected into a shipped option and `verify-content` stayed green. The
 * demotion is still right (nothing is excused by a rule it is currently
 * breaking) and it is still applied by `dispositionRow`; it was never the
 * failure.
 */
export const bannedTermFaults = (question, sourceId, flags, where) => {
  const texts = answerText(question);
  const faults = [];
  for (const flag of flags) {
    const banned = (flag.bannedFromAnswers ?? []).flatMap((value) => {
      const term = str(value);
      return term === null ? [] : [term];
    });
    if (banned.length === 0) continue;
    const hits = banned.filter((term) => texts.some((text) => mentionsTerm(text, term)));
    if (hits.length === 0) continue;
    faults.push(
      `${where}: an option or explanation contains ${hits.map((term) => `"${term}"`).join(', ')}, ` +
        `which ${sourceId} bans from answers under the staleness flag "${str(flag.topic) ?? '?'}". ` +
        `That flag declares upstream: "does-not-revise" - the official source states the same ` +
        `out-of-date thing the cache does, so re-verifying can never correct this and marking the ` +
        `question volatile buys nothing. Route the answer around the stale fact: change the option ` +
        `or the explanation so it does not depend on it. If the term is over-broad, refine the ` +
        `entry in the register rather than removing it.`,
    );
  }
  return faults;
};

/**
 * The live checks naming a chapter, oldest first. Per chapter and not per
 * source: a document with several chapters lives at several URLs and they are
 * revised independently, so a verdict for the whole source would average
 * unrelated facts. A finding about `How Canadians Govern Themselves`, whose page
 * has not been touched since 2017, says nothing about `Who We Are`, whose page
 * was modified last month and still carries 2006-era census shares.
 */
export const liveChecksForChapter = (manifest, chapter) =>
  [...(manifest.liveChecks ?? [])]
    .filter((check) => (check.pages ?? []).some((page) => str(page.chapter) === chapter))
    .sort((a, b) => String(a.checkedAt).localeCompare(String(b.checkedAt)));

/**
 * ADR-0016 §2's four-row table: which row is this claim's chapter on?
 *
 * The disposition belongs to the SOURCE and is read per chapter. The live check
 * that governs a question is the most recent one whose `pages[]` names the
 * question's chapter; when no check names it, the question falls to row 1, which
 * is the pre-ADR-0016 behaviour and the safe direction. Every branch that is not
 * row 2 or row 3 returns row 1: when in doubt, keep the clock on the question.
 *
 * `unreachableTail` counts the consecutive `source-unreachable` checks at the
 * end of the list. It is returned rather than reported here because this module
 * has no output of its own — a rule that printed would be a rule the fixtures
 * could not run silently.
 */
export const dispositionRow = (manifest, chapter, flags, banRespected) => {
  const checks = liveChecksForChapter(manifest, chapter);
  if (checks.length === 0) {
    return {
      row: 1,
      why: 'no live check in the register names this chapter',
      check: null,
      unreachableTail: 0,
    };
  }

  // `source-unreachable` is explicitly "no state change": it does not become the
  // disposition, it defers to the last check that decided anything. ADR-0016
  // keeps it separate from `source-withdrawn` for exactly this reason — a DNS
  // failure is not a retraction.
  let unreachableTail = 0;
  for (let i = checks.length - 1; i >= 0; i -= 1) {
    if (str(checks[i].finding) !== 'source-unreachable') break;
    unreachableTail += 1;
  }
  const decisive = checks.filter((check) => str(check.finding) !== 'source-unreachable').at(-1);

  if (decisive === undefined) {
    return {
      row: 1,
      why: 'every live check for this chapter is source-unreachable',
      check: null,
      unreachableTail,
    };
  }

  const finding = str(decisive.finding);
  if (finding === 'source-withdrawn') {
    return { row: 3, why: 'source-withdrawn', check: decisive, unreachableTail };
  }
  if (finding === 'source-revised') {
    return {
      row: 1,
      why: 'the latest live check found the source revised',
      check: decisive,
      unreachableTail,
    };
  }
  if (finding !== 'source-unrevised') {
    return {
      row: 1,
      why: `unrecognised finding ${String(finding)}`,
      check: decisive,
      unreachableTail,
    };
  }

  // Row 2 additionally requires that EVERY flag over this claim has declared the
  // source will not revise, and that the question satisfies the banned-answer
  // list that declaration makes mandatory. A flag still saying `unknown` means
  // nobody has established the source is unrevised THERE, and `unknown` is
  // treated exactly as `revises`.
  const undeclared = flags.filter((flag) => str(flag.upstream) !== 'does-not-revise');
  if (undeclared.length > 0) {
    return {
      row: 1,
      why:
        `the live check found the source unrevised, but the flag(s) ` +
        `${undeclared.map((flag) => `"${str(flag.topic) ?? '?'}"`).join(', ')} over this claim ` +
        `declare upstream ${undeclared.map((flag) => str(flag.upstream) ?? 'absent').join(', ')}, ` +
        `and absent and "unknown" are treated exactly as "revises"`,
      check: decisive,
      unreachableTail,
    };
  }
  // A question whose answers still depend on the stale fact has not put row 2's
  // mitigation in place, so it does not get row 2's exemption. Nothing is
  // excused by a rule it is currently breaking. The BAN ITSELF fails in
  // `bannedTermFaults`; this branch only decides which clock the question is on
  // afterwards.
  if (!banRespected) {
    return {
      row: 1,
      why:
        'the flags declare does-not-revise but this question does not satisfy their ' +
        'bannedFromAnswers list, so the only mitigation row 2 rests on is not in place',
      check: decisive,
      unreachableTail,
    };
  }
  return {
    row: 2,
    why: 'source-unrevised, and every flag declares does-not-revise',
    check: decisive,
    unreachableTail,
  };
};
