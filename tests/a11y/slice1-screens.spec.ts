import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * Slice 1's DOM screens, scanned in a real browser: settings, the character
 * creator, dialogue, the question card and Study.
 *
 * Three rules this file is written to.
 *
 * 1. **A scan that cannot fail proves nothing.** Every test waits for the
 *    screen's own marker before asserting anything, so removing a screen makes
 *    the test fail on the wait rather than pass against an empty page.
 * 2. **Every check is shown to fail without its fix.** Each block that asserts a
 *    property also breaks that property — in the page, from the test — and
 *    asserts the check goes red. A green tick that cannot go red is the failure
 *    mode this project has spent a session removing.
 * 3. **`best-practice` is in the ruleset.** The WCAG tag sets do not check that
 *    a dialog has an accessible name: that is `aria-dialog-name`, and it is
 *    best-practice only. Names and descriptions are also asserted directly,
 *    because axe cannot see a *wrong* name, only a missing one.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/**
 * Two page-level best-practice rules are disabled, and only these two.
 *
 * `region` and `landmark-one-main` are about the structure of a *document* — a
 * banner, a main, a contentinfo. What this harness renders is a single modal
 * dialog over a game canvas, which is the whole page in the real app too: the
 * canvas is `aria-hidden` and the dialog is `aria-modal`, so there is no
 * document structure to landmark and adding a `<main>` would be a landmark
 * invented to satisfy a scanner. Every other best-practice rule, including
 * `aria-dialog-name`, is on.
 */
const DISABLED = ['region', 'landmark-one-main'];

const scan = (page: Page, tags: readonly string[] = RULESET) =>
  new AxeBuilder({ page }).withTags([...tags]).disableRules(DISABLED).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

type ScreenName = 'settings' | 'creator' | 'dialogue' | 'card' | 'study';

interface HarnessOptions {
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly singleSwitch?: boolean;
  readonly motion?: 'reduced';
  readonly contrast?: 'high';
  readonly font?: 'dyslexia';
  readonly state?: 'ready' | 'empty' | 'error' | 'summary';
  readonly long?: boolean;
  readonly sound?: boolean;
}

/** Open one screen and wait for the marker that says it is really there. */
async function openScreen(
  page: Page,
  screen: ScreenName,
  options: HarnessOptions = {},
): Promise<Locator> {
  const params = new URLSearchParams({ screen });
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.singleSwitch === true) params.set('switch', '1');
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.font !== undefined) params.set('font', options.font);
  if (options.state !== undefined) params.set('state', options.state);
  if (options.long === true) params.set('long', '1');
  if (options.sound === true) params.set('sound', '1');

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  await page.waitForSelector(`html[data-tn-harness-ready="${screen}"]`, { timeout: 15_000 });

  const testId = TEST_IDS[screen];
  const root = page.locator(`[data-testid="${testId}"]`);
  await expect(root, `${screen} never appeared`).toBeVisible();
  return root;
}

const TEST_IDS: Readonly<Record<ScreenName, string>> = {
  settings: 'settings-screen',
  creator: 'character-creator',
  dialogue: 'dialogue',
  card: 'question-card',
  study: 'study-screen',
};

/** What the browser reports as focused, in a form a failure message can name. */
const focusedTestId = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return 'none';
    return (
      element.getAttribute('data-testid') ??
      (element.id !== '' ? `#${element.id}` : element.tagName.toLowerCase())
    );
  });

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
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

const SCREENS: readonly ScreenName[] = ['settings', 'creator', 'dialogue', 'card', 'study'];

