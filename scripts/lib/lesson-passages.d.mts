/**
 * Types for `scripts/lib/lesson-passages.mjs`, hand-written, for the same reason
 * `claims.d.mts` and `staleness.d.mts` are: the module is `.mjs` because it must
 * stay runnable by a plain Node script with no build step, and its other caller
 * is a TypeScript contract test running under `strict` with `allowJs` off, which
 * cannot import it without this file. A signature change here that the module
 * does not match breaks `make typecheck`, which is what keeps the one
 * implementation one implementation.
 *
 * The parameter types are as WIDE as the JSON they describe: everything a
 * document carries is `unknown` until a narrowing helper looks at it, exactly as
 * the runtime does. A narrower type would be an assertion about content that the
 * schema, not TypeScript, is responsible for — and this module's whole job is to
 * check references the schema cannot see.
 */

export declare const LESSONS_DIR: string;
export declare const QUESTS_DIR: string;

/** One passage, flattened to what a reference resolves against. */
export interface CorpusPassage {
  readonly id: string;
  /** Position in its lesson's `passages[]`, for the pointer in a message. */
  readonly index: number;
  /** `/passages/3`. */
  readonly pointer: string;
  /** The `factClaim` block, or `null` when the document did not carry one. */
  readonly fact: { readonly [key: string]: unknown } | null;
  readonly text: { readonly [key: string]: unknown } | null;
}

/** One lesson document, flattened. */
export interface CorpusLesson {
  readonly id: string;
  readonly chapter: string;
  /** `content/lessons/<chapter>/<file>.json`. */
  readonly where: string;
  readonly passages: readonly CorpusPassage[];
}

/**
 * Every lesson in a tree.
 *
 * A flat list rather than a map keyed by `id`, deliberately: a map would keep
 * one of two lessons sharing an id and the ambiguity this gate exists to catch
 * would be gone before anything looked for it.
 */
export interface LessonCorpus {
  readonly lessons: readonly CorpusLesson[];
  readonly chapters: readonly string[];
  /** Documents this reader could not make sense of; a schema's job, recorded here. */
  readonly faults: readonly string[];
  readonly lessonCount: number;
  readonly passageCount: number;
}

export declare const readLessonCorpus: (root: string) => LessonCorpus;

/** Why a `{ lesson, passage }` pair did not name exactly one passage. */
export type ResolutionFailure = 'malformed' | 'dangling' | 'ambiguous';

export type PassageResolution =
  | {
      readonly ok: true;
      readonly count: 1;
      readonly match: { readonly lesson: CorpusLesson; readonly passage: CorpusPassage };
    }
  | {
      readonly ok: false;
      readonly why: ResolutionFailure;
      /** How many passages carried the pair. 0 for dangling, 2 or more for ambiguous. */
      readonly count: number;
      readonly message: string;
    };

/** Exactly one passage, or a named failure. Never `undefined`, which is the point. */
export declare const resolvePassage: (
  corpus: LessonCorpus,
  reference: unknown,
) => PassageResolution;

/** Why a resolved passage may not be put in front of a player. */
export type PassageRefusal =
  | 'unreadable'
  | 'not-factual'
  | 'not-verified'
  | 'stale'
  | 'unevidenced';

export type PassageVerdict =
  | { readonly readable: true; readonly why: null; readonly status: string | null }
  | {
      readonly readable: false;
      readonly why: PassageRefusal;
      readonly status: string | null;
    };

export declare const passageVerdict: (passage: CorpusPassage) => PassageVerdict;

/** One `passages[]` entry, with the pointer its document holds it at. */
export interface FoundReference {
  /** `steps[2].passages[0]`. */
  readonly at: string;
  /** The step's declared `kind`, so a reference on the wrong kind is nameable. */
  readonly kind: string;
  readonly reference: unknown;
}

export declare const referencesIn: (quest: unknown) => readonly FoundReference[];

export declare const readStepFaults: (
  quest: unknown,
  where: string,
  corpus: LessonCorpus,
) => readonly string[];

export declare const readQuestCorpus: (
  root: string,
) => readonly { readonly where: string; readonly document: unknown }[];

/** The ADR-0024 sweep: every passage resolved by its own pair. */
export declare const resolveEveryPassage: (corpus: LessonCorpus) => {
  readonly resolved: number;
  readonly faults: readonly string[];
};
