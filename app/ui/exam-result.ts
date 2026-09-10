/**
 * The exam result: whether the player passed, how they did subject by subject,
 * and every question with its right answer.
 *
 * `docs/stories/TN-RESULT-exam-results.md` is the acceptance criteria, and four
 * of its rules are structural here rather than stylistic:
 *
 *  - **A count, never a percentage.** There is no division in this file. No
 *    grade, letter, star, streak, rank or badge exists to be rendered, and no
 *    history of attempts is drawn — `TN-RESULT-06`: "the result screen is not a
 *    scoreboard", and `OQ-RESULT-4` records why a count of attempts is a shaming
 *    number for the player who needed six and an encouraging one for nobody.
 *  - **No word calls the player a failure.** The heading under the pass mark is
 *    "Not this time" and the line under it is arithmetic. `tests/unit/ui/copy.test.ts`
 *    reads the table for "failed", "wrong" and "error"; this screen draws only
 *    rows from that table.
 *  - **A row is not a colour.** Every by-subject row is text and numbers, and
 *    nothing marks one as weak. There is no per-row state to style.
 *  - **Unanswered is a third thing.** It is counted in its subject's total, is
 *    not counted as right, is never called a mistake, and says so in the review
 *    with `exam.result.noAnswer`.
 *
 * ## Where a subject's name comes from, and what happens when there is none
 *
 * A subject is named with the same string the map draws as that level's subject
 * line (`level.<id>.subtitle`), resolved by the composition root and handed here
 * as data — writing a second set of subject names is how two screens end up
 * calling one chapter two things. A subject this build cannot name draws the row
 * **without** a name rather than with its id: `TN-RESULT-07` requires the
 * numbers to survive a build that has moved on, and forbids "TBD", "???" and an
 * empty box in the name's place.
 *
 * DOM only (ADR-0005). Nothing here counts down and nothing animates: a pass is
 * a line of text, not a firework (`TN-RESULT-11`).
 */

