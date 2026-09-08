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
 * The ADR-0008 marker is gone: slice 1 task 1.5 landed the first call sites.
 * `StartQuest`, `AnswerQuestion`, `ScheduleReview` and `SaveProgress` all hold
 * this port and pass `now()` into rules that may not reach one — the scheduler
 * is domain code and `domain-is-pure` forbids it importing a port, so it takes
 * `now` as an argument and the use case above it supplies one.
 *
 * `now` and `nowIso` are the two ends of the conversion ADR-0012 records: the
 * domain does arithmetic on `EpochMillis`, the save document persists
 * `IsoInstant`, and `SaveCodec` is where one becomes the other:
 * `app/application/persistence/iso-instant.ts` writes both directions out, so an
 * adapter implementing `nowIso()` has one conversion to call rather than a
 * second one to write.
 */

import type { EpochMillis, IsoInstant } from '@domain/ids';

export interface Clock {
  now(): EpochMillis;
  /** The same instant, formatted for persistence and content `asOf` comparison. */
  nowIso(): IsoInstant;
  /** Monotonic milliseconds since an arbitrary origin. Differences only. */
  elapsed(): number;
}
