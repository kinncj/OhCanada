/**
 * Composition root (ADR-0005).
 *
 * The only file in the app allowed to name a concrete implementation. It loads
 * and validates the game config, builds the renderer, reads the save, mounts the
 * DOM layer that sits above the canvas, wires the orientation rule, and routes
 * the player between the front door and a level. Everything it wires talks
 * through the seams: the renderer knows nothing about the overlay, the overlay
 * knows nothing about Phaser, and `app/ui` knows nothing about either.
 *
 * ## The front door (task 1.20)
 *
 * Until this file called `createShell`, the only route into a level was a
 * `?level=` URL parameter, and a visitor who typed the address was shown a
 * caption reading *"Foundation build. There is no level to play yet"* — a
 * sentence that was true of the page and false of the build. It was reported
 * from a second machine, which is the shape this project's defects keep taking:
 * a screen that misdescribes its own state. The screens were not missing. The
 * door was.
 *
 * The route, and every step of it decided here rather than in `app/ui`:
 *
 * ```
 * cold load ─┬─ no ?level= ──► shell.start() ──► title ──► map ──► level
 *            └─ ?level=<id> ─► shell.enterLevel(id) ────────────► level
 *
 * back:  level ──► shell.leaveLevel() ──► map ──► title
 * ```
 *
 * Five things about that seam are the shell's API and not this file's taste:
 *
 *  1. `enterLevel` is called **before** `createHud`. The shell's root is the
 *     page's one `<main>` while it is showing and `createHud` makes another;
 *     `enterLevel` detaches the first, so the page never has two.
 *  2. `built` and `unlocked` are computed **here** — `hasLevel(id)` from the
 *     level catalogue and `unlockedLevelIds(...)` from the domain, in
 *     `./journey.ts` — and handed over as data. The shell renders a `MapEntry`;
 *     it does not decide one.
 *  3. Study is mounted by this file, not by the shell. It is **not** mounted
 *     today, and the reason is written where the option would go.
 *  4. The shell owns no level loading and no error screen. Both are below.
 *  5. `onPlayLevel` is a **request**. This file decides whether it happens, and
 *     refuses a level this build cannot open rather than opening a black screen.
 */

import gameConfigDocument from '@content/game.config.json';

import { bundledLessonLibrary, bundledQuestionBank } from '@adapters/content';
import { browserIndexedDb, browserLocalStorage, openProgressStore } from '@adapters/persistence';
import { createSeededRandom } from '@adapters/random';
import {
  GameRenderer,
  bundledLevelCatalog,
  createCharacterPreview,
  hasLevel,
  parseBootConfig,
  type BootConfig,
  type SceneLevel,
} from '@adapters/phaser';
import { answerQuestion } from '@application/use-cases/answer-question';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { createExamSession, type ExamSession } from '@application/use-cases/exam-session';
import { countAnswered, countRight } from '@application/use-cases/exam-attempt';
import { createStudySession, type StudySession } from '@application/use-cases/study-session';
import type {
  Clock,
  Connectivity,
  LessonLibrary,
  LessonPassageReference,
  LocalizedText,
  QuestDocument,
  ShippableQuestion,
} from '@application/ports';
import { checkLevelAvailability } from '@application/use-cases/level-availability';
import {
  loadProgress,
  saveProgress,
  type SaveProgressDeps,
} from '@application/use-cases/save-progress';
import type { SaveTransferOptions } from '@ui/save-transfer';
import { downloadSaveFile, saveTransferOptions } from './save-transfer';
import { defaultSettings, withSettings } from '@domain/entities/player';
import { reachLevelEnd } from '@domain/entities/level-end';
import type { Randomness } from '@domain/scheduling/question-scheduler';
import {
  newProgress,
  stampedLevelIds,
  withCharacter,
  type Progress,
} from '@domain/entities/progress';
import type { EpochMillis, LevelId, LocaleCode, QuestionId } from '@domain/ids';
import { createAboutThisPlace, type AboutThisPlace as AboutPanel } from '@ui/about-this-place';
import { hasCopyRow, text, type UiLocale } from '@ui/copy';
import { createHud, type Hud } from '@ui/hud';
import { bareTargetId, interactHint } from '@ui/interact';
import { createLevelAnnouncer, type LevelTarget } from '@ui/level-events';
import {
  createLevelComplete,
  type LevelComplete,
  type LevelCompleteContent,
  type LevelCompleteNext,
} from '@ui/level-complete';
import { createLessonReader, type LessonReader, type LessonReaderView } from '@ui/lesson-reader';
import { createLevelError, createLevelLoading } from '@ui/level-screens';
import { describeEntry, type MapEntry } from '@ui/level-select';
import { announce, clearAnnouncements, mountLiveRegion } from '@ui/live-region';
import { createPassport, type Passport, type PassportExam } from '@ui/passport';
import { createPoiCard } from '@ui/poi-card';
import { createRotateOverlay, type RotateOverlay } from '@ui/rotate-overlay';
import {
  applySettings,
  createSettingsStore,
  prefersReducedMotion,
  type Settings as UiSettings,
  type SettingsStore,
} from '@ui/settings';
import { createSettingsScreen, type SettingsScreen } from '@ui/settings-screen';
import { createShell } from '@ui/shell';

import {
  creatorSlotsByLocale,
  repairSelection,
  toPlayerCharacter,
  toSelection,
} from './character-slots';
import { newSaveLocale } from './browser-locale';
import { creatorArt } from './creator-art';
import { createTaskCue } from './task-cue';
import { assetsBaseUrl, createScreenArt, type ScreenArt } from './screen-art';
import { aboutThisPlaceView } from './about-this-place';
import { lessonReaderView, resolveReading, type Reading } from './lesson-reading';
import { grantsPassage } from './verified-passages';
import { readGameRules, type GameRules } from './game-rules';
import {
  createGameEventBus,
  createMilestoneBus,
  levelEventSource,
  publishLevelFailed,
  publishSceneEvent,
  publishSceneMilestone,
  type GameEventBus,
  type MilestoneBus,
} from './game-events';
import { isPlayable, journeyEntries } from './journey';
import { createExamController, type ExamController } from './exam';
import { createExamEventLog } from './exam-events';
import {
  counterForDrawn,
  landmarkDraw,
  rememberAnswered,
  teachingQuotes,
} from './landmark-questions';
import { promptTargets } from './prompt-targets';
import { levelPlacements, type LevelPlacements } from './engageables';
import {
  completionLine,
  createQuestController,
  type CompletionLine,
  type QuestController,
  type VisitedOutcome,
} from './quest';
import { readQuests, questsForLevel, type QuestCatalogue } from './quests';
import {
  describeDialogueCensus,
  dialogueCensusIsRemarkable,
  type SpokenQuest,
} from './verified-dialogue';
import { createDrillRunner, type DrillRunner } from './quiz';
import { createStudyController, type StudyController } from './study';
import { readSubjectIndex } from './subjects';
import { watchPortraitFit, type PortraitWatch } from './portrait-notice';
import { watchForUpdates, workerContainerOf, type UpdateWatch } from './update-notice';

/**
 * The config is imported, not fetched. It is on the 6 s time-to-play budget and
 * needed before the first frame, so it is inlined by the bundler and there is no
 * request to wait for and nothing to 404 on a sub-path deploy (ADR-0006).
 * `parseBootConfig` and `readGameRules` still validate it at runtime:
 * `make validate-content` guards the repository, these guard the artefact.
 */

/** The page's query string, or `null` where there is no address to read. */
function readPageSearch(view: unknown): string | null {
  const location = (view as { readonly location?: { readonly search?: unknown } } | null)
    ?.location;
  return typeof location?.search === 'string' ? location.search : null;
}

function main(): void {
  const root = document.documentElement;
  root.dataset['tnBoot'] = 'loading';
  root.dataset['tnPaused'] = 'false';

  const gameHost = document.getElementById('game');
  const uiHost = document.getElementById('ui');
  if (gameHost === null || uiHost === null) {
    reportFailure('index.html is missing #game or #ui.');
    return;
  }

  /*
   * The live region goes up first: it is how every later failure gets spoken.
   * "First" has to mean before the config is parsed, not after — `announce`
   * auto-mounts to `document.body` when no region exists, so a parse failure
   * reported ahead of this line would put the one screen-reader channel outside
   * the `#ui` layer that owns it. Locked by
   * tests/unit/bootstrap/live-region-order.test.ts.
   */
  mountLiveRegion(uiHost);

  /*
   * The bus, before the renderer that publishes on it.
   *
   * CLAUDE.md: "Systems communicate over the typed event bus, not direct
   * references." The scene publishes, the bus carries, `app/ui` listens, and
   * neither end knows the other exists (ADR-0005).
   */
  const bus = createGameEventBus();
  /*
   * The second channel: what a level has *finished*, as opposed to what it is
   * doing. `game-events.ts` says why it is a bus of its own and not four more
   * names on the first one.
   */
  const milestones = createMilestoneBus();

  const parsed = parseBootConfig(gameConfigDocument);
  if (!parsed.ok) {
    reportFailure(`${parsed.error.code}: ${parsed.error.message}`);
    return;
  }
  const config = parsed.value;

  /* The progression half of the same file. `game-rules.ts` says why the
     renderer's parser deliberately does not carry it. */
  const rules = readGameRules(gameConfigDocument);
  if (!rules.ok) {
    reportFailure(`${rules.error.code}: ${rules.error.message}`);
    return;
  }

  document.title = config.title;
  root.lang = config.defaultLocale;

  /**
   * Who wants to know that a level has become **playable**.
   *
   * A set rather than one callback because the renderer is built once, at boot,
   * and level sessions come and go: the session that is open registers, and
   * unregisters when it closes, so a scene booting into a level that has already
   * been left reaches nobody.
   *
   * The distinction it carries is a real defect rather than a nicety.
   * `loadLevel` resolves when the document has parsed and the scene has been
   * handed to Phaser; Phaser boots it and calls `create` one or more frames
   * later, and everything that makes a level playable — the camera, the
   * affordances, the keyboard keys — happens in `create`. Writing "ready" and
   * taking the waiting screen down at the earlier moment shows the player a
   * level they cannot touch: measured with a 1.5 s delay on the textures, a real
   * key press in that window was lost two runs in three.
   */
  const playableListeners = new Set<(levelId: string) => void>();

  const renderer = new GameRenderer({
    parent: gameHost,
    config,
    onLevelEvent: (name, detail) => {
      publishSceneEvent(bus, name, detail);
    },
    /*
     * **The line the engine's half needed.** `level/exitReached` is the scene
     * saying the player has arrived at the end of the world — a position, not an
     * achievement, as `level-events.ts` in the adapter is careful to say. What
     * that arrival is worth is decided in `openLevel` below, where the passport
     * and the unlock rules are.
     */
    onLevelMilestone: (name, detail) => {
      publishSceneMilestone(milestones, name, detail);
    },
    /* The level's first playable frame. See {@link playableListeners}. */
    onLevelReady: (levelId) => {
      for (const listen of [...playableListeners]) listen(levelId);
    },
    /* The page's colours moved without a level change: the band above the
       canvas follows the canvas's first row (ADR-0044). Never called before this
       constructor returns — a level has to open first. */
    onPageThemeChange: () => {
      applyPageTheme(renderer);
    },
  });
  applyPageTheme(renderer);

  /*
   * "A new version is ready" (ADR-0034, `./update-notice.ts`).
   *
   * Started here, before anything awaits, because its trigger is whether this
   * page was already controlled when it loaded, and that is read when the watch
   * starts. It registers nothing: `scripts/lib/pwa.mjs` writes the registration
   * into `dist/index.html`, and this only listens — and only while the flag that
   * decides whether there is a worker at all is on. With no worker container, as
   * under the bootstrap suites' `window` double, every call below is a no-op and
   * the pause is handed back exactly as it was built.
   */
  const updates = watchForUpdates({
    enabled: gameConfigDocument.featureFlags.serviceWorker === true,
    container: workerContainerOf(window),
    root,
  });

  /*
   * One pause, several reasons.
   *
   * The rotate overlay, the menu, a landmark card and the settings screen all
   * pause the level, and they overlap: closing the menu while the device is
   * still sideways used to resume a game the overlay had stopped. Holding
   * reasons rather than a flag makes "paused" true while *anything* wants it,
   * which is what keeps `data-tn-paused` — the attribute the e2e suite and the
   * debug overlay read — a fact rather than the last caller's opinion.
   */
  /* The update notice waits on three of these: a level holds `poi`, `study` and
     `quest` exactly while a landmark's card and its question, a drill, or a quest
     dialogue is open. Every reason still reaches the renderer unchanged. */
  const pausing = createPauseControl(renderer, root);
  const deferred = updates.deferDuring<PauseReason>(pausing, ['poi', 'study', 'quest']);
  /* `deferDuring` wraps the two calls it defers on and hands back those two;
     `watch` is the control's own and is not one of them, so the pair is put
     together here rather than in `./update-notice.ts`, which has no business
     knowing that a level has a HUD. Every hold still reaches the renderer, and
     every watcher still hears it, whichever of the two objects it came through. */
  const pause: PauseControl = {
    hold: (reason) => {
      deferred.hold(reason);
    },
    release: (reason) => {
      deferred.release(reason);
    },
    watch: (listen) => pausing.watch(listen),
  };

  const overlay = createRotateOverlay(uiHost, {
    locale: toUiLocale(config.defaultLocale),
    onShow: () => {
      pause.hold('orientation');
    },
    onHide: () => {
      pause.release('orientation');
    },
  });

  /** What the window is right now, in CSS pixels. The visual viewport when the
      browser has one, because that is what a pinch-zoomed page is actually
      showing. */
  const measureViewport = (): { readonly width: number; readonly height: number } => {
    const viewport = window.visualViewport;
    return {
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight,
    };
  };

  const syncOrientation = (): void => {
    const { width, height } = measureViewport();
    root.dataset['tnMode'] = overlay.sync(width, height);
  };

  /*
   * "This game works best on a phone held upright" (ADR-0060, `./portrait-notice.ts`).
   *
   * Measured here, once, from the viewport the page loaded at — and deliberately
   * *not* re-measured by `syncOrientation` above. The rotate overlay has to
   * follow every resize because a phone can turn at any moment; this is a
   * sentence about the device, said once on arrival, and a version of it that
   * re-fired when a desktop player dragged their window would be an interruption
   * nobody asked for.
   *
   * It cannot collide with the overlay: `classifyAudience` answers
   * `phone-landscape` on exactly the branch `classifyViewport` answers
   * `landscape-phone` on, and the notice is never owed for it.
   */
  const portrait = watchPortraitFit({
    ...measureViewport(),
    /* The same probe the save uses, and a different key: a dismissal is a
       property of this device, not of this player's progress (ADR-0060). */
    storage: browserLocalStorage(),
  });
  /* Published like `data-tn-mode` beside it, so a suite can assert which of the
     three audiences the page decided it had without guessing from pixels. */
  root.dataset['tnAudience'] = portrait.audience;

  window.addEventListener('resize', syncOrientation, { passive: true });
  window.addEventListener('orientationchange', syncOrientation, { passive: true });
  window.visualViewport?.addEventListener('resize', syncOrientation, { passive: true });

  /*
   * The first orientation check runs *after* the front door is mounted, and the
   * order is a containment bug rather than a preference.
   *
   * The rotate overlay is a modal: opening it inerts everything outside itself,
   * which is what makes `aria-modal="true"` a promise rather than a claim. But
   * `inert` is applied to the elements that exist at that moment, and a screen
   * mounted afterwards is not covered by it. Loading the page already sideways
   * therefore used to open the overlay over an empty `#ui` and then add the
   * title screen behind it — reachable by Tab, from behind a dialog that says
   * nothing behind it is reachable. Checking last means the shell is on the page
   * before the trap engages, and every later check re-engages it over whatever
   * is there.
   */
  /* Read off the window rather than assumed: a page without it draws no
     screen pictures, and nothing else changes (ADR-0041). */
  const pageFetch = (window as Partial<Pick<Window, 'fetch'>>).fetch;
  void openFrontDoor({
    root,
    uiHost,
    gameHost,
    bus,
    milestones,
    onLevelPlayable: (listen) => {
      playableListeners.add(listen);
      return () => {
        playableListeners.delete(listen);
      };
    },
    renderer,
    pause,
    /* Built above in the config's default language, because the save has not
       been read yet; `openFrontDoor` tells it the player's own. */
    rotate: overlay,
    config,
    rules: rules.value,
    onMounted: syncOrientation,
    updates,
    portrait,
    /* The pictures the DOM screens draw (ADR-0041). With no page `fetch` there
       are none, and every screen is its words. */
    screenArt: createScreenArt({
      fetch: pageFetch === undefined ? undefined : (url) => pageFetch.call(window, url),
      baseUrl: assetsBaseUrl(),
      devicePixelRatio: () => window.devicePixelRatio,
      document,
      /* An earned level's points of interest, for its stamp on the passport
         (ADR-0045). The level's own document chunk, which the worker already
         precaches; nothing is drawn for a level that is not earned. */
      levelPois: async (levelId) => {
        const loaded = await bundledLevelCatalog.load(levelId, config.locomotionModes);
        return loaded.ok ? loaded.value.pois : null;
      },
    }),
  });
}

/* ------------------------------------------------------------------- the door */

interface FrontDoor {
  readonly root: HTMLElement;
  readonly uiHost: HTMLElement;
  readonly gameHost: HTMLElement;
  readonly bus: GameEventBus;
  /** The finished-something channel. See `game-events.ts`. */
  readonly milestones: MilestoneBus;
  /**
   * Hear about a level's first playable frame; the returned function stops
   * listening. Registration rather than one callback, because the renderer
   * outlives every level session.
   */
  readonly onLevelPlayable: (listen: (levelId: string) => void) => () => void;
  readonly renderer: GameRenderer;
  readonly pause: PauseControl;
  /**
   * The rotate overlay, mounted before this function runs.
   *
   * It is handed over for one reason: it is the only screen that exists before
   * the save has been read, so it is the only one that cannot be built in the
   * player's language. `openFrontDoor` reads the save and owns the settings
   * store, so it is where the overlay is told which language that is.
   */
  readonly rotate: RotateOverlay;
  readonly config: BootConfig;
  readonly rules: GameRules;
  /** Called once the DOM layer is on the page. See the note at the call site. */
  readonly onMounted: () => void;
  /** The update notice's watch, started in `main` before anything awaited. */
  readonly updates: UpdateWatch;
  /**
   * The portrait notice's watch (ADR-0060), which has already classified the
   * viewport the page loaded at.
   *
   * Handed over for the same reason the rotate overlay is: it is decided before
   * the save has been read, and the words it draws are in the player's language,
   * which only this function knows.
   */
  readonly portrait: PortraitWatch;
  /** Where the screens' pictures come from (ADR-0041). */
  readonly screenArt: ScreenArt;
}

/**
 * Read the save, mount the shell, and route.
 *
 * Asynchronous, and the `await` is deliberate rather than incidental: the title
 * screen draws different controls for a player who has a saved game than for one
 * who does not (`TN-TITLE-03`), and re-drawing it a moment later would replace
 * the control that already had focus — which is how a keyboard user loses their
 * place and a screen reader goes quiet.
 *
 * Since ADR-0026 the wait is a real one: IndexedDB opens asynchronously, so this
 * is a round trip to the browser's storage thread rather than the one microtask
 * `localStorage` cost. It is spent before the first frame and buys the opposite
 * saving — every save *after* this one stops blocking the main thread, which is
 * frame time in a game — and nothing is drawn twice waiting for it.
 */
