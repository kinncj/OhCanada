import type { LocalizerPort } from '@application/engine-ports';
import type { PresentedQuestion } from '@domain/question';
import { button, clear, el, focusTrap } from './dom';

export interface QuestionPanelOptions {
  readonly index: number;
  readonly total: number;
  readonly presented: PresentedQuestion;
  onAnswer(key: string): Promise<{ correct: boolean; correctKey: string }>;
  onContinue(): void;
}

export class QuestionPanel {
  readonly root = el('div', { class: 'screen', style: 'background: rgba(11,16,32,0.55)', dataset: { screen: 'question' } });
  private untrap: (() => void) | null = null;

  constructor(private readonly t: LocalizerPort) {}

  show(opts: QuestionPanelOptions): HTMLElement {
    clear(this.root);
    const t = this.t;
    const q = opts.presented;
    const panel = el('div', { class: 'panel question', role: 'dialog', aria: { labelledby: 'q-title' } });
    panel.append(el('h2', { id: 'q-title' }, t.t('question.title', { index: opts.index, total: opts.total })), el('p', { class: 'lead', dataset: { testid: 'question-text' } }, t.pick(q.question.text)));
    const choices = el('div', { class: 'choices', role: 'radiogroup' });
    let selected: string | null = null;
    const buttons = new Map<string, HTMLButtonElement>();
    for (const c of q.choices) {
      const b = el('button', { type: 'button', class: 'choice' }, el('kbd', {}, c.key.toUpperCase()), el('span', {}, t.pick(c.text)));
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.testid = `choice-${c.key}`;
      b.dataset.correct = String(c.correct);
      b.addEventListener('click', () => {
        selected = c.key;
        for (const [k, bb] of buttons) bb.setAttribute('aria-checked', String(k === c.key));
        submit.disabled = false;
      });
      buttons.set(c.key, b);
      choices.append(b);
    }
    const feedback = el('div', { class: 'feedback', role: 'status' });
    const submit = button(t.t('question.submit'), async () => {
      if (!selected) return;
      submit.disabled = true;
      for (const b of buttons.values()) b.disabled = true;
      const result = await opts.onAnswer(selected);
      buttons.get(result.correctKey)?.classList.add('correct');
      if (!result.correct) buttons.get(selected)?.classList.add('wrong');
      feedback.className = `feedback ${result.correct ? 'ok' : 'bad'}`;
      feedback.dataset.testid = 'feedback';
      feedback.textContent = result.correct ? t.t('question.correct') : t.t('question.incorrect', { answer: t.pick(q.question.answer) });
      if (q.question.explanation) feedback.append(el('div', { class: 'source' }, t.pick(q.question.explanation)));
      row.replaceChildren(button(t.t('question.continue'), opts.onContinue, 'btn', 'question-continue'));
      row.querySelector('button')?.focus();
    }, 'btn', 'question-submit');
    submit.disabled = true;
    const row = el('div', { class: 'row end' }, submit);
    panel.append(choices, feedback, el('p', { class: 'source' }, t.t('question.source', { source: q.question.source })), row);
    // keyboard shortcuts a-d
    panel.addEventListener('keydown', (e) => {
      const b = buttons.get(e.key.toLowerCase());
      if (b && !b.disabled) b.click();
    });
    this.root.append(panel);
    this.untrap?.();
    this.untrap = focusTrap(panel);
    return this.root;
  }

  close(): void {
    this.untrap?.();
    this.root.remove();
  }
}
