/**
 * Every line a shipped `visit` step is *allowed* to say reaches a screen, and
 * every line it is not says nothing — the corpus half.
 *
 * `tests/unit/bootstrap/a-visit-step-teaches-at-the-landmark.test.ts` is the
 * rule over fixtures, and
 * `tests/unit/bootstrap/a-line-is-said-only-when-verified.test.ts` is the
 * mutation that can never be vacuous. This file is the rule over the documents
 * that **actually ship**: every quest in the tree, every `visit` and `collect`
 * step in it, each one walked through the real controller against its own
 * level's real placements, in English and in French.
 *
 * ## What changed, and why this file was the one that was wrong
 *
 * It used to assert, of every teaching step, that every line in it was drawn.
 * That was true and it was the defect: five of the lines it asserted were drawn
 * are lines a verifier **declined**, and this suite was the thing standing over
 * them saying so. ADR-0003 follows the claim and not the screen it lands on, so
 * the question a corpus test may ask is not "was every line drawn" but "was
 * every line a verifier granted drawn, and was every line a verifier declined
 * not".
 *
 * ## How it avoids passing over nothing
 *
 * The expectation is computed **out of the raw JSON by a different route** from
 * the one the parser takes: this file reads `content/quests/*.json` off the
 * disk and decides, block by block, whether every line in it is granted. It
 * never calls `adjudicateClaim`, `readFactClaim` or `adjudicateQuest`. So when
 * an author fixes one of the five, the expectation moves with the content and
 * nothing here needs editing — and a filter that read the wrong field would
 * disagree with the independent verdict on every block it got wrong.
 *
 * What a corpus test cannot do is prove the mechanism when the corpus happens to
 * be clean. The five rejected lines are being rewritten by an author as this is
 * written, and the day they land fixed this file will assert "0 blocks silenced"
 * and be right to. That is why the mutation suite exists beside it and
 * synthesises its own rejected line.
 *
 * ## What is asserted, against what
 *
 * A granted block: the line's own **text**, from the JSON, found in the rendered
 * dialogue; the speaker's **name**, resolved the way the game resolves it, as
 * the dialog's accessible name; and — on the levels that may draw no figure at
 * any scale — that the speaker is a **landmark** and that no line on them carries
 * an `expression` key at all (ADR-0029 §4).
 *
 * A declined block: the outcome is `unverified` and not `no-dialogue`
 * (ADR-0024 — a silence has to say which silence it is), no dialog is opened at
 * all, and **not one word of the block** is anywhere in the page, in either
 * language. Not one word of the whole block, not only of the refused line: the
 * unit of refusal is the utterance, because the granted lines beside a refused
 * one are its run-up and saying them alone leaves the speaker mid-thought.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { createQuestController } from '../../../app/bootstrap/quest';
import { readQuests } from '../../../app/bootstrap/quests';
import type { SpokenQuest, SpokenStep } from '../../../app/bootstrap/verified-dialogue';
import {
  resolveEngageable,
  type EngageableKind,
  type LevelPlacements,
  levelPlacements,
} from '../../../app/bootstrap/engageables';
import { withQuestState, type Progress } from '@domain/entities/progress';
import { parseLevelDocument } from '@adapters/phaser/level-document';
import { createSettingsStore } from '@ui/settings';
import { UI_LOCALES, type UiLocale } from '@ui/copy';
import type { DialogueLine } from '@application/ports';
import gameConfigJson from '@content/game.config.json';

import { buildPage } from '../ui/support/fake-dom';
import { emptyProgress, ORIGIN, testClock } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const QUESTS_DIR = `${REPO_ROOT}content/quests`;

const MODES: readonly string[] = (gameConfigJson as { locomotionModes: readonly string[] })
  .locomotionModes;

/**
 * A level's placements, through the parser the game uses.
 *
 * Every landmark the level places, through `levelPlacements` — the helper the
 * game calls. A landmark whose blurb a verifier declined has no card, and is
 * still placed and still named: refusing a claim withholds the claim, not the
 * speaker (`a-refused-landmark-keeps-its-quest.test.ts`).
 */
