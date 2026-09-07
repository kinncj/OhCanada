import { describe, expect, it, vi } from 'vitest';
import { err } from '@common/result';
import { EventBus } from '@common/event-bus';
import { SeededRandom } from '@common/rng';
import type { GameEvents } from '@application/events';
import { SessionStore } from '@application/session-store';
import { InitializeSession } from '@application/use-cases/initialize-session';
import { ExportSave, ImportSave, ResetProgress, SaveProgress } from '@application/use-cases/save-progress';
import { CitizenshipExam } from '@application/use-cases/exam';
import { FakeContent } from '../../fixtures/content';
import { FakeClock, JsonCodec, MemoryRepo } from '../../fixtures/ports';
import { districtId, questionId, stampId } from '@domain/ids';

async function setup() {
  const store = new SessionStore();
  const repo = new MemoryRepo();
  const content = new FakeContent();
  const clock = new FakeClock();
  const bus = new EventBus<GameEvents>();
  await new InitializeSession(store, repo, content, clock, bus).execute();
  return { store, repo, content, clock, bus };
}

describe('save / export / import', () => {
  it('round-trips through the codec', async () => {
    const s = await setup();
    const save = new SaveProgress(s.store, s.repo, s.clock, s.bus);
    expect((await save.execute()).ok).toBe(true);
    expect(s.repo.stored).toEqual(s.store.progress);
    const json = new ExportSave(s.store, new JsonCodec()).execute();
    const t = await setup();
    const imported = await new ImportSave(t.store, new JsonCodec(), t.repo, t.clock, t.bus).execute(json);
    expect(imported.ok).toBe(true);
    expect(t.repo.stored?.createdAt).toBe(s.store.progress.createdAt);
  });
  it('rejects tampered or corrupt saves without touching state', async () => {
    const s = await setup();
    const before = s.store.progress;
    const errored = vi.fn();
    s.bus.on('progress:error', errored);
    const imp = new ImportSave(s.store, new JsonCodec(), s.repo, s.clock, s.bus);
    expect((await imp.execute('{not json')).ok).toBe(false);
    expect((await imp.execute('{"hello":1}')).ok).toBe(false);
    expect(s.store.progress).toBe(before);
    expect(errored).toHaveBeenCalledTimes(2);
  });
  it('save and import surface repo failures', async () => {
    const s = await setup();
    s.repo.failSave = true;
    expect((await new SaveProgress(s.store, s.repo, s.clock, s.bus).execute()).ok).toBe(false);
    const json = new ExportSave(s.store, new JsonCodec()).execute();
    expect((await new ImportSave(s.store, new JsonCodec(), s.repo, s.clock, s.bus).execute(json)).ok).toBe(false);
  });
  it('reset clears store and repo', async () => {
    const s = await setup();
    await new SaveProgress(s.store, s.repo, s.clock, s.bus).execute();
    await new ResetProgress(s.store, s.repo).execute();
    expect(s.store.hasProgress).toBe(false);
    expect(s.repo.stored).toBeNull();
  });
});

describe('CitizenshipExam', () => {
  it('is locked until enough stamps, then runs start/answer/finish', async () => {
    const s = await setup();
    const exam = new CitizenshipExam(s.store, s.content, s.clock, new SeededRandom(5), s.bus);
    expect(exam.isUnlocked()).toBe(false);
    expect((await exam.start()).ok).toBe(false);
    expect(exam.remaining()).toBe(0);
    expect(exam.expired()).toBe(false);
    expect(exam.finish().ok).toBe(false);
    expect(exam.answer(questionId('x'), 'a').ok).toBe(false);

    s.store.update((p) => ({ ...p, stamps: [{ id: stampId('a'), district: districtId('hub'), earnedAt: 'x' }, { id: stampId('b'), district: districtId('hub'), earnedAt: 'x' }] }));
    expect(exam.isUnlocked()).toBe(true);
    const started = await exam.start();
    expect(started.ok).toBe(true);
    expect((await exam.start()).ok).toBe(false); // already started
    if (!started.ok) throw new Error();
    for (const pq of started.value.questions) exam.answer(pq.question.id, pq.choices.find((c) => c.correct)!.key);
    s.clock.advance(120_000);
    expect(exam.remaining()).toBe(480);
    const grade = exam.finish();
    expect(grade.ok && grade.value.passed).toBe(true);
    expect(s.store.progress.examResults).toHaveLength(1);
    expect(s.store.progress.examResults[0]?.durationSeconds).toBe(120);
    // practice mode can be forced
    expect((await exam.start({ force: true })).ok).toBe(true);
    s.clock.advance(700_000);
    expect(exam.expired()).toBe(true);
  });
  it('reports content errors and small pools', async () => {
    const s = await setup();
    const exam = new CitizenshipExam(s.store, s.content, s.clock, new SeededRandom(5), s.bus);
    s.content.questions = s.content.questions.slice(0, 1);
    const r = await exam.start({ force: true });
    expect(r.ok).toBe(false);
    s.content.getAllQuestions = async () => err({ code: 'io', message: 'x' });
    expect((await exam.start({ force: true })).ok).toBe(false);
  });
});
