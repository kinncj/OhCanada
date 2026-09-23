/**
 * Every question has a lesson passage with the same proposition, and the player
 * meets it before being asked — measured, reported, and held by a ratchet
 * (ADR-0070 §5).
 *
 * The owner's goal is that the learning content matches the quests and the
 * questions. Two numbers say how far the corpus is from it:
 *
 *  (a) **Unlinked** — verified questions with no readable lesson passage sharing
 *      their proposition. For these, "Read about this" offers nothing, because
 *      there is nothing to open.
 *  (b) **Unreached** — pooled questions (one per `answer` step naming them) whose
 *      proposition the player has not met in that level before the step that
 *      asks it. Met means: a readable passage named by a `read` step at a lower
 *      index in the same quest (the same or an earlier stop, ADR-0063 §5), or one
 *      of the level's told facts — a landmark blurb, the territorial statement,
 *      or a quest line (step dialogue at a lower index, `declinedLine`,
 *      `reminderLine`; never `afterLine` or `doneLine`, which are spoken when
 *      the quest is over), each with a verifier's grant (ADR-0057 §6).
 *
 * Both are measured with the code the game runs: `sharesProposition` for "the
 * same proposition", `passagesSharingProposition` for the card's lookup, and
 * `grantsPassage` for ADR-0003's grant — imported, not copied.
 *
 * ## A ratchet, because today most questions fail both
 *
 * Making either rule absolute today would fail the build on content nobody on
 * this branch may write. So the counts are recorded in
 * `teach-back-baseline.json` and may only go down. A rise is a regression and
 * fails with the numbers. A fall fails too, with the new numbers to write down,
 * so the baseline never carries slack a later regression could hide in: **a
 * content change that lowers a count updates the baseline in the same commit.**
 *
 * The counts are printed on every run, and the corpus they are counted over must
 * be non-empty — a gate over nothing passes by saying nothing (ADR-0024).
 *
 * Content is read off the disk, by a route the bundle never takes, so the
 * expectation comes from `content/` and not from the code under test.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { passageVerdict, resolvePassage } from '@application/content/lesson-passages';
import { sharesProposition } from '@application/content/proposition';
import { passagesSharingProposition } from '@application/content/question-passages';
import type {
  FactClaim,
  LessonDocument,
  LessonPassageReference,
  QuestionDocument,
} from '@application/ports';
import { isVerified } from '@domain/entities/question';

import { grantsPassage } from '../../../app/bootstrap/verified-passages';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const BASELINE_PATH = 'tests/unit/contracts/teach-back-baseline.json';

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;
const jsonIn = <T>(dir: string): T[] =>
  readdirSync(`${REPO_ROOT}${dir}`)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => json<T>(`${dir}/${name}`));
const subdirs = (dir: string): string[] =>
  readdirSync(`${REPO_ROOT}${dir}`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

interface Line {
  readonly fact?: FactClaim | null;
}
interface StepFile {
  readonly id: string;
  readonly kind: string;
  readonly questionPool?: readonly string[];
  readonly dialogue?: readonly Line[];
  readonly passages?: readonly LessonPassageReference[];
}
interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly declinedLine?: Line;
  readonly reminderLine?: Line;
  readonly steps: readonly StepFile[];
}
interface LevelFile {
  readonly id: string;
  readonly pois?: readonly { readonly fact?: FactClaim | null }[];
  readonly territory?: { readonly fact?: FactClaim | null } | null;
}
interface Baseline {
  readonly unlinkedVerifiedQuestions: number;
  readonly unreachedPooledQuestions: number;
}

const questions: QuestionDocument[] = subdirs('content/questions').flatMap((subject) =>
  jsonIn<QuestionDocument>(`content/questions/${subject}`),
);
const byId = new Map(questions.map((question) => [String(question.id), question]));
const verified = questions.filter(isVerified);

const lessons: LessonDocument[] = subdirs('content/lessons').flatMap((chapter) =>
  jsonIn<LessonDocument>(`content/lessons/${chapter}`),
);
const levels = jsonIn<LevelFile>('content/levels');
const quests = jsonIn<QuestFile>('content/quests');

/** A told claim's quote, when a verifier has granted it; nothing otherwise. */
const toldQuote = (fact: FactClaim | null | undefined): string[] => {
  if (fact?.factual !== true || fact.source === null) return [];
  return grantsPassage(fact).granted ? [fact.source.quote] : [];
};

/** The quotes of the readable passages a `read` step names. */
const readQuotes = (step: StepFile): string[] =>
  (step.passages ?? []).flatMap((reference) => {
    const found = resolvePassage(lessons, reference);
    if (!found.ok || !passageVerdict(found.passage, grantsPassage).readable) return [];
    return toldQuote(found.passage.fact);
  });

/* ------------------------------------------------------------------ (a) */

const unlinked = verified.filter(
  (question) =>
    passagesSharingProposition(lessons, question.source.quote, grantsPassage).length === 0,
);

/* ------------------------------------------------------------------ (b) */

interface Pooling {
  readonly level: string;
  readonly quest: string;
  readonly step: string;
  readonly question: string;
  readonly reached: boolean;
}

