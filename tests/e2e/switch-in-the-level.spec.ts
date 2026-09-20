import { expect, test, type Page } from '@playwright/test';

import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { DEFAULT_HOLD_TO_CHOOSE_MS, defaultSettings } from '@domain/entities/player';
import { newProgress } from '@domain/entities/progress';
import type { EpochMillis, LocaleCode } from '@domain/ids';

import { START_LEVEL } from './start-level';

/**
 * One switch, inside a level, with no sheet open — `TN-HUD-06`, on the page a
 * player actually loads.
 *
 * ## The defect
 *
 * A live-site audit turned one-button mode on, played into the first level, and
 * waited for the guide's offer. Tapping anywhere that was not a control did
 * nothing at all: no element carried `data-switch-highlight`, focus sat on
 * `main`, fourteen short taps changed nothing and long presses chose nothing.
 * Scanning worked everywhere else — in Settings, and inside every dialogue, card
 * and question sheet — which localised the gap exactly: those surfaces own
 * rings, the shell's ring is detached while a level runs, and **the strip owned
 * none**. A player who cannot reach the offer watches themselves walk past every
 * landmark in the game.
 *
 * ## Why this spec is an e2e and not a unit test
 *
 * `tests/unit/ui/hud.test.ts` proves the ring exists, wraps, stands down under a
 * sheet and comes back — against a document double, where a HUD is constructed
 * directly. Not one of those assertions would have failed on the shipped page,
 * because the defect was never in a component: it was that nothing in
 * `app/bootstrap` ever gave the strip a ring, and that the level screens and the
 * pause are what decide when it may answer a tap. That is only assertable
 * through the real composition root, on the real level, with a real contact —
 * which is this file.
 *
 * Nothing here reaches into the scene or the DOM's internals: the taps are
 * pointer events on the sky, and every assertion is something the player can
 * see.
 */

const codec = createJsonSaveCodec({ maxImportBytes: 10_000_000, migrations: SAVE_MIGRATIONS });

/**
 * The save a player who has turned one-button mode on leaves.
 *
 * Written the way `./held-drive.ts` writes its own and for the same reasons:
 * these specs deep-link into a level and never pass a settings screen, and this
 * is the document the game itself writes, read back by its ordinary path.
 * Everything except the one switch is the shipped default, so the spec keeps
 * following the game rather than a copy of it.
 */
function oneButtonSave(): string {
  const progress = newProgress({
    ...defaultSettings('en' as unknown as LocaleCode),
    singleSwitch: true,
  });
  const snapshot = toProgressSnapshot(progress, {
    version: codec.version,
    updatedAt: Date.now() as EpochMillis,
  });
  if (!snapshot.ok) {
    throw new Error(`the one-button save is not a save: ${snapshot.error.message}`);
  }
  const encoded = codec.encode(snapshot.value);
  if (!encoded.ok) {
    throw new Error(`the one-button save would not encode: ${encoded.error.message}`);
  }
  return encoded.value;
}

/** Well clear of the strip, which is capped at a third of an 844 px viewport. */
const SKY = { x: 195, y: 120 } as const;

/**
 * Press and release one contact, `heldMs` apart, on the sky.
 *
 * "Tap anywhere" is the whole contract, so the contact deliberately lands on
 * nothing: not the prompt, not Menu, not any control. A press shorter than the
 * threshold advances the highlight; one longer chooses it.
 */
async function tapSwitch(page: Page, heldMs: number): Promise<void> {
  await page.mouse.move(SKY.x, SKY.y);
  await page.mouse.down();
  await page.waitForTimeout(heldMs);
  await page.mouse.up();
}

const SHORT_MS = 60;
const LONG_MS = DEFAULT_HOLD_TO_CHOOSE_MS + 400;

/** The marker of the control the switch would choose, or `null`. */
async function highlighted(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      document
        .querySelector('[data-switch-highlight="true"]')
        ?.getAttribute('data-testid') ?? null,
  );
}

/** Is the highlight inside the element with this marker? */
async function highlightIsIn(page: Page, testId: string): Promise<boolean> {
  return page.evaluate(
    (id) =>
      document
        .querySelector('[data-switch-highlight="true"]')
        ?.closest(`[data-testid="${id}"]`) !== null &&
      document.querySelector('[data-switch-highlight="true"]') !== null,
    testId,
  );
}

async function openLevel(page: Page): Promise<void> {
  await page.goto(`./?level=${START_LEVEL}`);
  await page.waitForSelector('[data-testid="playable"]');
  await expect(page.getByTestId('hud')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      if (window.sessionStorage.getItem('tn-e2e-one-button') !== null) return;
      window.sessionStorage.setItem('tn-e2e-one-button', '1');
      window.localStorage.setItem(key, value);
    },
    { key: PROGRESS_STORAGE_KEY, value: oneButtonSave() },
  );
});

