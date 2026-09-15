import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { CURRENT_SAVE_VERSION } from '@application/persistence/json-save-codec';
import { PROGRESS_SCHEMA_ID } from '@application/persistence/progress-document';
import { text } from '@ui/copy';

import { ensureCharacter } from './front-door';
import { finishedSave, seed, type SeededQuest } from './saves';
import { START_LEVEL } from './start-level';

/**
 * `TN-SAVE-06` on the shipped build: a save carried away in a file and brought
 * back (ADR-0046).
 *
 * The file is a real download and the import is a real file chooser. The round
 * trip is judged by the only witness that cannot be fooled by a screen: the game
 * saves a second file after the import, and its character, its levels — the
 * stamp in them — and its settings must be the first file's. A screen that said
 * "Your game is back." over a half-applied save would fail here.
 *
 * "A browser that had forgotten the game" is made by clearing the origin's
 * storage from a page of the same origin that runs no game, so no open
 * connection can hold the database: `manifest.json`, which the build serves as
 * JSON.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

interface LevelFile {
  readonly characters: readonly { readonly questId?: string }[];
}

/** The start level's own quest, so a finished save puts its stamp in the passport. */
const START_QUEST: SeededQuest = ((): SeededQuest => {
  const level = json<LevelFile>(`content/levels/${START_LEVEL}.json`);
  const questId = level.characters.find((character) => character.questId !== undefined)?.questId;
  if (questId === undefined) {
    throw new Error(`content/levels/${START_LEVEL}.json places no character with a quest to finish.`);
  }
  return json<SeededQuest>(`content/quests/${questId}.json`);
})();

interface SaveDocument {
  readonly version: number;
  readonly $schema: string;
  readonly character: unknown;
  readonly settings: unknown;
  readonly levels: readonly { readonly levelId: string; readonly stampEarnedAt: string | null }[];
}

interface SavedFile {
  readonly path: string;
  readonly name: string;
  readonly document: SaveDocument;
}

async function openSettings(page: Page): Promise<Locator> {
  await page.locator('[data-testid="title-settings"]').click();
  const settings = page.locator('[data-testid="settings-screen"]');
  await expect(settings).toBeVisible();
  return settings;
}

/** "Save to a file" from Settings on the title screen, and the file it made. */
async function saveToAFile(page: Page, as: string): Promise<SavedFile> {
  const settings = await openSettings(page);
  const downloading = page.waitForEvent('download');
  await settings.locator('[data-testid="save-export"]').click();
  const download = await downloading;
  const path = test.info().outputPath(as);
  await download.saveAs(path);
  const document = JSON.parse(readFileSync(path, 'utf8')) as SaveDocument;
  await settings.locator('[data-testid="settings-close"]').click();
  await expect(settings).toBeHidden();
  return { path, name: download.suggestedFilename(), document };
}

/** "Open a file" from Settings, choosing `file` in the picker. */
async function openAFile(
  settings: Locator,
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const choosing = page.waitForEvent('filechooser');
  await settings.locator('[data-testid="save-import"]').click();
  await (await choosing).setFiles(file);
}

/** Clear this origin's saves from a page of the origin that holds no connection to them. */
async function forgetTheGame(page: Page): Promise<void> {
  await page.goto('./manifest.json');
  await page.evaluate(async () => {
    window.localStorage.clear();
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(
        (database) =>
          new Promise<void>((resolve) => {
            if (database.name === undefined) {
              resolve();
              return;
            }
            const request = indexedDB.deleteDatabase(database.name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  });
}

const RETURNING = '[data-testid="title-choose-level"], [data-testid="title-continue"]';

test.describe('a save carried away in a file (TN-SAVE-06)', () => {
  test('saved from Settings, it brings the same game back to a browser that had forgotten it', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await seed(page, finishedSave(START_QUEST));
    await page.goto('./');
    await ensureCharacter(page);

    const saved = await saveToAFile(page, 'first.json');
    expect(saved.name).toMatch(/^truenorth-progress-\d{4}-\d{2}-\d{2}\.json$/u);
    expect(saved.document.version).toBe(CURRENT_SAVE_VERSION);
    expect(saved.document.$schema).toBe(PROGRESS_SCHEMA_ID);
    expect(saved.document.character, 'the character made in the creator is not in the file').not.toBeNull();
    expect(
      saved.document.levels.find((level) => level.levelId === START_LEVEL)?.stampEarnedAt ?? null,
      `the ${START_LEVEL} stamp is not in the file`,
    ).not.toBeNull();

    await forgetTheGame(page);
    await page.goto('./');
    /* The premise: this browser has no game now, so the title offers a first run. */
    await expect(page.locator('[data-testid="title-play"]')).toBeVisible();

    const settings = await openSettings(page);
    await openAFile(settings, page, saved.path);

    const confirm = page.locator('[data-testid="save-import-confirm"]');
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveAttribute('role', 'alertdialog');
    await expect(confirm).toContainText(text('en', 'save.import.confirm'));
    await confirm.locator('[data-testid="save-import-replace"]').click();

    const done = page.locator('[data-testid="save-import-done"]');
    await expect(done).toBeVisible();
    await expect(done).toContainText(text('en', 'save.import.done'));
    await done.locator('[data-testid="save-import-continue"]').click();

    /* The game starts again from the file: a returning player, not a first run. */
    await expect(page.locator('[data-testid="title-play"]')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator(RETURNING).first()).toBeVisible();

    const again = await saveToAFile(page, 'second.json');
    expect(again.document.character).toEqual(saved.document.character);
    expect(again.document.levels).toEqual(saved.document.levels);
    expect(again.document.settings).toEqual(saved.document.settings);
  });

  test('a file that is not a save is refused in words, and the game is left as it was', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto('./');
    await ensureCharacter(page);
    const before = await saveToAFile(page, 'before.json');

    const settings = await openSettings(page);
    const message = settings.locator('[data-testid="save-import-error"]');
    const confirm = page.locator('[data-testid="save-import-confirm"]');

    await openAFile(settings, page, {
      name: 'shopping-list.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ milk: 2, bread: 1 })),
    });
    await expect(message).toHaveText(
      `${text('en', 'save.import.error')} ${text('en', 'save.import.error.help')}`,
    );
    await expect(confirm).toHaveCount(0);

    /* A different sentence, so the wait below is for this file and not the last. */
    await openAFile(settings, page, {
      name: 'holiday.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(1_048_577, 32),
    });
    await expect(message).toHaveText(
      `${text('en', 'save.import.tooBig')} ${text('en', 'save.import.error.help')}`,
    );
    await expect(confirm).toHaveCount(0);

    await settings.locator('[data-testid="settings-close"]').click();
    await expect(settings).toBeHidden();

    const after = await saveToAFile(page, 'after.json');
    expect(after.document.character).toEqual(before.document.character);
    expect(after.document.levels).toEqual(before.document.levels);
    expect(after.document.settings).toEqual(before.document.settings);

    await page.reload();
    await expect(page.locator(RETURNING).first()).toBeVisible();
  });
});
