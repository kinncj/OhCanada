import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

/**
 * TN-LEVEL-01, -03 and -04 against the production artefact.
 *
 * ## Where each assertion is allowed to look
 *
 * This is the split `scene-probe.ts` was built around and it is not negotiable.
 * Assertions phrased as *states* — "`data-mode` is skate", "`data-particles` is
 * a number", "`data-player-x` equals the spawn in the level file" — read the
 * 10 Hz element, which is what `docs/stories/README.md` specifies. Assertions
 * phrased as *invariants over frames* read the unsampled ring buffer through
 * `window.__tnScene.frames()`:
 *
 *   - "never falls from above half of maxSpeed to 0 inside a single frame" — a
 *     100 ms poll sees one frame in six and can never observe a single frame;
 *   - "passes through 0 before the player moves left" — a zero crossing lasts
 *     one or two frames;
 *   - "never increases while I am not holding anything" — a spike between two
 *     polls is invisible.
 *
 * Asserting those three against the throttled element would not make them pass;
 * it would make them *flaky*, which is worse, because a test that fails one run
 * in six teaches people to press re-run. If a future change makes one of them
 * hard to satisfy, the answer is to fix the physics, never to move the assertion
 * onto the snapshot.
 *
 * ## Where the numbers come from
 *
 * `content/levels/ottawa.json`, read here on disk. The story says the scenarios
 * "assert relationships and read the values from that file, so tuning the level
 * does not rewrite the tests", and that is only true if the test never restates
 * a number.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface LevelFile {
  readonly id: string;
  readonly spawn: { readonly x: number };
  readonly theme: { readonly sky: string };
  readonly size: { readonly x: number };
  readonly locomotion: readonly {
    readonly mode: string;
    readonly maxSpeed: number;
    readonly maxSpeedMultiplierDownhill: number;
    readonly interaction: { readonly reachPx: number } | null;
  }[];
  readonly ground: readonly { readonly x: number; readonly y: number }[];
  readonly pois: readonly { readonly id: string; readonly position: { readonly x: number } }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
}

const OTTAWA = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/ottawa.json`, 'utf8'),
) as LevelFile;

const SKATE = OTTAWA.locomotion[0];
if (SKATE === undefined) throw new Error('content/levels/ottawa.json declares no locomotion');

const LEVEL_URL = `./?e2e=1&level=${OTTAWA.id}`;

/** Where the level's ground stops descending. Read off the polyline, not typed in. */
const DESCENT_END_X = (() => {
  let steepest = { x: 0, drop: 0 };
  for (let index = 1; index < OTTAWA.ground.length; index += 1) {
    const a = OTTAWA.ground[index - 1];
    const b = OTTAWA.ground[index];
    if (a === undefined || b === undefined) continue;
    const drop = b.y - a.y;
    if (drop > steepest.drop) steepest = { x: b.x, drop };
  }
  if (steepest.drop <= 0) throw new Error('the level has no descent for TN-LEVEL-03 to skate down');
  return steepest.x;
})();

const LANDMARK_X = OTTAWA.pois[0]?.position.x ?? 0;

/** One frame as `scene-probe.ts` records it. Restated so a rename fails a test. */
interface Frame {
  readonly frame: number;
  readonly t: number;
  readonly dtSeconds: number;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly speed: number;
  readonly grounded: boolean;
  readonly facing: 'left' | 'right';
  readonly intentMove: number;
  readonly cameraX: number;
}

interface TraceEvent {
  readonly name: string;
  readonly t: number;
  readonly frame: number;
  readonly detail?: string;
}

async function openLevel(page: Page): Promise<void> {
  await page.goto(LEVEL_URL);
  await page.waitForSelector('[data-testid="playable"]');
}

const frames = (page: Page): Promise<Frame[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { frames: () => Frame[] } }).__tnScene.frames(),
  );

const events = (page: Page): Promise<TraceEvent[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { events: () => TraceEvent[] } }).__tnScene.events(),
  );

const clearTrace = (page: Page): Promise<void> =>
  page.evaluate(() =>
    (window as unknown as { __tnScene: { clearTrace: () => void } }).__tnScene.clearTrace(),
  );

