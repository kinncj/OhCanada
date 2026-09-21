import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { text } from '@ui/copy';
import { HIGHLIGHT_ATTRIBUTE, SWITCH_STOP_ATTRIBUTE } from '@ui/single-switch';

import { focusedTestId } from './focus';
import { HARNESS_URL } from './playwright.config';

/**
 * The lesson reader in a real browser (ADR-0063).
 *
 * `docs/stories/TN-READ-reading-a-passage-at-a-stop.md` is the acceptance
 * criteria. This file scans the surface a `read` step opens, in both languages,
 * at 100 % and 200 % text, with one switch and with a keyboard — the four axes
 * ADR-0063 §3 says the reader inherits, plus the one it does not and this
 * change answers.
 *
 * Three rules, the same three `slice1-screens.spec.ts` states.
 *
 * 1. **A scan that cannot fail proves nothing.** Every test waits for the
 *    reader's own marker before asserting anything, so deleting the screen
 *    fails on the wait rather than passing against an empty page.
 * 2. **Every property asserted is also broken, from the test, and the check is
 *    shown to go red.** A green tick that cannot go red is not a gate.
 * 3. **`best-practice` is in the ruleset**, because the WCAG tag sets do not
 *    check that a dialog has an accessible name (`aria-dialog-name`), and an
 *    unnamed reader is the defect most likely to ship here: the name is the
 *    lesson's own title, which is content, so it is the one string this surface
 *    cannot write for itself.
 *
 * **What this does not prove.** The page below is the harness's, not `dist/`.
 * No quest ships a `read` step yet — authoring the first one is content's
 * obligation, dated 2027-02-20 — so nothing here may be reported as the shipped
 * game putting a passage in front of a player. What it proves is that the
 * surface exists, meets the contract, and is waiting for the step.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/**
 * The two page-level rules every component scan in this directory disables, for
 * the reason written in `slice1-screens.spec.ts`: one modal mounted alone over
 * an `aria-hidden` canvas has no document landmarks, and inventing a `<main>`
 * to satisfy a scanner is not accessibility. Everything else is on.
 */
const DISABLED = ['region', 'landmark-one-main'];

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags([...RULESET]).disableRules(DISABLED).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

const READER = '[data-testid="lesson-reader"]';
const TITLE = '[data-testid="lesson-reader-title"]';
const BODY = '[data-testid="lesson-reader-body"]';
const PASSAGE = '[data-testid="lesson-reader-passage"]';
const CLOSE = '[data-testid="lesson-reader-close"]';

/** The phone the design resolution is scaled to; 1080x1920 at device ratio 2.77. */
const PHONE = { width: 390, height: 844 } as const;

interface ReaderOptions {
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly singleSwitch?: boolean;
  readonly contrast?: 'high';
  readonly font?: 'dyslexia';
  readonly motion?: 'reduced';
  /** `long` is four passages at the corpus's own worst length. */
  readonly passages?: 'long';
}

/** Open the reader and wait for the marker that says it is really there. */
async function open(page: Page, options: ReaderOptions = {}): Promise<Locator> {
  const params = new URLSearchParams({ screen: 'lesson-reader' });
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.singleSwitch === true) params.set('switch', '1');
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.font !== undefined) params.set('font', options.font);
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.passages !== undefined) params.set('passages', options.passages);

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  const reader = page.locator(READER);
  await expect(reader, 'the reader did not mount').toBeVisible();
  await expect(page.locator(PASSAGE).first(), 'the reader drew no prose').toBeVisible();
  return reader;
}

test.use({ viewport: PHONE });

