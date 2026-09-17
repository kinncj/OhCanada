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
import {
  authoredAt,
  inOptionOrder,
  shownAt,
  shuffledOptionOrder,
  type OptionOrder,
} from '@domain/entities/asked-question';
import type { Randomness } from '@domain/scheduling/question-scheduler';
import type { UiLocale } from '@ui/copy';
import { createQuestionCard, type QuestionCard, type QuestionView } from '@ui/question-card';

import type { DrillCounter } from './landmark-questions';

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
   * Where each card's option order comes from (ADR-0059).
   *
   * A stream of the runner's own — the composition root hands in
   * `random.fork('options')` — so shuffling a card's four options can never
   * shift which questions the scheduler brings up. Seeded rather than
   * `Math.random()`, so a player who reports that the answer keeps landing in
   * the same place is reproducible from their seed.
   */
  readonly random: Randomness;
  /**
   * The card is asked over a running level, so it is a sheet with the level in
   * view above it (ADR-0045). Absent for Study.
   */
  readonly overLevel?: boolean;
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
  /**
   * Ask these, in this order. An empty list finishes immediately.
   *
   * `counter` is what the card counts when it counts more than this list — a
   * quest step's questions. Omitted, it counts the list.
   *
   * `placeFor` names where the questions are asked, in a language, for the
   * card's place line (ADR-0045). Omitted, the card draws no place: Study.
   */
  start(
    questions: readonly StudyQuestion[],
    counter?: DrillCounter | null,
    placeFor?: (locale: UiLocale) => readonly string[],
  ): void;
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
 * `index`/`total` count through **this activity**, not the bank (`OQ-CARD-3`).
 *
 * **The options are shown in `order`, not as authored (ADR-0059, resolving
 * `OQ-CARD-2`).** The card's own "the answer is …" line reads the wording out of
 * the view it was handed, so it points at whatever is on screen; nothing below
 * here ever sees the authored order again. What the caller must not forget is
 * the way back: {@link authoredAt} turns the tap into the index that gets
 * written down.
 */
export function questionView(
  selected: StudyQuestion,
  /*
   * Which authored option goes where on screen. Required, and deliberately not
   * defaulted to `AUTHORED_ORDER`: that default *is* the defect this argument
   * exists to fix, and it would come back silently the first time a caller
   * forgot to pass one.
   */
  order: OptionOrder,
  locale: UiLocale,
  index: number,
  total: number,
  /*
   * What the counter counts when it is not this set: a quest step's questions,
   * some of which may have been answered at an earlier landmark (ADR-0036).
   * Absent, the card counts through the drill — Study's case.
   */
  counter: DrillCounter | null = null,
  /* Where it is asked, already localised: the level's name, then the
     landmark's when its card has just named it (ADR-0045). Empty for Study. */
  place: readonly string[] = [],
): QuestionView {
  const { question } = selected;
  const explanation = localised(question.explanation, locale);
  return {
    kind: selected.familiarity,
    index,
    total,
    ...(counter === null
      ? {}
      : { progress: { n: counter.answered + index + 1, of: counter.total } }),
    ...(place.length === 0 ? {} : { place }),
    prompt: localised(question.prompt, locale),
    options: inOptionOrder(question.options, order).map((option) => localised(option, locale)),
    /* Where the key is *on screen*. The `??` is unreachable — the schema and
       `question-document.ts` both hold `correctIndex` to 0-3 — and is here so
       the type is total rather than asserted. */
    correctIndex: shownAt(order, question.correctIndex) ?? question.correctIndex,
    /* Absent rather than empty: the card treats an empty explanation as one it
       must not draw, and `exactOptionalPropertyTypes` makes the two different
       types rather than the same one written twice. */
    ...(explanation === '' ? {} : { explanation }),
  };
}

export function createDrillRunner(options: DrillRunnerOptions): DrillRunner {
  let locale = options.locale;
  let queue: readonly StudyQuestion[] = [];
  let counting: DrillCounter | null = null;
  let placing: ((locale: UiLocale) => readonly string[]) | null = null;
  let at = 0;
  let correct = 0;
  const returning: string[] = [];
  let live = false;
  /**
   * The order the card on screen is drawing, or `null` before the first one.
   *
   * Held here rather than recomputed, because the way back from a tap has to be
   * the exact order that produced the buttons the player was looking at.
   */
  let showing: OptionOrder | null = null;

  const card: QuestionCard = createQuestionCard(options.host, {
    locale,
    announce: options.announce,
    onAnswer: (chosenIndex, wasRight) => {
      const selected = queue[at];
      if (selected === undefined) return;
      if (wasRight) correct += 1;
      else returning.push(localised(selected.question.prompt, locale));
      /*
       * Back into the author's index space before anything is written down
       * (ADR-0059). Every review record and every exam answer ever saved stores
       * the authored index, and correctness is `chosenIndex === correctIndex`
       * with no `correct` flag to fall back on (ADR-0027) — so passing on a
       * screen position would silently re-grade the player's whole history.
       *
       * `wasRight` is unaffected either way: the card judged it against the
       * view it drew, which is the same answer in either index space.
       */
      const authored =
        showing === null ? chosenIndex : (authoredAt(showing, chosenIndex) ?? chosenIndex);
      options.onAnswer(selected.question, authored, wasRight);
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
    ...(options.overLevel === true ? { overLevel: true } : {}),
  });

  function present(): void {
    const selected = queue[at];
    if (selected === undefined) return;
    /*
     * A fresh order every time a card goes up, including for a question the
     * player has already met this sitting. A position is never allowed to
     * become a memorable property of a card, which is the whole of ADR-0059;
     * and three draws off this runner's own forked stream cannot move the
     * scheduler.
     */
    showing = shuffledOptionOrder(options.random);
    card.present(
      questionView(selected, showing, locale, at, queue.length, counting, placing?.(locale) ?? []),
    );
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

    start(questions, counter = null, placeFor): void {
      queue = questions;
      counting = counter;
      placing = placeFor ?? null;
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
