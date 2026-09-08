/**
 * Quest — the job an NPC gives, and exactly where the player is in it.
 *
 * `Quest` and `QuestStep` mirror `content/schemas/quest.schema.json`.
 * `QuestState` mirrors `progress.schema.json#/$defs/questProgress`, with one
 * substitution: `updatedAt` is `EpochMillis` here and `IsoInstant` there. That is
 * the same split the review record makes and for the same reason — the domain
 * does arithmetic, the save file is read by a person — and the conversion belongs
 * to `SaveCodec` (ADR-0012).
 *
 * The four statuses are the story's, not an invention: TN-SAVE item 5 promises
 * "not offered / declined / accepted with the current step / completed" all come
 * back, and TN-SAVE-01 asserts that a declined quest returns as *declined*
 * rather than as never offered. A quest never met has no `QuestState` at all.
 *
 * Every transition is a pure function of (quest, state, event, now) returning a
 * new state; nothing here reads a clock or mutates its input, and a refused
 * transition is a `Result` error rather than a thrown exception.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type {
  CharacterId,
  EpochMillis,
  LevelId,
  QuestId,
  QuestionId,
  SubjectId,
} from '@domain/ids';

import type { LocalizedText } from '@domain/entities/values';

export type QuestStepKind = 'talk' | 'visit' | 'collect' | 'answer';

/**
 * One objective.
 *
 * `targetId` is an unbranded string because what it names depends on `kind` — an
 * NPC, a POI, a subject — and a union of brands is not a shape a schema can
 * state (the port says the same).
 */
export interface QuestStep {
  readonly id: string;
  readonly kind: QuestStepKind;
  readonly targetId: string;
  readonly prompt: LocalizedText;
  /** `answer` steps only: how many, and optionally from which pool. The scheduler picks which. */
  readonly subject?: SubjectId;
  readonly count?: number;
  readonly questionPool?: readonly QuestionId[];
}

export interface Quest {
  readonly id: QuestId;
  readonly levelId: LevelId;
  readonly giver: CharacterId;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly steps: readonly QuestStep[];
}

export type QuestStatus = 'offered' | 'declined' | 'active' | 'completed';

export interface QuestState {
  readonly questId: QuestId;
  readonly status: QuestStatus;
  /** Index into `Quest.steps`. 0 while offered or declined; a completed quest keeps its last. */
  readonly stepIndex: number;
  /** How many of the current step's required items are done. 0 on every kind but `answer`. */
  readonly stepProgress: number;
  readonly updatedAt: EpochMillis;
}

/** Something the player just did, in the vocabulary a step is written in. */
export interface QuestEvent {
  readonly kind: QuestStepKind;
  /**
   * What it happened to. Optional: an `answer` step counts answers from the
   * scheduler's draw, and the caller has no target to name for them. When it is
   * given it must match the step, which is what stops a POI on the far side of
   * the level from completing this one.
   */
  readonly targetId?: string;
}

/** The result of one step-advancing event. */
export interface QuestAdvance {
  readonly state: QuestState;
  /** The index of the step this event finished, or `null` when it only counted toward one. */
  readonly completedStepIndex: number | null;
  /** True on the event that finished the last step (TN-QUEST-04). */
  readonly questCompleted: boolean;
}

/** How many items the step needs. `answer` steps say so; every other kind needs one event. */
export const requiredForStep = (step: QuestStep): number =>
  step.kind === 'answer' ? Math.max(1, step.count ?? 1) : 1;

/** The step the tracker is showing, or `undefined` when the quest is finished. */
export const currentStep = (quest: Quest, state: QuestState): QuestStep | undefined =>
  state.status === 'completed' ? undefined : quest.steps[state.stepIndex];

export const isQuestComplete = (state: QuestState): boolean => state.status === 'completed';

/**
 * May the giver offer this quest?
 *
 * Never met, offered-and-walked-away, and declined all say yes — TN-QUEST-03,
 * "the quest can be accepted later". Active and completed say no: the officer
 * gives a reminder or a thank-you instead, and TN-QUEST-02 asserts that no
 * second `quest/offered` is emitted.
 */
export const canOfferQuest = (state: QuestState | undefined): boolean =>
  state === undefined || state.status === 'offered' || state.status === 'declined';

const at = (state: Omit<QuestState, 'updatedAt'>, now: EpochMillis): QuestState => ({
  ...state,
  updatedAt: now,
});

/** Record that the giver made the offer. */
export const offerQuest = (
  quest: Quest,
  state: QuestState | undefined,
  now: EpochMillis,
): Result<QuestState> => {
  if (!canOfferQuest(state)) {
    return appErr('conflict', 'quest.offer.refused', 'That quest is not on offer any more.', {
      questId: quest.id,
      status: state?.status,
    });
  }
  return ok(at({ questId: quest.id, status: 'offered', stepIndex: 0, stepProgress: 0 }, now));
};

