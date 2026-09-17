import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { focusedTestId } from './focus';
import { HARNESS_URL } from './playwright.config';

/**
 * The shell: the title screen, the level select, and the flow between them.
 *
 * This is the game's front door. Until it existed the only way into a level was
 * a `?level=` URL parameter, and a visitor who typed the address got a caption
 * saying there was nothing to play — which was true of the page and not of the
 * build. So the scans that matter most here are the ones about *reachability*:
 * a keyboard user gets from a cold load into a level select without a pointer,
 * and a switch user gets there with one contact.
 *
 * **Nothing is disabled in the ruleset.** `region` and `landmark-one-main` are
 * off in `slice1-screens.spec.ts` because a lone modal over a canvas has no
 * document structure to landmark. The shell is a whole page — a `<main>` with
 * real content in it — so both rules run here, and a test below proves they ran
 * rather than merely failing to complain.
 *
 * **What the harness proves and what `dist/` proves.** Every scan but the last
 * runs against the harness page, which mounts `createShell` directly with fixed
 * fixtures — ten map entries in three states, a resumable level, a blocked
 * browser — because those are states the shipped config does not have and a scan
 * that could not reach them would prove nothing about them.
 *
 * **The unbuilt state is the sharpest case of that, and it is deliberate.** All
 * ten levels have documents now, so no card on the shipped map is "Not made
 * yet" — and the whole accessibility question on this screen is whether the
 * three states are told apart in *words* rather than by colour. `TN-MAP-04`
 * settles it: the guard supplies its own unbuilt entry, because a guard whose
 * only input has been deleted passes exactly as a working guard passes and
 * nothing can make it fail (ADR-0024). So the fixture builds Halifax and Ottawa
 * only, Vancouver stands for a level nobody has built, and `?map=unnamed` adds
 * the id-less entry that levels 2 and 10 used to be. None of those three is
 * borrowed from a real level's name any more. The **last** test in
 * this file scans `dist/`, the artefact GitHub Pages serves, through the door a
 * visitor actually opens. It was `fixme` until `app/bootstrap/main.ts` called
 * `createShell`; task 1.20 landed that call and closed `OQ-TEST-2`.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * `best-practice` is in, deliberately: the WCAG tag sets do not check that a
 * dialog has an accessible name, and `aria-dialog-name` is best-practice only.
 */
const RULESET = [...WCAG, 'best-practice'];

/** Whole-page scan. Nothing disabled — that is the point of this constant. */
const scan = (page: Page) => new AxeBuilder({ page }).withTags([...RULESET]).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

type ShellView = 'title' | 'creator' | 'level-select';

interface HarnessOptions {
  readonly view?: ShellView;
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly singleSwitch?: boolean;
  readonly contrast?: 'high';
  readonly font?: 'dyslexia';
  readonly motion?: 'reduced';
  /** A level worth resuming, so Continue is drawn. */
  readonly resume?: boolean;
  /** Study is offered from the title screen. */
  readonly study?: boolean;
  /**
   * `none`: no level document at all. `one`: only Ottawa, so nothing is locked.
   * `journey`: the first four places built and open.
   */
  readonly levels?: 'none' | 'one' | 'journey';
  /** `TN-TITLE-04`: this browser is not saving. */
  readonly storageBlocked?: boolean;
  /** Levels whose stamps are in the passport, comma-separated, so "Earned" is drawn. */
  readonly stamped?: string;
  /** The save's last played level, as the composition root hands it to the shell. */
  readonly here?: string;
  /** Open the map on the way out of this level, as the level's menu does. */
  readonly from?: string;
  /**
   * `unnamed`: an eleventh entry with no id, for the one card state the shipped
   * ten cannot reach — a level whose place is not decided (`TN-MAP-04`).
   */
  readonly map?: 'unnamed';
}

const ROOT_TEST_ID: Readonly<Record<ShellView, string>> = {
  title: 'title-screen',
  creator: 'character-creator',
  'level-select': 'level-select',
};

/** Open the shell and wait for the marker that says it is really there. */
async function open(page: Page, options: HarnessOptions = {}): Promise<Locator> {
  const params = new URLSearchParams({ screen: 'shell' });
  const view = options.view ?? 'title';
  params.set('view', view);
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.singleSwitch === true) params.set('switch', '1');
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.font !== undefined) params.set('font', options.font);
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.resume === true) params.set('resume', '1');
  if (options.study === true) params.set('study', '1');
  if (options.levels !== undefined) params.set('levels', options.levels);
  if (options.stamped !== undefined) params.set('stamped', options.stamped);
  if (options.here !== undefined) params.set('here', options.here);
  if (options.from !== undefined) params.set('from', options.from);
  if (options.map !== undefined) params.set('map', options.map);
  if (options.storageBlocked === true) {
    params.set('storage', 'blocked');
    params.set('export', '1');
  }

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  await page.waitForSelector('html[data-tn-harness-ready="shell"]', { timeout: 15_000 });

  const root = page.locator(`[data-testid="${ROOT_TEST_ID[view]}"]`);
  await expect(root, `the ${view} view never appeared`).toBeVisible();
  return root;
}

/** Every visible interactive target smaller than 44 CSS px, named. */
async function undersizedTargets(page: Page): Promise<string[]> {
  const targets = page.locator(
    'button, a[href], input:not([type="hidden"]), select, textarea, ' +
      '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"]',
  );
  const count = await targets.count();
  expect(count, 'no interactive targets found — this test must not pass vacuously').toBeGreaterThan(
    0,
  );

  const tooSmall: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    if (box === null) continue;
    if (box.width < 44 || box.height < 44) {
      const name = await target.evaluate(
        (element) =>
          `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? '?'}]`,
      );
      tooSmall.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  return tooSmall;
}

const scrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );


/** Press and release the switch: one contact, `heldMs` long, anywhere on the page. */
async function switchPress(page: Page, heldMs: number): Promise<void> {
  await page.mouse.move(200, 700);
  await page.mouse.down();
  await page.waitForTimeout(heldMs);
  await page.mouse.up();
}

const highlighted = (page: Page): Promise<string> =>
  page.evaluate(
    () =>
      document
        .querySelector('[data-switch-highlight="true"]')
        ?.getAttribute('data-testid') ?? 'none',
  );

const VIEWS: readonly ShellView[] = ['title', 'creator', 'level-select'];

