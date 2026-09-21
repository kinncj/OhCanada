/**
 * The lesson reader: the surface a player reads a lesson passage on (ADR-0063).
 *
 * `docs/stories/TN-READ-reading-a-passage-at-a-stop.md` is the acceptance
 * criteria. ADR-0063 made a passage *reachable* — a fifth quest step kind,
 * `read`, carrying `{ lesson, passage }` references — and left the surface
 * unbuilt, with one question named as owed rather than solved: **what a
 * single-switch player and a screen-reader player do with prose** (§3, and the
 * ui-a11y obligation dated 2027-01-20). This file is that answer.
 *
 * **No copy is written here, and no string is invented.** The lesson's title and
 * every passage are content — authored in `content/lessons/**`, granted by a
 * verifier, and carried here in the player's language by the caller. The one
 * word this file draws from the shared table is `common.close`, which the
 * landmark card already draws. There is no counter, no "next", no "you have read
 * this", and no progress: ADR-0063 records that **whether reading happened is
 * not checkable and must not be gated**, and a control that claims to know is a
 * control that lies.
 *
 * ## How the words get here, and what this file may not do
 *
 * It draws {@link LessonReaderView}: passages **already resolved, already
 * filtered and already localised**. The route is deliberate and it is ADR-0063
 * §6's, held at this end by the shape of the type rather than by a convention:
 *
 *  - **It never resolves a `{ lesson, passage }` reference.** Resolution is
 *    cross-document — it must fail differently on zero matches and on two
 *    (ADR-0063 §4) — and a screen that globbed 48 lesson documents to answer it
 *    would put the whole corpus in the initial payload, against §6's per-chapter
 *    lazy catalogue and the <= 8 MB budget. {@link LessonReaderView} has **no
 *    field a reference could be poured into**.
 *  - **It never decides whether a passage may be read.** §6 puts the
 *    shippable-passage filter in `app/application`, "never in a screen, so the
 *    level reader and the Learn reader cannot disagree about what is readable".
 *    {@link ReadablePassage} therefore has **no `fact` and no `verification`** —
 *    a screen written against a raw `LessonPassage` would be a screen that could
 *    put a quarantined paragraph on a phone with every gate still green. The
 *    omission is a type, not a habit. This is `app/ui/about-this-place.ts`'s
 *    discipline exactly, for the same failure.
 *  - **It never chooses a language.** A passage carries `text.en` and `text.fr`;
 *    the caller picks, as it does for the landmark card, so this is not a second
 *    place that decides what "the French one" means. {@link LessonReader.setLocale}
 *    therefore *requires* the view back: the alternative is a French heading over
 *    English prose, which is what an optional parameter eventually ships.
 *
 * What reaches the card is prose and an id. That is the whole contract, and it
 * is the same contract for a passage read at a stop and a passage read in Learn
 * (ADR-0061), which is what §6 asks of the two readers.
 *
 * ## Single-switch (ADR-0063 §3, the question this file was owed for)
 *
 * "Tap anywhere advances" is a rule written for **cards** — a heading and two
 * buttons — and prose is not a card: there is nothing to advance to, and a
 * switch player cannot scroll, so a paragraph below the fold is a paragraph they
 * can never reach. A ring built only from controls would highlight `Close`, and
 * `Close` alone, over a passage the player never heard.
 *
 * So **each passage is a stop in the ring** (`SWITCH_STOP_ATTRIBUTE`), which is
 * `app/ui/confirm.ts`'s device and the same one scanning implementation —
 * `createSwitchRing`, owned by `app/ui/single-switch.ts` and given to this
 * surface by `app/ui/screen.ts` on `show()`. There is no second scanning
 * concept here and there must never be one. The ring is therefore:
 *
 *     passage 1 -> passage 2 -> ... -> passage n -> Close -> (wraps)
 *
 * and each short press does three things at once: it moves the highlight, it
 * **scrolls that passage into view** (`focusAndReveal`, the only way a switch
 * player scrolls anything), and it **speaks that passage** into the one live
 * region. Reading the document is the same gesture as moving through it. A long
 * press on a passage reads it again and does nothing else — a stop that could
 * act would be no stop — and only the last item in the ring closes anything.
 *
 * Nothing scans by itself and nothing expires: there is no `setTimeout` in this
 * file, and no timer outside Exam mode.
 *
 * **A measured rough edge, recorded rather than hidden.** `focusAndReveal`
 * scrolls as little as it can, which going *down* the ring brings a tall
 * paragraph's start into view and coming back *up* to it, on the wrap, brings
 * its end. So at 200 % text, with the longest passage the corpus ships — 314
 * characters in French, about 1 290 px against an 844 px viewport — a sighted
 * switch player sees the head of every passage on the first lap and the tail of
 * the first passage on every lap after. The spoken route is unaffected: the
 * whole paragraph is read aloud either way. A screen-specific override was
 * written and removed, because the shared reveal runs after it and undoes it,
 * and fixing it properly means changing `focus-scroll.ts` for every screen in
 * the game — which is not this screen's to decide. The cheap fix is editorial
 * and is the story's rule: three or four passages a stop, and a passage taller
 * than the phone does not go on one. `TN-READ`'s `OQ-READ-2`.
 *
 * ## Screen reader
 *
 * A passage is prose the player is **meant to read**, so the prose is the
 * dialog's own description rather than something behind a control:
 *
 *  1. **On open**, the dialog is named by the lesson's title and described by the
 *     whole body, so a screen reader reading a dialog on arrival reads the title
 *     and then every passage, in the order the `read` step named them. Nothing
 *     is announced separately: a live-region message as well would say it all
 *     twice, which is `about-this-place.ts`'s rule and `level-events.ts`'s.
 *  2. **Again, in the reader's own time.** The passages are real paragraphs in
 *     reading order inside the dialog — not behind a control, not a tooltip, and
 *     never text drawn on the `aria-hidden` canvas — so a reading cursor walks
 *     them, re-reads one, or spells a word out. That is the ordinary way a
 *     screen-reader player reads prose and it needed no invention; what it
 *     needed was for the prose to *be there*, which before ADR-0063 it was not.
 *  3. **Again, passage by passage, on one switch**: the scan above, which speaks
 *     one passage per press with its `lang` attached, so French prose is not read
 *     with English phonemes (`TN-LEVEL-11`).
 *
 * Route 3 speaks through the live region *and* moves focus to the paragraph,
 * which some screen readers read on focus. That is a deliberate belt and
 * braces: which of the two a given reader does is not knowable from here, and
 * `confirm.ts` settled the trade in the same words — heard twice at worst, and
 * never nothing, which is the failure that matters.
 *
 * **What is deliberately not here: a second Tab stop over the prose.** It was
 * written and taken out. A focusable box round the paragraphs would be a stop a
 * keyboard player meets on the way to `Close` that does nothing, and it would
 * claim a semantic (`group`, or a `region` landmark inside a dialog) to justify
 * itself. The screen root already scrolls and already holds focus at open, so
 * the keys that scroll a long page scroll this one; the prose needs no widget
 * round it to be read.
 *
 * ## Modality, and where focus goes back to
 *
 * A sheet over the level, like the landmark card (ADR-0041, ADR-0045): the stop
 * the player walked up to stays in view, dimmed, above it. Escape and `Close`
 * both close, and focus returns to whatever opened the reader — named by
 * {@link LessonReaderOptions.restoreFocusTo}, because a reader opened by tapping
 * a plaque on the canvas was opened by something `aria-hidden` that takes no
 * focus, and the trap would otherwise restore to `<body>`.
 *
 * DOM only (ADR-0005). No adapters, no scenes, no content.
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';
import { SWITCH_STOP_ATTRIBUTE } from './single-switch';

/**
 * One passage, as a player meets it: an identity and a paragraph.
 *
 * Structurally the readable half of `LessonPassage`, and deliberately not that
 * type: `fact` and `verification` are the fields a screen may not act on, and
 * `text` is a `LocalizedText` this file may not resolve. See the note at the
 * top.
 */
