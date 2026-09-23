import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { sharesProposition } from '@application/content/proposition';
import { hasCopyRow, text } from '@ui/copy';

import { closeTheReaderIfItOpens } from './after-the-card';
import { holdToMove } from './held-drive';
import { walkInLegs } from './walk';

/**
 * A stop with no task running asks only what it told, or nothing, and never one
 * question twice in a visit. ADR-0048.
 *
 * The second live-site audit rode the Prairies with the task declined. The grain
 * bins asked about Québec's referendums; the combine harvester asked the same
 * question again, tagged "You have seen this question before"; the container
 * car asked about Bombardier. `tests/unit/contracts/a-stop-outside-a-task-asks-only-what-it-told.test.ts`
 * proves the rule for every landmark over the real bank. This file rides the
 * shipped build: the train, the guide declined, and every stop engaged.
 *
 * What "related" means is worked out from `content/`, not typed: a verified
 * question in the level's subject whose `source.quote` shares a proposition with
 * the landmark's own (ADR-0028 §4, `@application/content/proposition`).
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEVEL_ID = 'prairie-rail';

interface PoiFile {
  readonly id: string;
  readonly position: { readonly x: number };
  readonly fact?: { readonly source?: { readonly quote?: string } | null } | null;
}
interface LevelFile {
  readonly id: string;
  readonly subject: string;
  readonly pois: readonly PoiFile[];
}
interface QuestFile {
  readonly levelId: string;
  readonly giver: string;
  readonly declinedLine?: Line;
}
interface Line {
  readonly text: { readonly en: string };
  readonly fact: {
    readonly factual: boolean;
    readonly source: { readonly sourceHash: string } | null;
    readonly verification: { readonly status: string; readonly sourceHash: string; readonly evidence: string } | null;
  };
}
interface QuestionFile {
  readonly id?: string;
  readonly subject?: string;
  readonly prompt?: { readonly en?: string };
  readonly source?: { readonly quote?: string };
  readonly verification?: { readonly status?: string };
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const LEVEL = json<LevelFile>(`content/levels/${LEVEL_ID}.json`);

const QUEST = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => json<QuestFile>(`content/quests/${name}`))
  .find((quest) => quest.levelId === LEVEL_ID);
if (QUEST === undefined) throw new Error(`content/quests/ offers no task on ${LEVEL_ID}, so there is none to decline`);

const promptFor = (id: string, fallback: string): string => {
  const key = `hud.interact.${id}`;
  return hasCopyRow(key) ? text('en', key as Parameters<typeof text>[1]) : text('en', fallback as Parameters<typeof text>[1]);
};
const GIVER_PROMPT = promptFor(QUEST.giver, 'hud.interact.npc');

/** Spoken when a verifier allows it, as `quest-moments.spec.ts` reads it. */
const granted = (line: Line | undefined): line is Line =>
  line !== undefined &&
  (line.fact.factual !== true ||
    (line.fact.verification !== null &&
      line.fact.source !== null &&
      line.fact.verification.status === 'verified' &&
      line.fact.verification.sourceHash === line.fact.source.sourceHash &&
      line.fact.verification.evidence.trim().length > 0));

const QUESTIONS: readonly QuestionFile[] = readdirSync(`${REPO_ROOT}content/questions`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) =>
    readdirSync(`${REPO_ROOT}content/questions/${entry.name}`)
      .filter((name) => name.endsWith('.json'))
      .map((name) => json<QuestionFile>(`content/questions/${entry.name}/${name}`)),
  );

/** Collapsed as the eye reads it, so a wrapped prompt still matches its row. */
const words = (value: string | null | undefined): string => (value ?? '').replace(/\s+/gu, ' ').trim();

/** What the HUD offers for a landmark already engaged in this sitting. */
const DONE_PROMPT = text('en', 'hud.interact.done');

/** Every landmark the train stops at, in the order it reaches them. */
const STOPS = [...LEVEL.pois]
  .sort((a, b) => a.position.x - b.position.x)
  .map((poi) => {
    const quote = poi.fact?.source?.quote ?? '';
    const related = QUESTIONS.filter(
      (question) =>
        question.subject === LEVEL.subject &&
        question.verification?.status === 'verified' &&
        typeof question.source?.quote === 'string' &&
        quote !== '' &&
        sharesProposition(question.source.quote, quote),
    ).map((question) => words(question.prompt?.en));
    const key = `hud.interact.${poi.id}`;
    if (!hasCopyRow(key)) {
      throw new Error(`${poi.id} has no prompt of its own, so this walk cannot tell its stop from another`);
    }
    return { id: poi.id, prompt: promptFor(poi.id, 'hud.interact.poi'), related };
  });

/**
 * What follows a landmark's card: a question, or the level running again with
 * none. One hold covers the card and whatever follows it, so the level running
 * again with no question on screen is the stop having asked nothing.
 */