async function openFrontDoor(deps: FrontDoor): Promise<void> {
  const { root, uiHost, gameHost, bus, milestones, renderer, pause, config, rules, screenArt } =
    deps;
  const { onLevelPlayable } = deps;

  /*
   * `#game`'s place on the page, remembered before anything moves it.
   *
   * `createHud` moves the canvas host inside the `<main>` it makes, which is
   * what puts the thing the page is *for* inside the one landmark (`TN-HUD-07`).
   * Leaving a level takes that `<main>` away again, so the canvas has to go back
   * exactly where the document put it rather than being appended to the body —
   * which would change its paint order against `#ui`.
   */
  const canvasParent = gameHost.parentElement;
  const canvasBefore = gameHost.nextElementSibling;

  const clock: Clock = {
    now: () => Date.now() as EpochMillis,
    elapsed: () => (typeof performance === 'undefined' ? Date.now() : performance.now()),
  };
  /*
   * Seeded from the wall clock so two sittings differ, and printed nowhere yet.
   * The value of `SeededRandomSource` here is not that this seed is interesting
   * — it is that a draw is a pure function of one number, so a repetitive drill
   * reported from a phone is reproducible once the seed travels with the report.
   * `fork` keeps the study draw's stream clear of any other consumer's.
   */
  const random = createSeededRandom(Date.now() >>> 0);
  /*
   * Where every card's option order comes from (ADR-0059).
   *
   * One stream for the whole sitting, shared by Study, the level and the exam,
   * rather than a fork taken per consumer: `fork` is deterministic from the seed
   * and the label, so `random.fork('options')` called again on the second level
   * would hand back a stream that starts over, and every visit would present its
   * nth question in the same order as the last. One stream advances.
   *
   * Forked off `random` for the reason the comment above gives: shuffling a
   * card's four options must never shift which questions the scheduler brings
   * up, and the study and exam draws run on streams of their own.
   */
  const optionsRandom = random.fork('options');
  /*
   * The migrations are passed in here, not defaulted inside the codec: the
   * version numbers and the steps between them belong where the build is
   * assembled (`save-migrations.ts`, and the tripwire that asked for it).
   */
  const codec = createJsonSaveCodec({
    maxImportBytes: rules.maxImportBytes,
    migrations: SAVE_MIGRATIONS,
  });
  /*
   * IndexedDB, with `localStorage` as the fallback and as the place an existing
   * save is carried out of (ADR-0026). `openProgressStore` does the choosing,
   * the copy and the verification; this file only reports what it decided.
   */
  const progressStore = await openProgressStore({
    indexedDb: browserIndexedDb(),
    localStorage: browserLocalStorage(),
    codec,
  });
  const save: SaveProgressDeps = {
    clock,
    repository: progressStore.repository,
    codec,
    defaultLocale: config.defaultLocale,
  };
  if (progressStore.migration.status === 'failed') {
    /*
     * Nothing was destroyed — the original is exactly where it was — and the
     * game carries on. Said out loud because a migration that fails silently is
     * one nobody fixes. A migration that *worked* says nothing: `console.info`
     * is not an allowed method here and a success is not a warning.
     */
    console.error(
      `[bootstrap] the saved game could not be carried into IndexedDB. ${progressStore.migration.error.code}: ${progressStore.migration.error.message}`,
    );
  }

  const loaded = await loadProgress(save);
  /*
   * `TN-SAVE-05`: storage being unavailable is a warning, never a stop. A
   * refused read and a browser with no storage at all are the same thing to a
   * player — this game is not going to remember them — so both raise the one
   * warning the title screen carries, and neither prevents play.
   */
  const storageBlocked = progressStore.blocked || !loaded.ok;
  /**
   * The exam's event trace, and the two `progress/*` names the stories assert
   * beside it.
   *
   * Installed on `window` only under `?e2e=1`, exactly as the scene probe is:
   * `emit` is a no-op on a normal load and `window.__tnExam` is `undefined`, so
   * a player's build carries no debug surface. Emitting is unconditional at
   * every call site, because a caller that had to ask whether the probe was on
   * would be one forgotten branch away from an event that fires in a test and
   * not in the game.
   */
  const examEvents = createExamEventLog({
    /* Read defensively. This runs under `environment: 'node'` in
       `tests/unit/bootstrap/`, against a `window` double that has no
       `location` — and a boot sequence that threw there would be a debug
       surface breaking the game it is supposed to observe. */
    search: readPageSearch(window),
    target: window as unknown as Record<string, unknown>,
  });
  /* `TN-ATTEMPT-05` turns on this flag: a browser that cannot save changes what
     leaving an exam costs, so the exam's menu has to know. It starts as the boot
     answer and moves the first time a write actually fails. */
  let storageFailing = storageBlocked;
  if (!loaded.ok) {
    console.error(`[bootstrap] the save could not be read. ${loaded.error.code}: ${loaded.error.message}`);
  }

  /*
   * A brand-new save starts in the browser's language (`OQ-SET-2`,
   * `./browser-locale.ts`): French for any `fr*` tag, English for `en*`, the
   * config's default otherwise. A save that loaded keeps its own locale, and
   * nothing drawn before this line was put in the browser's language, so a
   * returning player never sees a screen in a language they did not choose.
   */
  let progress: Progress =
    loaded.ok && loaded.value !== null
      ? loaded.value
      : newProgress(
          defaultSettings(
            newSaveLocale(window, toUiLocale(config.defaultLocale)) as unknown as LocaleCode,
          ),
          rules.unlockRules.initialLevels,
        );

  /* `TN-ATTEMPT-02`: "the event `progress/loaded` is emitted" when the game
     comes back to an exam it did not finish. Emitted for every load, because the
     event is about the save being read and not about what was in it. */
  examEvents.emit('progress/loaded');

  /*
   * The question bank, wired.
   *
   * `progress` is passed as a getter and not as a value: it is reassigned by
   * every answer and every settings change below, and a drill drawn from a
   * snapshot taken at boot would schedule against a history that stopped
   * growing. `random.fork('study')` keeps the draw's stream to itself, so
   * shuffling a card's options can never shift which questions come up.
   */
  const studySource: StudySession = createStudySession({
    bank: bundledQuestionBank,
    clock,
    random: random.fork('study'),
    progress: () => progress,
    tuning: rules.scheduler,
    drillSize: rules.study.drillSize,
  });

  /*
   * The quests this build ships, read once.
   *
   * `content/quests/` may be empty — it is while the first four are being
   * written — and an empty catalogue is a normal build rather than a failure: no
   * offer, no tracker, and no empty quest log that looks broken. A document that
   * will not load is a different thing entirely, so it is named on the console
   * and the other quests still load.
   */
  /*
   * The exam's own draw, on its own stream.
   *
   * `random.fork('exam')` rather than the study stream: `TN-EXAM-02` requires two
   * saves with the same seed to draw the same twenty questions whatever else the
   * player has done, and a shared stream would move the draw every time a card
   * shuffled or a drill ran. It is a different object from `studySource` for a
   * stronger reason than tidiness — `ExamSession` has no `progress` in its
   * dependencies at all, so the draw *cannot* read a review record.
   */
  /*
   * The lesson catalogue, wired once (ADR-0063 §6).
   *
   * One library for the sitting and for every surface that reads prose, so a
   * chapter fetched at a plaque is the chunk Learn reads later and a quarantined
   * passage disappears from both in one edit. Nothing is fetched by building it:
   * the index is read off module paths, and a chapter's chunk arrives when a
   * `read` step names a lesson in it.
   */
  const lessonLibrary = bundledLessonLibrary();

  const examSource: ExamSession = createExamSession({
    bank: bundledQuestionBank,
    random: random.fork('exam'),
    rules: rules.exam,
  });

  const questCatalogue: QuestCatalogue = readQuests();
  for (const refusal of questCatalogue.refused) {
    console.error(`[bootstrap] a quest document was refused. ${refusal}`);
  }
  /*
   * What ADR-0003's filter did to the words this build speaks (ADR-0024).
   *
   * Two states get a line: a block was left unsaid, or **quests were read and
   * nothing was examined**. The second is the one this exists for — every quest
   * opens on a `talk` step whose dialogue `readQuest` requires, so zero examined
   * across ten quests is the filter having stopped matching the blocks it reads,
   * which is exactly the failure that used to look like success. A build in good
   * order says nothing here and still publishes every number to the scene probe
   * (`data-dialogue-*`), so "0 unsaid of 46 blocks" stays readable from outside
   * without a warning on every load.
   */
  if (dialogueCensusIsRemarkable(questCatalogue.census)) {
    console.warn(`verified-dialogue: ${describeDialogueCensus(questCatalogue.census)}`);
  }

  const store = createSettingsStore(toUiSettings(progress.settings));
  const applyToPage = (): void => {
    applySettings(document, store.current, prefersReducedMotion(window));
  };
  applyToPage();

  /*
   * The rotate overlay, in the language of the save that has just been read.
   *
   * It is mounted in `main()`, before this function, and it has to be: a phone
   * can already be sideways on the first frame, and an overlay built after the
   * save would leave that player looking at a landscape game. So it is built in
   * `game.config.json#/defaultLocale` and corrected here — which is the whole of
   * the defect it fixes. A French save used to turn the whole game French except
   * this one screen, which kept telling the player to turn their phone upright in
   * English. `applyToPage` has just written the same language on `<html>`.
   */
  deps.rotate.setLocale(store.current.locale);

  /*
   * Auto-move (CLAUDE.md, Traversal and Accessibility): the player never has to
   * hold a direction.
   *
   * The line that joins `app/ui/settings-screen.ts`'s toggle to the scene that
   * has to obey it. Both ends existed and neither knew about the other — the
   * screen persisted `autoMove` and `GameRenderer.setAutoMove` was written with
   * no caller — which is the shape ADR-0008 is about: a capability nothing
   * composes. Set at boot from the save, and again on every change, because a
   * setting turned on while the map is up has to be in force on the level's
   * first frame and not one level later.
   */
  renderer.setAutoMove(store.current.autoMove);
  /*
   * "Less movement", the same way and for the same reason. Its absence was a
   * shipped defect: the setting restyled the DOM and the canvas never heard of
   * it, so particles and parallax easing stayed on until the operating system
   * asked for stillness instead. `applyToPage` above covers the screens; this
   * covers what the renderer draws, from the save at boot and on every change.
   */
  renderer.setReducedMotion(store.current.reducedMotion);

  const entriesNow = (): readonly MapEntry[] =>
    journeyEntries({
      rules: rules.unlockRules,
      /* The map's ten places, in map order. A separate list from the unlock
         sequence above, and separate on purpose: see `Journey` in
         `@domain/entities/level`. */
      journey: rules.journey,
      stamped: stampedLevelIds(progress),
      /* The catalogue's answer, derived from `content/levels/*.json` by a
         bundler glob — never a list anybody maintains, which is what makes
         dropping a level document in enough to make it playable. */
      isBuilt: (id) => hasLevel(`${id}`),
    });

  let entries = entriesNow();

  /**
   * Held while a save file replaces the save, and for good once it has
   * (ADR-0046): the game in memory is then the one the file replaced, and
   * writing it would put the old game back over the file before the restart.
   */
  let writesHeld = false;

  /** Write the game down. Nothing waits for it and a failure never stops play. */
  const persist = (): void => {
    if (writesHeld) return;
    void saveProgress(save, progress).then((written) => {
      if (written.ok) {
        examEvents.emit('progress/saved');
        return;
      }
      console.error(`[bootstrap] progress was not saved. ${written.error.code}`);
      examEvents.emit('progress/save-failed');
      storageFailing = true;
      shell.setStorageWarning(true);
      session?.hud.setStorageWarning(true);
      /* `TN-EXAM-05`: the exam carries on, and the promise its menu makes about
         leaving changes to the true one (`TN-ATTEMPT-05`). */
      shellExam?.setStorageBlocked(true);
    });
  };

  /**
   * One answer, and everything it changes.
   *
   * `answerQuestion` folds four things forward in one instant — the judgement,
   * the review record, the quest's `answer` step and, if that was the last one,
   * the level's stamp — and it is the only place in the program allowed to do
   * any of them. `StudySession` deliberately records nothing (it says so), and
   * the question card only judges what it was told the right answer was, so this
   * is the single write. Study and a landmark's question both come through here.
   *
   * **The quest is passed now**, and it is the level session's answer rather than
   * this function's: `QuestController.answering` is the quest that is active
   * *and* on an `answer` step, which is the only state in which an answer may
   * count toward one. Handing it over unconditionally would be wrong in the
   * other direction — a Study drill taken from the menu in the middle of a quest
   * would finish it — and the use case guards that too, so the answer is checked
   * twice and can be wrong in neither place. With no quest open, or no quest in
   * the build at all, this is `undefined` and the call behaves exactly as it did.
   *
   * A failure is logged and swallowed. `gradeAnswer` refuses an index outside
   * the four options, which is a defect in this file rather than something a
   * player did, and a drill that stopped dead would punish them for it.
   */
  const recordAnswer = (question: ShippableQuestion, chosenIndex: number): AnswerOutcome => {
    const quest = session?.answeringQuest;
    const result = answerQuestion({ clock }, { question, chosenIndex, progress, quest });
    if (!result.ok) {
      console.error(
        `[bootstrap] an answer was not recorded. ${result.error.code}: ${result.error.message}`,
      );
      return { stampEarned: false, correct: false, questCompleted: false };
    }
    progress = result.value.progress;
    persist();
    /* The tracker counts answers as they are given — "Answer 3 questions (1 of
       3)" — and the count is in the save this line has just written, so the
       session re-reads it rather than being told. */
    session?.refreshQuest();
    return {
      stampEarned: result.value.stampEarned,
      correct: result.value.judgement.correct,
      questCompleted: result.value.questCompleted,
    };
  };

  /**
   * "Save to a file" and "Open a file" (`TN-SAVE-06`, ADR-0046), handed to
   * Settings on the title screen and in a level. `./save-transfer.ts` says why a
   * replacement holds the game's own saves and then starts the game again.
   */
  const saveTransfer: SaveTransferOptions = saveTransferOptions({
    deps: { ...save, maxImportBytes: rules.maxImportBytes },
    progress: () => progress,
    writes: {
      hold: () => {
        writesHeld = true;
      },
      release: () => {
        writesHeld = false;
      },
    },
    download: (file) => {
      downloadSaveFile(document, file);
    },
    restart: () => {
      window.location.reload();
    },
  });

  /**
   * `TN-TITLE-04` and `TN-HUD-03`: the way out the storage warning has to offer.
   * The same file Settings' "Save to a file" makes, made the same way.
   */
  const exportSave = (): void => {
    saveTransfer.onExport();
  };

  /* ------------------------------------------------------- the character */

  /*
   * The character creator, mounted — and the branch that decides whether a cold
   * load draws "Play" or "Continue".
   *
   * `TN-FIRSTRUN` ruling 1: **a player is on their first run when the save
   * carries no character, and by nothing else.** Not when the save is empty,
   * not when no level has been played, not when there is no
   * `lastPlayedLevelId`. A save with stamps and answers and no character — an
   * import, a save written before this wire existed, a repair that dropped a
   * malformed block — is a first run, goes to the creator, and keeps every
   * stamp and every answer. That is why the line below asks `progress.character`
   * and nothing else.
   *
   * Until this existed, no creator block was ever passed to the shell, the
   * first-run branch could not be represented, and `title.play` was a row in the
   * copy table that had never been drawn on a shipped page.
   */
  const creatorRandom = random.fork('character');
  /*
   * A slot or an option the rig offers that nothing names **throws**, naming
   * every missing key (`creatorSlots`, ADR-0024): a group is drawn or the build
   * fails, and is never silently left out. At boot that is a build defect, so it
   * is reported the way every other refused boot is — `data-tn-boot="failed"`,
   * a visible notice and a spoken one — rather than escaping `main()` and
   * leaving the page on "loading" with nothing said.
   * `tests/unit/bootstrap/character-slots.test.ts` fails the build on the same
   * condition first, so this is what the program does if one ever ships.
   */
  const creatorSlots = ((): ReturnType<typeof creatorSlotsByLocale> | null => {
    try {
      return creatorSlotsByLocale();
    } catch (error) {
      reportFailure(error instanceof Error ? error.message : String(error));
      return null;
    }
  })();
  if (creatorSlots === null) return;

  /*
   * The saved appearance, repaired with a **uniform draw** and never with the
   * rig's `fallback`.
   *
   * `TN-LOOK-05`: "the slot whose option is gone was filled by a uniform draw
   * over that slot's options. And it was not filled with the rig's `fallback`
   * for that slot." The fallback is what the rig reserves for NPC documents and
   * save recovery, and a repair that reached for it would put the default
   * player back through the one door nobody was watching. `repairSkins` in
   * `app/domain/entities/character.ts` did exactly that for every slot and now
   * draws uniformly for a player-selectable one; it repairs against a
   * `Character` document, and the creator's slots come from the rig, so the
   * creator's repair is `repairSelection`.
   *
   * A save that predates a slot — every save made before `presentation` opened —
   * is not a repair either: the slot it does not name takes the rig's fallback
   * silently, because no choice the player made is gone.
   *
   * **A save with no character is not repaired here, and is not drawn for here.**
   * ADR-0053 rule 3: one draw, one holder, and the holder is the screen. This
   * file repairs a *saved* character, because repairing needs the save; a save
   * with no character is handed to the shell as **no selection**, and
   * `openingSelection()` in `app/ui/shell.ts` draws it and keeps it for the
   * sitting. Until that ADR, `toSelection(null)` answered `undefined` and
   * `repairSelection` drew every slot, so the shipped first-run draw was this
   * file's, the screen's own draw was dead code on a shipped page, and the
   * sitting's character had two holders that could disagree — which is what put
   * the pre-re-roll face on the title screen while the creator held the one
   * after "Surprise me".
   */
  const savedCharacter = toSelection(progress.character);
  const repairedCharacter =
    savedCharacter === undefined ? null : repairSelection(savedCharacter, creatorRandom.next);
  /**
   * The character **the save has**, and `null` until the player accepts one.
   *
   * Never a draw. Everything downstream of this line — the renderer, the title
   * figure, the creator's opening selection — is therefore about a character
   * somebody chose, and a character nobody has chosen exists in exactly one
   * place in the program (ADR-0053, rule 3).
   */
  let characterSelection: Readonly<Record<string, string>> | null =
    repairedCharacter?.selection ?? null;
  /*
   * A repaired character is written back now, not when the player next finishes
   * the creator. `TN-LOOK-05` requires the level to be playable with the drawn
   * option immediately — "the game never blocks, and never quietly picks the
   * middle of a ramp" — and requires the player to be told once rather than
   * every time.
   */
  if (repairedCharacter?.repaired === true) {
    progress = withCharacter(progress, toPlayerCharacter(repairedCharacter.selection));
    persist();
  }
  /*
   * The level draws what the player chose. Takes effect at the next level open,
   * which is every open in this route: the creator is always upstream of a
   * level. Nothing is said on a first run, because there is nothing the player
   * has chosen yet: the renderer's empty appearance dresses the puppet in the
   * rig artboard's own skins — "a complete character rather than a naked one" —
   * and the real one arrives with `character/created`.
   *
   * **This line owns dressing a saved character, and the shell's reports cannot
   * replace it.** ADR-0053 rule 3 moved the *draw* to the screen, and it is
   * worth being exact about what did not move with it: the shell reports a
   * character only when the creator is finished (`character/created`,
   * `character/changed`), and a returning player can go title → Continue →
   * level without ever opening the creator. Delete this line and that player
   * plays every level as the rig's own skins.
   *
   * The two dress sites are disjoint by construction — this one runs once, at
   * boot, only for a character that was already in the save; `keepCharacter`
   * runs only when the player accepts one — so no boot dresses the puppet
   * twice.
   */
  if (characterSelection !== null) renderer.setPlayerAppearance(characterSelection);

  /** Save the character, tell the level, and say which of the two events it was. */
  const keepCharacter = (
    selection: Readonly<Record<string, string>>,
    event: 'character/created' | 'character/changed',
  ): void => {
    characterSelection = { ...selection };
    progress = withCharacter(progress, toPlayerCharacter(characterSelection));
    renderer.setPlayerAppearance(characterSelection);
    examEvents.emit(event);
    persist();
  };

  let session: LevelSession | null = null;

  const shell = createShell(uiHost, {
    store,
    entries,
    stampsToUnlock: rules.unlockRules.stampsToUnlockNext,
    announce,
    ...(progress.lastPlayedLevelId === null ? {} : { resumeLevelId: progress.lastPlayedLevelId }),
    /* Where the map says the player is when it is opened from the title screen.
       `app/ui` never reads the save, so the field is handed to it. */
    lastPlayedLevelId: progress.lastPlayedLevelId,
    onExportSave: exportSave,
    saveTransfer,
    creator: {
      slots: creatorSlots,
      required: progress.character === null,
      /* The saved character, repaired — and **nothing at all** on a first run,
         which is the shell's cue to draw one and hold it for the sitting
         (ADR-0053, rule 3). `initialSelection` has always been optional and
         `openingSelection()` has always handled its absence; what changed is
         that this file stopped filling it in. */
      ...(characterSelection === null ? {} : { initialSelection: characterSelection }),
      optionRepaired: repairedCharacter?.repaired === true,
      /* The picture beside the words (ADR-0040): the level's sprite puppet in a
         2D canvas, loaded when the creator opens and released when it closes. */
      art: creatorArt(createCharacterPreview),
    },
    /*
     * The stream the first-run draw is made from (ADR-0053, rule 3).
     *
     * The draw is the screen's, and it is still seeded from here: `app/ui` has
     * no source of its own and would otherwise fall back to an unseeded
     * `Math.random`, which would make the one draw in the game that decides what
     * a player looks like the one draw that cannot be replayed from a seed.
     * `random.fork('character')` is the same stream a saved character is
     * repaired from, and "Surprise me" draws from it too.
     */
    random: creatorRandom.next,
    /* The player's character in front of the title's landscape (ADR-0041), and
       only ever **the save's** character. A first run draws the landscape alone:
       a face nobody has chosen does not belong on the screen that comes before
       the one where choosing happens (ADR-0053, rule 3; `docs/content-review.md`
       §8.1 read one screen earlier). Read at the call, so a character changed in
       Settings is the one drawn next time. */
    titleFigure: () =>
      characterSelection === null ? Promise.resolve(null) : screenArt.figure(characterSelection),
    /*
     * Two callbacks, not one with a flag (`TN-FIRSTRUN`, ruling 3). The first
     * is the first run and is what the route waits on; the second is Settings,
     * and a listener that re-ran the first-run route on it would take a player
     * who changed their hair back to the level select.
     */
    onCreateCharacter: (selection) => {
      keepCharacter(selection, 'character/created');
    },
    onChangeCharacter: (selection) => {
      keepCharacter(selection, 'character/changed');
    },
    /*
     * A request, not a transition (`TN-FLOW`). The map only draws a control on a
     * card it believes is open, but a save carried in from another build — or a
     * config edited between two sittings — can still ask for a level this build
     * cannot open, and the honest answer is to stay on the map rather than to
     * open a black screen. The card the player pressed keeps focus and says why
     * it cannot be opened, which is the state they were already reading.
     */
    onPlayLevel: (id) => {
      if (!isPlayable(entries, id)) {
        console.error(`[bootstrap] refused to open "${String(id)}": not built, or not unlocked.`);
        return;
      }
      enterLevel(id);
    },
    /*
     * Study, mounted — the option the comment that used to be here described.
     *
     * `app/bootstrap/study.ts` is what goes inside the braces: it owns the
     * screen, the drill and the card, because it needs `studySource`, the live
     * `progress` and the save, none of which `app/ui` may hold (ADR-0005).
     *
     * Into `shell.main`, which is the page's one `<main>` while the shell is
     * showing — a `dialog` is not a landmark, so a modal mounted beside it puts
     * its own content outside every landmark and axe's `region` rule is right to
     * say so. Bracketed with `setModalOpen`, which is the shell's stated
     * contract: two enabled switch rings both answer "tap anywhere".
     */
    /*
     * The passport, from the map (`TN-PASSPORT-01`, `OQ-PASSPORT-3`).
     *
     * The map is its home because the stamp count is already there: "Stamps: 1
     * of 10" is a fact a player wants to open, and the control sits beside it.
     * The title screen deliberately does not offer it — `OQ-TITLE-2` keeps
     * progress off the first screen, and `TN-PASSPORT` agrees — and the level's
     * menu is the other route, for a player who is already inside a level.
     *
     * Mounted into `shell.main`, which is the page's one `<main>` while the shell
     * is showing: a `dialog` is not a landmark, so a modal mounted beside it puts
     * its own content outside every landmark and axe's `region` rule is right to
     * say so. Bracketed with `setModalOpen`, because two enabled switch rings
     * both answer "tap anywhere".
     */
    onOpenPassport: () => {
      /* Rebuilt rather than kept: the entries are a value, the screen has no
         state a player would lose, and a stamp earned since the last opening has
         to be in it. */
      shellPassport?.destroy();
      shellPassport = createPassport(shell.main, {
        locale: store.current.locale,
        entries: entriesNow(),
        announce,
        singleSwitch: store.current.singleSwitch,
        holdMs: store.current.holdToChooseMs,
        /* Each earned stamp, pressed in its level's landmark (ADR-0045). */
        stampArt: (levelId) => screenArt.stampOfLevel(levelId),
        /* `TN-PASSPORT-06`. Drawn from what is already saved, so it is right the
           moment the screen opens; the one thing it cannot know yet is whether
           the bank can run an exam at all, which arrives below. */
        exam: examPanel(examReady),
        onOpenExam: () => {
          shellPassport?.hide();
          shell.setModalOpen(false);
          openExam();
        },
        onBack: () => {
          shellPassport?.hide();
          shell.setModalOpen(false);
        },
      });
      shell.setModalOpen(true);
      shellPassport.show();
      /* Earned stamps not read yet arrive after the screen opens, and redraw it
         once (ADR-0045). Nothing is drawn in their place while they load. */
      const openedPassport = shellPassport;
      void screenArt.learnStamps(earnedIds(entriesNow())).then((learned) => {
        if (learned && shellPassport === openedPassport && openedPassport.visible) {
          openedPassport.setEntries(entriesNow());
        }
      });
      /*
       * Whether the exam can run, asked once and folded in when it answers.
       *
       * The passport opens on what the save knows rather than waiting for the
       * bank: a screen that held itself back for a network call would be a
       * blank passport, and everything above this line is already true.
       */
      void examSource.readiness().then((readiness) => {
        if (!readiness.ok) return;
        examReady = readiness.value.ready;
        shellPassport?.setExam(examPanel(examReady));
      });
    },
    onOpenStudy: openShellStudy,
    /*
     * Exam mode, from the title screen (`TN-EXAM-01`) — and the way back to an
     * exam the player left, because `title-exam` is one control with two labels
     * (`OQ-ATTEMPT-4`).
     *
     * The same seam as Study and for the same reasons: `app/bootstrap/exam.ts`
     * owns the screens because it needs the bank, the live `progress`, the save
     * and the `Clock`, none of which `app/ui` may hold (ADR-0005). Mounted into
     * `shell.main` — the page's one `<main>` while the shell is showing, and a
     * `dialog` is not a landmark — and bracketed with `setModalOpen`, because two
     * enabled switch rings both answer "tap anywhere".
     */
    onOpenExam: openExam,
    examUnfinished: progress.examInProgress !== null,
  });

  /*
   * The update notice's screens (ADR-0034). Drawn first in whichever `<main>`
   * has the page — the level's while one is open, the front door's otherwise —
   * so it is inside the landmark, in the Tab order and in the front door's switch
   * ring, and it never has to take focus to be reached. `rehome` below moves it
   * when the page changes hands. Reloading is this file's to do, not `app/ui`'s.
   */
  deps.updates.attach({
    store,
    announce,
    host: () => session?.hud.main ?? shell.main,
    reload: () => {
      window.location.reload();
    },
  });

  /*
   * The portrait notice (ADR-0060), drawn in the same place and in the language
   * the save has just been read in. It is owed only to a desktop, a laptop or a
   * tablet, and only until the player closes it once on this device; on a phone
   * held upright this call does nothing at all.
   */
  deps.portrait.attach({
    store,
    announce,
    host: () => session?.hud.main ?? shell.main,
  });

  /* Built on the first Study, kept for the session: the drill's `recentlyAsked`
     lives in `studySource` and the screen's is only DOM, but rebuilding the
     screen on every open would throw away a summary the player is reading. */
  let shellStudy: StudyController | null = null;

  function openShellStudy(): void {
    shellStudy ??= createStudyController({
      host: shell.main,
      session: studySource,
      store,
      announce,
      random: optionsRandom,
      record: (question, chosenIndex) => {
        recordAnswer(question, chosenIndex);
      },
      onOpen: () => {
        shell.setModalOpen(true);
        deps.updates.block('study');
      },
      onClose: () => {
        shell.setModalOpen(false);
        deps.updates.unblock('study');
      },
    });
    shellStudy.open();
  }

  /*
   * Exam mode, kept for the session like Study: it holds the questions drawn,
   * the clock and the attempt being taken, and rebuilding it on every open would
   * be rebuilding the exam.
   */
  let shellExam: ExamController | null = null;

  function openExam(): void {
    shellExam ??= createExamController({
      host: shell.main,
      session: examSource,
      store,
      announce,
      clock,
      /* Option order only, and seeded per *attempt* rather than per sitting, so
         an exam picked back up is the paper the player left rather than the
         same questions rearranged (ADR-0059 §3). Never the exam's own draw,
         which is `random.fork('exam')` and must stay a pure function of the
         seed (`TN-EXAM-02`). */
      orderStream: (seed) => createSeededRandom(seed),
      progress: () => progress,
      /* Apply and save in one step, so an answer and the exam it belongs to are
         never written a tick apart (`TN-ATTEMPT-02`). */
      update: (change) => {
        progress = change(progress);
        persist();
      },
      /* The same single write every other answer in the game goes through, with
         no quest supplied — so an exam updates the review schedule and cannot
         advance a quest (`TN-RESULT-05`). */
      record: (question, chosenIndex) => {
        recordAnswer(question, chosenIndex);
      },
      events: examEvents,
      subjects: () =>
        readSubjectIndex((message) => {
          console.error(`[bootstrap] ${message}`);
        }),
      /*
       * "Subjects ready: 1 of 10". The ten come from `journey`, which is the same
       * list the map counts its places from and the passport counts its slots
       * from — `OQ-EXAM-5` asks for the subjects to be declared in
       * `game.config.json`, and until they are, the ten chapters and the ten
       * levels are the same ten and this is the only number in the build that is
       * not invented here.
       */
      subjectsTotal: rules.journey.length,
      storageBlocked: () => storageFailing,
      openSettings: (onClosed) => {
        shell.openSettings(onClosed);
      },
      openStudy: openShellStudy,
      onOpen: () => {
        shell.setModalOpen(true);
        deps.updates.block('exam');
      },
      onClose: () => {
        shell.setModalOpen(false);
        deps.updates.unblock('exam');
      },
      onAttemptChanged: () => {
        shell.setExamUnfinished(progress.examInProgress !== null);
        shellPassport?.setExam(examPanel(examReady));
      },
    });
    shellExam.open();
  }

  /**
   * The practice exam as the passport shows it (`TN-PASSPORT-06`).
   *
   * The **most recent** finished attempt, never the best and never a count of
   * them; an unfinished exam is a route back rather than a result, because an
   * exam nobody finished has no verdict to show. `ready` is `null` until the
   * bank has answered, and a build that cannot run the exam says so instead of
   * offering a control that opens an apology.
   */
  let examReady: boolean | null = null;

  function examPanel(ready: boolean | null): PassportExam {
    const unfinished = progress.examInProgress;
    if (unfinished !== null) {
      return {
        kind: 'unfinished',
        answered: countAnswered(unfinished.answers),
        total: unfinished.answers.length,
      };
    }
    const last = progress.exams.at(-1);
    if (last !== undefined) {
      return {
        kind: 'result',
        passed: last.passed,
        correct: countRight(last.answers),
        total: last.answers.length,
        timed: last.timed,
      };
    }
    return ready === false ? { kind: 'not-ready' } : { kind: 'none' };
  }
  /* The passport is the other way round — it holds nothing a player would lose
     and everything it draws is derived from the save — so it is rebuilt on every
     opening and destroyed with the shell. */
  let shellPassport: Passport | null = null;

  if (storageBlocked) shell.setStorageWarning(true);

  /*
   * The one thing that touches the bank on a normal boot: nothing.
   *
   * `createStudySource` reads glob *keys*, so no question document is on the
   * initial payload and a title screen downloads none of the bank. This probe
   * runs only under `featureFlags.debugOverlay`, which is how the wire can be
   * observed end to end in a browser — "the build can ask N questions" — without
   * spending a learner's first six seconds proving it.
   */
  if (config.debugOverlay) {
    void studySource.available().then((count) => {
      console.warn(
        count.ok
          ? `[bootstrap] question bank ready: ${count.value} question(s) can be asked.`
          : `[bootstrap] question bank unavailable. ${count.error.code}: ${count.error.message}`,
      );
    });
  }

  /* One subscription for every screen that has to follow a setting. The shell
     follows the store itself; everything below is this file's to keep in step. */
  store.subscribe((next, changed) => {
    applyToPage();
    /* `applySettings` has already written `lang` on `<html>`; what is left is
       every screen this file owns, which follows no store of its own. */
    if (changed === 'locale') {
      /* Including the one screen that was on the page before the save was read:
         it follows no store of its own and would otherwise keep the language it
         was built with for the rest of the sitting. */
      deps.rotate.setLocale(next.locale);
      session?.setLocale(next.locale);
      shellPassport?.setLocale(next.locale);
    }
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      session?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      shellPassport?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
    }
    if (changed === 'autoMove') renderer.setAutoMove(next.autoMove);
    if (changed === 'reducedMotion') renderer.setReducedMotion(next.reducedMotion);
    progress = withSettings(progress, toDomainSettings(next, progress.settings));
    persist();
  });

  /* --------------------------------------------------------------- routing */

  function enterLevel(id: LevelId): void {
    if (session !== null) return;

    /*
     * A level this build has no words for is a level this build cannot open.
     *
     * `levelWords` asks the copy table for the three rows both level screens
     * need — the place, the waiting sentence, the failure title — and answers
     * `null` when any is missing. That happens for exactly one kind of id: one
     * no level document declares, arriving from a `?level=` address somebody
     * typed. `TN-WAIT-03` fails the build for a *shipped* level with no rows, so
     * the other case is a build failure caught before a player sees it.
     *
     * `TN-FLOW-05` decides what happens next, and it is not the error card:
     * "no Try again is offered for something that cannot succeed", "the player
     * is taken to, or offered, the level select", "nothing on the screen blames
     * the player". Retrying a level id that does not exist retries nothing, and
     * an error card naming no level — or naming the last level somebody wrote a
     * story for, which is what it used to do — is the defect `TN-WAIT` exists to
     * make impossible. So the player is taken to the map, which is a screen they
     * can act on, and the id goes on the console where developer vocabulary
     * belongs.
     */
    const words = levelWords(id);
    if (words === null) {
      console.error(
        `[bootstrap] refused to open "${String(id)}": this build has no level document ` +
          'and no copy rows for it. Taking the player to the level select (TN-FLOW-05).',
      );
      shell.show('level-select');
      return;
    }

    /* Before `createHud`, and this order is the shell's contract: the shell's
       root is the page's one `<main>` and `createHud` makes another, so the
       first is detached before the second exists. */
    shell.enterLevel(id);
    /* The shell's `<main>` has just been detached, and a modal mounted inside it
       would go with it — still `aria-modal`, still holding the page inert. It is
       destroyed rather than carried, which is `TN-FLOW-08`'s "a screen that has
       been left is removed". */
    shellPassport?.destroy();
    shellPassport = null;
    pause.release('shell');
    root.dataset['tnLevel'] = 'loading';
    /*
     * The dialogue census, on the probe, beside the level's claim census.
     *
     * Build-wide rather than per-level, because that is the scope it was
     * computed at: `readQuests` walks every document once at boot. The numbers
     * do not change between levels, and publishing them on every entry means a
     * scenario that opens any level can read them — the canvas is `aria-hidden`
     * and Playwright cannot read a word of dialogue out of it, so without this
     * "the rejected line was not said" is only assertable by its absence, which
     * is the shape of assertion that passes over a filter that dropped
     * everything.
     *
     * `publish` merges, so the scene's own `level/ready` patch a moment later
     * leaves these standing.
     */
    renderer.sceneProbe?.publish({
      dialogueExamined: questCatalogue.census.examined,
      dialogueDrawable: questCatalogue.census.drawable,
      dialogueRefused: questCatalogue.census.refused.length,
      dialogueBlocks: questCatalogue.census.utterances,
      dialogueSilenced: questCatalogue.census.silenced.length,
      /* Of the lines examined, the four moment lines each quest carries. They
         are in every number above as well; this one says they were read. */
      dialogueMoments: questCatalogue.census.moments,
    });
    /* This level's quests, read once: the session offers them, and the end of
       the level asks whether any of them is done (ADR-0036). */
    const levelQuests = questsForLevel(questCatalogue, id);
    session = openLevel({
      id,
      words,
      screenArt,
      root,
      uiHost,
      gameHost,
      bus,
      milestones,
      onLevelPlayable,
      renderer,
      pause,
      store,
      clock,
      progressNow: () => progress,
      commitProgress: (next) => {
        progress = next;
        persist();
      },
      announce,
      /* `TN-LEVEL-02` and `TN-WAIT-04`: twice the time-to-play budget with no
         level, and a way out appears beside the sentence. The number is
         `budgets.timeToPlayMs` from the config CI measures against, doubled
         here and nowhere else. */
      stallAfterMs: rules.timeToPlayMs * 2,
      quests: levelQuests,
      entries: entriesNow,
      /* One session for the sitting, shared with Study on the front door: see
         `LevelWiring.questions`. */
      questions: studySource,
      /* One library for the sitting: a chapter fetched at a plaque is the same
         chunk Learn will read (ADR-0063 §6). */
      lessons: lessonLibrary,
      record: recordAnswer,
      /* One options stream for the sitting, shared with Study: see
         `LevelWiring.random` (ADR-0059). */
      random: optionsRandom,
      onExportSave: exportSave,
      saveTransfer,
      /*
       * Reaching the end of the level earns its stamp **only when the level's
       * task is done** (ADR-0036).
       *
       * The passport promises "You earn a stamp when you finish a level's task",
       * and this line used to break that promise on every walk: it wrote the
       * stamp on arrival, so the audit's player earned Ottawa's with "You did not
       * answer any questions here" printed underneath. `reachLevelEnd` is the
       * rule — already stamped, no task, or a task done earns; anything else is
       * unfinished — and it is a pure domain function, called directly for the
       * same reason `withSettings` is a few lines up: there is no use case to
       * hold the clock for, and the clock is already here. The stamp stays
       * idempotent, so a level finished twice moves nothing.
       *
       * The unlock rule is not run here and never is in this file: it is
       * `unlockedLevelIds`' over the stamps in the save, and `entriesNow()` asks
       * it fresh. Writing the stamp *is* opening the next level, which is why an
       * unfinished level opens nothing.
       */
      finishLevel: () => {
        const outcome = reachLevelEnd(progress, {
          levelId: id,
          questIds: levelQuests.map((quest) => quest.id),
          now: clock.now(),
        });
        if (outcome.kind === 'finished' && outcome.stampEarned) {
          progress = outcome.progress;
          persist();
        }
        return outcome.kind;
      },
      onLeave: () => {
        leaveLevel();
      },
      onLeaveToLevel: (next) => {
        leaveLevel(next);
      },
      onPlayNextLevel: (next) => {
        playNextLevel(next);
      },
      /*
       * The map's own words about the card that just opened, without the map.
       *
       * `entriesNow()` rather than `entries`: the stamp was written a moment ago
       * and `entries` is the list as it was when this level was entered, which is
       * precisely the list in which the new level is still locked.
       */
      describeNext: (next, forLocale) => {
        const map = {
          locale: forLocale,
          entries: entriesNow(),
          stampsToUnlock: rules.unlockRules.stampsToUnlockNext,
        };
        const description = describeEntry(map, next);
        /*
         * The control is labelled with that level's own `level.<id>.play` row —
         * "Play Québec City" / « Jouer dans la Ville de Québec » — because a
         * label that says what pressing does beats one that says where you would
         * end up, and because the French takes « à » for three of the four built
         * levels and « dans la » for the fourth, so no template is right in both
         * languages (`TN-DONE-04`).
         *
         * A level with no row — every level nobody has written a story for, and
         * level 2, which has no place name on purpose — gets **no route of its
         * own** rather than a button labelled with a number or with another
         * level's words (`TN-DONE-05`).
         */
        const playKey = `level.${String(next)}.play`;
        if (!hasCopyRow(playKey) || description === null) return null;
        /* The map's card exists, and the line on this card is one plain sentence
           rather than the map's three rows joined ("Peggy's Cove. Open. You can
           play this now."), which read like screen-reader text to a sighted
           player. The button beside it names the place. */
        return { label: text(forLocale, playKey), description: text(forLocale, 'level.complete.nextOpen') };
      },
      /*
       * What opened while this level was open.
       *
       * `entriesNow()` re-runs the unlock rule over the stamps in the *current*
       * progress, and `openedWhileIn` compares it with the list taken when the
       * level was entered. A level that was already open before is not news; a
       * level that was not is exactly the thing the player has just earned and
       * has not been told about.
       */
      openedNext: () => openedWhileIn(entriesOnEntry),
    });
    /* The level's `<main>` has the page now: the notices follow it. */
    deps.updates.rehome();
    deps.portrait.rehome();

    /* The snapshot the comparison above is against, taken before a single
       question could have been answered. */
    entriesOnEntry = entries;

    /*
     * `TN-SAVE`'s survives table: the level last played, recorded when it is
     * *entered* rather than when it loads, so a level that fails on a flaky
     * connection is still the one Continue offers next time.
     */
    progress = { ...progress, lastPlayedLevelId: id };
    shell.setResumeLevelId(id);
    shell.setLastPlayedLevelId(id);
    persist();
  }

  /**
   * The map as it was when the current level was entered.
   *
   * Only ever compared against, never rendered. It is what lets "a level opened
   * while you were in there" be a **fact** rather than a guess: two runs of the
   * same pure function over two values of the save.
   */
  let entriesOnEntry: readonly MapEntry[] = entries;

  /** Which level is open now that was not open then, or `null`. */
  function openedWhileIn(before: readonly MapEntry[]): LevelId | null {
    const wasOpen = new Set(
      before.filter((entry) => entry.unlocked && entry.built).map((entry) => entry.id),
    );
    const opened = entriesNow().find(
      (entry) => entry.unlocked && entry.built && entry.id !== undefined && !wasOpen.has(entry.id),
    );
    return opened?.id ?? null;
  }

  /**
   * Take the level down, and leave the shell holding the map.
   *
   * Everything both ways out of a level share, and nothing either of them
   * decides. `false` means there was no level open, which every caller treats as
   * "nothing to do" rather than as a failure — leaving twice is a double tap on
   * a control, not a defect.
   *
   * Split out of {@link leaveLevel} when the completion card gained a route
   * straight into the next level: that route needs the whole teardown and none
   * of the hand-back, because the map it would hand to is a screen the player
   * never sees.
   */
  function teardownLevel(): boolean {
    if (session === null) return false;
    /* The announcements queued by a level describe something the player can no
       longer reach, so they are dropped rather than read over the map. */
    clearAnnouncements();
    session.close();
    session = null;
    /* The canvas goes back where the document put it, then the HUD's `<main>`
       goes — in that order, or the canvas is removed with it. */
    if (canvasParent !== null) canvasParent.insertBefore(gameHost, canvasBefore);
    delete root.dataset['tnLevel'];
    pause.hold('shell');

    /*
     * The map is redrawn *before* the shell hands it back, and the order is
     * `TN-FLOW-03` rather than tidiness: `setEntries` re-renders the whole list,
     * which replaces every card, and a card replaced after focus was put on it
     * takes the player's place with it. So the new state goes in while no list
     * exists, and `leaveLevel` builds it once and lands focus on the card the
     * player just came out of.
     */
    entries = entriesNow();
    shell.setEntries(entries);
    return true;
  }

  function leaveLevel(focusLevelId?: LevelId): void {
    if (!teardownLevel()) return;
    /*
     * After the HUD is destroyed, and it puts the player back on the card they
     * just left rather than at the top of the map (`TN-FLOW-03`) — unless a
     * level opened while they were in there, in which case the news is the new
     * card and that is where they land, announced as open (`TN-MAP-03`).
     *
     * `focusLevelId` comes from the completion card, which asked
     * `openedNext()` while the level was still up. It is checked again here
     * against the list that was just rebuilt, so a card the map does not have
     * falls back rather than focusing nothing.
     */
    const opened = focusLevelId ?? openedWhileIn(entriesOnEntry);
    entriesOnEntry = entries;
    shell.leaveLevel(opened === null ? {} : { focusLevelId: opened });
    /* And back to the front door's, which is attached again. */
    deps.updates.rehome();
    deps.portrait.rehome();
  }

  /**
   * Finish one level and open the next one, without stopping on the map.
   *
   * "Once you reach the end of a level, it should send you to a new level" —
   * this is that sentence, and it is the completion card's primary action. The
   * map is still one tap away on the same card, and leaving the new level still
   * lands on it, so `TN-FLOW`'s one rule — "back always goes one step up the
   * route, and never further" — is untouched.
   *
   * A **request**, checked here rather than trusted, exactly like
   * `onPlayLevel`. The id came from `openedWhileIn`, which already requires the
   * level to be built and unlocked, but the save can be written to between the
   * card being drawn and the button being pressed, and `enterLevel` refuses a
   * level this build has no words for by taking the player to the map — a route
   * that needs the map to be *attached*, which it is not while a level is
   * open. So the refusal happens up here, where the fallback is a real screen:
   * the map, focused on the card that just opened, which is where every other
   * way out of a level lands.
   */
  function playNextLevel(id: LevelId): void {
    if (session === null) return;
    if (!isPlayable(entriesNow(), id) || levelWords(id) === null) {
      console.error(
        `[bootstrap] refused to open "${String(id)}" straight from the level just finished: ` +
          'not built, not unlocked, or this build has no copy rows for it. Taking the ' +
          'player to the map instead (TN-FLOW-05).',
      );
      leaveLevel(id);
      return;
    }
    if (!teardownLevel()) return;
    /* The comparison the *next* level's completion card will be made against.
       `enterLevel` sets it again from the same value; setting it here as well
       keeps the invariant true even on the path that refuses below. */
    entriesOnEntry = entries;
    enterLevel(id);
  }

  const requested = new URLSearchParams(window.location?.search ?? '').get('level');
  if (requested !== null && requested.length > 0) {
    /*
     * The deep link, kept (`OQ-FLOW-3`). It is a real route a player can be sent
     * on, `tests/e2e` drives the shipped artefact through it, and it now leads
     * *back* into the map rather than to a dead end: leaving is `leaveLevel`,
     * not a reload. A level the build does not have still opens and fails to the
     * error card, because "this link is wrong" and "this level is locked" are
     * different answers and only the second belongs on the map.
     */
    enterLevel(requested as LevelId);
  } else {
    shell.start();
  }

  deps.onMounted();

  void renderer.ready.then(() => {
    root.dataset['tnBoot'] = 'ready';
  });
}

