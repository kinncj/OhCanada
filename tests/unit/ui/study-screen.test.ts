import { describe, expect, it, vi } from 'vitest';

import { createStudyScreen, type StudyState } from '@ui/study-screen';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-STUDY-study-mode.md`. The drill itself is the question card,
 * reused; this screen is what surrounds it.
 */

interface Fixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createStudyScreen>;
  readonly root: FakeElement;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly handlers: Record<string, ReturnType<typeof vi.fn>>;
  at(testId: string): FakeElement | null;
}

function open(
  state: StudyState = { kind: 'ready', available: 12, drillSize: 5 },
  overrides: Partial<Parameters<typeof createStudyScreen>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const handlers = {
    onStart: vi.fn(),
    onPractiseNew: vi.fn(),
    onRetry: vi.fn(),
    onAgain: vi.fn(),
    onExit: vi.fn(),
  };

  const screen = createStudyScreen(page.host, {
    locale: 'en',
    announce,
    ...handlers,
    ...overrides,
  });
  screen.show(state);

  const root = page.doc.byTestId('study-screen');
  if (root === null) throw new Error('the study screen did not mount');

  return { page, screen, root, announce, handlers, at: (testId) => root.byTestId(testId) };
}

describe('opening Study', () => {
  it('is a named dialog that says what will happen', () => {
    const { root, page, at } = open();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(page.doc.getElementById(root.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'Study',
    );
    expect(root.textContent).toContain('Practise the questions you have seen. There is no time limit.');
    expect(at('study-start')?.textContent).toBe('Start');
  });

  it('shows the number of questions in the drill, as text', () => {
    expect(open().at('study-count')?.textContent).toBe('5 questions');
  });

  it('says so plainly when fewer questions are ready than a full drill', () => {
    /* TN-STUDY-02: the drill is not padded with repeats; the player is told. */
    const { at } = open({ kind: 'ready', available: 3, drillSize: 5 });
    expect(at('study-count')?.textContent).toBe('You have 3 questions ready. We will ask those.');
  });

  it('starts the drill when asked', () => {
    const { at, handlers } = open();
    at('study-start')?.click();
    expect(handlers['onStart']).toHaveBeenCalledTimes(1);
  });

  it('never explains how the questions were chosen', () => {
    const { root } = open();
    const words = ['spaced repetition', 'fsrs', 'algorithm', 'interval', 'due'];
    for (const word of words) {
      expect(root.textContent.toLowerCase()).not.toContain(word);
    }
  });

  it('shows no timer and nothing that counts down', () => {
    const { root } = open();
    expect(root.textContent).toContain('There is no time limit.');
    expect(root.querySelectorAll('progress').length).toBe(0);
  });
});

describe('nothing to review yet', () => {
  it('explains why, and offers a way to practise anyway', () => {
    const { at, handlers, root } = open({ kind: 'empty' });
    expect(at('study-empty')).not.toBeNull();
    expect(root.textContent).toContain('Nothing to review yet');
    expect(root.textContent).toContain('Play a level and answer a few questions first.');

    const practise = at('study-practise-new');
    expect(practise?.textContent).toBe('Practise new questions');
    practise?.click();
    expect(handlers['onPractiseNew']).toHaveBeenCalledTimes(1);
  });

  it('shows no empty question card', () => {
    const { page } = open({ kind: 'empty' });
    expect(page.doc.byTestId('question-card')).toBeNull();
  });
});

describe('when the questions cannot be loaded', () => {
  it('shows the message it was given, offers Try again, and announces it', () => {
    /* The message itself is content — this screen writes none. */
    const message = 'We could not load the questions.';
    const { at, announce, handlers } = open({ kind: 'error', message });

    expect(at('study-error')?.textContent).toBe(message);
    expect(announce).toHaveBeenCalledWith(message);
    expect(at('study-retry')?.textContent).toBe('Try again');

    at('study-retry')?.click();
    expect(handlers['onRetry']).toHaveBeenCalledTimes(1);
  });

  it('starts no blank drill', () => {
    const { at } = open({ kind: 'error', message: 'nope' });
    expect(at('study-start')).toBeNull();
  });
});

describe('the summary', () => {
  const summary: StudyState = {
    kind: 'summary',
    correct: 4,
    total: 5,
    returning: ['Who is the head of state?', 'What is the capital?'],
  };

  it('says how it went, plainly, with no grade', () => {
    const { at, root } = open(summary);
    expect(at('study-summary')).not.toBeNull();
    expect(root.textContent).toContain('Finished');
    expect(at('study-summary-score')?.textContent).toBe('You got 4 out of 5 right.');
    expect(root.textContent).not.toMatch(/%|\bgrade\b|\bstreak\b|\bstar\b/i);
  });

  it('names what is coming back, by its wording, as a list', () => {
    const { at } = open(summary);
    const list = at('study-summary-returning');
    expect(list?.tagName).toBe('UL');
    expect(list?.children.length).toBe(2);
    expect(list?.textContent).toContain('Who is the head of state?');
    expect(at('study-summary')?.textContent).toContain('We will ask these again:');
  });

  it('says so out loud when every answer was right', () => {
    const { root, at } = open({ kind: 'summary', correct: 5, total: 5, returning: [] });
    expect(root.textContent).toContain('You got them all right.');
    expect(at('study-summary-returning')).toBeNull();
    expect(root.textContent).not.toContain('We will ask these again:');
  });

  it('moves focus to the summary so it is read', () => {
    const { page, at } = open(summary);
    expect(page.doc.activeElement).toBe(at('study-summary'));
  });

  it('offers another drill and a way back to the game', () => {
    const { at, handlers } = open(summary);
    expect(at('study-again')?.textContent).toBe('Study again');
    expect(at('study-exit')?.textContent).toBe('Back to the game');

    at('study-again')?.click();
    expect(handlers['onAgain']).toHaveBeenCalledTimes(1);
    at('study-exit')?.click();
    expect(handlers['onExit']).toHaveBeenCalledTimes(1);
  });
});

describe('leaving part-way', () => {
  it('says the answers so far are kept', () => {
    const { screen, root, announce } = open();
    screen.showLeftNotice();
    expect(root.textContent).toContain('Your answers so far are saved.');
    expect(announce).toHaveBeenCalledWith('Your answers so far are saved.');
  });

  it('says it once, however many times it is said', () => {
    const { screen, root } = open();
    screen.showLeftNotice();
    screen.showLeftNotice();
    expect(root.allByTestId('study-left-notice').length).toBe(1);
  });

  it('leaves on Escape', () => {
    const { root, handlers } = open();
    press(root, 'Escape');
    expect(handlers['onExit']).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to whatever opened Study', () => {
    const page = buildPage();
    const menu = page.doc.createElement('button');
    menu.setAttribute('data-testid', 'menu-button');
    page.ui.append(menu);
    menu.focus();

    const screen = createStudyScreen(page.host, { locale: 'en' });
    screen.show({ kind: 'ready', available: 5, drillSize: 5 });
    screen.hide();
    expect(page.doc.activeElement).toBe(menu);
  });
});

describe('moving between states', () => {
  it('goes from ready to summary without closing', () => {
    const { screen, at } = open();
    screen.setState({ kind: 'summary', correct: 2, total: 5, returning: ['A', 'B', 'C'] });
    expect(at('study-summary-score')?.textContent).toBe('You got 2 out of 5 right.');
    expect(at('study-start')).toBeNull();
    expect(screen.state.kind).toBe('summary');
  });

  it('does not steal focus into a summary that is not on screen', () => {
    const page = buildPage();
    const screen = createStudyScreen(page.host, { locale: 'en' });
    screen.setState({ kind: 'summary', correct: 1, total: 1, returning: [] });
    expect(page.doc.activeElement).toBeNull();
  });
});

describe('French', () => {
  it('draws the Study screen in French', () => {
    const { screen, root } = open();
    screen.setLocale('fr');
    expect(root.textContent).toContain('Révision');
    expect(root.textContent).toContain(
      "Exercez-vous avec les questions que vous avez déjà vues. Il n'y a aucune limite de temps.",
    );
    expect(root.byTestId('study-start')?.textContent).toBe('Commencer');
    expect(root.byTestId('study-exit')?.textContent).toBe('Retour au jeu');
  });

  it('draws the empty state in French', () => {
    const { screen, root } = open({ kind: 'empty' });
    screen.setLocale('fr');
    expect(root.textContent).toContain("Rien à réviser pour l'instant");
    expect(root.textContent).toContain("Jouez d'abord à un niveau et répondez à quelques questions.");
    expect(root.byTestId('study-practise-new')?.textContent).toBe(
      "S'exercer avec de nouvelles questions",
    );
  });

  it('draws the summary in French, with a space before the colon', () => {
    const { screen, root } = open({ kind: 'summary', correct: 4, total: 5, returning: ['Q'] });
    screen.setLocale('fr');
    expect(root.textContent).toContain('Terminé');
    expect(root.textContent).toContain('Vous avez 4 bonnes réponses sur 5.');
    expect(root.textContent).toContain('Nous reposerons ces questions :');
    expect(root.byTestId('study-again')?.textContent).toBe('Réviser encore');
  });

  it('says the leaving message in French', () => {
    const { screen, root } = open();
    screen.setLocale('fr');
    screen.showLeftNotice();
    expect(root.textContent).toContain('Vos réponses sont enregistrées.');
  });
});

describe('one switch', () => {
  it('reaches Start with short presses and takes it with a long one', () => {
    const clock = { now: 0 };
    const page = buildPage();
    const onStart = vi.fn();
    const screen = createStudyScreen(page.host, {
      locale: 'en',
      singleSwitch: true,
      holdMs: 600,
      now: () => clock.now,
      onStart,
    });
    screen.show({ kind: 'ready', available: 5, drillSize: 5 });

    const tap = (heldMs: number): void => {
      page.doc.dispatchEvent(new FakeEvent('pointerdown'));
      clock.now += heldMs;
      page.doc.dispatchEvent(new FakeEvent('pointerup'));
    };

    /* The highlight opens on Start; a long press takes it. */
    tap(800);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('advances nothing by itself', () => {
    const clock = { now: 0 };
    const page = buildPage();
    const onStart = vi.fn();
    const screen = createStudyScreen(page.host, {
      locale: 'en',
      singleSwitch: true,
      holdMs: 600,
      now: () => clock.now,
      onStart,
    });
    screen.show({ kind: 'ready', available: 5, drillSize: 5 });

    clock.now += 120_000;
    expect(onStart).not.toHaveBeenCalled();
    screen.setSingleSwitch(false);
    expect(page.doc.listenerCount('pointerup')).toBe(0);
  });
});

describe('the screen leaving the page', () => {
  it('cleans up after itself', () => {
    const { screen, page } = open();
    screen.destroy();
    expect(page.doc.byTestId('study-screen')).toBeNull();
    expect(page.game.inert).toBe(false);
  });
});