/**
 * The player said "Not now".
 *
 * Declining a quest that was never offered is refused rather than silently
 * recorded: a decline the player never made would show a tracker state nobody
 * chose after a reload.
 */
export const declineQuest = (
  quest: Quest,
  state: QuestState | undefined,
  now: EpochMillis,
): Result<QuestState> => {
  if (state === undefined || state.status !== 'offered') {
    return appErr('conflict', 'quest.decline.refused', 'That quest is not on offer.', {
      questId: quest.id,
      status: state?.status,
    });
  }
  return ok(at({ questId: quest.id, status: 'declined', stepIndex: 0, stepProgress: 0 }, now));
};

/**
 * Move to the step after `stepIndex`, completing the quest if there is none.
 *
 * One place decides what "the next step" means, so accepting the offer and
 * answering the last question cannot disagree about it.
 */
const advanceTo = (quest: Quest, questId: QuestId, nextIndex: number, now: EpochMillis): QuestState =>
  nextIndex >= quest.steps.length
    ? at(
        {
          questId,
          status: 'completed',
          // A completed quest keeps the index of its last step (the schema says so).
          stepIndex: Math.max(0, quest.steps.length - 1),
          stepProgress: 0,
        },
        now,
      )
    : at({ questId, status: 'active', stepIndex: nextIndex, stepProgress: 0 }, now);

/**
 * The player said "Yes, let's go".
 *
 * Accepting finishes a leading `talk` step in the same move, because that is
 * what the story says happens: TN-QUEST-02 emits `quest/accepted` and
 * `quest/step-completed` for step 1 together, and the tracker then shows step 2.
 * A quest that does not open with a `talk` step simply starts at step 0.
 */
export const acceptQuest = (
  quest: Quest,
  state: QuestState | undefined,
  now: EpochMillis,
): Result<QuestAdvance> => {
  if (state === undefined || (state.status !== 'offered' && state.status !== 'declined')) {
    return appErr('conflict', 'quest.accept.refused', 'That quest cannot be accepted now.', {
      questId: quest.id,
      status: state?.status,
    });
  }
  if (quest.steps.length === 0) {
    return appErr('invalid', 'quest.steps.empty', 'A quest with no steps cannot be started.', {
      questId: quest.id,
    });
  }
  const first = quest.steps[0];
  const completesFirst = first !== undefined && first.kind === 'talk';
  const next = advanceTo(quest, quest.id, completesFirst ? 1 : 0, now);
  return ok({
    state: next,
    completedStepIndex: completesFirst ? 0 : null,
    questCompleted: next.status === 'completed',
  });
};

/**
 * Fold one thing the player did into the quest.
 *
 * Steps cannot be skipped (TN-QUEST-04): an event is matched against the
 * *current* step only, and an event for any other step is refused rather than
 * queued. On an `answer` step the event counts — "Answer 3 questions (2 of 3)" —
 * and the step finishes on the count the quest asked for, right or wrong
 * (TN-QUEST-04: "a wrong answer still finishes the quest").
 */
export const progressQuest = (
  quest: Quest,
  state: QuestState,
  event: QuestEvent,
  now: EpochMillis,
): Result<QuestAdvance> => {
  if (state.status !== 'active') {
    return appErr('conflict', 'quest.progress.inactive', 'That quest is not being played.', {
      questId: quest.id,
      status: state.status,
    });
  }
  const step = quest.steps[state.stepIndex];
  if (step === undefined) {
    return appErr('invalid', 'quest.step.missing', 'That quest has no such step.', {
      questId: quest.id,
      stepIndex: state.stepIndex,
    });
  }
  if (step.kind !== event.kind) {
    return appErr('conflict', 'quest.step.mismatch', 'That is not the current step.', {
      questId: quest.id,
      stepIndex: state.stepIndex,
      expected: step.kind,
      received: event.kind,
    });
  }
  if (event.targetId !== undefined && event.targetId !== step.targetId) {
    return appErr('conflict', 'quest.step.target', 'That is not what the current step asks for.', {
      questId: quest.id,
      stepIndex: state.stepIndex,
      expected: step.targetId,
      received: event.targetId,
    });
  }

  const done = state.stepProgress + 1;
  if (done < requiredForStep(step)) {
    return ok({
      state: at(
        {
          questId: state.questId,
          status: 'active',
          stepIndex: state.stepIndex,
          stepProgress: done,
        },
        now,
      ),
      completedStepIndex: null,
      questCompleted: false,
    });
  }

  const next = advanceTo(quest, state.questId, state.stepIndex + 1, now);
  return ok({
    state: next,
    completedStepIndex: state.stepIndex,
    questCompleted: next.status === 'completed',
  });
};
