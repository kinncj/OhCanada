/**
 * ADR-0024's mechanical form, over `validate-content`'s own success line.
 *
 * > A gate that reports a count fails when the count is zero, unless zero is
 * > explicitly declared legal in that gate, with a reason.
 *
 * That line prints five numbers. Four are load-bearing evidence and one was a
 * vacuum, in the same sentence in the same tone: `content/locales/en` and
 * `content/locales/fr` are empty directories, and the gate printed
 * "0 locale bundle(s) in EN/FR parity" as a pass on every run since it was
 * written -- CLAUDE.md's "EN and FR from the first commit" reporting success
 * about nothing.
 *
 * Two of the five needed work and both are proved here:
 *
 *   - `localeBundlesChecked`: zero is now DECLARED legal, and the declaration is
 *     conditional on its own premise still holding. Both halves of that premise
 *     are cases below, because a declaration nobody can invalidate is a comment.
 *   - `contentDocuments`: had no floor at all. `every([])` is vacuously true and
 *     reads exactly like a clean bill, which ADR-0024 records as the sharpest
 *     instance of the class (`progress.schema.json` was briefly invalid for
 *     every document and `make validate-content` said OK, because no progress
 *     documents exist).
 *
 * The first draft of BOTH floors passed cases they should have failed, and both
 * defects were found by running them rather than by reading them:
 *
 *   - the content floor was written over `dataFiles.length`, which always
 *     carries `assets/credits.json` and `assets/style/palette.json` and so can
 *     never be zero. A floor that cannot fire is decoration (ADR-0014).
 *   - the copy.ts premise check matched a bare `keyof typeof EN`, which the
 *     file's own header COMMENT contains, so retyping `CopyRow` to `string`
 *     still passed. A gate that reads a comment as evidence of the code is the
 *     failure this whole file is about.
 *
 * Cases drive the real CLI over scratch trees built from the REAL `content/` and
 * `assets/` trees. That is deliberate and it is the second thing the first draft
 * got wrong: a hand-built minimal tree trips the credit gate's own floor, which
 * is another agent's rule correctly firing, and `validate-content` prints its
 * success line ONLY when nothing failed -- so over a minimal tree the counts
 * under test here are not observable at all. Cases assert the `locales:` and
 * `content:` failure lines, and the wording of the summary line, rather than the
 * exit code.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/validate-content.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const SCHEMAS = join(REPO, 'content', 'schemas');
const REAL_COPY = join(REPO, 'app', 'ui', 'copy.ts');
const WORK = mkdtempSync(join(tmpdir(), 'vacuum-floor-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Tree {
  /** Write a locale bundle. */
  readonly bundles?: Readonly<Record<string, readonly string[]>>;
  /** Replace `app/ui/copy.ts` with this text, or omit it entirely with `null`. */
  readonly copy?: string | null;
  /** Write a content document under content/levels, so the tree is not empty. */
  readonly documents?: boolean;
  /** Build a tree with no `app/ui/` at all, the shape every other fixture has. */
  readonly noUi?: boolean;
}

let caseId = 0;

const linesFor = (output: string, prefix: string): readonly string[] =>
  output.split('\n').filter((line) => line.trim().startsWith(`- ${prefix}:`));

function run(tree: Tree = {}): { readonly output: string; readonly root: string } {
  caseId += 1;
  const root = join(WORK, `case-${String(caseId)}`);
  mkdirSync(root, { recursive: true });

  // The real content/ and assets/ trees, so that every OTHER rule in this gate
  // is satisfied and the success line actually prints. A hand-built minimal
  // tree cannot do that: it trips the credit gate's own floor, and then the
  // only thing observable is a failure list.
  if (tree.documents === false) {
    mkdirSync(join(root, 'content'), { recursive: true });
    cpSync(SCHEMAS, join(root, 'content', 'schemas'), { recursive: true });
  } else {
    cpSync(join(REPO, 'content'), join(root, 'content'), { recursive: true });
  }
  cpSync(join(REPO, 'assets'), join(root, 'assets'), { recursive: true });
  mkdirSync(join(root, 'content', 'locales', 'en'), { recursive: true });
  mkdirSync(join(root, 'content', 'locales', 'fr'), { recursive: true });

  for (const [name, locales] of Object.entries(tree.bundles ?? {})) {
    for (const locale of locales) {
      writeFileSync(
        join(root, 'content', 'locales', locale, name),
        `${JSON.stringify(
          {
            $schema: '../../schemas/locale.schema.json',
            locale,
            strings: { 'settings.title': locale === 'en' ? 'Settings' : 'Parametres' },
          },
          null,
          2,
        )}\n`,
      );
    }
  }

  // `app/ui/` always exists, because the premise check is scoped to a tree that
  // HAS a UI: a --root with no UI has no player-facing strings for EN/FR parity
  // to be about, which is the shape every other gate's fixture has. So the
  // "copy.ts is gone" case must delete the file and leave the directory, which
  // is the state that actually matters.
  if (tree.noUi !== true) {
    mkdirSync(join(root, 'app', 'ui'), { recursive: true });
    writeFileSync(join(root, 'app', 'ui', 'hud.ts'), 'export const HUD = 1;\n');
    const copy = tree.copy === undefined ? readFileSync(REAL_COPY, 'utf8') : tree.copy;
    if (copy !== null) writeFileSync(join(root, 'app', 'ui', 'copy.ts'), copy);
  }

  const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { output: `${result.stdout}${result.stderr}`, root };
}

