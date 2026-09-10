/**
 * The title screen — the first thing a cold load shows.
 *
 * `docs/stories/TN-TITLE-title-screen.md` is the acceptance criteria and
 * `TN-FLOW-first-run-and-return.md` owns the route it starts. This screen exists
 * because the game had no front door: `app/bootstrap` mounted four things, the
 * only way into a level was a `?level=` URL parameter, and a player who opened
 * the deployed page was told "there is no level to play yet" — a caption
 * behaving correctly on a game with no entrance.
 *
 * Four things here are acceptance criteria, not layout:
 *
 *  1. **Play and Continue are never both present** (`TN-TITLE-03`). A player who
 *     has a saved game is offered `Continue` and `Choose a level`; a player who
 *     has none is offered `Play`. Nobody is ever asked to guess whether "Play"
 *     replaces the game they have, because the two are not on screen together —
 *     which is a property of {@link TitleScreenRoutes}, not of a code path.
 *  2. **Nothing is drawn disabled** (`TN-TITLE-01`). A route that is not
 *     available is absent from the accessibility tree, not greyed out.
 *  3. **Focus starts on the primary control** (`TN-TITLE-05`): `title-continue`
 *     when one is offered, `title-play` when it is not, and never the document
 *     body. It is also first in reading order, so the eye and the focus start in
 *     the same place.
 *  4. **The game does not claim to be official** (`TN-TITLE-01`). `title.notOfficial`
 *     is on this screen, in the language the player is reading, not in a credits
 *     page nobody opens.
 *
 * It is **not a dialog**: it is the page's primary content, nothing sits behind
 * it to be modal over, and trapping focus in it would be a keyboard trap
 * (`TN-TITLE-05`: "not a dialog and does not trap Tab"). `app/ui/shell.ts` puts
 * it inside the page's one `<main>`, which is what lets a whole-page scan run
 * with axe's `region` and `landmark-one-main` rules on (`TN-TITLE-07`).
 *
 * Every string is a row in `app/ui/copy.ts`, transcribed from `TN-TITLE`'s copy
 * table. Nothing here is a caller's option, because nothing here is a caller's
 * to word.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { injectScreenStyles } from './screen-styles';

/**
 * The ways in that are true for this player.
 *
 * `resume` and `play` are mutually exclusive by construction: the type below is
 * a union, so "Play and Continue side by side" is not a state this module can
 * represent. `TN-TITLE-03` is the scenario; this is the scenario made
 * unreachable rather than merely untested.
 */
export type TitleScreenRoutes =
  | {
      /** No saved game: one way in, and it starts with the character creator. */
      readonly kind: 'first-run';
      readonly onPlay: () => void;
    }
  | {
      readonly kind: 'returning';
      /**
       * The level the game recorded when one last became ready, already
       * localised for the "Last played" line. Absent when the save has no level
       * to resume — a first sitting that never opened one, or a level this build
       * no longer contains (`TN-TITLE-04`) — and then no Continue is drawn and
       * no "Last played" line either.
       */
      readonly resume?: { readonly levelTitle: string; readonly onContinue: () => void };
      /** `map.open`. The returning player's way to the map. */
      readonly onChooseLevel: () => void;
    };