import { count, text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/** One question of the exam, as the review draws it. */
export interface ExamReviewItem {
  /** The question's wording, or `null` when this build no longer has it. */
  readonly prompt: string | null;
  /** Four options in authored order. Empty when the question is unavailable. */
  readonly options: readonly string[];
  /** What the player chose, or `null` for a question they did not answer. */
  readonly chosenIndex: number | null;
  /** What was right when the question was asked (`ADR-0027`: recorded, not looked up). */
  readonly correctIndex: number;
  readonly explanation?: string;
}

/** One row of the by-subject breakdown. */
export interface ExamSubjectRow {
  /** For the `subject-row-<id>` marker. Never drawn as text. */
  readonly id: string;
  /** `level.<id>.subtitle`, or `null` when this build does not know the subject. */
  readonly name: string | null;
  readonly correct: number;
  readonly total: number;
}

export interface ExamResultView {
  readonly correct: number;
  readonly total: number;
  readonly passMark: number;
  readonly passed: boolean;
  /** Was the clock still running at the end? A timer stopped mid-exam is `false`. */
  readonly timed: boolean;
  /** The exam ended because the clock reached zero (`TN-TIMER-05`). */
  readonly timeUp: boolean;
  readonly unanswered: number;
  readonly subjects: readonly ExamSubjectRow[];
  readonly review: readonly ExamReviewItem[];
  /** Same optional pair as the start screen, and absent for the same reason. */
  readonly subjectsReady?: { readonly ready: number; readonly total: number };
}

export interface ExamResultOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string, lang?: string) => void;
  /** `exam.result.practise`. Absent draws no control — nothing was missed. */
  readonly onPractise?: () => void;
  /** `exam.again`: back to the start screen, never straight into a new exam. */
  readonly onAgain?: () => void;
  /** `common.close`, and Escape. Always offered: the result is never a dead end. */
  readonly onClose?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface ExamResult {
  readonly element: HTMLElement;
  readonly visible: boolean;
  /** What the live region says: whether they passed, and the score. Once. */
  readonly arrivalMessage: string;
  show(view: ExamResultView): void;
  hide(): void;
  /** `TN-RESULT-04`, opened from `exam.result.review`. */
  openReview(): void;
  closeReview(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createExamResult(host: HTMLElement, options: ExamResultOptions): ExamResult {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let view: ExamResultView | null = null;
  /* The review is a second surface over this one, so the result stands its trap
     and its ring down while the review owns the page (`Screen.setCovered`). */
  let holdMs = options.holdMs ?? 600;

  const screen: Screen = createScreen(host, {
    id: 'tn-exam-result',
    testId: 'exam-result',
    locale,
    ...(options.onClose === undefined ? {} : { onEscape: options.onClose }),
    ...(options.announce === undefined
      ? {}
      : { announce: (message: string) => { options.announce?.(message, locale); } }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  /*
   * "Your exam" is this screen's **accessible name**, and nothing is drawn above
   * the verdict.
   *
   * It used to be a kicker — a small line reading `exam.result.title` over the
   * `<h1>` — and `TN-EXAMMENU`'s ruling 3 is that the row is right and the place
   * was wrong. `TN-RESULT-01` requires the verdict to be the first line a player
   * reads, and `TN-RESULT-02` is the case that decides it: somebody who did not
   * pass read "Your exam", then "Not this time". A label above a verdict is a
   * pause before bad news, which is the one place a screen should be quickest.
   *
   * The row is still needed, and `TN-RESULT-10` has always required it without
   * naming it: "`exam-result` has an accessible name that is not empty", and
   * `exam.result.title` is the only row in `TN-RESULT`'s copy table that no
   * scenario in that file draws. As the name it does three jobs — it satisfies
   * that scenario, it is what a screen-reader user hears on arrival *before* the
   * live region reads the verdict and the score, and it occupies no visible
   * line. Hearing "Your exam" and then "You passed" is not a repetition to
   * remove: they are two sentences and the second is not derivable from the
   * first.
   */

  /* `TN-TIMER-05`: the exam ended at zero. It says so plainly, and it is not a
     failure by itself — the verdict below is whatever the answers earned. */
  const timeUp = element(doc, 'div', {
    testId: 'exam-time-up',
    className: 'tn-screen__notice',
  });
  timeUp.hidden = true;

  const verdict = element(doc, 'h1', { id: 'tn-exam-result-verdict', testId: 'exam-result-verdict' });
  verdict.tabIndex = -1;

  const score = element(doc, 'p', {
    id: 'tn-exam-result-score',
    testId: 'exam-result-score',
  });
  screen.describedBy(score);

  const summary = element(doc, 'div', { className: 'tn-screen__row' });
  const bySubject = element(doc, 'div', {
    testId: 'exam-result-by-subject',
    className: 'tn-screen__row',
  });
  const actions = element(doc, 'div', { className: 'tn-screen__actions' });

  screen.card.append(timeUp, verdict, score, summary, bySubject, actions);

  /* ------------------------------------------------------------ the review */

  const review: Screen = createScreen(host, {
    id: 'tn-exam-review',
    testId: 'exam-review',
    locale,
    onEscape: () => {
      closeReview();
    },
    ...(options.announce === undefined
      ? {}
      : { announce: (message: string) => { options.announce?.(message, locale); } }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const reviewTitle = element(doc, 'h1', { id: 'tn-exam-review-title' });
  reviewTitle.tabIndex = -1;
  review.labelledBy(reviewTitle);
  const reviewList = element(doc, 'ul', {
    testId: 'exam-review-list',
    className: 'tn-screen__options',
    attrs: { role: 'list' },
  });
  const reviewActions = element(doc, 'div', { className: 'tn-screen__actions' });
  review.card.append(reviewTitle, reviewList, reviewActions);

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    get arrivalMessage(): string {
      if (view === null) return '';
      return `${verdictText(view)} ${scoreText(view)}`;
    },

    show(next): void {
      view = next;
      screen.show();
      render();
      screen.refreshSwitch();
      /* `TN-RESULT-10`: focus moves to the result and the first thing read is
         whether they passed. The heading is that sentence. */
      verdict.focus({ preventScroll: true });
      options.announce?.(this.arrivalMessage, locale);
    },

    hide(): void {
      review.hide();
      screen.hide();
    },

    openReview: openReview,

    closeReview,

    setLocale(nextLocale): void {
      locale = nextLocale;
      screen.setLocale(nextLocale);
      review.setLocale(nextLocale);
      render();
      if (review.visible) renderReview();
      screen.refreshSwitch();
      review.refreshSwitch();
    },

    setSingleSwitch(enabled, nextHoldMs): void {
      if (nextHoldMs !== undefined) holdMs = nextHoldMs;
      screen.setSwitchEnabled(enabled, holdMs);
      review.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      review.destroy();
      screen.destroy();
    },
  };

  function openReview(): void {
    if (review.visible) return;
    renderReview();
    screen.setCovered(true);
    review.show();
    review.refreshSwitch();
    reviewTitle.focus({ preventScroll: true });
  }

  function closeReview(): void {
    if (!review.visible) return;
    review.hide();
    screen.setCovered(false);
  }

  function verdictText(current: ExamResultView): string {
    return text(locale, current.passed ? 'exam.result.passed.title' : 'exam.result.notYet.title');
  }

  function scoreText(current: ExamResultView): string {
    return text(locale, 'exam.result.score', {
      correct: current.correct,
      total: current.total,
    });
  }

  function render(): void {
    if (view === null) return;
    const current = view;

    /* Re-read on every render because it is locale-dependent, like every other
       string here — `setLocale` redraws and the name has to follow. */
    screen.label(text(locale, 'exam.result.title'));

    timeUp.hidden = !current.timeUp;
    replaceChildren(
      timeUp,
      current.timeUp
        ? [
            element(doc, 'h2', { text: text(locale, 'exam.timer.timeUp.title') }),
            element(doc, 'p', { text: text(locale, 'exam.timer.timeUp.body') }),
          ]
        : [],
    );

    verdict.textContent = verdictText(current);
    score.textContent = scoreText(current);

    const lines: HTMLElement[] = [
      element(doc, 'p', {
        testId: 'exam-result-pass-mark',
        text: text(locale, 'exam.result.passMark', {
          pass: current.passMark,
          total: current.total,
        }),
      }),
      /* Which exam this was. Neither sentence says one is worth more than the
         other (`TN-RESULT-01`, `TN-TIMER-06`). */
      element(doc, 'p', {
        testId: 'exam-result-timer',
        text: text(locale, current.timed ? 'exam.result.withTimer' : 'exam.result.noTimer'),
      }),
    ];

    if (current.unanswered > 0) {
      lines.push(
        element(doc, 'p', {
          testId: 'exam-result-unanswered',
          text: count(locale, 'exam.result.unanswered', current.unanswered),
        }),
      );
    }

    if (current.subjectsReady !== undefined) {
      const { ready, total } = current.subjectsReady;
      lines.push(
        element(doc, 'p', {
          testId: 'exam-result-subjects-ready',
          className: 'tn-screen__help',
          text: text(locale, 'exam.subjectsReady', { ready, total }),
        }),
      );
      if (ready < total) {
        lines.push(
          element(doc, 'p', {
            className: 'tn-screen__help',
            text: text(locale, 'map.moreComing'),
          }),
        );
      }
    }

    replaceChildren(summary, lines);
    renderSubjects(current);
    renderActions(current);
  }

  function renderSubjects(current: ExamResultView): void {
    replaceChildren(bySubject, [
      element(doc, 'h2', { text: text(locale, 'exam.result.bySubject') }),
      element(doc, 'ul', {
        attrs: { role: 'list' },
        children: current.subjects.map((row) => {
          const item = element(doc, 'li', {
            testId: `subject-row-${row.id}`,
            /*
             * A subject this build cannot name keeps its numbers and loses its
             * label, in the words the score line already uses. Drawing the raw
             * id — `modern-canada` — would be showing a player a key
             * (`TN-RESULT-07`).
             */
            text:
              row.name === null
                ? text(locale, 'exam.result.score', {
                    correct: row.correct,
                    total: row.total,
                  })
                : text(locale, 'exam.result.subjectRow', {
                    subject: row.name,
                    correct: row.correct,
                    total: row.total,
                  }),
          });
          item.tabIndex = 0;
          return item;
        }),
      }),
    ]);
  }

  function renderActions(current: ExamResultView): void {
    const items: HTMLElement[] = [
      button(doc, {
        testId: 'exam-result-review',
        text: text(locale, 'exam.result.review'),
        attrs: { 'data-tn-action': 'primary' },
        onClick: openReview,
      }),
    ];

    /*
     * Offered only where there is something to practise. `TN-RESULT-02` puts it
     * on the not-passed path, and it is just as true of a pass with three
     * mistakes in it; what it is not true of is a clean sheet, and a control
     * that opened a drill of nothing would be `TN-STUDY-03`'s defect.
     */
    if (options.onPractise !== undefined) {
      items.push(
        button(doc, {
          testId: 'exam-result-practise',
          text: text(locale, 'exam.result.practise'),
          onClick: options.onPractise,
        }),
      );
    }

    if (options.onAgain !== undefined) {
      /* Offered without being pushed: it is never the focused control and never
         the primary one (`TN-RESULT-02`). */
      items.push(
        button(doc, {
          testId: 'exam-again',
          text: text(locale, 'exam.again'),
          onClick: options.onAgain,
        }),
      );
    }

    if (options.onClose !== undefined) {
      items.push(
        button(doc, {
          testId: 'exam-result-close',
          text: text(locale, 'common.close'),
          attrs: { 'data-tn-action': 'quiet' },
          onClick: options.onClose,
        }),
      );
    }

    replaceChildren(actions, items);
    /* Referenced so the parameter is not merely decorative: a result with no
       questions in it has nothing to review, and that is a defect upstream
       rather than a state to draw. */
    if (current.review.length === 0) items[0]?.setAttribute('aria-disabled', 'true');
  }

  /**
   * The whole list, at twenty.
   *
   * `TN-RESULT-04` answers `OQ-STUDY-4` here: a drill of five lists what came
   * back inline, an exam of twenty lists it on its own screen. Each item is a
   * list item with a name, readable one at a time, and the only *control* in the
   * dialog is the one that leaves it — so a switch user reaches the way out on
   * the first press instead of walking twenty items first (`TN-RESULT-09`).
   */
  function renderReview(): void {
    if (view === null) return;
    reviewTitle.textContent = text(locale, 'exam.result.review');

    replaceChildren(
      reviewList,
      view.review.map((item, index) => {
        const parts: HTMLElement[] = [
          element(doc, 'h2', {
            className: 'tn-screen__eyebrow',
            text: text(locale, 'card.progress', { n: index + 1, total: view?.review.length ?? 0 }),
          }),
        ];

        if (item.prompt === null) {
          /* `TN-RESULT-07`: a question this build no longer has. The score and
             the by-subject rows above are untouched by it. */
          parts.push(element(doc, 'p', { text: text(locale, 'exam.result.unavailable') }));
        } else {
          parts.push(element(doc, 'p', { text: item.prompt }));

          if (item.chosenIndex === null) {
            parts.push(
              element(doc, 'p', {
                className: 'tn-screen__legend',
                text: text(locale, 'exam.result.noAnswer'),
              }),
            );
          }

          parts.push(
            element(doc, 'ul', {
              attrs: { role: 'list' },
              children: item.options.flatMap((wording, at) => {
                const isCorrect = at === item.correctIndex;
                const isChosen = at === item.chosenIndex;
                if (!isCorrect && !isChosen) return [];
                const labels: HTMLElement[] = [];
                if (isChosen) {
                  labels.push(
                    element(doc, 'span', {
                      className: 'tn-screen__state',
                      text: text(locale, 'card.yourAnswer'),
                    }),
                  );
                }
                if (isCorrect) {
                  labels.push(
                    element(doc, 'span', {
                      className: 'tn-screen__state',
                      text: text(locale, 'card.correctAnswer'),
                    }),
                  );
                }
                return [
                  element(doc, 'li', {
                    /* The mark is a shape and the words beside it carry the
                       meaning; the fill is the stylesheet's third signal. */
                    attrs: { 'data-tn-answer': isCorrect ? 'correct' : 'wrong' },
                    children: [
                      mark(doc, isCorrect ? '✓' : '✗'),
                      element(doc, 'span', { text: wording }),
                      ...labels,
                    ],
                  }),
                ];
              }),
            }),
          );

          if (item.explanation !== undefined && item.explanation !== '') {
            parts.push(
              element(doc, 'p', {
                text: text(locale, 'card.why', { explanation: item.explanation }),
              }),
            );
          }

          /*
           * The promise printed on the card is kept for exam answers too
           * (`TN-RESULT-02`, `TN-RESULT-05`): a question answered wrongly here
           * updates its review state and comes back in Study. It is not said
           * about a question nobody reached — nothing was missed, so nothing is
           * being promised back.
           */
          if (item.chosenIndex !== null && item.chosenIndex !== item.correctIndex) {
            parts.push(element(doc, 'p', { text: text(locale, 'card.againSoon') }));
          }
        }

        const row = element(doc, 'li', {
          testId: `exam-review-item-${String(index)}`,
          className: 'tn-screen__row',
          children: parts,
        });
        row.tabIndex = 0;
        return row;
      }),
    );

    replaceChildren(reviewActions, [
      button(doc, {
        testId: 'exam-review-back',
        text: text(locale, 'common.back'),
        attrs: { 'data-tn-action': 'quiet' },
        onClick: () => {
          closeReview();
        },
      }),
    ]);
  }
}
