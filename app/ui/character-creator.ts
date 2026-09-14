/**
 * The character creator — the first screen a new player sees.
 *
 * `docs/stories/TN-CREATOR-character-creator.md` is the acceptance criteria and
 * `docs/content-review.md` §8 constrains what may be on it. Three constraints
 * from that document are structural here, not incidental:
 *
 *  1. **Slot independence (§8.2).** "Every option in every slot is available
 *     with every option in every other slot." There is no API in this module by
 *     which one slot's chosen option could filter another's: {@link optionsOf}
 *     takes a slot and nothing else, and the render reads it that way. Coupling
 *     would have to be *added*, in public, rather than merely permitted.
 *  2. **Nothing is pre-selected (§8.1).** The creator randomises on open. A
 *     slot's `default` is for NPC documents and save recovery and is never
 *     rendered as a pre-chosen option — `OQ-REVIEW-7` is the live conflict with
 *     `CharacterSlot.default`, and this follows the PO's recommendation until the
 *     schema settles it. {@link CreatorSlot} carries no `default` field at all,
 *     so a caller cannot pass one by accident; save recovery comes in through
 *     `initialSelection`.
 *  3. **The randomiser is uniform (§8.3).** One draw per slot, over every option
 *     in that slot, from an injected source so the distribution is testable.
 *
 * Option *names* are content: this module renders whatever the caller gives it
 * and writes none. The names are decided now — `TN-LOOK` and `TN-SKIN` — and
 * they still arrive as data, because the list of slots is the rig's and the
 * composition root is the only place allowed to read it.
 *
 * Two more rules this screen keeps, both from
 * `docs/stories/TN-FIRSTRUN-choosing-a-character-before-playing.md`:
 *
 *  4. **There is no skip, and nothing here is required.** The screen opens on a
 *     complete randomised character with the primary control live. A skip would
 *     have to land somewhere, and the only appearance available without a draw
 *     is each slot's `fallback` — which the rig reserves for NPC documents and
 *     save recovery and says is never a pre-selection. A skip control is a
 *     default player through the back door.
 *  5. **The primary control is named for where it goes.** On the first run it
 *     opens the level select and reads `creator.start`; re-opened from Settings
 *     it returns to Settings and reads `creator.done`. Exactly one of the two
 *     is ever on the page, the same shape as `title-play` against
 *     `title-continue`, so a player is never asked to guess which button keeps
 *     their changes. {@link CharacterCreatorOptions.primary} is that choice and
 *     the two are not separately suppressible.
 *
 * DOM only (ADR-0005).
 */

import { labelled, text, type UiLocale } from './copy';
import {
  button,
  CHOSEN_GLYPH,
  chosenMark,
  element,
  replaceChildren,
  UNCHOSEN_GLYPH,
} from './dom';
import { createScreen, type Screen } from './screen';

/** One choice inside a slot. `name` is already localised by the caller. */
export interface CreatorOption {
  readonly id: string;
  readonly name: string;
  /**
   * A CSS colour drawn above the name, for an option whose content *is* a
   * colour: the six skin ramps. The composition root reads it from the art
   * palette and this module never invents one.
   *
   * It is decoration. The name is still all a screen reader hears, and all
   * high contrast needs to tell six tones apart (`TN-SKIN-05`), so the swatch is
   * `aria-hidden`. What it fixes is the sighted player's problem: six buttons
   * reading "1, light" … "6, dark", with no colour on any of them, is a skin
   * tone picker that shows no skin tones.
   */
  readonly swatch?: string;
}

/**
 * One group of choices. Deliberately flat: an option list, a label, a test id.
 * No `dependsOn`, no `availableWhen`, no `default` — see §8.2 and §8.1 above.
 */
