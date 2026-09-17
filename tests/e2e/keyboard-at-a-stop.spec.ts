import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { START_LEVEL } from './start-level';

/**
 * A keyboard player at a stop goes on exactly as a finger does, the interact key
 * engages what is on offer, and the strip says how to go on. ADR-0043,
 * `TN-REACH-12`.
 *
 * A second live-site audit, keyboard only, on Halifax: at the Town Clock the
 * player let go and pressed right again fourteen times and never moved, while a
 * held finger went on at once; and `Enter` at a stop opened nothing. The level read
 * each key once a frame, so a key let go and pressed again — or pressed and let
 * go — between two frames never happened. A finger cannot do that: it is a tap for
 * its first 160 ms.
 *
 * So the keys here are fired **in one task**, which puts the up and the down
 * between two frames whatever the frame rate: the input that was lost, made
 * deterministic. `tests/unit/adapters/phaser/key-presses.test.ts` and
 * `auto-stop.test.ts` prove the bookkeeping; this joins it to Phaser's own `Key`.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

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
if (MODE?.drive !== 'held') {
  throw new Error(`content/levels/${START_LEVEL}.json does not spawn in a held mode, so nobody presses again at a stop`);
}
const REACH = MODE.interaction?.reachPx ?? 0;

const FIRST = [
  ...LEVEL.pois.map((poi) => ({ id: poi.id, x: poi.position.x, npc: false })),
  ...LEVEL.characters.map((character) => ({ id: character.characterId, x: character.position.x, npc: true })),
]
  .filter((subject) => subject.x > LEVEL.spawn.x)
  .sort((a, b) => a.x - b.x)[0];
if (FIRST === undefined || REACH <= 0) {
  throw new Error(`content/levels/${START_LEVEL}.json places nothing ahead of its spawn to stop at`);
}

/* --------------------------------------------------------------- the probe -- */

interface Frame {
  readonly frame: number;
  readonly dtSeconds: number;
  readonly x: number;
  readonly velocityX: number;
  readonly intentMove: number;
}

type Scene = {
  __tnScene: {
    frames: () => Frame[];
    snapshot: () => { playerX?: number };
    events: () => { name: string; detail?: string }[];
  };
};

const frames = (page: Page): Promise<Frame[]> =>
  page.evaluate(() => (window as unknown as Scene).__tnScene.frames());

const playerX = async (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as Scene).__tnScene.snapshot().playerX ?? Number.NaN);

