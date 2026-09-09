import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import gameConfigDocument from '@content/game.config.json';
/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { readGameRules } from '../../../app/bootstrap/game-rules';
import { unlockedLevelIds } from '@domain/entities/level';
import { hasCopyRow, text } from '@ui/copy';
import type { LevelId } from '@domain/ids';

/**
 * The front door, and what the page is while a level has it.
 *
 * Slice 1 built a title screen, a level select, a HUD, a menu, a question card,
 * Study, settings, a POI card and two level screens, and wired none of them:
 * `app/bootstrap/main.ts` mounted the live region, the rotate overlay, the
 * renderer and a caption reading *"Foundation build. There is no level to play
 * yet"*. A visitor who typed the address read that sentence and had nothing to
 * press — a page describing itself wrongly, which is the third time this project
 * has shipped that shape. This suite is the wiring written down.
 *
 * It asserts **decisions**, because decisions live in the composition root
 * (ADR-0005) and nowhere else:
 *
 *  - a cold load opens the shell, and only a level gets a HUD;
 *  - `shell.enterLevel` is called **before** `createHud`, so the page never has
 *    two `<main>` landmarks;
 *  - `built` and `unlocked` are computed here, from the level catalogue and the
 *    config's `unlockRules`, and handed to the map as data;
 *  - `onPlayLevel` is a request this file may refuse;
 *  - leaving a level takes the HUD's `<main>` away and puts the canvas back,
 *    rather than leaving a second landmark behind the map;
 *  - `data-tn-level` — the attribute `app/ui` routes on — says loading, ready or
 *    failed, and is absent when no level is open.
 *
 * `node` environment, no jsdom: the fake DOM below supplies the handful of calls
 * the boot path makes. The DOM *screens* are mocked, exactly as the Phaser
 * adapter is, for the same reason: this suite asks what bootstrap decided, not
 * what a `<button>` looks like. `app/ui` has its own suites and its own axe
 * scans. What is deliberately **not** mocked is `@ui/level-events`: it is pure,
 * it is the subscriber the bus exists to feed, and mocking it would leave the
 * wiring unproven.
 */

/* ------------------------------------------------ the chain, read not retyped */

/**
 * Which level a cold load lands on is `content/game.config.json`'s answer and
 * not this suite's. It was Ottawa; it is Halifax; it will be somewhere else the
 * week Mi'kma'ki ships. A test that types the name has to be edited every time
 * the game grows and proves nothing more than one that reads it — so the three
 * levels this file needs are *roles*, derived from the shipped unlock rules:
 *
 *  - {@link START_LEVEL} — open before a single stamp is earned, so it is where
 *    the player lands and the only level the map will open on a cold load;
 *  - {@link EARNED_LEVEL} — the first level `order` makes them play for. The
 *    fixture catalogue below has a document for it and the rules keep it shut,
 *    which is the built-and-locked pair that proves `built` and `unlocked` come
 *    from two different sources rather than one;
 *  - {@link UNBUILT_LEVEL} — named by the rules, with no document in the
 *    catalogue. The request `onPlayLevel` has to refuse.
 *
 * Every assertion below interpolates the name, so a failure still says which
 * level it was about.
 */
const parsedRules = readGameRules(gameConfigDocument);
if (!parsedRules.ok) {
  throw new Error(`content/game.config.json did not parse: ${parsedRules.error.message}`);
}
const rules = parsedRules.value.unlockRules;

/** What `unlockRules` opens with an empty passport. */
const openAtBoot = unlockedLevelIds(rules, []);

/** Fail at import with the config change that caused it, rather than at `undefined`. */
const roleOrThrow = (id: LevelId | undefined, why: string): LevelId => {
  if (id === undefined) throw new Error(why);
  return id;
};

const START_LEVEL = roleOrThrow(
  openAtBoot[0],
  'content/game.config.json opens no level with an empty passport, so a cold load ' +
    'has nothing to play and this suite has no level to open.',
);

const EARNED_LEVEL = roleOrThrow(
  rules.order.find((id) => !openAtBoot.includes(id)),
  'every level in unlockRules.order is already in initialLevels, so no level in this ' +
    'build is earned by playing. The map would have no locked card to draw and the ' +
    'unlock chain would be untested by walking it — which is how the dead chain hid.',
);

const UNBUILT_LEVEL = roleOrThrow(
  rules.order.find((id) => id !== START_LEVEL && id !== EARNED_LEVEL),
  'unlockRules.order names fewer than three levels, so there is none left over to ' +
    'play the level this build has no document for.',
);

const hoisted = vi.hoisted(() => {
  const state: {
    /** Every composition step, in the order it happened. Order is the assertion. */
    calls: string[];
    loadCalls: string[];
    loadResult: unknown;
    search: string;
    /** Which level ids this build has a document for. */
    built: string[];
    hudOptions: Record<string, unknown> | null;
    hudHost: unknown;
    hudDestroyed: number;
    mainRemoved: number;
    modalHosts: Record<string, unknown>;
    /** The options each mocked modal was built with, keyed the same way. */
    modalOptions: Record<string, unknown>;
    shellOptions: Record<string, unknown> | null;
    shellHost: unknown;
    storageWarning: boolean;
    entries: unknown;
    level: unknown;
    paused: number;
    resumed: number;
    poiShown: unknown[];
    errorShown: number;
    /** Every option the error card was built or re-localised with. */
    errorTitles: string[];
    /** How many times the waiting screen was shown, and with what. */
    loadingShown: number;
    loadingText: { title: string; message: string }[];
    loadingHidden: number;
    loadingStallAfterMs: number | undefined;
    autoMove: boolean[];
    /** Every question the card was asked to present, in order. */
    questionsAsked: unknown[];
    /** Which host the question card was mounted into. */
    questionHost: unknown;
    /** The options the card was built with, so the answer wire can be driven. */
    questionOptions: Record<string, unknown> | null;
    /** Every showing of the completion card, with the content it was handed. */
    completeShown: unknown[];
    completeOptions: Record<string, unknown> | null;
    /** What `shell.leaveLevel` was told to land on, per call. */
    leftTo: unknown[];
    /**
     * The renderer's own `onLevelEvent`, captured at construction.
     *
     * It is how this suite plays a scene: the composition root hands the
     * renderer a sink, the renderer publishes on the bus through it, and `app/ui`
     * subscribes. Driving that sink is driving the real wire rather than calling
     * a listener the test found.
     */
    emit: ((name: string, detail?: string) => void) | null;
    /**
     * The renderer's `onLevelMilestone`, captured the same way and for the same
     * reason: `level/exitReached` is the scene saying the player walked to the
     * end of the world, and driving the sink is driving the real wire.
     */
    milestone: ((name: string, detail?: string) => void) | null;
    /** How many times the world was told the level is over. */
    markedComplete: number;
    /**
     * The renderer's `onLevelReady`: the level's **first playable frame**.
     *
     * A different moment from `loadLevel` resolving, which is the whole reason
     * it exists — Phaser is handed the scene by the time the promise settles and
     * boots it one or more frames later, so the camera, the affordances and the
     * keyboard keys do not exist yet. The fake below reproduces that gap rather
     * than papering over it.
     */
    playable: ((levelId: string) => void) | null;
    /** Does the fake scene boot at all? `false` is a level that never comes up. */
    scenesBoot: boolean;
    /** What the fake `StudySession` hands back, and how often it was asked. */
    drillCalls: number[];
    availableCalls: number;
    /** Every answer that reached `answerQuestion`, as [questionId, index]. */
    recorded: [string, number][];
    /** Every label the interact prompt was given, `null` for withdrawn. */
    prompts: (string | null)[];
    /** Every value the one-time interact hint was given, `null` for removed. */
    hints: (string | null)[];
    /** Every value the HUD notice was given, `null` for cleared. */
    notices: (string | null)[];
    /** Every value the quest tracker was given, `null` for "no task". */
    tasks: (string | null)[];
    /** Every state the Study screen was shown in. */
    studyShown: unknown[];
    /**
     * Which level the next recorded answer earns the stamp for, or `null`.
     *
     * `answerQuestion` earns one only for an answer that completes a quest's
     * `answer` step, and no level document declares a quest today — so the
     * signal is unreachable through content and is driven here instead. What is
     * being asserted is the composition root's half: what it does when the
     * domain says a stamp was earned.
     */
    stampFor: string | null;
    /** What the faked `answerQuestion` judges the next answers to be. */
    answersAreCorrect: boolean;
    /** Does the next recorded answer finish a quest? */
    questCompletes: boolean;
    /** The quest id handed to `answerQuestion` on each answer, or `null`. */
    answeredWithQuest: (string | null)[];
    /** Every passport that was mounted, as [host, options]. */
    passports: { host: unknown; options: Record<string, unknown> }[];
    passportsShown: number;
    passportsDestroyed: number;
    /** Every dialogue that was shown, as the content it was given. */
    dialoguesShown: Record<string, unknown>[];
    dialogueOptions: Record<string, unknown> | null;
  } = {
    calls: [],
    loadCalls: [],
    loadResult: { ok: true, value: undefined },
    search: '',
    /* Filled in `beforeEach` from the shipped rules: the level a cold load opens
       and the first one it makes the player earn. */
    built: [] as string[],
    hudOptions: null,
    hudHost: null,
    hudDestroyed: 0,
    mainRemoved: 0,
    modalHosts: {},
    modalOptions: {},
    shellOptions: null,
    shellHost: null,
    storageWarning: false,
    entries: null,
    level: null,
    paused: 0,
    resumed: 0,
    poiShown: [],
    errorShown: 0,
    errorTitles: [],
    loadingShown: 0,
    loadingText: [],
    loadingHidden: 0,
    loadingStallAfterMs: undefined,
    autoMove: [],
    questionsAsked: [],
    questionHost: null,
    questionOptions: null,
    completeShown: [],
    completeOptions: null,
    leftTo: [],
    emit: null,
    milestone: null,
    markedComplete: 0,
    playable: null,
    scenesBoot: true,
    drillCalls: [],
    availableCalls: 0,
    recorded: [],
    prompts: [],
    hints: [],
    notices: [],
    tasks: [],
    studyShown: [],
    stampFor: null,
    answersAreCorrect: true,
    questCompletes: false,
    answeredWithQuest: [],
    passports: [],
    passportsShown: 0,
    passportsDestroyed: 0,
    dialoguesShown: [],
    dialogueOptions: null,
  };
  return { state };
});

