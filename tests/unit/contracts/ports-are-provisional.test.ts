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
 *
 * Since slice 1 it also judges `docs/architecture.md` §5's port table, whose last
 * column states the same fact in prose. ADR-0008's Consequences require the table
 * and the files to agree, and by review alone they did not: four rows still read
 * `PROVISIONAL` after their first callers landed. A document describing the ports
 * directory is a claim about it, and this is the one place in the repository that
 * can check it — so the table's State column is derived from the same marker the
 * gate above reads, and a disagreement fails here rather than misleading a reader.
 *
 * The row-to-file mapping is not by name-guessing: it reuses `declaringFileOf`,
 * the barrel's own export map, so `ICharacterRenderer` finds `character-renderer.ts`
 * and `AudioPort` finds `audio.ts` because `index.ts` says so. A row naming a type
 * the barrel does not export fails, which is what stops the table describing ports
 * that do not exist.
 *
 * What it deliberately does not check: the "→ slice 1 task N" part of a
 * `PROVISIONAL` cell, or anything in the Hides and Notes columns. Those are prose
 * and there is nothing to compare them against. Only the binary — marked or not —
 * is a fact both sides state.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const APP_DIR = `${REPO_ROOT}app`;
const PORTS_DIR = `${REPO_ROOT}app/application/ports`;
const PORTS_INDEX = `${PORTS_DIR}/index.ts`;
const ARCHITECTURE_DOC = `${REPO_ROOT}docs/architecture.md`;
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
/* docs/architecture.md 5 — the same fact, in prose                           */
/* -------------------------------------------------------------------------- */

interface TableRow {
  /** The type named in the first column, e.g. `ICharacterRenderer`. */
  readonly port: string;
  /** The State column, verbatim. */
  readonly state: string;
  readonly line: number;
}

/**
 * Rows of the port table in §5. Found by shape rather than by heading offset —
 * a four-column row whose first cell is a single backticked identifier — so
 * re-ordering the document or adding a section above it does not silently empty
 * this set. The anti-vacuum assertion below is what catches it if it does.
 */
const portTableRows = (): readonly TableRow[] => {
  const rows: TableRow[] = [];
  readFileSync(ARCHITECTURE_DOC, 'utf8')
    .split('\n')
    .forEach((text, index) => {
      if (!text.startsWith('|')) return;
      const cells = text.split('|').slice(1, -1);
      if (cells.length !== 4) return;
      const port = /^\s*`([A-Za-z][A-Za-z0-9_]*)`\s*$/u.exec(cells[0] ?? '')?.[1];
      if (port === undefined) return;
      rows.push({ port, state: (cells[3] ?? '').trim(), line: index + 1 });
    });
  return rows;
};

const architectureRows = portTableRows();

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

describe('docs/architecture.md 5 states the same marker state as the files (ADR-0008)', () => {
  it('found a port table to read', () => {
    // Anti-vacuum: if the table moves, is reformatted, or loses its backticks,
    // every assertion below becomes vacuous and this is what says so.
    expect(
      architectureRows.length,
      `${ARCHITECTURE_DOC} has no four-column table row whose first cell is a single ` +
        'backticked identifier, so the port table could not be found and nothing below ' +
        'is being checked',
    ).toBeGreaterThanOrEqual(portFiles.length);
  });

  it('names only ports the barrel actually exports', () => {
    const unknown = architectureRows
      .filter((row) => declaringFileOf.get(row.port) === undefined)
      .map((row) => `docs/architecture.md:${String(row.line)} lists \`${row.port}\``);
    expect(
      unknown,
      'The port table describes a type that app/application/ports/index.ts does not ' +
        'export. Either the port was renamed or removed and the table was not, or the ' +
        'table is describing a seam that does not exist yet — which belongs in 6, ' +
        '"Seams deliberately left open", not in the table of what is there.\n  ' +
        unknown.join('\n  '),
    ).toEqual([]);
  });

  it('describes every port file exactly once', () => {
    const described = architectureRows
      .map((row) => declaringFileOf.get(row.port))
      .filter((file): file is string => file !== undefined);
    const missing = portFiles.filter((file) => !described.includes(file));
    expect(
      missing,
      `app/application/ports holds ${missing.join(', ')}, which docs/architecture.md 5 ` +
        'does not describe. A port absent from the table is a seam a reader of the ' +
        'architecture cannot know about.',
    ).toEqual([]);
    expect(new Set(described).size, 'a port file is described by two rows').toBe(described.length);
  });

  it.each(architectureRows.map((row) => [row.port, row] as const))(
    '%s: the State column agrees with the file',
    (_port, row) => {
      const file = declaringFileOf.get(row.port);
      if (file === undefined) return; // reported by the case above
      const marked = headerCarriesMarker(file);
      const claimsProvisional = /\bPROVISIONAL\b/u.test(row.state);
      expect(
        claimsProvisional,
        `docs/architecture.md:${String(row.line)} says \`${row.port}\` is ` +
          `"${row.state}", and app/application/ports/${file} ${marked ? 'carries' : 'does not carry'} ` +
          `the ${MARKER_FORM} marker. The file is the fact; the table is a claim about it. ` +
          (marked
            ? 'Update the table row to PROVISIONAL, or land a consumer and remove the marker.'
            : 'The first caller has landed, so this row is out of date — say what it is ' +
              'consumed by instead.'),
      ).toBe(marked);
    },
  );
});
