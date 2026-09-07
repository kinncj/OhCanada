import { el } from './dom';

export class LoadingScreen {
  readonly root = el('div', { class: 'loading', role: 'status', aria: { live: 'polite' }, dataset: { screen: 'loading' } });
  private readonly label = el('div', { style: 'font-weight:700' });
  private readonly bar = el('div', {});

  constructor() {
    this.root.append(el('div', { class: 'title', style: 'font-size:2.4rem' }, 'True', el('span', { class: 'leaf' }, 'North')), this.label, el('div', { class: 'bar' }, this.bar));
  }

  set(text: string, fraction: number): void {
    this.label.textContent = text;
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  hide(): void {
    this.root.remove();
  }
}
