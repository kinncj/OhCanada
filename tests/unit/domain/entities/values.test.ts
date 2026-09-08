import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_LOCALES,
  isBilingual,
  isSupportedLocale,
  localeKey,
  textIn,
} from '@domain/entities/values';

import { locale, text } from '../../support/fixtures';

describe('localized text', () => {
  it('ships English and French, and nothing else', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'fr']);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
  });

  it('reads the text of the locale asked for', () => {
    const greeting = text('Hello', 'Bonjour');
    expect(textIn(greeting, locale('en'))).toBe('Hello');
    expect(textIn(greeting, locale('fr'))).toBe('Bonjour');
  });

  it('falls back to English for a locale that cannot come from content or a save', () => {
    expect(localeKey(locale('de'))).toBe('en');
    expect(textIn(text('Hello', 'Bonjour'), locale('de'))).toBe('Hello');
  });

  it('counts whitespace-only text as missing, which minLength cannot', () => {
    expect(isBilingual(text('Hello', 'Bonjour'))).toBe(true);
    expect(isBilingual({ en: 'Hello', fr: '   ' })).toBe(false);
    expect(isBilingual({ en: '', fr: 'Bonjour' })).toBe(false);
  });
});
