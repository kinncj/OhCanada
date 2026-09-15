import { describe, expect, it } from 'vitest';

import { browserLanguages, newSaveLocale } from '../../../app/bootstrap/browser-locale';

/**
 * `OQ-SET-2`: a brand-new save starts in the browser's language, and the
 * config's `defaultLocale` is only the answer for a browser that asks for
 * neither French nor English.
 *
 * That a save which loaded keeps its own locale is the other half, and it is
 * held where the choice is made: `main.ts` calls {@link newSaveLocale} only on
 * the branch that builds `newProgress`. `tests/e2e/browser-language.spec.ts`
 * proves both halves in a French-language Chromium.
 */

const browser = (languages: unknown, language?: unknown): unknown => ({
  navigator: { languages, language },
});

describe('browserLanguages', () => {
  it("reads navigator.languages, in the browser's order", () => {
    expect(browserLanguages(browser(['fr-CA', 'en-CA'], 'fr-CA'))).toEqual(['fr-CA', 'en-CA']);
  });

  it('falls back to navigator.language when the list is empty or absent', () => {
    expect(browserLanguages(browser([], 'fr-FR'))).toEqual(['fr-FR']);
    expect(browserLanguages(browser(undefined, 'en-GB'))).toEqual(['en-GB']);
  });

  it('drops entries that are not language tags', () => {
    expect(browserLanguages(browser([42, null, 'fr-CA']))).toEqual(['fr-CA']);
    expect(browserLanguages(browser('fr-CA', 7))).toEqual([]);
  });

  it('answers nothing for a window with no navigator, as the bootstrap suites boot against', () => {
    expect(browserLanguages({ innerWidth: 390, innerHeight: 844 })).toEqual([]);
    expect(browserLanguages({ navigator: null })).toEqual([]);
    expect(browserLanguages(undefined)).toEqual([]);
    expect(browserLanguages(null)).toEqual([]);
  });
});

describe('newSaveLocale', () => {
  it('starts a new save in French for any French tag', () => {
    for (const tag of ['fr', 'fr-CA', 'fr-FR', 'FR-be', 'fr_CH']) {
      expect(newSaveLocale(browser([tag]), 'en'), tag).toBe('fr');
    }
  });

  it('starts a new save in English for any English tag, whatever the default', () => {
    for (const tag of ['en', 'en-CA', 'en-US', 'EN-gb']) {
      expect(newSaveLocale(browser([tag]), 'fr'), tag).toBe('en');
    }
  });

  it('lets the first French or English tag decide, skipping any other language', () => {
    expect(newSaveLocale(browser(['de-DE', 'fr-CA', 'en-CA']), 'en')).toBe('fr');
    expect(newSaveLocale(browser(['pt-BR', 'en-CA', 'fr-CA']), 'fr')).toBe('en');
  });

  it("falls back to the config's default for a browser that asks for neither", () => {
    expect(newSaveLocale(browser(['de-DE', 'zh-Hans']), 'en')).toBe('en');
    expect(newSaveLocale(browser(['de-DE', 'zh-Hans']), 'fr')).toBe('fr');
    expect(newSaveLocale({}, 'en')).toBe('en');
    expect(newSaveLocale({}, 'fr')).toBe('fr');
  });
});
