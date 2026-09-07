import { el } from './dom';

export interface TouchHandlers {
  onMove(x: number, y: number): void;
  onLook(dx: number, dy: number): void;
  onInteract(): void;
}

/** Virtual joystick (left), drag-to-look (right half), interact button. Shown only on touch devices. */
export class TouchControls {
  readonly root = el('div', { class: 'touch' });

  constructor(h: TouchHandlers) {
    const stick = el('div', { class: 'stick' }, el('div', { class: 'knob' }));
    const knob = stick.firstElementChild as HTMLElement;
    let active: number | null = null;
    const center = { x: 0, y: 0 };
    stick.addEventListener('pointerdown', (e) => {
      active = e.pointerId;
      const r = stick.getBoundingClientRect();
      center.x = r.left + r.width / 2;
      center.y = r.top + r.height / 2;
      stick.setPointerCapture(e.pointerId);
    });
    stick.addEventListener('pointermove', (e) => {
      if (active !== e.pointerId) return;
      const dx = (e.clientX - center.x) / 50;
      const dy = (e.clientY - center.y) / 50;
      const len = Math.hypot(dx, dy);
      const k = len > 1 ? 1 / len : 1;
      knob.style.transform = `translate(${dx * k * 40}px, ${dy * k * 40}px)`;
      h.onMove(dx * k, -dy * k);
    });
    const end = (e: PointerEvent) => {
      if (active !== e.pointerId) return;
      active = null;
      knob.style.transform = '';
      h.onMove(0, 0);
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    const look = el('div', { class: 'lookpad' });
    let last: { x: number; y: number } | null = null;
    look.addEventListener('pointerdown', (e) => {
      last = { x: e.clientX, y: e.clientY };
    });
    look.addEventListener('pointermove', (e) => {
      if (!last) return;
      h.onLook((e.clientX - last.x) * 0.005, (e.clientY - last.y) * 0.005);
      last = { x: e.clientX, y: e.clientY };
    });
    look.addEventListener('pointerup', () => (last = null));
    const act = el('button', { class: 'act', type: 'button' }, 'E');
    act.addEventListener('click', h.onInteract);
    this.root.append(stick, look, act);
  }
}
