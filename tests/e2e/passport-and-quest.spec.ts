import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * The two player-facing halves of what the game is for: **a quest to run, and a
 * passport to collect the stamps in** — on the shipped build, through the front
 * door a visitor actually opens.
 *
 * Neither screen existed. `TN-HUD-02`'s menu had offered "See my passport" since
 * slice 1 with nothing behind it, and `content/quests/` was empty while the
 * whole surface was built against the schema. So the assertions here are mostly
 * about **reachability**: a screen nobody can open is not a screen, which is the
 * defect this project keeps finding from both ends.
 *
 * Against `vite preview` at the real base path, like the rest of `tests/e2e`.
 */

/** Cold load to the title screen, with no URL parameter. */
async function frontDoor(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
  await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
}

/** The map, which is where the passport lives. */
async function theMap(page: Page): Promise<void> {
  await frontDoor(page);
  const play = page.locator('[data-testid="title-play"]');
  const choose = page.locator('[data-testid="title-choose-level"]');
  /* A first run goes through the creator; a returning one is offered the map
     directly. Either way this ends on the level select. */
  if (await choose.isVisible()) await choose.click();
  else {
    await play.click();
    const start = page.locator('[data-testid="start-playing"]');
    if (await start.isVisible()) await start.click();
  }
  await expect(page.locator('[data-testid="level-select"]')).toBeVisible();
}

async function intoTheLevel(page: Page): Promise<void> {
  await page.goto(`./?level=${START_LEVEL}`);
  await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');
  await expect(page.locator('[data-testid="hud"]')).toBeVisible();
}

test.describe('the passport, on the shipped build', () => {
  test('is reachable from a cold load, in two presses, from the map', async ({ page }) => {
    /*
     * `TN-PASSPORT-01`, and `OQ-PASSPORT-3`'s answer to "where does it live":
     * the map, because the stamp count is already drawn there. A returning
     * player should not have to remember a menu to find out how far they have
     * got.
     */
    await theMap(page);

    const open = page.locator('[data-testid="passport-open"]');
    await expect(open, 'the map offers no way into the passport').toBeVisible();
    await open.click();

    const passport = page.locator('[data-testid="passport"]');
    await expect(passport).toBeVisible();
    await expect(passport).toHaveAttribute('role', 'dialog');
    await expect(passport).toHaveAccessibleName('My passport');
    await expect(passport.locator('[data-testid="passport-slots"] > li')).toHaveCount(10);
  });

  test('looks like a beginning to a player who has earned nothing', async ({ page }) => {
    await theMap(page);
    await page.locator('[data-testid="passport-open"]').click();

    const passport = page.locator('[data-testid="passport"]');
    await expect(passport.locator('[data-testid="passport-empty"]')).toBeVisible();
    await expect(passport.locator('[data-testid="passport-counts"]')).toContainText(
      'Stamps: 0 of 10',
    );
    /* Nothing on it reads as an error: a build with four levels out of ten is a
       normal state of this game (`TN-PASSPORT-04`). */
    const wording = ((await passport.textContent()) ?? '').toLowerCase();
    for (const word of ['error', 'failed', 'missing', 'unavailable']) {
      expect(wording.includes(word), `the empty passport says "${word}"`).toBe(false);
    }
  });

  test('goes back to the map it was opened from, in the state it was left in', async ({
    page,
  }) => {
    await theMap(page);
    await page.locator('[data-testid="passport-open"]').click();
    await page.locator('[data-testid="passport-back"]').click();

    await expect(page.locator('[data-testid="passport"]')).toBeHidden();
    await expect(page.locator('[data-testid="level-select"]')).toBeVisible();
    /* Focus comes back to the control that opened it, never to the body. */
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
    ).toBe('passport-open');
  });

  test('is reachable from the level’s menu, and gives the level back', async ({ page }) => {
    /*
     * The trap this task was warned about, proved on the artefact: a modal over
     * a live scene has to release the level on the way out. The menu once took a
     * hold and never let go, and the level behind it stopped and would not
     * start — with nothing on screen saying why.
     */
    await intoTheLevel(page);
    await page.locator('[data-testid="menu-button"]').click();
    await page.locator('[data-testid="menu-passport"]').click();

    await expect(page.locator('[data-testid="passport"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await page.locator('[data-testid="passport-back"]').click();
    await expect(page.locator('[data-testid="passport"]')).toBeHidden();
    await expect(
      page.locator('html'),
      'the level was left frozen behind a passport that has gone',
    ).toHaveAttribute('data-tn-paused', 'false');
  });

  test('is French when the game is', async ({ page }) => {
    await theMap(page);
    await page.locator('[data-testid="level-select-back"]').click();
    await page.locator('[data-testid="title-settings"]').click();
    await page.locator('[data-testid="setting-language-fr"]').click();
    await page.locator('[data-testid="settings-close"]').click();
    await page.locator('[data-testid="title-choose-level"]').click();
    await page.locator('[data-testid="passport-open"]').click();

    const passport = page.locator('[data-testid="passport"]');
    await expect(passport).toHaveAccessibleName('Mon passeport');
    await expect(passport).toContainText('Tampons : 0 sur 10');
    await expect(passport, 'a passport stamp is a tampon, never a timbre').not.toContainText(
      'timbre',
    );
  });
});

test.describe('what is in reach, on the shipped build', () => {
  test('never draws a landmark’s name in the HUD', async ({ page }) => {
    /*
     * `TN-REACH-05`'s check, read the way it asks to be read: "the check reads
     * what the HUD draws at runtime, not only what a copy table declares". The
     * prompt used to carry the level document's own `pois[].name`, interpolated
     * at runtime — which is exactly how "CN Tower" reached a surface
     * `TN-NAMES-04` fails the build for without passing through a copy table at
     * all.
     *
     * The player is walked toward whatever this level puts in reach; whether one
     * is reached in the time allowed is not what is asserted. What is asserted is
     * that **whatever** the HUD ends up drawing contains no name from the list.
     */
    await intoTheLevel(page);

    const move = page.locator('[data-testid="move-right"]');
    if (await move.isVisible()) {
      await move.hover();
      await page.mouse.down();
      await page.waitForTimeout(2_500);
      await page.mouse.up();
    }

    const hud = ((await page.locator('[data-testid="hud"]').textContent()) ?? '').toLowerCase();
    for (const name of [
      'cn tower',
      'tour cn',
      'château frontenac',
      'chateau frontenac',
      'pier 21',
      'quai 21',
      'canada place',
      'toronto city hall',
      'town clock',
    ]) {
      expect(hud.includes(name), `the HUD draws "${name}"`).toBe(false);
    }

    /* And when something *is* in reach, the offer is a verb phrase from the copy
       table rather than a noun from the document. */
    const prompt = page.locator('[data-testid="interact-prompt"]');
    if (await prompt.isVisible()) {
      await expect(prompt).toHaveText(
        /^(Look at|Talk to|Done\.)/,
        { useInnerText: true },
      );
    }
  });
});