test.describe('the shell', () => {
  for (const view of VIEWS) {
    test(`${view}: has no axe violations, in English and in French`, async ({ page }) => {
      for (const locale of ['en', 'fr'] as const) {
        await open(page, { view, locale, resume: true, study: true });
        const results = await scan(page).analyze();
        expect(results.violations, `${view} (${locale}): ${violationsOf(results)}`).toEqual([]);
      }
    });

    test(`${view}: keeps every touch target at 44 CSS px, at 100 % and at 200 % text`, async ({
      page,
    }) => {
      await open(page, { view, resume: true, study: true });
      expect(await undersizedTargets(page)).toEqual([]);

      await open(page, { view, resume: true, study: true, textScale: 200 });
      expect(await undersizedTargets(page), 'at 200 % text').toEqual([]);
    });

    test(`${view}: does not scroll sideways or clip at 200 % text with the dyslexia font`, async ({
      page,
    }) => {
      await open(page, { view, textScale: 200, font: 'dyslexia', resume: true, study: true });
      expect(await scrollsSideways(page)).toBe(false);

      const clipped = await page.evaluate(() => {
        const bad: string[] = [];
        for (const element of document.querySelectorAll<HTMLElement>(
          '.tn-screen h1, .tn-screen h2, .tn-screen p, .tn-screen button, .tn-screen span',
        )) {
          if (element.scrollWidth > element.clientWidth + 1) {
            bad.push(`${element.tagName}: ${(element.textContent ?? '').slice(0, 40)}`);
          }
        }
        return bad;
      });
      expect(clipped, clipped.join(' | ')).toEqual([]);
    });

    test(`${view}: is clean in high contrast and with reduced motion`, async ({ page }) => {
      await open(page, { view, contrast: 'high', motion: 'reduced', resume: true, study: true });
      const results = await scan(page).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);

      /* Reduced motion removes animation, not information: the controls are
         still there and still say what they say. */
      const moving = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.tn-screen, .tn-screen *')].filter(
          (element) => {
            const style = getComputedStyle(element);
            return style.animationName !== 'none' || style.transitionDuration !== '0s';
          },
        ).length,
      );
      expect(moving, 'something still animates under reduced motion').toBe(0);
    });
  }

  test('is the page one <main>, with everything inside a landmark', async ({ page }) => {
    await open(page, { study: true, resume: true });

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main')).toHaveAttribute('data-testid', 'shell');

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('really runs region and landmark-one-main, rather than passing without them', async ({
    page,
  }) => {
    /* "No violations" is also what a scan says about a rule it never ran. */
    await open(page);
    const results = await scan(page).analyze();
    const seen = new Set(
      [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable].map(
        (entry) => entry.id,
      ),
    );

    expect([...seen], 'the region rule did not run').toContain('region');
    expect([...seen], 'the landmark-one-main rule did not run').toContain('landmark-one-main');
  });

  test('the whole-page rules can fail — the negative control', async ({ page }) => {
    /* Unwrap the `<main>` and the title screen's content is outside every
       landmark, which is exactly what `region` exists to report. */
    await open(page);
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main === null) throw new Error('the page has no main to unwrap');
      const replacement = document.createElement('div');
      replacement.append(...main.childNodes);
      main.replaceWith(replacement);
    });

    const results = await scan(page).analyze();
    const ids = results.violations.map((violation) => violation.id);
    expect(ids, `unwrapping the main produced no violation: ${violationsOf(results)}`).toContain(
      'region',
    );
  });

  test('has exactly one live region, and an aria-hidden canvas', async ({ page }) => {
    await open(page);
    expect(await page.locator('[aria-live]').count()).toBe(1);
    await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('getting in without a pointer', () => {
  test('focus starts on the primary control, not on the body', async ({ page }) => {
    /* `TN-TITLE-05`. A returning player's primary control is Continue; a
       first-time player's is Play. Neither is the document body. */
    await open(page, { resume: true });
    expect(await focusedTestId(page)).toBe('title-continue');

    /* And it says where it goes, out loud (`TN-TITLE-07`). */
    await expect(page.locator('[data-testid="title-continue"]')).toHaveAccessibleDescription(
      /Ottawa/,
    );
  });

  test('a keyboard alone gets from the title screen into the level select', async ({ page }) => {
    await open(page);

    /* No saved character in the harness's returning fixture, so the way in is
       "Choose a level" — and it already has focus. */
    expect(await focusedTestId(page)).toBe('title-choose-level');

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="level-select"]')).toBeVisible();

    /* The view changed, so focus went with it rather than being left on a
       control that no longer exists — and it landed on the one open card, which
       is what `TN-FLOW-01` asks for. */
    expect(await focusedTestId(page)).toBe('level-card-ottawa');
  });

  test('every card is reachable from the keyboard, in level order, whatever its state', async ({
    page,
  }) => {
    await open(page, { view: 'level-select' });

    /* `TN-MAP-07`: focus reaches all ten cards, in level order, and a card that
       cannot be opened is disabled in name and not removed from the order. */
    await page.locator('[data-testid="level-card-halifax"]').focus();
    const reached: string[] = ['level-card-halifax'];
    for (let index = 0; index < 9; index += 1) {
      await page.keyboard.press('Tab');
      reached.push(await focusedTestId(page));
    }

    expect(reached).toEqual([
      'level-card-halifax',
      'level-card-peggys-cove',
      'level-card-quebec-city',
      'level-card-ottawa',
      'level-card-toronto',
      'level-card-winnipeg',
      'level-card-prairie-rail',
      'level-card-alberta-foothills',
      'level-card-vancouver',
      'level-card-the-north',
    ]);

    for (const closed of ['level-card-halifax', 'level-card-vancouver']) {
      await expect(page.locator(`[data-testid="${closed}"]`)).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await expect(page.locator(`[data-testid="${closed}"]`)).toHaveAccessibleDescription(/\S/);
    }
  });

  test('one switch contact walks the title screen and opens the level select', async ({
    page,
  }) => {
    await open(page, { singleSwitch: true, resume: true, study: true });

    /* The ring comes on with the primary control highlighted, so a switch user
       can see where they are before pressing anything. Nothing scans on its
       own (`TN-FLOW-07`). */
    expect(await highlighted(page)).toBe('title-continue');

    await switchPress(page, 60);
    expect(await highlighted(page)).toBe('title-choose-level');

    await switchPress(page, 900);
    await expect(page.locator('[data-testid="level-select"]')).toBeVisible();
  });

  test('the highlight reaches every card, including the ones that cannot be opened', async ({
    page,
  }) => {
    await open(page, { view: 'level-select', singleSwitch: true });

    /* `TN-MAP-08`. A switch user who could not reach the closed cards would be
       the only player who cannot find out what the rest of the game is. */
    const seen = new Set<string>();
    for (let press = 0; press < 12; press += 1) {
      seen.add(await highlighted(page));
      await switchPress(page, 60);
    }

    expect([...seen]).toContain('level-card-ottawa');
    expect([...seen], 'a locked card was skipped').toContain('level-card-halifax');
    expect([...seen], 'a not-built card was skipped').toContain('level-card-vancouver');
    expect([...seen], 'the way out was skipped').toContain('level-select-back');
  });

  test('a long press on a card that cannot be opened says why, and opens nothing', async ({
    page,
  }) => {
    await open(page, { view: 'level-select', singleSwitch: true });

    for (let press = 0; press < 12; press += 1) {
      if ((await highlighted(page)) === 'level-card-vancouver') break;
      await switchPress(page, 60);
    }
    expect(await highlighted(page)).toBe('level-card-vancouver');

    await switchPress(page, 900);
    await expect(page.locator('[data-testid="level-select"]')).toBeVisible();
    expect(await highlighted(page), 'the highlight moved').toBe('level-card-vancouver');
    await expect(page.locator('#tn-live-region')).toContainText('still making this level');
  });
});

test.describe('what the level select says about a place', () => {
  test('tells open, locked and not-made-yet apart in words, not by colour', async ({ page }) => {
    await open(page, { view: 'level-select' });

    const ottawa = page.locator('[data-testid="level-card-ottawa"]');
    const halifax = page.locator('[data-testid="level-card-halifax"]');
    const vancouver = page.locator('[data-testid="level-card-vancouver"]');

    await expect(ottawa).toHaveAttribute('data-state', 'open');
    await expect(halifax).toHaveAttribute('data-state', 'locked');
    await expect(vancouver).toHaveAttribute('data-state', 'not-built');

    await expect(ottawa).toContainText('Open');
    await expect(halifax).toContainText('Locked');
    await expect(vancouver).toContainText('Not made yet');

    /* And the reason is on the page as text, not only as a style. */
    await expect(page.locator('[data-testid="level-card-halifax-help"]')).toContainText(/\S/);
    await expect(page.locator('[data-testid="level-card-vancouver-help"]')).toContainText(/\S/);
  });

  test('reads its number, its place and its state to a screen reader', async ({ page }) => {
    await open(page, { view: 'level-select' });

    const ottawa = page.locator('[data-testid="level-card-ottawa"]');
    await expect(ottawa).toHaveAccessibleName(/Level 4/);
    await expect(ottawa).toHaveAccessibleName(/Ottawa/);
    await expect(ottawa).toHaveAccessibleName(/Open/);
    await expect(ottawa).toHaveAccessibleDescription(/You can play this now/);

    const vancouver = page.locator('[data-testid="level-card-vancouver"]');
    await expect(vancouver).toHaveAccessibleName(/Not made yet/);
    await expect(vancouver).toHaveAccessibleDescription(/still making this level/);
  });

  test('is a list of ten items, in the order of the journey', async ({ page }) => {
    await open(page, { view: 'level-select' });
    await expect(page.locator('[data-testid="level-select-list"] > li')).toHaveCount(10);
    await expect(page.locator('[data-testid="level-select-counts"]')).toContainText(
      'Levels ready: 2 of 10',
    );
  });

  test('a card nobody has built is not drawn as an error', async ({ page }) => {
    await open(page, { view: 'level-select' });

    const card = (
      (await page.locator('[data-testid="level-card-vancouver"]').textContent()) ?? ''
    ).concat(
      (await page.locator('[data-testid="level-card-vancouver-help"]').textContent()) ?? '',
    );

    for (const word of ['error', 'failed', 'missing', 'unavailable', 'not found', 'stamp']) {
      expect(card.toLowerCase(), `a not-built card says "${word}"`).not.toContain(word);
    }
  });

  test('names the two levels that were numbered slots until they were built', async ({
    page,
  }) => {
    /*
     * `peggys-cove` and `the-north` drew a number and a subject line while they
     * had no id, and this scan asserted exactly that. They shipped with ids,
     * names and copy of their own in `b48bda1`, and `level.2.subtitle`,
     * `level.10.title` and `level.10.subtitle` were retired with the state they
     * described — so the assertion below is the same one, made against what is
     * true now: every card on the shipped map names its place.
     */
    await open(page, { view: 'level-select' });

    const two = page.locator('[data-testid="level-card-peggys-cove"]');
    await expect(two).toContainText('Level 2');
    await expect(two).toContainText("Peggy's Cove");
    await expect(two).toContainText('Who we are');

    const ten = page.locator('[data-testid="level-card-the-north"]');
    await expect(ten).toContainText('Level 10');
    await expect(ten).toContainText('The North');
    await expect(ten).toContainText("Canada's regions");
  });

  test('a card with no place name draws no placeholder in its place', async ({ page }) => {
    /*
     * The guard is handed its own entry, on purpose (`TN-MAP-04`, ADR-0024).
     * Every level in the shipped journey is named, so the branch that draws a
     * card for a level whose place is not decided has no input left on the map —
     * and it is live code: what it answers instead of a name is what a player
     * reads. The alternative to checking is the word "undefined" on a card.
     */
    await open(page, { view: 'level-select', map: 'unnamed' });

    const unnamed = page.locator('[data-testid="level-card-11"]');
    await expect(unnamed).toContainText('Level 11');
    for (const placeholder of ['TBD', '???', 'undefined', 'null', 'Coming soon']) {
      await expect(unnamed).not.toContainText(placeholder);
    }

    /* It is still a card a screen reader can read and a switch user can reach:
       a number is not a name, and "Not made yet" is the state either way. */
    await expect(unnamed).toContainText('Not made yet');
    await expect(unnamed).toHaveAccessibleName(/Level 11/);

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('survives greyscale: the states differ with no colour at all', async ({ page }) => {
    await open(page, { view: 'level-select' });

    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('[data-testid="level-card-halifax"]')).toContainText('Locked');
    await expect(page.locator('[data-testid="level-card-vancouver"]')).toContainText(
      'Not made yet',
    );

    /* The border tells them apart as a shape as well as a word, so the states
       are distinguishable to a player who reads neither colour nor English. */
    const borders = await page.evaluate(() =>
      ['ottawa', 'halifax', 'vancouver'].map(
        (id) =>
          getComputedStyle(
            document.querySelector(`[data-testid="level-card-${id}"]`) as HTMLElement,
          ).borderTopStyle,
      ),
    );
    expect(new Set(borders).size, `borders were ${borders.join(', ')}`).toBe(3);

    /*
     * `color-contrast` is off for this scan and only for this scan. Chromium's
     * forced-colors *emulation* forces the background to Canvas and leaves the
     * authored text colour in the computed style, so axe compares #f3f8fc
     * against #ffffff and reports a ratio no real forced-colors user would ever
     * see — the browser paints CanvasText there. Contrast is proven under the
     * normal and high-contrast themes by every other scan in this file; what is
     * asked here is whether the states survive with no colour, which is the
     * assertions above.
     */
    const results = await scan(page).disableRules(['color-contrast']).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    await page.emulateMedia({ forcedColors: null });
  });

  test('a build with no levels at all still shows ten cards, and no error', async ({ page }) => {
    await open(page, { view: 'level-select', levels: 'none' });

    await expect(page.locator('[data-testid="level-select-list"] > li')).toHaveCount(10);
    await expect(page.locator('[data-testid="level-select-counts"]')).toContainText(
      'Levels ready: 0 of 10',
    );
    await expect(page.locator('[data-testid="level-select"]')).not.toContainText('error');

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });
});

/**
 * The level select reads as a journey rather than as a list of options.
 *
 * Ten identical rows in a column, each ending in a state word, is a menu; what
 * this screen describes is one route across a country in a fixed order, and the
 * player's word for the result was that "the maps are odd". `app/ui/journey.ts`
 * draws the route. What can only be proved in a browser is here:
 *
 *  - that the rail is **drawn** and takes up room, rather than existing only as
 *    attributes a unit test can read;
 *  - that it costs a keyboard user, a screen-reader user and a switch user
 *    **nothing** — the licence for hiding it is that it carries no fact of its
 *    own, and axe is the check that hiding it was done correctly;
 *  - that travelled and ahead differ by **shape**, which is the one thing the
 *    fake DOM in `tests/unit/ui` cannot measure at all;
 *  - that it grows with the text instead of squeezing the cards beside it.
 */
test.describe('the level select is a route, not a list', () => {
  test('draws a length of route beside all ten cards, and axe is clean', async ({ page }) => {
    await open(page, { view: 'level-select', stamped: 'ottawa' });

    const rails = page.locator('[data-testid="level-select-list"] .tn-journey');
    await expect(rails).toHaveCount(10);

    /* Drawn, not merely present: a rail with no box would be ten attributes
       nobody can see, which is a different screen from the one described. */
    const widths = await rails.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().width),
    );
    expect(Math.min(...widths)).toBeGreaterThan(8);

    for (let index = 0; index < 10; index += 1) {
      await expect(rails.nth(index)).toHaveAttribute('aria-hidden', 'true');
    }

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('costs the keyboard, the reader and the switch nothing', async ({ page }) => {
    await open(page, { view: 'level-select', stamped: 'ottawa' });

    /* Nothing on the rail can be focused, so the ten stops on the journey are
       still exactly the ten cards (`TN-MAP-07`, `TN-MAP-08`). */
    await expect(page.locator('.tn-journey button, .tn-journey [tabindex]')).toHaveCount(0);

    /* And the card's accessible name is what it always was: a number, a place
       and a state, with nothing from the drawing leaking into it. */
    const ottawa = page.locator('[data-testid="level-card-ottawa"]');
    await expect(ottawa).toHaveAccessibleName(/Level 4/);
    await expect(ottawa).toHaveAccessibleName(/Ottawa/);
    await expect(ottawa).toHaveAccessibleName(/Open/);
    await expect(ottawa).toHaveAccessibleDescription(/You can play this now/);
  });

  test('says only what the cards already say in words', async ({ page }) => {
    /*
     * The promise that lets the whole rail be hidden from assistive technology.
     * Every mark on it is a redrawing of the state word and the "Earned" badge
     * the card beside it prints; the day one of them states something new, a
     * screen-reader user is missing something a sighted player has.
     */
    await open(page, { view: 'level-select', stamped: 'ottawa' });

    const mismatches = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="level-select-list"] > li')]
        .map((item) => {
          const rail = item.querySelector<HTMLElement>('.tn-journey');
          const card = item.querySelector<HTMLElement>('button[data-state]');
          return {
            handle: card?.getAttribute('data-level-handle') ?? '?',
            state: [rail?.getAttribute('data-journey-state'), card?.getAttribute('data-state')],
            stamp: [
              rail?.getAttribute('data-journey-reached'),
              card?.getAttribute('data-stamped'),
            ],
          };
        })
        .filter((row) => row.state[0] !== row.state[1] || row.stamp[0] !== row.stamp[1])
        .map((row) => row.handle),
    );
    expect(mismatches, 'the rail disagrees with the words on these cards').toEqual([]);
  });

  test('tells a leg walked from a leg ahead by shape, not by colour', async ({ page }) => {
    await open(page, { view: 'level-select', stamped: 'ottawa' });

    /* Ottawa's stamp is earned, so the leg below it is travelled and the leg
       below Toronto is not. Border style, because a dotted border is a shape
       and greyscale does not take it away. */
    const styles = await page.evaluate(() =>
      ['ottawa', 'toronto'].map((handle) => {
        const item = document
          .querySelector(`[data-level-handle="${handle}"]`)
          ?.closest('li');
        const leg = item?.querySelector<HTMLElement>('.tn-journey__leg--after');
        return leg === null || leg === undefined
          ? '?'
          : getComputedStyle(leg).borderInlineStartStyle;
      }),
    );
    expect(styles[0]).toBe('solid');
    expect(styles[1]).toBe('dotted');
    expect(styles[0]).not.toBe(styles[1]);
  });

  test('marks where the route has got to, and survives forced colours doing it', async ({
    page,
  }) => {
    await open(page, { view: 'level-select' });

    /* Scoped to the list: the map above it marks the same stop with the same
       token, and is asserted on its own below. */
    const rail = page.locator('[data-testid="level-select-list"]');
    await expect(rail.locator('[data-journey-current="true"]')).toHaveCount(1);
    /* And it is on Ottawa: the only card reading "Open" without "Earned", which
       is a fact printed on the card and drawn here rather than invented. */
    const markedHandle = await page.evaluate(
      () =>
        document
          .querySelector('[data-testid="level-select-list"] [data-journey-current="true"]')
          ?.closest('li')
          ?.querySelector('button[data-level-handle]')
          ?.getAttribute('data-level-handle') ?? 'none',
    );
    expect(markedHandle).toBe('ottawa');

    const sizeOf = async (): Promise<readonly number[]> =>
      page.evaluate(() =>
        ['true', 'false'].map((flag) => {
          const pin = document.querySelector<HTMLElement>(
            `[data-testid="level-select-list"] [data-journey-current="${flag}"] .tn-journey__pin`,
          );
          return pin === null ? 0 : pin.getBoundingClientRect().width;
        }),
      );

    const [markedNormal, plainNormal] = await sizeOf();
    expect(markedNormal ?? 0).toBeGreaterThan(plainNormal ?? 0);

    /* The ring round it is a box-shadow, which forced colours drops. The size
       difference is not, so the mark still reads with no colour at all. */
    await page.emulateMedia({ forcedColors: 'active' });
    const [markedForced, plainForced] = await sizeOf();
    expect(markedForced ?? 0).toBeGreaterThan(plainForced ?? 0);
    await page.emulateMedia({ forcedColors: null });
  });

  test('grows with the text rather than squeezing the cards beside it', async ({ page }) => {
    const railWidth = (): Promise<number> =>
      page.evaluate(
        () =>
          document.querySelector<HTMLElement>('.tn-journey')?.getBoundingClientRect().width ?? 0,
      );

    await open(page, { view: 'level-select' });
    const atOneHundred = await railWidth();

    await open(page, { view: 'level-select', textScale: 200, font: 'dyslexia' });
    const atTwoHundred = await railWidth();

    /* Every length on the rail is in rem, so it doubles with the root font
       size — a pixel literal would shrink relative to the text exactly when the
       player asked for bigger text. */
    expect(atTwoHundred).toBeGreaterThan(atOneHundred * 1.8);

    /* And the cards beside it still fit, and are still targets. */
    expect(await scrollsSideways(page)).toBe(false);
    expect(await undersizedTargets(page), 'at 200 % text, beside the route').toEqual([]);
  });

  test('is still a list of ten items to a screen reader', async ({ page }) => {
    /* `TN-MAP-09`. `list-style: none` on a flex <ul> is the one stylesheet
       change WebKit takes the list role away for, so the role is written. */
    await open(page, { view: 'level-select' });
    await expect(page.locator('[data-testid="level-select-list"]')).toHaveAttribute(
      'role',
      'list',
    );
    await expect(
      page.locator('[data-testid="level-select-list"]').getByRole('listitem'),
    ).toHaveCount(10);
  });
});

