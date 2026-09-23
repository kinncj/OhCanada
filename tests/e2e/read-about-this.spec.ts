import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { passagesSharingProposition } from '@application/content/question-passages';
import type { LessonDocument, QuestionDocument } from '@application/ports';
import { isVerified } from '@domain/entities/question';
import { text } from '@ui/copy';

import { grantsPassage } from '../../app/bootstrap/verified-passages';

import { missedQuestionSave, seed } from './saves';

/**
 * "Read about this" on the shipped build — `docs/stories/TN-TEACHBACK-read-about-this.md`,
 * ADR-0070.
 *
 * A player answers a real question from the real bank in Study and opens the
 * passage of the guide it rests on, found by the game's own lookup in the lazy
 * lesson catalogue — in English and in French, at 100 % and 200 % text. The
 * question is chosen here, off the disk, the way the game would find its passage
 * (the proposition rule, the shippable filter, the verifier's grant), and put in
 * front of the player through the shipped draw: a save in which it was missed
 * three days ago makes it the first card of a drill.
 *
 * Screenshots go to `TEACH_BACK_SHOTS` when it is set, for a person to look at;
 * the assertions do not depend on them.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SHOTS = process.env['TEACH_BACK_SHOTS'];

const readJson = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;
const dirsIn = (dir: string): string[] =>
  readdirSync(`${REPO_ROOT}${dir}`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
const filesIn = (dir: string): string[] =>
  readdirSync(`${REPO_ROOT}${dir}`)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `${dir}/${name}`);

const lessons = dirsIn('content/lessons').flatMap((chapter) =>
  filesIn(`content/lessons/${chapter}`).map((path) => readJson<LessonDocument>(path)),
);

/** The first verified question, in bank order, that has a passage to read. */
const TAUGHT = ((): { question: QuestionDocument; lesson: LessonDocument } => {
  for (const subject of dirsIn('content/questions')) {
    for (const path of filesIn(`content/questions/${subject}`)) {
      const question = readJson<QuestionDocument>(path);
      if (!isVerified(question)) continue;
      const found = passagesSharingProposition(lessons, question.source.quote, grantsPassage);
      const lesson = found[0]?.lesson;
      if (lesson !== undefined) return { question, lesson };
    }
  }
  throw new Error('no verified question has a readable passage: this spec has nothing to open');
})();

test.describe('"Read about this", on the shipped build', () => {
  for (const locale of ['en', 'fr'] as const) {
    for (const scale of [1, 2] as const) {
      test(`${locale} ${String(scale * 100)} %: answer a question in Study and read its passage`, async ({
        page,
      }) => {
        await seed(
          page,
          missedQuestionSave({ questionId: String(TAUGHT.question.id), locale, textScale: scale }),
        );
        await page.goto('./');
        await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
        await page.locator('[data-testid="title-study"]').click();
        await page.locator('[data-testid="study-start"]').click();

        const card = page.locator('[data-testid="question-card"]');
        await expect(card).toBeVisible();
        await expect(card.locator('[data-testid="question-prompt"]')).toHaveText(
          TAUGHT.question.prompt[locale],
        );

        /* Not before the answer. */
        const readAbout = card.locator('[data-testid="question-read-about"]');
        await expect(readAbout).toBeHidden();

        await card.locator('[data-testid="option-0"]').click();
        await expect(card.locator('[data-testid="question-feedback"]')).toBeVisible();
        await expect(readAbout).toBeVisible();
        await expect(readAbout).toHaveText(text(locale, 'card.readAbout'));
        const box = await readAbout.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        if (SHOTS !== undefined) {
          mkdirSync(SHOTS, { recursive: true });
          await readAbout.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${SHOTS}/card-${locale}-${String(scale * 100)}.png` });
        }

        await readAbout.click();
        const reader = page.locator('[data-testid="lesson-reader"]');
        await expect(reader).toBeVisible();
        await expect(reader).toHaveAttribute('lang', locale);
        await expect(reader.locator('[data-testid="lesson-reader-title"]')).toHaveText(
          TAUGHT.lesson.title[locale],
        );
        await expect(reader.locator('[data-testid="lesson-reader-passage"]').first()).toBeVisible();
        if (SHOTS !== undefined) {
          await page.screenshot({ path: `${SHOTS}/reader-${locale}-${String(scale * 100)}.png` });
        }

        /* Closing returns to the card, with focus on the control that opened it. */
        await page.keyboard.press('Escape');
        await expect(reader).toBeHidden();
        await expect(card).toBeVisible();
        await expect(readAbout).toBeFocused();
      });
    }
  }
});
