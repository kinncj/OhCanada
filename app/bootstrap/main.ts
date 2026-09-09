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

import { bundledQuestionBank } from '@adapters/content';
import { browserIndexedDb, browserLocalStorage, openProgressStore } from '@adapters/persistence';
import { createSeededRandom } from '@adapters/random';
import {
  GameRenderer,
  hasLevel,
  parseBootConfig,
  type BootConfig,
  type SceneLevel,
} from '@adapters/phaser';
import { answerQuestion } from '@application/use-cases/answer-question';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { createStudySession, type StudySession } from '@application/use-cases/study-session';
import type {
  Clock,
  LocalizedText,
  QuestDocument,
  ShippableQuestion,
} from '@application/ports';
import {
  exportProgress,
  loadProgress,
  saveProgress,
  type SaveProgressDeps,
} from '@application/use-cases/save-progress';
import { defaultSettings, withSettings } from '@domain/entities/player';
import {
  newProgress,
  stampedLevelIds,
  withStamp,
  type Progress,
} from '@domain/entities/progress';
import type { EpochMillis, LevelId, LocaleCode } from '@domain/ids';
import { hasCopyRow, text, type UiLocale } from '@ui/copy';
import { createHud, type Hud } from '@ui/hud';
import {
  bareTargetId,
  interactHint,
  interactPrompt,
  type InteractKind,
} from '@ui/interact';
import { createLevelAnnouncer, type LevelTarget } from '@ui/level-events';
import {
  createLevelComplete,
  type LevelComplete,
  type LevelCompleteContent,
  type LevelCompleteNext,
} from '@ui/level-complete';
import { createLevelError, createLevelLoading } from '@ui/level-screens';
import { describeEntry, type MapEntry } from '@ui/level-select';
import { announce, clearAnnouncements, mountLiveRegion } from '@ui/live-region';
import { createPassport, type Passport } from '@ui/passport';
import { createPoiCard } from '@ui/poi-card';
import { createRotateOverlay } from '@ui/rotate-overlay';
import {
  applySettings,
  createSettingsStore,
  prefersReducedMotion,
  type Settings as UiSettings,
  type SettingsStore,
} from '@ui/settings';
import { createSettingsScreen, type SettingsScreen } from '@ui/settings-screen';
import { createShell } from '@ui/shell';

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
import { createQuestController, type QuestController } from './quest';
import { readQuests, questsForLevel, type QuestCatalogue } from './quests';
import { createDrillRunner, type DrillRunner } from './quiz';
import { createStudyController, type StudyController } from './study';