export interface ReadablePassage {
  /**
   * The passage's own `id`, for `data-tn-passage`.
   *
   * Not drawn and not announced — it is an authoring identity, not a word of
   * copy. It is here so a failing scan, a screenshot or a report can name the
   * paragraph it is about, which on a surface whose whole content is content is
   * the difference between "the second paragraph" and a reference somebody can
   * look up. Unique only **within its lesson** (`lesson.schema.json`), which is
   * exactly the scope one reader draws.
   */
  readonly id: string;
  /** The passage's own `text.en` or `text.fr`, chosen by the caller. */
  readonly text: string;
}

/** What the reader draws: one lesson's title, and the passages a step named. */
export interface LessonReaderView {
  /**
   * The lesson's own `title`, already localised. Names the dialog.
   *
   * Required rather than defaulted, for the reason the landmark card's heading
   * and the dialogue's speaker are: an unnamed dialog is a defect, and a default
   * is how one gets shipped.
   */
  readonly title: string;
  /**
   * In the order the `read` step named them. **At least one** — a reader with
   * nothing in it is a blank sheet the player taps past, which ADR-0024 refuses
   * and `app/bootstrap/quests.ts` already refuses at load. An empty list does
   * not open the reader; see {@link LessonReader.show}.
   */
  readonly passages: readonly ReadablePassage[];
}

