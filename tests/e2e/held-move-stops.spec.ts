import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type CDPSession, type Page } from '@playwright/test';

import { holdToMove } from './held-drive';
import { START_LEVEL } from './start-level';

/**
 * Holding to move stops at each thing a player can choose, and a fresh press
 * carries them on. ADR-0032, `TN-REACH-09`.
 *
 * The product owner's words: *the character stops on each point of interest.*
 * `tests/unit/adapters/phaser/auto-stop.test.ts` proves the rule against every
 * shipped level with the real strategy — that a held drive lands inside reach in
 * every mode, that holding on does not overrule the stop, that steering back and
 * engaging release it, that nothing stops a player twice. This file exists for
 * the half that arithmetic cannot reach: that a real key and a real finger, on
 * the shipped build, are joined to it.
 *
 * Every assertion is on the intent the level was handed and on where the level
 * put the player, never on a picture. Waits are on simulated frames, for the
 * reason `level-ottawa.spec.ts` gives: this suite renders on SwiftShader and
 * `locomotion.ts` clamps a step, so a busy machine runs the world slow.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** ADR-0002. Portrait, always. */
const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

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

/**
 * The level the game opens on, read rather than typed (`start-level.ts`), and
 * the first two things in it. Everything below is phrased in that level's own
 * numbers, so moving the guide or tuning the walk does not rewrite this file.
 */
const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as LevelFile;

const MODE = LEVEL.locomotion[0];
if (MODE === undefined) throw new Error(`content/levels/${START_LEVEL}.json declares no locomotion`);
if (MODE.drive !== 'held') {
  throw new Error(
    `content/levels/${START_LEVEL}.json drives itself, so nobody holds anything to move on it ` +
      'and this suite is about nothing. auto-move-stops.spec.ts covers an automatic drive.',
  );
}

const REACH = MODE.interaction?.reachPx ?? 0;
if (REACH <= 0) {
  throw new Error(
    `content/levels/${START_LEVEL}.json spawns in a mode that can engage nothing, so nothing ` +
      'stops a held drive and this suite is about nothing.',
  );
}

const AHEAD = [
  ...LEVEL.pois.map((poi) => ({ id: poi.id, x: poi.position.x })),
  ...LEVEL.characters.map((character) => ({ id: character.characterId, x: character.position.x })),
]
  .filter((subject) => subject.x > LEVEL.spawn.x)
  .sort((a, b) => a.x - b.x);

const FIRST = AHEAD[0];
const SECOND = AHEAD[1];
if (FIRST === undefined || SECOND === undefined) {
  throw new Error(
    `content/levels/${START_LEVEL}.json places fewer than two things ahead of its spawn, so ` +
      '"stops at each one and goes on to the next" cannot be walked.',
  );
}

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

async function openLevel(page: Page): Promise<void> {
  await page.goto(`./?e2e=1&level=${START_LEVEL}`);
  await page.waitForSelector('[data-testid="playable"]');
}

/** Wait until the level has simulated `seconds` more than it had. */
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

/**
 * Wait until the last three frames were all given `move` as their intent.
 *
 * Three, not one, for `touch-controls.spec.ts`'s reason: "some frame was given
 * 0" is true of every trace, because the level starts at rest.
 */
async function waitForIntent(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const recent = (
        window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } }
      ).__tnScene
        .frames()
        .slice(-3);
      return recent.length === 3 && recent.every((frame) => frame.intentMove === want);
    },
    move,
    { timeout: 20_000 },
  );
}

/**
 * Wait until the level holds the player at rest with `move` still pressed.
 *
 * The state this whole file is about, read off the trace: three frames in a row
 * that were handed a direction and moved the player not at all. Before ADR-0032
 * that never happened in open level, because a held drive did not stop.
 */
async function waitForHeldAtRest(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const recent = (
        window as unknown as {
          __tnScene: { frames: () => { intentMove: number; velocityX: number }[] };
        }
      ).__tnScene
        .frames()
        .slice(-3);
      return (
        recent.length === 3 &&
        recent.every((frame) => frame.intentMove === want && frame.velocityX === 0)
      );
    },
    move,
    { timeout: 45_000 },
  );
}

async function waitForPlayerPast(page: Page, x: number): Promise<void> {
  await page.waitForFunction(
    (want: number) =>
      ((window as unknown as { __tnScene: { snapshot: () => { playerX?: number } } }).__tnScene
        .snapshot().playerX ?? 0) >= want,
    x,
    { timeout: 45_000 },
  );
}

/* ----------------------------------------------------------------- fingers -- */

/**
 * A design-space point on the glass, as a viewport point Chromium can be handed.
 *
 * Measured from the canvas's layout box, as `touch-controls.spec.ts` does, rather
 * than restating `Scale.FIT`'s arithmetic.
 */
async function onGlass(page: Page, designX: number, designY: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('the game canvas has no layout box');
  return {
    x: box.x + (designX / DESIGN_WIDTH) * box.width,
    y: box.y + (designY / DESIGN_HEIGHT) * box.height,
  };
}

/** A real touch, through the DevTools protocol, into Phaser's own `TouchManager`. */
async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchEnd',
  point: { x: number; y: number } | null,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point === null ? [] : [{ x: point.x, y: point.y, id: 1 }],
  });
}

/* --------------------------------------------------------------- scenarios -- */

