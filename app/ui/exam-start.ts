/**
 * The screen in front of the exam: what the exam is, whether to be timed, and —
 * when there is one to finish — the exam the player already has.
 *
 * `docs/stories/TN-EXAM-starting-and-answering.md` (`TN-EXAM-01`, `TN-EXAM-05`),
 * `TN-TIMER-the-exam-clock.md` (`TN-TIMER-01`) and
 * `TN-ATTEMPT-leaving-and-resuming-an-exam.md` (`TN-ATTEMPT-03`, `TN-ATTEMPT-04`)
 * are the acceptance criteria.
 *
 * ## Five states, one screen
 *
 * | On screen | When |
 * |---|---|
 * | `ready` | The bank can ask `exam.questionCount` questions and nothing is unfinished |
 * | `resume` | An exam was left unfinished (`exam-resume`) |
 * | `not-ready` | Fewer verified questions exist than the exam needs (`exam-not-ready`) |
 * | `error` | The bank would not load |
 * | `gone` | The unfinished exam names questions this build no longer has |
 *
 * They are one screen rather than five because they answer one question — *can I
 * take an exam, and which one* — and because a player who goes from `resume` to
 * `ready` by discarding an attempt must not watch a dialog close and another
 * open. `exam-resume` and `exam-not-ready` are elements **inside** it, the way
 * `study-empty` and `study-error` are inside the Study screen.
 *
 * ## No number on this screen is written into a string
 *
 * "The exam has 20 questions." and "You need 15 out of 20 to pass." are
 * `exam.questionCount` and `exam.passMark` from `content/game.config.json`,
 * arriving as data. `TN-EXAM-01` asserts a build with a count of 10 and a pass
 * mark of 8 reads correctly, which is only true if nobody typed 20 anywhere —
 * so this file has no default for either and takes both as required.
 *
 * ## The timer choice lives here and only here
 *
 * `TN-TIMER-01`: the switch is on this screen, it starts **off** every time, it
 * is not remembered between attempts, and no control anywhere else in the game
 * turns a timer on. It is a `role="switch"` with the state as a **word**, the
 * same shape `app/ui/settings-screen.ts` uses, so a player meets one kind of
 * switch in this game rather than two.
 *
 * Nothing on this screen counts down (`TN-EXAM-01`): there is no clock here,
 * only the *choice* of one, and `app/ui/exam-clock.ts` is not imported.
 *
 * DOM only (ADR-0005).
 */

import { count, labelled, text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { MINUTE_MS } from './exam-clock';
import { createScreen, type Screen } from './screen';

/** What the screen is showing. Nothing else is a state, and there is no sixth. */
export type ExamStartState =
  | {
      readonly kind: 'ready';
      /** `exam.questionCount`. Never defaulted; see the note above. */
      readonly questionCount: number;
      /** `exam.passMark`. */
      readonly passMark: number;
      /** `exam.timeLimitSeconds`, in milliseconds, for the limit beside the switch. */
      readonly timeLimitMs: number;
      /**
       * How many subjects have questions, and how many the finished game has.
       * Absent draws no "Subjects ready" line at all — `OQ-EXAM-5` records that
       * nothing in `content/` enumerates the subjects, and `TN-MAP-04`'s rule
       * holds here: a number this screen cannot derive is left out, never
       * guessed and never drawn as a placeholder.
       */
      readonly subjects?: { readonly ready: number; readonly total: number };
    }
  | { readonly kind: 'not-ready' }
  /** `TN-STUDY-03`'s failed-bank message, supplied as content by the caller. */
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'resume';
      readonly answered: number;
      readonly total: number;
      /** Milliseconds left on the paused clock, or `null` for an untimed attempt. */
      readonly remainingMs: number | null;
    }
  | { readonly kind: 'gone' };

