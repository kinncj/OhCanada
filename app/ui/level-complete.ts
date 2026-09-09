/**
 * The card a player reads when a level is finished.
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
 * ## What it is allowed to claim, and what it is not
 *
 * Reaching the end of the world finishes the level and earns its stamp. A player
 * can walk from the spawn to the exit **without answering a single question**,
 * and the card is still shown, because the stamp is still earned. What the card
 * must not do is imply the subject was learned. So the sentence about the
 * player's answers is drawn **only when there were answers**
 * ({@link LevelCompleteContent.progressMessage} is absent otherwise), and its
 * absence is the honest difference between a level walked through and a level
 * played. A line reading "0 out of 0" would look like a defect; a line claiming
 * anything else would be the game lying to a learner.
 *
 * A sentence saying *"you did not answer anything here"* is the one string this
 * card still wants and does not have. Reported as a copy gap with the task; the
 * route back into the level (`common.keepPlaying`) is offered on every showing
 * precisely so a player who skipped the landmarks can go and read them.
 *
 * ## Four strings this card takes as data, and one it does not
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
 *  - What the player answered here is the caller's arithmetic and the caller's
 *    row: this module cannot count answers and does not choose the wording.
 *  - The level that just opened arrives as {@link LevelCompleteNext}: its own
 *    place name, and the map's own description of the card
 *    (`app/ui/level-select.ts`'s `describeEntry` — "Halifax. Open. You can play
 *    this now."). **No sentence naming the newly opened level is written here.**
 *    No story writes one, and inventing it would be this module authoring
 *    player-facing copy (ADR-0010); joining three rows the map already draws is
 *    the same fact in words that have been reviewed.
 *
 * ## Three ways on, and none of them is chosen for the player
 *
 * The user asked for "once you reach the end of a level, it should send you to a
 * new level", so the level that just opened is the **primary** action and its
 * label is that level's own name — the same decision, for the same reason, as
 * the HUD's interact prompt drawing a landmark's name because "Talk to the
 * officer" is a row nobody has written. `map.open` is beside it for a player who
 * wants the journey rather than the next step, and `common.keepPlaying` goes
 * back into the level they just finished. Nothing counts down, nothing is
 * pre-chosen, and Escape is "keep playing" — leaving a dialog must never be a
 * route the player did not ask for.
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
   * `map.open`: the way to the map, where the level that just opened is.
   * Primary only when there is no next level to offer.
   */
  readonly onChooseLevel?: () => void;
  /**
   * Straight into the level that just opened, without going through the map.
   *
   * Only reachable while {@link LevelCompleteContent.next} says there *is* one,
   * so the control cannot exist without a destination.
   */
  readonly onPlayNext?: () => void;
  /** `common.keepPlaying`: stay in this level. Closing and Escape do the same. */
  readonly onKeepPlaying?: () => void;
  /**
   * Where focus goes when the card closes back into the level.
   *
   * The trap restores focus to whatever opened the card, which is right when a
   * question card opened it and **wrong when the world did**: reaching the end
   * of the level is published by a canvas that is `aria-hidden` and takes no
   * focus, so the trap would restore to `<body>`. Naming the destination is what
   * keeps focus off the body on the path this card was built for.
   */
  readonly restoreFocusTo?: () => HTMLElement | null;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

/** The level that opened while this one was being played. */
export interface LevelCompleteNext {
  /** `level.<id>.title` — that level's own place name, already localised. */
  readonly title: string;
  /**
   * The map's own description of that card, already localised: "Halifax. Open.
   * You can play this now." It is the button's accessible description and the
   * only sentence on the card that names the new level.
   */
  readonly description: string;
}

/** What this showing of the card says, in the language in force when it opens. */
export interface LevelCompleteContent {
  /**
   * `stamp.<id>.earned` for the level that was finished, already localised.
   * Absent when this build has no row for that level — the card then says the
   * task is done and offers the same ways on, which is every fact it has.
   */
  readonly stampMessage?: string;
  /**
   * What the player answered in this level, already localised.
   *
   * **Absent when they answered nothing**, which is a state reaching the end of
   * the world makes reachable and which the card must not paper over. See the
   * note at the top of this file.
   */
  readonly progressMessage?: string;
  /** The level that just opened, when one did. */
  readonly next?: LevelCompleteNext;
}

/**
 * The content, or a function that resolves it for a language.
 *
 * A resolver is what a caller wants: every string on this card but the heading
 * is looked up by the caller — per level, per count, per newly opened level —
 * and the player can change language while the card is open. Passed as a plain
 * value the card kept the old language's sentences until it was shown again;
 * passed as a function it is asked for them in the new one.
 */
export type LevelCompleteContentFor =
  | LevelCompleteContent
  | ((locale: UiLocale) => LevelCompleteContent);

