/**
 * Types for `scripts/lib/staleness.mjs`, hand-written.
 *
 * The module is `.mjs` because one of its two callers is a plain Node script
 * that runs with no build step; the other is a TypeScript contract test running
 * under `strict` with `allowJs` off, which cannot import it without this file.
 * Keeping the declarations here rather than turning on `allowJs` keeps the
 * script exactly as runnable as it was and still makes a signature change break
 * `make typecheck` — the two must be edited together, which is the property the
 * one-rule-two-implementations defect lacked.
 *
 * The parameter types are deliberately as WIDE as the JSON they describe:
 * everything a register or a question carries is `unknown` until a `str()`/
 * `int()` narrows it, exactly as the runtime does. A narrower type here would be
 * an assertion about content the schema, not TypeScript, is responsible for.
 */

/** One `knownStaleness[]` entry of a source register. */
export interface StalenessFlag {
  readonly topic?: unknown;
  readonly problem?: unknown;
  readonly affects?: readonly unknown[];
  readonly grain?: unknown;
  readonly pages?: readonly unknown[];
  readonly action?: unknown;
  readonly upstream?: unknown;
  readonly bannedFromAnswers?: readonly unknown[];
}

/** One `liveChecks[].pages[]` entry: a single live URL that was compared. */
export interface LiveCheckPageLike {
  readonly url?: unknown;
  readonly chapter?: unknown;
  readonly sourceDateModified?: unknown;
  readonly agreesWithCache?: unknown;
  readonly claimsCompared?: readonly unknown[];
}

/** One `liveChecks[]` entry: one occasion the live page was compared. */
export interface LiveCheckLike {
  readonly checkedAt?: unknown;
  readonly checkedBy?: unknown;
  readonly finding?: unknown;
  readonly consequence?: unknown;
  readonly pages?: readonly LiveCheckPageLike[];
}

/** As much of `content/sources/<id>.json` as ADR-0016 §2 and §3 read. */
export interface SourceRegisterLike {
  readonly knownStaleness?: readonly StalenessFlag[];
  readonly liveChecks?: readonly LiveCheckLike[];
}

/** As much of a question as §3 reads: the strings a player is told are true. */
export interface AnswerBearing {
  readonly options?: readonly unknown[];
  readonly explanation?: unknown;
}

/** Which row of ADR-0016 §2's table a claim's chapter is on, and why. */
export interface Disposition {
  readonly row: 1 | 2 | 3;
  readonly why: string;
  readonly check: LiveCheckLike | null;
  /** Consecutive `source-unreachable` checks at the end of the list. */
  readonly unreachableTail: number;
}

export declare const STALE_AFTER_DAYS: number;

export declare const mentionsTerm: (text: string, term: string) => boolean;

export declare const answerText: (question: AnswerBearing) => readonly string[];

export declare const applicableFlags: (
  manifest: SourceRegisterLike,
  chapter: string,
  page: number | null,
) => readonly StalenessFlag[];

export declare const bannedTermFaults: (
  question: AnswerBearing,
  sourceId: string,
  flags: readonly StalenessFlag[],
  where: string,
) => readonly string[];

export declare const liveChecksForChapter: (
  manifest: SourceRegisterLike,
  chapter: string,
) => readonly LiveCheckLike[];

export declare const dispositionRow: (
  manifest: SourceRegisterLike,
  chapter: string,
  flags: readonly StalenessFlag[],
  banRespected: boolean,
) => Disposition;
