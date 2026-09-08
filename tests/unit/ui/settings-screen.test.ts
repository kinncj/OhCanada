import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import { createSettingsScreen } from '@ui/settings-screen';
import { createSettingsStore, DEFAULT_SETTINGS, type Settings } from '@ui/settings';
import { HIGHLIGHT_ATTRIBUTE } from '@ui/single-switch';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-SET-settings.md`. This screen is built first because six of
 * the seven slice-1 stories open a scenario with a precondition only it can set.
 *
 * Geometry — the 44 px target, the label that must not clip at 200 % — is
 * asserted in `tests/a11y/settings.spec.ts` against real Chromium. This file
 * proves the semantics and the state machine.
 */

interface Fixture {
  readonly page: FakePage;
  readonly store: ReturnType<typeof createSettingsStore>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly onClose: ReturnType<typeof vi.fn>;
  readonly screen: ReturnType<typeof createSettingsScreen>;
  readonly root: FakeElement;
  control(testId: string): FakeElement;
}

function open(initial: Partial<Settings> = {}, showSound = false): Fixture {
  const page = buildPage();
  const store = createSettingsStore({ ...DEFAULT_SETTINGS, ...initial });
  const announce = vi.fn();
  const onClose = vi.fn();
  const screen = createSettingsScreen(page.host, {
    store,
    announce,
    onClose,
    showSound,
    now: () => 0,
  });
  screen.show();

  const root = page.doc.byTestId('settings-screen');
  if (root === null) throw new Error('the settings screen did not mount');

  return {
    page,
    store,
    announce,
    onClose,
    screen,
    root,
    control(testId: string): FakeElement {
      const found = root.byTestId(testId);
      if (found === null) throw new Error(`no control ${testId}`);
      return found;
    },
  };
}

describe('the settings screen', () => {
  it('is a named modal dialog', () => {
    const { root, page } = open();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');

    const name = page.doc.getElementById(root.getAttribute('aria-labelledby') ?? '');
    expect(name?.textContent).toBe('Settings');
  });

  it('shows a control for every setting the story lists', () => {
    const { control } = open();
    for (const testId of [
      'setting-language',
      'setting-auto-move',
      'setting-single-switch',
      'setting-reduced-motion',
      'setting-high-contrast',
      'setting-dyslexia-font',
      'setting-text-size',
      'setting-subtitles',
    ]) {
      expect(control(testId)).not.toBeNull();
    }
  });

  it('labels every control with words, never an icon alone', () => {
    const { root } = open();
    for (const control of root.querySelectorAll('[role="switch"]')) {
      expect(control.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('leaves the sound section out until there is a sound to control', () => {
    /* OQ-SET-3: "ship the sound section only if a sound ships; a control that
       does nothing is worse than a missing one". The copy is transcribed and the
       section is one flag away. */
    expect(open().root.byTestId('setting-sound')).toBeNull();
    expect(open({}, true).root.byTestId('setting-sound')).not.toBeNull();
  });

  it('draws every switch as a switch, with its state as a word as well as a position', () => {
    const { control } = open();
    const motion = control('setting-reduced-motion');
    expect(motion.getAttribute('role')).toBe('switch');
    expect(motion.getAttribute('aria-checked')).toBe('false');
    /* TN-SET-07: the state is still a word when the animation is gone. */
    expect(motion.textContent).toContain('Off');

    motion.click();
    expect(motion.getAttribute('aria-checked')).toBe('true');
    expect(motion.textContent).toContain('On');
  });

  it('attaches help text as the accessible description, not as a floating paragraph', () => {
    const { control, page } = open();
    const single = control('setting-single-switch');
    const describedBy = single.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(page.doc.getElementById(describedBy ?? '')?.textContent).toBe(
      'Tap to move the highlight. Hold to choose.',
    );
  });

  it('applies a change at once, and never says it was saved', () => {
    /* TN-SET-03: the change applies even when the write fails, so this screen
       does not save and must not claim to. */
    const { control, store, root } = open();
    control('setting-high-contrast').click();
    expect(store.current.highContrast).toBe(true);
    expect(root.textContent.toLowerCase()).not.toContain('saved');
  });

  it('announces the setting name and its new state, once', () => {
    const { control, announce } = open();
    control('setting-reduced-motion').click();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Less movement: On');
  });

  it('shows the text size as a percentage a screen reader can read', () => {
    const { control } = open({ textScale: 150 });
    const slider = control('setting-text-size');
    expect(slider.getAttribute('type')).toBe('range');
    expect(slider.getAttribute('min')).toBe('100');
    expect(slider.getAttribute('max')).toBe('200');
    expect(slider.getAttribute('aria-valuetext')).toBe('150%');
    expect(control('setting-text-size-value').textContent).toBe('150%');
  });

  it('changes the text size, clamping what the control cannot express', () => {
    const { control, store } = open();
    const slider = control('setting-text-size');
    slider.value = '200';
    slider.dispatchEvent(new FakeEvent('input'));
    expect(store.current.textScale).toBe(200);

    slider.value = '900';
    slider.dispatchEvent(new FakeEvent('input'));
    expect(store.current.textScale).toBe(200);
  });

  it('changes the language with the arrow keys', () => {
    /* TN-SET-04: "the language control changes with the arrow keys" — which a
       native `select` only does once it is open, and a popup is a second focus
       surface over a modal. */
    const { control, store } = open();
    const group = control('setting-language');
    expect(group.getAttribute('role')).toBe('radiogroup');

    press(group, 'ArrowRight');
    expect(store.current.locale).toBe('fr');
    press(group, 'ArrowRight');
    expect(store.current.locale).toBe('en');
    press(group, 'ArrowLeft');
    expect(store.current.locale).toBe('fr');
  });

  it('ignores a key that is not an arrow', () => {
    const { control, store } = open();
    const event = new FakeEvent('keydown', { key: 'x' });
    control('setting-language').dispatchEvent(event);
    expect(store.current.locale).toBe('en');
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps focus on the language control after a change, never on the body', () => {
    const { control, page } = open();
    press(control('setting-language'), 'ArrowRight');
    expect(page.doc.activeElement).toBe(control('setting-language-fr'));
  });

  it('redraws every label in the new language without closing', () => {
    const { control, root, store } = open();
    control('setting-language-fr').click();

    expect(store.current.locale).toBe('fr');
    expect(root.getAttribute('lang')).toBe('fr');
    expect(root.textContent).toContain('Réglages');
    expect(root.textContent).toContain('Déplacement automatique');
    expect(root.textContent).toContain('Mode à un bouton');
    expect(root.textContent).toContain('Moins de mouvement');
    expect(root.textContent).toContain('Contraste élevé');
    expect(root.textContent).toContain('Police plus lisible');
    expect(root.textContent).toContain('Taille du texte');
    expect(root.textContent).toContain('Sous-titres');
    expect(root.textContent).toContain('Fermer');
  });

  it('announces a language change in the language just chosen', () => {
    const { control, announce } = open();
    control('setting-language-fr').click();
    expect(announce).toHaveBeenCalledWith('Langue : Français');
  });

  it('never translates the language names', () => {
    const { control, root } = open();
    control('setting-language-fr').click();
    expect(root.byTestId('setting-language-en')?.textContent).toBe('English');
    expect(root.byTestId('setting-language-fr')?.textContent).toBe('Français');
  });

  it('says nothing when the language chosen is the one already in use', () => {
    const { control, announce } = open();
    control('setting-language-en').click();
    expect(announce).not.toHaveBeenCalled();
  });

  it('shows the French help text in French', () => {
    const { control, page } = open({ locale: 'fr' });
    const single = control('setting-single-switch');
    expect(page.doc.getElementById(single.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Touchez pour déplacer la sélection. Maintenez pour choisir.',
    );
  });

  it('closes on the Close button and on Escape', () => {
    const { control, onClose, root } = open();
    control('settings-close').click();
    expect(onClose).toHaveBeenCalledTimes(1);

    press(root, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('gives focus back to whatever opened it', () => {
    const page = buildPage();
    const menu = page.doc.createElement('button');
    menu.id = 'menu-button';
    page.ui.append(menu);
    menu.focus();

    const screen = createSettingsScreen(page.host, { store: createSettingsStore() });
    screen.show();
    screen.hide();
    expect(page.doc.activeElement).toBe(menu);
  });

  it('turns one-button mode on from inside itself, and off again with the switch alone', () => {
    /* TN-SET-05: "no setting can put the game into a state that the switch alone
       cannot leave". */
    const fixture = open();
    const clock = { now: 0 };
    fixture.screen.destroy();

    const page = buildPage();
    const store = createSettingsStore();
    const screen = createSettingsScreen(page.host, { store, now: () => clock.now });
    screen.show();

    const root = page.doc.byTestId('settings-screen');
    root?.byTestId('setting-single-switch')?.click();
    expect(store.current.singleSwitch).toBe(true);

    /* From here the pointer is the only input: short presses to reach the
       control, a long press to take it. */
    let guard = 0;
    while (
      root?.byTestId('setting-single-switch')?.getAttribute(HIGHLIGHT_ATTRIBUTE) !== 'true' &&
      guard < 40
    ) {
      tap(page, clock, 50);
      guard += 1;
    }
    expect(guard).toBeLessThan(40);

    tap(page, clock, 800);
    expect(store.current.singleSwitch).toBe(false);
  });

  it('reflects a change made somewhere else', () => {
    const { control, store } = open();
    store.set('highContrast', true);
    expect(control('setting-high-contrast').getAttribute('aria-checked')).toBe('true');
  });

  it('stops listening to the store when it is destroyed', () => {
    const { screen, store, page } = open();
    screen.destroy();
    expect(page.doc.byTestId('settings-screen')).toBeNull();
    expect(() => store.set('highContrast', true)).not.toThrow();
  });

  it('reports whether it is on screen', () => {
    const { screen } = open();
    expect(screen.visible).toBe(true);
    screen.hide();
    expect(screen.visible).toBe(false);
  });

  it('uses the story wording, not wording of its own', () => {
    const { root } = open();
    expect(root.textContent).toContain(text('en', 'settings.autoMove'));
    expect(root.textContent).toContain(text('en', 'settings.subtitles'));
  });
});

function tap(page: FakePage, clock: { now: number }, heldMs: number): void {
  page.doc.dispatchEvent(new FakeEvent('pointerdown'));
  clock.now += heldMs;
  page.doc.dispatchEvent(new FakeEvent('pointerup'));
}
