import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@common/event-bus';
import { SeededRandom } from '@common/rng';
import type { GameEvents } from '@application/events';
import { SessionStore } from '@application/session-store';
import { InitializeSession } from '@application/use-cases/initialize-session';
import { StartQuest } from '@application/use-cases/start-quest';
import { AdvanceQuest } from '@application/use-cases/advance-quest';
import { AnswerQuestion } from '@application/use-cases/answer-question';
import { UnlockDistrict } from '@application/use-cases/unlock-district';
import { FakeContent } from '../../fixtures/content';
import { FakeClock, MemoryRepo } from '../../fixtures/ports';
import { districtId, npcId, questId, questionId, triggerId } from '@domain/ids';

async function setup() {
  const store = new SessionStore();
  const repo = new MemoryRepo();
  const content = new FakeContent();
  const clock = new FakeClock();
  const bus = new EventBus<GameEvents>();
  await new InitializeSession(store, repo, content, clock, bus).execute();
  const advance = new AdvanceQuest(store, content, clock, bus);
  const start = new StartQuest(store, content, clock, bus);
  const answer = new AnswerQuestion(store, content, clock, new SeededRandom(1), bus, advance);
  const travel = new UnlockDistrict(store, content, clock, bus);
  const events: string[] = [];
  bus.onAny((t) => events.push(t));
  return { store, repo, content, clock, bus, advance, start, answer, travel, events };
}

describe('quest flow', () => {
  it('slice 1: start -> talk -> reach -> 3 questions -> stamp -> unlock', async () => {
    const s = await setup();
    const started = await s.start.execute(questId('hub-welcome'));
    expect(started.ok).toBe(true);
    expect((await s.start.execute(questId('hub-welcome'))).ok).toBe(false); // already active
    expect((await s.start.execute(questId('missing'))).ok).toBe(false);

    await s.advance.execute({ kind: 'talked', npc: npcId('guide'), at: s.clock.now() });
    expect(s.store.progress.activeQuests[0]?.stepIndex).toBe(1);
    await s.advance.execute({ kind: 'reached', trigger: triggerId('flagpole'), at: s.clock.now() });
    expect(s.store.progress.activeQuests[0]?.stepIndex).toBe(2);

    for (const id of ['q-rr-001', 'q-rr-002', 'q-rr-003']) {
      const p = await s.answer.present(questId('hub-welcome'), questionId(id));
      expect(p.ok).toBe(true);
      if (!p.ok) throw new Error();
      const key = id === 'q-rr-002' ? p.value.choices.find((c) => !c.correct)!.key : p.value.choices.find((c) => c.correct)!.key;
      const r = await s.answer.answer(questionId(id), key);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.correct).toBe(id !== 'q-rr-002');
    }
    const p = s.store.progress;
    expect(p.completedQuests).toEqual(['hub-welcome']);
    expect(p.stamps).toHaveLength(1);
    expect(p.answered).toHaveLength(3);
    expect(p.unlockedDistricts).toContain('rights-responsibilities');
    expect(s.events).toEqual(expect.arrayContaining(['quest:started', 'quest:updated', 'question:asked', 'question:answered', 'quest:completed', 'stamp:earned', 'district:unlocked']));
    expect((await s.start.execute(questId('hub-welcome'))).ok).toBe(false); // already completed

    // travel
    expect(s.travel.isUnlocked(districtId('rights-responsibilities'))).toBe(true);
    expect(s.travel.travel(districtId('rights-responsibilities')).ok).toBe(true);
    expect(s.store.progress.currentDistrict).toBe('rights-responsibilities');
    expect(s.travel.travel(districtId('who-we-are')).ok).toBe(false);
    expect(s.travel.travel(districtId('nowhere')).ok).toBe(false);
    expect(s.events).toContain('district:locked-attempt');
  });

  it('answering a question that was not presented fails', async () => {
    const s = await setup();
    const r = await s.answer.answer(questionId('q-rr-001'), 'a');
    expect(r.ok).toBe(false);
    const missing = await s.answer.present(questId('hub-welcome'), questionId('q-zz-999'));
    expect(missing.ok).toBe(false);
  });

  it('failing the quiz marks the quest failed and emits', async () => {
    const s = await setup();
    await s.start.execute(questId('hub-welcome'));
    await s.advance.execute({ kind: 'talked', npc: npcId('guide'), at: 0 });
    await s.advance.execute({ kind: 'reached', trigger: triggerId('flagpole'), at: 0 });
    for (const id of ['q-rr-001', 'q-rr-002', 'q-rr-003']) {
      const p = await s.answer.present(questId('hub-welcome'), questionId(id));
      if (!p.ok) throw new Error();
      await s.answer.answer(questionId(id), p.value.choices.find((c) => !c.correct)!.key);
    }
    expect(s.store.progress.activeQuests[0]?.status).toBe('failed');
    expect(s.events).toContain('quest:failed');
    // restart allowed after failure
    expect((await s.start.execute(questId('hub-welcome'))).ok).toBe(true);
  });

  it('explicit reward unlocks and content errors', async () => {
    const s = await setup();
    await s.start.execute(questId('rr-collect'));
    await s.advance.execute({ kind: 'collected', trigger: triggerId('a'), at: 0 });
    await s.advance.execute({ kind: 'collected', trigger: triggerId('b'), at: 0 });
    expect(s.store.progress.unlockedDistricts).toContain('who-we-are');

    const t = await setup();
    await t.start.execute(questId('hub-welcome'));
    t.content.failQuests = true;
    const r = await t.advance.execute({ kind: 'tick', at: 0 });
    expect(r.ok).toBe(false);
    const vi_ = vi.fn();
    void vi_;
  });

  it('advance is a no-op with no active quests', async () => {
    const s = await setup();
    const r = await s.advance.execute({ kind: 'tick', at: 0 });
    expect(r.ok && r.value).toEqual([]);
  });
});
