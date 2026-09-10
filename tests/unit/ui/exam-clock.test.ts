/**
 * `docs/stories/TN-TIMER-the-exam-clock.md` — the one countdown this game has.
 *
 * Every "five minutes pass" in that file is one line here, because the clock
 * reads an injected monotonic `now` and schedules through an injected
 * `schedule`: there is no wall clock to freeze and no timer to wait out. A suite
 * that actually waited would be the slowest and least trustworthy way to prove a
 * property about waiting.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  CLOCK_WARNINGS,
  clockMinutes,
  clockText,
  createExamClock,
  MINUTE_MS,
  nextChangeDelay,
  type ExamClock,
} from '@ui/exam-clock';

/** A hand-driven scheduler: nothing runs until the test advances the clock. */
interface Harness {
  readonly clock: ExamClock;
  /** Move the monotonic clock forward and run whatever was due. */
  advance(ms: number): void;
  readonly changes: () => number;
  readonly warned: () => readonly number[];
  readonly expired: () => number;
}

function harness(): Harness {
  let now = 10_000;
  let pending: { at: number; run: () => void } | null = null;
  let handle = 0;
  const onChange = vi.fn();
  const warned: number[] = [];
  const onExpire = vi.fn();

  const clock = createExamClock({
    now: () => now,
    schedule: (run, delayMs) => {
      handle += 1;
      pending = { at: now + delayMs, run };
      return handle;
    },
    cancel: () => {
      pending = null;
    },
    onChange,
    onWarn: (minutes) => warned.push(minutes),
    onExpire,
  });

  return {
    clock,
    advance(ms): void {
      const target = now + ms;
      /* Fire everything that comes due inside the step, in order, exactly as a
         browser would — and no more than a few hundred times, because a clock
         that woke up per second would spin here and say so. */
      for (let guard = 0; guard < 500; guard += 1) {
        if (pending === null || pending.at > target) break;
        now = pending.at;
        const due = pending;
        pending = null;
        due.run();
      }
      now = target;
    },
    changes: () => onChange.mock.calls.length,
    warned: () => [...warned],
    expired: () => onExpire.mock.calls.length,
  };
}

describe('what the clock says', () => {
  it('rounds up to whole minutes, so a player is never told they have less', () => {
    /* `TN-TIMER-02`: four and a half minutes into a thirty-minute exam reads
       "26 minutes left". */
    expect(clockMinutes(30 * MINUTE_MS)).toBe(30);
    expect(clockMinutes(25.5 * MINUTE_MS)).toBe(26);
    expect(clockMinutes(MINUTE_MS)).toBe(1);
    expect(clockMinutes(0)).toBe(0);
  });

  it('reads as a counted noun above a minute, in both languages', () => {
    expect(clockText('en', 30 * MINUTE_MS)).toBe('30 minutes left');
    expect(clockText('fr', 30 * MINUTE_MS)).toBe('Il reste 30 minutes');
  });

  it('agrees with its number at one', () => {
    /* `TN-TIMER-11`: « Il reste 1 minutes » is the defect the plural rows exist
       to prevent, and the form comes from `Intl`, never from `n === 1`. */
    expect(clockText('en', MINUTE_MS)).toBe('1 minute left');
    expect(clockText('fr', MINUTE_MS)).toBe('Il reste 1 minute');
  });

  it('says the last minute in words, and counts no seconds', () => {
    expect(clockText('en', 50_000)).toBe('Less than 1 minute left');
    expect(clockText('fr', 50_000)).toBe("Il reste moins d'une minute");
    for (const remaining of [59_999, 30_000, 1_000, 1]) {
      expect(clockText('en', remaining)).not.toMatch(/second/);
    }
  });

  it('announces at five minutes and at one, and nowhere else', () => {
    expect([...CLOCK_WARNINGS]).toEqual([5, 1]);
  });
});

