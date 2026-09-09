import { expect, test, type Page } from '@playwright/test';

import {
  NEXT_LEVEL,
  NEXT_LEVEL_MODE_LABEL,
  NEXT_LEVEL_PLAY_LABEL,
  START_LEVEL,
  START_LEVEL_MODE_LABEL,
} from './start-level';

/**
 * "Once you reach the end of a level, it should send you to a new level."
 *
 * The whole route, through the production artefact, with nothing stubbed: a
 * player walks from the spawn to the end of the world, the scene notices, the
 * composition root writes the stamp, the unlock rule opens the next place and
 * the card that says so offers a way straight into it.
 *
 * ## Why this file exists when three suites already cover the pieces
 *
 * Because every piece was covered and the feature did not work. The completion
 * card had a suite, an axe scan and a harness page; the stamp had a domain test
 * named for its idempotence; the unlock rule had a contract test walking the
 * whole chain. What none of them could see was that **nothing raised the
 * signal**: a stamp was earned only by an answer completing a quest's `answer`
 * step, and every level document declares `"quests": []`, so the card was
 * reachable by no sequence of play. A suite of green units over a dead wire is
 * this project's recurring defect, and the only test that could have caught it
 * is one that starts at the spawn and ends in another level.
 *
 * ## What is asserted, and what is deliberately not
 *
 * Asserted: the arrival happens by walking (not by a test hook), the level stops
 * while the card is up, the card names the level that opened, one press lands
 * the player *in* that level, and walking to the end twice draws one card.
 *
 * Not asserted: where the exit line is. That is
 * `tests/unit/adapters/phaser/level-exit.test.ts`'s, over every shipped level
 * with the real locomotion and the real camera — arithmetic proved once in a
 * browser is arithmetic proved on one machine at one frame rate.
 *
 * The level ids are read from `content/game.config.json` and `content/levels/`
 * (see `start-level.ts`), never typed, so this suite follows the game as it
 * grows instead of being edited every time the chain changes.
 */

if (NEXT_LEVEL === null || NEXT_LEVEL_PLAY_LABEL === null) {
  throw new Error(
    `finishing "${START_LEVEL}" opens no level this build has a document for, so there is ` +
      'no "send you to a new level" to walk. Either the unlock chain is broken (see ' +
      'tests/unit/contracts/unlock-chain-is-reachable.test.ts) or this build ships one ' +
      'level, and this suite has nothing to assert.',
  );
}

/**
 * The end of a level is a **walk**, and that costs real time.
 *
 * The exit line is half a camera view short of the far wall, which in the levels
 * that ship is thousands of world pixels from the spawn at a few hundred pixels
 * a second — fifteen simulated seconds or so. `MAX_STEP_SECONDS` clamps a frame
 * to 1/30 s, so a browser rendering on SwiftShader at a fraction of 60 fps
 * advances the simulation at that same fraction of real time: the walk takes as
 * long as the machine makes it take.
 *
 * Two consequences, both settings rather than assertions:
 *
 *  - a generous timeout, because a slow walk is a slow machine and not a defect;
 *  - **serial**, so the three walks in this file do not compete with each other
 *    for the CPU they are all waiting on. Every scenario below therefore does as
 *    much as it can with one walk instead of starting a fresh one per assertion.
 */
test.describe.configure({ mode: 'serial', timeout: 300_000 });

const LEVEL_URL = `./?level=${START_LEVEL}`;

/** Open the level and wait until it is really playable. */
async function openLevel(page: Page, url = LEVEL_URL): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
}

/**
 * Walk right until the completion card arrives.
 *
 * The key is held rather than tapped because that is how the game is played, and
 * it is released **after** the card appears: a player does not let go the instant
 * they arrive, and a card that only opened because the input stopped would be a
 * different feature.
 */
