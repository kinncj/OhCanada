/**
 * StartQuest — the officer makes the offer, and the player says yes or no.
 *
 * This is one of the first four call sites for `Clock` (slice 1 task 1.5). The
 * quest rules themselves are pure domain and take `now` as a parameter; this use
 * case is what holds the port and supplies it. Nothing about presentation
 * happens here: the result says what became true, and `app/bootstrap` is what
 * turns that into `quest/offered`, `quest/accepted`, `quest/declined` and
 * `quest/step-completed` on the event bus.
 *
 * Stories: TN-QUEST-01 (the offer), TN-QUEST-02 (accepting, and the leading
 * `talk` step completing with it), TN-QUEST-03 (declining, and being able to
 * accept later), TN-SAVE item 5 (all four states survive a closed tab).
 */

import { andThen, ok } from '@common/result';
import type { Result } from '@common/result';
import type { QuestDocument } from '@application/ports/content-repository';
import type { Clock } from '@application/ports/clock';

import {
  acceptQuest as acceptQuestRule,
  canOfferQuest,
  currentStep,
  declineQuest as declineQuestRule,
  offerQuest as offerQuestRule,
} from '@domain/entities/quest';
import type { QuestState, QuestStep } from '@domain/entities/quest';
import { questStateFor, withQuestState } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';

export interface StartQuestDeps {
  readonly clock: Clock;
}

export interface OfferQuestInput {
  readonly quest: QuestDocument;
  readonly progress: Progress;
}

export interface OfferQuestResult {
  readonly progress: Progress;
  readonly state: QuestState;
}

/**
 * Record that the giver offered the quest.
 *
 * Refused once the quest is active or complete: TN-QUEST-02 and TN-QUEST-04 both
 * assert that talking to the officer again gives a reminder and emits no second
 * `quest/offered`. Whether the offer *may* be made is `questIsOnOffer`, which the
 * dialogue asks before it opens.
 */
export const offerQuest = (
  deps: StartQuestDeps,
  input: OfferQuestInput,
): Result<OfferQuestResult> => {
  const { quest, progress } = input;
  const existing = questStateFor(progress, quest.levelId, quest.id);
  return andThen(offerQuestRule(quest, existing, deps.clock.now()), (state) =>
    ok({ progress: withQuestState(progress, quest.levelId, state), state }),
  );
};

/** Would engaging the giver open an offer, or a reminder? */
export const questIsOnOffer = (progress: Progress, quest: QuestDocument): boolean =>
  canOfferQuest(questStateFor(progress, quest.levelId, quest.id));

export type QuestDecision = 'accept' | 'decline';

export interface StartQuestInput {
  readonly quest: QuestDocument;
  readonly progress: Progress;
  readonly decision: QuestDecision;
}

export interface StartQuestResult {
  readonly progress: Progress;
  readonly state: QuestState;
  readonly accepted: boolean;
  /** The step this decision finished — step 1 of the story, index 0 — or `null`. */
  readonly completedStepIndex: number | null;
  /** What the tracker shows next; `undefined` once the quest is finished. */
  readonly currentStep: QuestStep | undefined;
  readonly questCompleted: boolean;
}

/**
 * "Yes, let's go" or "Not now".
 *
 * Both need the quest to have been offered first. Leaving the dialogue without
 * choosing is neither of these and reaches this use case not at all
 * (TN-QUEST-03: closing the dialogue emits no accept and no decline).
 */
export const startQuest = (
  deps: StartQuestDeps,
  input: StartQuestInput,
): Result<StartQuestResult> => {
  const { quest, progress, decision } = input;
  const now = deps.clock.now();
  const existing = questStateFor(progress, quest.levelId, quest.id);

  if (decision === 'decline') {
    return andThen(declineQuestRule(quest, existing, now), (state) =>
      ok({
        progress: withQuestState(progress, quest.levelId, state),
        state,
        accepted: false,
        completedStepIndex: null,
        currentStep: currentStep(quest, state),
        questCompleted: false,
      }),
    );
  }

  return andThen(acceptQuestRule(quest, existing, now), (advance) =>
    ok({
      progress: withQuestState(progress, quest.levelId, advance.state),
      state: advance.state,
      accepted: true,
      completedStepIndex: advance.completedStepIndex,
      currentStep: currentStep(quest, advance.state),
      questCompleted: advance.questCompleted,
    }),
  );
};
