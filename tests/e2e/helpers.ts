import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __truenorth: {
      teleport(x: number, z: number): void;
      interact(): string | null;
      nearby(): string | null;
      state(): { stamps: unknown[]; unlockedDistricts: string[]; completedQuests: string[]; character: { name: string } | null; currentDistrict: string };
      travel(id: string): boolean;
      openJournal(): void;
      openExam(practice: boolean): void;
      backend: string;
    };
  }
}

export interface TelemetryEvent {
  type: string;
  payload: unknown;
}

export function collectTelemetry(page: Page): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  page.on('console', (m) => {
    const text = m.text();
    if (!text.startsWith('[truenorth] ')) return;
    try {
      events.push(JSON.parse(text.slice('[truenorth] '.length)) as TelemetryEvent);
    } catch {
      /* ignore */
    }
  });
  return events;
}

export async function bootToMenu(page: Page, query = '?e2e=1&preset=minimal'): Promise<void> {
  await page.goto(query);
  await page.getByTestId('menu-new').or(page.getByTestId('menu-continue')).first().waitFor({ timeout: 300_000 });
}

export async function createCharacterAndEnter(page: Page, name = 'Sam'): Promise<void> {
  await page.getByTestId('menu-new').click();
  await page.getByTestId('creator-name').fill(name);
  await page.getByTestId('opt-outfit-hockey').click();
  await page.getByTestId('opt-accessory-toque').click();
  await page.getByTestId('creator-confirm').click();
  await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]') && !!window.__truenorth, null, { timeout: 300_000 });
}

export async function stepThroughDialogue(page: Page, accept: boolean): Promise<void> {
  await page.getByTestId('dialogue-line').waitFor();
  for (let i = 0; i < 8; i++) {
    if (accept && (await page.getByTestId('dialogue-accept').isVisible().catch(() => false))) {
      await page.getByTestId('dialogue-accept').click();
      return;
    }
    if (await page.getByTestId('dialogue-close').isVisible().catch(() => false)) {
      await page.getByTestId('dialogue-close').click();
      return;
    }
    await page.getByTestId('dialogue-next').click();
  }
}

export async function answerQuestion(page: Page, correct: boolean): Promise<void> {
  await page.getByTestId('question-text').waitFor();
  await page.locator(`[data-testid^="choice-"][data-correct="${correct}"]`).first().click();
  await page.getByTestId('question-submit').click();
  await page.getByTestId('feedback').waitFor();
  await page.getByTestId('question-continue').click();
}
