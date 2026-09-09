import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * Auto-move stops where a player can choose something, and lets them go on.
 *
 * The option existed, was reachable from the settings screen, and stopped for
 * nothing: a player who cannot hold a control was carried past every landmark
 * and every character in the level. `tests/unit/adapters/phaser/auto-stop.test.ts`
 * proves the arithmetic against every shipped level with the real strategy —
 * where the brake starts, that it lands inside reach, that a subject is never
 * stopped for twice. This file exists for the half that arithmetic cannot reach:
 * that the switch a player can actually press is joined to it, and that a level
 * really does come to rest and really can then be engaged.
 *
 * So it goes the long way round — the real title screen, the real settings
 * screen, the real switch, the real map card — exactly as the auto-move
 * scenario in `touch-controls.spec.ts` does, and for the same reason: the
 * failure being guarded against is the one where both ends exist and nothing
 * joins them.
 *
 * Every assertion is on the intent the level was handed and on where the level
 * put the player, never on a picture.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Only the parts of the level document this file reads. */
interface LevelFile {
  readonly spawn: { readonly x: number };
  readonly locomotion: readonly {
    readonly interaction: { readonly reachPx: number } | null;
  }[];
  readonly pois: readonly { readonly id: string; readonly position: { readonly x: number } }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
}

/**
 * The level the map actually opens, and the first thing in it.
 *
 * Read from the document rather than typed in, for `start-level.ts`'s reason:
 * which level a cold load opens is configuration and it has already moved twice.
 * Everything below is phrased in that level's own numbers, so tuning the walk or
 * moving the guide does not rewrite this file.
 */
const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as LevelFile;

const MODE = LEVEL.locomotion[0];
if (MODE === undefined) throw new Error(`content/levels/${START_LEVEL}.json declares no locomotion`);

const REACH = MODE.interaction?.reachPx ?? 0;
if (REACH <= 0) {
  throw new Error(
    `content/levels/${START_LEVEL}.json spawns in a mode that can engage nothing, so an ` +
      'automatic drive has nothing to stop for and this suite is about nothing.',
  );
}

/** The first thing a player leaving the spawn to the right comes to. */
const FIRST = ((): { readonly id: string; readonly x: number } => {
  const ahead = [
    ...LEVEL.pois.map((poi) => ({ id: poi.id, x: poi.position.x })),
    ...LEVEL.characters.map((character) => ({
      id: character.characterId,
      x: character.position.x,
    })),
  ]
    .filter((subject) => subject.x > LEVEL.spawn.x)
    .sort((a, b) => a.x - b.x);
  const first = ahead[0];
  if (first === undefined) {
    throw new Error(
      `content/levels/${START_LEVEL}.json places nothing ahead of its spawn, so there is ` +
        'nothing an automatic drive could stop for.',
    );
  }
  return first;
})();

/* --------------------------------------------------------------- the probe -- */

interface Frame {
  readonly frame: number;
  readonly dtSeconds: number;
  readonly x: number;
  readonly velocityX: number;
  readonly intentMove: number;
}

interface TraceEvent {
  readonly name: string;
  readonly frame: number;
  readonly detail?: string;
}

interface Snapshot {
  readonly playerX?: number;
  readonly speed?: number;
  readonly affordancesReady?: number;
}

const frames = (page: Page): Promise<Frame[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { frames: () => Frame[] } }).__tnScene.frames(),
  );

const events = (page: Page): Promise<TraceEvent[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { events: () => TraceEvent[] } }).__tnScene.events(),
  );

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { snapshot: () => Snapshot } }).__tnScene.snapshot(),
  );

/**
 * Wait until the level has simulated `seconds` more than it had.
 *
 * Simulated, not wall clock, for the reason `touch-controls.spec.ts` gives: this
 * suite renders on SwiftShader with several workers and `locomotion.ts` clamps a
 * step, so a busy machine runs the world slow and a scenario phrased in seconds
 * would fail on the frame rate instead of on the tuning.
 */
async function waitForSimulated(page: Page, seconds: number): Promise<void> {
  const since = await page.evaluate(
    () =>
      (window as unknown as { __tnScene: { frames: () => { frame: number }[] } }).__tnScene
        .frames()
        .at(-1)?.frame ?? -1,
  );

  await page.waitForFunction(
    ({ want, after }: { want: number; after: number }) =>
      (
        window as unknown as {
          __tnScene: { frames: () => { frame: number; dtSeconds: number }[] };
        }
      ).__tnScene
        .frames()
        .filter((frame) => frame.frame > after)
        .reduce((total, frame) => total + frame.dtSeconds, 0) >= want,
    { want: seconds, after: since },
    { timeout: 45_000 },
  );
}

/** Wait until the level's own speed reading is above / at or below a limit. */
const waitForSpeedAbove = (page: Page, limit: number): Promise<unknown> =>
  page.waitForFunction(
    (want: number) =>
      ((window as unknown as { __tnScene: { snapshot: () => { speed?: number } } }).__tnScene
        .snapshot().speed ?? 0) > want,
    limit,
    { timeout: 30_000 },
  );

const waitForRest = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () =>
      ((window as unknown as { __tnScene: { snapshot: () => { speed?: number } } }).__tnScene
        .snapshot().speed ?? 0) === 0,
    undefined,
    { timeout: 45_000 },
  );

