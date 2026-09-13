/**
 * The save-format migrations this build knows, and the first one that is real.
 *
 * `SaveMigration` and `migrateForward` have existed since slice 1 with an empty
 * list behind them, and `save-format-version-is-still-one.test.ts` was the
 * tripwire that said so out loud: a mechanism nothing has ever exercised on real
 * input is not a mechanism anyone should trust. Version 2 is what fires it.
 *
 * **What changed in 4.** `character.skins` is keyed the way the rig spells its
 * slots. See `renameSkinSlotsToTheRigsSpelling` for what a version-3 save holds
 * and why this one restores rather than drops.
 *
 * **What changed in 3.** The exam attempt stopped being a score line and became a
 * record of the exam (ADR-0027): `answers[]` in draw order replaced
 * `askedQuestionIds` and `correctCount`, `finishedAt` stopped being nullable, and
 * `examInProgress` arrived beside `exams` so an unfinished exam is not a row in
 * the history. Version 2 wrote none of what version 3 needs — see
 * `dropVersionTwoExams` for what that costs and why it costs nothing yet.
 *
 * **What changed in 2.** `settings.holdToChooseMs` — TN-SET-09's single-switch
 * hold time — became a persisted property. It looks like a trivial addition and
 * it is not: `progress.schema.json` is `additionalProperties: false` with every
 * declared property required, so a version-1 document is *invalid* against the
 * version-2 schema. Widening the schema to make the property optional would have
 * made both documents valid and both readers guess, which is how "a save that
 * half-loads" starts. A version and a migration say the same thing without
 * guessing.
 *
 * **Where these are wired.** The composition root passes this list to
 * `createJsonSaveCodec`; the codec defaults to no migrations. That is deliberate
 * and the tripwire asked for it: the version numbers and the steps between them
 * belong where the build is assembled, not defaulted inside the thing whose job
 * is to apply them. A test that wants to decode a version-1 document has to say
 * so by passing this list, which is exactly the visibility that was wanted.
 *
 * **What a migration may assume: nothing.** It runs *before* the schema check
 * (`json-save-codec.ts` step 4 of 5), on a document that has been parsed and
 * version-gated and nothing more. So every step below inspects what it touches
 * and leaves anything it does not understand exactly as it found it, letting
 * `validateProgressDocument` produce the error message. A migration that threw,
 * or that "repaired" a document it had not understood, would turn a readable
 * failure into a lost save.
 */

import { ok } from '@common/result';
import type { Result } from '@common/result';

import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';
import type { SaveMigration } from '@application/persistence/json-save-codec';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `progress.schema.json`'s `skins` property names, which is the rig's slot key
 * form. Written out here rather than imported from `progress-schema.ts`, whose
 * exported surface is one function on purpose. `save-migrations.test.ts` pins
 * this against the real validator, so the copy cannot drift into accepting a
 * name a save could not hold.
 */
const RIG_SLOT_NAME = /^[a-z][A-Za-z0-9]*$/u;

/**
 * 1 -> 2: a switch user's hold time stops being forgotten between sessions.
 *
 * A version-1 save cannot carry the field, so the value it gets is the one the
 * game ships with. That is a real loss for the player who had set two seconds
 * before this build — it is unrecoverable, the number was never written down —
 * and it is stated here rather than glossed, because "the migration restored
 * their setting" would be false.
 */
export const addHoldToChooseMs: SaveMigration = {
  from: 1,
  to: 2,
  apply: (document: Readonly<Record<string, unknown>>): Result<Record<string, unknown>> => {
    const next = { ...document, version: 2 };
    const settings = document['settings'];
    if (!isPlainObject(settings)) {
      // Not a shape this step understands. Untouched, and the schema check that
      // runs next says what is wrong with it in the language of a JSON pointer.
      return ok(next);
    }
    const existing = settings['holdToChooseMs'];
    return ok({
      ...next,
      settings: {
        ...settings,
        holdToChooseMs:
          typeof existing === 'number' && Number.isFinite(existing)
            ? existing
            : DEFAULT_HOLD_TO_CHOOSE_MS,
      },
    });
  },
};

