/**
 * Which questions grade the sentence a landmark just told (ADR-0036).
 *
 * The normalisation is the contract gate's, so "the same sentence" means the
 * same thing to the game and to `a-proposition-belongs-to-one-subject.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import {
  normaliseQuote,
  questionsTelling,
  sharesProposition,
} from '@application/content/proposition';

import { questionId } from '../../support/fixtures';

const quoted = (id: string, quote: string) => ({ id: questionId(id), source: { quote } });

describe('the same sentence', () => {
  it('folds case, diacritics, punctuation and whitespace, and nothing else', () => {
    expect(normaliseQuote('  Québec — “the city”,\n founded ')).toBe('quebec the city founded');
  });

  it('matches a question quoting the landmark sentence word for word', () => {
    expect(
      sharesProposition(
        'Alberta is the largest producer of oil and gas',
        'Alberta is the largest producer of oil and gas.',
      ),
    ).toBe(true);
  });

  it('matches a question quoting one of the two sentences a blurb rests on', () => {
    const blurb =
      'Natural resources industries include forestry, fishing, agriculture, mining and energy. ' +
      'These industries have historically been an important part of the economy.';
    expect(sharesProposition(blurb, 'These industries have historically been an important part of the economy.')).toBe(true);
  });

  it('does not match on a shared phrase that is not the whole of either quote', () => {
    expect(
      sharesProposition('Toronto is the largest city in Canada.', 'Montreal is the largest city in Quebec.'),
    ).toBe(false);
  });

  it('does not match across a word boundary', () => {
    /* "art" is inside "part"; a substring test would call these one sentence. */
    expect(sharesProposition('an important part', 'art')).toBe(false);
  });

  it('matches nothing to an empty quote', () => {
    expect(sharesProposition('', 'Anything at all.')).toBe(false);
    expect(sharesProposition('Anything at all.', ' — ')).toBe(false);
  });
});

describe('the questions a place tells', () => {
  const bank = [
    quoted('eco-11', 'Natural resources industries include forestry, fishing, agriculture, mining and energy.'),
    quoted('eco-30', 'Alberta is the largest producer of oil and gas'),
    quoted('reg-43', 'The province was named after Princess Louise.'),
  ];

  it('returns the questions resting on any quote given, in bank order', () => {
    expect(
      questionsTelling(bank, [
        'Alberta is the largest producer of oil and gas.',
        'Natural resources industries include forestry, fishing, agriculture, mining and energy.',
      ]),
    ).toEqual(['eco-11', 'eco-30']);
  });

  it('returns nothing for a place that told nothing', () => {
    expect(questionsTelling(bank, [])).toEqual([]);
    expect(questionsTelling(bank, ['   '])).toEqual([]);
  });
});
