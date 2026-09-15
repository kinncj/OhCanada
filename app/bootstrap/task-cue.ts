/**
 * Is the stop the task names behind the player?
 *
 * A second live-site audit walked Halifax past the Town Clock. The task still
 * read "Find the Town Clock", and nothing said the clock was behind: a player who
 * skipped a stop walked on towards the end of the level looking for it. The HUD
 * now draws "Behind you" after the task (`hud-task-cue`), and this is where the
 * composition root decides when.
 *
 * ## Where the player is, without asking the engine
 *
 * The scene does not publish the player's x outside the e2e probe, and the level
 * scene is not this layer's to change. What reaches the composition root is
 * **reach**: `poi/entered` names the landmark or character the player has just
 * come up to, and the level document says where each one stands. So the player is
 * taken to be where the last thing they reached stands, or at the spawn before
 * they reach anything. Levels run left to right, so a stop whose x is less than
 * that is behind them.
 *
 * It is a lower bound, and a deliberate one. A player who walks on from the stop
 * into open ground is not told until they reach the next thing, and a player
 * walking back keeps the cue until they reach the stop itself, which is true all
 * the way. It never says "behind" about a stop the player has not passed.
 *
 * Pure: no DOM, no Phaser, no bus.
 */

/** What the HUD draws after the task. */
export type TaskCue = 'behind' | null;

/** As much of a quest step as this needs. */
export interface CueStep {
  readonly kind: string;
  readonly targetId: string;
}

/**
 * The place a step sends the player to.
 *
 * A `talk`, `visit` or `collect` step names it. An `answer` step names its
 * subject, not a place, and is asked where the step before it sent the player
 * (ADR-0036), so it takes the nearest earlier step's place. `null` when there is
 * none, or the index is not a step.
 */
export function placeOfStep(steps: readonly CueStep[], index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= steps.length) return null;
  for (let at = index; at >= 0; at -= 1) {
    const step = steps[at];
    if (step === undefined) return null;
    if (step.kind !== 'answer') return step.targetId;
  }
  return null;
}

export interface TaskCueTracker {
  /** A level arrived: the player stands at its spawn, or nowhere known. */
  arrive(spawnX: number | null): void;
  /** Something came into reach: the player is about where it stands. */
  reached(targetId: string): void;
  /** What to draw after the task whose stop is `placeId`. */
  cue(placeId: string | null): TaskCue;
}

/**
 * @param xOf where a target the level places stands, by any spelling of its id,
 *   or `null` for a target the level does not place.
 */
export function createTaskCue(xOf: (targetId: string) => number | null): TaskCueTracker {
  let playerX: number | null = null;

  return {
    arrive(spawnX): void {
      playerX = spawnX !== null && Number.isFinite(spawnX) ? spawnX : null;
    },

    reached(targetId): void {
      const x = xOf(targetId);
      if (x !== null && Number.isFinite(x)) playerX = x;
    },

    cue(placeId): TaskCue {
      if (placeId === null || playerX === null) return null;
      const placeX = xOf(placeId);
      if (placeX === null || !Number.isFinite(placeX)) return null;
      return placeX < playerX ? 'behind' : null;
    },
  };
}
