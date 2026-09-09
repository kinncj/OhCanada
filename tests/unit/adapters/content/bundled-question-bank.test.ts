/**
 * The question bank adapter, run over the REAL `content/questions/` tree.
 *
 * Every assertion below is against the 237 documents the repository actually
 * ships, and the negative cases are made by *taking content away* from that same
 * map rather than by hand-building a fixture. That is deliberate and it is the
 * point of `QuestionBankOptions.modules`: a floor proved against a fixture only
 * proves the fixture, and the failures this file has to catch — a glob that
 * matched nothing, a directory that moved, a subject whose every question was
 * rejected — are all failures of the *real* map. A fixture cannot be wrong in
 * those ways, so it cannot demonstrate that the floor catches them.
 */

import { describe, expect, it } from 'vitest';

import {
  BUNDLED_QUESTION_MODULES,
  createQuestionBank,
  questionAddress,
  type QuestionModuleMap,
} from '@adapters/content';
import { loadEveryBank } from '@application/content/question-bank';
import type { SubjectId } from '@domain/ids';

const subject = (id: string): SubjectId => id as SubjectId;

/** The real map, with every document under `<name>/` removed. */
const without = (name: string): QuestionModuleMap =>
  Object.fromEntries(
    Object.entries(BUNDLED_QUESTION_MODULES).filter(
      ([path]) => questionAddress(path)?.subject !== name,
    ),
  );

/** The real map, keeping only the listed paths. */
const only = (paths: readonly string[]): QuestionModuleMap =>
  Object.fromEntries(paths.map((path) => [path, BUNDLED_QUESTION_MODULES[path] as () => Promise<unknown>]));

interface RawQuestion {
  readonly id: string;
  readonly subject: string;
  readonly verification: { readonly status: string };
}

/** Read every document once, so the expected numbers come from the tree, not from me. */
const readTree = async (): Promise<readonly { path: string; document: RawQuestion }[]> =>
  Promise.all(
    Object.entries(BUNDLED_QUESTION_MODULES).map(async ([path, load]) => {
      const module = (await load()) as { readonly default?: RawQuestion };
      return { path, document: (module.default ?? module) as RawQuestion };
    }),
  );

