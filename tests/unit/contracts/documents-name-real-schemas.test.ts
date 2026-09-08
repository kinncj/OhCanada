/**
 * A Markdown file that names a `content/schemas/*.schema.json` names one that
 * exists.
 *
 * ADR-0007 makes the schemas the authority on the shape of authored content, so
 * a document that cites one is citing a contract. `SECURITY.md` is the case that
 * prompted this: it tells a reader that an imported save is "validated against
 * `content/schemas/save.schema.json` with `additionalProperties: false`". The
 * file is `progress.schema.json`. The claim is *true* — the validation happens,
 * `additionalProperties: false` holds, and `tests/unit/contracts/
 * save-codec-matches-progress-schema.test.ts` pins it against real ajv — but the
 * document points a reader at nothing, in the one place a security researcher
 * would go to check the assertion before deciding whether to report a finding.
 *
 * That is this project's standing failure mode (ADR-0009): a written claim that
 * stops being true, or was never quite true, and nothing noticing. Schema
 * filenames are the sub-case where noticing is a `readFileSync` away, so it is
 * checked rather than reviewed.
 *
 * Scope is every `*.md` in the repository, not only `docs/`. The obligation gate
 * is `docs/`-only because an obligation is only allowed to live there; a *claim
 * about a schema* can be made anywhere, and the two documents that matter most
 * here — `SECURITY.md` and `CLAUDE.md` — are both outside `docs/`.
 *
 * What this does NOT check: whether the surrounding sentence about the schema is
 * true. Only that the path resolves. A gate that reads documents cannot verify
 * what they assert; it can verify that what they point at is there.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Directories with no authored Markdown of ours, or too much of somebody else's. */
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report']);

const markdownFilesIn = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return markdownFilesIn(path);
    return entry.isFile() && path.endsWith('.md') ? [path] : [];
  });

/**
 * Every `content/schemas/<name>.schema.json` a document mentions, wherever it
 * appears — prose, a table cell, a code span or a fenced block. Unlike the
 * obligation gate, code is *not* excluded: a schema path written inside backticks
 * is the normal way to cite one, and it is the form `SECURITY.md` uses.
 */
const SCHEMA_REFERENCE = /content\/schemas\/([A-Za-z0-9._-]+\.schema\.json)/gu;

interface Reference {
  readonly file: string;
  readonly line: number;
  readonly schema: string;
}

const referencesIn = (path: string): readonly Reference[] => {
  const label = path.slice(REPO_ROOT.length);
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, index) =>
      [...text.matchAll(SCHEMA_REFERENCE)].map((match) => ({
        file: label,
        line: index + 1,
        schema: match[1] ?? '',
      })),
    );
};

const markdownFiles = markdownFilesIn(REPO_ROOT.replace(/\/$/u, ''));
const references = markdownFiles.flatMap(referencesIn);
const schemasOnDisk = new Set(readdirSync(`${REPO_ROOT}content/schemas`));

describe('a document that names a content schema names one that exists (ADR-0007)', () => {
  it('found Markdown to read and schemas to check against', () => {
    // Anti-vacuum. A walk that stops matching passes silently otherwise, and a
    // gate whose silence means "found nothing" is indistinguishable from one
    // whose silence means "found no defects".
    expect(markdownFiles.length, 'no Markdown files were found to scan').toBeGreaterThan(20);
    expect(
      references.length,
      'no document in the repository cites a content/schemas/*.schema.json path, so ' +
        'this gate is comparing an empty set against an empty set',
    ).toBeGreaterThan(5);
    expect(schemasOnDisk.size, 'content/schemas is empty').toBeGreaterThan(0);
  });

  it('resolves every cited schema path to a file on disk', () => {
    const dangling = references
      .filter(({ schema }) => !schemasOnDisk.has(schema))
      .map(
        ({ file, line, schema }) =>
          `${file}:${line} names content/schemas/${schema}, which does not exist. ` +
          `content/schemas holds: ${[...schemasOnDisk].sort().join(', ')}.`,
      );

    expect(
      dangling,
      `A document points a reader at a schema that is not there:\n  ${dangling.join('\n  ')}\n` +
        'Fix the document, or add the schema. Deleting the sentence is also an answer, ' +
        'but only if the claim it made was not worth making.',
    ).toEqual([]);
  });

  it('does not confirm that any sentence around a schema path is true', () => {
    // Stated as a test so the limitation is read, not buried in the header. This
    // gate resolves paths; it cannot tell whether "validated against X with
    // additionalProperties: false" is a fact. That is what the contract tests
    // beside this file are for.
    expect(existsSync(`${REPO_ROOT}tests/unit/contracts/save-codec-matches-progress-schema.test.ts`)).toBe(
      true,
    );
    expect(existsSync(`${REPO_ROOT}tests/unit/contracts/ports-match-schemas.test.ts`)).toBe(true);
  });
});
