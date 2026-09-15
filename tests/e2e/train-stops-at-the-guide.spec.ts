import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { hasCopyRow, text } from '@ui/copy';

/**
 * A mode that drives itself stops at the task's giver however the player
 * presses, and a ride with a front backs up only while they press back.
 * ADR-0043, `TN-REACH-12`.
 *
 * A second live-site audit found both on the Prairies. The train drives itself
 * from the spawn and comes to rest past the guide with "Talk to the guide" on
 * offer — but a player who pressed right as it braked let the guide go, rode on
 * to the grain bins, and reached the end of a level whose task had never started.
 * And steering back out of a stop turned the passenger round, then drove the car
 * backwards at 739 px/s to the start of the world with the rider half off the
 * glass.
 *
 * `tests/unit/adapters/phaser/auto-stop.test.ts` and `backing.test.ts` prove the
 * rules with the real strategy. This file joins them to a real key on the shipped
 * build. Waits are on simulated frames, for the reason `level-ottawa.spec.ts`
 * gives: SwiftShader runs the world slow.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** ADR-0002. Portrait, always. */
const DESIGN_WIDTH = 1080;

/** Only the parts of a level document this file reads. */
interface LevelFile {
  readonly id: string;
  readonly spawn: { readonly x: number };
  readonly ground: readonly { readonly x: number }[];
  readonly camera: { readonly zoom: number };
  readonly locomotion: readonly {
    readonly mode: string;
    readonly drive: string;
    readonly interaction: { readonly reachPx: number } | null;
  }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
  readonly rides: readonly {
    readonly mode: string;
    readonly turnsWithRider: boolean;
    readonly backingMaxSpeed?: number;
    readonly riderAnchor: { readonly x: number };
  }[];
}

const LEVELS = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')) as LevelFile);

/** The level that drives itself on a ride with a front — read, never typed. */
const LEVEL = LEVELS.find((level) => {
  const mode = level.locomotion[0];
  return (
    mode !== undefined &&
    mode.drive === 'auto' &&
    level.rides.some((ride) => ride.mode === mode.mode && !ride.turnsWithRider)
  );
});
if (LEVEL === undefined) {
  throw new Error('no shipped level drives itself on a ride that does not turn, so this suite is about nothing');
}
const MODE = LEVEL.locomotion[0];
const RIDE = LEVEL.rides.find((ride) => ride.mode === MODE?.mode);
const REACH = MODE?.interaction?.reachPx ?? 0;
const GIVER = [...LEVEL.characters]
  .filter((character) => character.position.x > LEVEL.spawn.x)
  .sort((a, b) => a.position.x - b.position.x)[0];
if (MODE === undefined || RIDE === undefined || REACH <= 0 || GIVER === undefined) {
  throw new Error(`content/levels/${LEVEL.id}.json places no character ahead of its spawn for its ride to stop at`);
}
const BACKING = RIDE.backingMaxSpeed;
if (BACKING === undefined) {
  throw new Error(`content/levels/${LEVEL.id}.json declares no backingMaxSpeed on a ride that does not turn`);
}
/** Where the ride's tail meets the world's edge (`backing.ts#backingBounds`). */
const EDGE = Math.max(0, LEVEL.ground[0]?.x ?? 0) + RIDE.riderAnchor.x;
const PROMPT_KEY = `hud.interact.${GIVER.characterId}`;
const PROMPT = hasCopyRow(PROMPT_KEY)
  ? text('en', PROMPT_KEY as Parameters<typeof text>[1])
  : text('en', 'hud.interact.npc');

/* --------------------------------------------------------------- the probe -- */

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
  readonly cameraX?: number;
}

type Scene = { __tnScene: { frames: () => Frame[]; snapshot: () => Snapshot } };

const frames = (page: Page): Promise<Frame[]> =>
  page.evaluate(() => (window as unknown as Scene).__tnScene.frames());

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => (window as unknown as Scene).__tnScene.snapshot());

const lastFrame = async (page: Page): Promise<number> => (await frames(page)).at(-1)?.frame ?? -1;

