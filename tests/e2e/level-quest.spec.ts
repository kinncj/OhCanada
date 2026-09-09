import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { hasCopyRow, text } from '@ui/copy';

import { NEXT_LEVEL_PLAY_LABEL, START_LEVEL } from './start-level';

/**
 * The level's own quest, walked end to end on the shipped build: **offer,
 * accept, track, complete, stamp, card, next level.**
 *
 * ## Why this file exists
 *
 * Because the quest could not be given at all, on the level the game opens on,
 * while every suite was green. Three of the four authored quests declare
 * `"giver": "guide"`; `app/ui/dialogue.ts` takes the speaker's name as a
 * **required** option, because `TN-QUEST-08` refuses a dialog whose accessible
 * name is "Speaker", "NPC" or nothing; and there was no `npc.guide.name` row. So
 * `app/bootstrap/quest.ts` refused the offer, wrote a line to the console, and
 * the player walked past a beaver whose only prompt read "Talk to this person".
 *
 * `tests/e2e/level-end-to-next.spec.ts` walks the *other* way a level ends — to
 * the exit line, with no task accepted — and it passed throughout. The two are
 * different routes to the same card and only one of them was broken, which is
 * why this is a second file rather than another assertion in that one.
 *
 * ## What is read rather than typed
 *
 * The level, the quest, the giver, the landmarks, the prompts and the stamp
 * sentence, all from `content/` and `app/ui/copy.ts` — the same sources the game
 * reads. A spec that typed "Halifax", "guide" or "Talk to the guide" would have
 * to be edited when `content/game.config.json` opens somewhere else, and would
 * prove nothing this does not. What is asserted is the **relationship**: the
 * prompt is the row keyed on the giver's id, the dialog is named by the giver's
 * name row, and neither is the generic row for a person.
 *
 * ## Why it is serial and slow
 *
 * Every step of it is a real walk at a few hundred world pixels a second, and
 * the browser renders on SwiftShader. A slow walk is a slow machine, not a
 * defect (see `level-end-to-next.spec.ts` for the same reasoning).
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface LevelFile {
  readonly id: string;
  readonly characters: readonly {
    readonly characterId: string;
    readonly questId?: string;
  }[];
}

interface QuestFile {
  readonly id: string;
  readonly giver: string;
  readonly steps: readonly {
    readonly id: string;
    readonly kind: string;
    readonly prompt: { readonly en: string; readonly fr: string };
  }[];
}

const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as LevelFile;

/** The character the level places with a task beside them. */
const GIVER_IN_THE_LEVEL = LEVEL.characters.find((character) => character.questId !== undefined);

if (GIVER_IN_THE_LEVEL === undefined) {
  throw new Error(
    `content/levels/${START_LEVEL}.json places no character with a questId, so the level ` +
      'the game opens on offers the player no task at all. Either the document lost its ' +
      'quest or this suite is pointed at the wrong level.',
  );
}

const QUEST = JSON.parse(
  readFileSync(`${REPO_ROOT}content/quests/${GIVER_IN_THE_LEVEL.questId ?? ''}.json`, 'utf8'),
) as QuestFile;

/** `hud.interact.<id>` and `npc.<id>.name`, the two rows the giver needs. */
const PROMPT_KEY = `hud.interact.${QUEST.giver}`;
const NAME_KEY = `npc.${QUEST.giver}.name`;

for (const key of [PROMPT_KEY, NAME_KEY]) {
  if (!hasCopyRow(key)) {
    throw new Error(
      `content/quests/${QUEST.id}.json is given by "${QUEST.giver}" and app/ui/copy.ts has ` +
        `no ${key}. Without ${NAME_KEY} the offer is refused outright (TN-QUEST-08), and ` +
        `without ${PROMPT_KEY} the HUD calls the character "this person". Transcribe the ` +
        'rows from docs/stories/TN-GUIDE-the-guide.md.',
    );
  }
}

const GIVER_PROMPT = text('en', PROMPT_KEY as Parameters<typeof text>[1]);
const GIVER_NAME = text('en', NAME_KEY as Parameters<typeof text>[1]);
const GIVER_NAME_FR = text('fr', NAME_KEY as Parameters<typeof text>[1]);
const GIVER_PROMPT_FR = text('fr', PROMPT_KEY as Parameters<typeof text>[1]);
const STAMP_SENTENCE = text('en', `stamp.${START_LEVEL}.earned` as Parameters<typeof text>[1]);

/** The step after the opening `talk`, which is what the tracker shows first. */
const SECOND_STEP = QUEST.steps[1];

test.describe.configure({ mode: 'serial', timeout: 300_000 });

async function openLevel(page: Page, query = '', level: string = START_LEVEL): Promise<void> {
  await page.goto(`./?level=${level}${query}`);
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
}

