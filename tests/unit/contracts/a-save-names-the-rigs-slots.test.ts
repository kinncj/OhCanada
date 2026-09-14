/**
 * A save names the rig's slots, and nothing checked that it did.
 *
 * This is `a-character-names-the-rigs-slots.test.ts` for the *save* side, and it
 * exists for the same reason, one document later. `progress.schema.json`'s
 * `character.skins` used to constrain its property names with
 * `common.schema.json#/$defs/id`, which is kebab-case, while
 * `content/characters/rig.json` names its slots `hairShape`, `hairColour`,
 * `headCovering` and interpolates them into part templates by exactly those
 * keys. `character.schema.json` had already fixed that contradiction on its own
 * side; the progress schema was the copy nobody updated.
 *
 * It failed differently, and worse. A character document with a wrong slot name
 * draws without that part; a *save* with the rig's own slot names failed
 * `SaveCodec.encode`, which validates on the way out as well as in - so every
 * write was refused and the player stayed a first-run player for ever, with
 * nothing said.
 *
 * The schema now accepts the rig's key form, which makes the wrong saves
 * unwritable in the shape they were written. **But a pattern cannot say WHICH
 * keys the rig has** - a save keyed `hairStyle` passes it - and that is a
 * cross-document fact, so it lives here. What is checked is the end of the
 * chain: the character the shipped composition root actually writes, against the
 * real schema run by the real ajv.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { toProgressSnapshot } from '@application/persistence/progress-document';
import { validateProgressDocument } from '@application/persistence/progress-schema';
import type { ProgressSnapshot } from '@application/ports/progress-repository';
import { defaultSettings } from '@domain/entities/player';
import { newProgress, withCharacter } from '@domain/entities/progress';
import type { PlayerCharacter } from '@domain/entities/character';
import type { LocaleCode } from '@domain/ids';

import {
  playerSlots,
  repairSelection,
  toPlayerCharacter,
  toSelection,
} from '../../../app/bootstrap/character-slots';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string): unknown => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8'));

/* -------------------------------------------------------------------------- */
/* the authority: the real schema, the real validator                         */
/* -------------------------------------------------------------------------- */

// Configured exactly as scripts/validate-content.mjs configures it.
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(read('content/schemas/common.schema.json') as object);
const validateWithAjv = ajv.compile(read('content/schemas/progress.schema.json') as object);

const ajvAccepts = (document: unknown): boolean => validateWithAjv(document) === true;
const codecAccepts = (document: unknown): boolean => validateProgressDocument(document).ok;

/** A save document holding exactly this character, built the way the game builds one. */
const saveHolding = (character: PlayerCharacter | null): ProgressSnapshot => {
  const empty = newProgress(defaultSettings('en' as LocaleCode), []);
  const written = toProgressSnapshot(character === null ? empty : withCharacter(empty, character), {
    version: 1,
    updatedAt: 0 as never,
  });
  if (!written.ok) throw new Error('the fixture must produce a snapshot');
  return written.value;
};

/** The character a first run writes: every slot the rig offers, drawn uniformly. */
const asTheGameWritesIt = (): PlayerCharacter =>
  toPlayerCharacter(repairSelection(undefined, () => 0.5).selection);

