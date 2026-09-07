import { describe, expect, it } from 'vitest';
import { correctKey, isCorrectChoice, isStale, presentQuestion } from '@domain/question';
import { SeededRandom } from '@common/rng';
import { q } from '../../fixtures/content';

describe('question', () => {
  it('presents shuffled choices with exactly one correct', () => {
    const p = presentQuestion(q('q-rr-001', 'rights-responsibilities'), new SeededRandom(3));
    expect(p.choices).toHaveLength(4);
    expect(p.choices.filter((c) => c.correct)).toHaveLength(1);
    expect(new Set(p.choices.map((c) => c.key)).size).toBe(4);
    const ck = correctKey(p);
    expect(isCorrectChoice(p, ck)).toBe(true);
    expect(isCorrectChoice(p, 'zz')).toBe(false);
  });
  it('correctKey throws when no correct choice', () => {
    const p = presentQuestion(q('q-rr-001', 'rights-responsibilities'), new SeededRandom(3));
    const broken = { ...p, choices: p.choices.map((c) => ({ ...c, correct: false })) };
    expect(() => correctKey(broken)).toThrow();
  });
  it('stale detection only for volatile facts', () => {
    const now = new Date('2026-09-07');
    expect(isStale(q('q-a-001', 'history', false, '2020-01-01'), now, 180)).toBe(false);
    expect(isStale(q('q-a-001', 'history', true, '2020-01-01'), now, 180)).toBe(true);
    expect(isStale(q('q-a-001', 'history', true, '2026-08-01'), now, 180)).toBe(false);
    expect(isStale(q('q-a-001', 'history', true, 'garbage'), now, 180)).toBe(true);
  });
});
