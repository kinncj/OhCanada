/**
 * ADR-0015: a tripwire. This test exists to fail exactly once.
 *
 * `SaveCodec.decode` promises to accept "this version and every older one", and
 * `json-save-codec.ts` keeps that promise with a real mechanism: `SaveMigration`,
 * `migrateForward`, and a loop that walks a document from its version to this
 * build's. The mechanism is unit-tested — with a migration the test supplies.
 * That proves the loop, the ordering and the missing-step failure. It proves
 * nothing about whether a genuine version-1 save survives a genuine step,
 * because there is no version 2 and the list of migrations is empty.
 *
 * The risk this closes is not that the code is wrong. It is that a reader — or a
 * future agent — sees a migration mechanism, a `minSupportedVersion`, and a
 * passing suite, and concludes migration is done. Nothing in the repository
 * currently contradicts that reading at the moment it would matter.
 *
 * So: this asserts version 1 is still the only version. Today that is a
 * statement of fact and costs nothing. The day somebody writes version 2 it
 * fails, and its message is the instruction for what must land alongside.
 *
 * It is deliberately NOT an `OBLIGATION` (ADR-0009). An obligation needs a real
 * date and nothing is owed until a format change is wanted; a date invented to
 * satisfy the format would be re-dated on every run, which ADR-0009 names as the
 * way obligations are defeated. This fires on the event, not on the calendar.
 *
 * It is also NOT `PROVISIONAL (ADR-0008)`. That marker means "nothing has ever
 * implemented or called this", and `migrateForward` runs on every `decode`.
 */

import { describe, expect, it } from 'vitest';

import {
  CURRENT_SAVE_VERSION,
  MIN_SUPPORTED_SAVE_VERSION,
  createJsonSaveCodec,
} from '@application/persistence/json-save-codec';

const WHAT_MUST_LAND =
  'A second save format version has been introduced, so the migration mechanism is ' +
  'now load-bearing and this tripwire has done its job (ADR-0015). Before deleting ' +
  'this test, land all three: (1) a real `SaveMigration` from 1 to 2, wired in from ' +
  'the composition root where the version numbers live — not defaulted inside the ' +
  'codec; (2) a test that decodes a genuine version-1 document produced by this ' +
  "build's own `encode`, not a hand-written fixture, and asserts the migrated " +
  'snapshot preserves every review state, every quest state and every stamp — a ' +
  'migration that silently drops a field resets a player\'s progress and looks like ' +
  'a successful import; (3) an amendment to ADR-0015 recording what the first ' +
  'migration taught, since its Consequences section currently claims migration is ' +
  'untested against a real version change.';

describe('the save format has one version, so migration is untried (ADR-0015)', () => {
  it('writes version 1', () => {
    expect(CURRENT_SAVE_VERSION, WHAT_MUST_LAND).toBe(1);
  });

  it('supports back to version 1, so no migration step is reachable', () => {
    expect(MIN_SUPPORTED_SAVE_VERSION, WHAT_MUST_LAND).toBe(1);
    expect(
      CURRENT_SAVE_VERSION - MIN_SUPPORTED_SAVE_VERSION,
      'The supported version range has widened, which means `migrateForward` can now ' +
        'take a step on real input. ' +
        WHAT_MUST_LAND,
    ).toBe(0);
  });

  it('ships no migrations, and the default is empty rather than a placeholder', () => {
    // The codec is asked, rather than the module's constants read, because what
    // matters is what a caller that supplies no migrations actually gets. A
    // placeholder step defaulted in here would be invisible to the two checks above.
    const codec = createJsonSaveCodec({ maxImportBytes: 1024 });
    expect(codec.version).toBe(1);
    expect(codec.minSupportedVersion).toBe(1);
  });
});
