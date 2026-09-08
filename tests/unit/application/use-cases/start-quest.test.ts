/**
 * StartQuest, against TN-QUEST-01/02/03 — including that the clock arrives as a
 * port and is the only source of "now" in the recorded state.
 */

import { describe, expect, it } from 'vitest';

import { offerQuest, questIsOnOffer, startQuest } from '@application/use-cases/start-quest';
import { questStateFor } from '@domain/entities/progress';

import { MINUTE, ORIGIN, at, emptyProgress, levelId, makeQuest, questId, testClock } from '../../support/fixtures';

const quest = makeQuest();

describe('offering the quest', () => {
  it('records the offer, stamped with the clock the use case was given', () => {
    const clock = testClock();
    clock.advance(3 * MINUTE);
    const offered = offerQuest({ clock }, { quest, progress: emptyProgress() });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    expect(offered.value.state).toMatchObject({ status: 'offered', stepIndex: 0 });
    expect(offered.value.state.updatedAt).toBe(at(ORIGIN + 3 * MINUTE));
    expect(questStateFor(offered.value.progress, levelId(), questId())?.status).toBe('offered');
  });

  it('says whether the giver has an offer to make or a reminder', () => {
    const clock = testClock();
    const progress = emptyProgress();
    expect(questIsOnOffer(progress, quest)).toBe(true);

    const offered = offerQuest({ clock }, { quest, progress });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;

    const accepted = startQuest(
      { clock },
      { quest, progress: offered.value.progress, decision: 'accept' },
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(questIsOnOffer(accepted.value.progress, quest)).toBe(false);

    const second = offerQuest({ clock }, { quest, progress: accepted.value.progress });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('quest.offer.refused');
  });
});

describe('accepting and declining', () => {
  const offeredProgress = () => {
    const offered = offerQuest({ clock: testClock() }, { quest, progress: emptyProgress() });
    if (!offered.ok) throw new Error('the fixture must be offerable');
    return offered.value.progress;
  };

  it('accepting finishes step 1 and points the tracker at step 2 (TN-QUEST-02)', () => {
    const accepted = startQuest(
      { clock: testClock() },
      { quest, progress: offeredProgress(), decision: 'accept' },
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.value.accepted).toBe(true);
    expect(accepted.value.completedStepIndex).toBe(0);
    expect(accepted.value.currentStep?.id).toBe('visit-hill');
    expect(accepted.value.questCompleted).toBe(false);
    expect(questStateFor(accepted.value.progress, levelId(), questId())).toMatchObject({
      status: 'active',
      stepIndex: 1,
    });
  });

  it('declining leaves the quest available and shows no tracker (TN-QUEST-03)', () => {
    const declined = startQuest(
      { clock: testClock() },
      { quest, progress: offeredProgress(), decision: 'decline' },
    );
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.value.accepted).toBe(false);
    expect(declined.value.state.status).toBe('declined');
    expect(questIsOnOffer(declined.value.progress, quest)).toBe(true);

    const later = startQuest(
      { clock: testClock() },
      { quest, progress: declined.value.progress, decision: 'accept' },
    );
    expect(later.ok).toBe(true);
    if (later.ok) expect(later.value.state.status).toBe('active');
  });

  it('refuses a decision on a quest that was never offered', () => {
    const progress = emptyProgress();
    const accepted = startQuest({ clock: testClock() }, { quest, progress, decision: 'accept' });
    expect(accepted.ok).toBe(false);
    if (!accepted.ok) expect(accepted.error.code).toBe('quest.accept.refused');

    const declined = startQuest({ clock: testClock() }, { quest, progress, decision: 'decline' });
    expect(declined.ok).toBe(false);
    if (!declined.ok) expect(declined.error.code).toBe('quest.decline.refused');
  });

  it('reports a one-step quest as complete on acceptance', () => {
    const errand = makeQuest({ steps: quest.steps.slice(0, 1) });
    const offered = offerQuest({ clock: testClock() }, { quest: errand, progress: emptyProgress() });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const accepted = startQuest(
      { clock: testClock() },
      { quest: errand, progress: offered.value.progress, decision: 'accept' },
    );
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.value.questCompleted).toBe(true);
      expect(accepted.value.currentStep).toBeUndefined();
    }
  });
});
