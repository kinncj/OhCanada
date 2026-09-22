import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { hasCopyRow, text } from '@ui/copy';

import { NEXT_LEVEL_PLAY_LABEL, START_LEVEL } from './start-level';
import { holdToMove } from './held-drive';
import { letGo, walkInLegs } from './walk';

/**
 * The level's own quest, walked end to end on the shipped build: **offer,
 * accept, track, complete, stamp, card, next level.**
 *
 * ## Why this file exists
 *
 * Because the quest could not be given at all, on the level the game opens on,
 * while every suite was green. Three of the four authored quests declare
 * `"giver": "guide"`; `app/ui/dialogue.ts` takes the speaker's name as a
 * **required** option, because `TN-QUEST-08` refuses a dialog whose accessible
 * name is "Speaker", "NPC" or nothing; and there was no `npc.guide.name` row. So
 * `app/bootstrap/quest.ts` refused the offer, wrote a line to the console, and
 * the player walked past a beaver whose only prompt read "Talk to this person".
 *
 * **The name is no longer a copy row.** ADR-0029 widened a giver from a
 * character to anything a level places, and moved a character giver's name to
 * `content/characters/<id>.json#/name` — content, bilingual and schema-validated
 * — because a lighthouse needs a name too and no `npc.<id>.name` row may be
 * invented for one (`TN-LEVEL-peggys-cove.md`). `npc.guide.name` and
 * `npc.officer.name` are deleted, so this file reads the document the game
 * reads. The relationship asserted is unchanged: the dialog is named by whatever
 * names the giver, and the prompt never is.
 *
 * `tests/e2e/level-end-to-next.spec.ts` walks the *other* way a level ends — to
 * the exit line, with no task accepted — and it passed throughout. The two are
 * different routes to the same card and only one of them was broken, which is
 * why this is a second file rather than another assertion in that one.
 *
 * ## What is read rather than typed
 *
 * The level, the quest, the giver, the landmarks, the prompts and the stamp
 * sentence, all from `content/` and `app/ui/copy.ts` — the same sources the game
 * reads. A spec that typed "Halifax", "guide" or "Talk to the guide" would have
 * to be edited when `content/game.config.json` opens somewhere else, and would
 * prove nothing this does not. What is asserted is the **relationship**: the
 * prompt is the row keyed on the giver's id, the dialog is named by the giver's
 * own document, and neither is the generic row for a person.
 *
 * ## Why it is serial and slow
 *
 * Every step of it is a real walk at a few hundred world pixels a second, and
 * the browser renders on SwiftShader. A slow walk is a slow machine, not a
 * defect (see `level-end-to-next.spec.ts` for the same reasoning).
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface LevelFile {
  readonly id: string;
  readonly characters: readonly {
    readonly characterId: string;
    readonly questId?: string;
  }[];
}

interface QuestFile {
  readonly id: string;
  readonly giver: string;
  readonly steps: readonly QuestStep[];
  /**
   * The four moment lines: what the giver says after "Not now", on a return
   * mid-quest, after the quest is complete, and on the completion card. Read
   * here so the census below covers them; for a while nothing in the build did.
   */
  readonly declinedLine?: QuestLine;
  readonly reminderLine?: QuestLine;
  readonly afterLine?: QuestLine;
  readonly doneLine?: QuestLine;
}

type QuestLine = NonNullable<QuestStep['dialogue']>[number];

interface QuestStep {
    readonly id: string;
    readonly kind: string;
    readonly prompt: { readonly en: string; readonly fr: string };
    /**
     * What the step says when the player reaches its target.
     *
     * On a `talk` step this is the offer. On a `visit` step it is the teaching
     * this suite exists to keep on screen: the quests were rebuilt so that a
     * player is told why a landmark matters and asked about it standing there,
     * and for a while the runtime read the field on `steps[0]` only, so 27
     * authored lines validated, shipped and were drawn nowhere.
     */
    readonly dialogue?: readonly {
      readonly speaker: string;
      readonly text: { readonly en: string; readonly fr: string };
      /**
       * ADR-0003's block, on the line. Read here so this spec can tell a line
       * the game is allowed to say from one a verifier declined.
       *
       * Five of the lines in `content/quests/` were rejected and spoken anyway,
       * in named characters' voices, while `verify-content` counted them as
       * excluded from the build. `app/bootstrap/verified-dialogue.ts` is the gate
       * that closed it, and the whole block goes when one line in it is refused —
       * the granted lines beside it are its run-up, and saying them alone leaves
       * the speaker mid-thought.
       */
      readonly fact: {
        readonly factual: boolean;
        readonly source: { readonly sourceHash: string } | null;
        readonly verification: {
          readonly status: string;
          readonly sourceHash: string;
          readonly evidence: string;
        } | null;
      };
    }[];
}

