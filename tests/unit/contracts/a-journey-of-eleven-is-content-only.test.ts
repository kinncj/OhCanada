import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import gameConfigDocument from '@content/game.config.json';
/* Relative, not aliased: there is no `@bootstrap` alias (see
   unlock-chain-is-reachable.test.ts). */
import { readGameRules } from '../../../app/bootstrap/game-rules';
import { journeyEntries, journeyPlaces } from '../../../app/bootstrap/journey';
import type { LevelId } from '@domain/ids';
import type { UiLocale } from '@ui/copy';
import { createExamResult, type ExamResultView } from '@ui/exam-result';
import { createExamStartScreen } from '@ui/exam-start';
import { createLevelSelect, type MapEntry } from '@ui/level-select';
import { createPassport } from '@ui/passport';

import { buildPage } from '../ui/support/fake-dom';
import { placeNumber } from '../../support/journey-count';

/**
 * The fixture-of-eleven test (`docs/plan/kingston.md` K-0.3).
 *
 * Adding a place to the journey must be a change to `content/game.config.json`
 * and nothing else. Until K-0.3 every screen already counted the entries it was
 * handed, but the suites around them wrote "10", "ten" and "of 10" down, so an
 * eleventh place in `journey` — a content commit — would have turned tests red
 * that content does not own. That is the hidden two-owner commit K-0.3 removes.
 *
 * What this file proves: the shipped config, and the same config with one more
 * place, go through the same path the game takes — `readGameRules`, then
 * `journeyEntries`, then the map, the passport and both exam screens — and
 * every count on those screens is the config's, in English and in French. The
 * extra place is a **fixture id** (`eleventh-place`), inserted after Ottawa
 * where K-2.2 will put a real one. It is not Kingston and names nothing: this
 * test changes no journey content.
 */

const FIXTURE_PLACE = 'eleventh-place';

type ConfigDocument = typeof gameConfigDocument;

/** The shipped config with one more place in `journey` and in the unlock order. */
function withOneMorePlace(config: ConfigDocument): ConfigDocument {
  const insertAfter = (list: readonly string[], after: string): string[] => {
    const at = list.indexOf(after);
    if (at < 0) throw new Error(`content/game.config.json has no "${after}" to insert after.`);
    return [...list.slice(0, at + 1), FIXTURE_PLACE, ...list.slice(at + 1)];
  };
  return {
    ...config,
    journey: insertAfter(config.journey, 'ottawa'),
    unlockRules: {
      ...config.unlockRules,
      order: insertAfter(config.unlockRules.order, 'ottawa'),
    },
  };
}

const LEVELS_DIR = fileURLToPath(new URL('../../../content/levels', import.meta.url));
const BUILT = new Set(
  readdirSync(LEVELS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length)),
);

interface Journey {
  readonly label: string;
  readonly journey: readonly (string | null)[];
  readonly entries: readonly MapEntry[];
}

function journeyOf(label: string, document: ConfigDocument): Journey {
  const parsed = readGameRules(document);
  if (!parsed.ok) throw new Error(`${label} did not parse: ${parsed.error.message}`);
  const entries = journeyEntries({
    rules: parsed.value.unlockRules,
    journey: parsed.value.journey,
    stamped: [],
    unlocked: [],
    isBuilt: (id: LevelId) => BUILT.has(`${id}`),
  });
  return { label, journey: parsed.value.journey.map((slot) => (slot === null ? null : `${slot}`)), entries };
}

const SHIPPED = journeyOf('content/game.config.json', gameConfigDocument);
const ELEVEN_FROM_TEN = journeyOf('the eleven-place fixture', withOneMorePlace(gameConfigDocument));

const WORDS = {
  en: { stamps: 'Stamps', ready: 'Levels ready', of: 'of', level: 'Level', subjects: 'Subjects ready' },
  fr: { stamps: 'Tampons :', ready: 'Niveaux prêts :', of: 'sur', level: 'Niveau', subjects: 'Sujets prêts :' },
} as const satisfies Record<UiLocale, Record<string, string>>;

const stampsLine = (locale: UiLocale, earned: number, total: number): string =>
  `${WORDS[locale].stamps}${locale === 'en' ? ':' : ''} ${String(earned)} ${WORDS[locale].of} ${String(total)}`;
const readyLine = (locale: UiLocale, ready: number, total: number): string =>
  `${WORDS[locale].ready}${locale === 'en' ? ':' : ''} ${String(ready)} ${WORDS[locale].of} ${String(total)}`;
