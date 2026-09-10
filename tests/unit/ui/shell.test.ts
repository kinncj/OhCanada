import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';

import type { CreatorSlot } from '@ui/character-creator';
import type { UiLocale } from '@ui/copy';
import type { MapEntry } from '@ui/level-select';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';
import { createShell } from '@ui/shell';

import { buildPage, pressSwitch, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * The shell — the route `docs/stories/TN-FLOW-first-run-and-return.md` describes,
 * and the composition API `app/bootstrap` mounts.
 *
 * These tests are the written form of the contract in that module's header, and
 * they exist because the last thing this project shipped was 4,000 lines of
 * screens with no consumer. The assertions to read first are the two about a
 * level transition: the shell's `<main>` must be **gone** while the level's HUD
 * owns the page, and it must come back with its state intact.
 */

const SLOT: CreatorSlot = {
  id: 'coat',
  testId: 'slot-coat',
  label: 'Coat',
  options: [
    { id: 'parka', name: 'Parka' },
    { id: 'anorak', name: 'Anorak' },
  ],
};

const SLOTS: Readonly<Record<UiLocale, readonly CreatorSlot[]>> = {
  en: [SLOT],
  fr: [{ ...SLOT, label: 'Manteau' }],
};

const id = (value: string): LevelId => value as LevelId;

/** The ten of `TN-LEVELS-2-to-10-spine.md`; 2 and 10 have no id, on purpose. */
const SPINE: readonly (readonly [number, string | undefined])[] = [
  [1, 'halifax'],
  [2, undefined],
  [3, 'quebec-city'],
  [4, 'ottawa'],
  [5, 'toronto'],
  [6, 'winnipeg'],
  [7, 'prairie-rail'],
  [8, 'alberta-foothills'],
  [9, 'vancouver'],
  [10, undefined],
];

const entries = (built: readonly string[], unlocked: readonly string[]): readonly MapEntry[] =>
  SPINE.map(([number, levelId]) => ({
    number,
    ...(levelId === undefined ? {} : { id: id(levelId) }),
    built: levelId !== undefined && built.includes(levelId),
    unlocked: levelId !== undefined && unlocked.includes(levelId),
  }));

const ENTRIES = entries(['ottawa', 'halifax'], ['ottawa']);

interface Fixture {
  readonly page: FakePage;
  readonly shell: ReturnType<typeof createShell>;
  readonly store: ReturnType<typeof createSettingsStore>;
  readonly onPlayLevel: ReturnType<typeof vi.fn>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly clock: { now: number };
  at(testId: string): FakeElement | null;
}

function mount(overrides: Partial<Parameters<typeof createShell>[1]> = {}): Fixture {
  const page = buildPage();
  const store = createSettingsStore(DEFAULT_SETTINGS);
  const onPlayLevel = vi.fn();
  const announce = vi.fn();
  const clock = { now: 0 };
  const shell = createShell(page.host, {
    store,
    entries: ENTRIES,
    stampsToUnlock: 1,
    onPlayLevel,
    announce,
    now: () => clock.now,
    ...overrides,
  });
  return {
    page,
    shell,
    store,
    onPlayLevel,
    announce,
    clock,
    at: (testId) => page.doc.byTestId(testId),
  };
}

/** A shell that has never been played: the first-run route. */
const firstRun = (over: Partial<Parameters<typeof createShell>[1]> = {}): Fixture =>
  mount({ creator: { slots: SLOTS, required: true }, ...over });

describe('the shell, on a cold load', () => {
  it('shows the title screen with no URL parameter', () => {
    const { shell, at } = mount();
    shell.start();

    expect(shell.view).toBe('title');
    expect(at('title-screen')).not.toBeNull();
  });

  it('is the page one <main>, so the level HUD is never a second one', () => {
    const { shell, at } = mount();
    shell.start();

    const main = at('shell');
    expect(main?.tagName).toBe('MAIN');
    expect(main?.getAttribute('role')).toBeNull();
    expect(main?.getAttribute('aria-modal')).toBeNull();
  });

  it('puts focus on the primary control, never on the body', () => {
    const { shell, page, at } = firstRun();
    shell.start();
    expect(page.doc.activeElement).toBe(at('title-play'));
  });

  it('announces the screen it arrived at, once', () => {
    const { shell, announce } = mount();
    shell.start();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0]?.[0]).toContain('TrueNorth');
  });
});

