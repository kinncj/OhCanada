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
 *   4. **A question drawn from a chapter the manifest already flags as stale is
 *      marked `volatile`.**
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
 * block an author is trusted to read is prose; this makes it a gate. `volatile`
 * is not a decoration — CLAUDE.md re-verifies volatile items every run and
 * quarantines them when the source changes or `asOf` exceeds 180 days — so
 * forcing it on questions from a flagged chapter routes them to the live page
 * automatically, which is exactly what each flag's `action` asks for in words.
 *
 * **What this cannot do, stated so its silence is not read as coverage:** it
 * cannot tell whether a `knownStaleness` entry should exist. The gate enforces
 * the link between a flag and the questions under it; noticing that a source has
 * gone stale in a region nobody flagged is the verifier's judgement against the
 * live page, and no check here substitutes for it.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCES_DIR = `${REPO_ROOT}content/sources`;
const QUESTIONS_DIR = `${REPO_ROOT}content/questions`;

interface SourceChapter {
  readonly title?: unknown;
  readonly page?: unknown;
  readonly endPage?: unknown;
}
interface KnownStaleness {
  readonly topic?: unknown;
  readonly affects?: readonly unknown[];
  readonly grain?: unknown;
  readonly pages?: readonly unknown[];
  readonly upstream?: unknown;
  readonly bannedFromAnswers?: readonly unknown[];
}
interface LiveCheckPage {
  readonly url?: unknown;
  readonly chapter?: unknown;
  readonly sourceDateModified?: unknown;
  readonly agreesWithCache?: unknown;
  readonly claimsCompared?: readonly unknown[];
}
interface LiveCheck {
  readonly checkedAt?: unknown;
  readonly checkedBy?: unknown;
  readonly finding?: unknown;
  readonly consequence?: unknown;
  readonly pages?: readonly LiveCheckPage[];
}
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

/**
 * A banned term appears in text when it appears as a WHOLE word, case-insensitively.
 *
 * Whole-word rather than substring, because the terms are ordinary English and
 * French words: a substring match on "53" hits "1953" and "253", and one on
 * "Elizabeth" is fine but one on "Queen" would hit "Queensland". The register
 * chooses the terms and a term that still over-fires is refined there, which is
 * the safe direction - a build failure and one edit, against shipping a wrong
 * fact to somebody studying for a citizenship test.
 *
 * "Whole word" is bounded by anything that is not a letter or a digit. The
 * apostrophe is deliberately a BOUNDARY and not word-like, which the fixtures
 * below caught: treating it as word-like made French elision ("l'Elizabeth")
 * miss, and - far worse - made the English possessive ("Elizabeth's reign") miss
 * too. Both failures are in the dangerous direction, letting a banned term ship
 * by being adjacent to punctuation. Letters are matched by Unicode property, so
 * accented French is a word and "Elisabeth" is one word, not two.
 *
 * The term itself may contain spaces ("Her Majesty", "53 other nations"), which
 * is why this is a boundary check around a literal rather than a token set.
 */
const WORDLIKE = /[\p{L}\p{N}]/u;

export const mentionsTerm = (text: string, term: string): boolean => {
  const haystack = text.toLocaleLowerCase();
  const needle = term.trim().toLocaleLowerCase();
  if (needle === '') return false;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? '' : haystack.charAt(at - 1);
    const after = haystack.charAt(at + needle.length);
    if (!WORDLIKE.test(before) && !WORDLIKE.test(after)) return true;
    from = at + 1;
  }
};

/** Every player-readable string of a question that an answer could hide a stale fact in. */
const answerText = (question: QuestionLike): readonly string[] => {
  const from = (value: LocalizedTextLike | undefined): readonly string[] =>
    value === undefined
      ? []
      : [str(value.en), str(value.fr)].flatMap((text) => (text === null ? [] : [text]));
  // The PROMPT is deliberately not included. A question may legitimately ask
  // about a stale topic - the wrongness is in asserting a stale value as an
  // answer, not in naming the subject. Options and explanation are what a player
  // is told is TRUE.
  return [...(question.options ?? []).flatMap(from), ...from(question.explanation)];
};

/**
 * The whole check as one pure function over already-parsed documents, so the
 * fixtures below exercise the same code the corpus does. A predicate proved on
 * fixtures and a predicate run over content must not be two predicates.
 */
