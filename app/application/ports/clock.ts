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
 * There is no `nowIso()`. ADR-0012 put `EpochMillis` in the domain and
 * `IsoInstant` in the save document and said `SaveCodec` converts; ADR-0015
 * removed the port method, because the conversion's home turned out to be
 * `app/application/persistence/iso-instant.ts` — a pure function pinned against
 * `Date` and `ajv-formats` — and a member whose only correct implementation is
 * `toIsoInstant(now())` is a helper on the wrong object, not a seam. Nothing in
 * `app/**` called it, and its one implementation wrote a second, unpinned
 * conversion. Code that needs an `IsoInstant` calls `toIsoInstant(clock.now())`.
 */

import type { EpochMillis } from '@domain/ids';

export interface Clock {
  now(): EpochMillis;
  /** Monotonic milliseconds since an arbitrary origin. Differences only. */
  elapsed(): number;
}
