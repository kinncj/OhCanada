/**
 * Exam mode, composed.
 *
 * `app/ui/exam-start.ts`, `app/ui/exam-screen.ts`, `app/ui/exam-result.ts` and
 * `app/ui/exam-clock.ts` know nothing about a bank, a save or a clock;
 * `app/application/use-cases/exam-session.ts` knows nothing about a screen. This
 * module is the wire, and it is the composition root's work for the same reason
 * `app/bootstrap/study.ts` is: it needs the session, the live `Progress`, the
 * save and the `Clock`, and `app/ui` may hold none of them (ADR-0005).
 *
 * ## The whole of Exam mode, in one path
 *
 * ```
 * title-exam ─► exam-start ─┬─ ready     ─► exam-begin ─► exam-screen ─┬─ exam-finish ─► exam-result
 *                           ├─ resume    ─► Carry on   ─► exam-screen ─┴─ time up     ─► exam-result
 *                           ├─ not-ready ─► Study                      └─ Leave       ─► title (kept)
 *                           ├─ gone      ─► Start a new exam
 *                           └─ error     ─► Try again
 * ```
 *
 * ## Four rules that live in this file rather than in a screen
 *
 *  1. **The exam is written down as it is answered.** Every choice folds into
 *     `examInProgress` and is saved within the same tick, so `TN-ATTEMPT-02`'s
 *     "an answer given a moment before the tab closed is kept" is true because
 *     nothing is buffered, not because a buffer is flushed.
 *  2. **An exam answer is a real answer.** It goes through the same
 *     `answerQuestion` every other answer in the game goes through, so a question
 *     missed in an exam comes back in Study (`TN-RESULT-02`, `TN-RESULT-05`). No
 *     quest is passed, so an exam cannot advance one — the input that could is
 *     not supplied, rather than a flag saying not to.
 *  3. **The clock's `now` is the injected `Clock.elapsed()`.** Monotonic and
 *     one source, because a second source of time is how a paused clock quietly
 *     stops being paused (`OQ-TIMER-3`).
 *  4. **Only one exam is ever unfinished**, and that is the save's shape rather
 *     than this file's discipline: `examInProgress` is a nullable field, so
 *     starting a new exam over an old one is one assignment and cannot leave two
 *     behind (`TN-ATTEMPT-04`).
 */

import type { Clock, ShippableQuestion } from '@application/ports';
import {
  countAnswered,
  countRight,
  discardExam,
  finishExam,
  missedQuestionIds,
  openingIndex,
  resultsBySubject,
  startExam,
  withChoice,
  withExamInProgress,
  withRemaining,
} from '@application/use-cases/exam-attempt';
import type { ExamSession } from '@application/use-cases/exam-session';
import type { ExamAnswer, ExamInProgress, Progress } from '@domain/entities/progress';
import type { QuestionId, SubjectId } from '@domain/ids';
import { hasCopyRow, text, type UiLocale } from '@ui/copy';
import { createConfirm, type Confirm } from '@ui/confirm';
import { clockText, createExamClock, MINUTE_MS, type ExamClock } from '@ui/exam-clock';
import { createExamResult, type ExamResult, type ExamReviewItem } from '@ui/exam-result';
import {
  createExamScreen,
  type ExamQuestionView,
  type ExamScreen,
  type ExamTimerView,
} from '@ui/exam-screen';
import { createExamStartScreen, type ExamStartScreen } from '@ui/exam-start';
import type { SettingsStore } from '@ui/settings';

import type { ExamEventLog } from './exam-events';
import type { SubjectIndex } from './subjects';

