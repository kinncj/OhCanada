/**
 * Types for `scripts/lib/claims.mjs`, hand-written, for the same reason
 * `staleness.d.mts` is: the module is `.mjs` because one of its two callers is a
 * plain Node script with no build step, and the other is a TypeScript contract
 * test running under `strict` with `allowJs` off. A signature change here that
 * the module does not match breaks `make typecheck`, which is what keeps the one
 * implementation one implementation.
 *
 * The parameter types are as WIDE as the JSON they describe: everything a
 * document carries is `unknown` until a narrowing helper looks at it, exactly as
 * the runtime does. A narrower type would be an assertion about content that the
 * schema, not TypeScript, is responsible for.
 */

/** One of `prose`: an author's player-facing words, per field and locale. */
export interface ClaimProse {
  readonly field: string;
  readonly locale: string;
  readonly text: string;
}

/**
 * A question and a `factClaim` normalised to one record. See the module header
 * for what each field means and why the normalisation happens once.
 */
export interface Claim {
  readonly where: string;
  readonly pointer: string;
  readonly at: string;
  readonly collection: string;
  readonly kind: 'question' | 'fact';
  readonly factual: boolean;
  readonly source: { readonly [key: string]: unknown } | null;
  readonly verification: { readonly [key: string]: unknown } | null;
  readonly prose: readonly ClaimProse[];
  readonly asserted: readonly string[];
  readonly surface: string;
  /** The node the claim is made of: the question document, or the block. */
  readonly document: unknown;
}

/** A haystack tokenised once, for many short comparisons against it. */
export interface TextIndex {
  readonly words: readonly string[];
  readonly joined: string;
  readonly vocabulary: ReadonlySet<string>;
}

export declare const CLAIM_COLLECTIONS: readonly string[];

export declare const isSchemaDocument: (where: string) => boolean;

export declare const words: (text: string) => readonly string[];
export declare const indexText: (text: string) => TextIndex;
export declare const containsRun: (index: TextIndex, text: string) => boolean;
export declare const longestSharedRun: (index: TextIndex, text: string) => number;
export declare const unknownWords: (index: TextIndex, text: string) => readonly string[];

export declare const isFactClaim: (value: unknown) => boolean;
export declare const isQuestionDocument: (value: unknown) => boolean;
export declare const collectionOf: (where: string) => string;

export declare const questionClaim: (document: unknown, where: string) => Claim;
export declare const factClaim: (
  block: unknown,
  parent: unknown,
  where: string,
  pointer: string,
) => Claim;
export declare const claimsIn: (document: unknown, where: string) => readonly Claim[];

export declare const claimCountFault: (
  rawText: string,
  found: readonly Claim[],
  where: string,
) => string | null;

/**
 * Both recognisers, checked against the schemas that define the shapes.
 * `faults` are divergences; `notes` are shapes the given schemas do not define,
 * which is a gap in coverage rather than a defect and is reported as one.
 */
export declare const recogniserFaults: (
  commonSchema: unknown,
  questionSchema: unknown,
) => { readonly faults: readonly string[]; readonly notes: readonly string[] };
