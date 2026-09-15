import { describe, expect, it, vi } from 'vitest';

/* The shipped quest the game opens on, for its closing line. Read rather than
   typed, so these tests are about where the card puts a line and never about
   what an author wrote. */
import halifaxQuest from '@content/quests/halifax-clock-and-pier.json';
import { text } from '@ui/copy';
import { createLevelComplete } from '@ui/level-complete';

import { buildPage, press } from './support/fake-dom';

/**
 * `docs/stories/TN-QUEST-parliament-hill.md` §`TN-QUEST-04`: the card a player
 * reads when a level's task is finished.
 *
 * The point of the screen is the one the user reported as missing: the domain
 * earns the stamp and opens the next level, and **nothing said so**. So the
 * assertions below are mostly about what is *said* and what is *offered*, not
 * about layout.
 *
 * The stamp sentence is data, per level, because `stamp.<id>.earned` is a row
 * per level and only Ottawa's is written. A level with no row must draw the card
 * without that line rather than name another place.
 */

function open(overrides: Partial<Parameters<typeof createLevelComplete>[1]> = {}) {
  const page = buildPage();
  const announce = vi.fn();
  const onChooseLevel = vi.fn();
  const onKeepPlaying = vi.fn();
  const onPlayNext = vi.fn();
  const card = createLevelComplete(page.host, {
    locale: 'en',
    announce,
    onChooseLevel,
    onKeepPlaying,
    onPlayNext,
    ...overrides,
  });
  return {
    page,
    card,
    announce,
    onChooseLevel,
    onKeepPlaying,
    onPlayNext,
    at: (testId: string) => page.doc.byTestId(testId),
  };
}

/** The level that opened, as the composition root hands it over. */
const NEXT = {
  /* `level.quebec-city.play`, not the place name: the label says what pressing
     does, and the French takes « dans la » where three of the four built levels
     take « à » (`TN-DONE-04`). */
  label: text('en', 'level.quebec-city.play'),
  /* One plain sentence, the same for a sighted player and a listener, rather
     than the map's three rows joined. */
  description: text('en', 'level.complete.nextOpen'),
} as const;

const OTTAWA_STAMP = text('en', 'stamp.ottawa.earned');

