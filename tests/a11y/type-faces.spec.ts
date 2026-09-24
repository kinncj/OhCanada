import { expect, test, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * ADR-0066 §1 and ADR-0071, in a real browser: the game draws in the faces it
 * brings, at the weights it asks for, and never emboldens one synthetically.
 *
 * ## Why width alone cannot prove "no synthetic bold"
 *
 * Measured in this suite's Chromium while writing it: a family that declares
 * only a Regular, asked for at 700, is drawn with the Regular's advance widths
 * (473 px for the probe string at 32 px, the same at every weight) and about 45 %
 * more ink. Synthetic emboldening thickens the outlines and leaves the advances
 * alone. So a width check tells you whether the **real Bold** was picked, and an
 * ink check tells you whether anything was **thickened on top of it**. Each
 * weight the sheet asks for is held to both, against references drawn from the
 * same files under families that cannot synthesise: the Regular declared and
 * asked for at 400, and the Bold declared and asked for at 700.
 */

const PROBE = 'Mission : Répondez à 5 questions sur les peuples';
const SIZE = 32;

async function open(page: Page, params: Record<string, string>): Promise<void> {
  await page.goto(`${HARNESS_URL}?${new URLSearchParams(params).toString()}`);
  await page.waitForSelector(`html[data-tn-harness-ready="${params['screen'] ?? ''}"]`, { timeout: 15_000 });
}

interface Drawn {
  readonly width: number;
  readonly ink: number;
}

/**
 * Register reference faces from the game's own @font-face URLs, then draw the
 * probe in `family` at each weight, by DOM width and by canvas ink.
 */
async function drawAtWeights(
  page: Page,
  family: string,
): Promise<{ readonly byWeight: Record<number, Drawn>; readonly regular: Drawn; readonly bold: Drawn }> {
  return page.evaluate(
    async ({ family: name, probe, size }) => {
      const sheet = document.getElementById('tn-type-faces')?.textContent ?? '';
      const blocks = [...sheet.matchAll(/@font-face\s*\{([^}]*)\}/gu)].map((match) => match[1] ?? '');
      const urlOf = (weight: number): string => {
        const block = blocks.find(
          (body) => body.includes(`font-family: "${name}"`) && body.includes(`font-weight: ${String(weight)};`),
        );
        const url = block === undefined ? null : /url\("([^"]+)"\)/u.exec(block)?.[1];
        if (url === null || url === undefined) throw new Error(`no @font-face for ${name} ${String(weight)}`);
        return url;
      };
      const regular = new FontFace('TN Reference Regular', `url("${urlOf(400)}")`, { weight: '400' });
      const bold = new FontFace('TN Reference Bold', `url("${urlOf(700)}")`, { weight: '700' });
      document.fonts.add(await regular.load());
      document.fonts.add(await bold.load());
      for (const weight of [400, 700]) {
        const faces = await document.fonts.load(`${String(weight)} ${String(size)}px "${name}"`);
        if (faces.length === 0) throw new Error(`${name} ${String(weight)} did not load`);
      }

      const draw = (css: string, weight: number): { width: number; ink: number } => {
        const span = document.createElement('span');
        span.style.cssText = `font-family: ${css}; font-weight: ${String(weight)}; font-size: ${String(size)}px; white-space: nowrap; position: absolute`;
        span.textContent = probe;
        document.body.append(span);
        const width = span.getBoundingClientRect().width;
        span.remove();

        const canvas = document.createElement('canvas');
        canvas.width = 1400;
        canvas.height = 80;
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('no 2d context');
        context.font = `${String(weight)} ${String(size)}px ${css}`;
        context.fillText(probe, 4, 56);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let index = 3; index < pixels.length; index += 4) ink += pixels[index] ?? 0;
        return { width, ink };
      };

      const byWeight: Record<number, { width: number; ink: number }> = {};
      for (const weight of [400, 600, 700, 800]) byWeight[weight] = draw(`"${name}"`, weight);
      return {
        byWeight,
        regular: draw('"TN Reference Regular"', 400),
        bold: draw('"TN Reference Bold"', 700),
      };
    },
    { family, probe: PROBE, size: SIZE },
  );
}

