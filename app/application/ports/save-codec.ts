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
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call site: slice 1 task 1.6 (JSON export/import). Whoever writes the
 * first implementation may change this interface without an ADR, and removes this
 * marker in the same change.
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