/*
 * A player who holds a control to move (ADR-0058).
 *
 * The game walks by itself for anybody who has changed nothing, and every
 * scenario below is about a *held* drive — where a hold comes to rest, what
 * holding on does not overrule, what a release glides. That precondition used to
 * be the shipped default and is now a choice, so the spec states it.
 */
test.beforeEach(async ({ page }) => {
  await holdToMove(page);
});

test.describe('holding to move stops at each thing a player can choose (TN-REACH-09)', () => {
  test('a held key comes to rest at the first thing, and holding on does not move it', async ({
    page,
  }) => {
    await openLevel(page);

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForHeldAtRest(page, 1);
      /* And it stays: the key is still down, and a stop that gave way to a held
         key after a beat would pass the first reading and fail the player. */
      await waitForSimulated(page, 1.5);

      const trace = await frames(page);
      const shot = await snapshot(page);

      expect(
        trace.some((frame) => frame.velocityX > 0),
        'the player never moved, so nothing was stopped',
      ).toBe(true);
      expect(
        trace.slice(-20).every((frame) => frame.intentMove === 1 && frame.velocityX === 0),
        'the key was held down the whole time and the player moved on',
      ).toBe(true);
      expect(shot.speed ?? -1, 'the level did not stay at rest').toBe(0);
      expect(shot.playerX ?? 0, 'the player never left the spawn').toBeGreaterThan(LEVEL.spawn.x);
      expect(
        Math.abs((shot.playerX ?? 0) - FIRST.x),
        `a held walk came to rest at ${Math.round(shot.playerX ?? 0)}, which the ${String(REACH)} ` +
          `px reach of "${FIRST.id}" at ${String(FIRST.x)} cannot cover`,
      ).toBeLessThanOrEqual(REACH);

      /* The non-visual half: the canvas is `aria-hidden`, so what says something
         is here is `poi/entered`, spoken through the live region — and it has to
         have happened by the time the player is standing at it. */
      const entered = (await events(page)).filter((event) => event.name === 'poi/entered');
      expect(entered.map((event) => event.detail)).toContain(FIRST.id);
      expect(
        shot.affordancesReady ?? 0,
        'the player was stopped at something the level was not offering to engage',
      ).toBeGreaterThan(0);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
  });

  test('letting go and pressing again carries them on, to the next thing', async ({ page }) => {
    await openLevel(page);

    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await waitForHeldAtRest(page, 1);
    const restX = (await snapshot(page)).playerX ?? 0;

    await page.keyboard.up('ArrowRight');
    await waitForIntent(page, 0);
    /* Nothing restarts on its own, and there is no timer to wait out. */
    await waitForSimulated(page, 0.5);
    expect((await snapshot(page)).playerX ?? 0).toBeCloseTo(restX, 3);

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      /* Held continuously from here: getting past the first thing's reach at
         all is the proof that it did not catch the player a second time. */
      await waitForPlayerPast(page, FIRST.x + REACH);
      /* "Each": the next thing along stops them the same way. */
      await waitForHeldAtRest(page, 1);
      const shot = await snapshot(page);
      expect(
        Math.abs((shot.playerX ?? 0) - SECOND.x),
        `pressing on from "${FIRST.id}" came to rest at ${Math.round(shot.playerX ?? 0)}, not at ` +
          `"${SECOND.id}" (${String(SECOND.x)})`,
      ).toBeLessThanOrEqual(REACH);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
  });

  test('pressing the other way walks away from it at once (TN-SET-05)', async ({ page }) => {
    await openLevel(page);

    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await waitForHeldAtRest(page, 1);
    const restX = (await snapshot(page)).playerX ?? 0;
    await page.keyboard.up('ArrowRight');
    await waitForIntent(page, 0);

    await page.keyboard.down('ArrowLeft');
    try {
      await waitForIntent(page, -1);
      await waitForSimulated(page, 0.6);
      expect(
        (await snapshot(page)).playerX ?? 0,
        'the player pressed the other way and the stop kept them where they were',
      ).toBeLessThan(restX - 10);
    } finally {
      await page.keyboard.up('ArrowLeft');
    }
  });

  test('a held finger stops there too, and lifting and holding again carries on', async ({
    page,
  }) => {
    await openLevel(page);
    await waitForSimulated(page, 0.5);
    const cdp = await page.context().newCDPSession(page);

    /*
     * Near the right edge of the glass and above the HUD, which is anchored to the
     * bottom of the screen: well to the right of the player however the camera
     * leads, and on nothing but world. A finger held on the interact prompt would
     * be a tap on the prompt when it lifted.
     */
    const finger = await onGlass(page, DESIGN_WIDTH - 80, 900);

    await touch(cdp, 'touchStart', finger);
    try {
      await waitForIntent(page, 1);
      await waitForHeldAtRest(page, 1);
      const shot = await snapshot(page);
      expect(
        Math.abs((shot.playerX ?? 0) - FIRST.x),
        `a held finger came to rest at ${Math.round(shot.playerX ?? 0)}, out of reach of "${FIRST.id}"`,
      ).toBeLessThanOrEqual(REACH);
    } finally {
      await touch(cdp, 'touchEnd', null);
    }
    await waitForIntent(page, 0);

    await touch(cdp, 'touchStart', finger);
    try {
      await waitForIntent(page, 1);
      await waitForPlayerPast(page, FIRST.x + REACH);
    } finally {
      await touch(cdp, 'touchEnd', null);
    }

    /* Two holds, each longer than a tap: neither lift was read as a jump. */
    expect((await events(page)).map((event) => event.name)).not.toContain('player/jumped');
  });
});
