import type { TestInfo } from '@playwright/test';

/**
 * Three outcomes, and the reason there are three (ADR-0024).
 *
 * A performance budget can hold, it can be breached, or the measurement can fail
 * to be taken. The third is not a milder version of either of the others, and
 * this lane has confused it with both: a frame sampler that collected 19 frames
 * was reported as a failure of the frame budget, and a software-rasteriser
 * branch that returned early read as a pass. Both were "nothing was measured"
 * wearing another outcome's colour.
 *
 * So every budget test in this lane ends in exactly one call to `settle`, and
 * `settle` is the only thing that decides what the outcome looks like:
 *
 *   held          the test passes, and the number that held is attached;
 *   breached      the test fails with a message that begins BUDGET BREACHED;
 *   not-measured  the test fails with a message that begins NOT MEASURED and
 *                 says what stopped the measurement.
 *
 * Why NOT MEASURED fails rather than passing quietly: in THIS lane every budget
 * is one a GPU-less runner can measure exactly - counts of work, not timings -
 * so a measurement that could not be taken means the instrument is broken, and
 * a broken instrument over a budget is the silent pass this project keeps
 * removing. What a runner genuinely cannot measure is not in this lane at all:
 * it is in the device lane, and the reporter lists it as NOT CHECKED HERE, so
 * nothing in this job can be permanently red for a reason nobody can fix.
 *
 * `perf-reporter.ts` reads the attachment and prints the three outcomes as three
 * different sections, with three different CI annotation titles.
 */

export type VerdictStatus = 'held' | 'breached' | 'not-measured';

export interface Verdict {
  /** The budget in words, as CLAUDE.md states it. */
  readonly budget: string;
  readonly status: VerdictStatus;
  readonly measured?: number;
  readonly limit?: number;
  readonly unit?: string;
  /** The context that makes the number attributable, or why there is no number. */
  readonly detail: string;
}

export const VERDICT_ATTACHMENT = 'perf-verdict';

export const notMeasured = (budget: string, why: string): Verdict => ({
  budget,
  status: 'not-measured',
  detail: why,
});

/** Held when `measured <= limit`, breached otherwise. The one comparison in the lane. */
export const atMost = (
  budget: string,
  measured: number,
  limit: number,
  unit: string,
  detail: string,
): Verdict => ({
  budget,
  status: measured <= limit ? 'held' : 'breached',
  measured,
  limit,
  unit,
  detail,
});

export function formatNumber(value: number | undefined, unit: string | undefined): string {
  if (value === undefined) return 'no number';
  const magnitude = Math.abs(value);
  const digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
  return `${value.toFixed(digits)}${unit === undefined || unit === '' ? '' : ` ${unit}`}`;
}

export function describeVerdict(verdict: Verdict): string {
  switch (verdict.status) {
    case 'held':
      return (
        `${verdict.budget}: ${formatNumber(verdict.measured, verdict.unit)} against ` +
        `${formatNumber(verdict.limit, verdict.unit)} - ${verdict.detail}`
      );
    case 'breached':
      return (
        `BUDGET BREACHED - ${verdict.budget}: measured ` +
        `${formatNumber(verdict.measured, verdict.unit)}, limit ` +
        `${formatNumber(verdict.limit, verdict.unit)} - ${verdict.detail}`
      );
    case 'not-measured':
      return (
        `NOT MEASURED - ${verdict.budget}: ${verdict.detail}. This is neither a pass nor a ` +
        'breach: the instrument could not take the measurement, so nothing is known about the budget.'
      );
  }
}

/**
 * Record the outcome and make the test say it. Call exactly once, last.
 *
 * Returns only when the budget held. Throws otherwise, with the message
 * `describeVerdict` produces, so the Playwright output and the reporter's
 * summary say the same thing in the same words.
 */
export async function settle(testInfo: TestInfo, verdict: Verdict): Promise<void> {
  await testInfo.attach(VERDICT_ATTACHMENT, {
    body: JSON.stringify(verdict),
    contentType: 'application/json',
  });
  if (verdict.status !== 'held') throw new Error(describeVerdict(verdict));
}
