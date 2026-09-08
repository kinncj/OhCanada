/**
 * ADR-0008 enforcement: a port file with no consumer under `app/` carries
 * `PROVISIONAL` in its header comment, and a port file with a consumer does not.
 *
 * The defect this closes: `app/application/ports/` grew to eleven files in slice
 * 0, of which three exported types were read by anything. `AudioPort` declared a
 * four-bus model with ducking curves, `Locomotion` declared an eight-mode
 * strategy contract, and nothing distinguished them from `GameConfigDocument`,
 * which an adapter compiles against and a contract test pins to a schema. A
 * directory called `ports` reads as "these are the contracts"; nine of the eleven
 * had never been implemented or called by anything.
 *
 * `ports-match-schemas.test.ts` cannot see this. It walks schema -> type, so it
 * only ever reaches types a schema names, and a behavioural seam like `Clock`
 * will never have a schema at all. This file walks the other axis: import edges.
 *
 * Both directions fail, which is the part that keeps it honest over time:
 *   - unconsumed and unmarked -> a port was written ahead of any caller with
 *     nothing saying so;
 *   - consumed and still marked -> the first caller landed and the marker was
 *     left behind, so the file still disclaims a contract that is now real.
 *
 * A test is not a consumer (ADR-0008): `tests/**` is excluded on purpose. An
 * interface exercised only by a test written against it is tested against itself.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const APP_DIR = `${REPO_ROOT}app`;
const PORTS_DIR = `${REPO_ROOT}app/application/ports`;
const PORTS_INDEX = `${PORTS_DIR}/index.ts`;
/**
 * The marker, matched as a *marker* rather than as a word.
 *
 * It was `'PROVISIONAL'` and a plain `includes`, which is wrong in a way that
 * only shows up once a marker is removed: the sentence a careful implementer
 * writes when they retire one — "the ADR-0008 PROVISIONAL marker is gone because
 * the first call site landed" — contains the word, so the file was read as still
 * marked and the gate failed on a port that had been corrected properly. A check
 * that punishes explaining yourself teaches people to explain themselves less.
 *
 * So the form is what counts, and it is the form ADR-0008 specifies and every
 * port already uses: `PROVISIONAL (ADR-0008)`. Prose about the marker does not
 * match it. Writing the bare word and expecting it to count fails in the safe
 * direction — the port reports as unconsumed and unmarked, which points at the
 * right fix.
 */
const MARKER = /\bPROVISIONAL\s*\(ADR-0008\)/u;
const MARKER_FORM = 'PROVISIONAL (ADR-0008)';

/** Every `.ts` file under `dir`, recursively. */
const typeScriptFilesIn = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return typeScriptFilesIn(path);
    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });

const parse = (path: string): ts.SourceFile =>
  ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ESNext, true);

const portFiles = readdirSync(PORTS_DIR)
  .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
  .sort();

/* -------------------------------------------------------------------------- */
/* which file declares which exported name                                    */
/* -------------------------------------------------------------------------- */

/**
 * `index.ts` is a wall of `export type { A, B } from './x'`, so the mapping from
 * an exported name to the file that declares it is read from the barrel rather
 * than guessed from the name.
 */
const declaringFileOf = new Map<string, string>();

for (const statement of parse(PORTS_INDEX).statements) {
  if (!ts.isExportDeclaration(statement)) continue;
  const specifier = statement.moduleSpecifier;
  if (specifier === undefined || !ts.isStringLiteral(specifier)) continue;
  const file = `${specifier.text.replace(/^\.\//u, '')}.ts`;
  const clause = statement.exportClause;
  if (clause === undefined || !ts.isNamedExports(clause)) continue;
  for (const element of clause.elements) declaringFileOf.set(element.name.text, file);
}

/* -------------------------------------------------------------------------- */
/* which names anything under app/ actually imports                           */
/* -------------------------------------------------------------------------- */

const consumerFiles = typeScriptFilesIn(APP_DIR).filter(
  (path) => !path.startsWith(`${PORTS_DIR}/`),
);

interface Consumption {
  /** Imported name -> the files that import it. */
  readonly byName: ReadonlyMap<string, readonly string[]>;
  /** Files that do `import * as ports from '@application/ports'`, which consumes everything. */
  readonly wholeBarrel: readonly string[];
}

