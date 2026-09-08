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
 * and writes none. §8.1 recommends the ordinal-with-lightness-cue naming for
 * skin tones and leaves it open (`OQ-REVIEW-6`), which is exactly why the ramp
 * ships unnamed *here* and named *there*: adding names later changes the data,
 * not this file.
 *
 * DOM only (ADR-0005).
 */

import { labelled, text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/** One choice inside a slot. `name` is already localised by the caller. */
export interface CreatorOption {
  readonly id: string;
  readonly name: string;
}

/**
 * One group of choices. Deliberately flat: an option list, a label, a test id.
 * No `dependsOn`, no `availableWhen`, no `default` — see §8.2 and §8.1 above.
 */
export interface CreatorSlot {
  readonly id: string;
  /** From `docs/stories/README.md`: `slot-skin`, `slot-hair`, `slot-coat`. */
  readonly testId: string;
  readonly label: string;
  readonly options: readonly CreatorOption[];
}

/** Slot id to chosen option id. */
export type CharacterSelection = Readonly<Record<string, string>>;

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
  /** `character/created`. The caller saves and loads the level. */
  readonly onStart?: (selection: CharacterSelection) => void;
  readonly onChange?: (selection: CharacterSelection) => void;
  /**
   * `OQ-SET-1`: the creator is the first screen, and a player who needs
   * one-button mode or 200 % text needs it here. Without this control
   * `TN-CREATOR-05` and `TN-CREATOR-08` describe a state a first-run player
   * cannot reach.
   */
  readonly onOpenSettings?: () => void;
  /** Reduced motion is a request for stillness; the preview never animates under it. */
  readonly motion?: 'reduced' | 'full';
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
    locale,
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
   * The preview is named by the same text the player can read. `TN-CREATOR-06`
   * asks for "a text description listing the chosen option of every slot"; a
   * visible paragraph doing double duty means the description cannot drift from
   * what is drawn, and `TN-CREATOR-03`'s "the art fails to load" case still
   * leaves a screen with words on it rather than an empty box.
   */
  const previewText = element(doc, 'p', { id: 'tn-creator-preview-text' });
  const preview = element(doc, 'div', {
    testId: 'character-preview',
    className: 'tn-screen__preview',
    attrs: { role: 'img', 'aria-labelledby': 'tn-creator-preview-text' },
    children: [previewText],
  });

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

  const startButton = button(doc, {
    testId: 'start-playing',
    text: text(locale, 'creator.start'),
    onClick: () => options.onStart?.(selection),
  });

  /* `OQ-SET-1`. Labelled with the settings screen's own title, so it needs no
     copy this module would have had to invent. */
  const settingsButton = button(doc, {
    testId: 'creator-settings',
    text: text(locale, 'settings.title'),
    ...(options.onOpenSettings === undefined ? {} : { onClick: options.onOpenSettings }),
  });

  const saveFailure = element(doc, 'div', {
    testId: 'creator-save-error',
    className: 'tn-screen__notice',
  });
  saveFailure.hidden = true;

  screen.card.append(
    title,
    intro,
    preview,
    groupsHost,
    saveFailure,
    element(doc, 'div', {
      className: 'tn-screen__actions',
      children: [randomiseButton, startButton, settingsButton],
    }),
  );

  buildGroups();
  paint();
  applyMotion(options.motion ?? 'full');

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
      randomiseButton.textContent = text(next, 'creator.randomise');
      startButton.textContent = text(next, 'creator.start');
      settingsButton.textContent = text(next, 'settings.title');
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
      screen.destroy();
    },
  };

  function say(message: string): void {
    options.announce?.(message);
  }

  function applyMotion(motion: 'reduced' | 'full'): void {
    /* Read by `TN-CREATOR-07` and by the renderer that will drive the preview.
       The value comes from `resolveMotion`, which has no tier input, so a fast
       machine cannot turn this back on. */
    preview.setAttribute('data-animated', String(motion !== 'reduced'));
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
        const group = element(doc, 'div', {
          className: 'tn-screen__group',
          testId: slot.testId,
          attrs: { role: 'radiogroup', 'aria-labelledby': legendId },
          children: [legend],
        });

        for (const option of optionsOf(slot)) {
          group.append(optionButton(slot, option));
        }

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
   * (`TN-CREATOR-06`, and "colour is never the only signal"). The chosen one is
   * marked with a tick as well as a background, so reduced motion, high contrast
   * and greyscale all leave the choice visible.
   */
  function optionButton(slot: CreatorSlot, option: CreatorOption): HTMLElement {
    return button(doc, {
      testId: `${slot.testId}-${option.id}`,
      attrs: {
        role: 'radio',
        'aria-checked': 'false',
        'data-option-id': option.id,
        'data-slot-id': slot.id,
      },
      children: [mark(doc, '✓'), element(doc, 'span', { text: option.name })],
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
        control.tabIndex = chosen ? 0 : -1;
      }
      /* Data hooks the level's renderer reads, and `TN-CREATOR-01` asserts. */
      preview.setAttribute(`data-${slot.id}`, selection[slot.id] ?? '');
    }
    previewText.textContent = describeSelection();
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
