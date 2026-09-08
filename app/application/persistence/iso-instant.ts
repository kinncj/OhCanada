/**
 * `EpochMillis` <-> `IsoInstant`, written out.
 *
 * The domain holds every moment as `EpochMillis` because what it does with time
 * is arithmetic: "is this question due", "how many whole days since". The save
 * document holds every moment as `IsoInstant` because what a save file is for is
 * being exported, moved between devices and read by a person: sortable,
 * unambiguous about its timezone, legible. Both port headers say the conversion
 * belongs to `SaveCodec` (ADR-0012), and this is it.
 *
 * Why the calendar maths is here rather than `new Date(ms).toISOString()`:
 *
 *  - `Date` is a *clock as well as* a calendar, and this layer is the one place
 *    that must not have a clock. Every rule takes `now` as a parameter for that
 *    reason, and a module that imports the type that also answers `Date.now()`
 *    invites the shortcut back.
 *  - the parse direction cannot use `Date` anyway. `Date.parse` accepts
 *    implementation-defined junk ("Jan 5 2024", "2024-13-45" in some engines),
 *    and this function is the *validation* of every timestamp in an imported
 *    save (SECURITY.md: never trust the shape). Acceptance here mirrors
 *    `ajv-formats`' `date-time` exactly, including its leap-second rule and its
 *    tolerance of `t`, `z`, a space separator and `+hhmm` offsets, so that
 *    `SaveCodec.decode` accepts precisely what `progress.schema.json` accepts —
 *    proved against the real ajv in `tests/unit/contracts/`.
 *
 * The civil-calendar conversion is Howard Hinnant's `days_from_civil` /
 * `civil_from_days`, valid for any proleptic Gregorian date, and pinned against
 * `Date` as an oracle in `tests/unit/application/persistence/iso-instant.test.ts`
 * — the same arrangement ADR-0012 made for the memory model: the library is the
 * authority on the numbers, this file is the authority on the vocabulary, and a
 * test keeps them equal.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { EpochMillis, IsoInstant } from '@domain/ids';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Days in each month of a common year, 1-indexed. */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number =>
  month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month] ?? 0);

/** Days since 1970-01-01 for a proleptic Gregorian date. */
export const daysFromCivil = (year: number, month: number, day: number): number => {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
};

export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** The inverse of `daysFromCivil`. */
export const civilFromDays = (days: number): CivilDate => {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
};

const pad = (value: number, width: number): string => `${value}`.padStart(width, '0');

/** Smallest and largest instant the four-digit-year form can express. */
export const MIN_ISO_EPOCH_MS = daysFromCivil(0, 1, 1) * MS_PER_DAY;
export const MAX_ISO_EPOCH_MS = (daysFromCivil(9999, 12, 31) + 1) * MS_PER_DAY - 1;

/**
 * Format an instant as the save file spells it: `YYYY-MM-DDTHH:MM:SS.sssZ`, UTC,
 * always three fractional digits. Byte-identical to `Date.prototype.toISOString`
 * across the four-digit-year range, which the oracle test asserts.
 *
 * Out-of-range and non-integer inputs fail rather than being coerced: a save that
 * silently wrote `1970-01-01` for a corrupt timestamp would be a save that lies.
 */
export const toIsoInstant = (millis: EpochMillis): Result<IsoInstant> => {
  if (!Number.isFinite(millis) || !Number.isInteger(millis)) {
    return appErr('invalid', 'time.epoch.notAnInstant', 'Not a whole number of milliseconds.', {
      millis,
    });
  }
  if (millis < MIN_ISO_EPOCH_MS || millis > MAX_ISO_EPOCH_MS) {
    return appErr('invalid', 'time.epoch.outOfRange', 'Outside the range a save can express.', {
      millis,
    });
  }
  const days = Math.floor(millis / MS_PER_DAY);
  const msOfDay = millis - days * MS_PER_DAY;
  const { year, month, day } = civilFromDays(days);
  const hour = Math.floor(msOfDay / MS_PER_HOUR);
  const minute = Math.floor((msOfDay % MS_PER_HOUR) / MS_PER_MINUTE);
  const second = Math.floor((msOfDay % MS_PER_MINUTE) / MS_PER_SECOND);
  const milli = msOfDay % MS_PER_SECOND;
  const text =
    `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` +
    `T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}.${pad(milli, 3)}Z`;
  return ok(text as IsoInstant);
};

/**
 * RFC 3339 as `ajv-formats` reads it, split into date and time on `T`, `t` or a
 * space, with the offset required.
 */
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(?:([Zz])|([+-])(\d{2}):?(\d{2})?)$/u;

/**
 * Read an instant from a save.
 *
 * Accepts exactly what `progress.schema.json`'s `format: date-time` accepts and
 * refuses everything else, so a timestamp that passes here is a timestamp the
 * schema would pass. Fractional seconds are truncated to milliseconds, which is
 * what `Date` does with them; a leap second (`23:59:60`) is accepted where ajv
 * accepts it and lands on the following second, because nothing in this game can
 * tell the difference and refusing an import over it would be theatre.
 */
export const fromIsoInstant = (text: string): Result<EpochMillis> => {
  const match = DATE_TIME.exec(text);
  if (match === null) {
    return appErr('invalid', 'time.iso.malformed', 'Not an ISO-8601 instant.', { text });
  }
  // No branch for a missing offset: the pattern requires `Z` or a sign, which is
  // `format: date-time`'s strict-timezone rule, so an offset-less instant never
  // reaches here. A guard for it would be a line no input can execute.
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , sign, offsetHourText, offsetMinuteText] =
    match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText ?? '0');
  const offsetMinute = Number(offsetMinuteText ?? '0');
  const offsetSign = sign === '-' ? -1 : 1;

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return appErr('invalid', 'time.iso.date', 'That date does not exist.', { text });
  }
  if (offsetHour > 23 || offsetMinute > 59) {
    return appErr('invalid', 'time.iso.offset', 'That UTC offset does not exist.', { text });
  }
  if (!(hour <= 23 && minute <= 59 && second < 60)) {
    // ajv's leap-second allowance: 23:59:60 in UTC once the offset is removed.
    const utcMinute = minute - offsetMinute * offsetSign;
    const utcHour = hour - offsetHour * offsetSign - (utcMinute < 0 ? 1 : 0);
    const leapSecond =
      (utcHour === 23 || utcHour === -1) && (utcMinute === 59 || utcMinute === -1) && second < 61;
    if (!leapSecond) {
      return appErr('invalid', 'time.iso.time', 'That time of day does not exist.', { text });
    }
  }

  const wholeSeconds = Math.floor(second);
  // Truncate, do not round: `Date` reads .9999 as 999 ms and so does this.
  const fraction = secondText === undefined ? 0 : fractionMillis(secondText);
  const days = daysFromCivil(year, month, day);
  const millis =
    days * MS_PER_DAY +
    hour * MS_PER_HOUR +
    minute * MS_PER_MINUTE +
    wholeSeconds * MS_PER_SECOND +
    fraction -
    offsetSign * (offsetHour * MS_PER_HOUR + offsetMinute * MS_PER_MINUTE);

  return ok(millis as EpochMillis);
};

/** Milliseconds from the fractional part of a seconds field, truncated to three digits. */
const fractionMillis = (secondText: string): number => {
  const dot = secondText.indexOf('.');
  if (dot === -1) return 0;
  return Number(secondText.slice(dot + 1).padEnd(3, '0').slice(0, 3));
};

/** Would `progress.schema.json`'s `format: date-time` accept this string? */
export const isIsoInstant = (text: string): boolean => fromIsoInstant(text).ok;
