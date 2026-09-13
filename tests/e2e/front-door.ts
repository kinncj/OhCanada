import { expect, type Page } from '@playwright/test';

/**
 * The way a player actually gets from a cold load to the level select, now that
 * the character creator is on the route.
 *
 * Not a spec file: `testMatch` in `tests/e2e/playwright.config.ts` is
 * `**\/*.spec.ts`, so this is a module the specs share — the same shape as
 * `./start-level.ts` and for the same reason.
 *
 * ## Why this exists
 *
 * Four specs had the same three lines: press whichever of "Play" and "Choose a
 * level" the title screen is offering, then press a card. That was the whole
 * route while no creator block was ever passed to the shell, which is to say
 * while `title.play` was a control the game contained and never drew.
 * `docs/stories/TN-FIRSTRUN-choosing-a-character-before-playing.md` is explicit
 * that mounting the creator **is** a title-screen change, so the specs that go
 * in through the front door gained a step and are updated rather than worked
 * around.
 *
 * The step costs a player one tap and no choice: the creator opens on a
 * complete randomised character and "Start playing" is live from the first
 * frame (`TN-FIRSTRUN-02`). {@link reachLevelSelect} touches no group, which is
 * deliberate — a helper that chose an appearance would make every spec above it
 * depend on an option id, and the specs above it are about levels.
 */

/**
 * Press the front door and come out on the level select, whichever branch this
 * browser's save puts the player on.
 *
 * A first run goes title → creator → level select; a returning player goes
 * title → level select. Both are handled, because a spec that assumed one would
 * fail on a save left behind by whatever ran before it.
 */
export async function reachLevelSelect(page: Page): Promise<void> {
  await page
    .locator('[data-testid="title-play"], [data-testid="title-choose-level"]')
    .first()
    .click();

  const creator = page.locator('[data-testid="character-creator"]');
  const select = page.locator('[data-testid="level-select"]');
  await expect(creator.or(select).first()).toBeVisible();

  if ((await creator.count()) > 0) {
    /* Chosen nothing, which is the claim `TN-FIRSTRUN-02` makes about this
       screen: one tap from arrival reaches a level. */
    await page.locator('[data-testid="start-playing"]').click();
  }

  await expect(select).toBeVisible();
}

/**
 * Get past the creator once, so the rest of a spec meets a returning player.
 *
 * For the specs whose subject is somewhere else entirely — the exam, the
 * passport — and which need "Choose a level" to be on the title screen. It
 * leaves the player on the title screen with a character in the save, which is
 * the state every one of those specs used to assume a cold load was in.
 */
export async function ensureCharacter(page: Page): Promise<void> {
  const play = page.locator('[data-testid="title-play"]');
  if ((await play.count()) === 0) return;
  await play.click();
  await page.locator('[data-testid="start-playing"]').click();
  await expect(page.locator('[data-testid="level-select"]')).toBeVisible();
  await page.locator('[data-testid="level-select-back"]').click();
  await expect(page.locator('[data-testid="title-choose-level"]')).toBeVisible();
}
