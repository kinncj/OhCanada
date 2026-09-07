import type { LocalizerPort } from '@application/engine-ports';
import { clear, el } from './dom';

export class Hud {
  readonly root = el('div', { class: 'hud', dataset: { screen: 'hud' } });
  private readonly objective = el('div', { class: 'objective', hidden: true });
  private readonly stamps = el('div', { class: 'stamps' });
  private readonly prompt = el('div', { class: 'prompt', hidden: true });
  private readonly toasts = el('div', { class: 'toasts', aria: { live: 'polite' } });
  private readonly controls = el('div', { class: 'controls' });
  private readonly overlay = el('div', { class: 'click-to-play', hidden: true });

  constructor(private readonly t: LocalizerPort) {
    this.root.append(
      el('div', { class: 'top-left' }, this.objective),
      el('div', { class: 'top-right' }, this.stamps),
      this.prompt,
      this.toasts,
      this.controls,
      el('div', { class: 'crosshair' }),
      this.overlay,
    );
    this.setStamps(0);
    this.controls.textContent = t.t('hud.controls');
  }

  setObjective(questTitle: string | null, text: string | null): void {
    clear(this.objective);
    if (!text) {
      this.objective.hidden = true;
      return;
    }
    this.objective.hidden = false;
    this.objective.append(el('small', {}, questTitle ?? this.t.t('hud.objective')), el('div', { dataset: { testid: 'objective' } }, text));
  }

  setStamps(n: number): void {
    clear(this.stamps);
    this.stamps.append(el('span', { class: 'leaf' }, '🍁'), el('span', { dataset: { testid: 'stamps' } }, `${n}`), el('span', {}, this.t.t('hud.stamps')));
  }

  setPrompt(key: string | null, text: string | null): void {
    clear(this.prompt);
    if (!text) {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.hidden = false;
    if (key) this.prompt.append(el('kbd', {}, key));
    this.prompt.append(el('span', { dataset: { testid: 'prompt' } }, text));
  }

  toast(text: string, bad = false): void {
    const t = el('div', { class: bad ? 'toast bad' : 'toast', role: 'status' }, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), 4200);
  }

  private clickToPlayShown: boolean | null = null;
  showClickToPlay(show: boolean, onClick?: () => void): void {
    if (this.clickToPlayShown === show) return; // called every frame: only touch the DOM on change
    this.clickToPlayShown = show;
    this.overlay.hidden = !show;
    clear(this.overlay);
    if (show) {
      this.overlay.append(el('div', {}, this.t.t('hud.clickToPlay')));
      this.overlay.onclick = () => onClick?.();
    }
  }

  refreshText(): void {
    this.controls.textContent = this.t.t('hud.controls');
  }
}
