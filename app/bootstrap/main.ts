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

import { browserLocalStorage, createLocalStorageProgressRepository } from '@adapters/persistence';
import {
  GameRenderer,
  hasLevel,
  parseBootConfig,
  type BootConfig,
  type SceneLevel,
} from '@adapters/phaser';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import type { Clock, LocalizedText } from '@application/ports';
import {
  exportProgress,
  loadProgress,
  saveProgress,
  type SaveProgressDeps,
} from '@application/use-cases/save-progress';
import { defaultSettings, withSettings } from '@domain/entities/player';
import { newProgress, stampedLevelIds, type Progress } from '@domain/entities/progress';
import type { EpochMillis, LevelId, LocaleCode } from '@domain/ids';
import { text, type CopyKey, type UiLocale } from '@ui/copy';
import { createHud, type Hud } from '@ui/hud';
import { createLevelAnnouncer } from '@ui/level-events';
import { createLevelError } from '@ui/level-screens';
import type { MapEntry } from '@ui/level-select';
import { announce, clearAnnouncements, mountLiveRegion } from '@ui/live-region';
import { createPoiCard } from '@ui/poi-card';
import { createRotateOverlay } from '@ui/rotate-overlay';
import {
  applySettings,
  createSettingsStore,
  HOLD_TO_CHOOSE_DEFAULT_MS,
  prefersReducedMotion,
  type Settings as UiSettings,
  type SettingsStore,
} from '@ui/settings';
import { createSettingsScreen, type SettingsScreen } from '@ui/settings-screen';
import { createShell } from '@ui/shell';