const subjectsLine = (locale: UiLocale, ready: number, total: number): string =>
  `${WORDS[locale].subjects}${locale === 'en' ? ':' : ''} ${String(ready)} ${WORDS[locale].of} ${String(total)}`;

describe('the fixture is what it claims to be', () => {
  it('has exactly one place more than the shipped journey, and it is not built', () => {
    expect(ELEVEN_FROM_TEN.journey).toHaveLength(SHIPPED.journey.length + 1);
    expect(BUILT.has(FIXTURE_PLACE)).toBe(false);
    /* Eleven today. When the shipped journey grows, so does the fixture, and
       the assertions below still hold, because none of them is a literal. */
    expect(journeyPlaces(ELEVEN_FROM_TEN.journey)).toBe(ELEVEN_FROM_TEN.journey.length);
  });
});

describe.each([SHIPPED, ELEVEN_FROM_TEN])('a journey read from $label', (fixture) => {
  const total = journeyPlaces(fixture.journey);
  const built = fixture.entries.filter((entry) => entry.built).length;

  it('numbers one entry per place, 1 to the journey’s length, in config order', () => {
    expect(fixture.entries).toHaveLength(total);
    expect(fixture.entries.map((entry) => entry.number)).toEqual(
      Array.from({ length: total }, (_unused, index) => index + 1),
    );
    expect(fixture.entries.map((entry) => entry.id ?? null)).toEqual(fixture.journey);
  });

  it.each(['en', 'fr'] as const)('draws every place on the map, and counts them all (%s)', (locale) => {
    const page = buildPage();
    createLevelSelect(page.host, {
      locale,
      entries: fixture.entries,
      stampsToUnlock: 1,
      onChoose: () => undefined,
      announce: () => undefined,
    });
    const list = page.doc.byTestId('level-select-list');
    expect(list?.querySelectorAll('li')).toHaveLength(total);
    expect(list?.querySelectorAll('button')).toHaveLength(total);

    const counts = page.doc.byTestId('level-select-counts')?.textContent ?? '';
    expect(counts).toContain(stampsLine(locale, 0, total));
    if (built < total) expect(counts).toContain(readyLine(locale, built, total));

    /* The last place carries the last number, whatever the length. */
    const north = page.doc.byTestId('level-card-the-north')?.textContent ?? '';
    expect(north).toContain(`${WORDS[locale].level} ${String(placeNumber('the-north', fixture.journey))}`);
    for (const placeholder of ['undefined', 'null', 'NaN']) expect(counts).not.toContain(placeholder);
  });

  it.each(['en', 'fr'] as const)('draws every place in the passport, and counts them all (%s)', (locale) => {
    const page = buildPage();
    const passport = createPassport(page.host, {
      locale,
      entries: fixture.entries,
      announce: () => undefined,
      onBack: () => undefined,
    });
    passport.show();
    expect(page.doc.byTestId('passport-slots')?.children).toHaveLength(total);
    const counts = page.doc.byTestId('passport-counts')?.textContent ?? '';
    expect(counts).toContain(stampsLine(locale, 0, total));
    if (built < total) expect(counts).toContain(readyLine(locale, built, total));
  });

  it.each(['en', 'fr'] as const)('counts one exam subject per place (%s)', (locale) => {
    /* `app/bootstrap/main.ts` hands the exam `subjectsTotal: rules.journey.length`. */
    const subjects = { ready: 1, total: fixture.journey.length };

    const start = buildPage();
    createExamStartScreen(start.host, { locale }).show({
      kind: 'ready',
      questionCount: 20,
      passMark: 15,
      timeLimitMs: 1_800_000,
      subjects,
    });
    expect(start.ui.querySelector('[data-testid="exam-subjects"]')?.textContent).toBe(
      subjectsLine(locale, subjects.ready, subjects.total),
    );

    const result = buildPage();
    const view: ExamResultView = {
      correct: 15,
      total: 20,
      passMark: 15,
      passed: true,
      timed: false,
      timeUp: false,
      unanswered: 0,
      subjects: [],
      review: [],
      subjectsReady: subjects,
    };
    createExamResult(result.host, { locale, onClose: () => undefined }).show(view);
    expect(
      result.ui.querySelector('[data-testid="exam-result-subjects-ready"]')?.textContent,
    ).toBe(subjectsLine(locale, subjects.ready, subjects.total));
  });
});