/* ------------------------------------------------------------------- a level */

/**
 * What one recorded answer changed that a screen has to react to.
 *
 * Deliberately one field. `answerQuestion` returns six, and the other five —
 * the judgement, whether the question comes back, the quest state, which step
 * closed, whether the quest finished — are already on screen or are nobody's
 * business up here: the card judges and explains, and the quest tracker is not
 * wired. `stampEarned` is the one that changes *the game outside this question*,
 * because it is what opens the next level.
 */
interface AnswerOutcome {
  /** True only on the answer that earned the stamp, never on a repeat. */
  readonly stampEarned: boolean;
  /**
   * Did this answer finish a **quest**?
   *
   * Not the same question as `stampEarned`, and the completion card needs both:
   * the stamp says a level is finished, and this says *how*. "Task done!" over a
   * player who was never offered a task is a claim about something they never
   * did, so the heading follows this field (`TN-DONE`, `OQ-DONE-1`).
   */
  readonly questCompleted: boolean;
  /**
   * Was it right?
   *
   * Not for the card — the card judged the answer before this call and is
   * already saying so. It is for the **completion card**, which has to be able
   * to tell a player who answered three questions from one who walked the length
   * of the level and answered none. A level whose stamp is already held is
   * finished again by reaching its end (ADR-0036), so without this the same card
   * would claim the same thing about two very different sittings, which is the
   * game lying to a learner.
   */
  readonly correct: boolean;
}