export interface LevelComplete {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(content: LevelCompleteContentFor): void;
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
  let source: LevelCompleteContentFor = {};
  let content: LevelCompleteContent = {};

  const resolve = (): LevelCompleteContent =>
    typeof source === 'function' ? source(locale) : source;

  const keepPlaying = (): void => {
    if (!screen.visible) return;
    screen.hide();
    /*
     * The trap has already restored focus to whatever opened the card. That is
     * the body when the *world* opened it, so the destination is named — the
     * same fix, for the same reason, as `poi-card.ts`'s.
     */
    const destination = options.restoreFocusTo?.() ?? null;
    if (destination !== null && destination.isConnected) {
      destination.focus({ preventScroll: true });
    }
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

  /** Everything the card is saying right now, in reading order. */
  function lines(): HTMLElement[] {
    const said: HTMLElement[] = [];
    const stamp = content.stampMessage;
    if (stamp !== undefined && stamp !== '') {
      said.push(element(doc, 'p', { testId: 'quest-complete-stamp', text: stamp }));
    }
    const progress = content.progressMessage;
    if (progress !== undefined && progress !== '') {
      said.push(element(doc, 'p', { testId: 'quest-complete-progress', text: progress }));
    }
    const next = content.next;
    if (next !== undefined && next.description !== '') {
      said.push(
        element(doc, 'p', {
          id: 'tn-level-complete-next',
          testId: 'quest-complete-next-level',
          text: next.description,
        }),
      );
    }
    return said;
  }

  function render(): void {
    title.textContent = text(locale, 'quest.done.title');

    const said = lines();
    replaceChildren(body, said);
    body.hidden = said.length === 0;
    /* A card with nothing but its heading has no description to point at, and an
       `aria-describedby` aimed at an empty element is a dialog that reads its
       own name and then a silence. */
    screen.describedBy(said.length === 0 ? null : body);

    const next = content.next;
    /* The route into the new level exists only while there *is* one, the caller
       has somewhere to send the player, and the level can be named. A control
       with no destination is the dead control this project keeps finding, and a
       control labelled with nothing is worse. */
    const offersNext =
      next !== undefined && next.title !== '' && options.onPlayNext !== undefined;

    const controls: HTMLElement[] = [];
    if (offersNext && next !== undefined) {
      const play = button(doc, {
        testId: 'quest-complete-next',
        /* The level's own name. "Play {{level}}" is a sentence nobody has
           written and French would need it per level anyway (« Jouer à
           Halifax », « Jouer dans le Nord »). */
        text: next.title,
        attrs: { 'data-tn-action': 'primary' },
        ...(options.onPlayNext === undefined ? {} : { onClick: options.onPlayNext }),
      });
      /* Named by the place, described by what the map says about it — the same
         pairing the map's own card uses (`TN-MAP-09`: the reason is read after
         the name, never as part of it).

         Only when that paragraph is really on the page: an `aria-describedby`
         pointing at an id nothing carries is an invalid attribute value, which
         axe is right to flag and a screen reader reads as nothing at all. */
      if (next.description !== '') {
        play.setAttribute('aria-describedby', 'tn-level-complete-next');
      }
      controls.push(play);
    }

    controls.push(
      button(doc, {
        testId: 'quest-complete-map',
        text: text(locale, 'map.open'),
        /* Never two primaries on one screen (`screen-styles.ts`): the map is the
           way forward only when there is no new level to offer. */
        ...(offersNext ? {} : { attrs: { 'data-tn-action': 'primary' } }),
        ...(options.onChooseLevel === undefined ? {} : { onClick: options.onChooseLevel }),
      }),
      button(doc, {
        testId: 'quest-complete-keep-playing',
        text: text(locale, 'common.keepPlaying'),
        attrs: { 'data-tn-action': 'quiet' },
        onClick: keepPlaying,
      }),
    );

    replaceChildren(actions, controls);
  }

  render();

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(next): void {
      source = next;
      content = resolve();
      render();
      screen.show();
      screen.refreshSwitch();
      /*
       * `TN-QUEST-08`: "reads 'Task done. You earned the Ottawa stamp.'" — the
       * one place in this directory where a modal is announced *as well as*
       * being read on arrival, because the story asks for it by name. The two
       * rows are joined; neither sentence is written here.
       *
       * Only the heading and the stamp: the rest of the card is its
       * `aria-describedby` and is read on arrival, and repeating it through the
       * live region is the double-speaking every other screen here avoids.
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
      /* A caller that passed a resolver gets its sentences in the new language;
         one that passed plain strings keeps them, because only the caller can
         look up a row keyed on a level this module does not know the id of. */
      content = resolve();
      render();
      screen.refreshSwitch();
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
