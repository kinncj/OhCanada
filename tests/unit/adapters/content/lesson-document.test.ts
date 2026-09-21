/**
 * Reading `content/lessons/<chapter>/<id>.json` at run time.
 *
 * Every branch here is a document the deploy shipped and the build never saw —
 * `make validate-content` checks all 48 against the schema in CI — so what this
 * parser is for is turning "that is not a lesson" into a `Result` a caller can
 * report, instead of a cast that opens a reader with `undefined` in it.
 *
 * What it must NOT do is adjudicate: a quarantined passage is parsed exactly as
 * a verified one is, because the verification block is what the filter one layer
 * up needs in order to refuse it (ADR-0063 §6).
 */

import { describe, expect, it } from 'vitest';

import { parseLessonDocument } from '@adapters/content';

const ADDRESS = { chapter: 'how-canadians-govern-themselves', id: 'govern-01-a-federal-state' };

const claim = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  factual: true,
  source: { sourceId: 'discover-canada', sourceHash: 'a'.repeat(64) },
  verification: { status: 'verified', sourceHash: 'a'.repeat(64), evidence: 'quoted' },
  ...over,
});

const document = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  $schema: '../../schemas/lesson.schema.json',
  id: ADDRESS.id,
  chapter: 'How Canadians Govern Themselves',
  order: 1,
  title: { en: 'What federalism gives a province', fr: 'Ce que le fédéralisme donne' },
  passages: [
    {
      id: 'g1-policies-that-fit-each-province',
      text: { en: 'A province can shape its policies.', fr: 'Une province façonne ses politiques.' },
      fact: claim(),
    },
  ],
  ...over,
});

describe('parseLessonDocument', () => {
  it('reads a document the corpus actually ships the shape of', () => {
    const parsed = parseLessonDocument(document(), ADDRESS);
    expect(parsed.ok, parsed.ok ? '' : parsed.error.message).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.id).toBe(ADDRESS.id);
    expect(parsed.value.chapter).toBe('How Canadians Govern Themselves');
    expect(parsed.value.passages).toHaveLength(1);
    expect(parsed.value.passages[0]?.text.fr).toBe('Une province façonne ses politiques.');
  });

  it('carries a quarantined grant through rather than dropping the passage', () => {
    /*
     * The filter is `app/application/content/lesson-passages.ts`'s. An adapter
     * that dropped it here would make "this chapter has one lesson" and "this
     * chapter has one readable lesson" the same number, which is the diagnostic
     * that tells a missing chapter from a fully quarantined one.
     */
    const parsed = parseLessonDocument(
      document({
        passages: [
          {
            id: 'p',
            text: { en: 'a', fr: 'b' },
            fact: claim({
              verification: { status: 'quarantined', sourceHash: 'x', evidence: '' },
            }),
          },
        ],
      }),
      ADDRESS,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.passages[0]?.fact.verification?.status).toBe('quarantined');
  });

  it('refuses a document filed under a name it does not call itself', () => {
    /* Reachable by the `read` step that names it and invisible to the index that
       addresses it — a failure no schema can see, because a schema sees one file
       and never its path. */
    const parsed = parseLessonDocument(document({ id: 'govern-09-something-else' }), ADDRESS);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe('content.lesson.id');
    expect(parsed.error.details?.['addressed']).toBe(ADDRESS.id);
    expect(parsed.error.details?.['declared']).toBe('govern-09-something-else');
  });

  it.each([
    ['not an object at all', 'a string', 'content.lesson.document'],
    ['no $schema', document({ $schema: undefined }), 'content.lesson.$schema'],
    ['a non-kebab id', document({ id: 'Govern One' }), 'content.lesson.id'],
    ['no chapter', document({ chapter: '' }), 'content.lesson.chapter'],
    ['an order of zero', document({ order: 0 }), 'content.lesson.order'],
    ['a half-translated title', document({ title: { en: 'x' } }), 'content.lesson.title'],
    ['no passages', document({ passages: [] }), 'content.lesson.passages'],
  ])('refuses a document with %s', (_name, raw, code) => {
    const parsed = parseLessonDocument(raw, ADDRESS);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe(code);
  });

  it.each([
    ['is not an object', 'nope', 'content.lesson.passages[0]'],
    ['has no id', { text: { en: 'a', fr: 'b' }, fact: claim() }, 'content.lesson.passages[0].id'],
    [
      'is missing its French',
      { id: 'p', text: { en: 'a' }, fact: claim() },
      'content.lesson.passages[0].text',
    ],
    [
      'carries no fact block',
      { id: 'p', text: { en: 'a', fr: 'b' } },
      'content.lesson.passages[0].fact',
    ],
    [
      'carries a fact block with no factual flag',
      { id: 'p', text: { en: 'a', fr: 'b' }, fact: { source: null } },
      'content.lesson.passages[0].fact.factual',
    ],
  ])('refuses a passage that %s', (_name, passage, code) => {
    const parsed = parseLessonDocument(document({ passages: [passage] }), ADDRESS);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe(code);
  });
});
