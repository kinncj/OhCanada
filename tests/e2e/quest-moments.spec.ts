import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { defaultSettings } from '@domain/entities/player';
import { newProgress, withQuestState, withStamp } from '@domain/entities/progress';
import type { EpochMillis, LevelId, LocaleCode, QuestId } from '@domain/ids';
import { text } from '@ui/copy';

import { START_LEVEL } from './start-level';

/**
 * What a quest giver says at the three moments a step cannot speak for, on the
 * shipped build: after "Not now", on a return mid-quest, and after the quest is
 * complete (`TN-DIALOGUE-what-a-quest-giver-says.md`).
 *
 * ## Why this file exists
 *
 * Forty authored, verified lines — `declinedLine`, `reminderLine`, `afterLine`
 * and `doneLine` on every quest — were read by nothing in the app. A player who
 * came back to a finished giver was read the quest's present-tense summary; a
 * player who declined heard nothing. Some after-lines teach a fact, which makes
 * them the natural scenario: a finished giver, engaged, says something true about
 * Canada that the player has not been told yet.
 *
 * ## How a finished quest is reached without playing it
 *
 * Walking a quest to the end takes minutes on SwiftShader and is already
 * `level-quest.spec.ts`'s job. Here the save is **written by the game's own
 * functions** — `newProgress`, `withQuestState`, `withStamp`,
 * `toProgressSnapshot` and the JSON save codec — and put where ADR-0026 says an
 * existing save is carried from: `localStorage`, before the first boot, into an
 * empty IndexedDB. Nothing about the save's format is typed out here, so a
 * format change moves this file with it rather than breaking it silently.
 *
 * ## What is read rather than typed
 *
 * The lines, the giver, the landmark's name and whether a line is allowed to be
 * said, all from `content/`. When a verifier refuses a line, the matching
 * scenario asserts the silence instead.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Text {
  readonly en: string;
  readonly fr: string;
}

interface Line {
  readonly speaker: string;
  readonly text: Text;
  readonly fact: {
    readonly factual: boolean;
    readonly source: { readonly sourceHash: string } | null;
    readonly verification: {
      readonly status: string;
      readonly sourceHash: string;
      readonly evidence: string;
    } | null;
  };
}

interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly giver: string;
  readonly summary: Text;
  readonly steps: readonly {
    readonly kind: string;
    readonly count?: number;
    readonly prompt: Text;
  }[];
  readonly declinedLine?: Line;
  readonly reminderLine?: Line;
  readonly afterLine?: Line;
  /** Not said in a dialog: drawn on the completion card, under "Task done!" only. */
  readonly doneLine?: Line;
}