/**
 * The map of Canada above the route.
 *
 * `OQ-MAP-2` allowed a drawn map as "a decoration behind the same list, never the
 * only way to choose", and `app/ui/level-map.ts` is that. What only a browser can
 * prove about it is here:
 *
 *  - that it is **drawn** — the SVG really loads, above the list — and axe is
 *    clean over the page with it, in both languages;
 *  - that hiding it costs nobody anything: it is wordless, unfocusable, and a
 *    card's name is what it was;
 *  - that each pin **sits on its anchor**, with Halifax and Peggy's Cove in the
 *    inset, and is drawn in **the rail's shapes**, not new ones;
 *  - that at 200 % text it **takes no width from a card**, and its pins stay the
 *    drawing's size rather than the text's;
 *  - that a switch press over it is a press anywhere, and the drawing is fetched
 *    only when the level select is built.
 *
 * Reduced motion and high contrast are the `VIEWS` loop at the top of this file,
 * which now scans a level select with the map on it.
 */
interface SidecarPoint {
  readonly x: number;
  readonly y: number;
}

const MAP_SIDECAR = JSON.parse(
  readFileSync(
    new URL('../../assets/src/svg/screens/map-canada.anchors.json', import.meta.url),
    'utf8',
  ),
) as {
  readonly viewBox: readonly number[];
  readonly anchors: Readonly<Record<string, SidecarPoint>>;
  readonly inset?: { readonly anchors: Readonly<Record<string, SidecarPoint>> };
};

