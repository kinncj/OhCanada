/**
 * A document that names a `content/schemas/*.schema.json`, or an `ADR-NNNN`,
 * names one that exists.
 *
 * ADR-0007 makes the schemas the authority on the shape of authored content, and
 * `docs/adr/` is where every decision with alternatives lives, so a document
 * citing either is citing a contract. This gate resolves the pointer. It cannot
 * tell whether the sentence around it is true — see the last case in this file,
 * which states that limitation as a test so it is read rather than buried.
 *
 * ## Why it exists
 *
 * `SECURITY.md` told a reader that an imported save is "validated against
 * `content/schemas/save.schema.json` with `additionalProperties: false`". The file
 * is `progress.schema.json`. The claim was *true* — the validation happens, the
 * flag holds, and `save-codec-matches-progress-schema.test.ts` pins it against
 * real ajv — but the document pointed a reader at nothing, in the one place a
 * security researcher would go to check the assertion before deciding whether to
 * report a finding.
 *
 * That is this project's standing failure mode (ADR-0009): a written claim that
 * stops being true, or was never quite true, and nothing noticing. A filename is
 * the sub-case where noticing is a `readFileSync` away.
 *
 * ## Why it reads `.json` as well as `.md` (ADR-0018)
 *
 * The first version scanned Markdown only, and the blind spot was found the way
 * these things are: it caught `assets/style/rig-contract.md` naming a schema that
 * did not exist, and missed **the same dead path** in
 * `assets/style/rig-contract.json`'s `$comment` block and in
 * `assets/credits.json`'s `modifications` field. Same defect, one file type over.
 *
 * The lesson is not "add `.json`". It is that the gate was scoped by *file
 * extension* when the thing it guards is *a claim*, and a claim does not care what
 * it is written in. `$comment`, `note`, `description` and `modifications` are
 * prose fields this project uses heavily and deliberately — several schemas
 * require them — so a JSON file here carries as much documentation as a Markdown
 * one. The scope is now "every string a human wrote", which is `.md` bodies and
 * `.json` string values.
 *
 * `.ts` is **not** scanned, and that is a decision rather than an omission: a
 * schema path in TypeScript is almost always a real `readFileSync` argument, so a
 * dead one fails a test that actually runs, loudly and with a stack trace. This
 * gate is for paths that nothing executes. Adding `.ts` would mostly re-report
 * what the suite already proves, and a gate that duplicates another gate is one
 * more thing to keep in step.
 *
 * ## Why ADR ids
 *
 * ADR-0017 was referenced by `content/schemas/rig.schema.json` and by
 * `tests/unit/contracts/rig-is-coherent.test.ts` before the ADR was written — the
 * session that wrote them was cut off before the record. Identical class of
 * defect: a document pointing at a decision that is not there. The check is one
 * `readdirSync` and it closes it.
 *
 * ADR references are matched in `.md` and `.json` for the same reason as schema
 * paths, with one deliberate addition: **`.ts` under `tests/` and `app/` IS
 * scanned for ADR ids**, because unlike a schema path an `ADR-NNNN` in a comment
 * is never executed — nothing resolves it, so nothing can fail on it. That
 * asymmetry is the point: scan the places where being wrong is silent.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Directories holding nothing we authored, or too much of somebody else's. */
const SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  '.pwprobe',
]);

const filesIn = (dir: string, matches: (path: string) => boolean): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return filesIn(path, matches);
    return entry.isFile() && matches(path) ? [path] : [];
  });

const ROOT = REPO_ROOT.replace(/\/$/u, '');

/* -------------------------------------------------------------------------- */
/* what a human wrote                                                         */
/* -------------------------------------------------------------------------- */

interface Line {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

const markdownLines = (path: string): readonly Line[] => {
  const label = path.slice(REPO_ROOT.length);
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((text, index) => ({ file: label, line: index + 1, text }));
};

/**
 * Every string VALUE in a JSON document, with the line it sits on.
 *
 * Values only, never keys: a key is structure and is already constrained by a
 * schema, whereas a value is where a person writes prose. Finding the line
 * cheaply matters more than finding it perfectly here — the file and the text are
 * what a reader needs, and the line is a convenience — so the raw text is scanned
 * rather than the parsed tree re-located.
 *
 * **A file that does not parse is scanned as text instead**, and that is not a
 * grudging fallback. `tsconfig.json` is JSONC: it carries a long block comment
 * about `baseUrl` that is exactly the kind of prose this gate is for, and a first
 * draft of this file threw on it under the belief that unparseable JSON is a
 * defect. It is not — JSON-with-comments is a real format that real tools define.
 *
 * Stripping comments to parse it was the other option and is worse: `//` appears
 * inside every `https://truenorth.app/schemas/...` string in this repository, so a
 * naive stripper would corrupt precisely the values being searched for. Scanning
 * as text is *safe in the direction that matters* — it can only find MORE
 * references, never fewer, and the whole point of ADR-0018 is that a missed
 * reference is the expensive one.
 */
const jsonStringLines = (path: string): readonly Line[] => {
  const label = path.slice(REPO_ROOT.length);
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return markdownLines(path);
  }

  const values: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') values.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (typeof node === 'object' && node !== null) Object.values(node).forEach(walk);
  };
  walk(parsed);

  const rawLines = raw.split('\n');
  return values.map((text) => {
    const at = rawLines.findIndex((line) => line.includes(text.slice(0, 60)));
    return { file: label, line: at === -1 ? 0 : at + 1, text };
  });
};

