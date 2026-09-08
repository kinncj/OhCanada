/**
 * The accessibility settings, as data and as pure functions over that data.
 *
 * Split from `settings-screen.ts` on purpose: every other story in
 * `docs/stories/` opens with a precondition this model sets ("Given
 * single-switch mode is on", "Given text scaling is 200 %"), so the model has
 * to be usable — and testable — without building the screen that edits it.
 *
 * Nothing here touches storage. `TN-SET-03` requires that a change applies even
 * when the write fails, which is only expressible if applying and persisting are
 * different steps owned by different people: this module applies, the caller
 * persists and reports `progress/save-failed`.
 *
 * DOM only (ADR-0005): `applySettings` writes attributes on a document it is
 * handed. It never reads a renderer, a tier or a frame time — see
 * {@link resolveMotion}.
 */

import { isUiLocale, type CopyKey, type UiLocale } from './copy';

export interface Settings {
  readonly locale: UiLocale;
  /** `TN-SET-02`: the skater moves without a held control. */
  readonly autoMove: boolean;
  /** `docs/stories/README.md`, the single-switch contract. */
  readonly singleSwitch: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly dyslexiaFont: boolean;
  /** Percent, 100–200 (CLAUDE.md, Accessibility). */
  readonly textScale: number;
  readonly subtitles: boolean;
  /**
   * How long a switch contact must be held to *choose* rather than advance.
   * `TN-SET-09` draws it as {@link HOLD_TIME_CHOICES}, four named values rather
   * than a slider: a switch user reaches four named items in four short presses
   * and would need fourteen to walk a 100 ms step from 0.6 s to 2.0 s.
   */
  readonly holdToChooseMs: number;
}

export const TEXT_SCALE_MIN = 100;
export const TEXT_SCALE_MAX = 200;
export const TEXT_SCALE_STEP = 25;

export const HOLD_TO_CHOOSE_MIN_MS = 200;
export const HOLD_TO_CHOOSE_MAX_MS = 3_000;

/** `TN-SET-09`'s default, and the ceiling the hold-time control can never exceed. */
export const HOLD_TO_CHOOSE_DEFAULT_MS = 600;

export interface HoldTimeChoice {
  readonly ms: number;
  /** The name the player sees: Short, Medium, Long, Very long. */
  readonly label: CopyKey;
  readonly testId: string;
}

/**
 * The four values, in order. `TN-SET-09`: Short 0.3 s, Medium 0.6 s (the
 * default), Long 1.2 s, Very long 2.0 s. Every one sits inside the
 * {@link HOLD_TO_CHOOSE_MIN_MS}–{@link HOLD_TO_CHOOSE_MAX_MS} clamp, which still
 * guards a hand-edited or imported save.
 */
export const HOLD_TIME_CHOICES: readonly HoldTimeChoice[] = [
  { ms: 300, label: 'settings.holdTime.short', testId: 'setting-hold-time-short' },
  { ms: HOLD_TO_CHOOSE_DEFAULT_MS, label: 'settings.holdTime.medium', testId: 'setting-hold-time-medium' },
  { ms: 1_200, label: 'settings.holdTime.long', testId: 'setting-hold-time-long' },
  { ms: 2_000, label: 'settings.holdTime.veryLong', testId: 'setting-hold-time-very-long' },
];

/**
 * The nearest named choice to a stored value, so a save written by an older
 * build — or by hand — still lights one of the four radios rather than none.
 */
export function nearestHoldTimeChoice(ms: number): HoldTimeChoice {
  const first = HOLD_TIME_CHOICES[0] as HoldTimeChoice;
  return HOLD_TIME_CHOICES.reduce(
    (best, choice) => (Math.abs(choice.ms - ms) < Math.abs(best.ms - ms) ? choice : best),
    first,
  );
}

/**
 * Subtitles are on and nothing else is (CLAUDE.md: "Subtitles on by default").
 * `locale` is a placeholder the caller replaces with `preferredLocale(...)` or
 * the saved choice; it is not a claim that English is the default language.
 */
export const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  autoMove: false,
  singleSwitch: false,
  reducedMotion: false,
  highContrast: false,
  dyslexiaFont: false,
  textScale: TEXT_SCALE_MIN,
  subtitles: true,
  holdToChooseMs: HOLD_TO_CHOOSE_DEFAULT_MS,
};

/**
 * `TN-SET-03`: "a saved document declares a text scale of 500 % … the text scale
 * is clamped to 200 % and the game does not fail to start". Rounds to the step
 * so the slider and the saved value cannot disagree, and falls back to the
 * default for anything that is not a finite number.
 */
export function clampTextScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.textScale;
  const stepped = Math.round(value / TEXT_SCALE_STEP) * TEXT_SCALE_STEP;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, stepped));
}

export function clampHoldToChooseMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.holdToChooseMs;
  }
  return Math.min(HOLD_TO_CHOOSE_MAX_MS, Math.max(HOLD_TO_CHOOSE_MIN_MS, Math.round(value)));
}

