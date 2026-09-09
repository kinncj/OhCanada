/**
 * `QuestionBank`, over the bundled `content/questions/` tree.
 *
 * The adapter the project did not have: 237 documents, 230 of them verified,
 * and until now no code path that turned any of them into something a player
 * could be asked. Study could only render its empty state and Exam had nothing
 * to draw from.
 *
 * ## Three refusals, and why none of them is a filter
 *
 *  1. **A rejected question never reaches a player.** Not because this file
 *     filters one out — because it cannot construct its own return type without
 *     the gate. `QuestionBank.questions` promises `ShippableQuestion[]`, whose
 *     brand is a `unique symbol` private to `app/domain/entities/question.ts`,
 *     and `admitSubjectBank` is the only route to it from here (an adapter may
 *     not import the domain except for ids). Delete the call and this file stops
 *     compiling; there is no version of it that returns the directory it read.
 *  2. **An empty bank is an error, not an empty list.** `admitSubjectBank`
 *     refuses zero, and `admitSubjectCatalogue` refuses zero *subjects* — the
 *     case a per-subject check cannot see, because a glob that matched nothing
 *     leaves every per-subject check unreachable and every aggregate vacuously
 *     true (ADR-0024).
 *  3. **A malformed document fails its whole bank.** One bad file is not a
 *     shorter drill; `make validate-content` passes all 237 in CI, so a parse
 *     failure at runtime means the deploy shipped something the build never saw.
 *     Silently skipping it would shrink a bank by an amount nobody can observe,
 *     which is the failure mode the floor exists to make loud. TN-STUDY-03 has a
 *     screen for this and it is reachable.
 *
 * ## Locale
 *
 * There is no `LocaleCode` parameter anywhere in this adapter, and there must
 * not be. A bank is loaded once and carries EN and FR inline (ADR-0010), so the
 * settings screen changes language by re-rendering a card, not by evicting a
 * cache and re-downloading a chunk mid-drill.
 *
 * ## Caching
 *
 * A subject's admitted bank is memoised, and so is the in-flight promise, so two
 * screens opening at once share one download. Only successes are memoised: `io`
 * is the flaky-connection case and "Try again" has to be able to succeed.
 * There is no `unload` — the whole verified bank is 948 KB of JSON on disk and
 * a fraction of that decoded, three orders of magnitude below the 64 MB texture
 * budget that makes level unloading necessary.
 */

import { all, appErr } from '@common/result';
import type { Result } from '@common/result';
import type { SubjectId } from '@domain/ids';
import type { QuestionBank, QuestionDocument, ShippableQuestion } from '@application/ports';
import { admitSubjectBank, admitSubjectCatalogue } from '@application/content/question-bank';

import {
  BUNDLED_QUESTION_MODULES,
  fetchSubjectModules,
  indexQuestionModules,
  type QuestionModuleMap,
  type SubjectEntry,
} from './question-catalog';
import { parseQuestionDocument } from './question-document';

export interface QuestionBankOptions {
  /**
   * The module map to read. Defaults to the bundled glob.
   *
   * Injectable so a test can run this exact code over the *real* content minus a
   * directory, or minus every verified file in one — proving the floor by taking
   * content away rather than by asserting a hand-built empty fixture, which is
   * the one thing an empty-bank test must not do.
   */
  readonly modules?: QuestionModuleMap;
}

/** Parse one subject's fetched modules, refusing the bank on the first bad one. */
const parseSubject = (
  entry: SubjectEntry,
  loaded: readonly unknown[],
): Result<readonly QuestionDocument[]> =>
  all(
    loaded.map((raw, index) =>
      parseQuestionDocument(
        raw,
        String(entry.subject),
        entry.entries[index]?.id,
      ),
    ),
  );

export const createQuestionBank = (options: QuestionBankOptions = {}): QuestionBank => {
  const index = indexQuestionModules(options.modules ?? BUNDLED_QUESTION_MODULES);
  const byId = new Map(index.map((entry) => [String(entry.subject), entry]));
  const admitted = new Map<string, readonly ShippableQuestion[]>();
  const inFlight = new Map<string, Promise<Result<readonly ShippableQuestion[]>>>();

  const loadSubject = async (
    entry: SubjectEntry,
  ): Promise<Result<readonly ShippableQuestion[]>> => {
    const fetched = await fetchSubjectModules(entry);
    if (!fetched.ok) return fetched;
    const parsed = parseSubject(entry, fetched.value);
    if (!parsed.ok) return parsed;
    return admitSubjectBank(entry.subject, parsed.value);
  };

  return {
    async subjects(): Promise<Result<readonly SubjectId[]>> {
      return admitSubjectCatalogue(index.map((entry) => entry.subject));
    },

    async questions(subject: SubjectId): Promise<Result<readonly ShippableQuestion[]>> {
      const key = String(subject);
      const cached = admitted.get(key);
      if (cached !== undefined) return { ok: true, value: cached };

      const entry = byId.get(key);
      if (entry === undefined) {
        /* Kept apart from `bank.empty`: no directory is an id nobody authored and
           retrying it will never help, where an empty one is a build defect. */
        return appErr(
          'not-found',
          'content.questions.subject.missing',
          `no question bank named "${key}" under content/questions/. Known: ` +
            `${index.map((known) => String(known.subject)).join(', ') || '(none)'}.`,
          { subject: key, known: index.map((known) => String(known.subject)) },
        );
      }

      const pending = inFlight.get(key) ?? loadSubject(entry);
      inFlight.set(key, pending);
      try {
        const result = await pending;
        if (result.ok) admitted.set(key, result.value);
        return result;
      } finally {
        inFlight.delete(key);
      }
    },
  };
};

/**
 * The bank the composition root wires. Building it reads glob *keys* only —
 * no document is fetched until a subject is asked for.
 */
export const bundledQuestionBank: QuestionBank = createQuestionBank();
