/**
 * The seam Study mounts against, driven over the real bank.
 *
 * The use case is stated in ports, but it is exercised here against the actual
 * `content/questions/` tree through the actual adapter, because the thing worth
 * proving is not that `scheduleReview` can be called — that has its own suite —
 * but that a screen handed this object can render a count, run a drill and be
 * told when it cannot, from the files the repository ships.
 */

import { describe, expect, it } from 'vitest';

import {
  BUNDLED_QUESTION_MODULES,
  createQuestionBank,
  type QuestionModuleMap,
} from '@adapters/content';
import { createSeededRandom } from '@adapters/random';
import type { Clock, SchedulerTuning } from '@application/ports';
import { newProgress } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import { defaultSettings } from '@domain/entities/player';
import type { EpochMillis, LocaleCode } from '@domain/ids';

import { createStudySession } from '@application/use-cases/study-session';

const TUNING: SchedulerTuning = { exclusionWindow: 20, wrongWeight: 3, dailyNewLimit: 10 };

const clockAt = (millis: number): Clock => ({
  now: () => millis as EpochMillis,
  elapsed: () => 0,
});

const emptyProgress = (): Progress => newProgress(defaultSettings('en' as LocaleCode));

const sourceOver = (modules?: QuestionModuleMap, progress: Progress = emptyProgress()) =>
  createStudySession({
    bank: createQuestionBank(modules === undefined ? {} : { modules }),
    clock: clockAt(1_764_000_000_000),
    random: createSeededRandom(2026),
    progress: () => progress,
    tuning: TUNING,
    drillSize: 5,
  });

describe('the Study seam, over the shipped bank', () => {
  it('reports how many questions the build can ask', async () => {
    const onDisk = Object.keys(BUNDLED_QUESTION_MODULES).length;
    const available = await sourceOver().available();
    expect(available.ok).toBe(true);
    if (!available.ok) return;
    /*
     * Every VERIFIED question, across every subject. The bounds are derived
     * rather than written down — the bank is being authored while this runs —
     * but they are still both ends of an interval: at least four subjects'
     * shipping threshold, and strictly fewer than the documents on disk,
     * because some of those are rejected and must not be counted.
     */
    expect(available.value).toBeGreaterThanOrEqual(4 * 30);
    expect(available.value).toBeLessThan(onDisk);
  });

  it('carries the configured drill size so the copy and the loop read one number', () => {
    expect(sourceOver().drillSize).toBe(5);
  });

  it('draws a drill of documents the card can render in either language', async () => {
    const drill = await sourceOver().drill(5);
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions).toHaveLength(5);
    expect(drill.value.shortfall).toBe(0);
    for (const drawn of drill.value.questions) {
      expect(drawn.question.prompt.en.length).toBeGreaterThan(0);
      expect(drawn.question.prompt.fr.length).toBeGreaterThan(0);
      expect(drawn.question.verification.status).toBe('verified');
      expect(['new', 'seen']).toContain(drawn.familiarity);
    }
    /* No duplicate inside one drill. */
    expect(new Set(drill.value.questions.map((d) => String(d.question.id))).size).toBe(5);
  });

  it('replays exactly from its seed', async () => {
    const first = await sourceOver().drill(5);
    const second = await sourceOver().drill(5);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.questions.map((d) => String(d.question.id))).toEqual(
      second.value.questions.map((d) => String(d.question.id)),
    );
  });

  it('does not repeat a question in the next drill (TN-STUDY-02)', async () => {
    const source = sourceOver();
    const first = await source.drill(5);
    const second = await source.drill(5);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const asked = new Set(first.value.questions.map((d) => String(d.question.id)));
    for (const drawn of second.value.questions) {
      expect(asked.has(String(drawn.question.id))).toBe(false);
    }
  });

  it('states a short drill instead of padding it', async () => {
    /* `dailyNewLimit` is 10 and nothing has been seen, so asking for more than
       the day's budget is exactly TN-STUDY-02's short drill. */
    const drill = await sourceOver().drill(12);
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions.length).toBeLessThan(12);
    expect(drill.value.shortfall).toBe(12 - drill.value.questions.length);
    expect(new Set(drill.value.questions.map((d) => String(d.question.id))).size).toBe(
      drill.value.questions.length,
    );
  });

  it('reports a bank it cannot read rather than an empty drill', async () => {
    const source = sourceOver({});
    const available = await source.available();
    const drill = await source.drill(5);
    expect(available.ok).toBe(false);
    expect(drill.ok).toBe(false);
    if (!available.ok) expect(available.error.code).toBe('content.questions.catalogue.empty');
    if (!drill.ok) expect(drill.error.code).toBe('content.questions.catalogue.empty');
  });

  it('refuses a drill of zero rather than reporting an empty session', async () => {
    const drill = await sourceOver().drill(0);
    expect(drill.ok).toBe(false);
    if (!drill.ok) expect(drill.error.code).toBe('scheduler.count.invalid');
  });
});
