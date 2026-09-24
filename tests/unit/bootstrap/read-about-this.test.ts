/**
 * "Read about this" wired through the drill runner (ADR-0070, `TN-TEACHBACK`):
 * the runner asks for the reading when a card goes up, hands the card the
 * reader's view in the language in force, re-localises it on a language change,
 * and never lets a slow answer about one question land on the next.
 */

import { describe, expect, it, vi } from 'vitest';

import type { QuestionReading } from '@application/content/question-passages';
import type { FactClaim, LessonDocument, ShippableQuestion } from '@application/ports';
import type { StudyQuestion } from '@application/use-cases/study-session';

import { questionReaderView } from '../../../app/bootstrap/lesson-reading';
import { createDrillRunner } from '../../../app/bootstrap/quiz';

import { buildPage } from '../ui/support/fake-dom';

const QUESTION = (id: string): StudyQuestion => ({
  question: {
    id,
    subject: 'government',
    prompt: { en: `Prompt ${id}`, fr: `Question ${id}` },
    options: [
      { en: 'A', fr: 'A' },
      { en: 'B', fr: 'B' },
      { en: 'C', fr: 'C' },
      { en: 'D', fr: 'D' },
    ],
    correctIndex: 0,
    explanation: { en: 'Because.', fr: 'Parce que.' },
    source: { quote: `quote ${id}` },
  } as unknown as ShippableQuestion,
  familiarity: 'new',
});

const LESSON: LessonDocument = {
  $schema: '../../schemas/lesson.schema.json',
  id: 'govern-03',
  chapter: 'How Canadians Govern Themselves',
  order: 3,
  title: { en: 'The Crown', fr: 'La Couronne' },
  passages: [
    {
      id: 'g3-head',
      text: { en: 'The Sovereign is the head of state.', fr: 'Le souverain est le chef de l’État.' },
      fact: { factual: true, source: null, verification: null } as unknown as FactClaim,
    },
  ],
};

const READING: QuestionReading = { lesson: LESSON, passages: LESSON.passages };

const noReorder = { next: (): number => 0.999_999 };
const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function mount(readAbout?: (question: ShippableQuestion) => Promise<QuestionReading | null>) {
  const page = buildPage();
  const runner = createDrillRunner({
    host: page.host,
    locale: 'en',
    announce: vi.fn(),
    singleSwitch: false,
    holdMs: 600,
    random: noReorder,
    onAnswer: vi.fn(),
    onFinished: vi.fn(),
    ...(readAbout === undefined ? {} : { readAbout }),
  });
  const at = (testId: string) => page.doc.byTestId(testId);
  return { page, runner, at };
}

describe('questionReaderView', () => {
  it('is the reader’s view in one language, and null for nothing', () => {
    const localise = (value: { en: string; fr: string }, locale: 'en' | 'fr'): string => value[locale];
    expect(questionReaderView(READING, 'fr', localise)).toEqual({
      title: 'La Couronne',
      passages: [{ id: 'g3-head', text: 'Le souverain est le chef de l’État.' }],
    });
    expect(questionReaderView(null, 'en', localise)).toBeNull();
    expect(questionReaderView({ lesson: LESSON, passages: [] }, 'en', localise)).toBeNull();
  });
});

describe('the drill runner and "Read about this"', () => {
  it('asks about the question on screen and offers the reading once it is answered', async () => {
    const readAbout = vi.fn(async () => Promise.resolve(READING));
    const { runner, at } = mount(readAbout);
    runner.start([QUESTION('q1')]);
    await flush();
    expect(readAbout).toHaveBeenCalledTimes(1);
    expect(at('question-read-about')?.hidden).toBe(true);
    at('option-0')?.click();
    expect(at('question-read-about')?.hidden).toBe(false);
    at('question-read-about')?.click();
    expect(at('lesson-reader-title')?.textContent).toBe('The Crown');
  });

  it('offers nothing without a reading, when the lookup fails, or with no lookup at all', async () => {
    for (const readAbout of [
      async () => Promise.resolve(null),
      async () => Promise.reject(new Error('offline')),
      undefined,
    ]) {
      const { runner, at } = mount(readAbout);
      runner.start([QUESTION('q1')]);
      await flush();
      at('option-0')?.click();
      expect(at('question-read-about')?.hidden).toBe(true);
    }
  });

  it('re-localises the reading when the language changes', async () => {
    const { runner, at } = mount(async () => Promise.resolve(READING));
    runner.start([QUESTION('q1')]);
    await flush();
    at('option-0')?.click();
    at('question-read-about')?.click();
    runner.setLocale('fr');
    expect(at('lesson-reader-title')?.textContent).toBe('La Couronne');
    expect(at('question-read-about')?.textContent).toBe('Lire à ce sujet');
  });

  it('drops a slow answer about the last question', async () => {
    let release: (value: QuestionReading | null) => void = () => undefined;
    const slow = new Promise<QuestionReading | null>((resolve) => {
      release = resolve;
    });
    const readAbout = vi
      .fn<(question: ShippableQuestion) => Promise<QuestionReading | null>>()
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce(null);
    const { runner, at } = mount(readAbout);
    runner.start([QUESTION('q1'), QUESTION('q2')]);
    at('option-0')?.click();
    at('question-next')?.click();
    release(READING);
    await flush();
    at('option-0')?.click();
    expect(at('question-read-about')?.hidden).toBe(true);
  });
});
