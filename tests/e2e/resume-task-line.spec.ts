import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { labelled, text } from '@ui/copy';

import { reachLevelSelect } from './front-door';
import { activeQuestSave, seed } from './saves';
import { START_LEVEL } from './start-level';

/**
 * A save with a quest in progress opens with its task in the HUD, however the
 * player comes back to the level (`TN-FLOW-02`, `TN-FLOW-03`, `TN-SAVE-01`).
 *
 * ## Why this file exists
 *
 * The second audit seeded a save with Halifax's quest on "Find the Town Clock",
 * opened the level in French at 200 % text, and the strip showed the offer,
 * Settings, Menu and the mode, and no task. The tracker was drawn only when a
 * quest moved — an accept, a visit, an answer or a language change — and every
 * way into a level builds a new HUD, so a reload, Continue or the map opened the
 * level with no task line until the player engaged something. A stamp is earned
 * only for the task (ADR-0036), so a returning player did not know what they
 * were there to do.
 *
 * ## What is read rather than typed
 *
 * The level, its quest and the step's own words, from `content/`; the label and
 * how it joins the step, from `app/ui/copy.ts`. The save is written by the
 * game's own functions (`./saves.ts`).
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly steps: readonly {
    readonly kind: string;
    readonly count?: number;
    readonly prompt: { readonly en: string; readonly fr: string };
  }[];
}

const QUEST: QuestFile | undefined = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(`${REPO_ROOT}content/quests/${name}`, 'utf8')) as QuestFile)
  .find((quest) => quest.levelId === START_LEVEL);

if (QUEST === undefined) {
  throw new Error(
    `content/quests/ holds no quest for ${START_LEVEL}, the level the game opens on, so no ` +
      'save can come back to it with a task.',
  );
}

/** The step after the offer: where a player who accepted and walked away stands. */
const STEP_INDEX = 1;
const STEP = QUEST.steps[STEP_INDEX];

if (STEP === undefined) {
  throw new Error(`content/quests/${QUEST.id}.json has no step after its offer.`);
}

/** The tracker's whole line for that step, labelled and filled as the HUD draws it. */
const trackerLine = (locale: 'en' | 'fr'): string =>
  labelled(
    locale,
    text(locale, 'hud.task'),
    STEP.prompt[locale]
      .replace(/\{\{done\}\}/gu, '0')
      .replace(/\{\{count\}\}/gu, String(STEP.count ?? 1)),
  );

test.describe.configure({ mode: 'serial', timeout: 240_000 });

async function levelIsReady(page: Page): Promise<void> {
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
}

test.describe('a level opens with the task the save was left on', () => {
  for (const variant of [
    { name: 'in English', locale: 'en', textScale: 1 },
    { name: 'in French at 200 % text', locale: 'fr', textScale: 2 },
  ] as const) {
    test(`shows the task on opening, and again after a reload, ${variant.name}`, async ({
      page,
    }) => {
      await seed(
        page,
        activeQuestSave(QUEST, {
          stepIndex: STEP_INDEX,
          locale: variant.locale,
          textScale: variant.textScale,
        }),
      );
      await page.goto(`./?level=${START_LEVEL}`);
      await levelIsReady(page);

      /* The save's own language and text size are the ones in force. */
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', variant.locale);
      await expect(html).toHaveAttribute('data-tn-text-scale', String(variant.textScale * 100));

      const tracker = page.getByTestId('hud-quest-tracker');
      await expect(
        tracker,
        `the save has ${QUEST.id} on "${STEP.prompt.en}", and the level opened with no task line`,
      ).toBeVisible();
      await expect(tracker).toHaveText(trackerLine(variant.locale));

      /* A reload reads the same save back, out of the store it was carried into. */
      await page.reload();
      await levelIsReady(page);
      await expect(tracker, 'the task line was gone after a reload').toBeVisible();
      await expect(tracker).toHaveText(trackerLine(variant.locale));
    });
  }

  test('keeps the task through Settings, a language change, the map and Continue', async ({
    page,
  }) => {
    await seed(page, activeQuestSave(QUEST, { stepIndex: STEP_INDEX, locale: 'en' }));
    await page.goto(`./?level=${START_LEVEL}`);
    await levelIsReady(page);
    const tracker = page.getByTestId('hud-quest-tracker');
    await expect(tracker).toHaveText(trackerLine('en'));

    /* Settings opens over the level and closes back into it. */
    await page.getByTestId('hud-settings-button').click();
    await page.getByTestId('setting-language-fr').click();
    await page.getByTestId('settings-close').click();
    await expect(tracker, 'the task did not follow the language').toHaveText(trackerLine('fr'));

    await page.getByTestId('hud-settings-button').click();
    await page.getByTestId('setting-language-en').click();
    await page.getByTestId('settings-close').click();
    await expect(tracker).toHaveText(trackerLine('en'));

    /* Out to the map and back in: a new HUD, the same task. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-leave').click();
    await page.getByTestId(`level-card-${START_LEVEL}`).click();
    await levelIsReady(page);
    await expect(tracker, 'the task line was gone after coming back from the map').toHaveText(
      trackerLine('en'),
    );

    /* The front door: the title, the creator a save with no character opens,
       and the map. */
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await reachLevelSelect(page);
    await page.getByTestId(`level-card-${START_LEVEL}`).click();
    await levelIsReady(page);
    await expect(tracker, 'the task line was gone after the title and the map').toHaveText(
      trackerLine('en'),
    );

    /* And Continue, one tap from the title. */
    await page.goto('./');
    await expect(page.getByTestId('title-continue')).toBeVisible();
    await page.getByTestId('title-continue').click();
    await levelIsReady(page);
    await expect(tracker, 'the task line was gone after Continue').toHaveText(trackerLine('en'));
  });
});
