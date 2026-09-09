import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * The two things a player could not do on the shipped build, done on the
 * shipped build.
 *
 * 1. **Study.** `app/ui/study-screen.ts`, `app/ui/question-card.ts` and
 *    `app/application/use-cases/study-session.ts` were all finished and none of
 *    them had a caller: `app/bootstrap/main.ts` carried a comment where the
 *    option would go. So the game contained 253 verified questions and could ask
 *    none of them. This suite runs a whole drill against the real bundled bank,
 *    through the production artefact, and reads the summary.
 * 2. **Settings, from inside a level.** It was mounted, behind the menu, and was
 *    reported as unreachable — which is what "behind a menu nobody opens" means.
 *
 * Against `vite preview` at the real base path, like the rest of `tests/e2e`:
 * what is proved here is the page a visitor opens, not a harness.
 */

/** Cold load to the title screen, with no URL parameter. */
async function frontDoor(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
  await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
}

test.describe('Study, on the shipped build', () => {
  test('is offered on the title screen and opens on a real count', async ({ page }) => {
    await frontDoor(page);

    const open = page.locator('[data-testid="title-study"]');
    await expect(
      open,
      'the shell hides an absent option rather than drawing a dead control, so a ' +
        'missing Study button is a game with no Study in it',
    ).toBeVisible();
    await open.click();

    const study = page.locator('[data-testid="study-screen"]');
    await expect(study).toBeVisible();
    await expect(study).toHaveAttribute('role', 'dialog');
    await expect(study).toHaveAccessibleName(/\S/);

    /*
     * A count, drawn from the bank that actually downloaded — not a placeholder.
     * The number is the config's drill size and the wording is the plural rule's,
     * so the assertion is on the shape rather than on a literal.
     */
    const count = study.locator('[data-testid="study-count"]');
    await expect(count).toBeVisible();
    await expect(count).toHaveText(/\d+ questions?/);
    await expect(study.locator('[data-testid="study-start"]')).toBeVisible();
  });

  test('runs a whole drill and says how it went, with no score that follows the player', async ({
    page,
  }) => {
    await frontDoor(page);
    await page.locator('[data-testid="title-study"]').click();
    await page.locator('[data-testid="study-start"]').click();

    const card = page.locator('[data-testid="question-card"]');
    await expect(card).toBeVisible();

    const progress = card.locator('[data-testid="question-progress"]');
    await expect(progress).toHaveText(/^Question 1 of \d+$/);
    const total = Number(/of (\d+)/.exec((await progress.textContent()) ?? '')?.[1] ?? '0');
    expect(total, 'a drill of nothing is not a drill').toBeGreaterThan(0);

    for (let asked = 0; asked < total; asked += 1) {
      await expect(progress).toHaveText(`Question ${String(asked + 1)} of ${String(total)}`);
      /* Four options, in the authored order, every one of them a real target. */
      await expect(card.locator('[data-testid^="option-"]')).toHaveCount(4);
      await card.locator('[data-testid="option-0"]').click();

      /* Answering explains, either way — that is the whole point of a study
         tool, and it is what `TN-CARD` calls learning from the answer. */
      const feedback = card.locator('[data-testid="question-feedback"]');
      await expect(feedback).toBeVisible();
      await expect(feedback).toContainText(/That's right!|Not quite\./);
      await card.locator('[data-testid="question-next"]').click();
    }

    const summary = page.locator('[data-testid="study-summary"]');
    await expect(summary).toBeVisible();
    await expect(summary.locator('[data-testid="study-summary-score"]')).toHaveText(
      new RegExp(`You got \\d+ out of ${String(total)} right\\.`),
    );
    /* `TN-STUDY-04`: no percentage, grade, streak or star rating. */
    await expect(summary).not.toContainText('%');
    await expect(page.locator('[data-testid="study-again"]')).toBeVisible();

    /* And the way back is real: Study closes and the title screen is there. */
    await page.locator('[data-testid="study-exit"]').click();
    await expect(page.locator('[data-testid="study-screen"]')).toBeHidden();
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
  });

  test('is reachable from inside a level too, and never explains itself', async ({ page }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    await page.locator('[data-testid="menu-button"]').click();
    await page.locator('[data-testid="menu-study"]').click();

    const study = page.locator('[data-testid="study-screen"]');
    await expect(study).toBeVisible();
    /* The level stops while a screen owns the page. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    /*
     * `TN-CARD-02` and `TN-STUDY-02`: the player is never told how the questions
     * were chosen. The ban is on the words, in both languages, on every string
     * this screen can draw.
     */
    const wording = ((await study.textContent()) ?? '').toLowerCase();
    for (const banned of ['spaced repetition', 'fsrs', 'algorithm', 'interval', 'due']) {
      expect(wording, `"${banned}" is scheduler vocabulary and belongs to nobody but us`).not.toContain(
        banned,
      );
    }

    await page.locator('[data-testid="study-exit"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
  });
});

test.describe('Settings, from inside the game', () => {
  test('is a control on the strip, not only an item in a menu', async ({ page }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    const control = page.locator('[data-testid="hud-settings-button"]');
    await expect(
      control,
      'settings was mounted and was reported as unreachable, which is what a control ' +
        'behind a menu nobody opens amounts to',
    ).toBeVisible();
    await expect(control).toHaveText('Settings');

    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

    await control.click();
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');
  });

  test('comes back to the level when it is closed', async ({ page }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    await page.locator('[data-testid="hud-settings-button"]').click();
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="settings-screen"]')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
    /* Focus back on the control that opened it, not on the body. */
    await expect(page.locator('[data-testid="hud-settings-button"]')).toBeFocused();
  });

  test('is still in the menu, so neither route was taken away', async ({ page }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    await page.locator('[data-testid="menu-button"]').click();
    await page.locator('[data-testid="menu-settings"]').click();
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();
  });

  /**
   * The level starts again after a screen opened from the menu closes.
   *
   * It did not. `app/ui/menu.ts` deliberately does not resume when an item is
   * chosen — "the game does not resume behind an open screen" — and the screen
   * that opens takes its own pause reason. Nobody let go of the *menu's*, so a
   * player who opened Settings from the menu and closed it again was left in a
   * level that had stopped and would not start, with nothing on screen saying
   * why. Found by this suite; the fix is in `app/bootstrap/main.ts`.
   */
  test('lets the level start again after being opened from the menu', async ({ page }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    await page.locator('[data-testid="menu-button"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');
    await page.locator('[data-testid="menu-settings"]').click();
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="settings-screen"]')).toBeHidden();
    await expect(
      page.locator('html'),
      'the menu was still holding the level after handing it to another screen',
    ).toHaveAttribute('data-tn-paused', 'false');
  });

  test('changes the language of the level around it, without a reload', async ({ page }) => {
    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    await page.locator('[data-testid="hud-settings-button"]').click();
    await page.locator('[data-testid="setting-language-fr"]').click();

    await expect(page.locator('[data-testid="hud-settings-button"]')).toHaveText('Réglages');
    await expect(page.locator('[data-testid="menu-button"]')).toHaveText('Menu');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});

/**
 * The learning moment, walked on the shipped build.
 *
 * `TN-LEVEL-05` and `TN-CARD-01`: reach a landmark, learn something true about
 * it, be asked a question, and be told why the answer is the answer. Every piece
 * of that existed and none of it was joined: the interact prompt was never
 * shown, because `targets` was never passed to the announcer; the landmark card
 * closed straight back to the ice; and the question card had no caller anywhere
 * under `app/`.
 *
 * Everything below is DOM. The walk is `ArrowRight` and the signal that the
 * player arrived is the prompt appearing — no scene probe, no camera arithmetic,
 * so this suite says nothing about how the level is drawn and cannot break when
 * that changes.
 */
test.describe('reaching a landmark teaches, then asks', () => {
  test('prompt, fact, question, explanation, and back to the level', async ({ page }) => {
    /*
     * A traversal on a software rasteriser, not a computation: the landmark is
     * two thousand design pixels down the waterfront and this suite renders on
     * SwiftShader with several browsers on one machine. The waits below are
     * generous for that reason and for no other — nothing here asserts how long
     * the walk took, only that it arrives and what happens when it does.
     */
    test.slow();

    await page.goto(`./?level=${START_LEVEL}`);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    /*
     * Walk until something comes into reach. The prompt is the *only* thing
     * being waited on, so a level that never offers one fails here — which is
     * the state the game was in.
     *
     * Walked in short bursts rather than one long hold, and both halves of that
     * are defects this suite found rather than defensive noise:
     *
     *  - a single `keyboard.down` fired the instant `data-tn-level` becomes
     *    `ready` is sometimes dropped — the scene tells the DOM it is playable a
     *    frame or two before its keyboard input is listening — and a `held`
     *    drive has no repeat, so the player then stands still for the whole
     *    timeout. Pressing again is what a player does when nothing happens;
     *  - a player still walking when the prompt appears walks straight out of
     *    reach again, and the control is detached under the click. Releasing at
     *    the end of every burst means the check is made from a standstill.
     */
    const prompt = page.locator('[data-testid="interact-prompt"]');
    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(600);
      await page.keyboard.up('ArrowRight');
      if (await prompt.isVisible()) break;
    }
    await expect(
      prompt,
      'nothing was ever offered: the player walked past a landmark in silence',
    ).toBeVisible();

    /* The label is the landmark's own name from the level document — content, in
       the player's language — because no `hud.interact.*` copy row exists. */
    await expect(prompt).toHaveText(/\S/);
    const box = await prompt.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    /* Tapping the prompt does what tapping the landmark does (`TN-LEVEL-05`). */
    await prompt.click();

    const poi = page.locator('[data-testid="poi-card"]');
    await expect(poi).toBeVisible();
    await expect(poi).toHaveAttribute('role', 'dialog');
    await expect(poi).toHaveAccessibleName(/\S/);
    /* A sentence, not a caption: the blurb is a sourced fact about Canada, and a
       landmark that teaches nothing is scenery. */
    expect(
      ((await poi.textContent()) ?? '').length,
      'the landmark card carried no fact',
    ).toBeGreaterThan(60);
    /* The game does not move while a card is open. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await page.locator('[data-testid="poi-card-close"]').click();

    /* And then the assessment half, which is what makes this a study tool. */
    const card = page.locator('[data-testid="question-card"]');
    await expect(
      card,
      'the landmark taught something and asked nothing: the level has no way to assess',
    ).toBeVisible({ timeout: 15_000 });
    await expect(card.locator('[data-testid="question-progress"]')).toHaveText('Question 1 of 1');
    await expect(card.locator('[data-testid^="option-"]')).toHaveCount(4);
    /* Still paused: one hold covers the card and the question, so the game never
       moves in the gap between the two dialogs. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await card.locator('[data-testid="option-0"]').click();

    const feedback = card.locator('[data-testid="question-feedback"]');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/That's right!|Not quite\./);
    await expect(
      card.locator('[data-testid="question-explanation"]'),
      'the answer was judged and never explained, which is the half a study tool is for',
    ).toBeVisible();

    /* One question, so the control finishes rather than promising another. */
    const next = card.locator('[data-testid="question-next"]');
    await expect(next).toHaveText('Finish');
    await next.click();

    await expect(card).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
    await expect(page.locator('[data-testid="hud"]')).toBeVisible();
  });
});