export interface TitleScreenOptions {
  readonly locale: UiLocale;
  readonly routes: TitleScreenRoutes;
  /** `study.open`. Absent hides the item rather than drawing a dead control. */
  readonly onOpenStudy?: () => void;
  /**
   * The practice exam (`TN-EXAM-01`), and the way back to an unfinished one
   * (`TN-ATTEMPT-03`).
   *
   * **One control, two labels.** `OQ-ATTEMPT-4` keeps the screen at five items
   * rather than growing a sixth: an exam left unfinished changes what this
   * control says — "Finish your exam" instead of "Practice exam" — so a player
   * never meets two exam controls and never has to work out which one holds
   * theirs. It is still a control and never a message.
   *
   * Absent hides the item, like every other route here.
   */
  readonly onOpenExam?: () => void;
  /** `common.settings`. Absent hides the item. */
  readonly onOpenSettings?: () => void;
  /** An exam is saved and unfinished, so the exam item offers to finish it. */
  readonly examUnfinished?: boolean;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  /** The `<h1>`, which reads `title.game`. */
  readonly heading: HTMLElement;
  /** `title-continue` when there is one, otherwise `title-play` or `title-choose-level`. */
  readonly primary: HTMLElement | null;
  /** What the live region says on arrival: the game and this screen, once. */
  readonly arrivalMessage: string;
  readonly setLocale: (locale: UiLocale) => void;
  /** The save was read, or a level was played: redraw the ways in. */
  readonly setRoutes: (routes: TitleScreenRoutes) => void;
  /** An exam was left, finished or discarded: the exam item changes its label. */
  readonly setExamUnfinished: (unfinished: boolean) => void;
  /** `TN-TITLE-05`: focus starts on the primary control, never on the body. */
  readonly focus: () => void;
  readonly destroy: () => void;
}

