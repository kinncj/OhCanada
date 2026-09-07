import type { LocalizerPort } from '@application/engine-ports';
import type { DialogueLine } from '@domain/quest';
import { button, clear, el, focusTrap } from './dom';

export interface DialogueOptions {
  readonly speakerNames: Readonly<Record<string, string>>;
  readonly lines: readonly DialogueLine[];
  readonly acceptLabel?: string; // shows an "Accept quest" button on the last line
  onAccept?(): void;
  onClose(): void;
}

export class DialogueBox {
  readonly root = el('div', { class: 'dialogue', role: 'dialog', aria: { live: 'polite' }, dataset: { screen: 'dialogue' } });
  private index = 0;
  private untrap: (() => void) | null = null;

  constructor(private readonly t: LocalizerPort) {}

  open(opts: DialogueOptions): HTMLElement {
    this.index = 0;
    this.render(opts);
    return this.root;
  }

  private render(opts: DialogueOptions): void {
    clear(this.root);
    const line = opts.lines[this.index];
    if (!line) return;
    const speaker = line.speaker === 'player' ? this.t.t('dialogue.you') : line.speaker === 'narrator' ? this.t.t('dialogue.narrator') : (opts.speakerNames[line.speaker] ?? line.speaker);
    this.root.append(el('div', { class: 'speaker' }, speaker), el('div', { class: 'line', dataset: { testid: 'dialogue-line' } }, this.t.pick(line.text)));
    const row = el('div', { class: 'row end' });
    const last = this.index >= opts.lines.length - 1;
    if (!last) {
      row.append(button(this.t.t('dialogue.next'), () => {
        this.index++;
        this.render(opts);
      }, 'btn', 'dialogue-next'));
    } else {
      if (opts.acceptLabel && opts.onAccept) row.append(button(opts.acceptLabel, () => opts.onAccept?.(), 'btn', 'dialogue-accept'));
      row.append(button(this.t.t('dialogue.close'), () => opts.onClose(), opts.acceptLabel ? 'btn secondary' : 'btn', 'dialogue-close'));
    }
    this.root.append(row);
    this.untrap?.();
    this.untrap = focusTrap(this.root);
  }

  close(): void {
    this.untrap?.();
    this.root.remove();
  }
}