function placementsOf(levelId: string): LevelPlacements {
  const parsed = parseLevelDocument(
    JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${levelId}.json`, 'utf8')),
    MODES,
  );
  if (!parsed.ok) throw new Error(`content/levels/${levelId}.json: ${parsed.error.message}`);
  /* Through the helper the game calls, so this asks the question the game asks:
     every landmark the level places, including one whose claim was refused. */
  const placements = levelPlacements(parsed.value);
  if (placements === null) throw new Error(`content/levels/${levelId}.json: no placements`);
  return placements;
}

const CATALOGUE = readQuests();

/* ------------------------------------------------- the independent verdict --- */

/**
 * What the raw JSON says a block holds, read off the disk.
 *
 * Deliberately not the parser's view. `app/bootstrap/quests.ts` hands out
 * adjudicated quests and could not be used to compute what the adjudication
 * *should* have been without asking the thing under test to mark its own work.
 */
interface RawBlock {
  readonly questId: string;
  readonly stepIndex: number;
  readonly text: readonly { readonly en: string; readonly fr: string }[];
  /** True when every line in the block may be said. Computed here, from scratch. */
  readonly granted: boolean;
}

const raw = (): readonly Record<string, unknown>[] =>
  readdirSync(QUESTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(`${QUESTS_DIR}/${name}`, 'utf8')) as Record<string, unknown>);

/**
 * ADR-0003's three conditions, written out here in full.
 *
 * A fourth restatement of the rule, and that is the point: the seam test
 * (`a-line-is-said-only-when-verified.test.ts`) drives this one and
 * `adjudicateClaim` over the same matrix and fails if they disagree, so this
 * copy cannot drift without something going red, and until then it is an
 * expectation computed by a route the parser never takes.
 */
function lineIsGranted(line: Record<string, unknown>): boolean {
  const fact = line['fact'] as Record<string, unknown> | undefined;
  if (fact === undefined) return false;
  if (fact['factual'] !== true) return true;
  const source = fact['source'] as Record<string, unknown> | null;
  const verification = fact['verification'] as Record<string, unknown> | null;
  if (source === null || verification === null) return false;
  if (verification['status'] !== 'verified') return false;
  if (verification['sourceHash'] !== source['sourceHash']) return false;
  return String(verification['evidence'] ?? '').trim().length > 0;
}

const RAW_BLOCKS: readonly RawBlock[] = raw().flatMap((document) =>
  (document['steps'] as Record<string, unknown>[]).flatMap((step, stepIndex) => {
    const lines = step['dialogue'] as Record<string, unknown>[] | undefined;
    if (lines === undefined || lines.length === 0) return [];
    if (step['kind'] !== 'visit' && step['kind'] !== 'collect') return [];
    return [
      {
        questId: String(document['id']),
        stepIndex,
        text: lines.map((line) => line['text'] as { en: string; fr: string }),
        granted: lines.every((line) => lineIsGranted(line)),
      },
    ];
  }),
);

const GRANTED = RAW_BLOCKS.filter((block) => block.granted);
const DECLINED = RAW_BLOCKS.filter((block) => !block.granted);

/* ---------------------------------------------------------------- the walk --- */

/** Every step a player finishes by arriving somewhere, with the quest it is in. */
interface Arrival {
  readonly quest: SpokenQuest;
  readonly index: number;
  readonly step: SpokenStep;
}

const ARRIVALS: readonly Arrival[] = CATALOGUE.quests.flatMap((quest) =>
  quest.steps.flatMap((step, index) =>
    step.kind === 'visit' || step.kind === 'collect' ? [{ quest, index, step }] : [],
  ),
);

/** The arrivals with lines this build may say. */
const SPEAKING: readonly Arrival[] = ARRIVALS.filter(
  (arrival) => (arrival.step.dialogue?.length ?? 0) > 0,
);

/** The arrivals whose block ADR-0003 left unsaid. */
const SILENCED: readonly Arrival[] = ARRIVALS.filter(
  (arrival) => arrival.step.silenced !== undefined,
);

const blockOf = (arrival: Arrival): RawBlock | undefined =>
  RAW_BLOCKS.find(
    (block) => block.questId === String(arrival.quest.id) && block.stepIndex === arrival.index,
  );

const said = (locale: UiLocale, line: DialogueLine): string =>
  locale === 'fr' ? line.text.fr : line.text.en;

interface Walked {
  readonly outcome: string;
  readonly speaker: string;
  readonly body: string;
  /** Everything the page ended up holding, so "nowhere on the page" is answerable. */
  readonly page: string;
}

/**
 * Walk one arrival: put the player on that step, engage its target, ask for the
 * step's lines, and hand back what the DOM ended up holding.
 */
function walk(arrival: Arrival, locale: UiLocale): Walked {
  const { quest, index, step } = arrival;
  const page = buildPage();
  let progress: Progress = withQuestState(emptyProgress(), quest.levelId, {
    questId: quest.id,
    status: 'active',
    stepIndex: index,
    stepProgress: 0,
    updatedAt: ORIGIN,
  });

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

  const outcome = controller.visited(step.targetId).speak(vi.fn());
  const dialog = page.doc.byTestId('dialogue');
  const speaker =
    dialog === null
      ? ''
      : (page.doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent ?? '');
  return {
    outcome,
    speaker,
    body: page.doc.byTestId('dialogue-text')?.textContent ?? '',
    page: page.host.textContent ?? '',
  };
}

/* --------------------------------------------------------------- the floors --- */

describe('the corpus this suite reads', () => {
  it('is not empty, and holds steps that teach', () => {
    /* ADR-0024's floor, first, because every check below folds an empty list
       into a pass. The count is not pinned — content grows — but zero is not a
       number of teaching steps this game can have. */
    expect(
      CATALOGUE.quests.length,
      'no quest was read: everything below is vacuous',
    ).toBeGreaterThan(0);
    expect(CATALOGUE.refused, CATALOGUE.refused.join('\n')).toEqual([]);
    expect(ARRIVALS.length, 'no quest asks the player to go anywhere').toBeGreaterThan(0);
    expect(
      RAW_BLOCKS.length,
      'not one visit step in content/quests/ carries dialogue, so this suite proves nothing',
    ).toBeGreaterThan(0);
  });

  it('was examined by the filter, rather than passed over by it', () => {
    /*
     * The census, not the outcome. A filter that stopped matching the blocks it
     * reads leaves every line drawn and every assertion below green, and reports
     * `examined: 0`. This is the only check here that can see that.
     */
    expect(CATALOGUE.census.quests).toBe(CATALOGUE.quests.length);
    expect(
      CATALOGUE.census.examined,
      'the dialogue filter examined nothing across a build with quests in it',
    ).toBeGreaterThan(0);
    expect(CATALOGUE.census.utterances).toBeGreaterThan(0);
    expect(CATALOGUE.census.examined).toBe(
      CATALOGUE.census.drawable + CATALOGUE.census.refused.length,
    );
  });
});

/* ------------------------------------------------------------ the agreement --- */

describe('the parser and an independent reading of the JSON agree', () => {
  it('silences exactly the blocks whose lines are not all granted', () => {
    const disagreements: string[] = [];

    for (const arrival of ARRIVALS) {
      const block = blockOf(arrival);
      if (block === undefined) {
        if (arrival.step.dialogue !== undefined || arrival.step.silenced !== undefined) {
          disagreements.push(
            `${String(arrival.quest.id)} / ${arrival.step.id}: the parser holds a block the JSON does not`,
          );
        }
        continue;
      }
      const spoken = arrival.step.dialogue !== undefined;
      const silenced = arrival.step.silenced !== undefined;
      if (spoken === silenced) {
        disagreements.push(
          `${String(arrival.quest.id)} / ${arrival.step.id}: a block must be one of spoken or silenced, not both or neither`,
        );
        continue;
      }
      if (spoken !== block.granted) {
        disagreements.push(
          `${String(arrival.quest.id)} / ${arrival.step.id}: the JSON says granted=${String(
            block.granted,
          )} and the parser says spoken=${String(spoken)}`,
        );
      }
    }

    expect(disagreements, disagreements.join('\n')).toEqual([]);
  });

  it('counts the same refusals the JSON does', () => {
    /* Line-level, where the block-level check above is block-level. A filter
       that silenced the right blocks for the wrong lines would pass that one. */
    const refusedInJson = raw().flatMap((document) =>
      (document['steps'] as Record<string, unknown>[]).flatMap((step, stepIndex) =>
        ((step['dialogue'] as Record<string, unknown>[] | undefined) ?? []).flatMap(
          (line, lineIndex) =>
            lineIsGranted(line)
              ? []
              : [`${String(document['id'])}#/steps/${String(stepIndex)}/dialogue/${String(lineIndex)}`],
        ),
      ),
    );

    expect([...CATALOGUE.census.refused].map((claim) => claim.pointer).sort()).toEqual(
      [...refusedInJson].sort(),
    );
  });
});

