import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { labelled, text } from '@ui/copy';

import { activeQuestSave, seed } from './saves';
import { walkInLegs } from './walk';

/**
 * The dyslexia strip grows past a third, and the player stays above it
 * (ADR-0072, `TN-HUD-01`, `TN-HUD-08`).
 *
 * With the dyslexia face on at 200 % text, a task takes six lines and Settings
 * and Menu take two rows, and at a third of a 390 x 844 screen the task ended
 * below the strip on most steps (ADR-0071 §5). ADR-0072 lets the strip reach up
 * to the line the player walks on, and sits the canvas at the top of its space
 * so that line is higher. `tests/a11y/readability.spec.ts` holds every strip
 * the game can draw to that; this holds the part a component harness cannot:
 * on a running level, with the engine's own canvas and the player where the
 * scene says they are, the strip is taller than a third, every row the player
 * acts on ends inside it, and the player's feet are still above its top edge.
 *
 * ## Where the player is on the screen
 *
 * The scene publishes the player's world position on `scene-state`
 * (`data-player-y`, behind `?e2e=1`). Every level's world is exactly one
 * viewport tall, 1920 rows, so the camera's vertical scroll is clamped to 0
 * (`level-scene.ts`) and a world row is a canvas row. The canvas is FIT at
 * 1080 x 1920 (ADR-0002), so its box maps a row to the screen. The premise is
 * asserted, not assumed: a level taller than its viewport fails here first.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DESIGN_HEIGHT = 1920;

/** Halifax: its guide stands 500 px from the spawn, so an offer is a short walk. */
const LEVEL = 'halifax';

interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly steps: readonly {
    readonly kind: string;
    readonly count?: number;
    readonly prompt: { readonly en: string; readonly fr: string };
  }[];
}

const level = JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${LEVEL}.json`, 'utf8')) as {
  readonly size: { readonly y: number };
  readonly quests: readonly string[];
};
const questId = level.quests[0];
if (questId === undefined) throw new Error(`content/levels/${LEVEL}.json lists no quest.`);
const QUEST = JSON.parse(readFileSync(`${REPO_ROOT}content/quests/${questId}.json`, 'utf8')) as QuestFile;

/** The step with the longest sentence in this language: the strip's worst case on this level. */
function longestStep(locale: 'en' | 'fr'): number {
  let best = 1;
  QUEST.steps.forEach((step, index) => {
    if (index > 0 && step.prompt[locale].length > (QUEST.steps[best]?.prompt[locale].length ?? 0)) best = index;
  });
  return best;
}

const sentence = (locale: 'en' | 'fr', index: number): string => {
  const step = QUEST.steps[index];
  return (step?.prompt[locale] ?? '')
    .replace(/\{\{done\}\}/gu, '0')
    .replace(/\{\{count\}\}/gu, String(step?.count ?? 1));
};

interface Geometry {
  readonly viewport: number;
  readonly canvasTop: number;
  readonly feet: number;
  readonly stripTop: number;
  readonly stripHeight: number;
}

function geometry(page: Page): Promise<Geometry> {
  return page.evaluate((designHeight) => {
    const canvas = document.querySelector('#game canvas');
    const hud = document.querySelector('[data-testid="hud"]');
    const probe = document.querySelector('[data-testid="scene-state"]');
    if (canvas === null || hud === null || probe === null) throw new Error('the level is not drawn');
    const box = canvas.getBoundingClientRect();
    const strip = hud.getBoundingClientRect();
    const playerY = Number(probe.getAttribute('data-player-y'));
    return {
      viewport: window.innerHeight,
      canvasTop: box.top,
      feet: box.top + (playerY * box.height) / designHeight,
      stripTop: strip.top,
      stripHeight: strip.height,
    };
  }, DESIGN_HEIGHT);
}

/** The player's feet are at or above the strip's top edge, once the engine has refitted the canvas. */
async function expectThePlayerAboveTheStrip(page: Page, where: string): Promise<Geometry> {
  /* The engine refits its canvas to its host on its own clock (every 500 ms at
     most), so the first frames after the HUD mounts may still be centred. */
  await expect
    .poll(async () => {
      const seen = await geometry(page);
      return seen.stripTop - seen.feet;
    }, { message: `${where}: the strip covers the player's feet`, timeout: 10_000 })
    .toBeGreaterThanOrEqual(0);
  return geometry(page);
}

