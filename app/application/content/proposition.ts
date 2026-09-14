/**
 * Which questions grade what a place has just told the player (ADR-0036).
 *
 * A proposition's identity in this repository is its `source.quote` — the
 * sentence of *Discover Canada* a claim rests on (ADR-0028 §4, ADR-0030). A
 * landmark's blurb carries one, and so does every question. When the two rest
 * on the same sentence, the question asks about exactly what the landmark just
 * said, and a level asks it there first.
 *
 * ## "The same sentence", measured
 *
 * The normalisation is the one `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts`
 * uses to decide that two claims share a quote — case, diacritics, the
 * punctuation a copy out of a PDF picks up, and whitespace — and no more: no
 * stemming, no stop words, no truncation, nothing that could merge two
 * different sentences.
 *
 * One widening, and it is deliberate: a landmark's blurb often rests on **two**
 * consecutive sentences while each question quotes one of them (the Alberta
 * ranch barn's blurb and `eco-11`/`eco-12`). So a question counts when its whole
 * normalised quote appears, word for word and on word boundaries, inside the
 * place's — or the place's inside the question's. A shared word or phrase is not
 * enough; the whole of the shorter quote has to be there.
 *
 * Pure: strings in, ids out.
 */

import type { QuestionId } from '@domain/ids';

/** Case, diacritics, punctuation and whitespace folded; nothing else. */
export const normaliseQuote = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

/** Does one quote contain the whole of the other, on word boundaries? */
export const sharesProposition = (a: string, b: string): boolean => {
  const left = normaliseQuote(a);
  const right = normaliseQuote(b);
  if (left === '' || right === '') return false;
  return ` ${left} `.includes(` ${right} `) || ` ${right} `.includes(` ${left} `);
};

/** The shape this needs of a question: an id and the sentence it rests on. */
export interface QuotedQuestion {
  readonly id: QuestionId;
  readonly source: { readonly quote: string };
}

/**
 * The questions resting on any of these quotes, in bank order.
 *
 * Bank order rather than any ranking: which of two linked questions comes first
 * is the scheduler's business once both are offered to it, and this function
 * only says which are linked.
 */
export const questionsTelling = (
  questions: readonly QuotedQuestion[],
  quotes: readonly string[],
): readonly QuestionId[] => {
  const told = quotes.filter((quote) => normaliseQuote(quote) !== '');
  if (told.length === 0) return [];
  return questions
    .filter((question) => told.some((quote) => sharesProposition(question.source.quote, quote)))
    .map((question) => question.id);
};