/* -------------------------------------------------------------- the granted --- */

describe('every teaching step this build is allowed to speak is spoken', () => {
  it('has some, or the half below is about nothing', () => {
    expect(
      GRANTED.length,
      'every teaching block in content/quests/ holds a line a verifier declined',
    ).toBeGreaterThan(0);
    expect(SPEAKING.length).toBe(GRANTED.length);
  });

  it('says every line, in both languages, under the speaker’s own name', () => {
    const dropped: string[] = [];

    for (const arrival of SPEAKING) {
      for (const locale of UI_LOCALES) {
        const { outcome, speaker, body } = walk(arrival, locale);
        const where = `${String(arrival.quest.id)} / ${arrival.step.id} [${locale}]`;

        if (outcome !== 'spoken') {
          dropped.push(`${where}: carries dialogue and answered "${outcome}" instead of speaking`);
          continue;
        }
        if (speaker.trim() === '') {
          dropped.push(`${where}: opened a dialog with no accessible name`);
        }
        for (const line of arrival.step.dialogue ?? []) {
          if (!body.includes(said(locale, line))) {
            dropped.push(`${where}: "${said(locale, line)}" was not drawn`);
          }
        }
      }
    }

    expect(dropped, dropped.join('\n')).toEqual([]);
  });

  it('names the speaker from the document that names it, never from the id', () => {
    const wrong: string[] = [];

    for (const arrival of SPEAKING) {
      const speakers = new Set((arrival.step.dialogue ?? []).map((line) => String(line.speaker)));
      for (const id of speakers) {
        const resolution = resolveEngageable(placementsOf(String(arrival.quest.levelId)), id);
        if (!resolution.ok) {
          wrong.push(`${String(arrival.quest.id)} / ${arrival.step.id}: "${id}" is ${resolution.why}`);
          continue;
        }
        const { speaker } = walk(arrival, 'en');
        if (speaker === id) {
          wrong.push(`${String(arrival.quest.id)} / ${arrival.step.id}: announced as the raw id`);
        }
      }
    }

    expect(wrong, wrong.join('\n')).toEqual([]);
  });
});

