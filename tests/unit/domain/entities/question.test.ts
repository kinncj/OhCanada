/**
 * Whether a question may be shown, and what one answer means.
 */

import { describe, expect, it } from 'vitest';

import {
  gradeAnswer,
  isOptionIndex,
  isShippable,
  isVerified,
  shippableQuestions,
} from '@domain/entities/question';
import type { Question } from '@domain/entities/question';

import { makeQuestion, text } from '../../support/fixtures';

/** The document as content authors it, and the narrow view a rule reads. */
const document = makeQuestion('gov-01');
const question: Question = document;

describe('may this question be asked', () => {
  it('accepts a verified question with both languages', () => {
    expect(isVerified(question)).toBe(true);
    expect(isShippable(question)).toBe(true);
  });

  it.each(['unverified', 'quarantined', 'rejected'] as const)('refuses a %s question', (status) => {
    const other = makeQuestion('gov-02', {
      verification: { ...document.verification, status },
    });
    expect(isVerified(other)).toBe(false);
    expect(isShippable(other)).toBe(false);
  });

  it('refuses a status granted for a source that has since moved', () => {
    const drifted = makeQuestion('gov-03', {
      verification: { ...document.verification, sourceHash: 'b'.repeat(64) },
    });
    expect(isVerified(drifted)).toBe(false);
  });

  it('refuses a verified status with no quoted passage (ADR-0003)', () => {
    const empty = makeQuestion('gov-04', {
      verification: { ...document.verification, evidence: '   ' },
    });
    expect(isVerified(empty)).toBe(false);
  });

  it('refuses a question with no French wording, however verified (TN-QUEST-05)', () => {
    const halfTranslated = makeQuestion('gov-05', { prompt: { en: 'Prompt', fr: '' } });
    expect(isVerified(halfTranslated)).toBe(true);
    expect(isShippable(halfTranslated)).toBe(false);

    expect(isShippable(makeQuestion('gov-06', { explanation: { en: 'Why', fr: ' ' } }))).toBe(false);
    expect(
      isShippable(
        makeQuestion('gov-07', {
          options: [text('One'), { en: 'Two', fr: '' }, text('Three'), text('Four')],
        }),
      ),
    ).toBe(false);
  });

  it('filters a bank without reordering what is left', () => {
    const bank = [
      question,
      makeQuestion('gov-08', { verification: { ...document.verification, status: 'quarantined' } }),
      makeQuestion('gov-09'),
    ];
    expect(shippableQuestions(bank).map((entry) => entry.id)).toEqual(['gov-01', 'gov-09']);
  });
});

describe('grading an answer', () => {
  it('says which option was right, and does not treat wrong as an error', () => {
    const right = gradeAnswer(question, 0);
    expect(right.ok).toBe(true);
    if (right.ok) {
      expect(right.value.correct).toBe(true);
      expect(right.value.explanation).toEqual(question.explanation);
    }

    const wrong = gradeAnswer(question, 3);
    expect(wrong.ok).toBe(true);
    if (wrong.ok) {
      expect(wrong.value.correct).toBe(false);
      expect(wrong.value.correctIndex).toBe(0);
      expect(wrong.value.explanation).toEqual(question.explanation);
    }
  });

  it.each([-1, 4, 1.5, Number.NaN])('refuses %s, which no card can produce', (index) => {
    expect(isOptionIndex(index)).toBe(false);
    const graded = gradeAnswer(question, index);
    expect(graded.ok).toBe(false);
    if (!graded.ok) expect(graded.error.code).toBe('question.option.outOfRange');
  });
});
