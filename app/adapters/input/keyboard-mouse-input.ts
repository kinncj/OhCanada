import type { InputAction, InputPort, InputState } from '@application/engine-ports';

const ACTIONS: InputAction[] = ['forward', 'back', 'left', 'right', 'sprint', 'jump', 'interact', 'journal', 'pause'];
const LOOK_SENSITIVITY = 0.0022;
const GAMEPAD_DEADZONE = 0.18;

/**
 * Keyboard + mouse (pointer lock) + gamepad + touch. Bindings are KeyboardEvent.code values
 * and are remappable at runtime (Settings). Pause/journal/interact are edge-triggered.
 */
export class KeyboardMouseInput implements InputPort {
  private bindings: Record<string, string> = {};
  private codeToAction = new Map<string, InputAction>();
  private readonly down = new Set<InputAction>();
  private readonly pressed = new Set<InputAction>();
  private lookDx = 0;
  private lookDy = 0;
  private enabled = true;
  private touchMove = { x: 0, y: 0 };
  private touchLook = { dx: 0, dy: 0 };

  constructor(
    private readonly target: HTMLElement,
    private readonly doc: Document = document,
    private readonly nav: Navigator = navigator,
  ) {
    doc.addEventListener('keydown', this.onKeyDown);
    doc.addEventListener('keyup', this.onKeyUp);
    doc.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', () => this.down.clear());
  }

  get pointerLocked(): boolean {
    return this.doc.pointerLockElement === this.target;
  }

  requestPointerLock(): void {
    if (!this.pointerLocked && this.target.isConnected) {
      try {
        const p = this.target.requestPointerLock() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      } catch {
        /* pointer lock may be refused (iframes, headless) — gameplay still works with keys */
      }
    }
  }

  releasePointerLock(): void {
    if (this.pointerLocked) this.doc.exitPointerLock();
  }

  setBindings(bindings: Readonly<Record<string, string>>): void {
    this.bindings = { ...bindings };
    this.codeToAction.clear();
    for (const a of ACTIONS) {
      const code = this.bindings[a];
      if (code) this.codeToAction.set(code, a);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.down.clear();
      this.lookDx = this.lookDy = 0;
    }
  }

  keyLabel(action: InputAction): string {
    const code = this.bindings[action] ?? '';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('Space', 'Space').replace('Escape', 'Esc');
  }

  /** Touch controls feed these (virtual joystick / drag look). */
  setTouchMove(x: number, y: number): void {
    this.touchMove = { x, y };
  }
  addTouchLook(dx: number, dy: number): void {
    this.touchLook.dx += dx;
    this.touchLook.dy += dy;
  }
  pressAction(action: InputAction): void {
    this.pressed.add(action);
  }

  poll(): InputState {
    let x = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    let y = (this.down.has('forward') ? 1 : 0) - (this.down.has('back') ? 1 : 0);
    let sprint = this.down.has('sprint');
    let jump = this.down.has('jump');
    let dx = this.lookDx + this.touchLook.dx;
    let dy = this.lookDy + this.touchLook.dy;
    this.lookDx = this.lookDy = 0;
    this.touchLook = { dx: 0, dy: 0 };

    if (this.touchMove.x !== 0 || this.touchMove.y !== 0) {
      x = this.touchMove.x;
      y = this.touchMove.y;
    }

    const pads = typeof this.nav.getGamepads === 'function' ? this.nav.getGamepads() : [];
    const pad = pads.find((p) => p && p.connected);
    if (pad && this.enabled) {
      const ax = dz(pad.axes[0] ?? 0);
      const ay = -dz(pad.axes[1] ?? 0);
      if (ax !== 0 || ay !== 0) {
        x = ax;
        y = ay;
      }
      dx += dz(pad.axes[2] ?? 0) * 0.04;
      dy += dz(pad.axes[3] ?? 0) * 0.04;
      sprint = sprint || !!pad.buttons[10]?.pressed;
      jump = jump || !!pad.buttons[0]?.pressed;
      if (pad.buttons[2]?.pressed) this.pressed.add('interact');
      if (pad.buttons[9]?.pressed) this.pressed.add('pause');
      if (pad.buttons[3]?.pressed) this.pressed.add('journal');
    }
    if (!this.enabled) return { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, sprint: false, jump: false };
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { move: { x, y }, look: { dx, dy }, sprint, jump };
  }

  consume(action: InputAction): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  dispose(): void {
    this.doc.removeEventListener('keydown', this.onKeyDown);
    this.doc.removeEventListener('keyup', this.onKeyUp);
    this.doc.removeEventListener('mousemove', this.onMouseMove);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
    if (typing && action !== 'pause') return;
    if (action === 'pause' || action === 'journal' || action === 'interact') {
      if (!e.repeat) this.pressed.add(action);
      // pause/journal are UI toggles: always allowed. interact only in gameplay.
      if (action === 'interact' && !this.enabled) this.pressed.delete(action);
    }
    if (this.enabled) this.down.add(action);
    if (action === 'jump' || action === 'interact') e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = this.codeToAction.get(e.code);
    if (action) this.down.delete(action);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked || !this.enabled) return;
    this.lookDx += e.movementX * LOOK_SENSITIVITY;
    this.lookDy += e.movementY * LOOK_SENSITIVITY;
  };
}

function dz(v: number): number {
  return Math.abs(v) < GAMEPAD_DEADZONE ? 0 : v;
}
