/**
 * The gate and the floor, as rules — independently of where the documents came
 * from.
 *
 * `bundled-question-bank.test.ts` proves these fire over the real tree. This
 * file proves what they say, including the case a content-driven test cannot
 * make today: a question whose verification hash no longer matches the source it
 * cites. Nothing in `content/questions/` is stale right now, and a rule that has
 * never been shown to reject anything is a rule nobody has run.
 */

import { describe, expect, it } from 'vitest';

import {
  admitSubjectBank,
  admitSubjectCatalogue,
  loadEveryBank,
  MIN_SHIPPABLE_PER_SUBJECT,
  SUBJECT_SHIP_THRESHOLD,
} from '@application/content/question-bank';
import type { QuestionBank, QuestionDocument, ShippableQuestion } from '@application/ports';
import { appErr, ok } from '@common/result';
import type { QuestionId, SubjectId } from '@domain/ids';

const HASH = 'a'.repeat(64);

const question = (id: string, patch: Partial<QuestionDocument> = {}): QuestionDocument =>
  ({
    $schema: 'x',
    id: id as QuestionId,
    subject: 'history' as SubjectId,
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
      chapter: 'A chapter',
      quote: 'a passage',
      url: 'https://example.invalid/',
      sourceHash: HASH,
      asOf: '2026-09-08T00:00:00Z' as never,
      volatile: false,
    },
    verification: {
      status: 'verified',
      model: 'a-model',
      checkedAt: '2026-09-09T00:00:00Z' as never,
      sourceHash: HASH,
      evidence: 'the passage that entails it',
    },
    ...patch,
  }) as QuestionDocument;

const history = 'history' as SubjectId;

describe('admitSubjectBank', () => {
  it('admits a verified, bilingual question', () => {
    const admitted = admitSubjectBank(history, [question('a')]);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) expect(admitted.value.map((q) => String(q.id))).toEqual(['a']);
  });

  it.each([
    ['rejected', { status: 'rejected' as const }],
    ['quarantined', { status: 'quarantined' as const }],
    ['unverified', { status: 'unverified' as const }],
    ['verified against a hash the source no longer has', { sourceHash: 'b'.repeat(64) }],
    ['verified with no evidence quoted', { evidence: '   ' }],
  ])('never admits a question that is %s', (_name, patch) => {
    const bad = question('bad', {
      verification: { ...question('bad').verification, ...patch },
    });
    const admitted = admitSubjectBank(history, [bad, question('good')]);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) expect(admitted.value.map((q) => String(q.id))).toEqual(['good']);
  });

  it('never admits a question missing its French text', () => {
    const half = question('half', { explanation: { en: 'Because.', fr: '' } });
    const admitted = admitSubjectBank(history, [half, question('good')]);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) expect(admitted.value.map((q) => String(q.id))).toEqual(['good']);
  });

  it('refuses an empty list rather than reporting a deck of nothing', () => {
    const admitted = admitSubjectBank(history, []);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('content.questions.bank.empty');
    expect(admitted.error.details).toMatchObject({ offered: 0, admitted: 0 });
    expect(admitted.error.message).toContain('broken build');
  });

  it('distinguishes "no files" from "every file rejected" in the message', () => {
    const admitted = admitSubjectBank(history, [
      question('a', { verification: { ...question('a').verification, status: 'rejected' } }),
    ]);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.details).toMatchObject({ offered: 1, admitted: 0 });
    expect(admitted.error.message).toContain('may be shown');
  });

  it('lets a bank shorter than the drill size through — a short drill is not a defect', () => {
    const admitted = admitSubjectBank(history, [question('a'), question('b')]);
    expect(admitted.ok).toBe(true);
    expect(MIN_SHIPPABLE_PER_SUBJECT).toBe(1);
    /* The 30 is a shipping rule, checked as a build gate, not a runtime outage. */
    expect(SUBJECT_SHIP_THRESHOLD).toBe(30);
    expect(MIN_SHIPPABLE_PER_SUBJECT).toBeLessThan(SUBJECT_SHIP_THRESHOLD);
  });
});