interface LevelSession {
  readonly hud: Hud;
  /**
   * The quest an answer would count toward right now, or `undefined`.
   *
   * Read by `recordAnswer` and handed to `answerQuestion`, which is the only
   * thing allowed to advance an `answer` step.
   */
  readonly answeringQuest: QuestDocument | undefined;
  /** An answer was recorded: redraw the tracker from the save. */
  refreshQuest(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs: number): void;
  close(): void;
}

interface LevelWiring {
  readonly id: LevelId;
  /** This level's own three strings, in whatever language is asked for. */
  readonly words: LevelWordsFor;
  /**
   * The quests this level offers, with every line adjudicated under ADR-0003.
   *
   * `SpokenQuest` and not `QuestDocument`: `./verified-dialogue.ts` is the only
   * thing in the program that can produce one, so a line a verifier declined
   * cannot arrive here at all. Handing this the raw output of `readQuest` does
   * not compile, which is the point — it is a receipt, not a filter somebody has
   * to remember to call.
   *
   * An empty list is a normal state and not a failure: no giver, no tracker, and
   * no empty quest log drawn where there is nothing to log.
   */
  readonly quests: readonly SpokenQuest[];
  /**
   * The ten map entries as they are **now**, for the passport opened from the
   * level's menu. A thunk, because a stamp earned a moment ago has to be in it:
   * the list this level was entered with is precisely the list without it.
   */
  readonly entries: () => readonly MapEntry[];
  /** Twice the time-to-play budget: when the waiting screen offers a way out. */
  readonly stallAfterMs: number;
  readonly root: HTMLElement;
  readonly uiHost: HTMLElement;
  readonly gameHost: HTMLElement;
  readonly bus: GameEventBus;
  /** What the level has *finished*: `level/exitReached`, and the two after it. */
  readonly milestones: MilestoneBus;
  /**
   * The level's first playable frame, from the scene's own `create`.
   *
   * Not `loadLevel` resolving: see {@link FrontDoor.onLevelPlayable}. The
   * returned function stops listening and is called when the session closes.
   */
  readonly onLevelPlayable: (listen: (levelId: string) => void) => () => void;
  readonly renderer: GameRenderer;
  readonly pause: PauseControl;
  readonly store: SettingsStore;
  readonly clock: Clock;
  /**
   * The live save, and how to replace it.
   *
   * A getter and a setter rather than a value, because every answer replaces
   * `Progress` and a quest holding a snapshot would fold its steps into a save
   * that stopped growing. `commitProgress` writes and persists; the composition
   * root owns both, because it owns the repository.
   */
  readonly progressNow: () => Progress;
  readonly commitProgress: (progress: Progress) => void;
  readonly announce: (message: string, lang?: string) => void;
  /**
   * Where a landmark's question comes from, and where Study's drill comes from
   * over a level: **the same session**.
   *
   * One `StudySession` for the whole sitting is what makes `TN-CARD-02`'s "no
   * question is asked twice in that sitting" true across both — it keeps
   * `recentlyAsked` in memory and never persists it — and it is why a player who
   * studies a question and then meets it at a landmark is not asked it again a
   * minute later.
   */
  readonly questions: StudySession;
  /**
   * The one lesson catalogue, behind `chapters()` and `lessons(chapter)`
   * (ADR-0063 §6).
   *
   * Where a `read` step's `{ lesson, passage }` pairs are resolved, and the same
   * catalogue ADR-0061's Learn surface will read a chapter from — one of it, so
   * a passage ADR-0016's clock quarantines leaves the level and leaves Learn in
   * one edit. Lazy by chapter: asking for the index costs nothing and only the
   * chapter a step names is ever fetched, so the corpus stays off the ≤ 8 MB
   * initial payload.
   */
  readonly lessons: LessonLibrary;
  /** Record one answer. See {@link AnswerOutcome} for what comes back and why. */
  readonly record: (question: ShippableQuestion, chosenIndex: number) => AnswerOutcome;
  /**
   * Where each card's option order comes from (ADR-0059).
   *
   * The same stream the front door's Study uses, so the order a question is
   * drawn in keeps moving as the sitting goes on rather than restarting with
   * every level opened.
   */
  readonly random: Randomness;
  readonly onExportSave: () => void;
  /** Settings' "Your progress" section, the same one the title screen's Settings draws (ADR-0046). */
  readonly saveTransfer?: SaveTransferOptions;
  /**
   * The player reached the end of the world: decide what that is worth, write
   * the stamp if it earned one, and say which it was.
   *
   * Called when the player reaches the end of the world, and called by nothing
   * else. It is the caller's because only the caller holds `Progress` and the
   * save. `'finished'` means the stamp is in the passport — earned now, or
   * already — and `'unfinished'` means the level's task is not done and nothing
   * was written (ADR-0036, `reachLevelEnd`). Idempotent in the domain: a level
   * finished twice is one stamp, one unlock and one line in the passport.
   */
  readonly finishLevel: () => 'finished' | 'unfinished';
  readonly onLeave: () => void;
  /**
   * Leave, and land the player on a card other than this level's.
   *
   * Called only from the completion card, and only with a level that has just
   * opened. Every other way out of a level goes through {@link LevelWiring.onLeave}
   * and lands on the card they left (`TN-FLOW-03`).
   */
  readonly onLeaveToLevel: (id: LevelId) => void;
  /**
   * Leave, and open that level straight away, without stopping on the map.
   *
   * "Once you reach the end of a level, it should send you to a new level" —
   * `map.open` is one tap short of that, so the completion card offers the
   * level itself as its primary action. Coherent with `TN-FLOW`: that story's
   * one rule is about *back* ("back always goes one step up the route, and never
   * further"), which is untouched — leaving the new level still lands on the
   * map. The map is not skipped for a first-run player either; they have already
   * come through it to reach this level, which is the reason `TN-FLOW` gives for
   * the creator handing to the map rather than to a level.
   *
   * A request, like `onPlayLevel`: the caller re-checks that the level is built,
   * unlocked and nameable, and falls back to the map rather than opening a black
   * screen.
   */
  readonly onPlayNextLevel: (id: LevelId) => void;
  /**
   * What to say about the level that just opened, in a given language.
   *
   * The caller's, because it is the map's answer and the map is not on the page:
   * `describeEntry` composes "Halifax. Open. You can play this now." out of rows
   * the level select already draws. A sentence naming the newly opened level is
   * a copy row nobody has written; this is the same fact in reviewed words
   * rather than a fourth string invented at the one screen that needed it.
   *
   * `null` for a level this build cannot name — level 2 has a subject line and
   * deliberately no place name — and the card then offers the map alone.
   */
  readonly describeNext: (id: LevelId, locale: UiLocale) => LevelCompleteNext | null;
  /**
   * Which level opened while this one was being played, or `null`.
   *
   * Asked of the caller because it is the caller's arithmetic: `unlockedLevelIds`
   * over the stamps in the save, compared against the same list taken when this
   * level was entered. A level session cannot compute it — it may not run the
   * unlock rule (that is `app/domain`'s) and it does not hold the map.
   */
  readonly openedNext: () => LevelId | null;
  /** The pictures the level's cards draw: its landmarks, its stamp, its speakers (ADR-0041). */
  readonly screenArt: ScreenArt;
}

/**
 * Everything the DOM layer does with a level, in one place.
 *
 * Nothing below reaches into the scene and nothing below is reachable from it.
 * The subscription is the injected function `app/ui/level-events.ts` asks for,
 * and every screen mounted here is mounted into `hud.main` — a `dialog` is not a
 * landmark, so a modal beside `<main>` puts its content outside every landmark
 * and axe's `region` rule is right to complain.
 *
 * ## The learning moment: reach a landmark, learn something, be asked about it
 *
 * This is what a level is *for*, and until now none of it happened. A player
 * could walk the whole of Halifax and be told nothing and asked nothing.
 *
 * The loop, and every step of it is a screen that already existed:
 *
 * ```
 *   poi/entered ──► interact prompt in the HUD, naming the landmark
 *        │
 *   tap the prompt, or tap the landmark (poi/engaged)
 *        │
 *        ▼
 *   poi-card ──── the level's own sourced blurb: the place, in its own words
 *        │  close
 *        ▼
 *   dialogue ───── the current `visit` step's lines, in the speaker's name.
 *        │         Only while a quest is standing on this landmark, and only
 *        │  close  when that step carries any: silence here is a document's
 *        ▼         choice, never a field nobody read.
 *   question-card ─ one question, four options, the answer explained
 *        │  answered and recorded
 *        ▼
 *   back to the level, focus on the prompt
 * ```
 *
 * The card and the dialogue are two surfaces because they are **two voices**. A
 * blurb is the place; a line has a speaker, and on Peggy's Cove and in the North
 * that speaker is the landmark itself (ADR-0029), named from the level's own
 * `pois[].name` by the same resolution the offer used, with no rig, no portrait
 * and no pose anywhere on the path. One surface would give the pair a single
 * accessible name and a single voice.
 *
 * `TN-CARD-01` writes the second half of that in as many words — "the card opens
 * when I engage the landmark" — and `TN-LEVEL-05` writes the first. The level
 * stays paused for the whole chain, because `pause.hold('poi')` is taken when
 * the landmark is engaged and released when the question is done, so one hold
 * covers two dialogs and there is no frame in between where the game moves under
 * an open card.
 *
 * **Every question comes from this level's subject** (ADR-0036, `TN-CARD-01`'s
 * "all from this level's subject"). It used to be drawn from the whole bank,
 * because `SceneLevel` did not carry `subject`, and a play-through found
 * Toronto's streetcar asking about Magna Carta and Halifax's "Answer 2 questions
 * about voting" over a card reading "Question 1 of 1" about the police.
 * `SceneLevel.subject` carries it now, and `./landmark-questions.ts` is the rule:
 * while an `answer` step is being played the landmark asks everything that step
 * has left, and the card counts the step; otherwise it asks one question and
 * draws no counter. Either way a question resting on the sentence the landmark
 * just told is asked first.
 *
 * ## The interact prompt, and the copy gap it is wired around
 *
 * `TN-COPY-06` wants "Talk to the officer" and `app/ui/copy.ts` has no
 * `hud.interact.*` row. The prompt therefore carries **the landmark's own
 * localised name from the level document** — content, verbatim, in the player's
 * language (ADR-0010) — rather than a verb this file would have had to write.
 * It is thinner than the story asks for: a name says what is there and not what
 * pressing does. Reported rather than invented.
 *
 * `TN-LEVEL-08`'s arrival sentence has the same shape and the same answer: the
 * announcement is the **level document's own localised title**, because
 * `announce.arrived.*` does not exist either.
 *
 * Tapping the prompt engages the landmark **here**, not through the scene, and
 * that is what closes `TN-LEVEL-05`'s "tapping the interact prompt does what
 * tapping the target does" without an input port. The DOM already knows what is
 * in reach — `poi/entered` said so — so both routes end in the same
 * {@link engage} call and the scene needs no new outbound wire.
 *
 * ## The waiting screen, which had no caller
 *
 * `createLevelLoading` was built in slice 1, scanned by axe, covered by its own
 * suite — and constructed by nothing under `app/`. A level opened straight into
 * a canvas or into the error card, so no player had ever seen a waiting
 * sentence, and `TN-LEVEL-01`'s "the loading screen shows text, not only a
 * spinner" was unmet on the shipped page while passing in the harness. A screen
 * that is accessible and unreachable is not a screen. It is mounted here now,
 * into `hud.main` with the other modals, shown for the whole of `load()` and
 * hidden by whichever of the two outcomes arrives — so it is never on screen
 * behind a level that has already opened, which is the caption defect again.
 *
 * The three strings it and the error card draw are **this level's**, resolved
 * from `level.<id>.*` by {@link levelWords} and passed as data. Neither screen
 * reads the copy table itself, because a screen that reads a row keyed on no
 * level is a screen that names the wrong one — which is exactly what both did.
 */
