import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import type { RandomSource } from '@common/rng';
import { answerExam, gradeExam, isExpired, startExam, type ExamGrade, type ExamState, remainingSeconds } from '@domain/exam';
import { isExamUnlocked } from '@domain/district';
import type { QuestionId } from '@domain/ids';
import { recordExam } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock, ContentError, ContentRepository } from '../ports';
import type { SessionStore } from '../session-store';

export type ExamError = ContentError | { readonly code: 'locked' | 'not-started' | 'already-started'; readonly message: string };

/** Citizenship Ceremony: 20 questions, pass at 15, 30 minutes — mirrors the real test format. */
export class CitizenshipExam {
  constructor(
    private readonly store: SessionStore,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly rng: RandomSource,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  isUnlocked(): boolean {
    return isExamUnlocked(this.content.getConfig().unlockRules, this.store.progress.stamps.length);
  }

  async start(opts: { force?: boolean } = {}): Promise<Result<ExamState, ExamError>> {
    if (!opts.force && !this.isUnlocked()) return err({ code: 'locked', message: 'Earn more Passport Stamps to unlock the ceremony' });
    if (this.store.exam && this.store.exam.submittedAt === null) return err({ code: 'already-started', message: 'Exam in progress' });
    const pool = await this.content.getAllQuestions();
    if (!pool.ok) return err(pool.error);
    const params = this.content.getConfig().exam;
    let state: ExamState;
    try {
      state = startExam(pool.value, params, this.rng, this.clock.now());
    } catch (e) {
      return err({ code: 'invalid', message: (e as Error).message });
    }
    this.store.exam = state;
    this.events.emit('exam:started', { total: state.questions.length, timeLimitSeconds: params.timeLimitSeconds });
    return ok(state);
  }

  answer(questionId: QuestionId, key: string): Result<ExamState, ExamError> {
    const exam = this.store.exam;
    if (!exam) return err({ code: 'not-started', message: 'No exam in progress' });
    const next = answerExam(exam, questionId, key);
    this.store.exam = next;
    return ok(next);
  }

  remaining(): number {
    return this.store.exam ? remainingSeconds(this.store.exam, this.clock.now()) : 0;
  }

  expired(): boolean {
    return this.store.exam ? isExpired(this.store.exam, this.clock.now()) : false;
  }

  finish(): Result<ExamGrade, ExamError> {
    const exam = this.store.exam;
    if (!exam) return err({ code: 'not-started', message: 'No exam in progress' });
    const now = this.clock.now();
    const grade = gradeExam(exam, now);
    this.store.exam = { ...exam, submittedAt: now };
    this.store.update((p) =>
      recordExam(p, { at: this.clock.nowIso(), correct: grade.correct, total: grade.total, passed: grade.passed, durationSeconds: grade.durationSeconds }),
    );
    this.events.emit('exam:finished', { grade });
    return ok(grade);
  }
}