const markdownFiles = filesIn(ROOT, (path) => path.endsWith('.md'));
const jsonFiles = filesIn(ROOT, (path) => path.endsWith('.json'));
const sourceFiles = [
  ...filesIn(`${ROOT}/app`, (path) => path.endsWith('.ts')),
  ...filesIn(`${ROOT}/tests`, (path) => path.endsWith('.ts')),
  ...filesIn(`${ROOT}/common`, (path) => path.endsWith('.ts')),
];

const proseLines = [
  ...markdownFiles.flatMap(markdownLines),
  ...jsonFiles.flatMap(jsonStringLines),
];
const adrScanLines = [...proseLines, ...sourceFiles.flatMap(markdownLines)];

/* -------------------------------------------------------------------------- */
/* what is on disk                                                            */
/* -------------------------------------------------------------------------- */

const schemasOnDisk = new Set(readdirSync(`${REPO_ROOT}content/schemas`));
const adrsOnDisk = new Set(
  readdirSync(`${REPO_ROOT}docs/adr`)
    .map((name) => /^(ADR-\d{4})-/u.exec(name)?.[1])
    .filter((id): id is string => id !== undefined),
);

const SCHEMA_REFERENCE = /content\/schemas\/([A-Za-z0-9._-]+\.schema\.json)/gu;
const ADR_REFERENCE = /\bADR-(\d{4})\b/gu;

const findAll = (lines: readonly Line[], pattern: RegExp): readonly (Line & { readonly hit: string })[] =>
  lines.flatMap((line) =>
    [...line.text.matchAll(pattern)].map((match) => ({ ...line, hit: match[1] ?? '' })),
  );

const schemaReferences = findAll(proseLines, SCHEMA_REFERENCE);
const adrReferences = findAll(adrScanLines, ADR_REFERENCE);

/* -------------------------------------------------------------------------- */

describe('a document names a schema and a decision that exist (ADR-0007, ADR-0018)', () => {
  it('found documents to read and things to check against', () => {
    // Anti-vacuum. A walk that stops matching passes silently otherwise, and a
    // gate whose silence means "found nothing" is indistinguishable from one
    // whose silence means "found no defects".
    expect(markdownFiles.length, 'no Markdown files found').toBeGreaterThan(20);
    expect(jsonFiles.length, 'no JSON files found').toBeGreaterThan(10);
    expect(sourceFiles.length, 'no TypeScript files found').toBeGreaterThan(20);
    expect(
      schemaReferences.length,
      'nothing cites a content/schemas/*.schema.json path, so this gate compares an ' +
        'empty set against an empty set',
    ).toBeGreaterThan(5);
    expect(
      adrReferences.length,
      'nothing cites an ADR, which cannot be true in this repository',
    ).toBeGreaterThan(20);
    expect(schemasOnDisk.size, 'content/schemas is empty').toBeGreaterThan(0);
    expect(adrsOnDisk.size, 'docs/adr is empty').toBeGreaterThan(0);
  });

  it('reads JSON string values, not only Markdown', () => {
    // The blind spot ADR-0018 records, asserted directly: the widening is only
    // real if a `$comment` in a `.json` file is actually in scope. Pinned to a
    // file that exists and to the shape of the thing that was missed, rather than
    // trusting the walk above to have reached it.
    const fromJson = proseLines.filter((line) => line.file.endsWith('.json'));
    expect(fromJson.length, 'no JSON string values were collected at all').toBeGreaterThan(50);
    expect(
      new Set(fromJson.map((line) => line.file)).size,
      'JSON string values came from fewer than two files, so the walk is not reaching the tree',
    ).toBeGreaterThan(1);
  });

  it('resolves every cited schema path to a file on disk', () => {
    const dangling = schemaReferences
      .filter(({ hit }) => !schemasOnDisk.has(hit))
      .map(
        ({ file, line, hit }) =>
          `${file}:${String(line)} names content/schemas/${hit}, which does not exist. ` +
          `content/schemas holds: ${[...schemasOnDisk].sort().join(', ')}.`,
      );

    expect(
      dangling,
      `A document points a reader at a schema that is not there:\n  ${dangling.join('\n  ')}\n` +
        'Fix the document, or add the schema. Deleting the sentence is also an answer, ' +
        'but only if the claim it made was not worth making.',
    ).toEqual([]);
  });

  it('resolves every cited ADR to a file in docs/adr', () => {
    const dangling = [
      ...new Set(
        adrReferences
          .filter(({ hit }) => !adrsOnDisk.has(`ADR-${hit}`))
          .map(({ file, line, hit }) => `${file}:${String(line)} cites ADR-${hit}`),
      ),
    ];

    expect(
      dangling,
      `A document or a source comment cites a decision record that does not exist:\n  ` +
        `${dangling.join('\n  ')}\n` +
        `docs/adr holds ${[...adrsOnDisk].sort().join(', ')}. Either the ADR was never written — ` +
        `write it, because code citing a decision nobody recorded is the decision being made in a ` +
        `comment — or the number is wrong.`,
    ).toEqual([]);
  });

  it('does not confirm that any sentence around a reference is true', () => {
    // Stated as a test so the limitation is read, not buried in the header. This
    // gate resolves pointers; it cannot tell whether "validated against X with
    // additionalProperties: false" is a fact. That is what the contract tests
    // beside this file are for.
    expect(existsSync(`${REPO_ROOT}tests/unit/contracts/save-codec-matches-progress-schema.test.ts`)).toBe(
      true,
    );
    expect(existsSync(`${REPO_ROOT}tests/unit/contracts/ports-match-schemas.test.ts`)).toBe(true);
  });
});
