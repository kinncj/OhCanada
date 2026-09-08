/**
 * SaveCodec — the JSON export/import format, separated from where bytes are stored.
 *
 * Two implementations are expected and both satisfy this port: the one the
 * persistence adapter uses to write `localStorage`, and the one the settings screen
 * uses for the copy-paste save code. Splitting codec from repository is what lets a
 * save move between devices without a server, and what makes format migration a
 * pure, unit-testable function.
 *
 * `decode` never trusts its input: a save code may be truncated, hand-edited, or
 * written by a newer build. It validates against the save schema, migrates older
 * versions forward, and returns `Result` — a bad code shows a message, it does not
 * crash the game or silently reset progress.
 *
 * Consumed since slice 1 task 1.6, so the ADR-0008 marker is gone: this shape has
 * been compiled against a real caller. `decode`'s promise is now keepable, which
 * it was not when this file was written — `content/schemas/progress.schema.json`
 * exists, so "validate against the save schema" names something real.
 */

import type { Result } from '@common/result';
import type { ProgressSnapshot } from './progress-repository';

export interface SaveCodec {
  /** Format version this codec writes. `decode` accepts this and every older one. */
  readonly version: number;
  /** Lowest version `decode` can migrate from. Below it, decoding fails cleanly. */
  readonly minSupportedVersion: number;

  encode(snapshot: ProgressSnapshot): Result<string>;

  /**
   * Validate, migrate and return. Failure kinds the caller should expect:
   * `invalid` (not our format / schema violation) and `unsupported`
   * (a version this build cannot migrate, e.g. a save from a newer release).
   */
  decode(encoded: string): Result<ProgressSnapshot>;
}
