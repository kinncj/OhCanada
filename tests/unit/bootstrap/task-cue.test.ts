import { describe, expect, it } from 'vitest';

import halifaxLevel from '@content/levels/halifax.json';
import halifaxQuest from '@content/quests/halifax-clock-and-pier.json';

import { createTaskCue, placeOfStep } from '../../../app/bootstrap/task-cue';

/**
 * "Behind you" after the task (`app/bootstrap/task-cue.ts`).
 *
 * The audit's walk, on the shipped Halifax documents: the task was "Find the
 * Town Clock" and the player stood at the market stall, past the clock. What is
 * asserted is when the cue is true — never about a stop the player has not
 * passed — from nothing but what the player has reached and where the level
 * places it.
 */

/** Where Halifax places a target, by either spelling of its id. */
function xOf(targetId: string): number | null {
  const bare = targetId.replace(/^(poi|npc)\./u, '');
  const poi = halifaxLevel.pois.find((candidate) => candidate.id === bare);
  if (poi !== undefined) return poi.position.x;
  const character = halifaxLevel.characters.find((candidate) => candidate.characterId === bare);
  return character?.position.x ?? null;
}

describe('the place a step sends the player to', () => {
  it("is a talk or visit step's own target, and for an answer step the place before it", () => {
    const steps = halifaxQuest.steps;
    /* A stop is a visit, the read it opens (ADR-0067), then its answer. */
    expect(steps.map((step) => step.kind).slice(0, 5)).toEqual(['talk', 'visit', 'read', 'answer', 'visit']);
    const at = (id: string): number => steps.findIndex((step) => step.id === id);
    expect(placeOfStep(steps, at('meet-the-guide'))).toBe('guide');
    expect(placeOfStep(steps, at('find-the-town-clock'))).toBe('town-clock');
    expect(placeOfStep(steps, at('read-at-the-town-clock'))).toBe('town-clock');
    /* Answered at the clock: its target is the subject, never a place. */
    expect(placeOfStep(steps, at('answer-at-the-clock'))).toBe('town-clock');
    expect(placeOfStep(steps, at('answer-at-the-market-stall'))).toBe('market-stall');
  });

  it('is nothing for an index that is not a step, or an answer step with no place before it', () => {
    const steps = halifaxQuest.steps;
    expect(placeOfStep(steps, -1)).toBeNull();
    expect(placeOfStep(steps, steps.length)).toBeNull();
    expect(placeOfStep(steps, 1.5)).toBeNull();
    expect(placeOfStep([{ kind: 'answer', targetId: 'rights' }], 0)).toBeNull();
  });
});

describe('whether the stop is behind the player', () => {
  it('is not behind at the spawn, or while the stop is still ahead', () => {
    const cue = createTaskCue(xOf);
    cue.arrive(halifaxLevel.spawn.x);
    expect(cue.cue('town-clock')).toBeNull();
    cue.reached('npc.guide');
    expect(cue.cue('town-clock')).toBeNull();
  });

  it('is behind once the player has reached something past it: the audit walk past the Town Clock', () => {
    const cue = createTaskCue(xOf);
    cue.arrive(halifaxLevel.spawn.x);
    cue.reached('poi.town-clock');
    expect(cue.cue('town-clock'), 'standing at the stop is not being past it').toBeNull();
    cue.reached('poi.market-stall');
    expect(cue.cue('town-clock')).toBe('behind');
    /* The next stop on from the stall is still ahead. */
    expect(cue.cue('pier-21')).toBeNull();
  });

  it('stops being behind when the player walks back and reaches the stop', () => {
    const cue = createTaskCue(xOf);
    cue.arrive(halifaxLevel.spawn.x);
    cue.reached('pier-21');
    expect(cue.cue('town-clock')).toBe('behind');
    cue.reached('market-stall');
    expect(cue.cue('town-clock'), 'still past it on the way back').toBe('behind');
    cue.reached('town-clock');
    expect(cue.cue('town-clock')).toBeNull();
  });

  it('says nothing before a level arrives, about a place the level does not place, or with no task', () => {
    const cue = createTaskCue(xOf);
    expect(cue.cue('town-clock'), 'no level, no position').toBeNull();
    cue.arrive(halifaxLevel.spawn.x);
    cue.reached('harbour-tug');
    expect(cue.cue('nowhere-in-halifax')).toBeNull();
    expect(cue.cue(null)).toBeNull();
    /* Reaching something unplaced moves nobody. */
    cue.reached('nowhere-in-halifax');
    expect(cue.cue('town-clock')).toBe('behind');
  });

  it('starts again from the spawn when a level arrives again', () => {
    const cue = createTaskCue(xOf);
    cue.arrive(halifaxLevel.spawn.x);
    cue.reached('harbour-tug');
    expect(cue.cue('town-clock')).toBe('behind');
    cue.arrive(halifaxLevel.spawn.x);
    expect(cue.cue('town-clock')).toBeNull();
    cue.arrive(null);
    expect(cue.cue('town-clock')).toBeNull();
  });
});
