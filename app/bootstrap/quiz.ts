/**
 * Running a set of questions on the one question card.
 *
 * `docs/stories/TN-CARD-question-card.md` owns the card and
 * `TN-STUDY-study-mode.md` owns the drill. Both are already written and were
 * both unreachable: `app/ui/question-card.ts` had no caller under `app/` at all,
 * so no player had ever been asked anything. This module is what asks.
 *
 * It sits in `app/bootstrap` because it is composition and nothing else — a
 * `StudyQuestion` from the application layer on one side, `app/ui`'s card on the
 * other, and the localisation between them. It decides no rule: which questions
 * are asked is `StudySession`'s answer, whether an answer was right is
 * `answerQuestion`'s, and what a card looks like is the card's.
 *
 * ## Two callers, one runner
 *
 * A Study drill and the question a landmark asks are the same activity with
 * different lengths and different sources. `TN-STUDY-01` says so in as many
 * words — "Answering behaves exactly as it does in a level" — and the only way
 * to keep that true is for there to be one implementation, not two that agree
 * today.
 *
 * ## What it does not do
 *
 * Record anything. {@link DrillRunnerOptions.onAnswer} hands each answer back to
 * the caller, which owns `answerQuestion`, the progress value and the save.
 * `StudySession` deliberately does not record either, and a runner that did
 * would be the third place an answer is written.
 */

import type { ShippableQuestion } from '@application/ports';
import type { StudyQuestion } from '@application/use-cases/study-session';
import type { UiLocale } from '@ui/copy';
import { createQuestionCard, type QuestionCard, type QuestionView } from '@ui/question-card';

/** How a drill ended, and everything the summary needs to draw itself. */
export interface DrillResult {
  /** How many questions were actually answered. Never more than were asked. */
  readonly answered: number;
  readonly correct: number;
  /**
   * The wording of each question answered wrongly, in the language it was
   * answered in. `TN-STUDY-04`: "each is shown by its question wording, not by
   * an id."
   */
  readonly returning: readonly string[];
  /**
   * The player closed the card before the last question (`TN-STUDY-05`). The
   * answers already given still count and are in the numbers above; the question
   * that was on screen is not.
   */
  readonly left: boolean;
}

export interface DrillRunnerOptions {
  /** Where the card is mounted. A dialog goes inside the page's one `<main>`. */
  readonly host: HTMLElement;
  readonly locale: UiLocale;
  readonly announce: (message: string, lang?: string) => void;
  readonly singleSwitch: boolean;
  readonly holdMs: number;
  /**
   * One answer, once. The caller records it — `answerQuestion` plus the save —
   * and this runner never sees the result of doing so.
   */
  readonly onAnswer: (question: ShippableQuestion, chosenIndex: number, correct: boolean) => void;
  /**
   * Every question answered, or the player left. Called exactly once per drill,
   * and it is where the caller puts focus back: the card's own trap restores to
   * whatever was focused when it opened, which is right when a control opened it
   * and wrong when the level did.
   */
  readonly onFinished: (result: DrillResult) => void;
}

export interface DrillRunner {
  /** Is a drill on screen right now? */
  readonly running: boolean;
  /** Ask these, in this order. An empty list finishes immediately. */
  start(questions: readonly StudyQuestion[]): void;
  /** Close the card without finishing. Used when the whole screen goes away. */
  stop(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs: number): void;
  destroy(): void;
}

/** A `LocalizedText` in the player's language. Both are required by the schema. */
const localised = (value: { readonly en: string; readonly fr: string }, locale: UiLocale): string =>
  locale === 'fr' ? value.fr : value.en;

/**
 * One question, as the card draws it.
 *
 * Exported because the mapping is the whole seam between a content document and
 * a screen, and it is worth being able to assert on it without a DOM.
 * `index`/`total` count through **this activity**, not the bank (`OQ-CARD-3`),
 * and the options keep their authored order (`OQ-CARD-2`): a card that shuffled
 * would make the explanation's "the answer is" point at a different line every
 * time the same question came back.
 */
export function questionView(
  selected: StudyQuestion,
  locale: UiLocale,
  index: number,
  total: number,
): QuestionView {
  const { question } = selected;
  const explanation = localised(question.explanation, locale);
  return {
    kind: selected.familiarity,
    index,
    total,
    prompt: localised(question.prompt, locale),
    options: question.options.map((option) => localised(option, locale)),
    correctIndex: question.correctIndex,
    /* Absent rather than empty: the card treats an empty explanation as one it
       must not draw, and `exactOptionalPropertyTypes` makes the two different
       types rather than the same one written twice. */
    ...(explanation === '' ? {} : { explanation }),
  };
}

export function createDrillRunner(options: DrillRunnerOptions): DrillRunner {
  let locale = options.locale;
  let queue: readonly StudyQuestion[] = [];
  let at = 0;
  let correct = 0;
  const returning: string[] = [];
  let live = false;

  const card: QuestionCard = createQuestionCard(options.host, {
    locale,
    announce: options.announce,
    onAnswer: (chosenIndex, wasRight) => {
      const selected = queue[at];
      if (selected === undefined) return;
      if (wasRight) correct += 1;
      else returning.push(localised(selected.question.prompt, locale));
      options.onAnswer(selected.question, chosenIndex, wasRight);
    },
    onNext: () => {
      at += 1;
      if (at >= queue.length) {
        finish(false);
        return;
      }
      present();
    },
    /*
     * Escape, or Close. `TN-CARD-05` says this is not an answer and
     * `TN-STUDY-05` says the answers already given are kept — both of which are
     * true by construction here, because nothing is recorded except on
     * `onAnswer` and nothing is unwound.
     *
     * The card hides itself and shows its own "No problem. We will ask again
     * later." notice before this runs, so the runner only has to report.
     */
    onDismiss: () => {
      finish(true);
    },
    singleSwitch: options.singleSwitch,
    holdMs: options.holdMs,
  });

  function present(): void {
    const selected = queue[at];
    if (selected === undefined) return;
    card.present(questionView(selected, locale, at, queue.length));
  }

  function finish(left: boolean): void {
    if (!live) return;
    live = false;
    /* Hiding a card that has already hidden itself is a no-op; hiding one that
       has not is what stops a finished drill leaving a dialog on the page. */
    card.hide();
    options.onFinished({ answered: left ? at : queue.length, correct, returning: [...returning], left });
  }

  return {
    get running(): boolean {
      return live;
    },

    start(questions): void {
      queue = questions;
      at = 0;
      correct = 0;
      returning.length = 0;
      live = true;
      if (questions.length === 0) {
        finish(false);
        return;
      }
      present();
    },

    stop(): void {
      live = false;
      card.hide();
    },

    setLocale(next): void {
      locale = next;
      card.setLocale(next);
    },

    setSingleSwitch(enabled, holdMs): void {
      card.setSingleSwitch(enabled, holdMs);
    },

    destroy(): void {
      live = false;
      card.destroy();
    },
  };
}
