/**
 * Types for `scripts/lib/worker-budget.mjs`, hand-written, for the reason
 * `claims.d.mts` gives: the module is `.mjs` because `scripts/deploy-check.mjs`,
 * a plain Node script, calls it, and `tests/unit/infra/worker-budget-gate.test.ts`
 * drives the same function under TypeScript `strict`.
 */

export declare const BACKGROUND_BUDGET_KEY: 'backgroundCacheBytes';

export declare function mib(bytes: number): string;
export declare function kb(bytes: number): string;

/** The "no positive numeric" failure, or null when the key is a positive integer. */
export declare function backgroundBudgetKeyFailure(budgets: unknown): string | null;

export interface WorkerBudgetInput {
  /** The built site. */
  readonly distDir: string;
  /** dist-relative URLs the worker precaches. */
  readonly precacheUrls: readonly string[];
  /** dist-relative path -> the levels that draw it (the worker's `tn:level-art` block). */
  readonly levelArt: Readonly<Record<string, readonly string[]>>;
  /** `content/game.config.json#/budgets`, unvalidated. */
  readonly budgets: unknown;
}

export interface WorkerBudgetResult {
  readonly precacheBytes: number;
  readonly artBytes: number;
  readonly failures: string[];
}

export declare function checkWorkerBudgets(input: WorkerBudgetInput): WorkerBudgetResult;
