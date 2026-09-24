import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { journeyFinishedSave, seed, type SeededQuest } from './saves';
import { walkInLegs } from './walk';

/**
 * "Hitting the end of the wall should send you to the next level" — on the
 * level the owner played it on (ADR-0074).
 *
 * Ottawa, from a save in which its task and every task before it on the
 * journey are finished, so its stamp is held and the next place is open. The
 * player walks to the end holding a key, as a player does, and the next level
 * loads: no card, no map on the way, and the move said in the live region
 * because the canvas that showed it is `aria-hidden`.
 *
 * The task is seeded rather than played: finishing Ottawa's task in play is
 * `level-quest.spec.ts`'s kind of walk and takes minutes on SwiftShader, and
 * what is under test here is the end of the level. The re-arm of the latch and
 * the four outcomes of an arrival are proved without a browser, in
 * `tests/unit/adapters/phaser/level-exit.test.ts` and
 * `tests/unit/bootstrap/front-door.test.ts`.
 *
 * Every level id is read from `content/`, never typed, except the one this
 * spec is about.
 */

const LEVEL = 'ottawa';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const JOURNEY = json<{ readonly journey: readonly (string | null)[] }>(
  'content/game.config.json',
).journey;

const HERE = JOURNEY.indexOf(LEVEL);
const NEXT = JOURNEY[HERE + 1] ?? null;

if (HERE < 0 || NEXT === null) {
  throw new Error(
    `${LEVEL} is not on the journey, or is its last place, so there is no next level for its ` +
      'end to lead to and this spec has nothing to walk.',
  );
}

/** Every quest in the build, by the level it belongs to. */
const QUESTS: readonly SeededQuest[] = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => json<SeededQuest>(`content/quests/${name}`));

/** Each place up to and including Ottawa, finished by its own task. */
const FINISHED: readonly SeededQuest[] = JOURNEY.slice(0, HERE + 1).map((id) => {
  const quest = QUESTS.find((candidate) => candidate.levelId === id);
  if (quest === undefined) {
    throw new Error(`${String(id)} ships no quest, so its stamp cannot be seeded as a task done.`);
  }
  return quest;
});

test.describe.configure({ mode: 'serial', timeout: 300_000 });

/**
 * Keep every sentence the live region holds, and every value `data-tn-level`
 * takes, from now on, in the page — a round trip per sample would miss a
 * sentence that is on the region for a moment.
 */
async function listen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const record = window as unknown as { __heard: string[]; __levelStates: string[] };
    record.__heard = [];
    record.__levelStates = [];
    const region = document.getElementById('tn-live-region');
    new MutationObserver(() => {
      const said = region?.textContent ?? '';
      if (said.length > 0 && record.__heard.at(-1) !== said) record.__heard.push(said);
    }).observe(region ?? document.body, { childList: true, characterData: true, subtree: true });
    new MutationObserver(() => {
      record.__levelStates.push(document.documentElement.dataset['tnLevel'] ?? '(none)');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tn-level'] });
  });
}

const heard = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __heard: string[] }).__heard);

const levelNow = (page: Page): Promise<string | undefined> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __tnScene?: { snapshot: () => { level?: string } } }
      ).__tnScene?.snapshot().level,
  );

test('walking to the end of a finished Ottawa loads the next level', async ({ page }, info) => {
  await seed(page, journeyFinishedSave(FINISHED));
  await page.goto(`./?e2e=1&level=${LEVEL}`);
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
  await expect.poll(() => levelNow(page)).toBe(LEVEL);
  await listen(page);

  const card = page.getByTestId('quest-complete-card');

  /* Held in legs: the drive comes to rest at every stop and waits for a fresh
     press (ADR-0032). A leg ends when the level is left, or when a card shows —
     which is the failure. */
  const outcome = await walkInLegs(
    page,
    'ArrowRight',
    (legMs) =>
      page
        .waitForFunction(
          () => {
            const states = (window as unknown as { __levelStates: string[] }).__levelStates;
            if (states.length > 0) return 'left';
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

  await page.screenshot({ path: info.outputPath('ottawa-end-advance.png') });

  expect(
    outcome,
    `walking to the end of a finished ${LEVEL} drew a card or went nowhere, instead of ` +
      `taking the player on to ${NEXT} (ADR-0074)`,
  ).toBe('left');
  await expect(card).toBeHidden();

  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
  await expect.poll(() => levelNow(page), { timeout: 15_000 }).toBe(NEXT);
  await expect(page.getByTestId('level-select')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
  await page.screenshot({ path: info.outputPath('next-level-loaded.png') });

  /* Said, in order: the level is finished, then the next level's own waiting
     sentence. */
  await expect
    .poll(async () => {
      const said = await heard(page);
      const finished = said.indexOf(text('en', 'level.complete.title'));
      const loading = said.indexOf(
        text('en', `level.${NEXT}.loading` as Parameters<typeof text>[1]),
      );
      return finished >= 0 && loading > finished;
    }, { timeout: 15_000 })
    .toBe(true);
});