describe('the locale parity count no longer reports success about zero files', () => {
  it('declares zero legal while the migration has not started, and says why in the summary', () => {
    // The negative case, and it is the one that has to keep passing: failing
    // here would turn the build red over a guarantee that IS enforced, one
    // directory over, by app/ui/copy.ts's FR table and `make typecheck`.
    const { output } = run();
    expect(linesFor(output, 'locales')).toEqual([]);
    expect(output).toContain('NO locale bundles exist yet');
    expect(output).toContain('app/ui/copy.ts');
    // and it must not read like the four numbers beside it
    expect(output).not.toContain('0 locale bundle(s) in EN/FR parity');
  });

  it('fails when the directories are NOT empty and the count is still zero', () => {
    // Once a bundle exists, zero stops meaning "not started" and starts meaning
    // "the walk is broken or a bundle was deleted". EN gains one, FR does not,
    // so no PAIR is compared and the count stays at zero.
    const { output } = run({ bundles: { 'ui.json': ['en'] } });
    const locales = linesFor(output, 'locales');
    expect(locales.join('\n')).toContain('the locale directories are NOT empty');
    // the pre-existing parity rule fires too, and both are wanted: one names the
    // missing file, the other names the vacuum.
    expect(locales.join('\n')).toContain('content/locales/fr/ui.json is missing');
  });

  it('counts a matching pair, so the declaration retires itself', () => {
    const { output } = run({ bundles: { 'ui.json': ['en', 'fr'] } });
    expect(output).toContain('1 locale bundle(s) in EN/FR parity');
    expect(output).not.toContain('NO locale bundles exist yet');
  });

  it('does not fire over a tree with no UI at all, which is every other fixture', () => {
    // The premise is about THIS repository's UI strings. A first draft failed
    // every minimal tree in tests/unit/infra/, which is a gate over-reaching
    // into other gates' fixtures rather than a defect being caught.
    const { output } = run({ copy: null, noUi: true });
    expect(linesFor(output, 'locales')).toEqual([]);
  });

  it('fails when app/ui/copy.ts is gone, because the declaration cited it', () => {
    const { output } = run({ copy: null });
    expect(linesFor(output, 'locales').join('\n')).toContain('the file is missing');
  });

  it('fails when the FR table stops being typed against EN', () => {
    const real = readFileSync(REAL_COPY, 'utf8');
    const detyped = real
      .replace('const FR: Readonly<Record<CopyRow, string>> = {', 'const FR = {')
      .replace(
        'Readonly<Record<UiLocale, Readonly<Record<CopyRow, string>>>>',
        'Readonly<Record<UiLocale, unknown>>',
      );
    expect(detyped).not.toBe(real);
    const { output } = run({ copy: detyped });
    expect(linesFor(output, 'locales').join('\n')).toContain('no table is typed by the row type');
  });

  it('fails when the row type stops deriving from EN, comment or no comment', () => {
    // The defect in the first draft. `keyof typeof EN` appears in this file's
    // header prose, so a loose match passed a `CopyRow` retyped to `string`.
    const detyped = readFileSync(REAL_COPY, 'utf8').replace(
      'type CopyRow = keyof typeof EN;',
      'type CopyRow = string;',
    );
    expect(detyped).toContain('keyof typeof EN'); // still there, in the comment
    const { output } = run({ copy: detyped });
    expect(linesFor(output, 'locales').join('\n')).toContain('no row type is derived from EN');
  });
});

describe('the content-document count cannot pass by having nothing to validate', () => {
  it('fails on an empty content/, with the schemas still present', () => {
    const { output } = run({ documents: false });
    expect(linesFor(output, 'content').join('\n')).toContain('found 0 document(s) under content/');
    expect(linesFor(output, 'content').join('\n')).toContain('vacuously true');
  });

  it('does not fire when documents are there', () => {
    expect(linesFor(run().output, 'content')).toEqual([]);
  });

  it('is counted over content/ alone, so the floor can actually be reached', () => {
    // The floor was first written over `dataFiles`, which always carries
    // assets/credits.json and assets/style/palette.json. This asserts the thing
    // that made it decoration: the case above reaches zero even though those
    // two documents are what the combined list would still hold.
    const { output } = run({ documents: false });
    expect(output).toContain('a floor that cannot fire is decoration');
  });
});
