/**
 * ADR-0051, over the real corpus: a territory statement cites one source, names
 * only what that source names, and carries the publisher of the page the panel
 * links.
 *
 * Four rules, and each is here rather than in a schema or a script for a stated
 * reason:
 *
 *  1. **`sourcePublisher` is the register's own `publisher`, in both
 *     languages.** The panel draws it as the text of its source link, and the
 *     runtime cannot read a source register — there is no port for one,
 *     deliberately. So the value is carried in the level document and pinned to
 *     the register here, which is the only place that can open both files.
 *
 *     The comparison is **per language**, and that is not a refinement of the
 *     rule but the defect that prompted it: while both were bare strings, the
 *     French "About this place" panel drew "Immigration, Refugees and
 *     Citizenship Canada" under a French sentence, and this gate passed the
 *     whole time, because the one string it compared was the English one.
 *  2. **`territory.fact.factual` is true.** `adjudicateClaim` treats a
 *     `factual: false` block as drawable, correctly, because a greeting needs no
 *     verifier; spent on a territorial statement that exemption would draw an
 *     unsourced sentence about whose land this is. `parseLevelDocument` refuses
 *     it at run time and this refuses it in CI, because the schema cannot state
 *     it without a constraint wrapped round a `$ref` that
 *     `ports-match-schemas.test.ts` does not resolve (ADR-0051 §4).
 *  3. **An empty `nations` says why it is empty.** The schema's conditional is
 *     the authority; this restates it over the corpus so a document that somehow
 *     reached `content/` without passing `make validate-content` is still caught.
 *  4. **The gate's name-finder is alive.** `scripts/lib/claims.mjs` names the
 *     field `nations` in `NAME_FIELDS` because a name cannot be found by shape —
 *     an array of strings beside a claim is an array of strings. A named field
 *     can go dead silently when a schema renames it, and the symptom would be a
 *     count going to zero in a gate's summary, which is also what a corpus whose
 *     statements name nobody looks like. So this compares what the walk finds
 *     with what the documents print, in both directions.
 *
 * What this file cannot check, said plainly rather than implied: whether the
 * cited source really prints the name. That needs the source's bytes, every
 * register in this repository is `committed: false`, and the extractions are
 * git-ignored — so `verify-content`'s B9 does it where the bytes are and reports
 * it as unchecked where they are not. Nothing here may be read as covering it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { claimsIn, NAME_FIELDS } from '../../../scripts/lib/claims.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;
const SOURCES_DIR = `${REPO_ROOT}content/sources`;

interface TerritoryStatementJson {
  readonly nations?: unknown;
  readonly nationsAbsentBecause?: unknown;
  readonly sourcePublisher?: unknown;
  readonly fact?: {
    readonly factual?: unknown;
    readonly source?: { readonly sourceId?: unknown; readonly url?: unknown };
  };
}

interface LevelJson {
  readonly id?: unknown;
  readonly territory?: TerritoryStatementJson;
}

const levelFiles = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

const levels = levelFiles.map((file) => ({
  file,
  document: JSON.parse(readFileSync(`${LEVELS_DIR}/${file}`, 'utf8')) as LevelJson,
}));

/** The two languages every player-facing string carries (ADR-0010). */
const LANGUAGES = ['en', 'fr'] as const;
type Language = (typeof LANGUAGES)[number];

/**
 * A localised publisher, refused unless it carries both languages.
 *
 * It throws rather than returning what it found. A publisher missing its French
 * half is precisely what this suite exists to catch, and a comparison that read
 * `undefined` on both sides would agree with itself and report a pass.
 */
