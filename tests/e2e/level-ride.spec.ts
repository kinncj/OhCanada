import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

/**
 * ADR-0031, in the shipped build: a level that moves by a ride draws the ride and
 * seats the rider in it.
 *
 * The report this answers was a picture — on the Prairies "the character walks
 * by itself on a track" — and every counter the scene had read full marks over
 * it except `data-mode-gaps`. So the assertions are the four numbers that would
 * each be wrong in one of the ways it can come back:
 *
 *  - `data-rides` 1 and `data-rides-drawn` 1: the ride's art loaded. A ride whose
 *    texture never packed seats the rider in mid-air and still reaches `ready`;
 *  - `data-mode-gaps` 0: the rig has poses for the mode;
 *  - `data-character-mode` and `data-pose`: the puppet was built for the mode and
 *    is playing one of its states, not the standing walk.
 *
 * Derived from the level documents, so no level id and no mode is written here:
 * the levels checked are the ones whose opening mode has a ride, and the control
 * is a level with no ride at all, which must report none rather than a plausible
 * one.
 */

interface LevelDoc {
  readonly id: string;
  readonly locomotion: readonly { readonly mode: string }[];
  readonly rides?: readonly { readonly mode: string }[];
}

const LEVELS_DIR = fileURLToPath(new URL('../../content/levels', import.meta.url));

const levels: readonly LevelDoc[] = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(`${LEVELS_DIR}/${name}`, 'utf8')) as LevelDoc);

const openingMode = (level: LevelDoc): string => level.locomotion[0]?.mode ?? '';

const ridden = levels.filter((level) =>
  (level.rides ?? []).some((ride) => ride.mode === openingMode(level)),
);
const unridden = levels.find((level) => (level.rides ?? []).length === 0);

test.describe('a level that moves by a ride draws it and seats the rider in it (ADR-0031)', () => {
  test('has a ridden level to open, so this block is not a pass over nothing', () => {
    expect(ridden.length).toBeGreaterThan(0);
  });

  for (const level of ridden) {
    const mode = openingMode(level);

    test(`${level.id}: the ride is drawn and the rider is posed for "${mode}"`, async ({ page }) => {
      await page.goto(`./?e2e=1&level=${level.id}`);
      await page.waitForSelector('[data-testid="playable"]');

      const probe = page.locator('[data-testid="scene-state"]');
      await expect(probe).toHaveAttribute('data-level', level.id);
      await expect(probe, 'the level opens in a mode with a ride and the scene found none').toHaveAttribute(
        'data-rides',
        '1',
      );
      await expect(
        probe,
        "the ride's art did not draw, so the rider is seated over nothing — the console says which texture",
      ).toHaveAttribute('data-rides-drawn', '1');
      await expect(probe, 'the rig has no poses for this mode').toHaveAttribute('data-mode-gaps', '0');
      await expect(probe).toHaveAttribute('data-character-mode', mode);
      await expect(
        probe,
        'the rider is playing a state that is not one of this mode\'s — the standing walk is the reported defect',
      ).toHaveAttribute('data-pose', new RegExp(`^${mode}/`, 'u'));
    });
  }

  test('a level with no ride reports none, rather than a plausible one', async ({ page }) => {
    expect(unridden, 'every level declares a ride, so there is no control to open').toBeDefined();
    if (unridden === undefined) return;

    await page.goto(`./?e2e=1&level=${unridden.id}`);
    await page.waitForSelector('[data-testid="playable"]');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', unridden.id);
    await expect(probe).toHaveAttribute('data-rides', '0');
    await expect(probe).toHaveAttribute('data-rides-drawn', '0');
  });
});