async function openLevel(page: Page): Promise<void> {
  /* Every text the live region is given, in order — it drains a queue, so a
     reading taken later would only see the last. It clears itself before each
     message (`app/ui/live-region.ts`), so a blank followed by words is one
     announcement, even when the words repeat the last. */
  await page.addInitScript(() => {
    const said: string[] = [];
    let blank = true;
    (window as unknown as { __said: string[] }).__said = said;
    new MutationObserver(() => {
      const words = document.getElementById('tn-live-region')?.textContent ?? '';
      if (words === '') {
        blank = true;
        return;
      }
      if (!blank) return;
      blank = false;
      said.push(words);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.goto(`./?e2e=1&level=${START_LEVEL}`);
  await page.waitForSelector('[data-testid="playable"]');
}

async function waitForSimulated(page: Page, seconds: number): Promise<void> {
  const after = (await frames(page)).at(-1)?.frame ?? -1;
  await page.waitForFunction(
    ({ want, since }: { want: number; since: number }) =>
      (window as unknown as Scene).__tnScene
        .frames()
        .filter((frame) => frame.frame > since)
        .reduce((total, frame) => total + frame.dtSeconds, 0) >= want,
    { want: seconds, since: after },
    { timeout: 45_000 },
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

async function waitForHeldAtRest(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const recent = (window as unknown as Scene).__tnScene.frames().slice(-3);
      return recent.length === 3 && recent.every((frame) => frame.intentMove === 1 && frame.velocityX === 0);
    },
    undefined,
    { timeout: 45_000 },
  );
}

/**
 * Fire two key events in one task, on the focused element, as the browser would.
 *
 * `keyCode` is defined on the event because Phaser's `KeyboardPlugin` looks keys
 * up by it and a constructed `KeyboardEvent` leaves it 0.
 */
async function inOneTask(
  page: Page,
  key: 'ArrowRight' | 'Enter',
  order: readonly ('keydown' | 'keyup')[],
): Promise<void> {
  await page.evaluate(
    ({ name, types }: { name: string; types: readonly string[] }) => {
      const keyCode = name === 'Enter' ? 13 : 39;
      for (const type of types) {
        const event = new KeyboardEvent(type, { key: name, code: name, bubbles: true, cancelable: true });
        Object.defineProperty(event, 'keyCode', { get: () => keyCode });
        Object.defineProperty(event, 'which', { get: () => keyCode });
        (document.activeElement ?? document.body).dispatchEvent(event);
      }
    },
    { name: key, types: order },
  );
}

/* --------------------------------------------------------------- scenarios -- */

test.describe('a keyboard player at a stop (ADR-0043, TN-REACH-12)', () => {
  test('a key let go and pressed again between two frames carries them on past the stop', async ({ page }) => {
    await openLevel(page);

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForHeldAtRest(page);
      await waitForSimulated(page, 0.3);
      const since = (await frames(page)).at(-1)?.frame ?? -1;

      await inOneTask(page, 'ArrowRight', ['keyup', 'keydown']);

      await page.waitForFunction(
        (want: number) => ((window as unknown as Scene).__tnScene.snapshot().playerX ?? 0) >= want,
        FIRST.x + REACH,
        { timeout: 45_000 },
      );
      const after = (await frames(page)).filter((frame) => frame.frame > since);
      expect(
        after.every((frame) => frame.intentMove === 1),
        'a frame saw the key up, so this was not a press between two frames',
      ).toBe(true);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
  });

  test('the interact key engages what the stop is offering, however short the press', async ({ page }) => {
    await openLevel(page);

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForHeldAtRest(page);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    await waitForIntent(page, 0);
    await expect(page.getByTestId('interact-prompt')).toBeVisible();

    /* On the level, not on a focused control: a focused prompt would take Enter
       itself, and that route already worked. */
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await inOneTask(page, 'Enter', ['keydown', 'keyup']);

    await page.waitForFunction(
      (id: string) =>
        (window as unknown as Scene).__tnScene
          .events()
          .some((event) => (event.name === 'npc/engaged' || event.name === 'poi/engaged') && event.detail === id),
      FIRST.id,
      { timeout: 20_000 },
    );
    await expect(page.getByTestId(FIRST.npc ? 'dialogue' : 'poi-card')).toBeVisible();
  });

  /**
   * The third live-site audit: engaging with Enter left focus **outside** the
   * dialogue it opened, intermittently. From there Tab reached the Settings
   * button behind the modal, Enter opened Settings on top of the open dialogue,
   * and Space flipped the language radio underneath it. Opening the same
   * dialogue with a pointer was correct every time, because a click leaves focus
   * on the control it hit — inside the subtree the trap then inerts.
   *
   * The engine opens this modal from a game frame rather than from a DOM
   * handler, so `app/ui` cannot assume the focus it moved at open is still
   * there: `app/ui/focus-trap.ts` re-asserts containment when focus lands
   * outside. This walks the real key, on the real level, and holds all three
   * halves of the promise — focus inside, the page behind inert, Tab staying in.
   */
  test('engaging with the interact key leaves focus inside what it opened', async ({ page }) => {
    await openLevel(page);
    const modal = FIRST.npc ? 'dialogue' : 'poi-card';
    const inModal = (id: string): Promise<boolean> =>
      page.evaluate(
        (testId) => document.activeElement?.closest(`[data-testid="${testId}"]`) !== null,
        id,
      );

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForHeldAtRest(page);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    await waitForIntent(page, 0);
    await expect(page.getByTestId('interact-prompt')).toBeVisible();

    /* The audit's own path: the key goes to the level, not to a focused control.
       A focused prompt takes Enter itself, and that route always worked. */
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await inOneTask(page, 'Enter', ['keydown', 'keyup']);
    await expect(page.getByTestId(modal)).toBeVisible();

    /* Whichever frame it opened on, focus is inside it. */
    await expect
      .poll(() => inModal(modal), { timeout: 10_000 })
      .toBe(true);

    /* And the page behind it is really inert, which is what makes `aria-modal`
       true rather than a claim. */
    expect(
      await page.getByTestId('hud').evaluate((node) => (node as HTMLElement).inert),
      'the HUD behind the modal was reachable',
    ).toBe(true);

    /* Six presses: more than the dialogue has controls, so this wraps rather
       than merely running out of stops before it could leak. */
    for (let pressed = 0; pressed < 6; pressed += 1) {
      await page.keyboard.press('Tab');
      expect(await inModal(modal), `Tab left the modal on press ${String(pressed + 1)}`).toBe(true);
    }

    /* The two things the audit could do from outside it. */
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('settings-screen')).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(page.getByTestId(modal), 'the modal was closed from behind it').toBeVisible();
  });

  test('at a stop the strip says how to go on, says it once, and takes it away on moving', async ({ page }) => {
    await openLevel(page);
    const words = text('en', 'hud.stop.hint');

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await waitForHeldAtRest(page);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    await waitForIntent(page, 0);
    const restX = await playerX(page);

    await expect(page.getByTestId('interact-hint')).toHaveText(words);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __said: string[] }).__said), { timeout: 20_000 })
      .toContain(words);
    /* Standing there says nothing more. */
    await waitForSimulated(page, 1.5);
    const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    expect(said.filter((entry) => entry === words), said.join(' | ')).toHaveLength(1);

    await page.keyboard.down('ArrowRight');
    try {
      await waitForIntent(page, 1);
      await page.waitForFunction(
        (want: number) => ((window as unknown as Scene).__tnScene.snapshot().playerX ?? 0) >= want,
        restX + 40,
        { timeout: 45_000 },
      );
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    await expect(page.getByTestId('interact-hint')).not.toHaveText(words);
  });
});