const LEVEL = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${START_LEVEL}.json`, 'utf8'),
) as LevelFile;

/** The character the level places with a task beside them. */
const GIVER_IN_THE_LEVEL = LEVEL.characters.find((character) => character.questId !== undefined);

if (GIVER_IN_THE_LEVEL === undefined) {
  throw new Error(
    `content/levels/${START_LEVEL}.json places no character with a questId, so the level ` +
      'the game opens on offers the player no task at all. Either the document lost its ' +
      'quest or this suite is pointed at the wrong level.',
  );
}

const QUEST = JSON.parse(
  readFileSync(`${REPO_ROOT}content/quests/${GIVER_IN_THE_LEVEL.questId ?? ''}.json`, 'utf8'),
) as QuestFile;

/** `hud.interact.<id>`: the one row a character giver still needs. */
const PROMPT_KEY = `hud.interact.${QUEST.giver}`;

if (!hasCopyRow(PROMPT_KEY)) {
  throw new Error(
    `content/quests/${QUEST.id}.json is given by "${QUEST.giver}" and app/ui/copy.ts has ` +
      `no ${PROMPT_KEY}, so the HUD calls the character "this person". Transcribe the row ` +
      'from docs/stories/TN-GUIDE-the-guide.md.',
  );
}

/**
 * What the dialog must be called, read from the document ADR-0029 put it in.
 *
 * It was `npc.<giver>.name` in `app/ui/copy.ts` until that row was deleted. The
 * name is the dialog's accessible name and its speaker label (`TN-QUEST-08`), so
 * a giver this build cannot name is refused outright — which is why this throws
 * here, with the file that is missing, rather than failing inside a walk.
 */
function giverName(giver: string): { readonly en: string; readonly fr: string } {
  const path = `${REPO_ROOT}content/characters/${giver}.json`;
  const document = JSON.parse(readFileSync(path, 'utf8')) as {
    readonly name?: { readonly en?: string; readonly fr?: string };
  };
  const en = document.name?.en ?? '';
  const fr = document.name?.fr ?? '';
  if (en.trim() === '' || fr.trim() === '') {
    throw new Error(
      `content/characters/${giver}.json names the giver of a shipped quest in neither or ` +
        'only one language, so the dialog it opens has no accessible name and ' +
        'app/bootstrap/quest.ts refuses the offer outright (TN-QUEST-08, ADR-0029).',
    );
  }
  return { en, fr };
}

const GIVER_PROMPT = text('en', PROMPT_KEY as Parameters<typeof text>[1]);
const GIVER_NAME = giverName(QUEST.giver).en;
const GIVER_NAME_FR = giverName(QUEST.giver).fr;
const GIVER_PROMPT_FR = text('fr', PROMPT_KEY as Parameters<typeof text>[1]);
const STAMP_SENTENCE = text('en', `stamp.${START_LEVEL}.earned` as Parameters<typeof text>[1]);

/** The step after the opening `talk`, which is what the tracker shows first. */
const SECOND_STEP = QUEST.steps[1];

/**
 * ADR-0003's three conditions, over the document, so this spec can say which
 * blocks the game is allowed to speak.
 *
 * Written from the document's own field names rather than imported from the
 * gate, for the reason `level-ottawa.spec.ts` gives about the same rule: a
 * scenario that asked the code under test what it should expect would agree with
 * it however wrong it was.
 */
const lineIsGranted = (line: NonNullable<QuestStep['dialogue']>[number]): boolean =>
  line.fact.factual !== true ||
  (line.fact.verification !== null &&
    line.fact.source !== null &&
    line.fact.verification.status === 'verified' &&
    line.fact.verification.sourceHash === line.fact.source.sourceHash &&
    line.fact.verification.evidence.trim().length > 0);

/** A block may be said only if every line in it may. The unit is the utterance. */
const blockIsSpeakable = (step: QuestFile['steps'][number]): boolean =>
  (step.dialogue ?? []).every((line) => lineIsGranted(line));

/**
 * The first landmark the task sends the player to **and is allowed to teach at**,
 * and what it teaches there.
 *
 * "And is allowed to" is not a hedge. Halifax's quest carries a rejected line on
 * its third step today, and a scenario that took `steps.find(kind === 'visit')`
 * and asserted its words were drawn would be asserting that a declined claim
 * reaches a player — which is what the old version of this file did, one level
 * over. Which step is refused moves as authors fix them, so this is derived
 * rather than indexed.
 */
const FIRST_VISIT = QUEST.steps.find(
  (step) => step.kind === 'visit' && (step.dialogue?.length ?? 0) > 0 && blockIsSpeakable(step),
);
const FIRST_VISIT_LINES = (FIRST_VISIT?.dialogue ?? []).map((entry) => entry.text.en);

/**
 * Every quest in the build, for the census this suite reads off the probe.
 *
 * Read here, off the disk, by a route the bundle never takes: the expectation
 * has to be computed from `content/` and not from the thing being measured.
 */
const ALL_QUESTS: readonly QuestFile[] = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(`${REPO_ROOT}content/quests/${name}`, 'utf8')) as QuestFile);

const MOMENT_FIELDS = ['declinedLine', 'reminderLine', 'afterLine', 'doneLine'] as const;

/**
 * Every moment line in the build, each a block of one: a moment is one thing a
 * speaker says at one moment. Computed from the documents, so the day an author
 * removes or adds one the expectation follows the content.
 */
const MOMENT_BLOCKS = ALL_QUESTS.flatMap((quest) =>
  MOMENT_FIELDS.flatMap((field) => {
    const line = quest[field];
    return line === undefined ? [] : [{ lines: [line], speakable: lineIsGranted(line) }];
  }),
);

/** Every block of words in the build — steps and moments — with the verdict computed here. */
const ALL_BLOCKS = [
  ...ALL_QUESTS.flatMap((quest) =>
    quest.steps.flatMap((step) =>
      (step.dialogue?.length ?? 0) === 0
        ? []
        : [{ lines: step.dialogue ?? [], speakable: blockIsSpeakable(step) }],
    ),
  ),
  ...MOMENT_BLOCKS,
];

test.describe.configure({ mode: 'serial', timeout: 300_000 });

/*
 * A player who holds a control to move (ADR-0058). These walks are made of legs
 * that hold and let go at each stop; the subject is the quest, and a second
 * driver would make "walked to the landmark it was sent to" mean something else.
 */
test.beforeEach(async ({ page }) => {
  await holdToMove(page);
});

async function openLevel(page: Page, query = '', level: string = START_LEVEL): Promise<void> {
  await page.goto(`./?level=${level}${query}`);
  await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
}

/**
 * Walk right, watching the HUD **in the page**, and stop the moment it offers
 * something this walk is looking for.
 *
 * ## Why the watching is in the page and not here
 *
 * Every check from the test process costs a round trip, so a walk written as
 * "hold 150 ms, ask, hold again" samples the world about every 45 world pixels
 * however short the hold is — the movement is dominated by the round trip, not
 * by the key. That is fine for a landmark in the middle of a level, whose reach
 * is hundreds of pixels wide, and it is **not** fine for the last landmark in
 * Halifax: `harbour-tug` sits at x 6806 and the level's arrival line is at
 * x 6660 (`app/adapters/phaser/level-exit.ts`: half a view back from the right
 * bound), so the band where the tug is in reach and the level has not yet ended
 * is about fifty pixels wide. A walk sampling every forty-five lands in it about
 * half the time, which is a coin toss dressed as a test.
 *
 * Polling inside the page on `requestAnimationFrame` sees the prompt on the
 * frame it appears, and the key is released one round trip later instead of one
 * *sample* later. **Reported, and not worked around further than this**: a
 * required quest landmark placed past its level's arrival line is a content
 * defect — the player who holds to move is told "Level finished!" as they walk
 * up to the last thing their task names, and the completion card draws once per
 * sitting, so finishing the task afterwards says nothing at all. Halifax's
 * `harbour-tug` and Peggy's Cove's `village-house` are both past their lines.
 *
 * Returns the prompt it stopped at, `'card'` when the level ended first — a real
 * outcome, not a timeout — and `null` when the walk ran out of time.
 *
 * **Held in legs** (`./walk.ts`). A held drive comes to rest at every landmark
 * and character it approaches and waits there for the player to let go and press
 * again (ADR-0032), so a walk told to pass the guide and go on to a landmark has
 * to do what a player does at the guide. Each leg watches for up to a few
 * seconds and ends by letting go; the next leg's press is the fresh one.
 */
async function walkRightWatching(
  page: Page,
  want: { readonly ignore?: readonly string[]; readonly wanted?: string },
  budgetMs = 60_000,
): Promise<string | null> {
  return walkInLegs(
    page,
    'ArrowRight',
    (legMs) =>
      page.evaluate(
        async ({ ignore, wanted, budget }) => {
          const visible = (testId: string): Element | null => {
            const found = document.querySelector(`[data-testid="${testId}"]`);
            return found !== null && (found as HTMLElement).checkVisibility() ? found : null;
          };
          const deadline = performance.now() + budget;
          while (performance.now() < deadline) {
            if (visible('quest-complete-card') !== null) return 'card';
            const offered = visible('interact-prompt')?.textContent ?? null;
            if (offered !== null) {
              if (wanted === undefined ? !ignore.includes(offered) : offered === wanted) {
                return offered;
              }
            }
            await new Promise((resolve) => {
              requestAnimationFrame(() => {
                resolve(null);
              });
            });
          }
          return null;
        },
        { ignore: [...(want.ignore ?? [])], wanted: want.wanted, budget: legMs },
      ),
    { budgetMs },
  );
}

/**
 * Walk right until something — anything — is in reach.
 *
 * Returns what the HUD offered, or `null` when the walk ran out — and `'card'`
 * when the player reached the end of the level instead, which is a real outcome
 * and not a timeout.
 */
const walkUntilSomethingIsInReach = (page: Page): Promise<string | null> =>
  walkRightWatching(page, { ignore: [] });

/**
 * Walk right until the HUD offers **this** prompt, passing anything else.
 *
 * `walkUntilSomethingIsInReach` stops at the first mark, which is right for the
 * level the game opens on — Halifax places its giver first — and wrong for a
 * level that places scenery before its giver. Ottawa used to: the canal locks
 * stood at x 1800 and the officer at x 2400, so a walk that stopped at the first
 * thing opened a landmark's card and then failed for want of a dialogue, naming
 * the officer. **The level was right and the walk was short**, which is why this
 * takes the prompt it is looking for rather than the first one it meets.
 *
 * Ottawa's order has since changed — the locks moved past the officer so that
 * ADR-0063's `read` step had a stop after the giver — and this helper is kept
 * exactly as it is. What it guards against is a level placing anything before
 * its giver, which several still may and any of them may start doing; naming the
 * order a level happens to have today is the mistake it was written to undo.
 */
const walkUntilThePromptReads = (page: Page, wanted: string): Promise<string | null> =>
  walkRightWatching(page, { wanted });

/**
 * Walk right until the HUD offers something that is **not** one of these.
 *
 * The giver stands between the spawn and the first landmark, and once they have
 * been talked to their prompt keeps its own words while the task runs (ADR-0039)
 * and reads "Done. See it again" once it is finished — so a walk that
 * stopped at the first mark stopped at the guide again, and engaging it opened
 * the reminder rather than the landmark. Saying what to ignore is how a walk
 * asks for "the next thing, not this one" without naming a landmark the level
 * document is free to move.
 */
const walkPastAndOnTo = (page: Page, ignore: readonly string[]): Promise<string | null> =>
  walkRightWatching(page, { ignore });

/** Walk to the giver and open what they have to say. */
async function talkToTheGiver(page: Page): Promise<void> {
  const offered = await walkUntilSomethingIsInReach(page);
  expect(
    offered,
    `walking right in ${START_LEVEL} never came within reach of anything. The giver is ` +
      `"${QUEST.giver}", placed by content/levels/${START_LEVEL}.json.`,
  ).toBe(GIVER_PROMPT);
  await page.getByTestId('interact-prompt').click();
  await expect(page.getByTestId('dialogue')).toBeVisible();
}

/**
 * Engage whatever is in reach once, and deal with whatever it opens.
 *
 * A landmark opens its card and then a question; a question is answered by
 * taking the first option, because what is asserted here is that the quest
 * *counts* the answer, never whether the player got it right. A character opens
 * a dialogue: the offer the first time, and the step's prompt read back after
 * that (`TN-REACH-03`).
 *
 * Engaged by tapping the HUD's prompt, which is `TN-LEVEL-05`'s "tapping the
 * prompt does what tapping the target does" and the route a one-thumb player
 * takes. The interact key is the other route and is not walked here: it engages
 * from the scene's own input, so a suite that used it would be proving the
 * keyboard binding rather than the quest.
 */
async function engageOnce(page: Page): Promise<'answered' | 'talked' | 'nothing'> {
  const poi = page.getByTestId('poi-card');
  const question = page.getByTestId('question-card');
  const dialogue = page.getByTestId('dialogue');
  const prompt = page.getByTestId('interact-prompt');

  /*
   * Only while the level is actually running. A modal holds it, and a tap that
   * lands in the frame between a card closing and the level starting again is a
   * tap the game is right to ignore.
   */
  await page.waitForSelector('html[data-tn-paused="false"]', { timeout: 15_000 });

  /*
   * Tapping the prompt does what tapping the target does (`TN-LEVEL-05`), and
   * the retry is not defensiveness: the HUD creates and removes that button as
   * things come in and out of reach, so a click can resolve the element and
   * then find it detached — the game redrawing a button, not a defect. Three
   * bounded attempts, and a prompt that has genuinely gone means there is
   * nothing here to engage.
   */
  let tapped = false;
  for (let attempt = 0; attempt < 3 && !tapped; attempt += 1) {
    try {
      await prompt.click({ timeout: 5_000 });
      tapped = true;
    } catch {
      if (!(await prompt.isVisible())) return 'nothing';
    }
  }
  if (!tapped) return 'nothing';

  /*
   * Waited for rather than slept on. A landmark's first question needs its
   * subject's bank, which is a separate chunk the browser fetches on demand, so
   * "how long until the card is up" is a download on a cold cache and not a
   * frame count. A fixed pause here is how this walk drifted past a landmark and
   * finished the *level* instead of the task.
   */
  const opened = await Promise.race([
    poi.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'poi' as const),
    question.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'question' as const),
    dialogue.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'dialogue' as const),
  ]).catch(() => null);

  if (opened === null) return 'nothing';

  if (opened === 'poi') {
    await page.getByTestId('poi-card-close').click();
    await expect(poi).toBeHidden();

    /*
     * The quest's own line about this place, when the player is standing on the
     * `visit` step that names it. The card is the place in its own words; this
     * is a named speaker commenting on it, and on two levels that speaker is the
     * landmark rather than a person. It is dismissed here rather than asserted:
     * `teaches at each landmark it sends the player to` below is where the words
     * are read.
     */
    const spoke = await Promise.race([
      dialogue.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true),
      question.waitFor({ state: 'visible', timeout: 10_000 }).then(() => false),
    ]).catch(() => null);
    if (spoke === null) return 'talked';
    if (spoke) {
      await page.getByTestId('dialogue-next').click();
      await expect(dialogue).toBeHidden();
    }

    /* The card's questions follow it, when this level's subject has any. */
    const asked = await question
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!asked) return 'talked';
  }

  if (await question.isVisible()) {
    /* An `answer` step asks everything it has left in one go (ADR-0036), so the
       card is answered until it goes rather than once. */
    for (let asked = 0; asked < 12 && (await question.isVisible()); asked += 1) {
      await page.getByTestId('option-0').click();
      const next = page.getByTestId('question-next');
      await expect(next).toBeVisible();
      await next.click();
    }
    await expect(question).toBeHidden();
    return 'answered';
  }

  if (await dialogue.isVisible()) {
    const onward = page.getByTestId('dialogue-next');
    if (await onward.isVisible()) await onward.click();
    await expect(dialogue).toBeHidden();
    return 'talked';
  }
  return 'nothing';
}

/** What the HUD offers for something already engaged in this sitting. */
const DONE_PROMPT = text('en', 'hud.interact.done');

/**
 * A prompt without its count: "Answer 3 questions ({{done}} of 3)" filled in by
 * the tracker is still the same step as the document's `prompt`.
 */
const stem = (line: string): string => (line.split('(')[0] ?? line).trim();

/**
 * Which step of the quest the tracker is showing, or `null`.
 *
 * The tracker draws the current step's own `prompt` (`TN-QUEST-02`: what to do
 * now, not what the quest is called), so the document can be asked what the
 * player is standing on. That is what lets the walk below tell "go somewhere"
 * from "answer here" — and a walk that cannot tell them apart strolls past the
 * landmark it was sent to, which is how this suite came to answer five of nine
 * questions and finish the level instead of the task.
 */
function stepShowing(line: string | null): QuestFile['steps'][number] | null {
  if (line === null || line.trim() === '') return null;
  /* `endsWith`, because the HUD labels the strip — "Task: Find the Town Clock" —
     and the label is `app/ui/copy.ts`'s while the sentence after it is the
     document's. Matching on equality silently found nothing, which is how the
     first draft of this walk went on strolling past the landmark it was sent
     to and answered five of nine questions. */
  return QUEST.steps.find((step) => stem(line).endsWith(stem(step.prompt.en))) ?? null;
}

/**
 * Keep walking until this target is out of reach, so the next one can be.
 *
 * Engaging a target lets the player go from it for the rest of the visit
 * (ADR-0032), so this walks on rather than being stopped where it stands; the
 * release is waited for so the walk after it begins with a press the level sees.
 */
async function walkOnPast(page: Page): Promise<void> {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await letGo(page, 'ArrowRight');
}

/**
 * Keep playing past the card that says what is left (ADR-0036).
 *
 * Reaching the end of a level whose task is not done earns nothing and draws a
 * card saying so, which the player dismisses to carry on. A walk that finishes
 * the task can meet it: Halifax's harbour tug stands past the level's arrival
 * line, so the player crosses the end on the way to the last landmark the task
 * names. That card is drawn once per sitting, so this is a no-op every other
 * time it is called.
 */
async function keepPlayingPastTheEnd(page: Page): Promise<void> {
  const unfinished = page.locator('[data-testid="quest-complete-card"][data-reason="unfinished"]');
  if (!(await unfinished.isVisible())) return;
  await unfinished.getByTestId('quest-complete-keep-playing').click();
  await expect(unfinished).toBeHidden();
}

test.describe('the level the game opens on gives its task, and finishes it', () => {
  test('names the character before it speaks, and offers the task', async ({ page }) => {
    /*
     * `TN-GUIDE-01`: "engaging the guide opens a named dialogue", and "no offer
     * is refused for want of a speaker's name" on the level the game opens on.
     */
    const refusals: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') refusals.push(message.text());
    });

    await openLevel(page);

    /* The prompt is the giver's own row, and not the row for a person. */
    const prompt = page.getByTestId('interact-prompt');
    const offered = await walkUntilSomethingIsInReach(page);
    expect(offered).toBe(GIVER_PROMPT);
    expect(offered).not.toBe(text('en', 'hud.interact.npc'));

    await prompt.click();

    const dialogue = page.getByTestId('dialogue');
    await expect(dialogue).toBeVisible();
    await expect(dialogue).toHaveAttribute('role', 'dialog');
    await expect(dialogue).toHaveAttribute('aria-modal', 'true');
    /* The name is the dialog's accessible name *and* is drawn, so a sighted
       player and a screen-reader user are told the same thing (`TN-QUEST-08`). */
    await expect(dialogue).toHaveAccessibleName(GIVER_NAME);
    await expect(page.getByTestId('dialogue-speaker')).toHaveText(GIVER_NAME);
    await expect(page.getByTestId('dialogue-accept')).toBeVisible();
    await expect(page.getByTestId('dialogue-decline')).toBeVisible();

    /* The sentence `app/bootstrap/quest.ts` prints when it refuses an offer for
       want of an accessible name, by the words it uses **now**: the old sentinel
       was `npc.<id>.name`, and no message contains that since ADR-0029 moved the
       name into `content/characters/`, so filtering on it would have been a
       check about nothing. */
    expect(
      refusals.filter((line) => line.includes('cannot name it')),
      'the offer was refused for want of a speaker’s name',
    ).toEqual([]);

    /* And the canvas is still out of the accessibility tree behind it. */
    await expect(page.locator('main canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  test('puts the task in the HUD once it is accepted, and not before', async ({ page }) => {
    await openLevel(page);
    const tracker = page.getByTestId('hud-quest-tracker');
    await expect(tracker, 'a task was tracked before anybody accepted one').toBeHidden();

    await talkToTheGiver(page);
    await page.getByTestId('dialogue-accept').click();

    await expect(page.getByTestId('dialogue')).toBeHidden();
    /* Accepting finishes the opening `talk` step in the same move, so the
       tracker shows the step after it (`TN-QUEST-02`). */
    await expect(tracker).toBeVisible();
    await expect(tracker).toContainText(SECOND_STEP?.prompt.en ?? '');
    /* The level is running again: whoever takes it gives it back. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
  });

  test('is refused without ending anything, and can be taken later', async ({ page }) => {
    /* `TN-QUEST-03`: declining is not a refusal to ever ask again. */
    await openLevel(page);
    await talkToTheGiver(page);
    await page.getByTestId('dialogue-decline').click();

    /* "Not now" is answered in the quest's own words when it wrote some and a
       verifier allows them (`TN-QUEST-03`, `declinedLine`). Closed here: this
       scenario is about what comes after, and `quest-moments.spec.ts` reads it. */
    if (QUEST.declinedLine !== undefined && lineIsGranted(QUEST.declinedLine)) {
      await expect(page.getByTestId('dialogue-text')).toHaveText(QUEST.declinedLine.text.en);
      await page.getByTestId('dialogue-next').click();
    }

    await expect(page.getByTestId('dialogue')).toBeHidden();
    await expect(page.getByTestId('hud-quest-tracker')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    await page.getByTestId('interact-prompt').click();
    await expect(page.getByTestId('dialogue-accept'), 'the task was never offered again')
      .toBeVisible();
  });

  test('is French from the name to the prompt', async ({ page }) => {
    /* `TN-GUIDE-06`. The language is set on the title screen and kept in the
       save, so the level opens in it. */
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-language-fr').click();
    await page.getByTestId('settings-close').click();

    await openLevel(page);
    const offered = await walkUntilSomethingIsInReach(page);
    expect(offered).toBe(GIVER_PROMPT_FR);
    expect(offered).not.toBe(text('fr', 'hud.interact.npc'));

    await page.getByTestId('interact-prompt').click();
    await expect(page.getByTestId('dialogue')).toHaveAccessibleName(GIVER_NAME_FR);
    await expect(page.getByTestId('dialogue-speaker')).toHaveText(GIVER_NAME_FR);
  });

  test('teaches at the landmark it sends the player to, before asking about it', async ({
    page,
  }) => {
    /*
     * The learning moment, on the shipped build, in the order it is meant to
     * happen:
     *
     *   the landmark's card — the level document's own verified blurb, the place
     *   in its own words, with no speaker;
     *   then the `visit` step's line — a **named** speaker saying why it matters;
     *   then the question.
     *
     * Two surfaces because they are two voices. The card is the place; the line
     * has somebody behind it, and on Peggy's Cove and in the North that somebody
     * is the landmark itself (ADR-0029), which is why the name is resolved from
     * what the level placed rather than from a copy row.
     *
     * This is the test that fails if visit dialogue stops rendering. It reads
     * the words out of `content/quests/` rather than typing them, so it goes red
     * for the runtime dropping them and not for an author rewording them.
     */
    test.setTimeout(180_000);

    expect(
      FIRST_VISIT,
      `content/quests/${QUEST.id}.json sends the player nowhere, so there is no landmark ` +
        'for it to teach at.',
    ).toBeDefined();
    expect(
      FIRST_VISIT_LINES.length,
      `content/quests/${QUEST.id}.json step "${FIRST_VISIT?.id ?? ''}" carries no dialogue, ` +
        'so this scenario would pass over a landmark that teaches nothing — which is exactly ' +
        'the defect it was written for (ADR-0024).',
    ).toBeGreaterThan(0);

    await openLevel(page);
    await talkToTheGiver(page);
    await page.getByTestId('dialogue-accept').click();
    await expect(page.getByTestId('dialogue')).toBeHidden();

    const tracker = page.getByTestId('hud-quest-tracker');
    await expect(tracker).toContainText(FIRST_VISIT?.prompt.en ?? '');

    /* On past the giver — whose prompt keeps its own words while the task runs
       (ADR-0039) and read "Done. See it again" before — and up to the
       first landmark the tracker names. */
    const offered = await walkPastAndOnTo(page, [GIVER_PROMPT, text('en', 'hud.interact.done')]);
    expect(
      offered,
      `walking on from the giver in ${START_LEVEL} never reached the landmark ` +
        `"${FIRST_VISIT?.id ?? ''}" names. "card" means the walk reached the end of the level.`,
    ).not.toBe(null);
    expect(offered).not.toBe('card');
    await page.getByTestId('interact-prompt').click();

    /* The place first. */
    const poi = page.getByTestId('poi-card');
    await expect(poi).toBeVisible();
    await page.getByTestId('poi-card-close').click();
    await expect(poi).toBeHidden();

    /* Then the speaker, in their own name — the same name the offer was made
       in, resolved the same way (`TN-QUEST-08`). */
    const dialogue = page.getByTestId('dialogue');
    await expect(
      dialogue,
      `content/quests/${QUEST.id}.json step "${FIRST_VISIT?.id ?? ''}" carries ` +
        `${String(FIRST_VISIT_LINES.length)} lines and the player was told none of them.`,
    ).toBeVisible();
    await expect(dialogue).toHaveAttribute('aria-modal', 'true');
    await expect(dialogue).toHaveAccessibleName(GIVER_NAME);
    await expect(page.getByTestId('dialogue-speaker')).toHaveText(GIVER_NAME);
    for (const said of FIRST_VISIT_LINES) {
      await expect(page.getByTestId('dialogue-text')).toContainText(said);
    }
    /* Nothing to decide: the task was accepted two landmarks ago. */
    await expect(page.getByTestId('dialogue-accept')).toBeHidden();

    /* The question waits behind the line rather than opening over it, and the
       level stays stopped for the whole chain. */
    await expect(page.getByTestId('question-card')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await page.getByTestId('dialogue-next').click();
    await expect(dialogue).toBeHidden();
    await expect(page.getByTestId('question-card')).toBeVisible();

    /* And the canvas is still out of the accessibility tree behind all three. */
    await expect(page.locator('main canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  test('stops at every landmark the task names, and finishes the task', async ({ page }) => {
    /*
     * The whole route in one walk, because it is one walk: accept, follow the
     * tracker through each step, and finish. What proves the quest finished
     * rather than the level running out is the card's heading — `quest.done.title`
     * for a task, `level.complete.title` for a walk to the exit — and `TN-DONE`
     * calls drawing the wrong one a claim about something the player never did.
     *
     * **The walk follows the tracker rather than the first thing in reach.** It
     * used to take whatever the HUD offered and then walk on, which worked while
     * Halifax had one landmark to visit and one step to answer. The quest now
     * sends the player to four landmarks and asks nine questions, and a walk
     * that moved on after each engagement drifted a landmark behind the step it
     * was on: it answered five, ran out of level and drew the *other* completion
     * card, correctly, for a task it had not finished — since ADR-0036 the card
     * that says what is left, which this walk now keeps playing past.
     * The test had expired; the game had not. `stepShowing` is the fix, and the
     * scenario it now proves is `TN-DONE`'s first: a player who stops at every
     * landmark finishes the task.
     */
    test.setTimeout(420_000);

    await openLevel(page);
    await talkToTheGiver(page);
    await page.getByTestId('dialogue-accept').click();

    const card = page.getByTestId('quest-complete-card');
    /* The card that says the task is done — not the one that says what is left,
       which this walk can meet on its way to a landmark past the end of the
       level and simply keeps playing past (ADR-0036). */
    const finished = page.locator(
      '[data-testid="quest-complete-card"]:not([data-reason="unfinished"])',
    );
    const tracker = page.getByTestId('hud-quest-tracker');
    const seen: string[] = [];

    for (let round = 0; round < 40 && !(await finished.isVisible()); round += 1) {
      await keepPlayingPastTheEnd(page);
      const line = ((await tracker.textContent()) ?? '').trim();
      if (line !== '' && !seen.includes(line)) seen.push(line);

      /*
       * What the player is being asked to do decides what they do next, and
       * that is the whole of this walk:
       *
       *  - an **`answer`** step counts a question wherever it is asked, so the
       *    player stays where they are and engages the landmark again — even
       *    though its prompt now reads "Done. See it again", which is
       *    about this sitting and not about the task. A three-answer step needs
       *    exactly that;
       *  - a **`visit`** step finishes only at the landmark it names, and one
       *    already dealt with is behind the player — so they walk on to
       *    something they have not seen rather than spending a question on a
       *    place that cannot advance the step.
       *
       * Walking on after every engagement is what put the count a landmark
       * behind the step it was on; engaging whatever was in reach regardless is
       * what spent four questions on landmarks the step was not about and ran
       * the player out of level with the task unfinished.
       */
      const onAnswerStep = stepShowing(line)?.kind === 'answer';
      const prompt = page.getByTestId('interact-prompt');
      const inReach = (await prompt.isVisible()) ? ((await prompt.textContent()) ?? '') : null;

      /* `'card'` is the end of the level. Unfinished, it is dismissed at the top
         of the next round and the walk goes on; finished, the loop ends. */
      if (onAnswerStep) {
        if (inReach === null) {
          const offered = await walkUntilSomethingIsInReach(page);
          if (offered === null) break;
          if (offered === 'card') continue;
        }
      } else if (inReach === null || inReach === DONE_PROMPT || inReach === GIVER_PROMPT) {
        /* The giver keeps its own prompt while its quest is unfinished
           (ADR-0039) — engaged is not finished — so a walk that is going
           somewhere passes it as it passes anything already done. */
        const offered = await walkPastAndOnTo(page, [DONE_PROMPT, GIVER_PROMPT]);
        if (offered === null) break;
        if (offered === 'card') continue;
      }

      const did = await engageOnce(page);
      if (await finished.isVisible()) break;
      if (onAnswerStep && did === 'answered') continue;

      /*
       * The interact prompt does not say *which* landmark it is offering — it is
       * a copy row about a kind of thing (`TN-REACH`) — so the tracker is what
       * knows whether this was the place. If it did not move, walk on.
       */
      if (((await tracker.textContent()) ?? '').trim() === line) await walkOnPast(page);
    }

    await expect(
      finished,
      `the task never finished. The tracker showed: ${seen.join(' | ')}. Every step of ` +
        `content/quests/${QUEST.id}.json has to be reachable by walking and choosing.`,
    ).toBeVisible({ timeout: 30_000 });

    /* It is the **task** that finished, not the level running out under the
       player's feet. */
    await expect(card).toHaveAccessibleName(text('en', 'quest.done.title'));
    await expect(card).not.toHaveAccessibleName(text('en', 'level.complete.title'));

    /* Every step of it was walked, not just the ones before the level ran out. */
    const visits = QUEST.steps.filter((step) => step.kind === 'visit');
    expect(
      seen.length,
      `the tracker only ever showed ${String(seen.length)} of ${String(QUEST.steps.length - 1)} ` +
        `steps: ${seen.join(' | ')}`,
    ).toBeGreaterThanOrEqual(visits.length);

    /* The stamp is this level's own sentence, written out and not composed. */
    await expect(card.getByTestId('quest-complete-stamp')).toHaveText(STAMP_SENTENCE);
    /* The quest's own closing line, when a verifier allows it to be said. */
    if (QUEST.doneLine !== undefined && lineIsGranted(QUEST.doneLine)) {
      await expect(card.getByTestId('quest-complete-done')).toHaveText(QUEST.doneLine.text.en);
    } else {
      await expect(card.getByTestId('quest-complete-done')).toHaveCount(0);
    }
    /* The score is a count of answers, never a mark out of nothing. */
    await expect(card.getByTestId('quest-complete-progress')).toContainText('out of');
    /* The tracker goes when the task does: no half-finished task behind a card
       that says it is done. */
    await expect(tracker).toBeHidden();
    /* And the level is stopped behind it. */
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    /* The way on, and it is a label that says what pressing does. */
    if (NEXT_LEVEL_PLAY_LABEL !== null) {
      const play = card.getByTestId('quest-complete-next');
      await expect(play).toHaveText(NEXT_LEVEL_PLAY_LABEL);
      await play.click();
      await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
      await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');
    }

    /* The stamp really is in the passport, which is the record of the journey
       rather than a line on a card the player has already tapped past. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-passport').click();
    const passport = page.getByTestId('passport');
    await expect(passport).toBeVisible();
    await expect(passport.getByTestId('passport-counts')).toContainText('1 of 10');
  });

  test('walks past every landmark, earns no stamp, and is told what is left', async ({ page }) => {
    /*
     * The other way a level ends, and ADR-0036 changed what it is worth.
     *
     * It used to earn the stamp: a player who walked the length of the level
     * without tapping anything was told "You earned the … stamp" under a
     * passport that promises one for finishing a level's task. Now the end of a
     * level whose task is not done earns nothing, opens nothing, and draws the
     * card that says what the stamp is for and what is left — and gives the
     * level back.
     *
     * Nothing is engaged here: no dialogue, no card, no question. The tracker
     * must stay away for the whole walk, because no task was accepted.
     */
    test.setTimeout(300_000);

    await openLevel(page);
    const card = page.getByTestId('quest-complete-card');
    const tracker = page.getByTestId('hud-quest-tracker');

    /* Short bursts, each ending in a release the level sees: a held drive comes to
       rest at every landmark and character on the way (ADR-0032), and the next
       burst's press is what carries the player past it without engaging it. */
    for (let attempt = 0; attempt < 300 && !(await card.isVisible()); attempt += 1) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(150);
      await letGo(page, 'ArrowRight');
    }

    await expect(
      card,
      `walking the whole of ${START_LEVEL} without stopping never reached the end of it.`,
    ).toBeVisible({ timeout: 30_000 });

    /* The card that says what is left — not "Level finished!", and not "Task
       done!": the player accepted nothing and answered nothing (ADR-0036). */
    await expect(card).toHaveAttribute('data-reason', 'unfinished');
    await expect(card).toHaveAccessibleName(text('en', 'level.unfinished.title'));
    await expect(card).not.toHaveAccessibleName(text('en', 'level.complete.title'));
    await expect(card).not.toHaveAccessibleName(text('en', 'quest.done.title'));

    /* What the stamp is for — the passport's own promise — and what to do. */
    await expect(card.getByTestId('quest-complete-left-0')).toHaveText(text('en', 'passport.intro'));
    await expect(card.getByTestId('quest-complete-left-1')).toHaveText(
      text('en', 'level.unfinished.notStarted'),
    );

    /* No stamp, no score, no route into a level nothing opened, nothing new in
       the passport. */
    await expect(card.getByTestId('quest-complete-stamp')).toHaveCount(0);
    await expect(card).not.toContainText(STAMP_SENTENCE);
    await expect(card.getByTestId('quest-complete-progress')).toHaveCount(0);
    await expect(card.getByTestId('quest-complete-next')).toHaveCount(0);
    await expect(card.getByTestId('quest-complete-passport')).toHaveCount(0);

    /* And no remark about the task. Every closing line describes a route this
       player never walked (`TN-DONE` rule 6). */
    await expect(card.getByTestId('quest-complete-done')).toHaveCount(0);
    if (QUEST.doneLine !== undefined) {
      await expect(card).not.toContainText(QUEST.doneLine.text.en);
    }

    /* No task was ever accepted, so nothing tracked one. */
    await expect(tracker).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    /* One way on: back into the level, which is where the task is. */
    const keepPlaying = card.getByTestId('quest-complete-keep-playing');
    await expect(keepPlaying).toHaveAttribute('data-tn-action', 'primary');
    await keepPlaying.click();
    await expect(card).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    /* And the passport, opened from the menu now that the card has gone, holds
       no stamp for a walk. */
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-passport').click();
    const passport = page.getByTestId('passport');
    await expect(passport).toBeVisible();
    await expect(passport.getByTestId('passport-counts')).not.toContainText('1 of 10');
  });
});

/* ------------------------------------- and the other levels that place one --- */

/**
 * Every level whose document places a character with a task beside them, read
 * from `content/levels/` rather than listed.
 *
 * Three of the four are given by the same character, which is exactly why the
 * missing row broke three levels at once and why this is a loop: a name written
 * once and drawn on three levels is only proved by walking all three.
 */
const LEVELS_WITH_A_GIVER = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort()
  .flatMap((id) => {
    const document = JSON.parse(
      readFileSync(`${REPO_ROOT}content/levels/${id}.json`, 'utf8'),
    ) as LevelFile;
    const placed = document.characters.find((character) => character.questId !== undefined);
    if (placed === undefined) return [];
    const quest = JSON.parse(
      readFileSync(`${REPO_ROOT}content/quests/${placed.questId ?? ''}.json`, 'utf8'),
    ) as QuestFile;
    return [{ id, giver: quest.giver, quest: quest.id }];
  });

test.describe('every level that places a quest giver can give its quest', () => {
  for (const level of LEVELS_WITH_A_GIVER) {
    test(`${level.id} names ${level.giver} and offers ${level.quest}`, async ({ page }) => {
      /*
       * `TN-GUIDE-01`, the scenario outline: three of these levels are given by
       * the guide and all three were refused for one missing row. Walked rather
       * than asserted against the copy table, because a row that exists and a
       * dialogue that opens are different facts — the first was true for the
       * officer while the second was false for everybody else.
       */
      /* The giver's name, from `content/characters/<id>.json#/name` — every
         level in this list places a *character* with a `questId`, so every one
         of them has a document there. A landmark giver is named by its level's
         own `pois[].name` and is walked by
         `tests/unit/bootstrap/a-landmark-giver-opens-a-dialog.test.ts`. */
      const name = giverName(level.giver).en;

      /* The giver's own prompt row, which is what says the walk has arrived at
         the giver rather than at something else this level places. */
      const promptKey = `hud.interact.${level.giver}`;
      expect(
        hasCopyRow(promptKey),
        `${level.quest} is given by "${level.giver}" and app/ui/copy.ts has no ${promptKey}, ` +
          'so the HUD calls the character "this person"',
      ).toBe(true);
      const giverPrompt = text('en', promptKey as Parameters<typeof text>[1]);

      await openLevel(page, '', level.id);
      const offered = await walkUntilThePromptReads(page, giverPrompt);
      expect(
        offered,
        `walking right in ${level.id} never came within reach of "${level.giver}", who gives ` +
          `${level.quest}. "card" means the walk reached the end of the level first; null ` +
          'means it ran out of attempts.',
      ).toBe(giverPrompt);

      /* The prompt is a verb phrase from the table, never the character's name
         — which is now `content/characters/<id>.json#/name` and is drawn one
         press later, as the dialog's accessible name. */
      expect(offered).not.toBe(name);

      await page.getByTestId('interact-prompt').click();
      const dialogue = page.getByTestId('dialogue');
      await expect(dialogue, `${level.giver} said nothing in ${level.id}`).toBeVisible();
      await expect(dialogue).toHaveAccessibleName(name);
      await expect(page.getByTestId('dialogue-speaker')).toHaveText(name);
      await expect(page.getByTestId('dialogue-accept')).toBeVisible();
    });
  }
});

