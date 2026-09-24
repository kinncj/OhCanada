import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { closeTheReaderIfItOpens } from './after-the-card';
import { finishedSave, oneAnswerFromDoneSave, seed, type SeededQuest } from './saves';
import {
  JOURNEY,
  NEXT_LEVEL,
  NEXT_LEVEL_MODE_LABEL,
  NEXT_LEVEL_PLAY_LABEL,
  START_LEVEL,
  START_LEVEL_MODE_LABEL,
} from './start-level';
import { walkInLegs } from './walk';

/**
 * "Once you reach the end of a level, it should send you to a new level" — and,
 * since ADR-0036, only a level whose task is done.
 *
 * The whole route, through the production artefact, with nothing stubbed: the
 * scene notices the player at the end of the world, the composition root decides
 * what that arrival is worth, the unlock rule opens the next place when a stamp
 * was written, and the card that says so offers a way straight into it.
 *
 * ## Why this file exists when three suites already cover the pieces
 *
 * Because every piece was covered and the feature did not work: a suite of green
 * units over a dead wire is this project's recurring defect, and the only test
 * that could catch it starts at the spawn and ends in another level.
 *
 * ## What changed with ADR-0036
 *
 * Walking to the end used to earn the stamp whatever the player had done. A
 * play-through read "You earned the Ottawa stamp. You did not answer any
 * questions here." under a passport that promises a stamp for finishing a
 * level's task. So the three walks are now:
 *
 *  1. **the end with the task not done** — no stamp, no next level, and a card
 *     that says what is left and gives the level back;
 *  2. **the task finished** — from a save one answer short of it, so the walk is
 *     the giver and one landmark — which opens the next level, and one press
 *     lands the player in it;
 *  3. **the end of a level already finished** — since ADR-0073, straight into
 *     the next level, with no card: the card already said the level was done.
 *
 * Not asserted: where the exit line is. That is
 * `tests/unit/adapters/phaser/level-exit.test.ts`'s, over every shipped level
 * with the real locomotion and the real camera.
 *
 * The level ids are read from `content/game.config.json` and `content/levels/`
 * (see `start-level.ts`), never typed, so this suite follows the game as it grows.
 */

if (NEXT_LEVEL === null || NEXT_LEVEL_PLAY_LABEL === null) {
  throw new Error(
    `finishing "${START_LEVEL}" opens no level this build has a document for, so there is ` +
      'no "send you to a new level" to walk. Either the unlock chain is broken (see ' +
      'tests/unit/contracts/unlock-chain-is-reachable.test.ts) or this build ships one ' +
      'level, and this suite has nothing to assert.',
  );
}

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

interface QuestFile extends SeededQuest {
  readonly giver: string;
}

interface LevelFile {
  readonly characters: readonly { readonly questId?: string }[];
}

/**
 * The quest the start level's character gives, found from the level's own
 * document. The start level must set a task: without one, reaching its end earns
 * the stamp outright (ADR-0036) and the first walk below is about another rule.
 */
const START_QUEST: QuestFile = ((): QuestFile => {
  const level = json<LevelFile>(`content/levels/${START_LEVEL}.json`);
  const questId = level.characters.find((character) => character.questId !== undefined)?.questId;
  if (questId === undefined) {
    throw new Error(
      `content/levels/${START_LEVEL}.json places no character with a quest, so this suite has ` +
        'no task to leave undone and none to finish.',
    );
  }
  return json<QuestFile>(`content/quests/${questId}.json`);
})();

const STAMP_SENTENCE = text('en', `stamp.${START_LEVEL}.earned` as Parameters<typeof text>[1]);
const GIVER_PROMPT = text('en', `hud.interact.${START_QUEST.giver}` as Parameters<typeof text>[1]);
const DONE_PROMPT = text('en', 'hud.interact.done');

