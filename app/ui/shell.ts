/**
 * The shell — the route through the game, and the one thing `app/bootstrap`
 * mounts to make every other screen in this directory reachable.
 *
 * `docs/stories/TN-FLOW-first-run-and-return.md` is the acceptance criteria;
 * `TN-TITLE-title-screen.md` and `TN-MAP-level-select.md` own the two screens it
 * routes between.
 *
 * ```
 * cold load ─► title ─┬─ first run ──► creator ──► level select ──► level
 *                     ├─ returning ──► Continue ─────────────────► level
 *                     ├─ returning ──► Choose a level ──────────► level select ──► level
 *                     ├─ Study
 *                     └─ Settings
 *
 * back:  level ──► level select ──► title
 * ```
 *
 * One rule holds the diagram together and is enforced here rather than promised:
 * **back always goes one step up the route, and never further.**
 *
 * ## Why it exists
 *
 * Slice 1 built a character creator, a HUD, a menu, dialogue, a question card,
 * Study, settings, a POI card and two level screens, and wired none of them to
 * anything: the only route into a level was a `?level=` URL parameter, so a
 * visitor who typed the address read "there is no level to play yet" and had
 * nothing to press. The screens were not the missing part. The *door* was.
 *
 * ## The seam with `app/bootstrap`
 *
 * `app/bootstrap` is the composition root and the only place concretes are wired
 * (ADR-0005), so nothing here constructs a renderer, reads a save, or decides
 * which levels are unlocked. All three arrive as data, and a level transition is
 * two calls:
 *
 *   const shell = createShell(uiHost, { ...deps, onPlayLevel: (id) => { ... } });
 *   shell.start();                  // cold load: the title screen
 *   // ... onPlayLevel fires ...
 *   shell.enterLevel(id);           // BEFORE the HUD is created: see below
 *   // ... the player leaves the level ...
 *   shell.leaveLevel();             // back to the level select, focused on that card
 *
 * **`enterLevel` before the HUD, `leaveLevel` after the HUD is destroyed.** The
 * shell's root *is* the page's `<main>` while the shell is showing, and
 * `createHud` makes a second `<main>` for the level. Two of them on one page is
 * an axe `landmark-one-main` violation and a real ambiguity for a screen-reader
 * user. `enterLevel` therefore **detaches** the shell's root from the document —
 * not `hidden`, detached, which is also `TN-FLOW-08`'s "a screen that has been
 * left is removed, not merely hidden behind a style rule" — and `leaveLevel`
 * puts it back with its state intact.
 *
 * ## Copy
 *
 * Every string these screens draw is a row in `app/ui/copy.ts`, transcribed from
 * `TN-TITLE`, `TN-MAP`, `TN-FLOW` and `TN-LEVELS`' copy tables. This module
 * takes none as an option, because none of it is a caller's to word.
 *
 * DOM only (ADR-0005): no adapters, no scenes, no Phaser.
 */

import type { LevelId } from '@domain/ids';

import {
  createCharacterCreator,
  type CharacterCreator,
  type CharacterSelection,
  type CreatorSlot,
} from './character-creator';
import { text, type UiLocale } from './copy';
import { createLevelSelect, type LevelSelect, type MapEntry } from './level-select';
import { injectScreenStyles } from './screen-styles';
import { createSettingsScreen, type SettingsScreen } from './settings-screen';
import { createStorageWarning, type StorageWarning } from './storage-warning';
import { createSwitchRing, type SwitchRing } from './single-switch';
import { type SettingsStore } from './settings';
import { createTitleScreen, type TitleScreen } from './title-screen';

/** Which of the three surfaces in front of the game is showing. */
export type ShellView = 'title' | 'creator' | 'level-select';

/** The character creator's content, per language. Names are content, not copy. */
export interface ShellCreatorOptions {
  readonly slots: Readonly<Record<UiLocale, readonly CreatorSlot[]>>;
  /** `true` on a first run: Play goes through the creator before the map. */
  readonly required: boolean;
  /** A saved character, so a returning player is not re-randomised. */
  readonly initialSelection?: CharacterSelection;
}

