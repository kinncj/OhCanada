/**
 * Study mode, mounted.
 *
 * `app/ui/study-screen.ts` and `app/ui/question-card.ts` were both finished,
 * both scanned by axe, and both constructed by nothing under `app/`.
 * `app/application/use-cases/study-session.ts` was written as the seam they
 * needed and had no caller either. `app/bootstrap/main.ts` said so, in a comment
 * where the option would go:
 *
 * > "When it lands, the whole change here is:
 * >    onOpenStudy: () => { … mount over `studySource` … }"
 *
 * This module is what goes inside those braces. It is the composition root's
 * work — it needs the session, the progress value, the clock and the save, and
 * `app/ui` may hold none of them — and it is a separate file because
 * `openStudy()` in `main.ts` would be a hundred lines in the middle of routing.
 *
 * ## The four states, and where each comes from
 *
 * | On screen | Decided by |
 * |---|---|
 * | `ready`, with a count | `StudySession.available()` returning a positive number |
 * | `empty` | the same call returning zero |
 * | `error` | the same call failing — `TN-STUDY-03`, with a Try again that can work |
 * | `summary` | a drill that finished |
 *
 * `available()` is asked **every time Study opens**, not once at boot: the bank
 * is chunked per subject and a first open is the first time anything is
 * downloaded, so a connection that failed at boot and works now must produce a
 * working screen (`TN-STUDY-03`, "trying again after the questions come back").
 *
 * ## Recording, which `StudySession` deliberately does not do
 *
 * Every answer goes through `answerQuestion` and then the save. That is stated
 * in `study-session.ts` — "folding them in here would give this object two
 * reasons to exist" — so it is the caller's, and {@link StudyControllerDeps.record}
 * is where the caller hands it in. No quest is passed: `TN-STUDY-01`, "Study
 * earns no stamp and changes no level", is true because the one input that could
 * complete a quest is not supplied, rather than because a flag says so.
 *
 * ## Escape, twice
 *
 * `TN-STUDY-06`: "Escape leaves the drill, not the game." So Escape on a
 * question closes the drill and lands back on the Study screen with
 * `study.leaveKept` — "Your answers so far are saved." — and Escape there closes
 * Study and gives focus back to whatever opened it. Two levels, each one step.
 */

import type { ShippableQuestion } from '@application/ports';
import type { StudySession } from '@application/use-cases/study-session';
import { text, type UiLocale } from '@ui/copy';
import { createStudyScreen, type StudyScreen, type StudyState } from '@ui/study-screen';
import type { SettingsStore } from '@ui/settings';

import { createDrillRunner, type DrillRunner } from './quiz';

export interface StudyControllerDeps {
  /**
   * Where the screen and the card are mounted.
   *
   * It is the page's one `<main>` — `shell.main` on the front door,
   * `hud.main` over a level — because a `dialog` is not a landmark, so a modal
   * mounted beside `<main>` puts its content outside every landmark and axe's
   * `region` rule is right to complain.
   */
  readonly host: HTMLElement;
  readonly session: StudySession;
  /** Followed for the language, single-switch and the hold threshold. */
  readonly store: SettingsStore;
  readonly announce: (message: string, lang?: string) => void;
  /**
   * Record one answer: `answerQuestion` against the live progress, then the
   * save. Returns nothing — Study shows the player how they did from the card's
   * own judgement, and a summary that read the save back would be describing a
   * write that may still be in flight.
   */
  readonly record: (question: ShippableQuestion, chosenIndex: number) => void;
  /** Study now owns the page: the surface underneath stands its switch ring down. */
  readonly onOpen?: () => void;
  /** Study is gone. The level resumes, or the shell's ring comes back. */
  readonly onClose?: () => void;
}

export interface StudyController {
  /** Open Study. Asks the bank first, so the screen it opens on is the true one. */
  open(): void;
  /** Is Study — the screen or a drill — on the page? */
  readonly isOpen: boolean;
  destroy(): void;
}