describe('the save the game writes names the slots the rig actually has', () => {
  const rigSlotNames = playerSlots().map((entry) => entry.name);

  it('has slots to check, so this cannot pass over an empty rig', () => {
    expect(rigSlotNames.length, 'the rig offers no selectable slots, so any key would pass').toBeGreaterThan(0);
    expect(Object.keys(asTheGameWritesIt().skins)).toEqual(rigSlotNames);
  });

  it('is accepted by ajv over the real schema, key for key', () => {
    const save = saveHolding(asTheGameWritesIt());
    expect(ajvAccepts(save), JSON.stringify(validateWithAjv.errors)).toBe(true);
    expect(codecAccepts(save)).toBe(true);
  });

  it('is refused the moment one key is spelled any other way', () => {
    /*
     * The negative control. Without it, "the save validates" could mean "the
     * schema checks nothing about these keys", which is the vacuum this project
     * keeps finding: `propertyNames` is a keyword a value-only test never
     * reaches.
     */
    const character = asTheGameWritesIt();
    const [first] = Object.keys(character.skins);
    expect(first).toBeDefined();
    for (const wrong of [
      first!.replace(/[A-Z]/gu, (upper) => `-${upper.toLowerCase()}`) === first
        ? `${first!}-1`
        : first!.replace(/[A-Z]/gu, (upper) => `-${upper.toLowerCase()}`),
      first!.toUpperCase(),
      `${first!} `,
      `_${first!}`,
    ]) {
      const { [first!]: option, ...rest } = character.skins;
      const save = saveHolding({ ...character, skins: { ...rest, [wrong]: option ?? 'x' } });
      expect(ajvAccepts(save), `ajv accepted a slot keyed "${wrong}"`).toBe(false);
      expect(codecAccepts(save), `the codec accepted a slot keyed "${wrong}"`).toBe(false);
    }
  });

  it('names the same key form character.schema.json does, so the two documents agree', () => {
    /*
     * The two schemas that spell a slot name. They diverged once, silently, and
     * the divergence is what cost every save write; a shared `$ref` is not
     * available across files here, so the agreement is checked instead of
     * assumed.
     */
    const progress = read('content/schemas/progress.schema.json') as {
      $defs: { playerCharacter: { properties: { skins: { propertyNames: { pattern: string } } } } };
    };
    const character = read('content/schemas/character.schema.json') as {
      $defs: { characterSlot: { properties: { name: { pattern: string } } } };
    };
    expect(progress.$defs.playerCharacter.properties.skins.propertyNames.pattern).toBe(
      character.$defs.characterSlot.properties.name.pattern,
    );
  });

  it('records what the pattern cannot say, and what catches it instead', () => {
    /*
     * A slot the rig does not have passes the schema — `hairStyle` is a
     * perfectly good camelCase name — which is the whole reason this file
     * exists. What bounds it is `repairSelection`: an unknown key is a slot this
     * build does not offer, so it is dropped and draws no part, and every slot
     * the save does not name is filled from the rig's fallback, as for any save
     * older than a slot. Only an option id this build no longer offers is a
     * lost choice that is redrawn uniformly and told (TN-LOOK-05); this save
     * names none, so nothing is told.
     */
    const invented = { ...asTheGameWritesIt(), skins: { hairStyle: 'coil' } };
    expect(ajvAccepts(saveHolding(invented))).toBe(true);

    const repaired = repairSelection(toSelection(invented), () => 0);
    expect(Object.keys(repaired.selection)).toEqual(rigSlotNames);
    expect(repaired.selection['hairStyle']).toBeUndefined();
    expect(repaired.repaired).toBe(false);
    for (const { name, slot } of playerSlots()) {
      expect(slot.options).toContain(repaired.selection[name]);
    }
  });
});

describe('a character that chose nothing is not a character (ADR-0024)', () => {
  it('refuses an empty skins object, proved by emptying a real one', () => {
    /*
     * The floor, proved by removing the data rather than by asserting over a
     * fixture written empty. `{}` is the identity element the ADR warns about:
     * every repair folds it back into a fully dressed character - the creator's
     * redraws each missing slot, `repairSkins` redraws a selectable one and
     * falls a costume slot back - so a save that chose nothing comes back as
     * somebody, with no trace that nobody ever chose.
     */
    const character = asTheGameWritesIt();
    expect(ajvAccepts(saveHolding(character))).toBe(true);

    const emptied = { ...character, skins: {} };
    expect(Object.keys(emptied.skins)).toHaveLength(0);
    expect(ajvAccepts(saveHolding(emptied))).toBe(false);
    expect(codecAccepts(saveHolding(emptied))).toBe(false);
    expect(JSON.stringify(validateProgressDocument(saveHolding(emptied)))).toContain(
      '/character/skins',
    );
  });

  it('is a different state from no character at all, which is still accepted', () => {
    // `character: null` is the first run: the one state that legitimately says
    // nothing was chosen, and it has its own spelling.
    const firstRun = saveHolding(null);
    expect(firstRun.character).toBeNull();
    expect(ajvAccepts(firstRun)).toBe(true);
    expect(codecAccepts(firstRun)).toBe(true);
  });
});
