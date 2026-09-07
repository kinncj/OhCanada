import '../ui/styles.css';
import { EventBus } from '@common/event-bus';
import { SeededRandom } from '@common/rng';
import type { GameEvents } from '@application/events';
import type { Clock } from '@application/ports';
import {
  SessionStore, InitializeSession, CreateCharacter, StartQuest, AdvanceQuest, AnswerQuestion, UnlockDistrict, SaveProgress, ExportSave, ImportSave, ResetProgress, CitizenshipExam, UpdateSettings,
} from '@application/index';
import type { Settings } from '@domain/progress';
import type { Character } from '@domain/character';
import { StaticContentRepository } from '@adapters/content/static-content-repository';
import { JsonSaveCodec, LocalStorageProgressRepository } from '@adapters/persistence';
import { I18nextLocalizer } from '@adapters/i18n/i18next-localizer';
import { KeyboardMouseInput } from '@adapters/input/keyboard-mouse-input';
import { RapierPhysicsWorld } from '@adapters/physics/rapier-physics-world';
import { HowlerAudio } from '@adapters/audio/howler-audio';
import { MainMenu, CharacterCreator, LoadingScreen, el } from '@ui/index';
import { Game } from './game';
import { Flow } from './flow';
import { attachTelemetry } from './telemetry';

declare const __APP_VERSION__: string;

const BENCH_KEY = 'truenorth.benchmark.v1';

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
  loading.set(t.t('app.loading'), 0.4);

  let game: Game;
  try {
    game = await Game.create({ canvas, bus, config, physics, input, audio, catalog, assetBase: base, forceWebGL: params.get('webgl') === '1' });
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

  const resolvePreset = (): 'low' | 'medium' | 'high' | 'ultra' => {
    const s = settings().graphicsPreset;
    if (s !== 'auto') return s;
    const stored = safeGet(BENCH_KEY);
    return stored === 'low' || stored === 'medium' || stored === 'high' || stored === 'ultra' ? stored : 'medium';
  };
  const applySettings = (s: Settings): void => {
    document.documentElement.dataset.cb = s.colourBlindSafe ? '1' : '0';
    audio.setMasterVolume(s.masterVolume);
    input.setBindings(s.keyBindings);
    game.applyGraphics(resolvePreset(), s.reducedMotion);
    if (s.locale !== t.locale) void t.setLocale(s.locale).then(() => flow?.refreshLocale());
  };
  applySettings(settings());

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

  let backdropLoaded = false;
  const backdrop = async (): Promise<void> => {
    const hub = await content.getDistrict(config.startDistrict);
    if (!hub.ok || game.district) return;
    await game.loadDistrict(hub.value);
    backdropLoaded = true;
    game.gameplayEnabled = false;
    game.start();
    const forcedPreset = params.get('preset');
    if (forcedPreset === 'low' || forcedPreset === 'medium' || forcedPreset === 'high' || forcedPreset === 'ultra') {
      safeSet(BENCH_KEY, forcedPreset);
      game.applyGraphics(forcedPreset, settings().reducedMotion);
    } else if (settings().graphicsPreset === 'auto' && !safeGet(BENCH_KEY)) {
      const fps = await game.benchmark(config.benchmark.durationMs);
      const th = config.benchmark.thresholdsFps;
      const chosen = fps >= th.ultra ? 'ultra' : fps >= th.high ? 'high' : fps >= th.medium ? 'medium' : 'low';
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
        game.setPlayerAppearance(c.appearance);
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
    game.setPlayerAppearance(ch.appearance);
    const f = ensureFlow();
    if (!backdropLoaded || game.district?.id !== store.progress.currentDistrict) {
      await f.enterWorld();
    } else {
      // Hub already loaded as the menu backdrop: just hand over control.
      game.gameplayEnabled = true;
      input.setEnabled(true);
      const sp = game.district.spawn;
      game.teleport(sp.position[0], sp.position[2], sp.yaw);
      await f.enterWorld();
    }
    backdropLoaded = false;
  };

  loading.hide();
  showMenu();

  if (config.featureFlags.serviceWorker && import.meta.env.PROD && 'serviceWorker' in navigator && !e2e) {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
  }
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
