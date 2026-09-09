import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type CDPSession, type Page } from '@playwright/test';

import {
  TAP_MAX_MS,
  TAP_MAX_TRAVEL_PX,
  WALK_DEADZONE_PX,
} from '@adapters/phaser/touch-controls';

/**
 * Touch, through real touch events, into real Phaser.
 *
 * Every scenario below sends `touchstart` / `touchmove` / `touchend` /
 * `touchcancel` down the DevTools protocol at Chromium's input pipeline. Nothing
 * here calls into the adapter: the events go through Chromium's event
 * synthesis, into Phaser's own `TouchManager`, out of Phaser's `POINTER_*`
 * events, and what is asserted is the `intentMove` the *level* was given on the
 * frames that followed. That is the outermost edge this suite can reach, and it
 * is the only place where "the walk actually starts" and "the walk actually
 * stops" are facts rather than restatements.
 *
 * `tests/unit/adapters/phaser/touch-controls.test.ts` covers the arithmetic —
 * every branch of the tap/hold boundary, the hysteresis, the hit-area growth. It
 * exists for speed and coverage. This file exists because that one, on its own,
 * would prove only that a module agrees with itself.
 *
 * ## What is deliberately not here
 *
 * There is no assertion that a d-pad is absent, because there is nothing to
 * assert against: no on-canvas control was drawn, so the only honest check is
 * that walking works with the finger anywhere on the screen — which is what
 * "touch at 600 walks left because the player is at 680" says. A virtual
 * controller cannot produce that result.
 *
 * ## Numbers
 *
 * Read from `content/levels/ottawa.json` and from `touch-controls.ts`, never
 * typed in, so tuning the level or the thresholds does not rewrite the tests.
 * The one exception is the design resolution, which is a fixed decision
 * (ADR-0002) rather than something being tuned.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** ADR-0002. Portrait, always, and these two numbers do not move. */
const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

/** Only the parts of the level document this file actually reads. */
interface LevelFile {
  readonly id: string;
  readonly locomotion: readonly {
    readonly interaction: { readonly reachPx: number } | null;
  }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
}

