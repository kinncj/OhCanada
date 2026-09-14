import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

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
  /** `none`: no level document at all. `one`: only Ottawa, so nothing is locked. */
  readonly levels?: 'none' | 'one';
  /** `TN-TITLE-04`: this browser is not saving. */
  readonly storageBlocked?: boolean;
  /** One level's stamp is in the passport, so the map's "Earned" badge is drawn. */
  readonly stamped?: string;
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

const focusedTestId = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return 'none';
    return (
      element.getAttribute('data-testid') ??
      (element.id !== '' ? `#${element.id}` : element.tagName.toLowerCase())
    );
  });

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

    await expect(page.locator('[data-journey-current="true"]')).toHaveCount(1);
    /* And it is on Ottawa: the only card reading "Open" without "Earned", which
       is a fact printed on the card and drawn here rather than invented. */
    const markedHandle = await page.evaluate(
      () =>
        document
          .querySelector('[data-journey-current="true"]')
          ?.closest('li')
          ?.querySelector('button[data-level-handle]')
          ?.getAttribute('data-level-handle') ?? 'none',
    );
    expect(markedHandle).toBe('ottawa');

    const sizeOf = async (): Promise<readonly number[]> =>
      page.evaluate(() =>
        ['true', 'false'].map((flag) => {
          const pin = document.querySelector<HTMLElement>(
            `[data-journey-current="${flag}"] .tn-journey__pin`,
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