async function insideTheStrip(page: Page, testIds: readonly string[]): Promise<void> {
  const bottom = await page.evaluate(() => {
    const hud = document.querySelector('[data-testid="hud"]');
    if (hud === null) throw new Error('the HUD is not drawn');
    hud.scrollTop = 0;
    return hud.getBoundingClientRect().bottom;
  });
  for (const testId of testIds) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} is not drawn`).not.toBeNull();
    expect(
      (box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY),
      `${testId} ends below the strip, where a player has to scroll to find it`,
    ).toBeLessThanOrEqual(bottom + 1);
  }
}

test.describe.configure({ timeout: 240_000 });

test.describe('ADR-0072: with the dyslexia face at 200 %, the strip holds its rows and the player stays above it', () => {
  test('the level is one viewport tall, so a world row is a canvas row', () => {
    expect(level.size.y, `${LEVEL} is taller than its viewport; read the camera's scroll too`).toBe(DESIGN_HEIGHT);
  });

  for (const locale of ['en', 'fr'] as const) {
    const language = locale === 'fr' ? 'French' : 'English';

    test(`on ${LEVEL}, in ${language}, with the task and then an offer`, async ({ page }, info) => {
      const stepIndex = longestStep(locale);
      await seed(page, activeQuestSave(QUEST, { stepIndex, locale, textScale: 2, dyslexiaFont: true }));
      await page.goto(`./?level=${LEVEL}&e2e=1`);
      await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-tn-font', 'dyslexia');
      await expect(html).toHaveAttribute('data-tn-text-scale', '200');

      /* At the spawn nothing is in reach: the task in full. */
      const tracker = page.getByTestId('hud-quest-tracker');
      await expect(tracker).toHaveText(labelled(locale, text(locale, 'hud.task'), sentence(locale, stepIndex)));
      const atSpawn = await expectThePlayerAboveTheStrip(page, 'at the spawn');
      await insideTheStrip(page, ['hud-settings-button', 'menu-button', 'hud-quest-tracker']);
      /* The canvas sits at the top of its space; nothing of it is cut. */
      expect(atSpawn.canvasTop).toBeGreaterThanOrEqual(-0.5);
      expect(atSpawn.canvasTop).toBeLessThanOrEqual(0.5);
      /* The change is in force: the task needs more than a third here. */
      expect(atSpawn.stripHeight, 'the strip did not grow past a third').toBeGreaterThan(atSpawn.viewport / 3);
      info.annotations.push({
        type: 'with the task',
        description: `strip ${atSpawn.stripHeight.toFixed(0)} px (${((atSpawn.stripHeight / atSpawn.viewport) * 100).toFixed(1)} %), feet ${(atSpawn.stripTop - atSpawn.feet).toFixed(0)} px above it`,
      });

      /* Walk to the guide: the offer holds the strip and the task is its count. */
      const offered = await walkInLegs(page, 'ArrowRight', async (legMs) =>
        page
          .getByTestId('interact-prompt')
          .waitFor({ state: 'visible', timeout: legMs })
          .then(() => true)
          .catch(() => null),
      );
      expect(offered, 'no offer came into reach').toBe(true);
      await expect(page.getByTestId('hud-task-indicator')).toBeVisible();
      const atOffer = await expectThePlayerAboveTheStrip(page, 'at the offer');
      await insideTheStrip(page, ['interact-prompt', 'hud-settings-button', 'menu-button', 'hud-task-indicator']);
      info.annotations.push({
        type: 'with an offer',
        description: `strip ${atOffer.stripHeight.toFixed(0)} px (${((atOffer.stripHeight / atOffer.viewport) * 100).toFixed(1)} %), feet ${(atOffer.stripTop - atOffer.feet).toFixed(0)} px above it`,
      });
    });
  }
});