export const citationFaults = (
  question: QuestionLike,
  where: string,
  manifests: ReadonlyMap<string, SourceManifest>,
): readonly string[] => {
  const source = question.source;
  if (source === undefined) return [];
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
  const flags = (manifest.knownStaleness ?? []).filter((entry) => {
    if (!(entry.affects ?? []).some((affected) => str(affected) === chapter)) return false;
    const flagPages = (entry.pages ?? []).flatMap((value) => {
      const parsed = int(value);
      return parsed === null ? [] : [parsed];
    });
    // `grain: "pages"` narrows to the listed pages; anything else is the whole
    // chapter. A page-grain flag on a question with no page cannot be ruled out,
    // so it still applies - the missing page is reported separately above.
    if (str(entry.grain) !== 'pages' || flagPages.length === 0) return true;
    return page === null || flagPages.includes(page);
  });

  if (flags.length > 0 && source.volatile !== true) {
    const grains = flags
      .map((entry) => {
        const topic = str(entry.topic) ?? '?';
        return str(entry.grain) === 'pages'
          ? `${topic} (pages ${(entry.pages ?? []).join(', ')})`
          : `${topic} (whole chapter)`;
      })
      .join('; ');
    found.push(
      `${where}: ${sourceId} flags this claim as known-stale - ${grains} - and the question is not ` +
        `marked volatile. A volatile question is re-verified every run against the live page and ` +
        `quarantined when the source moves or asOf passes 180 days, which is what each flag asks ` +
        `for in words. Set source.volatile to true, or move the claim off the flagged page.`,
    );
  }
  if (flags.length === 0 && source.volatile === true) {
    // Not a failure. Over-marking is safe and sometimes right: a fact can be
    // volatile for a reason the register has not noticed, which is exactly the
    // judgement the staleness gate says it cannot make.
  }

  // --- answers may not depend on a fact the source will never correct --------
  //
  // ADR-0016. When a flag declares `upstream: "does-not-revise"`, marking the
  // question volatile buys nothing: the live page states the same wrong thing,
  // so the re-verification it routes to can only ever return "unchanged". The
  // mitigation that works is the one the author used unprompted - write the
  // answers so that none of them depends on the stale fact - and this is what
  // makes that a checked property instead of an unrecorded judgement.
  //
  // The check is deliberately on the ANSWERS, not the question. A prompt may name
  // a stale topic; what may not happen is a player being told a stale value is
  // true.
  const texts = answerText(question);
  for (const flag of flags) {
    const banned = (flag.bannedFromAnswers ?? []).flatMap((value) => {
      const term = str(value);
      return term === null ? [] : [term];
    });
    if (banned.length === 0) continue;
    const hits = banned.filter((term) => texts.some((text) => mentionsTerm(text, term)));
    if (hits.length === 0) continue;
    found.push(
      `${where}: an option or explanation contains ${hits.map((term) => `"${term}"`).join(', ')}, ` +
        `which ${sourceId} bans from answers under the staleness flag "${str(flag.topic) ?? '?'}". ` +
        `That flag declares upstream: "does-not-revise" - the official source states the same ` +
        `out-of-date thing the cache does, so re-verifying can never correct this and marking the ` +
        `question volatile buys nothing. Route the answer around the stale fact: change the option ` +
        `or the explanation so it does not depend on it. If the term is over-broad, refine the ` +
        `entry in the register rather than removing it.`,
    );
  }

  return found;
};

const jsonFilesUnder = (dir: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return jsonFilesUnder(path);
        return entry.isFile() && path.endsWith('.json') ? [path] : [];
      })
    : [];

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

    // Whitespace is normalised on both sides: a PDF extraction wraps lines
    // wherever the page did, and a quote copied out of it is one paragraph.
    const flat = (text: string): string => text.replace(/\s+/gu, ' ').trim();

    for (const path of jsonFilesUnder(QUESTIONS_DIR)) {
      const question = JSON.parse(readFileSync(path, 'utf8')) as QuestionLike;
      const quote = str(question.source?.quote);
      const sourceId = str(question.source?.sourceId);
      if (quote === null || sourceId === null) continue;
      const extraction = extractions.get(sourceId);
      if (extraction === undefined) continue;
      if (!flat(extraction).includes(flat(quote))) {
        failures.push(
          `${path.slice(REPO_ROOT.length)}: source.quote is not a passage of ${sourceId}. It must be ` +
            `copied exactly from the extraction the recorded hash covers, whitespace aside. A quote ` +
            `that is not in the source is a citation of something nobody can check.`,
        );
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('holds for every authored question', () => {
    // Derived, not listed. `content/questions/` is empty until task 1.7; the
    // suite above is what carries the check until there is a corpus.
    const failures = jsonFilesUnder(QUESTIONS_DIR).flatMap((path) => {
      const question = JSON.parse(readFileSync(path, 'utf8')) as QuestionLike;
      return citationFaults(question, path.slice(REPO_ROOT.length), manifests);
    });
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
