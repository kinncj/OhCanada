import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { CHOSEN_GLYPH } from '@ui/dom';

import { HARNESS_URL } from './playwright.config';

/**
 * Exam mode's screens, scanned in a real browser: the start screen, the running
 * exam, its menu, its two confirmations, the result and the review.
 *
 * `docs/stories/TN-EXAM-08`, `TN-TIMER-09`, `TN-TIMER-10`, `TN-RESULT-10`,
 * `TN-RESULT-11` and `TN-ATTEMPT-09` are the acceptance criteria, and the exam
 * is the one place in this game with a timer — so the people this design is most
 * for are exactly the ones these scans are about.
 *
 * The three rules `tests/a11y/slice1-screens.spec.ts` set are kept:
 *
 *  1. **A scan that cannot fail proves nothing.** Every test waits for the
 *     screen's own marker, so removing a screen fails on the wait rather than
 *     passing against an empty page.
 *  2. **Every check is shown to fail without its fix**, at least once per
 *     property, from inside the page.
 *  3. **`best-practice` is in the ruleset**, because `aria-dialog-name` is
 *     best-practice only and an unnamed dialog is the defect that would ship.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/**
 * The glyphs a running exam may never draw (`TN-EXAMMENU-06`). The chosen-state
 * indicator is imported rather than spelt out, so a change to the shape is one
 * edit; the verdict glyphs are spelt out here, because they are what this suite
 * exists to refuse and must not be able to follow a change to the source.
 */
const VERDICT_GLYPHS = ['\u2713', '\u2717', '\u2714', '\u2718', '\u274C', '\u2705'];

/**
 * The same two page-level rules the component scans disable, for the same
 * reason: what is mounted here is one screen at a time, with no document
 * structure to landmark. The whole-page claim is made where a whole page exists
 * — `tests/a11y/shell.spec.ts` and `tests/a11y/level-screens.spec.ts` — and
 * `tests/e2e/exam.spec.ts` runs the exam through the shipped artefact, where
 * the exam really does sit inside the page's one `<main>`.
 */
const DISABLED = ['region', 'landmark-one-main'];

const scan = (page: Page): AxeBuilder =>
  new AxeBuilder({ page }).withTags([...RULESET]).disableRules(DISABLED).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }): string =>
  JSON.stringify(results.violations, null, 2);

type ExamScreen = 'exam-start' | 'exam' | 'exam-result';

interface HarnessOptions {
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly singleSwitch?: boolean;
  readonly motion?: 'reduced';
  readonly contrast?: 'high';
  readonly font?: 'dyslexia';
  /** `exam-start`: which of its five states. */
  readonly state?: 'ready' | 'not-ready' | 'error' | 'resume' | 'gone';
  /** The clock: `on` for the switch, or what the running exam's clock says. */
  readonly timer?: 'on' | 'off' | 'running' | 'paused' | 'stopped' | 'last-minute';
  /** How many of the twenty have an answer, or `all`. */
  readonly answered?: number | 'all';
  /** Which question is on screen. */
  readonly at?: number;
  /** A second surface over the screen being scanned. */
  readonly over?: 'menu' | 'unanswered' | 'leave' | 'review';
  readonly storage?: 'blocked';
  readonly passed?: boolean;
  readonly timeUp?: boolean;
  readonly subjects?: false;
}

const TEST_IDS: Readonly<Record<ExamScreen, string>> = {
  'exam-start': 'exam-start',
  exam: 'exam-screen',
  'exam-result': 'exam-result',
};

