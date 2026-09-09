/**
 * The card a player reads when a level's task is finished.
 *
 * `docs/stories/TN-QUEST-parliament-hill.md` §`TN-QUEST-04` is the acceptance
 * criteria: the element is `quest-complete-card`, it says the task is done, it
 * says the stamp was earned, and it offers a way on rather than dropping the
 * player back onto the ice with no idea that anything changed.
 *
 * ## Why it exists at all
 *
 * The domain earns the stamp and `unlockedLevelIds` opens the next level the
 * moment it lands. **Nothing said so.** A player finished a level, the map
 * quietly gained a card, and the only way to find out was to leave and look —
 * which is the same shape as every other defect in this project: a fact the
 * build knows and the screen never mentions.
 *
 * ## Two strings this card takes as data, and one it does not
 *
 *  - `quest.done.title` — "Task done!" — is a row here, because it is the same
 *    sentence for every level.
 *  - The stamp sentence is **`stamp.<id>.earned`, per level**, for the reason
 *    `level.<id>.error.title` is per level: "You earned the {{level}} stamp." is
 *    right in English and wrong in French, where the article and the elision
 *    differ per place. `TN-QUEST` writes Ottawa's row and no other, so the
 *    caller looks the row up by id and passes it, and a level with no row draws
 *    the card **without that line** rather than naming the wrong place or
 *    printing a placeholder.
 *  - There is deliberately **no sentence naming the level that just opened.** No
 *    story writes one, and inventing it here would be this module authoring
 *    player-facing copy (ADR-0010). What the card does instead is *offer the
 *    route*: `map.open` — "Choose a level" — and the caller lands the player on
 *    the newly opened card, which announces itself as open with the words the
 *    map already owns (`TN-MAP-03`). Reported as a copy gap with the task.
 *
 * Nothing counts down here and nothing is chosen for the player: this card is a
 * full stop, not a timer.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

export interface LevelCompleteOptions {
  readonly locale: UiLocale;
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /**
   * `map.open`: the way to the map, where the level that just opened is. The
   * primary action, because it is the one the player has just earned.
   */
  readonly onChooseLevel?: () => void;
  /** `common.keepPlaying`: stay in this level. Closing and Escape do the same. */
  readonly onKeepPlaying?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

/** What this showing of the card says, in the language in force when it opens. */
export interface LevelCompleteContent {
  /**
   * `stamp.<id>.earned` for the level that was finished, already localised.
   * Absent when this build has no row for that level — the card then says the
   * task is done and offers the same two ways on, which is every fact it has.
   */
  readonly stampMessage?: string;
}

export interface LevelComplete {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(content: LevelCompleteContent): void;
  hide(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createLevelComplete(
  host: HTMLElement,
  options: LevelCompleteOptions,
): LevelComplete {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let content: LevelCompleteContent = {};

  const keepPlaying = (): void => {
    if (!screen.visible) return;
    screen.hide();
    options.onKeepPlaying?.();
  };

  const screen: Screen = createScreen(host, {
    id: 'tn-level-complete',
    testId: 'quest-complete-card',
    locale,
    /* Escape is "keep playing", not "choose a level": leaving a dialog must
       never be a route the player did not ask for. */
    onEscape: keepPlaying,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: 'tn-level-complete-title' });
  screen.labelledBy(title);

  const body = element(doc, 'div', {
    id: 'tn-level-complete-body',
    className: 'tn-screen__notice',
  });
  screen.describedBy(body);

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, body, actions);

  function render(): void {
    title.textContent = text(locale, 'quest.done.title');

    const stamp = content.stampMessage;
    const said = stamp !== undefined && stamp !== '';

    replaceChildren(
      body,
      said ? [element(doc, 'p', { testId: 'quest-complete-stamp', text: stamp })] : [],
    );
    body.hidden = !said;
    /* A card with nothing but its heading has no description to point at, and an
       `aria-describedby` aimed at an empty element is a dialog that reads its
       own name and then a silence. */
    screen.describedBy(said ? body : null);

    replaceChildren(actions, [
      button(doc, {
        testId: 'quest-complete-map',
        text: text(locale, 'map.open'),
        attrs: { 'data-tn-action': 'primary' },
        ...(options.onChooseLevel === undefined ? {} : { onClick: options.onChooseLevel }),
      }),
      button(doc, {
        testId: 'quest-complete-keep-playing',
        text: text(locale, 'common.keepPlaying'),
        attrs: { 'data-tn-action': 'quiet' },
        onClick: keepPlaying,
      }),
    ]);
  }

  render();

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(next): void {
      content = next;
      render();
      screen.show();
      screen.refreshSwitch();
      /*
       * `TN-QUEST-08`: "reads 'Task done. You earned the Ottawa stamp.'" — the
       * one place in this directory where a modal is announced *as well as*
       * being read on arrival, because the story asks for it by name. The two
       * rows are joined; neither sentence is written here.
       */
      const stamp = content.stampMessage;
      options.announce?.(
        stamp === undefined || stamp === ''
          ? text(locale, 'quest.done.title')
          : `${text(locale, 'quest.done.title')} ${stamp}`,
        locale,
      );
    },

    hide(): void {
      screen.hide();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      /* The stamp sentence is this level's row in the *new* language and only
         the caller can look it up, so it is left as it was until the caller
         shows the card again. The rows this module owns are redrawn. */
      render();
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