describe('the first run, end to end', () => {
  it('goes title -> creator -> level select', () => {
    const onCreateCharacter = vi.fn();
    const { shell, at } = firstRun({ onCreateCharacter });
    shell.start();

    at('title-play')?.click();
    expect(shell.view).toBe('creator');
    expect(at('character-creator')).not.toBeNull();
    expect(at('title-screen')).toBeNull();

    at('start-playing')?.click();
    expect(onCreateCharacter).toHaveBeenCalledTimes(1);
    expect(shell.view).toBe('level-select');
    expect(at('character-creator')).toBeNull();
  });

  it('carries the character the player made out of the creator', () => {
    const onCreateCharacter = vi.fn();
    const { shell, at } = firstRun({
      creator: { slots: SLOTS, required: true, initialSelection: { coat: 'parka' } },
      onCreateCharacter,
    });
    shell.start();
    at('title-play')?.click();
    at('slot-coat-anorak')?.click();
    at('start-playing')?.click();

    expect(onCreateCharacter).toHaveBeenCalledWith({ coat: 'anorak' });
  });

  it('does not show the creator twice in one sitting', () => {
    const { shell, at } = firstRun();
    shell.start();
    at('title-play')?.click();
    at('start-playing')?.click();

    /* Back to the title, and in again: a character exists now, so the way in is
       "Choose a level" and the creator is not shown again (`TN-FLOW-01`). */
    at('level-select-back')?.click();
    expect(at('title-play')).toBeNull();
    at('title-choose-level')?.click();
    expect(shell.view).toBe('level-select');
    expect(at('character-creator')).toBeNull();
  });

  it('asks the composition root to load a level; it never loads one itself', () => {
    const { shell, at, onPlayLevel } = mount();
    shell.start();
    at('title-choose-level')?.click();
    at('level-card-ottawa')?.click();

    expect(onPlayLevel).toHaveBeenCalledWith(id('ottawa'));
    /* Still on the map: the caller decides when the level has the page. */
    expect(shell.view).toBe('level-select');
  });

  it('goes back one step and never further', () => {
    const { shell, at } = mount();
    shell.start();
    at('title-choose-level')?.click();
    at('level-select-back')?.click();

    expect(shell.view).toBe('title');
    expect(at('title-screen')).not.toBeNull();
  });

  it('moves focus into every new view and announces it once', () => {
    const { shell, at, page, announce } = mount();
    shell.start();
    announce.mockClear();

    at('title-choose-level')?.click();
    expect(page.doc.activeElement).toBe(at('level-card-ottawa'));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0]?.[0]).toContain('Choose a level');
  });
});

describe('coming back', () => {
  it('offers Continue for a level this build has, and nothing else opens it', () => {
    const { shell, at, onPlayLevel } = mount({ resumeLevelId: id('ottawa') });
    shell.start();

    expect(at('title-last-played')?.textContent).toBe('Last played: Ottawa');
    at('title-continue')?.click();
    expect(onPlayLevel).toHaveBeenCalledWith(id('ottawa'));
    expect(at('character-creator')).toBeNull();
  });

  it('withdraws Continue when the saved level is not in this build', () => {
    /* `TN-TITLE-04`: no error, nothing that reads as a fault — the other way in
       is simply the one that is offered. */
    const { shell, at } = mount({ resumeLevelId: id('quebec-city') });
    shell.start();

    expect(at('title-continue')).toBeNull();
    expect(at('title-last-played')?.hidden).toBe(true);
    expect(at('title-choose-level')).not.toBeNull();
    expect(at('title-screen')?.textContent?.toLowerCase()).not.toContain('error');
  });

  it('offers and withdraws Continue as the save is read', () => {
    const { shell, at, onPlayLevel } = mount();
    shell.start();

    shell.setResumeLevelId(id('ottawa'));
    at('title-continue')?.click();
    expect(onPlayLevel).toHaveBeenCalledWith(id('ottawa'));

    shell.setResumeLevelId(null);
    expect(at('title-continue')).toBeNull();
  });
});

