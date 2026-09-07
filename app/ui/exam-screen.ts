import type { LocalizerPort } from '@application/engine-ports';
import type { ExamGrade, ExamState } from '@domain/exam';
import type { QuestionId } from '@domain/ids';
import { button, clear, el, focusTrap, formatTime } from './dom';

export interface ExamHandlers {
  onBegin(): Promise<ExamState | null>;
  onAnswer(questionId: QuestionId, key: string): ExamState;
  onFinish(): ExamGrade | null;
  remaining(): number;
  onExit(): void;
  readonly passMark: number;
}

export class ExamScreen {
  readonly root = el('div', { class: 'screen', dataset: { screen: 'exam' } });
  private untrap: (() => void) | null = null;
  private timer: number | null = null;
  private state: ExamState | null = null;
  private current = 0;

  constructor(private readonly t: LocalizerPort) {}

  showIntro(h: ExamHandlers): HTMLElement {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel exam', role: 'dialog' });
    panel.append(el('h2', {}, t.t('exam.title')), el('p', { class: 'lead' }, t.t('exam.intro')));
    panel.append(el('div', { class: 'row end' }, button(t.t('exam.backToHub'), h.onExit, 'btn secondary', 'exam-exit'), button(t.t('exam.begin'), async () => {
      const s = await h.onBegin();
      if (s) {
        this.state = s;
        this.current = 0;
        this.renderQuestion(h);
        this.startTimer(h);
      }
    }, 'btn', 'exam-begin')));
    this.root.append(panel);
    this.retrap(panel);
    return this.root;
  }

  private startTimer(h: ExamHandlers): void {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      const left = h.remaining();
      const el_ = this.root.querySelector<HTMLElement>('.timer');
      if (el_) {
        el_.textContent = this.t.t('exam.timeLeft', { time: formatTime(left) });
        el_.classList.toggle('low', left < 120);
      }
      if (left <= 0) {
        this.stopTimer();
        const grade = h.onFinish();
        if (grade) this.renderResult(grade, h, true);
      }
    }, 500);
  }

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private renderQuestion(h: ExamHandlers): void {
    if (!this.state) return;
    clear(this.root);
    const t = this.t;
    const s = this.state;
    const pq = s.questions[this.current];
    if (!pq) return;
    const panel = el('div', { class: 'panel exam question', role: 'dialog' });
    const timerEl = el('div', { class: 'timer', role: 'timer' }, t.t('exam.timeLeft', { time: formatTime(h.remaining()) }));
    panel.append(el('div', { class: 'row', style: 'justify-content:space-between' }, el('h2', {}, t.t('question.title', { index: this.current + 1, total: s.questions.length })), timerEl));
    const nav = el('div', { class: 'nav' });
    s.questions.forEach((q, i) => {
      const b = el('button', { type: 'button', class: `${s.answers[q.question.id] ? 'answered' : ''} ${i === this.current ? 'current' : ''}` }, String(i + 1));
      b.addEventListener('click', () => {
        this.current = i;
        this.renderQuestion(h);
      });
      nav.append(b);
    });
    panel.append(nav, el('p', { class: 'lead', dataset: { testid: 'exam-question' } }, t.pick(pq.question.text)));
    const choices = el('div', { class: 'choices', role: 'radiogroup' });
    for (const c of pq.choices) {
      const b = el('button', { type: 'button', class: 'choice' }, el('kbd', {}, c.key.toUpperCase()), el('span', {}, t.pick(c.text)));
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s.answers[pq.question.id] === c.key));
      b.dataset.testid = `exam-choice-${c.key}`;
      b.addEventListener('click', () => {
        this.state = h.onAnswer(pq.question.id, c.key);
        this.renderQuestion(h);
      });
      choices.append(b);
    }
    panel.append(choices);
    const row = el('div', { class: 'row end' });
    row.append(button(t.t('exam.previous'), () => {
      this.current = Math.max(0, this.current - 1);
      this.renderQuestion(h);
    }, 'btn ghost'));
    if (this.current < s.questions.length - 1) {
      row.append(button(t.t('exam.next'), () => {
        this.current++;
        this.renderQuestion(h);
      }, 'btn secondary', 'exam-next'));
    }
    row.append(button(t.t('exam.submit'), () => {
      this.stopTimer();
      const grade = h.onFinish();
      if (grade) this.renderResult(grade, h, false);
    }, 'btn', 'exam-submit'));
    panel.append(row);
    this.root.append(panel);
    this.retrap(panel);
  }

  private renderResult(grade: ExamGrade, h: ExamHandlers, timeUp: boolean): void {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel exam', role: 'dialog' });
    panel.append(el('h2', {}, t.t('exam.title')));
    const res = el('div', { class: 'result' });
    res.append(el('div', { class: 'score', dataset: { testid: 'exam-score' } }, `${grade.correct}/${grade.total}`));
    if (timeUp) res.append(el('p', { class: 'error' }, t.t('exam.timeUp')));
    res.append(el('p', { class: grade.passed ? 'feedback ok' : 'feedback bad' }, grade.passed ? t.t('exam.passed', { correct: grade.correct, total: grade.total }) : t.t('exam.failed', { correct: grade.correct, total: grade.total, pass: h.passMark })));
    panel.append(res);
    if (this.state) {
      const review = el('details', {}, el('summary', {}, t.t('exam.review')));
      const list = el('ol', {});
      for (const pq of this.state.questions) {
        const per = grade.perQuestion.find((p) => p.questionId === pq.question.id);
        const correctChoice = pq.choices.find((c) => c.correct);
        list.append(el('li', { class: per?.correct ? 'feedback ok' : 'feedback bad' }, t.pick(pq.question.text), el('div', { class: 'source' }, correctChoice ? t.pick(correctChoice.text) : '')));
      }
      review.append(list);
      panel.append(review);
    }
    panel.append(el('div', { class: 'row end' }, button(t.t('exam.backToHub'), h.onExit, 'btn', 'exam-exit')));
    this.root.append(panel);
    this.retrap(panel);
  }

  private retrap(panel: HTMLElement): void {
    this.untrap?.();
    this.untrap = focusTrap(panel);
  }

  close(): void {
    this.stopTimer();
    this.untrap?.();
    this.root.remove();
  }
}
