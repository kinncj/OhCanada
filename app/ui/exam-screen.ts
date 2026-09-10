/**
 * The running exam: twenty questions, Previous and Next, a clock that may not be
 * there, and a menu that can always be reached.
 *
 * `docs/stories/TN-EXAM-starting-and-answering.md` (`TN-EXAM-03`, `TN-EXAM-04`,
 * `TN-EXAM-06`, `TN-EXAM-07`, `TN-EXAM-08`), `TN-TIMER-the-exam-clock.md`
 * (`TN-TIMER-02`, `TN-TIMER-03`, `TN-TIMER-04`) and
 * `TN-ATTEMPT-leaving-and-resuming-an-exam.md` (`TN-ATTEMPT-01`, `TN-ATTEMPT-05`)
 * are the acceptance criteria.
 *
 * ## Why this is not `app/ui/question-card.ts`
 *
 * The card and this screen ask the same question and disagree about three things
 * that are the *whole* of what an exam is, and `TN-EXAM-03` names all three:
 *
 *  - the card teaches — a "New"/"Seen before" tag, the right answer, the
 *    explanation, "You will see this question again soon." — and an exam shows
 *    none of it: `question-kind`, `question-feedback` and `question-explanation`
 *    are asserted **absent** here;
 *  - the card takes one answer once (`TN-CARD-04`), and an exam answer can be
 *    changed until the exam is finished, because in an exam a mis-tap costs a
 *    mark and the player who mis-taps is disproportionately the player using a
 *    switch, a large pointer target at 200 % text, or a screen reader;
 *  - the card advances; an exam does not advance by itself at all.
 *
 * So the two screens share `app/ui/screen.ts` — the focus trap, the switch ring,
 * Escape, the 44 pt controls — and nothing else. Sharing the card and branching
 * it three ways would make every one of those differences a flag that the wrong
 * caller can set.
 *
 * ## Answering moves the focus; it does not move the exam
 *
 * `TN-EXAM-03`: "focus moves to `exam-next` … the exam has not moved to question
 * 2 by itself". Auto-advance would save twenty taps and take away the one moment
 * a player can check that the game heard them — and for a switch user it would
 * remove the chance entirely. On the last question focus lands on
 * `exam-finish` instead, because `exam-next` is disabled there and focus on a
 * disabled control is focus nowhere.
 *
 * ## The clock is drawn here and owned nowhere near here
 *
 * This screen renders whatever `app/ui/exam-clock.ts` says and tells it when the
 * player stopped answering. It never decides that time has passed, and it holds
 * no scheduling primitive of its own (`TN-TIMER-07`).
 *
 * DOM only (ADR-0005).
 */

import { count, labelled, text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { clockText, type ExamClock } from './exam-clock';
import { createConfirm, type Confirm } from './confirm';
import { createScreen, type Screen } from './screen';

/** One question, as this screen draws it. Localised by the caller. */
export interface ExamQuestionView {
  /** Zero-based position in this exam. */
  readonly index: number;
  readonly total: number;
  readonly prompt: string;
  /** Authored order, four of them (`OQ-CARD-2`). Empty when unavailable. */
  readonly options: readonly string[];
  /** Which option the player took, or `null`. Changeable until the exam ends. */
  readonly chosenIndex: number | null;
  /**
   * The bank can no longer produce this question (`TN-EXAM-05`, "the bank
   * shrinks between drawing and answering"). It is shown as unanswered, is not
   * counted as wrong, and is emphatically not an error card over the exam.
   */
  readonly unavailable?: boolean;
}

/** What the clock area says. `none` is an exam that never had one. */
export type ExamTimerView =
  | { readonly kind: 'none' }
  /** The player turned it off mid-exam (`TN-TIMER-04`). */
  | { readonly kind: 'stopped' }
  | { readonly kind: 'running'; readonly remainingMs: number; readonly paused: boolean };

export interface ExamScreenOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string, lang?: string) => void;
  /** The question at this index, already in the player's language. */
  readonly question: (index: number) => ExamQuestionView | null;
  /** How many of the twenty have an answer. Counted, never stored beside them. */
  readonly answered: () => number;
  /** Every index with no answer, in order. Drives the finish confirmation. */
  readonly unanswered: () => readonly number[];
  /** What the clock area should say right now. */
  readonly timer: () => ExamTimerView;
  /** An answer was given or changed. The caller records it and saves. */
  readonly onChoose: (index: number, chosenIndex: number) => void;
  /** The player moved to another question. For announcements the caller owns. */
  readonly onMove?: (index: number) => void;
  /** Finish, past any confirmation this screen showed. */
  readonly onFinish: () => void;
  /** `exam.leave`, past any confirmation. The exam is kept; the caller saves. */
  readonly onLeave: () => void;
  /** `common.settings` from the exam's menu. The caller pauses the clock. */
  readonly onOpenSettings?: () => void;
  /** `exam.timer.stop`. One way; the control is gone afterwards. */
  readonly onStopTimer?: () => void;
  /** The clock the screen draws and pauses. Absent for an untimed exam. */
  readonly clock?: ExamClock;
  /** `TN-ATTEMPT-05`: storage is blocked, so leaving really would lose the exam. */
  readonly storageBlocked?: boolean;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
  /**
   * How the screen learns the tab was hidden. Injected so `TN-TIMER-03`'s "the
   * tab is hidden for five minutes" is a test rather than a wait, and so this
   * module does not reach for `document` behind its caller's back.
   */
  readonly visibility?: {
    readonly hidden: () => boolean;
    readonly subscribe: (listener: () => void) => () => void;
  };
}

