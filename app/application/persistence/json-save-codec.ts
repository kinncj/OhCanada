/**
 * The JSON save format: what gets written to `localStorage`, and what a player
 * carries between devices as a file.
 *
 * `decode` never trusts its input. In order, and the order is the point
 * (SECURITY.md):
 *
 *  1. **Size first, before parsing.** A file over `save.maxImportBytes` is
 *     refused without `JSON.parse` ever seeing it. Capping after parsing would
 *     mean the parser has already read the thing the cap exists to keep out.
 *  2. `JSON.parse`, inside a `try`. Never `eval`, never `new Function`, never a
 *     dynamic import: an imported save is data and is only ever read as data.
 *  3. The version, before the shape, so a save from a newer build gets
 *     TN-SAVE-04's "This saved game is from a newer version." rather than a
 *     generic "we could not read it" — a newer document legitimately has
 *     properties this build's schema rejects.
 *  4. Migration forward to this build's version.
 *  5. The schema (`progress-schema.ts`), whole, with nothing applied partially.
 *
 * The cap is a constructor argument rather than a constant because it lives in
 * `content/game.config.json#/save/maxImportBytes`, so the number the check uses
 * and the number the message quotes cannot drift apart (OQ-SAVE-3).
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { ProgressSnapshot } from '@application/ports/progress-repository';
import type { SaveCodec } from '@application/ports/save-codec';

import { validateProgressDocument } from '@application/persistence/progress-schema';

/** The version this build writes. */
export const CURRENT_SAVE_VERSION = 1;

/** The oldest version this build can read. Raised only when a migration is retired. */
export const MIN_SUPPORTED_SAVE_VERSION = 1;

/**
 * One step forward in the save format.
 *
 * There are none yet — version 1 is the first — and there is deliberately no
 * placeholder pretending otherwise. The mechanism exists because `SaveCodec`
 * promises `decode` accepts "this version and every older one", and a promise
 * with no mechanism is the kind of thing this project keeps finding in its own
 * config files. The first real migration is written beside version 2 and passed
 * in from the composition root, where the version numbers live.
 */
export interface SaveMigration {
  readonly from: number;
  readonly to: number;
  /** Takes the parsed document, returns the next version's. Pure; never mutates. */
  readonly apply: (document: Readonly<Record<string, unknown>>) => Result<Record<string, unknown>>;
}

export interface JsonSaveCodecOptions {
  /** `content/game.config.json#/save/maxImportBytes`. Read it; do not hardcode it. */
  readonly maxImportBytes: number;
  readonly version?: number;
  readonly minSupportedVersion?: number;
  readonly migrations?: readonly SaveMigration[];
}

/**
 * How many bytes this string is as UTF-8, without a `TextEncoder`.
 *
 * The cap is a byte cap, and `String.length` counts UTF-16 units: an emoji-laden
 * file would be measured at half its size and a file of accented French at its
 * true length only by accident. Counting the code points costs one pass over a
 * string that is about to be parsed anyway.
 */
export const utf8ByteLength = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const versionOf = (value: unknown): number | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const version = (value as Record<string, unknown>).version;
  return typeof version === 'number' && Number.isInteger(version) ? version : undefined;
};

const migrateForward = (
  document: Record<string, unknown>,
  from: number,
  to: number,
  migrations: readonly SaveMigration[],
): Result<Record<string, unknown>> => {
  let current = document;
  let version = from;
  while (version < to) {
    const step = migrations.find((migration) => migration.from === version);
    if (step === undefined) {
      return appErr('unsupported', 'save.migration.missing', 'This save cannot be brought up to date.', {
        from: version,
        to,
      });
    }
    const migrated = step.apply(current);
    if (!migrated.ok) return migrated;
    current = migrated.value;
    version = step.to;
  }
  return ok(current);
};

/**
 * Build the codec. `maxImportBytes` comes from the game config; `version`,
 * `minSupportedVersion` and `migrations` default to this build's.
 */
export const createJsonSaveCodec = (options: JsonSaveCodecOptions): SaveCodec => {
  const version = options.version ?? CURRENT_SAVE_VERSION;
  const minSupportedVersion = options.minSupportedVersion ?? MIN_SUPPORTED_SAVE_VERSION;
  const migrations = options.migrations ?? [];
  const maxImportBytes = options.maxImportBytes;

  return {
    version,
    minSupportedVersion,

    encode(snapshot: ProgressSnapshot): Result<string> {
      // Validated on the way out as well as on the way in: a document this build
      // could not read back is a document it must not write. The cost is one
      // walk of an object that is about to be stringified anyway.
      const valid = validateProgressDocument(snapshot);
      if (!valid.ok) return valid;
      return ok(JSON.stringify(snapshot));
    },

    decode(encoded: string): Result<ProgressSnapshot> {
      const bytes = utf8ByteLength(encoded);
      if (bytes > maxImportBytes) {
        return appErr('invalid', 'save.import.tooBig', 'That file is too big.', {
          bytes,
          maxImportBytes,
        });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(encoded);
      } catch (cause) {
        return appErr(
          'invalid',
          'save.parse.failed',
          'That file is not JSON.',
          { bytes },
          cause,
        );
      }

      const found = versionOf(parsed);
      if (found === undefined) {
        return appErr('invalid', 'save.version.missing', 'That file does not say what it is.', {});
      }
      if (found > version) {
        return appErr(
          'unsupported',
          'save.version.newer',
          'This saved game is from a newer version.',
          { found, version },
        );
      }
      if (found < minSupportedVersion) {
        return appErr(
          'unsupported',
          'save.version.tooOld',
          'This saved game is too old to read.',
          { found, minSupportedVersion },
        );
      }

      const migrated = migrateForward(
        parsed as Record<string, unknown>,
        found,
        version,
        migrations,
      );
      if (!migrated.ok) return migrated;

      return validateProgressDocument(migrated.value);
    },
  };
};
