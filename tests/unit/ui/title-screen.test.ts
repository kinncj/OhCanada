import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import { createTitleScreen, type TitleScreenRoutes } from '@ui/title-screen';

import { buildPage, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-TITLE-title-screen.md`.
 *
 * The assertions that matter most are the negative ones. `TN-TITLE-03` is a
 * failure-path story about a screen that could lose somebody's game: Play and
 * Continue must never be offered together, and nothing may be drawn disabled.
 */

const FIRST_RUN = (onPlay: () => void): TitleScreenRoutes => ({ kind: 'first-run', onPlay });

const RETURNING = (
  onChooseLevel: () => void,
  resume?: { levelTitle: string; onContinue: () => void },
): TitleScreenRoutes => ({
  kind: 'returning',
  onChooseLevel,
  ...(resume === undefined ? {} : { resume }),
});

interface Fixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createTitleScreen>;
  at(testId: string): FakeElement | null;
}

function open(overrides: Partial<Parameters<typeof createTitleScreen>[1]> = {}): Fixture {
  const page = buildPage();
  const screen = createTitleScreen(page.host, {
    locale: 'en',
    routes: FIRST_RUN(() => undefined),
    ...overrides,
  });
  return { page, screen, at: (testId) => page.doc.byTestId(testId) };
}

describe('a first-time player opens the game', () => {
  it('is the way in: Play, with no URL parameter and no level', () => {
    const onPlay = vi.fn();
    const { at } = open({ routes: FIRST_RUN(onPlay) });

    const play = at('title-play');
    expect(play?.textContent).toBe('Play');
    expect(play?.tagName).toBe('BUTTON');
    expect(play?.getAttribute('type')).toBe('button');

    play?.click();
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('says what the game is, and that it is not the government', () => {
    const { at } = open();
    expect(at('title-screen')?.querySelector('h1')?.textContent).toBe('TrueNorth');
    expect(at('title-screen')?.textContent).toContain(
      'Get ready for the Canadian citizenship test.',
    );
    expect(at('title-not-official')?.textContent).toBe(
      'This game is not made by the Government of Canada.',
    );
  });

  it('offers only the ways in that are true: no Continue, no Choose a level', () => {
    const { at } = open();
    expect(at('title-continue')).toBeNull();
    expect(at('title-choose-level')).toBeNull();
    expect(at('title-last-played')?.hidden).toBe(true);
  });

  it('draws nothing disabled — an absent route, not a greyed-out one', () => {
    const { at } = open();
    const controls = at('title-screen')?.querySelectorAll('button') ?? [];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.hasAttribute('disabled'), control.textContent).toBe(false);
      expect(control.getAttribute('aria-disabled'), control.textContent).toBeNull();
    }
  });

  it('puts Play first in reading order and gives it focus when the screen opens', () => {
    const { at, screen, page } = open({ onOpenStudy: () => undefined, onOpenSettings: () => undefined });

    const first = at('title-screen')?.querySelectorAll('button')[0];
    expect(first?.getAttribute('data-testid')).toBe('title-play');

    screen.focus();
    expect(page.doc.activeElement).toBe(at('title-play'));
    expect(page.doc.activeElement).not.toBe(page.doc.body);
  });

  it('is not a dialog and traps nothing', () => {
    const { at } = open();
    const root = at('title-screen');
    expect(root?.getAttribute('role')).toBeNull();
    expect(root?.getAttribute('aria-modal')).toBeNull();
  });
});

describe('a returning player opens the game', () => {
  it('offers Continue first, and says where it goes', () => {
    const onContinue = vi.fn();
    const { at } = open({
      routes: RETURNING(() => undefined, { levelTitle: 'Ottawa', onContinue }),
    });

    const controls = at('title-screen')?.querySelectorAll('button') ?? [];
    expect(controls[0]?.getAttribute('data-testid')).toBe('title-continue');
    expect(at('title-continue')?.textContent).toBe('Continue');
    expect(at('title-last-played')?.textContent).toBe('Last played: Ottawa');

    /* The description resolves to the line on screen, so a screen reader reads
       "Continue, Last played: Ottawa" rather than a dangling reference. */
    expect(at('title-continue')?.getAttribute('aria-describedby')).toBe('tn-title-last-played');
    expect(at('title-last-played')?.id).toBe('tn-title-last-played');

    at('title-continue')?.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('names the other way in for where it goes, and never shows Play beside Continue', () => {
    const onChooseLevel = vi.fn();
    const { at } = open({
      routes: RETURNING(onChooseLevel, { levelTitle: 'Ottawa', onContinue: () => undefined }),
    });

    expect(at('title-play')).toBeNull();
    expect(at('title-choose-level')?.textContent).toBe(text('en', 'map.open'));
    at('title-choose-level')?.click();
    expect(onChooseLevel).toHaveBeenCalledTimes(1);
  });

  it('cannot draw Play and Continue together — the type does not allow it', () => {
    /*
     * `TN-TITLE-03`. The union in `TitleScreenRoutes` is what makes this true;
     * the assertion is over every route this module can be given, so it is a
     * statement about the screen and not about one call site.
     */
    for (const routes of [
      FIRST_RUN(() => undefined),
      RETURNING(() => undefined),
      RETURNING(() => undefined, { levelTitle: 'Ottawa', onContinue: () => undefined }),
    ]) {
      const { at } = open({ routes });
      const both = at('title-play') !== null && at('title-continue') !== null;
      expect(both, 'Play and Continue were offered together').toBe(false);
    }
  });

  it('drops Continue, and the Last played line, when there is no level to resume', () => {
    const { at, screen, page } = open({ routes: RETURNING(() => undefined) });

    expect(at('title-continue')).toBeNull();
    expect(at('title-last-played')?.hidden).toBe(true);
    expect(at('title-screen')?.textContent).not.toContain('Last played');

    /* And focus lands on the way in that is left, never on the body. */
    screen.focus();
    expect(page.doc.activeElement).toBe(at('title-choose-level'));
  });

  it('redraws the ways in when the save has been read', () => {
    const onContinue = vi.fn();
    const { at, screen } = open();

    screen.setRoutes(RETURNING(() => undefined, { levelTitle: 'Ottawa', onContinue }));
    expect(at('title-play')).toBeNull();
    at('title-continue')?.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('the other items', () => {
  it('omits Study and Settings rather than offering controls that do nothing', () => {
    const { at } = open();
    expect(at('title-study')).toBeNull();
    expect(at('title-settings')).toBeNull();
  });

  it('draws them from the table, and in the same order for either player', () => {
    const onOpenStudy = vi.fn();
    const onOpenSettings = vi.fn();
    const first = open({ onOpenStudy, onOpenSettings });
    expect(first.at('title-study')?.textContent).toBe(text('en', 'study.open'));
    expect(first.at('title-settings')?.textContent).toBe(text('en', 'common.settings'));

    const order = (fixture: Fixture): (string | null)[] =>
      (fixture.at('title-screen')?.querySelectorAll('button') ?? [])
        .map((button) => button.getAttribute('data-testid'))
        .slice(-2);

    const returning = open({
      routes: RETURNING(() => undefined, { levelTitle: 'Ottawa', onContinue: () => undefined }),
      onOpenStudy,
      onOpenSettings,
    });
    expect(order(first)).toEqual(['title-study', 'title-settings']);
    expect(order(returning)).toEqual(['title-study', 'title-settings']);

    first.at('title-study')?.click();
    first.at('title-settings')?.click();
    expect(onOpenStudy).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe('the title screen in French', () => {
  it('speaks French without being rebuilt, and does not translate the game', () => {
    const { at, screen } = open({
      routes: RETURNING(() => undefined, { levelTitle: 'Ottawa', onContinue: () => undefined }),
      onOpenStudy: () => undefined,
      onOpenSettings: () => undefined,
    });

    screen.setLocale('fr');

    expect(at('title-screen')?.querySelector('h1')?.textContent).toBe('TrueNorth');
    expect(at('title-continue')?.textContent).toBe('Continuer');
    expect(at('title-choose-level')?.textContent).toBe('Choisir un niveau');
    expect(at('title-study')?.textContent).toBe('Réviser');
    expect(at('title-settings')?.textContent).toBe('Réglages');
    expect(at('title-last-played')?.textContent).toBe('Dernier niveau : Ottawa');
    expect(at('title-not-official')?.textContent).toBe(
      "Ce jeu n'est pas fait par le gouvernement du Canada.",
    );
  });
});

describe('arriving', () => {
  it('has one message that names the game and what it is for', () => {
    const { screen } = open();
    expect(screen.arrivalMessage).toContain('TrueNorth');
    expect(screen.arrivalMessage).toContain('Get ready for the Canadian citizenship test.');
  });

  it('leaves nothing behind when it is destroyed', () => {
    const { at, screen } = open();
    screen.destroy();
    expect(at('title-screen')).toBeNull();
  });
});

describe('the way into the practice exam', () => {
  /* `TN-EXAM-01` and `TN-ATTEMPT-03`: one control, two labels. */

  it('is not drawn when the caller offers no exam', () => {
    /* `TN-TITLE-01`: a route that is not available is absent from the
       accessibility tree, never greyed out. */
    expect(open().at('title-exam')).toBeNull();
  });

  it('reads "Practice exam" and opens it', () => {
    const onOpenExam = vi.fn();
    const { at } = open({ onOpenExam });
    const exam = at('title-exam');
    expect(exam?.textContent).toBe('Practice exam');
    expect(exam?.tagName).toBe('BUTTON');
    exam?.click();
    expect(onOpenExam).toHaveBeenCalledTimes(1);
  });

  it('reads "Finish your exam" while one is unfinished, and is still a control', () => {
    const { at } = open({ onOpenExam: () => undefined, examUnfinished: true });
    expect(at('title-exam')?.textContent).toBe('Finish your exam');
    expect(at('title-exam')?.textContent).not.toBe('Practice exam');
    expect(at('title-exam')?.tagName).toBe('BUTTON');
  });

  it('changes its label when the exam is left or finished, without a second control', () => {
    const { screen, page, at } = open({ onOpenExam: () => undefined });
    screen.setExamUnfinished(true);
    expect(at('title-exam')?.textContent).toBe('Finish your exam');
    expect(page.ui.querySelectorAll('[data-testid="title-exam"]')).toHaveLength(1);
    screen.setExamUnfinished(false);
    expect(at('title-exam')?.textContent).toBe('Practice exam');
  });

  it('is French', () => {
    const { screen, at } = open({ onOpenExam: () => undefined });
    screen.setLocale('fr');
    expect(at('title-exam')?.textContent).toBe('Examen pratique');
    screen.setExamUnfinished(true);
    expect(at('title-exam')?.textContent).toBe('Terminer votre examen');
  });

  it('sits after Study and before Settings', () => {
    /* `OQ-EXAM-7` routes the position to `TN-TITLE`'s owner and `TN-EXAM-01`
       asserts only that the control exists. The order is pinned here so a change
       to it is a deliberate one. */
    const { page } = open({
      onOpenStudy: () => undefined,
      onOpenExam: () => undefined,
      onOpenSettings: () => undefined,
    });
    const order = page.ui
      .querySelectorAll('button')
      .map((control) => control.getAttribute('data-testid'));
    expect(order.slice(-3)).toEqual(['title-study', 'title-exam', 'title-settings']);
  });

  it('never takes focus from the primary control', () => {
    /* An exam is the wrong first click for somebody who has answered nothing,
       so it is offered and never the thing focus lands on. */
    const { screen, at } = open({ onOpenExam: () => undefined });
    expect(screen.primary).not.toBe(at('title-exam'));
  });
});
