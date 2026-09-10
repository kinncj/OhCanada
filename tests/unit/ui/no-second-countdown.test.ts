/**
 * `TN-TIMER-07` — the one exception stays one exception.
 *
 * `CLAUDE.md` says "no timers outside Exam mode" and Exam mode introduces the
 * one countdown this game has. The way that stays true is not a promise and not
 * a two-minute wait that asserts nothing happened: it is a check on **what the
 * source can contain**, which is the standard `tests/unit/ui/single-switch.test.ts`
 * set when it started grepping for scheduling primitives.
 *
 * Three claims, and the third is the one with teeth:
 *
 *  1. `app/ui/single-switch.ts` still holds no scheduling primitive at all, so
 *     an auto-scanning switch ring cannot be written without failing this file.
 *  2. Every module under `app/` that *does* schedule something is declared here
 *     with the reason it is allowed to, so a new one fails rather than joins.
 *  3. Exactly one of them can **end something for the player**, and no screen
 *     outside the exam imports it.
 *
 * The scan is a pure function over file contents so it can be pointed at a
 * fixture — `TN-TIMER-07`'s "a fixture exists in which a second countdown is
 * introduced outside the exam, and the suite is asserted to fail on it". A guard
 * whose failing case has never been seen is a guard nobody knows works.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('../../../app/', import.meta.url));

/**
 * A *call*, not a mention.
 *
 * The opening bracket has to be immediately after the name, so a doc comment
 * that says "not a bare `setTimeout` (ADR-0026)" is not a hit — three files talk
 * about these primitives precisely because they do not use them, and a check
 * that failed on the explanation would teach people to delete the explanation.
 */
const SCHEDULES =
  /\b(?:setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\(/u;

/** The module that drives the countdown a player can lose to. There is one. */
const THE_COUNTDOWN = 'ui/exam-clock.ts';

/**
 * Everything else under `app/` that schedules a callback, and why it is not a
 * timer the player can lose to. Each of these is a claim, not a waiver.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  /*
   * `TN-TIMER-07`: "a load budget is not a player timer". After twice the
   * time-to-play budget a stalled level *reveals a way out* — it adds a button.
   * Nothing counts down on screen, nothing expires, and ignoring it costs the
   * player nothing (`TN-COPY-07`).
   */
  'ui/level-screens.ts': 'the stalled-load escape route reveals a control; nothing expires',
  /*
   * Announcement pacing. It says so itself: "this is not a player timer:
   * nothing expires, nothing is chosen, and no scenario passes or fails on how
   * fast the player acts". The queue drains whether or not the player moves.
   */
  'ui/live-region.ts': 'the live region paces its own speech; the queue drains by itself',
};

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(`${directory}${entry.name}/`)
      : entry.name.endsWith('.ts')
        ? [`${directory}${entry.name}`]
        : [],
  );

const relative = (path: string): string => path.slice(APP.length);

/** Every module under `app/` that schedules a callback, by path relative to `app/`. */
export function schedulingModules(
  sources: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.keys(sources)
    .filter((path) => SCHEDULES.test(sources[path] ?? ''))
    .sort();
}

/**
 * The check, as a function, so it can be run against something that fails.
 *
 * Returns the modules that schedule a callback and are neither the exam clock
 * nor one of the declared exceptions. An empty list is the passing state.
 */
export function undeclaredCountdowns(
  sources: Readonly<Record<string, string>>,
): readonly string[] {
  return schedulingModules(sources).filter(
    (path) => path !== THE_COUNTDOWN && !(path in ALLOWED),
  );
}

const readApp = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    sourceFiles(APP).map((path) => [relative(path), readFileSync(path, 'utf8')]),
  );

describe('the one countdown in this game', () => {
  const sources = readApp();

  it('is driven by exactly one module, and that module is named here', () => {
    expect(Object.keys(sources)).toContain(THE_COUNTDOWN);
    expect(SCHEDULES.test(sources[THE_COUNTDOWN] ?? '')).toBe(true);
  });

  it('is the only thing under app/ that schedules anything undeclared', () => {
    const found = undeclaredCountdowns(sources);
    expect(
      found,
      `a new module schedules a callback and has not said why: ${found.join(', ')}`,
    ).toEqual([]);
  });

  it('leaves the single-switch ring with no scheduling primitive at all', () => {
    /*
     * `TN-TIMER-07`: "the single-switch code still contains no `setTimeout`,
     * `setInterval`, `requestAnimationFrame` or `requestIdleCallback`, and the
     * test that asserts it is not skipped". Exam mode is where that guard would
     * quietly weaken, so it is re-asserted from the exam's own suite as well as
     * from the ring's.
     */
    const ring = sources['ui/single-switch.ts'] ?? '';
    expect(ring).not.toBe('');
    expect(SCHEDULES.test(ring)).toBe(false);
  });

  it('is imported by the exam and by nothing else', () => {
    /* `TN-TIMER-07`: "no screen outside the exam imports it", and "the clock
       cannot reach a screen that is not the exam". */
    const importers = Object.entries(sources)
      .filter(([path, source]) => path !== THE_COUNTDOWN && /['"][^'"]*exam-clock['"]/u.test(source))
      .map(([path]) => path)
      .sort();
    /*
     * Three modules, and all three are the exam: the screen that draws the
     * clock, the composition that starts it, and the start screen — which
     * imports `MINUTE_MS` to say "30 minutes" beside the switch and never
     * constructs a clock. The assertion is on the whole list rather than on a
     * prefix rule, so a fourth importer has to be argued for here.
     */
    expect(importers).toEqual(['bootstrap/exam.ts', 'ui/exam-screen.ts', 'ui/exam-start.ts']);
    for (const path of importers) expect(path).toMatch(/exam/u);
  });

  it('fails when a second countdown is introduced outside the exam', () => {
    /*
     * The guard proven by a failing case. This fixture is what a new countdown
     * on, say, the level select would look like to the scan above — and a change
     * that made this fixture *pass* would be a change that stopped the check
     * checking anything.
     */
    const withASecondOne = {
      ...sources,
      'ui/level-select.ts':
        'export const nag = (): void => { setInterval(() => close(), 1000); };',
    };
    expect(undeclaredCountdowns(withASecondOne)).toEqual(['ui/level-select.ts']);
  });

  it('still fails when the second countdown hides inside the exam directory', () => {
    /* Naming a file `exam-something` is not a licence. Only the one module is
       exempt, by exact path. */
    const disguised = {
      ...sources,
      'ui/exam-nag.ts': 'setTimeout(() => undefined, 1000);',
    };
    expect(undeclaredCountdowns(disguised)).toEqual(['ui/exam-nag.ts']);
  });
});