/**
 * Turn auto-move on through the switch a player would use, then open the level
 * the map opens.
 *
 * Not `renderer.setAutoMove` and not a query parameter: the whole claim is that
 * a player can get this behaviour, and a test that pokes the adapter would pass
 * on a build where the settings screen had been unplugged.
 */
async function playWithAutoMove(page: Page): Promise<void> {
  await page.goto('./?e2e=1');
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

  await page.locator('[data-testid="title-settings"]').click();
  const toggle = page.locator('[data-testid="setting-auto-move"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-testid="settings-close"]').click();

  await page
    .locator('[data-testid="title-play"], [data-testid="title-choose-level"]')
    .first()
    .click();
  await page.locator(`[data-testid="level-card-${START_LEVEL}"]`).click();
  await page.waitForSelector('[data-testid="playable"]');
}

/* --------------------------------------------------------------- scenarios -- */

test.describe('auto-move stops where a player can choose something', () => {
  test('it comes to rest at the first subject instead of walking past it', async ({ page }) => {
    await playWithAutoMove(page);

    /* Moving first, so "stopped" is a stop and not the frame before the level
       started, and then at rest. Both are read from the level's own speed. */
    await waitForSpeedAbove(page, 50);
    await waitForRest(page);
    /* And it stays stopped: an automatic drive that restarted itself after a
       beat would pass this on the first reading and fail the player. */
    await waitForSimulated(page, 1.5);

    const trace = await frames(page);
    expect(
      trace.every((frame) => frame.intentMove === 0),
      'something was holding a direction, so this proves nothing about auto-move',
    ).toBe(true);
    expect(
      trace.some((frame) => frame.velocityX !== 0),
      'the player never moved at all, so nothing was ever stopped',
    ).toBe(true);

    const shot = await snapshot(page);
    const restingX = shot.playerX ?? 0;
    expect(shot.speed ?? -1, 'the level did not stay at rest').toBe(0);
    expect(
      Math.abs(restingX - FIRST.x),
      `auto-move put the player at ${Math.round(restingX)}, which the ${REACH} px reach of ` +
        `"${FIRST.id}" at ${FIRST.x} cannot cover — they were carried past it`,
    ).toBeLessThanOrEqual(REACH);

    /* The non-visual half. The canvas is `aria-hidden`, so what tells a player
       something is here is `poi/entered`, which `app/ui` speaks through the live
       region — and it has to have happened by the time the world went quiet. */
    const entered = (await events(page)).filter((event) => event.name === 'poi/entered');
    expect(entered.map((event) => event.detail)).toContain(FIRST.id);
    expect(
      (await snapshot(page)).affordancesReady ?? 0,
      'the level stopped at something it was not offering to engage',
    ).toBeGreaterThan(0);
  });

  test('and the player can then engage it', async ({ page }) => {
    await playWithAutoMove(page);
    await waitForSpeedAbove(page, 50);
    await waitForRest(page);
    await waitForSimulated(page, 0.3);

    /*
     * Held until the level says it saw it, then released.
     *
     * `#sampleIntent` reads `Key.isDown` once per frame, so a `press` whose
     * keydown and keyup both land between two updates is a press the level never
     * saw — the same class of defect as the dropped first keypress, and not rare
     * on a machine rendering through SwiftShader. Waiting on the *event* rather
     * than on simulated time, because engaging opens a card and the card pauses
     * the level: there are no more frames to wait for.
     */
    await page.keyboard.down('KeyE');
    await page.waitForFunction(
      (id: string) =>
        (window as unknown as { __tnScene: { events: () => { name: string; detail?: string }[] } })
          .__tnScene.events()
          .some(
            (event) =>
              (event.name === 'npc/engaged' || event.name === 'poi/engaged') && event.detail === id,
          ),
      FIRST.id,
      { timeout: 20_000 },
    );
    await page.keyboard.up('KeyE');
  });

  test('a nudge carries them on, and the same subject does not catch them again', async ({
    page,
  }) => {
    await playWithAutoMove(page);
    await waitForSpeedAbove(page, 50);
    await waitForRest(page);

    /*
     * TN-SET-05: no setting may trap the player. A held key is a third input
     * into the same sum the keyboard and the finger already share, so it wins
     * over the drive — and letting go hands the player back to it rather than
     * leaving them stranded, which is what makes the resume a nudge instead of a
     * trip to the settings screen.
     */
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      () => {
        const recent = (
          window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } }
        ).__tnScene
          .frames()
          .slice(-3);
        return recent.length === 3 && recent.every((frame) => frame.intentMove === 1);
      },
      undefined,
      { timeout: 20_000 },
    );
    await page.keyboard.up('ArrowRight');

    await page.waitForFunction(
      (want: number) =>
        ((window as unknown as { __tnScene: { snapshot: () => { playerX?: number } } }).__tnScene
          .snapshot().playerX ?? 0) > want,
      FIRST.x + REACH * 2,
      { timeout: 45_000 },
    );

    /* They left under their own steam and were carried on by the drive, not
       dragged back into a stop they had already declined. */
    const trace = await frames(page);
    const after = trace.filter((frame) => frame.x > FIRST.x + REACH);
    expect(after.length).toBeGreaterThan(10);
    expect(
      after.some((frame) => frame.intentMove === 0 && frame.velocityX !== 0),
      'the drive did not pick the player back up after the nudge',
    ).toBe(true);
  });
});
