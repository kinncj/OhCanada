/**
 * "Read about this" in the exam review — `TN-TEACHBACK`, ADR-0070. The review is
 * after the exam, so it may teach; the live exam question never offers the
 * control (that screen is `exam-screen.ts`, which this feature does not touch).
 */

import { describe, expect, it, vi } from 'vitest';

import { createExamResult, type ExamResultView } from '@ui/exam-result';
import type { LessonReaderView } from '@ui/lesson-reader';

import { buildPage, press, pressSwitch, type FakeElement } from './support/fake-dom';

const OPTIONS = ['The monarch', 'The prime minister', 'The governor general', 'The speaker'];

const VIEW: ExamResultView = {
  correct: 1,
  total: 3,
  passMark: 15,
  passed: false,
  timed: false,
  timeUp: false,
  unanswered: 1,
  subjects: [{ id: 'government', name: 'How Canadians govern themselves', correct: 1, total: 3 }],
  review: [
    { prompt: 'Who is the head of state?', options: OPTIONS, chosenIndex: 0, correctIndex: 0 },
    { prompt: 'Who leads the government?', options: OPTIONS, chosenIndex: 2, correctIndex: 1 },
    { prompt: null, options: [], chosenIndex: null, correctIndex: 3 },
  ],
};

const HEAD_EN: LessonReaderView = {
  title: 'The Crown',
  passages: [{ id: 'g3-head', text: 'The Sovereign is the head of state.' }],
};
const HEAD_FR: LessonReaderView = {
  title: 'La Couronne',
  passages: [{ id: 'g3-head', text: 'Le souverain est le chef de l’État.' }],
};

function open(overrides: Partial<Parameters<typeof createExamResult>[1]> = {}) {
  const page = buildPage();
  const clock = { now: 0 };
  const result = createExamResult(page.host, {
    locale: 'en',
    announce: vi.fn(),
    onClose: vi.fn(),
    now: () => clock.now,
    ...overrides,
  });
  result.show(VIEW);
  const at = (testId: string): FakeElement | null => page.doc.byTestId(testId);
  return { page, clock, result, at };
}

describe('"Read about this" in the exam review', () => {
  it('is offered on an item with a reading, and on no other', () => {
    const { result, at } = open();
    result.setReadings([HEAD_EN, null, HEAD_EN]);
    result.openReview();
    expect(at('exam-review-read-about-0')?.textContent).toBe('Read about this');
    expect(at('exam-review-read-about-1')).toBeNull();
    /* A question this build no longer has offers nothing, whatever it is handed. */
    expect(at('exam-review-read-about-2')).toBeNull();
  });

  it('arrives in an open review, and draws nothing for an empty reading', () => {
    const { result, at } = open();
    result.openReview();
    expect(at('exam-review-read-about-0')).toBeNull();
    result.setReadings([{ title: 'Empty', passages: [] }, HEAD_EN]);
    expect(at('exam-review-read-about-0')).toBeNull();
    expect(at('exam-review-read-about-1')).not.toBeNull();
  });

  it('keeps the way out first, so a switch never walks every item to leave (TN-RESULT-09)', () => {
    const { result, at } = open();
    result.setReadings([HEAD_EN, HEAD_EN]);
    result.openReview();
    const buttons = (at('exam-review') as FakeElement).querySelectorAll('button');
    expect(buttons[0]?.getAttribute('data-testid')).toBe('exam-review-back');
    expect(buttons).toHaveLength(3);
  });

  it('opens the reader over the review and puts focus back on the item’s control', () => {
    const { result, at, page } = open();
    result.setReadings([HEAD_EN]);
    result.openReview();
    at('exam-review-read-about-0')?.click();
    expect(at('lesson-reader')?.hidden).toBe(false);
    expect(at('lesson-reader-title')?.textContent).toBe('The Crown');

    press(at('lesson-reader') as FakeElement, 'Escape');
    expect(at('lesson-reader')?.hidden).toBe(true);
    /* One Escape closes the reader and not the review under it. */
    expect(at('exam-review')?.hidden).toBe(false);
    expect(page.doc.activeElement).toBe(at('exam-review-read-about-0'));
  });

  it('follows a language change with the view it is handed', () => {
    const { result, at } = open();
    result.setReadings([HEAD_EN]);
    result.openReview();
    at('exam-review-read-about-0')?.click();
    result.setLocale('fr');
    result.setReadings([HEAD_FR]);
    expect(at('lesson-reader-title')?.textContent).toBe('La Couronne');
    expect(at('exam-review-read-about-0')?.textContent).toBe('Lire à ce sujet');
  });

  it('closes an open reader whose reading is withdrawn, and when the review or result goes', () => {
    const { result, at } = open();
    result.setReadings([HEAD_EN]);
    result.openReview();
    at('exam-review-read-about-0')?.click();
    result.setReadings([]);
    expect(at('lesson-reader')?.hidden).toBe(true);
    expect(at('exam-review')?.hidden).toBe(false);

    result.setReadings([HEAD_EN]);
    at('exam-review-read-about-0')?.click();
    result.closeReview();
    expect(at('lesson-reader')?.hidden).toBe(true);

    result.openReview();
    at('exam-review-read-about-0')?.click();
    result.hide();
    expect(at('lesson-reader')?.hidden).toBe(true);
    result.destroy();
    expect(at('lesson-reader')).toBeNull();
  });

  it('works on one switch, and the highlight comes back to the item’s control', () => {
    const { result, at, page, clock } = open({ singleSwitch: true, holdMs: 600 });
    result.setReadings([HEAD_EN]);
    result.openReview();
    const focused = (): string | null => page.doc.activeElement?.getAttribute('data-testid') ?? null;
    for (let step = 0; step < 6 && focused() !== 'exam-review-read-about-0'; step += 1) {
      pressSwitch(page, clock, 10);
    }
    expect(focused()).toBe('exam-review-read-about-0');
    pressSwitch(page, clock, 900);
    expect(at('lesson-reader')?.hidden).toBe(false);

    result.setSingleSwitch(true, 600);
    pressSwitch(page, clock, 10);
    expect(focused()).toBe('lesson-reader-close');
    pressSwitch(page, clock, 900);
    expect(at('lesson-reader')?.hidden).toBe(true);
    expect(focused()).toBe('exam-review-read-about-0');
  });
});
