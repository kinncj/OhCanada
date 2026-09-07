import { expect, test } from '@playwright/test';
import { answerQuestion, bootToMenu, collectTelemetry, createCharacterAndEnter, stepThroughDialogue } from './helpers';

test.describe('Slice 1 smoke', () => {
  test('boot → create character → hub → NPC → quest → 3 questions → save → reload', async ({ page }) => {
    const events = collectTelemetry(page);
    await bootToMenu(page);
    await expect(page.getByText('TrueNorth').first()).toBeVisible();
    expect(events.some((e) => e.type === 'session:ready')).toBe(true);

    await createCharacterAndEnter(page, 'Sam');
    await expect.poll(() => events.some((e) => e.type === 'district:loaded'), { timeout: 300_000 }).toBe(true);
    expect(events.find((e) => e.type === 'character:created')).toMatchObject({ payload: { character: { name: 'Sam', appearance: { outfit: 'hockey', accessory: 'toque' } } } });
    await expect(page.getByTestId('stamps')).toHaveText('0');

    // Walk up to Amélie (deterministic: teleport via the e2e hook) and talk.
    await page.evaluate(() => window.__truenorth.teleport(4, 12.5));
    await expect.poll(() => page.evaluate(() => window.__truenorth.nearby())).toBe('guide-amelie');
    await page.evaluate(() => window.__truenorth.interact());
    await stepThroughDialogue(page, true); // accept the quest
    await stepThroughDialogue(page, false); // first step dialogue
    await expect(page.getByTestId('objective')).toContainText(/flagpole/i);
    expect(events.some((e) => e.type === 'quest:started')).toBe(true);

    // Reach the flagpole trigger; the quiz starts automatically.
    await page.evaluate(() => window.__truenorth.teleport(16, 12));
    await answerQuestion(page, true);
    await answerQuestion(page, false);
    await answerQuestion(page, true);

    await expect(page.getByTestId('stamps')).toHaveText('1');
    await stepThroughDialogue(page, false); // completion dialogue
    const answered = events.filter((e) => e.type === 'question:answered');
    expect(answered).toHaveLength(3);
    expect(answered.map((e) => (e.payload as { correct: boolean }).correct)).toEqual([true, false, true]);
    expect(events.some((e) => e.type === 'quest:completed')).toBe(true);
    expect(events.some((e) => e.type === 'district:unlocked')).toBe(true);
    expect(events.some((e) => e.type === 'progress:saved')).toBe(true);

    const state = await page.evaluate(() => window.__truenorth.state());
    expect(state.completedQuests).toEqual(['hub-welcome']);
    expect(state.unlockedDistricts).toContain('rights-responsibilities');

    // Reload: the save is restored and Continue drops us back into the world with the stamp.
    await page.reload();
    await page.getByTestId('menu-continue').waitFor({ timeout: 300_000 });
    await page.getByTestId('menu-continue').click();
    await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]'), null, { timeout: 300_000 });
    await expect(page.getByTestId('stamps')).toHaveText('1');
    const restored = await page.evaluate(() => window.__truenorth.state());
    expect(restored.character?.name).toBe('Sam');
    expect(restored.completedQuests).toEqual(['hub-welcome']);
  });

  test('travel to an unlocked district and back', async ({ page }) => {
    const events = collectTelemetry(page);
    await bootToMenu(page);
    await createCharacterAndEnter(page, 'Jo');
    // Locked: portal refuses.
    expect(await page.evaluate(() => window.__truenorth.travel('rights-responsibilities'))).toBe(false);
    expect(events.some((e) => e.type === 'district:locked-attempt')).toBe(true);
    // Complete the tutorial quickly.
    await page.evaluate(() => window.__truenorth.teleport(4, 12.5));
    await expect.poll(() => page.evaluate(() => window.__truenorth.nearby())).toBe('guide-amelie');
    await page.evaluate(() => window.__truenorth.interact());
    await stepThroughDialogue(page, true);
    await stepThroughDialogue(page, false);
    await page.evaluate(() => window.__truenorth.teleport(16, 12));
    for (let i = 0; i < 3; i++) await answerQuestion(page, true);
    await stepThroughDialogue(page, false);
    expect(await page.evaluate(() => window.__truenorth.travel('rights-responsibilities'))).toBe(true);
    await expect.poll(() => events.filter((e) => e.type === 'district:loaded').length, { timeout: 300_000 }).toBeGreaterThanOrEqual(2);
    await page.waitForFunction(() => !document.querySelector('[data-screen="loading"]'), null, { timeout: 300_000 });
    expect((await page.evaluate(() => window.__truenorth.state())).currentDistrict).toBe('rights-responsibilities');
    // District intro NPC exists and can be talked to.
    await page.evaluate(() => window.__truenorth.teleport(3, 12.5));
    await expect.poll(() => page.evaluate(() => window.__truenorth.nearby())).toBe('npc-rights-responsibilities-1');
  });

  test('french locale, settings, journal and practice exam', async ({ page }) => {
    await bootToMenu(page);
    await page.getByTestId('lang-fr').click();
    await expect(page.getByTestId('menu-new')).toHaveText('Nouveau parcours');
    await createCharacterAndEnter(page, 'Léa');
    await expect(page.getByTestId('stamps')).toHaveText('0');
    await page.evaluate(() => window.__truenorth.openJournal());
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
    await page.getByTestId('journal-practice').click();
    await page.getByTestId('exam-begin').click();
    await expect(page.getByTestId('exam-question')).toBeVisible();
    await expect(page.getByRole('timer')).toContainText(/29:|30:/);
    // answer all 20 with the first option and submit
    for (let i = 0; i < 20; i++) {
      await page.locator('[data-testid^="exam-choice-"]').first().click();
      if (i < 19) await page.getByTestId('exam-next').click();
    }
    await page.getByTestId('exam-submit').click();
    await expect(page.getByTestId('exam-score')).toContainText('/20');
    await page.getByTestId('exam-exit').click();
    await expect(page.getByTestId('stamps')).toBeVisible();
  });

  test('save import rejects tampered files', async ({ page }) => {
    await bootToMenu(page);
    page.on('dialog', (d) => void d.accept());
    const fileInput = page.locator('#import-save');
    await fileInput.setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"__proto__":{"x":1},"stamps":"not-an-array"}') });
    // Still on the menu, no crash, and no save created.
    await expect(page.getByTestId('menu-new')).toBeVisible();
    await expect(page.getByTestId('menu-continue')).toHaveCount(0);
  });
});
