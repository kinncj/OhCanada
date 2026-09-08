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
}
interface QuestionLike {
  readonly id?: unknown;
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