export function createTitleScreen(host: HTMLElement, options: TitleScreenOptions): TitleScreen {
  const doc = host.ownerDocument;
  injectScreenStyles(doc);

  let locale = options.locale;
  let routes = options.routes;
  let examUnfinished = options.examUnfinished === true;
  let primary: HTMLElement | null = null;

  const root = element(doc, 'div', {
    id: 'tn-title',
    className: 'tn-screen__card',
    testId: 'title-screen',
  });

  /*
   * The heading is the game's name and the view's focus target for a screen
   * reader. `tabindex="-1"` makes it programmatically focusable without adding
   * it to the Tab order; the *primary control* is what actually takes focus on
   * arrival (`TN-TITLE-05`), and the heading names the screen.
   */
  const heading = element(doc, 'h1', {
    id: 'tn-title-heading',
    className: 'tn-title__brand',
    text: text(locale, 'title.game'),
  });
  heading.tabIndex = -1;

  /*
   * Three flat bands under the wordmark, in the flag's proportion.
   *
   * Decoration and only decoration: it is `aria-hidden`, it holds no text, no
   * state and no meaning, and every scenario in `TN-TITLE` reads identically
   * with it deleted. It is here because the first screen of a game about Canada
   * should look like one, and because a band of solid colour is something the
   * palette can express (`assets/style/palette.json`) where a picture would be
   * an asset on the initial payload.
   */
  const flag = element(doc, 'div', {
    className: 'tn-title__flag',
    attrs: { 'aria-hidden': 'true' },
    children: [
      element(doc, 'span'),
      element(doc, 'span'),
      element(doc, 'span'),
    ],
  });

  const tagline = element(doc, 'p', {
    id: 'tn-title-tagline',
    className: 'tn-title__tagline',
    text: text(locale, 'title.tagline'),
  });

  /* The wordmark, the band and the tagline read as one block, above the ways
     in. Presentation only: the reading order is unchanged. */
  const hero = element(doc, 'div', {
    className: 'tn-title__hero',
    children: [heading, flag, tagline],
  });

  /* Drawn from the save, and only when there is one. Not the only way to know
     Continue exists — the control says so itself (`TN-TITLE-07`). */
  const lastPlayed = element(doc, 'p', {
    id: 'tn-title-last-played',
    testId: 'title-last-played',
    className: 'tn-screen__help',
  });

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });

  /* Last in reading order, first in importance to say out loud: this game is
     not from the Government of Canada (`TN-TITLE-01`). */
  const disclaimer = element(doc, 'p', {
    testId: 'title-not-official',
    className: 'tn-screen__help',
    text: text(locale, 'title.notOfficial'),
  });

  root.append(hero, lastPlayed, actions, disclaimer);
  host.append(root);

  render();

  function render(): void {
    heading.textContent = text(locale, 'title.game');
    tagline.textContent = text(locale, 'title.tagline');
    disclaimer.textContent = text(locale, 'title.notOfficial');

    const resume = routes.kind === 'returning' ? routes.resume : undefined;
    if (resume === undefined) {
      lastPlayed.textContent = '';
      lastPlayed.hidden = true;
    } else {
      lastPlayed.textContent = text(locale, 'title.lastPlayed', { level: resume.levelTitle });
      lastPlayed.hidden = false;
    }

    const items: HTMLElement[] = [];

    if (routes.kind === 'first-run') {
      items.push(
        button(doc, {
          testId: 'title-play',
          text: text(locale, 'title.play'),
          /* The one action that carries the player forward, drawn as such
             (`app/ui/screen-styles.ts`). Exactly one per screen: on this route
             it is Play, on the other it is Continue when there is one and
             "Choose a level" when there is not. */
          attrs: { 'data-tn-action': 'primary' },
          onClick: routes.onPlay,
        }),
      );
    } else {
      /* Continue first, and it says where it goes: the whole cost of landing a
         returning player on the title screen is this one tap (`TN-FLOW`, seam 1),
         so it is paid at the shortest possible reach. */
      if (resume !== undefined) {
        items.push(
          button(doc, {
            testId: 'title-continue',
            text: text(locale, 'title.continue'),
            /* `TN-TITLE-07`: announced with the level it would open. It points
               at the visible line rather than repeating it, so what is read and
               what is on screen cannot drift — and the line is only drawn when
               there is a level, which is the only time this control exists. */
            attrs: {
              'aria-describedby': lastPlayed.id,
              'data-tn-action': 'primary',
            },
            onClick: resume.onContinue,
          }),
        );
      }
      items.push(
        button(doc, {
          testId: 'title-choose-level',
          text: text(locale, 'map.open'),
          /* Primary only when there is no Continue above it: one screen, one
             red action. */
          ...(resume === undefined ? { attrs: { 'data-tn-action': 'primary' } } : {}),
          onClick: routes.onChooseLevel,
        }),
      );
    }

    if (options.onOpenStudy !== undefined) {
      items.push(
        button(doc, {
          testId: 'title-study',
          text: text(locale, 'study.open'),
          onClick: options.onOpenStudy,
        }),
      );
    }

    if (options.onOpenExam !== undefined) {
      items.push(
        button(doc, {
          testId: 'title-exam',
          /* `TN-ATTEMPT-03`: "it does not read 'Practice exam'" while there is
             one to finish. The label is the whole of how a player learns the
             exam survived their closing the tab. */
          text: text(locale, examUnfinished ? 'exam.resume' : 'exam.open'),
          onClick: options.onOpenExam,
        }),
      );
    }

    if (options.onOpenSettings !== undefined) {
      items.push(
        button(doc, {
          testId: 'title-settings',
          text: text(locale, 'common.settings'),
          attrs: { 'data-tn-action': 'quiet' },
          onClick: options.onOpenSettings,
        }),
      );
    }

    replaceChildren(actions, items);
    primary = items[0] ?? null;
  }

  return {
    element: root,
    heading,
    get primary(): HTMLElement | null {
      return primary;
    },
    get arrivalMessage(): string {
      /*
       * `TN-TITLE-07` asks for "a message naming the game and the screen, once".
       * No row is written for that sentence, so this composes two rows that are
       * — the game's name and what it is for — rather than inventing a third.
       * Reported as a gap with the task; if a row lands, it replaces this.
       */
      return `${text(locale, 'title.game')}. ${text(locale, 'title.tagline')}`;
    },
    setLocale(next): void {
      locale = next;
      render();
    },
    setRoutes(next): void {
      routes = next;
      render();
    },
    setExamUnfinished(unfinished): void {
      examUnfinished = unfinished;
      render();
    },
    focus(): void {
      /* The primary control, not the heading: `TN-TITLE-05` puts focus on the
         thing the player is most likely to want, and never on the body. */
      (primary ?? heading).focus();
    },
    destroy(): void {
      root.remove();
    },
  };
}