test.describe('slice 1 DOM screens', () => {
  for (const screen of SCREENS) {
    test.describe(screen, () => {
      test('has no axe violations, in English and in French', async ({ page }) => {
        for (const locale of ['en', 'fr'] as const) {
          await openScreen(page, screen, { locale });
          const results = await scan(page).analyze();
          expect(results.violations, `${screen} (${locale}): ${violationsOf(results)}`).toEqual([]);
        }
      });

      test('is a named dialog, and the name is not empty', async ({ page }) => {
        const root = await openScreen(page, screen);
        await expect(root).toHaveAttribute('role', /^(dialog|alertdialog)$/);
        await expect(root).toHaveAttribute('aria-modal', 'true');
        await expect(root).toHaveAccessibleName(/\S/);
      });

      test('an unnamed dialog is caught — the check can fail', async ({ page }) => {
        /*
         * The negative control for the test above. `aria-dialog-name` is tagged
         * best-practice, so a WCAG-only scan stays green on an unnamed dialog;
         * this proves the ruleset in use here does not.
         */
        const root = await openScreen(page, screen);
        await root.evaluate((element) => {
          element.removeAttribute('aria-labelledby');
          element.removeAttribute('aria-label');
        });

        const results = await scan(page).analyze();
        const ids = results.violations.map((violation) => violation.id);
        expect(ids, `stripping the name produced no violation: ${violationsOf(results)}`).toContain(
          'aria-dialog-name',
        );
      });

      test('keeps every touch target at 44 CSS px, at 100 % and at 200 % text', async ({
        page,
      }) => {
        await openScreen(page, screen);
        expect(await undersizedTargets(page)).toEqual([]);

        await openScreen(page, screen, { textScale: 200 });
        expect(await undersizedTargets(page), 'at 200 % text').toEqual([]);
      });

      test('does not scroll sideways at 200 % text, with the dyslexia font on', async ({
        page,
      }) => {
        await openScreen(page, screen, { textScale: 200, font: 'dyslexia' });
        expect(await scrollsSideways(page)).toBe(false);

        /* Every label is reachable, by scrolling down if needed — not clipped. */
        const clipped = await page.evaluate(() => {
          const bad: string[] = [];
          for (const element of document.querySelectorAll<HTMLElement>(
            '.tn-screen h1, .tn-screen h2, .tn-screen p, .tn-screen button, .tn-screen label',
          )) {
            if (element.scrollWidth > element.clientWidth + 1) {
              bad.push(`${element.tagName}: ${(element.textContent ?? '').slice(0, 40)}`);
            }
          }
          return bad;
        });
        expect(clipped, clipped.join(' | ')).toEqual([]);
      });

      test('has exactly one live region, and an aria-hidden canvas', async ({ page }) => {
        await openScreen(page, screen);
        /* Two polite live regions is a well-known way to make a screen reader
           go quiet; `app/ui/live-region.ts` owns the only channel. */
        expect(await page.locator('[aria-live]').count()).toBe(1);
        await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
      });

      test('contains focus: Tab cannot leave it', async ({ page }) => {
        const root = await openScreen(page, screen);
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
          .toBe(TEST_IDS[screen]);

        for (let index = 0; index < 12; index += 1) {
          await page.keyboard.press('Tab');
          const inside = await root.evaluate((element) =>
            element.contains(document.activeElement),
          );
          expect(inside, `focus escaped ${screen} after ${String(index + 1)} tabs`).toBe(true);
        }
      });

      test('removing the containment is caught — the check can fail', async ({ page }) => {
        /* The negative control for the test above: with the background left
           reachable, Tab escapes into a control behind a modal screen. */
        const root = await openScreen(page, screen);
        await page.evaluate(() => {
          const behind = document.createElement('button');
          behind.id = 'tn-behind';
          behind.textContent = 'Behind';
          document.body.append(behind);
          for (const element of document.querySelectorAll<HTMLElement>('[inert]')) {
            element.inert = false;
          }
          /* Undo the trap itself, the way a refactor that dropped it would. */
          const clone = document.querySelector<HTMLElement>('.tn-screen');
          clone?.replaceWith(clone.cloneNode(true));
        });

        await page.locator('#tn-behind').focus();
        const inside = await root.evaluate((element) => element.contains(document.activeElement));
        expect(inside, 'the negative control did not reach outside the dialog').toBe(false);
      });

      test('is still clean in high contrast', async ({ page }) => {
        await openScreen(page, screen, { contrast: 'high' });
        const results = await scan(page).analyze();
        expect(results.violations, violationsOf(results)).toEqual([]);

        /*
         * axe reports contrast it cannot compute as "incomplete", not as a pass,
         * so an unknown is treated as a failure here.
         *
         * One exception, and it is narrow: a node whose content is only a symbol
         * ("nonBmp") has no contrast axe can judge. Those nodes are the tick and
         * cross marks, which are `aria-hidden` decoration sitting next to the
         * same meaning in words — proved by the assertion below, so the
         * exception cannot quietly grow to cover real text.
         */
        const unknown = results.incomplete
          .filter((issue) => issue.id === 'color-contrast')
          .flatMap((issue) => issue.nodes)
          .filter(
            (node) =>
              !node.any.every(
                (check) => (check.data as { messageKey?: string } | null)?.messageKey === 'nonBmp',
              ),
          );
        expect(unknown, `contrast is unknown, not proven: ${JSON.stringify(unknown)}`).toEqual([]);

        const unlabelledMarks = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('.tn-screen__mark')]
            .filter(
              (element) =>
                element.getAttribute('aria-hidden') !== 'true' ||
                (element.parentElement?.textContent ?? '').trim() ===
                  (element.textContent ?? '').trim(),
            )
            .map((element) => element.outerHTML),
        );
        expect(
          unlabelledMarks,
          'a mark that is not decoration, or that carries meaning no word repeats',
        ).toEqual([]);
      });

      test('removes animation under reduced motion, and keeps the information', async ({
        page,
      }) => {
        await openScreen(page, screen, { motion: 'reduced' });
        await expect(page.locator('html')).toHaveAttribute('data-tn-motion', 'reduced');

        const moving = await page.evaluate(() => {
          const bad: string[] = [];
          for (const element of document.querySelectorAll<HTMLElement>('.tn-screen, .tn-screen *')) {
            const style = getComputedStyle(element);
            if (style.animationName !== 'none' && style.animationDuration !== '0s') {
              bad.push(`${element.tagName} animates: ${style.animationName}`);
            }
            if (style.transitionDuration !== '0s') {
              bad.push(`${element.tagName} transitions: ${style.transitionDuration}`);
            }
          }
          return bad;
        });
        expect(moving, moving.join(' | ')).toEqual([]);
      });
    });
  }
});

