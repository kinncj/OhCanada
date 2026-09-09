/**
 * `RecordStore` — one string record, by key, asynchronously.
 *
 * The narrowest thing a save needs from a browser, and the seam that lets one
 * repository serve two very different stores: `IndexedDB` (asynchronous by
 * nature) and `localStorage` (synchronous, wrapped). Without it the same forty
 * lines of codec-and-`Result` plumbing would exist twice, once per backend, and
 * the second copy is where the difference in behaviour hides.
 *
 * Three rules, and they are the whole contract:
 *
 *  1. **Nothing throws.** Quota, a blocked store, an evicted database and a
 *     hand-edited value are all outcomes a browser produces in normal use, so
 *     they are values (`Result`), not exceptions (CLAUDE.md, `common/result.ts`).
 *  2. **Absent is not failed.** `read` answers `ok(null)` only when the key is
 *     genuinely not there. A store that would not answer is an `io` error.
 *     ADR-0024 is the reason this is stated as a rule rather than left to each
 *     implementation: both collapse to "no save", and one of them silently
 *     replaces a real save with a new game.
 *  3. **`write` resolves when the bytes are durable**, not when they are queued.
 *     What that means differs per backend and is each implementation's problem.
 */

import type { Result } from '@common/result';

export interface RecordStore {
  /** `ok(null)` for a key that is not there; an error for a store that would not answer. */
  read(key: string): Promise<Result<string | null>>;
  write(key: string, value: string): Promise<Result<void>>;
  remove(key: string): Promise<Result<void>>;
  /** Release the handle. Safe to call more than once; never throws. */
  close(): void;
}