export interface ExamControllerDeps {
  /** Where every exam screen is mounted: the page's one `<main>`. */
  readonly host: HTMLElement;
  readonly session: ExamSession;
  readonly store: SettingsStore;
  readonly announce: (message: string, lang?: string) => void;
  /** `now()` for the attempt's instants, `elapsed()` for the clock. */
  readonly clock: Clock;
  /** Read, not captured: an answer reassigns it. */
  readonly progress: () => Progress;
  /** Apply a change and persist it. The caller owns the save and its failures. */
  readonly update: (change: (progress: Progress) => Progress) => void;
  /**
   * Record one answer against the review schedule — `answerQuestion` plus the
   * save — exactly as Study does. Returns nothing: an exam shows the player how
   * they did at the end, from its own answers, never from the save read back.
   */
  readonly record: (question: ShippableQuestion, chosenIndex: number) => void;
  readonly events: ExamEventLog;
  /** `subject -> level`, so a result can name a subject the way the map does. */
  readonly subjects: () => Promise<SubjectIndex>;
  /**
   * How many subjects the finished game has, for "Subjects ready: 1 of 10".
   * Absent draws no such line — `OQ-EXAM-5`: a number this screen cannot derive
   * is left out rather than guessed.
   */
  readonly subjectsTotal?: number;
  /** `TN-ATTEMPT-05`: this browser is not saving, so leaving really loses it. */
  readonly storageBlocked: () => boolean;
  /** Opens the settings screen and calls back when it closes, so the clock resumes. */
  readonly openSettings?: (onClosed: () => void) => void;
  /** `study.open` from the not-ready screen and `exam.result.practise` from a result. */
  readonly openStudy?: () => void;
  /** The exam owns the page: the surface underneath stands its switch ring down. */
  readonly onOpen?: () => void;
  /** The exam is gone. The shell's ring comes back. */
  readonly onClose?: () => void;
  /** An exam started, was left, finished or was discarded: relabel the way in. */
  readonly onAttemptChanged?: () => void;
  /** Injected so a hidden tab is testable without hiding a tab. */
  readonly document?: Document;
}

export interface ExamController {
  /** Open the exam. Asks the bank first, so the screen it opens on is the true one. */
  open(): void;
  /** Is any exam screen on the page? */
  readonly isOpen: boolean;
  /**
   * A save has just failed, so leaving really would end the exam.
   *
   * `TN-ATTEMPT-05`: the exam's menu shows "leaving will end this exam" instead
   * of "Your exam is saved", and leaving asks first. Pushed in rather than
   * polled, because the moment it becomes true is the moment a write failed.
   */
  setStorageBlocked(blocked: boolean): void;
  destroy(): void;
}

/** What the exam holds while it is being taken, beyond what the save carries. */
interface Running {
  exam: ExamInProgress;
  /** The wording, by id. A question the bank has lost is simply absent. */
  readonly byId: ReadonlyMap<QuestionId, ShippableQuestion>;
  /** Is the clock still running? A timer turned off mid-exam makes this false. */
  timed: boolean;
  /**
   * The player turned the clock off during this exam.
   *
   * Distinct from `!timed`, and the distinction is a sentence on screen: an exam
   * that never had a clock says "No timer. Take as long as you like." and one
   * whose clock was stopped says "The timer is off." (`TN-TIMER-02` against
   * `TN-TIMER-04`). Both end up untimed and they are not the same fact, so the
   * exam remembers which — `remainingMs` is `null` in both cases and cannot.
   */
  timerStopped: boolean;
  /** The exam ended because the clock reached zero (`TN-TIMER-05`). */
  timeUp: boolean;
}