const JOURNEY = [
  'halifax',
  'peggys-cove',
  'quebec-city',
  'ottawa',
  'toronto',
  'winnipeg',
  'prairie-rail',
  'alberta-foothills',
  'vancouver',
  'the-north',
] as const;

test.describe('the map above the route shows where the journey is in the country', () => {
  const mapOf = (page: Page): Locator => page.locator('[data-testid="level-select-map"]');

  /** Until the drawing has decoded, a scan is of an empty frame, not of the map. */
  const drawingLoaded = (page: Page): Promise<unknown> =>
    page.waitForFunction(() => {
      const art = document.querySelector<HTMLImageElement>('[data-testid="level-select-map"] img');
      return art !== null && art.complete && art.naturalWidth > 0;
    });

  test('is drawn above the list, and axe is clean with it, in English and in French', async ({
    page,
  }) => {
    for (const locale of ['en', 'fr'] as const) {
      await open(page, { view: 'level-select', locale, stamped: 'ottawa' });
      await drawingLoaded(page);

      const map = await mapOf(page).boundingBox();
      const list = await page.locator('[data-testid="level-select-list"]').boundingBox();
      expect(map, 'the map has no box').not.toBeNull();
      expect(list, 'the list has no box').not.toBeNull();
      expect(map?.height ?? 0, 'the map is not really drawn').toBeGreaterThan(100);
      expect((map?.y ?? 0) + (map?.height ?? 0), 'the map is not above the list').toBeLessThanOrEqual(
        (list?.y ?? 0) + 0.5,
      );

      const results = await scan(page).analyze();
      expect(results.violations, `${locale}: ${violationsOf(results)}`).toEqual([]);
    }
  });

  test('is hidden from assistive technology, carries no words and adds no stop', async ({
    page,
  }) => {
    await open(page, { view: 'level-select' });
    const map = mapOf(page);

    await expect(map).toHaveAttribute('aria-hidden', 'true');
    await expect(map.locator('img')).toHaveAttribute('alt', '');
    expect(((await map.textContent()) ?? '').trim(), 'the map carries words').toBe('');
    await expect(
      map.locator('button, a[href], input, select, textarea, [tabindex]'),
    ).toHaveCount(0);

    /* From the heading, over the counts and the map, the next stop is the first
       card: the map put nothing between them (`TN-MAP-07`). */
    await page.locator('#tn-level-select-heading').focus();
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('level-card-halifax');

    /* And a card's name is a number, a place and a state, as it always was. */
    const ottawa = page.locator('[data-testid="level-card-ottawa"]');
    await expect(ottawa).toHaveAccessibleName(/Level 4/);
    await expect(ottawa).toHaveAccessibleName(/Ottawa/);
    await expect(ottawa).toHaveAccessibleName(/Open/);
    await expect(ottawa).toHaveAccessibleDescription(/You can play this now/);
  });

  test("pins each stop at its anchor, with Halifax and Peggy's Cove in the inset", async ({
    page,
  }) => {
    await open(page, { view: 'level-select' });
    await drawingLoaded(page);

    const placed = await page.evaluate(() => {
      const art = document
        .querySelector('[data-testid="level-select-map"] img')
        ?.getBoundingClientRect();
      if (art === undefined) return [];
      return [
        ...document.querySelectorAll<HTMLElement>('[data-testid="level-select-map"] .tn-map__stop'),
      ].map((stop) => {
        const pin = stop.querySelector('.tn-journey__pin')?.getBoundingClientRect();
        return {
          handle: stop.getAttribute('data-map-handle') ?? '?',
          x: pin === undefined ? -1 : (pin.left + pin.width / 2 - art.left) / art.width,
          y: pin === undefined ? -1 : (pin.top + pin.height / 2 - art.top) / art.height,
        };
      });
    });

    expect(placed.map((stop) => stop.handle)).toEqual([...JOURNEY]);

    const [, , width = 0, height = 0] = MAP_SIDECAR.viewBox;
    for (const stop of placed) {
      const point = MAP_SIDECAR.inset?.anchors[stop.handle] ?? MAP_SIDECAR.anchors[stop.handle];
      expect(point, `the sidecar has no anchor for ${stop.handle}`).toBeDefined();
      /* Six viewBox units is about two CSS px on a 390 px phone. */
      expect(Math.abs(stop.x * width - (point?.x ?? 0)), `${stop.handle} x`).toBeLessThan(6);
      expect(Math.abs(stop.y * height - (point?.y ?? 0)), `${stop.handle} y`).toBeLessThan(6);
    }
    expect(MAP_SIDECAR.inset?.anchors.halifax, 'Halifax is not in the inset').toBeDefined();
    expect(MAP_SIDECAR.inset?.anchors['peggys-cove'], "Peggy's Cove is not in the inset").toBeDefined();
  });

  test("marks the stop the route has got to, in the rail's shapes and not new ones", async ({
    page,
  }) => {
    await open(page, { view: 'level-select', stamped: 'ottawa' });
    await drawingLoaded(page);

    /* One mark, on the same stop the rail marks. */
    const current = mapOf(page).locator('[data-journey-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('data-map-handle', 'ottawa');
    const railHandle = await page.evaluate(
      () =>
        document
          .querySelector('[data-testid="level-select-list"] [data-journey-current="true"]')
          ?.closest('li')
          ?.querySelector('button[data-level-handle]')
          ?.getAttribute('data-level-handle') ?? 'none',
    );
    expect(railHandle).toBe('ottawa');

    /* Open and earned, locked, not made yet: the map pin looks exactly like the
       rail pin beside that card, and the three look different from each other. */
    const looks = (): Promise<{ handle: string; map: string; rail: string }[]> =>
      page.evaluate(() =>
        ['ottawa', 'halifax', 'vancouver'].map((handle) => {
          const look = (pin: Element | null | undefined): string => {
            if (pin === null || pin === undefined) return 'missing';
            const style = getComputedStyle(pin);
            return `${style.borderTopStyle} ${style.backgroundColor}`;
          };
          return {
            handle,
            map: look(
              document.querySelector(
                `[data-testid="level-select-map"] [data-map-handle="${handle}"] .tn-journey__pin`,
              ),
            ),
            rail: look(
              document
                .querySelector(`[data-level-handle="${handle}"]`)
                ?.closest('li')
                ?.querySelector('.tn-journey__pin'),
            ),
          };
        }),
      );

    const normal = await looks();
    for (const row of normal) expect(row.map, row.handle).toBe(row.rail);
    expect(new Set(normal.map((row) => row.map.split(' ')[0])).size).toBe(3);

    const sizes = (): Promise<number[]> =>
      page.evaluate(() =>
        ['true', 'false'].map(
          (flag) =>
            document
              .querySelector(
                `[data-testid="level-select-map"] [data-journey-current="${flag}"] .tn-journey__pin`,
              )
              ?.getBoundingClientRect().width ?? 0,
        ),
      );
    const [marked = 0, plain = 0] = await sizes();
    expect(marked).toBeGreaterThan(plain);

    /* With no colour at all: the ring is gone, the size and the shapes are not. */
    await page.emulateMedia({ forcedColors: 'active' });
    const [markedForced = 0, plainForced = 0] = await sizes();
    expect(markedForced).toBeGreaterThan(plainForced);
    for (const row of await looks()) expect(row.map, `${row.handle}, forced`).toBe(row.rail);

    /* `color-contrast` off for this scan only, for the reason given in "survives
       greyscale" above: Chromium's emulation leaves authored text colours in the
       computed style. */
    const results = await scan(page).disableRules(['color-contrast']).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    await page.emulateMedia({ forcedColors: null });
  });

  test('takes no width from a card at 200 % text, and its pins stay the drawing\'s size', async ({
    page,
  }) => {
    const pinShare = (): Promise<number> =>
      page.evaluate(() => {
        const art = document
          .querySelector('[data-testid="level-select-map"] img')
          ?.getBoundingClientRect().width;
        const pin = document
          .querySelector('[data-testid="level-select-map"] [data-journey-current="false"] .tn-journey__pin')
          ?.getBoundingClientRect().width;
        return art === undefined || pin === undefined || art === 0 ? 0 : pin / art;
      });

    await open(page, { view: 'level-select' });
    await drawingLoaded(page);
    const atOneHundred = await pinShare();
    expect(atOneHundred).toBeGreaterThan(0);

    await open(page, { view: 'level-select', textScale: 200, font: 'dyslexia' });
    await drawingLoaded(page);
    const atTwoHundred = await pinShare();
    expect(Math.abs(atTwoHundred - atOneHundred), 'the pins grew with the text').toBeLessThan(
      atOneHundred * 0.05,
    );

    /* Halifax and Peggy's Cove are still two pins, not one. */
    const overlap = await page.evaluate(() => {
      const box = (handle: string): DOMRect | undefined =>
        document
          .querySelector(
            `[data-testid="level-select-map"] [data-map-handle="${handle}"] .tn-journey__pin`,
          )
          ?.getBoundingClientRect();
      const a = box('halifax');
      const b = box('peggys-cove');
      if (a === undefined || b === undefined) return true;
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    });
    expect(overlap, "Halifax and Peggy's Cove are drawn on top of each other").toBe(false);

    /* The list beside nothing: the Ottawa card is exactly as wide with the map as
       without it, which is the budget the route's gutter was measured against. */
    expect(await scrollsSideways(page)).toBe(false);
    expect(await undersizedTargets(page), 'at 200 % text, under the map').toEqual([]);
    const cardWidth = (): Promise<number> =>
      page
        .locator('[data-testid="level-card-ottawa"]')
        .evaluate((card) => card.getBoundingClientRect().width);
    const withMap = await cardWidth();
    await page.evaluate(() => document.querySelector('[data-testid="level-select-map"]')?.remove());
    const withoutMap = await cardWidth();
    expect(Math.abs(withMap - withoutMap), 'the map squeezed the list').toBeLessThan(0.5);
  });

  test('a switch press over the map is a press anywhere', async ({ page }) => {
    await open(page, { view: 'level-select', singleSwitch: true });
    await drawingLoaded(page);
    await mapOf(page).scrollIntoViewIfNeeded();

    const box = await mapOf(page).boundingBox();
    expect(box, 'the map has no box').not.toBeNull();
    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

    /* Nothing on the map is under the pointer: it takes no input. */
    const onMap = await page.evaluate(
      ([px, py]) =>
        document.elementFromPoint(px ?? 0, py ?? 0)?.closest('[data-testid="level-select-map"]') !==
        null,
      [x, y],
    );
    expect(onMap, 'the map took the pointer').toBe(false);

    const before = await highlighted(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    expect(await highlighted(page), 'a press over the map did not advance').not.toBe(before);
    await expect(page.locator('[data-testid="level-select"]')).toBeVisible();
  });

  test('fetches the drawing when the level select is built, not on the title screen', async ({
    page,
  }) => {
    const isDrawing = (url: string): boolean =>
      /\/map-canada[^/]*\.svg$/.test(new URL(url).pathname);
    const fetched: string[] = [];
    page.on('request', (request) => {
      if (isDrawing(request.url())) fetched.push(request.url());
    });

    await open(page);
    expect(fetched, 'the title screen fetched the map').toEqual([]);

    const drawing = page.waitForRequest((request) => isDrawing(request.url()));
    await page.locator('[data-testid="title-choose-level"]').click();
    await drawing;
    await expect(mapOf(page)).toBeVisible();
  });
});

test.describe('the title screen states what it is', () => {
  test('says the game is not made by the Government of Canada', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-testid="title-not-official"]')).toContainText(
      'This game is not made by the Government of Canada.',
    );
    await expect(page.locator('[data-testid="title-screen"]')).toContainText(
      'Get ready for the Canadian citizenship test.',
    );
  });

  test('never draws a control disabled, and never Play beside Continue', async ({ page }) => {
    for (const resume of [true, false]) {
      await open(page, { resume, study: true });

      const drawnDisabled = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="title-screen"] button')].filter(
          (element) =>
            element.hasAttribute('disabled') ||
            element.getAttribute('aria-disabled') === 'true',
        ).length,
      );
      expect(drawnDisabled, 'a control on the title screen is drawn disabled').toBe(0);

      const play = await page.locator('[data-testid="title-play"]').count();
      const carryOn = await page.locator('[data-testid="title-continue"]').count();
      expect(play + carryOn, 'Play and Continue were offered together').toBeLessThan(2);
    }
  });

  test('storage being blocked warns without covering or blocking the way in', async ({ page }) => {
    await open(page, { storageBlocked: true });

    const warning = page.locator('[data-testid="storage-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('This browser is not saving your progress.');
    /* Not a second announcer: the one live region owns that channel. */
    expect(await warning.getAttribute('aria-live')).toBeNull();
    expect(await page.locator('[aria-live]').count()).toBe(1);

    /* And the way in is still reachable, not behind it. */
    await page.locator('[data-testid="title-choose-level"]').click();
    await expect(page.locator('[data-testid="level-select"]')).toBeVisible();

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });
});