describe('settings and Study, from the first screen', () => {
  it('opens settings over the title screen and closes back to it', () => {
    const { shell, at } = mount();
    shell.start();

    at('title-settings')?.click();
    expect(at('settings-screen')?.hidden).toBe(false);
    expect(at('settings-screen')?.getAttribute('aria-modal')).toBe('true');

    at('settings-close')?.click();
    expect(at('settings-screen')?.hidden).toBe(true);
    expect(at('title-screen')).not.toBeNull();
  });

  it('is reachable from the creator, which is the first screen on a first run', () => {
    const { shell, at } = firstRun();
    shell.start();
    at('title-play')?.click();
    at('creator-settings')?.click();

    expect(at('settings-screen')?.hidden).toBe(false);
  });

  it('hands Study to the caller, and hides it when there is no Study', () => {
    const onOpenStudy = vi.fn();
    const withStudy = mount({ onOpenStudy });
    withStudy.shell.start();
    withStudy.at('title-study')?.click();
    expect(onOpenStudy).toHaveBeenCalledTimes(1);

    const without = mount();
    without.shell.start();
    expect(without.at('title-study')).toBeNull();
  });
});

describe('the language changes', () => {
  it('redraws the title screen without a reload', () => {
    const { shell, store, at } = mount({ resumeLevelId: id('ottawa') });
    shell.start();

    store.set('locale', 'fr');
    expect(at('title-continue')?.textContent).toBe('Continuer');
    expect(at('title-last-played')?.textContent).toBe('Dernier niveau : Ottawa');
    expect(at('shell')?.getAttribute('lang')).toBe('fr');
  });

  it('redraws the level select in place, keeping every card in the state it was in', () => {
    const { shell, store, at } = mount();
    shell.start();
    at('title-choose-level')?.click();

    store.set('locale', 'fr');
    expect(shell.view).toBe('level-select');
    expect(at('level-card-halifax')?.textContent).toContain('Verrouillé');
    expect(at('level-card-halifax')?.getAttribute('data-state')).toBe('locked');
    expect(at('level-card-ottawa')?.getAttribute('data-state')).toBe('open');
  });

  it('redraws the creator in place', () => {
    const { shell, store, at } = firstRun();
    shell.start();
    at('title-play')?.click();

    store.set('locale', 'fr');
    expect(at('character-creator')?.textContent).toContain('Manteau');
  });
});