/**
 * The config is imported, not fetched. It is on the 6 s time-to-play budget and
 * needed before the first frame, so it is inlined by the bundler and there is no
 * request to wait for and nothing to 404 on a sub-path deploy (ADR-0006).
 * `parseBootConfig` and `readGameRules` still validate it at runtime:
 * `make validate-content` guards the repository, these guard the artefact.
 */

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
  });
  applyPageTheme(renderer);

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
  const pause = createPauseControl(renderer, root);

  const overlay = createRotateOverlay(uiHost, {
    locale: toUiLocale(config.defaultLocale),
    onShow: () => {
      pause.hold('orientation');
    },
    onHide: () => {
      pause.release('orientation');
    },
  });

  const syncOrientation = (): void => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    root.dataset['tnMode'] = overlay.sync(width, height);
  };

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
    config,
    rules: rules.value,
    onMounted: syncOrientation,
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
  readonly config: BootConfig;
  readonly rules: GameRules;
  /** Called once the DOM layer is on the page. See the note at the call site. */
  readonly onMounted: () => void;
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
  const { root, uiHost, gameHost, bus, milestones, renderer, pause, config, rules } = deps;
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
  if (!loaded.ok) {
    console.error(`[bootstrap] the save could not be read. ${loaded.error.code}: ${loaded.error.message}`);
  }

  let progress: Progress =
    loaded.ok && loaded.value !== null
      ? loaded.value
      : newProgress(defaultSettings(config.defaultLocale), rules.unlockRules.initialLevels);

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
  const questCatalogue: QuestCatalogue = readQuests();
  for (const refusal of questCatalogue.refused) {
    console.error(`[bootstrap] a quest document was refused. ${refusal}`);
  }

  const store = createSettingsStore(toUiSettings(progress.settings));
  const applyToPage = (): void => {
    applySettings(document, store.current, prefersReducedMotion(window));
  };
  applyToPage();

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

  /** Write the game down. Nothing waits for it and a failure never stops play. */
  const persist = (): void => {
    void saveProgress(save, progress).then((written) => {
      if (written.ok) return;
      console.error(`[bootstrap] progress was not saved. ${written.error.code}`);
      shell.setStorageWarning(true);
      session?.hud.setStorageWarning(true);
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
   * `TN-TITLE-04` and `TN-HUD-03`: the way out the storage warning has to offer.
   *
   * A `Blob` and an object URL rather than a `data:` URI: a save can be larger
   * than some browsers allow in a URL, and the object URL is revoked as soon as
   * the click has been dispatched.
   */
  const exportSave = (): void => {
    const encoded = exportProgress(save, progress);
    if (!encoded.ok) {
      console.error(`[bootstrap] the save could not be exported. ${encoded.error.code}`);
      return;
    }
    const url = URL.createObjectURL(new Blob([encoded.value], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'truenorth-save.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  let session: LevelSession | null = null;

  const shell = createShell(uiHost, {
    store,
    entries,
    stampsToUnlock: rules.unlockRules.stampsToUnlockNext,
    announce,
    ...(progress.lastPlayedLevelId === null ? {} : { resumeLevelId: progress.lastPlayedLevelId }),
    onExportSave: exportSave,
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
        onBack: () => {
          shellPassport?.hide();
          shell.setModalOpen(false);
        },
      });
      shell.setModalOpen(true);
      shellPassport.show();
    },
    onOpenStudy: () => {
      shellStudy ??= createStudyController({
        host: shell.main,
        session: studySource,
        store,
        announce,
        record: (question, chosenIndex) => {
          recordAnswer(question, chosenIndex);
        },
        onOpen: () => {
          shell.setModalOpen(true);
        },
        onClose: () => {
          shell.setModalOpen(false);
        },
      });
      shellStudy.open();
    },
  });

  /* Built on the first Study, kept for the session: the drill's `recentlyAsked`
     lives in `studySource` and the screen's is only DOM, but rebuilding the
     screen on every open would throw away a summary the player is reading. */
  let shellStudy: StudyController | null = null;
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
      session?.setLocale(next.locale);
      shellPassport?.setLocale(next.locale);
    }
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      session?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      shellPassport?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
    }
    if (changed === 'autoMove') renderer.setAutoMove(next.autoMove);
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
    session = openLevel({
      id,
      words,
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
      quests: questsForLevel(questCatalogue, id),
      entries: entriesNow,
      /* One session for the sitting, shared with Study on the front door: see
         `LevelWiring.questions`. */
      questions: studySource,
      record: recordAnswer,
      onExportSave: exportSave,
      /*
       * Reaching the end of the level earns its stamp.
       *
       * `withStamp` rather than a use case, for the same reason `withSettings`
       * is called directly a few lines up: there is no `finishLevel` use case to
       * hold the clock for, the rule is one pure domain function, and the clock
       * is already here. It is **idempotent by design** — TN-QUEST-04's "exactly
       * one Ottawa stamp however many times the quest is finished" — so a level
       * finished twice moves nothing and opens nothing a second time.
       *
       * The unlock rule is not run here and never is in this file: it is
       * `unlockedLevelIds`' over the stamps in the save, and `entriesNow()` asks
       * it fresh. Writing the stamp *is* opening the next level.
       */
      finishLevel: () => {
        progress = withStamp(progress, id, clock.now());
        persist();
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
        return { label: text(forLocale, playKey), description };
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
   * of the level and answered none. Reaching the end earns the stamp either way,
   * so without this the same card would claim the same thing about two very
   * different sittings, which is the game lying to a learner.
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
   * The quests this level offers. Empty for every level in this build today,
   * which is a normal state and not a failure: no giver, no tracker, and no
   * empty quest log drawn where there is nothing to log.
   */
  readonly quests: readonly QuestDocument[];
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
  /** Record one answer. See {@link AnswerOutcome} for what comes back and why. */
  readonly record: (question: ShippableQuestion, chosenIndex: number) => AnswerOutcome;
  readonly onExportSave: () => void;
  /**
   * The level is finished: write its stamp into the passport.
   *
   * Called when the player reaches the end of the world, and called by nothing
   * else. It is the caller's because only the caller holds `Progress` and the
   * save, and it is **idempotent in the domain** — `withStamp` keeps the first
   * moment rather than moving it, so a level finished twice is one stamp, one
   * unlock and one line in the passport.
   */
  readonly finishLevel: () => void;
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
 *   poi-card ──── the level's own sourced blurb: the learning
 *        │  close
 *        ▼
 *   question-card ─ one question, four options, the answer explained
 *        │  answered and recorded
 *        ▼
 *   back to the level, focus on the prompt
 * ```
 *
 * `TN-CARD-01` writes the second half of that in as many words — "the card opens
 * when I engage the landmark" — and `TN-LEVEL-05` writes the first. The level
 * stays paused for the whole chain, because `pause.hold('poi')` is taken when
 * the landmark is engaged and released when the question is done, so one hold
 * covers two dialogs and there is no frame in between where the game moves under
 * an open card.
 *
 * **The question is drawn from the whole bank, not from this level's subject,
 * and that is a seam gap rather than a choice.** `TN-CARD-01` asks for "all from
 * this level's subject"; `SceneLevel` — what `app/adapters/phaser` hands back for
 * a loaded level — carries `pois` and does not carry `subject`, so this file
 * cannot know which subject to ask for. The draw is the scheduler's, over
 * everything the build can ask, which is a real drill and a narrower claim.
 * Reported; the fix is one field on `SceneLevel` and one line here.
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
   * `TN-REACH-03`: a target already used says "Done. See this one again" rather
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
    passport = createPassport(hud.main, {
      locale,
      entries: wiring.entries(),
      announce: wiring.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onBack: () => {
        passport?.hide();
        pause.release('passport');
        /* Focus is the screen's own: its trap restores to the menu button the
           menu restored to on its way out. Moving it here would take that away. */
      },
    });
    takeOverFromMenu();
    pause.hold('passport');
    passport.show();
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
      void askAbout();
    },
    restoreFocusTo: () => hud.prompt,
  });

  /*
   * One question about the landmark just read, then back to the level.
   *
   * The runner is the same one Study uses, at a length of one. `TN-STUDY-01`:
   * "answering behaves exactly as it does in a level" — which is only true while
   * there is one implementation of answering, so there is.
   */
  const runner: DrillRunner = createDrillRunner({
    host: hud.main,
    locale,
    announce: wiring.announce,
    singleSwitch: store.current.singleSwitch,
    holdMs: store.current.holdToChooseMs,
    onAnswer: (question, chosenIndex) => {
      const outcome = wiring.record(question, chosenIndex);
      answeredHere += 1;
      if (outcome.correct) correctHere += 1;
      /* Remembered rather than acted on: the completion card must not open over
         the explanation the player is still reading. It opens when the question
         is done. */
      if (outcome.questCompleted) finishedByQuest = true;
      if (outcome.stampEarned) finished = true;
      /* The tracker counts answers as they are given, and it is behind the card
         the player is still reading — right by the time they close it. */
      quests.refresh();
    },
    onFinished: () => {
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
   * Did a **quest** finish this level, as opposed to the player reaching its end?
   *
   * The card's heading is the only thing that reads it, and it is the whole of
   * `OQ-DONE-1`: two paths draw one card, and only one of them may claim a task
   * was done.
   */
  let finishedByQuest = false;

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
   *    reaching the end earns the stamp, and a card that said the same thing to
   *    a player who read three landmarks and to one who walked straight past
   *    them would be claiming a subject was learned when nothing was answered;
   *  - the level that just opened, in the map's own words.
   *
   * A purpose-written sentence for the "answered nothing" case is the one string
   * this card wants and does not have. Reported as a copy gap rather than
   * invented here (ADR-0010).
   */
  function completionContent(forLocale: UiLocale): LevelCompleteContent {
    const stampKey = `stamp.${String(id)}.earned`;
    const next = openedByThisLevel();
    const described = next === null ? null : wiring.describeNext(next, forLocale);
    return {
      /* What finished, which is what the heading is about. `finishedByQuest` is
         set only by an answer that completed a quest; every other route here is
         the level ending, and "Task done!" over a player who accepted no task is
         a claim about something they never did (`TN-DONE`). */
      reason: finishedByQuest ? 'quest' : 'level',
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
    };
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
    /* The card's own reason, not the landmark's. `poi` is taken and released by
       the landmark chain; a dialog that borrowed it could be closed by a chain
       finishing underneath it and leave a live level running behind an open
       card — or, the other way round, leave the level frozen after the card had
       gone. The menu did exactly that once. */
    pause.hold('complete');
    completed.show(completionContent);
  }

  /**
   * The player reached the end of the level.
   *
   * `level/exitReached` is the scene reporting a **position**; this is where it
   * becomes an achievement, which is the split `app/adapters/phaser`'s
   * `level-events.ts` asks for and the reason the decision is here. In order:
   * the stamp goes into the passport (so `unlockedLevelIds` has already opened
   * whatever it opens before anything is drawn), the world is told the level is
   * over so nothing left in it keeps asking to be done, and then — and only
   * then — the card says so.
   *
   * Idempotent at every step: `withStamp` keeps the first moment,
   * `markLevelComplete` returns early, and {@link showCompleted} draws once.
   */
  function reachedTheEnd(): void {
    if (cardShown) return;
    wiring.finishLevel();
    /*
     * The world's half. `markLevelComplete` had no caller anywhere in the app —
     * a capability nothing composed, which is the shape this project keeps
     * finding — so every affordance in a finished level went on pulsing at a
     * player who had already been given credit for it.
     */
    renderer.markLevelComplete();
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
    host: hud.main,
    store,
    clock: wiring.clock,
    announce: wiring.announce,
    progress: wiring.progressNow,
    commit: wiring.commitProgress,
    setTask: (step) => {
      hud.setTask(step);
    },
    onOpen: () => {
      pause.hold('quest');
    },
    onClose: () => {
      pause.release('quest');
      refreshPrompt();
    },
    onCompleted: () => {
      /* A **task** is what finished, so the card says so — the other route to
         this flag is an answer that completed a quest's last step, which
         `recordAnswer` reports. Reaching the end of the level sets neither. */
      finishedByQuest = true;
      /* The card, not here and not now: `showCompleted` is the one place that
         draws it, once per sitting, whichever way the level was finished. */
      finished = true;
      if (!card.visible && !runner.running) showCompleted();
    },
    restoreFocusTo: () => hud.prompt ?? hud.main,
  });

  /**
   * What the prompt says about what is in reach, in the language in force now.
   *
   * Every string it can produce is a copy row (`app/ui/interact.ts`): the level
   * document's landmark name never reaches the HUD again, which is both halves of
   * `TN-REACH`'s defect — a button labelled with a noun, and a trade name on a
   * surface `TN-NAMES-04` fails the build for.
   */
  function targetsNow(): Readonly<Record<string, LevelTarget>> {
    return promptTargets(renderer.level, locale, {
      done: engaged,
      canEngage: (targetId) => quests.canEngage(targetId),
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
    const poi = level.pois.find((candidate) => candidate.id === bareTargetId(detail));
    if (poi === undefined) return;
    markEngaged(detail);
    learning = poi.id;
    /* One hold for the whole chain: the landmark card, and the question after
       it. Released by `askAbout` or by the runner finishing. */
    pause.hold('poi');
    /* The `visit` step, when this is the step the player is on. Before the card,
       so the tracker behind it is already right when the card closes. */
    quests.visited(detail);
    card.show({ title: localised(poi.name, locale), body: [localised(poi.blurb, locale)] });
  }

  /**
   * This one has been done.
   *
   * Two consequences, and they are the same fact seen from two sides: the prompt
   * for it becomes "Done. See this one again" (`TN-REACH-03`), and the one-time
   * hint has served its purpose and goes for good (`TN-REACH-04`: "it goes as
   * soon as I engage anything, and does not come back in this sitting").
   */
  function markEngaged(detail: string): void {
    engaged.add(bareTargetId(detail));
    hintShown = true;
    hintOnScreen = false;
    hud.setHint(null);
    refreshPrompt();
  }

  /**
   * The assessment half of the learning moment.
   *
   * A drill of one, from the same session Study draws from, so a landmark never
   * asks what the player has just been asked. A bank that will not load, or that
   * has nothing left to ask, is **not** an error card here: the player is in a
   * level, they have just read something true, and interrupting that with a
   * failure they cannot act on would be worse than the level simply carrying on.
   * It goes to the console, where a developer can act on it.
   */
  async function askAbout(): Promise<void> {
    const about = learning;
    learning = null;
    if (about === null) {
      pause.release('poi');
      /* The chain was torn down rather than finished — a language change, the
         level closing — so there is nowhere to put focus and nothing owed. */
      return;
    }

    const drawn = await wiring.questions.drill(1);
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
    runner.start(drawn.value.questions);
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

  async function load(): Promise<void> {
    root.dataset['tnLevel'] = 'loading';
    loading.show();
    announceWait();
    await renderer.ready;
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
    root.dataset['tnLevel'] = 'ready';
    /* The side panels are this level's sky and ground now, not the boot
       screen's. Re-applied so a wide window does not frame a level in the
       previous screen's scenery (ADR-0002). */
    applyPageTheme(renderer);
    const label = modeLabel(renderer, locale);
    if (label !== null) hud.setMode(label);
  }

  const offPlayable = wiring.onLevelPlayable(() => {
    levelIsPlayable();
  });

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
      completed.setLocale(next);
      quests.setLocale(next);
      passport?.setLocale(next);
      /* The prompt is a copy row, so it is drawn again in the new language rather
         than left in the old one. `announcer.inReach` is what is actually in
         reach, so nothing is invented and nothing is offered that is not there. */
      refreshPrompt();
      /* The hint follows the language too, but only while it is still on screen:
         `hintOnScreen` is false once anything has been engaged, so a language
         change cannot bring back a hint that has already gone (`TN-REACH-04`). */
      if (hintOnScreen) hud.setHint(interactHint(next));
      /* Both level screens are handed their own strings again, in the new
         language. They cannot look a row up: it is keyed on a level neither of
         them knows the id of. */
      loading.setLocale(next, { title: words(next).title, message: words(next).loading });
      failure.setLocale(next, words(next).errorTitle);
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
    },
    close(): void {
      offFailure();
      offEngaged();
      offNpcEngaged();
      offMilestone();
      offPlayable();
      announcer.destroy();
      /* `learning` first: a landmark card destroyed with a question still owed
         would otherwise draw one over a level that no longer exists. */
      learning = null;
      runner.destroy();
      completed.destroy();
      quests.destroy();
      passport?.destroy();
      passport = null;
      study?.destroy();
      study = null;
      card.destroy();
      loading.destroy();
      failure.destroy();
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
  | 'settings'
  | 'study'
  | 'shell';

interface PauseControl {
  hold(reason: PauseReason): void;
  release(reason: PauseReason): void;
}

function createPauseControl(renderer: GameRenderer, root: HTMLElement): PauseControl {
  const reasons = new Set<PauseReason>();

  const sync = (): void => {
    const paused = reasons.size > 0;
    if (paused) renderer.pause();
    else renderer.resume();
    root.dataset['tnPaused'] = paused ? 'true' : 'false';
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

/**
 * What the interact prompt says about everything a level can put in reach.
 *
 * **This function is where the defect was.** It used to answer with the
 * landmark's own localised name from the level document, because
 * `app/ui/copy.ts` had no `hud.interact.*` row — so a player riding through
 * Toronto read "CN Tower" in the HUD. Two things were wrong with that: a noun
 * says what is *there* rather than what choosing it will do, and `TN-NAMES-04`
 * fails the build for a name from its list drawn by the HUD. It got past that
 * check because the name was never a copy string; it was content, interpolated
 * here, at runtime.
 *
 * Every string it can now produce comes from the copy table, through
 * `app/ui/interact.ts`, which holds the whole precedence: **done** beats a
 * level's own per-target row, which beats the kind. A target with no row at all
 * offers `null`, and the announcer draws no prompt for it — never "Interact",
 * never a name, never an empty string (`TN-REACH-05`).
 *
 * ## Both spellings of an id, on purpose
 *
 * The stories write a subject two ways — `poi/entered` for `npc.officer`, and a
 * level document that calls the same character `officer` — and a copy row is
 * keyed on the document's id. Both are registered, so whichever spelling the
 * scene sends finds the same target rather than silently offering nothing.
 *
 * A level that has not loaded has nothing in reach, which is the correct answer
 * rather than a special case.
 */
function promptTargets(
  level: SceneLevel | null,
  locale: UiLocale,
  state: {
    /** Bare ids engaged in this sitting. */
    readonly done: ReadonlySet<string>;
    /**
     * Would choosing this target open a dialogue?
     *
     * Two things at once, and both matter: it says a character is a person to
     * *talk to* rather than a place to look at, and it says whether talking to
     * them can happen at all. A character who is not a quest giver, or whose
     * name this build has no row for, cannot be spoken to — and a prompt that
     * opens nothing is the dead control this project keeps finding.
     */
    readonly canEngage: (targetId: string) => boolean;
  },
): Readonly<Record<string, LevelTarget>> {
  if (level === null) return {};

  const targets: Record<string, LevelTarget> = {};

  const offer = (rawId: string, kind: InteractKind): void => {
    const bare = bareTargetId(rawId);
    const prompt = interactPrompt(locale, { id: bare, kind, done: state.done.has(bare) });
    /* No row, no offer. The alternative is a button whose label this file would
       have had to make up, which is the whole of `TN-REACH`'s defect. */
    if (prompt === null) return;
    const target: LevelTarget = { prompt };
    targets[bare] = target;
    targets[`${kind}.${bare}`] = target;
  };

  /*
   * A character is offered only while there is something for them to say, and a
   * point of interest is always offered because it always has a card. A
   * character who stands on a point of interest is a person: being spoken to is
   * the more specific thing choosing them does.
   */
  for (const character of level.characters) {
    if (state.canEngage(`${character.characterId}`)) offer(`${character.characterId}`, 'npc');
  }
  for (const poi of level.pois) {
    offer(poi.id, state.canEngage(poi.id) ? 'npc' : 'poi');
  }

  return targets;
}

/** A `LocalizedText` in the player's language, falling back to English. */
function localised(value: LocalizedText | undefined, locale: UiLocale): string {
  if (value === undefined) return '';
  return locale === 'fr' ? value.fr : value.en;
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
