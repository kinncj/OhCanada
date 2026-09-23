/**
 * One engagement of a landmark finishes every arrival step in a row that names
 * it, and hands back all of what they had to say (ADR-0067).
 *
 * ## The defect
 *
 * `QuestController.visited` advanced exactly one step. A quest written
 * `visit locks → read locks → answer` therefore finished the visit, left the
 * `read` step current while the player stood at the locks, drew a question for
 * no task, and waited for a second tap on a landmark whose card had just been
 * read. The one-sitting walk models one engagement per stop and reported the
 * quest stuck, which is why the first `read` step had to be given a stop of its
 * own (Dow's Lake). That capped reading at the stops a level has spare — none,
 * on seven of the ten.
 *
 * ## What is pinned
 *
 *  1. Every consecutive `visit`/`collect`/`read` step naming the engaged target
 *     is finished, in order, by the one call — and no further: an `answer`
 *     step, a step elsewhere and a `talk` step all stop it.
 *  2. The passages of every `read` step in the run come back together, in step
 *     order, so the chain stays card → passages → lines → question.
 *  3. Every step's lines are said, in step order, and the caller's continuation
 *     is paid exactly once, after the last.
 *  4. A run that finishes the quest earns the stamp once.
 */

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestController } from '../../../app/bootstrap/quest';
import { readQuest } from '../../../app/bootstrap/quests';
import {
  adjudicateQuest,
  createDialogueLedger,
  type SpokenQuest,
} from '../../../app/bootstrap/verified-dialogue';
import type { LevelPlacements } from '../../../app/bootstrap/engageables';
import { questStateFor, withQuestState, type Progress } from '@domain/entities/progress';
import { createSettingsStore } from '@ui/settings';
import { buildPage, type FakePage } from '../ui/support/fake-dom';
import { emptyProgress, flavourFact, ORIGIN, testClock, text as localised } from '../support/fixtures';

const BLURB = localised('A true, short thing.', 'Une chose vraie et courte.');

const OTTAWA: LevelPlacements = {
  characters: [{ characterId: 'officer' }],
  pois: [
    { id: 'rideau-locks', name: localised('The Rideau locks', 'Les écluses Rideau'), blurb: BLURB },
    { id: 'dows-lake', name: localised('Dow’s Lake', 'Le lac Dow'), blurb: BLURB },
  ],
};

const line = (en: string): Record<string, unknown> => ({
  speaker: 'officer',
  text: { en, fr: `${en} (fr)` },
  fact: flavourFact(),
});

const FIRST = { lesson: 'govern-01', passage: 'p1' };
const SECOND = { lesson: 'govern-01', passage: 'p2' };
const THIRD = { lesson: 'govern-02', passage: 'p1' };

const prompt = (en: string) => ({ en, fr: `${en} (fr)` });

const visitStep = (id: string, targetId: string, lines?: readonly string[]) => ({
  id,
  kind: 'visit',
  targetId,
  prompt: prompt(`Go to ${targetId}`),
  ...(lines === undefined ? {} : { dialogue: lines.map(line) }),
});
const readStep = (id: string, targetId: string, passages: readonly object[]) => ({
  id,
  kind: 'read',
  targetId,
  prompt: prompt(`Read at ${targetId}`),
  passages,
});
const answerStep = (id: string) => ({
  id,
  kind: 'answer',
  targetId: 'government',
  prompt: prompt('Answer 1 question ({{done}} of 1)'),
  subject: 'government',
  count: 1,
});

function parse(steps: readonly Record<string, unknown>[]): SpokenQuest {
  const read = readQuest(
    {
      id: 'ottawa-parliament-hill',
      levelId: 'ottawa',
      giver: 'officer',
      title: prompt('See Parliament'),
      summary: prompt('You saw Parliament.'),
      steps: [
        {
          id: 'meet-the-officer',
          kind: 'talk',
          targetId: 'officer',
          prompt: prompt('Talk to the officer'),
          dialogue: [line('Come and see.')],
        },
        ...steps,
      ],
    },
    'fixture',
  );
  if (!read.ok) throw new Error(`fixture did not load: ${read.error.message}`);
  const spoken = adjudicateQuest(read.value, createDialogueLedger(), 'fixture');
  if (!spoken.ok) throw new Error(`fixture was not adjudicable: ${spoken.error.message}`);
  return spoken.value;
}

interface Harness {
  readonly page: FakePage;
  readonly controller: QuestController;
  readonly progress: () => Progress;
  readonly completed: ReturnType<typeof vi.fn>;
}

function harnessFor(quest: SpokenQuest, stepIndex: number): Harness {
  const page = buildPage();
  let progress: Progress = withQuestState(emptyProgress(), quest.levelId, {
    questId: quest.id,
    status: 'active',
    stepIndex,
    stepProgress: 0,
    updatedAt: ORIGIN,
  });
  const completed = vi.fn();
  const controller = createQuestController({
    levelId: quest.levelId,
    quests: [quest],
    placements: () => OTTAWA,
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
    onCompleted: completed,
    restoreFocusTo: () => null,
  });
  return { page, controller, progress: () => progress, completed };
}

const stepIndexOf = (h: Harness, quest: SpokenQuest): number | undefined =>
  questStateFor(h.progress(), quest.levelId, quest.id)?.stepIndex;

