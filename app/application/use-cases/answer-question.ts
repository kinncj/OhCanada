import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import type { RandomSource } from '@common/rng';
import type { QuestId, QuestionId } from '@domain/ids';
import { correctKey, isCorrectChoice, presentQuestion, type PresentedQuestion } from '@domain/question';
import { recordAnswer } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock, ContentError, ContentRepository } from '../ports';
import type { SessionStore } from '../session-store';
import type { AdvanceQuest } from './advance-quest';

export type AnswerError = ContentError | { readonly code: 'not-presented'; readonly message: string };

export class AnswerQuestion {
  constructor(
    private readonly store: SessionStore,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly rng: RandomSource,
    private readonly events: EventPublisher<GameEvents>,
    private readonly advance: AdvanceQuest,
  ) {}

  /** Present a question (shuffled choices) for a quest step. */
  async present(quest: QuestId, questionId: QuestionId): Promise<Result<PresentedQuestion, ContentError>> {
    const res = await this.content.getQuestions([questionId]);
    if (!res.ok) return res;
    const q = res.value[0];
    if (!q) return err({ code: 'not-found', message: `Question ${questionId} not found` });
    const presented = presentQuestion(q, this.rng);
    this.store.presented.set(questionId, presented);
    this.events.emit('question:asked', { quest, question: questionId });
    return ok(presented);
  }

  async answer(questionId: QuestionId, chosenKey: string): Promise<Result<{ correct: boolean; correctKey: string }, AnswerError>> {
    const presented = this.store.presented.get(questionId);
    if (!presented) return err({ code: 'not-presented', message: `Question ${questionId} was not presented` });
    const correct = isCorrectChoice(presented, chosenKey);
    const ck = correctKey(presented);
    this.store.presented.delete(questionId);
    this.store.update((p) => recordAnswer(p, { questionId, correct, at: this.clock.nowIso() }));
    this.events.emit('question:answered', { question: questionId, correct, correctKey: ck, chosenKey });
    const adv = await this.advance.execute({ kind: 'answered', questionId, correct, at: this.clock.now() });
    if (!adv.ok) return err(adv.error);
    return ok({ correct, correctKey: ck });
  }
}