function openLevel(wiring: LevelWiring): LevelSession {
  const { id, root, uiHost, gameHost, bus, renderer, pause, store, words } = wiring;
  let locale = store.current.locale;
  /**
   * The browser's own answer to "is there a network" (`Connectivity`, ADR-0034,
   * amended 2026-09-15). `false` only when the browser is sure; a page with no
   * `navigator` at all — the node doubles `tests/unit/bootstrap/` boot this file
   * under — reads as online, which asks nothing and changes nothing.
   */
  const browserConnectivity: Connectivity = {
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  };

  const hud = createHud(uiHost, {
    locale,
    announce: wiring.announce,
    /*
     * `canvasHost` is a composition decision (ADR-0005): the HUD moves `#game`
     * inside the `<main>` it creates, so `<main>` holds the thing the page is
     * *for* rather than being a wrapper invented to satisfy a scanner. The
     * canvas is `aria-hidden` either way.
     */
    canvasHost: gameHost,
    singleSwitch: store.current.singleSwitch,
    holdMs: store.current.holdToChooseMs,
    onPause: () => {
      pause.hold('menu');
    },
    onResume: () => {
      pause.release('menu');
    },
    onOpenSettings: () => {
      openSettings();
    },
    onOpenStudy: () => {
      openStudy();
    },
    onOpenPassport: () => {
      openPassport();
    },
    onOpenAbout: () => {
      openAbout();
    },
    onLeaveLevel: wiring.onLeave,
    onExportSave: wiring.onExportSave,
    /*
     * `TN-LEVEL-05`: tapping the interact prompt does what tapping the target
     * does — and it does it without reaching the scene at all.
     *
     * The route that was planned here was a port: `app/ui` may not import an
     * adapter, this file may not hold a scene, so an `InputPort` with
     * `engageNearest()` would carry the tap across. It is not needed. The DOM
     * already knows what is in reach, because `poi/entered` told it, so the
     * prompt engages the same landmark the canvas would have and both routes end
     * in one function. One less port, one less thing to keep in step, and no
     * outbound call into the adapter.
     */
    onInteract: () => {
      engage(announcer.inReach ?? undefined);
    },
  });

  /**
   * What has been engaged in this sitting.
   *
   * `TN-REACH-03`: a target already used says "Done. See it again" rather
   * than inviting the player to do it again. Per sitting rather than per save,
   * which is `OQ-REACH-3` answered in the direction that needs no new field in
   * `progress.schema.json` — a document this task may not edit — and which is
   * also the honest one: the sentence is about what *this* visit has covered.
   */
  const engaged = new Set<string>();

  /** Has the one-time hint been raised in this sitting? It never comes back. */
  let hintShown = false;
  /** Is it on screen right now? Only then does a language change redraw it. */
  let hintOnScreen = false;
  /**
   * What a drive is holding the player at rest beside, while the strip says how
   * to go on (ADR-0043), or `null`. See `offStopped`.
   */
  let stopHint: string | null = null;
  /** What that sentence has already been said aloud for, in this sitting. */
  const stopHintSaid = new Set<string>();

  /* Focus follows the page. Without this the control the player pressed on the
     map has just been detached and focus falls to the body (`TN-FLOW-06`). */
  hud.focus();

  /*
   * The strip stays empty until *this* level says how the player moves.
   *
   * `renderer.level` is still the level just left at this point — leaving one
   * level and opening another used to draw the previous level's word for a
   * moment, and `Hud.setMode` treats the first value as the state the player
   * arrived in and the second as a change worth announcing, so a screen-reader
   * user was told they had changed mode when they had only changed level. The
   * label is set once, in `load`, when the document being named is the one that
   * has just arrived. `TN-MOVE-02`: the strip is absent rather than wrong.
   */

  /**
   * The menu hands the level over; it does not keep holding it.
   *
   * `app/ui/menu.ts` is explicit that choosing an item is not a dismissal — "the
   * game does not resume behind an open screen" — so the menu's own `onDismiss`
   * deliberately does not fire, and `pause.release('menu')` with it. The screen
   * that opens is then supposed to own the pause, and it does: it takes its own
   * reason. What nobody did was let go of the *menu's*, so a player who opened
   * Settings from the menu and closed it again was left in a level that had
   * stopped and would not start: `menu` was still held, `data-tn-paused` stayed
   * `true`, and nothing on screen said why.
   *
   * Called by every screen the menu can open, at the moment it takes over. The
   * menu is already closed by then — `choose()` hides it before calling the
   * handler — so this releases a hold on a dialog that is gone rather than
   * resuming a level behind an open one.
   */
  function takeOverFromMenu(): void {
    pause.release('menu');
  }

  let settings: SettingsScreen | null = null;
  function openSettings(): void {
    settings ??= createSettingsScreen(hud.main, {
      store,
      announce: wiring.announce,
      ...(wiring.saveTransfer === undefined ? {} : { saveTransfer: wiring.saveTransfer }),
      onClose: () => {
        settings?.hide();
        pause.release('settings');
        /* Focus is the screen's own: its trap restores to whatever opened it —
           the strip's Settings control, or the menu button the menu restored to
           on its way out. Moving focus here would take that away. */
      },
    });
    takeOverFromMenu();
    pause.hold('settings');
    settings.show();
  }

  /**
   * The passport, over a level, from the menu (`TN-PASSPORT-01`).
   *
   * Rebuilt on every opening: it holds nothing a player would lose, and
   * everything it draws comes from the save, so a stamp earned a minute ago has
   * to be in it. Mounted into `hud.main` with the other modals, so its content is
   * inside the page's one landmark.
   *
   * The pause discipline is the one the menu taught: `takeOverFromMenu` releases
   * the hold the menu took, this screen takes its **own**, and `onBack` releases
   * that one. A screen that borrowed the menu's would leave the level frozen the
   * moment the menu was closed underneath it.
   */
  let passport: Passport | null = null;
  function openPassport(): void {
    passport?.destroy();
    const opened = createPassport(hud.main, {
      locale,
      entries: wiring.entries(),
      announce: wiring.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      /* Each earned stamp, pressed in its level's landmark (ADR-0045). */
      stampArt: (levelId) => wiring.screenArt.stampOfLevel(levelId),
      onBack: () => {
        passport?.hide();
        pause.release('passport');
        /* Focus is the screen's own: its trap restores to the menu button the
           menu restored to on its way out. Moving it here would take that away. */
      },
    });
    passport = opened;
    takeOverFromMenu();
    pause.hold('passport');
    opened.show();
    /* Stamps not read yet arrive after the screen opens, and redraw it once. */
    void wiring.screenArt.learnStamps(earnedIds(wiring.entries())).then((learned) => {
      if (learned && passport === opened && opened.visible) opened.setEntries(wiring.entries());
    });
  }

  /**
   * "About this place": whose land this level stands on
   * (`docs/content-review.md` §10.2).
   *
   * Ten level documents have carried a territorial statement, verified and
   * sourced, since before this file drew a HUD, and until now **not one of them
   * rendered anywhere**. This is the screen §10.2 mandates and the only screen
   * that states one.
   *
   * Three things about the wiring, each of which is the decision rather than the
   * plumbing:
   *
   *  1. **It reads `SceneLevel.about`, never `LevelDocument.territory`.** The
   *     adapter has already run ADR-0003's three conditions over the claim, and
   *     `about` is the verdict: a statement that may be drawn, or a refusal that
   *     carries no nation and no publisher. `./about-this-place.ts` is the whole
   *     mapping and says why each field is dropped.
   *  2. **It is reachable from the pause menu and from nowhere on the way in.**
   *     §10.2 rules out the shape where a player dismisses a card to reach the
   *     game; nothing constructs this panel on level entry, and the item is
   *     absent from every menu that is not over a level, because
   *     `MenuOptions.onOpenAbout` is only wired here.
   *  3. **It holds the level like every other screen the menu opens.** The menu
   *     hands over (`takeOverFromMenu`), the panel takes its own reason, and
   *     closing releases it — the discipline the passport records, and the one
   *     that stops a level being left frozen behind a screen that has gone.
   *
   * Rebuilt on each opening rather than kept: it holds nothing the player would
   * lose, and `renderer.level` is the level that is actually loaded *now*, which
   * a panel built once at `openLevel` time would not be.
   */
  let about: AboutPanel | null = null;
  function openAbout(): void {
    const level = renderer.level;
    /* No level, no place to be about. `takeOverFromMenu` still runs, because the
       menu has already closed itself and something has to give the level back —
       otherwise asking for the panel before the level loaded would leave a
       paused level with nothing on screen to say so. */
    takeOverFromMenu();
    if (level === null) return;

    about?.destroy();
    about = createAboutThisPlace(hud.main, {
      locale,
      announce: wiring.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onClose: () => {
        pause.release('about');
        /* Focus is the panel's own: its trap restores to the menu button the
           menu restored to on its way out. Moving it here would take that away. */
      },
    });
    pause.hold('about');
    about.show(aboutThisPlaceView(level.about, locale, localised));
  }

  /* Study, over a level (`TN-STUDY`, `OQ-STUDY-3`: the same control, from the
     menu here and from the title screen on the front door). Its own controller,
     mounted into this level's `<main>`, over the same session the landmarks draw
     from — so a drill taken on the canal and a question asked at the Peace Tower
     do not repeat each other. */
  let study: StudyController | null = null;
  function openStudy(): void {
    study ??= createStudyController({
      host: hud.main,
      session: wiring.questions,
      store,
      announce: wiring.announce,
      /* The level's own options stream, which is the front door's: a drill taken
         on the canal and a question asked at the Peace Tower share one sitting
         (ADR-0059). */
      random: wiring.random,
      record: (question, chosenIndex) => {
        wiring.record(question, chosenIndex);
      },
      onOpen: () => {
        takeOverFromMenu();
        pause.hold('study');
      },
      onClose: () => {
        pause.release('study');
        /* The Study screen's trap restores focus to whatever opened it, which is
           the menu button. Nothing to do here. */
      },
    });
    study.open();
  }

  /*
   * The landmark the player is reading about right now, or `null`.
   *
   * Held because the question comes *after* the card is closed, and by then the
   * card no longer knows what it was showing. `null` is what tells
   * {@link askAbout} that the card closed for some other reason — the level being
   * torn down, a language change that rebuilt it — and that nothing should be
   * asked.
   */
  let learning: string | null = null;
  /*
   * The name the landmark's card has just drawn as its heading, or `null`.
   *
   * The question card names the place it is asked (ADR-0045): the level, and the
   * landmark only when its own card has just named it. A giver that is a
   * landmark (Peggy's Cove's lighthouse, the North's sternwheeler) and a
   * landmark whose card was withheld drew no heading, so the question names only
   * the level there, as the completion card does (`TN-DONE`).
   */
  let learningName: LocalizedText | null = null;

  /**
   * What the quest step the player has just finished has to say, waiting for the
   * landmark's card to close.
   *
   * Held for the same reason {@link learning} is: the lines belong to the step
   * that was current when the landmark was engaged, and by the time the card is
   * closed the quest has moved on to the `answer` step, which carries none. The
   * value captured them at the right moment; this is where it waits.
   *
   * `null` means there is nothing owed — no quest running, or a landmark that is
   * not this step's target — and the card closes straight into the question, as
   * it always has.
   */
  let pendingVisit: VisitedOutcome | null = null;

  /**
   * This level session has been closed.
   *
   * Read by the one thing here that can still be waiting when it happens: a
   * lesson chapter downloading behind the reader. Everything else on the
   * landmark chain is synchronous or already guarded by `learning` being
   * nulled, and a screen mounted into a `<main>` that has been removed is a
   * level's worth of DOM behind the map.
   */
  let torndown = false;

  /* A modal over a level pauses it, and closing resumes. The card takes focus
     and is read on arrival, which is why `SPEAKS['poi/engaged']` is `false` —
     announcing it as well would say everything twice. */
  const card = createPoiCard(hud.main, {
    locale,
    announce: wiring.announce,
    singleSwitch: store.current.singleSwitch,
    /* Closing the landmark card does not resume the level: the question comes
       next and the hold carries across both. `askAbout` releases it, on every
       path including the one where there is no question to ask. */
    onClose: () => {
      afterTheCard();
    },
    restoreFocusTo: () => hud.prompt,
  });

  /**
   * The card is closed: the quest's line about this place, and then the question.
   *
   * The order is the argument. The **card** is the place introducing itself —
   * the level document's own verified blurb, with no speaker, and a fact the
   * player can come back for at any time. The **line** is somebody commenting on
   * it: a named speaker, which on Peggy's Cove and in the North is the landmark
   * that offered the task rather than a person, because those levels may draw no
   * figure at any scale. The **question** follows immediately, so the player is
   * taught and asked in one breath, standing in front of the thing.
   *
   * One continuation and no branch here. `speak` calls it back on every path —
   * when the player dismisses the line, and immediately when the step had none —
   * so the question cannot be owed down one route and forgotten down the other.
   * `pause.hold('poi')` covers all three surfaces: the level never runs for a
   * frame in between.
   */
  function afterTheCard(): void {
    const visit = pendingVisit;
    pendingVisit = null;
    if (visit === null) {
      void askAbout();
      return;
    }
    const thenSpeak = (): void => {
      visit.speak(() => {
        void askAbout();
      });
    };
    /*
     * A `read` step's passages, between the place's own card and whatever is
     * said about it. One question — "is there anything to read here?" — and not
     * a branch on the step kind: `VisitedOutcome.passages` is empty on every
     * other kind, and a `read` step carries no `dialogue` (ADR-0063 §3), so the
     * two surfaces never both open and the order below is a sequence rather
     * than a choice.
     */
    if (visit.passages.length === 0) {
      thenSpeak();
      return;
    }
    void openReader(visit.passages, thenSpeak);
  }

  /**
   * The lesson reader: the passages a `read` step named, in the language in
   * force (ADR-0063, `TN-READ`).
   *
   * Built here and not at `openLevel`, like the About panel: most levels never
   * open one, and the surface that draws prose is not worth mounting on every
   * level for the one stop that reads.
   *
   * {@link reading} is held beside it because the screen cannot re-resolve what
   * it was handed — it takes prose, and that is the whole seam — so a language
   * change rebuilds the view from the resolution rather than from the words on
   * the page.
   */
  let reader: LessonReader | null = null;
  let reading: Reading | null = null;
  /** The continuation the reader owes: the step's line, then the question. */
  let afterReading: (() => void) | null = null;

  function readerView(next: UiLocale): LessonReaderView | null {
    return reading === null ? null : lessonReaderView(reading, next, localised);
  }

  /**
   * Resolve a `read` step's references and open the reader on what may be read.
   *
   * `onClosed` is called **exactly once on every path**, which is
   * `VisitedOutcome.speak`'s contract asked of this surface and for the same
   * reason: the question after it must not be owed down one route and forgotten
   * down the other. It is called immediately when the references will not
   * resolve, when every passage they name is unreadable, and when the level went
   * away while a chapter was downloading; otherwise it waits for the player.
   *
   * Nothing here is a player-facing failure. A reference that names nothing is a
   * document defect a player cannot act on, and interrupting a level with it
   * would be worse than the level carrying on — so it goes to the console, where
   * a developer can act on it, exactly as a landmark with no question to ask
   * does. The level stays finishable either way: the step advanced before this
   * ran, because ADR-0063 says whether reading happened is not checkable.
   */
  async function openReader(
    references: readonly LessonPassageReference[],
    onClosed: () => void,
  ): Promise<void> {
    const resolved = await resolveReading(wiring.lessons, references, grantsPassage);
    /* The chapter arrived after the level went: there is nothing to draw on and
       nothing is owed, because `close()` has already dropped what was owed. */
    if (torndown) return;

    if (!resolved.ok) {
      console.error(
        `[bootstrap] a read step's passages could not be shown. ` +
          `${resolved.error.code}: ${resolved.error.message}`,
      );
      onClosed();
      return;
    }
    /* Each passage a verifier will not let a player read, named. Said here and
       not shown: a quarantined paragraph leaves the level the way it leaves
       Learn, by not being in the list (ADR-0063 §6). */
    for (const refusal of resolved.value.refused) {
      console.error(`[bootstrap] a lesson passage is left unread. ${refusal}`);
    }

    reading = resolved.value;
    const view = readerView(locale);
    if (view === null) {
      /* Every passage was refused. Nothing opens — a sheet with a heading and no
         words is a screen the player dismisses having been told nothing
         (ADR-0024) — and the level carries straight on. */
      reading = null;
      onClosed();
      return;
    }

    reader?.destroy();
    reader = createLessonReader(hud.main, {
      locale,
      announce: wiring.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onClose: () => {
        reading = null;
        const owed = afterReading;
        afterReading = null;
        owed?.();
      },
      /* The prompt, like the landmark card's: the plaque on the canvas is
         `aria-hidden` and takes no focus, so the trap would restore to the body. */
      restoreFocusTo: () => hud.prompt,
    });
    afterReading = onClosed;
    reader.show(view);
  }

  /*
   * The landmark's questions — what the task's step has left, or one — then back
   * to the level.
   *
   * The runner is the same one Study uses, at whatever length the draw is
   * (`./landmark-questions.ts`). `TN-STUDY-01`:
   * "answering behaves exactly as it does in a level" — which is only true while
   * there is one implementation of answering, so there is.
   */
  const runner: DrillRunner = createDrillRunner({
    host: hud.main,
    locale,
    announce: wiring.announce,
    singleSwitch: store.current.singleSwitch,
    holdMs: store.current.holdToChooseMs,
    random: wiring.random,
    /* A sheet over the level, as the landmark card before it is (ADR-0045). */
    overLevel: true,
    onAnswer: (question, chosenIndex) => {
      /* Asked before the answer is recorded: once it completes the last step,
         no quest is answering any more, and the card needs to know which did. */
      const answering = quests.answering;
      const outcome = wiring.record(question, chosenIndex);
      answeredHere += 1;
      answeredThisVisit = rememberAnswered(answeredThisVisit, question.id);
      if (outcome.correct) correctHere += 1;
      /* Remembered rather than acted on: the completion card must not open over
         the explanation the player is still reading. It opens when the question
         is done. */
      if (outcome.questCompleted) {
        finishedByQuest = true;
        finishedQuest = spokenQuestFor(answering);
      }
      if (outcome.stampEarned) finished = true;
      /* The tracker counts answers as they are given, and it is behind the card
         the player is still reading — right by the time they close it. */
      quests.refresh();
    },
    onFinished: () => {
      /* The set that came round again is over, so the strip stops saying so. */
      if (askingAgain) {
        askingAgain = false;
        hud.setNotice(null);
      }
      backToTheLevel();
    },
  });

  /**
   * Leave the landmark chain: release its hold, and either open the completion
   * card or put the player back where they were.
   *
   * One function because there are two ways out of that chain — a question that
   * was answered, and a landmark that had no question to ask — and only the
   * first of them used to look at {@link finished}. A level finished while a
   * card was open would have set the flag and never drawn anything.
   */
  function backToTheLevel(): void {
    pause.release('poi');
    if (finished) {
      showCompleted();
      return;
    }
    if (unfinishedOwed) {
      showUnfinished();
      return;
    }
    /* Back where they were. The card's own trap restores to whatever was
       focused when it opened, which is the landmark card that has since gone,
       so the destination is named. */
    const prompt = hud.prompt;
    if (prompt !== null && prompt.isConnected) prompt.focus({ preventScroll: true });
    else hud.focus();
  }

  /**
   * The level is finished and the card is owed.
   *
   * Set by an answer that earned the stamp *and* by reaching the end of the
   * world, and read when there is nothing on screen for the card to open over.
   */
  let finished = false;

  /** Has the completion card been drawn in this sitting of this level? */
  let cardShown = false;

  /**
   * Did the player reach the end with the level's task unfinished, this sitting?
   *
   * ADR-0036. The arrival is latched by the scene and said once; the card that
   * says what is left is drawn once. Finishing the task afterwards still draws
   * "Task done!" — `cardShown` is about that card, and this is not.
   */
  let endReachedUnfinished = false;

  /** The unfinished card is owed, waiting for a card or a question to close. */
  let unfinishedOwed = false;

  /** Which of the two cards {@link completionContent} is resolving words for. */
  let showing: 'finished' | 'unfinished' = 'finished';

  /**
   * Did a **quest** finish this level, as opposed to the player reaching its end?
   *
   * The card's heading is the only thing that reads it, and it is the whole of
   * `OQ-DONE-1`: two paths draw one card, and only one of them may claim a task
   * was done.
   */
  let finishedByQuest = false;

  /**
   * The quest that finished this level, kept from both routes that complete one
   * — the controller's `onCompleted`, and an answer that completes the last
   * step — so the card can draw that quest's own closing line. `null` on the
   * walk to the end, where `completionLine` draws nothing whatever it holds.
   */
  let finishedQuest: SpokenQuest | null = null;

  /** This level's adjudicated quest with that id: never the raw document. */
  const spokenQuestFor = (quest: QuestDocument | undefined): SpokenQuest | null =>
    quest === undefined ? null : (wiring.quests.find((own) => own.id === quest.id) ?? null);

  /** The card's closing line, by the route that finished the level (`TN-DONE`). */
  const doneLineNow = (): CompletionLine =>
    completionLine(
      finishedByQuest && finishedQuest !== null
        ? { by: 'quest', quest: finishedQuest }
        : { by: 'level' },
    );

  /**
   * What the player answered **at this level's landmarks**, this sitting.
   *
   * Not a Study drill taken from the menu over the level: Study reports its own
   * score on its own summary, and folding it in here would let a player answer
   * ten questions in the menu and be told the level taught them. Not the save
   * either — `Progress` counts reviews per question and not per level, and a
   * card claiming "you answered three here" about a sitting three weeks ago
   * would be a different sentence than the one it looks like.
   */
  let answeredHere = 0;
  let correctHere = 0;
  /**
   * Which questions this level visit has answered at its landmarks, most recent
   * first (ADR-0048).
   *
   * Every landmark draw is told, so nothing answered here is asked again while
   * anything else can be: the second live-site audit met the same question at
   * the grain bins and at the combine harvester, because a wrong answer comes due
   * within minutes and the scheduler puts a missed question first. Held with the
   * level, so leaving the level is the end of the visit; answers, not draws, so a
   * card closed unanswered is asked again (`TN-CARD-05`).
   */
  let answeredThisVisit: readonly QuestionId[] = [];
  /** The strip is saying that a task step's questions came round again. */
  let askingAgain = false;

  /**
   * The card that says the level's task is done, and offers the way on.
   *
   * The stamp sentence is `stamp.<id>.earned` for **this** level, looked up by
   * id and passed as data, because only Ottawa's row is written and a level with
   * no row must show the card without that line rather than name another place.
   */
  const completed: LevelComplete = createLevelComplete(hud.main, {
    locale,
    announce: wiring.announce,
    singleSwitch: store.current.singleSwitch,
    holdMs: store.current.holdToChooseMs,
    /* Straight into the level that just opened — what the player asked for.
       Re-asked at the press rather than captured when the card was drawn: the
       save can have changed under an open card. */
    onPlayNext: () => {
      const next = openedByThisLevel();
      /* No new level means the control should not have been drawn; the map is
         the honest fallback rather than a press that does nothing. */
      if (next === null) wiring.onLeave();
      else wiring.onPlayNextLevel(next);
    },
    onChooseLevel: () => {
      const next = openedByThisLevel();
      if (next === null) wiring.onLeave();
      else wiring.onLeaveToLevel(next);
    },
    onKeepPlaying: () => {
      pause.release('complete');
    },
    /*
     * "See my passport", where the stamp just landed (`TN-QUEST-04`,
     * `TN-PASSPORT-01`). It opens over the card rather than replacing it, so the
     * way on the player was reading is still there when they come back — and the
     * card keeps its own pause hold throughout, so the level cannot start moving
     * under two open screens.
     *
     * `OQ-DONE-5` is open on whether this control belongs here at all. Two
     * stories assert it and one recommends against it; it is here because the
     * stamp is the reward and this is the moment it was earned, and removing it
     * is deleting these six lines.
     */
    onOpenPassport: () => {
      openPassport();
    },
    /*
     * Where focus goes when the card closes back into the level.
     *
     * The card's trap restores to whatever opened it, and the thing that opens
     * it now is **the end of the world** — published by a canvas that is
     * `aria-hidden` and holds no focus, so the trap would restore to `<body>`.
     * The HUD's `<main>` is a real destination — programmatically focusable,
     * never in the Tab order — and it is on the page for as long as the level
     * is. It is exactly where `Hud.focus` puts a player arriving from the map.
     */
    restoreFocusTo: () => hud.main,
  });

  /**
   * Everything the completion card says, resolved in whatever language is in
   * force when it is asked — including after the player changes language with
   * the card open.
   *
   * Three lines, each of which is drawn only while it is **true**:
   *
   *  - the stamp sentence, `stamp.<id>.earned`, for levels this build has a row
   *    for. Only Ottawa has one; a level without draws no stamp line rather than
   *    naming another place;
   *  - what the player answered here. `study.summary.score` is the row — the
   *    same sentence, about the same fact, that the Study summary draws, reused
   *    rather than reworded exactly as `passport.state.earned` is reused by the
   *    map. **Absent when they answered nothing**, which is the whole point:
   *    a level already stamped is finished again at its end, and a card that said
   *    the same thing to
   *    a player who read three landmarks and to one who walked straight past
   *    them would be claiming a subject was learned when nothing was answered;
   *  - the level that just opened, in the map's own words.
   *
   * A purpose-written sentence for the "answered nothing" case is the one string
   * this card wants and does not have. Reported as a copy gap rather than
   * invented here (ADR-0010).
   */
  function completionContent(forLocale: UiLocale): LevelCompleteContent {
    if (showing === 'unfinished') return unfinishedContent(forLocale);
    const stampKey = `stamp.${String(id)}.earned`;
    const next = openedByThisLevel();
    const described = next === null ? null : wiring.describeNext(next, forLocale);
    const done = doneLineNow();
    return {
      /* What finished, which is what the heading is about. `finishedByQuest` is
         set only by an answer that completed a quest; every other route here is
         the level ending, and "Task done!" over a player who accepted no task is
         a claim about something they never did (`TN-DONE`). */
      reason: finishedByQuest ? 'quest' : 'level',
      /* The quest's own closing line, only when a quest finished and a verifier
         granted it. Refused, absent or the walk to the end: no key at all, so
         the card is exactly what it was (`TN-DONE-05`). No speaker name. */
      ...(done.said === 'spoken' ? { doneMessage: localised(done.text, forLocale) } : {}),
      ...(hasCopyRow(stampKey) ? { stampMessage: text(forLocale, stampKey) } : {}),
      /* One slot, two rows, never both and never empty (`TN-DONE-02`). A total
         of zero is what `level.complete.none` *is*, not a value the score row
         renders — so the card can never draw "0 out of 0". */
      progressMessage:
        answeredHere === 0
          ? text(forLocale, 'level.complete.none')
          : text(forLocale, 'level.complete.score', {
              correct: correctHere,
              total: answeredHere,
            }),
      ...(described === null ? {} : { next: described }),
      ...stampArtNow(),
    };
  }

  /**
   * The picture the level's stamp is pressed in the shape of (ADR-0041), as a
   * key to spread: none when the manifest has not got it, so the card draws no
   * stamp rather than an empty ring.
   */
  function stampArtNow(): { readonly stampArt?: string } {
    const level = renderer.level;
    const stampArt = level === null ? null : wiring.screenArt.stampOf(level.pois);
    return stampArt === null ? {} : { stampArt };
  }

  /**
   * Draw the card, once.
   *
   * **Once per sitting of this level**, whichever way the level was finished and
   * however many times it is finished again: walking back over the exit line,
   * or answering the last question of a quest after having already reached the
   * end, must not draw a second card or announce a second time. The stamp is
   * idempotent in the domain and this is the same promise on the screen.
   */
  function showCompleted(): void {
    finished = false;
    if (cardShown) return;
    cardShown = true;
    showing = 'finished';
    /* The task is done: whatever the unfinished card was waiting to say is not
       true any more. */
    unfinishedOwed = false;
    /*
     * The world's half, on every route that finishes a level. `markLevelComplete`
     * once had no caller anywhere in the app, so every affordance in a finished
     * level went on pulsing at a player who had already been given credit; it
     * was then called only on arrival at the end, which since ADR-0036 is the
     * rarer route to a stamp. Idempotent in the scene, and its `level/completed`
     * echo arrives at `reachedTheEnd` after `cardShown` is set, so it draws
     * nothing twice.
     */
    renderer.markLevelComplete();
    /* The card's own reason, not the landmark's. `poi` is taken and released by
       the landmark chain; a dialog that borrowed it could be closed by a chain
       finishing underneath it and leave a live level running behind an open
       card — or, the other way round, leave the level frozen after the card had
       gone. The menu did exactly that once. */
    pause.hold('complete');
    /* The one silence a maintainer has to act on, said once per card rather
       than on every language change the resolver below is asked again for. */
    const done = doneLineNow();
    if (done.said === 'unverified' && finishedQuest !== null) {
      console.error(
        `[bootstrap] "${String(finishedQuest.id)}" draws no closing line on its completion ` +
          `card. ${done.silenced.message}`,
      );
    }
    completed.show(completionContent);
  }

  /**
   * The words on the card at the end of an unfinished level (ADR-0036).
   *
   * Two lines, both true on this route and both in the player's language: the
   * passport's own promise — "You earn a stamp when you finish a level's task" —
   * so the reason there is no stamp is the rule the player was already told, and
   * then what is left. The tracker's line when a task is being played ("Next:
   * Answer 2 questions about voting"); a plain "you have not started it" when
   * none is. No stamp, no score and no next level: nothing was earned.
   */
  function unfinishedContent(forLocale: UiLocale): LevelCompleteContent {
    const task = quests.task;
    return {
      reason: 'unfinished',
      leftMessages: [
        text(forLocale, 'passport.intro'),
        task === null
          ? text(forLocale, 'level.unfinished.notStarted')
          : text(forLocale, 'level.unfinished.next', { step: task }),
      ],
      /* The same stamp, as an outline: what the task is for. */
      ...stampArtNow(),
    };
  }

  /**
   * Draw the card that says what is left, once per sitting.
   *
   * Its own hold, `'complete'`, like the finished card's: keeping playing
   * releases it through the same `onKeepPlaying`, and leaving takes the level
   * down with every hold it had.
   */
  function showUnfinished(): void {
    unfinishedOwed = false;
    if (cardShown) return;
    showing = 'unfinished';
    pause.hold('complete');
    completed.show(completionContent);
  }

  /**
   * The player reached the end of the level.
   *
   * `level/exitReached` is the scene reporting a **position**; this is where it
   * becomes an achievement, which is the split `app/adapters/phaser`'s
   * `level-events.ts` asks for and the reason the decision is here. Since
   * ADR-0036 it is an achievement only when the level's task is done — or the
   * level sets none, or its stamp is already held. Otherwise nothing is written,
   * nothing opens, the world keeps its marks, and the card says what is left.
   * When it is, in order:
   * the stamp goes into the passport (so `unlockedLevelIds` has already opened
   * whatever it opens before anything is drawn), the world is told the level is
   * over so nothing left in it keeps asking to be done, and then — and only
   * then — the card says so.
   *
   * Idempotent at every step: `withStamp` keeps the first moment,
   * `markLevelComplete` returns early, and {@link showCompleted} draws once.
   */
  function reachedTheEnd(): void {
    if (cardShown || endReachedUnfinished) return;
    if (wiring.finishLevel() === 'unfinished') {
      endReachedUnfinished = true;
      /* The same guard as below, for the same reason: a card never opens over
         another card. `backToTheLevel` draws what is owed. */
      if (card.visible || runner.running) {
        unfinishedOwed = true;
        return;
      }
      showUnfinished();
      return;
    }
    /* The world's half — `markLevelComplete` — is `showCompleted`'s, so a level
       finished by its task is told it is over as well as one walked to the end
       (ADR-0036). */
    /* A level cannot advance while a modal is open — the pause stops the scene,
       and the scene is what watches the exit line — so this branch is a guard
       rather than a path. It is here because the failure it prevents is a
       completion card opening on top of a question card, and two traps over one
       `<main>` is not a state any screen recovers from. */
    if (card.visible || runner.running) {
      finished = true;
      return;
    }
    showCompleted();
  }

  /**
   * Which level this one opened, if any.
   *
   * Asked of the *caller*, which is the only place that can answer: whether a
   * level is unlocked is `unlockedLevelIds`' answer over the stamps in the save,
   * and this function runs after the stamp was written. `null` means nothing new
   * opened — the last level in the chain, or a level replayed for a stamp it
   * already had — and the completion card then offers the map without claiming
   * anything about it.
   */
  function openedByThisLevel(): LevelId | null {
    return wiring.openedNext();
  }

  /**
   * What this level places: every character and **every** landmark, including
   * one whose claim a verifier refused.
   *
   * **Refusing a claim withholds the claim, not the landmark.** This used to be
   * built from `teachingPois`, which was right for the card and wrong for
   * naming: Peggy's Point Lighthouse gives Peggy's Cove's quest (ADR-0029), its
   * blurb was rejected, and the resolver was told the level "places nothing
   * called peggys-point-light" — so the quest could not be offered and every
   * line it speaks went unsaid. `levelPlacements` takes the level rather than a
   * list, so which landmarks this means is no longer a choice made here.
   *
   * The card is still built from `teachingPois` in {@link engage}, and that is
   * where the blurb's verdict is enforced; the prompt offers a refused landmark
   * only while it has a quest to give or a step waiting (`promptTargets`).
   *
   * A thunk rather than a value: this is read before `loadLevel` resolves and
   * again after every level change, and a list captured once would be the one
   * from the level just left.
   */
  const placementsNow = (): LevelPlacements | null => levelPlacements(renderer.level);

  /**
   * "Behind you" after the task (`./task-cue.ts`, second live-site audit).
   *
   * The player is taken to stand where the last thing they reached stands, from
   * the spawn on, and the cue is redrawn when reach or the task changes.
   * `questsBuilt` rather than `quests`, so a task drawn while the controller is
   * still being built never reads the controller before it exists.
   */
  const placeX = (targetId: string): number | null => {
    const level = renderer.level;
    if (level === null) return null;
    const bare = bareTargetId(targetId);
    const poi = level.pois.find((candidate) => String(candidate.id) === bare);
    if (poi !== undefined) return poi.position.x;
    const character = level.characters.find((candidate) => String(candidate.characterId) === bare);
    return character?.position.x ?? null;
  };
  const taskCue = createTaskCue(placeX);
  let questsBuilt: QuestController | null = null;
  const refreshTaskCue = (): void => {
    hud.setTaskCue(taskCue.cue(questsBuilt?.taskPlace ?? null));
  };

  /**
   * The quest, from the offer to the stamp (`app/bootstrap/quest.ts`).
   *
   * Built with the level whether or not the level has one: with no quests it
   * offers nothing, tracks nothing and draws nothing, which is the state every
   * level in this build is in today and is not a state anybody has to special-case
   * at a call site.
   *
   * Its own pause reason. A dialogue over a live level is the trap the menu was —
   * whoever takes the level has to give it back on every path out — and borrowing
   * `poi`'s hold would let a landmark chain finishing underneath release a level
   * that an open dialogue was still holding.
   */
  const quests: QuestController = createQuestController({
    levelId: id,
    quests: wiring.quests,
    /* ADR-0029: a giver is named from what the level placed it as — a character
       (`content/characters/<id>.json#/name`) or a point of interest
       (`pois[].name`). A thunk, not a value: this controller is built before
       `loadLevel` resolves, and a level read here would be the one just left. */
    placements: placementsNow,
    host: hud.main,
    /* A character's face, or a landmark's own art for a landmark speaker, and
       never a face for a landmark (ADR-0029, ADR-0041). */
    portraitOf: (speaker) => {
      if (speaker.kind === 'character') return wiring.screenArt.portraitOf(speaker.id);
      const placed = (renderer.level?.pois ?? []).find((candidate) => candidate.id === speaker.id);
      return wiring.screenArt.pictureOf(placed?.artKey);
    },
    store,
    clock: wiring.clock,
    announce: wiring.announce,
    progress: wiring.progressNow,
    commit: wiring.commitProgress,
    setTask: (step) => {
      /* Read after the controller has moved, so the count is the step the line
         names. The indicator draws it while an offer is up (ADR-0066 §2). */
      const position = questsBuilt?.taskPosition ?? null;
      hud.setTask(step, position === null ? {} : { position });
      refreshTaskCue();
    },
    onOpen: () => {
      pause.hold('quest');
    },
    onClose: () => {
      pause.release('quest');
      refreshPrompt();
    },
    onCompleted: (quest) => {
      /* A **task** is what finished, so the card says so — the other route to
         this flag is an answer that completed a quest's last step, which
         `recordAnswer` reports. Reaching the end of the level sets neither. */
      finishedByQuest = true;
      finishedQuest = spokenQuestFor(quest);
      /* The card, not here and not now: `showCompleted` is the one place that
         draws it, once per sitting, whichever way the level was finished. */
      finished = true;
      if (!card.visible && !runner.running) showCompleted();
    },
    /*
     * Accepting a quest whose next step is an `answer` step asks its questions
     * there and then (ADR-0036).
     *
     * Peggy's Cove's lighthouse and the North's sternwheeler open `talk` →
     * `answer`: the giver says "then three questions", the player accepts, and
     * the play-through found the tracker reading "Answer 3 questions" with
     * nothing asked — the count was made up later by whatever landmark came
     * next, on whatever subject. The giver is where the step is, so the giver is
     * where it is asked, through the same chain a landmark uses.
     */
    onAccepted: (quest) => {
      if (quests.answeringStep === undefined) return;
      if (card.visible || runner.running) return;
      learning = bareTargetId(String(quest.giver));
      learningName = null;
      pause.hold('poi');
      void askAbout();
    },
    restoreFocusTo: () => hud.prompt ?? hud.main,
  });
  /* The cue may read the controller from here on, and is drawn once for a task
     the controller may have drawn while it was being built. */
  questsBuilt = quests;
  refreshTaskCue();

  /**
   * What the prompt says about what is in reach, in the language in force now.
   *
   * Every string it can produce is a copy row (`app/ui/interact.ts`): the level
   * document's landmark name never reaches the HUD again, which is both halves of
   * `TN-REACH`'s defect — a button labelled with a noun, and a trade name on a
   * surface `TN-NAMES-04` fails the build for.
   */
  function targetsNow(): Readonly<Record<string, LevelTarget>> {
    return promptTargets(placementsNow(), locale, {
      done: engaged,
      canEngage: (targetId) => quests.canEngage(targetId),
      awaits: (targetId) => quests.awaits(targetId),
      /* A giver whose quest is unfinished, or a landmark a running quest is
         waiting for, is not "done" just because it was engaged (ADR-0039). */
      stillToDo: (targetId) => quests.hasUnfinishedQuest(targetId) || quests.awaits(targetId),
    });
  }

  /** Redraw the offer for whatever is in reach — its wording, or its state. */
  function refreshPrompt(): void {
    const reach = announcer.inReach;
    hud.setPrompt(reach === null ? null : (targetsNow()[reach]?.prompt ?? null));
  }

  /**
   * Engage a landmark or a character: show what it teaches, or let it speak.
   *
   * Both routes in — tapping the subject on the canvas (`poi/engaged`,
   * `npc/engaged`) and tapping the interact prompt in the HUD — end here, so they
   * cannot behave differently. An id the level does not declare opens nothing:
   * the engine and the document disagreeing is not something to render.
   */
  function engage(detail: string | undefined): void {
    if (detail === undefined || card.visible || runner.running || quests.dialogueOpen) return;

    /*
     * A quest giver is a conversation, not a card. Asked first, because a
     * character can also be declared as a point of interest and being spoken to
     * is the more specific answer.
     */
    if (quests.engage(detail)) {
      markEngaged(detail);
      return;
    }

    const level: SceneLevel | null = renderer.level;
    if (level === null) return;
    /*
     * `teachingPois`, not `pois`. A landmark whose claim was refused is not in
     * this list, so there is nothing to open — and because the same list builds
     * the prompt and the reach targets, the player was never offered it in the
     * first place. The lookup failing here is the belt to that braces.
     */
    const poi = level.teachingPois.find((candidate) => candidate.id === bareTargetId(detail));
    if (poi === undefined) {
      /*
       * A landmark with no card: its claim was refused. If the level gives it a
       * quest role and the player is on that step, the step still happens —
       * the quest's own lines, then the question — with the card left out,
       * because the card is the one thing the verdict withheld. Refusing a claim
       * withholds the claim, not the landmark.
       *
       * Anything else is scenery and opens nothing, which is what it always did.
       * `visited` changes nothing when this is not the current step's target.
       */
      const quiet = level.reachablePois.find((candidate) => candidate.id === bareTargetId(detail));
      if (quiet === undefined) return;
      const visit = quests.visited(detail);
      if (!visit.advanced) return;
      markEngaged(detail);
      learning = quiet.id;
      learningName = null;
      pause.hold('poi');
      pendingVisit = visit;
      afterTheCard();
      return;
    }
    markEngaged(detail);
    learning = poi.id;
    learningName = poi.name;
    /* One hold for the whole chain: the landmark card, and the question after
       it. Released by `askAbout` or by the runner finishing. */
    pause.hold('poi');
    /*
     * The `visit` step, when this is the step the player is on. Before the card,
     * so the tracker behind it is already right when the card closes — and the
     * step's own lines come back with it, because by the time the card closes
     * the quest is on the `answer` step and that step has nothing to say.
     */
    pendingVisit = quests.visited(detail);
    /* The landmark's own picture, when the manifest has it: the image the
       level already drew for this point of interest (ADR-0041). No key at
       all otherwise, so the card is exactly the card it was. */
    const art = wiring.screenArt.pictureOf(poi.artKey);
    card.show({
      title: localised(poi.name, locale),
      body: [localised(poi.blurb, locale)],
      ...(art === null ? {} : { art }),
    });
  }

  /**
   * This one has been done.
   *
   * Two consequences, and they are the same fact seen from two sides: the prompt
   * for it becomes "Done. See it again" (`TN-REACH-03`), and the one-time
   * hint has served its purpose and goes for good (`TN-REACH-04`: "it goes as
   * soon as I engage anything, and does not come back in this sitting").
   */
  function markEngaged(detail: string): void {
    engaged.add(bareTargetId(detail));
    /* Every route in ends here, and the prompt's route never passes through
       the scene: without this, a player stopped at a landmark (ADR-0032) closed
       its card and was still held there. */
    renderer.markEngaged(bareTargetId(detail));
    hintShown = true;
    hintOnScreen = false;
    stopHint = null;
    hud.setHint(null);
    refreshPrompt();
  }

  /**
   * The assessment half of the learning moment.
   *
   * A drill from the level's subject (`./landmark-questions.ts`, ADR-0036), from
   * the same session Study draws from, so a landmark never
   * asks what the player has just been asked. A bank that will not load, or that
   * has nothing left to ask, is **not** an error card here: the player is in a
   * level, they have just read something true, and interrupting that with a
   * failure they cannot act on would be worse than the level simply carrying on.
   * It goes to the console, where a developer can act on it.
   */
  async function askAbout(): Promise<void> {
    const about = learning;
    const aboutName = learningName;
    learning = null;
    learningName = null;
    if (about === null) {
      pause.release('poi');
      /* The chain was torn down rather than finished — a language change, the
         level closing — so there is nowhere to put focus and nothing owed. */
      return;
    }

    /* The level's subject, what the step has left, and what this landmark just
       told: `./landmark-questions.ts` says why each (ADR-0036). */
    const level = renderer.level;
    const draw = landmarkDraw({
      levelSubject: level?.subject,
      answering: quests.answeringStep,
      teaches: teachingQuotes(level?.teachingPois, about),
      answeredHere: answeredThisVisit,
    });
    const drawn = await wiring.questions.drill(draw.count, draw.scope);
    if (!drawn.ok || drawn.value.questions.length === 0) {
      if (!drawn.ok) {
        console.error(
          `[bootstrap] no question could be drawn for "${about}". ` +
            `${drawn.error.code}: ${drawn.error.message}`,
        );
      }
      /*
       * `TN-QUEST-05`: an `answer` step that cannot start says so.
       *
       * Only when a quest is waiting on one. A landmark with no question to ask
       * is the level quietly carrying on — the player has just read something
       * true and interrupting that with a failure they cannot act on would be
       * worse — but a player counting to three needs to know why the count is not
       * moving. Said in the strip *and* announced, because every sound has a
       * visual equivalent, and neither blocks: the skater can move away, the
       * tracker still reads "(0 of 3)", and nothing is earned.
       */
      if (quests.answering !== undefined) {
        const message = text(locale, 'quest.noQuestions');
        hud.setNotice(message);
        wiring.announce(message, locale);
      }
      backToTheLevel();
      return;
    }

    /* Whatever the notice was about has stopped being true. */
    hud.setNotice(null);
    /* ADR-0048: a task step whose questions this visit has all answered asks
       again what it answered — and says so, in the strip and aloud, rather than
       let "You have seen this question before" stand as the only word on it. */
    askingAgain = (drawn.value.repeated ?? 0) > 0;
    if (askingAgain) {
      const message = text(locale, 'quest.askedAgain');
      hud.setNotice(message);
      wiring.announce(message, locale);
    }
    /* A short bank asks fewer than the step has left (`TN-QUEST-05`), and the
       card never counts to a question that is not coming. */
    /* Where the questions are asked, for the card's place line (ADR-0045): the
       map's name for this level, then the landmark's own heading when its card
       has just drawn it. Resolved per language, so a language change is right on
       the next question. */
    const levelId = level === null ? null : String(level.id);
    const placeFor = (which: UiLocale): readonly string[] => {
      const names: string[] = [];
      const titleKey = levelId === null ? '' : `level.${levelId}.title`;
      if (hasCopyRow(titleKey)) names.push(text(which, titleKey));
      if (aboutName !== null) names.push(localised(aboutName, which));
      return names;
    };
    runner.start(
      drawn.value.questions,
      counterForDrawn(draw, drawn.value.questions.length),
      placeFor,
    );
  }

  /*
   * The waiting screen (`TN-LEVEL-01`, `TN-WAIT-01`), in `hud.main` like every
   * other modal so its content sits inside the one landmark.
   *
   * Its two strings are this level's and are required options: the sentence
   * names the work *this* level is doing, and a screen that waits without saying
   * what for is the defect the story was written against. "Go back" is the same
   * route the error card's is — the map, not a reload — and it appears beside
   * the sentence after `stallAfterMs` rather than in place of it.
   */
  const loading = createLevelLoading(hud.main, {
    locale,
    title: words(locale).title,
    message: words(locale).loading,
    onBack: wiring.onLeave,
    stallAfterMs: wiring.stallAfterMs,
    singleSwitch: store.current.singleSwitch,
    holdMs: store.current.holdToChooseMs,
  });

  /*
   * `TN-WAIT-05`: the waiting sentence is read by the live region once, when the
   * level starts loading, and is not repeated while the load continues. A retry
   * does not say it again either — the dialog takes focus when it comes back, so
   * a screen reader reads it on arrival, and a live region that repeats what a
   * dialog has just said is the double-speaking this file avoids elsewhere.
   */
  let waitAnnounced = false;
  const announceWait = (): void => {
    if (waitAnnounced) return;
    waitAnnounced = true;
    wiring.announce(words(locale).loading, locale);
  };

  const failure = createLevelError(hud.main, {
    locale,
    /* This level's title, never a row keyed on no level: "A failure never names
       another level" (`TN-WAIT-02`). */
    title: words(locale).errorTitle,
    singleSwitch: store.current.singleSwitch,
    /* Both ways out stay inside the page now. "Go back" is the map, not a
       reload of a URL with the level stripped off it, and "Try again" re-opens
       the same level rather than re-downloading the whole application. */
    onBack: wiring.onLeave,
    onRetry: () => {
      failure.hide();
      void load();
    },
  });

  const announcer = createLevelAnnouncer(levelEventSource(bus), {
    locale,
    announce: wiring.announce,
    /* A thunk, for the reason `arrival` is one: this subscription exists before
       the level is asked for, and what its landmarks are called is in the
       document that has not arrived yet. */
    targets: targetsNow,
    onPrompt: (target) => {
      hud.setPrompt(target?.prompt ?? null);
      /*
       * The one-time hint (`TN-REACH-04`), the first time anything is in reach.
       *
       * It explains the marks, which are the one affordance a player cannot be
       * told about anywhere else — the level select does not mention them, the
       * menu does not, and the mark itself is a shape. Shown beside the prompt,
       * announced once, and gone for good the moment anything is engaged.
       */
      if (target === null || hintShown) return;
      hintShown = true;
      hintOnScreen = true;
      const message = interactHint(locale);
      hud.setHint(message);
      wiring.announce(message, locale);
    },
    /* A thunk, not a string: this subscription has to exist before the level is
       asked for, or `level/ready` is missed, and the sentence it wants to say is
       the level document's title, which does not exist until the load finishes.
       See `LevelAnnouncerOptions.arrival`. */
    arrival: () => localised(renderer.level?.title, locale),
    /* Read when the failure happens, in the language in force then. */
    failure: () => words(locale).errorTitle,
  });

  const offFailure = bus.on('level/failed', () => {
    failure.show();
    /* The card owns the page now, and it has a ring of its own: "Try again" and
       "Go back" are what a switch reaches, not the strip behind it. */
    syncHudCover();
  });

  /* The player tapped the landmark on the canvas. The other route in is the
     interact prompt, and both end in `engage`. */
  const offEngaged = bus.on('poi/engaged', ({ detail }) => {
    engage(detail);
  });

  /* The other thing a player can tap: a character. `npc/engaged` is declared by
     `app/ui/level-events.ts` and is what a quest giver arrives on; it ends in the
     same `engage` call as a landmark, so the two routes cannot behave
     differently. A build whose scene never publishes it loses nothing — the
     interact prompt reaches the same function. */
  const offNpcEngaged = bus.on('npc/engaged', ({ detail }) => {
    engage(detail);
  });

  /*
   * At a stop, say why the world stopped and how to go on (ADR-0043).
   *
   * A drive — held, auto-move, or a mode that drives itself — comes to rest
   * beside what it holds, and the prompt already offers that (`TN-REACH-07`).
   * Nothing said the halt was on purpose, or how to go on without choosing: a
   * keyboard player at a stop in a live-site audit pressed right fourteen times.
   * So while the player is at rest with something on offer they have not engaged
   * in this sitting, the strip draws `hud.stop.hint` in the hint's place, and the
   * live region says it once per thing per sitting — not once per stop, which a
   * player walking back and forth would hear as a loop (`TN-LEVEL-08`). Moving on
   * takes it away and gives back the one-time hint if that is still owed;
   * engaging takes it away with every other hint (`markEngaged`).
   */
  const offStopped = bus.on('player/stopped', () => {
    const reach = announcer.inReach;
    if (reach === null) return;
    const id = bareTargetId(reach);
    if (engaged.has(id)) return;
    stopHint = id;
    const message = text(locale, 'hud.stop.hint');
    hud.setHint(message);
    if (stopHintSaid.has(id)) return;
    stopHintSaid.add(id);
    wiring.announce(message, locale);
  });
  const offMoved = bus.on('player/moved', () => {
    if (stopHint === null) return;
    stopHint = null;
    hud.setHint(hintOnScreen ? interactHint(locale) : null);
  });

  /* Where the player is, for "Behind you" after the task: the spawn when the
     level arrives, then whatever they last came up to. */
  const offArrivedForCue = bus.on('level/ready', () => {
    taskCue.arrive(renderer.level?.spawn.x ?? null);
    refreshTaskCue();
  });
  const offReachedForCue = bus.on('poi/entered', ({ detail }) => {
    if (detail === undefined) return;
    taskCue.reached(detail);
    refreshTaskCue();
  });

  /**
   * The end of the level, and the two milestones that are not it.
   *
   * `level/exitReached` is the one the player produces by walking: the scene
   * sees the geometry, this file decides what the arrival is worth.
   *
   * `level/completed` comes back the other way — it is the scene's echo of the
   * `markLevelComplete` call {@link reachedTheEnd} makes — and `quest/completed`
   * is one subject in a level finishing, not the level. Both go through the same
   * idempotent entry rather than being ignored: a quest that finishes a level is
   * a route the domain already supports, and if a future scene ever publishes
   * `level/completed` first, the card is drawn once either way.
   *
   * `detail` is the level's id. A milestone naming **another** level is a wiring
   * mistake — one bus, one level open at a time — and it is refused rather than
   * used, because opening the wrong level's completion card would give a player
   * a stamp for somewhere they have not been.
   */
  const offMilestone = wiring.milestones.onAny((event) => {
    const { detail } = event.payload;
    if (detail !== undefined && detail !== `${id}`) {
      console.error(
        `[bootstrap] "${event.type}" arrived for "${detail}" while "${String(id)}" was the ` +
          'open level. Ignored: a milestone for another level cannot be about this one.',
      );
      return;
    }
    switch (event.type) {
      case 'level/exitReached':
      case 'level/completed':
        reachedTheEnd();
        return;
      case 'quest/completed':
        /* One subject finished, not the level. The world has already stopped
           advertising it (`LevelScene.markCompleted`), and the quest tracker
           that would say so is not wired — reported, not faked. */
        return;
      default:
        return;
    }
  });

  /**
   * The card a level shows instead of opening when the browser is offline and
   * the level's art was never kept (ADR-0034, amended 2026-09-15): the level's
   * own error title, its own sentence, and the same two ways on. Built the first
   * time it is needed, which online is never.
   */
  let offline: ReturnType<typeof createLevelError> | null = null;
  const needsConnectionCard = (): ReturnType<typeof createLevelError> => {
    offline ??= createLevelError(hud.main, {
      locale,
      reason: 'needsConnection',
      title: words(locale).errorTitle,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onBack: wiring.onLeave,
      onRetry: () => {
        offline?.hide();
        void load();
      },
    });
    return offline;
  };

  /**
   * Whether anything is over the level right now — which is whether the strip's
   * switch ring may answer a tap (`app/ui/hud.ts`, `setCovered`).
   *
   * Two sources, and both are already facts this file holds rather than a list
   * of screens kept by hand:
   *
   *  - **the pause**, which every surface the player can open over a level takes
   *    a reason on: the menu, a landmark's card and its question, a quest
   *    dialogue, Settings, the passport, "About this place", Study, the
   *    completion card, and the rotate overlay. One watcher covers all ten, and
   *    a screen added later that forgets to pause is a bug with a louder
   *    symptom than this one;
   *  - **the two level screens**, which do *not* pause: the level is not running
   *    yet while it is opening, and there is nothing to pause when it failed to.
   *    They are asked for their own `visible`, so nothing here has to remember
   *    which of the three was last shown.
   */
  function syncHudCover(): void {
    hud.setCovered(
      levelPaused || loading.visible || failure.visible || offline?.visible === true,
    );
  }

  /** What the pause last said. Declared before the watch that writes it. */
  let levelPaused = false;
  const offPause = pause.watch((paused) => {
    levelPaused = paused;
    syncHudCover();
  });

  async function load(): Promise<void> {
    root.dataset['tnLevel'] = 'loading';
    loading.show();
    /* The waiting screen is a dialog over the strip, so the strip stops scanning
       for as long as it is up. It takes no pause: there is no level to pause. */
    syncHudCover();
    announceWait();
    await renderer.ready;
    /*
     * Offline, a level whose art is not all in the browser's cache is not
     * started: it would draw placeholder bands and nothing it is about.
     * `checkLevelAvailability` never asks the cache while the browser is online,
     * and it is not even awaited then, so the online path is the one it was.
     */
    if (!browserConnectivity.isOnline()) {
      const availability = await checkLevelAvailability(
        { connectivity: browserConnectivity, art: renderer },
        `${id}`,
      );
      if (availability.kind === 'needsConnection') {
        loading.hide();
        root.dataset['tnLevel'] = 'failed';
        console.warn(
          `[bootstrap] level "${String(id)}" was not opened: the browser is offline and ` +
            (availability.known
              ? `${String(availability.missing.length)} of its art file(s) are not cached`
              : 'whether its art is cached cannot be told') +
            ' (ADR-0034).',
        );
        needsConnectionCard().show();
        syncHudCover();
        /* The dialog takes focus, so a screen reader reads it on arrival; the one
           live region says it once as well, because `level/failed` is not
           published for a level that was never asked to load. */
        wiring.announce(
          `${words(locale).errorTitle} ${text(locale, 'level.needsConnection.body')}`,
          locale,
        );
        return;
      }
    }
    const result = await renderer.loadLevel(`${id}`);
    if (!result.ok) {
      /* Gone before the error card arrives (`TN-WAIT-02`: "the element
         level-loading is gone"). Two dialogs over one level is a state neither
         story describes, and the one underneath would keep saying the level was
         opening. */
      loading.hide();
      root.dataset['tnLevel'] = 'failed';
      /* The level id belongs here and not in the announcement: it is developer
         vocabulary, and a player hears `app/ui`'s copy instead. */
      console.error(
        `[bootstrap] level "${String(id)}" failed. ${result.error.code}: ${result.error.message}`,
      );
      /* On the bus, not straight to `announce`: `app/ui` owns what a level
         failure sounds like, and the error card subscribes to the same event.
         One fact, one publisher, two listeners — the point of the bus. */
      publishLevelFailed(bus, `${id}`);
      return;
    }
    /*
     * And nothing else. `loadLevel` resolving is **not** the level becoming
     * playable — see {@link levelIsPlayable}, which is what takes the waiting
     * screen down.
     */
  }

  /**
   * The level's first playable frame: the camera is framed, the affordances are
   * built and the keyboard keys exist.
   *
   * `TN-WAIT-01` — "the waiting screen goes when the level is playable" — and
   * this is the line that makes the word *playable* true. It used to run when
   * `loadLevel` resolved, which is one or more frames earlier: Phaser has been
   * handed the scene by then and has not booted it, so the page said "ready",
   * the waiting screen went, and the first key the player pressed reached a
   * scene that did not exist yet. Measured with a 1.5 s delay on the level's
   * textures, that key press was lost two runs in three.
   *
   * Safe to arrive before or after `load()` finishes, and safe to arrive twice:
   * every line is idempotent.
   */
  function levelIsPlayable(): void {
    /* Out of the accessibility tree rather than behind a style rule. */
    loading.hide();
    /* The level is the player's: with one switch, the strip starts scanning now
       — the offer when there is one, then Settings and Menu. */
    syncHudCover();
    root.dataset['tnLevel'] = 'ready';
    /* The side panels are this level's sky and ground now, not the boot
       screen's. Re-applied so a wide window does not frame a level in the
       previous screen's scenery (ADR-0002). */
    applyPageTheme(renderer);
    const label = modeLabel(renderer, locale);
    if (label !== null) hud.setMode(label);
    /*
     * The task the player arrived with (`TN-FLOW-02`, `TN-SAVE-01`): a save with
     * a quest in progress, opened by a reload, Continue, the map or the next
     * level. The HUD is new with this session and the tracker used to be drawn
     * only when a quest moved — an accept, a visit, an answer or a language
     * change — so a returning player saw no task until they engaged something.
     *
     * Drawn, not said. It is the state the level opens in, as the mode is, and
     * `TN-HUD-07` announces a change; the arrival announcement is the one
     * sentence said on arrival. The line is in the tree as text from here, and
     * the next change to it is announced as before, because `setTask` ignores a
     * value it already holds. With no quest being played nothing is drawn.
     */
    const task = quests.task;
    if (task !== null) {
      const position = quests.taskPosition;
      hud.setTask(task, { announce: false, ...(position === null ? {} : { position }) });
      /*
       * And the cue that belongs with it. The resume draw goes straight to the
       * HUD rather than through the controller's `setTask`, which is what
       * refreshes the cue on every other path — so without this line a save left
       * on a stop the player had already walked past would open with "Find the
       * Town Clock" and nothing saying the clock is behind them. Drawn again
       * from `level/ready`, which is where the player's position arrives, so
       * whichever of the two runs first the strip ends up right.
       */
      refreshTaskCue();
    }
  }

  const offPlayable = wiring.onLevelPlayable(() => {
    levelIsPlayable();
    /* The faces of the characters this level places, painted once the level is
       playable and before anyone is spoken to (ADR-0041). In the background:
       a dialogue opened before a face is ready draws the name alone. */
    void wiring.screenArt.paintPortraits(
      (renderer.level?.characters ?? []).map((placed) => String(placed.characterId)),
    );
  });

  /* The manifest the landmark card and the stamp resolve pictures from: the
     file the renderer is about to read, so this is the same request. */
  void wiring.screenArt.prime();
  void load();

  return {
    hud,
    get answeringQuest(): QuestDocument | undefined {
      return quests.answering;
    },
    refreshQuest(): void {
      quests.refresh();
    },
    setLocale(next): void {
      locale = next;
      hud.setLocale(next);
      card.setLocale(next);
      runner.setLocale(next);
      /* The quest before the completion card: the unfinished card's last line is
         the tracker's, and the card re-resolves its words on `setLocale`. */
      quests.setLocale(next);
      completed.setLocale(next);
      passport?.setLocale(next);
      /* The panel cannot re-resolve its own content: the statement is a
         `LocalizedText` on the level document and the refusal is a reason code,
         so both are handed back with the language. A level that has gone leaves
         the panel as it was rather than redrawing it empty. */
      if (about !== null) {
        const level = renderer.level;
        if (level !== null) about.setLocale(next, aboutThisPlaceView(level.about, next, localised));
      }
      /* The reader cannot re-resolve its prose either, and for a stronger
         reason: it was handed words, never references (ADR-0063 §6). The view is
         rebuilt from the resolution that is still held here, so the heading and
         the paragraphs change language together — a French heading over English
         prose is what an optional parameter ships (`TN-READ-03`). */
      const reread = readerView(next);
      if (reader !== null && reread !== null) reader.setLocale(next, reread);
      /* The prompt is a copy row, so it is drawn again in the new language rather
         than left in the old one. `announcer.inReach` is what is actually in
         reach, so nothing is invented and nothing is offered that is not there. */
      refreshPrompt();
      /* The hint follows the language too, but only while it is still on screen:
         `hintOnScreen` is false once anything has been engaged, so a language
         change cannot bring back a hint that has already gone (`TN-REACH-04`). */
      if (stopHint !== null) hud.setHint(text(next, 'hud.stop.hint'));
      else if (hintOnScreen) hud.setHint(interactHint(next));
      /* Both level screens are handed their own strings again, in the new
         language. They cannot look a row up: it is keyed on a level neither of
         them knows the id of. */
      loading.setLocale(next, { title: words(next).title, message: words(next).loading });
      failure.setLocale(next, words(next).errorTitle);
      offline?.setLocale(next, words(next).errorTitle);
      announcer.setLocale(next);
      const label = modeLabel(renderer, next);
      if (label !== null) hud.setMode(label);
      /* The settings screen has no `setLocale`: it subscribes to the store it
         was handed and re-renders itself. */
    },
    setSingleSwitch(enabled, holdMs): void {
      hud.setSingleSwitch(enabled, holdMs);
      card.setSingleSwitch(enabled, holdMs);
      runner.setSingleSwitch(enabled, holdMs);
      completed.setSingleSwitch(enabled, holdMs);
      quests.setSingleSwitch(enabled, holdMs);
      passport?.setSingleSwitch(enabled, holdMs);
      about?.setSingleSwitch(enabled, holdMs);
      reader?.setSingleSwitch(enabled, holdMs);
    },
    close(): void {
      torndown = true;
      offPause();
      offFailure();
      offEngaged();
      offNpcEngaged();
      offStopped();
      offMoved();
      offArrivedForCue();
      offReachedForCue();
      offMilestone();
      offPlayable();
      announcer.destroy();
      /* `learning` first: a landmark card destroyed with a question still owed
         would otherwise draw one over a level that no longer exists. */
      learning = null;
      /* And what a card that will never be closed owed: a line about a landmark
         on a level that is going. */
      pendingVisit = null;
      runner.destroy();
      completed.destroy();
      quests.destroy();
      passport?.destroy();
      passport = null;
      about?.destroy();
      about = null;
      /* And what a reader that will never be closed owed: the line and the
         question that came after a passage on a level that is going. */
      reader?.destroy();
      reader = null;
      reading = null;
      afterReading = null;
      study?.destroy();
      study = null;
      card.destroy();
      loading.destroy();
      failure.destroy();
      offline?.destroy();
      offline = null;
      settings?.destroy();
      settings = null;
      hud.destroy();
      /* The HUD does not remove its own `<main>` — a level reloading over an old
         one is supposed to find it (`findOrCreateMain`). Leaving the level is
         the other case, and a second landmark left on the page behind the map is
         an axe `landmark-one-main` violation and a real ambiguity for a screen
         reader, so the composition root that asked for it takes it away. */
      hud.main.remove();
      pause.release('menu');
      pause.release('poi');
      pause.release('complete');
      pause.release('quest');
      pause.release('passport');
      pause.release('settings');
      pause.release('study');
    },
  };
}

