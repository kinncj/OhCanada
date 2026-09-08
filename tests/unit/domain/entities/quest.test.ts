/**
 * The quest state machine, scenario for scenario against TN-QUEST.
 */

import { describe, expect, it } from 'vitest';

import {
  acceptQuest,
  canOfferQuest,
  currentStep,
  declineQuest,
  isQuestComplete,
  offerQuest,
  progressQuest,
  requiredForStep,
} from '@domain/entities/quest';
import type { Quest, QuestState } from '@domain/entities/quest';

import { MINUTE, ORIGIN, at, makeQuest, questId, text } from '../../support/fixtures';

const quest: Quest = makeQuest();

const offered = (): QuestState => {
  const state = offerQuest(quest, undefined, ORIGIN);
  if (!state.ok) throw new Error('the fixture must be offerable');
  return state.value;
};

const accepted = (): QuestState => {
  const advance = acceptQuest(quest, offered(), ORIGIN);
  if (!advance.ok) throw new Error('the fixture must be acceptable');
  return advance.value.state;
};

describe('the offer (TN-QUEST-01, TN-QUEST-03)', () => {
  it('offers a quest the player has never met', () => {
    expect(canOfferQuest(undefined)).toBe(true);
    const state = offered();
    expect(state).toMatchObject({ status: 'offered', stepIndex: 0, stepProgress: 0 });
    expect(state.updatedAt).toBe(ORIGIN);
  });

  it('offers it again after a decline', () => {
    const declined = declineQuest(quest, offered(), ORIGIN);
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(canOfferQuest(declined.value)).toBe(true);
    expect(offerQuest(quest, declined.value, at(ORIGIN + MINUTE)).ok).toBe(true);
  });

  it('refuses a second offer once the quest is under way (TN-QUEST-02)', () => {
    const active = accepted();
    expect(canOfferQuest(active)).toBe(false);
    const again = offerQuest(quest, active, ORIGIN);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.kind).toBe('conflict');
      expect(again.error.code).toBe('quest.offer.refused');
    }
  });

  it('refuses a decline the player never made', () => {
    expect(declineQuest(quest, undefined, ORIGIN).ok).toBe(false);
    expect(declineQuest(quest, accepted(), ORIGIN).ok).toBe(false);
  });
});

describe('accepting (TN-QUEST-02)', () => {
  it('finishes the leading talk step in the same move', () => {
    const advance = acceptQuest(quest, offered(), ORIGIN);
    expect(advance.ok).toBe(true);
    if (!advance.ok) return;
    expect(advance.value.completedStepIndex).toBe(0);
    expect(advance.value.state).toMatchObject({ status: 'active', stepIndex: 1, stepProgress: 0 });
    expect(currentStep(quest, advance.value.state)?.id).toBe('visit-hill');
  });

  it('starts at step 0 when the quest does not open with a talk step', () => {
    const walkUp = makeQuest({ steps: quest.steps.slice(1) });
    const advance = acceptQuest(walkUp, offered(), ORIGIN);
    expect(advance.ok).toBe(true);
    if (!advance.ok) return;
    expect(advance.value.completedStepIndex).toBeNull();
    expect(advance.value.state.stepIndex).toBe(0);
  });

  it('completes a one-step talk quest outright', () => {
    const errand = makeQuest({ steps: quest.steps.slice(0, 1) });
    const advance = acceptQuest(errand, offered(), ORIGIN);
    expect(advance.ok).toBe(true);
    if (!advance.ok) return;
    expect(advance.value.questCompleted).toBe(true);
    expect(isQuestComplete(advance.value.state)).toBe(true);
    expect(currentStep(errand, advance.value.state)).toBeUndefined();
  });

  it('refuses to accept a quest nobody offered, or one already running', () => {
    expect(acceptQuest(quest, undefined, ORIGIN).ok).toBe(false);
    expect(acceptQuest(quest, accepted(), ORIGIN).ok).toBe(false);
  });

  it('refuses a quest with no steps', () => {
    const empty = makeQuest({ id: questId('empty'), steps: [] });
    const advance = acceptQuest(empty, offered(), ORIGIN);
    expect(advance.ok).toBe(false);
    if (!advance.ok) expect(advance.error.code).toBe('quest.steps.empty');
  });
});