describe('the bundled bank, over the content that ships', () => {
  it('serves every verified question and not one rejected one', async () => {
    const tree = await readTree();
    const rejected = tree.filter((entry) => entry.document.verification.status !== 'verified');
    const verified = tree.filter((entry) => entry.document.verification.status === 'verified');

    /* The tree itself has to be interesting, or everything below is vacuous:
       a bank with nothing rejected in it cannot demonstrate an exclusion. */
    expect(tree.length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);

    const loaded = await loadEveryBank(createQuestionBank());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.value).toHaveLength(verified.length);

    const served = new Set(loaded.value.map((question) => String(question.id)));
    for (const entry of rejected) {
      expect(served.has(entry.document.id)).toBe(false);
    }
    for (const question of loaded.value) {
      expect(question.verification.status).toBe('verified');
    }
  });

  it('lists the subjects that have a directory, sorted, derived from the tree', async () => {
    /* Derived, not written down: a subject is a directory, and the bank is
       authored continuously. What is fixed is that the list is exactly the
       directories under `content/questions/`, sorted, with nothing invented. */
    const onDisk = [
      ...new Set(
        Object.keys(BUNDLED_QUESTION_MODULES).flatMap((path) => {
          const address = questionAddress(path);
          return address === null ? [] : [address.subject];
        }),
      ),
    ].sort();
    expect(onDisk.length).toBeGreaterThan(1);

    const subjects = await createQuestionBank().subjects();
    expect(subjects.ok).toBe(true);
    if (!subjects.ok) return;
    expect(subjects.value.map(String)).toEqual(onDisk);
  });

  it('keeps both languages on every served question, and chooses neither', async () => {
    const loaded = await loadEveryBank(createQuestionBank());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    for (const question of loaded.value) {
      expect(question.prompt.en.length).toBeGreaterThan(0);
      expect(question.prompt.fr.length).toBeGreaterThan(0);
      expect(question.explanation.fr.length).toBeGreaterThan(0);
      for (const option of question.options) expect(option.fr.length).toBeGreaterThan(0);
    }
  });

  it('returns each subject in a stable, machine-independent order', async () => {
    const first = await createQuestionBank().questions(subject('rights'));
    const second = await createQuestionBank().questions(subject('rights'));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.map((q) => String(q.id))).toEqual(second.value.map((q) => String(q.id)));
    const ids = first.value.map((q) => String(q.id));
    expect(ids).toEqual([...ids].sort());
  });

  it('fetches a subject once and serves the second caller from the cache', async () => {
    let fetches = 0;
    const counted: QuestionModuleMap = Object.fromEntries(
      Object.entries(BUNDLED_QUESTION_MODULES).map(([path, load]) => [
        path,
        async () => {
          fetches += 1;
          return load();
        },
      ]),
    );
    const inRights = Object.keys(BUNDLED_QUESTION_MODULES).filter(
      (path) => questionAddress(path)?.subject === 'rights',
    ).length;
    expect(inRights).toBeGreaterThan(0);

    const bank = createQuestionBank({ modules: counted });
    const [a, b] = await Promise.all([
      bank.questions(subject('rights')),
      bank.questions(subject('rights')),
    ]);
    expect(a?.ok && b?.ok).toBe(true);
    /* One subject's documents, once — not twice for two concurrent callers, and
       not the whole bank for one subject's drill. */
    expect(fetches).toBe(inRights);
    await bank.questions(subject('rights'));
    expect(fetches).toBe(inRights);
  });
});

