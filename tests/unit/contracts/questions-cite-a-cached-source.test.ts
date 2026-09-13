/**
 * ADR-0003 turns on a `sourceHash`: a verification status is granted *for a
 * hash*, so when canada.ca edits the page the hash stops matching and the claim
 * falls out of the build without anyone noticing the edit. That mechanism has
 * two ends, and until slice 1 task 1.2 only one of them existed. A question
 * carried a chapter title and a 64-character string; nothing said which document
 * either referred to, and nothing could check them. `FactSource.sourceId` names
 * the `content/sources/<id>.json` manifest, and this file is what makes naming it
 * mean something.
 *
 * Four checks, all of them cross-document and therefore impossible in JSON
 * Schema, which cannot read a second file:
 *
 *   1. `sourceId` names a manifest that exists.
 *   2. `chapter` is one of that manifest's `chapters[].title`. A chapter cited by
 *      a title the source does not use is a citation of nothing.
 *   3. `sourceHash` is the hash of what the verifier actually read — the
 *      manifest's `extractedTextSha256` when there is an extraction, its `sha256`
 *      otherwise. A mismatch means the source moved and the claim is stale.
 *   4. **A question drawn from a region the manifest already flags as stale is
 *      marked `volatile` — when, and only when, `volatile` is what arms its
 *      clock.**
 *
 * Check 4 is the one worth explaining. The cached *Discover Canada* is the 2012
 * large-print edition, and its Oath of Citizenship is a trap rather than merely
 * an old page: it **already carries the June 2021 amendment** recognising the
 * Aboriginal and treaty rights of First Nations, Inuit and Métis peoples, and in
 * the same passage still swears allegiance to "Her Majesty / Queen Elizabeth the
 * Second". The monarch is King Charles III. So one block of text is
 * simultaneously current and out of date, in both official languages, and a
 * verifier who checks whether the page was revised will find the amendment,
 * conclude that it was, and be wrong about everything else on it. A question
 * authored straight off that page would be confidently, officially wrong about
 * the Oath, in a game teaching people to take it.
 *
 * The manifest records those regions in `knownStaleness[]`. A `knownStaleness`
 * block an author is trusted to read is prose; this makes it a gate.
 *
 * **ADR-0016's amendment of 2026-09-08 is why check 4 reads a row and not a
 * flag.** `volatile` is not a routing directive. It is the author's judgement
 * that a fact can change without notice, and the only thing a gate can do with
 * it is observe that on ADR-0016 §2 **row 1** it is what arms the 180-day
 * `source.asOf` quarantine in `verify-content`. On **row 2** the clock has moved
 * to the source — `liveChecks[].checkedAt` — and demanding `volatile` buys a
 * live fetch per question per run against a page that has been established as
 * unrevised, which is a re-check that structurally cannot produce a finding.
 *
 * So the demand fires per row, and the row comes from the **register**, never
 * from the flag alone. `upstream: "does-not-revise"` on its own is an undated
 * sentence somebody typed after reading a page once; exempting on it would be an
 * obligation switched off by an assertion that never expires. Row 2 needs the
 * flag's declaration *and* a dated `liveChecks[]` entry finding
 * `source-unrevised` for that chapter, and when that entry ages past 180 days
 * the exemption lapses and the volatile demand comes back. The mechanism that
 * grants the exemption is the mechanism that revokes it.
 *
 * That is also why this file takes a `today`: the corpus check below runs on the
 * real clock and **can turn a green tree red with no commit**, exactly like
 * `check-obligations`. That is the expiry working, not a flake.
 *
 * **§2's table is not implemented here.** It used to be — a second copy of
 * `dispositionFor` from `scripts/verify-content.mjs`, written against it line by
 * line, with nothing keeping the two agreeing. ADR-0016 recorded that as a
 * boundary defect with an obligation to extract one shared module, and
 * `scripts/lib/staleness.mjs` is that module: this file and the script now
 * import `applicableFlags`, `dispositionRow` and `bannedTermFaults` from it, so
 * a change to the rule cannot reach one gate and miss the other. What is left
 * here is what a contract test owns — the fixtures that pin each branch, and the
 * corpus the rule is run over.
 *
 * **What this cannot do, stated so its silence is not read as coverage:** it
 * cannot tell whether a `knownStaleness` entry should exist. The gate enforces
 * the link between a flag and the questions under it; noticing that a source has
 * gone stale in a region nobody flagged is the verifier's judgement against the
 * live page, and no check here substitutes for it.
 *
 * **The corpus is every claim under `content/`, and the file name is older than
 * that.** Until this was widened, both this file and `scripts/verify-content.mjs`
 * walked `content/questions/` — while ADR-0003's second amendment had already
 * said "verification now follows the claim rather than the screen it appears
 * on", and `content/quests/` and `content/levels/` had been carrying 60 factual
 * `factClaim` blocks for a slice. Every check below now runs over a normalised
 * CLAIM from `scripts/lib/claims.mjs`, so a landmark blurb's `fact.source` and a
 * question's `source` are the same thing to read, and the sourceId, chapter,
 * hash, page-range, staleness, banned-term and quote-contiguity rules apply
 * wherever the sentence is. The file keeps its name because `source.schema.json`,
 * ADR-0003, ADR-0016 and ADR-0028 all cite it by path, and a rename would trade
 * one dangling reference for four.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0016 §2 and §3, imported rather than restated. The module is `.mjs`
 * because `scripts/verify-content.mjs` is a plain Node script with no build
 * step; `scripts/lib/staleness.d.mts` beside it is what makes this import typed
 * under `strict`, and it fails `make typecheck` if a signature moves.
 */
import {
  CLAIM_COLLECTIONS,
  claimsIn,
  containsRun,
  indexText,
  isSchemaDocument,
  questionClaim,
  type Claim,
} from '../../../scripts/lib/claims.mjs';
import {
  applicableFlags,
  bannedTermFaultsIn,
  dispositionRow,
  mentionsTerm,
  STALE_AFTER_DAYS,
  type LiveCheckLike,
  type StalenessFlag,
} from '../../../scripts/lib/staleness.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCES_DIR = `${REPO_ROOT}content/sources`;
const CONTENT_DIR = `${REPO_ROOT}content`;

