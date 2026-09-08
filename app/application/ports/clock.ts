/**
 * Clock — the only source of "now".
 *
 * The domain owns spaced repetition, exam timing and 180-day content expiry, and
 * none of it may call `Date.now()`: a rule that reads the wall clock cannot be tested
 * without freezing global state, and an exam timer that reads it directly cannot be
 * paused. Every rule that needs time takes a `Clock`.
 *
 * `now` is wall-clock time for scheduling and persistence. `elapsed` is a monotonic
 * source for frame and timer arithmetic — it does not jump when the device clock is
 * corrected and it never goes backwards.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call sites: slice 1 task 1.4 (`QuestionScheduler`) and 1.5 (the use
 * cases). Whoever writes the first implementation may change this interface
 * without an ADR, and removes this marker in the same change.
 */

import type { EpochMillis, IsoInstant } from '@domain/ids';

export interface Clock {
  now(): EpochMillis;
  /** The same instant, formatted for persistence and content `asOf` comparison. */
  nowIso(): IsoInstant;
  /** Monotonic milliseconds since an arbitrary origin. Differences only. */
  elapsed(): number;
}
