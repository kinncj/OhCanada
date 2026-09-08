import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  count,
  COPY_GAPS,
  formatNumber,
  percent,
  pluralCategory,
  preferredLocale,
  text,
  UI_LOCALES,
  isUiLocale,
} from '@ui/copy';

/**
 * The copy table is the one place in `app/ui` that holds player-facing words, so
 * it is the one place where a wording rule can be checked mechanically. Four of
 * these are rules from documents outside this directory:
 *
 *  - `docs/stories/TN-CARD-02` and `TN-STUDY-02`: the scheduling vocabulary
 *    never reaches a screen, in either language.
 *  - `docs/content-review.md` §8.6: no French string about the player requires
 *    gender agreement — no `(e)`, no `·e`, no bracketed ending.
 *  - `docs/stories/README.md`, French style: no space before `?` or `!`, a space
 *    before `:`.
 *  - `docs/stories/README.md`: the UI invents no copy. Anything this module had
 *    to write is declared in `COPY_GAPS` and reported upward.
 */

const UI_DIR = fileURLToPath(new URL('../../../app/ui/', import.meta.url));

const everyString = (locale: 'en' | 'fr'): string[] => {
  const source = readFileSync(new URL('../../../app/ui/copy.ts', import.meta.url), 'utf8');
  const table = source.split(locale === 'en' ? 'const EN = {' : 'const FR: Readonly')[1] ?? '';
  return table.split('\n');
};