export function createExamController(deps: ExamControllerDeps): ExamController {
  const { store } = deps;
  const doc = deps.document ?? deps.host.ownerDocument;

  let startScreen: ExamStartScreen | null = null;
  let examScreen: ExamScreen | null = null;
  let resultScreen: ExamResult | null = null;
  let newExamConfirm: Confirm | null = null;
  let clock: ExamClock | null = null;
  let running: Running | null = null;
  let showing = false;
  /** Bumped on every open and every request, so a slow bank cannot land late. */
  let generation = 0;
  /** The previous exam's questions, so a second exam is a new draw (`TN-RESULT-06`). */
  let lastDrawn: ReadonlySet<QuestionId> = new Set();

  const locale = (): UiLocale => store.current.locale;
  const rules = deps.session.rules;
  const timeLimitMs = rules.timeLimitSeconds * 1000;

  const unsubscribe = store.subscribe((next, changed) => {
    if (changed === 'locale') {
      startScreen?.setLocale(next.locale);
      examScreen?.setLocale(next.locale);
      resultScreen?.setLocale(next.locale);
      newExamConfirm?.setLocale(next.locale);
    }
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      startScreen?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      examScreen?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      resultScreen?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      newExamConfirm?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
    }
  });

  return {
    get isOpen(): boolean {
      return showing;
    },

    open(): void {
      if (showing) return;
      showing = true;
      deps.onOpen?.();
      void refresh();
    },

    setStorageBlocked(blocked): void {
      examScreen?.setStorageBlocked(blocked);
    },

    destroy(): void {
      unsubscribe();
      clock?.destroy();
      clock = null;
      running = null;
      newExamConfirm?.destroy();
      newExamConfirm = null;
      resultScreen?.destroy();
      resultScreen = null;
      examScreen?.destroy();
      examScreen = null;
      startScreen?.destroy();
      startScreen = null;
      showing = false;
    },
  };

  /* ------------------------------------------------------------- the start */

  function start(): ExamStartScreen {
    startScreen ??= createExamStartScreen(deps.host, {
      locale: locale(),
      announce: deps.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onStart: (timed) => {
        void begin(timed);
      },
      onContinue: () => {
        void carryOn();
      },
      onNewExam: () => {
        askAboutNewExam();
      },
      onRetry: () => {
        void refresh();
      },
      ...(deps.openStudy === undefined
        ? {}
        : {
            onOpenStudy: () => {
              close();
              deps.openStudy?.();
            },
          }),
      onBack: close,
    });
    return startScreen;
  }

  /**
   * Ask the bank and the save, and show whichever of the five states is true.
   *
   * Asked **every time the exam opens**, never cached at boot: the bank is
   * chunked per subject and a first open is the first time anything is
   * downloaded, so a connection that failed at boot and works now must produce a
   * working screen (`TN-EXAM-05`, "trying again after the bank comes back").
   */
  async function refresh(): Promise<void> {
    const mine = (generation += 1);
    const screen = start();

    const unfinished = deps.progress().examInProgress;
    const index = await deps.session.byId();
    if (mine !== generation || !showing) return;

    if (!index.ok) {
      console.error(
        `[bootstrap] the question bank could not be read. ${index.error.code}: ${index.error.message}`,
      );
      screen.show({ kind: 'error', message: text(locale(), 'study.error') });
      return;
    }

    if (unfinished !== null) {
      /*
       * `TN-ATTEMPT-05`: a saved exam that names a question this build no longer
       * has cannot be opened, and says so without an error screen, a warning
       * triangle or a red state. The attempt is **not** dropped here — only
       * starting a new exam drops it — so nothing else in the save is disturbed
       * by a build that moved on.
       */
      const missing = unfinished.answers.some(
        (answer) => !index.value.has(answer.questionId),
      );
      if (missing) {
        screen.show({ kind: 'gone' });
        return;
      }
      screen.show({
        kind: 'resume',
        answered: countAnswered(unfinished.answers),
        total: unfinished.answers.length,
        remainingMs: unfinished.remainingMs,
      });
      return;
    }

    const readiness = await deps.session.readiness();
    if (mine !== generation || !showing) return;
    if (!readiness.ok) {
      console.error(
        `[bootstrap] the exam could not read the bank. ${readiness.error.code}: ${readiness.error.message}`,
      );
      screen.show({ kind: 'error', message: text(locale(), 'study.error') });
      return;
    }
    if (!readiness.value.ready) {
      screen.show({ kind: 'not-ready' });
      return;
    }

    screen.show({
      kind: 'ready',
      questionCount: rules.questionCount,
      passMark: rules.passMark,
      timeLimitMs,
      ...(deps.subjectsTotal === undefined
        ? {}
        : {
            subjects: {
              ready: readiness.value.subjectsReady,
              total: deps.subjectsTotal,
            },
          }),
    });
  }

  /** `TN-ATTEMPT-04`: the one destructive confirmation in this game. */
  function askAboutNewExam(): void {
    const screen = start();
    newExamConfirm ??= createConfirm(deps.host, {
      id: 'tn-exam-new-confirm',
      testId: 'exam-new-confirm',
      locale: locale(),
      describe: (which) => ({ title: text(which, 'exam.new.confirm') }),
      confirmKey: 'exam.new',
      confirmTestId: 'exam-new-confirmed',
      cancelKey: 'exam.new.keep',
      cancelTestId: 'exam-new-keep',
      announce: deps.announce,
      onConfirm: () => {
        screen.setCovered(false);
        deps.update(discardExam);
        deps.events.emit('exam/discarded');
        deps.onAttemptChanged?.();
        void refresh();
      },
      onCancel: () => {
        screen.setCovered(false);
      },
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
    });
    screen.setCovered(true);
    newExamConfirm.open();
  }

  /* -------------------------------------------------------------- the exam */

  async function begin(timed: boolean): Promise<void> {
    const mine = (generation += 1);
    const drawn = await deps.session.draw(lastDrawn);
    if (mine !== generation || !showing) return;

    if (!drawn.ok) {
      if (drawn.error.code === 'exam.bank.tooSmall') {
        start().setState({ kind: 'not-ready' });
        return;
      }
      console.error(
        `[bootstrap] an exam could not be drawn. ${drawn.error.code}: ${drawn.error.message}`,
      );
      start().setState({ kind: 'error', message: text(locale(), 'study.error') });
      return;
    }

    const index = await deps.session.byId();
    if (mine !== generation || !showing) return;
    if (!index.ok) {
      start().setState({ kind: 'error', message: text(locale(), 'study.error') });
      return;
    }

    lastDrawn = new Set(drawn.value.map((question) => question.id));
    const exam = startExam(drawn.value, deps.clock.now(), timed ? timeLimitMs : null);
    running = { exam, byId: index.value, timed, timeUp: false, timerStopped: false };

    deps.update((progress) => withExamInProgress(progress, exam));
    deps.events.emit('exam/started');
    deps.onAttemptChanged?.();

    enterExam(0, timed ? timeLimitMs : null);
  }

  /** `TN-ATTEMPT-03`: pick the unfinished exam back up, exactly where it was left. */
  async function carryOn(): Promise<void> {
    const mine = (generation += 1);
    const unfinished = deps.progress().examInProgress;
    if (unfinished === null) {
      void refresh();
      return;
    }
    const index = await deps.session.byId();
    if (mine !== generation || !showing) return;
    if (!index.ok) {
      start().setState({ kind: 'error', message: text(locale(), 'study.error') });
      return;
    }

    running = {
      exam: unfinished,
      byId: index.value,
      timed: unfinished.remainingMs !== null,
      timeUp: false,
      timerStopped: false,
    };
    deps.events.emit('exam/resumed');
    /* `TN-ATTEMPT-02`: "the exam opens at the first question with no answer; if
       every question has an answer, at the last one". Which question was on
       screen is deliberately not saved. */
    enterExam(openingIndex(unfinished.answers), unfinished.remainingMs);
  }

  function enterExam(index: number, remainingMs: number | null): void {
    startScreen?.hide();
    newExamConfirm?.close();
    resultScreen?.hide();

    if (remainingMs !== null) {
      clock?.destroy();
      clock = createExamClock({
        now: () => deps.clock.elapsed(),
        onChange: () => {
          examScreen?.refreshClock();
        },
        /* `TN-TIMER-09`: two points and the end, and never in between. */
        /* The same words the clock is drawing, so what is read and what is on
           screen cannot drift — and the plural form comes from `Intl` rather
           than from a comparison to 1 (`TN-TIMER-11`). */
        onWarn: (minutes) => {
          deps.announce(clockText(locale(), minutes * MINUTE_MS), locale());
        },
        onExpire: () => {
          timeUp();
        },
      });
      clock.start(remainingMs);
    } else {
      clock?.destroy();
      clock = null;
    }

    const screen = examSurface();
    screen.setStorageBlocked(deps.storageBlocked());
    screen.show(index);
    /* The clock always comes back paused and starts when the player is looking
       at a question (`TN-ATTEMPT-02`). */
    clock?.resume();
    screen.refreshClock();
  }

  function examSurface(): ExamScreen {
    examScreen ??= createExamScreen(deps.host, {
      locale: locale(),
      announce: deps.announce,
      question: viewAt,
      answered: () => (running === null ? 0 : countAnswered(running.exam.answers)),
      unanswered: () =>
        running === null
          ? []
          : running.exam.answers.flatMap((answer, index) =>
              answer.chosenIndex === null ? [index] : [],
            ),
      timer: timerView,
      onChoose: choose,
      onFinish: finish,
      onLeave: leave,
      onStopTimer: stopTimer,
      ...(deps.openSettings === undefined
        ? {}
        : {
            onOpenSettings: () => {
              examScreen?.pause('settings');
              deps.openSettings?.(() => {
                examScreen?.resume('settings');
              });
            },
          }),
      storageBlocked: deps.storageBlocked(),
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      visibility: {
        hidden: () => doc.hidden === true,
        subscribe: (listener) => {
          doc.addEventListener('visibilitychange', listener);
          return () => {
            doc.removeEventListener('visibilitychange', listener);
          };
        },
      },
      ...(clock === null ? {} : { clock }),
    });
    return examScreen;
  }

  function timerView(): ExamTimerView {
    if (running === null) return { kind: 'none' };
    if (clock === null || !clock.on) {
      /* An exam that never had a clock says "No timer."; one whose clock the
         player turned off says "The timer is off." They are different facts
         (`TN-TIMER-02` and `TN-TIMER-04`) and the exam remembers which. */
      return running.timerStopped ? { kind: 'stopped' } : { kind: 'none' };
    }
    return {
      kind: 'running',
      remainingMs: clock.remainingMs,
      paused: clock.phase === 'paused',
    };
  }

  function viewAt(index: number): ExamQuestionView | null {
    if (running === null) return null;
    const answer = running.exam.answers[index];
    if (answer === undefined) return null;
    const total = running.exam.answers.length;
    const question = running.byId.get(answer.questionId);
    if (question === undefined) {
      return {
        index,
        total,
        prompt: '',
        options: [],
        chosenIndex: answer.chosenIndex,
        unavailable: true,
      };
    }
    return {
      index,
      total,
      prompt: localised(question.prompt),
      options: question.options.map(localised),
      chosenIndex: answer.chosenIndex,
    };
  }

  function localised(value: { readonly en: string; readonly fr: string }): string {
    return locale() === 'fr' ? value.fr : value.en;
  }

  function choose(index: number, chosenIndex: number): void {
    if (running === null) return;
    const answer = running.exam.answers[index];
    if (answer === undefined) return;

    running.exam = withChoice(running.exam, index, chosenIndex);

    /*
     * The review schedule first, then the exam.
     *
     * `deps.record` reassigns `Progress` and saves; writing `examInProgress`
     * before it would fold the exam into a value that is about to be replaced.
     * `deps.update` reads the live progress, so the order below is the only one
     * in which both survive.
     *
     * Changing an answer records a second answer against the schedule, and that
     * is correct rather than tolerated: the player did answer twice, and the
     * exam's own record still holds exactly one answer for the question
     * (`TN-EXAM-03`).
     */
    const question = running.byId.get(answer.questionId);
    if (question !== undefined) deps.record(question, chosenIndex);

    const exam = withRemaining(running.exam, clock?.on === true ? clock.remainingMs : null);
    running.exam = exam;
    deps.update((progress) => withExamInProgress(progress, exam));
    deps.events.emit('exam/answered', String(answer.questionId));
  }

  /** `TN-TIMER-04`: one way, and everything else about the exam is untouched. */
  function stopTimer(): void {
    if (running === null) return;
    clock?.stop();
    running.timed = false;
    running.timerStopped = true;
    const exam = withRemaining(running.exam, null);
    running.exam = exam;
    deps.update((progress) => withExamInProgress(progress, exam));
    examScreen?.refresh();
  }

  function timeUp(): void {
    if (running === null) return;
    running.timeUp = true;
    deps.events.emit('exam/time-up');
    /* `TN-TIMER-05`: announced, once, and then focus moves to the result — which
       `ExamResult.show` does, because that is where focus belongs once the exam
       has ended. */
    deps.announce(text(locale(), 'exam.timer.timeUp.title'), locale());
    finish();
  }

  function finish(): void {
    if (running === null) return;
    const current = running;
    clock?.destroy();
    clock = null;

    let passed = false;
    deps.update((progress) => {
      const outcome = finishExam(progress, {
        exam: current.exam,
        now: deps.clock.now(),
        passMark: rules.passMark,
        timed: current.timed,
      });
      passed = outcome.attempt.passed;
      return outcome.progress;
    });

    deps.events.emit('exam/finished', passed ? 'passed' : 'not-passed');
    deps.onAttemptChanged?.();

    examScreen?.hide();
    void showResult(current, passed);
  }

  /** `TN-ATTEMPT-01`: leaving keeps the exam, asks nothing, and says so. */
  function leave(): void {
    if (running !== null) {
      const exam = withRemaining(running.exam, clock?.on === true ? clock.remainingMs : null);
      running.exam = exam;
      deps.update((progress) => withExamInProgress(progress, exam));
    }
    clock?.destroy();
    clock = null;
    running = null;
    deps.events.emit('exam/left');
    deps.onAttemptChanged?.();
    deps.announce(text(locale(), 'exam.leave.kept'), locale());
    close();
  }

  /* ------------------------------------------------------------ the result */

  async function showResult(current: Running, passed: boolean): Promise<void> {
    const index = await deps.subjects();
    if (!showing) return;

    const answers = current.exam.answers;
    const missed = missedQuestionIds(answers);

    const screen = resultSurface(missed.length > 0);
    screen.show({
      correct: countRight(answers),
      total: answers.length,
      passMark: rules.passMark,
      passed,
      timed: current.timed,
      timeUp: current.timeUp,
      unanswered: answers.length - countAnswered(answers),
      subjects: resultsBySubject(answers).map((row) => ({
        id: String(row.subjectId),
        name: subjectName(index, row.subjectId),
        correct: row.correct,
        total: row.total,
      })),
      review: answers.map((answer) => reviewItem(current, answer)),
    });
    running = null;
  }

  /**
   * The subject's name, or `null`.
   *
   * The **map's own** row for the level that teaches it — never a second set of
   * subject names, and never the raw id (`TN-RESULT-07`). A subject with no level
   * document in this build, or a level with no copy row, answers `null` and the
   * row keeps its numbers without a label.
   */
  function subjectName(index: SubjectIndex, subject: SubjectId): string | null {
    const level = index.levelFor(String(subject));
    if (level === null) return null;
    const key = `level.${level}.subtitle`;
    return hasCopyRow(key) ? text(locale(), key) : null;
  }

  function reviewItem(current: Running, answer: ExamAnswer): ExamReviewItem {
    const question = current.byId.get(answer.questionId);
    if (question === undefined) {
      return {
        prompt: null,
        options: [],
        chosenIndex: answer.chosenIndex,
        correctIndex: answer.correctIndex,
      };
    }
    const explanation = localised(question.explanation);
    return {
      prompt: localised(question.prompt),
      options: question.options.map(localised),
      chosenIndex: answer.chosenIndex,
      /* The answer's own record, not the bank's: a key corrected since the exam
         was taken must not change what the player is told they got right. */
      correctIndex: answer.correctIndex,
      ...(explanation === '' ? {} : { explanation }),
    };
  }

  function resultSurface(offerPractise: boolean): ExamResult {
    /* Rebuilt per result: it holds nothing a player would lose between exams,
       and whether "Practise the questions you missed" is offered at all depends
       on the exam that has just finished. */
    resultScreen?.destroy();
    resultScreen = createExamResult(deps.host, {
      locale: locale(),
      announce: deps.announce,
      ...(offerPractise && deps.openStudy !== undefined
        ? {
            onPractise: () => {
              close();
              deps.openStudy?.();
            },
          }
        : {}),
      onAgain: () => {
        /* `TN-RESULT-06`: a new exam starts from the start screen, with the
           timer choice offered again, and nothing starts until it is chosen. */
        resultScreen?.hide();
        void refresh();
      },
      onClose: close,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
    });
    return resultScreen;
  }

  /* --------------------------------------------------------------- leaving */

  function close(): void {
    if (!showing) return;
    showing = false;
    generation += 1;
    clock?.destroy();
    clock = null;
    running = null;
    newExamConfirm?.close();
    resultScreen?.hide();
    examScreen?.hide();
    startScreen?.hide();
    deps.onClose?.();
  }
}
