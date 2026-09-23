/**
 * One engagement of a landmark finishes every arrival step in a row that names
 * it (ADR-0067).
 *
 * Before this rule an engagement finished exactly one step, so a `read` step
 * written straight after a `visit` to the same landmark was left current while
 * the player stood in front of it, and the one-sitting walk reported the quest
 * stuck. That is why Dow's Lake had to be drawn for the first `read` step.
 */

import { describe, expect, it } from 'vitest';

import { isArrivalStep, stepsFinishedOnArrival } from '../../../app/bootstrap/arrival';

const visit = (targetId: string) => ({ kind: 'visit', targetId });
const read = (targetId: string) => ({ kind: 'read', targetId });
const collect = (targetId: string) => ({ kind: 'collect', targetId });
const answer = (targetId: string) => ({ kind: 'answer', targetId });
const talk = (targetId: string) => ({ kind: 'talk', targetId });

describe('isArrivalStep', () => {
  it('is visit, collect and read, and never talk or answer', () => {
    expect(isArrivalStep(visit('a'))).toBe(true);
    expect(isArrivalStep(collect('a'))).toBe(true);
    expect(isArrivalStep(read('a'))).toBe(true);
    expect(isArrivalStep(talk('a'))).toBe(false);
    expect(isArrivalStep(answer('a'))).toBe(false);
  });
});

describe('stepsFinishedOnArrival', () => {
  it('finishes a visit and the read after it at the same landmark', () => {
    const steps = [talk('guide'), visit('locks'), read('locks'), answer('government')];
    expect(stepsFinishedOnArrival(steps, 1, 'locks')).toBe(2);
  });

  it('finishes a read and the visit after it, in the order they are written', () => {
    expect(stepsFinishedOnArrival([read('locks'), visit('locks'), answer('x')], 0, 'locks')).toBe(2);
  });

  it('stops at an answer step, so the question is still asked before the next one', () => {
    const steps = [visit('locks'), answer('government'), read('locks')];
    expect(stepsFinishedOnArrival(steps, 0, 'locks')).toBe(1);
  });

  it('stops at a step that names somewhere else: steps are never skipped', () => {
    expect(stepsFinishedOnArrival([visit('locks'), read('lake'), read('locks')], 0, 'locks')).toBe(1);
  });

  it('never finishes a talk step, which only accepting an offer completes', () => {
    expect(stepsFinishedOnArrival([talk('locks'), visit('locks')], 0, 'locks')).toBe(0);
    expect(stepsFinishedOnArrival([visit('locks'), talk('locks')], 0, 'locks')).toBe(1);
  });

  it('is nothing when the current step is not this landmark’s', () => {
    expect(stepsFinishedOnArrival([visit('lake'), read('locks')], 0, 'locks')).toBe(0);
  });

  it('runs to the end of the quest', () => {
    expect(stepsFinishedOnArrival([answer('x'), visit('lake'), read('lake')], 1, 'lake')).toBe(2);
  });

  it('compares ids the way the prompt spells them, with or without a prefix', () => {
    expect(stepsFinishedOnArrival([visit('locks'), read('poi.locks')], 0, 'poi.locks')).toBe(2);
  });

  it('is nothing for an index that is not a step', () => {
    const steps = [visit('locks')];
    expect(stepsFinishedOnArrival(steps, -1, 'locks')).toBe(0);
    expect(stepsFinishedOnArrival(steps, 1, 'locks')).toBe(0);
    expect(stepsFinishedOnArrival(steps, 0.5, 'locks')).toBe(0);
  });
});
