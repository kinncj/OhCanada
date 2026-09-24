import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { holdToMove } from './held-drive';
import { walkWithProbe } from './walk';

/**
 * No mark is ever drawn on a character — the player walking, or anyone standing.
 *
 * A real build at 390 × 844, Peggy's Cove, holding right for about four seconds
 * from the spawn: the granite erratic's hollow ring sat on the player's chest.
 * The erratic is lower than the player, and its mark had stepped sideways along
 * the art to keep off the head *where the stop rests the player* — onto the
 * column the player walks through on the way in. The fish store's sat on their
 * hat. Halifax's guide read correctly, as a pin above his head.
 *
 * `mark-clearance.ts` now keeps every mark clear of the player's standing figure
 * wherever the ground carries them, and of every other character, and
 * `tests/unit/contracts/a-mark-sits-on-its-subject.test.ts` holds that for every
 * level from the documents. This holds it on the glass, against the real
 * production build and real art: the scene counts, every frame behind `?e2e=1`,
 * the marks on screen whose extent overlaps the player where they stand or a
 * placed character's drawn art (`marksOnActors` in the frame trace). The walk
 * goes past every subject on the level the defect was photographed on, and on
 * one level with a guide, and the count never leaves zero.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Subject {
  readonly x: number;
}

function subjectsOf(levelId: string): readonly number[] {
  const level = JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${levelId}.json`, 'utf8')) as {
    readonly pois: readonly { readonly position: Subject }[];
    readonly characters: readonly { readonly position: Subject }[];
  };
  return [...level.pois, ...level.characters].map((subject) => subject.position.x).sort((a, b) => a - b);
}

/** What the page has seen since {@link watchMarks}: the most marks on a character in any one frame. */
interface Watched {
  readonly frames: number;
  readonly counted: number;
  readonly worst: number;
  readonly worstAtX: number | null;
}

/** Read every frame's count as it is recorded, so a long walk cannot outrun the trace buffer. */
async function watchMarks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scene = (
      window as unknown as {
        __tnScene: { frames: () => { frame: number; x: number; marksOnActors?: number }[] };
      }
    ).__tnScene;
    const seen = { frames: 0, counted: 0, worst: 0, worstAtX: null as number | null, last: -1 };
    (window as unknown as { __tnMarksSeen: typeof seen }).__tnMarksSeen = seen;
    const tick = (): void => {
      for (const entry of scene.frames()) {
        if (entry.frame <= seen.last) continue;
        seen.last = entry.frame;
        seen.frames += 1;
        if (entry.marksOnActors === undefined) continue;
        seen.counted += 1;
        if (entry.marksOnActors > seen.worst) {
          seen.worst = entry.marksOnActors;
          seen.worstAtX = entry.x;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function watched(page: Page): Promise<Watched> {
  return page.evaluate(() => (window as unknown as { __tnMarksSeen: Watched }).__tnMarksSeen);
}

test.beforeEach(async ({ page }) => {
  await holdToMove(page);
});

for (const levelId of ['peggys-cove', 'halifax']) {
  test(`${levelId}: no mark is drawn on the player as they walk past every subject, or on anyone standing`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const subjects = subjectsOf(levelId);
    const last = subjects.at(-1);
    expect(last, `${levelId} has nothing to mark, so this walk checks nothing`).toBeDefined();

    await page.goto(`./?e2e=1&level=${levelId}`);
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe, 'the level draws its player with a placeholder: no rig, no figure').toHaveAttribute(
      'data-player-drawn',
      'true',
    );
    await expect(probe, 'the level offers no marks, so there is nothing to keep off anyone').not.toHaveAttribute(
      'data-affordances',
      '0',
    );

    await watchMarks(page);
    const arrived = await walkWithProbe(page, 'ArrowRight', { kind: 'past', x: (last ?? 0) + 200 }, { budgetMs: 200_000 });
    expect(arrived, `the walk never got past the last subject on ${levelId}`).toBe(true);

    const seen = await watched(page);
    expect(seen.counted, 'no frame carried a count, so the scene is not measuring marks on characters').toBeGreaterThan(
      60,
    );
    expect(
      seen.worst,
      `a mark overlapped a character on ${levelId} with the player at x ${String(seen.worstAtX)}: ` +
        'the ring is on the player (or a guide), which is the defect from Peggy\'s Cove',
    ).toBe(0);
  });
}
