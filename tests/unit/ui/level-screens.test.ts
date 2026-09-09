import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import { createLevelError, createLevelLoading } from '@ui/level-screens';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `TN-LEVEL-01`, `TN-LEVEL-02` and `TN-WAIT-a-level-opens-or-it-does-not.md`.
 *
 * Both screens exist because this project has twice shipped a page that
 * described a state it was not in, and both were then found describing the
 * *wrong level*: one `level.loading` row and one `level.error.title` row, both
 * written when Ottawa was the only level with a story, drawn by the three levels
 * that shipped after it. The assertions that matter most here are the negative
 * ones: the loading screen never claims progress it cannot measure, the error
 * screen never says there is no level to play, and **neither screen can be
 * built without being told which level it is about** — the fixtures below pass
 * Halifax's rows, so a screen that fell back to a row of its own would fail here
 * by naming Ottawa.
 */

interface LoadingFixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createLevelLoading>;
  readonly onBack: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
}

function openLoading(
  overrides: Partial<Parameters<typeof createLevelLoading>[1]> = {},
): LoadingFixture {
  const page = buildPage();
  const onBack = vi.fn();
  const screen = createLevelLoading(page.host, {
    locale: 'en',
    title: text('en', 'level.halifax.title'),
    /* The sentence is the caller's — `OQ-LEVEL-9` keeps the wording with the
       level that waits — and it is Halifax's, because Halifax is the level the
       game opens on and the one that used to be told about the canal. The
       assertions below stay literal, so reading the row is not circular. */
    message: text('en', 'level.halifax.loading'),
    onBack,
    ...overrides,
  });
  screen.show();
  return { page, screen, onBack, at: (testId) => page.doc.byTestId(testId) };
}