test.describe('settings, from the first screen', () => {
  test('opens over the title screen as a named dialog and passes the whole-page scan', async ({
    page,
  }) => {
    await open(page);
    await page.locator('[data-testid="title-settings"]').click();

    const settings = page.locator('[data-testid="settings-screen"]');
    await expect(settings).toBeVisible();
    await expect(settings).toHaveAttribute('aria-modal', 'true');
    await expect(settings).toHaveAccessibleName(/\S/);

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('contains focus while it is open — Tab cannot reach the title behind it', async ({
    page,
  }) => {
    await open(page);
    await page.locator('[data-testid="title-settings"]').click();
    const settings = page.locator('[data-testid="settings-screen"]');
    await expect(settings).toBeVisible();

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab');
      const inside = await settings.evaluate((element) => element.contains(document.activeElement));
      expect(inside, `focus escaped the settings screen after ${String(index + 1)} tabs`).toBe(true);
    }
  });

  test('closing it puts focus back on the control that opened it', async ({ page }) => {
    await open(page);
    /* A real click, not a scripted one: the trap restores focus to whatever had
       it when the screen opened, and that is only meaningful if the control the
       player pressed had focus in the first place. */
    await page.locator('[data-testid="title-settings"]').click();
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();
    await page.locator('[data-testid="settings-close"]').click();

    await expect(page.locator('[data-testid="settings-screen"]')).toBeHidden();
    expect(await focusedTestId(page)).toBe('title-settings');
  });
});

/**
 * `OQ-TEST-2`, closed: one whole-page scan against `dist/`, not a harness.
 *
 * The body asserts the premise *first*, so it cannot go green by accident: it
 * fails on the wait if the built page has no title screen. This is the test that
 * makes the axe count a statement about the shipped artefact rather than about a
 * dev server, and it is the one that would have caught the defect task 1.20
 * exists for — a visitor reaching the deployed page and finding nothing to
 * press.
 */
test('the built page a visitor loads has no axe violations', async ({ page }) => {
  /* `baseURL` is `vite preview` over `dist/` — the artefact GitHub Pages serves. */
  const response = await page.goto('./');
  expect(response, 'no response from vite preview').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  /* The premise, before the scan: a cold load with no URL parameter lands on the
     title screen and there is something to press. One of Play and Continue is
     there — which one depends on whether this browser has a saved game — and
     `TN-TITLE-03` requires that never to be both. */
  await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
  await expect(page.locator('main')).toHaveCount(1);
  const wayIn = page.locator(
    '[data-testid="title-play"], [data-testid="title-continue"], [data-testid="title-choose-level"]',
  );
  await expect(wayIn.first()).toBeVisible();

  const results = await scan(page).analyze();
  expect(results.violations, violationsOf(results)).toEqual([]);

  /* And it is really a way in, not a picture of one. */
  await wayIn.first().click();
  await expect(
    page.locator('[data-testid="level-select"], [data-testid="character-creator"]').first(),
  ).toBeVisible();
});

/**
 * A finished level, on the map.
 *
 * `MapEntry.stamped` was only ever counted — the counts line said "Stamps: 1 of
 * 10" and the card looked exactly like one the player had never opened. It is a
 * badge now, in words, beside the state word rather than instead of it.
 */
test.describe('a level whose stamp is in the passport', () => {
  test('says Earned, in words, and still says whether it is open', async ({ page }) => {
    const root = await open(page, { view: 'level-select', stamped: 'ottawa' });
    const card = root.locator('[data-testid="level-card-ottawa"]');

    await expect(card.locator('[data-testid="level-card-ottawa-stamp"]')).toHaveText('Earned');
    await expect(card).toContainText('Open');
    /* The sentence is the card's *description*, in a sibling paragraph — the
       badge did not replace it. */
    await expect(root.locator('[data-testid="level-card-ottawa-help"]')).toHaveText(
      'You can play this now.',
    );
  });

  test('has no violations, and the badge is not colour alone', async ({ page }) => {
    await open(page, { view: 'level-select', stamped: 'ottawa' });
    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('is readable at 200 % text without clipping the badge', async ({ page }) => {
    const root = await open(page, {
      view: 'level-select',
      stamped: 'ottawa',
      textScale: 200,
      font: 'dyslexia',
    });
    expect(await scrollsSideways(page)).toBe(false);
    await expect(root.locator('[data-testid="level-card-ottawa-stamp"]')).toBeVisible();
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test('is French', async ({ page }) => {
    const root = await open(page, { view: 'level-select', stamped: 'ottawa', locale: 'fr' });
    await expect(root.locator('[data-testid="level-card-ottawa-stamp"]')).toHaveText('Obtenu');
  });
});

/**
 * Where the player is: on the map, on the rail, and in words on the card.
 *
 * The player's report was "no matter if I am in Quebec, it doesn't show it". The
 * marker followed the first open card without a stamp, so a player in Québec City
 * saw it on Halifax. The fixture below stamps levels 1 and 2 and records level 3
 * as last played, so every scan here is of a marker that is **not** on the first
 * card, and of a line that runs inside the Atlantic inset and out of it.
 */
test.describe('the level select says where the player is', () => {
  const TRAVELLED: HarnessOptions = {
    view: 'level-select',
    levels: 'journey',
    stamped: 'halifax,peggys-cove',
    here: 'quebec-city',
  };

  const drawingLoaded = (page: Page): Promise<unknown> =>
    page.waitForFunction(() => {
      const art = document.querySelector<HTMLImageElement>('[data-testid="level-select-map"] img');
      return art !== null && art.complete && art.naturalWidth > 0;
    });

  /**
   * Every element of the map with the animation the cascade gave it. Computed
   * style rather than `getAnimations()`, so the answer does not depend on how
   * long the page took to get here: a finished animation leaves no running
   * animation behind, and its declaration is still there.
   */
  const mapMotion = (
    page: Page,
  ): Promise<{ name: string; tag: string; iterations: string; end: number }[]> =>
    page.evaluate(() => {
      const seconds = (value: string): number =>
        Math.max(
          ...value
            .split(',')
            .map((part) =>
              part.trim().endsWith('ms')
                ? Number.parseFloat(part) / 1000
                : Number.parseFloat(part),
            ),
        );
      return [
        ...document.querySelectorAll(
          '[data-testid="level-select-map"], [data-testid="level-select-map"] *',
        ),
      ].map((node) => {
        const style = getComputedStyle(node);
        const iterations = style.animationIterationCount;
        const count = iterations === 'infinite' ? Number.POSITIVE_INFINITY : Number(iterations);
        return {
          name: style.animationName,
          tag: node.tagName.toLowerCase(),
          iterations,
          end: seconds(style.animationDelay) + seconds(style.animationDuration) * count,
        };
      });
    });

  const pinWidths = (page: Page): Promise<{ here: number; plain: number }> =>
    page.evaluate(() => {
      const width = (flag: string): number =>
        document
          .querySelector(
            `[data-testid="level-select-map"] [data-journey-current="${flag}"] .tn-journey__pin`,
          )
          ?.getBoundingClientRect().width ?? 0;
      return { here: width('true'), plain: width('false') };
    });

  test('has no axe violations with the marker on level 3, in English and in French', async ({
    page,
  }) => {
    for (const locale of ['en', 'fr'] as const) {
      await open(page, { ...TRAVELLED, locale });
      await drawingLoaded(page);
      await expect(page.locator('[data-testid="level-card-quebec-city-here"]')).toHaveText(
        locale === 'en' ? 'You are here' : 'Vous êtes ici',
      );
      const results = await scan(page).analyze();
      expect(results.violations, `${locale}: ${violationsOf(results)}`).toEqual([]);
    }
  });

  test('says it in words on that one card, and the map and the rail mark the same card', async ({
    page,
  }) => {
    await open(page, TRAVELLED);
    const card = page.locator('[data-testid="level-card-quebec-city"]');
    await expect(card).toHaveAccessibleName(/Québec City/);
    await expect(card).toHaveAccessibleName(/You are here/);
    await expect(page.locator('.tn-levels__here')).toHaveCount(1);
    /* Not the first card, which is where the old rule put it. */
    await expect(page.locator('[data-testid="level-card-halifax-here"]')).toHaveCount(0);

    const current = page.locator('[data-testid="level-select-map"] [data-journey-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('data-map-handle', 'quebec-city');
    const railHandle = await page.evaluate(
      () =>
        document
          .querySelector('[data-testid="level-select-list"] [data-journey-current="true"]')
          ?.closest('li')
          ?.querySelector('button[data-level-handle]')
          ?.getAttribute('data-level-handle') ?? 'none',
    );
    expect(railHandle).toBe('quebec-city');
  });

  test('says the level the map was opened from ahead of the level last played', async ({
    page,
  }) => {
    await open(page, { ...TRAVELLED, from: 'ottawa' });
    await expect(page.locator('[data-testid="level-card-ottawa-here"]')).toHaveText('You are here');
    await expect(page.locator('.tn-levels__here')).toHaveCount(1);
    /* And the player lands on that card, as they always did. */
    expect(await focusedTestId(page)).toBe('level-card-ottawa');
    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('draws the travelled line inside the inset and out of it, ending on the marker', async ({
    page,
  }) => {
    /* Reduced motion, so no pin is mid-swell while its centre is measured. */
    await open(page, { ...TRAVELLED, motion: 'reduced' });
    await drawingLoaded(page);

    const drawn = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('[data-testid="level-select-map-route"]');
      const matrix = svg?.getScreenCTM() ?? null;
      const centre = (handle: string): { x: number; y: number } | null => {
        const box = document
          .querySelector(
            `[data-testid="level-select-map"] [data-map-handle="${handle}"] .tn-journey__pin`,
          )
          ?.getBoundingClientRect();
        return box === undefined ? null : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      };
      const legs = [
        ...document.querySelectorAll<SVGLineElement>('[data-testid="level-select-map"] line.tn-map__leg'),
      ].map((line) => {
        const point = (x: string, y: string): { x: number; y: number } | null => {
          if (matrix === null) return null;
          const at = new DOMPoint(
            Number(line.getAttribute(x)),
            Number(line.getAttribute(y)),
          ).matrixTransform(matrix);
          return { x: at.x, y: at.y };
        };
        return {
          from: line.getAttribute('data-map-from'),
          to: line.getAttribute('data-map-to'),
          frame: line.getAttribute('data-map-frame'),
          start: point('x1', 'y1'),
          end: point('x2', 'y2'),
        };
      });
      return {
        legs,
        halifax: centre('halifax'),
        peggysCove: centre('peggys-cove'),
        quebecCity: centre('quebec-city'),
      };
    });

    expect(drawn.legs.map((leg) => [leg.from, leg.to, leg.frame])).toEqual([
      ['halifax', 'peggys-cove', 'inset'],
      ['peggys-cove', 'quebec-city', 'main'],
    ]);

    const near = (
      a: { x: number; y: number } | null,
      b: { x: number; y: number } | null,
      what: string,
    ): void => {
      expect(a, `${what}: no point`).not.toBeNull();
      expect(b, `${what}: no pin`).not.toBeNull();
      expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)), what).toBeLessThan(3);
    };
    const [inInset, outOfInset] = drawn.legs;
    near(inInset?.start ?? null, drawn.halifax, 'the inset leg starts on Halifax');
    near(inInset?.end ?? null, drawn.peggysCove, "the inset leg ends on Peggy's Cove");
    near(outOfInset?.end ?? null, drawn.quebecCity, 'the line ends on the marker');

    /* No leg is a dot: Halifax to Peggy's Cove is drawn where it has a length. */
    for (const leg of drawn.legs) {
      const length = Math.hypot(
        (leg.end?.x ?? 0) - (leg.start?.x ?? 0),
        (leg.end?.y ?? 0) - (leg.start?.y ?? 0),
      );
      expect(length, `${String(leg.from)} to ${String(leg.to)}`).toBeGreaterThan(8);
    }
  });

  test('moves once and stops: the line draws in, the marker swells, all within five seconds', async ({
    page,
  }) => {
    await open(page, TRAVELLED);
    const motion = await mapMotion(page);

    const lines = motion.filter((node) => node.tag === 'line');
    expect(lines, 'two legs, each an ink line on a casing').toHaveLength(4);
    for (const line of lines) {
      expect(line.name).toBe('tn-map-route-draw');
      expect(line.iterations).toBe('1');
    }
    expect(motion.filter((node) => node.name === 'tn-map-here-pulse')).toHaveLength(1);
    for (const node of motion) {
      expect(node.iterations, `${node.tag} loops`).not.toBe('infinite');
      expect(node.end, `${node.tag} is still moving after five seconds`).toBeLessThanOrEqual(5);
    }
  });

  test('reduced motion removes all of it, and keeps the line, the marker and the words', async ({
    page,
  }) => {
    const still = async (): Promise<void> => {
      await drawingLoaded(page);
      const motion = await mapMotion(page);
      expect(motion.length).toBeGreaterThan(10);
      expect(motion.filter((node) => node.name !== 'none')).toEqual([]);
      const running = await page.evaluate(
        () =>
          document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return (
              target instanceof Element &&
              target.closest('[data-testid="level-select-map"]') !== null
            );
          }).length,
      );
      expect(running, 'an animation is running on the map').toBe(0);

      /* The line is simply drawn: no dash left over from the animation. */
      const lines = await page.evaluate(() =>
        [...document.querySelectorAll<SVGLineElement>('[data-testid="level-select-map"] line')].map(
          (line) => {
            const box = line.getBoundingClientRect();
            return { dash: getComputedStyle(line).strokeDasharray, size: box.width + box.height };
          },
        ),
      );
      expect(lines).toHaveLength(4);
      for (const line of lines) {
        expect(line.dash).toBe('none');
        expect(line.size).toBeGreaterThan(4);
      }

      const pins = await pinWidths(page);
      expect(pins.here).toBeGreaterThan(pins.plain);
      await expect(page.locator('[data-testid="level-card-quebec-city-here"]')).toBeVisible();
    };

    /* The setting. */
    await open(page, { ...TRAVELLED, motion: 'reduced' });
    await still();

    /* The operating system's preference, with the setting left off. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, TRAVELLED);
    await still();
    await page.emulateMedia({ reducedMotion: null });
  });

  test('reads in high contrast and in forced colours, without colour', async ({ page }) => {
    await open(page, { ...TRAVELLED, contrast: 'high', motion: 'reduced' });
    await drawingLoaded(page);
    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);

    await page.emulateMedia({ forcedColors: 'active' });
    const pins = await pinWidths(page);
    expect(pins.here, 'the marker is not bigger once colour is gone').toBeGreaterThan(pins.plain);
    const looks = await page.evaluate(() => {
      const leg = document.querySelector('[data-testid="level-select-map"] line.tn-map__leg');
      const badge = document.querySelector('[data-testid="level-card-quebec-city-here"]');
      return {
        stroke: leg === null ? 'missing' : getComputedStyle(leg).stroke,
        edge: badge === null ? 'missing' : getComputedStyle(badge).borderTopStyle,
      };
    });
    expect(looks.stroke).not.toMatch(/^(none|missing|transparent|rgba\(0, 0, 0, 0\))$/);
    expect(looks.edge).toBe('double');

    /* `color-contrast` off for this scan only, as in the forced-colours scan
       above: Chromium's emulation leaves authored text colours in the computed
       style. */
    const forced = await scan(page).disableRules(['color-contrast']).analyze();
    expect(forced.violations, violationsOf(forced)).toEqual([]);
    await page.emulateMedia({ forcedColors: null });
  });

  test('fits at 200 % text in French: the word wraps rather than clips, and Ottawa keeps its width', async ({
    page,
  }) => {
    await open(page, { ...TRAVELLED, locale: 'fr', textScale: 200, font: 'dyslexia' });
    await drawingLoaded(page);
    expect(await scrollsSideways(page)).toBe(false);

    const badge = page.locator('[data-testid="level-card-quebec-city-here"]');
    await expect(badge).toHaveText('Vous êtes ici');
    await expect(badge).toBeVisible();
    expect(
      await badge.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      'the word is clipped',
    ).toBe(true);
    expect(await undersizedTargets(page), 'at 200 % text, with the marker').toEqual([]);

    const cardWidth = (): Promise<number> =>
      page
        .locator('[data-testid="level-card-ottawa"]')
        .evaluate((card) => card.getBoundingClientRect().width);
    const withMap = await cardWidth();
    await page.evaluate(() => document.querySelector('[data-testid="level-select-map"]')?.remove());
    expect(Math.abs((await cardWidth()) - withMap), 'the map squeezed the list').toBeLessThan(0.5);
  });

  test('adds nothing to the keyboard walk or the switch ring', async ({ page }) => {
    await open(page, TRAVELLED);
    await expect(
      page.locator('[data-testid="level-select-map"]').locator('button, a[href], input, select, textarea, [tabindex]'),
    ).toHaveCount(0);

    /* From the heading, past the counts and the map, to the first card, then the
       second: the word is inside a card, not a stop of its own. */
    await page.locator('#tn-level-select-heading').focus();
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('level-card-halifax');
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('level-card-peggys-cove');

    await open(page, { ...TRAVELLED, singleSwitch: true });
    expect(await highlighted(page)).toBe(await focusedTestId(page));
  });
});