/**
 * Read a settings block of unknown provenance — a saved document, a URL, an
 * older version — into something every screen can rely on. Unknown keys are
 * dropped, bad values fall back per field, and the result is always complete.
 */
export function normaliseSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const bool = (key: keyof Settings, fallback: boolean): boolean =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback;

  return {
    locale: isUiLocale(raw['locale']) ? raw['locale'] : base.locale,
    autoMove: bool('autoMove', base.autoMove),
    singleSwitch: bool('singleSwitch', base.singleSwitch),
    reducedMotion: bool('reducedMotion', base.reducedMotion),
    highContrast: bool('highContrast', base.highContrast),
    dyslexiaFont: bool('dyslexiaFont', base.dyslexiaFont),
    textScale: 'textScale' in raw ? clampTextScale(raw['textScale']) : base.textScale,
    subtitles: bool('subtitles', base.subtitles),
    holdToChooseMs:
      'holdToChooseMs' in raw ? clampHoldToChooseMs(raw['holdToChooseMs']) : base.holdToChooseMs,
  };
}

export type MotionMode = 'reduced' | 'full';

/**
 * The motion axis, and the whole of it.
 *
 * Two inputs, both of them a *request for stillness*: the in-game setting and
 * the operating system's `prefers-reduced-motion`. Either one wins
 * (`TN-CREATOR-07`: "the in-game setting has the same effect as the browser
 * setting"). There is deliberately no third parameter — no render tier, no
 * measured frame time, no device class — so no amount of good hardware can
 * upgrade a player who asked for stillness back into animation. The engine
 * keeps motion as a separate axis from the visual tier for the same reason; a
 * signature that cannot express the mistake is stronger than a comment asking
 * nobody to make it.
 */
export function resolveMotion(settings: Settings, prefersReducedMotion: boolean): MotionMode {
  return settings.reducedMotion || prefersReducedMotion ? 'reduced' : 'full';
}

/** Every screen reads these off `<html>`; the CSS in `screen-styles.ts` keys off them. */
export interface AppliedSettings {
  readonly motion: MotionMode;
  readonly textScale: number;
}

/**
 * Write the settings onto the document so *one* change restyles every screen at
 * once (`TN-SET-01`: "Text size changes the whole game, not one screen").
 *
 * Text scaling is a root `font-size` percentage, so anything sized in `rem`
 * — which is everything these screens draw — grows with it, including the
 * `min-height` that keeps a touch target at 44 px.
 */
export function applySettings(
  doc: Document,
  settings: Settings,
  prefersReducedMotion: boolean,
): AppliedSettings {
  const root = doc.documentElement;
  const motion = resolveMotion(settings, prefersReducedMotion);

  root.setAttribute('lang', settings.locale);
  root.setAttribute('data-tn-motion', motion);
  root.setAttribute('data-tn-contrast', settings.highContrast ? 'high' : 'normal');
  root.setAttribute('data-tn-font', settings.dyslexiaFont ? 'dyslexia' : 'default');
  root.setAttribute('data-tn-switch', settings.singleSwitch ? 'on' : 'off');
  root.setAttribute('data-tn-subtitles', settings.subtitles ? 'on' : 'off');
  root.setAttribute('data-tn-auto-move', settings.autoMove ? 'on' : 'off');
  root.setAttribute('data-tn-text-scale', String(settings.textScale));
  root.style.setProperty('--tn-text-scale', String(settings.textScale / 100));
  root.style.setProperty('font-size', `${settings.textScale}%`);

  return { motion, textScale: settings.textScale };
}

/** Detached from `window` so a caller can supply the media query in a test. */
export function prefersReducedMotion(view: { matchMedia?: (q: string) => { matches: boolean } }): boolean {
  return view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export type SettingsListener = (next: Settings, changed: keyof Settings) => void;

export interface SettingsStore {
  readonly current: Settings;
  /** Apply one field. Returns the new value; a no-op change notifies nobody. */
  set<K extends keyof Settings>(key: K, value: Settings[K]): Settings;
  toggle(key: KeyOfType<Settings, boolean>): Settings;
  subscribe(listener: SettingsListener): () => void;
}

type KeyOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

/**
 * A tiny observable over {@link Settings}. It exists so the screen, the level
 * and the persistence adapter all read one value and hear one notification, and
 * so `TN-SET-01`'s "a change takes effect at once" is not five listeners racing.
 */
export function createSettingsStore(initial: Settings = DEFAULT_SETTINGS): SettingsStore {
  let current = normaliseSettings(initial);
  const listeners = new Set<SettingsListener>();

  const commit = <K extends keyof Settings>(key: K, value: Settings[K]): Settings => {
    if (current[key] === value) return current;
    const next = normaliseSettings({ ...current, [key]: value }, current);
    if (next[key] === current[key]) return current;
    current = next;
    for (const listener of [...listeners]) listener(current, key);
    return current;
  };

  return {
    get current(): Settings {
      return current;
    },
    set: commit,
    toggle(key): Settings {
      return commit(key, !current[key] as Settings[typeof key]);
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