/**
 * ADR-0003 through the built artefact, for the words a character says.
 *
 * The canvas is `aria-hidden` and a dialog that never opens leaves nothing on
 * the page to assert, so "the rejected line was not said" is only provable from
 * outside by its **absence** — and an absence is exactly what a filter that
 * dropped everything also produces. That is why the census is on the probe:
 * `data-dialogue-examined` is the number that separates "the filter ran and
 * refused nothing" from "the filter never matched a block", and
 * `data-dialogue-silenced` is what a player actually lost.
 *
 * The numbers are computed here from `content/quests/` by a route the bundle
 * never takes, so this tracks the content: the day an author rewrites the five
 * declined lines and a verifier grants them, `data-dialogue-silenced` goes to 0,
 * this spec expects 0, and nothing here is edited. What it can never do is pass
 * while the runtime and the documents disagree.
 */
test.describe('ADR-0003 — a line a verifier declined is not spoken', () => {
  test('publishes a dialogue census that matches the documents in content/quests/', async ({
    page,
  }) => {
    /* The floor. Every check below folds an empty corpus into a pass, and zero
       blocks of dialogue is not a number this game can have. */
    expect(
      ALL_BLOCKS.length,
      'content/quests/ holds no dialogue at all, so this scenario is about nothing',
    ).toBeGreaterThan(0);

    const lines = ALL_BLOCKS.reduce((total, block) => total + block.lines.length, 0);
    const refused = ALL_BLOCKS.reduce(
      (total, block) => total + block.lines.filter((line) => !lineIsGranted(line)).length,
      0,
    );
    const silenced = ALL_BLOCKS.filter((block) => !block.speakable).length;

    await openLevel(page, '&e2e=1');
    const probe = page.locator('[data-testid="scene-state"]');

    await expect(
      probe,
      'the dialogue filter examined a different number of lines than content/quests/ carries, ' +
        'which means it is reading something other than every fact block on every line.',
    ).toHaveAttribute('data-dialogue-examined', String(lines));
    await expect(probe).toHaveAttribute('data-dialogue-blocks', String(ALL_BLOCKS.length));
    await expect(probe).toHaveAttribute('data-dialogue-refused', String(refused));
    await expect(probe).toHaveAttribute('data-dialogue-drawable', String(lines - refused));
    await expect(
      probe,
      'the build silenced a different number of blocks than content/quests/ has blocks with a ' +
        'declined line in them. One refused line takes its whole block with it, and that is ' +
        'the number a player feels.',
    ).toHaveAttribute('data-dialogue-silenced', String(silenced));
    /*
     * The four moment lines each quest carries, and the reason this number is
     * published at all: for a while the filter read steps only, so `examined`
     * matched a count that left 40 authored, verified lines out, and every
     * assertion above passed over them. Every number above includes them; this
     * one says they were read.
     */
    expect(
      MOMENT_BLOCKS.length,
      'content/quests/ carries no moment line, so the moment half of this census is about nothing',
    ).toBeGreaterThan(0);
    await expect(
      probe,
      'the build examined a different number of moment lines than content/quests/ carries',
    ).toHaveAttribute('data-dialogue-moments', String(MOMENT_BLOCKS.length));

    /* And the reading that ADR-0024 exists for: a filter that stopped matching
       the blocks it reads publishes `examined: 0` beside `refused: 0`, and looks
       exactly like a clean build without this. */
    expect(lines, 'examined would be 0, which is the failure this attribute exists for').toBeGreaterThan(0);
  });
});
