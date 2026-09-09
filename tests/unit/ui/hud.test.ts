import { describe, expect, it, vi } from 'vitest';

import { createHud } from '@ui/hud';

import { buildPage, press, pressSwitch, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-HUD-hud-and-menu.md`.
 *
 * What this file can and cannot prove is the same split as every other suite in
 * this directory: structure and behaviour here, geometry in `tests/a11y`. "The
 * HUD is in the lower third", "every control is 44 CSS px" and "the label is not
 * clipped at 200 %" are asserted against real Chromium, where they can fail; a
 * unit test claiming them against the document double would be a green tick that
 * certifies nothing.
 */

interface Fixture {
  readonly page: FakePage;
  readonly hud: ReturnType<typeof createHud>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly handlers: Record<string, ReturnType<typeof vi.fn>>;
  readonly clock: { now: number };
  at(testId: string): FakeElement | null;
}

function mount(overrides: Partial<Parameters<typeof createHud>[1]> = {}): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const clock = { now: 0 };
  const handlers = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenStudy: vi.fn(),
    onOpenPassport: vi.fn(),
    onInteract: vi.fn(),
    onExportSave: vi.fn(),
  };

  const hud = createHud(page.host, {
    locale: 'en',
    announce,
    ...handlers,
    now: () => clock.now,
    ...overrides,
  });

  return { page, hud, announce, handlers, clock, at: (testId) => page.doc.byTestId(testId) };
}

describe('the HUD is there while the player plays', () => {
  it('is a named region inside the page one main, with the mode as text', () => {
    /* TN-HUD-07: exactly one main, hud is a region with an accessible name. */
    const { hud, at } = mount();
    hud.setMode('Skating');

    const region = at('hud');
    expect(region?.tagName).toBe('SECTION');
    /* The name comes from `hud.label`, which `TN-HUD` writes down. It names what
       the region is for; the story lists "HUD", "Region" and the empty string as
       defects, and `tests/unit/ui/copy.test.ts` holds that rule over the row. */
    expect(region?.getAttribute('aria-label')).toBe('Game controls');
    expect(region?.closest('main')).toBe(hud.main);
    expect(at('hud-mode-label')?.textContent).toBe('Skating');
  });

  it('builds one main however many HUDs are mounted', () => {
    const page = buildPage();
    const first = createHud(page.host, { locale: 'en' });
    const second = createHud(page.host, { locale: 'en' });

    expect(page.doc.querySelectorAll('main')).toHaveLength(1);
    expect(second.main).toBe(first.main);
  });

  it('adopts the canvas host into main when the composition root hands it over', () => {
    const page = buildPage();
    const hud = createHud(page.host, {
      locale: 'en',
      canvasHost: page.game as unknown as HTMLElement,
    });

    expect(page.game.parentElement).toBe(hud.main);
  });

  it('offers the menu in one tap, with a visible label', () => {
    const { at } = mount();
    const button = at('menu-button');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.textContent).toBe('Menu');
  });

  it('shows the tracker only when there is a task, and removes it rather than hiding it', () => {
    const { hud, at } = mount();
    expect(at('hud-quest-tracker')).toBeNull();

    hud.setTask('Answer 3 questions (0 of 3)');
    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Answer 3 questions (0 of 3)');

    hud.setTask(null);
    /* Not hidden: absent. A hidden tracker is one stylesheet away from visible. */
    expect(at('hud-quest-tracker')).toBeNull();
  });

  it('announces a change to the tracker once, through the one live region', () => {
    /* TN-HUD-07: neither the tracker nor the mode carries an aria-live of its own. */
    const { hud, at, announce } = mount();
    hud.setTask('Answer 3 questions (0 of 3)');
    hud.setTask('Answer 3 questions (0 of 3)');

    expect(announce).toHaveBeenCalledTimes(1);
    expect(at('hud-quest-tracker')?.getAttribute('aria-live')).toBeNull();
    expect(at('hud-mode-label')?.getAttribute('aria-live')).toBeNull();
  });

  it('does not repeat the arrival announcement for the mode it arrived in', () => {
    const { hud, announce } = mount();
    hud.setMode('Skating');
    expect(announce).not.toHaveBeenCalled();

    hud.setMode('Walking');
    expect(announce).toHaveBeenCalledWith('Walking', 'en');
  });
});

describe('the interact prompt', () => {
  it('appears with the offer in words and does what tapping the target does', () => {
    const { hud, at, handlers } = mount();
    hud.setPrompt('Talk to the officer');

    const prompt = at('interact-prompt');
    expect(prompt?.tagName).toBe('BUTTON');
    expect(prompt?.textContent).toBe('Talk to the officer');

    prompt?.click();
    expect(handlers['onInteract']).toHaveBeenCalledTimes(1);
  });

  it('is withdrawn when nothing is in reach', () => {
    const { hud, at } = mount();
    hud.setPrompt('Talk to the officer');
    hud.setPrompt(null);
    expect(at('interact-prompt')).toBeNull();
  });

  it('says nothing itself: the level announcer owns the offer', () => {
    /* Two speakers for one event is how a message gets read twice. */
    const { hud, announce } = mount();
    hud.setPrompt('Talk to the officer');
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('the storage warning', () => {
  it('is absent from the tree when nothing is wrong', () => {
    /* TN-HUD-03: "not merely hidden behind a style rule that something else can
       override" — the exact defect axe found in this directory before. */
    const { at } = mount();
    expect(at('storage-warning')).toBeNull();
  });

  it('is inside the HUD, with both sentences, when storage cannot be written', () => {
    const { hud, at } = mount();
    hud.setStorageWarning(true);

    const warning = at('storage-warning');
    expect(warning?.closest('[data-testid="hud"]')).not.toBeNull();
    expect(warning?.textContent).toContain('This browser is not saving your progress.');
    expect(warning?.textContent).toContain(
      'You can keep playing, but everything will be gone when you close the tab.',
    );
  });

  it('is not a second announcer, and is spoken once', () => {
    const { hud, at, announce } = mount();
    hud.setStorageWarning(true);
    hud.setStorageWarning(true);

    expect(at('storage-warning')?.getAttribute('aria-live')).toBeNull();
    expect(at('storage-warning')?.getAttribute('role')).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('offers the way out TN-SAVE promises, and nothing to dismiss', () => {
    const { hud, at, handlers } = mount();
    hud.setStorageWarning(true);

    at('save-export')?.click();
    expect(handlers['onExportSave']).toHaveBeenCalledTimes(1);
    /* It is never the thing that has to be dismissed to carry on. */
    expect(at('storage-warning')?.querySelectorAll('[data-testid="storage-warning-close"]')).toEqual(
      [],
    );
  });

  it('leaves the tracker and the menu button operable', () => {
    const { hud, at } = mount();
    hud.setTask('Find the Peace Tower');
    hud.setStorageWarning(true);

    expect(at('hud-quest-tracker')).not.toBeNull();
    expect(at('menu-button')?.closest('[inert]')).toBeNull();
  });

  it('goes away again when storage starts working', () => {
    const { hud, at } = mount();
    hud.setStorageWarning(true);
    hud.setStorageWarning(false);
    expect(at('storage-warning')).toBeNull();
  });
});

describe('the menu', () => {
  it('opens paused, as a named modal dialog', () => {
    const { hud, at, handlers } = mount();
    at('menu-button')?.click();

    const menu = at('menu');
    expect(menu?.hidden).toBe(false);
    expect(menu?.getAttribute('role')).toBe('dialog');
    expect(menu?.getAttribute('aria-modal')).toBe('true');
    expect(hud.main.ownerDocument.getElementById(menu?.getAttribute('aria-labelledby') ?? '')
      ?.textContent).toBe('Menu');
    expect(handlers['onPause']).toHaveBeenCalledTimes(1);
  });

  it('offers Settings, Study and the passport, each with a visible label', () => {
    const { at } = mount();
    at('menu-button')?.click();

    expect(at('menu-settings')?.textContent).toBe('Settings');
    expect(at('menu-study')?.textContent).toBe('Study');
    expect(at('menu-passport')?.textContent).toBe('See my passport');
    expect(at('menu-close')?.textContent).toBe('Close');
  });

  it('offers the way out of the level when there is one, and only then', () => {
    /*
     * `TN-HUD-02`, amended 2026-09-08, and `TN-FLOW-03`. Before this item a
     * player who reached a level from the level select had no way back except
     * the browser's back button, which this game must not depend on. The second
     * half matters as much: a menu with nothing to leave does not offer it.
     */
    const onLeaveLevel = vi.fn();
    const { at } = mount({ onLeaveLevel });
    at('menu-button')?.click();
    expect(at('menu-leave')?.textContent).toBe('Leave the level');

    at('menu-leave')?.click();
    expect(onLeaveLevel).toHaveBeenCalledTimes(1);
    /* One screen at a time: the menu is gone before the route is taken. */
    expect(at('menu')?.hidden).toBe(true);

    const without = mount();
    without.at('menu-button')?.click();
    expect(without.at('menu-leave')).toBeNull();
  });

  it('makes the HUD inert while it is open, so the menu cannot be opened over itself', () => {
    /* TN-HUD-04, and the same mechanism that stops a modal being reached over a
       question card: the trap inerts everything outside the dialog. */
    const { hud, at } = mount();
    at('menu-button')?.click();

    expect(hud.main.inert).toBe(true);
    expect(at('menu-button')?.closest('[inert]')).toBe(hud.main);
  });

  it('closes back to the game and gives focus to the menu button', () => {
    const { at, handlers, page } = mount();
    const button = at('menu-button');
    button?.focus();
    button?.click();

    at('menu-close')?.click();

    expect(at('menu')?.hidden).toBe(true);
    expect(handlers['onResume']).toHaveBeenCalledTimes(1);
    expect(page.doc.activeElement).toBe(button);
  });

  it('closes on Escape, and gives focus back', () => {
    const { at, page, handlers } = mount();
    const button = at('menu-button');
    button?.focus();
    button?.click();

    press(at('menu') as FakeElement, 'Escape');

    expect(at('menu')?.hidden).toBe(true);
    expect(page.doc.activeElement).toBe(button);
    expect(handlers['onResume']).toHaveBeenCalledTimes(1);
  });

  it('leaves exactly one dialog on the page when an item is chosen', () => {
    /* TN-HUD-04: "one screen at a time". The menu goes before the screen it
       asked for arrives, which is also what leaves menu-button as the return
       point for the screen that opens next. */
    const { at, handlers, page } = mount();
    const button = at('menu-button');
    button?.focus();
    button?.click();
    at('menu-settings')?.click();

    expect(at('menu')?.hidden).toBe(true);
    expect(handlers['onOpenSettings']).toHaveBeenCalledTimes(1);
    expect(page.doc.activeElement).toBe(button);
  });

  it('does not resume the game when a screen was opened from it', () => {
    /* TN-HUD-04: "the game does not resume behind an open screen". */
    const { at, handlers } = mount();
    at('menu-button')?.click();
    at('menu-study')?.click();

    expect(handlers['onOpenStudy']).toHaveBeenCalledTimes(1);
    expect(handlers['onResume']).not.toHaveBeenCalled();
  });

  it('is reachable and choosable with one switch, and nothing scans by itself', () => {
    /* TN-HUD-06. */
    const { page, hud, at, clock } = mount({ singleSwitch: true, holdMs: 600 });
    at('menu-button')?.click();
    hud.setSingleSwitch(true, 600);

    const first = at('menu-settings');
    expect(first?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 100);
    expect(at('menu-study')?.getAttribute('data-switch-highlight')).toBe('true');

    /* Two minutes pass on the injected clock and nothing has moved. */
    clock.now += 120_000;
    expect(at('menu-study')?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 700);
    expect(at('menu')?.hidden).toBe(true);
  });
});

describe('the HUD in French', () => {
  it('redraws every label it owns without rebuilding the level', () => {
    /* TN-HUD-09. */
    const { hud, at } = mount({ locale: 'fr' });
    hud.setMode('Patinage');
    hud.setTask('Répondez à 3 questions (0 sur 3)');
    hud.setStorageWarning(true);

    expect(at('menu-button')?.textContent).toBe('Menu');
    /* TN-HUD-09, "The region's name is French". */
    expect(at('hud')?.getAttribute('aria-label')).toBe('Commandes du jeu');
    expect(at('hud-mode-label')?.textContent).toBe('Patinage');
    /* Canadian French puts a space before a colon. */
    expect(at('hud-quest-tracker')?.textContent).toBe('Mission : Répondez à 3 questions (0 sur 3)');
    expect(at('storage-warning')?.textContent).toContain(
      "Ce navigateur n'enregistre pas votre progression.",
    );
  });

  it('switches language in place, warning and menu included', () => {
    const { hud, at } = mount();
    hud.setTask('Answer 3 questions (0 of 3)');
    hud.setStorageWarning(true);

    hud.setLocale('fr');
    at('menu-button')?.click();

    /* TN-HUD-09's last scenario: the language changes from the menu and the
       region's name changes with it, without the level being rebuilt. A name
       supplied by the caller could not do this. */
    expect(at('hud')?.getAttribute('aria-label')).toBe('Commandes du jeu');
    expect(at('hud-quest-tracker')?.textContent).toContain('Mission :');
    expect(at('storage-warning')?.textContent).toContain('Ce navigateur');
    expect(at('menu-settings')?.textContent).toBe('Réglages');
    expect(at('menu-passport')?.textContent).toBe('Voir mon passeport');
  });

  /**
   * `TN-SET-01` wants Settings "from the game", and it was reachable only
   * behind the menu — which was reported as unreachable, because a player who
   * does not know a menu contains it has to open the menu to find out. Both
   * routes exist now and both open the same screen.
   */
  describe('settings, on the strip', () => {
    it('draws a Settings control beside Menu, with a visible label', () => {
      const { at } = mount({ onOpenSettings: () => undefined });
      const control = at('hud-settings-button');
      expect(control?.hidden).toBe(false);
      expect(control?.textContent).toBe('Settings');
    });

    it('opens settings without going through the menu', () => {
      const onOpenSettings = vi.fn();
      const { at } = mount({ onOpenSettings });
      at('hud-settings-button')?.click();
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('draws no control when nothing is wired, rather than a dead one', () => {
      /* Built directly rather than through `mount`, which wires every handler:
         the state under test is the one where the caller wired none. */
      const page = buildPage();
      createHud(page.host, { locale: 'en' });
      expect(page.doc.byTestId('hud-settings-button')?.hidden).toBe(true);
    });

    it('becomes French with the rest of the strip, without a reload', () => {
      const { hud, at } = mount({ onOpenSettings: () => undefined });
      hud.setLocale('fr');
      expect(at('hud-settings-button')?.textContent).toBe('Réglages');
    });
  });
});