/**
 * Wait until the trace has accumulated `seconds` of *simulated* time.
 *
 * Wall clock is not a usable ruler here. This suite renders on SwiftShader with
 * `fullyParallel`, and `locomotion.ts` bounds a step at `MAX_STEP_SECONDS` so a
 * slow frame cannot brake a skater from cruise to zero in one go — so on a busy
 * machine the world runs slow, and `waitForTimeout(1000)` buys a quarter of a
 * simulated second. A fixed timeout would make every relationship in
 * TN-LEVEL-03 fail for a reason that has nothing to do with the tuning, which is
 * the flakiness this file's header refuses.
 *
 * So the wait is on the thing being measured. A machine too slow to simulate
 * `seconds` inside the Playwright timeout still fails, loudly, with a message
 * that says the frame rate was the problem — which is true, and is the perf
 * suite's business rather than a wrong answer here.
 */
async function waitForSimulated(page: Page, seconds: number): Promise<void> {
  /* Measured from *now*, by frame index, not from the start of the buffer: the
     level has been running since it became playable, so a wait that summed the
     whole trace would already be satisfied before the interaction began and the
     key would be pressed and released inside one frame. `frame` is monotonic in
     the probe, so this is a delta and it survives a trace that was never cleared. */
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

/** Hold a key until `seconds` of simulated time have passed, then release it. */
async function holdForSimulated(page: Page, key: string, seconds: number): Promise<void> {
  await page.keyboard.down(key);
  await waitForIntent(page, key === 'ArrowLeft' ? -1 : 1);
  await waitForSimulated(page, seconds);
  await page.keyboard.up(key);
  /* And wait for the release to land too, or the next phase starts while the
     game still thinks a direction is held and the two intents cancel. */
  await waitForIntent(page, 0);
}

/**
 * Wait until a frame has actually been given `move` as its intent.
 *
 * Pressing a key and the game *seeing* it pressed are two different events, and
 * under load they can be seconds apart: the keystroke crosses the CDP
 * connection, Chromium queues it, Phaser drains its key queue on its next
 * update, and only then does a frame carry the intent. A scenario that measures
 * from the `keyboard.down` call instead of from that frame is measuring the
 * round trip, and it fails with "no player/braked" — a sentence about the
 * physics — when the truth is that the physics was never asked.
 *
 * So the tests wait for the input to land, and if it never does they say that
 * instead.
 */
async function waitForIntent(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const scene = (window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } })
        .__tnScene;
      /* The *last* frames, not any frame. "Some frame was given 0" is true of
         every trace ever recorded — the level starts at rest — so a release
         checked that way is not checked at all, and the next phase starts while
         the game still thinks the previous direction is held. Holding left and
         right at once sums to zero, which is why that mistake presents as
         "the skater never went left". */
      const recent = scene.frames().slice(-3);
      return recent.length === 3 && recent.every((frame) => frame.intentMove === want);
    },
    move,
    { timeout: 20_000 },
  );
}

/** Wait until the skater's world x passes `x`, or fail saying it never did. */
async function waitForPlayerPast(page: Page, x: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const scene = (window as unknown as { __tnScene: { snapshot: () => { playerX?: number } } })
        .__tnScene;
      return (scene.snapshot().playerX ?? 0) >= want;
    },
    x,
    { timeout: 45_000 },
  );
}

/**
 * The first frame at or after `ms` of *simulated* time from the start of the
 * trace.
 *
 * Not wall time, and the difference matters. `locomotion.ts` clamps a step at
 * `MAX_STEP_SECONDS` so one slow frame cannot brake a skater from cruise to
 * zero, which means a machine below 30 fps runs the world slow. This suite runs
 * several Chromiums on a software rasteriser at once, and it is routinely below
 * 30 fps for that reason and no other.
 *
 * TN-LEVEL-03 is a statement about the tuning — "at least 70 percent of maxSpeed
 * after 1 second" — so integrating the simulated `dt` asks the question the
 * story asks. Whether the machine delivers those seconds in a second is
 * `tests/perf/budgets.spec.ts`'s question, it has its own budget, and answering
 * it here as well would make one number fail two different claims.
 */
const at = (trace: readonly Frame[], ms: number): Frame | undefined => {
  let simulated = 0;
  for (const frame of trace) {
    simulated += frame.dtSeconds * 1000;
    if (simulated >= ms) return frame;
  }
  return undefined;
};