async function whatFollows(page: Page): Promise<'asked' | 'nothing' | null> {
  return Promise.race([
    page
      .getByTestId('question-card')
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(() => 'asked' as const)
      .catch(() => null),
    page
      .waitForSelector('html[data-tn-paused="false"]', { timeout: 60_000 })
      .then(() => 'nothing' as const)
      .catch(() => null),
  ]);
}

/**
 * Engage the landmark just left again, when its offer is still in reach.
 *
 * The train goes on once a card closes, so the offer may already be gone; that
 * is not a failure, and this answers `false`. When it opens, the card is closed
 * and `true` says the question half is next.
 */
async function engageAgain(page: Page): Promise<boolean> {
  const offer = page.getByTestId('interact-prompt');
  const poi = page.getByTestId('poi-card');
  try {
    if (!(await offer.isVisible()) || words(await offer.textContent()) !== DONE_PROMPT) return false;
    await offer.click({ timeout: 2_000 });
    await poi.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    if (!(await poi.isVisible())) return false;
  }
  await page.getByTestId('poi-card-close').click();
  await closeTheReaderIfItOpens(page);
  return true;
}

/** Ride on, pressing again at every stop, until the HUD offers `prompt`. */
async function rideTo(page: Page, prompt: string): Promise<boolean> {
  const found = await walkInLegs(
    page,
    'ArrowRight',
    (legMs) =>
      page
        .waitForFunction(
          (want: string) => {
            const offer = document.querySelector('[data-testid="interact-prompt"]');
            return (
              offer !== null &&
              (offer as HTMLElement).checkVisibility() &&
              (offer.textContent ?? '').replace(/\s+/gu, ' ').trim() === want
            );
          },
          prompt,
          { timeout: legMs, polling: 'raf' },
        )
        .then(() => true)
        .catch(() => null),
    { budgetMs: 180_000, legMs: 4_000 },
  );
  return found === true;
}

/*
 * A player who holds a control to move (ADR-0058): this walk is made of legs
 * that hold and let go, and what it asserts is what a stop offers, not what
 * carried the player to it.
 */
test.beforeEach(async ({ page }) => {
  await holdToMove(page);
});

test.describe('a stop with no task running asks only what it told (ADR-0048)', () => {
  test('on the Prairies with the task declined, each stop asks about itself or nothing, and nothing twice', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(`./?e2e=1&level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');

    /* The train drives itself to the guide and rests there, offering the task. */
    const prompt = page.getByTestId('interact-prompt');
    await expect(prompt).toHaveText(GIVER_PROMPT, { timeout: 120_000 });
    await prompt.click();
    await page.getByTestId('dialogue-decline').click();

    const dialogue = page.getByTestId('dialogue');
    if (granted(QUEST.declinedLine)) {
      await expect(page.getByTestId('dialogue-text')).toHaveText(QUEST.declinedLine.text.en);
      await page.getByTestId('dialogue-next').click();
    }
    await expect(dialogue).toBeHidden();
    await expect(page.getByTestId('hud-quest-tracker')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    const poi = page.getByTestId('poi-card');
    const question = page.getByTestId('question-card');
    const asked: string[] = [];

    for (const stop of STOPS) {
      expect(await rideTo(page, stop.prompt), `the train never stopped at ${stop.id}`).toBe(true);
      await prompt.click();
      await expect(poi).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('poi-card-close').click();
      await closeTheReaderIfItOpens(page);

      const outcome = await whatFollows(page);
      expect(outcome, `${stop.id}: neither a question nor the level came back`).not.toBeNull();
      if (stop.related.length > 0) {
        /* A fresh save, so nothing it told has been answered: it must ask. */
        expect(outcome, `${stop.id} tells a sentence a question rests on, and asked nothing`).toBe('asked');
      }

      if (outcome === 'asked') {
        const said = words(await page.getByTestId('question-prompt').textContent());
        expect(
          stop.related,
          `${stop.id} asked "${said}", which rests on nothing the stop told`,
        ).toContain(said);
        expect(asked, `"${said}" was asked twice in one visit`).not.toContain(said);
        asked.push(said);

        for (let n = 0; n < 5 && (await question.isVisible()); n += 1) {
          await page.getByTestId('option-0').click();
          await page.getByTestId('question-next').click();
        }
        await expect(question).toBeHidden();
        await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false', { timeout: 15_000 });

        /* Engaged again in the same visit, it has nothing left to ask. */
        if (await engageAgain(page)) {
          expect(await whatFollows(page), `${stop.id} asked again what this visit answered`).toBe('nothing');
          await expect(question).toBeHidden();
        }
      } else {
        await expect(question, `${stop.id} asked after the level came back`).toBeHidden();
      }

      /* Still no task: nothing here is counting toward one. */
      await expect(page.getByTestId('hud-quest-tracker')).toBeHidden();
    }

    expect(
      errors.filter((line) => line.includes('no question could be drawn')),
      'a stop with nothing to ask was reported as a failure',
    ).toEqual([]);
  });
});
