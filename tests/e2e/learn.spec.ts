import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { text } from '@ui/copy';

import { seed, settingsSave } from './saves';

/**
 * Learn, end to end over the built game (`TN-LEARN-01`, `TN-LEARN-02`,
 * `TN-LEARN-07`): the title's door, a chapter, a lesson, a passage — in
 * English and in French — and the one chunk a chapter costs.
 *
 * The expected words are read from the lesson document on disk, so this spec
 * follows the corpus rather than pinning a sentence somebody will re-word.
 */

interface LessonFile {
  readonly id: string;
  readonly order: number;
  readonly title: { readonly en: string; readonly fr: string };
  readonly passages: readonly {
    readonly id: string;
    readonly text: { readonly en: string; readonly fr: string };
  }[];
}

const CHAPTER = 'canadas-history';
const DIR = fileURLToPath(new URL(`../../content/lessons/${CHAPTER}`, import.meta.url));
const FIRST: LessonFile = readdirSync(DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8')) as LessonFile)
  .sort((a, b) => a.order - b.order)[0] as LessonFile;

for (const locale of ['en', 'fr'] as const) {
  test(`Learn opens a chapter, a lesson and a passage in ${locale === 'en' ? 'English' : 'French'}`, async ({
    page,
  }) => {
    await seed(page, settingsSave({ locale }));

    const lessonChunks: string[] = [];
    page.on('request', (request) => {
      const match = /\/assets\/(lessons-[a-z-]+)-[\w-]+\.js$/.exec(request.url());
      if (match?.[1] !== undefined) lessonChunks.push(match[1]);
    });

    await page.goto('./');
    const door = page.locator('[data-testid="title-learn"]');
    await expect(door).toHaveText(text(locale, 'learn.open'));
    await door.click();

    const learn = page.locator('[data-testid="learn"]');
    await expect(learn).toBeVisible();
    await expect(learn).toHaveAttribute('role', 'dialog');
    await expect(learn).toHaveAccessibleName(text(locale, 'learn.title'));
    const chapters = page.locator('[data-testid="learn-chapters"] button');
    await expect(chapters.first()).toHaveText(
      text(locale, 'learn.chapter.rights-and-responsibilities-of-citizenship'),
    );
    expect(lessonChunks, 'opening Learn downloaded a lesson').toEqual([]);

    await page.locator(`[data-testid="learn-chapter-${CHAPTER}"]`).click();
    await expect(page.locator('[data-testid="learn-title"]')).toHaveText(
      text(locale, `learn.chapter.${CHAPTER}`),
    );
    await expect(page.locator(`[data-testid="learn-lesson-${FIRST.id}"]`)).toHaveText(
      FIRST.title[locale],
    );
    expect(lessonChunks).toEqual([`lessons-${CHAPTER}`]);

    await page.locator(`[data-testid="learn-lesson-${FIRST.id}"]`).click();
    const reader = page.locator('[data-testid="lesson-reader"]');
    await expect(reader).toBeVisible();
    await expect(reader).toHaveAttribute('lang', locale);
    await expect(page.locator('[data-testid="lesson-reader-title"]')).toHaveText(FIRST.title[locale]);
    const first = FIRST.passages[0];
    expect(first).toBeDefined();
    await expect(page.locator('[data-testid="lesson-reader-passage"]').first()).toHaveText(
      first?.text[locale] ?? '',
    );
    await expect(page.locator('[data-testid="lesson-reader-passage"]')).toHaveCount(
      FIRST.passages.length,
    );

    /* Back, one step at a time, to the title's door. */
    await page.locator('[data-testid="lesson-reader-close"]').click();
    await expect(page.locator(`[data-testid="learn-lesson-${FIRST.id}"]`)).toBeFocused();
    await page.locator('[data-testid="learn-back"]').click();
    await expect(page.locator(`[data-testid="learn-chapter-${CHAPTER}"]`)).toBeFocused();
    await page.locator('[data-testid="learn-back"]').click();
    await expect(learn).toBeHidden();
    await expect(door).toBeFocused();
  });
}
