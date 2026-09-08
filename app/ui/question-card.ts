/**
 * The question card.
 *
 * `docs/stories/TN-CARD-question-card.md` is the acceptance criteria. Four of
 * its rules shape the code rather than the styling:
 *
 *  - **Nothing counts down.** There is no timer in this file, at all. The card
 *    is unchanged after two minutes because nothing is scheduled to change it.
 *  - **The player never learns how questions are chosen.** The only scheduling
 *    word on screen is the tag — "New" or "Seen before" — and the promise that a
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
 * DOM only (ADR-0005). Study mode reuses this card exactly (`TN-STUDY`).
 */

import { text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

export interface QuestionView {
  /** "New" or "Seen before" — the only thing the player is told about scheduling. */
  readonly kind: 'new' | 'seen';
  /** Zero-based position in the current activity, not in the bank (`OQ-CARD-3`). */
  readonly index: number;
  readonly total: number;
  readonly prompt: string;
  /** Authored order (`OQ-CARD-2`). Four of them, in slice 1. */
  readonly options: readonly string[];
  readonly correctIndex: number;
  /** Absent is survivable: the result and the right answer still show. */
  readonly explanation?: string;
}

export interface QuestionCardOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string) => void;
  /** Emitted once per question, never twice (`question/answered`). */
  readonly onAnswer?: (chosenIndex: number, correct: boolean) => void;
  /** "Next" or "Finish" was chosen. The caller presents the next question or hides. */
  readonly onNext?: () => void;
  /** Escape or Close (`question/dismissed`). Not an answer. */
  readonly onDismiss?: () => void;
  /** The dismissal message, for a HUD that wants to show it as well as speak it. */
  readonly onNotice?: (message: string) => void;
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

  const screen: Screen = createScreen(host, {
    id: 'tn-question-card',
    testId: 'question-card',
    locale,
    onEscape: dismiss,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  /* The accessible name is the progress line, so a screen reader opening the
     dialog hears "Question 1 of 3" before the prompt (`TN-CARD-08`). */
  const progress = element(doc, 'h1', { id: 'tn-question-progress', testId: 'question-progress' });
  screen.labelledBy(progress);

  /* Words, not an icon (`TN-CARD-08`). */
  const kind = element(doc, 'p', { testId: 'question-kind', className: 'tn-screen__help' });

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
    onClick: () => options.onNext?.(),
  });
  nextButton.hidden = true;

  const closeButton = button(doc, {
    testId: 'question-close',
    text: text(locale, 'card.close'),
    onClick: dismiss,
  });

  screen.card.append(
    progress,
    kind,
    prompt,
    optionList,
    feedback,
    element(doc, 'div', {
      className: 'tn-screen__actions',
      children: [nextButton, closeButton],
    }),
  );

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
      current = question;
      answered = false;
      chosenIndex = -1;
      notice.hidden = true;
      notice.textContent = '';

      paintQuestion(question);
      feedback.hidden = true;
      replaceChildren(feedback, []);
      nextButton.hidden = true;

      screen.show();
      screen.refreshSwitch();
      /* `TN-STUDY-08`: moving to the next question is announced. */
      options.announce?.(progressText(question));
    },

    hide(): void {
      screen.hide();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      closeButton.textContent = text(next, 'card.close');
      /* Switching language mid-question keeps the question and the answer state
         (`TN-CARD-11`); only the words are redrawn. */
      if (current !== null) {
        paintQuestion(current);
        if (answered) repaintFeedback();
      }
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      notice.remove();
      screen.destroy();
    },
  };

  function progressText(question: QuestionView): string {
    return text(locale, 'card.progress', {
      n: question.index + 1,
      total: question.total,
    });
  }

  function paintQuestion(question: QuestionView): void {
    progress.textContent = progressText(question);
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
    screen.refreshSwitch();
    /* Focus the result so it is read, rather than left behind on the option
       the player just pressed (`TN-CARD-06`). */
    feedback.focus();

    options.onAnswer?.(index, correct);
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
    const message = text(locale, 'card.closedNotice');
    screen.hide();
    notice.textContent = message;
    notice.hidden = false;
    options.announce?.(message);
    options.onNotice?.(message);
    options.onDismiss?.();
  }
}
