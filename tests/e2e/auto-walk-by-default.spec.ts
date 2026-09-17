import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { reachLevelSelect } from './front-door';
import { START_LEVEL } from './start-level';

/**
 * The game walks by itself for a player who has changed nothing. ADR-0058.
 *
 * `auto-move-stops.spec.ts` proves what an automatic drive does once it is on —
 * that it comes to rest at each thing it can engage, that the thing can then be
 * engaged, that a nudge carries the player on. This file proves the one thing
 * that file cannot: that a player who never opens Settings **gets** it, and that
 * the switch still takes it away and remembers that they did.
 *
 * It goes in through the real front door — title, creator, map — because the
 * claim is about what a first-run player receives, and a deep link would skip
 * the three screens between them and the level.
 *
 * Every assertion is on the intent the level was handed and on where the level
 * put the player, never on a picture.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Only the parts of the level document this file reads. */
interface LevelFile {
  readonly spawn: { readonly x: number };
  readonly locomotion: readonly {
    readonly drive: string;
    readonly interaction: { readonly reachPx: number } | null;
  }[];
  readonly pois: readonly { readonly id: string; readonly position: { readonly x: number } }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
}

const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as LevelFile;

const MODE = LEVEL.locomotion[0];
if (MODE === undefined) throw new Error(`content/levels/${START_LEVEL}.json declares no locomotion`);

/**
 * The level the map opens has to be one a player would otherwise *hold* a
 * control to walk. On a mode that drives itself the default proves nothing,
 * because the level would move with the setting off as well.
 */
if (MODE.drive !== 'held') {
  throw new Error(
    `content/levels/${START_LEVEL}.json drives itself, so this suite cannot tell the auto-walk ` +
      'default from the level. Point it at a level whose first mode is "held".',
  );
}

const REACH = MODE.interaction?.reachPx ?? 0;
if (REACH <= 0) {
  throw new Error(
    `content/levels/${START_LEVEL}.json spawns in a mode that can engage nothing, so an ` +
      'automatic drive has nothing to stop for.',
  );
}

/** The first thing a player leaving the spawn comes to. */
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
    throw new Error(`content/levels/${START_LEVEL}.json places nothing ahead of its spawn.`);
  }
  return first;
})();

interface Frame {
  readonly frame: number;
  readonly dtSeconds: number;
  readonly x: number;
  readonly velocityX: number;
  readonly intentMove: number;
}

interface Snapshot {
  readonly playerX?: number;
  readonly speed?: number;
}

const frames = (page: Page): Promise<Frame[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { frames: () => Frame[] } }).__tnScene.frames(),
  );

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { snapshot: () => Snapshot } }).__tnScene.snapshot(),
  );

/**
 * Wait until the level has simulated `seconds` more than it had. Simulated, not
 * wall clock: this suite renders on SwiftShader and `locomotion.ts` clamps a
 * step, so a busy machine runs the world slow and a scenario phrased in seconds
 * would fail on the frame rate instead of on the default.
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

const waitForRest = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () =>
      ((window as unknown as { __tnScene: { snapshot: () => { speed?: number } } }).__tnScene
        .snapshot().speed ?? 0) === 0,
    undefined,
    { timeout: 45_000 },
  );

/** Title, creator, map, level — the route a first-run player actually takes. */
async function playFromAColdStart(page: Page): Promise<void> {
  await page.goto('./?e2e=1');
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
  await reachLevelSelect(page);
  await page.locator(`[data-testid="level-card-${START_LEVEL}"]`).click();
  await page.waitForSelector('[data-testid="playable"]');
}

