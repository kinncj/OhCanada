/**
 * The runtime read of a question document.
 *
 * Two halves. The first is that every one of the 237 real documents parses —
 * a parser that agrees with the schema on a fixture and disagrees on the tree is
 * a parser nobody has run. The second is that each refusal names its field,
 * because `make validate-content` gives a JSON pointer and this has to give
 * something a person can act on with the same effort.
 */

import { describe, expect, it } from 'vitest';

import { BUNDLED_QUESTION_MODULES, parseQuestionDocument, questionAddress } from '@adapters/content';

const REAL = Object.entries(BUNDLED_QUESTION_MODULES);

/** A document that is valid in every respect, as the object literal below mutates it. */
const valid = (): Record<string, unknown> => ({
  $schema: '../../schemas/question.schema.json',
  id: 'demo-01-a-question',
  subject: 'history',
  prompt: { en: 'Prompt?', fr: 'Question?' },
  options: [
    { en: 'a', fr: 'a' },
    { en: 'b', fr: 'b' },
    { en: 'c', fr: 'c' },
    { en: 'd', fr: 'd' },
  ],
  correctIndex: 0,
  explanation: { en: 'Because.', fr: 'Parce que.' },
  source: {
    sourceId: 'discover-canada',
    chapter: "Canada's History",
    page: 23,
    quote: 'a passage',
    url: 'https://example.invalid/',
    sourceHash: 'a'.repeat(64),
    asOf: '2026-09-08T00:00:00Z',
    volatile: false,
  },
  verification: {
    status: 'verified',
    model: 'a-model',
    checkedAt: '2026-09-09T00:00:00Z',
    sourceHash: 'a'.repeat(64),
    evidence: 'the passage that entails it',
  },
});

describe('every shipped question document parses', () => {
  it('reads every one of them without a single refusal', async () => {
    /* A floor, not a count: the bank is authored continuously, but a glob that
       matched nothing would make the loop below pass over zero documents. */
    expect(REAL.length).toBeGreaterThan(200);
    for (const [path, load] of REAL) {
      const address = questionAddress(path);
      expect(address).not.toBeNull();
      const parsed = parseQuestionDocument(await load(), address?.subject, address?.id);
      expect(parsed.ok, `${path}: ${parsed.ok ? '' : parsed.error.message}`).toBe(true);
    }
  });
});

describe('a document that is not a question', () => {
  const cases: readonly [string, unknown, string][] = [
    ['not an object', 42, 'content.question.document'],
    ['no $schema', { ...valid(), $schema: undefined }, 'content.question.$schema'],
    ['an id that is not kebab-case', { ...valid(), id: 'Not An Id' }, 'content.question.id'],
    ['a subject that is not kebab-case', { ...valid(), subject: '' }, 'content.question.subject'],
    ['a prompt that is not localized', { ...valid(), prompt: 'hello' }, 'content.question.prompt'],
    [
      'a prompt missing French',
      { ...valid(), prompt: { en: 'Prompt?' } },
      'content.question.prompt',
    ],
    ['three options', { ...valid(), options: [1, 2, 3] }, 'content.question.options'],
    [
      'an option missing French',
      { ...valid(), options: [{ en: 'a' }, { en: 'b', fr: 'b' }, { en: 'c', fr: 'c' }, { en: 'd', fr: 'd' }] },
      'content.question.options.0',
    ],
    ['a correctIndex of 4', { ...valid(), correctIndex: 4 }, 'content.question.correctIndex'],
    ['a correctIndex that is a string', { ...valid(), correctIndex: '0' }, 'content.question.correctIndex'],
    ['no explanation', { ...valid(), explanation: null }, 'content.question.explanation'],
    ['no source block', { ...valid(), source: 'discover-canada' }, 'content.question.source'],
    [
      'a source with no hash',
      { ...valid(), source: { ...(valid()['source'] as object), sourceHash: '' } },
      'content.question.sourceHash',
    ],
    [
      'a source with a non-boolean volatile',
      { ...valid(), source: { ...(valid()['source'] as object), volatile: 'no' } },
      'content.question.source.volatile',
    ],
    [
      'a source with page 0',
      { ...valid(), source: { ...(valid()['source'] as object), page: 0 } },
      'content.question.source.page',
    ],
    ['no verification block', { ...valid(), verification: [] }, 'content.question.verification'],
    [
      'a verification status nobody defined',
      { ...valid(), verification: { ...(valid()['verification'] as object), status: 'probably' } },
      'content.question.verification.status',
    ],
    [
      'a checkedAt that is neither a string nor null',
      { ...valid(), verification: { ...(valid()['verification'] as object), checkedAt: 0 } },
      'content.question.verification.checkedAt',
    ],
    [
      'a model that is not a string',
      { ...valid(), verification: { ...(valid()['verification'] as object), model: 7 } },
      'content.question.model',
    ],
  ];

  it.each(cases)('refuses %s', (_name, document, code) => {
    const parsed = parseQuestionDocument(document);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe(code);
  });
});

describe('the address is part of the document', () => {
  it('refuses a file whose declared id is not its file name', () => {
    const parsed = parseQuestionDocument(valid(), 'history', 'hist-99-something-else');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('content.question.id');
      expect(parsed.error.details).toMatchObject({ declared: 'demo-01-a-question' });
    }
  });

  it('refuses a file filed under a subject it does not claim', () => {
    const parsed = parseQuestionDocument(valid(), 'rights', 'demo-01-a-question');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('content.question.subject');
  });

  it('accepts the bundler wrapper and the bare object alike', () => {
    const bare = parseQuestionDocument(valid());
    const wrapped = parseQuestionDocument({ default: valid() });
    expect(bare.ok && wrapped.ok).toBe(true);
    if (bare.ok && wrapped.ok) expect(wrapped.value).toEqual(bare.value);
  });

  it('keeps an optional page when it is there and omits it when it is not', () => {
    const withPage = parseQuestionDocument(valid());
    const source = valid()['source'] as Record<string, unknown>;
    delete source['page'];
    const withoutPage = parseQuestionDocument({ ...valid(), source });
    expect(withPage.ok && withoutPage.ok).toBe(true);
    if (!withPage.ok || !withoutPage.ok) return;
    expect(withPage.value.source.page).toBe(23);
    expect('page' in withoutPage.value.source).toBe(false);
  });

  it('reads a rejected document rather than hiding it from the gate above', () => {
    const parsed = parseQuestionDocument({
      ...valid(),
      verification: { status: 'rejected', model: '', checkedAt: null, sourceHash: '', evidence: '' },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.verification.status).toBe('rejected');
  });
});
