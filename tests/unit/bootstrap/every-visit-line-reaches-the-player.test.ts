/**
 * Every line a shipped `visit` step carries reaches a screen — the corpus half.
 *
 * `tests/unit/bootstrap/a-visit-step-teaches-at-the-landmark.test.ts` is the
 * rule, over fixtures that exist whether or not `content/quests/` ever holds a
 * teaching step. This file is the same rule over the documents that **actually
 * ship**: every quest in the tree, every `visit` and `collect` step in it, each
 * one walked through the real controller against its own level's real
 * placements, in English and in French.
 *
 * ## Why both, and why this one cannot be the only one
 *
 * There are 27 live `visit` steps and all 27 carry dialogue, so this file would
 * be silent about the *other* half of ADR-0024 — what a step with no lines does
 * — and the day a quiet step is authored it would pass over it saying nothing.
 * That half is the fixture file's. What that file cannot do is notice a step
 * whose lines are in the tree and never reach a player, because a fixture proves
 * a mechanism and only the corpus proves the content is wired to it.
 *
 * This is the file that would have been red on the day the 27 lines landed.
 *
 * ## What is asserted, against what
 *
 * The line's own **text**, from the JSON, found in the rendered dialogue; the
 * speaker's **name**, resolved the way the game resolves it, as the dialog's
 * accessible name; and — on the two levels that may draw no figure at any scale
 * — that the speaker is a **landmark** and that no line on them carries an
 * `expression` key at all (ADR-0029 §4).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { createQuestController } from '../../../app/bootstrap/quest';
import { readQuests } from '../../../app/bootstrap/quests';
import {
  resolveEngageable,
  type EngageableKind,
  type LevelPlacements,
} from '../../../app/bootstrap/engageables';
import { withQuestState, type Progress } from '@domain/entities/progress';
import { parseLevelDocument } from '@adapters/phaser/level-document';
import { createSettingsStore } from '@ui/settings';
import { UI_LOCALES, type UiLocale } from '@ui/copy';
import type { DialogueLine, QuestDocument, QuestStepDocument } from '@application/ports';
import gameConfigJson from '@content/game.config.json';

import { buildPage } from '../ui/support/fake-dom';
import { emptyProgress, ORIGIN, testClock } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const MODES: readonly string[] = (gameConfigJson as { locomotionModes: readonly string[] })
  .locomotionModes;

/**
 * A level's placements, through the parser the game uses.
 *
 * `teachingPois`, never `pois`: a landmark whose blurb a verifier declined is
 * not engageable at run time (ADR-0003), so a speaker that is one could not be
 * named — and a test that read the raw JSON would say it could.
 */
function placementsOf(levelId: string): LevelPlacements {
  const parsed = parseLevelDocument(
    JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${levelId}.json`, 'utf8')),
    MODES,
  );
  if (!parsed.ok) throw new Error(`content/levels/${levelId}.json: ${parsed.error.message}`);
  return { pois: parsed.value.teachingPois, characters: parsed.value.characters };
}

const CATALOGUE = readQuests();

/** Every step a player finishes by arriving somewhere, with the quest it is in. */
interface Arrival {
  readonly quest: QuestDocument;
  readonly index: number;
  readonly step: QuestStepDocument;
}

const ARRIVALS: readonly Arrival[] = CATALOGUE.quests.flatMap((quest) =>
  quest.steps.flatMap((step, index) =>
    step.kind === 'visit' || step.kind === 'collect' ? [{ quest, index, step }] : [],
  ),
);

/** The arrivals that were written with something to teach. */
const TEACHING: readonly Arrival[] = ARRIVALS.filter(
  (arrival) => (arrival.step.dialogue?.length ?? 0) > 0,
);

const said = (locale: UiLocale, line: DialogueLine): string =>
  locale === 'fr' ? line.text.fr : line.text.en;

/**
 * Walk one arrival: put the player on that step, engage its target, ask for the
 * step's lines, and hand back what the DOM ended up holding.
 */
function walk(
  arrival: Arrival,
  locale: UiLocale,
): { readonly outcome: string; readonly speaker: string; readonly body: string } {
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
  return { outcome, speaker, body: page.doc.byTestId('dialogue-text')?.textContent ?? '' };
}

describe('every teaching step this build ships is spoken', () => {
  it('reads a corpus that is not empty, and holds steps that teach', () => {
    /* ADR-0024's floor, first, because every check below folds an empty list
       into a pass. The count is not pinned — content grows — but zero is not a
       number of teaching steps this game can have. */
    expect(CATALOGUE.quests.length, 'no quest was read: everything below is vacuous').toBeGreaterThan(0);
    expect(CATALOGUE.refused, CATALOGUE.refused.join('\n')).toEqual([]);
    expect(ARRIVALS.length, 'no quest asks the player to go anywhere').toBeGreaterThan(0);
    expect(
      TEACHING.length,
      'not one visit step in content/quests/ carries dialogue, so this suite proves nothing',
    ).toBeGreaterThan(0);
  });

  it('says every line, in both languages, under the speaker’s own name', () => {
    const dropped: string[] = [];

    for (const arrival of TEACHING) {
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

    for (const arrival of TEACHING) {
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
  const byLandmark = TEACHING.filter((arrival) =>
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
