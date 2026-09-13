/**
 * "About this place": the panel that states whose land a level stands on.
 *
 * `docs/content-review.md` §10.2 is the mandate, and it has been unbuilt since
 * it was written. Ten level documents carry a territorial statement, each quoted
 * from that nation's own page and each verified like any other claim, and **not
 * one of them reached a player** — there was no screen that drew one. This is
 * that screen.
 *
 * ## What it draws, and what it is never allowed to draw
 *
 * It draws {@link AboutThisPlaceView}, which is the **adjudicated** claim: the
 * composition root builds it from `SceneLevel.about`, the discriminated union
 * `app/adapters/phaser/verified-claim.ts` produces after running ADR-0003's
 * three conditions over the level's territorial claim.
 *
 * **It never draws a level document's `territory` block**, and it cannot: this
 * file is `app/ui`, it may not read content and may not import an adapter
 * (ADR-0005), and the view it takes has no field a raw document could be poured
 * into. That is deliberate and it is the failure this panel was most likely to
 * become — a screen written against `territory.statement` would put a sentence
 * on screen that a verifier had declined, with every gate still green.
 *
 * **The refused branch carries no nation and no publisher, and that is
 * load-bearing rather than tidy.** Halifax's statement was rejected because its
 * first sentence places Halifax in Mi'kma'ki and the cited source does not say
 * so. `nations: ["Mi'kmaq"]` is that same attribution as a list; naming the
 * publisher makes it indirectly, because "Assembly of Nova Scotia Mi'kmaw
 * Chiefs" attributes the territory as plainly as the sentence does. A panel that
 * dropped the sentence and kept either would still be making the declined claim,
 * in a form a reader cannot even disagree with. So {@link AboutThisPlaceView}'s
 * `unavailable` branch has **no field for a nation, a publisher or a URL** —
 * the omission is a type, not a habit — and it carries no developer message
 * either, because `AboutThisPlace.message` says which field of which document
 * failed and is for a console.
 *
 * ## Modality, which §10.2 decides and a reader may expect the opposite of
 *
 * §10.2 rules out "**a modal on level entry that the player dismisses to get to
 * the game**", a splash card, a collectible, a stamp, an NPC line — every shape
 * the player *taps past on the way to gameplay* — and requires the panel to be
 * "DOM, ARIA, keyboard, single-switch, EN and FR, **like every other screen**".
 *
 * So this is a dialog built exactly like `app/ui/passport.ts` and
 * `app/ui/poi-card.ts`: `role="dialog"`, `aria-modal="true"`, focus contained
 * while it is open, Escape closes it, and focus returns to the control that
 * opened it. What makes it §10.2-compliant is **where it is reachable from and
 * that it is never shown unasked** — it is on no route into a level, nothing has
 * to be dismissed to start playing, and closing it puts the player back exactly
 * where they were. Two things follow, and neither is negotiable:
 *
 *  - **Nothing constructs it on level entry.** `app/bootstrap/main.ts` builds it
 *    inside `openAbout`, which only the menu item calls, so a level that is
 *    never asked never makes one.
 *  - **It announces nothing to the live region.** Asserted in the unit suite,
 *    for both branches.
 *
 * The alternative — a surface that covers the viewport, claims not to be modal,
 * and lets Tab walk into live controls the player cannot see — is not the more
 * accessible reading of "never modal". It is a lie in the other direction, and
 * single-switch mode ("tap anywhere") cannot coexist with a running level
 * underneath at all.
 *
 * ## The accessible name, and the announcement
 *
 * The name is the panel's own `<h1>`, `about.title`, which is word-for-word the
 * control that opened it (`about.open`). That is `app/ui/menu.ts`'s discipline —
 * "the dialog's accessible name is the word the player pressed, so what they see
 * and what they hear are the same thing" — and it is why the name is not
 * "About Ottawa": composing a place name into a heading needs a preposition, and
 * `title.lastPlayed` records what French does to that idea. The place identifies
 * itself in the first line, because the first line is the statement.
 *
 * **Nothing is announced when it opens.** It is a dialog, it takes focus, and a
 * screen reader reads a dialog on arrival — the rule `app/ui/level-screens.ts`
 * states for the two screens that do not announce themselves, and the reason
 * `SPEAKS['poi/engaged']` is `false`. A live-region message as well would say
 * everything twice, and `TN-PEGGYS-03` requires that "nothing about it is
 * announced unasked while I am playing".
 *
 * ## The source link
 *
 * §10.2: "the panel names where the territorial statement comes from, and the
 * source is the nation's own material where one exists." The publisher is the
 * link's text — never a bare URL, never "click here", never an icon — and the
 * link **says out loud that it leaves the game**, as visible prose that is also
 * its accessible description. It opens in a new context with
 * `rel="noopener noreferrer"`, so the source page cannot reach back into a game
 * holding a player's save.
 *
 * DOM only (ADR-0005). No adapters, no scenes, no content.
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/**
 * Why a statement is not on screen, in the two shapes a player can act on —
 * which is to say, neither of them, and that is the honest answer.
 *
 * - `being-checked` — the source moved under a verdict that was once true
 *   (`quarantined`, or a status granted for a `sourceHash` the claim no longer
 *   cites). `TN-PEGGYS-06` and `TN-NORTH-06` require the panel to "say plainly
 *   that the source is being checked" in exactly this case.
 * - `not-checked` — everything else: never verified, verified with no quoted
 *   evidence, or checked and declined.
 *
 * Three of `ClaimRefusalReason`'s and `FactVerification`'s distinctions collapse
 * into the second, on purpose. "Rejected" and "unverified" differ to a verifier
 * and not to a player, and spelling the difference out would publish a verdict
 * *about a nation's page* on a screen that exists to quote it.
 */