describe('the copy table', () => {
  it('offers exactly the two languages the game ships in', () => {
    expect([...UI_LOCALES]).toEqual(['en', 'fr']);
    expect(isUiLocale('en')).toBe(true);
    expect(isUiLocale('fr')).toBe(true);
    expect(isUiLocale('de')).toBe(false);
    expect(isUiLocale(null)).toBe(false);
  });

  it('has a French string for every English one', () => {
    /* Enforced by the type, and asserted anyway: the type is what a future
       refactor can weaken, and a silently-English screen is `TN-CREATOR-09`'s
       named defect. */
    for (const key of KEYS) {
      expect(text('fr', key), `missing FR for ${key}`).not.toBe('');
      expect(typeof text('fr', key)).toBe('string');
    }
  });

  it('never puts a scheduling word on screen, in either language', () => {
    const banned = ['spaced repetition', 'fsrs', 'algorithm', 'interval', 'due', 'répétition espacée', 'algorithme', 'intervalle', 'échéance'];
    for (const locale of UI_LOCALES) {
      for (const key of KEYS) {
        const value = text(locale, key).toLowerCase();
        for (const word of banned) {
          expect(value.includes(word), `${key} (${locale}) contains "${word}"`).toBe(false);
        }
      }
    }
  });

  it('never uses the words "wrong", "fail" or "error" about the player', () => {
    for (const key of KEYS) {
      const value = text('en', key).toLowerCase();
      for (const word of [' wrong', 'you failed', 'your error']) {
        expect(value.includes(word), `${key} says "${word}"`).toBe(false);
      }
    }
  });

  it('writes no French string that needs gender agreement about the player', () => {
    /* docs/content-review.md 8.6: no « prêt(e) », no « inscrit·e », no bracketed
       ending. The creator is where the game first speaks to the player about
       themself, so the rule is checked over the whole table. */
    for (const key of KEYS) {
      const value = text('fr', key);
      expect(/\(e\)|·e\b|·es\b|-e\)/.test(value), `${key} needs agreement: ${value}`).toBe(false);
    }
  });

  it('uses Canadian French typography', () => {
    for (const key of KEYS) {
      const value = text('fr', key);
      expect(/\s[?!]/.test(value), `${key} has a space before ? or !: ${value}`).toBe(false);
      if (value.includes(':')) {
        expect(/\S:/.test(value), `${key} needs a space before ":": ${value}`).toBe(false);
      }
    }
  });

  it('invents nothing: the gap list is empty and its marker is gone', () => {
    /*
     * `TN-COPY-06`, "the gap list is empty when the tables are complete".
     * `settings.state.on` / `.off` used to be the two entries and are now
     * written down in `TN-COPY-strings-and-counts.md`, so nothing here is
     * authored by this directory. The marker is built rather than written so
     * this file is not itself a hit for the search.
     */
    const marker = ['NEEDS', 'COPY'].join('_');
    const source = readFileSync(new URL('../../../app/ui/copy.ts', import.meta.url), 'utf8');

    expect([...COPY_GAPS]).toEqual([]);
    expect(source.includes(marker), `${marker} survives in copy.ts`).toBe(false);
  });

  it('takes the two strings no table carries from the caller, as required options', () => {
    /*
     * The other half of `TN-COPY-06`: "the string is taken from the caller as
     * data, or the key is listed as a gap". Two screens need a string no story
     * table writes — the `hud` region's accessible name and the level-loading
     * sentence — and both are *required* options, so neither can quietly become
     * a default this directory authored. Read from the source, so deleting the
     * word `readonly label: string` fails here rather than at review.
     */
    const hud = readFileSync(new URL('../../../app/ui/hud.ts', import.meta.url), 'utf8');
    const level = readFileSync(new URL('../../../app/ui/level-screens.ts', import.meta.url), 'utf8');

    expect(hud).toMatch(/readonly label: string;/);
    expect(hud).not.toMatch(/options\.label \?\?/);
    expect(level).toMatch(/readonly message: string;/);
    expect(level).not.toMatch(/options\.message \?\?/);
  });

  it('counts through Intl.PluralRules, in English', () => {
    /* `TN-COPY-01`. */
    expect(count('en', 'study.count', 1)).toBe('1 question');
    expect(count('en', 'study.count', 5)).toBe('5 questions');
    expect(count('en', 'study.short', 1)).toBe('You have 1 question ready. We will ask it.');
    expect(count('en', 'study.short', 3)).toBe('You have 3 questions ready. We will ask those.');
  });

  it('counts through Intl.PluralRules, in French, where French differs', () => {
    /*
     * `TN-COPY-02`. This is the pair that makes the rule worth having: at zero
     * the two languages choose different categories, and an `n === 1`
     * comparison gets French wrong every time.
     */
    expect(count('fr', 'study.count', 0)).toBe('0 question');
    expect(count('en', 'study.count', 0)).toBe('0 questions');
    expect(count('fr', 'study.count', 1)).toBe('1 question');
    expect(count('fr', 'study.count', 5)).toBe('5 questions');
    expect(pluralCategory('fr', 0)).toBe('one');
    expect(pluralCategory('en', 0)).toBe('other');
  });

  it('treats a fraction below two as singular in French and plural in English', () => {
    /* `TN-SET-09` draws 0.3 s as « 0,3 seconde » and as "0.3 seconds". */
    expect(pluralCategory('fr', 0.3)).toBe('one');
    expect(pluralCategory('en', 0.3)).toBe('other');
    expect(count('fr', 'settings.holdTime.seconds', 0.3, { seconds: formatNumber('fr', 0.3) })).toBe(
      '0,3 seconde',
    );
    expect(count('en', 'settings.holdTime.seconds', 0.3, { seconds: formatNumber('en', 0.3) })).toBe(
      '0.3 seconds',
    );
    expect(count('en', 'settings.holdTime.seconds', 2, { seconds: formatNumber('en', 2) })).toBe(
      '2 seconds',
    );
    expect(count('fr', 'settings.holdTime.seconds', 2, { seconds: formatNumber('fr', 2) })).toBe(
      '2 secondes',
    );
  });

  it('formats a number the way each language writes one', () => {
    expect(formatNumber('en', 0.6)).toBe('0.6');
    expect(formatNumber('fr', 0.6)).toBe('0,6');
  });

  it('carries both plural forms for every counted key, in both languages', () => {
    /*
     * `TN-COPY-03`: "a count key without both forms fails the check", and "a form
     * missing in one language only fails the check". The type already refuses a
     * French table with a missing row; this catches the other half — an English
     * `.one` with no `.other` beside it.
     */
    const missing: string[] = [];
    for (const key of KEYS) {
      if (!key.endsWith('.one')) continue;
      const other = `${key.slice(0, -'.one'.length)}.other`;
      if (!KEYS.includes(other as (typeof KEYS)[number])) missing.push(other);
    }
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('never places a counted noun straight after a placeholder in a single row', () => {
    /*
     * `TN-COPY-03`, third scenario: a single row whose value puts a noun
     * immediately after a placeholder is how "1 questions" happens.
     *
     * A *preposition* after the number is fine and is what rule 1 recommends —
     * "Question 1 of 3" / « Question 1 sur 3 » has no plural problem because the
     * noun does not follow the number that changes — so the function words are
     * skipped rather than the keys being exempted.
     *
     * What is left is a real finding and it is reported rather than silenced:
     * `study.summary.score` in French reads « Vous avez 1 bonnes réponses sur 5 »
     * when the player got one right. The wording belongs to
     * `docs/stories/TN-STUDY-study-mode.md`, which this directory may not edit,
     * so the key is listed here with its language and reported with the task.
     * The assertion is an equality, not an allowance: fixing the string fails
     * this test, and so does adding a second offender.
     */
    const FUNCTION_WORDS = new Set([
      'of', 'out', 'on', 'in', 'for', 'and', 'or', 'to',
      'sur', 'de', 'des', 'du', 'et', 'ou', 'en', 'au',
    ]);
    const REPORTED_TO_THE_PO = ['study.summary.score (fr)'];

    const offenders: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of KEYS) {
        if (key.endsWith('.one') || key.endsWith('.other')) continue;
        const value = text(locale, key as Parameters<typeof text>[1]);
        const after = /\{\{\w+\}\} ([a-zà-ÿ]+)/u.exec(value);
        if (after === null) continue;
        if (FUNCTION_WORDS.has(after[1] ?? '')) continue;
        offenders.push(`${key} (${locale})`);
      }
    }
    expect(offenders.sort(), offenders.join('\n')).toEqual(REPORTED_TO_THE_PO);
  });

  it('refuses hand-written pluralisation anywhere in app/ui', () => {
    /*
     * `TN-COPY-03`, last scenario: "a string chosen by comparing a count to 1
     * rather than by its plural category" fails the unit suite, naming the
     * string. The type already makes it uncompilable — `text` cannot name a
     * plural row — and this is the belt: a screen could still build the ending
     * itself out of two literals.
     */
    const offenders: string[] = [];
    for (const name of readdirSync(UI_DIR)) {
      if (!name.endsWith('.ts')) continue;
      const code = readFileSync(`${UI_DIR}${name}`, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const [hit] of code.matchAll(/[!=]==\s*1\s*\?|\?\s*'[^']*'\s*:\s*'[^']*s'/g)) {
        offenders.push(`${name}: ${hit}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('leaves a placeholder visible when a parameter is missing, rather than a hole', () => {
    expect(text('en', 'card.progress', { n: 1, total: 3 })).toBe('Question 1 of 3');
    expect(text('fr', 'card.progress', { n: 1, total: 3 })).toBe('Question 1 sur 3');
    expect(text('en', 'card.progress', { n: 1 })).toBe('Question 1 of {{total}}');
    expect(text('en', 'card.progress')).toBe('Question {{n}} of {{total}}');
  });

  it('formats a percentage the way each language writes one', () => {
    expect(percent('en', 200)).toBe('200%');
    /* French uses a space before the sign; `Intl` knows which space. */
    expect(percent('fr', 200)).toMatch(/^200\s%$/u);
  });

  it('follows the browser language on a first run, and falls back to English', () => {
    expect(preferredLocale(['fr-CA', 'en-CA'])).toBe('fr');
    expect(preferredLocale(['en-GB'])).toBe('en');
    expect(preferredLocale(['de-DE'])).toBe('en');
    expect(preferredLocale([])).toBe('en');
  });

  it('keeps the language names untranslated', () => {
    expect(text('en', 'settings.language.fr')).toBe(text('fr', 'settings.language.fr'));
    expect(text('en', 'settings.language.en')).toBe(text('fr', 'settings.language.en'));
  });

  it('is the only place in app/ui that holds player-facing sentences', () => {
    /*
     * A sentence hardcoded in a screen is a string that will not move when the
     * locale bundles land, which is the whole point of keeping the copy in one
     * module. Crude but effective: no other file in app/ui may contain a quoted
     * run of words ending in a full stop.
     */
    /*
     * `rotate-overlay.ts` and `build-status.ts` are slice 0 and carry their own
     * two-language `COPY` block with the same `TODO(slice-1): move to
     * content/locales` marker. They are exempt rather than moved: they are not
     * this task's files, and they will move in the same change this table does.
     */
    const slice0 = ['rotate-overlay.ts', 'build-status.ts'];
    const offenders: string[] = [];
    for (const name of readdirSync(UI_DIR)) {
      if (!name.endsWith('.ts') || name === 'copy.ts' || slice0.includes(name)) continue;
      const source = readFileSync(`${UI_DIR}${name}`, 'utf8');
      /* Strip comments, which are prose by design. */
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const [, sentence] of code.matchAll(/'([A-Z][a-z]+ [a-z][^']*\.)'/g)) {
        offenders.push(`${name}: ${sentence ?? ''}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

/** Every key, read from the module rather than re-listed here. */
const KEYS = (() => {
  const source = readFileSync(new URL('../../../app/ui/copy.ts', import.meta.url), 'utf8');
  const block = source.split('const EN = {')[1]?.split('} as const;')[0] ?? '';
  const keys = [...block.matchAll(/^\s{2}'([\w.]+)':/gm)].map((match) => match[1] ?? '');
  if (keys.length === 0) throw new Error('copy.ts: no keys found — the parser has drifted');
  return keys as Parameters<typeof text>[1][];
})();

describe('the copy table parser used by this suite', () => {
  it('really found the table, so the rules above are not vacuous', () => {
    expect(KEYS.length).toBeGreaterThan(50);
    expect(KEYS).toContain('settings.title');
    expect(KEYS).toContain('study.summary.score');
    expect(KEYS).toContain('study.count.one');
    expect(everyString('en').length).toBeGreaterThan(10);
  });
});
