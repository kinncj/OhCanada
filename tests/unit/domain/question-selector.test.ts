import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@common/rng';
import { recordOutcome, recordSeen, selectQuestions, type SelectionHistory } from '@domain/question-selector';
import { questionId } from '@domain/ids';
import { q } from '../../fixtures/content';

const pool = Array.from({ length: 30 }, (_, i) => q(`q-hi-${String(i + 1).padStart(3, '0')}`, 'history'));

describe('QuestionSelector', () => {
  it('50 consecutive draws from a 30-question pool never repeat inside the exclusion window', () => {
    const rng = new SeededRandom(11);
    let history: SelectionHistory = { seenQuestionIds: [], wrongQuestionIds: [] };
    const cfg = { exclusionWindow: 20, wrongWeight: 3 };
    const draws: string[] = [];
    for (let i = 0; i < 50; i++) {
      const [picked] = selectQuestions(pool, 'history', history, 1, rng, cfg);
      expect(picked).toBeDefined();
      const recent = draws.slice(-cfg.exclusionWindow);
      expect(recent).not.toContain(picked!.id);
      draws.push(picked!.id);
      history = recordSeen(history, [picked!.id], cfg);
    }
    expect(new Set(draws).size).toBeGreaterThanOrEqual(21);
  });

  it('weights previously-wrong questions higher', () => {
    const rng = new SeededRandom(3);
    let hits = 0;
    const history: SelectionHistory = { seenQuestionIds: [], wrongQuestionIds: [questionId('q-hi-005')] };
    for (let i = 0; i < 300; i++) {
      const [p] = selectQuestions(pool, 'history', history, 1, rng, { exclusionWindow: 0, wrongWeight: 10 });
      if (p?.id === 'q-hi-005') hits++;
    }
    expect(hits).toBeGreaterThan(40); // uniform would be ~10
  });

  it('relaxes the window when the pool is too small and filters by subject', () => {
    const rng = new SeededRandom(1);
    const small = pool.slice(0, 3);
    const history: SelectionHistory = { seenQuestionIds: small.map((x) => x.id), wrongQuestionIds: [] };
    expect(selectQuestions(small, 'history', history, 3, rng)).toHaveLength(3);
    expect(selectQuestions(pool, 'symbols', history, 3, rng)).toHaveLength(0);
    expect(selectQuestions(pool, null, history, 5, rng)).toHaveLength(5);
  });

  it('records outcomes and bounds history', () => {
    let h: SelectionHistory = { seenQuestionIds: [], wrongQuestionIds: [] };
    h = recordOutcome(h, questionId('q-hi-001'), false);
    expect(h.wrongQuestionIds).toEqual(['q-hi-001']);
    h = recordOutcome(h, questionId('q-hi-001'), true);
    expect(h.wrongQuestionIds).toEqual([]);
    h = recordSeen(h, Array.from({ length: 500 }, (_, i) => questionId(`q-hi-${i}`)), { exclusionWindow: 20, wrongWeight: 1 });
    expect(h.seenQuestionIds.length).toBe(200);
  });
});