/**
 * The end of a level is a **walk**, and that costs real time: thousands of world
 * pixels at a few hundred a second, at whatever fraction of 60 fps SwiftShader
 * manages. A generous timeout, and **serial**, so the walks do not compete for
 * the CPU they are all waiting on.
 */
test.describe.configure({ mode: 'serial', timeout: 300_000 });

const LEVEL_URL = `./?level=${START_LEVEL}`;

/** Open the level and wait until it is really playable. */
async function openLevel(page: Page, url = LEVEL_URL): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
}

/**
 * Walk right until the card at the end of the level arrives.
 *
 * Held in legs, because a held drive comes to rest at every landmark and
 * character on the way and waits there for the player to let go and press again
 * (ADR-0032). The leg that sees the card is released after it appears: a player
 * does not let go the instant they arrive.
 */
async function walkToTheEnd(page: Page): Promise<void> {
  const card = page.getByTestId('quest-complete-card');
  const arrived = await walkInLegs(
    page,
    'ArrowRight',
    (legMs) =>
      card
        .waitFor({ state: 'visible', timeout: legMs })
        .then(() => true)
        .catch(() => null),
    { budgetMs: 240_000 },
  );
  expect(
    arrived,
    `walking right in ${START_LEVEL} never reached the end of the level. The scene ` +
      'publishes `level/exitReached` when the player crosses the line; if that never ' +
      'arrives, either the walk is not moving or the milestone is not wired to the ' +
      'composition root.',
  ).toBe(true);
  await expect(card).toBeVisible();
}

/**
 * Walk right, watching the HUD in the page, until it offers something not in
 * `ignore`. `'card'` when the level ended first, `null` when time ran out. The
 * in-page watching `quest-moments.spec.ts` uses, for the reason it gives: a round
 * trip per sample walks straight past a narrow reach band.
 */
async function walkRightPast(page: Page, ignore: readonly string[]): Promise<string | null> {
  return walkInLegs(
    page,
    'ArrowRight',
    (legMs) =>
      page.evaluate(
        async ({ skip, budget }) => {
          const deadline = performance.now() + budget;
          while (performance.now() < deadline) {
            const card = document.querySelector('[data-testid="quest-complete-card"]');
            if (card !== null && (card as HTMLElement).checkVisibility()) return 'card';
            const prompt = document.querySelector('[data-testid="interact-prompt"]');
            if (prompt !== null && (prompt as HTMLElement).checkVisibility()) {
              const offered = prompt.textContent ?? '';
              if (!skip.includes(offered)) return offered;
            }
            await new Promise((resolve) => {
              requestAnimationFrame(() => {
                resolve(null);
              });
            });
          }
          return null;
        },
        { skip: [...ignore], budget: legMs },
      ),
    { budgetMs: 60_000 },
  );
}

/**
 * Engage what is in reach and answer everything it asks.
 *
 * The landmark's card first, then the step's line when there is one, then every
 * question: an `answer` step asks all it has left in one go (ADR-0036), so the
 * card is answered until it goes. The first option each time — what is asserted
 * is that the answer counts, never whether it was right.
 */
async function answerWhatTheLandmarkAsks(page: Page): Promise<void> {
  const poi = page.getByTestId('poi-card');
  const dialogue = page.getByTestId('dialogue');
  const question = page.getByTestId('question-card');

  await page.getByTestId('interact-prompt').click();
  await expect(poi).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('poi-card-close').click();
  await closeTheReaderIfItOpens(page);

  const opened = await Promise.race([
    dialogue
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'dialogue' as const)
      .catch(() => null),
    question
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'question' as const)
      .catch(() => null),
  ]);
  if (opened === 'dialogue') {
    await page.getByTestId('dialogue-next').click();
  }
  await expect(question, 'the landmark asked nothing, so no answer could finish the task')
    .toBeVisible({ timeout: 15_000 });

  for (let asked = 0; asked < 12 && (await question.isVisible()); asked += 1) {
    await page.getByTestId('option-0').click();
    await page.getByTestId('question-next').click();
  }
  await expect(question).toBeHidden();
}