describe('a level transition', () => {
  it('takes the shell off the page entirely, so there is one <main>', () => {
    const { shell, at } = mount();
    shell.start();
    shell.enterLevel(id('ottawa'));

    expect(shell.view).toBeNull();
    /* Removed, not hidden: `TN-FLOW-08` requires a screen that has been left to
       be gone from the accessibility tree, not behind a style rule. */
    expect(at('shell')).toBeNull();
  });

  it('puts the shell back on the map, focused on the card just left', () => {
    const { shell, at, page } = mount();
    shell.start();
    at('title-choose-level')?.click();
    shell.enterLevel(id('ottawa'));
    shell.leaveLevel();

    expect(shell.view).toBe('level-select');
    expect(page.doc.activeElement).toBe(at('level-card-ottawa'));
  });

  it('announces where the player arrived, not the screen they left', () => {
    const { shell, announce } = mount();
    shell.start();
    shell.enterLevel(id('ottawa'));
    announce.mockClear();
    shell.leaveLevel();

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0]?.[0]).toContain('Choose a level');
  });

  it('falls back to the open card when the level it came from has no card', () => {
    const { shell, at, page } = mount();
    shell.start();
    shell.enterLevel(id('nowhere'));
    shell.leaveLevel();

    expect(page.doc.activeElement).toBe(at('level-card-ottawa'));
  });

  /**
   * `TN-FLOW-03` puts the player back on the card they just left, and that is
   * right for every ordinary exit. It is wrong exactly once: when finishing the
   * level opened another one, the news is the new card. `TN-MAP-03`: "it is
   * announced as open when I reach it."
   */
  it('lands on the card that just opened, when the caller names one', () => {
    const { shell, at, page } = mount();
    shell.start();
    shell.enterLevel(id('ottawa'));
    shell.setEntries(entries(['ottawa', 'halifax'], ['ottawa', 'halifax']));
    shell.leaveLevel({ focusLevelId: id('halifax') });

    expect(page.doc.activeElement).toBe(at('level-card-halifax'));
  });

  it('announces that card — the place, its state and what to do — not the screen', () => {
    const { shell, announce } = mount();
    shell.start();
    shell.enterLevel(id('ottawa'));
    shell.setEntries(entries(['ottawa', 'halifax'], ['ottawa', 'halifax']));
    announce.mockClear();
    shell.leaveLevel({ focusLevelId: id('halifax') });

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0]?.[0]).toBe('Halifax. Open. You can play this now.');
  });

  it('falls back to the ordinary landing when that card is not in this build', () => {
    const { shell, at, page } = mount();
    shell.start();
    shell.enterLevel(id('ottawa'));
    shell.leaveLevel({ focusLevelId: id('nowhere') });

    expect(page.doc.activeElement).toBe(at('level-card-ottawa'));
  });

  it('closes an open settings screen on the way into a level', () => {
    const { shell, at } = mount();
    shell.start();
    at('title-settings')?.click();
    shell.enterLevel(id('ottawa'));
    shell.leaveLevel();

    expect(at('settings-screen')?.hidden).toBe(true);
  });

  it('redraws what progress opened while the player was away', () => {
    const { shell, at, onPlayLevel } = mount();
    shell.start();
    shell.enterLevel(id('ottawa'));
    shell.setEntries(entries(['ottawa', 'halifax'], ['ottawa', 'halifax']));
    shell.leaveLevel();

    at('level-card-halifax')?.click();
    expect(onPlayLevel).toHaveBeenCalledWith(id('halifax'));
  });

  it('sends a player with no character through the creator when asked to', () => {
    const { shell, at } = mount({ creator: { slots: SLOTS, required: false } });
    shell.start();
    shell.setCharacterRequired(true);
    expect(at('title-play')).not.toBeNull();

    at('title-play')?.click();
    expect(shell.view).toBe('creator');
  });
});

describe('storage is blocked', () => {
  it('warns on the title screen without covering or blocking the way in', () => {
    const { shell, at } = mount();
    shell.start();
    shell.setStorageWarning(true);

    expect(at('storage-warning')).not.toBeNull();
    expect(at('storage-warning')?.textContent).toContain(
      'This browser is not saving your progress.',
    );
    /* Not a second announcer, and not something to dismiss. */
    expect(at('storage-warning')?.getAttribute('aria-live')).toBeNull();
    expect(at('title-play') ?? at('title-choose-level')).not.toBeNull();
  });

  it('is raised once and taken down when it is no longer true', () => {
    const { shell, at } = mount();
    shell.start();
    shell.setStorageWarning(true);
    shell.setStorageWarning(true);
    expect(at('shell')?.querySelectorAll('[data-testid="storage-warning"]').length).toBe(1);

    shell.setStorageWarning(false);
    expect(at('storage-warning')).toBeNull();
  });

  it('does not follow the player to the level select', () => {
    const { shell, at } = mount();
    shell.start();
    shell.setStorageWarning(true);
    at('title-choose-level')?.click();

    expect(at('storage-warning')).toBeNull();
  });
});