/* --------------------------------------------------------------- a level's words */

/** The three strings a level owns, in one language. */
interface LevelWords {
  /** `level.<id>.title` — the place, and the waiting dialog's accessible name. */
  readonly title: string;
  /** `level.<id>.loading` — "Getting the harbour ready." */
  readonly loading: string;
  /** `level.<id>.error.title` — "We could not load Halifax." */
  readonly errorTitle: string;
}

/** Those three strings, in whichever language is asked for. */
type LevelWordsFor = (locale: UiLocale) => LevelWords;

/**
 * This level's own words, or `null` if this build has none for it.
 *
 * The rows are keyed on the level's id — `level.halifax.loading`,
 * `level.halifax.error.title` — and that shape is the whole fix. There was one
 * `level.loading` and one `level.error.title` in the game, both written when
 * Ottawa was the only level with a story, and the three levels that shipped
 * after it drew them: a player opening Halifax read that the canal was being
 * got ready and, when a load failed, that Ottawa could not be loaded.
 * `TN-WAIT-a-level-opens-or-it-does-not.md` writes one pair per level and
 * refuses the unqualified keys, and this function is where a level id becomes
 * the strings the two screens draw.
 *
 * A **resolver** rather than three strings, because the player can change
 * language without leaving the level: the id is checked once, here, and the
 * screens are handed new strings for the same level as often as they need them.
 *
 * `null` is not a defect this file papers over — see `enterLevel`, which refuses
 * to open a level it cannot name.
 */