/** Total simulated seconds in a trace. The premise every timed assertion needs. */
const simulatedSeconds = (trace: readonly Frame[]): number =>
  trace.reduce((total, frame) => total + frame.dtSeconds, 0);

/**
 * The trace from the first frame the player was actually holding something.
 *
 * Clearing the trace and pressing a key are two round trips to the browser, and
 * the game keeps drawing between them — so a trace cleared "just before" a hold
 * still opens with a handful of idle frames. Measuring "speed after 100 ms" from
 * the start of the buffer then measures the round trip, and fails on a busy
 * machine for a reason that has nothing to do with acceleration. The trace
 * records the intent each frame was given, which is exactly what makes the
 * question answerable: start where the input did.
 */
const fromFirstHeld = (trace: readonly Frame[]): readonly Frame[] => {
  const start = trace.findIndex((frame) => frame.intentMove !== 0);
  return start === -1 ? [] : trace.slice(start);
};

test.describe('TN-LEVEL-01 — the level becomes playable', () => {
  test('the marker appears and the scene reports the level it loaded', async ({ page }) => {
    await openLevel(page);

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', OTTAWA.id);
    await expect(probe).toHaveAttribute('data-mode', SKATE.mode);
    await expect(probe).toHaveAttribute('data-paused', 'false');
  });

  test('the level/ready fact is emitted, naming the level', async ({ page }) => {
    await openLevel(page);
    const trace = await events(page);
    const ready = trace.find((event) => event.name === 'level/ready');
    expect(ready, 'no level/ready in the event trace').toBeDefined();
    expect(ready?.detail).toBe(OTTAWA.id);
  });

  test('the player starts at the spawn in the level file, facing along the canal', async ({
    page,
  }) => {
    await openLevel(page);

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-player-x', String(OTTAWA.spawn.x));
    await expect(probe).toHaveAttribute('data-facing', 'right');
    await expect(probe).toHaveAttribute('data-speed', '0');
    await expect(probe).toHaveAttribute('data-grounded', 'true');
  });

  test('the canvas stays hidden from assistive technology, and the marker carries nothing', async ({
    page,
  }) => {
    await openLevel(page);

    await expect(page.locator('#game canvas')).toHaveAttribute('aria-hidden', 'true');
    const marker = page.locator('[data-testid="playable"]');
    await expect(marker).toHaveAttribute('aria-hidden', 'true');
    await expect(marker).toHaveText('');
    /* One channel for a screen-reader user, and the level did not add a second. */
    await expect(page.locator('[aria-live]')).toHaveCount(1);
  });

  test('a level nobody authored never becomes playable', async ({ page }) => {
    /*
     * It never opens at all now, which is `TN-FLOW-05`: a level id no document
     * declares has no words either — no waiting sentence, no failure title — and
     * `app/bootstrap` may not invent them, so the player is taken to the level
     * select instead of to an error card that names whichever level had a story
     * first. `tests/e2e/level-landmarks.spec.ts` covers the failure card by
     * failing a level this build really has.
     */
    await page.goto('./?e2e=1&level=atlantis');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await expect(page.locator('html')).not.toHaveAttribute('data-tn-level', /.*/);
    await expect(page.locator('[data-testid="playable"]')).toHaveCount(0);
    await expect(page.getByTestId('level-select')).toBeVisible();
  });

  test('a normal load opens the front door, not a level', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await expect(page.locator('[data-testid="playable"]')).toHaveCount(0);
    /* And it explains itself. This used to be the foundation caption, which was
       true of a page with nothing to press; task 1.20 replaced it with the title
       screen, which is a way in rather than an apology for not having one. */
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-tn-level', /.*/);
  });

  test('nothing from the empty shell is left on screen over a running level', async ({ page }) => {
    await openLevel(page);

    /* The caption reads "Foundation build. There is no level to play yet", which
       was found sitting over the ice in the most legible panel on the screen.
       It is a statement about a page with no level, and it is mounted only on
       one now (`app/bootstrap/main.ts`). */
    await expect(
      page.locator('#tn-build-status'),
      'the foundation-build caption is on screen over a level that is playing',
    ).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'ready');

    /* And the front door is detached, not hidden behind a style rule: the shell's
       root is a `<main>` while it is showing, and two of them on one page is an
       axe `landmark-one-main` violation and a real ambiguity for a screen reader
       (`TN-FLOW-08`). */
    await expect(page.locator('#tn-shell')).toHaveCount(0);
    await expect(page.locator('main')).toHaveCount(1);

    /* The desktop side panels are the *level's* sky and ground (ADR-0002), not
       the boot screen's hills: those stops are collapsed while a level is open,
       because a level's ground is a polyline and no single band matches it. */
    const land = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        crest: style.getPropertyValue('--tn-land-crest').trim(),
        skirt: style.getPropertyValue('--tn-land-skirt').trim(),
        end: style.getPropertyValue('--tn-land-end').trim(),
        sky: style.getPropertyValue('--tn-sky').trim(),
      };
    });
    expect(land.crest).toBe('100%');
    expect(land.skirt).toBe('100%');
    expect(land.end).toBe('100%');
    /* And the panels carry the level's own theme, not `game.config.json`'s. */
    expect(land.sky.toLowerCase()).toBe(OTTAWA.theme.sky.toLowerCase());
  });
});

