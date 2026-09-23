/**
 * What one engagement of a landmark finishes (ADR-0067).
 *
 * A `visit`, `collect` or `read` step completes on arrival (ADR-0063: whether
 * reading happened is not checkable and must not be gated). An engagement is
 * one arrival, so it finishes **every** such step in a row that names the
 * target engaged — not only the first. Each one is still completed in order,
 * by its own `progressQuest` event, so `TN-QUEST-04`'s "steps cannot be
 * skipped" is untouched: the run ends at the first step that is an `answer`, a
 * `talk` (completed by accepting an offer, never by walking up), or somewhere
 * else.
 *
 * Pure, and shared on purpose: `./quest.ts` advances by it, and the one-sitting
 * walk (`a-quests-answer-steps-fill-in-one-sitting.test.ts`) walks by it, so the
 * gate cannot model a different game from the one that ships.
 */

import { bareTargetId } from '@ui/interact';

import type { CueStep } from './task-cue';

/** The step kinds that complete when the player arrives at their target. */
export function isArrivalStep(step: Pick<CueStep, 'kind'>): boolean {
  return step.kind === 'visit' || step.kind === 'collect' || step.kind === 'read';
}

/**
 * How many steps, from `index` on, one engagement of `targetId` finishes: the
 * length of the run of arrival steps naming it. `0` when the step at `index`
 * is not one, or `index` is not a step.
 */
export function stepsFinishedOnArrival(
  steps: readonly CueStep[],
  index: number,
  targetId: string,
): number {
  if (!Number.isInteger(index) || index < 0) return 0;
  const here = bareTargetId(targetId);
  let at = index;
  for (; at < steps.length; at += 1) {
    const step = steps[at];
    if (step === undefined || !isArrivalStep(step) || bareTargetId(step.targetId) !== here) break;
  }
  return at - index;
}