async function openScreen(
  page: Page,
  screen: ExamScreen,
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
  if (options.timer !== undefined) params.set('timer', options.timer);
  if (options.answered !== undefined) params.set('answered', String(options.answered));
  if (options.at !== undefined) params.set('at', String(options.at));
  if (options.over !== undefined) params.set('over', options.over);
  if (options.storage !== undefined) params.set('storage', options.storage);
  if (options.passed === false) params.set('passed', '0');
  if (options.timeUp === true) params.set('timeup', '1');
  if (options.subjects === false) params.set('subjects', '0');

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  await page.waitForSelector(`html[data-tn-harness-ready="${screen}"]`, { timeout: 15_000 });

  const root = page.locator(`[data-testid="${TEST_IDS[screen]}"]`);
  await expect(root, `${screen} never appeared`).toBeVisible();
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

const clippedLabels = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
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

/**
 * Every state of every exam screen, as one list.
 *
 * A scan of the default state of three screens would miss almost everything
 * interesting: the fills only exist once an option is taken, the clock only
 * exists in a timed exam, and the confirmations cannot be reached at all
 * without a state to reach them from.
 */
const STATES: readonly { readonly name: string; readonly options: HarnessOptions }[] = [
  { name: 'start, ready', options: {} },
  { name: 'start, timer on', options: { timer: 'on' } },
  { name: 'start, no subject count', options: { subjects: false } },
  { name: 'start, not ready', options: { state: 'not-ready' } },
  { name: 'start, bank failed', options: { state: 'error' } },
  { name: 'start, an exam to finish', options: { state: 'resume' } },
  { name: 'start, an exam that cannot be opened', options: { state: 'gone' } },
];

const EXAM_STATES: readonly { readonly name: string; readonly options: HarnessOptions }[] = [
  { name: 'untimed, nothing answered', options: {} },
  { name: 'an answer taken', options: { answered: 3, at: 1 } },
  { name: 'a clock running', options: { timer: 'running' } },
  { name: 'a clock paused', options: { timer: 'paused' } },
  { name: 'the last minute', options: { timer: 'last-minute' } },
  { name: 'the timer turned off mid-exam', options: { timer: 'stopped' } },
  { name: 'the last question', options: { at: 19, answered: 'all' } },
  { name: 'the menu', options: { over: 'menu', timer: 'running' } },
  { name: 'the unanswered warning', options: { over: 'unanswered', answered: 17 } },
  { name: 'leaving a browser that cannot save', options: { over: 'leave', storage: 'blocked' } },
];

const RESULT_STATES: readonly { readonly name: string; readonly options: HarnessOptions }[] = [
  { name: 'passed', options: {} },
  { name: 'not this time', options: { passed: false } },
  { name: 'time is up', options: { timeUp: true } },
  { name: 'without the timer', options: { timer: 'off' } },
  { name: 'the review', options: { over: 'review' } },
];

test.describe('the exam start screen', () => {
  for (const { name, options } of STATES) {
    test(`has no axe violations: ${name}, in English and in French`, async ({ page }) => {
      for (const locale of ['en', 'fr'] as const) {
        await openScreen(page, 'exam-start', { ...options, locale });
        const results = await scan(page).analyze();
        expect(results.violations, `${name} (${locale}): ${violationsOf(results)}`).toEqual([]);
      }
    });
  }

  test('is a named dialog, and an unnamed one is caught', async ({ page }) => {
    const root = await openScreen(page, 'exam-start');
    await expect(root).toHaveAttribute('role', 'dialog');
    await expect(root).toHaveAttribute('aria-modal', 'true');
    await expect(root).toHaveAccessibleName(/\S/);

    /* The negative control: `aria-dialog-name` is best-practice only, so a
       WCAG-only scan would stay green on an unnamed dialog. */
    await root.evaluate((element) => {
      element.removeAttribute('aria-labelledby');
      element.removeAttribute('aria-label');
    });
    const results = await scan(page).analyze();
    expect(results.violations.map((violation) => violation.id)).toContain('aria-dialog-name');
  });

  test('keeps every target at 44 CSS px, at 100 % and at 200 % text', async ({ page }) => {
    await openScreen(page, 'exam-start');
    expect(await undersizedTargets(page)).toEqual([]);
    await openScreen(page, 'exam-start', { textScale: 200 });
    expect(await undersizedTargets(page), 'at 200 % text').toEqual([]);
  });

  test('fits the French sentences at 200 % on a small phone', async ({ page }) => {
    /* `TN-EXAM-09`: the two longest sentences on the screen, in the longer
       language, at the size that breaks layouts. */
    await openScreen(page, 'exam-start', { locale: 'fr', textScale: 200, font: 'dyslexia' });
    await expect(
      page.getByText('Cet examen ne porte que sur les sujets qui sont prêts.'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Vous pouvez revenir en arrière et changer une réponse avant de terminer.',
      ),
    ).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
    const clipped = await clippedLabels(page);
    expect(clipped, clipped.join(' | ')).toEqual([]);
  });

  test('shows the timer switch state as a word, not as a position', async ({ page }) => {
    /* `TN-TIMER-01`. The word is what survives greyscale, forced colours and a
       screen reader; the fill is the third signal. */
    const toggle = page.locator('[data-testid="exam-timer-toggle"]');
    await openScreen(page, 'exam-start');
    await expect(toggle).toHaveAttribute('role', 'switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toContainText('Off');
    await expect(toggle).toHaveAccessibleDescription(/time limit/);

    await openScreen(page, 'exam-start', { timer: 'on' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toContainText('On');
  });

  test('draws no clock, because no exam is running', async ({ page }) => {
    await openScreen(page, 'exam-start', { timer: 'on' });
    await expect(page.locator('[data-testid="exam-clock"]')).toHaveCount(0);
  });

  test('has one live region and an aria-hidden canvas', async ({ page }) => {
    await openScreen(page, 'exam-start');
    expect(await page.locator('[aria-live]').count()).toBe(1);
    await expect(page.locator('#tn-live-region')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('a running exam', () => {
  for (const { name, options } of EXAM_STATES) {
    test(`has no axe violations: ${name}, in English and in French`, async ({ page }) => {
      for (const locale of ['en', 'fr'] as const) {
        await openScreen(page, 'exam', { ...options, locale });
        const results = await scan(page).analyze();
        expect(results.violations, `${name} (${locale}): ${violationsOf(results)}`).toEqual([]);
      }
    });
  }

  test('names the question card and describes it with the wording', async ({ page }) => {
    /* `TN-EXAM-08`: a named region inside the exam screen, whose name includes
       "Question 1 of 20" and whose description is the prompt. */
    await openScreen(page, 'exam');
    const card = page.locator('[data-testid="question-card"]');
    await expect(card).toHaveAccessibleName(/Question 1 of 20/);
    await expect(card).toHaveAccessibleDescription(/\S/);
  });

  test("shows none of the level card's teaching", async ({ page }) => {
    await openScreen(page, 'exam', { answered: 3 });
    await expect(page.locator('[data-testid="question-kind"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-feedback"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-explanation"]')).toHaveCount(0);
  });

  test('reports the chosen option to the accessibility tree, with a word beside it', async ({
    page,
  }) => {
    await openScreen(page, 'exam');
    const option = page.locator('[data-testid="option-2"]');
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await expect(option).toContainText('Your answer');
    /* `TN-EXAM-03`: focus moves to Next, and the exam does not move. */
    await expect(page.locator('[data-testid="exam-next"]')).toBeFocused();
    await expect(page.locator('[data-testid="question-progress"]')).toHaveText(
      'Question 1 of 20',
    );
  });

  test('keeps the chosen option distinguishable without colour', async ({ page }) => {
    /* `TN-EXAM-09` under `High contrast`: the mark and the word carry the
       meaning, and the border weight changes with them. */
    await openScreen(page, 'exam', { contrast: 'high' });
    const option = page.locator('[data-testid="option-1"]');
    await option.click();
    await expect(option).toContainText(CHOSEN_GLYPH);
    await expect(option).toContainText('Your answer');
    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('marks the chosen option as recorded, never as right', async ({ page }) => {
    /*
     * `TN-EXAMMENU-06`. The exam drew a **tick** beside "Your answer", which is
     * `TN-CARD-04`'s pairing on a screen where the player has already been
     * marked — and here nothing has been marked, and `exam.noFeedback` has just
     * promised in printed copy that nothing will be until the end.
     *
     * The word is right and stays. The shape is one shape with two fills, so
     * "chosen" and "not chosen" differ by fill and no symbol in a running exam
     * carries a verdict.
     */
    const root = await openScreen(page, 'exam');
    await page.locator('[data-testid="option-1"]').click();

    const chosen = page.locator('[data-tn-chosen="true"]');
    await expect(chosen).toHaveCount(1);
    await expect(chosen).toHaveText(CHOSEN_GLYPH);
    await expect(page.locator('[data-tn-chosen="false"]')).toHaveCount(3);

    /* Nothing anywhere on a running exam is a tick or a cross. */
    const drawn = await root.innerText();
    for (const glyph of VERDICT_GLYPHS) {
      expect(drawn.includes(glyph), `a running exam drew "${glyph}"`).toBe(false);
    }
    /* And the mark is not read: the word and `aria-pressed` are what the
       accessibility tree is given (`TN-EXAM-08`). */
    await expect(page.locator('[data-testid="option-1"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await chosen.getAttribute('aria-hidden')).toBe('true');

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test("names its own menu, and never the HUD's", async ({ page }) => {
    /*
     * `TN-EXAMMENU-01` and `TN-EXAMMENU-04`. The control says the same word as
     * the HUD's on purpose — one word for one thing wherever a player can see
     * which screen they are on — and the **dialog's name** is where the two have
     * to differ, because "Menu, dialog" tells somebody who cannot see the exam
     * behind it nothing about where they are.
     */
    await openScreen(page, 'exam', { over: 'menu' });
    await expect(page.locator('[data-testid="exam-menu-button"]')).toHaveText('Menu');
    const menu = page.locator('[data-testid="exam-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAccessibleName('Exam menu');
    /* The level's menu can never open over an exam (`TN-EXAMMENU-02`). */
    await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="menu-button"]')).toHaveCount(0);
    await expect(menu).not.toContainText('Leave the level');

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test("names its own menu in French, at 200 %", async ({ page }) => {
    /* `TN-EXAMMENU-04`'s longest-French scenario and `TN-EXAMMENU-05`. */
    await openScreen(page, 'exam', {
      over: 'menu',
      locale: 'fr',
      textScale: 200,
      timer: 'running',
    });
    const menu = page.locator('[data-testid="exam-menu"]');
    await expect(menu).toHaveAccessibleName("Menu de l'examen");
    await expect(menu).toContainText("Quitter l'examen");
    await expect(menu).toContainText('Arrêter le chronomètre');
    await expect(menu).toContainText('Réglages');

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('draws the clock as text with no live region of its own', async ({ page }) => {
    /* `TN-TIMER-09`: "exactly one element on the page has an aria-live
       attribute", and the clock is not it. */
    await openScreen(page, 'exam', { timer: 'running' });
    const clock = page.locator('[data-testid="exam-clock"]');
    await expect(clock).toBeVisible();
    await expect(clock).toHaveText(/30 minutes left/);
    await expect(clock).not.toHaveAttribute('aria-live', /.*/);
    expect(await page.locator('[aria-live]').count()).toBe(1);
  });

  test('removes the clock entirely when there is none', async ({ page }) => {
    /* `TN-TIMER-02`: "not present in the accessibility tree" — hidden, not
       merely styled away. */
    await openScreen(page, 'exam');
    await expect(page.locator('[data-testid="exam-clock"]')).toBeHidden();
    await expect(page.getByText('No timer. Take as long as you like.')).toBeVisible();
  });

  test('fits the French clock and its pause at 200 % text', async ({ page }) => {
    /* `TN-TIMER-10`: the French readings are longer and neither may be
       truncated with an ellipsis. */
    await openScreen(page, 'exam', {
      locale: 'fr',
      textScale: 200,
      timer: 'paused',
      font: 'dyslexia',
    });
    await expect(page.getByText('Chronomètre en pause')).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
    const clipped = await clippedLabels(page);
    expect(clipped, clipped.join(' | ')).toEqual([]);

    await openScreen(page, 'exam', { locale: 'fr', textScale: 200, timer: 'last-minute' });
    await expect(page.getByText("Il reste moins d'une minute")).toBeVisible();
  });

  test('keeps every control at 44 CSS px at 200 % text, and does not cover the question', async ({
    page,
  }) => {
    await openScreen(page, 'exam', { textScale: 200, timer: 'running' });
    expect(await undersizedTargets(page)).toEqual([]);
    expect(await scrollsSideways(page)).toBe(false);
    for (const testId of ['exam-previous', 'exam-next', 'exam-finish']) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
    }
  });

  test('is a keyboard-only exam', async ({ page }) => {
    /* `TN-EXAM-06`: every control is reachable with Tab, each activates with
       Enter, and focus is never left on the document body. */
    await openScreen(page, 'exam');
    const reached: string[] = [];
    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        return element === null || element === document.body
          ? 'body'
          : (element.getAttribute('data-testid') ?? element.tagName.toLowerCase());
      });
      expect(focused, 'focus fell to the document body').not.toBe('body');
      reached.push(focused);
    }
    expect(reached).toContain('option-0');
    expect(reached).toContain('exam-next');
    expect(reached).toContain('exam-finish');

    await page.locator('[data-testid="option-1"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="option-1"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('opens the unanswered warning as an alertdialog that takes focus', async ({ page }) => {
    await openScreen(page, 'exam', { over: 'unanswered', answered: 17 });
    const dialog = page.locator('[data-testid="exam-unanswered"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'alertdialog');
    await expect(dialog).toHaveAccessibleName(/\S/);
    await expect(dialog).toContainText('You have not answered 3 questions.');
    const focused = await page.evaluate(() =>
      document.querySelector('[data-testid="exam-unanswered"]')?.contains(document.activeElement),
    );
    expect(focused, 'focus is not inside the confirmation').toBe(true);
  });

  test('leaves the exam alone when the warning is dismissed with Escape', async ({ page }) => {
    await openScreen(page, 'exam', { over: 'unanswered', answered: 17 });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="exam-unanswered"]')).toBeHidden();
    await expect(page.locator('[data-testid="exam-screen"]')).toBeVisible();
  });
});

test.describe('the exam result', () => {
  for (const { name, options } of RESULT_STATES) {
    test(`has no axe violations: ${name}, in English and in French`, async ({ page }) => {
      for (const locale of ['en', 'fr'] as const) {
        await openScreen(page, 'exam-result', { ...options, locale });
        const results = await scan(page).analyze();
        expect(results.violations, `${name} (${locale}): ${violationsOf(results)}`).toEqual([]);
      }
    });
  }

  test('puts focus on the verdict, so the first thing read is whether I passed', async ({
    page,
  }) => {
    await openScreen(page, 'exam-result');
    await expect(page.locator('[data-testid="exam-result-verdict"]')).toBeFocused();
    await expect(page.locator('[data-testid="exam-result-verdict"]')).toHaveText('You passed');
  });

  test('is named "Your exam" and draws no line above the verdict', async ({ page }) => {
    /*
     * `TN-RESULT-10`'s "an accessible name that is not empty", and
     * `TN-EXAMMENU`'s ruling 3 about which string it is. `exam.result.title` was
     * drawn as a kicker over the `<h1>`, so a player who did not pass read "Your
     * exam" and then "Not this time" — a label before a verdict, which
     * `TN-RESULT-01` refuses. As the screen's **name** it costs no visible line
     * and is what a screen-reader user hears on arrival.
     */
    for (const [locale, name, verdict] of [
      ['en', 'Your exam', 'Not this time'],
      ['fr', 'Votre examen', 'Pas cette fois'],
    ] as const) {
      const root = await openScreen(page, 'exam-result', { locale, passed: false });
      await expect(root).toHaveAccessibleName(name);
      const drawn = await root.innerText();
      expect(drawn, `"${name}" is drawn on the result`).not.toContain(name);
      expect(drawn.indexOf(verdict), 'the verdict is not the first line').toBe(0);
    }
  });

  test('reads the score line as one phrase', async ({ page }) => {
    /* `TN-RESULT-10`: "a single text node in the accessibility tree", so no
       number is read apart from the words around it. */
    await openScreen(page, 'exam-result', { locale: 'fr' });
    const score = page.locator('[data-testid="exam-result-score"]');
    await expect(score).toHaveText('Bonnes réponses : 17 sur 20');
    expect(await score.evaluate((element) => element.childNodes.length)).toBe(1);
  });

  test('exposes the by-subject rows as a list, each row one phrase', async ({ page }) => {
    await openScreen(page, 'exam-result');
    const rows = page.locator('[data-testid^="subject-row-"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toHaveText(/.+: \d+ out of \d+/);
    /* None of them announces on its own. */
    expect(await page.locator('[aria-live]').count()).toBe(1);
  });

  test('shows no percentage, grade, streak or rank', async ({ page }) => {
    await openScreen(page, 'exam-result', { passed: false });
    const text = (await page.locator('[data-testid="exam-result"]').innerText()).toLowerCase();
    expect(text).not.toContain('%');
    for (const word of ['grade', 'streak', 'rank', 'badge', 'average']) {
      expect(text, `the result says "${word}"`).not.toContain(word);
    }
  });

  test('never uses the word "failed" about the player, in either language', async ({ page }) => {
    for (const [locale, banned] of [
      ['en', ['failed', 'wrong', 'error', 'mistake']],
      ['fr', ['échec', 'échoué', 'erreur', 'faute']],
    ] as const) {
      await openScreen(page, 'exam-result', { passed: false, locale });
      const text = (await page.locator('[data-testid="exam-result"]').innerText()).toLowerCase();
      for (const word of banned) {
        expect(text, `${locale}: the result says "${word}"`).not.toContain(word);
      }
    }
  });

  test('tells the four review states apart without colour', async ({ page }) => {
    /* Right, wrong, unanswered and gone, on one page, in high contrast. */
    await openScreen(page, 'exam-result', { over: 'review', contrast: 'high' });
    const review = page.locator('[data-testid="exam-review"]');
    await expect(review).toBeVisible();
    await expect(review).toContainText('Your answer');
    await expect(review).toContainText('Correct answer');
    await expect(review).toContainText('You did not answer this one.');
    await expect(review).toContainText('This question could not be shown.');
    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('offers one control out of the review, so a long list is not a trap', async ({ page }) => {
    /* `TN-RESULT-09`: the highlight reaches a control that leaves the review
       without visiting every item first. The items are list items. */
    await openScreen(page, 'exam-result', { over: 'review' });
    const buttons = page.locator('[data-testid="exam-review"] button');
    await expect(buttons).toHaveCount(1);
    await expect(page.locator('[data-testid="exam-review-back"]')).toBeVisible();
  });

  test('fits the French result at 200 % text on a small phone', async ({ page }) => {
    await openScreen(page, 'exam-result', {
      locale: 'fr',
      textScale: 200,
      timer: 'off',
      font: 'dyslexia',
    });
    await expect(page.getByText('Vous avez fait cet examen sans chronomètre.')).toBeVisible();
    await expect(page.getByText('Vos résultats par sujet')).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
    const clipped = await clippedLabels(page);
    expect(clipped, clipped.join(' | ')).toEqual([]);
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test('nothing animates, with reduced motion on', async ({ page }) => {
    /* `TN-RESULT-11`: "a pass is not a firework". There is nothing to remove,
       which is asserted rather than assumed. */
    await openScreen(page, 'exam-result', { motion: 'reduced' });
    const animated = await page.evaluate(() => {
      const bad: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>('[data-testid="exam-result"] *')) {
        const style = getComputedStyle(element);
        if (style.animationName !== 'none' || style.transitionDuration !== '0s') {
          bad.push(element.tagName);
        }
      }
      return bad;
    });
    expect(animated, animated.join(' | ')).toEqual([]);
  });
});
