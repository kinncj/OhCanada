/**
 * Id parsing, and the one thing that matters about it: it agrees with the
 * schema. The pattern and the length bound are read out of
 * `content/schemas/common.schema.json` and compared with the constants, so a
 * change to either end fails here rather than showing up as content that
 * validates and then cannot be loaded.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ID_PATTERN,
  MAX_ID_LENGTH,
  isId,
  parseCharacterId,
  parseLevelId,
  parseLocaleCode,
  parsePoiId,
  parseQuestId,
  parseQuestionId,
  parseSubjectId,
} from '@domain/identity';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface CommonSchema {
  readonly $defs: {
    readonly id: { readonly pattern: string; readonly maxLength: number };
    readonly localeCode: { readonly enum: readonly string[] };
  };
}

const commonSchema = JSON.parse(
  readFileSync(`${REPO_ROOT}content/schemas/common.schema.json`, 'utf8'),
) as CommonSchema;

describe('the id vocabulary mirrors the schema', () => {
  it('uses the schema pattern and length bound', () => {
    expect(ID_PATTERN.source).toBe(commonSchema.$defs.id.pattern);
    expect(MAX_ID_LENGTH).toBe(commonSchema.$defs.id.maxLength);
  });

  it('accepts only the locales the schema enumerates', () => {
    for (const code of commonSchema.$defs.localeCode.enum) {
      expect(parseLocaleCode(code).ok).toBe(true);
    }
    expect(parseLocaleCode('de').ok).toBe(false);
    expect(parseLocaleCode('EN').ok).toBe(false);
    expect(parseLocaleCode(42).ok).toBe(false);
  });
});

describe('isId', () => {
  it.each([
    ['ottawa', true],
    ['gov-01-three-features', true],
    ['a', true],
    ['Ottawa', false],
    ['-ottawa', false],
    ['ottawa-', false],
    ['ottawa--hill', false],
    ['parliament hill', false],
    ['poi.parliament-hill', false],
    ['', false],
  ])('reads %s as %s', (value, expected) => {
    expect(isId(value)).toBe(expected);
  });

  it('refuses anything that is not a string, and anything too long', () => {
    expect(isId(7)).toBe(false);
    expect(isId(null)).toBe(false);
    expect(isId(undefined)).toBe(false);
    expect(isId('a'.repeat(MAX_ID_LENGTH))).toBe(true);
    expect(isId('a'.repeat(MAX_ID_LENGTH + 1))).toBe(false);
  });
});

describe('every id kind parses through the same rule and reports its own name', () => {
  const parsers = [
    ['level', parseLevelId],
    ['quest', parseQuestId],
    ['question', parseQuestionId],
    ['subject', parseSubjectId],
    ['character', parseCharacterId],
    ['poi', parsePoiId],
  ] as const;

  it.each(parsers)('%s accepts a kebab-case id', (_kind, parse) => {
    const parsed = parse('parliament-hill');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toBe('parliament-hill');
  });

  it.each(parsers)('%s refuses a bad id and says which kind it was', (kind, parse) => {
    const parsed = parse('Parliament Hill');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.kind).toBe('invalid');
      expect(parsed.error.code).toBe(`id.${kind}.invalid`);
      expect(parsed.error.details).toEqual({ value: 'Parliament Hill' });
    }
  });
});
