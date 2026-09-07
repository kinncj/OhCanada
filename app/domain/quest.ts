import type { DistrictId, LocalizedText, NpcId, QuestId, QuestionId, StampId, TriggerId } from './ids';

export type QuestType = 'fetch' | 'dialogue' | 'puzzle' | 'timed';

export interface DialogueLine {
  readonly speaker: string; // npc id or "player" or "narrator"
  readonly text: LocalizedText;
}

interface StepBase {
  readonly id: string;
  readonly objective: LocalizedText;
  readonly timeLimitSeconds?: number;
}

export interface TalkStep extends StepBase {
  readonly kind: 'talk';
  readonly npc: NpcId;
  readonly dialogue: readonly DialogueLine[];
}

export interface ReachStep extends StepBase {
  readonly kind: 'reach';
  readonly trigger: TriggerId;
}

export interface CollectStep extends StepBase {
  readonly kind: 'collect';
  readonly items: readonly TriggerId[]; // pickup trigger ids
}

export interface AnswerStep extends StepBase {
  readonly kind: 'answer';
  readonly questions: readonly QuestionId[];
  readonly minCorrect: number;
}

export type QuestStep = TalkStep | ReachStep | CollectStep | AnswerStep;

export interface QuestReward {
  readonly stamp: StampId;
  readonly unlocks?: readonly DistrictId[];
}

export interface Quest {
  readonly id: QuestId;
  readonly district: DistrictId;
  readonly type: QuestType;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly giverNpc: NpcId;
  readonly steps: readonly QuestStep[];
  readonly reward: QuestReward;
  readonly completionDialogue?: readonly DialogueLine[];
}

export type QuestStatus = 'active' | 'completed' | 'failed';

export interface QuestState {
  readonly questId: QuestId;
  readonly status: QuestStatus;
  readonly stepIndex: number;
  readonly collected: readonly TriggerId[];
  readonly answers: Readonly<Record<string, number>>; // stepId -> correct count
  readonly stepStartedAt: number; // ms, from Clock
}

export type QuestEvent =
  | { readonly kind: 'talked'; readonly npc: NpcId; readonly at: number }
  | { readonly kind: 'reached'; readonly trigger: TriggerId; readonly at: number }
  | { readonly kind: 'collected'; readonly trigger: TriggerId; readonly at: number }
  | { readonly kind: 'answered'; readonly questionId: QuestionId; readonly correct: boolean; readonly at: number }
  | { readonly kind: 'tick'; readonly at: number };

export function startQuest(quest: Quest, at: number): QuestState {
  if (quest.steps.length === 0) throw new Error(`Quest ${quest.id} has no steps`);
  return { questId: quest.id, status: 'active', stepIndex: 0, collected: [], answers: {}, stepStartedAt: at };
}

export function currentStep(quest: Quest, state: QuestState): QuestStep | undefined {
  return quest.steps[state.stepIndex];
}

function advance(quest: Quest, state: QuestState, at: number): QuestState {
  const next = state.stepIndex + 1;
  if (next >= quest.steps.length) return { ...state, status: 'completed', stepIndex: next, stepStartedAt: at };
  return { ...state, stepIndex: next, collected: [], stepStartedAt: at };
}

function timedOut(step: QuestStep, state: QuestState, at: number): boolean {
  return step.timeLimitSeconds !== undefined && at - state.stepStartedAt > step.timeLimitSeconds * 1000;
}

/** Pure reducer: apply a world event to a quest state. Unrelated events are no-ops. */
export function applyQuestEvent(quest: Quest, state: QuestState, event: QuestEvent): QuestState {
  if (state.status !== 'active') return state;
  const step = currentStep(quest, state);
  if (!step) return state;

  if (timedOut(step, state, event.at)) return { ...state, status: 'failed' };

  switch (step.kind) {
    case 'talk':
      return event.kind === 'talked' && event.npc === step.npc ? advance(quest, state, event.at) : state;
    case 'reach':
      return event.kind === 'reached' && event.trigger === step.trigger ? advance(quest, state, event.at) : state;
    case 'collect': {
      if (event.kind !== 'collected' || !step.items.includes(event.trigger) || state.collected.includes(event.trigger)) return state;
      const collected = [...state.collected, event.trigger];
      const s = { ...state, collected };
      return collected.length >= step.items.length ? advance(quest, s, event.at) : s;
    }
    case 'answer': {
      if (event.kind !== 'answered' || !step.questions.includes(event.questionId)) return state;
      const answeredKey = `${step.id}:answered`;
      const answeredCount = (state.answers[answeredKey] ?? 0) + 1;
      const correctCount = (state.answers[step.id] ?? 0) + (event.correct ? 1 : 0);
      const s: QuestState = { ...state, answers: { ...state.answers, [step.id]: correctCount, [answeredKey]: answeredCount } };
      if (answeredCount < step.questions.length) return s;
      return correctCount >= step.minCorrect ? advance(quest, s, event.at) : { ...s, status: 'failed' };
    }
  }
}

/** Restart a failed quest from its first step. */
export function retryQuest(quest: Quest, at: number): QuestState {
  return startQuest(quest, at);
}
