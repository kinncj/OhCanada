/**
 * What a level asks at a landmark, and how the card counts it (ADR-0036).
 *
 * Each case below is one line of the play-through that found the defect:
 * questions drawn from the whole bank, a card counting "1 of 1" under a task of
 * two, and a landmark that told one thing and asked about another.
 */

import { describe, expect, it } from 'vitest';

import {
  counterForDrawn,
  landmarkDraw,
  rememberAnswered,
  teachingQuotes,
} from '../../../app/bootstrap/landmark-questions';

import { questionId, subjectId } from '../support/fixtures';

const RIGHTS = subjectId('rights');

describe('a landmark with no task step being played', () => {
  it('asks one question, from the level’s own subject', () => {
    const draw = landmarkDraw({ levelSubject: RIGHTS, answering: undefined, teaches: [] });
    expect(draw.count).toBe(1);
    expect(draw.scope.subject).toBe('rights');
  });

  it('draws no counter, because "Question 1 of 1" counts nothing', () => {
    expect(landmarkDraw({ levelSubject: RIGHTS, answering: undefined, teaches: [] }).counter).toBeNull();
  });

  it('asks first what the landmark just told', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: undefined,
      teaches: ['Taking responsibility for oneself and one’s family.'],
    });
    expect(draw.scope.teaches).toEqual(['Taking responsibility for oneself and one’s family.']);
  });
});

describe('a landmark while an answer step is being played', () => {
  const step = { subject: RIGHTS };

  it('asks every question the step has left, and counts the step', () => {
    /* Halifax: "Answer 2 questions about voting", nothing answered yet. */
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step, done: 0, required: 2 },
      teaches: [],
    });
    expect(draw.count).toBe(2);
    expect(draw.counter).toEqual({ answered: 0, total: 2 });
  });

  it('asks only what is left of a step already started', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step, done: 1, required: 2 },
      teaches: [],
    });
    expect(draw.count).toBe(1);
    /* So the one question on screen reads "Question 2 of 2". */
    expect(draw.counter).toEqual({ answered: 1, total: 2 });
  });

  it('narrows to the step’s pool when it names one', () => {
    const pool = [questionId('rights-28'), questionId('rights-29')];
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step: { subject: RIGHTS, questionPool: pool }, done: 0, required: 2 },
      teaches: [],
    });
    expect(draw.scope.pool).toEqual(pool);
  });

  it('draws from no pool when the step names none, which is the whole subject', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step, done: 0, required: 2 },
      teaches: [],
    });
    expect('pool' in draw.scope).toBe(false);
  });

  it('keeps the level’s subject even when a step names another', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step: { subject: subjectId('justice') }, done: 0, required: 2 },
      teaches: [],
    });
    expect(draw.scope.subject).toBe('rights');
  });

  it('falls back to the step’s subject only when the level says none', () => {
    const draw = landmarkDraw({
      levelSubject: undefined,
      answering: { step: { subject: subjectId('justice') }, done: 0, required: 2 },
      teaches: [],
    });
    expect(draw.scope.subject).toBe('justice');
  });

  it('is not paced by the day’s new-question budget, because the tracker promised the count', () => {
    /* ADR-0053: the Peggy's Cove blocker. A task step's count is a promise made
       on screen before a question is asked, so the budget may not shorten it. */
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step, done: 0, required: 3 },
      teaches: [],
    });
    expect(draw.scope.dailyNewLimitApplies).toBe(false);
  });

  it('leaves a stop with no task paced like every other drill', () => {
    const draw = landmarkDraw({ levelSubject: RIGHTS, answering: undefined, teaches: [] });
    expect(draw.scope.dailyNewLimitApplies).toBeUndefined();
  });

  it('never asks zero questions, whatever the save says was answered', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step, done: 5, required: 2 },
      teaches: [],
    });
    expect(draw.count).toBe(1);
    expect(draw.counter).toEqual({ answered: 1, total: 2 });
  });
});

