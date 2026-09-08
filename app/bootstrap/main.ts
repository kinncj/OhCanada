import '../ui/styles.css';
import { EventBus } from '@common/event-bus';
import { SeededRandom } from '@common/rng';
import type { GameEvents } from '@application/events';
import type { Clock, PresetName } from '@application/ports';
import {
  SessionStore, InitializeSession, CreateCharacter, StartQuest, AdvanceQuest, AnswerQuestion, UnlockDistrict, SaveProgress, ExportSave, ImportSave, ResetProgress, CitizenshipExam, UpdateSettings,
} from '@application/index';
import type { Settings } from '@domain/progress';
import type { Character } from '@domain/character';
import { StaticContentRepository } from '@adapters/content/static-content-repository';
import { JsonSaveCodec, LocalStorageProgressRepository } from '@adapters/persistence';
import { I18nextLocalizer } from '@adapters/i18n/i18next-localizer';
import { KeyboardMouseInput } from '@adapters/input/keyboard-mouse-input';
import { GamepadUiNavigator } from '@adapters/input/gamepad-ui-navigator';
import { RapierPhysicsWorld } from '@adapters/physics/rapier-physics-world';
import { HowlerAudio } from '@adapters/audio/howler-audio';
import { MainMenu, CharacterCreator, LoadingScreen, el } from '@ui/index';
import { Game } from './game';
import { Flow } from './flow';
import { attachTelemetry } from './telemetry';

declare const __APP_VERSION__: string;

const BENCH_KEY = 'truenorth.benchmark.v1';
const FORCE_WEBGL_KEY = 'truenorth.forceWebGL.v1';
const HEAL_KEY = 'truenorth.heal.v1';
const SAFE_KEY = 'truenorth.safe.v1';