interface LevelFile {
  readonly id: string;
  readonly characters: readonly { readonly characterId: string; readonly questId?: string }[];
  readonly pois: readonly { readonly id: string; readonly name: Text; readonly questId?: string }[];
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

/** ADR-0003's three conditions, from the document's own fields. */
const granted = (line: Line | undefined): line is Line =>
  line !== undefined &&
  (line.fact.factual !== true ||
    (line.fact.verification !== null &&
      line.fact.source !== null &&
      line.fact.verification.status === 'verified' &&
      line.fact.verification.sourceHash === line.fact.source.sourceHash &&
      line.fact.verification.evidence.trim().length > 0));

const LEVELS: readonly LevelFile[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => json<LevelFile>(`content/levels/${name}`));

/** The level the game opens on first, then the rest, so the natural case is tried first. */
const IN_ORDER = [
  ...LEVELS.filter((level) => level.id === START_LEVEL),
  ...LEVELS.filter((level) => level.id !== START_LEVEL),
];

const questOf = (id: string): QuestFile => json<QuestFile>(`content/quests/${id}.json`);

/** The level the game opens on, and the character who gives its quest. */
const START = IN_ORDER.find((level) => level.id === START_LEVEL);
const START_GIVER = START?.characters.find((character) => character.questId !== undefined);
const START_QUEST = START_GIVER?.questId === undefined ? undefined : questOf(START_GIVER.questId);

/**
 * A landmark that **gives** a quest (ADR-0029), found rather than named.
 *
 * Not merely a landmark with a `questId`: the level schema lets a quest's visit
 * target carry one too, and that landmark gives nothing. The giver is the one
 * whose id the quest names as its `giver`.
 */
const LANDMARK_GIVERS = IN_ORDER.flatMap((level) =>
  level.pois.flatMap((poi) => {
    if (poi.questId === undefined) return [];
    const quest = questOf(poi.questId);
    return quest.giver === poi.id ? [{ level, poi, quest }] : [];
  }),
);
const LANDMARK_LEVEL = LANDMARK_GIVERS[0]?.level;
const LANDMARK = LANDMARK_GIVERS[0]?.poi;
const LANDMARK_QUEST = LANDMARK_GIVERS[0]?.quest;

function characterName(id: string): Text {
  return json<{ readonly name: Text }>(`content/characters/${id}.json`).name;
}

/* --------------------------------------------------------------- the save --- */

const codec = createJsonSaveCodec({ maxImportBytes: 10_000_000, migrations: SAVE_MIGRATIONS });

/** A save in which this level's quest is complete and its stamp earned, as the game writes one. */
function finishedSave(quest: QuestFile): string {
  const now = Date.now() as EpochMillis;
  const level = quest.levelId as LevelId;
  let progress = newProgress(defaultSettings('en' as LocaleCode), [level]);
  progress = withQuestState(progress, level, {
    questId: quest.id as QuestId,
    status: 'completed',
    stepIndex: quest.steps.length - 1,
    stepProgress: 0,
    updatedAt: now,
  });
  progress = withStamp(progress, level, now);
  return encodeSave(progress, now);
}

/**
 * A save one answer short of finishing this level's quest: accepted, on its last
 * step, with that step's count all but met — and **no stamp**, because the
 * answer that finishes the quest is what earns it. That is the route whose card
 * reads "Task done!", which is the only card a quest's closing line is drawn on.
 */
function oneAnswerFromDoneSave(quest: QuestFile): string {
  const lastIndex = quest.steps.length - 1;
  const last = quest.steps[lastIndex];
  if (last?.kind !== 'answer') {
    throw new Error(
      `${quest.id} does not end on an answer step, so no single answer can finish it. ` +
        'Point this scenario at a quest that does.',
    );
  }
  const now = Date.now() as EpochMillis;
  const level = quest.levelId as LevelId;
  const progress = withQuestState(newProgress(defaultSettings('en' as LocaleCode), [level]), level, {
    questId: quest.id as QuestId,
    status: 'active',
    stepIndex: lastIndex,
    stepProgress: Math.max(1, last.count ?? 1) - 1,
    updatedAt: now,
  });
  return encodeSave(progress, now);
}

/** The save as the game writes one: snapshot, then the JSON codec. */
function encodeSave(progress: ReturnType<typeof newProgress>, now: EpochMillis): string {
  const snapshot = toProgressSnapshot(progress, { version: codec.version, updatedAt: now });
  if (!snapshot.ok) throw new Error(`the seeded save is not a save: ${snapshot.error.message}`);
  const encoded = codec.encode(snapshot.value);
  if (!encoded.ok) throw new Error(`the seeded save would not encode: ${encoded.error.message}`);
  return encoded.value;
}

/**
 * Put a save where an older build would have left one, before the game boots.
 *
 * Once per tab: an init script runs on every navigation, and a save written
 * again after the game has carried the first one into IndexedDB would be a
 * second, stale copy the store keeps rather than reads.
 */
async function seed(page: Page, bytes: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.sessionStorage.getItem('tn-e2e-seeded') !== null) return;
      window.sessionStorage.setItem('tn-e2e-seeded', '1');
      window.localStorage.setItem(key, value);
    },
    { key: PROGRESS_STORAGE_KEY, value: bytes },
  );
}

/* --------------------------------------------------------------- the walk --- */

test.describe.configure({ mode: 'serial', timeout: 240_000 });