describe('the counter for what the bank handed back', () => {
  const step = { subject: RIGHTS };

  it('keeps the step’s count when the draw is full', () => {
    const draw = landmarkDraw({ levelSubject: RIGHTS, answering: { step, done: 1, required: 3 }, teaches: [] });
    expect(counterForDrawn(draw, 2)).toEqual({ answered: 1, total: 3 });
  });

  it('counts only to what was drawn when the bank is short, so no question is promised', () => {
    const draw = landmarkDraw({ levelSubject: RIGHTS, answering: { step, done: 0, required: 3 }, teaches: [] });
    expect(counterForDrawn(draw, 2)).toEqual({ answered: 0, total: 2 });
  });

  it('draws no counter where there was none to begin with', () => {
    const draw = landmarkDraw({ levelSubject: RIGHTS, answering: undefined, teaches: [] });
    expect(counterForDrawn(draw, 1)).toBeNull();
  });
});

describe('what a landmark told', () => {
  const pois = [
    { id: 'market-stall', fact: { source: { quote: 'Getting a job, taking care of one’s family.' } } },
    { id: 'scenery', fact: { source: null } },
    { id: 'fixture' },
  ];

  it('is the sentence its teaching claim rests on', () => {
    expect(teachingQuotes(pois, 'market-stall')).toEqual(['Getting a job, taking care of one’s family.']);
  });

  it('is nothing for a landmark with no source, no claim, or no card', () => {
    expect(teachingQuotes(pois, 'scenery')).toEqual([]);
    expect(teachingQuotes(pois, 'fixture')).toEqual([]);
    expect(teachingQuotes(pois, 'not-placed')).toEqual([]);
    expect(teachingQuotes(undefined, 'market-stall')).toEqual([]);
  });
});

describe('a stop with no task step asks only what it told (ADR-0048)', () => {
  /*
   * The second live-site audit, on the Prairies with the task declined: the grain
   * bins asked about Québec's referendums and the container car about Bombardier,
   * because a landmark with no step drew from the whole subject and only
   * preferred what it had told.
   */
  const MODERN = subjectId('modern-canada');
  const told = ['is the country’s largest producer of grains and oilseeds'];

  it('draws from nothing but the sentence the landmark just told', () => {
    const draw = landmarkDraw({ levelSubject: MODERN, answering: undefined, teaches: told });
    expect(draw.scope.onlyWhatItTells).toBe(true);
    expect(draw.scope.teaches).toEqual(told);
    expect(draw.scope.subject).toBe('modern-canada');
    expect(draw.count).toBe(1);
  });

  it('never asks a stop with no step to come round again', () => {
    const draw = landmarkDraw({ levelSubject: MODERN, answering: undefined, teaches: told });
    expect(draw.scope.repeatWhenExhausted).not.toBe(true);
  });

  it('leaves an answer step to fill its count from its pool, as ADR-0036 says', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step: { subject: RIGHTS }, done: 0, required: 2 },
      teaches: told,
    });
    expect(draw.scope.onlyWhatItTells).not.toBe(true);
  });
});

describe('nothing is asked twice in one level visit (ADR-0048)', () => {
  const referendums = questionId('mc-16-sovereignty-referendums');
  const bombardier = questionId('mc-35-bombardier-snowmobile');

  it('tells a stop with no step what the visit has already answered', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: undefined,
      teaches: [],
      answeredHere: [bombardier, referendums],
    });
    expect(draw.scope.answeredHere).toEqual([bombardier, referendums]);
  });

  it('tells an answer step too, and lets only a step ask again once its pool is spent', () => {
    const draw = landmarkDraw({
      levelSubject: RIGHTS,
      answering: { step: { subject: RIGHTS }, done: 1, required: 2 },
      teaches: [],
      answeredHere: [referendums],
    });
    expect(draw.scope.answeredHere).toEqual([referendums]);
    expect(draw.scope.repeatWhenExhausted).toBe(true);
  });

  it('carries an empty list for a visit that has answered nothing', () => {
    expect(landmarkDraw({ levelSubject: RIGHTS, answering: undefined, teaches: [] }).scope.answeredHere).toEqual(
      [],
    );
  });

  it('remembers an answer once, most recent first', () => {
    expect(rememberAnswered([], referendums)).toEqual([referendums]);
    expect(rememberAnswered([referendums], bombardier)).toEqual([bombardier, referendums]);
    expect(rememberAnswered([bombardier, referendums], referendums)).toEqual([referendums, bombardier]);
  });
});
