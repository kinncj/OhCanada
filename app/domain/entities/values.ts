/**
 * The value types every entity shares, mirroring `common.schema.json`.
 *
 * These are the schema's `$defs` in TypeScript, with the same property names and
 * the same value types (ADR-0007). They are declared here rather than imported
 * from `app/application/ports/content-repository.ts` because `domain-is-pure`
 * forbids `app/domain` from importing the application layer — checked with
 * `depcruise`, not assumed. Structural typing is what keeps the two honest: a
 * `LocalizedText` from the port satisfies this one exactly, so the content
 * adapter's documents reach the domain rules with no mapping layer in between,
 * and `tests/unit/contracts/entities-mirror-ports.test.ts` fails to compile if
 * that ever stops being true.
 */

import type { LocaleCode } from '@domain/ids';

/**
 * A string in every supported locale. Both are mandatory, which is how ADR-0003's
 * "missing EN or FR text" clause is enforced per document (`localizedText`).
 */
export interface LocalizedText {
  readonly en: string;
  readonly fr: string;
}

/** A point, size or scroll factor in design-resolution pixels (`vec2`). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** The locales that ship. EN and FR from the first commit (CLAUDE.md, Language). */
export type SupportedLocale = 'en' | 'fr';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'fr'];

/** Is this string one of the locales the game ships? */
export const isSupportedLocale = (value: string): value is SupportedLocale =>
  SUPPORTED_LOCALES.includes(value as SupportedLocale);

/**
 * The key a branded `LocaleCode` reads under, falling back to `en`.
 *
 * The fallback is not a language policy: a `LocaleCode` that is neither `en` nor
 * `fr` cannot come from content (the schema's enum rejects it) and cannot come
 * from a save (`SettingsDocument.locale` is the same enum). It can only come
 * from a caller that built one by hand, and returning English beats throwing
 * inside a text lookup.
 */
export const localeKey = (locale: LocaleCode): SupportedLocale =>
  isSupportedLocale(`${locale}`) ? (`${locale}` as SupportedLocale) : 'en';

/** The text a player in this locale reads. */
export const textIn = (text: LocalizedText, locale: LocaleCode): string =>
  localeKey(locale) === 'fr' ? text.fr : text.en;

/**
 * Does this text exist in both languages?
 *
 * TN-QUEST-05 promises a question missing its French wording is never shown, and
 * the schema's `minLength: 1` cannot catch whitespace. The build check fails
 * first; this is the runtime half of the same promise.
 */
export const isBilingual = (text: LocalizedText): boolean =>
  text.en.trim().length > 0 && text.fr.trim().length > 0;