export interface ExamScreen {
  readonly element: HTMLElement;
  readonly visible: boolean;
  /** Which question is on screen, zero-based. */
  readonly at: number;
  show(index: number): void;
  hide(): void;
  /** Move to a question and put focus where a player would look for it. */
  goTo(index: number): void;
  /** Re-read the question, the count and the clock without moving. */
  refresh(): void;
  /** Redraw the clock only. Cheap, and called once a minute at most. */
  refreshClock(): void;
  /** The player is not answering: a screen the caller opened over the exam. */
  pause(reason: string): void;
  /** They are answering again. The clock carries on when the last reason goes. */
  resume(reason: string): void;
  setStorageBlocked(blocked: boolean): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createExamScreen(host: HTMLElement, options: ExamScreenOptions): ExamScreen {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let at = 0;
  let storageBlocked = options.storageBlocked === true;
  let holdMs = options.holdMs ?? 600;
  /**
   * What is over the exam right now: its menu, a confirmation, Settings.
   *
   * A set rather than a boolean, and for the same reason {@link paused} is one:
   * Settings opens *from* the menu, so two surfaces hand over to each other and
   * the first to close must not put the exam back in charge under the second.
   * `Screen.setCovered` stands the focus trap and the switch ring down together
   * — measured: without it the outer trap marks the menu `inert` and every
   * control in it is unclickable.
   */
  const covers = new Set<string>();

  const cover = (reason: string): void => {
    covers.add(reason);
    screen.setCovered(true);
  };

  const uncover = (reason: string): void => {
    covers.delete(reason);
    if (covers.size === 0) screen.setCovered(false);
  };
  /**
   * Why the clock is paused, and how many reasons are outstanding.
   *
   * A set rather than a boolean: Settings can be opened from the exam's menu, so
   * two surfaces are over the exam at once and the first one to close must not
   * start the clock under the second. `TN-TIMER-03` — "nobody pays exam time for
   * raising their text size" — is one lost pause away from being false.
   */
  const paused = new Set<string>();

  const screen: Screen = createScreen(host, {
    id: 'tn-exam-screen',
    testId: 'exam-screen',
    locale,
    /*
     * `TN-EXAM-06`: "Escape does not throw the exam away". It opens the menu,
     * which is where leaving lives — so Escape reaches the way out in one press
     * and takes nothing away by itself.
     */
    onEscape: () => {
      openMenu();
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

  const heading = element(doc, 'h1', { id: 'tn-exam-heading', testId: 'exam-heading' });
  heading.tabIndex = -1;
  screen.labelledBy(heading);

  /* The clock area. Drawn as text and nothing else: no bar, no ring, no colour
     that means anything (`TN-TIMER` rule 5). */
  const clockLine = element(doc, 'p', { testId: 'exam-clock', className: 'tn-exam__clock' });
  const clockPaused = element(doc, 'span', { testId: 'exam-clock-paused' });
  const clockTime = element(doc, 'span', { testId: 'exam-clock-time' });
  clockLine.append(clockPaused, clockTime);

  /* The sentence an untimed exam shows instead. Never both. */
  const untimedLine = element(doc, 'p', {
    testId: 'exam-untimed',
    className: 'tn-screen__help',
  });

  const progress = element(doc, 'p', { testId: 'exam-progress' });

  const questionProgress = element(doc, 'h2', {
    id: 'tn-exam-question-progress',
    testId: 'question-progress',
  });
  const prompt = element(doc, 'p', { id: 'tn-exam-question-prompt', testId: 'question-prompt' });
  const optionList = element(doc, 'ul', {
    className: 'tn-screen__options',
    attrs: { role: 'list' },
  });

  /**
   * A named region rather than a nested dialog.
   *
   * `TN-EXAM-08` allows either. A second `aria-modal` dialog inside the exam's
   * own dialog would mean two focus traps and two switch rings over one page,
   * which is the defect `app/ui/shell.ts` brackets `setModalOpen` to avoid. A
   * region named by the progress line gives the same thing a screen reader
   * needs — "Question 1 of 20" before the prompt — with one trap.
   */
  const card = element(doc, 'section', {
    testId: 'question-card',
    className: 'tn-exam__card',
    attrs: {
      'aria-labelledby': questionProgress.id,
      'aria-describedby': prompt.id,
    },
    children: [questionProgress, prompt, optionList],
  });

  const previous = button(doc, {
    testId: 'exam-previous',
    onClick: () => {
      move(at - 1);
    },
  });
  const next = button(doc, {
    testId: 'exam-next',
    onClick: () => {
      move(at + 1);
    },
  });
  const finish = button(doc, {
    testId: 'exam-finish',
    attrs: { 'data-tn-action': 'primary' },
    onClick: () => {
      requestFinish();
    },
  });
  /*
   * The way to Settings, the timer and the way out, and it is on the screen at
   * all times rather than behind a gesture (`OQ-ATTEMPT-3`, and `TN-EXAM-01`'s
   * one-thumb scenario). It sits **last** in the reading order and therefore
   * last in the switch ring, so `TN-EXAM-07`'s ring — the four options, then
   * Previous, Next and Finish — is walked before a switch user reaches it.
   */
  const menuButton = button(doc, {
    testId: 'exam-menu-button',
    attrs: { 'data-tn-action': 'quiet' },
    onClick: () => {
      openMenu();
    },
  });

  const controls = element(doc, 'div', {
    className: 'tn-screen__actions',
    children: [previous, next, finish, menuButton],
  });

  screen.card.append(heading, clockLine, untimedLine, progress, card, controls);

  /* -------------------------------------------------------------- the menu */

  const menu: Screen = createScreen(host, {
    id: 'tn-exam-menu',
    testId: 'exam-menu',
    locale,
    onEscape: () => {
      closeMenu();
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

  const menuTitle = element(doc, 'h1', { id: 'tn-exam-menu-title' });
  menu.labelledBy(menuTitle);
  const menuActions = element(doc, 'div', { className: 'tn-screen__actions' });
  /**
   * What leaving means, said in the menu rather than after the fact.
   *
   * `TN-ATTEMPT-05`: a browser that cannot save turns "Your exam is saved. You
   * can finish it later." into "leaving will end this exam", and the two
   * sentences are never both on screen. A player deciding whether to stop should
   * read the true one before they decide, not the reassuring one afterwards.
   */
  const menuPromise = element(doc, 'p', {
    testId: 'exam-menu-promise',
    className: 'tn-screen__help',
  });
  menu.card.append(menuTitle, menuPromise, menuActions);

  /* ------------------------------------------------------- confirmations */

  const unansweredConfirm: Confirm = createConfirm(host, {
    id: 'tn-exam-unanswered',
    testId: 'exam-unanswered',
    locale,
    describe: (which) => ({
      title: count(which, 'exam.unanswered', options.unanswered().length),
    }),
    confirmKey: 'exam.finishAnyway',
    confirmTestId: 'exam-finish-anyway',
    cancelKey: 'exam.goToUnanswered',
    cancelTestId: 'exam-go-unanswered',
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    onConfirm: () => {
      uncover('confirm');
      resume('confirm');
      options.onFinish();
    },
    /*
     * Cancelling this one is not "nothing": it takes the player to the first
     * question they skipped (`TN-EXAM-04`). Escape does the same, which is right
     * — the player said no to finishing, and the questions are what is behind
     * the dialog.
     */
    onCancel: () => {
      uncover('confirm');
      resume('confirm');
      const first = options.unanswered()[0];
      if (first !== undefined) move(first);
      else focusQuestion();
    },
    singleSwitch: options.singleSwitch === true,
    holdMs: options.holdMs ?? 600,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  const leaveConfirm: Confirm = createConfirm(host, {
    id: 'tn-exam-leave-confirm',
    testId: 'exam-leave-confirm',
    locale,
    describe: (which) => ({
      title: text(which, 'exam.leave.confirm'),
      body: text(which, 'exam.leave.notKept'),
    }),
    confirmKey: 'exam.leave',
    confirmTestId: 'exam-leave-confirmed',
    cancelKey: 'exam.leave.stay',
    cancelTestId: 'exam-leave-stay',
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    onConfirm: () => {
      uncover('confirm');
      resume('confirm');
      options.onLeave();
    },
    onCancel: () => {
      uncover('confirm');
      resume('confirm');
      focusQuestion();
    },
    singleSwitch: options.singleSwitch === true,
    holdMs: options.holdMs ?? 600,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  /* --------------------------------------------------------- the tab going */

  const unsubscribeVisibility =
    options.visibility === undefined
      ? null
      : options.visibility.subscribe(() => {
          /*
           * `TN-TIMER-03`: "a hidden tab pauses the clock … no time was taken
           * while the game was closed", and `OQ-TIMER-2` records why — the
           * alternative punishes the phone call, the bus stop and the browser
           * that discarded the tab, none of which is the player's doing.
           */
          if (options.visibility?.hidden() === true) pause('hidden');
          else resume('hidden');
        });

  render();

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    get at(): number {
      return at;
    },

    show(index): void {
      at = clampIndex(index);
      screen.show();
      render();
      screen.refreshSwitch();
      focusQuestion();
      announceQuestion();
    },

    hide(): void {
      menu.hide();
      unansweredConfirm.close();
      leaveConfirm.close();
      screen.hide();
    },

    goTo(index): void {
      move(index);
    },

    refresh(): void {
      render();
      screen.refreshSwitch();
    },

    refreshClock(): void {
      renderClock();
    },

    pause,

    resume(reason: string): void {
      /* A screen the caller opened over the exam has closed. It covered the
         exam as well as pausing it, so both come back together. */
      uncover(reason);
      resume(reason);
    },

    setStorageBlocked(blocked): void {
      storageBlocked = blocked;
      renderMenu();
    },

    setLocale(nextLocale): void {
      locale = nextLocale;
      screen.setLocale(nextLocale);
      menu.setLocale(nextLocale);
      unansweredConfirm.setLocale(nextLocale);
      leaveConfirm.setLocale(nextLocale);
      render();
      screen.refreshSwitch();
    },

    setSingleSwitch(enabled, nextHoldMs): void {
      if (nextHoldMs !== undefined) holdMs = nextHoldMs;
      screen.setSwitchEnabled(enabled, holdMs);
      menu.setSwitchEnabled(enabled, holdMs);
      unansweredConfirm.setSingleSwitch(enabled, holdMs);
      leaveConfirm.setSingleSwitch(enabled, holdMs);
    },

    destroy(): void {
      unsubscribeVisibility?.();
      unansweredConfirm.destroy();
      leaveConfirm.destroy();
      menu.destroy();
      screen.destroy();
    },
  };

  /* ------------------------------------------------------------- behaviour */

  function clampIndex(index: number): number {
    const view = options.question(0);
    const total = view?.total ?? 1;
    return Math.min(Math.max(0, index), Math.max(0, total - 1));
  }

  function pause(reason: string): void {
    paused.add(reason);
    options.clock?.pause();
    renderClock();
  }

  function resume(reason: string): void {
    paused.delete(reason);
    if (paused.size > 0) return;
    options.clock?.resume();
    renderClock();
  }

  function move(index: number): void {
    const target = clampIndex(index);
    if (target === at) return;
    at = target;
    render();
    screen.refreshSwitch();
    focusQuestion();
    announceQuestion();
    options.onMove?.(at);
  }

  /**
   * Where focus lands when a question arrives.
   *
   * The heading of the card, not an option: `TN-EXAM-06` requires focus never to
   * be left on the body, and a screen reader landing on the progress line reads
   * "Question 2 of 20" and then the prompt, which is the order a player needs
   * them in. Landing on `option-0` would read one answer out of context.
   */
  function focusQuestion(): void {
    if (!screen.visible) return;
    questionProgress.tabIndex = -1;
    questionProgress.focus({ preventScroll: true });
  }

  function announceQuestion(): void {
    const view = options.question(at);
    if (view === null) return;
    const where = text(locale, 'card.progress', { n: view.index + 1, total: view.total });
    /*
     * `TN-EXAM-08`: "it also reads whether that question has been answered yet",
     * and it says nothing about being right — an exam gives no feedback until it
     * ends, and the live region is not a loophole in that.
     */
    const chosen = view.chosenIndex === null ? null : view.options[view.chosenIndex];
    const answeredPart =
      chosen === undefined || chosen === null
        ? text(locale, 'exam.notAnsweredYet')
        : labelled(locale, text(locale, 'card.yourAnswer'), chosen);
    options.announce?.(`${where} ${answeredPart}`, locale);
  }

  function requestFinish(): void {
    if (options.unanswered().length === 0) {
      /* `TN-EXAM-04`: "no confirmation was shown" when everything is answered.
         A dialog that always appears is a dialog nobody reads. */
      options.onFinish();
      return;
    }
    pause('confirm');
    cover('confirm');
    unansweredConfirm.open();
  }

  function openMenu(): void {
    if (menu.visible) return;
    renderMenu();
    pause('menu');
    cover('menu');
    menu.show();
    menu.refreshSwitch();
  }

  function closeMenu(): void {
    if (!menu.visible) return;
    menu.hide();
    uncover('menu');
    resume('menu');
  }

  /* ---------------------------------------------------------- the drawing */

  function render(): void {
    heading.textContent = text(locale, 'exam.title');
    renderClock();
    renderQuestion();
    renderControls();
    renderMenu();
  }

  function renderClock(): void {
    const view = options.timer();
    if (view.kind === 'running') {
      clockLine.hidden = false;
      untimedLine.hidden = true;
      untimedLine.textContent = '';
      /*
       * Paused is a **word**, not a style: `TN-TIMER-03`, "the pause is not
       * conveyed by colour, opacity or an icon alone". The time left stays
       * underneath it, because a player who opened a menu still wants to know
       * what they are coming back to.
       */
      clockPaused.hidden = !view.paused;
      clockPaused.textContent = view.paused ? text(locale, 'exam.timer.paused') : '';
      clockTime.textContent = clockText(locale, view.remainingMs);
      return;
    }

    /* `TN-TIMER-02`: "the element `exam-clock` is not present in the
       accessibility tree" when there is no clock. `hidden` is what removes it,
       rather than a class that leaves it readable to a screen reader. */
    clockLine.hidden = true;
    clockPaused.textContent = '';
    clockTime.textContent = '';
    untimedLine.hidden = false;
    untimedLine.textContent = text(
      locale,
      view.kind === 'stopped' ? 'exam.timer.stopped' : 'exam.timer.off',
    );
  }

  function renderQuestion(): void {
    const view = options.question(at);
    progress.textContent = text(locale, 'exam.answered', {
      done: options.answered(),
      total: view?.total ?? 0,
    });

    if (view === null) {
      questionProgress.textContent = '';
      prompt.textContent = '';
      replaceChildren(optionList, []);
      return;
    }

    questionProgress.textContent = text(locale, 'card.progress', {
      n: view.index + 1,
      total: view.total,
    });

    if (view.unavailable === true) {
      /*
       * `TN-EXAM-05`: "the failure is not shown as an error card over the exam".
       * One sentence where the wording would be, the same sentence the result
       * uses for it later, and the exam carries on.
       */
      prompt.textContent = text(locale, 'exam.result.unavailable');
      replaceChildren(optionList, []);
      return;
    }

    prompt.textContent = view.prompt;
    replaceChildren(
      optionList,
      view.options.map((wording, index) => {
        const chosen = view.chosenIndex === index;
        const control = button(doc, {
          testId: `option-${String(index)}`,
          /* `aria-pressed`, not `aria-checked`: the player may change their mind
             and may also un-choose nothing — there is no "none of these" — so
             this is a toggle that reports its state, which is what
             `TN-EXAM-08`'s "reports its chosen state" asks for. */
          attrs: { 'aria-pressed': String(chosen) },
          onClick: () => {
            choose(index);
          },
          children: chosen
            ? [
                mark(doc, '✓'),
                element(doc, 'span', { text: wording }),
                element(doc, 'span', {
                  className: 'tn-screen__state',
                  text: text(locale, 'card.yourAnswer'),
                }),
              ]
            : [element(doc, 'span', { text: wording })],
        });
        return element(doc, 'li', { children: [control] });
      }),
    );
  }

  function choose(chosenIndex: number): void {
    const view = options.question(at);
    if (view === null || view.unavailable === true) return;
    options.onChoose(at, chosenIndex);
    renderQuestion();
    renderControls();
    screen.refreshSwitch();

    const wording = view.options[chosenIndex] ?? '';
    /* Recorded, and said so — without a word about whether it was right
       (`TN-EXAM-08`). */
    options.announce?.(labelled(locale, text(locale, 'card.yourAnswer'), wording), locale);

    /*
     * `TN-EXAM-03`: focus moves to Next, and the exam does not. On the last
     * question Next is disabled, so Finish is where a player would go and where
     * focus goes — never onto a control that cannot be taken.
     */
    const target = next.getAttribute('aria-disabled') === 'true' ? finish : next;
    target.focus({ preventScroll: true });
  }

  function renderControls(): void {
    const view = options.question(at);
    const total = view?.total ?? 0;

    previous.textContent = text(locale, 'exam.previous');
    next.textContent = text(locale, 'exam.next');
    finish.textContent = text(locale, 'exam.finish');
    menuButton.textContent = text(locale, 'hud.menu');

    /*
     * `aria-disabled`, never `disabled`. `TN-EXAM-03` allows either "not
     * offered" or "present and marked aria-disabled", and the second is kinder:
     * a screen-reader or switch user can still read that Previous exists and is
     * not available yet, instead of the control silently disappearing and
     * reappearing as they move.
     */
    setDisabled(previous, at <= 0);
    setDisabled(next, at >= total - 1);
  }

  function setDisabled(control: HTMLElement, disabled: boolean): void {
    control.setAttribute('aria-disabled', String(disabled));
    /* Out of the tab order as well, so Tab does not stop on something that does
       nothing; still in the accessibility tree, which is the point. */
    (control as HTMLButtonElement).tabIndex = disabled ? -1 : 0;
  }

  function renderMenu(): void {
    menuTitle.textContent = text(locale, 'hud.menu.title');
    menuPromise.textContent = text(
      locale,
      storageBlocked ? 'exam.leave.notKept' : 'exam.leave.kept',
    );
    menu.describedBy(menuPromise);

    const items: HTMLElement[] = [];

    if (options.onOpenSettings !== undefined) {
      items.push(
        button(doc, {
          testId: 'exam-menu-settings',
          text: text(locale, 'common.settings'),
          onClick: () => {
            /*
             * The menu goes, Settings arrives, and the exam stays covered
             * throughout: `cover('settings')` is taken *before* the menu's is
             * released, so the exam never becomes interactive for the frame
             * between them. The clock stays paused for the same reason —
             * `TN-TIMER-03`, no exam time for changing a setting.
             */
            cover('settings');
            pause('settings');
            menu.hide();
            uncover('menu');
            paused.delete('menu');
            options.onOpenSettings?.();
          },
        }),
      );
    }

    /*
     * `TN-TIMER-04`, the escape hatch. Offered only while a clock is running, so
     * "the clock cannot be started again mid-exam" is true of the screen as well
     * as of the clock: once it is gone there is no control here to bring it
     * back.
     */
    if (options.timer().kind === 'running' && options.onStopTimer !== undefined) {
      items.push(
        button(doc, {
          testId: 'exam-timer-stop',
          text: text(locale, 'exam.timer.stop'),
          onClick: () => {
            menu.hide();
            uncover('menu');
            paused.delete('menu');
            options.onStopTimer?.();
            render();
            screen.refreshSwitch();
            options.announce?.(text(locale, 'exam.timer.stopped'), locale);
            /* `TN-TIMER-08`: "focus returns to the question I was on". */
            focusQuestion();
          },
        }),
      );
    }

    items.push(
      button(doc, {
        testId: 'exam-leave',
        text: text(locale, 'exam.leave'),
        onClick: () => {
          menu.hide();
          uncover('menu');
          paused.delete('menu');
          if (storageBlocked) {
            /* The only confirmation leaving ever shows, and only where there is
               something to lose (`TN-ATTEMPT-05`). */
            pause('confirm');
            cover('confirm');
            leaveConfirm.open();
            return;
          }
          options.onLeave();
        },
      }),
    );

    items.push(
      button(doc, {
        testId: 'exam-menu-close',
        text: text(locale, 'common.close'),
        attrs: { 'data-tn-action': 'quiet' },
        onClick: () => {
          closeMenu();
        },
      }),
    );

    replaceChildren(menuActions, items);
  }
}