export function createStudyController(deps: StudyControllerDeps): StudyController {
  const { store } = deps;
  let screen: StudyScreen | null = null;
  let runner: DrillRunner | null = null;
  let showing = false;
  /** Bumped on every open and every request, so a slow answer cannot land late. */
  let generation = 0;

  const locale = (): UiLocale => store.current.locale;

  const unsubscribe = store.subscribe((next, changed) => {
    if (changed === 'locale') {
      screen?.setLocale(next.locale);
      runner?.setLocale(next.locale);
    }
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      screen?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      runner?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
    }
  });

  function build(): StudyScreen {
    screen ??= createStudyScreen(deps.host, {
      locale: locale(),
      announce: (message) => {
        deps.announce(message, locale());
      },
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onStart: () => {
        void beginDrill();
      },
      /* `TN-STUDY-03`: "practising anyway" from the empty state is the same
         draw. The scheduler introduces new questions up to the daily limit, so
         the two controls differ in the sentence above them, not in the draw. */
      onPractiseNew: () => {
        void beginDrill();
      },
      onRetry: () => {
        void refresh();
      },
      onAgain: () => {
        void beginDrill();
      },
      onExit: close,
    });
    return screen;
  }

  function buildRunner(): DrillRunner {
    runner ??= createDrillRunner({
      host: deps.host,
      locale: locale(),
      announce: deps.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onAnswer: (question, chosenIndex) => {
        deps.record(question, chosenIndex);
      },
      onFinished: (result) => {
        const study = build();
        if (result.left) {
          /*
           * `TN-STUDY-05`: the drill is over, the answers are kept, and the
           * player is told. They land back on the Study screen rather than in
           * the level, so leaving is still one deliberate step and not a
           * side-effect of pressing Escape once.
           */
          void refresh().then(() => {
            study.showLeftNotice();
          });
          return;
        }
        study.show({
          kind: 'summary',
          correct: result.correct,
          total: result.answered,
          returning: result.returning,
        });
      },
    });
    return runner;
  }

  /** Ask the bank, and show whichever of the three opening states is true. */
  async function refresh(): Promise<void> {
    const mine = (generation += 1);
    const study = build();
    const count = await deps.session.available();
    if (mine !== generation || !showing) return;

    const state: StudyState = !count.ok
      ? /* The message is `app/ui`'s row, not the error's text: `study.error` is
           written for a player and `count.error.message` is written for whoever
           has to fix it, which goes to the console below. */
        { kind: 'error', message: text(locale(), 'study.error') }
      : count.value === 0
        ? { kind: 'empty' }
        : { kind: 'ready', available: count.value, drillSize: deps.session.drillSize };

    if (!count.ok) {
      console.error(
        `[bootstrap] the question bank could not be read. ${count.error.code}: ${count.error.message}`,
      );
    }

    study.show(state);
  }

  async function beginDrill(): Promise<void> {
    const mine = (generation += 1);
    const study = build();
    const drawn = await deps.session.drill(deps.session.drillSize);
    if (mine !== generation || !showing) return;

    if (!drawn.ok) {
      console.error(
        `[bootstrap] a drill could not be drawn. ${drawn.error.code}: ${drawn.error.message}`,
      );
      study.show({ kind: 'error', message: text(locale(), 'study.error') });
      return;
    }

    if (drawn.value.questions.length === 0) {
      /* Nothing to ask is the empty state, never a card with no question in it
         (`TN-STUDY-03`: "no empty question card is shown"). */
      study.show({ kind: 'empty' });
      return;
    }

    /* The screen goes before the card arrives: one dialog at a time, which is
       the same rule the menu keeps (`TN-HUD-02`). */
    study.hide();
    buildRunner().start(drawn.value.questions);
  }

  function close(): void {
    if (!showing) return;
    showing = false;
    generation += 1;
    runner?.stop();
    screen?.hide();
    deps.onClose?.();
  }

  return {
    get isOpen(): boolean {
      return showing;
    },

    open(): void {
      if (showing) return;
      showing = true;
      deps.onOpen?.();
      /*
       * The screen appears when `available()` answers, and not before.
       *
       * There is no fourth state to open on. `StudyState` has `ready`, `empty`
       * and `error`, all three of which are claims about the bank, and no story
       * writes a waiting sentence for this screen — `study.loading` does not
       * exist and inventing it would be this file authoring copy (ADR-0010).
       * Opening on `ready` with a count nobody has counted yet would put a
       * number on screen that is about to change, which is the defect this
       * project keeps finding. The wait is one dynamic import of chunks the
       * bundler has already split, and the adapter caches the answer, so it is
       * paid once per session. Reported as a copy gap with the task.
       */
      void refresh();
    },

    destroy(): void {
      unsubscribe();
      runner?.destroy();
      runner = null;
      screen?.destroy();
      screen = null;
      showing = false;
    },
  };
}
