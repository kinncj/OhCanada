import type { LocalizerPort } from '@application/engine-ports';
import { button, clear, el, focusTrap } from './dom';

export interface PauseHandlers {
  onResume(): void;
  onSave(): Promise<boolean>;
  onSettings(): void;
  onMainMenu(): void;
}

export class PauseMenu {
  readonly root = el('div', { class: 'screen', style: 'background: rgba(11,16,32,0.6)', dataset: { screen: 'pause' } });
  private untrap: (() => void) | null = null;

  constructor(private readonly t: LocalizerPort) {}

  show(h: PauseHandlers): HTMLElement {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel menu-panel', role: 'dialog', style: 'width:min(92vw,380px)' });
    const status = el('p', { class: 'source', role: 'status' });
    panel.append(
      el('h2', {}, t.t('pause.title')),
      el('div', { class: 'stack' },
        button(t.t('pause.resume'), h.onResume, 'btn', 'pause-resume'),
        button(t.t('pause.save'), async () => {
          status.textContent = (await h.onSave()) ? t.t('pause.saved') : '…';
        }, 'btn secondary', 'pause-save'),
        button(t.t('menu.settings'), h.onSettings, 'btn secondary', 'pause-settings'),
        button(t.t('pause.mainMenu'), h.onMainMenu, 'btn ghost', 'pause-main'),
      ),
      status,
    );
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