class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
  nowIso(): string {
    return new Date().toISOString();
  }
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const canvas = el('canvas', { id: 'game', tabIndex: 0 });
  const ui = el('div', { id: 'ui' });
  document.body.append(canvas, ui);
  const loading = new LoadingScreen();
  ui.append(loading.root);
  loading.set('Loading…', 0.05);
  const watchdog = window.setTimeout(() => {
    if (!loading.root.isConnected) return;
    const btn = el('button', { class: 'btn', type: 'button', style: 'margin-top:1rem' }, 'Reload without cache');
    btn.addEventListener('click', async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        for (const r of regs ?? []) await r.unregister();
        const keys = await caches?.keys?.();
        for (const k of keys ?? []) await caches.delete(k);
      } catch {
        /* ignore */
      }
      location.href = `${location.pathname}?nocache=${Date.now()}`;
    });
    loading.root.append(el('p', { class: 'source', style: 'margin-top:1rem;color:#fff' }, 'Taking longer than usual…'), btn);
  }, 20_000);
  // Last resort: if the menu never appears, reload once with every asset disabled so the game still opens.
  const escalate = window.setTimeout(() => {
    if (booted || safeMode) return;
    safeSet(SAFE_KEY, '1');
    location.reload();
  }, 35_000);

  const safeMode = params.get('safe') === '1' || safeGet(SAFE_KEY) === '1';
  // Anything thrown before the world is up is shown on screen: a blank phone screen with no explanation is
  // the worst possible failure mode, and a device far from a debugger cannot report anything else.
  const problems: string[] = [];
  let booted = false;
  const reportFatal = (what: string): void => {
    if (problems.length > 3) return;
    problems.push(what);
    if (booted) return;
    const panel = document.getElementById('boot-error') ?? el('div', { class: 'screen', id: 'boot-error', dataset: { screen: 'boot-error' } }, el('div', { class: 'panel' }, el('h2', {}, 'TrueNorth could not start'), el('pre', { id: 'boot-error-text', style: 'white-space:pre-wrap;font-size:0.8rem' })));
    const text = panel.querySelector('#boot-error-text');
    if (text) text.textContent = problems.join('\n\n');
    if (!panel.isConnected) ui.append(panel);
  };
  window.addEventListener('error', (e) => reportFatal(`${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => reportFatal(`Unhandled rejection: ${String((e.reason as Error)?.message ?? e.reason)}`));

  const bus = new EventBus<GameEvents>();
  attachTelemetry(bus);
  const content = new StaticContentRepository();
  const config = content.getConfig();
  const base = config.basePath;
  const clock = new SystemClock();
  const rng = new SeededRandom((Date.now() ^ 0x5bd1e995) >>> 0);
  const store = new SessionStore();
  const codec = new JsonSaveCodec();
  const repo = new LocalStorageProgressRepository(codec);
  const debugEnabled = params.get('debug') === '1' || params.get('e2e') === '1' || config.featureFlags.debugOverlay === true;
  const e2e = params.get('e2e') === '1';

  const init = new InitializeSession(store, repo, content, clock, bus);
  const initRes = await init.execute();
  if (!initRes.ok) {
    // Corrupt save: start fresh but keep the broken file for the user to export/inspect.
    console.warn('Save could not be loaded:', initRes.error.message);
    await repo.clear();
    await init.execute();
  }
  const settings = () => store.progress.settings;
  const browserLocale = (navigator.language || 'en').slice(0, 2) === 'fr' ? 'fr' : 'en';
  const t = new I18nextLocalizer(store.progress.settings.locale ?? (config.locales.includes(browserLocale) ? browserLocale : config.defaultLocale), config.locales);
  await t.init();
  loading.set(t.t('app.loading'), 0.2);

  const catalogRes = await content.getCharacterCatalog();
  if (!catalogRes.ok) throw new Error(catalogRes.error.message);
  const catalog = catalogRes.value;

  const physics = new RapierPhysicsWorld();
  const input = new KeyboardMouseInput(canvas);
  input.setBindings(settings().keyBindings);
  const audio = new HowlerAudio(base);
  audio.setMasterVolume(settings().masterVolume);
  if (config.featureFlags.gamepad !== false) {
    const padNav = new GamepadUiNavigator(ui);
    const pollPads = (): void => {
      padNav.poll();
      requestAnimationFrame(pollPads);
    };
    requestAnimationFrame(pollPads);
  }
  loading.set(t.t('app.loading'), 0.4);

  // Safari (iOS included) reports navigator.gpu but Three's WebGPU backend renders a black canvas there,
  // so the proven WebGL2 path is the default on Safari; ?webgpu=1 opts back in for testing.
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const forceWebGL = params.get('webgl') === '1' || safeGet(FORCE_WEBGL_KEY) === '1' || (isSafari && params.get('webgpu') !== '1');
  let game: Game;
  try {
    try {
      game = await Game.create({ canvas, bus, config, physics, input, audio, catalog, assetBase: base, forceWebGL, safeMode });
    } catch (first) {
      console.warn('[truenorth] renderer init failed, retrying with WebGL2', first);
      game = await Game.create({ canvas, bus, config, physics, input, audio, catalog, assetBase: base, forceWebGL: true, safeMode });
    }
  } catch (e) {
    loading.hide();
    ui.append(el('div', { class: 'screen' }, el('div', { class: 'panel' }, el('h2', {}, 'TrueNorth'), el('p', {}, t.t('errors.webgl')), el('p', { class: 'source' }, String((e as Error).message)))));
    return;
  }
  loading.set(t.t('app.loading'), 0.7);

  const useCases = {
    createCharacter: new CreateCharacter(store, content, clock, bus),
    startQuest: new StartQuest(store, content, clock, bus),
    advance: new AdvanceQuest(store, content, clock, bus),
    save: new SaveProgress(store, repo, clock, bus),
    exportSave: new ExportSave(store, codec),
    importSave: new ImportSave(store, codec, repo, clock, bus),
    reset: new ResetProgress(store, repo),
    exam: new CitizenshipExam(store, content, clock, rng, bus),
    settings: new UpdateSettings(store, clock, bus),
    travel: new UnlockDistrict(store, content, clock, bus),
    answer: null as unknown as AnswerQuestion,
  };
  useCases.answer = new AnswerQuestion(store, content, clock, rng, bus, useCases.advance);

  // iPadOS reports a Macintosh user agent: treat any multi-touch device as mobile.
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true || navigator.maxTouchPoints > 1 || ('ontouchstart' in window && Math.min(screen.width, screen.height) < 900);
  const PRESETS: readonly PresetName[] = ['minimal', 'low', 'medium', 'high', 'ultra'];
  const isPreset = (v: string | null): v is PresetName => !!v && (PRESETS as readonly string[]).includes(v);
  const resolvePreset = (): PresetName => {
    const s = settings().graphicsPreset;
    if (s !== 'auto') return s;
    const stored = safeGet(BENCH_KEY);
    if (isPreset(stored)) return stored;
    return isMobile ? config.benchmark.mobileDefault : 'medium';
  };
  const applySettings = (s: Settings): void => {
    document.documentElement.dataset.cb = s.colourBlindSafe ? '1' : '0';
    audio.setMasterVolume(s.masterVolume);
    input.setBindings(s.keyBindings);
    game.applyGraphics(resolvePreset(), s.reducedMotion);
    if (s.locale !== t.locale) void t.setLocale(s.locale).then(() => flow?.refreshLocale());
  };
  applySettings(settings());

  const watchForBlankRenderer = makeBlankRendererWatchdog(game, ui, t, forceWebGL);
  let flow: Flow | null = null;
  let menu: MainMenu | null = null;
  let creator: CharacterCreator | null = null;

  const showMenu = (): void => {
    flow?.dispose();
    flow = null;
    game.stop();
    game.gameplayEnabled = false;
    game.unloadDistrict();
    input.setEnabled(false);
    input.releasePointerLock();
    menu?.destroy();
    menu = new MainMenu(t, {
      onNew: () => {
        if (store.progress.character) {
          if (!window.confirm(t.t('menu.resetConfirm'))) return;
          void useCases.reset.execute().then(() => init.execute()).then(() => showCreator());
          return;
        }
        showCreator();
      },
      onContinue: () => void (store.progress.character ? enterWorld() : showCreator()),
      onSettings: () => {
        menu?.destroy();
        const f = ensureFlow();
        f.openSettings(() => showMenu());
      },
      onImport: async (json) => {
        const r = await useCases.importSave.execute(json);
        if (!r.ok) window.alert(t.t('errors.importInvalid', { message: r.error.message }));
        else {
          applySettings(settings());
          showMenu();
        }
      },
      onExport: () => useCases.exportSave.execute(),
      onReset: () => void useCases.reset.execute().then(() => init.execute()).then(() => showMenu()),
      onLocale: (l) => {
        useCases.settings.execute({ locale: l });
        void t.setLocale(l).then(() => showMenu());
      },
    });
    ui.append(menu.render(!!store.progress.character, __APP_VERSION__));
    // Idle backdrop: the hub, slowly orbiting.
    void backdrop();
  };

  const backdrop = async (): Promise<void> => {
    const hub = await content.getDistrict(config.startDistrict);
    if (!hub.ok || game.district) return;
    await game.loadDistrict(hub.value);

    game.gameplayEnabled = false;
    game.start();
    const forcedPreset = params.get('preset');
    if (isPreset(forcedPreset)) {
      safeSet(BENCH_KEY, forcedPreset);
      game.applyGraphics(forcedPreset, settings().reducedMotion);
    } else if (settings().graphicsPreset === 'auto' && !safeGet(BENCH_KEY)) {
      // Benchmark on the current (mobile: minimal) preset; only ever step up as far as the measured frame-rate allows.
      const fps = await game.benchmark(config.benchmark.durationMs);
      const th = config.benchmark.thresholdsFps;
      const current = resolvePreset();
      let chosen: PresetName = fps >= th.ultra ? 'ultra' : fps >= th.high ? 'high' : fps >= th.medium ? 'medium' : fps >= th.low ? 'low' : 'minimal';
      // Measured on 'minimal' (mobile) the headroom is unknown above 'low': cap at low for phones, at medium elsewhere.
      if (current === 'minimal' && PRESETS.indexOf(chosen) > PRESETS.indexOf(isMobile ? 'low' : 'medium')) chosen = isMobile ? 'low' : 'medium';
      safeSet(BENCH_KEY, chosen);
      console.info(`[truenorth] ${JSON.stringify({ type: 'benchmark', payload: { fps: Math.round(fps), chosen } })}`);
      game.applyGraphics(chosen, settings().reducedMotion);
    }
  };

  const ensureFlow = (): Flow => {
    if (flow) return flow;
    flow = new Flow({
      ui, bus, t, content, config, store, game, input, audio,
      useCases: { startQuest: useCases.startQuest, advance: useCases.advance, answer: useCases.answer, travel: useCases.travel, save: useCases.save, exam: useCases.exam, settings: useCases.settings },
      onMainMenu: () => showMenu(),
      applySettings,
    }, debugEnabled);
    void flow.preloadDistrictNames();
    if (e2e || debugEnabled) (window as unknown as { __truenorth: unknown }).__truenorth = { ...flow.hooks(), version: __APP_VERSION__, backend: game.backend };
    return flow;
  };

  const showCreator = (): void => {
    menu?.destroy();
    creator?.destroy();
    creator = new CharacterCreator(t, catalog, {
      onPreview: (c: Character) => {
        void game.setPlayerAppearance(c.appearance);
        if (!game.district) void backdrop();
        game.gameplayEnabled = false;
        game.rig.distance = 3.2;
        game.rig.pitch = 0.05;
        game.rig.yaw = game.player.transform.yaw + Math.PI; // face the player during creation
      },
      onConfirm: async (c) => {
        const r = await useCases.createCharacter.execute(c);
        if (!r.ok) return r.error.kind === 'invalid' ? r.error.errors.map((e) => e.field) : [r.error.error.message];
        await useCases.save.execute();
        creator?.destroy();
        creator = null;
        game.rig.distance = 6.5;
        game.rig.pitch = 0.28;
        await enterWorld();
        return [];
      },
      onBack: () => {
        creator?.destroy();
        creator = null;
        showMenu();
      },
    }, store.progress.character);
    ui.append(creator.render());
  };

  const enterWorld = async (): Promise<void> => {
    menu?.destroy();
    menu = null;
    const ch = store.progress.character;
    if (!ch) return showCreator();
    await game.setPlayerAppearance(ch.appearance);
    const f = ensureFlow();
    await f.enterWorld(); // loadDistrict is single-flight and reuses the hub already loaded as the menu backdrop
    watchForBlankRenderer();
    if (game.district) {
      const sp = game.district.spawn;
      game.teleport(sp.position[0], sp.position[2], sp.yaw);
    }

  };

  window.clearTimeout(watchdog);
  window.clearTimeout(escalate);
  booted = true;
  loading.hide();
  showMenu();
  window.setTimeout(() => {
    if (game.renderer.stats().drawCalls > 0 && safeGet(HEAL_KEY)) safeSet(HEAL_KEY, '');
  }, 20_000);

  if (config.featureFlags.serviceWorker && import.meta.env.PROD && 'serviceWorker' in navigator && !e2e) {
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) location.reload();
      hadController = true;
    });
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' }).then((reg) => reg.update().catch(() => undefined)).catch(() => undefined);
  } else if ('serviceWorker' in navigator) {
    // Offline play is off: actively evict any worker and cache from an earlier build. A stale app shell on a
    // phone is undebuggable from here — it makes every fix look like it changed nothing.
    void navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (regs.length === 0) return;
      for (const r of regs) await r.unregister();
      try {
        for (const k of await caches.keys()) await caches.delete(k);
      } catch {
        /* ignore */
      }
      console.info(`[truenorth] ${JSON.stringify({ type: 'sw:evicted', payload: { count: regs.length } })}`);
      location.reload();
    }).catch(() => undefined);
  }
}

/**
 * A populated world that draws nothing means the GPU path failed silently — the black canvas with a working
 * HUD. Rather than leaving the player staring at it, step down a ladder: WebGL2 backend → minimal preset →
 * an on-screen report of what was tried. Each step reloads once and is remembered, so it cannot loop.
 */
function makeBlankRendererWatchdog(game: Game, ui: HTMLElement, t: { t(key: string): string }, forcedWebGL: boolean) {
  return function watchForBlankRenderer(): void {
    let blank = 0;
    const step = Number(safeGet(HEAL_KEY) ?? '0');
    const timer = window.setInterval(() => {
      if (!game.district) return;
      const stats = game.renderer.stats();
      blank = stats.drawCalls === 0 ? blank + 1 : 0;
      if (blank < 6) return; // ~6 s of drawing nothing
      window.clearInterval(timer);
      console.warn(`[truenorth] ${JSON.stringify({ type: 'render:blank', payload: { backend: game.backend, preset: game.presetLabel, step } })}`);
      if (!forcedWebGL && step < 1) {
        safeSet(FORCE_WEBGL_KEY, '1');
        safeSet(HEAL_KEY, '1');
        location.reload();
      } else if (step < 2) {
        safeSet(BENCH_KEY, 'minimal');
        safeSet(HEAL_KEY, '2');
        location.reload();
      } else {
        ui.append(
          el('div', { class: 'screen', dataset: { screen: 'render-error' } },
            el('div', { class: 'panel' },
              el('h2', {}, 'TrueNorth'),
              el('p', {}, t.t('errors.webgl')),
              el('p', { class: 'source' }, `backend ${game.backend} · preset ${game.presetLabel} · draw calls 0 · recovery steps tried: ${step}`),
            ),
          ),
        );
      }
    }, 1000);
  };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

boot().catch((e: unknown) => {
  console.error(e);
  document.body.append(el('pre', { style: 'color:#fff;padding:1rem' }, String(e instanceof Error ? e.stack ?? e.message : e)));
});
