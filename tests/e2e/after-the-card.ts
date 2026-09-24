import { expect, type Page } from '@playwright/test';

/**
 * What a stop draws after the landmark's own card, when it is a lesson.
 *
 * Not a spec file: `testMatch` in `tests/e2e/playwright.config.ts` is
 * `**\/*.spec.ts`, so this is a module the specs share — the same shape as
 * `./start-level.ts` and `./walk.ts`.
 *
 * ## Why this exists
 *
 * One engagement finishes every step waiting at a stop (ADR-0067), and the
 * composition root runs that chain in one order: the place's card, then the
 * passages a `read` step names in the lesson reader, then the step's lines, then
 * the question. Whether the reader opens is the quest document's business — a
 * stop reads when its level's task puts a `read` step there and the task is
 * running — so a walk that asserted it would have to be edited whenever an
 * author adds or moves one. {@link closeTheReaderIfItOpens} is the unit
 * `walkPast` helper's rule in `tests/unit/bootstrap/front-door.test.ts`:
 * dismissed only if it opened. What the reader shows is asserted where it is
 * the subject (`learn.spec.ts`, `tests/a11y/lesson-reader.spec.ts`).
 */

/**
 * Wait for whatever follows a landmark card that has just been closed, and
 * close the lesson reader if that is what it was.
 *
 * Resolves once the reader is shut, or once something else followed the card
 * — the step's line, the question, or the level running again — leaving that
 * for the caller. `true` when the reader opened and was closed.
 */
export async function closeTheReaderIfItOpens(page: Page, timeoutMs = 15_000): Promise<boolean> {
  const reader = page.getByTestId('lesson-reader');
  const followed = await Promise.race([
    reader
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => 'reader' as const)
      .catch(() => null),
    page
      .getByTestId('dialogue')
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => 'other' as const)
      .catch(() => null),
    page
      .getByTestId('question-card')
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => 'other' as const)
      .catch(() => null),
    page
      .waitForSelector('html[data-tn-paused="false"]', { timeout: timeoutMs })
      .then(() => 'other' as const)
      .catch(() => null),
  ]);
  if (followed !== 'reader') return false;
  await page.getByTestId('lesson-reader-close').click();
  await expect(reader).toBeHidden();
  return true;
}
