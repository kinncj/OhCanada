import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * The two things a player said were wrong, asserted against the shipped build.
 *
 * > "the character is still a rectangle"
 * > "we don't know what to click nor how to go to the next level"
 *
 * Both had been invisible to the whole suite, and for the same reason each time:
 * **the counter that existed did not cover the subject of the complaint.**
 *
 *   - `data-actors` is `pois.length + characters.length`. The player is in
 *     neither list, so the one character on screen at the spawn was outside
 *     every count. `data-actors-drawn` could read full marks — and did — while
 *     the player was a rounded rectangle. `data-player-drawn` is the counter
 *     that can fail on it, and it is asserted here first because it is the whole
 *     bug.
 *   - Nothing counted what the game *offered*. A level whose landmarks and
 *     people are silently tappable and a level with no interactions at all
 *     produce identical probes. `data-affordances` and `data-affordances-ready`
 *     are two numbers rather than one because "I cannot tell what is
 *     interactive" and "I cannot tell when I am close enough" are two
 *     complaints, and one number would clear both while answering neither.
 *
 * The third scenario is the easter egg: the level's sky follows the device
 * clock. It is asserted through the CSS custom properties the desktop side
 * panels are painted from, because those are the tinted palette rendered into
 * the DOM — a real, player-visible surface — and reading a pixel off this canvas
 * has already been established as unreliable at this device scale
 * (`level-art.spec.ts`).
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface LevelFile {
  readonly pois: readonly { readonly id: string; readonly position: { readonly x: number } }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
  readonly locomotion: readonly {
    readonly interaction: { readonly reachPx: number } | null;
  }[];
}

const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as LevelFile;

const URL_FOR = (search = ''): string => `./?e2e=1&level=${START_LEVEL}${search}`;

const ENGAGEABLE = LEVEL.pois.length + LEVEL.characters.length;

test.describe('the player is a character, not a rectangle', () => {
  test('composes the player from the rig, and reports no placeholder at all', async ({ page }) => {
    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');

    await expect(
      probe,
      'the player is drawn with fillRoundedRect. Nothing composed them from the rig — they ' +
        'are not in level.characters, so no existing counter could see it, which is why this ' +
        'shipped and stayed shipped.',
    ).toHaveAttribute('data-player-drawn', 'true');

    await expect(
      probe,
      'a character fell back to a placeholder shape. The console line above says which one ' +
        'and why: no rig, no artboard, no atlas, or an atlas with none of the rig in it.',
    ).toHaveAttribute('data-placeholders', '0');
  });

  test('keeps the player composed after they have moved and jumped', async ({ page }) => {
    /* The pose is driven every frame from the same step the physics produced. A
       renderer that threw on the first `setNumber` would leave the character
       frozen or gone, and a spawn-time assertion alone would not see it. */
    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');
    const start = Number(await probe.getAttribute('data-player-x'));

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);

    expect(
      Number(await probe.getAttribute('data-player-x')),
      'the player never moved, so nothing about a moving character was exercised',
    ).toBeGreaterThan(start);
    await expect(probe).toHaveAttribute('data-player-drawn', 'true');
    await expect(probe).toHaveAttribute('data-placeholders', '0');
  });
});

test.describe('the world says what can be touched', () => {
  test('marks every engageable subject, before the player is anywhere near it', async ({
    page,
  }) => {
    test.skip(
      LEVEL.locomotion[0]?.interaction === null,
      'this level spawns in a mode that engages nothing, so there is nothing to advertise',
    );
    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');

    expect(ENGAGEABLE, 'the level places nothing engageable, so this proves nothing').toBeGreaterThan(
      0,
    );
    await expect(
      probe,
      'the level offers things to tap and shows no sign that any of them can be tapped, ' +
        'which is the report: "we don\'t know what to click".',
    ).toHaveAttribute('data-affordances', String(ENGAGEABLE));
  });

  test('separates "this is tappable" from "tapping this will work"', async ({ page }) => {
    test.skip(
      LEVEL.locomotion[0]?.interaction === null,
      'this level spawns in a mode that engages nothing',
    );
    const target = [...LEVEL.characters, ...LEVEL.pois]
      .map((subject) => subject.position.x)
      .sort((a, b) => a - b)[0];
    expect(target, 'nothing to walk to').toBeGreaterThan(0);

    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');

    /*
     * The control, and it runs first. At the spawn every subject is marked and
     * none is in reach — a counter that reported "ready" here would be
     * reporting construction rather than reach, which is the defect
     * `data-actors-drawn` had and `data-actors-visible` was written to replace.
     */
    await expect(probe).toHaveAttribute('data-affordances-ready', '0');

    await walkTo(page, (target as number) - 60);

    await expect(
      probe,
      'the player is standing next to something engageable and nothing on screen has changed ' +
        'state, so there is still no way to tell that a tap would do anything',
    ).toHaveAttribute('data-affordances-ready', /^[1-9]/u);
  });
});

test.describe('the level follows the real world', () => {
  /**
   * Two loads of the same level at two times of day, and the sky is different.
   *
   * `page.clock.setFixedTime` fixes `Date` **without** faking timers, which
   * matters: installing fake timers would stop `requestAnimationFrame` and the
   * game would never render a frame to assert about.
   *
   * The assertion is on `--tn-sky`, the custom property the page paints the
   * desktop side panels with. It is the tinted palette on a real surface, so a
   * tint that never reached anything a player sees would fail here.
   */
  const skyAt = async (page: Page, hour: number): Promise<string> => {
    await page.clock.setFixedTime(new Date(2026, 0, 15, hour, 0, 0));
    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    return page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--tn-sky').trim(),
    );
  };

  test('is darker at night than at midday', async ({ page }) => {
    const noon = await skyAt(page, 12);
    const night = await skyAt(page, 1);

    expect(noon, 'the page paints no sky colour, so the panels have nothing to extend').toMatch(
      /^#[0-9a-f]{6}$/iu,
    );
    expect(
      luminance(night),
      `the sky is ${night} at 01:00 and ${noon} at midday — the level is not following the ` +
        'device clock at all',
    ).toBeLessThan(luminance(noon));
  });

  test('reports where in the day it thinks it is', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 0, 15, 21, 0, 0));
    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');

    /* 21:00 is 0.875 of the way through the day. Rounded by the probe's own
       formatter, so this reads whatever it publishes rather than restating it. */
    const phase = Number(await probe.getAttribute('data-day-phase'));
    expect(phase, 'the scene publishes no time of day').toBeGreaterThan(0.86);
    expect(phase).toBeLessThan(0.89);
  });

  test('is playable on a device whose clock is nonsense', async ({ page }) => {
    /* A dead RTC reports the epoch, or 2099, or something no timezone explains.
       Whatever it is, it is a time, and the level still has to open. */
    await page.clock.setFixedTime(new Date(1970, 0, 1, 0, 0, 0));
    await page.goto(URL_FOR());
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', START_LEVEL);
    await expect(probe).toHaveAttribute('data-player-drawn', 'true');
  });
});

/** Relative luminance of a `#rrggbb`, good enough to order two shades of one sky. */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return 0.2126 * ((value >> 16) & 0xff) + 0.7152 * ((value >> 8) & 0xff) + 0.0722 * (value & 0xff);
}

async function walkTo(page: Page, worldX: number): Promise<void> {
  const probe = page.locator('[data-testid="scene-state"]');
  await page.keyboard.down('ArrowRight');
  for (let tick = 0; tick < 400; tick += 1) {
    if (Number(await probe.getAttribute('data-player-x')) >= worldX) break;
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(600);
}
