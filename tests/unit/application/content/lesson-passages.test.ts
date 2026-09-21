/**
 * Exactly one passage or a named failure, then the shippable-passage filter
 * (ADR-0063 §4 and §6).
 *
 * The agreement with `scripts/lib/lesson-passages.mjs` is a contract test
 * (`tests/unit/contracts/a-passage-is-readable-by-one-rule.test.ts`); this file
 * is the module's own behaviour, including the branches the shipped corpus
 * cannot reach — two documents sharing an id, a step naming two lessons, a step
 * whose every passage is quarantined.
 *
 * The grant is injected here as a stub, which is the point of it being a
 * parameter: this layer applies ADR-0003's verdict and never derives it.
 */

import { describe, expect, it } from 'vitest';

import {
  chapterOfLesson,
  lessonsNamedBy,
  passageVerdict,
  readingFor,
  resolvePassage,
  whyUnreadable,
  type AdjudicateClaim,
  type ClaimGrant,
} from '@application/content/lesson-passages';
import type { FactClaim, LessonDocument, LessonPassage } from '@application/ports';

/* -------------------------------------------------------------------------- */
/* fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const fact = (factual: boolean): FactClaim =>
  ({ factual, source: null, verification: null }) as unknown as FactClaim;

const passage = (id: string, factual = true): LessonPassage => ({
  id,
  text: { en: `${id} in English`, fr: `${id} en français` },
  fact: fact(factual),
});

const lesson = (id: string, passages: readonly LessonPassage[]): LessonDocument => ({
  $schema: '../../schemas/lesson.schema.json',
  id,
  chapter: 'How Canadians Govern Themselves',
  order: 1,
  title: { en: `${id} title`, fr: `${id} titre` },
  passages,
});

/** Grants everything. The rule itself is `app/adapters/phaser/verified-claim.ts`'s. */
const granted: AdjudicateClaim = () => ({ granted: true, why: null, status: 'verified' });

/** Refuses everything, with the word a caller has to be able to see. */
const refused = (why: ClaimGrant['why'], status: string | null): AdjudicateClaim =>
  () => ({ granted: false, why, status });

const CORPUS: readonly LessonDocument[] = [
  lesson('govern-01', [passage('g1-a'), passage('g1-b')]),
  lesson('govern-02', [passage('g2-a')]),
];

/* -------------------------------------------------------------------------- */

describe('resolvePassage', () => {
  it('answers exactly one passage for a pair one passage carries', () => {
    const found = resolvePassage(CORPUS, { lesson: 'govern-01', passage: 'g1-b' });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.count).toBe(1);
    expect(found.lesson.id).toBe('govern-01');
    expect(found.passage.id).toBe('g1-b');
  });

  it('does not match a passage id from another lesson', () => {
    /* The whole reason the pair is the key: an id is unique only inside its
       lesson, so a bare id is not a key (ADR-0063 §4). */
    const found = resolvePassage(CORPUS, { lesson: 'govern-02', passage: 'g1-a' });
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.why).toBe('dangling');
  });

  it('is dangling with a count of 0, and says what it searched', () => {
    const found = resolvePassage(CORPUS, { lesson: 'govern-01', passage: 'renamed' });
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.why).toBe('dangling');
    expect(found.count).toBe(0);
    expect(found.message).toContain('2 loaded lesson document(s) holding 3 passage(s)');
    expect(found.message).toContain('DANGLING');
  });

  it('is ambiguous when two passages inside one lesson share an id', () => {
    const doubled = [lesson('govern-01', [passage('same'), passage('same')])];
    const found = resolvePassage(doubled, { lesson: 'govern-01', passage: 'same' });
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.why).toBe('ambiguous');
    expect(found.count).toBe(2);
  });

  it('is ambiguous when two lesson documents share an id', () => {
    /* The other route to it, and it is equally real: neither is visible to a
       schema, because `uniqueItems` compares whole items. */
    const doubled = [lesson('govern-01', [passage('p')]), lesson('govern-01', [passage('p')])];
    const found = resolvePassage(doubled, { lesson: 'govern-01', passage: 'p' });
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.why).toBe('ambiguous');
    expect(found.count).toBe(2);
  });

  it('is malformed when either half is not a string', () => {
    const half = { lesson: 'govern-01' } as unknown as { lesson: string; passage: string };
    const found = resolvePassage(CORPUS, half);
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.why).toBe('malformed');
    expect(found.count).toBe(0);
  });

  it('never answers undefined for an empty corpus: it answers dangling', () => {
    /* ADR-0024 in one assertion. `find` over `[]` is `undefined`, which reads as
       an answer; "exactly one" has no identity element to be mistaken for one. */
    const found = resolvePassage([], { lesson: 'govern-01', passage: 'g1-a' });
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.why).toBe('dangling');
  });
});

describe('passageVerdict', () => {
  it('is readable when the passage is a claim and the grant allows it', () => {
    const verdict = passageVerdict(passage('p'), granted);
    expect(verdict.readable).toBe(true);
    expect(verdict.why).toBeNull();
  });

  it('refuses factual: false before it asks the grant at all', () => {
    /* ADR-0061 §9.3: every lesson passage is a claim. A grant that waved it
       through would be right for a greeting and wrong for the guide. */
    let asked = false;
    const spy: AdjudicateClaim = () => {
      asked = true;
      return { granted: true, why: null, status: 'verified' };
    };
    const verdict = passageVerdict(passage('p', false), spy);
    expect(verdict.readable).toBe(false);
    expect(verdict.why).toBe('not-factual');
    expect(asked, 'the grant was consulted about a passage that asserts nothing').toBe(false);
  });

  it.each([
    ['not-verified', 'quarantined'],
    ['stale', 'verified'],
    ['unevidenced', 'verified'],
    ['unreadable', null],
  ] as const)('carries the grant’s own word for a refusal: %s', (why, status) => {
    const verdict = passageVerdict(passage('p'), refused(why, status));
    expect(verdict.readable).toBe(false);
    expect(verdict.why).toBe(why);
    expect(verdict.status).toBe(status);
  });

  it('refuses rather than passing when the grant names no reason', () => {
    const silent: AdjudicateClaim = () => ({ granted: false, why: null, status: null });
    expect(passageVerdict(passage('p'), silent).why).toBe('unreadable');
  });
});