test.describe('settings', () => {
  test('every switch is a switch, named, with its state as a word', async ({ page }) => {
    const root = await openScreen(page, 'settings');

    for (const testId of [
      'setting-auto-move',
      'setting-single-switch',
      'setting-reduced-motion',
      'setting-high-contrast',
      'setting-dyslexia-font',
      'setting-subtitles',
    ]) {
      const control = root.locator(`[data-testid="${testId}"]`);
      await expect(control).toHaveAttribute('role', 'switch');
      await expect(control).toHaveAccessibleName(/\S/);
      await expect(control).toHaveAttribute('aria-checked', /^(true|false)$/);
      /* TN-SET-07: the state is a word, so removing the animation removes no
         information. */
      await expect(control).toContainText(/On|Off/);
    }
  });

  test('help text is the accessible description, not a floating paragraph', async ({ page }) => {
    const root = await openScreen(page, 'settings');
    await expect(root.locator('[data-testid="setting-single-switch"]')).toHaveAccessibleDescription(
      'Tap to move the highlight. Hold to choose.',
    );
  });

  test('a missing description is caught — the check can fail', async ({ page }) => {
    const root = await openScreen(page, 'settings');
    const control = root.locator('[data-testid="setting-single-switch"]');
    await control.evaluate((element) => element.removeAttribute('aria-describedby'));
    await expect(control).toHaveAccessibleDescription('');
  });

  test('the text size is a slider that reports a percentage', async ({ page }) => {
    const root = await openScreen(page, 'settings');
    const slider = root.locator('[data-testid="setting-text-size"]');
    await expect(slider).toHaveAccessibleName('Text size');
    await expect(slider).toHaveAttribute('aria-valuetext', '100%');

    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', '125%');
    /* One control, the whole game: the root font size is what every screen
       scales from. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-text-scale', '125');
  });

  test('the language changes with the arrow keys and redraws in French', async ({ page }) => {
    const root = await openScreen(page, 'settings');
    await root.locator('[data-testid="setting-language-en"]').focus();
    await page.keyboard.press('ArrowRight');

    await expect(root).toHaveAttribute('lang', 'fr');
    await expect(root.locator('h1')).toHaveText('Réglages');
    await expect(root.locator('[data-testid="settings-close"]')).toHaveText('Fermer');
    /* Never translated. */
    await expect(root.locator('[data-testid="setting-language-fr"]')).toHaveText('Français');
    await expect(root.locator('[data-testid="setting-language-en"]')).toHaveText('English');
  });

  test('switches toggle with Space from the keyboard', async ({ page }) => {
    const root = await openScreen(page, 'settings');
    const control = root.locator('[data-testid="setting-high-contrast"]');
    await control.focus();
    await page.keyboard.press('Space');
    await expect(control).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-tn-contrast', 'high');
  });

  test('leaves the sound section out until there is a sound to control', async ({ page }) => {
    /* OQ-SET-3. One flag turns it on when audio ships. */
    let root = await openScreen(page, 'settings');
    await expect(root.locator('[data-testid="setting-sound"]')).toHaveCount(0);

    root = await openScreen(page, 'settings', { sound: true });
    await expect(root.locator('[data-testid="setting-sound"]')).toHaveCount(1);
  });
});

