/**
 * Every moment line a shipped quest is allowed to say reaches the player at its
 * moment, and every one it is not allowed to say is silent — the corpus half.
 *
 * `tests/unit/bootstrap/a-moment-line-is-said-only-when-verified.test.ts` is the
 * rule over synthesised documents and cannot be vacuous. This file is the rule
 * over the documents that **ship**: every quest in `content/quests/`, all four
 * moment lines, each walked through the real controller against its own level's
 * real placements, in English and in French.
 *
 * ## The defect it exists for
 *
 * Every quest carries `declinedLine`, `reminderLine`, `afterLine` and `doneLine`
 * (`TN-DIALOGUE-what-a-quest-giver-says.md`). The port declared them, the schema
 * validated them, the verifier granted them, and nothing in `app/` read them:
 * declining said nothing, coming back mid-quest read the step prompt aloud,
 * coming back afterwards read the present-tense summary, and `verify-content`
 * counted 132 quest claims while the runtime examined 92.
 *
 * ## How it avoids passing over nothing
 *
 * The expectation is computed **from the raw JSON by a different route** from
 * the one the game takes: which lines are granted is decided here from the
 * `fact` block's own fields, and who says a line is decided here by reading the
 * level document and `content/characters/` directly. The only thing imported
 * from the code under test to compute an expectation is the list of field names.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  completionLine,
  createQuestController,
  momentSpeech,
  type QuestController,
  type SpokenMoment,
} from '../../../app/bootstrap/quest';
import { readQuests } from '../../../app/bootstrap/quests';
import {
  QUEST_MOMENTS,
  type QuestMoment,
  type SpokenQuest,
} from '../../../app/bootstrap/verified-dialogue';
import { levelPlacements, type LevelPlacements } from '../../../app/bootstrap/engageables';
import { withQuestState, type Progress } from '@domain/entities/progress';
import { parseLevelDocument } from '@adapters/phaser/level-document';
import { createSettingsStore } from '@ui/settings';
import { UI_LOCALES, type UiLocale } from '@ui/copy';
import gameConfigJson from '@content/game.config.json';

import { buildPage, type FakePage } from '../ui/support/fake-dom';
import { emptyProgress, ORIGIN, testClock } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const MODES: readonly string[] = (gameConfigJson as { locomotionModes: readonly string[] })
  .locomotionModes;

/* ------------------------------------------------------ the raw documents --- */

interface RawText {
  readonly en: string;
  readonly fr: string;
}

interface RawLine {
  readonly speaker: string;
  readonly text: RawText;
  readonly fact: Record<string, unknown>;
  readonly expression?: string;
}

type RawQuest = {
  readonly id: string;
  readonly levelId: string;
  readonly giver: string;
  readonly summary: RawText;
  readonly steps: readonly { readonly kind: string; readonly dialogue?: readonly RawLine[] }[];
} & { readonly [M in QuestMoment]?: RawLine };

const json = (path: string): unknown =>
  JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as unknown;

const RAW_QUESTS: readonly RawQuest[] = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => json(`content/quests/${name}`) as RawQuest);

/**
 * ADR-0003's three conditions, written out here in full, by a route the parser
 * never takes. The same restatement `every-visit-line-reaches-the-player.test.ts`
 * carries, and `a-line-is-said-only-when-verified.test.ts` drives the real rule
 * over the matrix that would catch this copy drifting.
 */
function lineIsGranted(line: RawLine): boolean {
  const fact = line.fact;
  if (fact['factual'] !== true) return true;
  const source = fact['source'] as Record<string, unknown> | null;
  const verification = fact['verification'] as Record<string, unknown> | null;
  if (source === null || verification === null) return false;
  if (verification['status'] !== 'verified') return false;
  if (verification['sourceHash'] !== source['sourceHash']) return false;
  return String(verification['evidence'] ?? '').trim().length > 0;
}