const bothLanguages = (value: unknown, where: string): Readonly<Record<Language, string>> => {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${where} carries no localised publisher`);
  }
  const record = value as Record<string, unknown>;
  const both = {} as Record<Language, string>;
  for (const language of LANGUAGES) {
    const text = record[language];
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error(`${where} carries no ${language} publisher`);
    }
    both[language] = text;
  }
  return both;
};

const registerPublisher = (sourceId: string): Readonly<Record<Language, string>> => {
  const register = JSON.parse(
    readFileSync(`${SOURCES_DIR}/${sourceId}.json`, 'utf8'),
  ) as { readonly publisher?: unknown };
  return bothLanguages(register.publisher, `content/sources/${sourceId}.json`);
};

describe('every level states a territory, and states it about one source', () => {
  it('there is at least one level, so this suite is not reading an empty directory', () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  it.each(levelFiles)('%s: carries a territory statement', (file) => {
    const territory = levels.find((level) => level.file === file)?.document.territory;
    expect(territory, 'every place in Canada is on someone territory').toBeDefined();
  });

  it.each(levelFiles)('%s: states a fact, so a verifier owns it', (file) => {
    const territory = levels.find((level) => level.file === file)?.document.territory;
    expect(
      territory?.fact?.factual,
      'a territory statement that claimed nothing would not be one, and a false `factual` is the ' +
        'exemption ADR-0003 grants a greeting, spent on a sentence about whose land this is',
    ).toBe(true);
  });

  /*
   * PER LANGUAGE, and the loop is the point rather than tidiness.
   *
   * The panel draws this value as the text of its source link, so while the
   * publisher was one string the French panel read "Immigration, Refugees and
   * Citizenship Canada" under a French sentence — the only line on that panel
   * nobody had translated. A gate that compares ONE string goes green on that
   * corpus, because the one string it compares is the English one. Comparing
   * each language against that language's half of the register's own publisher
   * is what fails on it, and it is the reason this is not a single `toEqual`
   * over the whole object: a later reader loosening this to "the publishers
   * match" would restore exactly the hole it was written to close.
   */
  for (const language of LANGUAGES) {
    it.each(levelFiles)(
      `%s: names the publisher its own register names, in ${language}`,
      (file) => {
        const territory = levels.find((level) => level.file === file)?.document.territory;
        const sourceId = territory?.fact?.source?.sourceId;
        expect(typeof sourceId, `${file}: the territorial claim cites no sourceId`).toBe('string');
        const printed = bothLanguages(
          territory?.sourcePublisher,
          `content/levels/${file} territory.sourcePublisher`,
        );
        expect(
          printed[language],
          `${file}: the "About this place" panel draws this as the text of the link it points at ` +
            `${String(territory?.fact?.source?.url)}, so a publisher that is not the publisher of ` +
            'that page attributes the sentence to somebody who did not write it (ADR-0051) — and ' +
            `in ${language} it must be that register's own ${language} name, not its English one`,
        ).toBe(registerPublisher(String(sourceId))[language]);
      },
    );
  }

  it.each(levelFiles)('%s: has a page for the panel to link', (file) => {
    const territory = levels.find((level) => level.file === file)?.document.territory;
    expect(typeof territory?.fact?.source?.url).toBe('string');
  });

  it.each(levelFiles)('%s: an empty list of nations records why it is empty', (file) => {
    const territory = levels.find((level) => level.file === file)?.document.territory;
    const nations = territory?.nations;
    expect(Array.isArray(nations)).toBe(true);
    const empty = Array.isArray(nations) && nations.length === 0;
    expect(
      territory?.nationsAbsentBecause,
      empty
        ? `${file}: names nobody and does not say why. A statement may name nobody only where the ` +
          'source it cites names nobody for this place, and that is a finding to record rather ' +
          'than an empty list to leave (ADR-0051).'
        : `${file}: names somebody and also says it names nobody.`,
    ).toBe(empty ? 'source-names-none' : undefined);
  });
});

describe('the gate can still find the names a statement prints', () => {
  /** Every name the claim walk reports, as `file/name`. */
  const found = levels
    .flatMap(({ file, document }) =>
      claimsIn(document, `content/levels/${file}`).flatMap((claim) =>
        claim.names.map(({ name }) => `${file}/${name}`),
      ),
    )
    .sort();

  /** Every name the documents print, read a different way. */
  const printed = levels
    .flatMap(({ file, document }) => {
      const nations = document.territory?.nations;
      return Array.isArray(nations) ? nations.map((name) => `${file}/${String(name)}`) : [];
    })
    .sort();

  it('names the field it reads, with a reason, because a name cannot be found by shape', () => {
    expect(NAME_FIELDS.length).toBeGreaterThan(0);
    for (const { key, why } of NAME_FIELDS) {
      expect(key.length).toBeGreaterThan(0);
      expect(why.length).toBeGreaterThan(20);
    }
  });

  it('finds exactly the names the level documents print, and no others', () => {
    /*
     * The anti-vacuity guard (ADR-0024). `NAME_FIELDS` names a field, so a
     * schema that renames it leaves the walk finding nothing — and "found
     * nothing" is also what a corpus whose statements name nobody looks like,
     * which is a state ADR-0051 makes legitimate. Equality tells the two apart:
     * a dead field finds nothing while the documents still print names, and that
     * fails here even though the gate's own summary would look calm.
     */
    expect(found).toEqual(printed);
  });
});