/**
 * 2 -> 3: the exam record becomes the exam, and version-2 attempts do not survive.
 *
 * **The drop is the decision, not an oversight.** A version-2 attempt records
 * `askedQuestionIds` and one `correctCount`; a version-3 attempt records, per
 * question, the subject it came from, the option the player chose and the option
 * that was right. None of those three was ever written down, so there is no
 * function from the old record to the new one. What a conversion would have to
 * do is invent them — and the shape of the invention is the one ADR-0024 names:
 * twenty answers with `chosenIndex: null` would present a player's 16 out of 20
 * as "answered nothing, got nothing wrong", on a result screen, in the past
 * tense. A migration that lies is worse than one that drops.
 *
 * **What it costs, stated rather than glossed** — the same way 1 -> 2 states the
 * hold time it cannot restore. In principle: a player's exam history. In fact:
 * nothing, and the reason is checkable rather than asserted. **No shipped code
 * path has ever written an exam attempt** — exam mode is unbuilt, and
 * `withExamAttempt` is called from tests only — so no version-1 or version-2 save
 * on any device contains one. `save-migrations.test.ts` pins that claim; when
 * exam mode lands it will write version 3, and no new version-2 document can ever
 * exist to be reached by this step.
 *
 * Everything else in the document is left exactly as found, including an `exams`
 * that is not an array: the schema check runs next and says what is wrong with it
 * in the language of a JSON pointer, which is a better error than anything a
 * migration could repair its way into.
 */
export const dropVersionTwoExams: SaveMigration = {
  from: 2,
  to: 3,
  apply: (document: Readonly<Record<string, unknown>>): Result<Record<string, unknown>> => {
    const next: Record<string, unknown> = { ...document, version: 3, examInProgress: null };
    // Untouched when it is not a list of attempts: not a shape this step
    // understands, so it goes to the validator as it arrived.
    if (Array.isArray(document['exams'])) next['exams'] = [];
    return ok(next);
  },
};

/**
 * 3 -> 4: a character is keyed the way the rig spells its slots, and the saves
 * written the other way are carried across rather than dropped.
 *
 * **What version 3 holds.** `progress.schema.json` constrained `skins`' property
 * names with the shared kebab-case id while `content/characters/rig.json` names
 * its slots `hairShape`, `hairColour`, `headCovering` - the same contradiction
 * `character.schema.json` had already fixed on its own side. Because
 * `SaveCodec.encode` validates on the way out as well as in, a character keyed
 * the rig's way failed *every* write, so the composition root kebab-cased the
 * slot name on the way into the save and camel-cased it on the way out. The
 * schema now accepts the rig's form and that conversion is gone; what is left on
 * a device is a version-3 document whose skins read `hair-shape`, `hair-colour`,
 * `head-covering`.
 *
 * **This one restores, and that is the difference from 2 -> 3.** The exam step
 * dropped what it could not carry because the three facts version 3 needs - the
 * subject, the option chosen, the option that was right - were never written
 * down, so a conversion would have had to invent them. Here nothing is missing:
 * the kebab key *is* the rig's key, spelled by a rule, and un-spelling it is the
 * same rule read backwards. A character is also the least replaceable thing in
 * the save - a level comes back by walking it again; an appearance a player sat
 * and chose does not - so dropping it to save four lines would be the wrong
 * trade even if it were a close one.
 *
 * **What it costs: nothing, and nothing is dropped.** Every key any build ever
 * wrote came out of one rule, "a hyphen and a lower case letter for every upper
 * case one", whose inverse below is exact on precisely that image. A key
 * *outside* it - `hair-1`, say, which no build could produce because a rig slot
 * named `hair1` kebabs to `hair1` - un-spells to something the schema still
 * refuses. So does a pair of keys that would land on the same name. In both
 * cases this step leaves `skins` **exactly as it found it** and lets
 * `validateProgressDocument` name the key in a JSON pointer, which is this
 * module's rule for input it does not understand and a better outcome than half
 * a character or a silently dropped slot. The document that reaches either
 * branch is a hand-edited one.
 */
export const renameSkinSlotsToTheRigsSpelling: SaveMigration = {
  from: 3,
  to: 4,
  apply: (document: Readonly<Record<string, unknown>>): Result<Record<string, unknown>> => {
    const next = { ...document, version: 4 };
    const character = document['character'];
    // `null` is a save with no character, which is most of them, and anything
    // else here is not a shape this step understands.
    if (!isPlainObject(character)) return ok(next);
    const skins = character['skins'];
    if (!isPlainObject(skins)) return ok(next);

    const renamed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(skins)) {
      const name = key.replace(/-([a-z])/gu, (_whole, letter: string) => letter.toUpperCase());
      // Un-spelled to something the schema would refuse anyway, or onto a name
      // another key already took: not this step's to guess at.
      if (!RIG_SLOT_NAME.test(name) || Object.hasOwn(renamed, name)) return ok(next);
      renamed[name] = value;
    }
    return ok({ ...next, character: { ...character, skins: renamed } });
  },
};

/**
 * Every step this build can take, oldest first.
 *
 * `migrateForward` looks steps up by their `from`, so order is documentation
 * rather than mechanism — but a list a person can read top to bottom is how the
 * next author sees that 1 -> 2 exists before writing 2 -> 3.
 */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [
  addHoldToChooseMs,
  dropVersionTwoExams,
  renameSkinSlotsToTheRigsSpelling,
];
