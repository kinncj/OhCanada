/**
 * An `answer` step asks from its level's subject (ADR-0030 §2, ADR-0036).
 *
 * The composition root draws every in-level question from the **level's**
 * `subject` (`app/bootstrap/landmark-questions.ts`). A quest step that named a
 * different subject would therefore say one thing in the document and have the
 * game do another, and the difference would reach nobody: the tracker reads the
 * step's prompt, the card reads the level's bank. This holds the two equal.
 *
 * Read off the disk, by a route the bundle never takes, so the expectation is
 * computed from `content/` and not from the code under test.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface StepFile {
  readonly id: string;
  readonly kind: string;
  readonly subject?: string;
}
interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly steps: readonly StepFile[];
}
interface LevelFile {
  readonly id: string;
  readonly subject: string;
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const quests = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => json<QuestFile>(`content/quests/${name}`));

const levels = new Map(
  readdirSync(`${REPO_ROOT}content/levels`)
    .filter((name) => name.endsWith('.json'))
    .map((name) => json<LevelFile>(`content/levels/${name}`))
    .map((level) => [level.id, level] as const),
);

describe('an answer step asks its level’s subject', () => {
  it('has answer steps to check, so this is about something (ADR-0024)', () => {
    expect(quests.flatMap((quest) => quest.steps).filter((step) => step.kind === 'answer').length)
      .toBeGreaterThan(0);
  });

  for (const quest of quests) {
    it(`${quest.id} asks from ${quest.levelId}'s subject at every answer step`, () => {
      const level = levels.get(quest.levelId);
      expect(level, `content/quests/${quest.id}.json names a level nothing places`).toBeDefined();
      for (const step of quest.steps.filter((candidate) => candidate.kind === 'answer')) {
        expect(
          step.subject,
          `content/quests/${quest.id}.json step "${step.id}" asks "${String(step.subject)}", but ` +
            `${quest.levelId} teaches "${String(level?.subject)}". The game draws a level's ` +
            'questions from its own subject, so the tracker and the card would disagree.',
        ).toBe(level?.subject);
      }
    });
  }
});
