import { expect, test, type Page } from '@playwright/test';

/**
 * `TN-CREATOR-12` and ADR-0040, on the artefact GitHub Pages serves: the
 * character creator shows the character it describes, drawn from the level's
 * atlas, and every choice reaches the picture.
 *
 * **Why frames and not pixels.** CI draws with SwiftShader, and a pixel
 * comparison there proves little about a phone. The picture's host publishes
 * `data-frames`, the atlas frames on the picture back to front, which are the
 * rig's templates resolved against the choice: choosing tight curls in black
 * has to put `character-hair-coil-black` on the picture, and nothing else can.
 * Pixels are read once, for the one claim that is about pixels — reduced motion
 * is a picture that does not change.
 *
 * The audit this answers: "Your character" was a sentence, six groups of
 * choices and no picture of the result.
 */

async function openCreator(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('character-creator')).toBeVisible();
}

const art = (page: Page) => page.getByTestId('character-preview-art');

async function framesNow(page: Page): Promise<readonly string[]> {
  await expect(art(page)).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  return ((await art(page).getAttribute('data-frames')) ?? '').split(' ').filter((frame) => frame !== '');
}

interface Chosen {
  readonly skin: string;
  readonly hairShape: string;
  readonly hairColour: string;
  readonly headCovering: string;
  readonly feature: string;
  readonly presentation: string;
}

async function chosen(page: Page): Promise<Chosen> {
  return page.getByTestId('character-preview').evaluate((node) => ({
    skin: node.getAttribute('data-skin') ?? '',
    hairShape: node.getAttribute('data-hair-shape') ?? '',
    hairColour: node.getAttribute('data-hair-colour') ?? '',
    headCovering: node.getAttribute('data-head-covering') ?? '',
    feature: node.getAttribute('data-feature') ?? '',
    presentation: node.getAttribute('data-presentation') ?? '',
  }));
}

/** The frames the rig's templates resolve to for a choice, as `rig.json` names them. */
function expectedFrames(choice: Chosen): readonly string[] {
  return [
    `character-head-${choice.skin}`,
    `character-neck-${choice.skin}`,
    `character-hair-${choice.hairShape}-${choice.hairColour}`,
    `character-face-neutral-${choice.presentation}`,
  ];
}

async function expectPictureMatches(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const choice = await chosen(page);
      const frames = await framesNow(page);
      const missing = expectedFrames(choice).filter((frame) => !frames.includes(frame));
      const toque = frames.includes('character-head-covering-toque') === (choice.headCovering === 'toque');
      const glasses = frames.includes('character-feature-glasses') === (choice.feature === 'glasses');
      const heads = frames.filter((frame) => frame.startsWith('character-head-skin-')).length;
      const hairs = frames.filter((frame) => frame.startsWith('character-hair-')).length;
      return { missing, toque, glasses, heads, hairs };
    })
    .toEqual({ missing: [], toque: true, glasses: true, heads: 1, hairs: 1 });
}

const pick = async (page: Page, slot: string, current: string, options: readonly string[]): Promise<string> => {
  const other = options.find((option) => option !== current);
  if (other === undefined) throw new Error(`no other option in ${slot}`);
  await page.getByTestId(`slot-${slot}-${other}`).click();
  return other;
};

test.describe("the creator's picture", () => {
  test('draws the character the words describe, from the level atlas, unread', async ({ page }) => {
    const atlases: string[] = [];
    page.on('request', (request) => {
      if (/\/atlas\/shared@[12]x\.[0-9a-f]{8}\.webp$/u.test(request.url())) atlases.push(request.url());
    });
    await openCreator(page);

    await expectPictureMatches(page);
    expect(atlases.length, 'the picture did not come from the shared character atlas').toBeGreaterThan(0);

    await expect(art(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(art(page).locator('canvas')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#game canvas')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[aria-live]')).toHaveCount(1);
  });

  test('changes with skin and with hair, at once', async ({ page }) => {
    await openCreator(page);
    await expectPictureMatches(page);
    const before = await chosen(page);

    const skin = await pick(page, 'skin', before.skin, ['skin-1', 'skin-2', 'skin-3', 'skin-4', 'skin-5', 'skin-6']);
    await expect.poll(() => framesNow(page)).toContain(`character-head-${skin}`);
    await expect.poll(() => framesNow(page)).not.toContain(`character-head-${before.skin}`);

    const shape = await pick(page, 'hair-shape', before.hairShape, ['crop', 'coil', 'bob', 'long']);
    const colour = await pick(page, 'hair-colour', before.hairColour, ['black', 'brown', 'blond', 'red', 'grey']);
    await expect.poll(() => framesNow(page)).toContain(`character-hair-${shape}-${colour}`);
    await expect
      .poll(() => framesNow(page))
      .not.toContain(`character-hair-${before.hairShape}-${before.hairColour}`);
    await expectPictureMatches(page);
  });

  test('carries the head covering, the glasses and the style, and Surprise me', async ({ page }) => {
    await openCreator(page);
    await expectPictureMatches(page);
    const before = await chosen(page);

    await pick(page, 'head-covering', before.headCovering, ['none', 'toque']);
    await pick(page, 'feature', before.feature, ['none', 'glasses']);
    await pick(page, 'presentation', before.presentation, ['feminine', 'masculine', 'neutral']);
    await expectPictureMatches(page);

    await page.getByTestId('randomise-character').click();
    await expectPictureMatches(page);
  });

  test('is let go when the creator closes, on the first run and from Settings', async ({ page }) => {
    await openCreator(page);
    await framesNow(page);

    await page.getByTestId('start-playing').click();
    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(art(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(1);

    await page.getByTestId('level-select-back').click();
    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-character').click();
    await expectPictureMatches(page);

    await page.getByTestId('creator-done').click();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(art(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('is words only when the art cannot load, and the way on still works', async ({ page }) => {
    await page.route('**/atlas/shared@*.webp', (route) => route.abort());
    await openCreator(page);

    await expect(art(page)).toHaveAttribute('data-state', 'failed', { timeout: 20_000 });
    await expect(art(page)).toBeHidden();
    await expect(page.locator('#tn-creator-preview-text')).toContainText('Skin tone');

    const before = await chosen(page);
    await pick(page, 'hair-shape', before.hairShape, ['crop', 'coil', 'bob', 'long']);
    await page.getByTestId('start-playing').click();
    await expect(page.getByTestId('level-select')).toBeVisible();
  });
});

test.describe("the creator's picture under reduced motion", () => {
  test.use({ reducedMotion: 'reduce' });

  test('holds still, and still follows every choice', async ({ page }) => {
    await openCreator(page);
    await framesNow(page);
    await expect(page.getByTestId('character-preview')).toHaveAttribute('data-animated', 'false');

    const pixels = (): Promise<string> =>
      art(page)
        .locator('canvas')
        .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
    const first = await pixels();
    await page.waitForTimeout(1_000);
    expect(await pixels(), 'the picture moved under reduced motion').toBe(first);

    const before = await chosen(page);
    const shape = await pick(page, 'hair-shape', before.hairShape, ['crop', 'coil', 'bob', 'long']);
    await expect.poll(() => framesNow(page)).toContain(`character-hair-${shape}-${before.hairColour}`);
  });
});
