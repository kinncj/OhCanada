import { describe, expect, it, vi } from 'vitest';

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
  title: 'Québec City',
  description: 'Québec City. Open. You can play this now.',
} as const;

const OTTAWA_STAMP = text('en', 'stamp.ottawa.earned');

describe('the level completion card', () => {
  it('says the task is done and offers both ways on', () => {
    const { card, at } = open();
    card.show({ stampMessage: OTTAWA_STAMP });

    const root = at('quest-complete-card');
    expect(root?.hidden).toBe(false);
    expect(root?.textContent).toContain('Task done!');
    expect(at('quest-complete-stamp')?.textContent).toBe(OTTAWA_STAMP);
    expect(at('quest-complete-map')?.textContent).toBe('Choose a level');
    expect(at('quest-complete-keep-playing')?.textContent).toBe('Keep playing');
  });

  it('draws no stamp line for a level this build has no row for', () => {
    const { card, at } = open();
    card.show({});

    expect(at('quest-complete-card')?.textContent).toContain('Task done!');
    expect(
      at('quest-complete-stamp'),
      'a level with no stamp row must draw nothing there, never a placeholder',
    ).toBeNull();
  });

  it('is a modal dialog named by its heading and described by the stamp line', () => {
    const { card, at, page } = open();
    card.show({ stampMessage: OTTAWA_STAMP });

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
    expect(announce).toHaveBeenCalledWith(`Task done! ${OTTAWA_STAMP}`, 'en');
  });

  it('announces the heading alone when there is no stamp row', () => {
    const { card, announce } = open();
    card.show({});
    expect(announce).toHaveBeenCalledWith('Task done!', 'en');
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
    card.show({ stampMessage: text('fr', 'stamp.ottawa.earned') });

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
    expect(play?.textContent).toBe('Québec City');
    /* Named by the place, described by what the map says about it — never a
       sentence this screen wrote. */
    expect(at('quest-complete-next-level')?.textContent).toBe(NEXT.description);
    expect(
      play?.getAttribute('aria-describedby'),
      'the reason is read after the name, never as part of it (TN-MAP-09)',
    ).toBe('tn-level-complete-next');
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

describe('what the card claims about what the player did', () => {
  it('says what they answered, when they answered something', () => {
    const { card, at } = open();
    card.show({ progressMessage: 'You got 2 out of 3 right.' });
    expect(at('quest-complete-progress')?.textContent).toBe('You got 2 out of 3 right.');
  });

  it('says nothing about answers when there were none', () => {
    const { card, at } = open();
    /* Reaching the end earns the stamp whether or not anything was answered. A
       card that scored a level nobody answered anything in would be claiming a
       subject was learned when nothing was. */
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
    expect(announce).toHaveBeenCalledWith(`Task done! ${OTTAWA_STAMP}`, 'en');
  });
});

describe('the card follows the language, and lets go of the level', () => {
  it('redraws every sentence in the new language when the caller can resolve one', () => {
    const { card, at } = open();
    card.show((locale) => ({
      stampMessage: text(locale, 'stamp.ottawa.earned'),
      next: { title: locale === 'fr' ? 'Ville de Québec' : 'Québec City', description: 'x' },
    }));

    card.setLocale('fr');
    expect(at('quest-complete-stamp')?.textContent).toBe(text('fr', 'stamp.ottawa.earned'));
    expect(at('quest-complete-next')?.textContent).toBe('Ville de Québec');
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
