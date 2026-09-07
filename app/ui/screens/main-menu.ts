import type { LocalizerPort } from '@application/engine-ports';
import type { Locale } from '@domain/ids';
import { button, clear, el, focusTrap } from '../dom';

export interface MainMenuHandlers {
  onNew(): void;
  onContinue(): void;
  onSettings(): void;
  onImport(json: string): void;
  onExport(): string;
  onReset(): void;
  onLocale(locale: Locale): void;
}

export class MainMenu {
  readonly root = el('div', { class: 'screen', dataset: { screen: 'main-menu' } });
  private untrap: (() => void) | null = null;

  constructor(
    private readonly t: LocalizerPort,
    private readonly handlers: MainMenuHandlers,
  ) {}

  render(hasSave: boolean, version: string): HTMLElement {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel menu-panel', role: 'dialog', aria: { labelledby: 'menu-title' } });
    panel.append(
      el('h1', { class: 'title', id: 'menu-title' }, 'True', el('span', { class: 'leaf' }, 'North')),
      el('p', { class: 'tagline' }, t.t('app.tagline')),
    );
    const stack = el('div', { class: 'stack' });
    if (hasSave) stack.append(button(t.t('menu.continue'), this.handlers.onContinue, 'btn', 'menu-continue'));
    stack.append(button(t.t('menu.newGame'), this.handlers.onNew, hasSave ? 'btn secondary' : 'btn', 'menu-new'));
    stack.append(button(t.t('menu.settings'), this.handlers.onSettings, 'btn secondary', 'menu-settings'));
    const row = el('div', { class: 'row', style: 'justify-content:center; margin-top:0.6rem' });
    const file = el('input', { type: 'file', accept: 'application/json', class: 'sr-only', id: 'import-save' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (f) this.handlers.onImport(await f.text());
      file.value = '';
    });
    row.append(
      button(t.t('menu.importSave'), () => file.click(), 'btn ghost', 'menu-import'),
      file,
      button(t.t('menu.exportSave'), () => download(this.handlers.onExport(), 'truenorth-save.json'), 'btn ghost', 'menu-export'),
    );
    if (hasSave) {
      row.append(
        button(t.t('menu.resetSave'), () => {
          if (window.confirm(t.t('menu.resetConfirm'))) this.handlers.onReset();
        }, 'btn ghost', 'menu-reset'),
      );
    }
    const lang = el('div', { class: 'row', style: 'justify-content:center; margin-top:0.8rem' });
    for (const l of ['en', 'fr'] as const) {
      const b = button(l.toUpperCase(), () => this.handlers.onLocale(l), 'chip', `lang-${l}`);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(t.locale === l));
      lang.append(b);
    }
    panel.append(stack, row, lang, el('p', { class: 'source', style: 'margin-top:1rem' }, t.t('app.version', { version })));
    this.root.append(panel);
    this.untrap?.();
    this.untrap = focusTrap(panel);
    return this.root;
  }

  destroy(): void {
    this.untrap?.();
    this.root.remove();
  }
}

function download(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
