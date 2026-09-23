/**
 * The question card.
 *
 * `docs/stories/TN-CARD-question-card.md` is the acceptance criteria. Four of
 * its rules shape the code rather than the styling:
 *
 *  - **Nothing counts down.** There is no timer in this file, at all. The card
 *    is unchanged after two minutes because nothing is scheduled to change it.
 *  - **The player never learns how questions are chosen.** The only scheduling
 *    word on screen is the tag — "New question" or "You have seen this question
 *    before" (ADR-0036) — and the promise that a
 *    missed question comes back. `spaced repetition`, `FSRS`, `algorithm`,
 *    `interval`, `due` appear nowhere, in either language, and a unit test reads
 *    every string this card can draw to prove it.
 *  - **One answer, once.** `TN-CARD-04`: a second tap emits nothing and changes
 *    nothing, which covers the double tap in `TN-CARD-05` without a gesture
 *    timer.
 *  - **Right and wrong are a word and a shape, never a colour.** Every mark is a
 *    glyph *and* the words "Your answer" / "Correct answer".
 *
 * The wording of the question, its options and its explanation are content
 * (`content/questions/*`), verified by the content agents. Nothing here writes
 * question wording.
 *
 * ## The layout (ADR-0045)
 *
 * The card hugs its content at the foot of the screen, so nothing is left blank
 * under the options before the player answers. In a level it is a sheet over the
 * level, like the landmark card before it (ADR-0041); in Study it keeps the night
 * behind it. When the answer arrives the result gets focus, as it always did, and
 * the way on is scrolled into view with it, so "Next" is never below the fold.
 *
 * ## "Read about this" (ADR-0070, `TN-TEACHBACK`)
 *
 * Once an answer is judged, and only then, the card may offer the lesson
 * passage that tells what the question asked. The caller hands it over as the
 * lesson reader's own view — a title and prose, already resolved, filtered and
 * in one language — through {@link QuestionCard.setReading}; this file resolves
 * nothing and decides nothing about what is readable. No view, no control: a
 * question with nothing to read offers nothing, not a disabled button.
 *
 * The reader opens as its own dialog beside this one, the card stands its trap
 * and switch ring down while it is there (`Screen.setCovered`), and closing it
 * puts focus — and the switch highlight — back on the control that opened it.
 *
 * DOM only (ADR-0005). Study mode reuses this card exactly (`TN-STUDY`).
 */

