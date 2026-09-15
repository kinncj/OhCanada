import type { Page } from '@playwright/test';

/**
 * Walking a level the way a player does, now that every drive stops at each
 * thing it can engage (ADR-0032).
 *
 * Not a spec file: `testMatch` in `tests/e2e/playwright.config.ts` is
 * `**\/*.spec.ts`, so this is a module the specs share — the same shape as
 * `./start-level.ts` and `./front-door.ts`.
 *
 * ## Why this exists
 *
 * A held key used to carry the player past everything in the level, and a dozen
 * walks were written as "hold right until X". Since ADR-0032 a held drive comes
 * to rest at each landmark and character it approaches and stays there, key
 * down, until the player **lets go and presses again**, engages, or steers back.
 * A walk that holds one key and waits for somewhere past the first landmark now
 * waits at the first landmark, which is the game working.
 *
 * So these walks do what a player does at each stop: let go, and press again.
 * They do not poke the auto-stop or turn it off, and nothing here reaches into
 * the scene — a walk that got past the stop by any route a player lacks would
 * prove nothing about the level it walks.
 *
 * ## Two ways of noticing a stop
 *
 *  - **With the scene probe** (`?e2e=1`), {@link walkWithProbe} reads the frame
 *    trace: the key held down and the level at rest for three frames in a row is
 *    a stop, and the walk presses again at once.
 *  - **Without it**, a page opened as a player opens it has no trace to read, so
 *    {@link walkInLegs} holds for a leg, lets go, and presses again, until the
 *    thing the walk is for turns up. A leg that ends mid-stride costs a step of
 *    glide; a leg that ends at a stop is the re-press.
 *
 * Either way the walk lets the level run a frame with nothing pressed between
 * letting go and pressing again. The level no longer needs that frame: since
 * ADR-0043 a key let go and pressed again inside one frame is a new press
 * (`key-presses.ts`, held by `keyboard-at-a-stop.spec.ts`). A hand leaves one
 * anyway, and it keeps these walks' traces readable.
 *
 * **A press only answers a stop once the player is at rest** (ADR-0043). A leg
 * that ends while a stop is still braking presses again into the brake, is held
 * on, and costs one more leg; {@link walkWithProbe} waits for rest and never pays
 * it.
 */

/** Wait for `count` animation frames in the page — the loop Phaser steps the level on. */
export async function afterFrames(page: Page, count = 3): Promise<void> {
  await page.evaluate(
    (want: number) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= want) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );
}

/**
 * Let go of `key`, and wait until the level has run frames without it.
 *
 * For a walk made of bursts: the next press is then a new one, which is what
 * lets a held stop go.
 */
export async function letGo(page: Page, key: string): Promise<void> {
  await page.keyboard.up(key);
  await afterFrames(page);
}

export interface LegOptions {
  /** How long the whole walk may take, wall clock. */
  readonly budgetMs?: number;
  /** How long one hold lasts before the walk lets go and presses again. */
  readonly legMs?: number;
  /** Run after each let-go, before the next press. Defaults to {@link afterFrames}. */
  readonly settle?: (page: Page) => Promise<void>;
}

/**
 * Hold `key` in legs until `leg` finds what the walk is for.
 *
 * `leg(ms)` is called with the key down and waits up to `ms` for the walk's
 * destination, answering it or `null`. The key is let go after every leg, found
 * or not — a player does not keep walking once they have arrived — and a leg
 * that found nothing is followed by a fresh press. `null` when the budget ran out.
 */
export async function walkInLegs<T>(
  page: Page,
  key: string,
  leg: (legMs: number) => Promise<T | null>,
  options: LegOptions = {},
): Promise<T | null> {
  const deadline = Date.now() + (options.budgetMs ?? 60_000);
  const legMs = options.legMs ?? 2_500;
  const settle = options.settle ?? ((target: Page): Promise<void> => afterFrames(target));

  while (Date.now() < deadline) {
    await page.keyboard.down(key);
    /* Let go whether the leg found it, ran out, or threw: a key left down by a
       failed walk would walk the next scenario's player too. */
    const found = await leg(Math.max(1, Math.min(legMs, deadline - Date.now()))).finally(() =>
      page.keyboard.up(key),
    );
    if (found !== null) return found;
    await settle(page);
  }
  return null;
}

/** Where a probe walk is going. */
export type ProbeGoal =
  /** The player's world x has reached `x`, in the direction of the walk. */
  | { readonly kind: 'past'; readonly x: number }
  /** The scene has recorded `name` at least `count` times (default 1). */
  | { readonly kind: 'event'; readonly name: string; readonly count?: number };

/**
 * Walk with the scene probe until `goal`, pressing again at every stop.
 *
 * Requires `?e2e=1`. A stop is read off the trace rather than waited out: the
 * last three frames carried this walk's direction as their intent and moved the
 * player not at all. After letting go, the walk waits for a frame that carried
 * no intent, so the next press is one the level sees begin. Resolves `true` on
 * arrival, `false` when the budget ran out.
 */
export async function walkWithProbe(
  page: Page,
  key: 'ArrowRight' | 'ArrowLeft',
  goal: ProbeGoal,
  options: { readonly budgetMs?: number } = {},
): Promise<boolean> {
  const direction = key === 'ArrowLeft' ? -1 : 1;

  const arrived = await walkInLegs(
    page,
    key,
    async (legMs) => {
      const handle = await page
        .waitForFunction(
          ({ want, sign }: { want: ProbeGoal; sign: number }) => {
            const scene = (
              window as unknown as {
                __tnScene: {
                  snapshot: () => { playerX?: number };
                  events: () => { name: string }[];
                  frames: () => { intentMove: number; velocityX: number }[];
                };
              }
            ).__tnScene;

            if (want.kind === 'past') {
              const x = scene.snapshot().playerX ?? Number.NaN;
              if (sign > 0 ? x >= want.x : x <= want.x) return 'arrived';
            } else {
              const seen = scene.events().filter((event) => event.name === want.name).length;
              if (seen >= (want.count ?? 1)) return 'arrived';
            }

            const recent = scene.frames().slice(-3);
            const held =
              recent.length === 3 &&
              recent.every((frame) => frame.intentMove === sign && frame.velocityX === 0);
            return held ? 'stopped' : false;
          },
          { want: goal, sign: direction },
          { timeout: legMs, polling: 'raf' },
        )
        .catch(() => null);
      if (handle === null) return null;
      return (await handle.jsonValue()) === 'arrived' ? true : null;
    },
    {
      budgetMs: options.budgetMs ?? 120_000,
      legMs: 30_000,
      settle: async (target) => {
        await target
          .waitForFunction(
            () =>
              (
                window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } }
              ).__tnScene
                .frames()
                .at(-1)?.intentMove === 0,
            undefined,
            { timeout: 20_000, polling: 'raf' },
          )
          .catch(() => undefined);
      },
    },
  );

  return arrived === true;
}
