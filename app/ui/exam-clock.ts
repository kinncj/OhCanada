/**
 * The exam clock — the one countdown in this game, and the only module in the
 * source that drives one.
 *
 * `docs/stories/TN-TIMER-the-exam-clock.md` is the acceptance criteria.
 * `CLAUDE.md` says "no timers outside Exam mode" and also "timer only in Exam
 * mode, and optional"; this file is where those two meet, and it is deliberately
 * the *only* place they meet. `tests/unit/ui/no-second-countdown.test.ts` names
 * this module, greps the rest of `app/` for scheduling primitives, and fails
 * when a second one appears (`TN-TIMER-07`).
 *
 * ## The five rules, and where each one lives in the code
 *
 *  1. **It never chooses anything.** The only callbacks are
 *     {@link ExamClockOptions.onChange} — "redraw the words" — and
 *     {@link ExamClockOptions.onExpire}. There is no reference to a question, an
 *     option, a dialog or a highlight in this file, so a clock that advanced a
 *     question could not be written here without being handed one.
 *  2. **It never ticks.** {@link nextChangeDelay} schedules the *next moment the
 *     drawn words change* and nothing in between, so a thirty-minute exam wakes
 *     up thirty-one times rather than eighteen hundred. Seconds are never
 *     computed, let alone drawn.
 *  3. **It pauses whenever the player is not answering.** {@link ExamClock.pause}
 *     freezes the remaining milliseconds; nothing can expire while it is frozen,
 *     because the only thing that expires it is a callback that is not
 *     scheduled. `TN-TIMER-05`: "time cannot run out while the clock is paused".
 *  4. **It can be turned off mid-exam and never turned back on.**
 *     {@link ExamClock.stop} is one-way by construction: it clears the deadline
 *     and moves the phase to `off`, and `start` refuses to run again on a
 *     stopped clock. `TN-SET-05` — no setting may trap the player — is true of
 *     the one timer in the game because of this method.
 *  5. **It is text, never a bar.** This module returns strings and a number of
 *     whole minutes. It renders nothing, holds no element and knows no colour,
 *     so there is nothing here for reduced motion to remove.
 *
 * ## Monotonic time, injected
 *
 * `now` is `Clock.elapsed()` from the composition root: monotonic, so a device
 * clock corrected mid-exam cannot add or remove time, and injected, so
 * `TN-TIMER-03`'s "five minutes pass" is a test that runs in a millisecond.
 * There is no `Date.now()` in this file and no second source of time — which is
 * how a paused clock quietly stops being paused (`OQ-TIMER-3`).
 *
 * DOM only (ADR-0005) — and in fact not even that: nothing here touches a node.
 */

import { count, text, type UiLocale } from './copy';

export const MINUTE_MS = 60_000;

/**
 * Whole minutes left, as the clock draws them.
 *
 * Rounded **up**: at four and a half minutes into a thirty-minute exam,
 * twenty-five and a half minutes remain and the clock reads "26 minutes left"
 * (`TN-TIMER-02`). Rounding down would tell a player they had less time than
 * they have, which is the one direction a clock must never be wrong in.
 */
export const clockMinutes = (remainingMs: number): number =>
  Math.max(0, Math.ceil(remainingMs / MINUTE_MS));

/**
 * What the clock says.
 *
 * Three readings and no fourth: the counted noun above a minute, the words below
 * one, and nothing at zero — the exam is over by then and the result says so.
 * `count(...)` and not `text(...)`, so the form comes from `Intl.PluralRules` for
 * the active locale: « Il reste 1 minute » and never « Il reste 1 minutes »
 * (`TN-TIMER-11`).
 */
export function clockText(locale: UiLocale, remainingMs: number): string {
  if (remainingMs < MINUTE_MS) return text(locale, 'exam.timer.lessThanMinute');
  return count(locale, 'exam.timer.left', clockMinutes(remainingMs));
}

/**
 * How long until {@link clockText} would say something different, in
 * milliseconds. `null` when it never will again.
 *
 * The whole of rule 2 is this function. Above a minute the next change is at the
 * next whole minute; at exactly a minute it is the instant the clock drops below
 * one and starts saying so in words; below a minute the next change is the end
 * of the exam.
 */
export function nextChangeDelay(remainingMs: number): number | null {
  if (remainingMs <= 0) return null;
  if (remainingMs <= MINUTE_MS) {
    /* One millisecond to cross from "1 minute left" into "Less than 1 minute
       left", then the rest of the minute until the exam ends. */
    return remainingMs === MINUTE_MS ? 1 : remainingMs;
  }
  const boundary = Math.max(MINUTE_MS, Math.floor((remainingMs - 1) / MINUTE_MS) * MINUTE_MS);
  return Math.max(1, remainingMs - boundary);
}

/**
 * The two moments the live region says something about time, and no others.
 *
 * `TN-TIMER-09`: "time is announced at two points and at the end, and never in
 * between". A clock that announced every minute would be a nag; one that
 * announced nothing would hide the only signal a screen-reader user has.
 */
export const CLOCK_WARNINGS: readonly number[] = [5, 1];

export type ExamClockPhase = 'running' | 'paused' | 'off' | 'expired';