describe('the level is loading', () => {
  it('shows text, not only a spinner, and names itself', () => {
    const { at, page } = openLoading();
    const root = at('level-loading');

    expect(root?.hidden).toBe(false);
    expect(root?.textContent).toContain('Getting the harbour ready.');
    expect(
      root?.textContent,
      'the screen drew the sentence belonging to another level',
    ).not.toContain('Getting the canal ready.');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('Halifax');
  });

  it('offers no escape until the load has stalled', () => {
    /* TN-LEVEL-02: the escape is what a *stalled* load gets. Offering it from
       the first frame teaches the player that loading is going wrong. */
    const { at } = openLoading();
    expect(at('level-loading-back')).toBeNull();
  });

  it('offers a focusable way out when the caller says the load has stalled', () => {
    const { screen, at, onBack } = openLoading();
    screen.offerEscape();

    const back = at('level-loading-back');
    expect(back?.textContent).toBe('Go back');
    back?.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('adds the escape beside the message, never in place of it', () => {
    /* `TN-COPY-07`: "the same sentence is shown for the whole wait", and "any
       control that appears later is added beside it". A screen that swaps its
       sentence for "Still working…" once a load is slow is making a second
       claim about progress it still cannot measure. */
    const { screen, at } = openLoading();
    screen.offerEscape();

    expect(at('level-loading')?.textContent).toContain('Getting the harbour ready.');
  });

  it('offers it on its own after the stall budget, when it was given one', () => {
    vi.useFakeTimers();
    try {
      const { screen, at } = openLoading({ stallAfterMs: 12_000 });
      expect(at('level-loading-back')).toBeNull();
      vi.advanceTimersByTime(12_000);
      expect(at('level-loading-back')).not.toBeNull();
      screen.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the stall timer when the level arrives', () => {
    vi.useFakeTimers();
    try {
      const { screen, at } = openLoading({ stallAfterMs: 12_000 });
      screen.hide();
      vi.advanceTimersByTime(60_000);
      /* A "Go back" button appearing behind a level that has already loaded is
         the same class of defect as the caption over the ice. */
      expect(at('level-loading-back')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers nothing to press when there is nowhere to go back to', () => {
    /* A button that leads nowhere is worse than no button. */
    const page = buildPage();
    const screen = createLevelLoading(page.host, {
      locale: 'en',
      title: text('en', 'level.halifax.title'),
      message: text('en', 'level.halifax.loading'),
    });
    screen.show();
    screen.offerEscape();
    expect(page.doc.byTestId('level-loading-back')).toBeNull();
  });
});

describe('leaving the loading screen behind', () => {
  it('translates the escape it has drawn, and the two strings the level owns', () => {
    /*
     * `TN-WAIT-06`: the French sentence is the one the level's story carries,
     * and it arrives as data — the screen cannot look up a row keyed on a level
     * it was never told the id of. Required, so a language change cannot bring
     * the button across and leave the sentence behind.
     */
    const { screen, at } = openLoading();
    screen.offerEscape();
    screen.setLocale('fr', {
      title: text('fr', 'level.halifax.title'),
      message: text('fr', 'level.halifax.loading'),
    });
    expect(at('level-loading-back')?.textContent).toBe('Retour');
    expect(at('level-loading')?.textContent).toContain('Préparation du port.');
  });

  it('draws one escape however many times the caller asks', () => {
    const { screen, page } = openLoading();
    screen.offerEscape();
    screen.offerEscape();
    expect(
      page.doc.documentElement.querySelectorAll('[data-testid="level-loading-back"]'),
    ).toHaveLength(1);
  });

  it('is gone after destroy', () => {
    const { screen, at } = openLoading();
    screen.destroy();
    expect(at('level-loading')).toBeNull();
  });
});

interface ErrorFixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createLevelError>;
  readonly onRetry: ReturnType<typeof vi.fn>;
  readonly onBack: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
}

function openError(
  overrides: Partial<Parameters<typeof createLevelError>[1]> = {},
): ErrorFixture {
  const page = buildPage();
  const onRetry = vi.fn();
  const onBack = vi.fn();
  const screen = createLevelError(page.host, {
    locale: 'en',
    /* Halifax, not Ottawa: this card used to read one row for every level, so a
       fixture that passed Ottawa's title would agree with the defect. */
    title: text('en', 'level.halifax.error.title'),
    onRetry,
    onBack,
    ...overrides,
  });
  screen.show();
  return { page, screen, onRetry, onBack, at: (testId) => page.doc.byTestId(testId) };
}

describe('the level did not load', () => {
  it('says what happened and offers both ways on', () => {
    const { at } = openError();
    const root = at('level-error');

    expect(root?.textContent).toContain('We could not load Halifax.');
    expect(root?.textContent, 'a failure named another level').not.toContain('Ottawa');
    expect(root?.textContent).toContain('Check your connection and try again.');
    expect(at('level-retry')?.textContent).toBe('Try again');
    expect(at('level-back')?.textContent).toBe('Go back');
  });

  it('interrupts: it is an alertdialog, named and described', () => {
    const { at, page } = openError();
    const root = at('level-error');

    expect(root?.getAttribute('role')).toBe('alertdialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('We could not load Halifax.');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Check your connection and try again.');
  });

  it('never says there is no level to play', () => {
    /*
     * The caption defect, as a rule this screen cannot break. "There is no level
     * to play yet" is not true of a level that exists and failed to arrive.
     */
    const { at } = openError();
    const wording = (at('level-error')?.textContent ?? '').toLowerCase();
    expect(wording).not.toContain('no level');
    expect(wording).not.toContain('foundation');
  });

  it('takes both routes onward', () => {
    const { at, onRetry, onBack } = openError();
    at('level-retry')?.click();
    at('level-back')?.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed into an empty page', () => {
    /* Escape has nowhere useful to go: dismissing would leave no level, no card
       and no way back. Both routes onward are buttons, and both are handlers the
       caller supplied. */
    const { screen, at } = openError();
    press(at('level-error') as FakeElement, 'Escape');
    expect(screen.visible).toBe(true);
  });

  it('follows a language change under a live switch ring', () => {
    const { screen, at } = openError({ singleSwitch: true, holdMs: 600 });
    screen.setSingleSwitch(true, 2_000);
    screen.setLocale('fr', text('fr', 'level.halifax.error.title'));
    expect(at('level-retry')?.textContent).toBe('Réessayer');
    screen.destroy();
    expect(at('level-error')).toBeNull();
  });

  it('is French end to end, and the title is written out rather than composed', () => {
    /*
     * `TN-WAIT-06`. Québec City is the row that proves the template would have
     * been wrong — « charger la Ville de Québec » takes an article and
     * « charger Halifax » does not — so it is the one this test names.
     */
    const { screen, at } = openError({
      locale: 'fr',
      title: text('fr', 'level.quebec-city.error.title'),
    });
    screen.setLocale('fr', text('fr', 'level.quebec-city.error.title'));

    expect(at('level-error')?.textContent).toContain(
      "Nous n'avons pas pu charger la Ville de Québec.",
    );
    expect(at('level-error')?.textContent).toContain('Vérifiez votre connexion et réessayez.');
    expect(at('level-retry')?.textContent).toBe('Réessayer');
    expect(at('level-back')?.textContent).toBe('Retour');
  });

  it('names the level it was told about, whichever level that is', () => {
    /*
     * `TN-WAIT-02`: "each built level names itself", and "a failure never names
     * another level". Four levels through one card, so the card cannot be right
     * by accident — which is exactly how it was wrong before, being right about
     * the only level anybody checked.
     */
    for (const [id, title] of [
      ['halifax', 'We could not load Halifax.'],
      ['quebec-city', 'We could not load Québec City.'],
      ['ottawa', 'We could not load Ottawa.'],
      ['toronto', 'We could not load Toronto.'],
    ] as const) {
      const { at } = openError({ title: text('en', `level.${id}.error.title`) });
      expect(at('level-error')?.textContent).toContain(title);
    }
  });
});
