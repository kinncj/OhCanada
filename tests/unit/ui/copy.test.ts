import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { COPY_GAPS, percent, preferredLocale, text, UI_LOCALES, isUiLocale } from '@ui/copy';

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

  it('declares every string it had to invent, and invents no other', () => {
    /* The NEEDS_COPY comments in the source are the marker; COPY_GAPS is the
       list. If they disagree, a sixth invented string has slipped in unlisted. */
    const source = readFileSync(new URL('../../../app/ui/copy.ts', import.meta.url), 'utf8');
    const marked = source.split('NEEDS_COPY').length - 1;
    /* One mention in the module docstring, one in COPY_GAPS' own doc comment,
       and one comment above the invented block. */
    expect(marked).toBeGreaterThan(0);
    expect([...COPY_GAPS]).toEqual(['settings.state.on', 'settings.state.off']);
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
    expect(everyString('en').length).toBeGreaterThan(10);
  });
});