async function walkToTheEnd(page: Page): Promise<void> {
  const card = page.getByTestId('quest-complete-card');
  await page.keyboard.down('ArrowRight');
  try {
    await expect(
      card,
      `walking right in ${START_LEVEL} never reached the end of the level. The scene ` +
        'publishes `level/exitReached` when the player crosses the line; if that never ' +
        'arrives, either the walk is not moving or the milestone is not wired to the ' +
        'composition root.',
    ).toBeVisible({ timeout: 240_000 });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
}

test.describe('reaching the end of a level sends the player to a new one', () => {
  test('walks to the end, finishes the level, and offers the level that opened', async ({
    page,
  }) => {
    await openLevel(page);

    const card = page.getByTestId('quest-complete-card');
    await expect(card, 'the card was up before the player had gone anywhere').toBeHidden();

    await walkToTheEnd(page);

    /*
     * The heading says what actually finished. No task was offered or accepted
     * on this walk, so "Task done!" would be a claim about something the player
     * never did — the defect `TN-DONE` was written for, on the first card the
     * shipped game draws (`OQ-DONE-1`).
     */
    await expect(card).toHaveAccessibleName('Level finished!');
    /*
     * And it says plainly that nothing was answered, rather than scoring a level
     * nobody answered anything in. One slot, two rows, never both and never
     * empty — and the sentence carries no number, so "0 out of 0" cannot be
     * drawn (`TN-DONE-02`).
     */
    const line = card.getByTestId('quest-complete-progress');
    await expect(line).toHaveText(
      'You did not answer any questions here. Every place in this level has something to teach you.',
    );
    await expect(line).not.toContainText('0 out of 0');

    /* The level that just opened: a label that says what pressing does,
       described in the map's own words. */
    const play = card.getByTestId('quest-complete-next');
    await expect(play).toHaveText(NEXT_LEVEL_PLAY_LABEL ?? '');
    await expect(card.getByTestId('quest-complete-next-level')).toContainText(
      'You can play this now.',
    );

    /* And the level is stopped behind it: a dialog over a live scene is a game
       that moves under a card the player is reading. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');
  });

  test('one press lands the player in the new level, and back still goes to the map', async ({
    page,
  }) => {
    await openLevel(page);
    await walkToTheEnd(page);

    await page.getByTestId('quest-complete-next').click();

    /* The map is never drawn on the way: the card offers it, the player did not
       take it. */
    await expect(page.getByTestId('level-select')).toHaveCount(0);
    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });

    /*
     * It is really the *other* level. The two declare different locomotion, so
     * the mode strip is the fact that tells them apart from outside the game —
     * an assertion that "a level loaded" would pass on the first one reloading.
     */
    if (NEXT_LEVEL_MODE_LABEL !== null) {
      await expect(page.getByTestId('hud-mode-label')).toHaveText(NEXT_LEVEL_MODE_LABEL);
      expect(NEXT_LEVEL_MODE_LABEL).not.toBe(START_LEVEL_MODE_LABEL);
    }

    /* One `<main>`, with the canvas inside it, exactly as on any other level:
       the level that was left took its landmark away with it. */
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main canvas')).toHaveCount(1);
    /* And the game is running again — the completion card's pause went with the
       level it belonged to. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    /*
     * Leaving the new level goes to the map, on the card just left.
     * `TN-FLOW`'s one rule is about going *back* — "one step up the route, and
     * never further" — and going forward into a level without passing the map
     * must not have moved it.
     */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();

    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}`)).toBeFocused();
  });

  test('finishing twice is still one card, and the map really has the new one', async ({
    page,
  }) => {
    await openLevel(page);
    await walkToTheEnd(page);

    /* Back into the level, then push into the end of the world again. The stamp
       is idempotent in the domain and the card is idempotent on the screen. */
    await page.getByTestId('quest-complete-keep-playing').click();
    await expect(page.getByTestId('quest-complete-card')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(5_000);
    await page.keyboard.up('ArrowRight');

    await expect(
      page.getByTestId('quest-complete-card'),
      'a level finished twice is one stamp, one unlock and one card',
    ).toBeHidden();

    /* Out by the menu, which is the route that does not go through the card at
       all: the news is a fact about the save, so it survives the way out. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();

    await expect(page.getByTestId('level-select')).toBeVisible();
    const opened = page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}`);
    /* Landed on, not merely present: the news is the new card, so that is where
       the player is put (`TN-MAP-03`, `TN-FLOW-03`). */
    await expect(opened).toBeFocused();
    await expect(opened).toHaveAttribute('data-state', 'open');
    /* And the level just finished carries its stamp, as a word rather than a
       colour (`TN-MAP-01`). */
    await expect(page.getByTestId(`level-card-${START_LEVEL}-stamp`)).toBeVisible();
  });
});
