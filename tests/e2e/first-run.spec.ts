import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * `docs/stories/TN-FIRSTRUN-choosing-a-character-before-playing.md` and
 * `TN-CREATOR-character-creator.md`, on the artefact GitHub Pages serves.
 *
 * **What this proves that no unit test can.** `title.play` had been written,
 * translated and shipped since slice 1 and had never been drawn on a page: the
 * shell can only represent a first run when a creator block is passed to it, no
 * creator block was ever passed, and so every cold load took the
 * returning-player branch. Hundreds of appearances were in the payload and
 * nobody could choose between them. This suite is the route that changed —
 * title → creator → level select → level — with a real save in a real browser.
 *
 * The save is cleared before each test rather than after, because a failing run
 * that leaves a character behind would make the next run a returning player and
 * turn one failure into a green suite with a hole in it.
 */

const SLOT_SKIN = '[data-testid="slot-skin"]';

/** A browser that has never played: no save, so no character, so a first run. */
async function coldLoad(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
}

/** The trace `?e2e=1` installs. Read-only: a test may look, never steer. */
async function events(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const probe = (window as unknown as { __tnExam?: { events(): { name: string }[] } }).__tnExam;
    return (probe?.events() ?? []).map((entry) => entry.name);
  });
}

/** What the creator's picture is dressed in: the character the sitting holds. */
async function appearance(page: Page): Promise<Record<string, string | null>> {
  return page.getByTestId('character-preview').evaluate((node) => ({
    skin: node.getAttribute('data-skin'),
    hairShape: node.getAttribute('data-hair-shape'),
    hairColour: node.getAttribute('data-hair-colour'),
    headCovering: node.getAttribute('data-head-covering'),
    feature: node.getAttribute('data-feature'),
  }));
}

