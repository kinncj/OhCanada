/**
 * The lower-third HUD: what the player is doing, what their task is, what they
 * can engage, and the way to everything else.
 *
 * `TN-HUD-hud-and-menu.md` is the acceptance criteria. This file also settles
 * the page's landmarks, which is not a detail — see *Landmarks* below.
 *
 * **Copy.** Everything drawn here is defined in a story table and referenced,
 * never copied: `hud.label`, `hud.menu`, `hud.task`, `common.settings`,
 * `study.open`, `passport.open`, `common.close`, `storage.warning`. The two
 * strings that vary per level — the mode label (`locomotion.<mode>.label`) and
 * the quest step (`quest.step.*`) — arrive as data, because the level and the
 * quest own them.
 *
 * `hud.label`, the accessible name of the region, used to be a required option
 * because no table carried it (`TN-COPY-06`). `TN-HUD` writes it down now, so
 * the region reads the row like every other string it draws, and the option is
 * gone. That is the stronger guarantee, not the weaker one: a caller could not
 * omit the name before, but it could pass "HUD" or "Section", which `TN-HUD`'s
 * table names as defects — and a caller-supplied name could not become French
 * on a language change without a reload, which `TN-HUD-09` requires.
 *
 * **Landmarks.** `TN-HUD-07` requires the page to have exactly one `<main>`,
 * with the `aria-hidden` canvas inside it and `hud` as a named region — and it
 * requires axe's `region` and `landmark-one-main` rules, disabled while the
 * screens were scanned alone over a canvas, to be turned back on. This module
 * builds that page: {@link createHud} creates the `<main>` (once — a second HUD
 * reuses it) and will adopt the canvas host into it when the caller passes one,
 * which is the composition root's decision to make, not this file's.
 *
 * **Input.** The HUD is chrome, not a play control (`OQ-HUD-1`). The region and
 * its rows are `pointer-events: none` and only the controls opt back in, so a
 * hold on the play area behind the strip reaches the level and activates
 * nothing here (`TN-HUD-01`, last scenario).
 *
 * DOM only (ADR-0005): no adapters, no scenes.
 */

import { labelled, text, type UiLocale } from './copy';
import { button, element } from './dom';
import { createMenu, type Menu } from './menu';
import { injectScreenStyles } from './screen-styles';
import { createStorageWarning, type StorageWarning } from './storage-warning';

export interface HudOptions {
  readonly locale: UiLocale;
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /** Opening the menu pauses the level (`TN-HUD-02`). */
  readonly onPause?: () => void;
  /** The menu was dismissed without choosing anything: the level resumes. */
  readonly onResume?: () => void;
  readonly onOpenSettings?: () => void;
  readonly onOpenStudy?: () => void;
  readonly onOpenPassport?: () => void;
  /** `flow.leaveLevel`: the route out of the level (`TN-FLOW-03`, `TN-HUD-02`). */
  readonly onLeaveLevel?: () => void;
  /** Tapping `interact-prompt` does what tapping the target does (`TN-LEVEL-05`). */
  readonly onInteract?: () => void;
  /** `TN-HUD-03`: the way out the warning has to offer. */
  readonly onExportSave?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
  /**
   * The element holding the `aria-hidden` canvas. Given one, the HUD moves it
   * inside `<main>` so the page has the structure `TN-HUD-07` describes.
   */
  readonly canvasHost?: HTMLElement;
}

