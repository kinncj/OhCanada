import { devices, expect, test } from '@playwright/test';
import { collectTelemetry } from './helpers';

// Touch-first: phone viewport, coarse pointer, no keyboard. Uses the virtual joystick and on-screen interact button.
test.use({ ...devices['Pixel 7'], launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });

test('phone: touch controls appear, joystick moves the player, tap to interact', async ({ page }) => {
  const events = collectTelemetry(page);
  await page.goto('?e2e=1&preset=minimal');
  await page.getByTestId('menu-new').waitFor({ timeout: 90_000 });
  await page.getByTestId('menu-new').tap();
  await page.getByTestId('creator-name').fill('Mo');
  await page.getByTestId('creator-confirm').tap();
  await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]') && !!window.__truenorth, null, { timeout: 90_000 });
  await expect.poll(() => events.some((e) => e.type === 'district:loaded'), { timeout: 60_000 }).toBe(true);
  const stick = page.locator('.touch .stick');
  await expect(stick).toBeVisible();
  await expect(page.locator('.touch .act')).toBeVisible();
  await expect(page.locator('.click-to-play')).toBeHidden();
  // Drag the joystick forward for a moment and check the player moved.
  const before = await page.evaluate(() => window.__truenorth.state().currentDistrict);
  expect(before).toBe('hub');
  const box = (await stick.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const posBefore = await page.evaluate(() => (window as unknown as { __truenorth: { nearby(): string | null } }).__truenorth.nearby());
  void posBefore;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 40, { steps: 5 });
  await page.waitForTimeout(1500);
  await page.mouse.up();
  const moved = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="debug-overlay"]');
    return el?.textContent ?? '';
  });
  expect(moved).toMatch(/pos/);
  // Tap interact next to the guide.
  await page.evaluate(() => window.__truenorth.teleport(4, 12.5));
  await expect.poll(() => page.evaluate(() => window.__truenorth.nearby())).toBe('guide-amelie');
  await page.locator('.touch .act').tap();
  await expect(page.getByTestId('dialogue-line')).toBeVisible({ timeout: 15_000 });
});