describe('the floor, proved by removing content', () => {
  it('refuses a subject whose directory is gone, and says which are left', async () => {
    const bank = createQuestionBank({ modules: without('history') });

    const subjects = await bank.subjects();
    expect(subjects.ok).toBe(true);
    if (subjects.ok) expect(subjects.value.map(String)).not.toContain('history');

    const missing = await bank.questions(subject('history'));
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('content.questions.subject.missing');
    expect(missing.error.kind).toBe('not-found');
    /* Not retryable, and the message has to name what does exist or a report of
       it is indistinguishable from a network failure. */
    expect(missing.error.message).toContain('government');
  });

  it('refuses a subject whose every question was rejected, rather than serving none', async () => {
    const tree = await readTree();
    const rejectedRights = tree.filter(
      (entry) =>
        entry.document.subject === 'rights' && entry.document.verification.status !== 'verified',
    );
    /* The exclusion has to have something to exclude, or the refusal below could
       be a missing directory wearing the wrong error code. */
    expect(rejectedRights.length).toBeGreaterThan(0);

    const bank = createQuestionBank({ modules: only(rejectedRights.map((entry) => entry.path)) });

    const subjects = await bank.subjects();
    expect(subjects.ok).toBe(true);
    if (subjects.ok) expect(subjects.value.map(String)).toEqual(['rights']);

    const drawn = await bank.questions(subject('rights'));
    expect(drawn.ok).toBe(false);
    if (drawn.ok) return;
    expect(drawn.error.code).toBe('content.questions.bank.empty');
    /* `offered` and `admitted` are what separate "the files are gone" from
       "the files are all rejected". Both are zero-length decks; only one is a
       verification result. */
    expect(drawn.error.details).toMatchObject({
      subject: 'rights',
      offered: rejectedRights.length,
      admitted: 0,
    });
  });

  it('refuses a catalogue with nothing in it at all', async () => {
    const bank = createQuestionBank({ modules: {} });

    const subjects = await bank.subjects();
    expect(subjects.ok).toBe(false);
    if (subjects.ok) return;
    expect(subjects.error.code).toBe('content.questions.catalogue.empty');

    /* And the aggregate path refuses too. This is the vacuity that matters:
       `loadWholeBank` over zero subjects is `[].flat()`, which is a perfectly
       successful empty deck. */
    const whole = await loadEveryBank(bank);
    expect(whole.ok).toBe(false);
    if (!whole.ok) expect(whole.error.code).toBe('content.questions.catalogue.empty');
  });

  it('draws the rest of the game when one subject of many is empty', async () => {
    const tree = await readTree();
    const rejected = tree.filter((entry) => entry.document.verification.status !== 'verified');
    const rightsPaths = Object.keys(BUNDLED_QUESTION_MODULES).filter(
      (path) => questionAddress(path)?.subject === 'rights',
    );
    /* Every history document, plus only the rejected ones from rights: two
       subjects, one of which admits nothing. */
    const modules = only([
      ...Object.keys(BUNDLED_QUESTION_MODULES).filter(
        (path) => questionAddress(path)?.subject === 'history',
      ),
      ...rejected.filter((entry) => rightsPaths.includes(entry.path)).map((entry) => entry.path),
    ]);
    const bank = createQuestionBank({ modules });

    /*
     * The union skips it — that is the `content/questions/elections/` case, a
     * subject authored and not yet verified, and taking Study offline for it
     * would be a worse failure than the one the floor exists to catch.
     */
    const whole = await loadEveryBank(bank);
    expect(whole.ok).toBe(true);
    if (whole.ok) {
      expect(whole.value.length).toBeGreaterThan(0);
      expect(whole.value.every((question) => String(question.subject) === 'history')).toBe(true);
    }

    /* And asking for it by name still refuses, because that question has no
       honest answer but an error. */
    const named = await bank.questions(subject('rights'));
    expect(named.ok).toBe(false);
    if (!named.ok) expect(named.error.code).toBe('content.questions.bank.empty');
  });

  it('refuses the union when every subject in it is empty', async () => {
    const tree = await readTree();
    const rejected = tree.filter((entry) => entry.document.verification.status !== 'verified');
    expect(rejected.length).toBeGreaterThan(0);
    const whole = await loadEveryBank(
      createQuestionBank({ modules: only(rejected.map((entry) => entry.path)) }),
    );
    expect(whole.ok).toBe(false);
    if (!whole.ok) expect(whole.error.code).toBe('content.questions.union.empty');
  });

  it('refuses a bank whose chunk will not download, and keeps it retryable', async () => {
    let attempts = 0;
    const flaky: QuestionModuleMap = Object.fromEntries(
      Object.entries(BUNDLED_QUESTION_MODULES)
        .filter(([path]) => questionAddress(path)?.subject === 'rights')
        .map(([path, load], index) => [
          path,
          async () => {
            if (index === 0) {
              attempts += 1;
              if (attempts === 1) throw new Error('offline');
            }
            return load();
          },
        ]),
    );
    const bank = createQuestionBank({ modules: flaky });

    const first = await bank.questions(subject('rights'));
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.kind).toBe('io');
      expect(first.error.code).toBe('content.questions.fetchFailed');
    }

    /* A failure is not memoised, or "Try again" could never succeed. */
    const second = await bank.questions(subject('rights'));
    expect(second.ok).toBe(true);
  });

  it('refuses the bank when one document is malformed rather than shrinking it', async () => {
    const rightsPaths = Object.keys(BUNDLED_QUESTION_MODULES).filter(
      (path) => questionAddress(path)?.subject === 'rights',
    );
    const broken: QuestionModuleMap = Object.fromEntries(
      rightsPaths.map((path, index) => [
        path,
        index === 3
          ? async () => ({ default: { $schema: 'x', id: 'oops' } })
          : (BUNDLED_QUESTION_MODULES[path] as () => Promise<unknown>),
      ]),
    );
    const drawn = await createQuestionBank({ modules: broken }).questions(subject('rights'));
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) expect(drawn.error.kind).toBe('invalid');
  });
});