interface SourceChapter {
  readonly title?: unknown;
  readonly page?: unknown;
  readonly endPage?: unknown;
}
// The shapes a register carries, named once in the module that reads them. The
// aliases keep this file's fixtures reading as they did when it defined them.
type KnownStaleness = StalenessFlag;
type LiveCheck = LiveCheckLike;

interface SourceManifest {
  readonly id?: unknown;
  readonly committed?: unknown;
  readonly sha256?: unknown;
  readonly pages?: unknown;
  readonly extractedText?: unknown;
  readonly extractedTextSha256?: unknown;
  readonly chapters?: readonly SourceChapter[];
  readonly knownStaleness?: readonly KnownStaleness[];
  readonly liveChecks?: readonly LiveCheck[];
}
interface LocalizedTextLike {
  readonly en?: unknown;
  readonly fr?: unknown;
}
interface QuestionLike {
  readonly id?: unknown;
  readonly options?: readonly LocalizedTextLike[];
  readonly explanation?: LocalizedTextLike;
  readonly source?: {
    readonly sourceId?: unknown;
    readonly chapter?: unknown;
    readonly page?: unknown;
    readonly quote?: unknown;
    readonly sourceHash?: unknown;
    readonly volatile?: unknown;
  };
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const int = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

/** Whole days from an ISO date to another, or null if either is unreadable. */
const ageInDays = (from: string, to: string): number | null => {
  const then = Date.parse(`${from}T00:00:00Z`);
  const now = Date.parse(`${to}T00:00:00Z`);
  return Number.isNaN(then) || Number.isNaN(now) ? null : Math.round((now - then) / 86_400_000);
};

/**
 * The whole check as one pure function over an already-normalised CLAIM, so the
 * fixtures below exercise the same code the corpus does. A predicate proved on
 * fixtures and a predicate run over content must not be two predicates — and
 * from slice 1 until this file was widened they were not two predicates, they
 * were one predicate run over one third of the corpus. The walk below covers
 * every claim under `content/`, and `scripts/lib/claims.mjs` is what makes a
 * question's `source` and a dialogue line's `fact.source` the same thing to read.
 */
export const claimFaults = (
  claim: Claim,
  manifests: ReadonlyMap<string, SourceManifest>,
  // The real clock by default. Row 2's exemption expires against this, so the
  // corpus check below is deliberately date-dependent; the fixtures pin it.
  today: string = new Date().toISOString().slice(0, 10),
): readonly string[] => {
  const where = claim.at;
  const source = claim.source;
  // `factual: false` is the author's recorded judgement that a line states no
  // fact, and the schema then forbids it a source. Nothing to cite, nothing to
  // check.
  if (source === null) return [];
  const sourceId = str(source.sourceId);
  const chapter = str(source.chapter);
  const sourceHash = str(source.sourceHash);
  if (sourceId === null || chapter === null || sourceHash === null) return [];

  const manifest = manifests.get(sourceId);
  if (manifest === undefined) {
    return [
      `${where}: source.sourceId is "${sourceId}" and content/sources/${sourceId}.json does not ` +
        `exist. Known sources: ${[...manifests.keys()].join(', ') || '(none)'}`,
    ];
  }

  const found: string[] = [];

  const titles = (manifest.chapters ?? []).flatMap((entry) => {
    const title = str(entry.title);
    return title === null ? [] : [title];
  });
  if (!titles.includes(chapter)) {
    found.push(
      `${where}: source.chapter is "${chapter}", which is not a chapter of ${sourceId}. ` +
        `A chapter cited by a title the source does not use is a citation of nothing. ` +
        `Chapters: ${titles.join(' | ')}`,
    );
  }

  // What the verifier read is what the status was granted against.
  const expectedHash =
    manifest.extractedText === undefined
      ? str(manifest.sha256)
      : str(manifest.extractedTextSha256);
  if (expectedHash !== null && sourceHash !== expectedHash) {
    found.push(
      `${where}: source.sourceHash does not match ${sourceId}'s current hash. The source moved ` +
        `under this claim, so its verification no longer applies (ADR-0003). ` +
        `Question has ${sourceHash}; the manifest has ${expectedHash}.`,
    );
  }

  // --- the page, and the chapter range it has to sit inside ------------------
  const page = int(source.page);
  const citedChapter = (manifest.chapters ?? []).find((entry) => str(entry.title) === chapter);
  const chapterStart = int(citedChapter?.page);
  const chapterEnd = int(citedChapter?.endPage);

  if (page === null && int(manifest.pages) !== null) {
    found.push(
      `${where}: ${sourceId} is paginated and source.page is missing. Without it a page-grain ` +
        `staleness flag cannot be evaluated for this question, so the flag falls back to its whole ` +
        `chapter and forces every question in that chapter volatile - which is how a flag stops ` +
        `discriminating.`,
    );
  }
  if (page !== null && chapterStart !== null && chapterEnd !== null) {
    if (page < chapterStart || page > chapterEnd) {
      found.push(
        `${where}: source.page is ${String(page)} and the cited chapter "${chapter}" runs ` +
          `${String(chapterStart)}-${String(chapterEnd)}. Either the page or the chapter is wrong; a ` +
          `chapter without an endPage used to hide this, because every page after a chapter's start ` +
          `belonged to it by accident.`,
      );
    }
  }

  // --- staleness, at the finest grain the flag offers ------------------------
  //
  // Page grain is preferred and chapter grain is the fallback, which is the
  // whole point: a flag on two facts in a long chapter used to force all 57
  // authored questions volatile, and a flag that fires on everything carries the
  // same information as one that fires on nothing.
  const flags = applicableFlags(manifest, chapter, page);

  // --- answers may not depend on a fact the source will never correct --------
  //
  // ADR-0016 §3. When a flag declares `upstream: "does-not-revise"`, the live
  // page states the same wrong thing, so re-verification can only ever return
  // "unchanged". The mitigation that works is the one the author used unprompted
  // — write the answers so that none of them depends on the stale fact — and this
  // is what makes that a checked property instead of an unrecorded judgement.
  //
  // The check is deliberately on the ANSWERS, not the question. A prompt may name
  // a stale topic; what may not happen is a player being told a stale value is
  // true.
  //
  // It runs before the volatile branch because its result is an INPUT to that
  // branch: a question breaking the ban has not put row 2's mitigation in place
  // and so cannot claim row 2's exemption.
  // `verify-content` fails on exactly these strings, from exactly this call.
  // Until 2026-09-09 it did not: the script fed the ban into the row and nothing
  // else, so a banned term in a shipped option demoted the question from row 2
  // to row 1 and produced no failure there at all. This file was the only gate
  // that failed it.
  //
  // `claim.asserted` is what a player is told is TRUE — a question's options and
  // explanation, and every word of a blurb or a dialogue line, which have no
  // prompt to hold apart from their answers.
  const banFaults = [...bannedTermFaultsIn(claim.asserted, sourceId, flags, where, claim.surface)];

  // --- volatile, demanded on the rows where volatile is what arms the clock ---
  //
  // ADR-0016 amendment 2026-09-08. The demand is not "a flag applies"; it is
  // "a flag applies AND this chapter is on a row where `volatile` is the only
  // clock the question has". The row comes from the register's `liveChecks[]`,
  // never from `upstream` alone.
  if (flags.length > 0 && source.volatile !== true) {
    const disposition = dispositionRow(manifest, chapter, flags, banFaults.length === 0);
    const checkedAt = str(disposition.check?.checkedAt);
    const age = checkedAt === null ? null : ageInDays(checkedAt, today);
    const exempt = disposition.row === 2 && age !== null && age <= STALE_AFTER_DAYS;

    const grains = flags
      .map((entry) => {
        const topic = str(entry.topic) ?? '?';
        return str(entry.grain) === 'pages'
          ? `${topic} (pages ${(entry.pages ?? []).join(', ')})`
          : `${topic} (whole chapter)`;
      })
      .join('; ');

    if (!exempt) {
      const because =
        disposition.row === 3
          ? `the latest live check for "${chapter}" found the page source-withdrawn, so every ` +
            `claim citing it quarantines (ADR-0016 §2 row 3) and volatile is the least of it`
          : disposition.row === 2
            ? `"${chapter}" is on ADR-0016 §2 row 2, but the live check that put it there ` +
              `${age === null ? `has no readable checkedAt (${checkedAt ?? 'absent'})` : `was ${String(age)} days ago, over ${String(STALE_AFTER_DAYS)}`}. ` +
              `Row 2's exemption from this demand rests entirely on that date, so it has lapsed and ` +
              `the clock falls back onto the claim. The real fix is ONE live check appended to ` +
              `${sourceId}'s liveChecks[] for this chapter, not N re-verifications`
            : `"${chapter}" is on ADR-0016 §2 row 1 (${disposition.why}), and on row 1 volatile is ` +
              `what arms the only clock the claim has: verify-content quarantines a volatile ` +
              `claim once source.asOf passes ${String(STALE_AFTER_DAYS)} days, and a non-volatile ` +
              `row-1 claim is on no clock at all`;
      found.push(
        `${where}: ${sourceId} flags this claim as known-stale - ${grains} - and the claim is not ` +
          `marked volatile. ${because}. Set source.volatile to true, or move the claim off the ` +
          `flagged page.`,
      );
    }
  }
  if (flags.length === 0 && source.volatile === true) {
    // Not a failure. Over-marking is safe and sometimes right: a fact can be
    // volatile for a reason the register has not noticed, which is exactly the
    // judgement the staleness gate says it cannot make. The same applies to a
    // question marked volatile under a row-2 flag: the exemption lifts the
    // DEMAND, it does not forbid the mark.
  }

  found.push(...banFaults);

  return found;
};

/**
 * The same check, entered from a question literal. Every fixture below is a
 * question shaped by hand, and they go through the same normalisation the corpus
 * does rather than through a second door into the predicate.
 */
export const citationFaults = (
  question: QuestionLike,
  where: string,
  manifests: ReadonlyMap<string, SourceManifest>,
  today: string = new Date().toISOString().slice(0, 10),
): readonly string[] => claimFaults(questionClaim(question, where), manifests, today);

const jsonFilesUnder = (dir: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return jsonFilesUnder(path);
        return entry.isFile() && path.endsWith('.json') ? [path] : [];
      })
    : [];

