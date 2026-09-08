import { el } from './dom';

export class LoadingScreen {
  readonly root = el('div', { class: 'loading', role: 'status', aria: { live: 'polite' }, dataset: { screen: 'loading' } });
  private readonly label = el('div', { style: 'font-weight:700' });
  private readonly bar = el('div', {});
  private lastStage = '';
  private lastProgressAt = Date.now();
  private readonly lines: string[] = [];
  private readonly trace = el('pre', { class: 'source', style: 'margin:0.8rem 1rem 0;font-size:0.62rem;line-height:1.35;white-space:pre-wrap;text-align:left;color:#93a2b5;max-height:34vh;overflow:hidden' });
  private readonly stage = el('div', { class: 'source', style: 'margin-top:0.6rem;color:#cbd5e1;min-height:1.2em' });

  constructor() {
    this.root.append(el('div', { class: 'title', style: 'font-size:2.4rem' }, 'True', el('span', { class: 'leaf' }, 'North')), this.label, el('div', { class: 'bar' }, this.bar), this.stage, this.trace);
  }

  set(text: string, fraction: number, stage?: string): void {
    this.label.textContent = text;
    if (stage !== undefined && stage !== this.lastStage) {
      this.lastStage = stage;
      this.note(`stage: ${stage}`);
    }
    this.stage.textContent = stage ?? '';
    this.lastProgressAt = Date.now();
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  /** Append a diagnostic line; shown on screen once a load looks stuck, so a screenshot carries the trace. */
  note(line: string): void {
    this.lines.push(line.length > 120 ? `${line.slice(0, 120)}…` : line);
    if (this.lines.length > 12) this.lines.shift();
    if (this.stalled) this.trace.textContent = this.lines.join('\n');
  }

  get stalled(): boolean {
    return Date.now() - this.lastProgressAt > 12_000;
  }

  /** Called on a timer by the composition root: reveals the trace and an escape hatch when a load hangs. */
  tick(onSafeMode: () => void): void {
    if (!this.stalled || this.escape.isConnected) return;
    this.trace.textContent = this.lines.join('\n');
    this.escape.textContent = 'Skip details and play';
    this.escape.addEventListener('click', onSafeMode);
    this.root.append(this.escape);
  }

  private readonly escape = el('button', { class: 'btn', type: 'button', style: 'margin-top:1rem' });

  hide(): void {
    this.root.remove();
  }
}