export interface ExamStartOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string, lang?: string) => void;
  /** Start a new exam. `timed` is the switch as the player left it. */
  readonly onStart?: (timed: boolean) => void;
  /** `exam.resume.continue` — pick the unfinished exam back up. */
  readonly onContinue?: () => void;
  /** `exam.new` — confirmed by the caller before anything is discarded. */
  readonly onNewExam?: () => void;
  /** `study.open`, offered where the exam cannot run (`TN-EXAM-05`). */
  readonly onOpenStudy?: () => void;
  /** `study.error.retry`, for a bank that may load on a second try. */
  readonly onRetry?: () => void;
  /** `common.back`, and Escape. Always offered: no screen is a dead end. */
  readonly onBack?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface ExamStartScreen {
  readonly element: HTMLElement;
  readonly visible: boolean;
  readonly state: ExamStartState;
  /** Is the timer switch on? Read when the exam begins; never persisted. */
  readonly timed: boolean;
  show(state: ExamStartState): void;
  setState(state: ExamStartState): void;
  hide(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  /**
   * A confirmation the caller mounted is over this screen, or is no longer.
   *
   * The destructive one (`TN-ATTEMPT-04`) is the caller's, because discarding an
   * attempt is the caller's; standing this screen's trap and ring down while it
   * is open is this screen's.
   */
  setCovered(covered: boolean): void;
  destroy(): void;
}

export function createExamStartScreen(
  host: HTMLElement,
  options: ExamStartOptions,
): ExamStartScreen {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let state: ExamStartState = { kind: 'not-ready' };
  /*
   * Off, every time. `TN-TIMER-01`: "the choice belongs to the attempt, not to
   * the game" — a player who finished a timed exam opens this screen and finds
   * the switch off again, because nothing has been remembered that they did not
   * ask to be remembered. It is a local, so there is nowhere for it to persist
   * to (`OQ-EXAM-2`).
   */
  let timed = false;

  const screen: Screen = createScreen(host, {
    id: 'tn-exam-start',
    testId: 'exam-start',
    locale,
    ...(options.onBack === undefined ? {} : { onEscape: options.onBack }),
    ...(options.announce === undefined
      ? {}
      : { announce: (message: string) => { options.announce?.(message, locale); } }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: 'tn-exam-start-title' });
  title.tabIndex = -1;
  screen.labelledBy(title);

  const panel = element(doc, 'div', { className: 'tn-screen__row' });
  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, panel, actions);

  render();

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    get state(): ExamStartState {
      return state;
    },
    get timed(): boolean {
      return timed;
    },

    show(next): void {
      state = next;
      /* Every opening is a fresh choice about the clock (`TN-TIMER-01`). */
      timed = false;
      screen.show();
      render();
      screen.refreshSwitch();
      title.focus({ preventScroll: true });
      announceArrival();
    },

    setState(next): void {
      state = next;
      render();
      screen.refreshSwitch();
    },

    hide(): void {
      screen.hide();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      render();
      screen.refreshSwitch();
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    setCovered(covered): void {
      screen.setCovered(covered);
    },

    destroy(): void {
      screen.destroy();
    },
  };

  /** What the live region says on arrival. Two rows that exist, never a third. */
  function announceArrival(): void {
    if (state.kind === 'resume') {
      /* `TN-ATTEMPT-08`: "the screen's name and how many answers I have given". */
      options.announce?.(
        `${text(locale, 'exam.resume.title')} ${text(locale, 'exam.answered', {
          done: state.answered,
          total: state.total,
        })}`,
        locale,
      );
      return;
    }
    if (state.kind === 'not-ready') {
      options.announce?.(text(locale, 'exam.notReady.title'), locale);
      return;
    }
    if (state.kind === 'gone') {
      options.announce?.(text(locale, 'exam.gone.title'), locale);
      return;
    }
    if (state.kind === 'error') {
      options.announce?.(state.message, locale);
      return;
    }
    options.announce?.(`${text(locale, 'exam.title')} ${text(locale, 'exam.intro')}`, locale);
  }

  function render(): void {
    title.textContent = text(locale, 'exam.title');
    switch (state.kind) {
      case 'ready':
        return renderReady(state);
      case 'resume':
        return renderResume(state);
      case 'not-ready':
        return renderNotReady();
      case 'gone':
        return renderGone();
      case 'error':
        return renderError(state.message);
    }
  }

  function backButton(): readonly HTMLElement[] {
    if (options.onBack === undefined) return [];
    return [
      button(doc, {
        testId: 'exam-back',
        text: text(locale, 'common.back'),
        attrs: { 'data-tn-action': 'quiet' },
        onClick: options.onBack,
      }),
    ];
  }

  function renderReady(ready: Extract<ExamStartState, { kind: 'ready' }>): void {
    const intro = element(doc, 'p', { testId: 'exam-intro', text: text(locale, 'exam.intro') });
    screen.describedBy(intro);

    /*
     * Two rows and not one. "The exam has 20 questions. You need 15 out of 20 to
     * pass." carries two counted nouns behind two different numbers, and a
     * plural category is chosen once per string — so at a pass mark of one the
     * French would draw the wrong ending whichever placeholder the form came
     * from (`TN-COPY` rule 9, written from this very string).
     */
    const rules = element(doc, 'div', {
      testId: 'exam-rules',
      className: 'tn-screen__row',
      children: [
        element(doc, 'p', {
          testId: 'exam-rules-length',
          text: count(locale, 'exam.rules.length', ready.questionCount, {
            count: ready.questionCount,
          }),
        }),
        element(doc, 'p', {
          testId: 'exam-rules-pass',
          text: text(locale, 'exam.rules.pass', {
            pass: ready.passMark,
            count: ready.questionCount,
          }),
        }),
        element(doc, 'p', { text: text(locale, 'exam.noFeedback') }),
        element(doc, 'p', { text: text(locale, 'exam.changeAnswers') }),
      ],
    });

    const children: HTMLElement[] = [intro, rules, timerGroup(ready.timeLimitMs)];

    if (ready.subjects !== undefined) {
      const { ready: available, total } = ready.subjects;
      const lines: HTMLElement[] = [
        element(doc, 'p', {
          testId: 'exam-subjects',
          text: text(locale, 'exam.subjectsReady', { ready: available, total }),
        }),
      ];
      /* Only while it is true, exactly as the map draws it (`TN-MAP`). */
      if (available < total) {
        lines.push(
          element(doc, 'p', {
            className: 'tn-screen__help',
            text: text(locale, 'map.moreComing'),
          }),
        );
      }
      lines.push(
        element(doc, 'p', {
          className: 'tn-screen__help',
          text: text(locale, 'exam.subjects.help'),
        }),
      );
      children.push(element(doc, 'div', { className: 'tn-screen__row', children: lines }));
    }

    replaceChildren(panel, children);
    replaceChildren(actions, [
      button(doc, {
        testId: 'exam-begin',
        text: text(locale, 'exam.start'),
        attrs: { 'data-tn-action': 'primary' },
        onClick: () => {
          options.onStart?.(timed);
        },
      }),
      ...backButton(),
    ]);
  }

  /**
   * The switch, its help, the limit it would apply, and — while it is off — the
   * sentence that says what "off" means.
   *
   * `TN-TIMER-01`: "with the timer off, you can take as long as you like", said
   * on the screen rather than left to be inferred from an absent clock. The
   * limit is drawn beside the switch as its value whether the switch is on or
   * off, so the player knows what they would be agreeing to before they agree.
   */
  function timerGroup(timeLimitMs: number): HTMLElement {
    const label = element(doc, 'span', { text: text(locale, 'exam.timer.use') });
    const stateWord = element(doc, 'span', { className: 'tn-screen__state' });
    const shape = mark(doc, '✓');

    const help = element(doc, 'p', {
      id: 'tn-exam-timer-help',
      className: 'tn-screen__help',
      text: text(locale, 'exam.timer.help'),
    });

    const control = button(doc, {
      testId: 'exam-timer-toggle',
      attrs: { role: 'switch', 'aria-checked': 'false', 'aria-describedby': help.id },
      children: [shape, label, stateWord],
      onClick: () => {
        timed = !timed;
        paint();
        /* `TN-TIMER-01`: announced once, as the label and its state. */
        options.announce?.(
          labelled(locale, text(locale, 'exam.timer.use'), stateText()),
          locale,
        );
      },
    });

    const limit = element(doc, 'p', {
      testId: 'exam-timer-limit',
      text: count(locale, 'exam.timer.limit', Math.round(timeLimitMs / MINUTE_MS)),
    });

    const off = element(doc, 'p', {
      testId: 'exam-timer-state',
      className: 'tn-screen__help',
      text: text(locale, 'exam.timer.off'),
    });

    const stateText = (): string =>
      text(locale, timed ? 'settings.state.on' : 'settings.state.off');

    function paint(): void {
      control.setAttribute('aria-checked', String(timed));
      stateWord.textContent = stateText();
      /* The shape is the second signal, beside the word; the fill is the third
         and is the stylesheet's. Removing colour loses nothing. */
      shape.hidden = !timed;
      off.hidden = timed;
    }

    paint();

    return element(doc, 'div', {
      className: 'tn-screen__group',
      testId: 'exam-timer',
      children: [control, help, limit, off],
    });
  }

  function renderResume(resume: Extract<ExamStartState, { kind: 'resume' }>): void {
    const heading = element(doc, 'h2', { text: text(locale, 'exam.resume.title') });
    const answered = element(doc, 'p', {
      testId: 'exam-resume-progress',
      text: text(locale, 'exam.answered', { done: resume.answered, total: resume.total }),
    });
    screen.describedBy(answered);

    const lines: HTMLElement[] = [heading, answered];
    /*
     * `TN-ATTEMPT-03`: "a timed exam says how much time is left before I carry
     * on", and "the clock is not running while I read the screen" — which is
     * true here by there being no clock on this screen at all. This is a
     * sentence about a saved number, not a countdown.
     */
    if (resume.remainingMs !== null) {
      lines.push(
        element(doc, 'p', {
          testId: 'exam-resume-time',
          text:
            resume.remainingMs < MINUTE_MS
              ? text(locale, 'exam.timer.lessThanMinute')
              : count(
                  locale,
                  'exam.timer.left',
                  Math.ceil(resume.remainingMs / MINUTE_MS),
                ),
        }),
      );
    }

    replaceChildren(panel, [
      element(doc, 'div', {
        testId: 'exam-resume',
        className: 'tn-screen__row',
        children: lines,
      }),
    ]);

    replaceChildren(actions, [
      button(doc, {
        testId: 'exam-continue',
        text: text(locale, 'exam.resume.continue'),
        attrs: { 'data-tn-action': 'primary' },
        ...(options.onContinue === undefined ? {} : { onClick: options.onContinue }),
      }),
      button(doc, {
        testId: 'exam-new',
        text: text(locale, 'exam.new'),
        ...(options.onNewExam === undefined ? {} : { onClick: options.onNewExam }),
      }),
      ...backButton(),
    ]);
  }

  /**
   * `TN-EXAM-05`: not an error, and no number.
   *
   * "Nothing on the screen says 'error', 'failed' or 'missing'", and "no number
   * of questions is shown to the player" — telling somebody the bank holds 12 of
   * the 20 they need is a progress bar on somebody else's authoring backlog.
   */
  function renderNotReady(): void {
    const heading = element(doc, 'h2', {
      testId: 'exam-not-ready-title',
      text: text(locale, 'exam.notReady.title'),
    });
    const body = element(doc, 'p', { text: text(locale, 'exam.notReady.body') });
    screen.describedBy(body);

    replaceChildren(panel, [
      element(doc, 'div', {
        testId: 'exam-not-ready',
        className: 'tn-screen__row',
        children: [heading, body],
      }),
    ]);
    replaceChildren(actions, [
      ...(options.onOpenStudy === undefined
        ? []
        : [
            button(doc, {
              testId: 'exam-study',
              text: text(locale, 'study.open'),
              attrs: { 'data-tn-action': 'primary' },
              onClick: options.onOpenStudy,
            }),
          ]),
      ...backButton(),
    ]);
  }

  /** `TN-ATTEMPT-05`: the saved exam names questions this build does not have. */
  function renderGone(): void {
    const heading = element(doc, 'h2', {
      testId: 'exam-gone-title',
      text: text(locale, 'exam.gone.title'),
    });
    const body = element(doc, 'p', { text: text(locale, 'exam.gone.body') });
    screen.describedBy(body);

    replaceChildren(panel, [
      element(doc, 'div', {
        testId: 'exam-gone',
        className: 'tn-screen__row',
        children: [heading, body],
      }),
    ]);
    replaceChildren(actions, [
      button(doc, {
        testId: 'exam-new',
        text: text(locale, 'exam.new'),
        attrs: { 'data-tn-action': 'primary' },
        ...(options.onNewExam === undefined ? {} : { onClick: options.onNewExam }),
      }),
      ...backButton(),
    ]);
  }

  function renderError(message: string): void {
    const body = element(doc, 'p', { testId: 'exam-error', text: message });
    screen.describedBy(body);
    replaceChildren(panel, [body]);
    replaceChildren(actions, [
      button(doc, {
        testId: 'exam-retry',
        text: text(locale, 'study.error.retry'),
        attrs: { 'data-tn-action': 'primary' },
        ...(options.onRetry === undefined ? {} : { onClick: options.onRetry }),
      }),
      ...backButton(),
    ]);
  }
}
