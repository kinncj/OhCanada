/**
 * The end of a level — what arriving there is worth (ADR-0036).
 *
 * The scene reports a **position**: the player crossed the arrival line
 * (`app/adapters/phaser/level-exit.ts`). Whether that arrival earns anything is
 * a rule, and this is the one place it is written.
 *
 * ## The rule
 *
 * The passport promises it in so many words — "You earn a stamp when you finish
 * a level's task" (`passport.intro`) — and until ADR-0036 the game broke that
 * promise on the most common route through a level: walking to the end earned
 * the stamp whether or not the task was done, so a player could collect every
 * stamp without answering a single question.
 *
 * Reaching the end:
 *
 *  1. **earns nothing new when the stamp is already in the passport.** A stamp is
 *     never taken away, and a level finished twice is one stamp;
 *  2. **earns the stamp when the level sets no task.** "Finish a level's task" is
 *     vacuous for a level with no quest, and a level nobody can finish is a dead
 *     end, not a rule;
 *  3. **earns the stamp when one of the level's quests is complete** and the
 *     stamp is somehow missing — a save written by an older build, or an import.
 *     The task was done; the passport catches up;
 *  4. **otherwise earns nothing**, and the level is *unfinished*: the player may
 *     keep playing or leave, and nothing opens.
 *
 * Every other stamp in the game is earned by the answer or the visit that
 * completes a quest (`answerQuestion`, `app/bootstrap/quest.ts`'s `earn`), which
 * rule 3 simply agrees with.
 *
 * Pure: no clock, no port. `now` arrives from the caller that holds the `Clock`.
 */

import type { EpochMillis, LevelId, QuestId } from '@domain/ids';

import { hasStamp, questStateFor, withStamp } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';

export interface LevelEndInput {
  readonly levelId: LevelId;
  /** Every quest this level offers. Empty means the level sets no task. */
  readonly questIds: readonly QuestId[];
  readonly now: EpochMillis;
}

/**
 * What reaching the end came to.
 *
 * `finished` carries whether **this** arrival wrote the stamp, because only a
 * newly earned stamp opens anything; `unfinished` carries the save unchanged, so
 * a caller cannot write a stamp it was refused.
 */
export type LevelEndOutcome =
  | {
      readonly kind: 'finished';
      readonly progress: Progress;
      /** True only when this arrival wrote the stamp. */
      readonly stampEarned: boolean;
    }
  | { readonly kind: 'unfinished'; readonly progress: Progress };

/** Has the player finished any task this level sets? */
const aTaskIsDone = (progress: Progress, input: LevelEndInput): boolean =>
  input.questIds.some(
    (questId) => questStateFor(progress, input.levelId, questId)?.status === 'completed',
  );

export const reachLevelEnd = (progress: Progress, input: LevelEndInput): LevelEndOutcome => {
  if (hasStamp(progress, input.levelId)) {
    return { kind: 'finished', progress, stampEarned: false };
  }
  if (input.questIds.length === 0 || aTaskIsDone(progress, input)) {
    return {
      kind: 'finished',
      progress: withStamp(progress, input.levelId, input.now),
      stampEarned: true,
    };
  }
  return { kind: 'unfinished', progress };
};