export interface ExamClockOptions {
  /** Monotonic milliseconds — `Clock.elapsed()`. Never a wall clock. */
  readonly now: () => number;
  /** Injected for the tests; `setTimeout` in a browser. */
  readonly schedule?: (run: () => void, delayMs: number) => number;
  readonly cancel?: (handle: number) => void;
  /** The drawn words changed, or the phase did. Redraw; decide nothing. */
  readonly onChange?: () => void;
  /** Five minutes left, then one. Called once per threshold, per exam. */
  readonly onWarn?: (minutesLeft: number) => void;
  /** Zero. The exam ends here and nowhere else in this file. */
  readonly onExpire?: () => void;
}

export interface ExamClock {
  readonly phase: ExamClockPhase;
  /** Milliseconds left. `0` once it has expired or been turned off. */
  readonly remainingMs: number;
  /** Is there a clock at all? `false` for an untimed exam and a stopped one. */
  readonly on: boolean;
  /** Begin, or begin again from a resumed attempt. Refused once stopped. */
  start(remainingMs: number): void;
  /** The player is not answering: a menu, a settings screen, a hidden tab. */
  pause(): void;
  /** They are answering again. A no-op unless the clock is paused. */
  resume(): void;
  /** `TN-TIMER-04`. One way: nothing in this interface starts it again. */
  stop(): void;
  destroy(): void;
}

export function createExamClock(options: ExamClockOptions): ExamClock {
  const schedule =
    options.schedule ??
    ((run: () => void, delayMs: number): number =>
      globalThis.setTimeout(run, delayMs) as unknown as number);
  const cancel = options.cancel ?? ((handle: number): void => { globalThis.clearTimeout(handle); });

  let phase: ExamClockPhase = 'off';
  /** Frozen milliseconds while paused; the source of truth when not running. */
  let held = 0;
  /** `now()` plus what is left, while running. */
  let deadline = 0;
  let handle: number | null = null;
  /**
   * `TN-TIMER-04`, "the clock cannot be started again mid-exam", made a property
   * of the object rather than a rule its caller keeps. `phase` alone cannot
   * carry it: a clock that has never run and one the player turned off are both
   * `off`, and only one of them may start.
   */
  let stopped = false;
  const warned = new Set<number>();

  const remaining = (): number => {
    if (phase === 'running') return Math.max(0, deadline - options.now());
    return phase === 'paused' ? held : 0;
  };

  const clearPending = (): void => {
    if (handle === null) return;
    cancel(handle);
    handle = null;
  };

  /**
   * Sleep until the words change, then change them.
   *
   * Re-entrant on purpose: a timer that fires early — a browser rounding a
   * delay down, a test driving the schedule by hand — recomputes from `now()`
   * and goes back to sleep rather than drawing a minute that has not passed.
   */
  const arm = (): void => {
    clearPending();
    if (phase !== 'running') return;
    const left = remaining();
    const delay = nextChangeDelay(left);
    if (delay === null) {
      expire();
      return;
    }
    handle = schedule(() => {
      handle = null;
      if (phase !== 'running') return;
      const now = remaining();
      if (now <= 0) {
        expire();
        return;
      }
      warn(now);
      options.onChange?.();
      arm();
    }, delay);
  };

  const warn = (left: number): void => {
    const minutes = clockMinutes(left);
    if (!CLOCK_WARNINGS.includes(minutes) || warned.has(minutes)) return;
    warned.add(minutes);
    options.onWarn?.(minutes);
  };

  const expire = (): void => {
    if (phase === 'expired') return;
    clearPending();
    phase = 'expired';
    held = 0;
    options.onChange?.();
    options.onExpire?.();
  };

  return {
    get phase(): ExamClockPhase {
      return phase;
    },
    get remainingMs(): number {
      return remaining();
    },
    get on(): boolean {
      return phase === 'running' || phase === 'paused';
    },

    start(remainingMs): void {
      /* A stopped or expired clock stays that way. `TN-TIMER-04`: "no control
         offers to turn it back on", and a method that could would be one caller
         away from being that control. */
      if (stopped || phase === 'expired') return;
      if (remainingMs <= 0) {
        expire();
        return;
      }
      /*
       * A resumed attempt always comes back **paused** (`TN-ATTEMPT-02`): the
       * clock carries on when the player carries on, not when the screen draws.
       * `resume()` is one call away and is what "Carry on" does.
       */
      phase = 'paused';
      held = remainingMs;
      warned.clear();
      options.onChange?.();
    },

    pause(): void {
      if (phase !== 'running') return;
      held = remaining();
      phase = 'paused';
      clearPending();
      options.onChange?.();
    },

    resume(): void {
      if (phase !== 'paused') return;
      if (held <= 0) {
        expire();
        return;
      }
      phase = 'running';
      deadline = options.now() + held;
      options.onChange?.();
      arm();
    },

    stop(): void {
      if (phase === 'off' || phase === 'expired') return;
      clearPending();
      stopped = true;
      phase = 'off';
      held = 0;
      options.onChange?.();
    },

    destroy(): void {
      clearPending();
      phase = 'off';
      held = 0;
    },
  };
}