export interface LessonReaderOptions {
  readonly locale: UiLocale;
  /**
   * The one live region (`app/ui/live-region.ts`). Screens never make a second.
   *
   * Used by the switch scan and by nothing else: opening the reader announces
   * nothing, because the dialog describes itself.
   */
  readonly announce?: (message: string, lang?: string) => void;
  /** Close, and Escape. The caller resumes the level and advances the quest. */
  readonly onClose?: () => void;
  /**
   * Where focus goes when the reader closes. A function rather than an element,
   * for the landmark card's reason: the interact prompt is rebuilt whenever the
   * offer changes, so a remembered node would be the one that was removed.
   */
  readonly restoreFocusTo?: () => HTMLElement | null;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface LessonReader {
  readonly element: HTMLElement;
  readonly visible: boolean;
  /** Opens on a view with at least one passage; an empty one opens nothing. */
  show(view: LessonReaderView): void;
  hide(): void;
  /**
   * The player changed language. The passages come back with it, for the reason
   * `about-this-place.ts` states: this screen cannot re-resolve prose it was
   * handed, and a required parameter is what stops a French heading appearing
   * over English paragraphs.
   */
  setLocale(locale: UiLocale, view: LessonReaderView): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

const ID = 'tn-lesson-reader';

export function createLessonReader(
  host: HTMLElement,
  options: LessonReaderOptions,
): LessonReader {
  const doc = host.ownerDocument;
  let locale = options.locale;
  /* Tracked here as well as in the screen, because the screen does not report
     it and a long press on prose must do nothing when the switch is off. */
  let switchEnabled = options.singleSwitch === true;

  const close = (): void => {
    hide();
    options.onClose?.();
  };

  const screen: Screen = createScreen(host, {
    id: ID,
    testId: 'lesson-reader',
    locale,
    /* A sheet over the level, so the stop the player walked up to stays in view
       above it (ADR-0041). The screen root scrolls when the prose is taller than
       the phone, which is every other screen's behaviour and needs no nested
       scroller — nested scrollers are what strand a paragraph at 200 % text. */
    className: 'tn-lesson-reader tn-screen--sheet',
    onEscape: close,
    ...(options.announce === undefined
      ? {}
      : {
          announce: (message: string) => {
            options.announce?.(message, locale);
          },
        }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: `${ID}-title`, testId: 'lesson-reader-title' });
  screen.labelledBy(title);

  /*
   * The prose. A plain box holding plain paragraphs, exactly as the landmark
   * card's body is: no role, no tabindex, nothing between the words and the
   * reading cursor. It is the dialog's description, so it is what a screen
   * reader reads after the title when the reader opens.
   */
  const body = element(doc, 'div', {
    id: `${ID}-body`,
    testId: 'lesson-reader-body',
    className: 'tn-lesson-reader__body',
  });
  /* Read on arrival, in the order the step named them. See "Screen reader". */
  screen.describedBy(body);

  const closeButton = button(doc, {
    testId: 'lesson-reader-close',
    text: text(locale, 'common.close'),
    onClick: close,
  });

  screen.card.append(
    title,
    body,
    element(doc, 'div', { className: 'tn-screen__actions', children: [closeButton] }),
  );

  /**
   * A long press on a passage: read it again, and change nothing.
   *
   * The only thing that can land here is the switch — a paragraph is out of the
   * Tab order and is no kind of control — so the guard is the switch being on
   * rather than which kind of event arrived. It is `confirm.ts`'s stop, asked of
   * prose: the one thing a switch player could not do before was ask for a
   * paragraph again.
   */
  const repeat = (passage: ReadablePassage): void => {
    if (!switchEnabled || !screen.visible) return;
    options.announce?.(passage.text, locale);
  };

  function render(view: LessonReaderView): void {
    title.textContent = view.title;
    replaceChildren(
      body,
      view.passages.map((passage) => {
        const paragraph = element(doc, 'p', {
          testId: 'lesson-reader-passage',
          className: 'tn-lesson-reader__passage',
          text: passage.text,
          /*
           * A stop in the ring, and out of the Tab order: `focus-trap.ts`
           * excludes a negative `tabindex`, so a keyboard player tabs from the
           * dialog straight to `Close` rather than through every paragraph. The
           * highlight can still focus it, which is what scrolls it into view.
           */
          attrs: {
            tabindex: '-1',
            [SWITCH_STOP_ATTRIBUTE]: 'true',
            /* Names the paragraph for a scan or a report; never drawn, never read. */
            'data-tn-passage': passage.id,
          },
        });
        paragraph.addEventListener('click', () => {
          repeat(passage);
        });
        return paragraph;
      }),
    );
  }

  function hide(): void {
    if (!screen.visible) return;
    screen.hide();
    /*
     * The trap restores focus to whatever opened the reader, which is right when
     * the interact prompt was pressed and wrong when the plaque on the canvas
     * was tapped — the canvas is `aria-hidden` and takes no focus, so the trap
     * would restore to the body. Naming the destination is what makes "focus
     * returns to where the player was" true both ways.
     */
    const destination = options.restoreFocusTo?.() ?? null;
    if (destination !== null && destination.isConnected) {
      destination.focus({ preventScroll: true });
    }
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(view): void {
      /*
       * Nothing to read is not a reader. `app/bootstrap/quests.ts` already
       * refuses a `read` step with an empty `passages[]` at load, and this is the
       * second line: a sheet with a heading and no words is a screen the player
       * dismisses, having been told nothing, with every gate green (ADR-0024).
       */
      if (view.passages.length === 0) return;
      render(view);
      screen.show();
      screen.refreshSwitch();
    },

    hide,

    setLocale(next, view): void {
      locale = next;
      screen.setLocale(next);
      closeButton.textContent = text(next, 'common.close');
      if (view.passages.length === 0) return;
      render(view);
      screen.refreshSwitch();
    },

    setSingleSwitch(enabled, holdMs): void {
      switchEnabled = enabled;
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