const spoken = (page: FakePage): string => page.doc.byTestId('dialogue-text')?.textContent ?? '';

describe('one engagement finishes every arrival step in a row at that landmark', () => {
  it('finishes a visit and the read after it, and hands the question the answer step', () => {
    const quest = parse([
      visitStep('see-the-locks', 'rideau-locks', ['The canal is old.']),
      readStep('read-at-the-locks', 'rideau-locks', [FIRST, SECOND]),
      answerStep('answer-at-the-locks'),
    ]);
    const h = harnessFor(quest, 1);

    const visit = h.controller.visited('rideau-locks');

    expect(visit.advanced).toBe(true);
    expect(visit.passages, 'the read step’s passages were dropped').toEqual([FIRST, SECOND]);
    expect(stepIndexOf(h, quest), 'the read step was left current at its own landmark').toBe(3);
    /* The question after the card counts toward the task, not toward nothing. */
    expect(h.controller.answeringStep?.step.id).toBe('answer-at-the-locks');
    expect(h.controller.awaits('rideau-locks')).toBe(false);
  });

  it('finishes a read and the visit after it, in the order they are written', () => {
    const quest = parse([
      readStep('read-at-the-locks', 'rideau-locks', [FIRST]),
      visitStep('see-the-locks', 'rideau-locks', ['The canal is old.']),
      answerStep('answer-at-the-locks'),
    ]);
    const h = harnessFor(quest, 1);

    const visit = h.controller.visited('rideau-locks');

    expect(visit.passages).toEqual([FIRST]);
    expect(stepIndexOf(h, quest)).toBe(3);
    const onClosed = vi.fn();
    expect(visit.speak(onClosed)).toBe('spoken');
    expect(spoken(h.page)).toContain('The canal is old.');
  });

  it('gathers the passages of two read steps at one stop, in step order', () => {
    const quest = parse([
      visitStep('see-the-locks', 'rideau-locks'),
      readStep('read-one', 'rideau-locks', [FIRST]),
      readStep('read-two', 'rideau-locks', [SECOND, THIRD]),
      answerStep('answer-at-the-locks'),
    ]);
    const h = harnessFor(quest, 1);
    expect(h.controller.visited('rideau-locks').passages).toEqual([FIRST, SECOND, THIRD]);
    expect(stepIndexOf(h, quest)).toBe(4);
  });

  it('stops at an answer step, so the question still comes before the next step', () => {
    const quest = parse([
      visitStep('see-the-locks', 'rideau-locks'),
      answerStep('answer-at-the-locks'),
      readStep('read-at-the-locks', 'rideau-locks', [FIRST]),
    ]);
    const h = harnessFor(quest, 1);

    const visit = h.controller.visited('rideau-locks');

    expect(visit.passages).toEqual([]);
    expect(stepIndexOf(h, quest)).toBe(2);
  });

  it('stops at a step that names another landmark: nothing is skipped', () => {
    const quest = parse([
      visitStep('see-the-locks', 'rideau-locks'),
      readStep('read-at-the-lake', 'dows-lake', [FIRST]),
    ]);
    const h = harnessFor(quest, 1);

    expect(h.controller.visited('rideau-locks').passages).toEqual([]);
    expect(stepIndexOf(h, quest)).toBe(2);
    expect(h.controller.visited('rideau-locks').advanced, 'a finished stop advanced again').toBe(
      false,
    );
  });

  it('says every step’s lines in order, and pays the caller once, after the last', () => {
    const quest = parse([
      visitStep('see-the-locks', 'rideau-locks', ['First line.']),
      visitStep('see-the-locks-again', 'rideau-locks', ['Second line.']),
      answerStep('answer-at-the-locks'),
    ]);
    const h = harnessFor(quest, 1);
    const onClosed = vi.fn();

    expect(h.controller.visited('rideau-locks').speak(onClosed)).toBe('spoken');
    expect(spoken(h.page)).toContain('First line.');
    expect(spoken(h.page)).not.toContain('Second line.');

    h.page.doc.byTestId('dialogue-next')?.click();
    expect(onClosed, 'the question was owed before the second step spoke').not.toHaveBeenCalled();
    expect(spoken(h.page)).toContain('Second line.');

    h.page.doc.byTestId('dialogue-next')?.click();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('answers what the one step would have when the run is one step long', () => {
    const quest = parse([
      readStep('read-at-the-locks', 'rideau-locks', [FIRST]),
      answerStep('answer-at-the-locks'),
    ]);
    const h = harnessFor(quest, 1);
    const onClosed = vi.fn();
    const visit = h.controller.visited('rideau-locks');
    expect(visit.speak(onClosed)).toBe('no-dialogue');
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('earns the stamp once when the run finishes the quest', () => {
    const quest = parse([
      visitStep('see-the-lake', 'dows-lake'),
      readStep('read-at-the-lake', 'dows-lake', [FIRST, SECOND]),
    ]);
    const h = harnessFor(quest, 1);

    const visit = h.controller.visited('dows-lake');

    expect(visit.passages).toEqual([FIRST, SECOND]);
    expect(questStateFor(h.progress(), quest.levelId, quest.id)?.status).toBe('completed');
    expect(h.completed).toHaveBeenCalledTimes(1);
  });
});