import { text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { motionIsReduced } from './focus-scroll';
import { createLessonReader, type LessonReader, type LessonReaderView } from './lesson-reader';
import { createScreen, type Screen } from './screen';

export interface QuestionView {
  /** New, or seen before — the only thing the player is told about scheduling. */
  readonly kind: 'new' | 'seen';
  /** Zero-based position in the current activity, not in the bank (`OQ-CARD-3`). */
  readonly index: number;
  readonly total: number;
  /**
   * What the counter says, when it counts something other than this set.
   *
   * In a level the card counts the quest step's questions, not the drill: a step
   * of two, one of which was answered at an earlier landmark, reads "Question 2
   * of 2" over the one question left (ADR-0036). Absent, the counter is
   * `index + 1` of `total`. Either way a count of one draws **no counter**:
   * "Question 1 of 1" tells a player nothing, and the dialog is named by the
   * question itself instead.
   */
  readonly progress?: { readonly n: number; readonly of: number };
  /**
   * Where the question is being asked, widest first: the level's name, then the
   * landmark's (ADR-0045). Already localised, and names the game already draws —
   * the map's title for the level and the landmark card's heading — so this card
   * writes no words of its own about the place. Absent or empty draws no line,
   * which is Study, where a question belongs to no place.
   */
  readonly place?: readonly string[];
  readonly prompt: string;
  /**
   * The four options **in the order to draw them**, already localised.
   *
   * Not the authored order: the caller shuffles from a seed (ADR-0059, which
   * resolves `OQ-CARD-2`), and {@link QuestionView.correctIndex} points into
   * *this* list. Nothing in this file needs to know that — the card reads the
   * "the answer is …" wording straight out of this array — and nothing in this
   * file may undo it by sorting.
   */
  readonly options: readonly string[];
  /** Which entry of {@link QuestionView.options} is right, by its drawn position. */
  readonly correctIndex: number;
  /** Absent is survivable: the result and the right answer still show. */
  readonly explanation?: string;
}

export interface QuestionCardOptions {
  readonly locale: UiLocale;
  /** The one live region. `lang` is passed only for prose the lesson reader speaks. */
  readonly announce?: (message: string, lang?: string) => void;
  /** Emitted once per question, never twice (`question/answered`). */
  readonly onAnswer?: (chosenIndex: number, correct: boolean) => void;
  /** "Next" or "Finish" was chosen. The caller presents the next question or hides. */
  readonly onNext?: () => void;
  /** Escape or Close (`question/dismissed`). Not an answer. */
  readonly onDismiss?: () => void;
  /** The dismissal message, for a HUD that wants to show it as well as speak it. */
  readonly onNotice?: (message: string) => void;
  /**
   * The card is asked over a running level (ADR-0045): a sheet, with the level
   * dimmed in view above it, as the landmark card before it is. Absent, the card
   * keeps the night behind it — Study, whose home screen is not a level.
   */
  readonly overLevel?: boolean;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface QuestionCard {
  readonly element: HTMLElement;
  readonly visible: boolean;
  readonly answered: boolean;
  present(question: QuestionView): void;
  hide(): void;
  setLocale(locale: UiLocale): void;
  /**
   * The passage(s) "Read about this" opens for the question on screen, or
   * `null` for none (ADR-0070). Cleared by every {@link QuestionCard.present},
   * so a reading can never outlive its question; the caller sets it again after
   * a language change, because the view is already in one language.
   *
   * The control is drawn only once the answer is judged and only while a view
   * is set. An empty view is treated as `null`.
   */
  setReading(view: LessonReaderView | null): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createQuestionCard(
  host: HTMLElement,
  options: QuestionCardOptions,
): QuestionCard {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let current: QuestionView | null = null;
  let answered = false;
  /** Which option the player took, or `-1` before they have. */
  let chosenIndex = -1;
  /** What "Read about this" opens for the question on screen, if anything. */
  let reading: LessonReaderView | null = null;
  /** Built on first use: most cards are never read about. */
  let reader: LessonReader | null = null;
  let switchEnabled = options.singleSwitch === true;
  let switchHoldMs = options.holdMs ?? 600;

  const screen: Screen = createScreen(host, {
    id: 'tn-question-card',
    testId: 'question-card',
    locale,
    className: `tn-question ${options.overLevel === true ? 'tn-screen--sheet' : 'tn-screen--hug'}`,
    onEscape: dismiss,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  /* Where the question is asked. Outside the dialog's name and description, so
     a screen reader opening the card still hears the counter and the question
     first, and reads the place when it reads the card. */
  const place = element(doc, 'p', {
    testId: 'question-place',
    className: 'tn-question__place',
  });
  place.hidden = true;

  /* The accessible name is the progress line, so a screen reader opening the
     dialog hears "Question 1 of 3" before the prompt (`TN-CARD-08`). */
  const progress = element(doc, 'h1', { id: 'tn-question-progress', testId: 'question-progress' });
  screen.labelledBy(progress);

  /* Words, not an icon (`TN-CARD-08`). */
  const kind = element(doc, 'p', { testId: 'question-kind', className: 'tn-screen__help' });

  /* The counter and the tag share a line when both fit, and wrap when not. */
  const head = element(doc, 'div', {
    className: 'tn-question__head',
    children: [progress, kind],
  });

  const prompt = element(doc, 'p', { id: 'tn-question-prompt', testId: 'question-prompt' });
  screen.describedBy(prompt);

  const optionList = element(doc, 'ul', {
    className: 'tn-screen__options',
    attrs: { role: 'list' },
  });

  const feedback = element(doc, 'div', {
    testId: 'question-feedback',
    className: 'tn-screen__notice',
  });
  feedback.tabIndex = -1;
  feedback.hidden = true;

  const nextButton = button(doc, {
    testId: 'question-next',
    attrs: { 'data-tn-action': 'primary' },
    onClick: () => options.onNext?.(),
  });
  nextButton.hidden = true;

  /*
   * "Read about this" (ADR-0070). After "Next" and before "Close", so the way on
   * stays the first control a keyboard or a switch meets after the result, and
   * this is a side door that comes back to the card rather than a second way on
   * (ADR-0036 §3).
   */
  const readButton = button(doc, {
    testId: 'question-read-about',
    text: text(locale, 'card.readAbout'),
    onClick: openReading,
  });
  readButton.hidden = true;

  const closeButton = button(doc, {
    testId: 'question-close',
    text: text(locale, 'card.close'),
    attrs: { 'data-tn-action': 'quiet' },
    onClick: dismiss,
  });

  const actions = element(doc, 'div', {
    className: 'tn-screen__actions',
    children: [nextButton, readButton, closeButton],
  });

  screen.card.append(place, head, prompt, optionList, feedback, actions);

  /**
   * The dismissal message. It outlives the card by design — the card is gone
   * and the game has resumed, so "No problem. We will ask again later." has to
   * live somewhere the player can still read it. It carries no `aria-live` of
   * its own: `app/ui/live-region.ts` owns the only announcement channel, and a
   * second polite region is a well-known way to make a screen reader go quiet.
   */
  const notice = element(doc, 'p', {
    testId: 'question-closed-notice',
    className: 'tn-screen__help',
  });
  notice.hidden = true;
  host.append(notice);

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    get answered(): boolean {
      return answered;
    },

    present(question): void {
      closeReading(false);
      current = question;
      answered = false;
      chosenIndex = -1;
      reading = null;
      readButton.hidden = true;
      notice.hidden = true;
      notice.textContent = '';

      paintQuestion(question);
      feedback.hidden = true;
      replaceChildren(feedback, []);
      nextButton.hidden = true;
      /* A question not yet answered can be left; see `answer` for why an
         answered one cannot be left this way. */
      closeButton.hidden = false;
      /* A new question starts at its top, not where the last explanation was
         scrolled to. */
      screen.element.scrollTop = 0;

      screen.show();
      screen.refreshSwitch();
      /* `TN-STUDY-08`: moving to the next question is announced. A card with no
         counter has nothing to announce that its own name does not already say
         on arrival, so it announces nothing rather than saying it twice. */
      if (counts(question)) options.announce?.(progressText(question));
    },

    hide(): void {
      closeReading(false);
      screen.hide();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      closeButton.textContent = text(next, 'card.close');
      readButton.textContent = text(next, 'card.readAbout');
      /* Switching language mid-question keeps the question and the answer state
         (`TN-CARD-11`); only the words are redrawn. */
      if (current !== null) {
        paintQuestion(current);
        if (answered) repaintFeedback();
      }
    },

    setReading(view): void {
      reading = view !== null && view.passages.length > 0 ? view : null;
      paintReadButton();
      if (reader?.visible === true) {
        /* The language changed under an open reader, or its passage went away. */
        if (reading === null) closeReading(true);
        else reader.setLocale(locale, reading);
      }
    },

    setSingleSwitch(enabled, holdMs): void {
      switchEnabled = enabled;
      if (holdMs !== undefined) switchHoldMs = holdMs;
      screen.setSwitchEnabled(enabled, holdMs);
      reader?.setSingleSwitch(enabled, holdMs);
    },

    destroy(): void {
      reader?.destroy();
      reader = null;
      notice.remove();
      screen.destroy();
    },
  };

  /** Offered once the answer is judged, and only while there is something to read. */
  function paintReadButton(): void {
    const offered = answered && reading !== null && screen.visible;
    if (readButton.hidden === !offered) return;
    readButton.hidden = !offered;
    screen.refreshSwitch();
  }

  function openReading(): void {
    if (!answered || reading === null || !screen.visible) return;
    reader ??= createLessonReader(host, {
      locale,
      ...(options.announce === undefined ? {} : { announce: options.announce }),
      onClose: () => {
        backToCard();
      },
      /* Back to the control that opened it, or — when the reading was
         withdrawn under it — to the way on. */
      restoreFocusTo: () => (readButton.hidden ? nextButton : readButton),
      singleSwitch: switchEnabled,
      holdMs: switchHoldMs,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    reader.setSingleSwitch(switchEnabled, switchHoldMs);
    /* The reader is a dialog of its own, mounted beside this one: an active
       trap here would mark it inert and a live ring here would answer its
       presses (`Screen.setCovered`). */
    screen.setCovered(true);
    reader.setLocale(locale, reading);
    reader.show(reading);
  }

  /** Close the reader, if open. `back` gives the card its focus and ring again. */
  function closeReading(back: boolean): void {
    if (reader?.visible !== true) return;
    reader.hide();
    if (back) backToCard();
    else screen.setCovered(false);
  }

  /**
   * The reader has gone: the card takes its trap and ring back, and the
   * highlight lands on "Read about this" rather than on the first control, so
   * a switch player is where they were (`TN-TEACHBACK-04`).
   */
  function backToCard(): void {
    screen.setCovered(false);
    if (!screen.visible) return;
    const back = readButton.hidden ? nextButton : readButton;
    if (switchEnabled) {
      screen.ring.refresh();
      const at = screen.ring.items.indexOf(back);
      if (at >= 0) screen.ring.highlight(at);
    }
    if (back.isConnected && !back.hidden) back.focus({ preventScroll: true });
  }

  /** What the counter counts: the caller's count, or this set. */
  function counted(question: QuestionView): { readonly n: number; readonly of: number } {
    return question.progress ?? { n: question.index + 1, of: question.total };
  }

  /** Is there anything to count? One question is not a set. */
  function counts(question: QuestionView): boolean {
    return counted(question).of > 1;
  }

  function progressText(question: QuestionView): string {
    const { n, of } = counted(question);
    return text(locale, 'card.progress', { n, total: of });
  }

  /**
   * The place line: each name in its own span, with a dot between them that is
   * drawn and never read. No name is written here.
   */
  function paintPlace(question: QuestionView): void {
    const names = (question.place ?? []).filter((name) => name !== '');
    const parts: HTMLElement[] = [];
    for (const [index, name] of names.entries()) {
      if (index > 0) {
        parts.push(
          element(doc, 'span', {
            className: 'tn-question__place-gap',
            text: '·',
            attrs: { 'aria-hidden': 'true' },
          }),
        );
      }
      parts.push(element(doc, 'span', { text: name }));
    }
    replaceChildren(place, parts);
    place.hidden = names.length === 0;
  }

  function paintQuestion(question: QuestionView): void {
    paintPlace(question);
    /*
     * The counter, or none. With a counter the dialog is named by it and
     * described by the question (`TN-CARD-08`: a screen reader hears "Question 1
     * of 3" before the prompt). Without one it is named by the question itself
     * and has no separate description, so the question is read once, not twice.
     */
    if (counts(question)) {
      progress.textContent = progressText(question);
      progress.hidden = false;
      screen.labelledBy(progress);
      screen.describedBy(prompt);
    } else {
      progress.textContent = '';
      progress.hidden = true;
      screen.labelledBy(prompt);
      screen.describedBy(null);
    }
    kind.textContent = text(locale, question.kind === 'new' ? 'card.kind.new' : 'card.kind.seen');
    prompt.textContent = question.prompt;

    replaceChildren(
      optionList,
      question.options.map((wording, index) => {
        /*
         * The accessible name is the whole option wording and nothing else — no
         * "option 1" prefix, which a screen reader would read before every
         * answer and which truncates nothing but helps nobody (`TN-CARD-08`).
         */
        const control = button(doc, {
          testId: `option-${String(index)}`,
          text: wording,
          onClick: () => answer(index),
        });
        return element(doc, 'li', { children: [control] });
      }),
    );

    if (answered) repaintOptionMarks();
  }

  function answer(index: number): void {
    /* Second tap, double tap, or a switch that fired twice: nothing happens. */
    if (answered || current === null) return;
    answered = true;

    const correct = index === current.correctIndex;
    chosenIndex = index;
    repaintOptionMarks();
    repaintFeedback();

    nextButton.hidden = false;
    /*
     * One way on from the last question (ADR-0036). Once it is answered,
     * "Finish" and "Close" both end the set and keep the answer, so a player
     * reading the explanation was offered two controls with nothing to tell them
     * apart. (In Study, "Close" also says the answers were kept and skips the
     * summary; "Finish" is the route that shows it.) On the last question only the
     * one that carries on is left. On any other, "Next" and "Close" are two
     * different choices (go on, or leave the drill with the answers kept,
     * `TN-STUDY-05`), so both stay. Escape still leaves the card.
     */
    closeButton.hidden = current.index + 1 >= current.total;
    readButton.hidden = reading === null;
    screen.refreshSwitch();
    /* Focus the result so it is read, rather than left behind on the option
       the player just pressed (`TN-CARD-06`). The scroll is `revealWayOn`'s. */
    feedback.focus({ preventScroll: true });
    revealWayOn();

    options.onAnswer?.(index, correct);
  }

  /**
   * Bring the result and the way on into view together (ADR-0045).
   *
   * The live-site audit found "Next" below the fold after answering at 100 %
   * text, and 257 px below it at 200 %. When the result and the actions fit on
   * screen together, the actions are scrolled just far enough to be seen, which
   * keeps the whole result above them. When they do not fit, the result is
   * scrolled to the top, so its first line — "Not quite." — is what is seen, and
   * the way on follows it directly. Instant under reduced motion, from the
   * setting or from the device.
   *
   * A document with no layout (the unit suite's) has nothing to scroll.
   */
  function revealWayOn(): void {
    const target = actions as Partial<Pick<HTMLElement, 'scrollIntoView' | 'getBoundingClientRect'>>;
    const result = feedback as Partial<Pick<HTMLElement, 'scrollIntoView' | 'getBoundingClientRect'>>;
    const scroller = screen.element as Partial<Pick<HTMLElement, 'getBoundingClientRect'>>;
    if (
      target.scrollIntoView === undefined ||
      target.getBoundingClientRect === undefined ||
      result.scrollIntoView === undefined ||
      result.getBoundingClientRect === undefined ||
      scroller.getBoundingClientRect === undefined
    ) {
      return;
    }
    const behavior: ScrollBehavior = motionReduced() ? 'auto' : 'smooth';
    const needed = target.getBoundingClientRect().bottom - result.getBoundingClientRect().top;
    if (needed <= scroller.getBoundingClientRect().height) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior });
    } else {
      result.scrollIntoView({ block: 'start', inline: 'nearest', behavior });
    }
  }

  /** Less movement, from the setting (`applySettings`) or from the device. */
  function motionReduced(): boolean {
    /* One reading of the motion axis for the whole of `app/ui` — this card asked
       the same two questions in its own words until `./focus-scroll.ts` existed. */
    return motionIsReduced(doc);
  }

  function repaintOptionMarks(): void {
    if (current === null) return;
    const controls = Array.from(optionList.querySelectorAll<HTMLElement>('button'));
    for (const [index, control] of controls.entries()) {
      const isCorrect = index === current.correctIndex;
      const isChosen = index === chosenIndex;
      /* `aria-disabled` rather than `disabled`: the answer cannot change, but a
         screen-reader or switch user must still be able to read every option
         back after answering. */
      control.setAttribute('aria-disabled', 'true');
      if (!isCorrect && !isChosen) continue;

      /*
       * The fill, and it is the *third* signal rather than the first.
       *
       * The two below it are the mark — a tick or a cross — and the words
       * "Correct answer" / "Your answer", both of which are added in the same
       * breath a few lines down. This attribute only tells the stylesheet which
       * of the two flat fills to use; deleting the rule that reads it removes
       * colour from the card and nothing else (`TN-CARD`, "right and wrong are a
       * word and a shape, never a colour"). `app/ui/screen-styles.ts` also
       * changes the border weight and style with it, so the distinction survives
       * greyscale and forced colours.
       */
      control.setAttribute('data-tn-answer', isCorrect ? 'correct' : 'wrong');

      const label = isCorrect ? 'card.correctAnswer' : 'card.yourAnswer';
      replaceChildren(control, [
        mark(doc, isCorrect ? '✓' : '✗'),
        element(doc, 'span', { text: current.options[index] ?? '' }),
        element(doc, 'span', {
          className: 'tn-screen__state',
          text: text(locale, label),
        }),
      ]);
    }
  }

  function repaintFeedback(): void {
    if (current === null) return;
    const correct = chosenIndex === current.correctIndex;
    const correctWording = current.options[current.correctIndex] ?? '';

    const parts: HTMLElement[] = [
      element(doc, 'p', {
        className: 'tn-screen__legend',
        text: text(locale, correct ? 'card.correct' : 'card.wrong'),
      }),
    ];

    if (!correct) {
      parts.push(
        element(doc, 'p', {
          text: text(locale, 'card.answerIs', { answer: correctWording }),
        }),
      );
    }

    /* A question with no explanation still shows the result and the right
       answer; the missing field is the content gate's failure, not the
       player's (`TN-CARD-05`). */
    if (current.explanation !== undefined && current.explanation !== '') {
      parts.push(
        element(doc, 'p', {
          testId: 'question-explanation',
          text: text(locale, 'card.why', { explanation: current.explanation }),
        }),
      );
    }

    if (!correct) {
      parts.push(element(doc, 'p', { text: text(locale, 'card.againSoon') }));
    }

    replaceChildren(feedback, parts);
    feedback.hidden = false;

    const last = current.index + 1 >= current.total;
    nextButton.textContent = text(locale, last ? 'card.finish' : 'card.next');

    options.announce?.(
      correct
        ? text(locale, 'card.correct')
        : `${text(locale, 'card.wrong')} ${text(locale, 'card.answerIs', { answer: correctWording })}`,
    );
  }

  function dismiss(): void {
    if (!screen.visible) return;
    closeReading(false);
    const message = text(locale, 'card.closedNotice');
    screen.hide();
    notice.textContent = message;
    notice.hidden = false;
    options.announce?.(message);
    options.onNotice?.(message);
    options.onDismiss?.();
  }
}