/**
 * Walk right in short holds until something is in reach.
 *
 * Held rather than tapped, because holding is how the game is played, and in
 * bursts rather than continuously because reach is a window a few hundred world
 * pixels wide: a single long hold walks straight through it.
 *
 * Returns what the HUD offered, or `null` when the walk ran out — and `'card'`
 * when the player reached the end of the level instead, which is a real outcome
 * and not a timeout.
 */
async function walkUntilSomethingIsInReach(page: Page, tries = 140): Promise<string | null> {
  const prompt = page.getByTestId('interact-prompt');
  const card = page.getByTestId('quest-complete-card');
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await card.isVisible()) return 'card';
    if (await prompt.isVisible()) return (await prompt.textContent()) ?? '';
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowRight');
  }
  return null;
}

/** Walk to the giver and open what they have to say. */
async function talkToTheGiver(page: Page): Promise<void> {
  const offered = await walkUntilSomethingIsInReach(page);
  expect(
    offered,
    `walking right in ${START_LEVEL} never came within reach of anything. The giver is ` +
      `"${QUEST.giver}", placed by content/levels/${START_LEVEL}.json.`,
  ).toBe(GIVER_PROMPT);
  await page.getByTestId('interact-prompt').click();
  await expect(page.getByTestId('dialogue')).toBeVisible();
}

/**
 * Engage whatever is in reach once, and deal with whatever it opens.
 *
 * A landmark opens its card and then a question; a question is answered by
 * taking the first option, because what is asserted here is that the quest
 * *counts* the answer, never whether the player got it right. A character opens
 * a dialogue: the offer the first time, and the step's prompt read back after
 * that (`TN-REACH-03`).
 *
 * Engaged by tapping the HUD's prompt, which is `TN-LEVEL-05`'s "tapping the
 * prompt does what tapping the target does" and the route a one-thumb player
 * takes. The interact key is the other route and is not walked here: it engages
 * from the scene's own input, so a suite that used it would be proving the
 * keyboard binding rather than the quest.
 */
async function engageOnce(page: Page): Promise<'answered' | 'talked' | 'nothing'> {
  const poi = page.getByTestId('poi-card');
  const question = page.getByTestId('question-card');
  const dialogue = page.getByTestId('dialogue');
  const prompt = page.getByTestId('interact-prompt');

  /*
   * Only while the level is actually running. A modal holds it, and a tap that
   * lands in the frame between a card closing and the level starting again is a
   * tap the game is right to ignore.
   */
  await page.waitForSelector('html[data-tn-paused="false"]', { timeout: 15_000 });

  /*
   * Tapping the prompt does what tapping the target does (`TN-LEVEL-05`), and
   * the retry is not defensiveness: the HUD creates and removes that button as
   * things come in and out of reach, so a click can resolve the element and
   * then find it detached — the game redrawing a button, not a defect. Three
   * bounded attempts, and a prompt that has genuinely gone means there is
   * nothing here to engage.
   */
  let tapped = false;
  for (let attempt = 0; attempt < 3 && !tapped; attempt += 1) {
    try {
      await prompt.click({ timeout: 5_000 });
      tapped = true;
    } catch {
      if (!(await prompt.isVisible())) return 'nothing';
    }
  }
  if (!tapped) return 'nothing';

  /*
   * Waited for rather than slept on. A landmark's first question needs its
   * subject's bank, which is a separate chunk the browser fetches on demand, so
   * "how long until the card is up" is a download on a cold cache and not a
   * frame count. A fixed pause here is how this walk drifted past a landmark and
   * finished the *level* instead of the task.
   */
  const opened = await Promise.race([
    poi.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'poi' as const),
    question.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'question' as const),
    dialogue.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'dialogue' as const),
  ]).catch(() => null);

  if (opened === null) return 'nothing';

  if (opened === 'poi') {
    await page.getByTestId('poi-card-close').click();
    await expect(poi).toBeHidden();
    /* The card's questions follow it, when this level's subject has any. */
    const asked = await question
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!asked) return 'talked';
  }

  if (await question.isVisible()) {
    await page.getByTestId('option-0').click();
    const next = page.getByTestId('question-next');
    if (await next.isVisible()) await next.click();
    await expect(question).toBeHidden();
    return 'answered';
  }

  if (await dialogue.isVisible()) {
    const onward = page.getByTestId('dialogue-next');
    if (await onward.isVisible()) await onward.click();
    await expect(dialogue).toBeHidden();
    return 'talked';
  }
  return 'nothing';
}

/** Keep walking until this target is out of reach, so the next one can be. */
async function walkOnPast(page: Page): Promise<void> {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
}