describe('whyUnreadable', () => {
  it.each([
    ['not-verified', 'Only "verified" ships'],
    ['stale', 'the verdict is stale'],
    ['unevidenced', 'an assertion rather than a verification'],
    ['not-factual', 'teaches nothing'],
    ['unreadable', 'cannot be adjudicated'],
  ] as const)('says what is wrong for %s', (why, fragment) => {
    const sentence = whyUnreadable(CORPUS[0] as LessonDocument, passage('p'), {
      readable: false,
      why,
      status: 'quarantined',
    });
    expect(sentence).toContain('govern-01/p');
    expect(sentence).toContain(fragment);
  });
});

describe('chapterOfLesson', () => {
  const index = [
    { chapter: 'how-canadians-govern-themselves', lessons: ['govern-01', 'govern-02'] },
    { chapter: 'federal-elections', lessons: ['elections-01'] },
  ];

  it('names the one chapter that holds a lesson', () => {
    const found = chapterOfLesson(index, 'elections-01');
    expect(found).toEqual({ ok: true, chapter: 'federal-elections' });
  });

  it('is dangling for a lesson no chapter holds', () => {
    expect(chapterOfLesson(index, 'nothing')).toEqual({ ok: false, why: 'dangling', count: 0 });
  });

  it('is ambiguous, and does not pick the first, when two chapters hold one id', () => {
    const doubled = [
      { chapter: 'one', lessons: ['shared'] },
      { chapter: 'two', lessons: ['shared'] },
    ];
    expect(chapterOfLesson(doubled, 'shared')).toEqual({ ok: false, why: 'ambiguous', count: 2 });
  });
});

describe('lessonsNamedBy', () => {
  it('lists each lesson once, in first-seen order', () => {
    expect(
      lessonsNamedBy([
        { lesson: 'b', passage: 'x' },
        { lesson: 'a', passage: 'y' },
        { lesson: 'b', passage: 'z' },
      ]),
    ).toEqual(['b', 'a']);
  });
});

describe('readingFor', () => {
  const refs = [
    { lesson: 'govern-01', passage: 'g1-a' },
    { lesson: 'govern-01', passage: 'g1-b' },
  ];

  it('keeps the order the step named, not the order the lesson holds', () => {
    const reading = readingFor(CORPUS, [refs[1]!, refs[0]!], granted);
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(reading.value.passages.map((one) => one.id)).toEqual(['g1-b', 'g1-a']);
    expect(reading.value.lesson.id).toBe('govern-01');
    expect(reading.value.refused).toEqual([]);
  });

  it('drops a passage a verifier will not let a player read, and says which', () => {
    const mixed = [lesson('govern-01', [passage('g1-a'), passage('g1-b', false)])];
    const reading = readingFor(mixed, refs, granted);
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(reading.value.passages.map((one) => one.id)).toEqual(['g1-a']);
    expect(reading.value.refused).toHaveLength(1);
    expect(reading.value.refused[0]).toContain('govern-01/g1-b');
  });

  it('answers an empty list, not an error, when every passage is refused', () => {
    /*
     * The asymmetry that matters: ADR-0016's clock can quarantine a passage long
     * after a quest was authored, so the step has to stay survivable. The caller
     * opens nothing and the level carries on.
     */
    const reading = readingFor(CORPUS, refs, refused('not-verified', 'quarantined'));
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(reading.value.passages).toEqual([]);
    expect(reading.value.refused).toHaveLength(2);
  });

  it('refuses the whole step when a reference resolves to nothing', () => {
    /* A dangling reference is a document defect somebody has to fix, and it is
       loud where a quarantine is survivable. */
    const reading = readingFor(CORPUS, [{ lesson: 'govern-01', passage: 'gone' }], granted);
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.kind).toBe('not-found');
    expect(reading.error.code).toBe('content.lesson.passage.dangling');
  });

  it('refuses the whole step when a reference names two passages', () => {
    const doubled = [lesson('govern-01', [passage('same'), passage('same')])];
    const reading = readingFor(doubled, [{ lesson: 'govern-01', passage: 'same' }], granted);
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.kind).toBe('invalid');
    expect(reading.error.code).toBe('content.lesson.passage.ambiguous');
    expect(reading.error.details?.['count']).toBe(2);
  });

  it('refuses a step that names two lessons, because a sheet has one title', () => {
    const reading = readingFor(
      CORPUS,
      [
        { lesson: 'govern-01', passage: 'g1-a' },
        { lesson: 'govern-02', passage: 'g2-a' },
      ],
      granted,
    );
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.code).toBe('content.lesson.passages.manyLessons');
    expect(reading.error.details?.['lessons']).toEqual(['govern-01', 'govern-02']);
  });

  it('refuses a step that names no passages at all', () => {
    const reading = readingFor(CORPUS, [], granted);
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.code).toBe('content.lesson.passages.empty');
  });
});
