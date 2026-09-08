import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import { createLevelError, createLevelLoading } from '@ui/level-screens';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-LEVEL-ottawa.md`, `TN-LEVEL-01` and `TN-LEVEL-02`.
 *
 * Both screens exist because this project has twice shipped a page that
 * described a state it was not in. The assertions that matter most here are the
 * negative ones: the loading screen never claims progress it cannot measure, and
 * the error screen never says there is no level to play.
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
    title: 'Ottawa',
    /* The sentence is still the caller's — `OQ-LEVEL-9` keeps the wording with
       the level that waits — but it is no longer invented here: `level.loading`
       is a row now, and this is the call Ottawa's composition root will make.
       The assertions below stay literal, so reading the row is not circular. */
    message: text('en', 'level.loading'),
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
    expect(root?.textContent).toContain('Getting the canal ready.');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('Ottawa');
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

    expect(at('level-loading')?.textContent).toContain('Getting the canal ready.');
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
      title: 'Ottawa',
      message: text('en', 'level.loading'),
    });
    screen.show();
    screen.offerEscape();
    expect(page.doc.byTestId('level-loading-back')).toBeNull();
  });
});

describe('leaving the loading screen behind', () => {
  it('translates the escape it has already drawn', () => {
    const { screen, at } = openLoading();
    screen.offerEscape();
    screen.setLocale('fr');
    expect(at('level-loading-back')?.textContent).toBe('Retour');
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
  const screen = createLevelError(page.host, { locale: 'en', onRetry, onBack, ...overrides });
  screen.show();
  return { page, screen, onRetry, onBack, at: (testId) => page.doc.byTestId(testId) };
}

describe('the level did not load', () => {
  it('says what happened and offers both ways on', () => {
    const { at } = openError();
    const root = at('level-error');

    expect(root?.textContent).toContain('We could not load Ottawa.');
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
    ).toBe('We could not load Ottawa.');
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
    screen.setLocale('fr');
    expect(at('level-retry')?.textContent).toBe('Réessayer');
    screen.destroy();
    expect(at('level-error')).toBeNull();
  });

  it('is French end to end', () => {
    const { screen, at } = openError({ locale: 'fr' });
    screen.setLocale('fr');

    expect(at('level-error')?.textContent).toContain("Nous n'avons pas pu charger Ottawa.");
    expect(at('level-error')?.textContent).toContain('Vérifiez votre connexion et réessayez.');
    expect(at('level-retry')?.textContent).toBe('Réessayer');
    expect(at('level-back')?.textContent).toBe('Retour');
  });
});