/** Who says a line, read off the level and the character documents directly. */
function expectedSpeaker(
  levelId: string,
  id: string,
): { readonly kind: 'character' | 'landmark'; readonly name: RawText } | null {
  const level = json(`content/levels/${levelId}.json`) as {
    readonly pois: readonly { readonly id: string; readonly name: RawText }[];
    readonly characters: readonly { readonly characterId: string }[];
  };
  const pois = level.pois.filter((poi) => poi.id === id);
  const characters = level.characters.filter((character) => character.characterId === id);
  if (pois.length + characters.length !== 1) return null;
  const [poi] = pois;
  if (poi !== undefined) return { kind: 'landmark', name: poi.name };
  const document = json(`content/characters/${id}.json`) as { readonly name: RawText };
  return { kind: 'character', name: document.name };
}

interface RawMoment {
  readonly quest: RawQuest;
  readonly moment: QuestMoment;
  readonly line: RawLine;
  readonly granted: boolean;
}

const RAW_MOMENTS: readonly RawMoment[] = RAW_QUESTS.flatMap((quest) =>
  QUEST_MOMENTS.flatMap((moment) => {
    const line = quest[moment];
    return line === undefined ? [] : [{ quest, moment, line, granted: lineIsGranted(line) }];
  }),
);

/* ------------------------------------------------------------- the game --- */

const CATALOGUE = readQuests();

const spokenQuest = (id: string): SpokenQuest => {
  const found = CATALOGUE.quests.find((quest) => String(quest.id) === id);
  if (found === undefined) throw new Error(`content/quests/: "${id}" did not load`);
  return found;
};

function placementsOf(levelId: string): LevelPlacements {
  const parsed = parseLevelDocument(json(`content/levels/${levelId}.json`), MODES);
  if (!parsed.ok) throw new Error(`content/levels/${levelId}.json: ${parsed.error.message}`);
  const placements = levelPlacements(parsed.value);
  if (placements === null) throw new Error(`content/levels/${levelId}.json: no placements`);
  return placements;
}

type State = 'on-offer' | 'active' | 'completed';

function progressIn(quest: SpokenQuest, state: State): Progress {
  if (state === 'on-offer') return emptyProgress();
  return withQuestState(emptyProgress(), quest.levelId, {
    questId: quest.id,
    status: state,
    stepIndex: state === 'active' ? 1 : quest.steps.length - 1,
    stepProgress: 0,
    updatedAt: ORIGIN,
  });
}

interface Harness {
  readonly page: FakePage;
  readonly controller: QuestController;
}

function harness(quest: SpokenQuest, state: State, locale: UiLocale): Harness {
  const page = buildPage();
  let progress = progressIn(quest, state);
  const controller = createQuestController({
    levelId: quest.levelId,
    quests: [quest],
    placements: () => placementsOf(String(quest.levelId)),
    host: page.host,
    store: createSettingsStore(),
    clock: testClock(),
    announce: vi.fn(),
    progress: () => progress,
    commit: (next) => {
      progress = next;
    },
    setTask: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    restoreFocusTo: () => null,
  });
  controller.setLocale(locale);
  return { page, controller };
}

interface Seen {
  readonly open: boolean;
  readonly speaker: string;
  readonly body: string;
  readonly page: string;
  readonly controls: readonly string[];
}

function seen(page: FakePage): Seen {
  const dialog = page.doc.byTestId('dialogue');
  const everything = page.host.textContent ?? '';
  const controls = ['dialogue-accept', 'dialogue-decline', 'dialogue-next'].filter(
    (id) => page.doc.byTestId(id) !== null,
  );
  if (dialog === null || dialog.hidden) {
    return { open: false, speaker: '', body: '', page: everything, controls };
  }
  return {
    open: true,
    speaker:
      page.doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent ?? '',
    body: page.doc.byTestId('dialogue-text')?.textContent ?? '',
    page: everything,
    controls,
  };
}

