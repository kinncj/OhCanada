import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';
import { text } from '@ui/copy';
import type { MapEntry } from '@ui/level-select';
import { createPassport, stampState } from '@ui/passport';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-PASSPORT-my-passport.md`.
 *
 * The reward surface of the whole game, and three things it must not become:
 *
 *  - a second vocabulary for a fact the map already states. "Not made yet" is
 *    the map's phrase and its key, reused here, because a player who has read it
 *    on one screen must not meet a different phrase for it one screen later;
 *  - an error. Nine of the ten levels do not exist, and a build with one level
 *    is a normal state of this game;
 *  - a screen that takes a stamp away. An earned stamp for a level this build no
 *    longer carries still reads "Earned", which is the one place the map's
 *    precedence deliberately does not apply.
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

const entries = (built: readonly string[], stamped: readonly string[]): readonly MapEntry[] =>
  SPINE.map(([number, levelId]) => ({
    number,
    ...(levelId === undefined ? {} : { id: id(levelId) }),
    built: levelId !== undefined && built.includes(levelId),
    unlocked: levelId === 'halifax',
    stamped: levelId !== undefined && stamped.includes(levelId),
  }));

const BUILT = ['halifax', 'quebec-city', 'ottawa', 'toronto'];

interface Fixture {
  readonly page: FakePage;
  readonly passport: ReturnType<typeof createPassport>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly onBack: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
}

function open(
  overrides: Partial<Parameters<typeof createPassport>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const onBack = vi.fn();
  const passport = createPassport(page.host, {
    locale: 'en',
    entries: entries(BUILT, ['ottawa']),
    announce,
    onBack,
    ...overrides,
  });
  passport.show();
  return { page, passport, announce, onBack, at: (testId) => page.doc.byTestId(testId) };
}

describe('which state a slot is in', () => {
  it('is the map’s rule, with earned put in front of it', () => {
    expect(stampState({ number: 4, built: true, unlocked: true, stamped: true })).toBe('earned');
    expect(stampState({ number: 4, built: true, unlocked: true })).toBe('not-earned');
    expect(stampState({ number: 4, built: true, unlocked: false })).toBe('not-earned');
    expect(stampState({ number: 7, built: false, unlocked: false })).toBe('not-built');
  });

  it('never takes a stamp away because the level is gone', () => {
    /*
     * `TN-PASSPORT-05`, the one place this screen and the map deliberately
     * disagree: the map says what a player can do now, the passport says what
     * they did. Both are answering their own question and neither is wrong.
     */
    expect(stampState({ number: 4, built: false, unlocked: false, stamped: true })).toBe('earned');
  });

  it('has no locked state at all', () => {
    /* A level that exists and is locked reads "Not earned yet", which is true.
       A fourth word would be a fourth thing to translate and get wrong. */
    const states = SPINE.map(([number]) =>
      stampState({ number, built: true, unlocked: false, stamped: false }),
    );
    expect(new Set(states)).toEqual(new Set(['not-earned']));
  });
});

describe('the passport', () => {
  it('says what it is, how a stamp is earned, and how much is left', () => {
    const { at } = open();
    expect(at('passport')?.hidden).toBe(false);
    expect(at('passport')?.textContent).toContain('My passport');
    expect(at('passport-intro')?.textContent).toBe(
      "You earn a stamp when you finish a level's task.",
    );
    const counts = at('passport-counts')?.textContent ?? '';
    expect(counts).toContain('Stamps: 1 of 10');
    expect(counts).toContain('Levels ready: 4 of 10');
    expect(counts).toContain('More are coming.');
  });

  it('draws ten slots, in the order the journey takes', () => {
    const { at } = open();
    const slots = at('passport-slots')?.children ?? [];
    expect(slots).toHaveLength(10);
    expect(slots.map((slot) => slot.getAttribute('data-level-handle'))).toEqual([
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

  it('says an earned stamp is earned, in words and with a shape', () => {
    const { at } = open();
    const slot = at('stamp-ottawa');
    expect(slot?.getAttribute('data-state')).toBe('earned');
    expect(slot?.textContent).toContain('Earned');
    expect(slot?.textContent).toContain('Ottawa');
    /* The mark is a shape beside the word, hidden from assistive technology so
       the stamp is never announced as "image" or as an empty string. */
    const mark = slot?.querySelectorAll('[aria-hidden="true"]') ?? [];
    expect(mark, 'a stamp with no shape is a stamp told apart by colour alone').toHaveLength(1);
  });

  it('draws an unearned slot in the same shape, never as a blank', () => {
    const { at } = open();
    const slot = at('stamp-halifax');
    expect(slot?.getAttribute('data-state')).toBe('not-earned');
    expect(slot?.textContent).toContain('Not earned yet');
    expect(slot?.textContent).toContain('Halifax');
    expect(slot?.textContent).not.toContain('Locked');
    /* No stamp shape on a slot nobody has earned: an outline reads as a slot the
       player could fill. */
    expect(slot?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('says a level nobody has built is not made yet, in the map’s own words', () => {
    const { at } = open();
    const slot = at('stamp-winnipeg');
    expect(slot?.getAttribute('data-state')).toBe('not-built');
    expect(slot?.textContent).toContain(text('en', 'map.state.notBuilt'));
    expect(slot?.textContent).toContain(text('en', 'map.notBuilt.help'));
    expect(slot?.textContent).not.toContain('Not earned yet');
  });

  it('never reads as an error, whatever state a slot is in', () => {
    /* `TN-PASSPORT-04`: a build with one level is a normal state of this game. */
    const { at } = open({ entries: entries(['ottawa'], []) });
    const page = at('passport')?.textContent?.toLowerCase() ?? '';
    for (const word of ['error', 'failed', 'missing', 'unavailable', 'not found', 'tbd', '???']) {
      expect(page.includes(word), `the passport says "${word}"`).toBe(false);
    }
  });

  it('draws no placeholder where a level has no place name', () => {
    /* Level 2 has a subject line and, deliberately, no place. */
    const { at } = open();
    const slot = at('passport-slot-2');
    expect(slot?.textContent).toContain('Level 2');
    expect(slot?.textContent).toContain(text('en', 'map.state.notBuilt'));
    expect(slot?.textContent).not.toContain('undefined');
  });

  it('counts the stamps it draws, and never more than ten', () => {
    const { at } = open({ entries: entries(BUILT, ['ottawa', 'halifax']) });
    expect(at('passport-counts')?.textContent).toContain('Stamps: 2 of 10');
    const earned = (at('passport-slots')?.children ?? []).filter(
      (slot) => slot.getAttribute('data-state') === 'earned',
    );
    expect(earned).toHaveLength(2);
  });
});

describe('a passport with nothing in it', () => {
  it('looks like a beginning rather than an error', () => {
    const { at } = open({ entries: entries(BUILT, []) });
    expect(at('passport-empty')?.textContent).toContain('No stamps yet');
    expect(at('passport-empty')?.textContent).toContain(
      'Finish a level to earn your first stamp.',
    );
    expect(at('passport-counts')?.textContent).toContain('Stamps: 0 of 10');
    /* And no slot is missing from the ten: the journey is still ten places. */
    expect(at('passport-slots')?.children).toHaveLength(10);
  });

  it('opens with no level data at all, and still draws ten slots', () => {
    const { at } = open({ entries: entries([], []) });
    expect(at('passport-slots')?.children).toHaveLength(10);
    expect(at('passport-empty')).not.toBeNull();
    expect(at('passport-counts')?.textContent).toContain('Levels ready: 0 of 10');
  });

  it('takes the empty state away as soon as there is a stamp', () => {
    const { passport, at } = open({ entries: entries(BUILT, []) });
    expect(at('passport-empty')).not.toBeNull();
    passport.setEntries(entries(BUILT, ['ottawa']));
    expect(at('passport-empty')).toBeNull();
    expect(at('stamp-ottawa')?.getAttribute('data-state')).toBe('earned');
  });
});

describe('the passport for a screen reader and a keyboard', () => {
  it('is a named modal dialog described by how a stamp is earned', () => {
    const { at, page } = open();
    const root = at('passport');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('My passport');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('You earn a stamp');
  });

  it('exposes the slots as a list of ten items, in journey order', () => {
    const { at } = open();
    expect(at('passport-slots')?.tagName).toBe('UL');
    for (const slot of at('passport-slots')?.children ?? []) {
      expect(slot.tagName).toBe('LI');
    }
  });

  it('names each slot with its number, its place and its state', () => {
    /*
     * `TN-PASSPORT-09`. A `listitem` takes no name from its contents, so the
     * label is written — and every word of it is also visible text, because
     * nothing important may exist only in the accessibility tree and nothing
     * only in pixels.
     */
    const { at } = open();
    const label = at('stamp-ottawa')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Level 4');
    expect(label).toContain('Ottawa');
    expect(label).toContain('Earned');

    expect(at('stamp-winnipeg')?.getAttribute('aria-label')).toContain('Not made yet');
    expect(at('stamp-halifax')?.getAttribute('aria-label')).toContain('Not earned yet');
  });

  it('lets a keyboard reach every slot, whatever its state, and activates none', () => {
    /* `TN-PASSPORT-07`: focus reaches all ten, and a slot is readable rather
       than activatable — no slot claims to open a level. */
    const { at } = open();
    for (const slot of at('passport-slots')?.children ?? []) {
      expect(slot.tabIndex, 'a slot a keyboard cannot reach is a slot nobody can read').toBe(0);
      expect(slot.tagName).not.toBe('BUTTON');
      expect(slot.getAttribute('role')).toBeNull();
    }
  });

  it('lands focus on the heading rather than on the document', () => {
    const { page, at } = open();
    expect(page.doc.activeElement).toBe(at('passport')?.querySelector('h1'));
  });

  it('announces the screen and the count once, and does not repeat it', () => {
    const { announce, passport } = open();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('My passport. Stamps: 1 of 10', 'en');
    passport.show();
    expect(announce, 'the arrival was read twice').toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and on Back, and only through the caller', () => {
    const { at, onBack } = open();
    at('passport-back')?.click();
    expect(onBack).toHaveBeenCalledTimes(1);

    const root = at('passport');
    if (root === null) throw new Error('the passport was not on the page');
    press(root, 'Escape');
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('draws no way back where a caller wired none', () => {
    const page = buildPage();
    createPassport(page.host, { locale: 'en', entries: entries(BUILT, []) }).show();
    expect(page.doc.byTestId('passport-back')).toBeNull();
  });
});

describe('the passport in French', () => {
  it('is French end to end, and says tampon rather than timbre', () => {
    const { at } = open({ locale: 'fr' });
    const page = at('passport')?.textContent ?? '';
    expect(page).toContain('Mon passeport');
    expect(page).toContain('Tampons : 1 sur 10');
    expect(page).toContain('Niveaux prêts : 4 sur 10');
    expect(page).toContain("D'autres arrivent.");
    expect(page).toContain('Obtenu');
    expect(page).toContain('Pas encore obtenu');
    expect(page).toContain('Pas encore créé');
    expect(page, 'a passport stamp is a tampon; a timbre is a postage stamp').not.toContain(
      'timbre',
    );
  });

  it('keeps every slot in the state it was in when the language changes', () => {
    const { passport, at } = open();
    passport.setLocale('fr');
    expect(at('stamp-ottawa')?.getAttribute('data-state')).toBe('earned');
    expect(at('stamp-ottawa')?.textContent).toContain('Obtenu');
    expect(at('passport-counts')?.textContent).toContain('Tampons : 1 sur 10');
    expect(at('passport')?.getAttribute('lang')).toBe('fr');
  });

  it('keeps the player on the slot they were reading through a language change', () => {
    const { passport, page, at } = open();
    at('stamp-ottawa')?.focus();
    passport.setLocale('fr');
    expect(page.doc.activeElement?.getAttribute('data-level-handle')).toBe('ottawa');
  });
});

describe('the practice exam on the passport', () => {
  /* `TN-PASSPORT-06`: the one place an exam result is kept. */

  it('is absent until there is one to draw', () => {
    /* The panel was deliberately missing while this build had no exam: naming a
       feature the game does not have is the defect from the other end. */
    const { at } = open();
    expect(at('passport-exam')?.hidden).toBe(true);
  });

  it('says nothing has been taken yet, and offers the way in', () => {
    const onOpenExam = vi.fn();
    const { at } = open({ exam: { kind: 'none' }, onOpenExam });
    expect(at('passport-exam')?.textContent).toContain('Practice exam');
    expect(at('passport-exam-none')?.textContent).toBe(
      'You have not taken the practice exam yet.',
    );
    expect(at('passport-exam-open')?.textContent).toBe('Practice exam');
    at('passport-exam-open')?.click();
    expect(onOpenExam).toHaveBeenCalledOnce();
  });

  it('shows the most recent result, and no history beside it', () => {
    const { at } = open({
      exam: { kind: 'result', passed: true, correct: 17, total: 20, timed: true },
      onOpenExam: () => undefined,
    });
    expect(at('passport-exam')?.textContent).toContain('Your last practice exam');
    expect(at('passport-exam-verdict')?.textContent).toBe('You passed');
    expect(at('passport-exam-score')?.textContent).toBe('Right answers: 17 out of 20');
    expect(at('passport-exam')?.textContent).toContain('You took this exam with the timer.');
    for (const word of ['best', 'average', 'streak', 'attempt']) {
      expect(at('passport-exam')?.textContent.toLowerCase()).not.toContain(word);
    }
  });

  it('shows a later result rather than a better one', () => {
    const { at } = open({
      exam: { kind: 'result', passed: false, correct: 11, total: 20, timed: false },
      onOpenExam: () => undefined,
    });
    expect(at('passport-exam-verdict')?.textContent).toBe('Not this time');
    expect(at('passport-exam-score')?.textContent).toBe('Right answers: 11 out of 20');
  });

  it('shows no score for an exam nobody has finished, and offers the way back', () => {
    const { at } = open({
      exam: { kind: 'unfinished', answered: 12, total: 20 },
      onOpenExam: () => undefined,
    });
    expect(at('passport-exam-unfinished')?.textContent).toBe('Answers given: 12 of 20');
    expect(at('passport-exam-verdict')).toBeNull();
    expect(at('passport-exam-score')).toBeNull();
    expect(at('passport-exam-open')?.textContent).toBe('Finish your exam');
  });

  it('offers nothing where the exam cannot start', () => {
    const { at } = open({ exam: { kind: 'not-ready' }, onOpenExam: () => undefined });
    expect(at('passport-exam-not-ready')?.textContent).toBe('The exam is not ready yet');
    expect(at('passport-exam')?.textContent).toContain(
      'We are still writing the questions. You can practise in Study instead.',
    );
    expect(at('passport-exam-open')).toBeNull();
  });

  it('redraws when an exam finishes, without rebuilding the screen', () => {
    const { passport, at } = open({ exam: { kind: 'none' }, onOpenExam: () => undefined });
    passport.setExam({ kind: 'result', passed: true, correct: 15, total: 20, timed: false });
    expect(at('passport-exam-score')?.textContent).toBe('Right answers: 15 out of 20');
  });

  it('is French', () => {
    const { passport, at } = open({
      exam: { kind: 'result', passed: false, correct: 11, total: 20, timed: false },
      onOpenExam: () => undefined,
    });
    passport.setLocale('fr');
    expect(at('passport-exam')?.textContent).toContain('Votre dernier examen pratique');
    expect(at('passport-exam-verdict')?.textContent).toBe('Pas cette fois');
    expect(at('passport-exam-score')?.textContent).toBe('Bonnes réponses : 11 sur 20');
    expect(at('passport-exam')?.textContent).toContain(
      'Vous avez fait cet examen sans chronomètre.',
    );
  });

  it('says in French that no exam has been taken yet', () => {
    const { passport, at } = open({ exam: { kind: 'none' }, onOpenExam: () => undefined });
    passport.setLocale('fr');
    expect(at('passport-exam-none')?.textContent).toBe(
      "Vous n'avez pas encore fait l'examen pratique.",
    );
  });

  it('earns no stamp: the count is untouched by a pass', () => {
    /* `TN-PASSPORT-06` and `TN-RESULT-05`: an exam earns no stamp and opens no
       level. The panel is beside the slots and changes none of them. */
    const { at } = open({
      exam: { kind: 'result', passed: true, correct: 20, total: 20, timed: false },
      entries: entries(BUILT, []),
      onOpenExam: () => undefined,
    });
    expect(at('passport-counts')?.textContent).toContain('Stamps: 0 of 10');
    expect(at('stamp-ottawa')?.getAttribute('data-state')).toBe('not-earned');
  });
});