describe('single-switch mode', () => {
  it('walks the title screen and chooses with one contact', () => {
    const { shell, store, at, page, clock, onPlayLevel } = mount({
      resumeLevelId: id('ottawa'),
    });
    store.set('singleSwitch', true);
    shell.start();

    /* The highlight starts on the first item and does not move on its own. */
    expect(at('title-continue')?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 50);
    expect(at('title-continue')?.getAttribute('data-switch-highlight')).toBeNull();
    expect(at('title-choose-level')?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 50);
    pressSwitch(page, clock, 50);
    expect(at('title-continue')?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 1_000);
    expect(onPlayLevel).toHaveBeenCalledWith(id('ottawa'));
  });

  it('reaches the map and opens the one open level with one contact', () => {
    const { shell, store, page, clock, onPlayLevel } = mount();
    store.set('singleSwitch', true);
    shell.start();

    pressSwitch(page, clock, 1_000);
    expect(shell.view).toBe('level-select');

    /* The map opens with the open card focused, so it is the first item and one
       long press takes it. */
    pressSwitch(page, clock, 1_000);
    expect(onPlayLevel).toHaveBeenCalledWith(id('ottawa'));
  });

  it('reaches every card, including the ones that cannot be opened', () => {
    const { shell, store, page, clock } = mount();
    store.set('singleSwitch', true);
    shell.start();
    shell.show('level-select');

    const seen = new Set<string>();
    for (let press = 0; press < 12; press += 1) {
      const current = page.doc.querySelector('[data-switch-highlight="true"]');
      const testId = current?.getAttribute('data-testid');
      if (testId !== null && testId !== undefined) seen.add(testId);
      pressSwitch(page, clock, 50);
    }

    /* `TN-MAP-08`: a switch user who could not reach the closed cards would be
       the only player who cannot find out what the rest of the game is. */
    expect([...seen]).toContain('level-card-ottawa');
    expect([...seen]).toContain('level-card-halifax');
    expect([...seen]).toContain('level-card-vancouver');
  });

  it('says why a card cannot be opened instead of opening it', () => {
    const { shell, store, page, clock, announce, onPlayLevel, at } = mount();
    store.set('singleSwitch', true);
    shell.start();
    shell.show('level-select');

    /* Walk to the first card that is not built and hold. */
    for (let press = 0; press < 12; press += 1) {
      const current = page.doc.querySelector('[data-switch-highlight="true"]');
      if (current?.getAttribute('data-testid') === 'level-card-vancouver') break;
      pressSwitch(page, clock, 50);
    }
    announce.mockClear();
    pressSwitch(page, clock, 1_000);

    expect(onPlayLevel).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(at('level-card-vancouver-help')?.textContent ?? '');
  });

  it('stands down while a modal owns the page, so two rings never answer one tap', () => {
    const { shell, store, at, page, clock } = mount();
    store.set('singleSwitch', true);
    shell.start();

    at('title-settings')?.click();
    pressSwitch(page, clock, 50);

    expect(at('title-choose-level')?.getAttribute('data-switch-highlight')).toBeNull();
    expect(at('settings-screen')?.querySelector('[data-switch-highlight="true"]')).not.toBeNull();
  });

  it('stands down for a modal the caller mounted, and comes back when it closes', () => {
    const { shell, store, at, page, clock } = mount();
    store.set('singleSwitch', true);
    shell.start();

    shell.setModalOpen(true);
    pressSwitch(page, clock, 50);
    expect(page.doc.querySelector('[data-switch-highlight="true"]')).toBeNull();

    shell.setModalOpen(false);
    expect(at('title-choose-level')?.getAttribute('data-switch-highlight')).toBe('true');
  });

  it('stands down while a level owns the page, and comes back after it', () => {
    const { shell, store, page, clock, at } = mount();
    store.set('singleSwitch', true);
    shell.start();
    shell.enterLevel(id('ottawa'));

    pressSwitch(page, clock, 50);
    expect(page.doc.querySelector('[data-switch-highlight="true"]')).toBeNull();

    shell.leaveLevel();
    expect(at('shell')?.querySelector('[data-switch-highlight="true"]')).not.toBeNull();
  });

  it('comes on when the player turns it on with a view already up', () => {
    const { shell, store, page, clock, at } = mount();
    shell.start();

    store.set('singleSwitch', true);
    expect(at('title-choose-level')?.getAttribute('data-switch-highlight')).toBe('true');
    pressSwitch(page, clock, 1_000);
    expect(shell.view).toBe('level-select');
  });
});

