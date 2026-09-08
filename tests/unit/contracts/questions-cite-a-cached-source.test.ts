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
 * large-print edition, and parts of it are false today: the Oath of Citizenship
 * still names Her Majesty Queen Elizabeth II, when the monarch is King Charles III
 * and the Oath was amended in June 2021 to recognise the Aboriginal and treaty
 * rights of First Nations, Inuit and Métis peoples. Worse, the document is
 * *inconsistently* updated — six references to Elizabeth II against one to His
 * Majesty — so it reads as current in places. A question authored straight off
 * that page would be confidently, officially wrong about the Oath, in a game
 * teaching people to take it.
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
}
interface KnownStaleness {
  readonly topic?: unknown;
  readonly affects?: readonly unknown[];
}
interface SourceManifest {
  readonly id?: unknown;
  readonly sha256?: unknown;
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
    readonly sourceHash?: unknown;
    readonly volatile?: unknown;
  };
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

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

  const flags = (manifest.knownStaleness ?? []).filter((entry) =>
    (entry.affects ?? []).some((affected) => str(affected) === chapter),
  );
  if (flags.length > 0 && source.volatile !== true) {
    found.push(
      `${where}: ${sourceId} flags "${chapter}" as known-stale ` +
        `(${flags.map((entry) => str(entry.topic) ?? '?').join('; ')}) and this question is not ` +
        `marked volatile. A volatile question is re-verified every run against the live page and ` +
        `quarantined when the source moves or asOf passes 180 days, which is what each flag asks ` +
        `for in words. Set source.volatile to true, or take the question off that chapter.`,
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
          chapters: [
            { title: 'Rights and Responsibilities of Citizenship' },
            { title: 'Canadian Symbols' },
          ],
          knownStaleness: [
            {
              topic: 'Oath of Citizenship',
              affects: ['Rights and Responsibilities of Citizenship'],
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
          volatile: false,
        },
      };
      expect(citationFaults(onTheOath, 'f', fixture)).toHaveLength(1);
      expect(
        citationFaults({ ...onTheOath, source: { ...onTheOath.source, volatile: true } }, 'f', fixture),
      ).toEqual([]);
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
