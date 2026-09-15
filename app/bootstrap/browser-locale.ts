/**
 * The language a brand-new save starts in (`OQ-SET-2`, `TN-TITLE`'s "The first
 * run follows the browser, and the player wins after that").
 *
 * French when the browser asks for French, English when it asks for English,
 * and `game.config.json#/defaultLocale` when it asks for neither. **Only for a
 * save that does not exist yet.** A save that loaded keeps its own locale,
 * whatever the browser says, and nothing shown before the save is read changes
 * language either: the page's `lang` and the rotate overlay stay on the
 * config's default, which is also `index.html`'s, until the save or this answer
 * is applied. So a returning English player in a French browser never sees a
 * French screen during the load.
 *
 * Here rather than in `main.ts` so it can be proved without booting the game,
 * and because `navigator` is read defensively: the bootstrap suites boot
 * `main.ts` against a `window` double with no `navigator` at all.
 */

import { preferredLocale, type UiLocale } from '@ui/copy';

interface NavigatorLike {
  readonly languages?: unknown;
  readonly language?: unknown;
}

/**
 * `navigator.languages` off a window, then `navigator.language`, or nothing.
 * Non-string entries are dropped rather than trusted.
 */
export function browserLanguages(view: unknown): readonly string[] {
  const found = (view as { readonly navigator?: unknown } | null | undefined)?.navigator;
  if (found === null || typeof found !== 'object') return [];
  const reported = found as NavigatorLike;

  const listed = Array.isArray(reported.languages)
    ? reported.languages.filter((tag): tag is string => typeof tag === 'string')
    : [];
  if (listed.length > 0) return listed;
  return typeof reported.language === 'string' ? [reported.language] : [];
}

/** The locale a new save is written in: the browser's, narrowed, or `fallback`. */
export function newSaveLocale(view: unknown, fallback: UiLocale): UiLocale {
  return preferredLocale(browserLanguages(view), fallback);
}
