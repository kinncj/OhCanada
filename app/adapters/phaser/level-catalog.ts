/**
 * Which levels exist, and how one is fetched.
 *
 * This module is the mechanical half of "a level must be addable by JSON and
 * assets alone". `import.meta.glob` is resolved by the bundler over
 * `content/levels/*.json`, so dropping `quebec-city.json` into that directory
 * adds a level to the catalog with no edit here and no edit to a scene: the
 * glob finds it, `parseLevelDocument` reads it, and `LevelScene` builds it.
 * Slice 2 is the proof, and if it ever needs a line of code, the level schema is
 * wrong (`docs/plan/slices.md`, Rules).
 *
 * ## Why a glob and not a fetch
 *
 * `content/` is not `publicDir`, so a level document is not a URL on the deploy
 * — and making it one would put an un-hashed, un-versioned JSON file on the
 * critical path of a sub-path GitHub Pages deploy (ADR-0006). The glob is lazy,
 * so each level becomes its own chunk: nothing but the level being played is on
 * the initial payload budget, and the previous level's document is releasable
 * with it (CLAUDE.md, Budgets).
 *
 * ## Why the load is `Result` and not a throw
 *
 * A level that will not load is TN-LEVEL-02, an expected failure with a player-
 * facing error card and a "Try again" button. `common/result.ts` reserves
 * exceptions for programmer errors, so a missing id, a malformed document and a
 * chunk that would not download all arrive as an `AppError` the loader can put
 * on screen and retry.
 */

import { appErr, ok, type Result } from '@common/result';

import { parseLevelDocument, type SceneLevel } from './level-document';

/**
 * Every `content/levels/*.json`, lazily. Keys are the module paths the bundler
 * saw; `idOf` turns one into the level id, which is also the file name and also
 * `document.id` — the schema's `levelId` is defined as naming
 * `content/levels/<id>.json`, so all three agree by construction.
 */
const LEVEL_MODULES: Record<string, () => Promise<unknown>> = import.meta.glob(
  '../../../content/levels/*.json',
);

const idOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);

/** The ids of every authored level, sorted. Derived from the directory, never listed. */
export function levelIds(): readonly string[] {
  return Object.keys(LEVEL_MODULES).map(idOf).sort();
}

/** True when a level document with this id exists. */
export function hasLevel(id: string): boolean {
  return levelIds().includes(id);
}

/**
 * The id a boot with no explicit choice should open.
 *
 * Deliberately *not* `game.config.json`'s `levels` or `unlockRules`: which level
 * a player is allowed to open next is progression, and progression belongs to
 * the application layer and its save data, not to a renderer. All this answers
 * is "of the levels that exist, which one is first alphabetically", which is
 * enough to open a level from a URL and not enough to be mistaken for an
 * unlocking rule.
 */
export function firstLevelId(): string | null {
  return levelIds()[0] ?? null;
}

/**
 * Fetch and parse one level.
 *
 * The two failures are kept apart on purpose. `not-found` is an id nobody
 * authored — a bad link, a typo in a URL — and retrying it will never help.
 * `io` is the chunk not arriving, which is TN-LEVEL-02's "requests for the
 * Ottawa assets fail" and is exactly the case where "Try again" is the right
 * button. A UI that shows the same card for both would be telling a player to
 * retry something that cannot succeed.
 */
export async function loadLevel(id: string): Promise<Result<SceneLevel>> {
  const path = Object.keys(LEVEL_MODULES).find((key) => idOf(key) === id);
  if (path === undefined) {
    return appErr(
      'not-found',
      'content.level.missing',
      `no level document named "${id}" under content/levels/. Known: ${levelIds().join(', ') || '(none)'}.`,
      { level: id },
    );
  }

  let raw: unknown;
  try {
    raw = await (LEVEL_MODULES[path] as () => Promise<unknown>)();
  } catch (cause) {
    return appErr(
      'io',
      'content.level.fetchFailed',
      `the document for level "${id}" could not be loaded.`,
      { level: id },
      cause,
    );
  }

  return interpretLevelModule(id, raw);
}

/**
 * Turn whatever the bundler handed back into a level, or say why it is not one.
 *
 * Split out of `loadLevel` so both of its failures are reachable from a test
 * without a bundler: the unwrap and the id check are the two places a document
 * that downloaded perfectly can still be unusable, and an untestable failure
 * path is a failure path nobody has ever seen work.
 */
export function interpretLevelModule(id: string, raw: unknown): Result<SceneLevel> {
  /* A JSON module is `{ default: … }` under the bundler and the raw object under
     a test that stubs it; both are accepted rather than assuming a shape that
     differs between the artefact under test and the artefact deployed. */
  const document =
    typeof raw === 'object' && raw !== null && 'default' in raw
      ? (raw as { readonly default: unknown }).default
      : raw;

  const parsed = parseLevelDocument(document);
  if (!parsed.ok) return parsed;
  if (parsed.value.id !== id) {
    return appErr(
      'invalid',
      'content.level.idMismatch',
      `content/levels/${id}.json declares id "${parsed.value.id}". The file name is the id ` +
        '(common.schema.json, levelId), so a mismatch makes the level unreachable by the name ' +
        'every other document refers to it by.',
      { level: id, declared: parsed.value.id },
    );
  }
  return ok(parsed.value);
}

/**
 * The catalog as an injectable seam, so a test can drive the loader without a
 * bundler glob and the failure path is provable rather than argued about.
 */
export interface LevelCatalog {
  ids(): readonly string[];
  load(id: string): Promise<Result<SceneLevel>>;
}

export const bundledLevelCatalog: LevelCatalog = {
  ids: levelIds,
  load: loadLevel,
};
