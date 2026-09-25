import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';

import {
  createLevelSelect,
  describeEntry,
  levelCardState,
  levelTitle,
  type MapEntry,
} from '@ui/level-select';

import { buildPage, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-MAP-level-select.md`.
 *
 * All ten levels exist now, so the fixture names all ten. The assertions that
 * matter are still the ones about the two ways a card can be closed: `TN-MAP-05`
 * is a failure-path story, and a level nobody built must never be described as a
 * level the player has not earned, nor read as a defect.
 *
 * The id-less entry that used to be levels 2 and 10 is kept — once, in
 * {@link MAP} — because the guard that answers `null` rather than drawing a
 * number is still live code. ADR-0024: an empty collection must not reduce to a
 * pass, and a guard whose only input has been deleted is that same vacuity
 * wearing a green tick.
 */

const id = (value: string): LevelId => value as LevelId;

/** The spine of `TN-LEVELS-2-to-10-spine.md`, all of them named. */
const SPINE: readonly (readonly [number, string])[] = [
  [1, 'halifax'],
  [2, 'peggys-cove'],
  [3, 'quebec-city'],
  [4, 'ottawa'],
  [5, 'toronto'],
  [6, 'winnipeg'],
  [7, 'prairie-rail'],
  [8, 'alberta-foothills'],
  [9, 'vancouver'],
  [10, 'the-north'],
];

/**
 * How many cards the fixture journey has. Asserted through this, never as a
 * literal, so no count here assumes the game has ten places (K-0.3).
 */
const TOTAL = SPINE.length;

const entries = (built: readonly string[], unlocked: readonly string[]): readonly MapEntry[] =>
  SPINE.map(([number, levelId]) => ({
    number,
    id: id(levelId),
    built: built.includes(levelId),
    unlocked: unlocked.includes(levelId),
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
    expect(at('level-select-counts')?.textContent).toContain(`Levels ready: 2 of ${String(TOTAL)}`);
    expect(at('level-select-counts')?.textContent).toContain(`Stamps: 0 of ${String(TOTAL)}`);
    expect(at('level-select-counts')?.textContent).toContain('More are coming.');
  });

  it('draws each count on its own line, so a screen reader pauses between them', () => {
    /* The three rows are labels with no closing punctuation. Joined with a
       space they read as one run-on sentence: "Levels ready: 2 of 10 Stamps:
       0 of 10 More are coming." */
    const { at } = open();
    const lines = (at('level-select-counts')?.children ?? []).map((line) => line.textContent);
    expect(lines).toEqual([`Levels ready: 2 of ${String(TOTAL)}`, `Stamps: 0 of ${String(TOTAL)}`, 'More are coming.']);
  });

  it('says nothing about readiness once every level is made', () => {
    /* ADR-0039: "Levels ready: 10 of 10" is a build report, not something a
       player can act on — the rule `map.moreComing` already followed. */
    const all: readonly MapEntry[] = [
      'halifax',
      'peggys-cove',
      'quebec-city',
      'ottawa',
      'toronto',
      'winnipeg',
      'prairie-rail',
      'alberta-foothills',
      'vancouver',
      'the-north',
    ].map((levelId, index) => ({
      number: index + 1,
      id: id(levelId),
      built: true,
      unlocked: index === 0,
    }));
    const { at, screen } = open({ entries: all });
    const lines = (at('level-select-counts')?.children ?? []).map((line) => line.textContent);
    expect(lines).toEqual([`Stamps: 0 of ${String(TOTAL)}`]);
    expect(screen.arrivalMessage).toBe('Choose a level.');
  });

  it('lists one card per place, in the order the journey takes', () => {
    const { at } = open();
    const handles = at('level-select-list')
      ?.querySelectorAll('button')
      .map((button) => button.getAttribute('data-level-handle'));

    expect(handles).toEqual(SPINE.map(([, handle]) => handle));
  });

  it('shows each card as a list item with its number, place and subject', () => {
    const { at } = open();
    expect(at('level-select-list')?.querySelectorAll('li').length).toBe(TOTAL);

    const ottawa = at('level-card-ottawa');
    expect(ottawa?.textContent).toContain('Level 4');
    expect(ottawa?.textContent).toContain('Ottawa');
    expect(ottawa?.textContent).toContain('How Canadians govern themselves');
  });

  it('names the two levels that were slots until they were built', () => {
    const { at } = open();

    const two = at('level-card-peggys-cove');
    expect(two?.textContent).toContain('Level 2');
    expect(two?.textContent).toContain("Peggy's Cove");
    expect(two?.textContent).toContain('Who we are');

    const last = at('level-card-the-north');
    expect(last?.textContent).toContain(`Level ${String(TOTAL)}`);
    expect(last?.textContent).toContain('The North');
    expect(last?.textContent).toContain("Canada's regions");
  });

  it('draws no placeholder where a place is not decided', () => {
    /* No entry in the shipped map is in this state any more, so the guard is
       handed one on purpose. The alternative to checking is the word
       "undefined" on a card, and `TN-MAP-04` forbids a placeholder in that
       space at all — including the level's number standing in for its name. */
    const { at } = open({
      entries: [{ number: 11, built: false, unlocked: false }],
    });
    const unbuilt = at('level-card-11');

    expect(unbuilt?.textContent).toContain('Level 11');
    for (const placeholder of ['TBD', '???', 'undefined', 'null', 'coming soon']) {
      expect(unbuilt?.textContent?.toLowerCase()).not.toContain(placeholder.toLowerCase());
    }
  });
});

/**
 * The journey, drawn.
 *
 * Ten identical rows in a column is a menu; this game's ten levels are one
 * route across a country in a fixed order, and that was invisible on the screen
 * that calls itself a map. `app/ui/journey.ts` draws the route; what is asserted
 * here is the promise that lets it be hidden from a screen reader — **every mark
 * on it is a redrawing of a word the card beside it already prints.** The day
 * that stops being true, a screen-reader user is missing something a sighted
 * player has, and these are the tests that should fail.
 */
describe('the cards are stops on one route', () => {
  const railOf = (card: FakeElement | null): FakeElement | null =>
    card?.parentElement?.parentElement?.querySelector('.tn-journey') ?? null;

  it('draws a length of route beside every card, hidden from assistive technology', () => {
    const { at } = open();
    const rails = at('level-select-list')?.querySelectorAll('.tn-journey') ?? [];
    expect(rails).toHaveLength(TOTAL);
    for (const rail of rails) expect(rail.getAttribute('aria-hidden')).toBe('true');
  });

  it('adds nothing to the order a keyboard walks or a screen reader reads', () => {
    /* `TN-MAP-07`: focus reaches all ten cards and nothing else stands between
       them. A decorative rail that could be focused would be ten new stops in
       the journey that are not places. */
    const { at } = open();
    const list = at('level-select-list');
    expect(list?.querySelectorAll('li')).toHaveLength(TOTAL);
    expect(list?.querySelectorAll('button')).toHaveLength(TOTAL);
    expect(list?.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('says nothing the card beside it does not already say in words', () => {
    const { at } = open({
      entries: DEFAULT_ENTRIES.map((entry) =>
        entry.id === id('ottawa') ? { ...entry, stamped: true } : entry,
      ),
    });

    for (const [, levelId] of SPINE) {
      const card = at(`level-card-${levelId}`);
      const rail = railOf(card);
      /* The shape on the rail and the word on the card are one decision. */
      expect(rail?.getAttribute('data-journey-state')).toBe(card?.getAttribute('data-state'));
      /* "Reached" is the "Earned" badge, and nothing else. */
      expect(rail?.getAttribute('data-journey-reached')).toBe(
        card?.getAttribute('data-stamped'),
      );
    }
  });

  it('ends the road at both ends of the journey and joins the eight between', () => {
    const { at } = open();
    const rails = at('level-select-list')?.querySelectorAll('.tn-journey') ?? [];
    expect(rails[0]?.getAttribute('data-journey-before')).toBe('none');
    expect(rails[9]?.getAttribute('data-journey-after')).toBe('none');
    expect(rails.filter((rail) => rail.getAttribute('data-journey-before') === 'none'))
      .toHaveLength(1);
  });

  it('draws the legs the player has walked solid and the rest ahead', () => {
    const { at } = open({
      entries: entries(['halifax', 'peggys-cove', 'ottawa'], ['halifax', 'peggys-cove']).map(
        (entry) => (entry.id === id('halifax') ? { ...entry, stamped: true } : entry),
      ),
    });
    const rails = at('level-select-list')?.querySelectorAll('.tn-journey') ?? [];
    expect(rails[0]?.getAttribute('data-journey-after')).toBe('travelled');
    expect(rails[1]?.getAttribute('data-journey-before')).toBe('travelled');
    expect(rails[1]?.getAttribute('data-journey-after')).toBe('ahead');
  });

  it('marks the one place the route has reached, and only one', () => {
    const { at } = open();
    const current =
      at('level-select-list')?.querySelectorAll('[data-journey-current="true"]') ?? [];
    expect(current).toHaveLength(1);
    /* Ottawa is the only card reading "Open" without "Earned", which is the
       rule stated in words rather than a fourth state invented for the rail. */
    expect(railOf(at('level-card-ottawa'))?.getAttribute('data-journey-current')).toBe('true');
  });

  it('marks nothing where there is nothing open and nothing earned', () => {
    const { at } = open({ entries: entries([], []) });
    expect(
      at('level-select-list')?.querySelectorAll('[data-journey-current="true"]'),
    ).toHaveLength(0);
  });

  it('redraws the route when progress changes, without being rebuilt', () => {
    const { at, screen } = open();
    expect(railOf(at('level-card-halifax'))?.getAttribute('data-journey-after')).toBe('ahead');

    screen.setEntries(
      entries(['ottawa', 'halifax'], ['ottawa', 'halifax']).map((entry) =>
        entry.id === id('halifax') ? { ...entry, stamped: true } : entry,
      ),
    );

    expect(railOf(at('level-card-halifax'))?.getAttribute('data-journey-after')).toBe(
      'travelled',
    );
    expect(railOf(at('level-card-halifax'))?.getAttribute('data-journey-reached')).toBe('true');
  });
});

/**
 * The map of Canada above the route.
 *
 * `OQ-MAP-2`: a drawn map "is a decoration behind the same list, never the only
 * way to choose". So it is asserted the way the rail is: it is hidden from
 * assistive technology, it adds nothing to the order a keyboard or a switch
 * walks, it carries no words in either language, and **every pin on it is the
 * rail's pin for the same card, in the same tokens**. Where a pin sits on the
 * drawing is `tests/unit/ui/level-map.test.ts` and `tests/a11y/shell.spec.ts`.
 */
describe('the map above the route', () => {
  const railCurrentHandle = (list: FakeElement | null): string | null =>
    list
      ?.querySelectorAll('li')
      .find((item) => item.querySelector('.tn-journey')?.getAttribute('data-journey-current') === 'true')
      ?.querySelector('button')
      ?.getAttribute('data-level-handle') ?? null;

  const mapCurrentHandles = (map: FakeElement | null): readonly (string | null)[] =>
    (map?.querySelectorAll('[data-journey-current="true"]') ?? []).map((pin) =>
      pin.getAttribute('data-map-handle'),
    );

  it('sits under the counts and over the list, so it takes no width from a card', () => {
    const { at } = open();
    const order = (at('level-select')?.children ?? []).map(
      (child) => child.getAttribute('data-testid') ?? child.tagName.toLowerCase(),
    );
    expect(order.indexOf('level-select-map')).toBe(order.indexOf('level-select-counts') + 1);
    expect(order.indexOf('level-select-list')).toBe(order.indexOf('level-select-map') + 1);
  });

  it('is hidden from assistive technology and adds nothing to a keyboard or switch walk', () => {
    const { at } = open({ onBack: () => undefined });
    const map = at('level-select-map');

    expect(map?.getAttribute('aria-hidden')).toBe('true');
    expect(map?.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);
    /* The ten cards and Back are still every control on the screen. */
    expect(at('level-select')?.querySelectorAll('button')).toHaveLength(11);
    expect(at('level-select-list')?.querySelectorAll('li')).toHaveLength(TOTAL);
  });

  it('carries no words, in either language, and no text at all', () => {
    /* No place name baked into the page, no caption, and no sentence about
       which way the journey runs (`OQ-MAP-3`). The numerals are data the
       stylesheet draws, not text (TN-MAP), so a reader hears the map as
       nothing and the cards say "Level N" instead. */
    const { at, screen } = open();
    const numerals = SPINE.map(([number]) => String(number)).join('');
    const drawn = (): string =>
      [...(at('level-select-map')?.querySelectorAll('.tn-journey__pin') ?? [])]
        .map((pin) => pin.getAttribute('data-map-number') ?? '')
        .join('');

    expect(at('level-select-map')?.textContent).toBe('');
    expect(drawn()).toBe(numerals);
    screen.setLocale('fr');
    expect(at('level-select-map')?.textContent).toBe('');
    expect(drawn()).toBe(numerals);
  });

  it('numbers each pin with the number on its card, so a dot can be matched to a place by sight', () => {
    const { at } = open();
    const pins = at('level-select-map')?.querySelectorAll('.tn-map__stop') ?? [];
    expect(pins).toHaveLength(TOTAL);
    for (const pin of pins) {
      const handle = pin.getAttribute('data-map-handle') ?? '?';
      const numeral = pin.querySelector('.tn-journey__pin')?.getAttribute('data-map-number') ?? '';
      expect(numeral, handle).toMatch(/^\d+$/u);
      const cardNumber = at(`level-card-${handle}`)?.querySelector('.tn-levels__number')?.textContent;
      expect(cardNumber, handle).toBe(`Level ${numeral}`);
    }
  });

  it('says nothing the card for that place does not already say', () => {
    const { at } = open({
      entries: DEFAULT_ENTRIES.map((entry) =>
        entry.id === id('ottawa') ? { ...entry, stamped: true } : entry,
      ),
    });

    const pins = at('level-select-map')?.querySelectorAll('.tn-map__stop') ?? [];
    expect(pins).toHaveLength(TOTAL);
    for (const pin of pins) {
      const handle = pin.getAttribute('data-map-handle') ?? '?';
      const card = at(`level-card-${handle}`);
      expect(pin.getAttribute('data-journey-state'), handle).toBe(card?.getAttribute('data-state'));
      expect(pin.getAttribute('data-journey-reached'), handle).toBe(
        card?.getAttribute('data-stamped'),
      );
    }
  });

  it('marks the stop the route has got to, and only that one', () => {
    const { at } = open();
    expect(mapCurrentHandles(at('level-select-map'))).toEqual([
      railCurrentHandle(at('level-select-list')),
    ]);
    expect(mapCurrentHandles(at('level-select-map'))).toEqual(['ottawa']);
  });

  it('marks nothing where the route marks nothing', () => {
    const { at } = open({ entries: entries([], []) });
    expect(railCurrentHandle(at('level-select-list'))).toBeNull();
    expect(mapCurrentHandles(at('level-select-map'))).toEqual([]);
  });

  it('draws no pin for a card that has no place', () => {
    const { at } = open({ entries: [{ number: 11, built: false, unlocked: false }] });
    expect(at('level-select-map')?.querySelectorAll('.tn-map__stop')).toHaveLength(0);
  });

  it('moves its mark when progress changes, without fetching the drawing again', () => {
    const { at, screen } = open();
    const art = at('level-select-map')?.querySelector('img');

    screen.setEntries(entries(['ottawa', 'halifax'], ['ottawa', 'halifax']));

    expect(mapCurrentHandles(at('level-select-map'))).toEqual(['halifax']);
    expect(railCurrentHandle(at('level-select-list'))).toBe('halifax');
    expect(at('level-select-map')?.querySelector('img')).toBe(art);
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

  it('names the level to finish first without a capital article, in both languages', () => {
    /* ADR-0039: the template drew "Finish The Prairies first." and « Terminez
       d'abord Les Prairies. ». The sentence is the level's own row now. */
    const pair: readonly MapEntry[] = [
      { number: 7, id: id('prairie-rail'), built: true, unlocked: true },
      { number: 8, id: id('alberta-foothills'), built: true, unlocked: false },
      { number: 9, id: id('vancouver'), built: true, unlocked: false },
    ];
    const english = open({ entries: pair });
    expect(english.at('level-card-alberta-foothills-help')?.textContent).toBe(
      'Finish the Prairies first.',
    );
    expect(english.at('level-card-vancouver-help')?.textContent).toBe(
      'Finish the Alberta foothills first.',
    );

    const french = open({ entries: pair, locale: 'fr' });
    expect(french.at('level-card-alberta-foothills-help')?.textContent).toBe(
      "Terminez d'abord les Prairies.",
    );
    expect(french.at('level-card-vancouver-help')?.textContent).toBe(
      "Terminez d'abord les contreforts de l'Alberta.",
    );
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
    expect(notBuilt).toBe(TOTAL - 1);
    expect(at('level-select-counts')?.textContent).toContain(`Levels ready: 1 of ${String(TOTAL)}`);
  });

  it('shows every card even when the game contains no level at all', () => {
    const { at } = open({ entries: entries([], []) });

    expect(at('level-select-list')?.querySelectorAll('li').length).toBe(TOTAL);
    expect(at('level-select-counts')?.textContent).toContain(`Levels ready: 0 of ${String(TOTAL)}`);
    expect(at('level-select')?.textContent?.toLowerCase()).not.toContain('error');
  });
});

describe('leaving, focusing and speaking French', () => {
  it('offers the passport where the stamp count already is', () => {
    /*
     * `TN-PASSPORT-01`, and `OQ-PASSPORT-3`'s recommendation: the map is the
     * passport's home because the count — "Stamps: 1 of 10" — is already drawn
     * on this screen, and a fact a player wants to open should have the control
     * beside it. The title screen deliberately does not offer one.
     */
    const onOpenPassport = vi.fn();
    const withPassport = open({ onOpenPassport });
    expect(withPassport.at('passport-open')?.textContent).toBe('See my passport');
    withPassport.at('passport-open')?.click();
    expect(onOpenPassport).toHaveBeenCalledTimes(1);

    /* Drawn only when a caller wired one: a route that opens nothing is worse
       than no route. */
    expect(open().at('passport-open')).toBeNull();
  });

  it('says the passport in French too', () => {
    const { at } = open({ locale: 'fr', onOpenPassport: vi.fn() });
    expect(at('passport-open')?.textContent).toBe('Voir mon passeport');
  });

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
    expect(at('level-select-counts')?.textContent).toContain(`Niveaux prêts : 2 sur ${String(TOTAL)}`);
    expect(at('level-select-counts')?.textContent).toContain(`Tampons : 0 sur ${String(TOTAL)}`);
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
    expect(screen.arrivalMessage).toContain(`Levels ready: 2 of ${String(TOTAL)}`);
  });

  it('counts the stamps the player has earned', () => {
    const { at } = open({
      entries: DEFAULT_ENTRIES.map((entry) =>
        entry.id === id('ottawa') ? { ...entry, stamped: true } : entry,
      ),
    });
    expect(at('level-select-counts')?.textContent).toContain(`Stamps: 1 of ${String(TOTAL)}`);
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


/**
 * The map's description of one card, without a map on the page.
 *
 * It was a method on the screen and is a pure function now, because the moment a
 * player most needs to hear "Halifax is open" is the moment the level select
 * does not exist: the completion card, over the level they have just finished.
 * `TN-MAP-03` — "it is announced as open when I reach it" — is a promise about a
 * fact, not about a screen, so the sentence has to be reachable from both.
 *
 * The alternative was a new copy row naming the level that just opened, which
 * would be one more string per level in two languages, written at the one screen
 * that needed it. Three reviewed rows joined is the same fact in words somebody
 * has already checked.
 */
describe('describing one card away from the map', () => {
  const MAP = {
    locale: 'en' as const,
    entries: [
      { number: 1, id: id('halifax'), built: true, unlocked: true, stamped: true },
      { number: 3, id: id('quebec-city'), built: true, unlocked: true },
      { number: 4, id: id('ottawa'), built: true, unlocked: false, stampsNeeded: 2 },
      /* No id: a level nobody built. See the note at the top of this file. */
      { number: 11, built: false, unlocked: false },
    ] satisfies MapEntry[],
    stampsToUnlock: 1,
  };

  it('says the place, the state and the reason, in that order', () => {
    expect(describeEntry(MAP, id('quebec-city'))).toBe(
      'Québec City. Open. You can play this now.',
    );
  });

  it('is the same sentence the screen itself draws', () => {
    const { screen: select } = open({ entries: MAP.entries, stampsToUnlock: MAP.stampsToUnlock });
    /* One rule, one place. A card that read one way on the map and another way
       on the card that sent the player there would be two answers to one
       question. */
    for (const entry of MAP.entries) {
      if (entry.id === undefined) continue;
      expect(select.describe(entry.id)).toBe(describeEntry(MAP, entry.id));
    }
  });

  it('still says why a locked card is locked', () => {
    expect(describeEntry(MAP, id('ottawa'))).toBe(
      'Ottawa. Locked. Earn 2 more stamps to open this.',
    );
  });

  it('answers null for a card this build does not have', () => {
    expect(describeEntry(MAP, id('nowhere'))).toBeNull();
  });

  it('is French', () => {
    expect(describeEntry({ ...MAP, locale: 'fr' }, id('quebec-city'))).toBe(
      'Ville de Québec. Ouvert. Vous pouvez y jouer maintenant.',
    );
  });

  it('gives a level its own name, and no name to a level that has none', () => {
    const [halifax, , , unnamed] = MAP.entries;
    expect(levelTitle('en', halifax as MapEntry)).toBe('Halifax');
    /*
     * `null` is what stops a completion card offering a button labelled with a
     * number. Every shipped level has a name today; this entry has none so that
     * the answer is still asserted rather than assumed.
     */
    expect(levelTitle('en', unnamed as MapEntry)).toBeNull();
  });
});

/**
 * Where the player is, said on the card.
 *
 * The map rings the stop and the rail beside the card marks it, and both are
 * `aria-hidden`, so the card for that level says "You are here" in words. One
 * decision drives all three, which is what these tests pin: the word, the rail
 * pin and the map pin are always on the same card.
 */
describe('where the player is, in words', () => {
  const FOUR = ['halifax', 'peggys-cove', 'quebec-city', 'ottawa'];

  /** The first four places built and open, with the stamps named. */
  const travelled = (stamped: readonly string[]): readonly MapEntry[] =>
    entries(FOUR, FOUR).map((entry) => ({
      ...entry,
      stamped: stamped.includes(String(entry.id)),
    }));

  const hereHandles = (fixture: Fixture): readonly (string | null)[] =>
    (fixture.at('level-select-list')?.querySelectorAll('button') ?? [])
      .filter((control) => control.getAttribute('data-here') === 'true')
      .map((control) => control.getAttribute('data-level-handle'));

  const railHere = (fixture: Fixture): string | null =>
    fixture
      .at('level-select-list')
      ?.querySelectorAll('li')
      .find(
        (item) =>
          item.querySelector('.tn-journey')?.getAttribute('data-journey-current') === 'true',
      )
      ?.querySelector('button')
      ?.getAttribute('data-level-handle') ?? null;

  const mapHere = (fixture: Fixture): readonly (string | null)[] =>
    (fixture.at('level-select-map')?.querySelectorAll('[data-journey-current="true"]') ?? []).map(
      (pin) => pin.getAttribute('data-map-handle'),
    );

  it('says "You are here" on the card for the level the map was opened from', () => {
    const fixture = open({
      entries: travelled(['halifax']),
      here: { inLevel: id('quebec-city'), lastPlayed: id('halifax') },
    });
    const badge = fixture.at('level-card-quebec-city-here');
    expect(badge?.textContent).toBe('You are here');
    /* Inside the button, so it is part of the card's name and not a stop. */
    expect(badge?.closest('button')).toBe(fixture.at('level-card-quebec-city'));
    expect(fixture.page.doc.querySelectorAll('.tn-levels__here')).toHaveLength(1);
    expect(hereHandles(fixture)).toEqual(['quebec-city']);
  });

  it('says it on the level the save last played, when the map was not opened from a level', () => {
    const fixture = open({ entries: travelled([]), here: { lastPlayed: id('ottawa') } });
    expect(hereHandles(fixture)).toEqual(['ottawa']);
    expect(fixture.at('level-card-ottawa-here')?.textContent).toBe('You are here');
  });

  it("falls back to the route's own answer, and still says it in words", () => {
    /* Halifax stamped, nothing named: the first open card without a stamp. */
    const fixture = open({ entries: travelled(['halifax']) });
    expect(hereHandles(fixture)).toEqual(['peggys-cove']);
    expect(fixture.at('level-card-peggys-cove-here')?.textContent).toBe('You are here');
  });

  it('is French', () => {
    const fixture = open({ entries: travelled([]), here: { lastPlayed: id('quebec-city') } });
    fixture.screen.setLocale('fr');
    expect(fixture.at('level-card-quebec-city-here')?.textContent).toBe('Vous êtes ici');
  });

  it('marks the same card in words, on the rail and on the map', () => {
    const fixture = open({
      entries: travelled(['halifax', 'peggys-cove']),
      here: { lastPlayed: id('quebec-city') },
    });
    expect(hereHandles(fixture)).toEqual(['quebec-city']);
    expect(railHere(fixture)).toBe('quebec-city');
    expect(mapHere(fixture)).toEqual(['quebec-city']);
  });

  it('draws the travelled line on the map up to that card, and nothing after it', () => {
    const fixture = open({
      entries: travelled(['halifax', 'peggys-cove', 'ottawa']),
      here: { lastPlayed: id('quebec-city') },
    });
    const legs = (fixture.at('level-select-map')?.querySelectorAll('.tn-map__leg') ?? []).map(
      (leg) => [
        leg.getAttribute('data-map-from'),
        leg.getAttribute('data-map-to'),
        leg.getAttribute('data-map-frame'),
      ],
    );
    /* Ottawa's stamp is further on than the player is, so no leg reaches it. */
    expect(legs).toEqual([
      ['halifax', 'peggys-cove', 'inset'],
      ['peggys-cove', 'quebec-city', 'main'],
    ]);
  });

  it('says nothing where there is nowhere to say', () => {
    const fixture = open({ entries: entries([], []), here: { lastPlayed: id('ottawa') } });
    expect(fixture.page.doc.querySelectorAll('.tn-levels__here')).toHaveLength(0);
    expect(hereHandles(fixture)).toEqual([]);
  });

  it('moves when told, without the screen being rebuilt', () => {
    const fixture = open({ entries: travelled([]), here: { lastPlayed: id('halifax') } });
    const screen = fixture.at('level-select');
    fixture.screen.setHere({ lastPlayed: id('ottawa') });
    expect(fixture.at('level-select')).toBe(screen);
    expect(hereHandles(fixture)).toEqual(['ottawa']);
    expect(mapHere(fixture)).toEqual(['ottawa']);
  });

  it('redraws nothing when told the same thing, so focus stays where it was', () => {
    const fixture = open({ entries: travelled([]), here: { lastPlayed: id('halifax') } });
    const card = fixture.at('level-card-quebec-city');
    fixture.screen.setHere({ lastPlayed: id('halifax'), inLevel: null });
    expect(fixture.at('level-card-quebec-city')).toBe(card);
  });

  it('adds nothing to the order a keyboard or a switch walks', () => {
    const fixture = open({
      entries: travelled(['halifax']),
      here: { lastPlayed: id('quebec-city') },
      onBack: () => undefined,
    });
    expect(fixture.at('level-select')?.querySelectorAll('button')).toHaveLength(11);
    expect(fixture.at('level-card-quebec-city-here')?.getAttribute('tabindex')).toBeNull();
    expect(fixture.at('level-select-map')?.querySelectorAll('[tabindex]')).toHaveLength(0);
  });
});