/* ------------------------------------------------------------- the declined --- */

describe('a teaching step holding a line a verifier declined says nothing at all', () => {
  it('matches the blocks an independent reading of the JSON declines', () => {
    /*
     * Not a floor. The five live rejections are being rewritten by an author,
     * and the day they land fixed this suite is right to find none — which is
     * exactly why the mechanism is proved by mutation in
     * `a-line-is-said-only-when-verified.test.ts` and not here.
     */
    expect(SILENCED.length).toBe(DECLINED.length);
  });

  it('answers "unverified" and not "no-dialogue", so the silence says which it is', () => {
    for (const arrival of SILENCED) {
      for (const locale of UI_LOCALES) {
        const { outcome } = walk(arrival, locale);
        expect(outcome, `${String(arrival.quest.id)} / ${arrival.step.id} [${locale}]`).toBe(
          'unverified',
        );
      }
    }
  });

  it('opens no dialog and puts no word of the block on the page', () => {
    const leaked: string[] = [];

    for (const arrival of SILENCED) {
      const block = blockOf(arrival);
      expect(block, `${String(arrival.quest.id)} / ${arrival.step.id}`).toBeDefined();
      for (const locale of UI_LOCALES) {
        const { speaker, body, page } = walk(arrival, locale);
        const where = `${String(arrival.quest.id)} / ${arrival.step.id} [${locale}]`;
        if (speaker !== '' || body !== '') leaked.push(`${where}: a dialog opened`);
        for (const line of block?.text ?? []) {
          /* Every line in the block, granted or refused. The unit is the
             utterance: a speaker who says the run-up and stops is a second
             defect introduced to fix the first. */
          const sentence = locale === 'fr' ? line.fr : line.en;
          if (page.includes(sentence)) leaked.push(`${where}: "${sentence}" reached the page`);
        }
      }
    }

    expect(leaked, leaked.join('\n')).toEqual([]);
  });

  it('still advances the step, so the level can be finished', () => {
    for (const arrival of SILENCED) {
      const outcome = (() => {
        const page = buildPage();
        let progress: Progress = withQuestState(emptyProgress(), arrival.quest.levelId, {
          questId: arrival.quest.id,
          status: 'active',
          stepIndex: arrival.index,
          stepProgress: 0,
          updatedAt: ORIGIN,
        });
        const owed = vi.fn();
        const controller = createQuestController({
          levelId: arrival.quest.levelId,
          quests: [arrival.quest],
          placements: () => placementsOf(String(arrival.quest.levelId)),
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
        const visit = controller.visited(arrival.step.targetId);
        visit.speak(owed);
        return { advanced: visit.advanced, owed: owed.mock.calls.length };
      })();

      /* A refused blurb does not remove the landmark; a refused line does not
         remove the step. What is lost is the teaching, and the question that
         follows it is still owed exactly once. */
      expect(outcome.advanced, `${String(arrival.quest.id)} / ${arrival.step.id}`).toBe(true);
      expect(outcome.owed, `${String(arrival.quest.id)} / ${arrival.step.id}`).toBe(1);
    }
  });
});

describe('the levels that may draw no figure speak as themselves', () => {
  /**
   * The levels whose teaching lines are spoken by a **landmark**, found by
   * asking the level document what it placed rather than by listing two ids.
   *
   * Peggy's Cove and the North are the two today. The membership is deliberately
   * not pinned: a third level that places a talking plaque should be covered by
   * this the day it lands, and a level that stops having one should not leave a
   * test asserting something about nobody.
   */
  const byLandmark = SPEAKING.filter((arrival) =>
    (arrival.step.dialogue ?? []).some((line) => {
      const resolution = resolveEngageable(
        placementsOf(String(arrival.quest.levelId)),
        String(line.speaker),
      );
      const kind: EngageableKind | undefined = resolution.ok ? resolution.engageable.kind : undefined;
      return kind === 'landmark';
    }),
  );

  it('has some, or this scenario is about nothing', () => {
    expect(
      byLandmark.length,
      'no shipped quest teaches in a landmark’s own voice, so ADR-0029 has no live case here',
    ).toBeGreaterThan(0);
  });

  it('carries no expression on any line, so nothing can reach for a pose', () => {
    /*
     * Absent, not `undefined`. `readQuest` leaves the key off, and a `visit`
     * step's lines go through the same reader as a `talk` step's — which is why
     * this is asserted over the parsed documents the controller was handed, not
     * over the raw JSON.
     */
    const posed = byLandmark.flatMap((arrival) =>
      (arrival.step.dialogue ?? [])
        .filter((line) => Object.hasOwn(line, 'expression'))
        .map((line) => `${String(arrival.quest.id)} / ${arrival.step.id}: ${String(line.speaker)}`),
    );
    expect(posed, posed.join('\n')).toEqual([]);
  });

  it('is named by its level’s own pois[].name when it speaks', () => {
    for (const arrival of byLandmark) {
      const { outcome, speaker } = walk(arrival, 'en');
      expect(outcome, `${String(arrival.quest.id)} / ${arrival.step.id}`).toBe('spoken');

      const id = String(arrival.step.dialogue?.[0]?.speaker ?? '');
      const resolution = resolveEngageable(placementsOf(String(arrival.quest.levelId)), id);
      expect(resolution.ok && resolution.engageable.kind).toBe('landmark');
      expect(resolution.ok && resolution.engageable.name.en).toBe(speaker);
    }
  });
});
