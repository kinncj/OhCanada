import type { Page } from '@playwright/test';

/**
 * What has focus, for the accessibility suite.
 *
 * Three specs had written the same evaluation for themselves
 * (`save-transfer`, `level-screens`, `shell`), which is three chances to drift
 * on the one question every keyboard scenario in this directory asks. It is
 * here once instead, in the form the older two already used — so a spec that
 * switches to it keeps reading exactly what it read before.
 *
 * Both are deliberately *reads*: they move nothing and assert nothing, so each
 * spec still says in its own words what it expects focus to be.
 */

/**
 * The focused element, named the way a failure message can be read: its
 * `data-testid`, else `#id`, else its tag. `'none'` when nothing has focus at
 * all — which is itself a failure every screen here is written against.
 */
export const focusedTestId = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return 'none';
    return (
      element.getAttribute('data-testid') ??
      (element.id !== '' ? `#${element.id}` : element.tagName.toLowerCase())
    );
  });

/** Is focus inside the element with this `data-testid`? */
export const focusIsInside = (page: Page, testId: string): Promise<boolean> =>
  page.evaluate(
    (id) => document.activeElement?.closest(`[data-testid="${id}"]`) !== null,
    testId,
  );