for (const family of ['Atkinson Hyperlegible', 'OpenDyslexic']) {
  test(`${family} draws 400 as its Regular and 600, 700 and 800 as its real Bold, with no synthetic emboldening`, async ({
    page,
  }) => {
    await open(page, { screen: 'level', task: '1', prompt: '1' });
    const drawn = await drawAtWeights(page, family);

    /* The references differ, or the checks below could not tell them apart. */
    expect(drawn.bold.width).toBeGreaterThan(drawn.regular.width);
    expect(drawn.bold.ink).toBeGreaterThan(drawn.regular.ink);

    expect(drawn.byWeight[400], `${family} at 400 is not its Regular`).toEqual(drawn.regular);
    for (const weight of [600, 700, 800]) {
      const at = drawn.byWeight[weight];
      expect(at?.width, `${family} at ${String(weight)} is drawn with the Regular's advances: the real Bold was not picked`).toBe(
        drawn.bold.width,
      );
      expect(at?.ink, `${family} at ${String(weight)} carries more ink than its Bold: it was emboldened synthetically`).toBe(
        drawn.bold.ink,
      );
    }
  });
}

/*
 * The toggle, finally testable (ADR-0066 §1, "a third thing"). Before the faces
 * shipped, [data-tn-font="dyslexia"] named a family with no file behind it and
 * changed the rendering only where Microsoft's core fonts happened to be.
 */
test.describe('the easier-to-read font toggle', () => {
  const renderedWidth = (page: Page, testId: string): Promise<{ readonly strip: number; readonly face: Record<string, number> }> =>
    page.evaluate(async (id) => {
      const target = document.querySelector(`[data-testid="${id}"]`);
      if (target === null) throw new Error(`${id} is not drawn`);
      const style = getComputedStyle(target);
      const probe = (family: string): number => {
        const span = document.createElement('span');
        span.style.cssText = `font: ${style.fontWeight} ${style.fontSize} ${family}; letter-spacing: ${style.letterSpacing}; word-spacing: ${style.wordSpacing}; white-space: nowrap; position: absolute`;
        span.textContent = 'Réglages Menu Mission 3/5';
        document.body.append(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return width;
      };
      await document.fonts.load(`${style.fontWeight} ${style.fontSize} "OpenDyslexic"`);
      await document.fonts.load(`${style.fontWeight} ${style.fontSize} "Atkinson Hyperlegible"`);
      return {
        strip: probe(style.fontFamily),
        face: { OpenDyslexic: probe('"OpenDyslexic"'), 'Atkinson Hyperlegible': probe('"Atkinson Hyperlegible"') },
      };
    }, testId);

  test('draws the HUD in Atkinson Hyperlegible when off, and in OpenDyslexic when on', async ({ page }) => {
    await open(page, { screen: 'level', task: '1', prompt: '1' });
    const off = await renderedWidth(page, 'hud-task-indicator');
    expect(off.strip, 'with the toggle off the HUD is not drawn in Atkinson Hyperlegible').toBe(
      off.face['Atkinson Hyperlegible'],
    );

    await open(page, { screen: 'level', task: '1', prompt: '1', font: 'dyslexia' });
    const on = await renderedWidth(page, 'hud-task-indicator');
    expect(on.strip, 'with the toggle on the HUD is not drawn in OpenDyslexic').toBe(on.face.OpenDyslexic);
    expect(on.strip, 'the toggle changed nothing a player can see').toBeGreaterThan(off.strip);
  });

  test('reaches a screen as well as the HUD', async ({ page }) => {
    await open(page, { screen: 'settings', font: 'dyslexia' });
    const family = await page.evaluate(
      () => getComputedStyle(document.querySelector('.tn-screen') as Element).fontFamily,
    );
    expect(family.startsWith('OpenDyslexic') || family.startsWith('"OpenDyslexic"')).toBe(true);
    expect(
      await page.evaluate(() => document.fonts.check('400 16px "OpenDyslexic"')),
      'OpenDyslexic is named and not loaded',
    ).toBe(true);
  });
});

test('the build requests the bundled faces from itself, and no face from anywhere else', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url());
  });
  await open(page, { screen: 'level', task: '1', prompt: '1', font: 'dyslexia' });
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.length, 'no font was requested at all').toBeGreaterThan(0);
  for (const url of fonts) {
    expect(new URL(url).origin, `${url} is not served by the game`).toBe(new URL(HARNESS_URL).origin);
    expect(url).toMatch(/\.woff2(\?|$)/u);
  }
});