vi.mock('@adapters/phaser', () => ({
  parseBootConfig: (): unknown => ({
    ok: true,
    value: {
      title: 'TrueNorth',
      version: '0.1.0',
      defaultLocale: 'en',
      palette: { sky: '#8ecae6', ground: '#2a9d8f', horizon: '#219ebc' },
    },
  }),
  /*
   * The level catalogue, which derives its answer from `content/levels/*.json`
   * through a bundler glob. Stubbed as a set, because the question this suite
   * asks is whether bootstrap *consults* it — the alternative being a list of
   * built levels written into a screen, which is the bug `TN-MAP` is about.
   */
  hasLevel: (id: string): boolean => hoisted.state.built.includes(id),
  GameRenderer: class {
    readonly ready = Promise.resolve();
    constructor(options: {
      onLevelEvent?: (name: string, detail?: string) => void;
      onLevelMilestone?: (name: string, detail?: string) => void;
      onLevelReady?: (levelId: string) => void;
    }) {
      hoisted.state.emit = options.onLevelEvent ?? null;
      hoisted.state.milestone = options.onLevelMilestone ?? null;
      hoisted.state.playable = options.onLevelReady ?? null;
    }
    get palette(): Record<string, string> {
      return { sky: '#8ecae6' };
    }
    cssVariables(): Record<string, string> {
      return {};
    }
    async loadLevel(id: string): Promise<unknown> {
      hoisted.state.loadCalls.push(id);
      const result = hoisted.state.loadResult as { ok: boolean };
      /*
       * The scene boots *after* this promise settles, which is the gap the
       * whole `onLevelReady` seam is about. Modelled as a later microtask
       * rather than as the same one: a fake that called back synchronously
       * would let a caller that writes "ready" at the wrong moment keep
       * passing, which is exactly the defect this reproduces.
       */
      if (result.ok && hoisted.state.scenesBoot) {
        void Promise.resolve()
          .then(() => Promise.resolve())
          .then(() => {
            hoisted.state.playable?.(id);
          });
      }
      return Promise.resolve(result);
    }
    get level(): unknown {
      return hoisted.state.level;
    }
    setAutoMove(enabled: boolean): void {
      hoisted.state.autoMove.push(enabled);
    }
    markLevelComplete(): void {
      hoisted.state.markedComplete += 1;
    }
    pause(): void {
      hoisted.state.paused += 1;
    }
    resume(): void {
      hoisted.state.resumed += 1;
    }
  },
}));

/*
 * The shell. Recorded rather than drawn: what this suite has to say about it is
 * the host it was mounted into, the data it was handed, and *when* each of its
 * three routing calls happened relative to the HUD.
 */
vi.mock('@ui/shell', () => ({
  createShell: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.calls.push('createShell');
    hoisted.state.shellHost = host;
    hoisted.state.shellOptions = options;
    hoisted.state.entries = options['entries'];
    return {
      element: {},
      /* Named, because a modal the composition root mounts has to go *into* the
         shell's own `<main>`: a `dialog` is not a landmark, so one mounted
         beside it leaves its content outside every landmark. */
      main: { id: 'tn-shell' },
      view: null,
      start: (): void => {
        hoisted.state.calls.push('shell.start');
      },
      show: (): void => undefined,
      enterLevel: (id: string): void => {
        hoisted.state.calls.push(`shell.enterLevel:${id}`);
      },
      leaveLevel: (leaving: unknown): void => {
        hoisted.state.calls.push('shell.leaveLevel');
        hoisted.state.leftTo.push(leaving);
      },
      setEntries: (next: unknown): void => {
        hoisted.state.entries = next;
      },
      setResumeLevelId: (): void => undefined,
      setCharacterRequired: (): void => undefined,
      setStorageWarning: (raised: boolean): void => {
        hoisted.state.storageWarning = raised;
      },
      setModalOpen: (open: boolean): void => {
        hoisted.state.calls.push(`shell.setModalOpen:${String(open)}`);
      },
      destroy: (): void => undefined,
    };
  },
}));

/*
 * The DOM screens, mocked at the seam bootstrap actually uses.
 *
 * Each records the host it was mounted into, which is the whole of what this
 * suite has to say about them: `hud.main` for anything opened over a level, and
 * `#game` handed to the HUD so the canvas ends up inside the one `<main>`.
 */
vi.mock('@ui/hud', () => ({
  createHud: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.calls.push('createHud');
    hoisted.state.hudHost = host;
    hoisted.state.hudOptions = options;
    const main = {
      id: 'tn-main',
      remove: (): void => {
        hoisted.state.mainRemoved += 1;
      },
    };
    return {
      element: {},
      main,
      menu: {},
      prompt: null,
      focus: (): void => {
        hoisted.state.calls.push('hud.focus');
      },
      setMode: () => undefined,
      setTask: (step: string | null): void => {
        hoisted.state.tasks.push(step);
      },
      setPrompt: (label: string | null): void => {
        hoisted.state.prompts.push(label);
      },
      setHint: (message: string | null): void => {
        hoisted.state.hints.push(message);
      },
      setNotice: (message: string | null): void => {
        hoisted.state.notices.push(message);
      },
      setStorageWarning: () => undefined,
      openMenu: () => undefined,
      closeMenu: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: (): void => {
        hoisted.state.hudDestroyed += 1;
      },
    };
  },
}));