test.describe('a first run', () => {
  test('offers Play, which opens a creator that is already answered', async ({ page }) => {
    await coldLoad(page);

    /* `TN-FIRSTRUN-01`: the branch is decided by whether the save has a
       character, and by nothing else. */
    const play = page.getByTestId('title-play');
    await expect(play).toBeVisible();
    await expect(play).toHaveText('Play');
    await expect(play).toBeFocused();
    await expect(page.getByTestId('title-continue')).toHaveCount(0);
    await expect(page.getByTestId('title-choose-level')).toHaveCount(0);

    await play.click();

    await expect(page.getByTestId('character-creator')).toBeVisible();
    await expect(page.getByTestId('title-screen')).toHaveCount(0);
    await expect(page.getByTestId('character-creator').locator('h1')).toHaveText(
      'Make your character',
    );

    /* Six groups, twenty-two options, and every group already answered — the
       screen opens on a complete randomised character (`TN-LOOK-01`). The
       sixth group is `presentation`, which the shipped rig offers. */
    const groups = page.locator('[data-testid="character-creator"] [role="radiogroup"]');
    await expect(groups).toHaveCount(6);
    await expect(page.locator('[data-testid="character-creator"] [role="radio"]')).toHaveCount(22);
    await expect(
      page.locator('[data-testid="character-creator"] [role="radio"][aria-checked="true"]'),
    ).toHaveCount(6);

    /* And the way on is live before anything has been touched: nothing here is
       required, and there is no skip to be offered instead. */
    await expect(page.getByTestId('start-playing')).toBeEnabled();
    for (const refused of ['Skip', 'Later', 'No thanks', 'Maybe later']) {
      await expect(page.locator(`button:text-is("${refused}")`)).toHaveCount(0);
    }
  });

  test('reaches a level having chosen nothing, and the level draws what was on the screen', async ({
    page,
  }) => {
    /* `TN-FIRSTRUN-02`: three taps to a level, none of them a choice about how
       the player looks. */
    await page.goto('./?e2e=1');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    await page.getByTestId('title-play').click();
    const preview = page.getByTestId('character-preview');
    const chosen = await preview.evaluate((node) => ({
      skin: node.getAttribute('data-skin'),
      hairShape: node.getAttribute('data-hair-shape'),
      hairColour: node.getAttribute('data-hair-colour'),
      headCovering: node.getAttribute('data-head-covering'),
      feature: node.getAttribute('data-feature'),
    }));
    for (const [slot, option] of Object.entries(chosen)) {
      expect(option, `${slot} was not answered when the screen opened`).toBeTruthy();
    }

    await page.getByTestId('start-playing').click();

    /* `character/created` — not `character/changed` — and the save written. */
    const trace = await events(page);
    expect(trace).toContain('character/created');
    expect(trace).not.toContain('character/changed');
    expect(trace).toContain('progress/saved');

    await expect(page.getByTestId('level-select')).toBeVisible();
    await page.getByTestId(`level-card-${START_LEVEL}`).click();
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');
    await expect(page.getByTestId('hud')).toBeVisible();

    /*
     * The character that reached the level is the one that was on the screen,
     * and it survived being written down.
     *
     * Read back through the game rather than out of a storage key: the save
     * moved to IndexedDB and the codec owns its shape, so a test that opened
     * the bytes would be asserting a storage decision instead of the promise —
     * which is that the appearance the player saw is the appearance they keep.
     */
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-character').click();

    const kept = await page.getByTestId('character-preview').evaluate((node) => ({
      skin: node.getAttribute('data-skin'),
      hairShape: node.getAttribute('data-hair-shape'),
      hairColour: node.getAttribute('data-hair-colour'),
      headCovering: node.getAttribute('data-head-covering'),
      feature: node.getAttribute('data-feature'),
    }));
    expect(kept).toEqual(chosen);
  });

  test('never offers Play again once a character exists', async ({ page }) => {
    await coldLoad(page);
    await page.getByTestId('title-play').click();
    await page.getByTestId('start-playing').click();
    await expect(page.getByTestId('level-select')).toBeVisible();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    await expect(page.getByTestId('title-play')).toHaveCount(0);
    await expect(page.getByTestId('title-choose-level')).toBeVisible();
    await expect(page.getByTestId('character-creator')).toHaveCount(0);
  });

  test('Back leaves the creator having saved nothing, and Play is still the way in', async ({
    page,
  }) => {
    /* `TN-FIRSTRUN-03`: no confirmation, nothing saying anything was lost, and
       the player is still a first-run player. */
    await coldLoad(page);
    await page.getByTestId('title-play').click();
    await page.getByTestId('creator-back').click();

    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('character-creator')).toHaveCount(0);
    await expect(page.getByTestId('title-play')).toBeVisible();
    await expect(page.getByTestId('title-play')).toBeFocused();
    await expect(page.getByTestId('title-continue')).toHaveCount(0);
  });

  test('shows no face on the title screen until the player has chosen one', async ({ page }) => {
    /*
     * ADR-0053 rule 3: "a figure is painted from the save's character, and a
     * first run draws the landscape alone." The defect it removes was visible
     * on this exact route — Play, "Surprise me", Back — because the first-run
     * draw was made in `app/bootstrap/main.ts` and kept there as well as in the
     * shell: the title screen drew the face from *before* the re-roll while the
     * creator held the one after it. Two screens, two characters, one player.
     *
     * The fix is that there is nothing to disagree with: the title figure is
     * painted from the save's character, and on a first run there is none.
     */
    await coldLoad(page);

    const figure = page.getByTestId('title-figure');
    await expect(figure).toHaveAttribute('data-state', 'empty');
    await expect(figure).toBeHidden();

    await page.getByTestId('title-play').click();
    await page.getByTestId('randomise-character').click();
    const asked = await appearance(page);

    await page.getByTestId('creator-back').click();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(
      page.getByTestId('title-figure'),
      'the title screen drew a character the player has not accepted',
    ).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('title-figure')).toBeHidden();

    /* And the character the player did ask for is still the one they are given
       back, which is the other half of the same rule (`TN-LOOK-03`). */
    await page.getByTestId('title-play').click();
    expect(
      await appearance(page),
      'the creator opened on a character the player had replaced',
    ).toEqual(asked);

    /* Accepting one is what makes a figure: now the save has a character, so
       the screen before the creator has something of the player's to draw. */
    await page.getByTestId('start-playing').click();
    await expect(page.getByTestId('level-select')).toBeVisible();
    await page.getByTestId('level-select-back').click();
    await expect(page.getByTestId('title-figure')).not.toHaveAttribute('data-state', 'empty');
  });

  test('goes from the keyboard alone, and never leaves focus on the body', async ({ page }) => {
    /* `TN-FIRSTRUN-06`. */
    await coldLoad(page);
    await expect(page.getByTestId('title-play')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('character-creator')).toBeVisible();
    const inside = await page.evaluate(() =>
      document
        .querySelector('[data-testid="character-creator"]')
        ?.contains(document.activeElement),
    );
    expect(inside, 'focus was not put inside the creator').toBe(true);

    /* Escape means back, and never means quit. */
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('title-play')).toBeFocused();
  });

  test('announces each screen once, through the one live region', async ({ page }) => {
    /* `TN-FIRSTRUN-07`: "exactly one element on the page has an `aria-live`
       attribute at every step", and the canvas is never read. */
    await coldLoad(page);
    const live = page.locator('[aria-live]');
    await expect(live).toHaveCount(1);

    await page.getByTestId('title-play').click();
    await expect(live).toHaveCount(1);
    /* Two canvases now: the game's, and the creator's picture (ADR-0040). Both
       are read by nobody. Scoped, because a locator matching two elements is a
       strict-mode failure rather than an answer. */
    await expect(page.locator('#game canvas')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-testid="character-preview-art"] canvas')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    await page.getByTestId('start-playing').click();
    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(live).toHaveCount(1);
  });

  test('is French end to end when the language is French', async ({ page }) => {
    /* `TN-FIRSTRUN-09`. The language is chosen before Play, from the title
       screen's own Settings, which is the one step earlier `TN-TITLE` puts it. */
    await coldLoad(page);
    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-language-fr').click();
    await page.getByTestId('settings-close').click();

    await expect(page.getByTestId('title-play')).toHaveText('Jouer');
    await page.getByTestId('title-play').click();

    const creator = page.getByTestId('character-creator');
    await expect(creator.locator('h1')).toHaveText('Créez votre personnage');
    await expect(page.getByTestId('randomise-character')).toHaveText('Au hasard');
    await expect(page.getByTestId('start-playing')).toHaveText('Commencer à jouer');
    await expect(page.getByTestId('creator-back')).toHaveText('Retour');
    await expect(page.getByTestId('creator-settings')).toHaveText('Réglages');
    await expect(creator).toHaveAttribute('lang', 'fr');
  });
});

