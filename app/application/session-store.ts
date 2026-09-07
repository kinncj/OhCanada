import type { Progress } from '@domain/progress';
import type { ExamState } from '@domain/exam';
import type { PresentedQuestion } from '@domain/question';

/**
 * In-memory authoritative game state. Use cases read/write here; SaveProgress persists it.
 * Kept deliberately dumb so it can be replaced by a fixture in tests.
 */
export class SessionStore {
  private progressState: Progress | null = null;
  exam: ExamState | null = null;
  /** Questions currently presented for an active quest step, keyed by question id. */
  readonly presented = new Map<string, PresentedQuestion>();

  get progress(): Progress {
    if (!this.progressState) throw new Error('Session not initialised');
    return this.progressState;
  }

  get hasProgress(): boolean {
    return this.progressState !== null;
  }

  set(progress: Progress): void {
    this.progressState = progress;
  }

  update(f: (p: Progress) => Progress): Progress {
    const next = f(this.progress);
    this.progressState = next;
    return next;
  }

  reset(): void {
    this.progressState = null;
    this.exam = null;
    this.presented.clear();
  }
}
