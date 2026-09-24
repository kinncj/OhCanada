/**
 * A stop's reader holds one lesson (ADR-0063 §2, ADR-0067 §2).
 *
 * One engagement finishes every arrival step in a row that names the landmark
 * engaged, and opens **one** reader over every passage of every `read` step in
 * that run. A reader is named by one lesson's title, so `readingFor` refuses
 * references from two lessons with `content.lesson.passages.manyLessons`
 * (`app/application/content/lesson-passages.ts`) — and at runtime that refusal
 * is a console line and a stop that silently teaches nothing: the composition
 * root logs it, pays the continuation and moves on to the question.
 *
 * So the shape is caught here, over `content/quests/`, rather than by a player.
 * The run is measured with the shipped `stepsFinishedOnArrival` and the lessons
 * with the shipped `lessonsNamedBy`, so the gate cannot model a different game
 * from the one that runs. Two `read` steps at one stop that are **not** in one
 * run (a question between them) open two readers and are allowed.
 */

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { lessonsNamedBy } from '@application/content/lesson-passages';
import type { LessonPassageReference } from '@application/ports';

import { readQuestCorpus } from '../../../scripts/lib/lesson-passages.mjs';
import { stepsFinishedOnArrival } from '../../../app/bootstrap/arrival';
import type { CueStep } from '../../../app/bootstrap/task-cue';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface StepLike {
  readonly id?: unknown;
  readonly kind?: unknown;
  readonly targetId?: unknown;
  readonly passages?: readonly LessonPassageReference[];
}

interface QuestLike {
  readonly steps?: readonly StepLike[];
}

interface ReaderSheet {
  /** The quest file, and the step ids of the run. */
  readonly where: string;
  readonly lessons: readonly string[];
}

/**
 * Every reader one engagement can open in this quest: for each step a player
 * can arrive on, the run it finishes, and the lessons that run's `read` steps
 * name. Runs with no `read` step open no reader and are left out.
 */
function readersIn(quest: QuestLike, where: string): ReaderSheet[] {
  const steps = (quest.steps ?? []).filter(
    (step): step is StepLike & CueStep =>
      typeof step.kind === 'string' && typeof step.targetId === 'string',
  );
  const sheets: ReaderSheet[] = [];
  steps.forEach((step, index) => {
    const run = steps.slice(index, index + stepsFinishedOnArrival(steps, index, step.targetId));
    const references = run.flatMap((member) =>
      member.kind === 'read' ? (member.passages ?? []) : [],
    );
    if (references.length === 0) return;
    sheets.push({
      where: `${where} steps ${run.map((member) => String(member.id)).join(' + ')}`,
      lessons: lessonsNamedBy(references),
    });
  });
  return sheets;
}

describe('a stop reads one lesson (content.lesson.passages.manyLessons)', () => {
  const sheets = readQuestCorpus(REPO_ROOT).flatMap(({ where, document }) =>
    readersIn(document as QuestLike, where),
  );

  it('measures something: at least one stop in the build opens a reader (ADR-0024)', () => {
    expect(sheets.length).toBeGreaterThan(0);
  });

  it('holds every reader in the build to one lesson', () => {
    for (const sheet of sheets) {
      expect(
        sheet.lessons,
        `${sheet.where} open one reader over passages from ${String(sheet.lessons.length)} ` +
          `lessons (${sheet.lessons.join(', ')}). A reader is named by one lesson, so the game ` +
          'refuses it and the stop teaches nothing. Put an answer step between them, or read ' +
          'one lesson here.',
      ).toHaveLength(1);
    }
  });
});

describe('the run is what one engagement finishes', () => {
  const one = (lesson: string, passage: string): LessonPassageReference => ({ lesson, passage });

  it('refuses two read steps with different lessons in one run at one stop', () => {
    const sheets = readersIn(
      {
        steps: [
          { id: 'go', kind: 'visit', targetId: 'locks' },
          { id: 'a', kind: 'read', targetId: 'locks', passages: [one('first', 'p1')] },
          { id: 'b', kind: 'read', targetId: 'poi.locks', passages: [one('second', 'p2')] },
          { id: 'ask', kind: 'answer', targetId: 'rights' },
        ],
      },
      'fixture',
    );
    expect(sheets[0]?.lessons).toEqual(['first', 'second']);
  });

  it('allows two lessons at one stop when a question stands between them', () => {
    const sheets = readersIn(
      {
        steps: [
          { id: 'a', kind: 'read', targetId: 'locks', passages: [one('first', 'p1')] },
          { id: 'ask', kind: 'answer', targetId: 'rights' },
          { id: 'b', kind: 'read', targetId: 'locks', passages: [one('second', 'p2')] },
        ],
      },
      'fixture',
    );
    expect(sheets.map((sheet) => sheet.lessons)).toEqual([['first'], ['second']]);
  });

  it('keeps two stops apart', () => {
    const sheets = readersIn(
      {
        steps: [
          { id: 'a', kind: 'read', targetId: 'locks', passages: [one('first', 'p1')] },
          { id: 'b', kind: 'read', targetId: 'lake', passages: [one('second', 'p2')] },
        ],
      },
      'fixture',
    );
    expect(sheets.map((sheet) => sheet.lessons)).toEqual([['first'], ['second']]);
  });
});
