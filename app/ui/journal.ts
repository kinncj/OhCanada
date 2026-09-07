import type { LocalizerPort } from '@application/engine-ports';
import type { Progress } from '@domain/progress';
import type { LocalizedText } from '@domain/ids';
import { button, clear, el, focusTrap } from './dom';

export interface JournalData {
  readonly progress: Progress;
  readonly quests: readonly { id: string; title: LocalizedText; objective: LocalizedText | null; status: 'active' | 'completed' | 'failed' }[];
  readonly districts: readonly { id: string; name: LocalizedText; unlocked: boolean; stamps: number }[];
  readonly examUnlocked: boolean;
  readonly stampsForExam: number;
  readonly pois: readonly { id: string; name: LocalizedText }[];
}

export interface JournalHandlers {
  onClose(): void;
  onExam(practice: boolean): void;
  onFastTravel(poiId: string): void;
}

export class Journal {
  readonly root = el('div', { class: 'screen', style: 'background: rgba(11,16,32,0.6)', dataset: { screen: 'journal' } });
  private untrap: (() => void) | null = null;

  constructor(private readonly t: LocalizerPort) {}

  show(data: JournalData, h: JournalHandlers): HTMLElement {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel journal', role: 'dialog', aria: { labelledby: 'journal-title' } });
    panel.append(el('h2', { id: 'journal-title' }, t.t('journal.title')));
    const cols = el('div', { class: 'cols' });
    const left = el('div', {});
    left.append(el('h3', {}, t.t('journal.active')));
    const active = data.quests.filter((q) => q.status !== 'completed');
    if (active.length === 0) left.append(el('p', { class: 'source' }, t.t('journal.none')));
    else left.append(el('ul', {}, ...active.map((q) => el('li', {}, el('strong', {}, t.pick(q.title)), q.objective ? el('div', { class: 'source' }, t.pick(q.objective)) : null, q.status === 'failed' ? el('span', { class: 'badge' }, t.t('quest.failed')) : null))));
    left.append(el('h3', {}, t.t('journal.completed')));
    const done = data.quests.filter((q) => q.status === 'completed');
    left.append(el('ul', {}, ...done.map((q) => el('li', {}, t.pick(q.title)))));
    const pct = data.progress.answered.length ? Math.round((data.progress.answered.filter((a) => a.correct).length / data.progress.answered.length) * 100) : 0;
    left.append(el('p', { class: 'source' }, t.t('journal.accuracy', { percent: pct })));
    const right = el('div', {});
    right.append(el('h3', {}, t.t('journal.districts')));
    right.append(el('ul', {}, ...data.districts.map((d) => el('li', { class: d.unlocked ? '' : 'locked' }, t.pick(d.name), el('span', { class: 'badge' }, d.unlocked ? `${d.stamps} 🍁` : t.t('journal.locked'))))));
    if (data.pois.length) {
      right.append(el('h3', {}, t.t('journal.fastTravel')));
      const list = el('div', { class: 'chips' });
      for (const p of data.pois) list.append(button(t.pick(p.name), () => h.onFastTravel(p.id), 'chip', `travel-${p.id}`));
      right.append(list);
    }
    right.append(el('h3', {}, t.t('journal.exam')));
    right.append(el('p', { class: 'source' }, data.examUnlocked ? t.t('journal.examOpen') : t.t('journal.examLocked', { needed: data.stampsForExam, have: data.progress.stamps.length })));
    const examRow = el('div', { class: 'stack' });
    if (data.examUnlocked) examRow.append(button(t.t('exam.title'), () => h.onExam(false), 'btn', 'journal-exam'));
    examRow.append(button(t.t('journal.practiceExam'), () => h.onExam(true), 'btn secondary', 'journal-practice'));
    right.append(examRow);
    cols.append(left, right);
    panel.append(cols, el('div', { class: 'row end', style: 'margin-top:1rem' }, button(t.t('dialogue.close'), h.onClose, 'btn', 'journal-close')));
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