/**
 * EVERY CLAIM UNDER content/, found by shape — the corpus this file judges.
 *
 * It used to be `jsonFilesUnder(QUESTIONS_DIR)`, in both of the places below,
 * and that one expression was this gate's entire scope. ADR-0018 and ADR-0019
 * both name the shape of that mistake: a gate that checks claims is scoped by
 * the set of places a claim can be made, not by a directory of a convenient
 * name. The schemas are the one exclusion, because they DEFINE the two shapes
 * rather than instantiating them.
 */
const CORPUS: readonly Claim[] = jsonFilesUnder(CONTENT_DIR).flatMap((path) => {
  const where = path.slice(REPO_ROOT.length);
  if (isSchemaDocument(where)) return [];
  return claimsIn(JSON.parse(readFileSync(path, 'utf8')), where);
});

/** The claims that state a fact, which are the ones every rule below is about. */
const FACTUAL: readonly Claim[] = CORPUS.filter((claim) => claim.factual);

const manifests = new Map<string, SourceManifest>(
  jsonFilesUnder(SOURCES_DIR).flatMap((path) => {
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as SourceManifest;
    const id = str(manifest.id);
    return id === null ? [] : [[id, manifest] as const];
  }),
);

/* -------------------------------------------------------------------------- */
/* ADR-0016 — an unrevised source, and the answers that route around it        */
/* -------------------------------------------------------------------------- */

