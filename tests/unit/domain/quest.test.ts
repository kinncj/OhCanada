import { describe, expect, it } from 'vitest';
import { applyQuestEvent, currentStep, retryQuest, startQuest } from '@domain/quest';
import { npcId, questionId, triggerId } from '@domain/ids';
import { QUEST_COLLECT, QUEST_WELCOME } from '../../fixtures/content';

describe('quest state machine', () => {
  it('walks talk -> reach -> answer to completion', () => {
    let s = startQuest(QUEST_WELCOME, 0);
    expect(currentStep(QUEST_WELCOME, s)?.kind).toBe('talk');
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'reached', trigger: triggerId('flagpole'), at: 1 }); // wrong step: no-op
    expect(s.stepIndex).toBe(0);
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'talked', npc: npcId('other'), at: 1 });
    expect(s.stepIndex).toBe(0);
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'talked', npc: npcId('guide'), at: 1 });
    expect(s.stepIndex).toBe(1);
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'reached', trigger: triggerId('flagpole'), at: 2 });
    expect(s.stepIndex).toBe(2);
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'answered', questionId: questionId('q-rr-001'), correct: true, at: 3 });
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'answered', questionId: questionId('q-xx-999'), correct: true, at: 3 }); // unrelated
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'answered', questionId: questionId('q-rr-002'), correct: false, at: 3 });
    expect(s.status).toBe('active');
    s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'answered', questionId: questionId('q-rr-003'), correct: true, at: 3 });
    expect(s.status).toBe('completed');
    expect(currentStep(QUEST_WELCOME, s)).toBeUndefined();
    // further events are no-ops
    expect(applyQuestEvent(QUEST_WELCOME, s, { kind: 'tick', at: 9 })).toBe(s);
  });

  it('fails the answer step when below minCorrect', () => {
    let s = startQuest(QUEST_WELCOME, 0);
    s = { ...s, stepIndex: 2 };
    for (const id of ['q-rr-001', 'q-rr-002', 'q-rr-003']) s = applyQuestEvent(QUEST_WELCOME, s, { kind: 'answered', questionId: questionId(id), correct: false, at: 1 });
    expect(s.status).toBe('failed');
    const again = retryQuest(QUEST_WELCOME, 5);
    expect(again.stepIndex).toBe(0);
    expect(again.status).toBe('active');
  });

  it('collect step handles duplicates and time limits', () => {
    let s = startQuest(QUEST_COLLECT, 0);
    s = applyQuestEvent(QUEST_COLLECT, s, { kind: 'collected', trigger: triggerId('a'), at: 1000 });
    s = applyQuestEvent(QUEST_COLLECT, s, { kind: 'collected', trigger: triggerId('a'), at: 1000 });
    s = applyQuestEvent(QUEST_COLLECT, s, { kind: 'collected', trigger: triggerId('zzz'), at: 1000 });
    expect(s.collected).toEqual(['a']);
    s = applyQuestEvent(QUEST_COLLECT, s, { kind: 'collected', trigger: triggerId('b'), at: 2000 });
    expect(s.status).toBe('completed');

    let t = startQuest(QUEST_COLLECT, 0);
    t = applyQuestEvent(QUEST_COLLECT, t, { kind: 'tick', at: 61_000 });
    expect(t.status).toBe('failed');
  });

  it('rejects quests without steps', () => {
    expect(() => startQuest({ ...QUEST_WELCOME, steps: [] }, 0)).toThrow();
  });
});
