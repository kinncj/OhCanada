/**
 * The exam's event names, and the `?e2e=1` trace that makes them observable.
 *
 * The property worth pinning is the one a player has: on a normal load there is
 * **no debug surface**. `app/adapters/phaser/scene-probe.ts` keeps the same
 * contract and this suite keeps it the same way — `?e2e=0` reading as on is the
 * kind of surprise that puts a trace in front of somebody who pasted a URL.
 */

import { describe, expect, it } from 'vitest';

import {
  createExamEventLog,
  EXAM_EVENT_NAMES,
  isExamProbeEnabled,
  type ExamProbeHandle,
} from '../../../app/bootstrap/exam-events';

describe('whether the trace is on', () => {
  it('is on for ?e2e=1 and for nothing else', () => {
    expect(isExamProbeEnabled('?e2e=1')).toBe(true);
    expect(isExamProbeEnabled('?level=ottawa&e2e=1')).toBe(true);
    expect(isExamProbeEnabled('?e2e=0')).toBe(false);
    expect(isExamProbeEnabled('?e2e')).toBe(false);
    expect(isExamProbeEnabled('')).toBe(false);
    expect(isExamProbeEnabled(null)).toBe(false);
    expect(isExamProbeEnabled(undefined)).toBe(false);
  });
});

describe('the names', () => {
  it('are the ones the stories name, and no others', () => {
    /* `docs/stories/README.md` fixes these. A name nothing can observe is a name
       nothing can be held to, and a name nothing emits is worse. */
    expect([...EXAM_EVENT_NAMES]).toEqual([
      'exam/started',
      'exam/answered',
      'exam/left',
      'exam/resumed',
      'exam/discarded',
      'exam/time-up',
      'exam/finished',
      'progress/saved',
      'progress/save-failed',
      'progress/loaded',
    ]);
  });

  it("do not include the level's answer event", () => {
    /* `TN-RESULT-05` and `docs/stories/README.md`: "an exam does not emit
       `question/asked` or `question/answered`", so nothing that counts a quest
       step can be advanced by an exam. The exam cannot say the word. */
    expect([...EXAM_EVENT_NAMES]).not.toContain('question/answered');
    expect([...EXAM_EVENT_NAMES]).not.toContain('question/asked');
  });
});

describe('a normal load', () => {
  it('installs nothing and records nothing', () => {
    const target: Record<string, unknown> = {};
    const log = createExamEventLog({ search: '', target });
    log.emit('exam/started');
    expect(target['__tnExam']).toBeUndefined();
    expect(Object.keys(target)).toEqual([]);
  });

  it('is safe to emit into from anywhere, so no caller has to ask', () => {
    const log = createExamEventLog();
    expect(() => {
      log.emit('exam/finished', 'passed');
    }).not.toThrow();
  });
});

describe('a run with the trace on', () => {
  it('records what happened, in order, with the detail', () => {
    const target: Record<string, unknown> = {};
    let now = 0;
    const log = createExamEventLog({
      search: '?e2e=1',
      target,
      now: () => {
        now += 5;
        return now;
      },
    });

    log.emit('exam/started');
    log.emit('exam/answered', 'gov-01');
    log.emit('exam/finished', 'passed');

    const handle = target['__tnExam'] as ExamProbeHandle;
    expect(handle.events().map((entry) => entry.name)).toEqual([
      'exam/started',
      'exam/answered',
      'exam/finished',
    ]);
    expect(handle.events()[1]?.detail).toBe('gov-01');
    expect(handle.events()[0]?.detail).toBeUndefined();
    expect(handle.events()[0]?.at).toBeLessThan(handle.events()[2]?.at ?? 0);
  });

  it('hands out a copy, so a test cannot steer the game by editing the trace', () => {
    const target: Record<string, unknown> = {};
    const log = createExamEventLog({ search: '?e2e=1', target });
    log.emit('exam/left');
    const handle = target['__tnExam'] as ExamProbeHandle;
    const first = handle.events();
    log.emit('exam/resumed');
    expect(first).toHaveLength(1);
    expect(handle.events()).toHaveLength(2);
    handle.clear();
    expect(handle.events()).toEqual([]);
  });
});