const readConsumption = (): Consumption => {
  const byName = new Map<string, string[]>();
  const wholeBarrel: string[] = [];

  for (const path of consumerFiles) {
    const label = path.slice(REPO_ROOT.length);
    for (const statement of parse(path).statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!ts.isStringLiteral(specifier)) continue;
      // `@application/ports`, `@application/ports/audio`, or a relative path into
      // the directory. Anything else cannot reach a port.
      const text = specifier.text;
      const reachesPorts =
        text === '@application/ports' ||
        text.startsWith('@application/ports/') ||
        text.includes('application/ports');
      if (!reachesPorts) continue;

      const clause = statement.importClause;
      if (clause?.namedBindings === undefined) continue;
      if (ts.isNamespaceImport(clause.namedBindings)) {
        wholeBarrel.push(label);
        continue;
      }
      for (const element of clause.namedBindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        byName.set(imported, [...(byName.get(imported) ?? []), label]);
      }
    }
  }

  return { byName, wholeBarrel };
};

const consumption = readConsumption();

const consumersOf = (portFile: string): readonly string[] => {
  if (consumption.wholeBarrel.length > 0) return consumption.wholeBarrel;
  const found = new Set<string>();
  for (const [name, files] of consumption.byName) {
    if (declaringFileOf.get(name) !== portFile) continue;
    for (const file of files) found.add(file);
  }
  return [...found].sort();
};

/** Is the marker in the file's own header comment — the first block comment? */
const headerCarriesMarker = (portFile: string): boolean => {
  const text = readFileSync(`${PORTS_DIR}/${portFile}`, 'utf8');
  const header = /^\/\*[\s\S]*?\*\//u.exec(text)?.[0];
  return header !== undefined && MARKER.test(header);
};

/* -------------------------------------------------------------------------- */
/* the gate                                                                   */
/* -------------------------------------------------------------------------- */

describe('a port exists when something calls it (ADR-0008)', () => {
  it('reads the ports directory and the import graph it is judged against', () => {
    expect(portFiles.length, 'app/application/ports holds no port files').toBeGreaterThan(0);
    expect(
      consumerFiles.length,
      'no file under app/ outside the ports directory — the consumption walk would find ' +
        'nothing and every port would look unconsumed',
    ).toBeGreaterThan(0);
    expect(
      declaringFileOf.size,
      `${PORTS_INDEX} re-exports nothing, so no imported name can be traced to the file ` +
        `that declares it`,
    ).toBeGreaterThan(0);
    // If the barrel ever stops naming a file that exists, every name in it maps
    // to a port that is not there and the gate silently stops judging that file.
    for (const [name, file] of declaringFileOf) {
      expect(
        portFiles,
        `${PORTS_INDEX} re-exports \`${name}\` from './${file.replace(/\.ts$/u, '')}', ` +
          `which is not a file in app/application/ports`,
      ).toContain(file);
    }
    // The gate must be able to see at least one real consumer, or "consumed"
    // is a branch nothing ever takes and only half of it is tested.
    expect(
      [...consumption.byName.keys()].length + consumption.wholeBarrel.length,
      'nothing under app/ imports anything from app/application/ports, so the consumed ' +
        'branch of this gate is never exercised',
    ).toBeGreaterThan(0);
  });

  describe.each(portFiles.map((file) => [file] as const))('%s', (portFile) => {
    it('carries the PROVISIONAL marker if and only if nothing under app/ imports it', () => {
      const consumers = consumersOf(portFile);
      const marked = headerCarriesMarker(portFile);

      if (consumers.length === 0) {
        expect(
          marked,
          `app/application/ports/${portFile} has no consumer under app/: nothing imports a ` +
            `type it declares, so nothing has ever been compiled against it. ADR-0008 requires ` +
            `\`${MARKER_FORM}\` in its header comment, naming the slice task that will give it a ` +
            `caller — or the file should not exist yet. The exact form matters: the bare word is ` +
            `not enough, so that prose *about* the marker cannot be mistaken for one. An unmarked ` +
            `port reads as a contract that something satisfies.`,
        ).toBe(true);
      } else {
        expect(
          marked,
          `app/application/ports/${portFile} is imported by ${consumers.join(', ')} and ` +
            `still carries \`${MARKER_FORM}\` in its header. The marker means "nothing has ever ` +
            `implemented or called this"; something has. Delete it (ADR-0008). Writing a sentence ` +
            `saying the marker is gone is fine and does not trip this check.`,
        ).toBe(false);
      }
    });
  });
});