export interface ShellOptions {
  /** The live settings, shared with every screen. Locale changes are followed. */
  readonly store: SettingsStore;
  /** The ten map entries, in map order (`TN-MAP-01`). */
  readonly entries: readonly MapEntry[];
  /** `unlockRules.stampsToUnlockNext`, for a locked card with no other answer. */
  readonly stampsToUnlock: number;
  readonly creator?: ShellCreatorOptions;
  /**
   * The level the game recorded when one last became ready. `null` — or an id
   * this build has no document for — means no Continue is offered and the
   * returning player is given "Choose a level" instead (`TN-TITLE-04`).
   */
  readonly resumeLevelId?: LevelId | null;
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /** The player chose a level. The composition root loads it. */
  readonly onPlayLevel: (id: LevelId) => void;
  /** `character/created`. The composition root saves it. */
  readonly onCreateCharacter?: (selection: CharacterSelection) => void;
  /**
   * Study, from the title screen. The composition root owns the study screen (it
   * needs the scheduler), mounts it into {@link Shell.main}, and brackets it
   * with {@link Shell.setModalOpen} so the shell's switch ring stands down.
   * Absent hides the item rather than offering a control that does nothing.
   */
  readonly onOpenStudy?: () => void;
  /** `TN-TITLE-04`: storage is blocked, and the warning belongs on this screen. */
  readonly onExportSave?: () => void;
  readonly now?: () => number;
  readonly random?: () => number;
}

/** What the map should do with the player who has just come out of a level. */
export interface LeaveLevelOptions {
  /**
   * Land on this card instead of the one the level was.
   *
   * `TN-FLOW-03` puts the player back on the card they just left, and that is
   * right for every ordinary exit. It is wrong exactly once: when finishing the
   * level **opened another one**, the news is the new card, and focusing the old
   * one leaves the player looking at a level they have already done while the
   * thing that changed is somewhere below the fold. The caller decides — the
   * shell is handed a `MapEntry` list and never derives an unlock (`TN-MAP`).
   *
   * A card this build does not have falls back to the ordinary behaviour rather
   * than to the top of the list.
   */
  readonly focusLevelId?: LevelId;
}

export interface Shell {
  /** The page's one `<main>` while the shell is showing. */
  readonly element: HTMLElement;
  /** The same node, named for what a caller does with it: mount a modal. */
  readonly main: HTMLElement;
  /** The view on screen, or `null` while a level has the page. */
  readonly view: ShellView | null;
  /** Cold load: the title screen, focused on its primary control. */
  readonly start: () => void;
  /** Move to a view, put focus in it, and announce it once. */
  readonly show: (view: ShellView) => void;
  /** A level has the page now. Call **before** the HUD is created. */
  readonly enterLevel: (id: LevelId) => void;
  /** The level is gone. Call **after** the HUD is destroyed. */
  readonly leaveLevel: (options?: LeaveLevelOptions) => void;
  /** Progress changed: redraw which levels are open. */
  readonly setEntries: (entries: readonly MapEntry[]) => void;
  /** A save was read, or a level became ready: offer or withdraw Continue. */
  readonly setResumeLevelId: (id: LevelId | null) => void;
  /** A character was created, or found in a save: the creator step is done. */
  readonly setCharacterRequired: (required: boolean) => void;
  /** `TN-TITLE-04`: this browser is not saving. Raised on the title screen. */
  readonly setStorageWarning: (raised: boolean) => void;
  /**
   * A modal the *caller* mounted into {@link Shell.main} opened or closed. Two
   * enabled switch rings both answer "tap anywhere", so the shell's stands down
   * while another surface owns the page. The shell brackets its own settings
   * screen; a caller brackets Study.
   */
  readonly setModalOpen: (open: boolean) => void;
  readonly destroy: () => void;
}