function levelWords(id: LevelId): LevelWordsFor | null {
  const titleKey = `level.${String(id)}.title`;
  const loadingKey = `level.${String(id)}.loading`;
  const errorKey = `level.${String(id)}.error.title`;
  /* Asked of the table, never assumed: `id` can come from an address a player
     typed, and `text` is typed total over keys this file builds from data. */
  if (!hasCopyRow(titleKey) || !hasCopyRow(loadingKey) || !hasCopyRow(errorKey)) return null;
  return (locale) => ({
    title: text(locale, titleKey),
    loading: text(locale, loadingKey),
    errorTitle: text(locale, errorKey),
  });
}

/**
 * The mode strip's label — "Walking", « Marche » — or `null`.
 *
 * **The key is the level document's, and the word is `app/ui`'s.** A level
 * declares `locomotion[].labelKey`, which ADR-0010 makes a *key* rather than
 * inline text precisely so that the wording is not the engine's, and
 * `TN-MOVE-locomotion-labels.md` is the table it names. So this function reads
 * the key the document carries rather than assembling one from the mode's id:
 * a document that renames a mode's key and a table that has not caught up
 * produce no label instead of the wrong label.
 *
 * `null` used to be the answer for every mode but `skate`, because the table had
 * one row — which is why the level the game opens on drew an empty paragraph and
 * a screen reader was told nothing about how the player moves. All four declared
 * modes have rows now; `null` is left for the mode nobody has written a label
 * for yet, because `TN-MOVE-02` would rather the strip be absent than say the
 * mode's id, "Mode", or a dash.
 */