async function openLevel(page: Page, level: string): Promise<void> {
  await page.goto(`./?level=${level}`);
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
}

/**
 * Walk right, watching the HUD in the page, until the prompt reads `wanted`.
 * The same in-page watching `level-quest.spec.ts` uses, for the same reason: a
 * round trip per sample walks straight past a narrow reach band.
 */
async function walkUntilThePromptReads(page: Page, wanted: string): Promise<string | null> {
  return walkRightUntil(page, { wanted, ignore: [] });
}

/**
 * Walk right until the HUD offers `wanted` — or, with `wanted` null, anything
 * not in `ignore`. `'card'` when the level ended first, `null` when time ran out.
 */
async function walkRightUntil(
  page: Page,
  want: { readonly wanted: string | null; readonly ignore: readonly string[] },
): Promise<string | null> {
  await page.keyboard.down('ArrowRight');
  try {
    return await page.evaluate(
      async ({ target, skip, budget }) => {
        const deadline = performance.now() + budget;
        while (performance.now() < deadline) {
          const card = document.querySelector('[data-testid="quest-complete-card"]');
          if (card !== null && (card as HTMLElement).checkVisibility()) return 'card';
          const prompt = document.querySelector('[data-testid="interact-prompt"]');
          if (prompt !== null && (prompt as HTMLElement).checkVisibility()) {
            const offered = prompt.textContent ?? '';
            if (target === null ? !skip.includes(offered) : offered === target) return offered;
          }
          await new Promise((resolve) => {
            requestAnimationFrame(() => {
              resolve(null);
            });
          });
        }
        return null;
      },
      { target: want.wanted, skip: [...want.ignore], budget: 40_000 },
    );
  } finally {
    await page.keyboard.up('ArrowRight');
  }
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Focus is somewhere real after a dialog closes — never the body (`TN-DIALOGUE-04`). */
const focusIsNotOnTheBody = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.activeElement !== null && document.activeElement !== document.body);

const giverPrompt = (giver: string): string =>
  text('en', `hud.interact.${giver}` as Parameters<typeof text>[1]);

/* ------------------------------------------------------------- the moments --- */