test.describe('TN-LEVEL-03 — skating feels like ice', () => {
  test('speed builds up instead of starting at full pace', async ({ page }) => {
    await openLevel(page);
    await clearTrace(page);

    await holdForSimulated(page, 'ArrowRight', 1.4);
    const trace = fromFirstHeld(await frames(page));

    expect(trace.length, 'the level never saw the key go down').toBeGreaterThan(10);
    expect(
      simulatedSeconds(trace),
      'the hold did not simulate a full second, so nothing below is being asked',
    ).toBeGreaterThan(1);
    expect(at(trace, 100)?.speed ?? 0).toBeGreaterThan(0);
    expect(at(trace, 200)?.speed ?? 0).toBeLessThan(SKATE.maxSpeed / 2);
    expect(at(trace, 1_000)?.speed ?? 0).toBeGreaterThanOrEqual(SKATE.maxSpeed * 0.7);

    const moved = (await events(page)).filter((event) => event.name === 'player/moved');
    expect(moved.length, 'no player/moved while the hold lasted').toBeGreaterThan(0);
  });

  test('releasing does not stop the skater, and nothing speeds up on its own', async ({ page }) => {
    await openLevel(page);
    await holdForSimulated(page, 'ArrowRight', 1.5);
    await clearTrace(page);
    await waitForSimulated(page, 2.2);

    const trace = await frames(page);
    const coasting = trace.filter((frame) => frame.intentMove === 0);
    expect(coasting.length, 'nothing was recorded during the coast').toBeGreaterThan(10);
    expect(simulatedSeconds(coasting), 'the coast was shorter than a second').toBeGreaterThan(1);

    const oneSecondIn = at(coasting, 1_000);
    expect(
      oneSecondIn,
      `the coast held ${simulatedSeconds(coasting).toFixed(2)} simulated seconds over ` +
        `${String(coasting.length)} frames, so there was no frame a second in`,
    ).toBeDefined();
    expect(oneSecondIn?.speed ?? 0).toBeGreaterThanOrEqual(SKATE.maxSpeed / 2);
    for (const frame of coasting) expect(frame.velocityX).toBeGreaterThan(0);

    /* The per-frame assertion. A 10 Hz poll would step over any spike between
       two samples, so this reads every frame the browser actually drew. */
    for (let index = 1; index < coasting.length; index += 1) {
      const previous = coasting[index - 1]?.speed ?? 0;
      const current = coasting[index]?.speed ?? 0;
      expect(
        current,
        `speed rose from ${previous.toFixed(1)} to ${current.toFixed(1)} with nothing held`,
      ).toBeLessThanOrEqual(previous + 1e-6);
    }
  });

  test('turning around passes through zero and costs time', async ({ page }) => {
    await openLevel(page);
    await holdForSimulated(page, 'ArrowRight', 1.5);
    await clearTrace(page);
    await page.keyboard.down('ArrowLeft');
    await waitForIntent(page, -1);
    await waitForSimulated(page, 2.5);
    await page.keyboard.up('ArrowLeft');

    const trace = await frames(page);
    const firstLeft = trace.findIndex((frame) => frame.velocityX < 0);
    expect(firstLeft, 'the skater never went left').toBeGreaterThan(0);

    /* One or two frames long. Only the unsampled buffer can see it. */
    expect(
      trace.slice(0, firstLeft).some((frame) => frame.velocityX === 0),
      'the skater reversed without ever passing through a stop',
    ).toBe(true);

    for (const frame of trace) {
      if (frame.facing === 'left') expect(frame.velocityX).toBeLessThan(0);
    }
  });

  test('holding the other way brakes, and there is no instant stop', async ({ page }) => {
    await openLevel(page);
    await holdForSimulated(page, 'ArrowRight', 1.5);
    await clearTrace(page);
    await page.keyboard.down('ArrowLeft');
    await waitForIntent(page, -1);
    await waitForSimulated(page, 1.5);
    await page.keyboard.up('ArrowLeft');

    const trace = await frames(page);
    expect(
      trace.some((frame) => frame.intentMove === -1 && frame.velocityX > 0),
      'the premise: the other way was held while the skater was still going right',
    ).toBe(true);

    const braked = (await events(page)).filter((event) => event.name === 'player/braked');
    expect(braked.length, 'no player/braked when the other way was held').toBeGreaterThan(0);

    expect(trace.length).toBeGreaterThan(10);
    for (let index = 1; index < trace.length; index += 1) {
      const previous = trace[index - 1];
      const current = trace[index];
      if ((previous?.speed ?? 0) > SKATE.maxSpeed / 2) {
        expect(
          current?.speed ?? 0,
          `speed fell from ${(previous?.speed ?? 0).toFixed(1)} to 0 between frames ` +
            `${String(previous?.frame)} and ${String(current?.frame)}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test('a downhill adds speed, and never past the stated limit', async ({ page }) => {
    await openLevel(page);
    await clearTrace(page);
    /* Far enough to cross the descent the level draws. Driven by the skater's
       position rather than by a clock, so a slow machine takes longer and still
       measures the same stretch of canal. */
    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await waitForPlayerPast(page, DESCENT_END_X);
    await page.keyboard.up('ArrowRight');

    const trace = await frames(page);
    const ceiling = SKATE.maxSpeed * SKATE.maxSpeedMultiplierDownhill;
    const top = Math.max(...trace.map((frame) => frame.speed));

    expect(top, 'the skater never reached the descent').toBeGreaterThan(SKATE.maxSpeed);
    for (const frame of trace) {
      expect(
        frame.speed,
        `speed ${frame.speed.toFixed(1)} over the ${ceiling.toFixed(1)} px/s cap`,
      ).toBeLessThanOrEqual(ceiling + 1e-6);
    }
  });

  test('a tap is a hop that keeps the momentum, and there is no second one', async ({ page }) => {
    await openLevel(page);
    await holdForSimulated(page, 'ArrowRight', 1.5);
    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await clearTrace(page);
    await page.mouse.click(200, 300);
    /* The second tap, while still in the air: "there is no second jump". The hop
       lasts about 0.6 simulated seconds, so a fifth of that is safely inside it. */
    await waitForSimulated(page, 0.12);
    await page.mouse.click(200, 300);
    await waitForSimulated(page, 2);
    await page.keyboard.up('ArrowRight');

    const jumps = (await events(page)).filter((event) => event.name === 'player/jumped');
    expect(jumps, 'a tap in the play area did not hop, or hopped twice').toHaveLength(1);

    const trace = await frames(page);
    const airborne = trace.filter((frame) => !frame.grounded);
    expect(airborne.length, 'the skater never left the ice').toBeGreaterThan(0);

    const takeOff = trace[trace.findIndex((frame) => !frame.grounded) - 1];
    const landingIndex = trace.findIndex(
      (frame, index) => index > 0 && frame.grounded && !(trace[index - 1]?.grounded ?? true),
    );
    expect(landingIndex, 'the skater never came back down').toBeGreaterThan(0);
    expect(trace[landingIndex]?.speed ?? 0).toBeGreaterThanOrEqual((takeOff?.speed ?? 0) * 0.9);
  });

  test('the player cannot leave the level', async ({ page }) => {
    await openLevel(page);
    await clearTrace(page);
    await holdForSimulated(page, 'ArrowLeft', 4);

    const trace = await frames(page);
    expect(trace.length).toBeGreaterThan(30);
    for (const frame of trace) {
      expect(frame.x, 'the skater went past the left bound').toBeGreaterThanOrEqual(-1e-6);
      /* "and the player does not fall through the ice": the polyline is the
         floor, so y must stay finite and on it. */
      expect(Number.isFinite(frame.y)).toBe(true);
      expect(frame.y).toBeLessThan(2_000);
    }
  });
});

test.describe('TN-LEVEL-04 — the camera, in portrait', () => {
  test('never scrolls backwards while the skater is moving right', async ({ page }) => {
    await openLevel(page);
    await clearTrace(page);
    await holdForSimulated(page, 'ArrowRight', 3);
    await waitForSimulated(page, 4);

    const trace = await frames(page);
    expect(trace.length).toBeGreaterThan(20);
    for (let index = 1; index < trace.length; index += 1) {
      const previous = trace[index - 1];
      const current = trace[index];
      if ((current?.velocityX ?? 0) > 0) {
        expect(current?.cameraX ?? 0).toBeGreaterThanOrEqual((previous?.cameraX ?? 0) - 1e-6);
      }
    }
  });

  test('keeps the skater between 25 and 70 percent of the canvas width', async ({ page }) => {
    await openLevel(page);
    await clearTrace(page);
    await holdForSimulated(page, 'ArrowRight', 3);
    await waitForSimulated(page, 4);

    /* Design width, because the camera works in design space and `Scale.FIT`
       maps that onto the canvas without cropping (ADR-0002). */
    const trace = await frames(page);
    for (const frame of trace) {
      const fraction = (frame.x - frame.cameraX) / 1080;
      expect(fraction, `player at ${(fraction * 100).toFixed(1)}% of the canvas`).toBeGreaterThan(
        0.25,
      );
      expect(fraction).toBeLessThan(0.7);
    }
  });

  test('the canvas keeps the 1080 by 1920 aspect ratio', async ({ page }) => {
    await openLevel(page);
    const box = await page.locator('#game canvas').boundingBox();
    expect(box).not.toBeNull();
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(1080 / 1920, 2);
  });

  /**
   * The tier may draw fewer pixels; it may not draw a different picture.
   *
   * `renderScale` and `maxPixelRatio` were declared in every graphics preset and
   * applied by nothing, so the tier degraded particles and parallax layers and
   * never the fragment count — the dominant cost on the software rasterisers
   * ADR-0011 exists to keep playable. Wiring them shrinks the canvas *backing
   * store* and lets `Scale.FIT`'s CSS stretch it back, which is invisible except
   * as speed. These are the assertions that keep "invisible" true, because the
   * way this goes wrong is a mis-framed portrait canvas rather than an error:
   *
   *   - the backing store is smaller than the design resolution on this device
   *     (otherwise nothing is being degraded and the wiring is decorative);
   *   - it keeps the design aspect ratio exactly, so nothing is stretched;
   *   - the CSS size is unchanged — the letterbox is where it was;
   *   - the camera still shows the same world, which the "25 to 70 percent"
   *     scenario above asserts by reading design-space coordinates.
   */
  test('draws fewer pixels at a degraded tier without changing the picture', async ({ page }) => {
    await openLevel(page);
    const probe = page.locator('[data-testid="scene-state"]');
    /* Wait for a measured tier: before the first window closes the buffer is
       still the provisional tier's, and this would test the guess. */
    await expect(probe).toHaveAttribute('data-tier', /^(low|medium|high)$/);
    await expect(page.locator('#game canvas')).toHaveAttribute('data-tn-tier-measured', 'true');

    const canvas = await page.locator('#game canvas').evaluate((node) => {
      const element = node as HTMLCanvasElement;
      const rect = element.getBoundingClientRect();
      return {
        backingWidth: element.width,
        backingHeight: element.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
      };
    });
    const tier = await probe.getAttribute('data-tier');
    const where =
      `tier "${String(tier)}": backing ${String(canvas.backingWidth)}x` +
      `${String(canvas.backingHeight)}, css ${canvas.cssWidth.toFixed(1)}x` +
      `${canvas.cssHeight.toFixed(1)}`;

    /* This suite runs Chromium on SwiftShader, which `tierCeilingFor` caps at
       medium, and both low and medium ask for fewer pixels than the design
       resolution on a 390 CSS px viewport. A full-size buffer here means the
       presets are being read and thrown away, which is the defect. */
    expect(
      canvas.backingWidth,
      `the drawing buffer is still the full design width, so the tier's renderScale and ` +
        `maxPixelRatio are being resolved and ignored — ${where}`,
    ).toBeLessThan(1080);
    expect(canvas.backingWidth, `the buffer collapsed — ${where}`).toBeGreaterThanOrEqual(270);

    expect(
      canvas.backingWidth / canvas.backingHeight,
      `the drawing buffer is not the design aspect ratio, so the picture is stretched — ${where}`,
    ).toBeCloseTo(1080 / 1920, 2);

    /* The letterbox is CSS and must not have moved: FIT sizes the element from
       the parent, and shrinking the buffer is meant to be invisible. */
    expect(
      canvas.cssWidth / canvas.cssHeight,
      `the canvas element changed shape — ${where}`,
    ).toBeCloseTo(1080 / 1920, 2);
  });
});

test.describe('TN-LEVEL-05 — coming into reach', () => {
  const OFFICER = OTTAWA.characters[0]?.characterId;
  const LANDMARK = OTTAWA.pois[0]?.id;
  const REACH = SKATE.interaction?.reachPx ?? 0;

  test('reports entering and leaving reach, naming who was reached', async ({ page }) => {
    expect(OFFICER, 'the level places nobody to come into reach of').toBeDefined();
    await openLevel(page);
    await clearTrace(page);

    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await waitForPlayerPast(page, (OTTAWA.characters[0]?.position.x ?? 0) + REACH + 200);
    await page.keyboard.up('ArrowRight');

    const trace = await events(page);
    const entered = trace
      .filter((event) => event.name === 'poi/entered')
      .map((event) => event.detail);
    const left = trace.filter((event) => event.name === 'poi/left').map((event) => event.detail);

    expect(entered, 'the skater passed the officer without entering reach').toContain(OFFICER);
    expect(left, 'reach was entered and never left').toContain(OFFICER);
  });

  test('a landmark further down the canal comes into reach the same way', async ({ page }) => {
    /* `test.slow()` because this one is a traversal, not a computation: the
       landmark is thousands of design pixels down the canal and this suite
       renders on a software rasteriser, several browsers at a time. The
       assertion is about the reach rule, not about how long the skate took. */
    test.slow();
    expect(LANDMARK, 'the level has no landmark to reach').toBeDefined();
    await openLevel(page);
    await clearTrace(page);

    await page.keyboard.down('ArrowRight');
    await waitForIntent(page, 1);
    await waitForPlayerPast(page, LANDMARK_X - REACH + 40);
    await page.keyboard.up('ArrowRight');

    const entered = (await events(page))
      .filter((event) => event.name === 'poi/entered')
      .map((event) => event.detail);
    expect(entered, 'the skater reached the landmark without entering reach').toContain(LANDMARK);
  });
});

test.describe('the visual tier is spent on something', () => {
  test('reports a tier, and a particle count inside the phone budget', async ({ page }) => {
    await openLevel(page);

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-tier', /^(low|medium|high)$/);
    await expect(probe).toHaveAttribute('data-parallax-easing', /^(on|off)$/);

    const particles = Number(await probe.getAttribute('data-particles'));
    expect(Number.isFinite(particles)).toBe(true);
    /* CLAUDE.md, Budgets: <= 400 on a phone, and this project runs the suite at
       390x844 with a coarse pointer, which is a phone. */
    expect(particles).toBeLessThanOrEqual(400);
  });

  test('this suite runs on a software rasteriser, so the tier is capped', async ({ page }) => {
    await openLevel(page);
    /* The same claim `scene-probe.spec.ts` makes at boot, re-made with a level
       on screen: if the level ever reports `high` here, the device string has
       stopped being read and the degrade is not happening. */
    await expect(page.locator('#game canvas')).toHaveAttribute('data-tn-tier', /^(low|medium)$/);
  });
});
