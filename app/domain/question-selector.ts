import type { RandomSource } from '@common/rng';
import type { Question } from './question';
import type { QuestionId, Subject } from './ids';

export interface SelectionHistory {
  /** Most recent first is not required; order is only used for the exclusion window when ids repeat. */
  readonly seenQuestionIds: readonly QuestionId[];
  readonly wrongQuestionIds: readonly QuestionId[];
}

export interface SelectorConfig {
  /** Questions answered within the last N draws are excluded when enough alternatives exist. */
  readonly exclusionWindow: number;
  /** Multiplicative weight for questions the player previously got wrong. */
  readonly wrongWeight: number;
}

export const DEFAULT_SELECTOR: SelectorConfig = { exclusionWindow: 20, wrongWeight: 3 };

/**
 * Picks `count` questions of a subject: never one seen in the last `exclusionWindow` draws (as long as the
 * pool allows), weighted toward previously-wrong answers. Deterministic given the injected RandomSource.
 */
export function selectQuestions(pool: readonly Question[], subject: Subject | null, history: SelectionHistory, count: number, rng: RandomSource, cfg: SelectorConfig = DEFAULT_SELECTOR): Question[] {
  const candidates = pool.filter((q) => subject === null || q.subject === subject);
  const recent = new Set(history.seenQuestionIds.slice(-cfg.exclusionWindow));
  const wrong = new Set(history.wrongQuestionIds);
  let eligible = candidates.filter((q) => !recent.has(q.id));
  if (eligible.length < count) {
    // Pool too small for the window: relax by re-admitting the least recently seen first.
    const order = new Map<string, number>();
    history.seenQuestionIds.forEach((id, i) => order.set(id, i));
    const readmit = candidates.filter((q) => recent.has(q.id)).sort((a, b) => (order.get(a.id) ?? -1) - (order.get(b.id) ?? -1));
    eligible = [...eligible, ...readmit.slice(0, count - eligible.length)];
  }
  const picked: Question[] = [];
  const remaining = [...eligible];
  while (picked.length < count && remaining.length > 0) {
    const weights = remaining.map((q) => (wrong.has(q.id) ? cfg.wrongWeight : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      r -= weights[idx] ?? 0;
      if (r < 0) break;
    }
    picked.push(remaining[idx] as Question);
    remaining.splice(idx, 1);
  }
  return picked;
}

/** Append a draw to the history (kept bounded to 10× the window to keep saves small). */
export function recordSeen(history: SelectionHistory, ids: readonly QuestionId[], cfg: SelectorConfig = DEFAULT_SELECTOR): SelectionHistory {
  const seen = [...history.seenQuestionIds, ...ids].slice(-cfg.exclusionWindow * 10);
  return { seenQuestionIds: seen, wrongQuestionIds: history.wrongQuestionIds };
}

export function recordOutcome(history: SelectionHistory, id: QuestionId, correct: boolean): SelectionHistory {
  const wrong = new Set(history.wrongQuestionIds);
  if (correct) wrong.delete(id);
  else wrong.add(id);
  return { seenQuestionIds: history.seenQuestionIds, wrongQuestionIds: [...wrong] };
}