test.describe('a quest giver speaks at the moments a step cannot', () => {
  test('a finished giver says its after-line, every time it is engaged', async ({ page }) => {
    expect(START_QUEST, `${START_LEVEL} places no character with a quest`).toBeDefined();
    if (START_QUEST === undefined || START_GIVER === undefined) return;

    await seed(page, finishedSave(START_QUEST));
    await openLevel(page, START_LEVEL);

    const offered = await walkUntilThePromptReads(page, giverPrompt(START_QUEST.giver));
    expect(
      offered,
      `walking right in ${START_LEVEL} never reached "${START_QUEST.giver}", whose quest the save ` +
        'marks complete. If the after-line is refused, the giver is rightly offered no prompt; ' +
        'see the census for that case.',
    ).toBe(giverPrompt(START_QUEST.giver));
    expect(granted(START_QUEST.afterLine), `${START_QUEST.id}'s afterLine is not granted`).toBe(true);
    if (!granted(START_QUEST.afterLine)) return;

    const dialogue = page.getByTestId('dialogue');
    const name = characterName(START_QUEST.giver).en;

    for (const time of ['first', 'second'] as const) {
      await page.getByTestId('interact-prompt').click();
      await expect(dialogue, `the ${time} engagement opened nothing`).toBeVisible();
      await expect(dialogue).toHaveAccessibleName(name);
      await expect(page.getByTestId('dialogue-speaker')).toHaveText(name);
      await expect(page.getByTestId('dialogue-text')).toHaveText(START_QUEST.afterLine.text.en);
      /* Not the summary read back, and not a second offer. */
      await expect(page.getByTestId('dialogue-text')).not.toContainText(START_QUEST.summary.en);
      await expect(page.getByTestId('dialogue-accept')).toBeHidden();
      await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

      await page.getByTestId('dialogue-next').click();
      await expect(dialogue).toBeHidden();
      await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
      expect(await focusIsNotOnTheBody(page), 'focus fell to the body').toBe(true);
    }

    await expect(page.locator('main canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  test('"Not now" is answered in the quest’s own words, and the offer stays open', async ({
    page,
  }) => {
    if (START_QUEST === undefined) return;
    await openLevel(page, START_LEVEL);

    expect(await walkUntilThePromptReads(page, giverPrompt(START_QUEST.giver))).toBe(
      giverPrompt(START_QUEST.giver),
    );
    await page.getByTestId('interact-prompt').click();
    await page.getByTestId('dialogue-decline').click();

    const dialogue = page.getByTestId('dialogue');
    if (granted(START_QUEST.declinedLine)) {
      await expect(dialogue, 'declining was answered with silence').toBeVisible();
      await expect(dialogue).toHaveAccessibleName(characterName(START_QUEST.giver).en);
      await expect(page.getByTestId('dialogue-text')).toHaveText(START_QUEST.declinedLine.text.en);
      await expect(page.getByTestId('dialogue-accept')).toBeHidden();
      await expect(page.getByTestId('hud-quest-tracker')).toBeHidden();
      await page.getByTestId('dialogue-next').click();
    }

    await expect(dialogue).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
    expect(await focusIsNotOnTheBody(page), 'focus fell to the body').toBe(true);

    await page.getByTestId('interact-prompt').click();
    await expect(page.getByTestId('dialogue-accept'), 'the task was never offered again').toBeVisible();
  });

  test('coming back mid-quest gives the reminder, and the tracker keeps the step', async ({
    page,
  }) => {
    if (START_QUEST === undefined) return;
    const step = START_QUEST.steps[1];
    expect(step, `${START_QUEST.id} has no step after its offer`).toBeDefined();
    if (step === undefined) return;

    await openLevel(page, START_LEVEL);
    expect(await walkUntilThePromptReads(page, giverPrompt(START_QUEST.giver))).toBe(
      giverPrompt(START_QUEST.giver),
    );
    await page.getByTestId('interact-prompt').click();
    await page.getByTestId('dialogue-accept').click();
    await expect(page.getByTestId('dialogue')).toBeHidden();

    const tracker = page.getByTestId('hud-quest-tracker');
    const stepStem = (step.prompt.en.split('(')[0] ?? step.prompt.en).trim();
    await expect(tracker).toContainText(stepStem);

    /* Still standing by the giver, whose prompt now says it was engaged. */
    await page.getByTestId('interact-prompt').click();
    const dialogue = page.getByTestId('dialogue');
    if (granted(START_QUEST.reminderLine)) {
      await expect(dialogue).toBeVisible();
      await expect(page.getByTestId('dialogue-text')).toHaveText(START_QUEST.reminderLine.text.en);
      /* Said instead of the step prompt, never beside it: the tracker has it. */
      await expect(page.getByTestId('dialogue-text')).not.toContainText(stepStem);
      await expect(page.getByTestId('dialogue-accept')).toBeHidden();
      await page.getByTestId('dialogue-next').click();
      await expect(dialogue).toBeHidden();
    } else {
      await expect(dialogue).toBeHidden();
    }
    await expect(tracker).toContainText(stepStem);
  });

  test('a finished landmark giver says its after-line in its own name, with no face', async ({
    page,
  }) => {
    expect(LANDMARK_QUEST, 'no level has a quest given by a landmark (ADR-0029)').toBeDefined();
    if (LANDMARK_QUEST === undefined || LANDMARK === undefined || LANDMARK_LEVEL === undefined) {
      return;
    }
    expect(granted(LANDMARK_QUEST.afterLine), `${LANDMARK_QUEST.id}'s afterLine is not granted`).toBe(
      true,
    );
    if (!granted(LANDMARK_QUEST.afterLine)) return;

    await seed(page, finishedSave(LANDMARK_QUEST));
    await openLevel(page, LANDMARK_LEVEL.id);

    /* A landmark with something to do is offered by its own row; it names nothing. */
    const offer = text('en', 'hud.interact.poi.offer');
    expect(
      await walkUntilThePromptReads(page, offer),
      `walking right in ${LANDMARK_LEVEL.id} never reached "${LANDMARK.id}"`,
    ).toBe(offer);
    await page.getByTestId('interact-prompt').click();

    const dialogue = page.getByTestId('dialogue');
    await expect(dialogue).toBeVisible();
    /* Named by the level's own pois[].name, never the id. */
    await expect(dialogue).toHaveAccessibleName(LANDMARK.name.en);
    await expect(page.getByTestId('dialogue-speaker')).toHaveText(LANDMARK.name.en);
    await expect(page.getByTestId('dialogue-speaker')).not.toHaveText(LANDMARK.id);
    await expect(page.getByTestId('dialogue-text')).toHaveText(LANDMARK_QUEST.afterLine.text.en);
    /* No portrait of any kind: a plaque has no face. */
    await expect(dialogue.locator('img, canvas, svg, picture')).toHaveCount(0);
  });

  test('finishing the task draws the quest’s own closing line first on the card', async ({
    page,
  }) => {
    /*
     * `TN-DONE`: "the line the giver speaks is drawn on the card, from the quest
     * document's doneLine" — under "Task done!", first in the card's body, with
     * no speaker name. One answer from done, on the level the game opens on, so
     * the walk is the giver and one landmark rather than the whole route.
     */
    expect(START_QUEST, `${START_LEVEL} places no character with a quest`).toBeDefined();
    if (START_QUEST === undefined) return;
    expect(
      granted(START_QUEST.doneLine),
      `${START_QUEST.id}'s doneLine is absent or not granted, so the card rightly draws none ` +
        'and this scenario has nothing to find.',
    ).toBe(true);
    if (!granted(START_QUEST.doneLine)) return;
    const doneLine = START_QUEST.doneLine;

    await seed(page, oneAnswerFromDoneSave(START_QUEST));
    await openLevel(page, START_LEVEL);

    /* Past the giver, whose prompt is the reminder now, to the first landmark. */
    const offered = await walkRightUntil(page, {
      wanted: null,
      ignore: [giverPrompt(START_QUEST.giver), text('en', 'hud.interact.done')],
    });
    expect(
      offered,
      `walking right in ${START_LEVEL} reached no landmark past the giver. "card" means the ` +
        'level ended first, which would draw "Level finished!" and no closing line.',
    ).not.toBeNull();
    expect(offered).not.toBe('card');
    await page.getByTestId('interact-prompt').click();

    await expect(page.getByTestId('poi-card')).toBeVisible();
    await page.getByTestId('poi-card-close').click();

    const question = page.getByTestId('question-card');
    await expect(question, 'the landmark asked nothing, so no answer could finish the task')
      .toBeVisible({ timeout: 15_000 });
    await page.getByTestId('option-0').click();
    const onward = page.getByTestId('question-next');
    if (await onward.isVisible()) await onward.click();

    const card = page.getByTestId('quest-complete-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAccessibleName(text('en', 'quest.done.title'));

    /* The line, word for word, first in the body — so it is the first thing the
       dialog's description reads after its name. */
    await expect(card.getByTestId('quest-complete-done')).toHaveText(doneLine.text.en);
    await expect(card.locator('#tn-level-complete-body > p').first()).toHaveAttribute(
      'data-testid',
      'quest-complete-done',
    );
    await expect(card).toHaveAccessibleDescription(
      new RegExp(`^${escapeRegExp(doneLine.text.en)}`, 'u'),
    );
    await expect(card.getByTestId('quest-complete-stamp')).toHaveText(
      text('en', `stamp.${START_LEVEL}.earned` as Parameters<typeof text>[1]),
    );

    /* No speaker: the giver is not named anywhere on the card. */
    await expect(card).not.toContainText(characterName(START_QUEST.giver).en);
    await expect(page.locator('main canvas')).toHaveAttribute('aria-hidden', 'true');
  });
});