function modeLabel(renderer: GameRenderer, locale: UiLocale): string | null {
  const key = renderer.level?.locomotion[0]?.labelKey;
  if (key === undefined || !hasCopyRow(key)) return null;
  return text(locale, key);
}

/* ------------------------------------------------------------------- pausing */

type PauseReason =
  | 'orientation'
  | 'menu'
  | 'poi'
  /** The completion card. Its own reason, never the landmark chain's. */
  | 'complete'
  /**
   * A quest dialogue over a live level.
   *
   * Its own reason for the same argument, and after the same defect: the menu
   * once took the level and never gave it back, so a player who opened Settings
   * from it was left in a level that had stopped and would not start. A dialogue
   * that borrowed `poi`'s hold would be released by a landmark chain finishing
   * underneath it — or, worse, would leave the level frozen after the officer had
   * gone.
   */
  | 'quest'
  /** The passport, opened over a level from the menu. */
  | 'passport'
  /**
   * "About this place", opened over a level from the menu.
   *
   * Its own reason, like every other screen the menu can open. The panel is what
   * `docs/content-review.md` §10.2 calls "always available, never blocking": it
   * blocks nothing because it is never on a route the player has to take, and
   * the level it was opened over is given back untouched when it closes. Nothing
   * in this game counts down outside Exam mode, so a paused level costs a reader
   * nothing at all.
   */
  | 'about'
  | 'settings'
  | 'study'
  | 'shell';

interface PauseControl {
  hold(reason: PauseReason): void;
  release(reason: PauseReason): void;
  /**
   * Hear when the level stops and when it runs again. Returns the unsubscribe.
   *
   * Every surface that can sit over a level takes a reason here — the menu, a
   * landmark's card and its question, a quest dialogue, Settings, the passport,
   * "About this place", Study, the completion card, the rotate overlay — so
   * "something is over the level" is a fact this control already holds, and the
   * HUD's switch ring stands down on exactly that fact rather than on a list of
   * screens somebody has to keep in step (`app/ui/hud.ts`, `setCovered`). The
   * alternative was bracketing eleven call sites, where the one forgotten
   * bracket is two switch rings answering one contact.
   *
   * Notified only when the answer changes, so a second reason taken over the
   * first says nothing.
   */
  watch(listen: (paused: boolean) => void): () => void;
}

function createPauseControl(renderer: GameRenderer, root: HTMLElement): PauseControl {
  const reasons = new Set<PauseReason>();
  const watchers = new Set<(paused: boolean) => void>();
  let was = false;

  const sync = (): void => {
    const paused = reasons.size > 0;
    if (paused) renderer.pause();
    else renderer.resume();
    root.dataset['tnPaused'] = paused ? 'true' : 'false';
    if (paused === was) return;
    was = paused;
    /* A copy, so a listener that unsubscribes while being told does not shorten
       the list being walked. */
    for (const listen of [...watchers]) listen(paused);
  };

  return {
    hold(reason): void {
      if (reasons.has(reason)) return;
      reasons.add(reason);
      sync();
    },
    release(reason): void {
      if (!reasons.delete(reason)) return;
      sync();
    },
    watch(listen): () => void {
      watchers.add(listen);
      return () => {
        watchers.delete(listen);
      };
    },
  };
}

/* ------------------------------------------------------------------ settings */

/**
 * The saved settings as the screens read them, and back again.
 *
 * Two differences, both of them the schema's: the document holds the text scale
 * as a 1–2 multiplier and the screens hold it as a 100–200 percentage, and the
 * document holds four volume levels no screen edits yet. Nothing else is
 * translated, because nothing else differs.
 *
 * `holdToChooseMs` — `TN-SET-09`'s switch hold time — used to have no field in
 * `progress.schema.json`, so it did not survive a reload and a switch user set
 * it again every session. Save format version 2 added it (ADR-0026), and this
 * bridge now carries it in both directions like every other setting.
 */
function toUiSettings(settings: Progress['settings']): UiSettings {
  return {
    locale: toUiLocale(`${settings.locale}`),
    autoMove: settings.autoMove,
    singleSwitch: settings.singleSwitch,
    reducedMotion: settings.reducedMotion,
    highContrast: settings.highContrast,
    dyslexiaFont: settings.dyslexiaFont,
    textScale: Math.round(settings.textScale * 100),
    subtitles: settings.subtitles,
    holdToChooseMs: settings.holdToChooseMs,
  };
}

function toDomainSettings(
  ui: UiSettings,
  previous: Progress['settings'],
): Partial<Progress['settings']> {
  return {
    locale: ui.locale as unknown as LocaleCode,
    autoMove: ui.autoMove,
    singleSwitch: ui.singleSwitch,
    reducedMotion: ui.reducedMotion,
    highContrast: ui.highContrast,
    dyslexiaFont: ui.dyslexiaFont,
    textScale: ui.textScale / 100,
    subtitles: ui.subtitles,
    holdToChooseMs: ui.holdToChooseMs,
    volumes: previous.volumes,
  };
}

/* -------------------------------------------------------------------- shared */

/** A `LocalizedText` in the player's language, falling back to English. */
function localised(value: LocalizedText | undefined, locale: UiLocale): string {
  if (value === undefined) return '';
  return locale === 'fr' ? value.fr : value.en;
}

/** The levels whose stamp is earned, by id: the ones the passport presses (ADR-0045). */
function earnedIds(entries: readonly MapEntry[]): readonly string[] {
  return entries.flatMap((entry) =>
    entry.stamped === true && entry.id !== undefined ? [String(entry.id)] : [],
  );
}

/**
 * Paints the page behind the canvas.
 *
 * This is what makes the desktop side panels: the canvas is FIT-scaled and never
 * stretched, so a wide window leaves letterbox space either side, and the page
 * under it runs the same sky -> ground gradient the scene draws. The two colours
 * come from the same config the renderer used, so they cannot drift.
 */
function applyPageTheme(renderer: GameRenderer): void {
  for (const [name, value] of Object.entries(renderer.cssVariables())) {
    document.documentElement.style.setProperty(name, value);
  }
  /* `renderer.palette`, not the config's: a level may override the theme, and
     the browser chrome should match the sky the player is actually looking at. */
  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute('content', renderer.palette.sky);
}

/** EN and FR ship from the first commit; anything else falls back to EN. */
function toUiLocale(locale: string): UiLocale {
  return locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/**
 * A boot failure is visible and speakable, never a blank canvas. Deliberately
 * developer-facing English: a config that fails validation is a build defect,
 * not something a player can act on.
 *
 * By the time any caller but one reaches here the live region is already in
 * `#ui`, so `announce` speaks through it. The exception is the missing
 * `#game`/`#ui` branch: there is no DOM layer to mount into, so `announce`
 * falls back to `document.body` and the visible notice is dropped. That page is
 * broken beyond anything this file can repair; speaking at all is the win.
 */
function reportFailure(message: string): void {
  document.documentElement.dataset['tnBoot'] = 'failed';
  console.error(`[bootstrap] ${message}`);
  announce(`TrueNorth could not start. ${message}`);

  const uiHost = document.getElementById('ui');
  if (uiHost === null) return;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.setAttribute(
    'style',
    'position:fixed;inset:auto 1rem 1rem 1rem;margin:0;padding:1rem;' +
      'background:#7a1020;color:#ffffff;border-radius:0.5rem;pointer-events:auto;',
  );
  notice.textContent = `TrueNorth could not start: ${message}`;
  uiHost.append(notice);
}

/* `type="module"` scripts are deferred, so the document is parsed by now. */
main();
