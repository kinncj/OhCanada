import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * "Once you reach the end of a level, it should send you to a new level" — the
 * engine's half, in the browser.
 *
 * Two scenarios, and they are the two halves of the same complaint. A player
 * presses a key and the game does nothing; a player walks to the far edge and
 * the game does nothing. Both were true of the shipped build.
 *
 * ## What is proved here, and what is proved without a browser
 *
 * *Where* the line is and *that it fires once* are properties of arithmetic over
 * a run of frames, and they are proved for all four shipped levels — walked to
 * the end, back, and out again, with the real locomotion strategy and the real
 * camera — in `tests/unit/adapters/phaser/level-exit.test.ts`. Restating them
 * here would prove them once, on one machine, for one level, and would take
 * fifteen seconds of wall clock to do it.
 *
 * What only a browser can prove is the **wiring**: that a real player holding a
 * real key crosses that line and that the milestone leaves the scene. That is
 * this file. The once-ness assertion below is deliberately described as weak —
 * the composition root pauses the level when the arrival opens its card, so the
 * browser would see a single event even from a scene that re-fired every frame.
 * The latch is the unit suite's to falsify, and it has been seen to fail there.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as { readonly size: { readonly x: number }; readonly spawn: { readonly x: number } };

interface TraceEvent {
  readonly name: string;
  readonly frame: number;
  readonly detail?: string;
}

interface Frame {
  readonly frame: number;
  readonly x: number;
}

const events = (page: Page): Promise<TraceEvent[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { events: () => TraceEvent[] } }).__tnScene.events(),
  );

const frames = (page: Page): Promise<Frame[]> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { frames: () => Frame[] } }).__tnScene.frames(),
  );

const arrivals = async (page: Page): Promise<TraceEvent[]> =>
  (await events(page)).filter((event) => event.name === 'level/exitReached');

const playerX = async (page: Page): Promise<number> =>
  Number(
    (await page.locator('[data-testid="scene-state"]').getAttribute('data-player-x')) ?? Number.NaN,
  );

test.describe('the first thing a player does', () => {
  /**
   * A key pressed in the same tick the level says it is playable.
   *
   * This is the defect the study suite works around by walking in short bursts,
   * made deterministic. `KeyboardManager` dispatches a `keydown`
   * **synchronously**, from the DOM handler, and `KeyboardPlugin.update` drops
   * any event whose `Key` has not been created yet. The scene used to create its
   * keys lazily, from `#sampleIntent`, on its first `update` — one frame after
   * `create` had already shown this marker. A held key produces no second
   * `keydown` under automation and no auto-repeat for half a second under a real
   * OS, so the player pressed right and simply stood there.
   *
   * ## Why the press is synthetic, and dispatched from inside the page
   *
   * Because a real `page.keyboard.down` **cannot fail here**, and a test that
   * cannot fail is worse than no test. The window is one frame wide, about
   * 16 ms; a Playwright selector wait plus a CDP round trip is longer than that,
   * so the driver always presses after the first `update` has already created
   * the keys by accident. Measured, not assumed: with the keys still created
   * lazily, `page.keyboard.down` fired the moment `data-tn-level` turns `ready`
   * moved the player in six runs out of six.
   *
   * A `MutationObserver` on the marker fires in the same task as the scene's
   * `create`, before the next animation frame, which is exactly the window a
   * player hits by pressing at the wrong moment. With the keys created lazily
   * this fails four times out of four and the player never leaves the spawn.
   *
   * Nothing else about the event is special: `keyCode` is what Phaser reads, the
   * manager listens on `window`, and no `keyup` follows — this is a key being
   * *held*, which is how this level is walked.
   */
  test('a key pressed the instant the level is playable is not dropped', async ({ page }) => {
    await page.goto(`./?e2e=1&level=${START_LEVEL}`);

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          /** Phaser reads `keyCode`; the DOM type calls it legacy and omits it. */
          interface LegacyKeyInit extends KeyboardEventInit {
            readonly keyCode?: number;
          }
          const init: LegacyKeyInit = {
            key: 'ArrowRight',
            code: 'ArrowRight',
            keyCode: 39,
            bubbles: true,
          };
          const press = (): void => {
            window.dispatchEvent(new KeyboardEvent('keydown', init));
            resolve();
          };
          if (document.querySelector('[data-testid="playable"]') !== null) {
            press();
            return;
          }
          const observer = new MutationObserver(() => {
            if (document.querySelector('[data-testid="playable"]') === null) return;
            observer.disconnect();
            press();
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }),
    );

    await expect
      .poll(() => playerX(page), {
        message:
          'the level said it was playable, a key went down, and the player never moved. The ' +
          'first keydown of the session was dropped: no `Key` existed for it yet, and a held ' +
          'key sends no second one.',
        timeout: 5_000,
      })
      .toBeGreaterThan(LEVEL.spawn.x + 100);
  });
});

test.describe('the end of the level', () => {
  /**
   * Walk the level, end to end, holding one key — which is how a player finds
   * the end, and is why this is slow rather than clever. Nothing here asserts
   * how long it took.
   */
  test('publishes the arrival, naming the level, before the wall', async ({ page }) => {
    test.slow();

    await page.goto(`./?e2e=1&level=${START_LEVEL}`);
    await page.waitForSelector('[data-testid="playable"]');

    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => (await arrivals(page)).length, {
        message:
          'the player walked the whole level and it never said they had arrived. This is the ' +
          'state the game shipped in: you reach the far edge, the bounds clamp holds you ' +
          'there, and nothing happens.',
        timeout: 120_000,
        intervals: [500],
      })
      .toBe(1);
    await page.keyboard.up('ArrowRight');

    const [arrival] = await arrivals(page);
    expect(
      arrival?.detail,
      'the milestone did not name the level it was about. `app/bootstrap` refuses a milestone ' +
        'whose detail is another level, so an unnamed one opens no card at all.',
    ).toBe(START_LEVEL);

    /*
     * Where the player was on the frame it fired, read from the unsampled ring
     * buffer rather than the 10 Hz element: by the time a poll notices, the
     * player has walked on. Strictly inside the world is the point — an arrival
     * announced at `size.x` is announced to somebody already stuck against the
     * bounds clamp.
     */
    const at = (await frames(page)).find((frame) => frame.frame === arrival?.frame);
    expect(
      at?.x ?? Number.NaN,
      'the level said the player had arrived only once they were pinned at the far edge.',
    ).toBeLessThan(LEVEL.size.x);
  });
});