export type AboutUnavailableReason = 'being-checked' | 'not-checked';

/**
 * What the panel draws: the adjudicated claim, already localised.
 *
 * Structurally the player-facing half of `SceneLevel.about`, and deliberately
 * not an import of it — `app/ui` may not import an adapter, and a `LocalizedText`
 * resolved here would be a second place that decides what "the French one" means.
 * The composition root resolves the language and drops every field the refused
 * branch may not carry.
 */
export type AboutThisPlaceView =
  | {
      readonly kind: 'statement';
      /** The territorial fact, in the language in force. §10.2's first line. */
      readonly statement: string;
      /**
       * Each nation named as that nation names itself — identical in the EN and
       * the FR panel, diacritics included (`docs/content-review.md` §9.3).
       * Drawn only beside the statement it came from, never on its own.
       */
      readonly nations: readonly string[];
      /** Who published the source. The link's text, never a bare URL. */
      readonly publisher: string;
      readonly sourceUrl: string;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: AboutUnavailableReason;
    };

export interface AboutThisPlaceOptions {
  readonly locale: UiLocale;
  /**
   * The one live region (`app/ui/live-region.ts`).
   *
   * Used by the switch ring and by nothing else here: a switch user moving the
   * highlight is told what it landed on, which they asked for by pressing.
   * **Opening the panel announces nothing** — see the note at the top.
   */
  readonly announce?: (message: string, lang?: string) => void;
  /** Close, and Escape. The caller resumes the level. */
  readonly onClose?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface AboutThisPlace {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(content: AboutThisPlaceView): void;
  hide(): void;
  /**
   * The player changed language. The content comes back with it: the statement
   * and the reason are resolved by the caller from data this screen cannot
   * re-resolve, and a required parameter is what stops a French player reading
   * an English statement under a French heading.
   */
  setLocale(locale: UiLocale, content: AboutThisPlaceView): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

const ID = 'tn-about-this-place';

export function createAboutThisPlace(
  host: HTMLElement,
  options: AboutThisPlaceOptions,
): AboutThisPlace {
  const doc = host.ownerDocument;
  let locale = options.locale;

  const close = (): void => {
    hide();
    options.onClose?.();
  };

  const screen: Screen = createScreen(host, {
    id: ID,
    testId: 'about-this-place',
    locale,
    className: 'tn-about',
    onEscape: close,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: `${ID}-title` });
  screen.labelledBy(title);

  /* Everything between the heading and the actions. Rebuilt on every `show` and
     on every language change, because the two branches share no element: a
     statement's list and a refusal's sentence are not two states of one node,
     and reusing one would be how a nation's name survives into a panel that may
     not carry it. */
  const body = element(doc, 'div', { id: `${ID}-body`, className: 'tn-about__body' });
  screen.describedBy(body);

  const closeButton = button(doc, {
    testId: 'about-this-place-close',
    text: text(locale, 'common.close'),
    onClick: close,
  });

  screen.card.append(
    title,
    body,
    element(doc, 'div', { className: 'tn-screen__actions', children: [closeButton] }),
  );

  /**
   * The statement, the nations it names, and where it came from — in that order,
   * because §10.2 fixes the territorial fact as the first line and everything
   * else on the screen exists to let a reader check it.
   */
  function statementRows(view: Extract<AboutThisPlaceView, { kind: 'statement' }>): HTMLElement[] {
    const rows: HTMLElement[] = [
      element(doc, 'p', {
        testId: 'about-this-place-statement',
        className: 'tn-about__statement',
        text: view.statement,
      }),
    ];

    /*
     * A list, and a list even of one, because these are names rather than prose:
     * a screen reader reads a list item as a unit, which is what keeps
     * "Kwanlin Dün First Nation" a name and not a run-on with the sentence
     * before it (`TN-NORTH-03`: "the endonyms in it are read as words").
     *
     * `nations` is never empty on this branch in practice — a verified
     * territorial claim names somebody — and an empty one draws no heading
     * rather than an empty list under a label promising names.
     */
    if (view.nations.length > 0) {
      rows.push(
        element(doc, 'h2', { text: text(locale, 'about.nations') }),
        element(doc, 'ul', {
          testId: 'about-this-place-nations',
          children: view.nations.map((nation) =>
            /*
             * No `lang`. An endonym is not English and not French, it is spelled
             * identically in both panels (§9.3), and tagging it with either
             * language would tell a screen reader to apply that language's
             * phonemes to a word that belongs to neither. The panel's own `lang`
             * stands, which is the least wrong of the three options available to
             * a file that may not carry a language tag per nation.
             */
            element(doc, 'li', { text: nation }),
          ),
        }),
      );
    }

    const outsideId = `${ID}-outside`;
    const link = element(doc, 'a', {
      testId: 'about-this-place-source',
      text: view.publisher,
      attrs: {
        href: view.sourceUrl,
        target: '_blank',
        /* The source page never gets a handle on the window holding a save. */
        rel: 'noopener noreferrer',
        'aria-describedby': outsideId,
      },
    });

    rows.push(
      element(doc, 'h2', { text: text(locale, 'about.source') }),
      element(doc, 'p', { className: 'tn-about__source', children: [link] }),
      /* Visible prose, not an icon and not a title attribute: "colour is never
         the only signal" is the same rule as "a glyph is never the only signal",
         and this sentence is the link's accessible description as well. */
      element(doc, 'p', {
        id: outsideId,
        className: 'tn-screen__help',
        text: text(locale, 'about.source.outside'),
      }),
    );

    return rows;
  }

  /**
   * The refusal, in two sentences and no names.
   *
   * The first says which of the two things happened; the second says whose
   * problem it is. A player who cannot see the screen gets exactly the same two
   * sentences, in the same order, because they are the content and not a
   * decoration — there is no icon, no colour and no state badge here to carry
   * meaning that the text does not.
   */
  function unavailableRows(
    view: Extract<AboutThisPlaceView, { kind: 'unavailable' }>,
  ): HTMLElement[] {
    return [
      element(doc, 'p', {
        testId: 'about-this-place-unavailable',
        /* Reported as data so a test can tell the two reasons apart without
           matching on the sentence, which is a string a reviewer may replace. */
        attrs: { 'data-tn-reason': view.reason },
        text: text(
          locale,
          view.reason === 'being-checked'
            ? 'about.unavailable.checking'
            : 'about.unavailable.notShown',
        ),
      }),
      element(doc, 'p', {
        testId: 'about-this-place-ours',
        className: 'tn-screen__help',
        text: text(locale, 'about.unavailable.ours'),
      }),
    ];
  }

  /**
   * Draw one of the two branches, whole.
   *
   * The view is a parameter rather than remembered state, and that is the reason
   * {@link AboutThisPlace.setLocale} demands the content back: there is no
   * "current content" for a language change to redraw from, so a caller cannot
   * change the chrome to French and leave the statement in English. It is the
   * same shape `createLevelLoading` uses for a level's own two strings and for
   * the same reason.
   */
  function render(view: AboutThisPlaceView): void {
    title.textContent = text(locale, 'about.title');
    closeButton.textContent = text(locale, 'common.close');
    replaceChildren(
      body,
      view.kind === 'statement' ? statementRows(view) : unavailableRows(view),
    );
  }

  function hide(): void {
    if (!screen.visible) return;
    screen.hide();
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(content): void {
      render(content);
      screen.show();
      screen.refreshSwitch();
      /* Nothing goes to the live region. The dialog has focus and is read on
         arrival; see the note at the top of this file. */
    },

    hide,

    setLocale(next, content): void {
      locale = next;
      screen.setLocale(next);
      render(content);
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