describe('taking the shell down', () => {
  it('leaves no element, no listener and no subscription behind', () => {
    const { shell, store, page, at } = mount();
    shell.start();
    at('title-settings')?.click();
    shell.setStorageWarning(true);

    shell.destroy();

    expect(at('shell')).toBeNull();
    expect(shell.view).toBeNull();
    expect(page.doc.listenerCount('pointerdown')).toBe(0);
    /* The store outlives the shell; nothing it notifies may touch dead DOM. */
    expect(() => store.set('locale', 'fr')).not.toThrow();
  });
});

describe('the exam, from the front door', () => {
  it('draws no exam control when the composition root offers none', () => {
    const { shell, at } = mount();
    shell.start();
    expect(at('title-exam')).toBeNull();
  });

  it('offers the exam and hands the request straight over', () => {
    const onOpenExam = vi.fn();
    const { shell, at } = mount({ onOpenExam });
    shell.start();
    at('title-exam')?.click();
    expect(onOpenExam).toHaveBeenCalledOnce();
    /* The shell routes; it does not own an exam screen (`ADR-0005`). */
    expect(at('exam-start')).toBeNull();
  });

  it('relabels the one control when an exam is left unfinished', () => {
    const { shell, at } = mount({ onOpenExam: () => undefined });
    shell.start();
    expect(at('title-exam')?.textContent).toBe('Practice exam');
    shell.setExamUnfinished(true);
    expect(at('title-exam')?.textContent).toBe('Finish your exam');
  });

  it('opens on the unfinished label when the save already had one', () => {
    const { shell, at } = mount({ onOpenExam: () => undefined, examUnfinished: true });
    shell.start();
    expect(at('title-exam')?.textContent).toBe('Finish your exam');
  });
});

describe('settings, opened from a screen the caller owns', () => {
  it('calls back when it closes, so an exam clock can carry on', () => {
    /* `TN-TIMER-03`: the clock is paused for exactly as long as Settings is
       open, and the only place that knows when it closes is the shell. */
    const closed = vi.fn();
    const { shell, at } = mount();
    shell.start();
    shell.openSettings(closed);
    expect(at('settings-screen')?.hidden).toBe(false);
    expect(closed).not.toHaveBeenCalled();
    at('settings-close')?.click();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('calls back once, not again the next time Settings is opened', () => {
    const closed = vi.fn();
    const { shell, at } = mount();
    shell.start();
    shell.openSettings(closed);
    at('settings-close')?.click();
    shell.openSettings();
    at('settings-close')?.click();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('gives the page back to whatever was over it, not to the shell', () => {
    /*
     * Settings can be opened from over another modal — the exam's own menu — and
     * clearing the modal flag on close would bring the shell's switch ring back
     * under a dialog that is still on the page.
     */
    const { shell, store, page, at } = mount();
    shell.start();
    store.set('singleSwitch', true);
    shell.setModalOpen(true);
    const ringWhileModal = page.doc.listenerCount('pointerdown');
    shell.openSettings();
    at('settings-close')?.click();
    expect(page.doc.listenerCount('pointerdown')).toBe(ringWhileModal);
  });
});