describe('when the clock next changes', () => {
  it('sleeps until the next whole minute rather than ticking', () => {
    expect(nextChangeDelay(30 * MINUTE_MS)).toBe(MINUTE_MS);
    expect(nextChangeDelay(25.5 * MINUTE_MS)).toBe(0.5 * MINUTE_MS);
  });

  it('crosses into words the instant it drops below a minute', () => {
    expect(nextChangeDelay(MINUTE_MS)).toBe(1);
    expect(nextChangeDelay(59_999)).toBe(59_999);
  });

  it('has nothing left to say at zero', () => {
    expect(nextChangeDelay(0)).toBeNull();
    expect(nextChangeDelay(-1)).toBeNull();
  });
});

describe('a clock running under an exam', () => {
  it('comes back paused and starts when the player carries on', () => {
    /* `TN-ATTEMPT-02`: the clock carries on when the player does, not when the
       screen draws. */
    const { clock } = harness();
    clock.start(20 * MINUTE_MS);
    expect(clock.phase).toBe('paused');
    expect(clock.remainingMs).toBe(20 * MINUTE_MS);
    clock.resume();
    expect(clock.phase).toBe('running');
  });

  it('changes at most once a minute, and never shows a second', () => {
    /* `TN-TIMER-02`: "four and a half minutes of answering have passed … it has
       changed at most five times since the exam started". */
    const bench = harness();
    bench.clock.start(30 * MINUTE_MS);
    const atStart = bench.changes();
    bench.clock.resume();
    bench.advance(4.5 * MINUTE_MS);
    expect(clockText('en', bench.clock.remainingMs)).toBe('26 minutes left');
    expect(bench.changes() - atStart).toBeLessThanOrEqual(6);
  });

  it('pauses without losing a millisecond, and cannot expire while paused', () => {
    /* `TN-TIMER-03` and `TN-TIMER-05`: "no exam time for making the game
       readable", and "time cannot run out while the clock is paused". */
    const bench = harness();
    bench.clock.start(20 * MINUTE_MS);
    bench.clock.resume();
    bench.clock.pause();
    bench.advance(5 * MINUTE_MS);
    expect(bench.clock.remainingMs).toBe(20 * MINUTE_MS);
    expect(bench.expired()).toBe(0);
    bench.clock.resume();
    bench.advance(MINUTE_MS);
    expect(clockMinutes(bench.clock.remainingMs)).toBe(19);
  });

  it('ends the exam at zero, once', () => {
    const bench = harness();
    bench.clock.start(2 * MINUTE_MS);
    bench.clock.resume();
    bench.advance(3 * MINUTE_MS);
    expect(bench.expired()).toBe(1);
    expect(bench.clock.phase).toBe('expired');
    expect(bench.clock.remainingMs).toBe(0);
  });

  it('announces five minutes and one minute, once each, and nothing between', () => {
    const bench = harness();
    bench.clock.start(7 * MINUTE_MS);
    bench.clock.resume();
    bench.advance(6.5 * MINUTE_MS);
    expect(bench.warned()).toEqual([5, 1]);
  });

  it('can be turned off in the middle, and never turned back on', () => {
    /* `TN-TIMER-04` and `TN-SET-05`: the escape hatch that makes "no setting may
       trap the player" true of the one timer in the game. */
    const bench = harness();
    bench.clock.start(12 * MINUTE_MS);
    bench.clock.resume();
    bench.clock.stop();
    expect(bench.clock.on).toBe(false);
    expect(bench.clock.phase).toBe('off');

    bench.clock.start(12 * MINUTE_MS);
    expect(bench.clock.on).toBe(false);
    bench.advance(60 * MINUTE_MS);
    expect(bench.expired()).toBe(0);
  });

  it('stays expired once it has expired', () => {
    const bench = harness();
    bench.clock.start(MINUTE_MS);
    bench.clock.resume();
    bench.advance(2 * MINUTE_MS);
    bench.clock.start(10 * MINUTE_MS);
    expect(bench.clock.phase).toBe('expired');
    expect(bench.expired()).toBe(1);
  });

  it('expires at once when resumed with nothing left', () => {
    const bench = harness();
    bench.clock.start(-1);
    expect(bench.clock.phase).toBe('expired');
  });

  it('schedules nothing after it is destroyed', () => {
    const bench = harness();
    bench.clock.start(5 * MINUTE_MS);
    bench.clock.resume();
    bench.clock.destroy();
    bench.advance(10 * MINUTE_MS);
    expect(bench.expired()).toBe(0);
  });
});