async function openLevel(page: Page): Promise<void> {
  await page.goto(`./?e2e=1&level=${LEVEL?.id ?? ''}`);
  await page.waitForSelector('[data-testid="playable"]');
}

async function waitForSimulated(page: Page, seconds: number): Promise<void> {
  const after = await lastFrame(page);
  await page.waitForFunction(
    ({ want, since }: { want: number; since: number }) =>
      (window as unknown as Scene).__tnScene
        .frames()
        .filter((frame) => frame.frame > since)
        .reduce((total, frame) => total + frame.dtSeconds, 0) >= want,
    { want: seconds, since: after },
    { timeout: 60_000 },
  );
}

async function waitForIntent(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const recent = (window as unknown as Scene).__tnScene.frames().slice(-3);
      return recent.length === 3 && recent.every((frame) => frame.intentMove === want);
    },
    move,
    { timeout: 20_000 },
  );
}

/** Three frames in a row handed `move` that moved the player not at all. */
async function waitForAtRest(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    ({ want, spawn }: { want: number; spawn: number }) => {
      const recent = (window as unknown as Scene).__tnScene.frames().slice(-3);
      return (
        recent.length === 3 &&
        recent.every((frame) => frame.intentMove === want && frame.velocityX === 0 && frame.x > spawn + 1)
      );
    },
    { want: move, spawn: LEVEL?.spawn.x ?? 0 },
    { timeout: 60_000, polling: 'raf' },
  );
}

/** The drive is being brought to rest: moving forward, slower on each of three frames. */
async function waitForBraking(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const [a, b, c] = (window as unknown as Scene).__tnScene.frames().slice(-3);
      return (
        a !== undefined &&
        b !== undefined &&
        c !== undefined &&
        c.velocityX > 0 &&
        a.velocityX > b.velocityX &&
        b.velocityX > c.velocityX
      );
    },
    undefined,
    { timeout: 60_000, polling: 'raf' },
  );
}

async function waitForPlayer(page: Page, compare: 'past' | 'back to', x: number): Promise<void> {
  await page.waitForFunction(
    ({ want, past }: { want: number; past: boolean }) => {
      const at = (window as unknown as Scene).__tnScene.snapshot().playerX ?? Number.NaN;
      return past ? at >= want : at <= want;
    },
    { want: x, past: compare === 'past' },
    { timeout: 60_000 },
  );
}

/** Where the rider is across the glass: 0 is the left edge, 1 the right. */
const acrossTheGlass = (shot: Snapshot): number =>
  (((shot.playerX ?? 0) - (shot.cameraX ?? 0)) * (LEVEL?.camera.zoom ?? 1)) / DESIGN_WIDTH;

/* --------------------------------------------------------------- scenarios -- */

test.describe('a mode that drives itself stops at the task’s giver, however the player presses (ADR-0043)', () => {
  test('a press begun while it brakes for the guide leaves it resting past him, offering the task', async ({
    page,
  }) => {
    await openLevel(page);
    await waitForBraking(page);

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForAtRest(page, 1);
      /* And it stays: the key is still down. */
      await waitForSimulated(page, 1);

      const trace = await frames(page);
      const pressed = trace.findIndex((frame) => frame.intentMove === 1);
      expect(pressed, 'the key never reached the level').toBeGreaterThan(0);
      expect(
        trace[pressed - 1]?.velocityX ?? 0,
        'the drive was already at rest when the key went down, so this is not the press the audit made',
      ).toBeGreaterThan(0);
      expect(
        trace.slice(-20).every((frame) => frame.intentMove === 1 && frame.velocityX === 0),
        'the key was held down and the drive went on',
      ).toBe(true);

      const shot = await snapshot(page);
      const x = shot.playerX ?? 0;
      expect(
        x,
        `the drive came to rest at ${String(Math.round(x))}, which is not past "${GIVER.characterId}" at ` +
          `${String(GIVER.position.x)} — ADR-0037 rests this ride beyond him, clear of its glass`,
      ).toBeGreaterThan(GIVER.position.x);
      expect(
        x - GIVER.position.x,
        `the drive came to rest at ${String(Math.round(x))}, out of its ${String(REACH)} px reach`,
      ).toBeLessThanOrEqual(REACH);
      await expect(page.getByTestId('interact-prompt')).toHaveText(PROMPT);
    } finally {
      await page.keyboard.up('ArrowRight');
    }

    /* The offer is the task's: taking it opens the giver's dialogue. */
    await waitForIntent(page, 0);
    await page.getByTestId('interact-prompt').click();
    await expect(page.getByTestId('dialogue')).toBeVisible();
  });

  test('a key held from the moment the level is playable rests there too', async ({ page }) => {
    await openLevel(page);
    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForAtRest(page, 1);
      await waitForSimulated(page, 1);
      const x = (await snapshot(page)).playerX ?? 0;
      expect(x).toBeGreaterThan(GIVER.position.x);
      expect(x - GIVER.position.x).toBeLessThanOrEqual(REACH);
      await expect(page.getByTestId('interact-prompt')).toHaveText(PROMPT);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
  });
});

