/**
 * Which question banks exist, and how one is fetched.
 *
 * The mechanical half of "a question is data, not a component":
 * `import.meta.glob` is resolved by the bundler over
 * `content/questions/<subject>/*.json`, so dropping a file into
 * `content/questions/rights/` adds a question with no edit here, and creating
 * `content/questions/symbols/` adds a whole subject with no edit anywhere. The
 * same convention as `app/adapters/phaser/level-catalog.ts`, deliberately: two
 * ways to address authored content would be one more than the project has
 * decided on.
 *
 * ## Why a glob and not a fetch
 *
 * `content/` is not `publicDir`, so a question document is not a URL on the
 * deploy, and making it one would put 237 un-hashed, un-versioned JSON files on
 * a sub-path GitHub Pages deploy (ADR-0006). The glob is lazy, so the bank is
 * **not** on the initial payload: a title screen downloads no questions at all,
 * and a subject's documents arrive when a drill asks for that subject.
 *
 * ## The address is the id
 *
 * `content/questions/<subject>/<id>.json` states two things a document also
 * states inside itself. Both are checked (`parseQuestionDocument`), because a
 * document reachable under one name and self-described under another is
 * reachable by the quest pools that name it and invisible to the bank that
 * indexes it.
 *
 * Pure apart from the glob: everything below takes the module map as a
 * parameter, so the empty-catalogue and missing-subject paths are provable by
 * *removing content* rather than by asserting against a fixture.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { SubjectId } from '@domain/ids';

/**
 * What the bundler hands back for a lazy glob: module path -> dynamic import.
 *
 * Declared as a type rather than used inline so a test can build one over a
 * subset of the real map — the real modules, with a directory taken away — and
 * exercise the same code the deploy runs.
 */
export type QuestionModuleMap = Readonly<Record<string, () => Promise<unknown>>>;

/**
 * Every `content/questions/<subject>/<id>.json`, lazily.
 *
 * One `import.meta.glob` and not one per subject, because a per-subject glob
 * would have to name the subjects and the whole point is that a subject is a
 * directory. Chunking is a build concern and is handled in `vite.config.ts`,
 * which groups a subject's documents into one chunk so a drill costs one request
 * rather than ninety-six.
 */
export const BUNDLED_QUESTION_MODULES: QuestionModuleMap = import.meta.glob(
  '../../../content/questions/*/*.json',
);

/** `…/content/questions/history/hist-01-x.json` -> `{ subject, id }`. */
export interface QuestionAddress {
  readonly subject: string;
  readonly id: string;
}

/**
 * Read the subject and the id out of a module path.
 *
 * Returns `null` rather than a `Result` for a path this catalogue does not
 * recognise: a glob pattern is not a promise about what matched it, and a
 * `README.md` or a `.gitkeep` under `content/questions/` is not a broken
 * question — it is not a question at all. What *is* a failure is the whole map
 * yielding no address, and that is `catalogueOf`'s to refuse.
 */
export const questionAddress = (path: string): QuestionAddress | null => {
  if (!path.endsWith('.json')) return null;
  const parts = path.split('/');
  const file = parts[parts.length - 1];
  const subject = parts[parts.length - 2];
  if (file === undefined || subject === undefined) return null;
  const id = file.slice(0, -'.json'.length);
  if (id.length === 0 || subject.length === 0) return null;
  return { subject, id };
};

/** One document, addressed and not yet fetched. */
export interface QuestionEntry extends QuestionAddress {
  readonly path: string;
  readonly load: () => Promise<unknown>;
}

/** One subject's documents, in a stable order. */
export interface SubjectEntry {
  readonly subject: SubjectId;
  readonly entries: readonly QuestionEntry[];
}

/**
 * Index a module map by subject, sorted, ids sorted inside each subject.
 *
 * Sorted rather than in glob order so a draw is reproducible from a seed on
 * every machine: `import.meta.glob`'s key order is the bundler's, and a
 * scheduler that draws one uniform number per pool entry *in pool order* would
 * otherwise replay a seed differently under a different file system.
 *
 * Returns the index even when it is empty. Refusing an empty one is
 * `admitSubjectCatalogue`'s job in the application layer, where the rule can be
 * stated once for every implementation of the port rather than once per adapter.
 */
export const indexQuestionModules = (modules: QuestionModuleMap): readonly SubjectEntry[] => {
  const bySubject = new Map<string, QuestionEntry[]>();
  for (const path of Object.keys(modules)) {
    const address = questionAddress(path);
    const load = modules[path];
    if (address === null || load === undefined) continue;
    const bucket = bySubject.get(address.subject) ?? [];
    bucket.push({ ...address, path, load });
    bySubject.set(address.subject, bucket);
  }
  return [...bySubject.keys()]
    .sort()
    .map((subject) => ({
      subject: subject as SubjectId,
      entries: (bySubject.get(subject) ?? []).slice().sort((a, b) => (a.id < b.id ? -1 : 1)),
    }));
};

/**
 * Fetch every document of one subject, in index order.
 *
 * A chunk that will not download is `io` and retryable — TN-STUDY-03's "the
 * questions could not be loaded" with a Try again button. It is kept apart from
 * `not-found` for the same reason `loadLevel` keeps them apart: a UI that shows
 * one card for both tells a player to retry something that can never succeed.
 */
export const fetchSubjectModules = async (
  entry: SubjectEntry,
): Promise<Result<readonly unknown[]>> => {
  const settled = await Promise.allSettled(entry.entries.map((question) => question.load()));
  const loaded: unknown[] = [];
  for (let index = 0; index < settled.length; index += 1) {
    const outcome = settled[index];
    if (outcome === undefined || outcome.status === 'rejected') {
      return appErr(
        'io',
        'content.questions.fetchFailed',
        `a question document for subject "${String(entry.subject)}" could not be loaded.`,
        { subject: String(entry.subject), path: entry.entries[index]?.path ?? null },
        outcome?.status === 'rejected' ? outcome.reason : undefined,
      );
    }
    loaded.push(outcome.value);
  }
  return ok(loaded);
};