import { readGameRules, type GameRules } from './game-rules';
import {
  createGameEventBus,
  levelEventSource,
  publishLevelFailed,
  publishSceneEvent,
  type GameEventBus,
} from './game-events';
import { isPlayable, journeyEntries } from './journey';

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

  const renderer = new GameRenderer({
    parent: gameHost,
    config,
    onLevelEvent: (name, detail) => {
      publishSceneEvent(bus, name, detail);
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
 * place and a screen reader goes quiet. `localStorage` is synchronous, so the
 * wait is one microtask and no frame is lost to it.
 */
async function openFrontDoor(deps: FrontDoor): Promise<void> {
  const { root, uiHost, gameHost, bus, renderer, pause, config, rules } = deps;

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
  const codec = createJsonSaveCodec({ maxImportBytes: rules.maxImportBytes });
  const storage = browserLocalStorage();
  const repository = createLocalStorageProgressRepository({ storage, codec });
  const save: SaveProgressDeps = {
    clock,
    repository,
    codec,
    defaultLocale: config.defaultLocale,
  };

  const loaded = await loadProgress(save);
  /*
   * `TN-SAVE-05`: storage being unavailable is a warning, never a stop. A
   * refused read and a browser with no storage at all are the same thing to a
   * player — this game is not going to remember them — so both raise the one
   * warning the title screen carries, and neither prevents play.
   */
  const storageBlocked = storage === null || !loaded.ok;
  if (!loaded.ok) {
    console.error(`[bootstrap] the save could not be read. ${loaded.error.code}: ${loaded.error.message}`);
  }

  let progress: Progress =
    loaded.ok && loaded.value !== null
      ? loaded.value
      : newProgress(defaultSettings(config.defaultLocale), rules.unlockRules.initialLevels);

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
     * Study is deliberately absent, and absent is the honest state.
     *
     * `app/ui/study-screen.ts` is finished and `content/questions/` holds a
     * verified bank, but nothing implements `ContentRepository`: there is no
     * adapter that reads those files, so no scheduler can be handed a question
     * and Study could only be mounted showing its *empty* state over a bank of
     * thirty verified questions. The shell's contract for this option is
     * "absent hides the item rather than offering a control that does nothing",
     * and a control that lies about the content is worse than one that is not
     * there. Reported with the task; it is a content adapter, not a UI screen.
     */
  });

  if (storageBlocked) shell.setStorageWarning(true);

  /* One subscription for every screen that has to follow a setting. The shell
     follows the store itself; everything below is this file's to keep in step. */
  store.subscribe((next, changed) => {
    applyToPage();
    /* `applySettings` has already written `lang` on `<html>`; what is left is
       every screen this file owns, which follows no store of its own. */
    if (changed === 'locale') session?.setLocale(next.locale);
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      session?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
    }
    if (changed === 'autoMove') renderer.setAutoMove(next.autoMove);
    progress = withSettings(progress, toDomainSettings(next, progress.settings));
    persist();
  });

  /* --------------------------------------------------------------- routing */

  function enterLevel(id: LevelId): void {
    if (session !== null) return;

    /* Before `createHud`, and this order is the shell's contract: the shell's
       root is the page's one `<main>` and `createHud` makes another, so the
       first is detached before the second exists. */
    shell.enterLevel(id);
    pause.release('shell');
    root.dataset['tnLevel'] = 'loading';
    session = openLevel({
      id,
      root,
      uiHost,
      gameHost,
      bus,
      renderer,
      pause,
      store,
      announce,
      onExportSave: exportSave,
      onLeave: leaveLevel,
    });

    /*
     * `TN-SAVE`'s survives table: the level last played, recorded when it is
     * *entered* rather than when it loads, so a level that fails on a flaky
     * connection is still the one Continue offers next time.
     */
    progress = { ...progress, lastPlayedLevelId: id };
    shell.setResumeLevelId(id);
    persist();
  }

  function leaveLevel(): void {
    if (session === null) return;
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
    /* After the HUD is destroyed, and it puts the player back on the card they
       just left rather than at the top of the map (`TN-FLOW-03`). */
    shell.leaveLevel();
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

interface LevelSession {
  readonly hud: Hud;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs: number): void;
  close(): void;
}

interface LevelWiring {
  readonly id: LevelId;
  readonly root: HTMLElement;
  readonly uiHost: HTMLElement;
  readonly gameHost: HTMLElement;
  readonly bus: GameEventBus;
  readonly renderer: GameRenderer;
  readonly pause: PauseControl;
  readonly store: SettingsStore;
  readonly announce: (message: string, lang?: string) => void;
  readonly onExportSave: () => void;
  readonly onLeave: () => void;
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
 * ## Two copy gaps, wired around rather than papered over
 *
 * `TN-LEVEL-08` wants an arrival sentence ("You are on the Rideau Canal in
 * Ottawa. Skating.") and `TN-COPY-06` wants an interact prompt ("Talk to the
 * officer"). **Neither string exists**: `app/ui/copy.ts` has no
 * `announce.arrived.*` or `hud.interact.*` row, and `content/schemas/level.schema.json`
 * gives a level nowhere to carry one.
 *
 * So the arrival announcement is the **level document's own localised title** —
 * a real string, owned by content, in the player's language (ADR-0010) — and it
 * is thinner than the story asks for. And `targets` is deliberately **not**
 * passed, which makes `createLevelAnnouncer` treat every `poi/entered` as an
 * offer it has no words for and show no prompt. That is its documented
 * behaviour and it is the honest one: a prompt reading "Interact" would be this
 * file inventing player-facing copy, which ADR-0010 forbids.
 */
function openLevel(wiring: LevelWiring): LevelSession {
  const { id, root, uiHost, gameHost, bus, renderer, pause, store } = wiring;
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
    onLeaveLevel: wiring.onLeave,
    onExportSave: wiring.onExportSave,
    /*
     * SEAM — `onInteract`, and the one input wire that is still missing.
     *
     * `TN-LEVEL-05` says tapping the interact prompt does what tapping the
     * target does, so this callback has to reach the scene. It cannot go direct:
     * `app/ui` may not import an adapter and this file may not hold a scene, so
     * the route is a port the adapter implements and this file constructs —
     * `app/application/ports/input.ts` is where it belongs, and
     * `onInteract: () => input.engageNearest()` is the one line that goes here.
     *
     * Deliberately unwired, because wiring it would be a control that does
     * nothing: the prompt is never *shown* either. `targets` is not passed (see
     * above) because no `hud.interact.*` copy row exists, so the HUD has no
     * prompt to tap. Both halves land together or neither does.
     *
     * The rest of the input path is wired: touch reaches the scene inside
     * `app/adapters/phaser` and `renderer.setAutoMove` is called from the
     * settings store above.
     */
  });

  /* Focus follows the page. Without this the control the player pressed on the
     map has just been detached and focus falls to the body (`TN-FLOW-06`). */
  hud.focus();

  const mode = modeLabel(renderer, locale);
  if (mode !== null) hud.setMode(mode);

  let settings: SettingsScreen | null = null;
  function openSettings(): void {
    settings ??= createSettingsScreen(hud.main, {
      store,
      announce: wiring.announce,
      onClose: () => {
        settings?.hide();
        pause.release('settings');
      },
    });
    pause.hold('settings');
    settings.show();
  }

  /* A modal over a level pauses it, and closing resumes. The card takes focus
     and is read on arrival, which is why `SPEAKS['poi/engaged']` is `false` —
     announcing it as well would say everything twice. */
  const card = createPoiCard(hud.main, {
    locale,
    announce: wiring.announce,
    singleSwitch: store.current.singleSwitch,
    onClose: () => {
      pause.release('poi');
    },
    restoreFocusTo: () => hud.prompt,
  });

  const failure = createLevelError(hud.main, {
    locale,
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
    /* A thunk, not a string: this subscription has to exist before the level is
       asked for, or `level/ready` is missed, and the sentence it wants to say is
       the level document's title, which does not exist until the load finishes.
       See `LevelAnnouncerOptions.arrival`. */
    arrival: () => localised(renderer.level?.title, locale),
  });

  const offFailure = bus.on('level/failed', () => {
    failure.show();
  });

  /*
   * A point of interest the player engaged, drawn from the level document.
   *
   * `name` and `blurb` are localised text the level already carries, so this is
   * content reaching the screen rather than copy invented here. An id the level
   * does not declare opens nothing: the engine and the document disagreeing is
   * not something to render.
   */
  const offEngaged = bus.on('poi/engaged', ({ detail }) => {
    const level: SceneLevel | null = renderer.level;
    if (detail === undefined || level === null) return;
    const poi = level.pois.find((candidate) => candidate.id === detail);
    if (poi === undefined) return;
    pause.hold('poi');
    card.show({ title: localised(poi.name, locale), body: [localised(poi.blurb, locale)] });
  });

  async function load(): Promise<void> {
    root.dataset['tnLevel'] = 'loading';
    await renderer.ready;
    const result = await renderer.loadLevel(`${id}`);
    if (!result.ok) {
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
    root.dataset['tnLevel'] = 'ready';
    /* The side panels are this level's sky and ground now, not the boot
       screen's. Re-applied so a wide window does not frame a level in the
       previous screen's scenery (ADR-0002). */
    applyPageTheme(renderer);
    const label = modeLabel(renderer, locale);
    if (label !== null) hud.setMode(label);
  }

  void load();

  return {
    hud,
    setLocale(next): void {
      locale = next;
      hud.setLocale(next);
      card.setLocale(next);
      failure.setLocale(next);
      announcer.setLocale(next);
      const label = modeLabel(renderer, next);
      if (label !== null) hud.setMode(label);
      /* The settings screen has no `setLocale`: it subscribes to the store it
         was handed and re-renders itself. */
    },
    setSingleSwitch(enabled, holdMs): void {
      hud.setSingleSwitch(enabled, holdMs);
      card.setSingleSwitch(enabled, holdMs);
    },
    close(): void {
      offFailure();
      offEngaged();
      announcer.destroy();
      card.destroy();
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
      pause.release('settings');
    },
  };
}

/**
 * The mode strip's label — "Skating", « Patinage » — or `null`.
 *
 * `null` is the answer for every mode but `skate`. The label is a copy row a
 * *level's* story owns (`TN-LEVEL-ottawa.md` writes `locomotion.skate.label`),
 * and the only level story written so far is Ottawa's. Québec City moves by
 * toboggan and has no story and therefore no row, so its strip carries no mode
 * rather than this file inventing the word — ADR-0010, and the same rule that
 * keeps a place name off a map card nobody has named.
 */
function modeLabel(renderer: GameRenderer, locale: UiLocale): string | null {
  const mode = renderer.level?.locomotion[0]?.mode;
  if (mode === undefined) return null;
  const key = `locomotion.${mode}.label` as CopyKey;
  /* `text` is typed total and is not: the map screen reaches the same table with
     keys built from data, and checks the same way. */
  const label = text(locale, key) as string | undefined;
  return label ?? null;
}

/* ------------------------------------------------------------------- pausing */

type PauseReason = 'orientation' | 'menu' | 'poi' | 'settings' | 'shell';

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
 * `holdToChooseMs` — `TN-SET-09`'s switch hold time — has **no field in
 * `progress.schema.json`**, so it does not survive a reload. That is a save
 * schema gap, not a UI one, and it is reported rather than worked around: a
 * switch user who has set a two-second hold has to set it again next time.
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
    /* `TN-SET-09`'s hold time has no field in the save document, so it starts at
       the default every session. See the note above. */
    holdToChooseMs: HOLD_TO_CHOOSE_DEFAULT_MS,
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
    volumes: previous.volumes,
  };
}

/* -------------------------------------------------------------------- shared */

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