describe('answers do not depend on a fact the source will never correct (ADR-0016)', () => {
  const unrevised = new Map<string, SourceManifest>([
    [
      'discover-canada',
      {
        id: 'discover-canada',
        sha256: 'a'.repeat(64),
        extractedText: 'discover-canada.txt',
        extractedTextSha256: 'b'.repeat(64),
        pages: 129,
        chapters: [{ title: 'How Canadians Govern Themselves', page: 54, endPage: 59 }],
        knownStaleness: [
          {
            topic: 'The monarch and the Commonwealth',
            affects: ['How Canadians Govern Themselves'],
            grain: 'chapter',
            upstream: 'does-not-revise',
            bannedFromAnswers: ['Her Majesty', 'Elizabeth', '53 other nations', '308'],
          },
        ],
      },
    ],
  ]);

  const ask = (options: readonly string[], explanation = 'A neutral explanation.'): QuestionLike => ({
    id: 'q',
    options: options.map((en) => ({ en, fr: en })),
    explanation: { en: explanation, fr: explanation },
    source: {
      sourceId: 'discover-canada',
      chapter: 'How Canadians Govern Themselves',
      page: 56,
      sourceHash: 'b'.repeat(64),
      volatile: true,
    },
  });

  it('accepts answers written around the stale facts', () => {
    // This is what the author actually did, unprompted, and what made 54 of 57
    // questions verifiable off an unrevised source. The rule exists to keep it
    // true rather than to discover it was.
    expect(
      citationFaults(
        ask(
          ['The Sovereign', 'The Prime Minister', 'The Speaker', 'The Chief Justice'],
          'Canada is a constitutional monarchy; the Sovereign is the head of state.',
        ),
        'f',
        unrevised,
      ),
    ).toEqual([]);
  });

  it('rejects an option that names the stale monarch', () => {
    const faults = citationFaults(ask(['Queen Elizabeth II', 'B', 'C', 'D']), 'f', unrevised);
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('"Elizabeth"');
    expect(faults[0]).toContain('does-not-revise');
  });

  it('rejects a stale count hidden in the explanation rather than an option', () => {
    // The explanation is player-facing prose asserting a fact, so it is an
    // answer for this purpose. Checking only the options would leave the easiest
    // place to put a wrong number unchecked.
    const faults = citationFaults(
      ask(['A', 'B', 'C', 'D'], 'The Commonwealth has 53 other nations besides Canada.'),
      'f',
      unrevised,
    );
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('"53 other nations"');
  });

  it('reads the French text too', () => {
    const question = ask(['A', 'B', 'C', 'D']);
    const french: QuestionLike = {
      ...question,
      options: [{ en: 'A', fr: 'Sa Majeste la reine Elizabeth II' }, ...(question.options ?? []).slice(1)],
    };
    // Both official languages ship, so a stale fact in only one of them is a
    // stale fact shipped to half the players.
    expect(citationFaults(french, 'f', unrevised)).toHaveLength(1);
  });

  it('does not fire on the prompt, which may name the stale topic', () => {
    const question = ask(['A', 'B', 'C', 'D']);
    expect(citationFaults({ ...question, id: 'q' }, 'f', unrevised)).toEqual([]);
  });

  it('does not fire when the flag names no banned terms', () => {
    // `bannedFromAnswers` is required only when a flag declares
    // `upstream: "does-not-revise"` (the schema enforces that). A flag against a
    // maintained source keeps the old behaviour: volatile, re-verify, quarantine.
    const maintained = new Map<string, SourceManifest>([
      [
        'discover-canada',
        {
          ...(unrevised.get('discover-canada') as SourceManifest),
          knownStaleness: [
            {
              topic: 'Named office holders',
              affects: ['How Canadians Govern Themselves'],
              grain: 'chapter',
              upstream: 'revises',
            },
          ],
        },
      ],
    ]);
    expect(citationFaults(ask(['Queen Elizabeth II', 'B', 'C', 'D']), 'f', maintained)).toEqual([]);
  });

  describe('whole-word matching', () => {
    it.each([
      ['53 other nations', 'There are 53 other nations.', true],
      ['53 other nations', 'There are 153 other nations.', false],
      ['308', 'There are 308 seats.', true],
      ['308', 'Route 3081 is long.', false],
      ['308', 'The number is 1308.', false],
      ['Elizabeth', "l'Elizabeth", true],
      ['Elizabeth', "Elizabeth's reign", true],
      ['Elizabeth', 'Elizabethan', false],
      ['Elizabeth', 'Queen Elizabeth II, 1952-2022.', true],
      ['Her Majesty', 'a symbol of Her Majesty, the Queen', true],
      ['Her Majesty', 'her majesty is lowercase here', true],
    ])('%s in "%s" -> %s', (term, text, expected) => {
      // Two directions, both proved rather than asserted in a comment. A
      // substring match would report "153 other nations" and "1308" as hits,
      // which is how a term list stops being usable and starts being argued
      // with. A token match that treats the apostrophe as part of a word would
      // miss "Elizabeth's", which is how a banned term ships.
      expect(mentionsTerm(text, term)).toBe(expected);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* ADR-0016 amendment — the volatile demand is row 1's, and the row is the      */
/* register's, not the flag's                                                   */
/* -------------------------------------------------------------------------- */

describe("the volatile demand follows ADR-0016 §2's row, not upstream alone", () => {
  const TODAY = '2026-09-08';
  const daysBefore = (days: number, from = TODAY): string =>
    new Date(Date.parse(`${from}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

  const flag = (over: Partial<KnownStaleness> = {}): KnownStaleness => ({
    topic: 'The monarch',
    affects: ['How Canadians Govern Themselves'],
    grain: 'pages',
    pages: [56],
    upstream: 'does-not-revise',
    bannedFromAnswers: ['Elizabeth'],
    ...over,
  });

  const check = (over: Partial<LiveCheck> = {}): LiveCheck => ({
    checkedAt: TODAY,
    checkedBy: 'content-verifier',
    finding: 'source-unrevised',
    consequence: 'recorded',
    pages: [
      {
        url: 'https://example.invalid/how-canadians-govern-themselves.html',
        chapter: 'How Canadians Govern Themselves',
        sourceDateModified: '2017-12-21',
        agreesWithCache: true,
        claimsCompared: ["the Sovereign's role and title"],
      },
    ],
    ...over,
  });

  const register = (
    flags: readonly KnownStaleness[],
    checks: readonly LiveCheck[] | undefined,
  ): ReadonlyMap<string, SourceManifest> =>
    new Map([
      [
        'discover-canada',
        {
          id: 'discover-canada',
          sha256: 'a'.repeat(64),
          extractedText: 'discover-canada.txt',
          extractedTextSha256: 'b'.repeat(64),
          pages: 129,
          chapters: [{ title: 'How Canadians Govern Themselves', page: 54, endPage: 59 }],
          knownStaleness: flags,
          ...(checks === undefined ? {} : { liveChecks: checks }),
        },
      ],
    ]);

  const ask = (options: readonly string[] = ['A', 'B', 'C', 'D']): QuestionLike => ({
    id: 'q',
    options: options.map((en) => ({ en, fr: en })),
    explanation: { en: 'A neutral explanation.', fr: 'A neutral explanation.' },
    source: {
      sourceId: 'discover-canada',
      chapter: 'How Canadians Govern Themselves',
      page: 56,
      sourceHash: 'b'.repeat(64),
      volatile: false,
    },
  });

  const demandsVolatile = (
    manifests: ReadonlyMap<string, SourceManifest>,
    question: QuestionLike = ask(),
  ): readonly string[] =>
    citationFaults(question, 'f', manifests, TODAY).filter((fault) =>
      fault.includes('not marked volatile'),
    );

  describe('both halves of row 2 are required, and the flag is only one of them', () => {
    it('does not demand volatile when a fresh live check finds the source unrevised', () => {
      // The fifteen collateral questions. Under `does-not-revise` a re-fetch can
      // only ever return "unchanged", so demanding the mark that routes to a
      // re-fetch is an obligation whose success condition is unreachable.
      expect(demandsVolatile(register([flag()], [check()]))).toEqual([]);
    });

    it('still demands volatile when nothing in the register backs the declaration', () => {
      // THE TRAP, and the reason `upstream` alone is not the predicate. A flag
      // saying "the source will never revise this" and no live check is an
      // undated sentence somebody typed after reading a page once. Exempting on
      // it switches off the only clock the question has and puts nothing in its
      // place — the vacuity moved one level up rather than removed.
      const faults = demandsVolatile(register([flag()], undefined));
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('no live check in the register names this chapter');
      expect(faults[0]).toContain('row-1 claim is on no clock at all');
    });

    it('still demands volatile when the flag says unknown', () => {
      const faults = demandsVolatile(register([flag({ upstream: 'unknown' })], [check()]));
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('"unknown" are treated exactly as "revises"');
    });

    it('still demands volatile when the flag says revises', () => {
      expect(demandsVolatile(register([flag({ upstream: 'revises' })], [check()]))).toHaveLength(1);
    });

    it('still demands volatile when the flag declares no upstream at all', () => {
      // Absent means unknown, and unknown is treated exactly as revises. A
      // register written before ADR-0016 must not acquire an exemption by
      // omission.
      const bare = { ...flag() };
      delete (bare as { upstream?: unknown }).upstream;
      delete (bare as { bannedFromAnswers?: unknown }).bannedFromAnswers;
      expect(demandsVolatile(register([bare], [check()]))).toHaveLength(1);
    });

    it('demands volatile when ONE of several flags over the same claim is not does-not-revise', () => {
      // The live corpus's shape on pages 2-3: two flags over the Oath, one
      // `does-not-revise` and one still `unknown`. Row 2 needs EVERY flag over
      // the region, because a single flag nobody has checked upstream means the
      // region has not been established as unrevised.
      const faults = demandsVolatile(
        register([flag(), flag({ topic: 'The Oath', upstream: 'unknown' })], [check()]),
      );
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('"The Oath"');
    });
  });

  describe('the register can revoke the exemption as well as grant it', () => {
    it('demands volatile again when the latest check finds the source revised', () => {
      const faults = demandsVolatile(
        register([flag()], [check({ checkedAt: daysBefore(30) }), check({ finding: 'source-revised' })]),
      );
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('found the source revised');
    });

    it('reads the LATEST decisive check, not the first', () => {
      // Ordering is by checkedAt, not by position in the array. A register that
      // appends out of order must not be able to resurrect an exemption.
      expect(
        demandsVolatile(
          register([flag()], [check({ finding: 'source-revised', checkedAt: daysBefore(30) }), check()]),
        ),
      ).toEqual([]);
    });

    it('treats source-unreachable as no state change, not as a revocation', () => {
      // ADR-0016 keeps `source-unreachable` apart from `source-withdrawn` for
      // this reason: a DNS failure is not a retraction, so it defers to the last
      // check that decided anything.
      expect(
        demandsVolatile(
          register([flag()], [check(), check({ finding: 'source-unreachable', checkedAt: daysBefore(1) })]),
        ),
      ).toEqual([]);
    });

    it('falls back to row 1 when every check for the chapter is unreachable', () => {
      const faults = demandsVolatile(register([flag()], [check({ finding: 'source-unreachable' })]));
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('source-unreachable');
    });

    it('demands volatile and names the quarantine when the source is withdrawn', () => {
      const faults = demandsVolatile(register([flag()], [check({ finding: 'source-withdrawn' })]));
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('source-withdrawn');
    });

    it('binds the check to the chapter, so a check on another chapter grants nothing', () => {
      // A finding about a page untouched since 2017 says nothing about a page
      // modified last month. Averaging them across a source would be the
      // container error ADR-0019 names.
      const elsewhere = check({
        pages: [
          {
            url: 'https://example.invalid/federal-elections.html',
            chapter: 'Federal Elections',
            sourceDateModified: '2025-08-08',
            agreesWithCache: true,
            claimsCompared: ['the number of electoral districts'],
          },
        ],
      });
      expect(demandsVolatile(register([flag()], [elsewhere]))).toHaveLength(1);
    });
  });

  describe('a question breaking the ban does not get the exemption the ban pays for', () => {
    it('demands volatile as well as reporting the banned term', () => {
      // Row 2's whole justification is that `bannedFromAnswers` replaces the
      // re-check. A question violating it has not put that mitigation in place,
      // so it falls to row 1 and is held to row 1's demand. Nothing is excused
      // by a rule it is currently breaking.
      const faults = citationFaults(
        ask(['Queen Elizabeth II', 'B', 'C', 'D']),
        'f',
        register([flag()], [check()]),
        TODAY,
      );
      expect(faults).toHaveLength(2);
      expect(faults.some((fault) => fault.includes('does not satisfy their bannedFromAnswers'))).toBe(
        true,
      );
      expect(faults.some((fault) => fault.includes('"Elizabeth"'))).toBe(true);
    });
  });

  describe('the exemption expires, and the expiry is the whole reason it is safe to grant', () => {
    it('holds at exactly 180 days', () => {
      expect(demandsVolatile(register([flag()], [check({ checkedAt: daysBefore(180) })]))).toEqual([]);
    });

    it('lapses at 181 days, and the demand comes back', () => {
      // The mechanism that grants the exemption is the mechanism that revokes
      // it. No second gate, no second field, and nothing to remember to check.
      const faults = demandsVolatile(register([flag()], [check({ checkedAt: daysBefore(181) })]));
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('181 days ago, over 180');
      expect(faults[0]).toContain("ONE live check appended to discover-canada's liveChecks[]");
    });

    it('lapses when the governing check has no readable date', () => {
      // Row 2 rests entirely on that date, so an unreadable one is not a reason
      // to keep trusting it.
      const faults = demandsVolatile(register([flag()], [check({ checkedAt: 'sometime' })]));
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('has no readable checkedAt');
    });

    it('does not treat over-marking under a row-2 flag as a fault', () => {
      // The exemption lifts the DEMAND; it does not forbid the mark. `volatile`
      // is still the author's judgement about the fact.
      const marked = { ...ask(), source: { ...ask().source, volatile: true } };
      expect(citationFaults(marked, 'f', register([flag()], [check()]), TODAY)).toEqual([]);
    });
  });
});

describe('the exemption does real work on the real register, and really expires (ADR-0016)', () => {
  // Fixtures prove the predicate; these two prove it is not idling. An exemption
  // that no shipped question uses, or one whose expiry no shipped question can
  // reach, is the vacuum ADR-0024 names — and it would be this amendment
  // committing the defect it was written to remove.
  //
  // BOTH directions are now exercised by the corpus. Until this file walked
  // `content/levels/`, only row 2 was: no authored QUESTION sat under a row-1
  // flag, and that asymmetry was recorded here as safe because row 1 is the
  // strict branch. Widening the walk found six territory acknowledgements citing
  // nation and Crown sources whose registers carry `knownStaleness` flags and no
  // live check at all — row 1, non-volatile, on no clock. Those are content
  // defects and they are reported by the corpus-wide check at the bottom of this
  // file, which is the one place a defect belongs; the two cases here are about
  // whether the row-2 EXEMPTION works, so they are scoped to the claims it
  // exempts rather than asserting the whole corpus is clean.
  const TODAY = new Date().toISOString().slice(0, 10);
  const LATER = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);

  const volatileDemands = (today: string): readonly string[] =>
    FACTUAL.flatMap((claim) =>
      claimFaults(claim, manifests, today).filter((fault) => fault.includes('not marked volatile')),
    );

  it('read the corpus it judges', () => {
    expect(FACTUAL.length, 'no factual claim parsed out of content/').toBeGreaterThan(0);
  });

  /** The claims ADR-0016's amendment exempts: flagged, and on row 2 today. */
  const exemptToday = FACTUAL.filter((claim) => {
    const source = claim.source;
    if (source === null || source.volatile === true) return false;
    const chapter = str(source.chapter);
    const manifest = manifests.get(str(source.sourceId) ?? '');
    if (chapter === null || manifest === undefined) return false;
    const flags = applicableFlags(manifest, chapter, int(source.page));
    return flags.length > 0 && dispositionRow(manifest, chapter, flags, true).row === 2;
  });

  it('exempts claims today that a flag-only rule would have failed', () => {
    // These are the questions the amendment is about: they sit on a flagged page
    // and carry a fact that cannot move — treaty rights, the Royal Proclamation,
    // residential schools, the 2008 apology, what "Inuit" means, Michif.
    expect(exemptToday.length, 'no shipped claim is exempted by row 2').toBeGreaterThan(0);
    const demanded = exemptToday.flatMap((claim) =>
      claimFaults(claim, manifests, TODAY).filter((fault) => fault.includes('not marked volatile')),
    );
    expect(demanded, demanded.join('\n')).toEqual([]);
  });

  it('fails those same claims once the governing live check ages out', () => {
    // The expiry proved against the register that ships, not a fixture. If this
    // ever returns nothing, the exemption has become unexpirable in practice and
    // the amendment has traded a vacuous gate for a silent one.
    //
    // Stated as the DIFFERENCE between the two clocks rather than as "everything
    // fails later", because some claims are already failing today for a reason
    // that has nothing to do with the exemption. What must be true of the
    // exemption is that running the clock forward adds demands, and that every
    // demand it adds is a lapse.
    const today = new Set(volatileDemands(TODAY));
    const newlyDemanded = volatileDemands(LATER).filter((fault) => !today.has(fault));
    expect(newlyDemanded.length, `no claim expires by ${LATER}`).toBeGreaterThan(0);
    expect(newlyDemanded.every((fault) => fault.includes('has lapsed'))).toBe(true);
    expect(newlyDemanded.some((fault) => fault.includes('liveChecks[]'))).toBe(true);
  });
});

describe('contiguity is one implementation, and it survives a PDF line break', () => {
  // TWO GATES, ONE RULE. `verify-content` and this file each used to decide for
  // themselves what "a contiguous passage of the source" meant, and they
  // disagreed once: this one compared strings, so a word the extractor broke at
  // a hyphen read as "three- quarters" and two correctly cited economy questions
  // were red here and green there. The fix at the time was to rejoin the hyphen
  // HERE, which made the two agree — and they still agree on every quote in the
  // corpus — but agreement maintained by hand across two files is the state the
  // defect started from. Both now import `containsRun` from
  // scripts/lib/claims.mjs.
  //
  // These cases are why the tokenising rule is the one that survived. The
  // extraction wraps at the column width, so both spellings below occur in it,
  // and a string rule has to decide whether a trailing hyphen is a real one —
  // rejoin and you reject a quote that spells the pair as two words, do not and
  // you reject one that spells it hyphenated. Nothing in the extraction says
  // which it was. Tokens do not have to decide.
  const extraction = indexText(
    ['Forestry, mining and energy are three-', 'quarters of it, and one-', 'third of the total.'].join(
      '\n',
    ),
  );

  it.each([
    ['a hyphenated word the author wrote hyphenated', 'three-quarters of it', true],
    ['a two-word phrase the extractor hyphenated at the wrap', 'one third of the total', true],
    ['the same phrase written with the hyphen', 'one-third of the total', true],
    ['a passage that is simply not there', 'four fifths of the total', false],
    ['words of the source in an order it does not use', 'quarters three of it', false],
  ])('%s', (_label, quote, expected) => {
    expect(containsRun(extraction, quote)).toBe(expected);
  });
});

describe('a live check binds to the chapters it claims to have checked (ADR-0016)', () => {
  const registers = [...manifests.entries()];

  it('read the registers it judges', () => {
    expect(registers.length, 'no content/sources/*.json parsed').toBeGreaterThan(0);
  });

  it.each(registers.map(([id, manifest]) => [id, manifest] as const))(
    '%s',
    (id, manifest) => {
      const titles = (manifest.chapters ?? []).flatMap((entry) => {
        const title = str(entry.title);
        return title === null ? [] : [title];
      });
      const faults = (manifest.liveChecks ?? []).flatMap((check, index) =>
        (check.pages ?? []).flatMap((page) => {
          const chapter = str(page.chapter);
          return chapter !== null && !titles.includes(chapter)
            ? [
                `liveChecks[${String(index)}] checked "${chapter}", which is not a chapter of ` +
                  `${id}. A live check has to join to the same chapter vocabulary a question's ` +
                  `source.chapter uses, or it records a finding about a region nothing can cite. ` +
                  `Chapters: ${titles.join(' | ')}`,
              ]
            : [];
        }),
      );
      expect(faults, faults.join('\n')).toEqual([]);
    },
  );

  it('declares bannedFromAnswers on every flag it says the source will not correct', () => {
    // The schema enforces this per file; this is the corpus-wide restatement, and
    // it is what fails if a register is ever validated by something looser.
    const faults = registers.flatMap(([id, manifest]) =>
      (manifest.knownStaleness ?? [])
        .filter(
          (flag) =>
            str(flag.upstream) === 'does-not-revise' &&
            (flag.bannedFromAnswers ?? []).length === 0,
        )
        .map(
          (flag) =>
            `${id}: the flag "${str(flag.topic) ?? '?'}" says the source will never correct it and ` +
              `names no banned terms. That switches the periodic re-check off and puts nothing in ` +
              `its place, which is worse than the busywork it replaces (ADR-0016).`,
        ),
    );
    expect(faults, faults.join('\n')).toEqual([]);
  });
});

describe('a question cites a cached source that exists, and says so (ADR-0003)', () => {
  describe('the predicate rejects each fault', () => {
    // A manifest shaped like content/sources/discover-canada.json, including its
    // real staleness flag on the chapter that carries the Oath.
    const fixture = new Map<string, SourceManifest>([
      [
        'discover-canada',
        {
          id: 'discover-canada',
          sha256: 'a'.repeat(64),
          extractedText: 'discover-canada.txt',
          extractedTextSha256: 'b'.repeat(64),
          pages: 129,
          chapters: [
            { title: 'Rights and Responsibilities of Citizenship', page: 11, endPage: 15 },
            { title: 'Canadian Symbols', page: 50, endPage: 60 },
          ],
          knownStaleness: [
            {
              topic: 'Oath of Citizenship',
              affects: ['Rights and Responsibilities of Citizenship'],
              grain: 'chapter',
            },
            {
              topic: 'The monarch',
              affects: ['Canadian Symbols'],
              grain: 'pages',
              pages: [57],
            },
          ],
        },
      ],
    ]);
    const good = {
      id: 'q1',
      source: {
        sourceId: 'discover-canada',
        chapter: 'Canadian Symbols',
        page: 52,
        sourceHash: 'b'.repeat(64),
        volatile: false,
      },
    };

    it('accepts a question that cites a real chapter at the current hash', () => {
      expect(citationFaults(good, 'fixture', fixture)).toEqual([]);
    });

    it('rejects a sourceId no manifest declares', () => {
      expect(
        citationFaults({ ...good, source: { ...good.source, sourceId: 'nope' } }, 'f', fixture),
      ).toHaveLength(1);
    });

    it('rejects a chapter the source does not have', () => {
      expect(
        citationFaults({ ...good, source: { ...good.source, chapter: 'Sport' } }, 'f', fixture),
      ).toHaveLength(1);
    });

    it('rejects a hash that no longer matches the source', () => {
      expect(
        citationFaults(
          { ...good, source: { ...good.source, sourceHash: 'c'.repeat(64) } },
          'f',
          fixture,
        ),
      ).toHaveLength(1);
    });

    it('rejects a non-volatile question drawn from a known-stale chapter', () => {
      const onTheOath = {
        ...good,
        source: {
          ...good.source,
          chapter: 'Rights and Responsibilities of Citizenship',
          page: 12,
          volatile: false,
        },
      };
      expect(citationFaults(onTheOath, 'f', fixture)).toHaveLength(1);
      expect(
        citationFaults({ ...onTheOath, source: { ...onTheOath.source, volatile: true } }, 'f', fixture),
      ).toEqual([]);
    });

    // The regression this grain work exists for. A page-grain flag on p. 57 must
    // catch the question on p. 57 and leave the one on p. 52 alone; chapter grain
    // caught both, which is how 57 of 57 authored questions became volatile and
    // the flag stopped carrying information.
    it('applies a page-grain flag to the flagged page only', () => {
      const onThePage = { ...good, source: { ...good.source, page: 57, volatile: false } };
      expect(citationFaults(onThePage, 'f', fixture)).toHaveLength(1);
      expect(citationFaults(onThePage, 'f', fixture)[0]).toContain('pages 57');
    });

    it('leaves a question elsewhere in the same chapter alone', () => {
      expect(citationFaults(good, 'f', fixture)).toEqual([]);
    });

    it('does not treat over-marking as a fault', () => {
      expect(
        citationFaults({ ...good, source: { ...good.source, volatile: true } }, 'f', fixture),
      ).toEqual([]);
    });

    it('rejects a page outside the chapter it claims', () => {
      const wrongPage = { ...good, source: { ...good.source, page: 12 } };
      const faults = citationFaults(wrongPage, 'f', fixture);
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain('runs 50-60');
    });

    it('rejects a missing page on a paginated source', () => {
      const { page: _page, ...withoutPage } = good.source;
      const faults = citationFaults({ ...good, source: withoutPage }, 'f', fixture);
      expect(faults.some((fault) => fault.includes('source.page is missing'))).toBe(true);
    });

    it('still applies a page-grain flag when the question has no page', () => {
      // Cannot be ruled out, so it is not ruled out. The missing page is its own
      // fault; silently dropping the flag would be the unsafe direction.
      const { page: _page, ...withoutPage } = good.source;
      const faults = citationFaults(
        { ...good, source: { ...withoutPage, chapter: 'Canadian Symbols' } },
        'f',
        fixture,
      );
      expect(faults.some((fault) => fault.includes('known-stale'))).toBe(true);
    });

    it('prefers the extracted-text hash, because that is what was read', () => {
      const noExtraction = new Map<string, SourceManifest>([
        ['plain', { id: 'plain', sha256: 'd'.repeat(64), chapters: [{ title: 'Only' }] }],
      ]);
      const q = {
        source: {
          sourceId: 'plain',
          chapter: 'Only',
          sourceHash: 'd'.repeat(64),
          volatile: false,
        },
      };
      expect(citationFaults(q, 'f', noExtraction)).toEqual([]);
    });
  });

  it('reads every collection of claims, and none of them is empty', () => {
    // ADR-0024, and the reason this file's scope is now a shape rather than a
    // directory. The check below walks whatever it finds; if `content/quests/`
    // were renamed, moved, or emptied of `factClaim` blocks, every assertion
    // here would still pass over the two collections left — which is exactly how
    // 60 player-facing claims went unchecked for a slice while the suite was
    // green. So the collections that carry claims are named, and a named one
    // that yields nothing fails.
    const perCollection = new Map<string, number>();
    for (const claim of FACTUAL) {
      perCollection.set(claim.collection, (perCollection.get(claim.collection) ?? 0) + 1);
    }
    const found = [...perCollection.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `content/${name}/ ${String(count)}`)
      .join(', ');
    const empty = CLAIM_COLLECTIONS.filter((name) => (perCollection.get(name) ?? 0) === 0);
    expect(
      empty,
      `${empty.map((name) => `content/${name}/`).join(', ')} yielded no factual claim. Found: ${found}`,
    ).toEqual([]);
  });

  it("holds every author's quote to being a real passage of the cached source", () => {
    // The one check here that reads the source text rather than the manifest,
    // and the one that catches a *fabricated* citation before any verifier runs:
    // `source.quote` must appear verbatim in the extraction the hash covers.
    //
    // The extraction is git-ignored — Discover Canada is Crown copyright and the
    // manifest says `committed: false` — so this cannot run in CI, and a check
    // that silently no-ops where it matters is a check that measures nothing.
    // The absence is therefore asserted rather than assumed: if the file is not
    // there, the manifest must *say* it is not committed. An undeclared absence
    // still fails, and the substring itself is re-checked by `verify-content`
    // (task 1.17), which re-fetches.
    const failures: string[] = [];
    const extractions = new Map<string, string>();
    let checked = 0;

    for (const [id, manifest] of manifests) {
      const name = str(manifest.extractedText);
      if (name === null) continue;
      const path = `${SOURCES_DIR}/${name}`;
      if (existsSync(path)) {
        extractions.set(id, readFileSync(path, 'utf8'));
      } else if (manifest.committed !== false) {
        failures.push(
          `content/sources/${name} is missing and ${id} does not declare "committed": false. ` +
            `Either commit the extraction or say in the manifest that it is not committed — an ` +
            `undeclared absence turns this check off without anyone deciding to.`,
        );
      }
    }

    /*
     * CONTIGUITY IS NOW ONE IMPLEMENTATION, imported from
     * scripts/lib/claims.mjs, and this comment is what it replaced.
     *
     * This file used to carry a `flat()` that rejoined words the extraction
     * broke at a real hyphen and then compared strings: `pdftotext -layout`
     * wraps "three-quarters" as "three-\nquarters", so collapsing whitespace
     * alone left "three- quarters" and a correctly cited quote read as
     * fabricated. Two economy questions were red on exactly that while
     * `verify-content` reported all 404 quotes contiguous — two implementations
     * of one rule disagreeing about what "contiguous" means, reconciled by hand.
     *
     * A reconciliation held in place by care has a date on it, and this one's
     * came due: the extraction wraps "one third" as "one-\nthird", where the
     * rejoining rule produces "one-third" and calls a correct quote fabricated,
     * and the tokenising rule does not. The token rule survived — it is also the
     * one that caught both genuinely fabricated citations this project has
     * shipped — and both gates now import it rather than agreeing to have it.
     */
    const indexed = new Map([...extractions].map(([id, text]) => [id, indexText(text)] as const));

    for (const claim of FACTUAL) {
      const quote = str(claim.source?.quote);
      const sourceId = str(claim.source?.sourceId);
      if (quote === null || sourceId === null) continue;
      const extraction = indexed.get(sourceId);
      if (extraction === undefined) continue;
      checked += 1;
      if (!containsRun(extraction, quote)) {
        failures.push(
          `${claim.at}: source.quote is not a passage of ${sourceId}. It must be ` +
            `copied exactly from the extraction the recorded hash covers, whitespace aside. A quote ` +
            `that is not in the source is a citation of something nobody can check.`,
        );
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
    // ADR-0024, restated for the check that matters most here: with every
    // extraction git-ignored this loop can legally compare nothing, and an empty
    // loop passes. The count says which of the two happened.
    expect(
      checked > 0 || extractions.size === 0,
      'every extraction was present and yet no quote was compared against one',
    ).toBe(true);
  });

  it('holds for every authored claim, wherever a player reads it', () => {
    // Derived, not listed, and no longer derived from one directory. A landmark
    // blurb citing a page outside its chapter's range is the same defect as a
    // question doing it — one wrong `endPage` in the register once put 13 of 14
    // economy page numbers outside their chapter — and until this walked
    // `content/` nothing would have said so.
    const failures = FACTUAL.flatMap((claim) => claimFaults(claim, manifests));
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