test.describe('a player who has changed nothing', () => {
  test('walks out of the spawn without holding anything, and stops at the first thing', async ({
    page,
  }) => {
    await playFromAColdStart(page);

    const spawnX = (await snapshot(page)).playerX ?? 0;
    await waitForRest(page);
    /* And stays: a drive that restarted itself after a beat would pass a single
       reading and fail the player (ADR-0032 — no timer, no automatic restart). */
    await waitForSimulated(page, 1.5);

    const trace = await frames(page);
    expect(
      trace.every((frame) => frame.intentMove === 0),
      'something was holding a direction, so this proves nothing about the default',
    ).toBe(true);
    expect(
      trace.some((frame) => frame.velocityX !== 0),
      'the player never moved: the game did not walk by itself',
    ).toBe(true);

    const shot = await snapshot(page);
    expect(shot.playerX ?? 0, 'the player never left the spawn').toBeGreaterThan(spawnX);
    expect(shot.speed ?? -1, 'the drive did not come to rest').toBe(0);
    expect(
      Math.abs((shot.playerX ?? 0) - FIRST.x),
      `the drive put the player at ${Math.round(shot.playerX ?? 0)}, which the ${String(REACH)} px ` +
        `reach of "${FIRST.id}" at ${String(FIRST.x)} cannot cover — they were carried past it`,
    ).toBeLessThanOrEqual(REACH);

    /* The canvas is `aria-hidden`, so what tells a player something is here is
       the prompt and the live region, not the picture. */
    await expect(page.locator('[data-testid="interact-prompt"]')).toBeVisible();
  });

  test('is told, in words, that it stopped and how to go on', async ({ page }) => {
    await playFromAColdStart(page);
    await waitForRest(page);

    /* `hud.stop.hint` (ADR-0043). It names no input, so it is true for a thumb,
       a key and a switch alike — which is why the default can ship without a
       sentence explaining a control. */
    await expect(page.locator('[data-testid="interact-hint"]')).toContainText(
      'Stopped here. Choose it, or move again to go on.',
    );
  });

  test('can still steer, and is picked back up when they let go', async ({ page }) => {
    await playFromAColdStart(page);
    await waitForSimulated(page, 0.8);

    /*
     * `TN-SET-05`: no setting may trap the player. A held key is a third input
     * into the same sum the keyboard and the finger already share, so it wins
     * over the drive — and letting go hands the player back to it rather than
     * leaving them stranded.
     */
    const before = (await snapshot(page)).playerX ?? 0;
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(
      () => {
        const recent = (
          window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } }
        ).__tnScene
          .frames()
          .slice(-3);
        return recent.length === 3 && recent.every((frame) => frame.intentMove === -1);
      },
      undefined,
      { timeout: 20_000 },
    );
    await waitForSimulated(page, 1.2);
    const steered = (await snapshot(page)).playerX ?? 0;
    await page.keyboard.up('ArrowLeft');

    expect(steered, 'holding left did not overrule the automatic drive').toBeLessThan(before);
  });
});

test.describe('the switch still turns it off', () => {
  test('one tap in Settings stops the game walking, and the player stands still', async ({
    page,
  }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    await page.locator('[data-testid="title-settings"]').click();
    const toggle = page.locator('[data-testid="setting-auto-move"]');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    /* The state is a word as well as a position (`TN-SET-07`): removing the
       animation removes no information, and neither does removing colour. */
    await expect(toggle).toContainText('On');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toContainText('Off');
    await page.locator('[data-testid="settings-close"]').click();

    await reachLevelSelect(page);
    await page.locator(`[data-testid="level-card-${START_LEVEL}"]`).click();
    await page.waitForSelector('[data-testid="playable"]');

    const spawnX = (await snapshot(page)).playerX ?? 0;
    await waitForSimulated(page, 3);
    const shot = await snapshot(page);

    expect(shot.playerX ?? 0, 'the game kept walking after the switch was turned off').toBeCloseTo(
      spawnX,
      3,
    );
    expect(shot.speed ?? -1).toBe(0);

    /* And the player can still move, by holding a direction themselves. */
    await page.keyboard.down('ArrowRight');
    await waitForSimulated(page, 1);
    await page.keyboard.up('ArrowRight');
    expect((await snapshot(page)).playerX ?? 0, 'holding a key moved nobody').toBeGreaterThan(
      spawnX,
    );
  });

  test('and the choice is still off after a reload', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.locator('[data-testid="title-settings"]').click();
    await page.locator('[data-testid="setting-auto-move"]').click();
    await expect(page.locator('[data-testid="setting-auto-move"]')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.locator('[data-testid="settings-close"]').click();

    /* `TN-SAVE` item 3: "the switches are where they left them". A default that
       came back on a reload would undo the player's decision every session,
       which is the one failure this change could not be allowed to have. */
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.locator('[data-testid="title-settings"]').click();
    await expect(
      page.locator('[data-testid="setting-auto-move"]'),
      'a player who turned auto-walk off found it back on after a reload',
    ).toHaveAttribute('aria-checked', 'false');
  });
});