test.describe('changing a character, later, which is what the intro promised', () => {
  test('Settings offers the way back in, and Done returns to Settings', async ({ page }) => {
    await page.goto('./?e2e=1');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.getByTestId('title-play').click();
    await page.getByTestId('start-playing').click();
    await expect(page.getByTestId('level-select')).toBeVisible();
    await page.getByTestId('level-select-back').click();

    await page.getByTestId('title-settings').click();
    const item = page.getByTestId('setting-character');
    await expect(item).toBeVisible();
    await expect(item).toHaveText('Change my character');

    await item.click();
    await expect(page.getByTestId('character-creator')).toBeVisible();

    /* It opens on the character the player has, and its primary control is
       named for where it goes (`TN-FIRSTRUN-04`). */
    await expect(
      page.locator('[data-testid="character-creator"] [role="radio"][aria-checked="true"]'),
    ).toHaveCount(6);
    await expect(page.getByTestId('creator-done')).toBeVisible();
    await expect(page.getByTestId('start-playing')).toHaveCount(0);

    const tones = page.locator(`${SLOT_SKIN} [role="radio"]`);
    await tones.nth(5).click();
    await page.getByTestId('creator-done').click();

    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page.getByTestId('setting-character')).toBeFocused();

    const trace = await events(page);
    expect(trace).toContain('character/changed');
    /* The first-run route ran once, and changing a character did not re-run it. */
    expect(trace.filter((name) => name === 'character/created')).toHaveLength(1);

    /*
     * Wait for the write before reloading. The assertion below is about what the
     * store kept, and a reload that beats the write reads a game with no
     * character: the creator then opens on a fresh draw and the chosen tone is
     * not checked. That is what failed here on a loaded runner while the same
     * spec passed five times elsewhere - a race, not a regression, and the
     * second one of this shape found today.
     *
     * `exam.spec.ts` already waits on this event. The save after the change is
     * the one that matters, so this waits for a `progress/saved` that follows
     * the `character/changed` rather than for any save at all - the first run
     * wrote one before this test ever clicked Done.
     */
    await page.waitForFunction(() => {
      const probe = (window as unknown as { __tnExam?: { events(): { name: string }[] } }).__tnExam;
      const names = (probe?.events() ?? []).map((entry) => entry.name);
      return names.lastIndexOf('progress/saved') > names.lastIndexOf('character/changed');
    });

    /* And it survives a reload, which is the only proof the save was written. */
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-character').click();
    await expect(page.locator(`${SLOT_SKIN} [role="radio"]`).nth(5)).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('comes back to the creator with the choices intact, and focus where it was', async ({
    page,
  }) => {
    /* `TN-CREATOR-11`: a first-run player who needs one-button mode or 200 %
       text needs Settings *here*, and reaching it must not cost them the
       character they were making. */
    await coldLoad(page);
    await page.getByTestId('title-play').click();
    await page.locator(`${SLOT_SKIN} [role="radio"]`).nth(4).click();

    await page.getByTestId('creator-settings').click();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await page.getByTestId('settings-close').click();

    await expect(page.getByTestId('character-creator')).toBeVisible();
    await expect(page.locator(`${SLOT_SKIN} [role="radio"]`).nth(4)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('creator-settings')).toBeFocused();
  });

  test('offers no route from the creator into the creator', async ({ page }) => {
    /* `TN-CREATOR-11` and `OQ-CREATOR-7`: a cycle is harmless for a pointer and
       a trap for a switch user, who cannot see the depth they are at. */
    await coldLoad(page);
    await page.getByTestId('title-play').click();
    await page.getByTestId('creator-settings').click();

    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page.getByTestId('setting-character')).toHaveCount(0);
  });
});