test.describe('a ride with a front backs up only while the player presses back (ADR-0043)', () => {
  test('backing is slow, stops when let go, waits, keeps its tail in the world and the rider on the glass', async ({
    page,
  }) => {
    test.slow();
    await openLevel(page);
    /* Nothing pressed: the drive stops at the guide on its own. */
    await waitForAtRest(page, 0);
    const restX = (await snapshot(page)).playerX ?? 0;
    const since = await lastFrame(page);

    await page.keyboard.down('ArrowLeft');
    try {
      await waitForIntent(page, -1);
      await waitForSimulated(page, 2);
    } finally {
      await page.keyboard.up('ArrowLeft');
    }
    await waitForIntent(page, 0);
    await waitForSimulated(page, 2);

    const trace = (await frames(page)).filter((frame) => frame.frame > since);
    const fastest = Math.max(...trace.map((frame) => -frame.velocityX));
    expect(fastest, 'pressing back did not back the ride up at all').toBeGreaterThan(0);
    expect(
      fastest,
      `the ride backed up at ${String(Math.round(fastest))} px/s, over the level's ${String(BACKING)}`,
    ).toBeLessThanOrEqual(BACKING + 0.5);
    expect(
      trace.slice(-20).every((frame) => frame.intentMove === 0 && frame.velocityX === 0),
      'the ride drove itself on after backing up, with nothing pressed',
    ).toBe(true);
    expect((await snapshot(page)).playerX ?? 0, 'the ride never left the stop').toBeLessThan(restX - 10);

    /* All the way back: the tail stops at the world's edge, and the rider is still framed. */
    await page.keyboard.down('ArrowLeft');
    try {
      await waitForIntent(page, -1);
      await waitForPlayer(page, 'back to', EDGE + 1);
      await waitForSimulated(page, 0.5);
    } finally {
      await page.keyboard.up('ArrowLeft');
    }
    await waitForIntent(page, 0);
    await waitForSimulated(page, 1);

    const edge = await snapshot(page);
    expect(edge.speed ?? -1, 'the ride is still moving against the edge after being let go').toBe(0);
    expect(edge.playerX ?? 0, `the ride backed past ${String(EDGE)}, taking its tail out of the world`).toBeGreaterThanOrEqual(
      EDGE - 0.5,
    );
    const across = acrossTheGlass(edge);
    expect(across, `the rider is ${String(Math.round(across * 100))} % across the glass`).toBeGreaterThanOrEqual(0.25);
    expect(across, `the rider is ${String(Math.round(across * 100))} % across the glass`).toBeLessThanOrEqual(0.75);

    /* A press forward sends it on, and the drive carries it from there. */
    const beforeForward = await lastFrame(page);
    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    await waitForPlayer(page, 'past', EDGE + 300);
    const onward = (await frames(page)).filter((frame) => frame.frame > beforeForward);
    expect(
      onward.some((frame) => frame.intentMove === 0 && frame.velocityX > 0),
      'the drive did not carry the ride forward once it was sent on',
    ).toBe(true);
  });
});