describe('the level completion card', () => {
  it('says the task is done and offers both ways on', () => {
    const { card, at } = open();
    card.show({ reason: 'quest', stampMessage: OTTAWA_STAMP });

    const root = at('quest-complete-card');
    expect(root?.hidden).toBe(false);
    expect(root?.textContent).toContain('Task done!');
    expect(at('quest-complete-stamp')?.textContent).toBe(OTTAWA_STAMP);
    expect(at('quest-complete-map')?.textContent).toBe('Choose a level');
    expect(at('quest-complete-keep-playing')?.textContent).toBe('Keep playing');
  });

  it('draws no stamp line for a level this build has no row for', () => {
    const { card, at } = open();
    card.show({ reason: 'quest' });

    expect(at('quest-complete-card')?.textContent).toContain('Task done!');
    expect(
      at('quest-complete-stamp'),
      'a level with no stamp row must draw nothing there, never a placeholder',
    ).toBeNull();
  });

  it('is a modal dialog named by its heading and described by the stamp line', () => {
    const { card, at, page } = open();
    card.show({ reason: 'quest', stampMessage: OTTAWA_STAMP });

    const root = at('quest-complete-card');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'Task done!',
    );
    expect(
      page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain(OTTAWA_STAMP);
  });

  it('points at no description when there is nothing to describe', () => {
    const { card, at } = open();
    card.show({});
    /* A dialog that names itself and then points at an empty element reads its
       own name followed by a silence. */
    expect(at('quest-complete-card')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('announces the news once, joining two rows and writing neither', () => {
    const { card, announce } = open();
    card.show({ stampMessage: OTTAWA_STAMP });

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(`Level finished! ${OTTAWA_STAMP}`, 'en');
  });

  it('announces the heading alone when there is no stamp row', () => {
    const { card, announce } = open();
    card.show({ reason: 'quest' });
    expect(announce).toHaveBeenCalledWith('Task done!', 'en');
  });

  it('says a task was done only when one was', () => {
    /*
     * `TN-DONE`, and the defect it was written for: the card is drawn on two
     * paths and drew "Task done!" on both, so the first thing a player who
     * walked to the exit having accepted no task read was a claim about
     * something they never did. `OQ-DONE-1`.
     */
    const { card, at } = open();
    card.show({});
    expect(at('quest-complete-card')?.textContent).toContain('Level finished!');
    expect(at('quest-complete-card')?.textContent).not.toContain('Task done!');

    card.show({ reason: 'quest' });
    expect(at('quest-complete-card')?.textContent).toContain('Task done!');
    expect(at('quest-complete-card')?.textContent).not.toContain('Level finished!');
  });

  it('offers the passport, where the stamp just landed', () => {
    /* `TN-QUEST-04` and `TN-PASSPORT-01` both assert it; `OQ-DONE-5` is open on
       whether it belongs here. Drawn only when a caller wired it, like every
       other route on this card. */
    const onOpenPassport = vi.fn();
    const { card, at } = open({ onOpenPassport });
    card.show({ stampMessage: OTTAWA_STAMP });
    expect(at('quest-complete-passport')?.textContent).toBe('See my passport');
    at('quest-complete-passport')?.click();
    expect(onOpenPassport).toHaveBeenCalledTimes(1);
  });

  it('draws no passport control where no caller wired one', () => {
    const { card, at } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    expect(at('quest-complete-passport')).toBeNull();
  });

  it('takes the player to the map when they ask for it', () => {
    const { card, at, onChooseLevel, onKeepPlaying } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    at('quest-complete-map')?.click();

    expect(onChooseLevel).toHaveBeenCalledTimes(1);
    expect(onKeepPlaying).not.toHaveBeenCalled();
  });

  it('goes back to the level, and closes, when they keep playing', () => {
    const { card, at, onKeepPlaying, onChooseLevel } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    at('quest-complete-keep-playing')?.click();

    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(onChooseLevel).not.toHaveBeenCalled();
    expect(card.visible).toBe(false);
  });

  it('treats Escape as keeping playing, never as a route the player did not ask for', () => {
    const { card, at, onKeepPlaying, onChooseLevel } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    const root = at('quest-complete-card');
    if (root === null) throw new Error('the completion card was not on the page');
    press(root, 'Escape');

    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(onChooseLevel).not.toHaveBeenCalled();
  });

  it('leaves once, however many times the player presses close', () => {
    const { card, at, onKeepPlaying } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    at('quest-complete-keep-playing')?.click();
    at('quest-complete-keep-playing')?.click();
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
  });

  it('is French end to end', () => {
    const { card, at } = open({ locale: 'fr' });
    card.setLocale('fr');
    card.show({ reason: 'quest', stampMessage: text('fr', 'stamp.ottawa.earned') });

    const root = at('quest-complete-card');
    expect(root?.textContent).toContain('Mission accomplie!');
    expect(root?.textContent).toContain("Vous avez obtenu le tampon d'Ottawa.");
    expect(root?.textContent, 'a passport stamp is a tampon, never a timbre').not.toContain(
      'timbre',
    );
    expect(at('quest-complete-map')?.textContent).toBe('Choisir un niveau');
    expect(at('quest-complete-keep-playing')?.textContent).toBe('Continuer à jouer');
  });

  it('redraws its own rows in the new language without inventing the level’s', () => {
    const { card, at } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    card.setLocale('fr');

    expect(at('quest-complete-map')?.textContent).toBe('Choisir un niveau');
    /* The stamp sentence is this level's row and only the caller can look it up,
       so it is left as it was rather than guessed at. */
    expect(at('quest-complete-stamp')?.textContent).toBe(OTTAWA_STAMP);
  });

  it('nothing on it counts down, and nothing is chosen for the player', () => {
    vi.useFakeTimers();
    try {
      const { card, onChooseLevel, onKeepPlaying } = open();
      card.show({ stampMessage: OTTAWA_STAMP });
      vi.advanceTimersByTime(120_000);
      expect(card.visible).toBe(true);
      expect(onChooseLevel).not.toHaveBeenCalled();
      expect(onKeepPlaying).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be taken down without the player choosing anything', () => {
    const { card, onKeepPlaying, onChooseLevel } = open();
    card.show({});
    card.hide();
    expect(card.visible).toBe(false);
    /* Hiding is the caller tidying up — a level being left, a language change —
       and it is not the player taking a route. */
    expect(onKeepPlaying).not.toHaveBeenCalled();
    expect(onChooseLevel).not.toHaveBeenCalled();
  });

  it('follows the switch settings while it is on screen', () => {
    const { card, at } = open({ singleSwitch: false });
    card.show({});
    card.setSingleSwitch(true, 900);
    /* The ring highlights the first control, which is how a switch user knows a
       press did anything. */
    expect(at('quest-complete-map')?.getAttribute('data-switch-highlight')).toBe('true');
  });

  it('takes itself off the page when destroyed', () => {
    const { card, at } = open();
    card.show({});
    card.destroy();
    expect(at('quest-complete-card')).toBeNull();
  });
});


/**
 * The half of this card the user asked for: "once you reach the end of a level,
 * it should send you to a new level."
 *
 * Reaching the end of the world finishes the level, so the card is now reachable
 * without a single question having been answered — which is why the two groups
 * below are about what it is allowed to *claim*, and about the route on being
 * one tap rather than two.
 */
describe('the way on from a finished level', () => {
  it('offers the level that just opened, named by that level', () => {
    const { card, at } = open();
    card.show({ stampMessage: OTTAWA_STAMP, next: NEXT });

    const play = at('quest-complete-next');
    expect(play?.textContent).toBe('Play Québec City');
    /* Named by the place, described by what the map says about it — never a
       sentence this screen wrote. */
    expect(at('quest-complete-next-level')?.textContent).toBe(NEXT.description);
    expect(
      play?.getAttribute('aria-describedby'),
      'the reason is read after the name, never as part of it (TN-MAP-09)',
    ).toBe('tn-level-complete-next');
  });

  it('says the level opened in a sentence, in both languages, not in the map card rows', () => {
    /* The audit read "Peggy's Cove. Open. You can play this now." as text written
       for a screen reader. The line is one sentence, ends as one, and does not
       repeat the state word the map draws. */
    for (const locale of ['en', 'fr'] as const) {
      const { card, at } = open({ locale });
      const sentence = text(locale, 'level.complete.nextOpen');
      card.show({ next: { label: text(locale, 'level.quebec-city.play'), description: sentence } });
      const line = at('quest-complete-next-level')?.textContent ?? '';
      expect(line).toBe(sentence);
      expect(line.endsWith('.')).toBe(true);
      expect(line.startsWith(`${text(locale, 'map.state.open')}.`)).toBe(false);
      expect(line).not.toContain(`. ${text(locale, 'map.state.open')}. `);
    }
  });

  it('sends the player there on one press, not two', () => {
    const { card, at, onPlayNext, onChooseLevel } = open();
    card.show({ next: NEXT });
    at('quest-complete-next')?.click();

    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(onChooseLevel, 'the map is the other route, not a stop on this one')
      .not.toHaveBeenCalled();
  });

  it('offers no route into a level when none opened', () => {
    const { card, at } = open();
    card.show({ stampMessage: OTTAWA_STAMP });

    expect(
      at('quest-complete-next'),
      'a control with no destination is a dead control, which is worse than one fewer',
    ).toBeNull();
    expect(at('quest-complete-next-level')).toBeNull();
  });

  it('offers no route when the caller cannot take one', () => {
    const page = buildPage();
    /* No `onPlayNext`: the composition root has nowhere to send the player, so
       the control is absent rather than present and dead. */
    const card = createLevelComplete(page.host, { locale: 'en' });
    card.show({ next: NEXT });
    expect(page.doc.byTestId('quest-complete-next')).toBeNull();
  });

  it('keeps the map as the way forward while there is nowhere new to go', () => {
    const { card, at } = open();
    card.show({});
    expect(at('quest-complete-map')?.getAttribute('data-tn-action')).toBe('primary');
  });

  it('never draws two primary actions on one screen', () => {
    const { card, at } = open();
    card.show({ next: NEXT });

    expect(at('quest-complete-next')?.getAttribute('data-tn-action')).toBe('primary');
    expect(
      at('quest-complete-map')?.getAttribute('data-tn-action'),
      'one action per screen carries the player forward; two is a screen with no answer',
    ).toBeNull();
  });

  it('still offers the map and the level they are in, on every showing', () => {
    const { card, at } = open();
    card.show({ next: NEXT });
    expect(at('quest-complete-map')).not.toBeNull();
    expect(at('quest-complete-keep-playing')).not.toBeNull();
  });
});

/**
 * ADR-0036: the end of a level whose task is not done.
 *
 * The audit's player walked to the end of Ottawa and read "You earned the Ottawa
 * stamp. You did not answer any questions here." — a stamp for a task nobody
 * did, under a passport that promises one only for finishing it. The card on
 * that route now earns nothing, says what is left, and gives the level back.
 */
describe('the end of a level whose task is not done', () => {
  const LEFT = [text('en', 'passport.intro'), text('en', 'level.unfinished.notStarted')];

  it('says where the player is, and what is left, with no stamp', () => {
    const { card, at } = open({ onOpenPassport: vi.fn() });
    /* Handed a stamp and a next level anyway: this card draws neither. */
    card.show({ reason: 'unfinished', leftMessages: LEFT, stampMessage: OTTAWA_STAMP, next: NEXT });

    const root = at('quest-complete-card');
    expect(root?.getAttribute('data-reason')).toBe('unfinished');
    expect(root?.textContent).toContain(text('en', 'level.unfinished.title'));
    expect(root?.textContent).not.toContain('Level finished!');
    expect(root?.textContent).not.toContain('Task done!');
    expect(at('quest-complete-left-0')?.textContent).toBe(LEFT[0]);
    expect(at('quest-complete-left-1')?.textContent).toBe(LEFT[1]);

    expect(at('quest-complete-stamp')).toBeNull();
    expect(at('quest-complete-progress')).toBeNull();
    expect(at('quest-complete-next')).toBeNull();
    expect(at('quest-complete-passport'), 'nothing was earned, so nothing is new in it').toBeNull();
  });

  it('gives the level back as its one primary action, and keeps the map beside it', () => {
    const { card, at, onKeepPlaying, onChooseLevel } = open();
    card.show({ reason: 'unfinished', leftMessages: LEFT });

    expect(at('quest-complete-keep-playing')?.getAttribute('data-tn-action')).toBe('primary');
    expect(at('quest-complete-map')?.getAttribute('data-tn-action')).toBe('quiet');

    at('quest-complete-map')?.click();
    expect(onChooseLevel).toHaveBeenCalledTimes(1);

    at('quest-complete-keep-playing')?.click();
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(card.visible).toBe(false);
  });

  it('is described by what it says, and announces the heading and what to do', () => {
    const { card, at, announce, page } = open();
    card.show({ reason: 'unfinished', leftMessages: LEFT });

    const root = at('quest-complete-card');
    const description = page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain(LEFT[0]);
    expect(description?.textContent).toContain(LEFT[1]);
    expect(announce).toHaveBeenCalledWith(`${text('en', 'level.unfinished.title')} ${LEFT[1] ?? ''}`, 'en');
  });

  it('marks the finished card as finished, so the two cannot be mistaken', () => {
    const { card, at } = open();
    card.show({ reason: 'quest' });
    expect(at('quest-complete-card')?.getAttribute('data-reason')).toBe('quest');
    card.show({});
    expect(at('quest-complete-card')?.getAttribute('data-reason')).toBe('level');
  });

  it('is French, from the heading to the line', () => {
    const { card, at } = open({ locale: 'fr' });
    card.show({
      reason: 'unfinished',
      leftMessages: [text('fr', 'passport.intro'), text('fr', 'level.unfinished.notStarted')],
    });
    expect(at('quest-complete-card')?.textContent).toContain(text('fr', 'level.unfinished.title'));
    expect(at('quest-complete-keep-playing')?.textContent).toBe(text('fr', 'common.keepPlaying'));
  });
});

describe('what the card claims about what the player did', () => {
  it('says what they answered, when they answered something', () => {
    const { card, at } = open();
    card.show({ progressMessage: 'You got 2 out of 3 right.' });
    expect(at('quest-complete-progress')?.textContent).toBe('You got 2 out of 3 right.');
  });

  it('draws whichever line the caller gave, and never both', () => {
    const { card, at } = open();
    /*
     * `TN-DONE-02`: one slot, two rows. Reaching the end earns the stamp whether
     * or not anything was answered, and the card must not paper over the second
     * case — but it must not score it either. The caller picks the row; the card
     * draws exactly one of them, and it can never render "0 out of 0" because
     * the total of zero is what the other row *is*.
     */
    card.show({ stampMessage: OTTAWA_STAMP, progressMessage: text('en', 'level.complete.none') });
    const line = at('quest-complete-progress');
    expect(line?.textContent).toBe(text('en', 'level.complete.none'));
    expect(line?.textContent).not.toContain('0 out of 0');
    expect(/\d/u.test(line?.textContent ?? ''), 'the sentence carries no number').toBe(false);
  });

  it('draws no line at all when the caller has nothing to say', () => {
    const { card, at } = open();
    card.show({ stampMessage: OTTAWA_STAMP });
    expect(at('quest-complete-progress')).toBeNull();
  });

  it('describes itself with everything it is saying, not only the stamp', () => {
    const { card, at, page } = open();
    card.show({
      stampMessage: OTTAWA_STAMP,
      progressMessage: 'You got 2 out of 3 right.',
      next: NEXT,
    });

    const root = at('quest-complete-card');
    const described = page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '');
    expect(described?.textContent).toContain(OTTAWA_STAMP);
    expect(described?.textContent).toContain('You got 2 out of 3 right.');
    expect(described?.textContent).toContain(NEXT.description);
  });

  it('announces the news once and does not read the whole card twice', () => {
    const { card, announce } = open();
    card.show({
      stampMessage: OTTAWA_STAMP,
      progressMessage: 'You got 2 out of 3 right.',
      next: NEXT,
    });

    expect(announce).toHaveBeenCalledTimes(1);
    /* The rest is the dialog's description and is read on arrival; saying it
       through the live region as well is the double-speaking every other screen
       here avoids. */
    expect(announce).toHaveBeenCalledWith(`Level finished! ${OTTAWA_STAMP}`, 'en');
  });
});

describe('the card follows the language, and lets go of the level', () => {
  it('redraws every sentence in the new language when the caller can resolve one', () => {
    const { card, at } = open();
    card.show((locale) => ({
      stampMessage: text(locale, 'stamp.ottawa.earned'),
      next: { label: text(locale, 'level.quebec-city.play'), description: 'x' },
    }));

    card.setLocale('fr');
    expect(at('quest-complete-stamp')?.textContent).toBe(text('fr', 'stamp.ottawa.earned'));
    expect(at('quest-complete-next')?.textContent).toBe('Jouer dans la Ville de Québec');
    expect(at('quest-complete-map')?.textContent).toBe('Choisir un niveau');
  });

  it('puts focus somewhere real when it closes, never on the body', () => {
    const page = buildPage();
    const destination = page.doc.createElement('button');
    page.host.append(destination as unknown as HTMLElement);
    const card = createLevelComplete(page.host, {
      locale: 'en',
      onKeepPlaying: () => undefined,
      restoreFocusTo: () => destination as unknown as HTMLElement,
    });
    card.show({});
    page.doc.byTestId('quest-complete-keep-playing')?.click();

    /*
     * The world opens this card, and the world is a canvas that is
     * `aria-hidden` and holds no focus — so the trap would restore to `<body>`,
     * which is where a keyboard user loses their place and a screen reader goes
     * quiet.
     */
    expect(page.doc.activeElement).toBe(destination);
  });

  it('never focuses a destination that has left the page', () => {
    const page = buildPage();
    const detached = page.doc.createElement('button');
    const card = createLevelComplete(page.host, {
      locale: 'en',
      restoreFocusTo: () => detached as unknown as HTMLElement,
    });
    card.show({});
    expect(() => page.doc.byTestId('quest-complete-keep-playing')?.click()).not.toThrow();
    expect(page.doc.activeElement).not.toBe(detached);
  });
});

/**
 * The quest's own closing line — its `doneLine` — on the card (`TN-DONE`).
 *
 * Which line, and whether a verifier allows it, is `completionLine`'s and is
 * asserted in `tests/unit/bootstrap/`. The card is handed a string or nothing,
 * and what is asserted here is where it goes: first in the body, which is first
 * in what `aria-describedby` reads, never in the announcement, never under
 * "Level finished!", and never as an empty paragraph.
 */
describe('the quest’s own closing line', () => {
  const DONE = halifaxQuest.doneLine.text;
  const HALIFAX_STAMP = {
    en: text('en', 'stamp.halifax.earned'),
    fr: text('fr', 'stamp.halifax.earned'),
  } as const;

  /** The body's paragraphs, by test id, in reading order. */
  const readingOrder = (page: ReturnType<typeof buildPage>): (string | null)[] =>
    (page.doc.getElementById('tn-level-complete-body')?.children ?? []).map((line) =>
      line.getAttribute('data-testid'),
    );

  for (const locale of ['en', 'fr'] as const) {
    it(`is drawn first, above the stamp and the score (${locale})`, () => {
      const { card, at, page } = open({ locale });
      card.show({
        reason: 'quest',
        doneMessage: DONE[locale],
        stampMessage: HALIFAX_STAMP[locale],
        progressMessage: text(locale, 'level.complete.score', { correct: 2, total: 3 }),
      });

      expect(at('quest-complete-done')?.textContent).toBe(DONE[locale]);
      expect(readingOrder(page)).toEqual([
        'quest-complete-done',
        'quest-complete-stamp',
        'quest-complete-progress',
      ]);
      expect(at('quest-complete-card')?.textContent).toContain(text(locale, 'quest.done.title'));
    });
  }

  it('stays first with the level that opened on the card as well', () => {
    const { card, page } = open();
    card.show({ reason: 'quest', doneMessage: DONE.en, stampMessage: HALIFAX_STAMP.en, next: NEXT });
    expect(readingOrder(page)).toEqual([
      'quest-complete-done',
      'quest-complete-stamp',
      'quest-complete-next-level',
    ]);
  });

  it('is the first thing the dialog’s description reads, and is not announced', () => {
    const { card, at, page, announce } = open();
    card.show({ reason: 'quest', doneMessage: DONE.en, stampMessage: HALIFAX_STAMP.en });

    const root = at('quest-complete-card');
    const described = page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '');
    expect(described?.children[0]?.textContent).toBe(DONE.en);
    expect((described?.textContent ?? '').startsWith(DONE.en)).toBe(true);

    /* The live region stays the heading and the stamp. The line is read once, by
       the description, and a line in both would be heard twice. */
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(`Task done! ${HALIFAX_STAMP.en}`, 'en');
    expect(String(announce.mock.calls[0]?.[0])).not.toContain(DONE.en);
  });

  it('names no speaker and puts no quotation marks around the line', () => {
    const { card, at } = open();
    card.show({ reason: 'quest', doneMessage: DONE.en });

    /* Exactly the line: no name before it, nothing around it. On two levels the
       giver is a landmark this card may not name. */
    expect(at('quest-complete-done')?.textContent).toBe(DONE.en);
    const drawn = at('quest-complete-card')?.textContent ?? '';
    for (const mark of ['“', '”', '"', '«', '»']) {
      expect(drawn, `the card drew ${mark}, which implies a speaker`).not.toContain(mark);
    }
    expect(at('dialogue-speaker')).toBeNull();
  });

  it('draws nothing when there is no line, leaving the card exactly as it was', () => {
    /* A quest with no line and a line a verifier refused both reach the card as
       no `doneMessage`; an empty string must look the same (`TN-DONE-05`). */
    const without = open();
    without.card.show({ reason: 'quest', stampMessage: HALIFAX_STAMP.en, progressMessage: 'x' });
    const empty = open();
    empty.card.show({
      reason: 'quest',
      doneMessage: '',
      stampMessage: HALIFAX_STAMP.en,
      progressMessage: 'x',
    });

    for (const { at, page } of [without, empty]) {
      expect(at('quest-complete-done'), 'no empty paragraph and no placeholder').toBeNull();
      expect(readingOrder(page)).toEqual(['quest-complete-stamp', 'quest-complete-progress']);
    }
    expect(empty.at('quest-complete-card')?.textContent).toBe(
      without.at('quest-complete-card')?.textContent,
    );
  });

  it('points at no description when an empty line is all there would have been', () => {
    const { card, at } = open();
    card.show({ reason: 'quest', doneMessage: '' });
    expect(at('quest-complete-card')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('is never drawn under "Level finished!", whatever the caller hands over', () => {
    /* `TN-DONE` rule 6: the card a player reaches by walking to the end says
       nothing about the task, and every authored line is about the task. */
    for (const reason of ['level', undefined] as const) {
      const { card, at } = open();
      card.show({
        ...(reason === undefined ? {} : { reason }),
        doneMessage: DONE.en,
        stampMessage: HALIFAX_STAMP.en,
      });
      expect(at('quest-complete-card')?.textContent).toContain('Level finished!');
      expect(at('quest-complete-done')).toBeNull();
      expect(at('quest-complete-card')?.textContent).not.toContain(DONE.en);
    }
  });

  it('follows the language when the caller resolves it, and stays first', () => {
    const { card, at, page } = open();
    card.show((locale) => ({
      reason: 'quest',
      doneMessage: DONE[locale],
      stampMessage: HALIFAX_STAMP[locale],
    }));
    expect(at('quest-complete-done')?.textContent).toBe(DONE.en);

    card.setLocale('fr');
    expect(at('quest-complete-done')?.textContent).toBe(DONE.fr);
    expect(readingOrder(page)[0]).toBe('quest-complete-done');
  });
});
