import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';

import { createLevelSelect, levelCardState, type MapEntry } from '@ui/level-select';

import { buildPage, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-MAP-level-select.md`.
 *
 * Nine of the ten levels do not exist, so the assertions that matter are the
 * ones about the two ways a level can be closed. `TN-MAP-05` is a failure-path
 * story: a level nobody built must never be described as a level the player has
 * not earned, and neither may read as a defect.
 */

const id = (value: string): LevelId => value as LevelId;

/** The ten of `TN-LEVELS-2-to-10-spine.md`, with 2 and 10 deliberately unscoped. */
const SPINE: readonly (readonly [number, string | undefined])[] = [
  [1, 'halifax'],
  [2, undefined],
  [3, 'quebec-city'],
  [4, 'ottawa'],
  [5, 'toronto'],
  [6, 'winnipeg'],
  [7, 'prairie-rail'],
  [8, 'alberta-foothills'],
  [9, 'vancouver'],
  [10, undefined],
];

const entries = (built: readonly string[], unlocked: readonly string[]): readonly MapEntry[] =>
  SPINE.map(([number, levelId]) => ({
    number,
    ...(levelId === undefined ? {} : { id: id(levelId) }),
    built: levelId !== undefined && built.includes(levelId),
    unlocked: levelId !== undefined && unlocked.includes(levelId),
  }));

/** Ottawa open, Halifax built and not earned, the other eight not made yet. */
const DEFAULT_ENTRIES = entries(['ottawa', 'halifax'], ['ottawa']);

interface Fixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createLevelSelect>;
  readonly onChoose: ReturnType<typeof vi.fn>;
  readonly announce: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
}

function open(overrides: Partial<Parameters<typeof createLevelSelect>[1]> = {}): Fixture {
  const page = buildPage();
  const onChoose = vi.fn();
  const announce = vi.fn();
  const screen = createLevelSelect(page.host, {
    locale: 'en',
    entries: DEFAULT_ENTRIES,
    stampsToUnlock: 1,
    onChoose,
    announce,
    ...overrides,
  });
  return { page, screen, onChoose, announce, at: (testId) => page.doc.byTestId(testId) };
}

describe('which state a card is in', () => {
  const entry = (over: Partial<MapEntry> = {}): MapEntry => ({
    number: 1,
    id: id('halifax'),
    built: true,
    unlocked: true,
    ...over,
  });

  it('is open when the document exists and the rules opened it', () => {
    expect(levelCardState(entry())).toBe('open');
  });

  it('is locked when the document exists and has not been earned', () => {
    expect(levelCardState(entry({ unlocked: false }))).toBe('locked');
  });

  it('is not built when nobody has made it — over locked and over open alike', () => {
    expect(levelCardState(entry({ built: false, unlocked: false }))).toBe('not-built');
    /* `TN-MAP-05`: a player who earned enough stamps for a level nobody built
       has still not failed at anything. */
    expect(levelCardState(entry({ built: false, unlocked: true }))).toBe('not-built');
  });
});

describe('the level select', () => {
  it('says what it is and how much of the game exists', () => {
    const { at } = open();
    expect(at('level-select')?.querySelector('h1')?.textContent).toBe('Choose a level');
    expect(at('level-select-counts')?.textContent).toContain('Levels ready: 2 of 10');
    expect(at('level-select-counts')?.textContent).toContain('Stamps: 0 of 10');
    expect(at('level-select-counts')?.textContent).toContain('More are coming.');
  });

  it('lists ten cards, in the order the journey takes', () => {
    const { at } = open();
    const handles = at('level-select-list')
      ?.querySelectorAll('button')
      .map((button) => button.getAttribute('data-level-handle'));

    expect(handles).toEqual([
      'halifax',
      '2',
      'quebec-city',
      'ottawa',
      'toronto',
      'winnipeg',
      'prairie-rail',
      'alberta-foothills',
      'vancouver',
      '10',
    ]);
  });

  it('shows each card as a list item with its number, place and subject', () => {
    const { at } = open();
    expect(at('level-select-list')?.querySelectorAll('li').length).toBe(10);

    const ottawa = at('level-card-ottawa');
    expect(ottawa?.textContent).toContain('Level 4');
    expect(ottawa?.textContent).toContain('Ottawa');
    expect(ottawa?.textContent).toContain('How Canadians govern themselves');
  });

  it('draws no place name and no placeholder where the place is not decided', () => {
    const { at } = open();
    const levelTwo = at('level-card-2');

    expect(levelTwo?.textContent).toContain('Level 2');
    expect(levelTwo?.textContent).toContain('Who we are');
    for (const placeholder of ['TBD', '???', 'undefined', 'null', 'coming soon']) {
      expect(levelTwo?.textContent?.toLowerCase()).not.toContain(placeholder.toLowerCase());
    }
  });
});

describe('an open level', () => {
  it('says it is open, says how to take it, and takes it', () => {
    const { at, onChoose } = open();
    const ottawa = at('level-card-ottawa');

    expect(ottawa?.getAttribute('data-state')).toBe('open');
    expect(ottawa?.textContent).toContain('Open');
    expect(at('level-card-ottawa-help')?.textContent).toBe('You can play this now.');
    expect(ottawa?.getAttribute('aria-disabled')).toBeNull();

    ottawa?.click();
    expect(onChoose).toHaveBeenCalledWith(id('ottawa'));
  });
});

describe('a level that is locked and can be earned', () => {
  it('names the level to finish first when one stamp opens the next', () => {
    /* Halifax is level 1, so there is nothing before it; level 5 is the case
       `TN-MAP-03` describes. */
    const { at } = open({ entries: entries(['ottawa', 'toronto'], ['ottawa']) });

    expect(at('level-card-toronto')?.getAttribute('data-state')).toBe('locked');
    expect(at('level-card-toronto')?.textContent).toContain('Locked');
    expect(at('level-card-toronto-help')?.textContent).toBe('Finish Ottawa first.');
  });

  it('counts the stamps still needed when the caller knows the number', () => {
    const withCount = (needed: number): readonly MapEntry[] =>
      entries(['ottawa', 'toronto'], ['ottawa']).map((entry) =>
        entry.id === id('toronto') ? { ...entry, stampsNeeded: needed } : entry,
      );

    expect(open({ entries: withCount(1) }).at('level-card-toronto-help')?.textContent).toBe(
      'Earn 1 more stamp to open this.',
    );
    expect(open({ entries: withCount(2) }).at('level-card-toronto-help')?.textContent).toBe(
      'Earn 2 more stamps to open this.',
    );
  });

  it('counts through Intl.PluralRules: French is singular at zero, English plural', () => {
    const withCount = (needed: number): readonly MapEntry[] =>
      entries(['ottawa', 'toronto'], ['ottawa']).map((entry) =>
        entry.id === id('toronto') ? { ...entry, stampsNeeded: needed } : entry,
      );

    expect(open({ entries: withCount(0) }).at('level-card-toronto-help')?.textContent).toBe(
      'Earn 0 more stamps to open this.',
    );
    expect(
      open({ locale: 'fr', entries: withCount(0) }).at('level-card-toronto-help')?.textContent,
    ).toBe('Gagnez encore 0 tampon pour ouvrir ce niveau.');
  });

  it('explains instead of doing nothing, and does not emit a choice', () => {
    const { at, onChoose, announce } = open();

    at('level-card-halifax')?.click();
    expect(onChoose).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(
      at('level-card-halifax-help')?.textContent ?? 'no help was drawn',
    );
  });

  it('stays in the tab order, named and described', () => {
    const { at } = open();
    const halifax = at('level-card-halifax');

    expect(halifax?.getAttribute('aria-disabled')).toBe('true');
    expect(halifax?.hasAttribute('disabled')).toBe(false);
    expect(halifax?.getAttribute('aria-describedby')).toBe('tn-level-card-halifax-help');
  });
});

describe('a level that is not built yet', () => {
  it('says the game is still being made, not that the player is missing something', () => {
    const { at } = open();
    const vancouver = at('level-card-vancouver');

    expect(vancouver?.getAttribute('data-state')).toBe('not-built');
    expect(vancouver?.textContent).toContain('Not made yet');
    expect(vancouver?.textContent).not.toContain('Locked');
    expect(at('level-card-vancouver-help')?.textContent).toBe(
      'We are still making this level.',
    );
  });

  it('is not drawn as an error, and asks the player for nothing', () => {
    const { at } = open();
    const card = `${at('level-card-vancouver')?.textContent ?? ''} ${
      at('level-card-vancouver-help')?.textContent ?? ''
    }`.toLowerCase();

    for (const word of ['error', 'failed', 'missing', 'unavailable', 'not found', 'stamp']) {
      expect(card, `a not-built card says "${word}"`).not.toContain(word);
    }
  });

  it('never asks for a stamp the player has already earned', () => {
    /* `TN-MAP-05`: unlocked by the rules, and still nobody has built it. */
    const { at, onChoose } = open({
      entries: entries(['ottawa'], ['ottawa', 'winnipeg']),
    });

    expect(at('level-card-winnipeg')?.getAttribute('data-state')).toBe('not-built');
    expect(at('level-card-winnipeg')?.textContent).not.toContain('Open');
    at('level-card-winnipeg')?.click();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('tells the two closed states apart by the word and by the sentence', () => {
    const { at } = open();

    const lockedWord = at('level-card-halifax')?.textContent ?? '';
    const notBuiltWord = at('level-card-vancouver')?.textContent ?? '';
    expect(lockedWord).toContain('Locked');
    expect(notBuiltWord).toContain('Not made yet');
    expect(at('level-card-halifax-help')?.textContent).not.toBe(
      at('level-card-vancouver-help')?.textContent,
    );
  });

  it('is the normal state of a build with one level', () => {
    const { at } = open({ entries: entries(['ottawa'], ['ottawa']) });

    const notBuilt = at('level-select-list')
      ?.querySelectorAll('[data-state="not-built"]')
      .length;
    expect(notBuilt).toBe(9);
    expect(at('level-select-counts')?.textContent).toContain('Levels ready: 1 of 10');
  });

  it('shows ten cards even when the game contains no level at all', () => {
    const { at } = open({ entries: entries([], []) });

    expect(at('level-select-list')?.querySelectorAll('li').length).toBe(10);
    expect(at('level-select-counts')?.textContent).toContain('Levels ready: 0 of 10');
    expect(at('level-select')?.textContent?.toLowerCase()).not.toContain('error');
  });
});

describe('leaving, focusing and speaking French', () => {
  it('offers Back only when there is somewhere to go back to', () => {
    const onBack = vi.fn();
    const withBack = open({ onBack });
    expect(withBack.at('level-select-back')?.textContent).toBe('Back');
    withBack.at('level-select-back')?.click();
    expect(onBack).toHaveBeenCalledTimes(1);

    expect(open().at('level-select-back')).toBeNull();
  });

  it('opens with the one open card focused, so choosing it is the next thing', () => {
    const { screen, page, at } = open();
    screen.focus();
    expect(page.doc.activeElement).toBe(at('level-card-ottawa'));
  });

  it('falls back to the heading when nothing is open', () => {
    const { screen, page, at } = open({ entries: entries([], []) });
    screen.focus();
    expect(page.doc.activeElement).toBe(at('level-select')?.querySelector('h1'));
  });

  it('focuses the card the player came back from, and says when it cannot', () => {
    const { screen, page, at } = open();
    expect(screen.focusLevel(id('vancouver'))).toBe(true);
    expect(page.doc.activeElement).toBe(at('level-card-vancouver'));
    expect(screen.focusLevel(id('nowhere'))).toBe(false);
  });

  it('redraws states when progress changes, without being rebuilt', () => {
    const { at, screen, onChoose } = open();
    screen.setEntries(entries(['ottawa', 'halifax'], ['ottawa', 'halifax']));

    expect(at('level-card-halifax')?.getAttribute('data-state')).toBe('open');
    at('level-card-halifax')?.click();
    expect(onChoose).toHaveBeenCalledWith(id('halifax'));
  });

  it('is French end to end, with a space before every colon', () => {
    const { at, screen } = open({ onBack: () => undefined });
    screen.setLocale('fr');

    expect(at('level-select')?.querySelector('h1')?.textContent).toBe('Choisir un niveau');
    expect(at('level-select-back')?.textContent).toBe('Retour');
    expect(at('level-select-counts')?.textContent).toContain('Niveaux prêts : 2 sur 10');
    expect(at('level-select-counts')?.textContent).toContain('Tampons : 0 sur 10');
    expect(at('level-select-counts')?.textContent).toContain("D'autres arrivent.");
    expect(at('level-card-halifax')?.textContent).toContain('Verrouillé');
    expect(at('level-card-vancouver')?.textContent).toContain('Pas encore créé');
    expect(at('level-card-vancouver-help')?.textContent).toBe(
      'Ce niveau est encore en préparation.',
    );
    /* The place name is what each language calls the place. */
    expect(at('level-card-quebec-city')?.textContent).toContain('Ville de Québec');

    const text = at('level-select')?.textContent ?? '';
    for (const english of ['Open', 'Locked', 'Not made yet', 'Back']) {
      expect(text, `English survived in French: ${english}`).not.toContain(english);
    }
  });

  it('announces the screen and how many levels are ready, in one message', () => {
    const { screen } = open();
    expect(screen.arrivalMessage).toContain('Choose a level');
    expect(screen.arrivalMessage).toContain('Levels ready: 2 of 10');
  });

  it('counts the stamps the player has earned', () => {
    const { at } = open({
      entries: DEFAULT_ENTRIES.map((entry) =>
        entry.id === id('ottawa') ? { ...entry, stamped: true } : entry,
      ),
    });
    expect(at('level-select-counts')?.textContent).toContain('Stamps: 1 of 10');
  });

  it('leaves nothing behind when it is destroyed', () => {
    const { at, screen } = open();
    screen.destroy();
    expect(at('level-select')).toBeNull();
  });

  /**
   * The stamp, on the card.
   *
   * `MapEntry.stamped` has been on this type since the map was written and was
   * only ever *counted*: a player who finished a level came back to a card that
   * looked exactly like one they had never opened. It is drawn now, as the same
   * word the passport uses, beside the state word rather than instead of it —
   * "Open" says whether the level can be played and "Earned" says whether its
   * stamp has been won, and a card is routinely both.
   */
  describe('a level whose stamp is in the passport', () => {
    it('says so, in words, beside its state', () => {
      const { at } = open({
        entries: [{ number: 1, id: id('halifax'), built: true, unlocked: true, stamped: true }],
      });

      expect(at('level-card-halifax-stamp')?.textContent).toBe('Earned');
      expect(at('level-card-halifax')?.textContent).toContain('Open');
      expect(at('level-card-halifax')?.getAttribute('data-stamped')).toBe('true');
    });

    it('draws no badge for a level that has not been finished', () => {
      const { at } = open({
        entries: [{ number: 1, id: id('halifax'), built: true, unlocked: true }],
      });

      expect(at('level-card-halifax-stamp')).toBeNull();
      expect(at('level-card-halifax')?.getAttribute('data-stamped')).toBe('false');
    });

    it('is French', () => {
      const { at } = open({
        locale: 'fr',
        entries: [{ number: 1, id: id('halifax'), built: true, unlocked: true, stamped: true }],
      });
      expect(at('level-card-halifax-stamp')?.textContent).toBe('Obtenu');
    });
  });

  /**
   * `TN-MAP-03`: "it is announced as open when I reach it."
   *
   * A player arriving on the map straight from finishing a level is put on the
   * card that just opened, so the announcement has to be about *that card* and
   * not about the screen. Composed from rows the card already draws.
   */
  describe('describing one card, for the player who was just sent to it', () => {
    it('names the place, its state and the sentence under it', () => {
      const { screen: select } = open({
        entries: [{ number: 1, id: id('halifax'), built: true, unlocked: true }],
      });

      expect(select.describe(id('halifax'))).toBe(
        'Halifax. Open. You can play this now.',
      );
    });

    it('says why a locked card is locked, rather than only that it is', () => {
      const { screen: select } = open({
        entries: [
          { number: 1, id: id('halifax'), built: true, unlocked: true },
          { number: 3, id: id('quebec-city'), built: true, unlocked: false, stampsNeeded: 1 },
        ],
      });

      expect(select.describe(id('quebec-city'))).toBe(
        'Québec City. Locked. Earn 1 more stamp to open this.',
      );
    });

    it('answers null for a card this build does not have', () => {
      const { screen: select } = open({
        entries: [{ number: 1, id: id('halifax'), built: true, unlocked: true }],
      });
      expect(select.describe(id('nowhere'))).toBeNull();
    });

    it('is French', () => {
      const { screen: select } = open({
        locale: 'fr',
        entries: [{ number: 1, id: id('halifax'), built: true, unlocked: true }],
      });
      expect(select.describe(id('halifax'))).toBe(
        'Halifax. Ouvert. Vous pouvez y jouer maintenant.',
      );
    });
  });
});