describe('following the quest (TN-QUEST-02, TN-QUEST-04)', () => {
  it('counts the visit, then counts three answers and completes', () => {
    const visited = progressQuest(quest, accepted(), { kind: 'visit', targetId: 'parliament-hill' }, ORIGIN);
    expect(visited.ok).toBe(true);
    if (!visited.ok) return;
    expect(visited.value.completedStepIndex).toBe(1);
    expect(visited.value.state.stepIndex).toBe(2);

    const first = progressQuest(quest, visited.value.state, { kind: 'answer' }, ORIGIN);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.completedStepIndex).toBeNull();
    expect(first.value.state.stepProgress).toBe(1);

    const second = progressQuest(quest, first.value.state, { kind: 'answer' }, ORIGIN);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.state.stepProgress).toBe(2);

    const third = progressQuest(quest, second.value.state, { kind: 'answer' }, ORIGIN);
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.value.completedStepIndex).toBe(2);
    expect(third.value.questCompleted).toBe(true);
    expect(third.value.state).toMatchObject({ status: 'completed', stepIndex: 2, stepProgress: 0 });
  });

  it('refuses a step out of order (TN-QUEST-04, "steps cannot be skipped")', () => {
    const skipped = progressQuest(quest, accepted(), { kind: 'answer' }, ORIGIN);
    expect(skipped.ok).toBe(false);
    if (!skipped.ok) {
      expect(skipped.error.code).toBe('quest.step.mismatch');
      expect(skipped.error.details).toMatchObject({ expected: 'visit', received: 'answer' });
    }
  });

  it('refuses the right kind of event at the wrong place', () => {
    const elsewhere = progressQuest(
      quest,
      accepted(),
      { kind: 'visit', targetId: 'rideau-canal' },
      ORIGIN,
    );
    expect(elsewhere.ok).toBe(false);
    if (!elsewhere.ok) expect(elsewhere.error.code).toBe('quest.step.target');
  });

  it('refuses progress on a quest that is not being played', () => {
    expect(progressQuest(quest, offered(), { kind: 'visit' }, ORIGIN).ok).toBe(false);

    const completed: QuestState = { ...accepted(), status: 'completed' };
    const after = progressQuest(quest, completed, { kind: 'visit' }, ORIGIN);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error.code).toBe('quest.progress.inactive');
  });

  it('refuses a state pointing past the end of the quest', () => {
    const broken: QuestState = { ...accepted(), stepIndex: 9 };
    const advanced = progressQuest(quest, broken, { kind: 'visit' }, ORIGIN);
    expect(advanced.ok).toBe(false);
    if (!advanced.ok) expect(advanced.error.code).toBe('quest.step.missing');
  });

  it('stamps every transition with the moment it happened', () => {
    const later = at(ORIGIN + 5 * MINUTE);
    const visited = progressQuest(quest, accepted(), { kind: 'visit' }, later);
    expect(visited.ok).toBe(true);
    if (visited.ok) expect(visited.value.state.updatedAt).toBe(later);
  });
});

describe('how many items a step needs', () => {
  it('reads the count from an answer step and treats every other kind as one', () => {
    const [talk, visit, answer] = quest.steps;
    expect(requiredForStep(talk!)).toBe(1);
    expect(requiredForStep(visit!)).toBe(1);
    expect(requiredForStep(answer!)).toBe(3);
  });

  it('treats an answer step with no count, or a nonsense one, as one question', () => {
    expect(
      requiredForStep({ id: 'a', kind: 'answer', targetId: 'government', prompt: text('Answer') }),
    ).toBe(1);
    expect(
      requiredForStep({
        id: 'a',
        kind: 'answer',
        targetId: 'government',
        prompt: text('Answer'),
        count: 0,
      }),
    ).toBe(1);
  });
});