const poolings: Pooling[] = levels.flatMap((level) => {
  const levelTold = [
    ...(level.pois ?? []).flatMap((poi) => toldQuote(poi.fact)),
    ...toldQuote(level.territory?.fact),
  ];
  return quests
    .filter((quest) => quest.levelId === level.id)
    .flatMap((quest) => {
      const questTold = [...toldQuote(quest.declinedLine?.fact), ...toldQuote(quest.reminderLine?.fact)];
      return quest.steps.flatMap((step, index) => {
        if (step.kind !== 'answer') return [];
        const before = quest.steps.slice(0, index);
        const told = [
          ...levelTold,
          ...questTold,
          ...before.flatMap((earlier) => (earlier.dialogue ?? []).flatMap((line) => toldQuote(line.fact))),
          ...before.filter((earlier) => earlier.kind === 'read').flatMap(readQuotes),
        ];
        return (step.questionPool ?? []).flatMap((id) => {
          const question = byId.get(id);
          /* An id that is not an askable question is another gate's failure
             (`an-answer-steps-pool-can-fill-its-count`); it is never drawn. */
          if (question === undefined || !isVerified(question)) return [];
          return [
            {
              level: level.id,
              quest: quest.id,
              step: step.id,
              question: id,
              reached: told.some((quote) => sharesProposition(question.source.quote, quote)),
            },
          ];
        });
      });
    });
});
const unreached = poolings.filter((pooling) => !pooling.reached);

/* -------------------------------------------------------------- report */

const baseline = json<Baseline>(BASELINE_PATH);
const measured: Baseline = {
  unlinkedVerifiedQuestions: unlinked.length,
  unreachedPooledQuestions: unreached.length,
};

const perLevel = levels
  .map((level) => {
    const mine = poolings.filter((pooling) => pooling.level === level.id);
    const missed = mine.filter((pooling) => !pooling.reached).length;
    return `  ${level.id}: ${String(missed)} of ${String(mine.length)} pooled unreached`;
  })
  .join('\n');

console.warn(
  [
    'Teach-back (ADR-0070 §5):',
    `  (a) ${String(unlinked.length)} of ${String(verified.length)} verified questions have no ` +
      `readable lesson passage sharing their proposition (baseline ${String(baseline.unlinkedVerifiedQuestions)}).`,
    `  (b) ${String(unreached.length)} of ${String(poolings.length)} pooled questions are not met ` +
      `in their level before the step that asks them (baseline ${String(baseline.unreachedPooledQuestions)}).`,
    perLevel,
  ].join('\n'),
);

describe('a question teaches back to its passage (ADR-0070 §5)', () => {
  it('counts over a corpus that is there (ADR-0024)', () => {
    expect(verified.length, 'no verified question was read').toBeGreaterThan(0);
    expect(lessons.length, 'no lesson document was read').toBeGreaterThan(0);
    expect(poolings.length, 'no answer step pools a verified question').toBeGreaterThan(0);
    /* Something is linked, or the lookup itself is broken rather than the content thin. */
    expect(unlinked.length).toBeLessThan(verified.length);
  });

  it('has no more unlinked verified questions than the baseline, and no fewer', () => {
    expect(
      unlinked.length,
      `REGRESSION: ${String(unlinked.length)} verified questions now have no lesson passage sharing ` +
        `their proposition, against a baseline of ${String(baseline.unlinkedVerifiedQuestions)}. ` +
        'A question added without its passage, or a passage renamed, quarantined or re-quoted, is ' +
        `the usual cause. Unlinked (first 40): ${unlinked
          .map((question) => String(question.id))
          .slice(0, 40)
          .join(', ')}`,
    ).toBeLessThanOrEqual(baseline.unlinkedVerifiedQuestions);
    expect(
      unlinked.length,
      `Progress: the count fell to ${String(unlinked.length)}. Write it into ${BASELINE_PATH} as ` +
        '"unlinkedVerifiedQuestions" in the same commit, so the ratchet keeps no slack.',
    ).toBe(baseline.unlinkedVerifiedQuestions);
  });

  it('has no more unreached pooled questions than the baseline, and no fewer', () => {
    expect(
      unreached.length,
      `REGRESSION: ${String(unreached.length)} pooled questions are not met before their step, ` +
        `against a baseline of ${String(baseline.unreachedPooledQuestions)}:\n` +
        unreached
          .map((pooling) => `  ${pooling.level} ${pooling.quest} ${pooling.step} ${pooling.question}`)
          .join('\n'),
    ).toBeLessThanOrEqual(baseline.unreachedPooledQuestions);
    expect(
      unreached.length,
      `Progress: the count fell to ${String(unreached.length)}. Write it into ${BASELINE_PATH} as ` +
        '"unreachedPooledQuestions" in the same commit, so the ratchet keeps no slack.',
    ).toBe(baseline.unreachedPooledQuestions);
  });

  it('records the baseline as the only numbers it holds', () => {
    expect(Object.keys(baseline).sort()).toEqual([
      'unlinkedVerifiedQuestions',
      'unreachedPooledQuestions',
    ]);
    expect(measured.unlinkedVerifiedQuestions).toBeGreaterThanOrEqual(0);
  });
});
