import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

/**
 * A character is drawn whole: nothing sits between its parts in the draw order.
 *
 * The report was a picture of Toronto — the rider's torso off the hips, both
 * mitts at the coat hem, somebody else's hair under the toque — and every
 * counter the scene published read full marks over it, because nothing was
 * missing. The guide drew its parts at `500 + z` and the player at `501 + z`, so
 * the two ranges interleaved, and ADR-0032 stops every drive level with the
 * character it meets. The rig and the pose were both correct; the order was not.
 *
 * `data-parts-interleaved` counts, off the scene's real display list, the drawn
 * things that sit by depth between the first and last part of a character they
 * are not part of. It is published when the level is ready, and depths are fixed
 * for the life of the level, so the spawn is as good a place to read it as the
 * stop: the defect was in the numbers, not in where the player happened to be.
 *
 * `data-player-drawn` and `data-placeholders` are asserted first because a
 * character that fell back to a placeholder has no parts to order, and would
 * read 0 for the wrong reason (ADR-0024).
 *
 * Derived from the level documents, so no level id is written here: every level
 * that places a character is opened.
 */

interface LevelDoc {
  readonly id: string;
  readonly characters: readonly unknown[];
}

const LEVELS_DIR = fileURLToPath(new URL('../../content/levels', import.meta.url));

const levels: readonly LevelDoc[] = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(`${LEVELS_DIR}/${name}`, 'utf8')) as LevelDoc);

const peopled = levels.filter((level) => level.characters.length > 0);

test.describe('nothing draws between the parts of a character', () => {
  test('has a level with a character to open, so this block is not a pass over nothing', () => {
    expect(peopled.length).toBeGreaterThan(0);
  });

  for (const level of peopled) {
    test(`${level.id}: the player and every character draw as whole puppets`, async ({ page }) => {
      await page.goto(`./?e2e=1&level=${level.id}`);
      await page.waitForSelector('[data-testid="playable"]');

      const probe = page.locator('[data-testid="scene-state"]');
      await expect(probe).toHaveAttribute('data-level', level.id);
      await expect(
        probe,
        'the player was not composed from the rig, so there were no parts to order',
      ).toHaveAttribute('data-player-drawn', 'true');
      await expect(
        probe,
        'a character fell back to a placeholder, so its parts were never ordered — the console says why',
      ).toHaveAttribute('data-placeholders', '0');
      await expect(
        probe,
        "something draws between a character's parts, so wherever the player stands on that character " +
          'the two are shuffled together (depth-plan.ts)',
      ).toHaveAttribute('data-parts-interleaved', '0');
    });
  }
});