test.describe('the level the game opens on gives its task, and finishes it', () => {
  test('names the character before it speaks, and offers the task', async ({ page }) => {
    /*
     * `TN-GUIDE-01`: "engaging the guide opens a named dialogue", and "no offer
     * is refused for want of a speaker's name" on the level the game opens on.
     */
    const refusals: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') refusals.push(message.text());
    });

    await openLevel(page);

    /* The prompt is the giver's own row, and not the row for a person. */
    const prompt = page.getByTestId('interact-prompt');
    const offered = await walkUntilSomethingIsInReach(page);
    expect(offered).toBe(GIVER_PROMPT);
    expect(offered).not.toBe(text('en', 'hud.interact.npc'));

    await prompt.click();

    const dialogue = page.getByTestId('dialogue');
    await expect(dialogue).toBeVisible();
    await expect(dialogue).toHaveAttribute('role', 'dialog');
    await expect(dialogue).toHaveAttribute('aria-modal', 'true');
    /* The name is the dialog's accessible name *and* is drawn, so a sighted
       player and a screen-reader user are told the same thing (`TN-QUEST-08`). */
    await expect(dialogue).toHaveAccessibleName(GIVER_NAME);
    await expect(page.getByTestId('dialogue-speaker')).toHaveText(GIVER_NAME);
    await expect(page.getByTestId('dialogue-accept')).toBeVisible();
    await expect(page.getByTestId('dialogue-decline')).toBeVisible();

    expect(
      refusals.filter((line) => line.includes('npc.<id>.name')),
      'the offer was refused for want of a speaker’s name',
    ).toEqual([]);

    /* And the canvas is still out of the accessibility tree behind it. */
    await expect(page.locator('main canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  test('puts the task in the HUD once it is accepted, and not before', async ({ page }) => {
    await openLevel(page);
    const tracker = page.getByTestId('hud-quest-tracker');
    await expect(tracker, 'a task was tracked before anybody accepted one').toBeHidden();

    await talkToTheGiver(page);
    await page.getByTestId('dialogue-accept').click();

    await expect(page.getByTestId('dialogue')).toBeHidden();
    /* Accepting finishes the opening `talk` step in the same move, so the
       tracker shows the step after it (`TN-QUEST-02`). */
    await expect(tracker).toBeVisible();
    await expect(tracker).toContainText(SECOND_STEP?.prompt.en ?? '');
    /* The level is running again: whoever takes it gives it back. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
  });

  test('is refused without ending anything, and can be taken later', async ({ page }) => {
    /* `TN-QUEST-03`: declining is not a refusal to ever ask again. */
    await openLevel(page);
    await talkToTheGiver(page);
    await page.getByTestId('dialogue-decline').click();

    await expect(page.getByTestId('dialogue')).toBeHidden();
    await expect(page.getByTestId('hud-quest-tracker')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    await page.getByTestId('interact-prompt').click();
    await expect(page.getByTestId('dialogue-accept'), 'the task was never offered again')
      .toBeVisible();
  });

  test('is French from the name to the prompt', async ({ page }) => {
    /* `TN-GUIDE-06`. The language is set on the title screen and kept in the
       save, so the level opens in it. */
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-language-fr').click();
    await page.getByTestId('settings-close').click();

    await openLevel(page);
    const offered = await walkUntilSomethingIsInReach(page);
    expect(offered).toBe(GIVER_PROMPT_FR);
    expect(offered).not.toBe(text('fr', 'hud.interact.npc'));

    await page.getByTestId('interact-prompt').click();
    await expect(page.getByTestId('dialogue')).toHaveAccessibleName(GIVER_NAME_FR);
    await expect(page.getByTestId('dialogue-speaker')).toHaveText(GIVER_NAME_FR);
  });

  test('runs to the end: every step, the stamp, the card and the way on', async ({ page }) => {
    /*
     * The whole route in one walk, because it is one walk: accept, follow the
     * tracker through each step, and finish. What proves the quest finished
     * rather than the level running out is the card's heading — `quest.done.title`
     * for a task, `level.complete.title` for a walk to the exit — and `TN-DONE`
     * calls drawing the wrong one a claim about something the player never did.
     */
    await openLevel(page);
    await talkToTheGiver(page);
    await page.getByTestId('dialogue-accept').click();

    const card = page.getByTestId('quest-complete-card');
    const tracker = page.getByTestId('hud-quest-tracker');
    const seen: string[] = [];

    for (let round = 0; round < 24 && !(await card.isVisible()); round += 1) {
      const current = (await tracker.textContent()) ?? '';
      if (current !== '' && !seen.includes(current)) seen.push(current);

      const offered = await walkUntilSomethingIsInReach(page);
      if (offered === 'card' || offered === null) break;

      /* Engage this target until it stops moving the quest on. An `answer` step
         asks one question per engagement, so a step that wants three takes
         three — which is the game, not a workaround. A character has one thing
         to say per visit, so talking ends the visit either way. */
      for (let engagement = 0; engagement < 8; engagement += 1) {
        const before = await tracker.textContent();
        const did = await engageOnce(page);
        if (await card.isVisible()) break;
        if (did !== 'answered') break;
        if (!(await page.getByTestId('interact-prompt').isVisible())) break;
        if ((await tracker.textContent()) !== before) break;
      }

      /* Then walk on. Standing in reach of something already dealt with is how
         a player gets stuck reading the same reminder, and how this loop would
         spend every round on the first target. */
      if (!(await card.isVisible())) await walkOnPast(page);
    }

    await expect(
      card,
      `the task never finished. The tracker showed: ${seen.join(' | ')}. Every step of ` +
        `content/quests/${QUEST.id}.json has to be reachable by walking and choosing.`,
    ).toBeVisible({ timeout: 30_000 });

    /* It is the **task** that finished, not the level running out under the
       player's feet. */
    await expect(card).toHaveAccessibleName(text('en', 'quest.done.title'));
    await expect(card).not.toHaveAccessibleName(text('en', 'level.complete.title'));

    /* The stamp is this level's own sentence, written out and not composed. */
    await expect(card.getByTestId('quest-complete-stamp')).toHaveText(STAMP_SENTENCE);
    /* The score is a count of answers, never a mark out of nothing. */
    await expect(card.getByTestId('quest-complete-progress')).toContainText('out of');
    /* The tracker goes when the task does: no half-finished task behind a card
       that says it is done. */
    await expect(tracker).toBeHidden();
    /* And the level is stopped behind it. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    /* The way on, and it is a label that says what pressing does. */
    if (NEXT_LEVEL_PLAY_LABEL !== null) {
      const play = card.getByTestId('quest-complete-next');
      await expect(play).toHaveText(NEXT_LEVEL_PLAY_LABEL);
      await play.click();
      await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
      await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
    }

    /* The stamp really is in the passport, which is the record of the journey
       rather than a line on a card the player has already tapped past. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-passport').click();
    const passport = page.getByTestId('passport');
    await expect(passport).toBeVisible();
    await expect(passport.getByTestId('passport-counts')).toContainText('1 of 10');
  });
});

/* ------------------------------------- and the other levels that place one --- */

/**
 * Every level whose document places a character with a task beside them, read
 * from `content/levels/` rather than listed.
 *
 * Three of the four are given by the same character, which is exactly why the
 * missing row broke three levels at once and why this is a loop: a name written
 * once and drawn on three levels is only proved by walking all three.
 */
const LEVELS_WITH_A_GIVER = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort()
  .flatMap((id) => {
    const document = JSON.parse(
      readFileSync(`${REPO_ROOT}content/levels/${id}.json`, 'utf8'),
    ) as LevelFile;
    const placed = document.characters.find((character) => character.questId !== undefined);
    if (placed === undefined) return [];
    const quest = JSON.parse(
      readFileSync(`${REPO_ROOT}content/quests/${placed.questId ?? ''}.json`, 'utf8'),
    ) as QuestFile;
    return [{ id, giver: quest.giver, quest: quest.id }];
  });

test.describe('every level that places a quest giver can give its quest', () => {
  for (const level of LEVELS_WITH_A_GIVER) {
    test(`${level.id} names ${level.giver} and offers ${level.quest}`, async ({ page }) => {
      /*
       * `TN-GUIDE-01`, the scenario outline: three of these levels are given by
       * the guide and all three were refused for one missing row. Walked rather
       * than asserted against the copy table, because a row that exists and a
       * dialogue that opens are different facts — the first was true for the
       * officer while the second was false for everybody else.
       */
      const nameKey = `npc.${level.giver}.name`;
      expect(hasCopyRow(nameKey), `${level.quest} is given by "${level.giver}" with no row`)
        .toBe(true);
      const name = text('en', nameKey as Parameters<typeof text>[1]);

      await openLevel(page, '', level.id);
      const offered = await walkUntilSomethingIsInReach(page);
      expect(offered, `nothing came into reach in ${level.id}`).not.toBeNull();

      /* Whatever came into reach first, the giver is reachable and speaks. The
         prompt is a verb phrase from the table, never the character's name. */
      expect(offered).not.toBe(name);

      await page.getByTestId('interact-prompt').click();
      const dialogue = page.getByTestId('dialogue');
      await expect(dialogue, `${level.giver} said nothing in ${level.id}`).toBeVisible();
      await expect(dialogue).toHaveAccessibleName(name);
      await expect(page.getByTestId('dialogue-speaker')).toHaveText(name);
      await expect(page.getByTestId('dialogue-accept')).toBeVisible();
    });
  }
});
