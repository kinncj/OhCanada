/**
 * Which lesson passages tell what a question asks (ADR-0070): the proposition
 * rule over the catalogue, through the shippable-passage filter, one lesson per
 * reading. The grant is a stub, as in `lesson-passages.test.ts`: this layer
 * applies ADR-0003's verdict and never derives it.
 */

import { describe, expect, it } from 'vitest';

import type { AdjudicateClaim } from '@application/content/lesson-passages';
import {
  passagesSharingProposition,
  readingForQuestion,
} from '@application/content/question-passages';
import type { FactClaim, LessonDocument, LessonPassage } from '@application/ports';

const claim = (quote: string | null, factual = true): FactClaim =>
  ({
    factual,
    source: quote === null ? null : { quote },
    verification: null,
  }) as unknown as FactClaim;

const passage = (id: string, quote: string | null, factual = true): LessonPassage => ({
  id,
  text: { en: `${id} in English`, fr: `${id} en français` },
  fact: claim(quote, factual),
});

const lesson = (id: string, passages: readonly LessonPassage[]): LessonDocument => ({
  $schema: '../../schemas/lesson.schema.json',
  id,
  chapter: 'How Canadians Govern Themselves',
  order: 1,
  title: { en: `${id} title`, fr: `${id} titre` },
  passages,
});

const granted: AdjudicateClaim = () => ({ granted: true, why: null, status: 'verified' });

/** Grants every claim except the ones whose quote mentions "quarantined". */
const quarantining: AdjudicateClaim = (fact) =>
  (fact.source?.quote ?? '').includes('quarantined')
    ? { granted: false, why: 'not-verified', status: 'quarantined' }
    : { granted: true, why: null, status: 'verified' };

const HEAD = 'The Sovereign is the Head of State.';
const PM = 'The Prime Minister is the head of government.';

const CORPUS: readonly LessonDocument[] = [
  lesson('govern-01', [
    passage('g1-head', 'The Sovereign is the Head of State'),
    passage('g1-pm', PM),
  ]),
  lesson('govern-02', [
    passage('g2-other', 'Canada is a federal state.'),
    /* Two sentences, of which the question quotes one: still the same proposition. */
    passage('g2-both', `${HEAD} ${PM}`),
    passage('g2-pm-again', 'the prime minister is the HEAD of government'),
  ]),
];

describe('passagesSharingProposition', () => {
  it('finds every lesson telling the proposition, in catalogue order, with its passages in order', () => {
    const found = passagesSharingProposition(CORPUS, PM, granted);
    expect(found.map((reading) => reading.lesson.id)).toEqual(['govern-01', 'govern-02']);
    expect(found[0]?.passages.map((p) => p.id)).toEqual(['g1-pm']);
    expect(found[1]?.passages.map((p) => p.id)).toEqual(['g2-both', 'g2-pm-again']);
  });

  it('matches containment either way on word boundaries, and nothing looser', () => {
    expect(passagesSharingProposition(CORPUS, 'The Sovereign', granted)).toHaveLength(2);
    expect(passagesSharingProposition(CORPUS, 'Sover', granted)).toEqual([]);
    expect(passagesSharingProposition(CORPUS, 'Parliament has three parts.', granted)).toEqual([]);
  });

  it('matches nothing for an empty or punctuation-only quote', () => {
    expect(passagesSharingProposition(CORPUS, '', granted)).toEqual([]);
    expect(passagesSharingProposition(CORPUS, ' … ', granted)).toEqual([]);
  });

  it('offers only what a player may read', () => {
    const corpus = [
      lesson('l', [
        passage('quarantined', `${PM} (quarantined)`),
        passage('not-a-claim', PM, false),
        passage('no-source', null),
        passage('fine', PM),
      ]),
    ];
    const found = passagesSharingProposition(corpus, PM, quarantining);
    expect(found).toHaveLength(1);
    expect(found[0]?.passages.map((p) => p.id)).toEqual(['fine']);
  });
});

describe('readingForQuestion', () => {
  it('opens the lesson that tells it in the most passages', () => {
    expect(readingForQuestion(CORPUS, PM, granted)?.lesson.id).toBe('govern-02');
  });

  it('keeps catalogue order on a tie', () => {
    expect(readingForQuestion(CORPUS, HEAD, granted)?.lesson.id).toBe('govern-01');
  });

  it('answers null when nothing readable tells it, so the card offers no control', () => {
    expect(readingForQuestion(CORPUS, 'Canada has three territories.', granted)).toBeNull();
    expect(readingForQuestion([], PM, granted)).toBeNull();
    const refusedAll: AdjudicateClaim = () => ({ granted: false, why: 'stale', status: 'verified' });
    expect(readingForQuestion(CORPUS, PM, refusedAll)).toBeNull();
  });
});
