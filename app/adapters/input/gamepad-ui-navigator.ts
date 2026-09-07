/**
 * Lets a gamepad drive the DOM menus: left stick / d-pad moves focus between focusable controls of the
 * top-most open panel, A (button 0) activates, B (button 1) presses the panel's close/back button.
 * Polled once per frame by bootstrap; does nothing when no gamepad is connected.
 */
export class GamepadUiNavigator {
  private lastMove = 0;
  private prevA = false;
  private prevB = false;
  private axisLatched = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly nav: Navigator = navigator,
  ) {}

  poll(now = performance.now()): void {
    const pads = typeof this.nav.getGamepads === 'function' ? this.nav.getGamepads() : [];
    const pad = pads.find((p) => p && p.connected);
    if (!pad) return;
    const panel = this.topPanel();
    if (!panel) return;
    const focusables = [...panel.querySelectorAll<HTMLElement>('button, [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((f) => !f.hasAttribute('disabled') && f.offsetParent !== null);
    if (focusables.length === 0) return;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const dpad = { up: !!pad.buttons[12]?.pressed, down: !!pad.buttons[13]?.pressed, left: !!pad.buttons[14]?.pressed, right: !!pad.buttons[15]?.pressed };
    let dir = 0;
    if (dpad.down || dpad.right) dir = 1;
    else if (dpad.up || dpad.left) dir = -1;
    else if (Math.abs(ay) > 0.6 || Math.abs(ax) > 0.6) {
      if (!this.axisLatched) dir = (Math.abs(ay) > Math.abs(ax) ? ay : ax) > 0 ? 1 : -1;
    }
    this.axisLatched = Math.abs(ay) > 0.6 || Math.abs(ax) > 0.6;
    if (dir !== 0 && now - this.lastMove > 180) {
      this.lastMove = now;
      const idx = focusables.indexOf(document.activeElement as HTMLElement);
      const next = focusables[(idx + dir + focusables.length) % focusables.length];
      next?.focus();
    }
    const a = !!pad.buttons[0]?.pressed;
    const b = !!pad.buttons[1]?.pressed;
    if (a && !this.prevA) {
      const el = document.activeElement as HTMLElement | null;
      if (el && panel.contains(el)) {
        if (el instanceof HTMLSelectElement) {
          el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else el.click();
      } else focusables[0]?.focus();
    }
    if (b && !this.prevB) {
      const close = panel.querySelector<HTMLElement>('[data-testid$="-close"], [data-testid$="-back"], [data-testid="pause-resume"], [data-testid="exam-exit"]');
      close?.click();
    }
    this.prevA = a;
    this.prevB = b;
  }

  /** The last screen/dialog appended to the UI root is the active one. */
  private topPanel(): HTMLElement | null {
    const panels = [...this.root.querySelectorAll<HTMLElement>('[role="dialog"]')].filter((p) => p.offsetParent !== null);
    return panels[panels.length - 1] ?? null;
  }
}