describe('admitSubjectCatalogue', () => {
  it('passes a catalogue with subjects in it', () => {
    const admitted = admitSubjectCatalogue([history]);
    expect(admitted.ok).toBe(true);
  });

  it('refuses a catalogue with none', () => {
    const admitted = admitSubjectCatalogue([]);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) expect(admitted.error.code).toBe('content.questions.catalogue.empty');
  });

  it('refuses a subject listed twice, which would weight it twice in a draw', () => {
    const admitted = admitSubjectCatalogue([history, history]);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('content.questions.catalogue.duplicate');
      expect(admitted.error.details).toMatchObject({ duplicates: ['history'] });
    }
  });
});

describe('loadEveryBank', () => {
  const bankOf = (
    subjects: readonly string[],
    per: (subject: string) => ReturnType<typeof admitSubjectBank>,
  ): QuestionBank => ({
    subjects: async () => admitSubjectCatalogue(subjects as unknown as SubjectId[]),
    questions: async (subject) => per(String(subject)),
  });

  it('unions every subject the catalogue lists', async () => {
    const loaded = await loadEveryBank(
      bankOf(['history', 'rights'], (subject) =>
        admitSubjectBank(subject as SubjectId, [question(`${subject}-1`), question(`${subject}-2`)]),
      ),
    );
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.map((q) => String(q.id))).toEqual([
        'history-1',
        'history-2',
        'rights-1',
        'rights-2',
      ]);
    }
  });

  it('skips a subject nobody has verified yet instead of taking the game down with it', async () => {
    /* The case this was written for: `content/questions/elections/` landed with
       eight authored questions and no verifier run. "Everything a player can be
       asked" has an honest answer that does not include elections. */
    const loaded = await loadEveryBank(
      bankOf(['elections', 'history'], (subject) =>
        admitSubjectBank(
          subject as SubjectId,
          subject === 'elections'
            ? [
                question('e-1', {
                  verification: { ...question('e-1').verification, status: 'unverified' },
                }),
              ]
            : [question('h-1')],
        ),
      ),
    );
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.map((q) => String(q.id))).toEqual(['h-1']);
  });

  it('still refuses the union when every subject is empty', async () => {
    /* The floor moved from the member to the union; it did not go away. Skipping
       one subject and skipping all of them are the same code path, and only one
       of them may succeed. */
    const loaded = await loadEveryBank(
      bankOf(['elections', 'symbols'], (subject) => admitSubjectBank(subject as SubjectId, [])),
    );
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('content.questions.union.empty');
    expect(loaded.error.details).toMatchObject({ skipped: ['elections', 'symbols'] });
  });

  it('fails the whole union on a chunk that will not download', async () => {
    /* Not the same as "not verified yet". A subject missing because the network
       dropped it would make the drill quietly smaller and describe itself as
       complete. */
    const loaded = await loadEveryBank(
      bankOf(['history', 'rights'], (subject) =>
        subject === 'rights'
          ? appErr('io', 'content.questions.fetchFailed', 'offline')
          : admitSubjectBank(subject as SubjectId, [question('h')]),
      ),
    );
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('content.questions.fetchFailed');
  });

  it('fails the whole union on a malformed document', async () => {
    const loaded = await loadEveryBank(
      bankOf(['history', 'rights'], (subject) =>
        subject === 'rights'
          ? appErr('invalid', 'content.question.prompt', 'no French')
          : admitSubjectBank(subject as SubjectId, [question('h')]),
      ),
    );
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.kind).toBe('invalid');
  });

  it('refuses a catalogue with no subjects rather than a successful empty union', async () => {
    /* `[].flat()` is `[]` and `Promise.all([])` resolves. Without the catalogue
       floor this call is a clean success describing a game with no questions. */
    const loaded = await loadEveryBank(bankOf([], () => ok([] as readonly ShippableQuestion[])));
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('content.questions.catalogue.empty');
  });
});
