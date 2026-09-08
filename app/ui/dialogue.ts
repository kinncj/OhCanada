/**
 * NPC dialogue.
 *
 * The scenarios live in `docs/stories/TN-QUEST-parliament-hill.md`
 * (`TN-QUEST-06` keyboard, `TN-QUEST-07` one switch, `TN-QUEST-08` screen
 * reader, `TN-QUEST-10` at 200 %) and in `TN-LEVEL-ottawa.md`. There is no
 * `TN-DIALOGUE` file, because dialogue is what the quest is made of.
 *
 * **No copy is written here.** The officer's lines, the accept and decline
 * labels and the speaker's name are content — they come from the caller, which
 * is also what lets the same component carry any NPC in any level. The one
 * string this module would have had to invent is the speaker's name used as the
 * dialog's accessible name (`TN-QUEST-08`: "an accessible name naming the
 * speaker"), and no story table carries one: it is a required option, so a
 * caller cannot forget it and leave an unnamed dialog behind.
 *
 * Closing is not declining (`TN-QUEST-04`: "Leaving the dialogue without
 * choosing is not a decline"), so Escape and Close route to `onClose` and never
 * to the decline handler.
 *
 * DOM only (ADR-0005).
 */

import { type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

export interface DialogueChoice {
  /** Already localised. */
  readonly label: string;
  readonly onSelect: () => void;
}

export interface DialogueContent {
  /** One paragraph per line, in the order the speaker says them. */
  readonly lines: readonly string[];
  readonly accept?: DialogueChoice;
  readonly decline?: DialogueChoice;
  /** For a line with nothing to decide: a single way onward. */
  readonly next?: DialogueChoice;
}

export interface DialogueOptions {
  /** Names the dialog. Content, and required: an unnamed dialog is a defect. */
  readonly speakerName: string;
  readonly locale: UiLocale;
  readonly announce?: (message: string) => void;
  /** Escape, and the absence of a choice. Emits `dialogue/closed`, not a decline. */
  readonly onClose?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface Dialogue {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(content: DialogueContent): void;
  hide(): void;
  setSpeaker(name: string): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createDialogue(host: HTMLElement, options: DialogueOptions): Dialogue {
  const doc = host.ownerDocument;

  const screen: Screen = createScreen(host, {
    id: 'tn-dialogue',
    testId: 'dialogue',
    locale: options.locale,
    className: 'tn-screen--dialogue',
    ...(options.onClose === undefined ? {} : { onEscape: options.onClose }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  /*
   * The speaker's name is the dialog's accessible name and is also drawn, so a
   * sighted player knows who is talking without hearing it — the same rule the
   * question card follows for its marks: nothing important exists only in the
   * accessibility tree, and nothing important exists only in pixels.
   */
  const speaker = element(doc, 'h1', {
    id: 'tn-dialogue-speaker',
    /* The marker `docs/stories/README.md` fixes for this element, and what
       `TN-LEVEL-05` reads to check the officer is named rather than "Speaker". */
    testId: 'dialogue-speaker',
    text: options.speakerName,
  });
  screen.labelledBy(speaker);

  const body = element(doc, 'div', {
    id: 'tn-dialogue-text',
    testId: 'dialogue-text',
    className: 'tn-screen__row',
  });
  screen.describedBy(body);

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(speaker, body, actions);

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(content): void {
      replaceChildren(
        body,
        content.lines.map((line) => element(doc, 'p', { text: line })),
      );

      const choices: HTMLElement[] = [];
      if (content.accept !== undefined) {
        choices.push(choice('dialogue-accept', content.accept));
      }
      if (content.decline !== undefined) {
        choices.push(choice('dialogue-decline', content.decline));
      }
      if (content.next !== undefined) {
        choices.push(choice('dialogue-next', content.next));
      }
      replaceChildren(actions, choices);

      screen.show();
      screen.refreshSwitch();
    },

    hide(): void {
      screen.hide();
    },

    setSpeaker(name): void {
      speaker.textContent = name;
    },

    setLocale(locale): void {
      screen.setLocale(locale);
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };

  function choice(testId: string, spec: DialogueChoice): HTMLElement {
    return button(doc, { testId, text: spec.label, onClick: spec.onSelect });
  }
}