test.describe('the lesson reader', () => {
  for (const locale of ['en', 'fr'] as const) {
    test(`${locale}: it is a named dialog described by its own prose, and axe finds nothing`, async ({
      page,
    }) => {
      const reader = await open(page, { locale });

      /* The canvas stays out of the accessibility tree; the reader is in it. */
      await expect(page.locator('#game canvas')).toHaveAttribute('aria-hidden', 'true');
      await expect(reader).toHaveAttribute('role', 'dialog');
      await expect(reader).toHaveAttribute('aria-modal', 'true');
      await expect(reader).toHaveAttribute('lang', locale);

      /*
       * Named by the lesson, described by the passages: what a screen reader
       * reads on arrival is the title and then every paragraph, in the order the
       * step named them. axe's `aria-dialog-name` sees a *missing* name; it
       * cannot see a name pointing at the wrong element, so both are read back.
       */
      const named = await reader.getAttribute('aria-labelledby');
      const described = await reader.getAttribute('aria-describedby');
      expect(named, 'the reader has no accessible name').not.toBeNull();
      expect(described, 'the prose is not the dialog description').not.toBeNull();
      expect(await page.locator(`#${String(named)}`).getAttribute('data-testid')).toBe(
        'lesson-reader-title',
      );
      expect(await page.locator(`#${String(described)}`).getAttribute('data-testid')).toBe(
        'lesson-reader-body',
      );

      /* The title is content and must not be empty: an unnamed dialog is a defect. */
      expect(((await page.locator(TITLE).textContent()) ?? '').trim()).not.toBe('');

      /* Every passage is real text in reading order inside the dialog. */
      const prose = await page.locator(PASSAGE).allTextContents();
      expect(prose.length, 'the reader drew no passages').toBeGreaterThan(0);
      for (const paragraph of prose) expect(paragraph.trim().length).toBeGreaterThan(20);

      await expect(page.locator(CLOSE)).toHaveText(text(locale, 'common.close'));

      const results = await scan(page).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);
    });
  }

  test('the dialog-name check can fail: an unnamed reader is reported', async ({ page }) => {
    await open(page);
    /* Rule 2. Break the name in the page and watch the scan go red, so the
       green tick above is known to mean something. */
    await page.locator(READER).evaluate((node) => {
      node.removeAttribute('aria-labelledby');
      node.removeAttribute('aria-label');
    });
    const results = await scan(page).analyze();
    expect(results.violations.map((violation) => (violation as { id: string }).id)).toContain(
      'aria-dialog-name',
    );
  });

  test('at 200 % text, in French, with the longest passages: nothing clips and nothing scrolls sideways', async ({
    page,
  }) => {
    await open(page, { locale: 'fr', textScale: 200, passages: 'long' });

    /*
     * The page does not scroll sideways. This is the check 200 % scans exist
     * for: a paragraph that cannot wrap, or a fixed width in `vw`, widens the
     * document and every line goes off the right edge of the phone.
     */
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll, 'the reader scrolls sideways at 200 %').toBeLessThanOrEqual(
      widths.client + 1,
    );

    /*
     * No paragraph overflows its own box sideways. A French compound the line
     * cannot break — and French is where they are — pushes past the sheet's
     * edge and reads as a sentence with its tail cut off. `scrollWidth` is what
     * reports it; a screenshot is not.
     */
    const clipped = await page.locator(PASSAGE).evaluateAll((nodes) =>
      nodes
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .map((node) => node.getAttribute('data-tn-passage') ?? '?'),
    );
    expect(clipped, 'passages clipped at 200 % text').toEqual([]);

    /* And every paragraph still has a box with words in it, so the check above
       is not passing over paragraphs that were never laid out. */
    const heights = await page
      .locator(PASSAGE)
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights.length).toBe(4);
    for (const height of heights) expect(height).toBeGreaterThan(40);

    /* The way out is still reachable: it scrolls to, and it is a 44 pt target. */
    await page.locator(CLOSE).scrollIntoViewIfNeeded();
    const box = await page.locator(CLOSE).boundingBox();
    expect(box, 'Close has no box').not.toBeNull();
    expect(box?.height ?? 0, 'Close is under 44 pt').toBeGreaterThanOrEqual(44);

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('Close is a 44 pt target at 100 % text too', async ({ page }) => {
    await open(page);
    const box = await page.locator(CLOSE).boundingBox();
    expect(box, 'Close has no box').not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('high contrast and the easier-to-read font reach the prose, and axe still finds nothing', async ({
    page,
  }) => {
    await open(page, { contrast: 'high', font: 'dyslexia', passages: 'long' });

    /* The font toggle is worthless if it stops at the chrome: the paragraphs
       are the words this screen exists for, so the family is read off one. */
    const family = await page
      .locator(PASSAGE)
      .first()
      .evaluate((node) => getComputedStyle(node).fontFamily.toLowerCase());
    expect(family, 'the easier-to-read font did not reach a passage').toContain('atkinson');

    /*
     * The leading rule is the shape that says "study material" when colour
     * cannot, so it has to be visible in the mode that flattens colour. It was
     * not: `--tn-accent` is `#ffffff` under high contrast and so is the sheet,
     * which drew a white rule on white paper — a shape nobody could see, found
     * by measuring the rendered border rather than by reading the palette.
     */
    const rule = await page
      .locator(PASSAGE)
      .first()
      .evaluate((node) => ({
        edge: getComputedStyle(node).borderInlineStartColor,
        width: getComputedStyle(node).borderInlineStartWidth,
        paper: getComputedStyle(node.parentElement?.parentElement ?? node).backgroundColor,
      }));
    expect(rule.width, 'the leading rule is not drawn').not.toBe('0px');
    expect(rule.edge, 'the leading rule is the same colour as the sheet').not.toBe(rule.paper);

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('less movement stills the sheet without removing a word', async ({ page }) => {
    await open(page, { motion: 'reduced', passages: 'long' });

    const animated = await page
      .locator(READER)
      .evaluate((root) =>
        [root, ...Array.from(root.querySelectorAll('*'))]
          .map((node) => getComputedStyle(node as Element))
          .filter(
            (style) =>
              (style.animationName !== 'none' && style.animationDuration !== '0s') ||
              (style.transitionProperty !== 'none' && style.transitionDuration !== '0s'),
          ).length,
      );
    expect(animated, 'something still animates with less movement asked for').toBe(0);

    /* Reduced motion removes animation, not information. */
    await expect(page.locator(PASSAGE)).toHaveCount(4);
    await expect(page.locator(CLOSE)).toBeVisible();
  });

  test('a keyboard reaches the way out, cannot leave the reader, and Escape closes it', async ({
    page,
  }) => {
    await open(page);

    /* Focus opens inside the dialog, never on the body behind it. */
    const opened = await page.evaluate(
      () => document.activeElement?.closest('[data-testid="lesson-reader"]') !== null,
    );
    expect(opened, 'focus did not open inside the reader').toBe(true);

    await page.keyboard.press('Tab');
    expect(await focusedTestId(page), 'Tab did not reach Close').toBe('lesson-reader-close');

    /* The trap holds: the only control in the reader is where Tab stays. */
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page), 'Tab left the reader').toBe('lesson-reader-close');

    await page.keyboard.press('Escape');
    await expect(page.locator(READER), 'Escape did not close the reader').toBeHidden();
  });

  test('a paragraph is never a Tab stop, and the way out never needs one press more than it has to', async ({
    page,
  }) => {
    await open(page, { passages: 'long' });
    /*
     * Each passage is focusable by the switch and out of the Tab order
     * (`tabindex="-1"`). A keyboard player reading four paragraphs must not have
     * to press Tab five times to reach Close — that is the shape this surface
     * would have taken if the switch stop had been written as a Tab stop.
     */
    const indexes = await page
      .locator(PASSAGE)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('tabindex')));
    expect(indexes).toEqual(['-1', '-1', '-1', '-1']);
    expect(
      await page
        .locator(PASSAGE)
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute(SWITCH_STOP_ATTRIBUTE))),
    ).toEqual(['true', 'true', 'true', 'true']);
  });

  test('one switch reaches every passage and then the way out, and reading is the same gesture as moving', async ({
    page,
  }) => {
    await open(page, { singleSwitch: true, passages: 'long' });

    const passages = await page
      .locator(PASSAGE)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tn-passage') ?? ''));
    expect(passages.length, 'the premise: four passages to scan').toBe(4);

    /*
     * Walk the ring with short presses. Every passage must be reached — a
     * paragraph a switch player cannot highlight is a paragraph they can neither
     * scroll to nor hear, which is the defect ADR-0063 §3 left open.
     */
    const reached = new Set<string>();
    let closeReached = false;
    for (let press = 0; press < 20; press += 1) {
      const on = await page.evaluate(
        (attribute) => {
          const node = document.querySelector(`[${attribute}="true"]`);
          if (node === null) return '';
          return node.getAttribute('data-tn-passage') ?? node.getAttribute('data-testid') ?? '';
        },
        HIGHLIGHT_ATTRIBUTE,
      );
      if (on === 'lesson-reader-close') closeReached = true;
      else if (on !== '') reached.add(on);
      await page.keyboard.press('Space');
    }

    expect([...passages].filter((id) => !reached.has(id)), 'passages one switch never reached')
      .toEqual([]);
    expect(closeReached, 'one switch never reached Close').toBe(true);

    /* The highlight is visible, not merely recorded: the shared indicator is an
       outline and a change of border style, so it survives greyscale. */
    const highlighted = page.locator(`${PASSAGE}[${HIGHLIGHT_ATTRIBUTE}="true"], ${CLOSE}[${HIGHLIGHT_ATTRIBUTE}="true"]`);
    await expect(highlighted).toHaveCount(1);
  });

  test('the highlight scrolls a passage into view, because a switch player cannot scroll', async ({
    page,
  }) => {
    await open(page, { singleSwitch: true, textScale: 200, passages: 'long', locale: 'fr' });

    /* Press until the last passage is highlighted, then ask whether it is on
       screen. Before `focusAndReveal`, this was the failure: the highlight was
       real, the paragraph was below the fold, and nothing moved. */
    const last = page.locator(PASSAGE).last();
    for (let press = 0; press < 20; press += 1) {
      if ((await last.getAttribute(HIGHLIGHT_ATTRIBUTE)) === 'true') break;
      await page.keyboard.press('Space');
    }
    await expect(last).toHaveAttribute(HIGHLIGHT_ATTRIBUTE, 'true');

    const onScreen = await last.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
    expect(onScreen, 'the switch highlighted a passage nobody could see').toBe(true);
  });

  test('a long press on a passage changes nothing; a long press on Close closes', async ({
    page,
  }) => {
    await open(page, { singleSwitch: true });

    /* The highlight opens on the first item in the ring, which here is prose. */
    const first = page.locator(PASSAGE).first();
    await expect(first).toHaveAttribute(HIGHLIGHT_ATTRIBUTE, 'true');

    /* Held past the default 600 ms threshold: a stop is chosen, and choosing a
       stop must not be a way out. ADR-0063: nothing requires reading, and
       nothing may act on a paragraph. */
    await page.keyboard.down('Space');
    await page.waitForTimeout(900);
    await page.keyboard.up('Space');
    await expect(page.locator(READER), 'a long press on prose closed the reader').toBeVisible();
    await expect(first, 'a long press on prose moved the highlight').toHaveAttribute(
      HIGHLIGHT_ATTRIBUTE,
      'true',
    );

    /* The same hold on Close does close it. */
    const close = page.locator(CLOSE);
    for (let press = 0; press < 20; press += 1) {
      if ((await close.getAttribute(HIGHLIGHT_ATTRIBUTE)) === 'true') break;
      await page.keyboard.press('Space');
    }
    await expect(close).toHaveAttribute(HIGHLIGHT_ATTRIBUTE, 'true');
    await page.keyboard.down('Space');
    await page.waitForTimeout(900);
    await page.keyboard.up('Space');
    await expect(page.locator(READER), 'a long press on Close did not close the reader').toBeHidden();
  });

  test('the reader is not a second announcer: opening it says nothing', async ({ page }) => {
    await open(page);

    /* One live region, and the reader does not write to it on open — the dialog
       describes itself, so a message as well would say it all twice. */
    await expect(page.locator('[aria-live]')).toHaveCount(1);
    await page.waitForTimeout(400);
    expect(
      ((await page.locator('#tn-live-region').textContent()) ?? '').trim(),
      'the reader announced itself over a dialog that already reads itself',
    ).toBe('');
  });

  test('the prose is the dialog description and nothing else is between it and a reader', async ({
    page,
  }) => {
    await open(page, { passages: 'long' });
    /*
     * The body carries no widget role and no tabindex: there is nothing between
     * the reading cursor and the words. This is asserted rather than left to
     * inspection because the tempting version of this screen wraps the prose in
     * a focusable `group` or a `region` landmark, and both add a stop that does
     * nothing.
     */
    const body = page.locator(BODY);
    expect(await body.getAttribute('role')).toBeNull();
    expect(await body.getAttribute('tabindex')).toBeNull();
    /* Paragraphs, in order, under the described element. */
    expect(await body.locator('> p').count()).toBe(4);
  });
});
