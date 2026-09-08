/**
 * The calendar conversion, pinned against `Date` as an oracle.
 *
 * `Date` is the authority on the numbers; `iso-instant.ts` is what ships,
 * because the application layer must not hold the type that also answers
 * `Date.now()` and because `Date.parse` accepts input a save file must not.
 * This test is what keeps the two equal — the same arrangement ADR-0012 made
 * between the memory model and `ts-fsrs`.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_ISO_EPOCH_MS,
  MIN_ISO_EPOCH_MS,
  civilFromDays,
  daysFromCivil,
  fromIsoInstant,
  isIsoInstant,
  toIsoInstant,
} from '@application/persistence/iso-instant';

import { at } from '../../support/fixtures';

const DAY = 86_400_000;

/** A spread of instants: epoch, leap days, century boundaries, before 1970. */
const CORPUS: readonly number[] = [
  0,
  1,
  -1,
  Date.UTC(1969, 6, 20, 20, 17, 40, 0),
  Date.UTC(1970, 0, 1, 0, 0, 0, 1),
  Date.UTC(1999, 11, 31, 23, 59, 59, 999),
  Date.UTC(2000, 1, 29, 12, 0, 0, 0),
  Date.UTC(1900, 1, 28, 23, 59, 59, 999),
  Date.UTC(2024, 1, 29, 6, 30, 15, 250),
  Date.UTC(2024, 2, 10, 7, 0, 0, 0),
  Date.UTC(2100, 1, 28, 0, 0, 0, 0),
  Date.UTC(2038, 0, 19, 3, 14, 7, 0),
  MIN_ISO_EPOCH_MS,
  MAX_ISO_EPOCH_MS,
];

/** A deterministic spread across the whole four-digit-year range. */
const sweep = (count: number): readonly number[] => {
  let state = 20240301 >>> 0;
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const span = MAX_ISO_EPOCH_MS - MIN_ISO_EPOCH_MS;
    return MIN_ISO_EPOCH_MS + Math.floor((state / 4294967296) * span);
  });
};

describe('civil calendar arithmetic', () => {
  it('agrees with Date on the day number of every day it is asked about', () => {
    for (const millis of [...CORPUS, ...sweep(200)]) {
      const date = new Date(millis);
      expect(daysFromCivil(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())).toBe(
        Math.floor(millis / DAY),
      );
    }
  });

  it('round-trips a day number back to its date', () => {
    for (const millis of [...CORPUS, ...sweep(200)]) {
      const days = Math.floor(millis / DAY);
      const civil = civilFromDays(days);
      expect(daysFromCivil(civil.year, civil.month, civil.day)).toBe(days);
    }
  });
});

describe('writing an instant', () => {
  it('is byte-identical to Date.prototype.toISOString', () => {
    for (const millis of [...CORPUS, ...sweep(500)]) {
      const written = toIsoInstant(at(millis));
      expect(written.ok).toBe(true);
      if (written.ok) expect(written.value).toBe(new Date(millis).toISOString());
    }
  });

  it('refuses a value that is not a whole number of milliseconds', () => {
    for (const broken of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      const written = toIsoInstant(at(broken));
      expect(written.ok).toBe(false);
      if (!written.ok) expect(written.error.code).toBe('time.epoch.notAnInstant');
    }
  });

  it('refuses an instant outside the four-digit-year range rather than writing a lie', () => {
    for (const outside of [MIN_ISO_EPOCH_MS - 1, MAX_ISO_EPOCH_MS + 1]) {
      const written = toIsoInstant(at(outside));
      expect(written.ok).toBe(false);
      if (!written.ok) expect(written.error.code).toBe('time.epoch.outOfRange');
    }
  });
});

describe('reading an instant', () => {
  it('agrees with Date.parse on everything it accepts', () => {
    const texts = [...CORPUS, ...sweep(300)].map((millis) => new Date(millis).toISOString());
    for (const text of texts) {
      const read = fromIsoInstant(text);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value).toBe(Date.parse(text));
    }
  });

  it('reads the offset forms RFC 3339 allows', () => {
    expect(fromIsoInstant('2024-03-01T12:00:00Z')).toEqual(
      fromIsoInstant('2024-03-01T13:00:00+01:00'),
    );
    expect(fromIsoInstant('2024-03-01T12:00:00Z')).toEqual(fromIsoInstant('2024-03-01T07:00:00-0500'));
    expect(fromIsoInstant('2024-03-01T12:00:00Z')).toEqual(fromIsoInstant('2024-03-01T13:00:00+01'));
    expect(fromIsoInstant('2024-03-01t12:00:00z').ok).toBe(true);
    expect(fromIsoInstant('2024-03-01 12:00:00Z').ok).toBe(true);
  });

  it('truncates a longer fraction to milliseconds, as Date does', () => {
    const read = fromIsoInstant('2024-03-01T12:00:00.98765Z');
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toBe(Date.parse('2024-03-01T12:00:00.98765Z'));

    const short = fromIsoInstant('2024-03-01T12:00:00.5Z');
    expect(short.ok).toBe(true);
    if (short.ok) expect(short.value).toBe(Date.parse('2024-03-01T12:00:00.5Z'));
  });

  it('accepts the leap second ajv accepts, and lands it on the next second', () => {
    const leap = fromIsoInstant('2016-12-31T23:59:60Z');
    expect(leap.ok).toBe(true);
    if (leap.ok) expect(leap.value).toBe(Date.parse('2017-01-01T00:00:00Z'));
    // ...but not one in the middle of the day.
    expect(fromIsoInstant('2016-12-31T12:00:60Z').ok).toBe(false);
  });

  it.each([
    ['not a date at all', 'yesterday'],
    ['a date with no time', '2024-03-01'],
    ['a time with no offset', '2024-03-01T12:00:00'],
    ['a month that does not exist', '2024-13-01T12:00:00Z'],
    ['a day that does not exist', '2024-02-30T12:00:00Z'],
    ['29 February in a common year', '2023-02-29T12:00:00Z'],
    ['29 February in a non-leap century', '1900-02-29T12:00:00Z'],
    ['an hour that does not exist', '2024-03-01T24:00:00Z'],
    ['a minute that does not exist', '2024-03-01T12:60:00Z'],
    ['an offset that does not exist', '2024-03-01T12:00:00+24:00'],
    ['an offset minute that does not exist', '2024-03-01T12:00:00+01:60'],
    ['a two-digit year', '24-03-01T12:00:00Z'],
    ['trailing junk', '2024-03-01T12:00:00Z '],
  ])('refuses %s', (_name, text) => {
    expect(fromIsoInstant(text).ok).toBe(false);
    expect(isIsoInstant(text)).toBe(false);
  });

  it('accepts 29 February in a leap year and a leap century', () => {
    expect(isIsoInstant('2024-02-29T00:00:00Z')).toBe(true);
    expect(isIsoInstant('2000-02-29T00:00:00Z')).toBe(true);
  });

  it('round-trips every instant it writes', () => {
    for (const millis of [...CORPUS, ...sweep(300)]) {
      const written = toIsoInstant(at(millis));
      expect(written.ok).toBe(true);
      if (!written.ok) continue;
      const read = fromIsoInstant(written.value);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value).toBe(millis);
    }
  });
});