export interface CreatorSlot {
  /** The rig's own slot key, spelled exactly: `hairShape`, never `hair-shape`. */
  readonly id: string;
  /** `slot-skin`, `slot-hair-shape`, `slot-hair-colour`, … (`TN-LOOK-01`). */
  readonly testId: string;
  readonly label: string;
  /**
   * One line under the group's heading that says how to read its options —
   * "From light to dark" on the skin group. Drawn visibly and made the group's
   * accessible description, so the sighted reader and the listener get the
   * same sentence. Absent means the options read on their own.
   */
  readonly help?: string;
  readonly options: readonly CreatorOption[];
}

/**
 * The preview's data hook for a slot: `hairShape` becomes `data-hair-shape`.
 *
 * `TN-CREATOR-01` names the five attributes in kebab case and an HTML attribute
 * name is lower-cased by the parser anyway, so `data-${slot.id}` would have
 * published `data-hairshape` — a hook every test and every renderer would have
 * had to misspell in the same way to find.
 */
export function previewAttribute(slotId: string): string {
  return `data-${slotId.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`)}`;
}

/** Slot id to chosen option id. */
export type CharacterSelection = Readonly<Record<string, string>>;

/** How far the picture got. `failed` hides it and leaves the words (`TN-CREATOR-03`). */
export type CreatorArtState = 'loading' | 'ready' | 'failed';

export interface CreatorArtStatus {
  readonly state: CreatorArtState;
  /**
   * The atlas frames on the picture, back to front. Published as `data-frames`
   * on `character-preview-art`, because pixels are not comparable on a software
   * GPU and a frame name is.
   */
  readonly frames: readonly string[];
}

/** What draws the character into the preview. This screen never knows which renderer it is. */
export interface CreatorArt {
  /** Dress the picture in this selection: called on every change. */
  draw(selection: CharacterSelection): void;
  /** `reduced` is a still pose and no frame loop at all. */
  setMotion(motion: 'reduced' | 'full'): void;
  /** The creator closed: release the canvas, the image and the loop. */
  destroy(): void;
}

export interface CreatorArtRequest {
  readonly selection: CharacterSelection;
  readonly motion: 'reduced' | 'full';
  readonly onStatus: (status: CreatorArtStatus) => void;
}

/**
 * The seam between this screen and whatever draws (ADR-0040). A DOM host and a
 * callback rather than an application port, because its first argument is an
 * element and a port may not name the DOM. The composition root supplies one.
 */
export type CreatorArtFactory = (host: HTMLElement, request: CreatorArtRequest) => CreatorArt;

/**
 * The options a slot offers. It takes the slot and *nothing else* — no current
 * selection, no other slot — which is the mechanical half of "no combination is
 * gated on another" (`docs/content-review.md` §8.2).
 */
export function optionsOf(slot: CreatorSlot): readonly CreatorOption[] {
  return slot.options;
}

/**
 * Draw one option per slot, uniformly. `random` returns [0, 1); pass a seeded
 * source and the draw is replayable. A weighted default player is a statement
 * made in code where nobody reads it (§8.3), so there is no weighting parameter.
 */
export function randomSelection(
  slots: readonly CreatorSlot[],
  random: () => number,
): CharacterSelection {
  const selection: Record<string, string> = {};
  for (const slot of slots) {
    const options = optionsOf(slot);
    if (options.length === 0) continue;
    const index = Math.min(options.length - 1, Math.floor(random() * options.length));
    const option = options[index];
    if (option !== undefined) selection[slot.id] = option.id;
  }
  return selection;
}

export interface CharacterCreatorOptions {
  readonly slots: readonly CreatorSlot[];
  readonly locale: UiLocale;
  /** Save recovery or a returning player. Absent means "randomise on open". */
  readonly initialSelection?: CharacterSelection;
  readonly random?: () => number;
  readonly announce?: (message: string) => void;
  /**
   * Which errand this screen is on, and therefore which primary control it
   * draws: `start` is the first run (`creator.start`, on to the level select)
   * and `done` is Settings (`creator.done`, back to Settings). Defaults to the
   * first run.
   */
  readonly primary?: 'start' | 'done';
  /**
   * `character/created` on the first run, `character/changed` from Settings.
   * The caller saves; which of the two events it is belongs to the caller,
   * because a listener running the first-run route must not be able to fire
   * from Settings (`TN-FIRSTRUN`, ruling 3).
   */
  readonly onStart?: (selection: CharacterSelection) => void;
  readonly onChange?: (selection: CharacterSelection) => void;
  /**
   * Back, one step up the route: the title screen on a first run, Settings
   * when Settings opened this screen. Escape routes here too. Absent draws no
   * control rather than one that goes nowhere — but every mounted route passes
   * it, because `TN-FIRSTRUN-03` requires a way out that saves nothing.
   */
  readonly onBack?: () => void;
  /**
   * A saved option this build no longer has was replaced by a uniform draw, so
   * the player is told, once, on the next screen where they can act on it
   * (`TN-LOOK-05`). Never the rig's `fallback`: the repair is the caller's and
   * this flag only says that one happened.
   */
  readonly optionRepaired?: boolean;
  /**
   * `OQ-SET-1`: the creator is the first screen, and a player who needs
   * one-button mode or 200 % text needs it here. Without this control
   * `TN-CREATOR-05` and `TN-CREATOR-08` describe a state a first-run player
   * cannot reach.
   */
  readonly onOpenSettings?: () => void;
  /** Reduced motion is a request for stillness; the preview never animates under it. */
  readonly motion?: 'reduced' | 'full';
  /**
   * What draws the character beside the words (ADR-0040). Absent draws no
   * picture and no empty box: the preview is the sentence alone, as it was.
   */
  readonly art?: CreatorArtFactory;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface CharacterCreator {
  readonly element: HTMLElement;
  readonly selection: CharacterSelection;
  readonly visible: boolean;
  show(): void;
  hide(): void;
  setLocale(locale: UiLocale, labels: readonly CreatorSlot[]): void;
  setMotion(motion: 'reduced' | 'full'): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  /** `TN-CREATOR-03`: storage refused the character. Not a dead end. */
  showSaveFailure(handlers: { onRetry?: () => void; onContinue?: () => void }): void;
  hideSaveFailure(): void;
  destroy(): void;
}

export function createCharacterCreator(
  host: HTMLElement,
  options: CharacterCreatorOptions,
): CharacterCreator {
  const doc = host.ownerDocument;
  const random = options.random ?? Math.random;
  let slots = options.slots;
  let locale = options.locale;
  let selection: CharacterSelection =
    options.initialSelection ?? randomSelection(slots, random);

  const screen: Screen = createScreen(host, {
    id: 'tn-character-creator',
    testId: 'character-creator',
    /* The picture's layout, and its sticky panel, key off this. */
    className: 'tn-creator',
    locale,
    /* Escape means back, and never means quit (`TN-FIRSTRUN-06`). */
    ...(options.onBack === undefined ? {} : { onEscape: options.onBack }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', {
    id: 'tn-creator-title',
    text: text(locale, 'creator.title'),
  });
  screen.labelledBy(title);

  const intro = element(doc, 'p', {
    id: 'tn-creator-intro',
    className: 'tn-screen__help',
    text: text(locale, 'creator.intro'),
  });
  screen.describedBy(intro);

  /*
   * The preview: a panel headed "Your character" that says, in words, what was
   * chosen in every group (`TN-CREATOR-06`) — and, when the composition root
   * hands this screen something to draw with, shows it (ADR-0040).
   *
   * **The words are the preview and the picture sits beside them.** The panel
   * is a group named by its own visible heading and described by the sentence
   * inside it in every state: while the art loads, once it is drawn, and when it
   * never arrives. The picture is `aria-hidden` and holds no control, so a
   * screen reader, a keyboard and a switch meet exactly the screen they met
   * before there was one.
   *
   * It used to be a `role="img"` box with nothing in it, which was
   * `TN-CREATOR-03`'s "an empty box with no explanation". So a picture that
   * fails is **hidden**, not left as a frame: the words close up and carry the
   * preview alone, as they always could.
   *
   * The `data-*` hooks stay on this element (`TN-CREATOR-01`). The picture's
   * host publishes its own: `data-state` (`loading`, `ready`, `failed`) and
   * `data-frames`, the atlas frames on the picture back to front, which is what
   * the e2e suite reads.
   */
  const previewHeading = element(doc, 'h2', {
    id: 'tn-creator-preview-heading',
    text: text(locale, 'creator.preview.label'),
  });
  const previewText = element(doc, 'p', { id: 'tn-creator-preview-text' });
  const artHost =
    options.art === undefined
      ? null
      : element(doc, 'div', {
          testId: 'character-preview-art',
          className: 'tn-creator__art',
          attrs: { 'aria-hidden': 'true', 'data-state': 'loading', 'data-frames': '' },
        });
  const preview = element(doc, 'div', {
    testId: 'character-preview',
    className: 'tn-screen__preview tn-creator__preview',
    attrs: {
      role: 'group',
      'aria-labelledby': 'tn-creator-preview-heading',
      'aria-describedby': 'tn-creator-preview-text',
      ...(artHost === null ? {} : { 'data-art': 'loading' }),
    },
    children: artHost === null ? [previewHeading, previewText] : [previewHeading, artHost, previewText],
  });
  let motion: 'reduced' | 'full' = options.motion ?? 'full';
  /* Declared before the first `paint`, which hands the picture every change. */
  let art: CreatorArt | null = null;
  let destroyed = false;

  /*
   * `TN-LOOK-05`. A sentence, not a dialog: it does not cover a control, it does
   * not have to be dismissed to reach the primary control, and it is announced
   * once. Absent entirely when no repair happened, so the screen never explains
   * something that did not occur.
   */
  const optionGone = element(doc, 'p', {
    testId: 'creator-option-gone',
    className: 'tn-screen__notice',
    text: text(locale, 'creator.optionGone'),
  });
  optionGone.hidden = options.optionRepaired !== true;

  const groups = new Map<string, HTMLElement>();
  const groupsHost = element(doc, 'div', { className: 'tn-screen__row' });

  const randomiseButton = button(doc, {
    testId: 'randomise-character',
    text: text(locale, 'creator.randomise'),
    onClick: () => {
      selection = randomSelection(slots, random);
      paint();
      options.onChange?.(selection);
      say(describeSelection());
    },
  });

  /*
   * One control, two names, and exactly one `data-testid` on the page
   * (`TN-FIRSTRUN-04`). Built once rather than as two buttons with one hidden:
   * a hidden `start-playing` is still a node a query finds, and "exactly one of
   * `creator-done` and `start-playing` is present in any state of this screen"
   * is the assertion that stops a player being offered two ways to keep a
   * change.
   */
  const primary = options.primary ?? 'start';
  /* The one red action on the screen: it is what carries the player on. */
  const startButton = button(doc, {
    testId: primary === 'done' ? 'creator-done' : 'start-playing',
    text: text(locale, primary === 'done' ? 'creator.done' : 'creator.start'),
    attrs: { 'data-tn-action': 'primary' },
    onClick: () => options.onStart?.(selection),
  });

  /* `TN-FIRSTRUN-03`: back goes one step up the route, saves nothing, asks
     nothing and says nothing about what was not kept. */
  const backButton =
    options.onBack === undefined
      ? null
      : button(doc, {
          testId: 'creator-back',
          text: text(locale, 'common.back'),
          attrs: { 'data-tn-action': 'quiet' },
          onClick: options.onBack,
        });

  /* `OQ-SET-1`. `common.settings` names the control that opens Settings, so a
     player who heard "Settings" in the HUD menu hears the same word here
     (`TN-CREATOR`'s copy table); `settings.title` stays that screen's heading.

     **Absent when there is nowhere to open.** It used to be drawn either way,
     and the creator re-opened *from* Settings passes no handler — so that
     screen carried a "Settings" button that did nothing when pressed, which a
     switch user walking the ring has no way to know until they try it. Same
     rule as Back: no control that goes nowhere. */
  const settingsButton =
    options.onOpenSettings === undefined
      ? null
      : button(doc, {
          testId: 'creator-settings',
          text: text(locale, 'common.settings'),
          attrs: { 'data-tn-action': 'quiet' },
          onClick: options.onOpenSettings,
        });

  const saveFailure = element(doc, 'div', {
    testId: 'creator-save-error',
    className: 'tn-screen__notice',
  });
  saveFailure.hidden = true;

  screen.card.append(
    title,
    intro,
    optionGone,
    preview,
    groupsHost,
    saveFailure,
    element(doc, 'div', {
      className: 'tn-screen__actions',
      children: [
        randomiseButton,
        startButton,
        ...(settingsButton === null ? [] : [settingsButton]),
        ...(backButton === null ? [] : [backButton]),
      ],
    }),
  );

  buildGroups();
  paint();
  applyMotion(motion);
  if (artHost !== null && options.art !== undefined) {
    try {
      art = options.art(artHost, { selection, motion, onStatus: showArtStatus });
    } catch {
      dropArt();
    }
  }
  /* Once, on arrival, through the one live region — and after `paint`, so it is
     not overtaken by the description. */
  if (options.optionRepaired === true) say(text(locale, 'creator.optionGone'));

  return {
    element: screen.element,
    get selection(): CharacterSelection {
      return selection;
    },
    get visible(): boolean {
      return screen.visible;
    },
    show(): void {
      screen.show();
    },
    hide(): void {
      screen.hide();
    },
    setLocale(next, nextSlots): void {
      locale = next;
      slots = nextSlots;
      screen.setLocale(next);
      title.textContent = text(next, 'creator.title');
      intro.textContent = text(next, 'creator.intro');
      optionGone.textContent = text(next, 'creator.optionGone');
      previewHeading.textContent = text(next, 'creator.preview.label');
      randomiseButton.textContent = text(next, 'creator.randomise');
      startButton.textContent = text(next, primary === 'done' ? 'creator.done' : 'creator.start');
      if (settingsButton !== null) settingsButton.textContent = text(next, 'common.settings');
      if (backButton !== null) backButton.textContent = text(next, 'common.back');
      /* The chosen option survives the language change (`TN-CREATOR-10`): only
         the labels are rebuilt, and `selection` is never touched here. */
      buildGroups();
      paint();
      screen.refreshSwitch();
    },
    setMotion(motion): void {
      applyMotion(motion);
    },
    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },
    showSaveFailure(handlers): void {
      const message = element(doc, 'p', { text: text(locale, 'creator.saveFailed') });
      const retry = button(doc, {
        testId: 'creator-retry',
        text: text(locale, 'creator.retry'),
        ...(handlers.onRetry === undefined ? {} : { onClick: handlers.onRetry }),
      });
      const keep = button(doc, {
        testId: 'creator-continue',
        text: text(locale, 'creator.continue'),
        ...(handlers.onContinue === undefined ? {} : { onClick: handlers.onContinue }),
      });
      replaceChildren(saveFailure, [message, retry, keep]);
      saveFailure.hidden = false;
      /* Announced through the one live region — never a second `aria-live`. */
      say(text(locale, 'creator.saveFailed'));
      screen.refreshSwitch();
      retry.focus();
    },
    hideSaveFailure(): void {
      saveFailure.hidden = true;
      replaceChildren(saveFailure, []);
      screen.refreshSwitch();
    },
    destroy(): void {
      /* The picture first: its frame loop must not outlive the screen it paints. */
      const current = art;
      art = null;
      destroyed = true;
      try {
        current?.destroy();
      } catch {
        /* Nothing is left to show a failure on. */
      }
      screen.destroy();
    },
  };

  function say(message: string): void {
    options.announce?.(message);
  }

  function applyMotion(next: 'reduced' | 'full'): void {
    motion = next;
    /* Read by `TN-CREATOR-07`, and handed to the picture, which paints a still
       pose under `reduced` and requests no frame at all. The shell resolves the
       value from the setting and the device's preference together, with no tier
       input, so a fast machine cannot turn this back on. */
    preview.setAttribute('data-animated', String(next !== 'reduced'));
    withArt((current) => {
      current.setMotion(next);
    });
  }

  /** What the picture reports, published on its host and on the panel. */
  function showArtStatus(status: CreatorArtStatus): void {
    if (artHost === null || destroyed) return;
    artHost.setAttribute('data-state', status.state);
    artHost.setAttribute('data-frames', status.frames.join(' '));
    preview.setAttribute('data-art', status.state);
    /* Never an empty box (`TN-CREATOR-03`): a picture that cannot be drawn
       steps aside, and the words carry the preview alone. */
    artHost.hidden = status.state === 'failed';
  }

  /**
   * Hand the picture something to do, and survive it.
   *
   * A renderer that throws is a picture that failed. It must never be a creator
   * whose radio stops announcing, or whose focus stops moving, because the call
   * that paints sits in the middle of `select`.
   */
  function withArt(action: (current: CreatorArt) => void): void {
    if (art === null) return;
    try {
      action(art);
    } catch {
      dropArt();
    }
  }

  function dropArt(): void {
    const current = art;
    art = null;
    try {
      current?.destroy();
    } catch {
      /* Already failing; the words are still on the page. */
    }
    showArtStatus({ state: 'failed', frames: [] });
  }

  function buildGroups(): void {
    groups.clear();
    replaceChildren(
      groupsHost,
      slots.map((slot) => {
        const legendId = `tn-creator-${slot.id}-legend`;
        const legend = element(doc, 'span', {
          id: legendId,
          className: 'tn-screen__legend',
          text: slot.label,
        });
        /* A `span`, not a `p`: it sits inside the radiogroup, where the only
           children with a role should be the radios. */
        const help =
          slot.help === undefined
            ? null
            : element(doc, 'span', {
                id: `tn-creator-${slot.id}-help`,
                className: 'tn-screen__help tn-creator__help',
                text: slot.help,
              });
        const list = optionsOf(slot);
        const radios = list.map((option, index) => optionButton(slot, option, index, list.length));
        /* Swatches sit in a grid that fills a row at a time, left to right, so
           the reading order is the ramp's order at every width. */
        const swatched = list.some((option) => option.swatch !== undefined);
        const group = element(doc, 'div', {
          className: 'tn-screen__group',
          testId: slot.testId,
          attrs: {
            role: 'radiogroup',
            'aria-labelledby': legendId,
            ...(help === null ? {} : { 'aria-describedby': help.id }),
          },
          children: [
            legend,
            ...(help === null ? [] : [help]),
            ...(swatched
              ? [element(doc, 'div', { className: 'tn-creator__swatches', children: radios })]
              : radios),
          ],
        });

        group.addEventListener('keydown', (event: KeyboardEvent) =>
          onGroupKey(slot, event),
        );
        groups.set(slot.id, group);
        return group;
      }),
    );
  }

  /**
   * An option is a radio with a *name* — never a bare colour swatch
   * (`TN-CREATOR-06`, and "colour is never the only signal").
   *
   * **The chosen one is marked by a shape.** Every option draws the radio
   * circle: filled when chosen, empty when not (`chosenMark`). It used to draw a
   * tick on *every* option, chosen or not, so the only thing that set the chosen
   * one apart was its fill and border — which is colour doing the work the tick
   * was there to do.
   *
   * **Position is stated, not inferred.** `aria-posinset` and `aria-setsize`
   * make "1 of 6" part of what a screen reader says for each tone, so the names
   * never have to carry it (`TN-SKIN-05`).
   *
   * `data-slot`, `data-option` and `data-chosen` are the hooks
   * `docs/stories/README.md` names for every option; `data-slot-id` and
   * `data-option-id` stay beside them for the code already reading them.
   */
  function optionButton(
    slot: CreatorSlot,
    option: CreatorOption,
    index: number,
    total: number,
  ): HTMLElement {
    const children: HTMLElement[] = [];
    if (option.swatch !== undefined) {
      const swatch = element(doc, 'span', {
        className: 'tn-creator__swatch',
        attrs: { 'aria-hidden': 'true' },
      });
      /* Set through the CSSOM, never as a `style` attribute, so a strict
         content security policy cannot strip the colour. */
      swatch.style.setProperty('--tn-swatch', option.swatch);
      children.push(swatch);
    }
    children.push(
      chosenMark(doc, false),
      element(doc, 'span', { className: 'tn-creator__name', text: option.name }),
    );
    return button(doc, {
      testId: `${slot.testId}-${option.id}`,
      attrs: {
        role: 'radio',
        'aria-checked': 'false',
        'aria-posinset': String(index + 1),
        'aria-setsize': String(total),
        'data-slot': slot.id,
        'data-option': option.id,
        'data-chosen': 'false',
        'data-option-id': option.id,
        'data-slot-id': slot.id,
      },
      children,
      onClick: () => select(slot, option),
    });
  }

  function select(slot: CreatorSlot, option: CreatorOption): void {
    if (selection[slot.id] === option.id) return;
    /* One slot, one key. Nothing else in `selection` is touched, which is what
       "no other group's chosen option changes" means at the data level. */
    selection = { ...selection, [slot.id]: option.id };
    paint();
    options.onChange?.(selection);
    /* "Hair: Curly" / « Cheveux : Bouclés » (`TN-CREATOR-06`, `TN-CREATOR-09`). */
    say(labelled(locale, slot.label, option.name));
    focusOption(slot.id, option.id);
  }

  function onGroupKey(slot: CreatorSlot, event: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const list = optionsOf(slot);
    if (list.length === 0) return;
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const current = list.findIndex((option) => option.id === selection[slot.id]);
    const next = (current + (forward ? 1 : -1) + list.length) % list.length;
    const target = list[next];
    if (target !== undefined) select(slot, target);
  }

  function focusOption(slotId: string, optionId: string): void {
    const group = groups.get(slotId);
    const target = group?.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`);
    target?.focus();
  }

  function paint(): void {
    for (const slot of slots) {
      const group = groups.get(slot.id);
      if (group === undefined) continue;
      for (const control of Array.from(
        group.querySelectorAll<HTMLElement>('[data-option-id]'),
      )) {
        const chosen = control.getAttribute('data-option-id') === selection[slot.id];
        control.setAttribute('aria-checked', String(chosen));
        control.setAttribute('data-chosen', String(chosen));
        control.tabIndex = chosen ? 0 : -1;
        const indicator = control.querySelector<HTMLElement>('[data-tn-chosen]');
        if (indicator !== null) {
          indicator.textContent = chosen ? CHOSEN_GLYPH : UNCHOSEN_GLYPH;
          indicator.setAttribute('data-tn-chosen', String(chosen));
        }
      }
      /* Data hooks the level's renderer reads, and `TN-CREATOR-01` asserts. */
      preview.setAttribute(previewAttribute(slot.id), selection[slot.id] ?? '');
    }
    previewText.textContent = describeSelection();
    /* The picture follows the same change the words just did. */
    const chosen = selection;
    withArt((current) => {
      current.draw(chosen);
    });
  }

  function describeSelection(): string {
    return slots
      .map((slot) => {
        const chosen = optionsOf(slot).find((option) => option.id === selection[slot.id]);
        return labelled(locale, slot.label, chosen?.name ?? '');
      })
      .join('. ');
  }
}
