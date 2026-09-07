import type { LocalizedText, QuestionId, Subject } from './ids';
import type { RandomSource } from '@common/rng';
import { shuffle } from '@common/rng';

export interface Question {
  readonly id: QuestionId;
  readonly subject: Subject;
  readonly text: LocalizedText;
  readonly answer: LocalizedText;
  readonly distractors: readonly LocalizedText[];
  readonly explanation?: LocalizedText;
  readonly source: string;
  readonly sourceUrl?: string;
  readonly asOf: string; // ISO date
  readonly volatile: boolean;
}

export interface Choice {
  readonly key: string; // stable per presentation ("a".."d")
  readonly text: LocalizedText;
  readonly correct: boolean;
}

export interface PresentedQuestion {
  readonly question: Question;
  readonly choices: readonly Choice[];
}

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

/** Shuffle answer + distractors into keyed choices. Deterministic given rng. */
export function presentQuestion(question: Question, rng: RandomSource): PresentedQuestion {
  const raw: Choice[] = [
    { key: '', text: question.answer, correct: true },
    ...question.distractors.map((d) => ({ key: '', text: d, correct: false })),
  ];
  const shuffled = shuffle(raw, rng).map((c, i) => ({ ...c, key: KEYS[i] ?? String(i) }));
  return { question, choices: shuffled };
}

export function isCorrectChoice(presented: PresentedQuestion, key: string): boolean {
  return presented.choices.some((c) => c.key === key && c.correct);
}

export function correctKey(presented: PresentedQuestion): string {
  const c = presented.choices.find((x) => x.correct);
  if (!c) throw new Error(`Question ${presented.question.id} has no correct choice`);
  return c.key;
}

/** Days between asOf and now; volatile facts older than the max are stale. */
export function isStale(question: Question, now: Date, maxAgeDays: number): boolean {
  if (!question.volatile) return false;
  const asOf = Date.parse(question.asOf);
  if (Number.isNaN(asOf)) return true;
  const ageDays = (now.getTime() - asOf) / 86_400_000;
  return ageDays > maxAgeDays;
}