export interface Hud {
  /** The `hud` region. */
  readonly element: HTMLElement;
  /** The page's one `<main>`. */
  readonly main: HTMLElement;
  readonly menu: Menu;
  /** `interact-prompt`, or `null` when nothing is in reach. */
  readonly prompt: HTMLElement | null;
  /** `hud-mode-label`: "Skating" / « Patinage ». Already localised. */
  setMode(label: string): void;
  /** `hud-quest-tracker`. `null` removes it: there is no task (`TN-HUD-01`). */
  setTask(step: string | null): void;
  /** `interact-prompt`. `null` withdraws the offer (`TN-LEVEL-05`). */
  setPrompt(label: string | null): void;
  /**
   * `interact-hint`: the one-time explanation of the marks (`TN-REACH-04`).
   *
   * `null` removes it, and removal is permanent in practice because the caller
   * decides it is shown once per sitting. Drawn **beside** the prompt, never
   * instead of it, and as a paragraph rather than a control: it blocks nothing,
   * takes no focus, is not in the Tab order and is not in the switch ring.
   */
  setHint(message: string | null): void;
  /**
   * `hud-notice`: something the game cannot do right now, said in the strip.
   *
   * `TN-QUEST-05` — "the questions are not ready right now" — needs a *visible*
   * sentence as well as an announcement: every sound has a visual equivalent
   * (CLAUDE.md), and a live-region message with nothing on screen is audible to
   * one player and invisible to every other. It is a paragraph and not a dialog,
   * because the story requires the skater to be able to move away: nothing is
   * blocked, nothing takes focus and nothing has to be dismissed.
   *
   * `null` removes it. Already localised — the caller owns the wording, as it
   * does for the tracker and the prompt.
   */
  setNotice(message: string | null): void;
  setStorageWarning(raised: boolean): void;
  /**
   * Put focus in the level, on arrival from the map (`TN-FLOW-06`).
   *
   * A view swap is this game's page navigation, and focus left on a control that
   * has just been detached falls to the body — which is where a keyboard user
   * loses their place and a screen reader goes quiet. The target is the one
   * `<main>`, not the menu button: the player arrived to *play*, and landing
   * them on the way out would make the first Tab press an exit.
   */
  focus(): void;
  openMenu(): void;
  closeMenu(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

const MAIN_ID = 'tn-main';

export function createHud(host: HTMLElement, options: HudOptions): Hud {
  const doc = host.ownerDocument;
  injectScreenStyles(doc);

  let locale = options.locale;
  let mode = '';
  let task: string | null = null;
  let promptLabel: string | null = null;
  let hint: string | null = null;
  let notice: string | null = null;

  const main = findOrCreateMain(doc, host);
  /*
   * The canvas belongs inside the one `<main>`, and it is `aria-hidden`, so it
   * contributes nothing to the accessibility tree either way — what it changes
   * is that `<main>` is real content rather than a wrapper invented to satisfy a
   * scanner. Whether to hand it over is the composition root's call.
   */
  if (options.canvasHost !== undefined && options.canvasHost.parentElement !== main) {
    main.append(options.canvasHost);
  }

  const modeLabel = element(doc, 'p', {
    testId: 'hud-mode-label',
    className: 'tn-hud__mode',
  });
  /*
   * `TN-MOVE-02`: the strip is "either absent from the accessibility tree or has
   * non-empty text", and "never present with an empty string". Until a level
   * says how the player moves there is nothing to say, and an empty paragraph is
   * the worst way to say it: no box for a sighted player, nothing at all for a
   * screen reader, and a `toBeVisible` assertion that fails on a missing word
   * rather than on a missing element. Hidden until {@link Hud.setMode}, never
   * filled with the mode's id, "Mode" or a dash.
   */
  modeLabel.hidden = true;

  /* The status rows: text only, no `aria-live` of their own (`TN-HUD-07`). A
     change to either is announced once, through the one live region. */
  const status = element(doc, 'div', {
    className: 'tn-hud__status',
    children: [modeLabel],
  });

  const warningSlot = element(doc, 'div', { className: 'tn-hud__slot' });
  /* The hint has a slot of its own, above the prompt's, rather than sharing one:
     an explanation read before the offer is the order they are useful in, and
     two slots keep that true however either of them arrives. */
  const hintSlot = element(doc, 'div', { className: 'tn-hud__slot' });
  const noticeSlot = element(doc, 'div', { className: 'tn-hud__slot' });
  const promptSlot = element(doc, 'div', { className: 'tn-hud__slot' });

  /*
   * Settings, on the strip, beside Menu.
   *
   * It was reachable before this — Menu, then "Settings" — and it was reported
   * as unreachable, which is the same defect this project keeps finding: a
   * capability that exists and is not *offered*. `TN-SET-01` asks for settings
   * "from the game", `TN-HUD-02` keeps the menu's item, and a player who does
   * not know a menu contains it has to open the menu to find out. Two controls
   * on the strip is the cheapest way to make the answer visible, and it costs
   * the menu nothing: the item stays, both routes open the same screen, and
   * closing it returns focus to whichever control opened it.
   *
   * Drawn only when the caller wired one, like every other item here: a Settings
   * button that opens nothing is worse than no button.
   */
  const settingsButton = button(doc, {
    testId: 'hud-settings-button',
    className: 'tn-hud__settings-button',
    text: text(locale, 'common.settings'),
    ...(options.onOpenSettings === undefined ? {} : { onClick: options.onOpenSettings }),
  });
  settingsButton.hidden = options.onOpenSettings === undefined;

  const menuButton = button(doc, {
    testId: 'menu-button',
    className: 'tn-hud__menu-button',
    text: text(locale, 'hud.menu'),
    onClick: () => openMenu(),
  });

  /* One row, wrapping to two when the text is large enough that two words do
     not share a 390 px line. */
  const controls = element(doc, 'div', {
    className: 'tn-hud__controls',
    children: [settingsButton, menuButton],
  });

  /*
   * `<section>` with an accessible name is a `region` landmark, which is what
   * `TN-HUD-07` asks for by name. Every piece of visible text the HUD draws is
   * inside it, so axe's `region` rule has nothing left outside a landmark.
   */
  const region = element(doc, 'section', {
    testId: 'hud',
    className: 'tn-hud',
    attrs: { 'aria-label': text(locale, 'hud.label') },
    children: [status, warningSlot, noticeSlot, hintSlot, promptSlot, controls],
  });
  main.append(region);

  const warning: StorageWarning = createStorageWarning(warningSlot, {
    locale,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    ...(options.onExportSave === undefined ? {} : { onExport: options.onExportSave }),
  });

  /*
   * The menu is mounted on `host`, beside `<main>` rather than inside it. That
   * is what lets its focus trap make the whole page — HUD included — inert while
   * it is open, which is `TN-HUD-04`'s "menu-button is not reachable with Tab"
   * and "tapping where menu-button is does not open the menu", with no state of
   * our own to keep in step.
   */
  const menu: Menu = createMenu(host, {
    locale,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    ...(options.onOpenSettings === undefined ? {} : { onOpenSettings: options.onOpenSettings }),
    ...(options.onOpenStudy === undefined ? {} : { onOpenStudy: options.onOpenStudy }),
    ...(options.onOpenPassport === undefined ? {} : { onOpenPassport: options.onOpenPassport }),
    ...(options.onLeaveLevel === undefined ? {} : { onLeaveLevel: options.onLeaveLevel }),
    onDismiss: () => {
      options.onResume?.();
    },
    singleSwitch: options.singleSwitch === true,
    holdMs: options.holdMs ?? 600,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  function openMenu(): void {
    menu.open();
    options.onPause?.();
  }

  function say(message: string): void {
    options.announce?.(message, locale);
  }

  function renderTask(): void {
    const existing = trackerElement();
    if (task === null) {
      /* Removed, not hidden: `TN-HUD-01`, "the tracker appears only when there
         is a task". A hidden tracker is one stylesheet away from being visible
         and one screen reader away from being read. */
      existing?.remove();
      return;
    }
    const wording = labelled(locale, text(locale, 'hud.task'), task);
    if (existing !== null) {
      existing.textContent = wording;
      return;
    }
    status.append(
      element(doc, 'p', {
        testId: 'hud-quest-tracker',
        className: 'tn-hud__task',
        text: wording,
      }),
    );
  }

  function trackerElement(): HTMLElement | null {
    return status.querySelector<HTMLElement>('[data-testid="hud-quest-tracker"]');
  }

  function renderPrompt(): void {
    const existing = promptElement();
    if (promptLabel === null) {
      existing?.remove();
      return;
    }
    if (existing !== null) {
      existing.textContent = promptLabel;
      return;
    }
    promptSlot.append(
      button(doc, {
        testId: 'interact-prompt',
        className: 'tn-hud__prompt',
        text: promptLabel,
        ...(options.onInteract === undefined ? {} : { onClick: options.onInteract }),
      }),
    );
  }

  /**
   * The hint, above the prompt.
   *
   * Removed rather than hidden, for the reason the tracker is: `TN-REACH-04`
   * requires it to be absent from the accessibility tree once the player has
   * engaged anything, and a hidden element is one stylesheet away from being
   * visible and one screen reader away from being read.
   *
   * It has a slot of its own above the prompt's, so the explanation is read
   * first and the offer last whichever of the two arrives first.
   */
  function renderHint(): void {
    const existing = hintElement();
    if (hint === null) {
      existing?.remove();
      return;
    }
    if (existing !== null) {
      existing.textContent = hint;
      return;
    }
    hintSlot.append(
      element(doc, 'p', {
        testId: 'interact-hint',
        className: 'tn-hud__hint',
        text: hint,
      }),
    );
  }

  function hintElement(): HTMLElement | null {
    return hintSlot.querySelector<HTMLElement>('[data-testid="interact-hint"]');
  }

  function renderNotice(): void {
    const existing = noticeSlot.querySelector<HTMLElement>('[data-testid="hud-notice"]');
    if (notice === null) {
      existing?.remove();
      return;
    }
    if (existing !== null) {
      existing.textContent = notice;
      return;
    }
    noticeSlot.append(
      element(doc, 'p', {
        testId: 'hud-notice',
        className: 'tn-hud__notice',
        text: notice,
      }),
    );
  }

  function promptElement(): HTMLElement | null {
    return promptSlot.querySelector<HTMLElement>('[data-testid="interact-prompt"]');
  }

  return {
    element: region,
    main,
    menu,
    get prompt(): HTMLElement | null {
      return promptElement();
    },

    setMode(label): void {
      if (label === mode) return;
      /* The first value is the state the player arrived in, not a change, and
         the arrival announcement (`announce.arrived.ottawa`) already carries it:
         "You are on the Rideau Canal in Ottawa. Skating." Speaking it again here
         would be the same word twice, from two speakers neither of which knows
         about the other. A later change — skate to walk — is news and is said. */
      const first = mode === '';
      mode = label;
      modeLabel.textContent = label;
      modeLabel.hidden = label === '';
      if (!first) say(label);
    },

    setTask(step): void {
      if (step === task) return;
      task = step;
      renderTask();
      if (step !== null) say(labelled(locale, text(locale, 'hud.task'), step));
    },

    setPrompt(label): void {
      if (label === promptLabel) return;
      promptLabel = label;
      renderPrompt();
      /* Deliberately silent. `app/ui/level-events.ts` announces the offer when
         the target comes into reach; announcing here as well would say it
         twice, and neither speaker would know the other had. */
    },

    setHint(message): void {
      if (message === hint) return;
      hint = message;
      renderHint();
      /* Deliberately silent, like `setPrompt`: `TN-REACH-04` allows the hint to
         be announced at most once, and the caller is the only thing that knows
         whether this is that once. */
    },

    setNotice(message): void {
      if (message === notice) return;
      notice = message;
      renderNotice();
      /* Deliberately silent: the caller announces it once, at the moment the
         thing it is about happened, and a second speaker here would say it
         twice. */
    },

    setStorageWarning(raised): void {
      if (raised) warning.raise();
      else warning.clear();
    },

    focus(): void {
      main.focus();
    },

    openMenu,

    closeMenu(): void {
      menu.close();
    },

    setLocale(next): void {
      locale = next;
      region.setAttribute('lang', next);
      /* `TN-HUD-09`: the region's name changes with the language, without the
         level reloading. */
      region.setAttribute('aria-label', text(next, 'hud.label'));
      menuButton.textContent = text(next, 'hud.menu');
      settingsButton.textContent = text(next, 'common.settings');
      renderTask();
      /* The hint is the caller's string in the caller's language, so it is
         re-supplied rather than translated here; what this does is keep whatever
         is on screen consistent when the strip is redrawn. */
      renderHint();
      renderNotice();
      warning.setLocale(next);
      menu.setLocale(next);
    },

    setSingleSwitch(enabled, holdMs): void {
      menu.setSingleSwitch(enabled, holdMs);
    },

    destroy(): void {
      menu.destroy();
      warning.destroy();
      region.remove();
    },
  };
}

/**
 * One `<main>` per page (`landmark-one-main`). A second HUD — a level reloading
 * over an old one — finds the first rather than adding a landmark that makes the
 * rule fail.
 */
function findOrCreateMain(doc: Document, host: HTMLElement): HTMLElement {
  const existing = doc.getElementById(MAIN_ID);
  if (existing !== null) return existing;

  const main = element(doc, 'main', { id: MAIN_ID, className: 'tn-main' });
  /* Focusable programmatically, never in the Tab order: `Hud.focus` moves focus
     here when a level takes the page, and a landmark that answered Tab would put
     a stop before every control on the way to the first one. */
  main.tabIndex = -1;
  host.append(main);
  return main;
}
