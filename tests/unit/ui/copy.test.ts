import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  count,
  COPY_GAPS,
  formatNumber,
  percent,
  pluralCategory,
  pluralise,
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

/**
 * Every level this build ships a document for, read from the directory.
 *
 * Never a list anybody maintains: `content/levels/` is what makes a level exist
 * (`app/adapters/phaser/level-catalog.ts` globs the same directory), so a level
 * added with no copy rows has to fail here rather than reach a player wearing
 * another level's words.
 */
const LEVEL_IDS: readonly string[] = readdirSync(
  fileURLToPath(new URL('../../../content/levels', import.meta.url)),
)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort();

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

  it('names the hud region from the table, and still takes the waiting sentence as data', () => {
    /*
     * `TN-COPY-06` closed both gaps, and they landed differently on purpose.
     *
     * `hud.label` is one name for the whole game, so the region reads the row
     * itself: a caller-supplied `string` could be "HUD" — which `TN-HUD` calls a
     * defect — and could not turn French on the language change `TN-HUD-09`
     * requires without a reload. There is no `label` option left to forget.
     *
     * `level.<id>.loading` names one level's work, so `OQ-LEVEL-9` keeps the
     * wording with the level that waits and the screen still takes it as a
     * **required** option — as does the error card's title, for the same reason
     * and after the same defect. Required, never defaulted: a screen that waits
     * without saying what for is `TN-LEVEL-01`'s defect, and a card that fails
     * without naming the level is `TN-WAIT-02`'s. Read from the source, so
     * deleting either word fails here rather than at review.
     */
    const hud = readFileSync(new URL('../../../app/ui/hud.ts', import.meta.url), 'utf8');
    const level = readFileSync(new URL('../../../app/ui/level-screens.ts', import.meta.url), 'utf8');

    expect(hud).toMatch(/'aria-label': text\(locale, 'hud\.label'\)/);
    expect(hud, 'the region name came back as a caller option').not.toMatch(/readonly label:/);
    expect(level).toMatch(/readonly message: string;/);
    expect(level).not.toMatch(/options\.message \?\?/);
    expect(level).toMatch(/readonly title: string;/);
    expect(level, 'the error card went back to reading a row keyed on no level').not.toMatch(
      /'level\.error\.title'/,
    );
  });

  it('names the hud region for what it holds, not for what it is', () => {
    /*
     * `TN-HUD`'s copy table writes `hud.label` down and names its defects: "HUD",
     * "Heads-up display", "Region", "Section" and the empty string. A
     * screen-reader user landing on a region called "HUD" has been told the name
     * of a widget rather than what is inside it. The row is checked here because
     * this is where the words are; `tests/unit/ui/hud.test.ts` checks that the
     * region carries it and that it turns French with the language.
     */
    const banned = ['hud', 'heads-up display', 'region', 'section', ''];
    expect(text('en', 'hud.label')).toBe('Game controls');
    expect(text('fr', 'hud.label')).toBe('Commandes du jeu');
    for (const locale of UI_LOCALES) {
      const value = text(locale, 'hud.label').trim();
      expect(banned, `hud.label (${locale}) is "${value}"`).not.toContain(value.toLowerCase());
    }
  });

  it('waits without claiming a figure it cannot measure, in either language', () => {
    /*
     * `TN-COPY-07`, the waiting rule, held over the table rather than over one
     * screen: it names the work, and it carries no percentage, no fraction, no
     * step count such as "2 of 4", and no ellipsis. Held over *every* row whose
     * key ends in `.loading`, so the next level inherits the rule instead of
     * being reviewed for it.
     */
    const waiting = KEYS.filter((key) => String(key).endsWith('.loading'));
    expect(waiting, 'no waiting row found — this rule must not pass vacuously').not.toEqual([]);

    for (const locale of UI_LOCALES) {
      for (const key of waiting) {
        const value = text(locale, key);
        expect(value, `${String(key)} (${locale}) is empty`).not.toBe('');
        expect(/\d/u.test(value), `${String(key)} (${locale}) carries a figure: ${value}`).toBe(
          false,
        );
        expect(value.includes('%'), `${String(key)} (${locale}) carries a percentage`).toBe(false);
        expect(
          value.includes('…') || value.includes('...'),
          `${String(key)} (${locale}) ends in an ellipsis: ${value}`,
        ).toBe(false);
      }
    }
  });

  it('gives every built level its own waiting sentence and its own failure', () => {
    /*
     * `TN-WAIT-01` and `TN-WAIT-02`, transcribed from the four level stories.
     * Literal on both sides: reading the row to assert the row proves nothing,
     * and these eight strings are the whole of the defect this suite is about —
     * one `level.loading` and one `level.error.title`, written for Ottawa,
     * drawn by Halifax.
     */
    expect(text('en', 'level.halifax.loading')).toBe('Getting the harbour ready.');
    expect(text('fr', 'level.halifax.loading')).toBe('Préparation du port.');
    expect(text('en', 'level.quebec-city.loading')).toBe('Getting the snowy slope ready.');
    expect(text('fr', 'level.quebec-city.loading')).toBe('Préparation de la pente enneigée.');
    expect(text('en', 'level.ottawa.loading')).toBe('Getting the canal ready.');
    expect(text('fr', 'level.ottawa.loading')).toBe('Préparation du canal.');
    expect(text('en', 'level.toronto.loading')).toBe('Getting the city streets ready.');
    expect(text('fr', 'level.toronto.loading')).toBe('Préparation des rues de la ville.');

    expect(text('en', 'level.halifax.error.title')).toBe('We could not load Halifax.');
    expect(text('fr', 'level.halifax.error.title')).toBe(
      "Nous n'avons pas pu charger Halifax.",
    );
    expect(text('en', 'level.quebec-city.error.title')).toBe('We could not load Québec City.');
    expect(text('fr', 'level.quebec-city.error.title')).toBe(
      "Nous n'avons pas pu charger la Ville de Québec.",
    );
    expect(text('en', 'level.ottawa.error.title')).toBe('We could not load Ottawa.');
    expect(text('fr', 'level.ottawa.error.title')).toBe("Nous n'avons pas pu charger Ottawa.");
    expect(text('en', 'level.toronto.error.title')).toBe('We could not load Toronto.');
    expect(text('fr', 'level.toronto.error.title')).toBe("Nous n'avons pas pu charger Toronto.");
  });

  it('refuses a waiting or failure key with no level in it', () => {
    /*
     * `TN-WAIT-03`: "a copy table declares `level.loading` or
     * `level.error.title` with no level in the key … the build fails". This is
     * the row that was the defect, and its absence is the fix — so it is
     * asserted rather than assumed, because the shape that came back once can
     * come back again.
     */
    expect(KEYS, 'level.loading is back: one sentence for four levels').not.toContain(
      'level.loading',
    );
    expect(KEYS, 'level.error.title is back: one title for four levels').not.toContain(
      'level.error.title',
    );
    /*
     * Read from the source as text rather than through the type, because the
     * type is what a future edit changes: `CopyKey` no longer *has* those two
     * members, so a comparison against them does not even compile — which is a
     * stronger guarantee and a worse test, since it would stop compiling for the
     * wrong reason if a row came back.
     */
    for (const key of KEYS.map(String)) {
      const unqualified = key === 'level.loading' || key === 'level.error.title';
      expect(unqualified, `${key} names no level`).toBe(false);
    }
  });

  it('carries both rows, in both languages, for every level with a document', () => {
    /*
     * `TN-WAIT-03`: "a document exists at content/levels/<id>.json … and no
     * `level.<id>.loading` row exists in English and in French … the build
     * fails, naming the level and the missing key". The set of levels is read
     * from the directory rather than listed, so a fifth level document lands
     * with this test already failing for it — which is the only way a level can
     * be stopped from inheriting another level's words the way Halifax did.
     */
    for (const id of LEVEL_IDS) {
      for (const suffix of ['loading', 'error.title']) {
        const key = `level.${id}.${suffix}`;
        expect(KEYS, `content/levels/${id}.json ships with no ${key}`).toContain(key);
        for (const locale of UI_LOCALES) {
          expect(text(locale, key as Parameters<typeof text>[1]), `${key} (${locale})`).not.toBe(
            '',
          );
        }
      }
      expect(KEYS, `no place name for ${id}`).toContain(`level.${id}.title`);
    }
  });

  it('names every locomotion mode a level declares, and no mode none declares', () => {
    /*
     * `TN-MOVE-02`, both halves: "every mode declared by any document under
     * content/levels has a row in both languages", and "a row in this table for
     * a mode no level declares is reported, so the table cannot silently grow".
     *
     * The second half is why this is an equality and not a subset check. The
     * five modes `game.config.json` allows and no level uses have no label on
     * purpose: two of them belong to levels `docs/content-review.md` §1 blocks,
     * and a blocked level with its HUD copy already written reads as
     * schedulable.
     *
     * The keys are read from the level documents' own `labelKey`, not built from
     * the mode's id, because `labelKey` is what `app/bootstrap` looks up.
     */
    const declared = new Set<string>();
    for (const id of LEVEL_IDS) {
      const document = JSON.parse(
        readFileSync(new URL(`../../../content/levels/${id}.json`, import.meta.url), 'utf8'),
      ) as { locomotion?: { mode: string; labelKey: string }[] };
      for (const mode of document.locomotion ?? []) {
        expect(
          mode.labelKey,
          `${id} declares "${mode.mode}" under a key that is not this table's shape`,
        ).toBe(`locomotion.${mode.mode}.label`);
        declared.add(mode.labelKey);
      }
    }

    const written = KEYS.filter((key) => String(key).startsWith('locomotion.'));
    expect([...declared].sort(), 'a level moves in a way nothing has a word for').toEqual(
      written.map(String).sort(),
    );
    for (const key of written) {
      for (const locale of UI_LOCALES) {
        const value = text(locale, key);
        expect(value, `${String(key)} (${locale}) is empty`).not.toBe('');
        expect(value.split(' ').length, `${String(key)} (${locale}) is not one word`).toBe(1);
        expect(value.includes('.'), `${String(key)} (${locale}) is a sentence`).toBe(false);
      }
    }
    /* The four labels, literally, from `TN-MOVE-locomotion-labels.md`. */
    expect(text('en', 'locomotion.walk.label')).toBe('Walking');
    expect(text('fr', 'locomotion.walk.label')).toBe('Marche');
    expect(text('en', 'locomotion.toboggan.label')).toBe('Sledding');
    expect(text('fr', 'locomotion.toboggan.label')).toBe('Glissade');
    expect(text('en', 'locomotion.skate.label')).toBe('Skating');
    expect(text('fr', 'locomotion.skate.label')).toBe('Patinage');
    expect(text('en', 'locomotion.bike.label')).toBe('Biking');
    expect(text('fr', 'locomotion.bike.label')).toBe('Vélo');
  });

  it('never names a landmark or states a territorial fact on a waiting screen', () => {
    /*
     * `TN-WAIT-06`'s last scenario, and the boundary `TN-NAMES-01` draws: "no
     * name on this file's list appears on … a loading message", and a loading
     * screen may not state a territorial fact or paraphrase one — the sourced
     * "About this place" panel is where a player reads those
     * (`docs/content-review.md` §10.2). A forty-character paraphrase of a cited
     * statement about a nation is an unsourced claim about that nation.
     */
    const banned = [
      'pier 21',
      'cn tower',
      'château frontenac',
      'chateau frontenac',
      'rideau',
      'parliament',
      'parlement',
      "mi'kma",
      'mikma',
      'treaty',
      'traité',
      'territ',
      'first nation',
      'première nation',
      'métis',
      'inuit',
    ];
    for (const key of KEYS.filter((row) => String(row).endsWith('.loading'))) {
      for (const locale of UI_LOCALES) {
        const value = text(locale, key).toLowerCase();
        for (const word of banned) {
          expect(value.includes(word), `${String(key)} (${locale}) says "${word}"`).toBe(false);
        }
      }
    }
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
     * The one finding this rule ever had is fixed. `study.summary.score` in
     * French used to read « Vous avez 1 bonnes réponses sur 5 » when the player
     * got one right; `TN-STUDY` rewords it to « Bonnes réponses : 1 sur 5 », the
     * noun in front of the number and « sur » after it, which is rule 1's
     * recommended form and the same shape as `card.progress`. So the list below
     * is empty.
     *
     * It stays an equality rather than becoming `toEqual([])` with no name,
     * because `TN-COPY`'s scenario "a recorded offender is not an excused one"
     * asks for exactly this: the list fails when an offender is added *and* when
     * a recorded one is fixed without being struck off. An allowance nobody has
     * to remove is an allowance that outlives its reason.
     */
    const FUNCTION_WORDS = new Set([
      'of', 'out', 'on', 'in', 'for', 'and', 'or', 'to',
      'sur', 'de', 'des', 'du', 'et', 'ou', 'en', 'au',
    ]);
    const REPORTED_TO_THE_PO: string[] = [];

    /*
     * The rule is about a noun that follows **a number that changes**, so the
     * placeholder has to be a count for the word after it to be at risk.
     * `map.locked.after` — "Finish {{level}} first." — put a word after a
     * *place name*, which has no plural category and cannot make "first" agree
     * with anything. Widening the rule to every placeholder would have made
     * that a finding, and a rule with a false finding in it gets an exemption
     * list, which is what rule 1 exists to avoid.
     */
    const COUNTED = new Set(['n', 'seconds', 'total', 'correct', 'earned', 'ready']);
    const nounAfterACount = (value: string): string | null => {
      const match = /\{\{(\w+)\}\} ([a-zà-ÿ]+)/u.exec(value);
      if (match === null) return null;
      if (!COUNTED.has(match[1] ?? '')) return null;
      return FUNCTION_WORDS.has(match[2] ?? '') ? null : (match[2] ?? '');
    };

    /* The positive control, so the empty list below means "nothing was found"
       and never "nothing was looked at". */
    expect(nounAfterACount('{{n}} questions'), 'the rule stopped finding anything').toBe(
      'questions',
    );
    expect(nounAfterACount('{{n}} of {{total}}')).toBeNull();
    expect(nounAfterACount('Finish {{level}} first.')).toBeNull();

    const offenders: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of KEYS) {
        if (key.endsWith('.one') || key.endsWith('.other')) continue;
        const value = text(locale, key as Parameters<typeof text>[1]);
        if (nounAfterACount(value) === null) continue;
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
  /* Hyphens are part of a key: the map draws `level.quebec-city.title` and
     `level.prairie-rail.title`, and a pattern that stopped at the hyphen would
     drop those rows from every rule below without failing anything. */
  const keys = [...block.matchAll(/^\s{2}'([\w.-]+)':/gm)].map((match) => match[1] ?? '');
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

/**
 * Counted strings that arrive as data.
 *
 * The level select's "how many stamps open this place" has no table row yet, so
 * the caller supplies both forms. The *choice* between them still has to be
 * `Intl.PluralRules`, which is the whole point: English and French disagree at
 * zero, so a caller's `n === 1` would be wrong in one of the two official
 * languages every time the number is nought.
 */
describe('a counted string supplied as data', () => {
  const FORMS = { one: '{{n}} stamp', other: '{{n}} stamps' };

  it('picks the form Intl picks, not the one a comparison would', () => {
    expect(pluralise('en', FORMS, 1)).toBe('1 stamp');
    expect(pluralise('en', FORMS, 2)).toBe('2 stamps');
  });

  it('is plural at zero in English and singular at zero in French', () => {
    expect(pluralise('en', FORMS, 0)).toBe('0 stamps');
    expect(pluralise('fr', { one: '{{n}} timbre', other: '{{n}} timbres' }, 0)).toBe('0 timbre');
  });

  it('formats the number for the locale rather than concatenating it', () => {
    expect(pluralise('fr', { one: '{{n}} timbre', other: '{{n}} timbres' }, 1.5)).toBe(
      `${formatNumber('fr', 1.5)} timbre`,
    );
  });

  it('falls back to `other` visibly when a locale asks for a form nobody wrote', () => {
    /* `few` exists in other languages and in neither of ours; a screen that
       rendered nothing would be worse than one with the wrong ending. */
    expect(pluralise('en', { other: '{{n}} stamps' }, 1)).toBe('1 stamps');
  });

  it('fills extra placeholders like the table does', () => {
    expect(
      pluralise('en', { one: '{{n}} stamp for {{place}}', other: '{{n}} stamps for {{place}}' }, 2, {
        place: 'Halifax',
      }),
    ).toBe('2 stamps for Halifax');
  });
});
