/**
 * AnswerQuestion — one tap on a question card, and everything it changes.
 *
 * It changes four things, and the order matters because each depends on the one
 * before: the answer is judged, the review record is folded forward, the quest's
 * `answer` step counts one more, and — if that was the last step — the level's
 * stamp is earned.
 *
 * The second call site for `Clock` (slice 1 task 1.5). The memory model takes
 * `now` as a parameter and cannot reach a clock (`domain-is-pure`); this is what
 * supplies it, once, so every consequence of one answer shares one instant.
 *
 * Stories: TN-CARD (a wrong answer is not a failure), TN-QUEST-02 ("the count
 * rises whether the answer was right or wrong"), TN-QUEST-04 ("a wrong answer
 * still finishes the quest", and the stamp is earned exactly once), TN-SAVE
 * items 6, 7 and 8.
 */

import { andThen, ok } from '@common/result';
import type { Result } from '@common/result';
import type { QuestDocument, QuestionDocument } from '@application/ports/content-repository';
import type { Clock } from '@application/ports/clock';

import { gradeAnswer } from '@domain/entities/question';
import type { AnswerJudgement } from '@domain/entities/question';
import { currentStep, progressQuest } from '@domain/entities/quest';
import type { QuestState } from '@domain/entities/quest';
import {
  hasStamp,
  questStateFor,
  reviewFor,
  withQuestState,
  withReview,
  withStamp,
  withSubjectStarted,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import { recordAnswer } from '@domain/scheduling/review-record';
import type { MemoryTuning } from '@domain/scheduling/review-record';

export interface AnswerQuestionDeps {
  readonly clock: Clock;
}

export interface AnswerQuestionInput {
  readonly question: QuestionDocument;
  /** Which of the four options was tapped. Anything else is refused. */
  readonly chosenIndex: number;
  readonly progress: Progress;
  /**
   * The quest this answer counts toward, when there is one. Omitted in Study
   * mode. Supplying it does not force a count: the answer only advances a quest
   * that is active *and* on an `answer` step, so a drill taken in the middle of
   * an accepted quest cannot finish it by accident.
   */
  readonly quest?: QuestDocument | undefined;
  readonly memory?: MemoryTuning | undefined;
}

export interface AnswerQuestionResult {
  readonly progress: Progress;
  readonly judgement: AnswerJudgement;
  /** True when the card may promise "You will see this question again soon." */
  readonly returnsSoon: boolean;
  readonly questState: QuestState | null;
  readonly completedStepIndex: number | null;
  readonly questCompleted: boolean;
  /** True only on the answer that earned the stamp, never on a repeat. */
  readonly stampEarned: boolean;
}

/** Does this answer count toward the quest's current step? */
const countsTowardQuest = (quest: QuestDocument, state: QuestState): boolean =>
  state.status === 'active' && currentStep(quest, state)?.kind === 'answer';

export const answerQuestion = (
  deps: AnswerQuestionDeps,
  input: AnswerQuestionInput,
): Result<AnswerQuestionResult> => {
  const { question, chosenIndex, progress, quest, memory } = input;

  return andThen(gradeAnswer(question, chosenIndex), (judgement): Result<AnswerQuestionResult> => {
    const now = deps.clock.now();
    const outcome = recordAnswer(
      reviewFor(progress, question.id) ?? null,
      question.id,
      judgement.correct,
      now,
      memory,
    );

    const answered = withSubjectStarted(
      withReview(progress, outcome.record),
      question.subject,
    );

    if (quest === undefined) {
      return ok({
        progress: answered,
        judgement,
        returnsSoon: outcome.returnsSoon,
        questState: null,
        completedStepIndex: null,
        questCompleted: false,
        stampEarned: false,
      });
    }

    const state = questStateFor(answered, quest.levelId, quest.id);
    if (state === undefined || !countsTowardQuest(quest, state)) {
      return ok({
        progress: answered,
        judgement,
        returnsSoon: outcome.returnsSoon,
        questState: state ?? null,
        completedStepIndex: null,
        questCompleted: false,
        stampEarned: false,
      });
    }

    return andThen(progressQuest(quest, state, { kind: 'answer' }, now), (advance) => {
      const tracked = withQuestState(answered, quest.levelId, advance.state);
      const stampEarned = advance.questCompleted && !hasStamp(tracked, quest.levelId);
      return ok({
        progress: stampEarned ? withStamp(tracked, quest.levelId, now) : tracked,
        judgement,
        returnsSoon: outcome.returnsSoon,
        questState: advance.state,
        completedStepIndex: advance.completedStepIndex,
        questCompleted: advance.questCompleted,
        stampEarned,
      });
    });
  });
};
