import type { InputAction, LocalizerPort } from '@application/engine-ports';
import type { Settings } from '@domain/progress';
import { button, clear, el, focusTrap } from './dom';

export interface SettingsHandlers {
  onChange(patch: Partial<Settings>): void;
  onClose(): void;
}

const ACTIONS: InputAction[] = ['forward', 'back', 'left', 'right', 'sprint', 'jump', 'interact', 'journal', 'pause'];

export class SettingsScreen {
  readonly root = el('div', { class: 'screen', style: 'background: rgba(11,16,32,0.7)', dataset: { screen: 'settings' } });
  private untrap: (() => void) | null = null;

  constructor(private readonly t: LocalizerPort) {}

  show(settings: Settings, h: SettingsHandlers): HTMLElement {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel settings', role: 'dialog', aria: { labelledby: 'settings-title' } });
    panel.append(el('h2', { id: 'settings-title' }, t.t('settings.title')));
    const grid = el('div', { class: 'grid' });

    const locale = el('select', {});
    for (const l of ['en', 'fr'] as const) locale.append(el('option', { value: l, selected: settings.locale === l }, l === 'en' ? 'English' : 'Français'));
    locale.addEventListener('change', () => h.onChange({ locale: locale.value as Settings['locale'] }));
    locale.dataset.testid = 'settings-locale';
    grid.append(el('label', { class: 'field' }, t.t('menu.language'), locale));

    const preset = el('select', {});
    for (const p of ['auto', 'low', 'medium', 'high', 'ultra'] as const) preset.append(el('option', { value: p, selected: settings.graphicsPreset === p }, t.t(`settings.${p}`)));
    preset.addEventListener('change', () => h.onChange({ graphicsPreset: preset.value as Settings['graphicsPreset'] }));
    preset.dataset.testid = 'settings-preset';
    grid.append(el('label', { class: 'field' }, t.t('settings.graphics'), preset));

    const toggle = (key: 'reducedMotion' | 'subtitles' | 'colourBlindSafe', label: string) => {
      const cb = el('input', { type: 'checkbox', checked: settings[key] });
      cb.dataset.testid = `settings-${key}`;
      cb.addEventListener('change', () => h.onChange({ [key]: cb.checked } as Partial<Settings>));
      grid.append(el('label', { class: 'row' }, cb, el('span', {}, t.t(label))));
    };
    toggle('reducedMotion', 'settings.reducedMotion');
    toggle('subtitles', 'settings.subtitles');
    toggle('colourBlindSafe', 'settings.colourBlindSafe');

    const vol = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(settings.masterVolume) });
    vol.addEventListener('input', () => h.onChange({ masterVolume: Number(vol.value) }));
    grid.append(el('label', { class: 'field' }, t.t('settings.volume'), vol));

    grid.append(el('h3', {}, t.t('settings.controls')));
    for (const a of ACTIONS) {
      const kbd = el('kbd', {}, pretty(settings.keyBindings[a] ?? ''));
      const rebind = button(t.t('settings.rebind'), () => {
        kbd.textContent = '…';
        const once = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          document.removeEventListener('keydown', once, true);
          if (e.code === 'Escape' && a !== 'pause') {
            kbd.textContent = pretty(settings.keyBindings[a] ?? '');
            return;
          }
          kbd.textContent = pretty(e.code);
          h.onChange({ keyBindings: { ...settings.keyBindings, [a]: e.code } });
          settings = { ...settings, keyBindings: { ...settings.keyBindings, [a]: e.code } };
        };
        document.addEventListener('keydown', once, true);
      }, 'btn ghost');
      grid.append(el('div', { class: 'bind' }, el('span', {}, t.t(`settings.actions.${a}`)), el('span', { class: 'row' }, kbd, rebind)));
    }
    panel.append(grid, el('div', { class: 'row end', style: 'margin-top:1rem' }, button(t.t('settings.close'), h.onClose, 'btn', 'settings-close')));
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

function pretty(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('Escape', 'Esc').replace('Space', 'Space');
}