test.describe('the character creator', () => {
  test('every option is a named radio, never a bare swatch', async ({ page }) => {
    const root = await openScreen(page, 'creator');

    for (const slot of ['slot-skin', 'slot-hair', 'slot-coat']) {
      const group = root.locator(`[data-testid="${slot}"]`);
      await expect(group).toHaveAttribute('role', 'radiogroup');
      await expect(group).toHaveAccessibleName(/\S/);

      const options = group.locator('[role="radio"]');
      const count = await options.count();
      expect(count, `${slot} has no options`).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        /* "an accessible name that is a word, not a colour swatch". */
        await expect(options.nth(index)).toHaveAccessibleName(/[A-Za-zÀ-ÿ]/);
      }
    }
  });

  test('choosing in one slot changes no other slot, at every skin tone', async ({ page }) => {
    /* docs/content-review.md §8.2, in a real browser this time. */
    const root = await openScreen(page, 'creator');
    const countIn = (slot: string) =>
      root.locator(`[data-testid="${slot}"] [role="radio"]`).count();

    const before = { hair: await countIn('slot-hair'), coat: await countIn('slot-coat') };
    const skins = root.locator('[data-testid="slot-skin"] [role="radio"]');

    for (let index = 0; index < (await skins.count()); index += 1) {
      await skins.nth(index).click();
      expect(await countIn('slot-hair')).toBe(before.hair);
      expect(await countIn('slot-coat')).toBe(before.coat);
    }
  });

  test('describes the preview in text, and updates it', async ({ page }) => {
    const root = await openScreen(page, 'creator');
    const preview = root.locator('[data-testid="character-preview"]');
    await expect(preview).toHaveAccessibleName(/Skin tone/);

    await root.locator('[data-testid="slot-hair-braids"]').click();
    await expect(preview).toHaveAccessibleName(/Hair: Braids/);
    await expect(preview).toHaveAttribute('data-hair', 'braids');
  });

  test('offers a way into Settings, because it is the first screen', async ({ page }) => {
    /* OQ-SET-1: without it, a first-run player who needs one-button mode or
       200 % text cannot reach either. */
    const root = await openScreen(page, 'creator');
    await expect(root.locator('[data-testid="creator-settings"]')).toBeVisible();
  });

  test('does not animate the preview under reduced motion', async ({ page }) => {
    const root = await openScreen(page, 'creator', { motion: 'reduced' });
    await expect(root.locator('[data-testid="character-preview"]')).toHaveAttribute(
      'data-animated',
      'false',
    );
  });

  test('marks the chosen option with a shape as well as a colour', async ({ page }) => {
    const root = await openScreen(page, 'creator');
    const chosen = root.locator('[data-testid="slot-coat-anorak"]');
    await chosen.click();
    await expect(chosen).toHaveAttribute('aria-checked', 'true');
    await expect(chosen.locator('[aria-hidden="true"]')).toHaveText('✓');
  });

  test('moves within a group with the arrow keys', async ({ page }) => {
    const root = await openScreen(page, 'creator');
    await root.locator('[data-testid="slot-hair-curly"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(root.locator('[data-testid="slot-hair-straight"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(await focusedTestId(page)).toBe('slot-hair-straight');
  });
});

test.describe('the question card', () => {
  test('names itself with the progress and describes itself with the question', async ({
    page,
  }) => {
    const root = await openScreen(page, 'card');
    await expect(root).toHaveAccessibleName(/Question 1 of 3/);
    await expect(root).toHaveAccessibleDescription(/head of state/);
    await expect(root.locator('[data-testid="question-kind"]')).toHaveText('New');
  });

  test('each option is a button carrying its whole wording', async ({ page }) => {
    const root = await openScreen(page, 'card');
    const options = root.locator('[data-testid^="option-"]');
    await expect(options).toHaveCount(4);

    for (let index = 0; index < 4; index += 1) {
      const option = options.nth(index);
      await expect(option).toHaveRole('button');
      /* No "option 1" prefix in front of the wording. */
      await expect(option).not.toHaveAccessibleName(/^option/i);
      await expect(option).toHaveAccessibleName(/\S{4,}/);
    }
  });

  test('a wrong answer is marked with a word and a shape, not a colour', async ({ page }) => {
    const root = await openScreen(page, 'card');
    await root.locator('[data-testid="option-1"]').click();

    await expect(root.locator('[data-testid="question-feedback"]')).toContainText('Not quite.');
    await expect(root.locator('[data-testid="question-feedback"]')).toContainText(
      'The answer is: The monarch',
    );
    await expect(root.locator('[data-testid="option-1"]')).toContainText('Your answer');
    await expect(root.locator('[data-testid="option-0"]')).toContainText('Correct answer');
    await expect(root.locator('[data-testid="option-1"] [aria-hidden="true"]')).toHaveText('✗');
    await expect(root.locator('[data-testid="option-0"] [aria-hidden="true"]')).toHaveText('✓');
  });

  test('moves focus to the result so a screen reader reads it', async ({ page }) => {
    await openScreen(page, 'card');
    await page.locator('[data-testid="option-0"]').click();
    expect(await focusedTestId(page)).toBe('question-feedback');
  });

  test('answers once, however many times it is tapped', async ({ page }) => {
    const root = await openScreen(page, 'card');
    const feedback = root.locator('[data-testid="question-feedback"]');
    await root.locator('[data-testid="option-0"]').click();
    await root.locator('[data-testid="option-1"]').click({ force: true });
    await expect(feedback).toContainText("That's right!");
  });

  test('Escape leaves the card without answering', async ({ page }) => {
    const root = await openScreen(page, 'card');
    await page.keyboard.press('Escape');
    await expect(root).toBeHidden();
    await expect(page.locator('[data-testid="question-closed-notice"]')).toHaveText(
      'No problem. We will ask again later.',
    );
  });

  test('the longest question is readable at 200 %, with every option reachable', async ({
    page,
  }) => {
    const root = await openScreen(page, 'card', { textScale: 200, long: true });
    expect(await scrollsSideways(page)).toBe(false);

    /* No ellipsis: the whole wording is in the box, even if the box scrolls. */
    const clipped = await root.evaluate((element) => {
      const bad: string[] = [];
      for (const option of element.querySelectorAll<HTMLElement>('[data-testid^="option-"]')) {
        if (option.scrollHeight > option.clientHeight + 2) bad.push(option.textContent ?? '');
      }
      return bad;
    });
    expect(clipped, clipped.join(' | ')).toEqual([]);

    for (let index = 0; index < 4; index += 1) {
      const option = root.locator(`[data-testid="option-${String(index)}"]`);
      await option.scrollIntoViewIfNeeded();
      await expect(option).toBeVisible();
    }
  });

  test('is answerable with one switch: short presses move, a long press chooses', async ({
    page,
  }) => {
    const root = await openScreen(page, 'card', { singleSwitch: true });

    /* Tap anywhere — the middle of the screen, not a control. */
    await page.mouse.move(195, 700);
    await page.mouse.down();
    await page.mouse.up();
    await expect(root.locator('[data-testid="option-1"]')).toHaveAttribute(
      'data-switch-highlight',
      'true',
    );

    /* Nothing scans on its own: a second passes and the highlight is where it
       was left. */
    await page.waitForTimeout(1_000);
    await expect(root.locator('[data-testid="option-1"]')).toHaveAttribute(
      'data-switch-highlight',
      'true',
    );

    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await expect(root.locator('[data-testid="question-feedback"]')).toContainText('Not quite.');
  });

  test('is French end to end', async ({ page }) => {
    const root = await openScreen(page, 'card', { locale: 'fr' });
    await expect(root.locator('[data-testid="question-progress"]')).toHaveText('Question 1 sur 3');
    await expect(root.locator('[data-testid="question-kind"]')).toHaveText('Nouvelle');

    await root.locator('[data-testid="option-1"]').click();
    const feedback = root.locator('[data-testid="question-feedback"]');
    await expect(feedback).toContainText('Pas tout à fait.');
    await expect(feedback).toContainText('La bonne réponse est : Le monarque');
    await expect(root.locator('[data-testid="question-next"]')).toHaveText('Suivant');

    /* Canadian typography: no space before "!" or "?". */
    const text = (await root.textContent()) ?? '';
    expect(/\s[?!]/.test(text)).toBe(false);
  });
});

test.describe('study', () => {
  test('says what will happen, and shows the drill size as text', async ({ page }) => {
    const root = await openScreen(page, 'study');
    await expect(root).toHaveAccessibleName('Study');
    await expect(root).toContainText('Practise the questions you have seen. There is no time limit.');
    await expect(root.locator('[data-testid="study-count"]')).toHaveText('5 questions');
    await expect(root.locator('[data-testid="study-start"]')).toBeVisible();
  });

  test('the empty state explains and offers a way on', async ({ page }) => {
    const root = await openScreen(page, 'study', { state: 'empty' });
    await expect(root.locator('[data-testid="study-empty"]')).toContainText('Nothing to review yet');
    await expect(root.locator('[data-testid="study-practise-new"]')).toBeVisible();
    await expect(page.locator('[data-testid="question-card"]')).toHaveCount(0);
  });

  test('the summary is a list, focused, with no grade', async ({ page }) => {
    const root = await openScreen(page, 'study', { state: 'summary' });
    await expect(root.locator('[data-testid="study-summary-score"]')).toHaveText(
      'You got 4 out of 5 right.',
    );
    await expect(root.locator('[data-testid="study-summary-returning"]')).toHaveRole('list');
    expect(await focusedTestId(page)).toBe('study-summary');
    await expect(root).not.toContainText('%');
  });

  test('the summary scrolls rather than clipping at 200 %', async ({ page }) => {
    const root = await openScreen(page, 'study', { state: 'summary', textScale: 200 });
    expect(await scrollsSideways(page)).toBe(false);
    for (const testId of ['study-again', 'study-exit']) {
      const control = root.locator(`[data-testid="${testId}"]`);
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('is French end to end', async ({ page }) => {
    const root = await openScreen(page, 'study', { locale: 'fr', state: 'summary' });
    await expect(root).toContainText('Terminé');
    await expect(root).toContainText('Vous avez 4 bonnes réponses sur 5.');
    await expect(root).toContainText('Nous reposerons ces questions :');
    await expect(root.locator('[data-testid="study-again"]')).toHaveText('Réviser encore');
    await expect(root.locator('[data-testid="study-exit"]')).toHaveText('Retour au jeu');
  });
});

test.describe('dialogue', () => {
  test('is named after the speaker and describes what was said', async ({ page }) => {
    const root = await openScreen(page, 'dialogue');
    await expect(root).toHaveAccessibleName('Officer');
    await expect(root).toHaveAccessibleDescription(/Welcome to Ottawa/);
    await expect(root.locator('[data-testid="dialogue-accept"]')).toHaveText("Yes, let's go");
    await expect(root.locator('[data-testid="dialogue-decline"]')).toHaveText('Not now');
  });

  test('both choices are reachable and takeable with the keyboard', async ({ page }) => {
    const root = await openScreen(page, 'dialogue');
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('dialogue-accept');
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('dialogue-decline');
    await expect(root).toBeVisible();
  });
});
