import { expect, test } from '@playwright/test';

import { reachLevelSelect } from './front-door';
import { START_LEVEL } from './start-level';

/**
 * The level select says where the player is, through the production artefact.
 *
 * The player's report: "the map on the level selection doesn't look dynamic …
 * no matter if I am in Quebec, it doesn't show it." The marker followed the
 * first open card without a stamp, and nothing told the map where the player
 * had been. Two facts now reach it, and this walks both through the real
 * composition root and the real save:
 *
 *  - leaving a level by its menu opens the map from inside that level, so that
 *    level is where the player is;
 *  - opening the map from the title, in the same sitting or after a cold load,
 *    reads the level the save recorded as last played.
 *
 * No walk to the end of a level, so this stays fast. The two stamp-driven
 * changes, a new level marked and the line growing, are asserted in
 * `level-end-to-next.spec.ts`, which already pays for the walk.
 */
test.describe('the level select says where the player is', () => {
  test('marks the level left by its menu, then the level last played, without a reload', async ({
    page,
  }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();
    await expect(page.getByTestId('level-select')).toBeVisible();

    const here = page.getByTestId(`level-card-${START_LEVEL}-here`);
    await expect(here).toHaveText('You are here');
    await expect(page.locator('.tn-levels__here')).toHaveCount(1);
    await expect(
      page.locator('[data-testid="level-select-map"] [data-journey-current="true"]'),
    ).toHaveAttribute('data-map-handle', START_LEVEL);
    /* Nothing stamped yet, so the player has travelled nowhere but here. */
    await expect(page.getByTestId('level-select-map-route')).toHaveAttribute('data-map-legs', '0');

    /* Out to the title and back in: not from inside a level this time, so the
       save's last played level answers, and it is the same one. */
    await page.getByTestId('level-select-back').click();
    await reachLevelSelect(page);
    await expect(page.getByTestId(`level-card-${START_LEVEL}-here`)).toHaveText('You are here');

    /* And after a cold load, from what was saved. */
    await page.goto('./');
    await reachLevelSelect(page);
    await expect(page.getByTestId(`level-card-${START_LEVEL}-here`)).toHaveText('You are here');
    await expect(page.locator('.tn-levels__here')).toHaveCount(1);
  });
});