test.describe('reaching the end of a level sends the player on only when the task is done', () => {
  test('walks to the end with the task not done, earns nothing, and is told what is left', async ({
    page,
  }) => {
    await openLevel(page);

    const card = page.getByTestId('quest-complete-card');
    await expect(card, 'the card was up before the player had gone anywhere').toBeHidden();

    await walkToTheEnd(page);

    /* The card that says what is left, not "Level finished!" and not "Task
       done!": the task was never started (ADR-0036). */
    await expect(card).toHaveAttribute('data-reason', 'unfinished');
    await expect(card).toHaveAccessibleName(text('en', 'level.unfinished.title'));
    await expect(card.getByTestId('quest-complete-left-0')).toHaveText(text('en', 'passport.intro'));
    await expect(card.getByTestId('quest-complete-left-1')).toHaveText(
      text('en', 'level.unfinished.notStarted'),
    );

    /* Nothing earned, so nothing to name, nothing opened and nothing new in the
       passport. */
    await expect(card.getByTestId('quest-complete-stamp')).toHaveCount(0);
    await expect(card.getByTestId('quest-complete-next')).toHaveCount(0);
    await expect(card.getByTestId('quest-complete-passport')).toHaveCount(0);

    /* One way on — back into the level — and the map beside it. The level is
       stopped behind the card. */
    const keepPlaying = card.getByTestId('quest-complete-keep-playing');
    await expect(keepPlaying).toHaveAttribute('data-tn-action', 'primary');
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await keepPlaying.click();
    await expect(card).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    /* And the map agrees: no stamp on this level, and the next one still shut. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();

    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(page.getByTestId(`level-card-${START_LEVEL}`)).toBeFocused();
    await expect(page.getByTestId(`level-card-${START_LEVEL}-stamp`)).toBeHidden();
    await expect(page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}`)).toHaveAttribute(
      'data-state',
      'locked',
    );
  });

  test('finishing the task opens the next level, and one press lands the player in it', async ({
    page,
  }) => {
    await seed(page, oneAnswerFromDoneSave(START_QUEST));
    await openLevel(page);

    /*
     * The mode strip before anything moves: the HUD names the mode **this**
     * level declares, resolved exactly as `app/bootstrap` resolves it.
     */
    const modeLabel = page.getByTestId('hud-mode-label');
    await expect(modeLabel).toBeVisible();
    await expect(modeLabel).toHaveText(START_LEVEL_MODE_LABEL);

    /* Mark the HUD this level built, so the strip read after the change can be
       told from a leftover. */
    await page
      .getByTestId('hud')
      .evaluate((element) => element.setAttribute('data-tn-previous-level', ''));

    /* Past the giver, whose prompt is the reminder now, to the first landmark —
       and its one question finishes the task. */
    const offered = await walkRightPast(page, [GIVER_PROMPT, DONE_PROMPT]);
    expect(
      offered,
      `walking right in ${START_LEVEL} reached no landmark past the giver. "card" means the ` +
        'level ended first.',
    ).not.toBeNull();
    expect(offered).not.toBe('card');
    await answerWhatTheLandmarkAsks(page);

    const card = page.getByTestId('quest-complete-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute('data-reason', 'quest');
    await expect(card).toHaveAccessibleName(text('en', 'quest.done.title'));
    await expect(card.getByTestId('quest-complete-stamp')).toHaveText(STAMP_SENTENCE);

    /* The level that just opened: a label that says what pressing does, and one
       plain sentence about it. */
    const play = card.getByTestId('quest-complete-next');
    await expect(play).toHaveText(NEXT_LEVEL_PLAY_LABEL ?? '');
    await expect(card.getByTestId('quest-complete-next-level')).toHaveText(
      text('en', 'level.complete.nextOpen'),
    );
    await expect(play).toHaveAccessibleDescription(text('en', 'level.complete.nextOpen'));
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await play.click();

    /* The map is never drawn on the way: the card offers it, the player did not
       take it. */
    await expect(page.getByTestId('level-select')).toHaveCount(0);
    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });

    /* The HUD names the mode the level it is in declares — or is absent when
       that level declares none anybody has a word for (`TN-MOVE-02`). */
    if (NEXT_LEVEL_MODE_LABEL === null) {
      await expect(modeLabel).toBeHidden();
    } else {
      await expect(modeLabel).toBeVisible();
      await expect(modeLabel).toHaveText(NEXT_LEVEL_MODE_LABEL);
    }

    /* One HUD, and it is not the marked one. */
    await expect(page.getByTestId('hud')).toHaveCount(1);
    await expect(
      page.locator('[data-testid="hud"][data-tn-previous-level]'),
      'the HUD the player arrived in is the one the level they left built',
    ).toHaveCount(0);

    /* One `<main>`, with the canvas inside it, and the game running again. */
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main canvas')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    /* Leaving the new level goes to the map, on the card just left
       (`TN-FLOW`: back goes one step up, and never further). */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();

    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}`)).toBeFocused();
    await expect(page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}-here`)).toHaveText(
      'You are here',
    );
    await expect(page.getByTestId(`level-card-${START_LEVEL}-here`)).toHaveCount(0);
    if (JOURNEY.indexOf(START_LEVEL) < JOURNEY.indexOf(NEXT_LEVEL ?? '')) {
      const leg = page.locator('[data-testid="level-select-map-route"] line.tn-map__leg');
      await expect(leg).toHaveCount(1);
      await expect(leg).toHaveAttribute('data-map-from', START_LEVEL);
      await expect(leg).toHaveAttribute('data-map-to', NEXT_LEVEL ?? '');
    }
  });

  test('a level already finished leads on at its end, straight into the next one (ADR-0073)', async ({
    page,
  }) => {
    await seed(page, finishedSave(START_QUEST));
    await openLevel(page);

    /* Walk to the end. The stamp is in the passport and the next level is open,
       so the end is a way on: no card, and the level is left. */
    const card = page.getByTestId('quest-complete-card');
    const outcome = await walkInLegs(
      page,
      'ArrowRight',
      (legMs) =>
        page
          .waitForFunction(
            () => {
              if (document.documentElement.dataset['tnLevel'] !== 'ready') return 'left';
              const shown = document.querySelector('[data-testid="quest-complete-card"]');
              return shown !== null && (shown as HTMLElement).checkVisibility() ? 'card' : false;
            },
            undefined,
            { timeout: legMs, polling: 'raf' },
          )
          .then((handle) => handle.jsonValue() as Promise<'left' | 'card'>)
          .catch(() => null),
      { budgetMs: 240_000 },
    );
    expect(
      outcome,
      `the end of ${START_LEVEL}, already finished, drew a card or went nowhere instead of ` +
        `opening ${NEXT_LEVEL ?? ''}`,
    ).toBe('left');
    await expect(card).toBeHidden();

    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
    await expect(page.getByTestId('level-select')).toHaveCount(0);
    const modeLabel = page.getByTestId('hud-mode-label');
    if (NEXT_LEVEL_MODE_LABEL === null) {
      await expect(modeLabel).toBeHidden();
    } else {
      await expect(modeLabel).toHaveText(NEXT_LEVEL_MODE_LABEL);
    }

    /* Out by the menu: the map, on the card of the level the player is in now,
       and the stamp they already had still there — one, not two. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();

    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}`)).toBeFocused();
    await expect(page.getByTestId(`level-card-${START_LEVEL}-stamp`)).toBeVisible();
    await expect(page.getByTestId(`level-card-${NEXT_LEVEL ?? ''}-here`)).toHaveText(
      'You are here',
    );
  });
});