const SHELL_ID = 'tn-shell';

/**
 * What the switch ring walks.
 *
 * The default ring selector skips `[aria-disabled="true"]`, which is right
 * everywhere else and wrong here: `TN-MAP-08` requires the highlight to visit
 * **all ten cards**, including the ones that cannot be opened, and requires a
 * long press on one to say why. A switch user who could not reach those cards
 * would be the only player who cannot find out what the rest of the game is.
 */
const RING_ITEM_SELECTOR = [
  'button:not([disabled])',
  '[role="radio"]',
  '[role="switch"]',
  'input:not([disabled]):not([type="hidden"])',
  'a[href]',
].join(',');

export function createShell(host: HTMLElement, options: ShellOptions): Shell {
  const doc = host.ownerDocument;
  injectScreenStyles(doc);

  const store = options.store;
  let entries = options.entries;
  let resumeLevelId: LevelId | null = options.resumeLevelId ?? null;
  let characterRequired = options.creator?.required === true;
  let selection: CharacterSelection | undefined = options.creator?.initialSelection;
  let view: ShellView | null = null;
  let modalOpen = false;
  let storageBlocked = false;
  let lastLevelId: LevelId | null = null;

  let title: TitleScreen | null = null;
  let creator: CharacterCreator | null = null;
  let levelSelect: LevelSelect | null = null;
  let settings: SettingsScreen | null = null;
  let warning: StorageWarning | null = null;

  /*
   * `<main>`, and `tn-screen` for the presentation every surface in this
   * directory shares — the 44 pt controls, the focus ring that is a change of
   * geometry, the reduced-motion and high-contrast rules. It is a landmark and
   * not a dialog: nothing sits behind it to be modal over, and a focus trap on
   * the page's own content is a keyboard trap (`TN-TITLE-05`).
   */
  const main = doc.createElement('main');
  main.id = SHELL_ID;
  main.className = 'tn-screen tn-shell';
  main.setAttribute('data-testid', 'shell');
  main.setAttribute('lang', store.current.locale);
  host.append(main);

  /* Above the view, because `TN-TITLE-04` requires it not to cover any control
     and not to be something the player has to dismiss to reach the way in. */
  const warningSlot = doc.createElement('div');
  warningSlot.className = 'tn-shell__warning';
  main.append(warningSlot);

  const ring: SwitchRing = createSwitchRing(main, {
    holdMs: () => store.current.holdToChooseMs,
    itemSelector: RING_ITEM_SELECTOR,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
  });

  const unsubscribe = store.subscribe((next, changed) => {
    if (changed === 'locale') {
      main.setAttribute('lang', next.locale);
      title?.setLocale(next.locale);
      levelSelect?.setLocale(next.locale);
      creator?.setLocale(next.locale, slotsFor(next.locale));
      warning?.setLocale(next.locale);
    }
    syncRing();
  });

  function slotsFor(locale: UiLocale): readonly CreatorSlot[] {
    return options.creator?.slots[locale] ?? [];
  }

  /** The ring is on only when single-switch is on, a view is up, and it owns the page. */
  function syncRing(): void {
    const wanted = store.current.singleSwitch && view !== null && !modalOpen && main.isConnected;
    if (!wanted) {
      ring.disable();
      return;
    }
    if (!ring.enabled) ring.enable();
    ring.refresh();
    /*
     * Where the highlight starts, and it is not always item one.
     *
     * `TN-FLOW-07` says the highlight starts at the screen's first item and does
     * not move until the player presses the switch. `TN-FLOW-01` says the map
     * opens with the *open* card ready to take, and names the long press as one
     * of the three ways to take it. Both are satisfied by starting the highlight
     * where the view put focus: on the title screen that is the primary control,
     * which is item one, and on the map it is the one card that can be opened.
     * A switch user who had to walk past three closed cards to reach the only
     * open one would be paying for the nine levels that do not exist yet.
     */
    if (ring.index === -1) {
      const focused = doc.activeElement as HTMLElement | null;
      const at = focused === null ? -1 : ring.items.indexOf(focused);
      ring.highlight(at === -1 ? 0 : at);
    }
  }

  function clearView(): void {
    title?.destroy();
    creator?.destroy();
    levelSelect?.destroy();
    title = null;
    creator = null;
    levelSelect = null;
  }

  function openSettings(): void {
    settings ??= createSettingsScreen(main, {
      store,
      ...(options.announce === undefined ? {} : { announce: options.announce }),
      onClose: () => {
        settings?.hide();
        setModalOpen(false);
      },
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    setModalOpen(true);
    settings.show();
  }

  function setModalOpen(open: boolean): void {
    modalOpen = open;
    syncRing();
  }

  /** The route Play takes: through the creator on a first run, else to the map. */
  function play(): void {
    show(characterRequired && options.creator !== undefined ? 'creator' : 'level-select');
  }

  function buildTitle(): void {
    title = createTitleScreen(main, {
      locale: store.current.locale,
      routes: routesOf(),
      ...(options.onOpenStudy === undefined ? {} : { onOpenStudy: options.onOpenStudy }),
      onOpenSettings: openSettings,
    });
  }

  /**
   * Which ways in are true for this player.
   *
   * A returning player is one who has a character; a resumable level is one the
   * caller named *and* the map has a built entry for, because `TN-TITLE-04`
   * requires Continue to be absent when the saved level is not in this build —
   * and requires no error to be shown for it, "because nothing is wrong with my
   * game".
   */
  function routesOf(): Parameters<typeof createTitleScreen>[1]['routes'] {
    if (characterRequired) return { kind: 'first-run', onPlay: play };

    const resume = resumableEntry();
    return {
      kind: 'returning',
      ...(resume === null
        ? {}
        : {
            resume: {
              levelTitle: resume.title,
              onContinue: (): void => {
                options.onPlayLevel(resume.id);
              },
            },
          }),
      onChooseLevel: () => {
        show('level-select');
      },
    };
  }

  function resumableEntry(): { readonly id: LevelId; readonly title: string } | null {
    if (resumeLevelId === null) return null;
    const entry = entries.find((candidate) => candidate.id === resumeLevelId);
    if (entry === undefined || !entry.built) return null;
    const key = `level.${String(entry.id ?? entry.number)}.title` as Parameters<typeof text>[1];
    const levelTitle = text(store.current.locale, key);
    if (levelTitle === undefined) return null;
    return { id: resumeLevelId, title: levelTitle };
  }

  function buildCreator(): void {
    const locale = store.current.locale;
    creator = createCharacterCreator(main, {
      slots: slotsFor(locale),
      locale,
      ...(options.announce === undefined ? {} : { announce: options.announce }),
      ...(selection === undefined ? {} : { initialSelection: selection }),
      ...(options.random === undefined ? {} : { random: options.random }),
      ...(options.now === undefined ? {} : { now: options.now }),
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      motion: store.current.reducedMotion ? 'reduced' : 'full',
      onChange: (next) => {
        selection = next;
      },
      onStart: (next) => {
        selection = next;
        characterRequired = false;
        options.onCreateCharacter?.(next);
        /* The creator hands to the map, not straight to a level: the map is
           where a player learns this is a journey with ten places and that nine
           are still being made (`TN-FLOW`, seam 2). */
        show('level-select');
      },
      onOpenSettings: openSettings,
    });
    creator.show();
  }

  function buildLevelSelect(): void {
    levelSelect = createLevelSelect(main, {
      locale: store.current.locale,
      entries,
      stampsToUnlock: options.stampsToUnlock,
      ...(options.announce === undefined ? {} : { announce: options.announce }),
      onChoose: (id) => {
        options.onPlayLevel(id);
      },
      onBack: () => {
        show('title');
      },
    });
  }

  function build(next: ShellView): void {
    clearView();
    view = next;
    if (next === 'title') buildTitle();
    else if (next === 'creator') buildCreator();
    else buildLevelSelect();
  }

  /**
   * Put focus in the new view and say where the player is, once.
   *
   * A view swap is this game's equivalent of a page navigation, and focus left
   * on a control that no longer exists falls to the body — which is where a
   * keyboard user loses their place and a screen reader goes quiet
   * (`TN-FLOW-06`). The creator is the exception: it is a dialog with its own
   * focus trap, which has already put focus inside itself and which a screen
   * reader reads on arrival, so announcing it as well would say it twice.
   */
  function land(): void {
    if (title !== null) {
      title.focus();
      options.announce?.(title.arrivalMessage);
      return;
    }
    if (levelSelect !== null) {
      levelSelect.focus();
      options.announce?.(levelSelect.arrivalMessage);
    }
  }

  function show(next: ShellView): void {
    build(next);
    applyWarning();
    land();
    syncRing();
  }

  /** The warning belongs on the title screen, and only there (`TN-TITLE-04`). */
  function applyWarning(): void {
    if (!storageBlocked || view !== 'title') {
      warning?.destroy();
      warning = null;
      return;
    }
    warning ??= createStorageWarning(warningSlot, {
      locale: store.current.locale,
      ...(options.announce === undefined ? {} : { announce: options.announce }),
      ...(options.onExportSave === undefined ? {} : { onExport: options.onExportSave }),
    });
    warning.raise();
  }

  return {
    element: main,
    main,
    get view(): ShellView | null {
      return view;
    },

    start(): void {
      show('title');
    },

    show,

    enterLevel(id): void {
      lastLevelId = id;
      view = null;
      ring.disable();
      settings?.hide();
      modalOpen = false;
      /* Detached, not hidden: a hidden `<main>` is still one CSS rule away from
         being a second landmark, and `TN-FLOW-08` requires a screen that has
         been left to be removed rather than hidden behind a style rule. */
      main.remove();
    },

    leaveLevel(leaving): void {
      if (!main.isConnected) host.append(main);
      build('level-select');
      applyWarning();

      /*
       * The card that just opened, when there is one, and the card they just
       * left otherwise (`TN-FLOW-03`).
       *
       * The announcement differs with it, and that is the point rather than a
       * detail. Landing on the level just played says the screen's name and how
       * much of the game is ready — the arrival message, which is what a player
       * returning to the map needs. Landing on a level that has just *opened*
       * has to say **that card**: its place, that it is open, and that it can be
       * played now. `TN-MAP-03`: "it is announced as open when I reach it."
       */
      const opened = leaving?.focusLevelId;
      if (opened !== undefined && levelSelect?.focusLevel(opened) === true) {
        const described = levelSelect.describe(opened);
        options.announce?.(described ?? levelSelect.arrivalMessage);
        syncRing();
        return;
      }

      const landed = lastLevelId !== null && levelSelect?.focusLevel(lastLevelId) === true;
      if (landed) options.announce?.(levelSelect?.arrivalMessage ?? '');
      else land();
      syncRing();
    },

    setEntries(next): void {
      entries = next;
      levelSelect?.setEntries(next);
      title?.setRoutes(routesOf());
      syncRing();
    },

    setResumeLevelId(id): void {
      resumeLevelId = id;
      title?.setRoutes(routesOf());
      syncRing();
    },

    setCharacterRequired(required): void {
      characterRequired = required;
      title?.setRoutes(routesOf());
      syncRing();
    },

    setStorageWarning(raised): void {
      storageBlocked = raised;
      applyWarning();
      syncRing();
    },

    setModalOpen,

    destroy(): void {
      unsubscribe();
      ring.destroy();
      clearView();
      warning?.destroy();
      warning = null;
      settings?.destroy();
      settings = null;
      view = null;
      main.remove();
    },
  };
}