/** Run with `console.error` held, so a refused line's sentence does not fill the log. */
function quietly<T>(run: () => T): T {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

const said = (text: RawText, locale: UiLocale): string => (locale === 'fr' ? text.fr : text.en);

/* ----------------------------------------------------------- the floors --- */

describe('the moment lines this suite reads', () => {
  it('exist, and every quest they sit in loaded', () => {
    /* ADR-0024's floor: every check below folds an empty corpus into a pass. */
    expect(RAW_QUESTS.length, 'content/quests/ is empty').toBeGreaterThan(0);
    expect(RAW_MOMENTS.length, 'no shipped quest carries a moment line').toBeGreaterThan(0);
    expect(CATALOGUE.refused, CATALOGUE.refused.join('\n')).toEqual([]);
    expect(CATALOGUE.quests.map((quest) => String(quest.id)).sort()).toEqual(
      RAW_QUESTS.map((quest) => quest.id).sort(),
    );
  });

  it('were all examined by the filter, which is the 40 the census used to leave out', () => {
    expect(
      CATALOGUE.census.moments,
      'the dialogue filter examined a different number of moment lines than content/quests/ carries',
    ).toBe(RAW_MOMENTS.length);

    const refusedHere = RAW_MOMENTS.filter((entry) => !entry.granted)
      .map((entry) => `${entry.quest.id}#/${entry.moment}/0`)
      .sort();
    const refusedByTheGame = CATALOGUE.census.refused
      .map((claim) => claim.pointer)
      .filter((pointer) => QUEST_MOMENTS.some((moment) => pointer.includes(`#/${moment}/`)))
      .sort();
    expect(refusedByTheGame).toEqual(refusedHere);
  });

  it('are carried spoken or silenced exactly as an independent reading of the JSON says', () => {
    const disagreements: string[] = [];
    for (const entry of RAW_MOMENTS) {
      const quest = spokenQuest(entry.quest.id);
      const spoken = quest[entry.moment] !== undefined;
      const silenced = quest.momentsSilenced?.[entry.moment] !== undefined;
      const where = `${entry.quest.id} ${entry.moment}`;
      if (spoken === silenced) disagreements.push(`${where}: spoken=${String(spoken)} silenced=${String(silenced)}`);
      else if (spoken !== entry.granted) {
        disagreements.push(`${where}: the JSON says granted=${String(entry.granted)}`);
      }
    }
    expect(disagreements, disagreements.join('\n')).toEqual([]);
  });

  it('name a speaker the level places, for every moment a dialog would open for', () => {
    const unplaced = RAW_MOMENTS.filter(
      (entry) => expectedSpeaker(entry.quest.levelId, entry.line.speaker) === null,
    ).map((entry) => `${entry.quest.id} ${entry.moment}: "${entry.line.speaker}"`);
    expect(unplaced, unplaced.join('\n')).toEqual([]);
  });
});

/* ------------------------------------------------------ the three spoken --- */

/**
 * What each spoken moment must look like on screen, or the silence it must be.
 * Shared by the three walks so their assertions cannot drift apart.
 */
function judge(
  problems: string[],
  where: string,
  view: Seen,
  raw: RawLine | undefined,
  levelId: string,
  locale: UiLocale,
): void {
  if (raw !== undefined && lineIsGranted(raw)) {
    const speaker = expectedSpeaker(levelId, raw.speaker);
    if (!view.open) {
      problems.push(`${where}: a granted line and no dialog opened`);
      return;
    }
    if (view.body !== said(raw.text, locale)) {
      problems.push(`${where}: said "${view.body}", not the line and only the line`);
    }
    if (speaker === null || view.speaker !== said(speaker.name, locale)) {
      problems.push(`${where}: named "${view.speaker}"`);
    }
    if (view.controls.join(',') !== 'dialogue-next') {
      problems.push(`${where}: offered ${view.controls.join(', ')} rather than one way onward`);
    }
    return;
  }
  if (view.open) problems.push(`${where}: nothing may be said here and a dialog opened`);
  if (raw !== undefined && (view.page.includes(raw.text.en) || view.page.includes(raw.text.fr))) {
    problems.push(`${where}: a line a verifier did not grant reached the page`);
  }
}

describe('declinedLine — after "Not now"', () => {
  it('is said in the speaker’s own name, in both languages, or nothing is', () => {
    const problems: string[] = [];

    for (const raw of RAW_QUESTS) {
      const quest = spokenQuest(raw.id);
      for (const locale of UI_LOCALES) {
        const where = `${raw.id} declinedLine [${locale}]`;
        const { page, controller } = harness(quest, 'on-offer', locale);
        if (!quietly(() => controller.engage(raw.giver))) {
          problems.push(`${where}: the offer could not be opened, so "Not now" cannot be reached`);
          continue;
        }
        const decline = page.doc.byTestId('dialogue-decline');
        if (decline === null) {
          problems.push(`${where}: the offer had no "Not now"`);
          continue;
        }
        quietly(() => {
          decline.click();
        });
        judge(problems, where, seen(page), raw.declinedLine, raw.levelId, locale);

        /* And it closes, back into a level that can offer the quest again. */
        page.doc.byTestId('dialogue-next')?.click();
        if (seen(page).open) problems.push(`${where}: the answer to "Not now" would not close`);
        if (!controller.canEngage(raw.giver)) {
          problems.push(`${where}: declining took the offer away`);
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('reminderLine — coming back mid-quest', () => {
  it('is said instead of the step prompt, never beside it, or nothing is said', () => {
    const problems: string[] = [];

    for (const raw of RAW_QUESTS) {
      const quest = spokenQuest(raw.id);
      for (const locale of UI_LOCALES) {
        const where = `${raw.id} reminderLine [${locale}]`;
        const { page, controller } = harness(quest, 'active', locale);
        const granted = raw.reminderLine !== undefined && lineIsGranted(raw.reminderLine);

        if (controller.canEngage(raw.giver) !== granted) {
          problems.push(`${where}: canEngage is ${String(!granted)} with granted=${String(granted)}`);
        }
        const opened = quietly(() => controller.engage(raw.giver));
        if (opened !== granted) problems.push(`${where}: engage answered ${String(opened)}`);
        /* `judge` requires the body to be exactly the line, which is what proves
           the step prompt was not read out beside it. */
        judge(problems, where, seen(page), raw.reminderLine, raw.levelId, locale);
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('afterLine — coming back after the quest is complete', () => {
  it('is said every time the finished giver is engaged, and the summary never is', () => {
    const problems: string[] = [];

    for (const raw of RAW_QUESTS) {
      const quest = spokenQuest(raw.id);
      for (const locale of UI_LOCALES) {
        const where = `${raw.id} afterLine [${locale}]`;
        const { page, controller } = harness(quest, 'completed', locale);

        for (const time of ['first', 'second'] as const) {
          quietly(() => controller.engage(raw.giver));
          const view = seen(page);
          judge(problems, `${where} (${time} time)`, view, raw.afterLine, raw.levelId, locale);
          if (view.body.includes(said(raw.summary, locale))) {
            problems.push(`${where} (${time} time): the present-tense summary was read back`);
          }
          page.doc.byTestId('dialogue-next')?.click();
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });
});

/* ------------------------------------------------------ the card's line --- */

describe('doneLine — the completion card', () => {
  it('is the quest’s own words when the quest finished the level, in both languages', () => {
    const problems: string[] = [];
    for (const raw of RAW_QUESTS) {
      const line = completionLine({ by: 'quest', quest: spokenQuest(raw.id) });
      const granted = raw.doneLine !== undefined && lineIsGranted(raw.doneLine);
      if (raw.doneLine === undefined) {
        if (line.said !== 'no-line') problems.push(`${raw.id}: no doneLine and "${line.said}"`);
      } else if (granted) {
        if (line.said !== 'spoken') problems.push(`${raw.id}: a granted doneLine is "${line.said}"`);
        else if (line.text.en !== raw.doneLine.text.en || line.text.fr !== raw.doneLine.text.fr) {
          problems.push(`${raw.id}: the card line is not the document's doneLine`);
        }
      } else if (line.said !== 'unverified') {
        problems.push(`${raw.id}: a refused doneLine is "${line.said}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('is not drawn when the level was finished by reaching its end', () => {
    for (const raw of RAW_QUESTS) {
      expect(completionLine({ by: 'level' }).said, raw.id).toBe('other-route');
    }
  });
});

/* ---------------------------------------------------- landmark speakers --- */

describe('a landmark’s moment lines', () => {
  const BY_LANDMARK = RAW_MOMENTS.filter(
    (entry) => expectedSpeaker(entry.quest.levelId, entry.line.speaker)?.kind === 'landmark',
  );

  it('exist in the shipped build, or this scenario is about nothing', () => {
    expect(
      BY_LANDMARK.length,
      'no shipped moment line is spoken by a landmark, so ADR-0029 has no live case here',
    ).toBeGreaterThan(0);
  });

  it('carry no expression, in the document or once parsed, so nothing can ask for a face', () => {
    const posed: string[] = [];
    for (const entry of BY_LANDMARK) {
      const where = `${entry.quest.id} ${entry.moment}`;
      if (Object.hasOwn(entry.line, 'expression')) posed.push(`${where}: in the document`);
      const parsed = spokenQuest(entry.quest.id)[entry.moment];
      if (parsed !== undefined && Object.hasOwn(parsed, 'expression')) {
        posed.push(`${where}: once parsed`);
      }
    }
    expect(posed, posed.join('\n')).toEqual([]);
  });

  it('are resolved as a landmark and named by the level’s own pois[].name', () => {
    const wrong: string[] = [];
    for (const entry of BY_LANDMARK) {
      if (entry.moment === 'doneLine' || !entry.granted) continue;
      const speech = momentSpeech(
        spokenQuest(entry.quest.id),
        entry.moment as SpokenMoment,
        placementsOf(entry.quest.levelId),
        entry.quest.levelId,
      );
      const expected = expectedSpeaker(entry.quest.levelId, entry.line.speaker);
      const where = `${entry.quest.id} ${entry.moment}`;
      if (speech.said !== 'spoken') {
        wrong.push(`${where}: "${speech.said}"`);
        continue;
      }
      if (speech.speaker.kind !== 'landmark') wrong.push(`${where}: resolved as ${speech.speaker.kind}`);
      if (
        expected === null ||
        speech.speaker.name.en !== expected.name.en ||
        speech.speaker.name.fr !== expected.name.fr
      ) {
        wrong.push(`${where}: named ${JSON.stringify(speech.speaker.name)}`);
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
  });
});

describe('the card line of a quest a landmark gives does not name the landmark', () => {
  /**
   * `TN-NORTH-05`'s scenario, "the giver's own last line names no landmark
   * either", which is written for English and lists the words; and `TN-DONE`'s
   * rule 2 in general form — a point-of-interest giver does not name itself.
   */
  const STORY_WORDS: Readonly<Record<string, readonly string[]>> = {
    'the-north': ['sternwheeler', 'Yukon', 'Whitehorse'],
    'peggys-cove': ['lighthouse', "Peggy's Point"],
  };

  const LANDMARK_QUESTS = RAW_QUESTS.filter(
    (quest) => expectedSpeaker(quest.levelId, quest.giver)?.kind === 'landmark',
  );

  it('has quests to check', () => {
    expect(LANDMARK_QUESTS.length).toBeGreaterThan(0);
  });

  it('carries neither the giver’s own name nor, in English, any word the level stories list', () => {
    const named: string[] = [];
    for (const quest of LANDMARK_QUESTS) {
      const done = quest.doneLine;
      const giver = expectedSpeaker(quest.levelId, quest.giver);
      if (done === undefined || giver === null) continue;
      for (const locale of UI_LOCALES) {
        if (said(done.text, locale).toLowerCase().includes(said(giver.name, locale).toLowerCase())) {
          named.push(`${quest.id} [${locale}]: names "${said(giver.name, locale)}"`);
        }
      }
      for (const word of STORY_WORDS[quest.levelId] ?? []) {
        if (done.text.en.toLowerCase().includes(word.toLowerCase())) {
          named.push(`${quest.id} [en]: contains "${word}"`);
        }
      }
    }
    expect(named, named.join('\n')).toEqual([]);
  });
});
