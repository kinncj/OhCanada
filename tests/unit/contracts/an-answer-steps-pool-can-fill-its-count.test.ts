/**
 * An `answer` step's pool is questions the game may ask, in its level's subject,
 * and enough of them for the step's count (ADR-0036).
 *
 * A step with no `questionPool` draws from its whole subject, so "Answer 2
 * questions about voting" asked about Magna Carta. Naming a pool fixes the topic,
 * and three quiet failures come with it. None of them is caught anywhere else:
 * `validate-content` checks only that a pool is an array of unique ids, and
 * `verify-content` never reads one.
 *
 *  - **An id the runtime will not ask is dropped without a word.** A missing
 *    document, a rejected question, one verified for an older `sourceHash`, or
 *    one without French is filtered out by `shippableQuestions`. A question from
 *    another subject is filtered out because every in-level draw is narrowed to
 *    the level's `subject`.
 *  - **So a pool shrinks without failing**, and once it is smaller than the
 *    step's `count` the card counts to what it drew. The step is then finished
 *    only by coming back to the landmark, and only while a question is left.
 *  - **A step with no pool silently goes back to the whole bank**, which is the
 *    defect this contract exists for.
 *
 * "Askable" here is `isShippable` in `app/domain/entities/question.ts`: verified
 * for the source hash it cites, with evidence, and bilingual in the prompt, the
 * explanation and every option. It is restated rather than imported, so the
 * expectation is computed from `content/` by a route the bundle never takes.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Text {
  readonly en?: string;
  readonly fr?: string;
}
interface QuestionFile {
  readonly id: string;
  readonly subject: string;
  readonly prompt: Text;
  readonly explanation: Text;
  readonly options: readonly Text[];
  readonly source: { readonly sourceHash: string };
  readonly verification: {
    readonly status: string;
    readonly sourceHash?: string | null;
    readonly evidence?: string | null;
  };
}
interface StepFile {
  readonly id: string;
  readonly kind: string;
  readonly count?: number;
  readonly questionPool?: readonly string[];
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

const jsonIn = (dir: string): readonly string[] =>
  readdirSync(`${REPO_ROOT}${dir}`)
    .filter((name) => name.endsWith('.json'))
    .sort();

const quests = jsonIn('content/quests').map((name) => json<QuestFile>(`content/quests/${name}`));

const levels = new Map(
  jsonIn('content/levels')
    .map((name) => json<LevelFile>(`content/levels/${name}`))
    .map((level) => [level.id, level] as const),
);

const questions = new Map(
  readdirSync(`${REPO_ROOT}content/questions`)
    .filter((name) => statSync(`${REPO_ROOT}content/questions/${name}`).isDirectory())
    .flatMap((subject) =>
      jsonIn(`content/questions/${subject}`).map((name) =>
        json<QuestionFile>(`content/questions/${subject}/${name}`),
      ),
    )
    .map((question) => [question.id, question] as const),
);

const bilingual = (text: Text | undefined): boolean =>
  (text?.en ?? '').trim().length > 0 && (text?.fr ?? '').trim().length > 0;

/** Why the runtime would not ask this question, or `null` when it would. */
const whyNotAskable = (question: QuestionFile): string | null => {
  const { verification, source } = question;
  if (verification.status !== 'verified') return `its verification status is "${verification.status}"`;
  if (verification.sourceHash !== source.sourceHash) {
    return 'it was verified against a different sourceHash than the one it cites';
  }
  if ((verification.evidence ?? '').trim().length === 0) return 'its verification has no evidence';
  if (!bilingual(question.prompt) || !bilingual(question.explanation)) {
    return 'its prompt or explanation is missing English or French';
  }
  if (!question.options.every(bilingual)) return 'an option is missing English or French';
  return null;
};

const answerSteps = (quest: QuestFile): readonly StepFile[] =>
  quest.steps.filter((step) => step.kind === 'answer');

describe('an answer step’s pool can fill its count', () => {
  it('has answer steps to check, so this is about something (ADR-0024)', () => {
    expect(quests.flatMap(answerSteps).length).toBeGreaterThan(0);
    expect(questions.size).toBeGreaterThan(0);
  });

  for (const quest of quests) {
    const where = (step: StepFile): string => `content/quests/${quest.id}.json step "${step.id}"`;

    it(`${quest.id} names a pool on every answer step`, () => {
      for (const step of answerSteps(quest)) {
        expect(
          step.questionPool?.length ?? 0,
          `${where(step)} names no questionPool, so it draws from the whole subject and its ` +
            'prompt says one topic while the card asks another (ADR-0036).',
        ).toBeGreaterThan(0);
      }
    });

    it(`${quest.id} pools only questions the game may ask, in its level’s subject`, () => {
      const level = levels.get(quest.levelId);
      expect(level, `content/quests/${quest.id}.json names a level nothing places`).toBeDefined();
      for (const step of answerSteps(quest)) {
        for (const id of step.questionPool ?? []) {
          const question = questions.get(id);
          expect(question, `${where(step)} pools "${id}", and no question has that id.`).toBeDefined();
          if (question === undefined) continue;
          expect(
            whyNotAskable(question),
            `${where(step)} pools "${id}", which the game will not ask: ${String(whyNotAskable(question))}.`,
          ).toBeNull();
          expect(
            question.subject,
            `${where(step)} pools "${id}" from "${question.subject}", but ${quest.levelId} asks ` +
              `"${String(level?.subject)}", so the draw drops it.`,
          ).toBe(level?.subject);
        }
      }
    });

    it(`${quest.id} pools at least as many askable questions as each step counts`, () => {
      const subject = levels.get(quest.levelId)?.subject;
      for (const step of answerSteps(quest)) {
        const askable = (step.questionPool ?? []).filter((id) => {
          const question = questions.get(id);
          return question !== undefined && question.subject === subject && whyNotAskable(question) === null;
        });
        expect(
          askable.length,
          `${where(step)} asks ${String(step.count)} but its pool holds ${String(askable.length)} ` +
            'askable question(s) in the level’s subject, so the card could never count to the task.',
        ).toBeGreaterThanOrEqual(step.count ?? 1);
      }
    });
  }
});