const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/ottawa.json`, 'utf8'),
) as LevelFile;

const MODE = LEVEL.locomotion[0];
if (MODE === undefined) throw new Error('content/levels/ottawa.json declares no locomotion');

const NPC = LEVEL.characters[0];
if (NPC === undefined) throw new Error('content/levels/ottawa.json places no character to tap');

const LEVEL_URL = `./?e2e=1&level=${LEVEL.id}`;

/** One frame as `scene-probe.ts` records it. Restated so a rename fails a test. */
interface Frame {
  readonly frame: number;
  readonly dtSeconds: number;
  readonly x: number;
  readonly velocityX: number;
  readonly intentMove: number;
  readonly cameraX: number;
}

interface TraceEvent {
  readonly name: string;
  readonly frame: number;
  readonly detail?: string;
}

interface Snapshot {
  readonly playerX?: number;
  readonly cameraX?: number;
  readonly speed?: number;
}

/* --------------------------------------------------------------- the probe -- */

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
    () =>
      (window as unknown as { __tnScene: { snapshot: () => Snapshot } }).__tnScene.snapshot(),
  );

const clearTrace = (page: Page): Promise<void> =>
  page.evaluate(() =>
    (window as unknown as { __tnScene: { clearTrace: () => void } }).__tnScene.clearTrace(),
  );

/* ----------------------------------------------------- design <-> the glass -- */

interface CanvasBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the canvas is on the page, in CSS pixels.
 *
 * Measured rather than computed. `Scale.FIT` centres a 1080x1920 canvas inside a
 * 390x844 viewport, which puts it at a y offset nobody should be restating, and
 * the whole point of touching "somewhere on the world" is that the mapping from
 * a design coordinate to a physical one is the app's job and not the test's.
 */
async function canvasBox(page: Page): Promise<CanvasBox> {
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('the game canvas has no layout box');
  return box;
}

/** A design-space point as a viewport CSS-pixel point Chromium can be handed. */
const onGlass = (box: CanvasBox, designX: number, designY: number): { x: number; y: number } => ({
  x: box.x + (designX / DESIGN_WIDTH) * box.width,
  y: box.y + (designY / DESIGN_HEIGHT) * box.height,
});

/* ------------------------------------------------------------------ fingers -- */

interface Finger {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Real touch events, at the outermost edge a Node process can reach.
 *
 * Playwright's `touchscreen.tap` is a `touchstart` immediately followed by a
 * `touchend`, which is the one gesture this feature does not need help with. A
 * hold, a drag, a second finger and a browser-cancelled touch all have to be
 * built out of `Input.dispatchTouchEvent` directly. These *are* the DOM events —
 * Chromium synthesises them exactly as it does for a finger — so Phaser's own
 * `TouchManager` is what reads them and nothing in this repository is being
 * faked or stubbed anywhere in the path.
 *
 * `touchPoints` means different things per type, and getting it backwards is
 * silent: for `touchStart` and `touchMove` it is every point that is down, and
 * for `touchEnd` and `touchCancel` it is the points *being lifted* — so `[]`
 * lifts all of them and `[a]` lifts `a` and leaves the rest. Verified against
 * Chromium's own `changedTouches` rather than read off the protocol docs,
 * because the first reading of them here was wrong in exactly the direction that
 * still made a two-finger test pass.
 */
async function dispatch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  fingers: readonly Finger[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: fingers.map((finger) => ({ x: finger.x, y: finger.y, id: finger.id })),
  });
}

/* ------------------------------------------------------------------- waits -- */

/**
 * Wait until the level has simulated `seconds` more than it had.
 *
 * Wall clock is not a ruler here for the reason `level-ottawa.spec.ts` gives at
 * length: this suite renders on SwiftShader with four workers, `locomotion.ts`
 * clamps a step at `MAX_STEP_SECONDS`, and a busy machine therefore runs the
 * world slow. Everything below is phrased in simulated time so a slow machine
 * fails on the frame rate — which is the perf suite's question — instead of
 * failing on the tuning, which is this one's.
 */
async function waitForSimulated(page: Page, seconds: number): Promise<void> {
  const since = await page.evaluate(() => {
    const scene = (window as unknown as { __tnScene: { frames: () => { frame: number }[] } })
      .__tnScene;
    return scene.frames().at(-1)?.frame ?? -1;
  });

  await page.waitForFunction(
    ({ want, after }: { want: number; after: number }) => {
      const scene = (
        window as unknown as {
          __tnScene: { frames: () => { frame: number; dtSeconds: number }[] };
        }
      ).__tnScene;
      return (
        scene
          .frames()
          .filter((frame) => frame.frame > after)
          .reduce((total, frame) => total + frame.dtSeconds, 0) >= want
      );
    },
    { want: seconds, after: since },
    { timeout: 45_000 },
  );
}

/**
 * Wait until three consecutive frames were given `move` as their intent.
 *
 * Three, not one: "some frame was given 0" is true of every trace ever recorded,
 * because the level starts at rest. Dispatching a touch and the game *seeing* it
 * are different events separated by a CDP round trip, Chromium's input queue and
 * Phaser's next update, so a scenario that measured from the `dispatch` call
 * would be measuring the round trip.
 */
async function waitForIntent(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const scene = (window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } })
        .__tnScene;
      const recent = scene.frames().slice(-3);
      return recent.length === 3 && recent.every((frame) => frame.intentMove === want);
    },
    move,
    { timeout: 20_000 },
  );
}

async function openLevel(page: Page): Promise<CDPSession> {
  await page.goto(LEVEL_URL);
  await page.waitForSelector('[data-testid="playable"]');
  /* One frame of physics before anything is asked of the level: the camera
     eases to its resting scroll over the first few frames and every scenario
     below is phrased relative to where the player is on the glass. */
  await waitForSimulated(page, 0.5);
  return page.context().newCDPSession(page);
}

/** Where the player is on the glass right now, in design pixels. Ottawa's zoom is 1. */
async function playerViewX(page: Page): Promise<number> {
  const shot = await snapshot(page);
  return (shot.playerX ?? 0) - (shot.cameraX ?? 0);
}

/**
 * Hold a finger at a design-space point until the level has been given `move`,
 * then keep holding for a beat, then lift.
 *
 * The hold has to outlast `TAP_MAX_MS` to become a walk at all, which is the
 * property being exercised, so the wait is on the intent rather than on a sleep.
 */
async function holdAt(
  page: Page,
  cdp: CDPSession,
  point: { x: number; y: number },
  expectMove: number,
  seconds: number,
): Promise<void> {
  await dispatch(cdp, 'touchStart', [{ id: 1, ...point }]);
  await waitForIntent(page, expectMove);
  await waitForSimulated(page, seconds);
}

/** Wait until the level's own speed reading drops to `limit` design px/s. */
async function waitForSpeedBelow(page: Page, limit: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const scene = (window as unknown as { __tnScene: { snapshot: () => { speed?: number } } })
        .__tnScene;
      return (scene.snapshot().speed ?? 0) <= want;
    },
    limit,
    { timeout: 30_000 },
  );
}

/** Hold the right arrow for `seconds` of simulated time. */
async function runRight(page: Page, seconds: number): Promise<void> {
  await page.keyboard.down('ArrowRight');
  await waitForIntent(page, 1);
  await waitForSimulated(page, seconds);
  await page.keyboard.up('ArrowRight');
  await waitForIntent(page, 0);
}

/**
 * Bring the player to a stop, ending up facing `facing`.
 *
 * Not "release the key and wait". Ottawa's mode has `glide: 0.9`, so free
 * friction is `deceleration x (1 - glide)` = 90 px/s²: a skater released at
 * cruise coasts for nearly seven seconds and two thousand pixels. Every
 * scenario that needs the player *somewhere specific* has to brake, and braking
 * is holding the opposite direction — which `locomotion.ts` truncates at exactly
 * zero rather than through it, so the facing set on the way in survives the stop.
 */
async function brakeToRest(page: Page, facing: 'left' | 'right'): Promise<void> {
  const towards = facing === 'left' ? 'ArrowLeft' : 'ArrowRight';
  const against = facing === 'left' ? 'ArrowRight' : 'ArrowLeft';

  await page.keyboard.down(towards);
  await waitForIntent(page, facing === 'left' ? -1 : 1);
  /* Long enough to reverse the travel and pick up real speed the other way, so
     the facing is unambiguous before the brake starts. */
  await waitForSimulated(page, 1.2);
  await page.keyboard.up(towards);

  await page.keyboard.down(against);
  await waitForSpeedBelow(page, 25);
  /* Released the moment the speed is gone: holding on past zero would start
     accelerating the other way and flip the facing this function exists to set. */
  await page.keyboard.up(against);
  await waitForIntent(page, 0);
  await waitForSpeedBelow(page, 5);
  /* The camera eases to the resting scroll; the whole point of this helper is
     that the caller can then read a stable position off the glass. */
  await waitForSimulated(page, 1.2);
}

test.describe('hold anywhere to walk, and the direction comes from the player', () => {
  test('a finger to the right of the player walks right', async ({ page }) => {
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const startX = (await snapshot(page)).playerX ?? 0;
    const player = await playerViewX(page);
    await clearTrace(page);

    await holdAt(page, cdp, onGlass(box, player + 300, 1500), 1, 0.6);
    await dispatch(cdp, 'touchEnd', []);

    const trace = await frames(page);
    expect(trace.some((frame) => frame.intentMove === 1)).toBe(true);
    expect(trace.every((frame) => frame.intentMove >= 0)).toBe(true);
    expect((await snapshot(page)).playerX ?? 0).toBeGreaterThan(startX);
  });

  test('a finger to the LEFT of the player walks left, with the player on the right of the screen', async ({
    page,
  }) => {
    /*
     * The discriminating scenario, and the reason the rule is written the way it
     * is. Ottawa's camera carries a lead offset, so a player facing left settles
     * at roughly `540 + offset.x` — past the middle of a 1080-wide screen. The
     * finger then goes down *in the right-hand half of the glass* and still to
     * the left of the player.
     *
     * A screen-zone implementation walks right here. There is no arrangement of
     * screen halves that produces the assertion below, which is what makes it
     * worth the setup.
     */
    const cdp = await openLevel(page);
    const box = await canvasBox(page);

    /*
     * Come to rest facing left, in open world.
     *
     * Facing is what puts the player past the midpoint: the camera's lead offset
     * is applied along the heading, and at rest the heading is the facing. Every
     * step is a keyboard one, which also says out loud that the keyboard path
     * still works while touch is being added to it.
     *
     * The order matters. Walking left from the spawn would pin the player
     * against the world's left edge, where the camera's scroll clamps at 0 and
     * the player ends up at view x = 0 — the *left* of the screen, facing left.
     * So they go right first to buy room.
     */
    await runRight(page, 2.5);
    await brakeToRest(page, 'left');

    const player = await playerViewX(page);
    expect(
      player,
      'the premise of this scenario is that the player is on the right-hand side of the ' +
        'screen; the camera did not put them there, so nothing below discriminates between ' +
        'the two rules',
    ).toBeGreaterThan(DESIGN_WIDTH / 2);

    /* Far enough left of the player to clear the dead zone, and still right of
       the middle of the glass. Both are asserted rather than assumed: the second
       one is the entire discriminating power of this scenario. */
    const touchX = Math.max(DESIGN_WIDTH / 2 + 8, player - WALK_DEADZONE_PX * 2);
    expect(
      touchX,
      'the finger must land in the RIGHT half of the glass, or a screen-zone implementation ' +
        'would agree with this test and it would prove nothing',
    ).toBeGreaterThan(DESIGN_WIDTH / 2);
    expect(
      player - touchX,
      'the finger must be clearly left of the player, or the dead zone swallows it',
    ).toBeGreaterThan(WALK_DEADZONE_PX);

    const startX = (await snapshot(page)).playerX ?? 0;
    await clearTrace(page);

    await holdAt(page, cdp, onGlass(box, touchX, 1500), -1, 0.6);
    await dispatch(cdp, 'touchEnd', []);

    const trace = await frames(page);
    expect(trace.some((frame) => frame.intentMove === -1)).toBe(true);
    expect(trace.every((frame) => frame.intentMove <= 0)).toBe(true);
    expect((await snapshot(page)).playerX ?? 0).toBeLessThan(startX);
  });

  test('a press shorter than the tap window never moves the player', async ({ page }) => {
    /* The other half of one boundary: if a tap also nudged, every jump would
       come with a slide, and on a mode that glides the slide outlasts the jump. */
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);
    await clearTrace(page);

    const point = onGlass(box, player + 300, 1500);
    await dispatch(cdp, 'touchStart', [{ id: 1, ...point }]);
    await dispatch(cdp, 'touchEnd', []);
    await waitForSimulated(page, 0.5);

    const trace = await frames(page);
    expect(trace.length).toBeGreaterThan(0);
    expect(trace.every((frame) => frame.intentMove === 0)).toBe(true);
  });
});

test.describe('letting go stops the walk, and so does the browser taking the touch away', () => {
  test('lifting the finger stops the walk', async ({ page }) => {
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);

    await holdAt(page, cdp, onGlass(box, player + 300, 1500), 1, 0.4);
    await dispatch(cdp, 'touchEnd', []);
    await waitForIntent(page, 0);

    await clearTrace(page);
    await waitForSimulated(page, 0.6);
    expect((await frames(page)).every((frame) => frame.intentMove === 0)).toBe(true);
  });

  test('a touch the browser cancels stops the walk', async ({ page }) => {
    /*
     * The classic bug in this feature. A notification shade, an incoming call or
     * a system edge gesture ends a touch with `touchcancel` and *no* `touchend`;
     * an implementation that only listens for the release leaves the direction
     * latched and the player walks on by themselves while looking at something
     * else. There is no finger left to stop them.
     */
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);

    await holdAt(page, cdp, onGlass(box, player + 300, 1500), 1, 0.4);
    await dispatch(cdp, 'touchCancel', []);
    await waitForIntent(page, 0);

    await clearTrace(page);
    await waitForSimulated(page, 0.6);
    const trace = await frames(page);
    expect(trace.every((frame) => frame.intentMove === 0)).toBe(true);
  });

  test('a touch the browser cancels before the tap window is not a tap', async ({ page }) => {
    /*
     * The half of `touchcancel` that a release handler cannot cover.
     *
     * Stopping the walk happens either way, because Phaser reports a cancelled
     * touch as a pointer that came up. What only the cancel branch gets right is
     * what the *short* one means: a touch that was cut off after ninety
     * milliseconds looks exactly like a tap by duration and travel, and treating
     * it as one fires a jump for an interaction the player never finished. A
     * system gesture becoming a jump is not a small thing on a level with a
     * canal down the middle of it.
     */
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);
    await clearTrace(page);

    const point = onGlass(box, player + 260, 900);
    await dispatch(cdp, 'touchStart', [{ id: 1, ...point }]);
    await dispatch(cdp, 'touchCancel', []);
    await waitForSimulated(page, 0.8);

    const names = (await events(page)).map((event) => event.name);
    expect(
      names,
      'a cancelled touch was read as a tap: the browser took it away, the player did not ' +
        'finish it',
    ).not.toContain('player/jumped');
  });
});

test.describe('two fingers, one direction', () => {
  test('a second finger on the other side of the player does not fight the first', async ({
    page,
  }) => {
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);

    const right = { id: 1, ...onGlass(box, player + 300, 1500) };
    const left = { id: 2, ...onGlass(box, Math.max(40, player - 320), 1200) };

    await dispatch(cdp, 'touchStart', [right]);
    await waitForIntent(page, 1);
    await clearTrace(page);

    /* Both fingers down, on opposite sides of the player, for long enough that
       the second one is past the tap window and would be a hold in its own
       right. */
    await dispatch(cdp, 'touchStart', [right, left]);
    await waitForSimulated(page, 0.8);

    const trace = await frames(page);
    expect(trace.length).toBeGreaterThan(0);
    expect(
      trace.every((frame) => frame.intentMove === 1),
      'a second finger produced a second direction: the intent went to ' +
        [...new Set(trace.map((frame) => frame.intentMove))].join(', '),
    ).toBe(true);

    await dispatch(cdp, 'touchEnd', []);
    await waitForIntent(page, 0);
  });

  test('a second finger can tap to jump while the first one is walking', async ({ page }) => {
    /*
     * The reason a second finger is tracked at all rather than dropped.
     *
     * One thumb holds the walk; the other taps. Nothing conflicts, because a
     * finger that does not own the axis cannot contribute a direction — so the
     * jump lands *and the walk carries on*, which is the assertion that would
     * fail if the second touch were being read as a new hold.
     */
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);

    const walking = { id: 1, ...onGlass(box, player + 300, 1500) };
    await dispatch(cdp, 'touchStart', [walking]);
    await waitForIntent(page, 1);
    await clearTrace(page);

    /* On the *other* side of the player, deliberately. If the wrong finger were
       lifted, or if a second touch were read as a new hold, the intent below
       would not still be 1. */
    const tapping = { id: 2, ...onGlass(box, Math.max(40, player - 300), 800) };
    await dispatch(cdp, 'touchStart', [walking, tapping]);
    await dispatch(cdp, 'touchEnd', [tapping]);
    await waitForSimulated(page, 0.5);

    expect((await events(page)).map((event) => event.name)).toContain('player/jumped');
    expect((await frames(page)).every((frame) => frame.intentMove === 1)).toBe(true);

    await dispatch(cdp, 'touchEnd', []);
    await waitForIntent(page, 0);
  });
});

test.describe('a tap means the thing under it, and a jump when there is nothing', () => {
  test('a tap on empty ground jumps', async ({ page }) => {
    await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);
    await clearTrace(page);

    /* Well clear of the player and of everything the level places, so the only
       thing under the finger is world. `touchscreen.tap` is Playwright's own
       `touchstart`/`touchend` pair — a real tap, short and still by
       construction. */
    const point = onGlass(box, player + 260, 900);
    await page.touchscreen.tap(point.x, point.y);
    await waitForSimulated(page, 0.6);

    expect((await events(page)).map((event) => event.name)).toContain('player/jumped');
  });

  test('a tap on an NPC engages them and does not jump', async ({ page }) => {
    await openLevel(page);
    const box = await canvasBox(page);
    const reach = MODE.interaction?.reachPx ?? 0;

    /*
     * Come to a stop inside the character's reach first, because reach is the
     * level's own `InteractionAffordance` and a tap does not get to ignore it:
     * an NPC across the canal is scenery, and tapping scenery is tapping the
     * world. Stopping matters as much as arriving — a skater released at cruise
     * coasts through the whole reach window in about two thirds of a second, so
     * a scenario that only waited to arrive would tap at a position it had
     * already left.
     */
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      (want: number) => {
        const scene = (window as unknown as { __tnScene: { snapshot: () => { playerX?: number } } })
          .__tnScene;
        return (scene.snapshot().playerX ?? 0) >= want;
      },
      NPC.position.x - reach * 1.4,
      { timeout: 45_000 },
    );
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft');
    await waitForSpeedBelow(page, 25);
    await page.keyboard.up('ArrowLeft');
    await waitForIntent(page, 0);
    await waitForSpeedBelow(page, 5);
    await waitForSimulated(page, 1.2);

    const shot = await snapshot(page);
    const npcViewX = NPC.position.x - (shot.cameraX ?? 0);
    expect(
      Math.abs(NPC.position.x - (shot.playerX ?? 0)),
      "the premise: the player is inside the mode's reach of this character by the time " +
        'the finger lands, or the tap is a tap on scenery and jumping is the right answer',
    ).toBeLessThanOrEqual(reach);
    expect(npcViewX).toBeGreaterThan(0);
    expect(npcViewX).toBeLessThan(DESIGN_WIDTH);

    await clearTrace(page);

    /*
     * On the character's feet.
     *
     * The rig and the placeholder differ in height and agree about where the
     * ground is, so a point just above the ground line is the one that lands on
     * either. It is also the case CLAUDE.md's 44 pt rule is about: the art here
     * is far narrower than a fingertip, and what has to grow is the hit area
     * rather than the officer.
     */
    const target = onGlass(box, npcViewX, (shot.playerX ?? 0) > 0 ? 1180 : 1180);
    await page.touchscreen.tap(target.x, target.y);
    await waitForSimulated(page, 0.6);

    const trace = await events(page);
    const names = trace.map((event) => event.name);
    expect(names).toContain('npc/engaged');
    expect(
      names,
      'the tap landed on a character and the level jumped instead: hit-testing has to ' +
        'decide what a tap meant before the jump does',
    ).not.toContain('player/jumped');
    expect(trace.find((event) => event.name === 'npc/engaged')?.detail).toBe(NPC.characterId);

    /*
     * And the other half of the same claim, from the same standstill: a tap
     * *beside* the character, with the character still well inside reach, jumps.
     *
     * Without this the scenario above is satisfied by an implementation that
     * engages on any tap taken while something is in reach, which is not
     * hit-testing — it is the interact key with a finger on it, and it would
     * make it impossible to jump anywhere near an NPC.
     */
    await clearTrace(page);
    const beside = onGlass(box, npcViewX - 150, 1180);
    await page.touchscreen.tap(beside.x, beside.y);
    await waitForSimulated(page, 0.6);

    const asideNames = (await events(page)).map((event) => event.name);
    expect(asideNames).toContain('player/jumped');
    expect(
      asideNames,
      'a tap beside the character engaged them anyway: the hit area is not being tested, ' +
        'only the distance',
    ).not.toContain('npc/engaged');
  });
});

test.describe('the keyboard is not made worse by any of this', () => {
  test('holding a key still walks, and touch adds to it rather than replacing it', async ({
    page,
  }) => {
    const cdp = await openLevel(page);
    const box = await canvasBox(page);

    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await waitForSimulated(page, 0.4);

    /* A finger on the other side of the player, held past the tap window. Two
       opposing inputs cancel, which is the same answer two opposing keys give
       and is what stops one device silently overriding the other. */
    const player = await playerViewX(page);
    await dispatch(cdp, 'touchStart', [
      { id: 1, ...onGlass(box, Math.max(40, player - 320), 1400) },
    ]);
    await waitForIntent(page, 0);

    await dispatch(cdp, 'touchCancel', []);
    await waitForIntent(page, 1);

    await page.keyboard.up('ArrowRight');
    await waitForIntent(page, 0);
  });
});

test.describe('auto-move, from the switch a player can actually reach', () => {
  test('turning it on walks without anybody holding anything', async ({ page }) => {
    /*
     * CLAUDE.md's traversal row offers auto-move as an option, and an option
     * nobody can turn on is not one. So this goes the long way round — the real
     * title screen, the real settings screen, the real switch — rather than
     * poking the renderer, because the failure this guards against is exactly
     * the one where both ends exist and nothing joins them.
     *
     * It belongs in this file rather than in a settings suite because it is the
     * half of one-thumb traversal for players who cannot hold a contact at all:
     * the finger still steers and still taps, and only the holding goes away.
     */
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
    await page.locator(`[data-testid="level-card-${LEVEL.id}"]`).click();
    await page.waitForSelector('[data-testid="playable"]');

    const startX = (await snapshot(page)).playerX ?? 0;
    await waitForSimulated(page, 1.2);

    const trace = await frames(page);
    /*
     * Nobody held anything, and the assertion says so in the strongest form
     * available: every frame was given an intent of exactly zero. The movement
     * comes from `drive: 'auto'` inside the strategy — `locomotion.ts` turns a
     * zero intent into "keep going the way you are facing" — which is the whole
     * point of implementing the option as tuning rather than as a synthesised
     * direction in the scene.
     */
    expect(
      trace.every((frame) => frame.intentMove === 0),
      'something was holding a direction, so this proves nothing about auto-move',
    ).toBe(true);
    expect(trace.some((frame) => frame.velocityX !== 0)).toBe(true);
    expect((await snapshot(page)).playerX ?? 0).toBeGreaterThan(startX);
  });
});

test.describe('the thresholds are the ones the engine states', () => {
  test('a drag past the tap radius walks without waiting out the tap window', async ({ page }) => {
    /*
     * The escape hatch from the only cost the single tap/hold boundary has:
     * `TAP_MAX_MS` of latency before a hold starts walking. A player who presses
     * and slides — which is most of them — never pays it.
     */
    const cdp = await openLevel(page);
    const box = await canvasBox(page);
    const player = await playerViewX(page);
    await clearTrace(page);

    const from = onGlass(box, player + 300, 1500);
    const to = onGlass(box, player + 300 + TAP_MAX_TRAVEL_PX * 3, 1500);
    await dispatch(cdp, 'touchStart', [{ id: 1, ...from }]);
    await dispatch(cdp, 'touchMove', [{ id: 1, ...to }]);
    await waitForIntent(page, 1);

    /* And the release after a drag is not a tap, so nothing jumps. */
    await dispatch(cdp, 'touchEnd', []);
    await waitForIntent(page, 0);
    await waitForSimulated(page, 0.4);
    expect((await events(page)).some((event) => event.name === 'player/jumped')).toBe(false);

    expect(TAP_MAX_MS).toBeGreaterThan(0);
  });
});