vi.mock('@ui/poi-card', () => ({
  createPoiCard: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['poi-card'] = host;
    hoisted.state.modalOptions['poi-card'] = options;
    return {
      element: {},
      visible: false,
      show: (content: unknown) => hoisted.state.poiShown.push(content),
      hide: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

/*
 * The question card, which is the second half of a landmark.
 *
 * Mocked like every other screen here, and it records the *options* as well as
 * what it was shown: `onAnswer` is the wire this suite drives to prove that an
 * answer reaches `answerQuestion` and the save, which is a composition decision
 * and therefore this file's business.
 */
vi.mock('@ui/question-card', () => ({
  createQuestionCard: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['question-card'] = host;
    hoisted.state.questionHost = host;
    hoisted.state.questionOptions = options;
    return {
      element: {},
      visible: false,
      answered: false,
      present: (question: unknown) => hoisted.state.questionsAsked.push(question),
      hide: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/study-screen', () => ({
  createStudyScreen: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['study-screen'] = host;
    hoisted.state.modalOptions['study-screen'] = options;
    return {
      element: {},
      visible: false,
      state: { kind: 'empty' },
      show: (state: unknown) => hoisted.state.studyShown.push(state),
      setState: (state: unknown) => hoisted.state.studyShown.push(state),
      hide: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      showLeftNotice: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/level-complete', () => ({
  createLevelComplete: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['quest-complete-card'] = host;
    hoisted.state.modalOptions['quest-complete-card'] = options;
    hoisted.state.completeOptions = options;
    return {
      element: {},
      visible: false,
      show: (content: unknown) => hoisted.state.completeShown.push(content),
      hide: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

/*
 * The question bank, at the seam the composition root uses.
 *
 * `createStudySession` is the application-layer use case; mocking it keeps this
 * suite about **wiring** — that the same session reaches Study on the front door
 * and a landmark inside a level, that a drill is asked for when a landmark card
 * closes, and that every answer goes through `answerQuestion` — without
 * downloading 253 real questions to prove a call happened. The session's own
 * behaviour has its own suite.
 */
vi.mock('@application/use-cases/study-session', () => ({
  createStudySession: (): unknown => ({
    drillSize: 5,
    available: async (): Promise<unknown> => {
      hoisted.state.availableCalls += 1;
      return Promise.resolve({ ok: true, value: 12 });
    },
    drill: async (count: number): Promise<unknown> => {
      hoisted.state.drillCalls.push(count);
      return Promise.resolve({
        ok: true,
        value: {
          questions: Array.from({ length: count }, (_unused, index) => ({
            familiarity: 'new',
            question: {
              id: `q-${String(index)}`,
              subject: 'rights',
              prompt: { en: 'Prompt', fr: 'Question' },
              options: [
                { en: 'A', fr: 'A' },
                { en: 'B', fr: 'B' },
                { en: 'C', fr: 'C' },
                { en: 'D', fr: 'D' },
              ],
              correctIndex: 0,
              explanation: { en: 'Because.', fr: 'Parce que.' },
            },
          })),
          shortfall: 0,
        },
      });
    },
  }),
}));

/*
 * `answerQuestion`, recorded rather than run.
 *
 * What this suite asserts about it is that it is *called*, once per answer, with
 * the question the card was showing — the composition decision. Whether the
 * answer is right, what the review record becomes and when a stamp is earned are
 * the use case's own suite's, under the coverage gate.
 */
vi.mock('@application/use-cases/answer-question', async () => {
  /*
   * The real `withStamp`, because the *consequence* of a stamp is what this
   * suite is about: a stamp changes `stampedLevelIds`, which changes
   * `unlockedLevelIds`, which changes the map — and a fake progress value would
   * short-circuit exactly the chain being asserted. Only the judgement is faked.
   */
  const { withStamp } = await import('@domain/entities/progress');
  return {
    answerQuestion: (
      _deps: unknown,
      input: { question: { id: string }; chosenIndex: number; progress: never },
    ): unknown => {
      hoisted.state.recorded.push([input.question.id, input.chosenIndex]);
      hoisted.state.answeredWithQuest.push(
        (input as { quest?: { id: string } }).quest?.id ?? null,
      );
      const earn = hoisted.state.stampFor;
      return {
        ok: true,
        value: {
          progress: earn === null ? input.progress : withStamp(input.progress, earn as never, 1 as never),
          stampEarned: earn !== null,
          /* Whether a **quest** finished, which is a different question from
             whether a stamp was earned: the card's heading follows this one. */
          questCompleted: hoisted.state.questCompletes,
          /*
           * The judgement, because the completion card counts on it: reaching
           * the end of a level earns the stamp whether or not anything was
           * answered, so "how many did you get right here" is the only thing on
           * that card telling a played level from a walked-through one. Driven
           * from the fixture, so a suite can be about a player who answered
           * correctly and a player who did not.
           */
          judgement: { correct: hoisted.state.answersAreCorrect },
        },
      };
    },
  };
});

vi.mock('@ui/level-screens', () => ({
  /*
   * Both screens record the **strings they were handed**, because that is the
   * decision this suite is about: which level's words the composition root
   * looked up. Neither screen may read a copy row itself — one row for four
   * levels is the defect `TN-WAIT-a-level-opens-or-it-does-not.md` was written
   * against — so what bootstrap passes is the whole of the fix.
   */
  createLevelError: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['level-error'] = host;
    hoisted.state.errorTitles.push(String(options['title']));
    return {
      element: {},
      visible: false,
      show: () => {
        hoisted.state.errorShown += 1;
      },
      hide: () => undefined,
      setLocale: (_locale: unknown, title: string) => {
        hoisted.state.errorTitles.push(title);
      },
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
  createLevelLoading: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['level-loading'] = host;
    hoisted.state.loadingStallAfterMs = options['stallAfterMs'] as number | undefined;
    hoisted.state.loadingText.push({
      title: String(options['title']),
      message: String(options['message']),
    });
    return {
      element: {},
      visible: false,
      show: () => {
        hoisted.state.loadingShown += 1;
      },
      hide: () => {
        hoisted.state.loadingHidden += 1;
      },
      offerEscape: () => undefined,
      setLocale: (_locale: unknown, words: { title: string; message: string }) => {
        hoisted.state.loadingText.push(words);
      },
      destroy: () => undefined,
    };
  },
}));

/*
 * The passport, at the seam this suite is about: **where** it is mounted, and
 * what the level does to the pause while it is open. What it draws is
 * `tests/unit/ui/passport.test.ts`'s.
 */
vi.mock('@ui/passport', () => ({
  createPassport: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['passport'] = host;
    hoisted.state.modalOptions['passport'] = options;
    hoisted.state.passports.push({ host, options });
    return {
      element: {},
      visible: false,
      arrivalMessage: '',
      show: () => {
        hoisted.state.passportsShown += 1;
      },
      hide: () => undefined,
      setEntries: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => {
        hoisted.state.passportsDestroyed += 1;
      },
    };
  },
}));

/* NPC dialogue: the quest's whole surface. Recorded rather than rendered, so
   this suite stays about the composition — which quest was offered, what the
   choices did, and whether the level was given back. */
vi.mock('@ui/dialogue', () => ({
  createDialogue: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['dialogue'] = host;
    hoisted.state.dialogueOptions = options;
    return {
      element: {},
      visible: false,
      show: (content: Record<string, unknown>) => hoisted.state.dialoguesShown.push(content),
      hide: () => undefined,
      setSpeaker: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/settings-screen', () => ({
  createSettingsScreen: (host: unknown): unknown => {
    hoisted.state.modalHosts['settings'] = host;
    return {
      element: {},
      visible: false,
      show: () => undefined,
      hide: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/rotate-overlay', () => ({
  createRotateOverlay: () => ({
    element: null,
    visible: false,
    sync: () => 'portrait',
    setVisible: () => undefined,
    destroy: () => undefined,
  }),
}));

/* ------------------------------------------------------------------ fake DOM */

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty: (): void => undefined };
  parentElement: FakeElement | null = null;
  id = '';
  lang = '';
  className = '';
  textContent = '';
  tabIndex = 0;
  hidden = false;

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {}

  get nextElementSibling(): FakeElement | null {
    const siblings = this.parentElement?.children;
    if (siblings === undefined) return null;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  /** `before === null` appends, which is the DOM's own rule. */
  insertBefore<T extends FakeElement>(node: T, before: FakeElement | null): T {
    node.remove();
    node.parentElement = this;
    const at = before === null ? -1 : this.children.indexOf(before);
    if (at === -1) this.children.push(node);
    else this.children.splice(at, 0, node);
    return node;
  }

  remove(): void {
    const siblings = this.parentElement?.children;
    if (siblings === undefined) return;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  *descendants(): Generator<FakeElement> {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }
}

class FakeDocument {
  readonly documentElement = new FakeElement('html', this);
  readonly head = new FakeElement('head', this);
  readonly body = new FakeElement('body', this);
  title = '';

  constructor() {
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    for (const element of this.documentElement.descendants()) {
      if (element.id === id) return element;
    }
    return null;
  }

  /** Only `meta[name="theme-color"]` is ever asked for, and the fake page has none. */
  querySelector(): FakeElement | null {
    return null;
  }
}

const asDocument = (doc: FakeDocument): Document => doc as unknown as Document;

function mountPage(): FakeDocument {
  const doc = new FakeDocument();
  const game = doc.createElement('div');
  game.id = 'game';
  const ui = doc.createElement('div');
  ui.id = 'ui';
  doc.body.append(game, ui);
  return doc;
}

let doc: FakeDocument;

/** Let the boot path's promise chain settle: the save read, then the level load. */
async function flush(): Promise<void> {
  for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
}

/** Import the composition root fresh with a given query string; `main()` runs at module scope. */
async function boot(search: string): Promise<void> {
  hoisted.state.search = search;
  vi.stubGlobal('window', {
    innerWidth: 390,
    innerHeight: 844,
    location: { search },
    addEventListener: (): void => undefined,
  });
  vi.resetModules();
  await import('../../../app/bootstrap/main');
  await flush();
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  hoisted.state.calls = [];
  hoisted.state.loadCalls = [];
  hoisted.state.loadResult = { ok: true, value: undefined };
  hoisted.state.built = [`${START_LEVEL}`, `${EARNED_LEVEL}`];
  hoisted.state.hudOptions = null;
  hoisted.state.hudHost = null;
  hoisted.state.hudDestroyed = 0;
  hoisted.state.mainRemoved = 0;
  hoisted.state.modalHosts = {};
  hoisted.state.modalOptions = {};
  hoisted.state.shellOptions = null;
  hoisted.state.shellHost = null;
  hoisted.state.storageWarning = false;
  hoisted.state.entries = null;
  hoisted.state.level = null;
  hoisted.state.paused = 0;
  hoisted.state.resumed = 0;
  hoisted.state.poiShown = [];
  hoisted.state.errorShown = 0;
  hoisted.state.errorTitles = [];
  hoisted.state.loadingShown = 0;
  hoisted.state.loadingText = [];
  hoisted.state.loadingHidden = 0;
  hoisted.state.loadingStallAfterMs = undefined;
  hoisted.state.autoMove = [];
  hoisted.state.questionsAsked = [];
  hoisted.state.questionHost = null;
  hoisted.state.questionOptions = null;
  hoisted.state.completeShown = [];
  hoisted.state.completeOptions = null;
  hoisted.state.leftTo = [];
  hoisted.state.emit = null;
  hoisted.state.drillCalls = [];
  hoisted.state.availableCalls = 0;
  hoisted.state.recorded = [];
  hoisted.state.prompts = [];
  hoisted.state.hints = [];
  hoisted.state.notices = [];
  hoisted.state.tasks = [];
  hoisted.state.studyShown = [];
  hoisted.state.stampFor = null;
  hoisted.state.answersAreCorrect = true;
  hoisted.state.questCompletes = false;
  hoisted.state.answeredWithQuest = [];
  hoisted.state.passports = [];
  hoisted.state.passportsShown = 0;
  hoisted.state.passportsDestroyed = 0;
  hoisted.state.dialoguesShown = [];
  hoisted.state.dialogueOptions = null;
  hoisted.state.milestone = null;
  hoisted.state.markedComplete = 0;
  hoisted.state.playable = null;
  hoisted.state.scenesBoot = true;
  doc = mountPage();
  vi.stubGlobal('document', asDocument(doc));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const levelState = (): string | undefined => doc.documentElement.dataset['tnLevel'];
const consoleText = (): string => vi.mocked(console.error).mock.calls.flat().join(' ');

interface MapEntryLike {
  readonly number: number;
  readonly id?: string;
  readonly built: boolean;
  readonly unlocked: boolean;
}

const entries = (): readonly MapEntryLike[] => hoisted.state.entries as readonly MapEntryLike[];
const entryFor = (id: string): MapEntryLike | undefined =>
  entries().find((entry) => entry.id === id);

const shellOption = <T>(name: string): T => (hoisted.state.shellOptions?.[name] as T);
const hudOption = <T>(name: string): T => (hoisted.state.hudOptions?.[name] as T);
/** The options one mocked modal was built with, so its callbacks can be driven. */
const modalOption = <T>(name: string): T => (hoisted.state.modalOptions[name] as T);

describe('a cold load opens the front door', () => {
  it('mounts the shell into #ui and starts it on the title screen', async () => {
    await boot('');

    expect(hoisted.state.shellHost, 'the shell belongs in the #ui layer').toBe(
      doc.getElementById('ui'),
    );
    expect(hoisted.state.calls).toContain('shell.start');
    expect(levelState(), 'no level was asked for, so there is no level state').toBeUndefined();
  });

  it('mounts no HUD and no modal until a level has the page', async () => {
    await boot('');

    expect(hoisted.state.hudOptions, 'a page with no level was given a level HUD').toBeNull();
    expect(hoisted.state.modalHosts).toEqual({});
  });

  it('draws no "there is no level to play yet" caption over a build that has two', async () => {
    await boot('');

    /* `app/ui/build-status.ts` is slice 0's sentence and it was true of a page
       with nothing to press. It is not mounted any more, and it must not come
       back: the title screen is what tells a visitor what this build is. */
    expect(doc.getElementById('tn-build-status')).toBeNull();
  });
});

describe('the map is handed data, and the data is computed here', () => {
  it('gives the shell ten entries, in the config order', async () => {
    await boot('');

    expect(entries()).toHaveLength(10);
    expect(entries().map((entry) => entry.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('asks the catalogue what is built and the domain what is unlocked', async () => {
    await boot('');

    /* The level a cold load lands on: a document exists and `initialLevels`
       opens it. */
    expect(
      entryFor(`${START_LEVEL}`),
      `${START_LEVEL} is in unlockRules.initialLevels and the catalogue has it, ` +
        'so its card is the one a cold load can press',
    ).toMatchObject({ built: true, unlocked: true });
    /* The first level the chain charges a stamp for: a document exists and no
       stamp has opened it yet. Built and locked is the pair that proves the two
       sources are read separately — one answer would have made this card agree
       with the level above or with the one below. */
    expect(
      entryFor(`${EARNED_LEVEL}`),
      `${EARNED_LEVEL} is built and unlockRules makes the player earn it, so its ` +
        'card is built and locked. A card that is open here means "unlocked" was ' +
        'answered with the catalogue instead of with the unlock rules',
    ).toMatchObject({ built: true, unlocked: false });
    /* A level the rules name and this build has no document for. */
    expect(
      entryFor(`${UNBUILT_LEVEL}`),
      `unlockRules.order names ${UNBUILT_LEVEL} and the catalogue has no document ` +
        'for it, so its card is neither built nor open',
    ).toMatchObject({ built: false, unlocked: false });
  });

  it('follows the catalogue rather than a list written into the code', async () => {
    hoisted.state.built = [];
    await boot('');

    expect(entries()).toHaveLength(10);
    expect(entries().every((entry) => !entry.built)).toBe(true);
  });

  it('carries the config’s stamp cost, so a locked card can say what opens it', async () => {
    await boot('');
    expect(shellOption<number>('stampsToUnlock')).toBeGreaterThanOrEqual(1);
  });

  it('raises the storage warning when this browser is not saving', async () => {
    /* `node` has no `localStorage`, which is the same state as a browser in
       private mode: `TN-SAVE-05` wants a warning and a game that still plays. */
    await boot('');
    expect(hoisted.state.storageWarning).toBe(true);
  });
});

describe('the settings a level has to obey', () => {
  it('tells the renderer about auto-move at boot, from the save', async () => {
    await boot('');

    /*
     * The wire ADR-0008 is about. `app/ui/settings-screen.ts` has offered this
     * toggle and `GameRenderer.setAutoMove` has existed with **no caller**:
     * a port with an implementation nobody composes looks consumed to a gate
     * that reads import edges, and is dead to a player who needs it.
     */
    expect(hoisted.state.autoMove, 'nothing ever told the renderer about auto-move').not.toEqual(
      [],
    );
  });

  it('follows the toggle while the game is running', async () => {
    await boot('');
    hoisted.state.autoMove = [];

    const store = shellOption<{ set: (key: string, value: unknown) => void }>('store');
    store.set('autoMove', true);

    expect(hoisted.state.autoMove, 'turning auto-move on did not reach the scene').toEqual([true]);
  });
});

describe('opening a level', () => {
  it('detaches the shell before the HUD exists, so the page never has two <main>', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    const enter = hoisted.state.calls.indexOf(`shell.enterLevel:${START_LEVEL}`);
    const hud = hoisted.state.calls.indexOf('createHud');
    expect(
      enter,
      `the shell was never told ${START_LEVEL} had the page`,
    ).toBeGreaterThanOrEqual(0);
    expect(hud, 'no HUD was created').toBeGreaterThanOrEqual(0);
    expect(enter, 'createHud ran before shell.enterLevel: two landmarks on one page').toBeLessThan(
      hud,
    );
  });

  it('puts focus in the level, so it is not left on a control that has gone', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.calls).toContain('hud.focus');
  });

  it('refuses a request for a level this build cannot open, and stays on the map', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${UNBUILT_LEVEL}`);
    await flush();

    expect(
      hoisted.state.loadCalls,
      `${UNBUILT_LEVEL} is locked and this build has no document for it, and it was opened`,
    ).toEqual([]);
    expect(hoisted.state.calls).not.toContain('createHud');
    expect(consoleText()).toContain(`${UNBUILT_LEVEL}`);
  });

  it('reaches "ready" when the level loads', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.loadCalls).toEqual([`${START_LEVEL}`]);
    expect(levelState()).toBe('ready');
  });

  it('shows the waiting screen, in this level\u2019s words, and takes it away when the level opens', async () => {
    /*
     * `OQ-WAIT-1`: `createLevelLoading` had **no caller under `app/`**. It was
     * built, scanned by axe and covered by its own suite, and no player had ever
     * seen a waiting sentence — a level opened straight into a canvas or into
     * the error card, which left `TN-LEVEL-01`'s "text, not only a spinner"
     * unmet on the shipped page while passing in the harness.
     *
     * So this asserts the wire, and the words: the sentence is
     * `level.<id>.loading` for the level being opened, not one row four levels
     * shared, and the screen is gone once the level is playable rather than left
     * on the page behind it.
     */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.loadingShown, 'no waiting screen was ever shown').toBe(1);
    expect(hoisted.state.loadingText[0]).toEqual({
      title: text('en', `level.${START_LEVEL}.title` as Parameters<typeof text>[1]),
      message: text('en', `level.${START_LEVEL}.loading` as Parameters<typeof text>[1]),
    });
    expect(hoisted.state.loadingHidden, 'the waiting screen outlived the load').toBe(1);
  });

  it('reads the waiting sentence into the live region, once', async () => {
    /*
     * `TN-WAIT-05` and `TN-HALIFAX-03`: "when a level starts loading,
     * #tn-live-region reads that level's waiting sentence", and it is not
     * repeated while the load continues. The canvas is `aria-hidden`, so a
     * screen swapped in silently is a screen a screen-reader user never learns
     * about — mounting the waiting screen without this would have made it
     * visible to everybody except the players it matters most to.
     */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();
    /* The region clears first and writes on a later task, so a screen reader
       hears a change rather than an insertion (`app/ui/live-region.ts`). */
    await vi.advanceTimersByTimeAsync(1_000);

    expect(doc.getElementById('tn-live-region')?.textContent).toContain(
      text('en', `level.${START_LEVEL}.loading` as Parameters<typeof text>[1]),
    );
  });

  it('times the way out from the config\u2019s time-to-play budget, doubled', async () => {
    /* `TN-LEVEL-02` and `TN-WAIT-04`: the escape appears after twice the budget
       CI measures against, so the two numbers cannot drift apart. */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.loadingStallAfterMs).toBe(parsedRules.value.timeToPlayMs * 2);
  });

  it('hands both level screens the new language\u2019s strings for the same level', async () => {
    /* `TN-WAIT-06` and `TN-HALIFAX-04`: changing language without leaving the
       level. Neither screen can look its row up — the row is keyed on a level id
       neither of them knows — so the composition root re-resolves both. */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    const store = shellOption<{ set: (key: string, value: unknown) => void }>('store');
    store.set('locale', 'fr');

    expect(hoisted.state.loadingText.at(-1)).toEqual({
      title: text('fr', `level.${START_LEVEL}.title` as Parameters<typeof text>[1]),
      message: text('fr', `level.${START_LEVEL}.loading` as Parameters<typeof text>[1]),
    });
    expect(hoisted.state.errorTitles.at(-1)).toBe(
      text('fr', `level.${START_LEVEL}.error.title` as Parameters<typeof text>[1]),
    );
  });
});

describe('the ?level= deep link still works, and now leads back to the map', () => {
  it('goes straight into the level, without the title screen', async () => {
    /*
     * Deep-linked to the level the map keeps **shut**, which is the claim
     * `OQ-FLOW-3` makes: the parameter bypasses the map, so it answers for a
     * level `onPlayLevel` would refuse. Using the level a cold load already
     * opens would have proved only that a link to the front door works.
     */
    await boot(`?level=${EARNED_LEVEL}`);

    expect(hoisted.state.calls).not.toContain('shell.start');
    expect(hoisted.state.calls).toContain(`shell.enterLevel:${EARNED_LEVEL}`);
    expect(
      hoisted.state.loadCalls,
      `?level=${EARNED_LEVEL} is a deep link into a level the map has not opened yet, ` +
        'and it is meant to open anyway',
    ).toEqual([`${EARNED_LEVEL}`]);
    expect(levelState()).toBe('ready');
  });

  it('treats an empty ?level= as no level at all', async () => {
    await boot('?level=');

    expect(hoisted.state.loadCalls).toEqual([]);
    expect(hoisted.state.calls).toContain('shell.start');
  });

  it('is "failed" when the level does not arrive, with the reason on the console', async () => {
    hoisted.state.loadResult = {
      ok: false,
      error: { kind: 'not-found', code: 'content.level.missing', message: 'no such level.' },
    };
    await boot(`?level=${START_LEVEL}`);

    expect(levelState()).toBe('failed');
    expect(hoisted.state.errorShown, 'no error card was shown').toBe(1);
    /* The waiting screen went before the card arrived: two dialogs over one
       level is a state no story describes (`TN-WAIT-02`, "level-loading is
       gone"). */
    expect(hoisted.state.loadingHidden).toBeGreaterThanOrEqual(1);
    /*
     * The id is on the console and NOT in the announcement. A level id is
     * developer vocabulary and this file may not author player-facing copy
     * (ADR-0010), so the failure goes on the bus and `app/ui` says what a player
     * hears — `level.<id>.error.title`, from the copy table, in their language.
     */
    expect(consoleText()).toContain(`${START_LEVEL}`);
    expect(
      hoisted.state.errorTitles[0],
      'the error card was built with a title that is not this level\u2019s',
    ).toBe(text('en', `level.${START_LEVEL}.error.title` as Parameters<typeof text>[1]));
  });

  it('takes a deep link to a level this build has no words for to the map', async () => {
    /*
     * `TN-FLOW-05`: "a deep link to a level that does not exist … no Try again is
     * offered for something that cannot succeed … the player is taken to, or
     * offered, the level select … nothing on the screen blames the player".
     *
     * This route used to open the level anyway and show the error card, whose
     * title was one row called `level.error.title` reading "We could not load
     * Ottawa." — so a mistyped address was answered by naming a place chosen by
     * which level had a story first. There is no title to draw for a level no
     * document declares, and inventing one would be `app/bootstrap` authoring
     * copy (ADR-0010). So the player is taken to a screen they can act on, and
     * the id goes where developer vocabulary goes.
     */
    await boot('?level=atlantis');

    expect(hoisted.state.loadCalls, 'a level with no document was opened').toEqual([]);
    expect(hoisted.state.calls).not.toContain('createHud');
    expect(hoisted.state.errorShown, 'a Try again was offered for something that cannot succeed').toBe(
      0,
    );
    expect(levelState(), 'the page claims a level is open').toBeUndefined();
    expect(consoleText()).toContain('atlantis');
  });
});

describe('the page has one <main>, and every modal is inside it (TN-HUD-07)', () => {
  it('hands the canvas host to the HUD, so <main> holds what the page is for', async () => {
    await boot(`?level=${START_LEVEL}`);

    expect(
      hoisted.state.hudOptions?.['canvasHost'],
      'the HUD was mounted without the canvas host, so <main> is a wrapper invented ' +
        'to satisfy a scanner rather than the content of the page',
    ).toBe(doc.getElementById('game'));
    expect(hoisted.state.hudHost, 'the HUD belongs in the #ui layer').toBe(
      doc.getElementById('ui'),
    );
  });

  it('mounts every modal opened over a level into hud.main, never beside it', async () => {
    await boot(`?level=${START_LEVEL}`);
    /* The settings screen is opened from the level's menu, so it is built on
       demand rather than at boot; opening it is what puts it on the page. */
    hudOption<() => void>('onOpenSettings')();

    /* A `dialog` is not a landmark. A modal mounted beside `<main>` puts its
       content outside every landmark, and axe's `region` rule is right to
       complain — the fix is the page, not the rule. */
    for (const [what, host] of Object.entries(hoisted.state.modalHosts)) {
      expect((host as { id?: string }).id, `${what} was mounted outside <main>`).toBe('tn-main');
    }
    expect(Object.keys(hoisted.state.modalHosts).sort()).toEqual([
      'level-error',
      'level-loading',
      'poi-card',
      /* The completion card and the question card are built with the level, not
         on demand, because a landmark's question must not wait on a screen being
         constructed after the player has already read the fact. */
      'quest-complete-card',
      'question-card',
      'settings',
    ]);
  });
});

/* ------------------------------------------------------------ the learning loop */

/** A level document, as the scene hands it back once it has loaded. */
const LOADED_LEVEL = {
  title: { en: 'Halifax', fr: 'Halifax' },
  locomotion: [{ labelKey: 'locomotion.walk.label' }],
  pois: [
    {
      id: 'town-clock',
      name: { en: 'Halifax Town Clock', fr: "Tour de l'horloge d'Halifax" },
      blurb: { en: 'A true, short thing.', fr: 'Une chose vraie et courte.' },
    },
  ],
  /* Every level document has one, empty or not, and the prompt is built from
     both lists: a character is a person and a point of interest is a place. */
  characters: [],
};

const emit = (name: string, detail?: string): void => {
  const sink = hoisted.state.emit;
  if (sink === null) throw new Error('the renderer was never handed an event sink');
  sink(name, detail);
};

/**
 * The scene's milestone channel, driven at the seam the composition root wires.
 *
 * `level/exitReached` is the engine's half of "once you reach the end of a level
 * it should send you to a new level": the scene watches the geometry and says
 * the player has arrived. Everything after it is this file's.
 */
const reachEnd = (detail: string = `${START_LEVEL}`): void => {
  const sink = hoisted.state.milestone;
  if (sink === null) throw new Error('the renderer was never handed a milestone sink');
  sink('level/exitReached', detail);
};

describe('a landmark teaches, then asks (TN-LEVEL-05, TN-CARD-01)', () => {
  const arrive = async (): Promise<void> => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
  };

  it('says what choosing it will do, and never what the landmark is called', async () => {
    await arrive();
    emit('poi/entered', 'town-clock');

    /*
     * `TN-REACH-01` and `TN-REACH-02`, and the defect they were written for.
     *
     * This used to draw the **level document's** name for the landmark — the
     * fixture's "Halifax Town Clock", and in the shipped game "CN Tower" — which
     * is wrong twice over: a noun says what is *there* rather than what choosing
     * it does, and `TN-NAMES-04` fails the build for a name from its list drawn
     * by the HUD. It got past that check because the name was never a copy
     * string; it was content interpolated at runtime, right here.
     *
     * Halifax writes no row of its own for this landmark, so the generic row is
     * the answer — which is the rule working, not a shortfall.
     */
    expect(hoisted.state.prompts).toEqual([text('en', 'hud.interact.poi')]);
    expect(hoisted.state.prompts.join(' ')).not.toContain('Halifax Town Clock');
  });

  it('draws the level’s own row where the level wrote one', async () => {
    /* `TN-REACH`'s second rule: a level with something better to say says it.
       Ottawa writes "Look at Parliament Hill" because that landmark is not on
       `TN-NAMES`'s list and the row is in that level's story. */
    hoisted.state.level = {
      ...LOADED_LEVEL,
      pois: [
        {
          id: 'parliament-hill',
          name: { en: 'Parliament Hill', fr: 'La Colline du Parlement' },
          blurb: { en: 'A true, short thing.', fr: 'Une chose vraie et courte.' },
        },
      ],
    };
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
    emit('poi/entered', 'parliament-hill');

    expect(hoisted.state.prompts).toEqual([text('en', 'hud.interact.parliament-hill')]);
  });

  it('says a landmark has been done once it has, rather than inviting it again', async () => {
    /* `TN-REACH-03`: done beats the level's own row and beats the kind. The
       state is the news; the invitation is not. */
    await arrive();
    emit('poi/engaged', 'town-clock');
    emit('poi/entered', 'town-clock');

    expect(hoisted.state.prompts.at(-1)).toBe(text('en', 'hud.interact.done'));
  });

  it('shows the one-time hint the first time something is in reach, and only once', async () => {
    /*
     * `TN-REACH-04`. The marks in the world are the one affordance a player
     * cannot be told about anywhere else, and the hint names no input — not
     * "tap", not a key, not "hold" — because the game is played with a thumb, a
     * keyboard and one switch.
     */
    await arrive();
    emit('poi/entered', 'town-clock');
    expect(hoisted.state.hints).toEqual([text('en', 'hud.interact.hint')]);

    emit('poi/left', 'town-clock');
    emit('poi/entered', 'town-clock');
    expect(hoisted.state.hints, 'the hint became a nag').toEqual([
      text('en', 'hud.interact.hint'),
    ]);

    /* It goes as soon as anything is engaged, and does not come back. */
    emit('poi/engaged', 'town-clock');
    expect(hoisted.state.hints.at(-1)).toBeNull();
  });

  it('withdraws the offer when the landmark goes out of reach', async () => {
    await arrive();
    emit('poi/entered', 'town-clock');
    emit('poi/left', 'town-clock');
    expect(hoisted.state.prompts).toEqual([text('en', 'hud.interact.poi'), null]);
  });

  it('offers nothing for a landmark the level does not declare', async () => {
    await arrive();
    emit('poi/entered', 'a-landmark-nobody-authored');
    expect(hoisted.state.prompts).toEqual([]);
  });

  it('tapping the prompt engages the same landmark tapping the canvas does', async () => {
    await arrive();
    emit('poi/entered', 'town-clock');
    hudOption<() => void>('onInteract')();

    expect(hoisted.state.poiShown).toEqual([
      { title: 'Halifax Town Clock', body: ['A true, short thing.'] },
    ]);
  });

  it('shows the landmark card, then asks one question about it', async () => {
    await arrive();
    emit('poi/engaged', 'town-clock');

    expect(hoisted.state.poiShown, 'the landmark taught nothing').toEqual([
      { title: 'Halifax Town Clock', body: ['A true, short thing.'] },
    ]);
    expect(hoisted.state.questionsAsked, 'a question arrived before the card was read').toEqual([]);

    /* Closing the card is what asks. The chain is one hold on the level, so the
       game never moves between the two dialogs. */
    modalOption<{ onClose: () => void }>('poi-card').onClose();
    await flush();

    expect(hoisted.state.drillCalls, 'a landmark asks exactly one question').toEqual([1]);
    expect(hoisted.state.questionsAsked).toHaveLength(1);
    expect(hoisted.state.questionsAsked[0]).toMatchObject({
      index: 0,
      total: 1,
      kind: 'new',
      prompt: 'Prompt',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Because.',
    });
  });

  it('records the answer through answerQuestion, and only once', async () => {
    await arrive();
    emit('poi/engaged', 'town-clock');
    modalOption<{ onClose: () => void }>('poi-card').onClose();
    await flush();

    const card = hoisted.state.questionOptions as { onAnswer: (index: number, right: boolean) => void };
    card.onAnswer(0, true);

    expect(hoisted.state.recorded).toEqual([['q-0', 0]]);
  });

  it('opens no question when the level never loaded, and does not fail loudly', async () => {
    hoisted.state.level = null;
    await boot(`?level=${START_LEVEL}`);
    emit('poi/engaged', 'town-clock');
    await flush();

    expect(hoisted.state.poiShown).toEqual([]);
    expect(hoisted.state.questionsAsked).toEqual([]);
  });

  it('opens nothing for a landmark the level does not declare', async () => {
    await arrive();
    emit('poi/engaged', 'a-landmark-nobody-authored');
    await flush();

    expect(hoisted.state.poiShown).toEqual([]);
    expect(hoisted.state.questionsAsked).toEqual([]);
  });
});

describe('finishing a level says so, and leads to the next one', () => {
  /** Play the whole loop once, with the answer earning this level's stamp. */
  const finishTheLevel = async (): Promise<void> => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
    hoisted.state.stampFor = `${START_LEVEL}`;

    emit('poi/engaged', 'town-clock');
    modalOption<{ onClose: () => void }>('poi-card').onClose();
    await flush();

    const card = hoisted.state.questionOptions as {
      onAnswer: (index: number, right: boolean) => void;
      onNext: () => void;
    };
    card.onAnswer(0, true);
    /* The completion card waits for the question to be *done*: it must not open
       over the explanation the player is still reading. */
    expect(hoisted.state.completeShown, 'the card opened over the explanation').toEqual([]);
    card.onNext();
    await flush();
  };

  it('shows the completion card once the question is done, not during it', async () => {
    await finishTheLevel();
    expect(hoisted.state.completeShown).toHaveLength(1);
  });

  it('names the stamp only when this build has a row for this level', async () => {
    await finishTheLevel();
    /* The card is shown a **resolver**, so the player can change language with it
       open and every sentence is looked up again. */
    const resolve = hoisted.state.completeShown[0] as (locale: string) => {
      stampMessage?: string;
    };
    const key = `stamp.${String(START_LEVEL)}.earned`;
    if (hasCopyRow(key)) {
      expect(resolve('en').stampMessage).toBe(text('en', key));
      /* Every built level has its own row now (`TN-DONE-03`), and the French
         takes three different forms after « tampon » across the four — which is
         the whole reason they are four rows and not one template. */
      expect(resolve('fr').stampMessage).toBe(text('fr', key));
      expect(resolve('fr').stampMessage).not.toContain('timbre');
    } else {
      expect(
        resolve('en').stampMessage,
        `this build has no ${key}, so the card must draw no stamp line rather than ` +
          'name another place or print a placeholder',
      ).toBeUndefined();
    }
  });

  it('lands the player on the level that just opened, not the one they finished', async () => {
    await finishTheLevel();

    /* The card's primary action is the map. It leaves through the composition
       root, which recomputes the unlock rule and names the new card. */
    modalOption<{ onChooseLevel: () => void }>('quest-complete-card').onChooseLevel();
    await flush();

    expect(hoisted.state.calls).toContain('shell.leaveLevel');
    expect(hoisted.state.leftTo.at(-1)).toEqual({ focusLevelId: EARNED_LEVEL });
  });

  it('lands them back where they were when nothing opened', async () => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(
      hoisted.state.leftTo.at(-1),
      'a level that opened nothing must not send the player somewhere new',
    ).toEqual({});
  });

  it('says the next level is open, even when the player leaves by the menu', async () => {
    await finishTheLevel();
    /* Not through the completion card: `Keep playing`, then the menu. The news
       is a fact about the save, so the route out cannot change it. */
    modalOption<{ onKeepPlaying: () => void }>('quest-complete-card').onKeepPlaying();
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.leftTo.at(-1)).toEqual({ focusLevelId: EARNED_LEVEL });
  });
});

describe('"ready" means the player can touch it', () => {
  /**
   * `loadLevel` resolving and the level becoming playable are two moments, and
   * for a while the page announced the first one.
   *
   * Phaser is handed the scene when the promise settles and boots it one or more
   * frames later; the camera, the affordances and — since the dropped-first-key
   * fix — the keyboard keys themselves are all created in `create`. So the page
   * said "ready", the waiting screen came down, and a key pressed in that window
   * reached a scene that did not exist. Measured with a 1.5 s delay on the
   * level's textures, it was lost two runs in three.
   */
  it('waits for the scene to boot before saying so', async () => {
    /* A level whose scene never comes up: the document parsed, Phaser has it,
       and `create` has not run. */
    hoisted.state.scenesBoot = false;
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);

    expect(
      levelState(),
      'the page called a level ready while its scene had not been built, so the first ' +
        'thing the player does — press a key — reaches nothing',
    ).toBe('loading');
    expect(
      hoisted.state.loadingHidden,
      'and the waiting screen came down over a level nobody can touch (TN-WAIT-01)',
    ).toBe(0);
  });

  it('says so, and takes the waiting screen down, once it has', async () => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);

    expect(levelState()).toBe('ready');
    expect(hoisted.state.loadingHidden).toBe(1);
  });

  it('stops listening when the level is left, so a late scene reaches nobody', async () => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    /* A scene booting into a level that has already been left would otherwise
       write `ready` over a page that is showing the map. */
    hoisted.state.playable?.(`${START_LEVEL}`);
    expect(levelState()).toBeUndefined();
  });
});

describe('reaching the end of a level finishes it and offers the next one', () => {
  /**
   * Walk to the end of the world, having answered nothing.
   *
   * The whole point of the scenario: `level/exitReached` is a **position**, and
   * a player can reach it without engaging a single landmark. It still finishes
   * the level, because that is the product decision — the points of interest are
   * where the learning happens and the end of the world is the finish line — and
   * the card is what has to be honest about it.
   */
  const walkToTheEnd = async (): Promise<void> => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
    reachEnd();
    await flush();
  };

  it('earns the stamp, so the next level is really open on the map', async () => {
    await walkToTheEnd();
    /* The map is rebuilt on the way out — `setEntries` replaces every card, so
       it is done while no list is on screen (`TN-FLOW-03`). This is what the
       player actually finds there. */
    modalOption<{ onKeepPlaying: () => void }>('quest-complete-card').onKeepPlaying();
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    const entries = hoisted.state.entries as {
      id?: LevelId;
      unlocked: boolean;
      stamped?: boolean;
    }[];
    expect(
      entries.find((entry) => entry.id === START_LEVEL)?.stamped,
      `walking to the end of ${String(START_LEVEL)} must put its stamp in the passport`,
    ).toBe(true);
    expect(
      entries.find((entry) => entry.id === EARNED_LEVEL)?.unlocked,
      `and that stamp is what opens ${String(EARNED_LEVEL)}: nothing else in the game ` +
        'writes one',
    ).toBe(true);
  });

  it('tells the world the level is over, so nothing in it keeps asking to be done', async () => {
    await walkToTheEnd();
    expect(
      hoisted.state.markedComplete,
      'markLevelComplete had no caller anywhere in the app, so every affordance in a ' +
        'finished level went on pulsing at a player who had already been given credit',
    ).toBe(1);
  });

  it('draws the completion card', async () => {
    await walkToTheEnd();
    expect(hoisted.state.completeShown).toHaveLength(1);
  });

  it('says plainly that nothing was answered, and never scores it', async () => {
    await walkToTheEnd();
    const resolve = hoisted.state.completeShown[0] as (locale: string) => {
      progressMessage?: string;
      reason?: string;
    };

    /*
     * `TN-DONE-02`. Silence was the honest answer while nothing was written; it
     * is not the same as saying so, and a player who walked past every landmark
     * should be told plainly that they did while there is still a way back. The
     * sentence carries no number — a total of zero is what it *is* — so the card
     * can never read "0 out of 0", and no word in it marks the player down.
     */
    expect(resolve('en').progressMessage).toBe(text('en', 'level.complete.none'));
    expect(resolve('fr').progressMessage).toBe(text('fr', 'level.complete.none'));
    expect(/\d/u.test(resolve('en').progressMessage ?? '')).toBe(false);

    /* And the heading is the level's, not the quest's: no task was accepted, so
       "Task done!" would be a claim about something that never happened. */
    expect(resolve('en').reason).toBe('level');
  });

  it('scores the questions the player did answer, at this level’s landmarks', async () => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');

    /* One landmark, one question, answered wrongly: the count is what the
       player did, not what they got right. */
    hoisted.state.answersAreCorrect = false;
    emit('poi/engaged', 'town-clock');
    modalOption<{ onClose: () => void }>('poi-card').onClose();
    await flush();
    const question = hoisted.state.questionOptions as {
      onAnswer: (index: number, right: boolean) => void;
      onNext: () => void;
    };
    question.onAnswer(1, false);
    question.onNext();
    await flush();

    reachEnd();
    await flush();

    const resolve = hoisted.state.completeShown[0] as (locale: string) => {
      progressMessage?: string;
    };
    /* The card owns its own score row rather than borrowing Study's
       (`TN-DONE`, `OQ-DONE-2`): the two screens count different sets and must be
       free to be reworded apart. */
    expect(resolve('en').progressMessage).toBe(
      text('en', 'level.complete.score', { correct: 0, total: 1 }),
    );
    expect(resolve('fr').progressMessage).toBe(
      text('fr', 'level.complete.score', { correct: 0, total: 1 }),
    );
  });

  it('names the level that just opened in the map’s own words, in either language', async () => {
    await walkToTheEnd();
    const resolve = hoisted.state.completeShown[0] as (locale: string) => {
      next?: { label: string; description: string };
    };

    const next = resolve('en').next;
    expect(
      next?.label,
      `the route into ${String(EARNED_LEVEL)} is labelled with that level's own ` +
        'level.<id>.play row: a label that says what pressing does, written out per ' +
        'level because French takes « à » for three of the four and « dans la » for ' +
        'the fourth',
    ).toBe(text('en', `level.${String(EARNED_LEVEL)}.play` as never));
    expect(resolve('fr').next?.label).toBe(
      text('fr', `level.${String(EARNED_LEVEL)}.play` as never),
    );
    /* Three rows the map already draws, joined — never a fourth sentence. */
    expect(next?.description).toContain(text('en', 'map.state.open'));
    expect(next?.description).toContain(text('en', 'map.open.help'));

    expect(resolve('fr').next?.description).toContain(text('fr', 'map.open.help'));
  });

  it('draws one card however many times the player walks over the end', async () => {
    await walkToTheEnd();
    reachEnd();
    reachEnd();
    await flush();

    expect(
      hoisted.state.completeShown,
      'a quest finished twice is one stamp and one unlock; a level finished twice is ' +
        'one card',
    ).toHaveLength(1);
    expect(hoisted.state.markedComplete).toBe(1);
  });

  it('ignores a milestone that names another level', async () => {
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
    reachEnd(`${UNBUILT_LEVEL}`);
    await flush();

    expect(
      hoisted.state.completeShown,
      'one bus, one open level: a milestone for somewhere else cannot be about this one',
    ).toEqual([]);
    expect(hoisted.state.markedComplete).toBe(0);
  });

  it('goes straight into the level that just opened when the player asks for it', async () => {
    await walkToTheEnd();
    modalOption<{ onPlayNext: () => void }>('quest-complete-card').onPlayNext();
    await flush();

    /* Out of one level and into the next, without the map in between. */
    expect(hoisted.state.calls).toContain(`shell.enterLevel:${String(EARNED_LEVEL)}`);
    expect(hoisted.state.loadCalls.at(-1)).toBe(`${EARNED_LEVEL}`);
    expect(
      hoisted.state.calls.filter((call) => call === 'shell.leaveLevel'),
      'the map is offered on the same card; it is not a screen the player is made to ' +
        'pass through',
    ).toEqual([]);
  });

  it('leaves the new level back to the map, so back still goes one step up', async () => {
    await walkToTheEnd();
    modalOption<{ onPlayNext: () => void }>('quest-complete-card').onPlayNext();
    await flush();
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.calls).toContain('shell.leaveLevel');
  });

  it('still offers the map, and lands on the card that just opened', async () => {
    await walkToTheEnd();
    modalOption<{ onChooseLevel: () => void }>('quest-complete-card').onChooseLevel();
    await flush();

    expect(hoisted.state.leftTo.at(-1)).toEqual({ focusLevelId: EARNED_LEVEL });
  });

  it('does not leave the level frozen when the card is closed', async () => {
    await walkToTheEnd();
    const pausedWithCardUp = hoisted.state.paused;
    modalOption<{ onKeepPlaying: () => void }>('quest-complete-card').onKeepPlaying();
    await flush();

    /*
     * The menu did exactly this once: it took a hold and never let go, and the
     * level behind it stopped and would not start. A completion card is another
     * dialog over a live scene.
     */
    expect(pausedWithCardUp).toBeGreaterThan(0);
    expect(hoisted.state.resumed, 'the level was left paused behind a card that has gone')
      .toBeGreaterThan(0);
  });

  it('offers no route into a level that is finished but opened nothing', async () => {
    /* Every level in the chain already stamped: finishing one again opens
       nothing, and the card must not claim otherwise. */
    hoisted.state.level = LOADED_LEVEL;
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
    reachEnd();
    await flush();
    modalOption<{ onKeepPlaying: () => void }>('quest-complete-card').onKeepPlaying();
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    /* Back in, and finish it a second time. The stamp is already in the save. */
    hoisted.state.completeShown = [];
    shellOption<(id: LevelId) => void>('onPlayLevel')(START_LEVEL);
    await flush();
    emit('level/ready');
    reachEnd();
    await flush();

    const resolve = hoisted.state.completeShown[0] as (locale: string) => {
      next?: unknown;
    };
    expect(
      resolve('en').next,
      'nothing opened this time, so there is no news to announce and no route to offer',
    ).toBeUndefined();
  });
});

describe('Study is mounted, on the front door and inside a level', () => {
  it('offers Study from the title screen, over the one session', async () => {
    await boot('');
    expect(
      shellOption<unknown>('onOpenStudy'),
      'the shell hides an absent option rather than drawing a dead control, so an ' +
        'absent onOpenStudy is a game with no Study in it',
    ).toBeTypeOf('function');
  });

  it('offers Study from the level menu', async () => {
    await boot(`?level=${START_LEVEL}`);
    expect(hudOption<unknown>('onOpenStudy')).toBeTypeOf('function');
  });

  it('asks the bank when Study opens, not at boot', async () => {
    await boot('');
    expect(hoisted.state.availableCalls, 'a cold load downloaded the question bank').toBe(0);

    shellOption<() => void>('onOpenStudy')();
    await flush();
    expect(hoisted.state.availableCalls).toBe(1);
  });
});

describe('leaving a level', () => {
  it('takes the HUD’s landmark away and puts the canvas back where it was', async () => {
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.hudDestroyed, 'the HUD outlived the level').toBe(1);
    expect(
      hoisted.state.mainRemoved,
      'the HUD’s <main> was left on the page behind the map, which is a second landmark',
    ).toBe(1);
    /* Back under `body`, before `#ui`, exactly where `index.html` put it — not
       appended, which would change its paint order against the DOM layer. */
    expect(doc.body.children.map((child) => child.id)).toEqual(['game', 'ui']);
  });

  it('hands the page back to the shell and clears the level state', async () => {
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.calls).toContain('shell.leaveLevel');
    expect(levelState(), 'the page still claims a level is open').toBeUndefined();
  });

  it('re-reads the map, so a stamp earned in the level opens the next card', async () => {
    await boot(`?level=${START_LEVEL}`);
    hoisted.state.entries = null;
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(entries(), 'the map was not redrawn on the way out').toHaveLength(10);
  });
});

/* ------------------------------------------------------------------ the passport */

/**
 * `docs/stories/TN-PASSPORT-01`: where the passport lives, and how a player
 * reaches it.
 *
 * Two routes, and one deliberate absence. The map is its home, because the stamp
 * count is already drawn there; the level's menu is the other, for a player who
 * is inside a level. The title screen offers none — `OQ-TITLE-2` keeps progress
 * off the first screen and `TN-PASSPORT` agrees.
 */
describe('the passport is reachable, and gives the level back', () => {
  it('is offered on the map, mounted inside the shell’s own main', async () => {
    await boot('');
    shellOption<() => void>('onOpenPassport')();

    expect(hoisted.state.passportsShown).toBe(1);
    /* A `dialog` is not a landmark: a modal mounted beside `<main>` puts its
       content outside every landmark and axe's `region` rule is right to say
       so. */
    expect((hoisted.state.modalHosts['passport'] as { id?: string }).id).toBe('tn-shell');
  });

  it('stands the shell’s switch ring down while it is open, and back up after', async () => {
    await boot('');
    shellOption<() => void>('onOpenPassport')();
    expect(hoisted.state.calls).toContain('shell.setModalOpen:true');

    modalOption<{ onBack: () => void }>('passport').onBack();
    expect(hoisted.state.calls).toContain('shell.setModalOpen:false');
  });

  it('is offered in the level’s menu, mounted inside the level’s main', async () => {
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onOpenPassport')();

    expect(hoisted.state.passportsShown).toBe(1);
    expect((hoisted.state.modalHosts['passport'] as { id?: string }).id).toBe('tn-main');
  });

  it('pauses the level while it is open and resumes it on the way out', async () => {
    /*
     * The trap the menu taught this file, and the one this task was warned
     * about: whoever takes the level has to give it back on every path out. The
     * menu hands over without releasing its own hold, so a screen opened from it
     * takes its own reason and releases that one — otherwise `data-tn-paused`
     * stays `true` and nothing on screen says why.
     */
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onPause')();
    hudOption<() => void>('onOpenPassport')();
    expect(levelState()).toBeDefined();
    expect(doc.documentElement.dataset['tnPaused']).toBe('true');

    modalOption<{ onBack: () => void }>('passport').onBack();
    expect(
      doc.documentElement.dataset['tnPaused'],
      'the level was left frozen behind a passport that has gone',
    ).toBe('false');
  });

  it('is offered on the card where the stamp was just earned', async () => {
    /* `TN-QUEST-04` and `TN-PASSPORT-01` both assert it; `OQ-DONE-5` records the
       disagreement about whether it belongs there. */
    await boot(`?level=${START_LEVEL}`);
    emit('level/ready');
    reachEnd();
    await flush();

    modalOption<{ onOpenPassport: () => void }>('quest-complete-card').onOpenPassport();
    expect(hoisted.state.passportsShown).toBe(1);
  });

  it('does not travel into a level on a main that has been detached', async () => {
    /*
     * The shell's `<main>` is removed when a level takes the page. A modal left
     * inside it would go with it — still `aria-modal`, still holding the rest of
     * the page inert — which is a screen that has been left being hidden rather
     * than removed (`TN-FLOW-08`).
     */
    await boot('');
    shellOption<() => void>('onOpenPassport')();
    shellOption<(id: LevelId) => void>('onPlayLevel')(START_LEVEL);
    await flush();

    expect(hoisted.state.passportsDestroyed).toBeGreaterThan(0);
  });

  it('draws it again from the save, so a stamp earned since is in it', async () => {
    await boot('');
    shellOption<() => void>('onOpenPassport')();
    modalOption<{ onBack: () => void }>('passport').onBack();
    shellOption<() => void>('onOpenPassport')();

    expect(hoisted.state.passports).toHaveLength(2);
    expect(hoisted.state.passports[1]?.options['entries']).toHaveLength(10);
  });
});

/* --------------------------------------------------------------------- the quest */

/**
 * `docs/stories/TN-QUEST-parliament-hill.md`, from the offer to the stamp.
 *
 * The quest documents are the real ones: `content/quests/*.json`, read through
 * the same glob the deploy uses. What is faked is the dialogue, so the
 * assertions are about the **composition** — which quest was offered, what the
 * two choices did to the save, and whether the level was given back.
 */
describe('a quest is offered, accepted and tracked', () => {
  const OTTAWA_LEVEL = {
    title: { en: 'Ottawa', fr: 'Ottawa' },
    locomotion: [{ labelKey: 'locomotion.skate.label' }],
    pois: [
      {
        id: 'parliament-hill',
        name: { en: 'Parliament Hill', fr: 'La Colline du Parlement' },
        blurb: { en: 'A true, short thing.', fr: 'Une chose vraie et courte.' },
      },
    ],
    characters: [{ characterId: 'officer' }],
  };

  const arriveInOttawa = async (): Promise<void> => {
    hoisted.state.level = OTTAWA_LEVEL;
    await boot('?level=ottawa');
    emit('level/ready');
  };

  it('offers the quest when the player engages its giver', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');

    expect(hoisted.state.dialoguesShown, 'the officer said nothing').toHaveLength(1);
    const offer = hoisted.state.dialoguesShown[0] as {
      lines: string[];
      accept?: { label: string };
      decline?: { label: string };
    };
    /* The lines are the quest document's — content, under ADR-0010 — and the two
       choices are copy rows, because they are the same in every quest. */
    expect(offer.lines.length).toBeGreaterThan(0);
    expect(offer.accept?.label).toBe(text('en', 'quest.accept'));
    expect(offer.decline?.label).toBe(text('en', 'quest.decline'));
  });

  it('names the dialog after the character, never "Speaker" or nothing', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');
    expect(hoisted.state.dialogueOptions?.['speakerName']).toBe(text('en', 'npc.officer.name'));
  });

  it('holds the level while the officer is talking and gives it back on accept', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');
    expect(doc.documentElement.dataset['tnPaused']).toBe('true');

    const offer = hoisted.state.dialoguesShown[0] as { accept: { onSelect: () => void } };
    offer.accept.onSelect();
    expect(
      doc.documentElement.dataset['tnPaused'],
      'the level was left frozen behind a dialogue that has gone',
    ).toBe('false');
  });

  it('gives it back when the player declines, and when they just leave', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');
    (hoisted.state.dialoguesShown[0] as { decline: { onSelect: () => void } }).decline.onSelect();
    expect(doc.documentElement.dataset['tnPaused']).toBe('false');

    /* Leaving without choosing is not a decline (`TN-QUEST-03`) — and it is the
       path most likely to be forgotten, because nobody pressed anything. */
    emit('npc/engaged', 'officer');
    expect(doc.documentElement.dataset['tnPaused']).toBe('true');
    (hoisted.state.dialogueOptions?.['onClose'] as () => void)();
    expect(doc.documentElement.dataset['tnPaused']).toBe('false');
  });

  it('shows the task once it is accepted, and shows none before', async () => {
    await arriveInOttawa();
    expect(hoisted.state.tasks, 'a tracker was drawn for a task nobody accepted').toEqual([]);

    emit('npc/engaged', 'officer');
    (hoisted.state.dialoguesShown[0] as { accept: { onSelect: () => void } }).accept.onSelect();

    /* Accepting finishes the leading `talk` step in the same move, so the
       tracker shows step 2 rather than "talk to the officer" (`TN-QUEST-02`). */
    const shown = hoisted.state.tasks.filter((task) => task !== null);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.at(-1)).not.toBe('');
  });

  it('can be accepted later, after it was declined', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');
    (hoisted.state.dialoguesShown[0] as { decline: { onSelect: () => void } }).decline.onSelect();

    emit('npc/engaged', 'officer');
    const second = hoisted.state.dialoguesShown[1] as { accept?: unknown };
    expect(second.accept, 'a declined quest was never offered again').toBeDefined();
  });

  it('gives a reminder rather than a second offer once it is being played', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');
    (hoisted.state.dialoguesShown[0] as { accept: { onSelect: () => void } }).accept.onSelect();

    emit('npc/engaged', 'officer');
    const again = hoisted.state.dialoguesShown[1] as { accept?: unknown; next?: unknown };
    expect(again.accept, 'the officer offered the quest twice').toBeUndefined();
    expect(again.next, 'a dialogue with nothing to decide needs one way onward').toBeDefined();
  });

  it('advances the visit step when the landmark it names is engaged', async () => {
    await arriveInOttawa();
    emit('npc/engaged', 'officer');
    (hoisted.state.dialoguesShown[0] as { accept: { onSelect: () => void } }).accept.onSelect();
    const afterAccepting = hoisted.state.tasks.at(-1);

    emit('poi/engaged', 'parliament-hill');
    expect(
      hoisted.state.tasks.at(-1),
      'engaging the landmark the step names changed nothing',
    ).not.toBe(afterAccepting);
  });

  it('hands the quest to answerQuestion only while an answer step is open', async () => {
    await arriveInOttawa();

    /* No quest accepted: a question at a landmark counts toward nothing. */
    emit('poi/engaged', 'parliament-hill');
    modalOption<{ onClose: () => void }>('poi-card').onClose();
    await flush();
    (hoisted.state.questionOptions as { onAnswer: (i: number, right: boolean) => void }).onAnswer(
      0,
      true,
    );
    expect(hoisted.state.answeredWithQuest).toEqual([null]);
  });

  it('says the task is done rather than the level, when a task is what finished', async () => {
    await arriveInOttawa();
    hoisted.state.stampFor = 'ottawa';
    hoisted.state.questCompletes = true;

    emit('poi/engaged', 'parliament-hill');
    modalOption<{ onClose: () => void }>('poi-card').onClose();
    await flush();
    const card = hoisted.state.questionOptions as {
      onAnswer: (i: number, right: boolean) => void;
      onNext: () => void;
    };
    card.onAnswer(0, true);
    card.onNext();
    await flush();

    const resolve = hoisted.state.completeShown[0] as (locale: string) => { reason?: string };
    expect(resolve('en').reason).toBe('quest');
  });

  it('offers no prompt for a character with nothing to say', async () => {
    /*
     * A character who is not a quest giver — or whose name this build has no row
     * for — cannot be spoken to, so the HUD offers nothing for them rather than a
     * control that opens nothing. That is the same rule the prompt already
     * follows for a target with no copy row, applied to the other reason an
     * engagement can be impossible.
     *
     * The character is `archivist`: a role `TN-LEVELS-2-to-10-spine.md` names,
     * that no shipped quest is given by. It used to be `guide`, which is exactly
     * the point — the guide gives three of the four quests and is named now, so
     * a fixture that kept using it would be asserting the opposite of what it
     * says. The other reason, a giver this build cannot name, is
     * `tests/unit/bootstrap/quest-giver-is-named.test.ts`, which can still
     * produce one.
     */
    hoisted.state.level = {
      ...LOADED_LEVEL,
      characters: [{ characterId: 'archivist' }],
    };
    await boot('?level=halifax');
    emit('level/ready');
    emit('poi/entered', 'archivist');

    expect(hoisted.state.prompts, 'a prompt was offered for a character who cannot answer')
      .toEqual([]);
  });

  it('gives the guide’s quest on the level the game opens on', async () => {
    /*
     * The defect that was live in the shipped build, from the front door: three
     * of the four authored quests declare `"giver": "guide"`, `app/ui/dialogue.ts`
     * takes the speaker's name as a **required** option (`TN-QUEST-08`), and no
     * `npc.guide.name` row existed — so all three offers were refused, Halifax
     * included, and Halifax is the level `content/game.config.json` opens on.
     * One copy row unblocked all three, and this is the one that matters most:
     * it is the first character most players meet.
     */
    hoisted.state.level = {
      ...LOADED_LEVEL,
      characters: [{ characterId: 'guide' }],
    };
    await boot('?level=halifax');
    emit('level/ready');
    emit('poi/entered', 'guide');

    /* The HUD says what talking to it will do, and does not call a beaver a
       person (`TN-GUIDE-03`). */
    expect(hoisted.state.prompts).toEqual([text('en', 'hud.interact.guide')]);
    expect(hoisted.state.prompts).not.toContain(text('en', 'hud.interact.npc'));

    emit('npc/engaged', 'guide');

    expect(hoisted.state.dialoguesShown, 'the guide said nothing').toHaveLength(1);
    const offer = hoisted.state.dialoguesShown[0] as {
      lines: string[];
      accept?: { label: string };
      decline?: { label: string };
    };
    expect(offer.lines.length, 'the offer had no lines to read').toBeGreaterThan(0);
    expect(offer.accept?.label).toBe(text('en', 'quest.accept'));
    expect(offer.decline?.label).toBe(text('en', 'quest.decline'));
    /* Named after the speaker, which is what a screen reader announces. */
    expect(hoisted.state.dialogueOptions?.['speakerName']).toBe(text('en', 'npc.guide.name'));
    expect(consoleText(), 'an offer was still refused for want of a name').not.toContain(
      'npc.<id>.name',
    );

    /* And accepting gives the level back and puts the task in the HUD. */
    (hoisted.state.dialoguesShown[0] as { accept: { onSelect: () => void } }).accept.onSelect();
    expect(
      doc.documentElement.dataset['tnPaused'],
      'the level was left frozen behind a dialogue that has gone',
    ).toBe('false');
    expect(hoisted.state.tasks.filter((task) => task !== null).length).toBeGreaterThan(0);
  });
});
