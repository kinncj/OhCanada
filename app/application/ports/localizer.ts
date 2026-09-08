/**
 * LocalizerPort — EN and FR from the first commit, so no string is ever a literal.
 *
 * Everything a player reads — dialogue, questions, HUD, settings, live-region
 * announcements — is a key resolved here. A missing key is a content bug and must
 * be visible as one, which is why `t` reports misses rather than quietly echoing
 * the key in production builds.
 *
 * Locale changes are published on the event bus; this port does not know about
 * re-rendering, and the DOM UI does not know about i18next.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call site: slice 1 task 1.15 (the DOM screens). Whoever writes the
 * first implementation may change this interface without an ADR, and removes this
 * marker in the same change.
 */

import type { LocaleCode } from '@domain/ids';
import type { Result } from '@common/result';

/** Interpolation values. Keep them primitive — no objects in translator-facing strings. */
export type TranslationParams = Readonly<Record<string, string | number>>;

export interface LocalizerPort {
  readonly locale: LocaleCode;
  readonly available: readonly LocaleCode[];

  /** Resolve a key. Falls back to the default locale, then to the key itself. */
  t(key: string, params?: TranslationParams): string;
  /** `null` instead of a fallback — for optional copy the UI may omit. */
  tOrNull(key: string, params?: TranslationParams): string | null;
  has(key: string): boolean;

  /** Loads the bundle if needed; failure leaves the current locale in place. */
  setLocale(locale: LocaleCode): Promise<Result<void>>;

  /** Locale-correct number/date rendering for scores, timers and `asOf` dates. */
  formatNumber(value: number): string;
  formatDuration(milliseconds: number): string;
}