test.describe('one switch, in the level (TN-HUD-06)', () => {
  test('the strip is scanned: a highlight exists, and a tap on the sky moves it', async ({
    page,
  }) => {
    await openLevel(page);

    /*
     * The audit's first finding, inverted: something in the strip is highlighted
     * as soon as the level is the player's. A ring that only appears after a
     * press would leave a player with no way to tell their switch is connected.
     */
    await expect.poll(() => highlightIsIn(page, 'hud'), { timeout: 15_000 }).toBe(true);
    const first = await highlighted(page);

    await tapSwitch(page, SHORT_MS);

    /* Fourteen taps changed nothing on the shipped build. One changes this. */
    await expect.poll(() => highlighted(page), { timeout: 10_000 }).not.toBe(first);
    expect(await highlightIsIn(page, 'hud')).toBe(true);
  });

  test('short presses reach Settings and Menu, and the ring wraps', async ({ page }) => {
    await openLevel(page);
    await expect.poll(() => highlightIsIn(page, 'hud'), { timeout: 15_000 }).toBe(true);

    /*
     * Six presses over a ring of at most four items (the offer, Settings, Menu,
     * and the storage warning's way out when it is raised), so this wraps rather
     * than merely running out of stops before it could fail.
     */
    const seen = new Set<string | null>();
    for (let press = 0; press < 6; press += 1) {
      seen.add(await highlighted(page));
      await tapSwitch(page, SHORT_MS);
    }

    expect([...seen].join(' | ')).toContain('hud-settings-button');
    expect([...seen].join(' | ')).toContain('menu-button');
    /* And nothing that is not a control was ever stopped on: the task, the cue,
       the notice and `interact-hint` are paragraphs (`TN-HUD-06`, `TN-REACH-06`). */
    for (const words of ['hud-quest-tracker', 'hud-task-cue', 'hud-notice', 'interact-hint']) {
      expect([...seen]).not.toContain(words);
    }
  });

  test('a long press opens the menu, the scan carries on inside it, and the strip takes the contact back', async ({
    page,
  }) => {
    await openLevel(page);
    await expect.poll(() => highlightIsIn(page, 'hud'), { timeout: 15_000 }).toBe(true);

    /* Walk to Menu with short presses, as a player does. */
    for (let press = 0; press < 6; press += 1) {
      if ((await highlighted(page)) === 'menu-button') break;
      await tapSwitch(page, SHORT_MS);
    }
    expect(await highlighted(page), 'Menu was not reachable with short presses').toBe(
      'menu-button',
    );

    await tapSwitch(page, LONG_MS);
    await expect(page.getByTestId('menu')).toBeVisible();

    /* The handover: one ring at a time, and it is the open sheet's. */
    await expect.poll(() => highlightIsIn(page, 'menu'), { timeout: 10_000 }).toBe(true);
    expect(await page.locator('[data-switch-highlight="true"]').count()).toBe(1);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('menu')).toBeHidden();

    /* And back: the level is the player's again, so the strip answers the next
       tap. This is the direction that is easy to get wrong — a strip that stood
       down and never stood up is the same defect with an extra step. */
    await expect.poll(() => highlightIsIn(page, 'hud'), { timeout: 10_000 }).toBe(true);
    await tapSwitch(page, SHORT_MS);
    expect(await highlightIsIn(page, 'hud')).toBe(true);
  });

  test('a long press on the offer engages what is in reach', async ({ page }) => {
    await openLevel(page);

    /*
     * The level walks by itself for a switch player (`InputProfile`
     * `single-switch`: "movement is automatic"), so the offer arrives without
     * anybody pressing anything. This is the whole of the audit's complaint:
     * standing in front of the guide with no way to say yes.
     */
    await expect(page.getByTestId('interact-prompt')).toBeVisible({ timeout: 30_000 });

    for (let press = 0; press < 6; press += 1) {
      if ((await highlighted(page)) === 'interact-prompt') break;
      await tapSwitch(page, SHORT_MS);
    }
    expect(await highlighted(page), 'the offer was not reachable with one switch').toBe(
      'interact-prompt',
    );

    await tapSwitch(page, LONG_MS);

    /* Whichever the first thing in this level is — a person speaks, a place
       shows its card — engaging it opens a sheet, and that sheet is scanned. */
    const sheet = page.locator('[data-testid="dialogue"], [data-testid="poi-card"]');
    await expect(sheet.first()).toBeVisible();
    await expect.poll(() => page.locator('[data-switch-highlight="true"]').count()).toBe(1);
  });
});
