/**
 * The character creator's content, derived from the rig and named from the copy
 * table — and the only place in the program that joins the two.
 *
 * ## Why the rig and not a character document
 *
 * `content/characters/player.json` **does not exist**. `character.schema.json`
 * is where `labelKey` lives, on the slot and on the option, and a player
 * document is what ADR-0010 means by the creator's content arriving as data;
 * `guide.json` and `officer.json` are already written in exactly that shape.
 * The player's is not, so the creator could not be mounted from one.
 *
 * `content/characters/rig.json` carries the same three facts — which slots the
 * creator offers, which options each slot has, and in what order — and it is
 * already the source every one of those documents is checked against
 * (`tests/unit/contracts/a-character-names-the-rigs-slots.test.ts`). So this
 * module reads the rig, and derives each `labelKey` by the one rule `TN-LOOK`
 * fixes: `creator.slot.<slotName>` and `creator.<slotName>.<optionId>`, spelled
 * as the rig spells them. That is the same key a player document would have
 * carried, produced by the rule a gate can check rather than by a table
 * somebody maintains.
 *
 * **This is not a second source of truth and must not become one.** No slot
 * name, option id or order is written down here; every one is read. The day
 * `content/characters/player.json` lands, {@link creatorSlots} reads its
 * `slots[]` instead of the rig's and nothing else in the program changes —
 * which is the property that made building against the rig acceptable rather
 * than merely expedient. What that document needs is reported with the task.
 *
 * ## Which slots the creator offers: the rig's flag, and nothing else
 *
 * A slot is offered **because the rig marks it `playerSelectable`**, and a slot
 * the rig does not mark is never offered, whatever else is true of it. This
 * used to be decided by the copy table: a slot with no `creator.slot.<name>` row
 * was skipped, which made `costume` look hidden on purpose when it was hidden by
 * accident — it has no row — and would have made a selectable slot that lost its
 * row vanish without a sound. ADR-0024 is the rule that forbids the second: an
 * absent row must not reduce to "nothing to show". So a selectable slot with a
 * missing row **throws**, naming every missing key at once ({@link creatorSlots}),
 * and `tests/unit/bootstrap/character-slots.test.ts` fails the build on the same
 * condition before any player could reach it.
 *
 * A selectable slot with **no options** is still offered nothing: there is
 * nothing to choose, so no group is drawn, rather than a heading over an empty
 * group. `presentation` was in that state until its art landed.
 *
 * ## The skin swatches are the art's own ramps
 *
 * Each skin option carries a swatch, and the colour is read from
 * `assets/style/palette.json` — `ramps[<option id>].base`, resolved through
 * `colours` — rather than written anywhere in `app/`. The option id *is* the
 * ramp id (`assets/style/art-bible.md` §8), so there is no mapping to keep. A
 * skin option with no ramp throws, for the same ADR-0024 reason: a swatch
 * quietly missing is a skin tone quietly reduced to a number.
 *
 * ## What is deliberately absent
 *
 * A `fallback` never reaches the creator. The rig says in as many words that
 * `fallback` is "for NPC documents and save recovery only" and that "the
 * creator never renders it as a pre-selection", so {@link repairSelection}
 * repairs with a **uniform draw** and this module never passes a fallback to
 * `app/ui`. `CreatorSlot` has no field for one.
 *
 * Composition root (ADR-0005): `app/ui` may not read content, and `app/domain`
 * may not read a file. This is the only layer allowed to see both.
 */

import rigJson from '@content/characters/rig.json';
import paletteJson from '../../assets/style/palette.json';

import type { RigDocument, RigSlot } from '@application/ports';
import type { PlayerCharacter } from '@domain/entities/character';
import type { CharacterId } from '@domain/ids';
import type { CharacterSelection, CreatorOption, CreatorSlot } from '@ui/character-creator';
import { hasCopyRow, text, UI_LOCALES, type UiLocale } from '@ui/copy';

const RIG = rigJson as unknown as RigDocument;

/**
 * The two parts of `assets/style/palette.json` a swatch needs: which colour id
 * is a ramp's base, and what that id's colour is.
 */
export interface SwatchPalette {
  readonly colours: Readonly<Record<string, string>>;
  readonly ramps: Readonly<Record<string, { readonly base: string } | undefined>>;
}

const PALETTE = paletteJson as unknown as SwatchPalette;

/**
 * The slots whose options are palette ramps, and so are drawn as swatches.
 *
 * One entry, and a set rather than a rule over every id, on purpose: `skin` is
 * the one slot where colour is the content and the art bible makes the option
 * id the ramp id. A rule that drew a swatch for any option whose id happened to
 * name a ramp would put one on a future option by coincidence.
 */
const SWATCHED_SLOTS: ReadonlySet<string> = new Set(['skin']);

/**
 * The artboard the creator dresses: the one that offers a choice.
 *
 * The same rule `app/adapters/phaser/character-cast.ts` uses to decide who the
 * player is, and stated once in each place rather than shared, because the two
 * directories may not import each other. A second playable character is a rig
 * edit; until there is one, the first is the only.
 */
function playerArtboard(rig: RigDocument): RigDocument['artboards'][number] | null {
  return rig.artboards.find((candidate) => candidate.playerSelectableSlots.length > 0) ?? null;
}

/** `hairShape` → `slot-hair-shape`, which is what `TN-LOOK-01` names the group. */
export function slotTestId(slotName: string): string {
  return `slot-${slotName.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`)}`;
}

/** The rig's own slot key → the row that names it. */
export function slotLabelKey(slotName: string): string {
  return `creator.slot.${slotName}`;
}

/** The rig's own option id → the row that names it. Never a shared row. */
export function optionLabelKey(slotName: string, optionId: string): string {
  return `creator.${slotName}.${optionId}`;
}

/**
 * The slots the creator offers, with the ids the rig declares — and nothing
 * about what they are called.
 *
 * **Whether** a slot is offered is the slot's own `playerSelectable` flag. The
 * copy table has no say in it: a selectable slot with no row is a build defect
 * that {@link creatorSlots} throws on, never a slot that quietly is not there.
 * A selectable slot with no options is offered nothing.
 *
 * **In what order** is the player artboard's `playerSelectableSlots`, which is
 * the list a player reads down; a selectable slot that list forgot is appended
 * in the rig's declaration order rather than dropped, because the flag is what
 * decides and a missing list entry is a rig defect the player should not pay
 * for. A listed slot the rig marks `playerSelectable: false` is not offered —
 * `tests/unit/contracts/rig-is-coherent.test.ts` already fails that rig.
 */
export function playerSlots(
  rig: RigDocument = RIG,
): readonly { readonly name: string; readonly slot: RigSlot }[] {
  const slots = rig.slots as unknown as Readonly<Record<string, RigSlot | undefined>>;
  const listed = playerArtboard(rig)?.playerSelectableSlots ?? [];
  const order = [
    ...listed.filter((name) => slots[name] !== undefined),
    ...Object.keys(slots).filter((name) => !listed.includes(name)),
  ];
  const found: { name: string; slot: RigSlot }[] = [];
  for (const name of order) {
    const slot = slots[name];
    if (slot === undefined || !slot.playerSelectable || slot.options.length === 0) continue;
    found.push({ name, slot });
  }
  return found;
}

/** The row under a slot that says how to read its options, when one exists. */
export function slotHelpKey(slotName: string): string {
  return `${slotLabelKey(slotName)}.help`;
}

/**
 * The swatch colour for one option: the base tone of the palette ramp the
 * option id names, or `undefined` when there is no such ramp.
 */
export function optionSwatch(
  optionId: string,
  palette: SwatchPalette = PALETTE,
): string | undefined {
  const base = palette.ramps[optionId]?.base;
  return base === undefined ? undefined : palette.colours[base];
}

/** The character document id the creator's choices belong to. */
export function playerCharacterId(rig: RigDocument = RIG): string {
  return String(playerArtboard(rig)?.characterId ?? 'player');
}

/**
 * Every row an offered slot needs and the copy table does not have: the slot's
 * label and each option's name. All of them, not the first (`TN-LOOK-04`).
 */
export function missingCreatorRows(rig: RigDocument = RIG): readonly string[] {
  const missing: string[] = [];
  for (const { name, slot } of playerSlots(rig)) {
    if (!hasCopyRow(slotLabelKey(name))) missing.push(slotLabelKey(name));
    for (const optionId of slot.options) {
      if (!hasCopyRow(optionLabelKey(name, optionId))) missing.push(optionLabelKey(name, optionId));
    }
  }
  return missing;
}

/**
 * A skin option the palette has no ramp for. Named, all of them, so a re-derived
 * or renamed ramp fails with the id rather than drawing a blank swatch.
 */
export function missingSwatches(
  rig: RigDocument = RIG,
  palette: SwatchPalette = PALETTE,
): readonly string[] {
  const missing: string[] = [];
  for (const { name, slot } of playerSlots(rig)) {
    if (!SWATCHED_SLOTS.has(name)) continue;
    for (const optionId of slot.options) {
      if (optionSwatch(optionId, palette) === undefined) missing.push(`${name}.${optionId}`);
    }
  }
  return missing;
}

/**
 * The creator's groups for one language.
 *
 * **Throws** when an offered slot is missing a row or a swatch. ADR-0010 forbids
 * inventing the words, and ADR-0024 forbids the other way out — dropping the
 * group — because a slot that disappears when its row does is a slot whose
 * absence reads as a decision. The message names every missing key, so one run
 * reports the whole gap.
 */
export function creatorSlots(
  locale: UiLocale,
  rig: RigDocument = RIG,
  palette: SwatchPalette = PALETTE,
): readonly CreatorSlot[] {
  const missing = missingCreatorRows(rig);
  if (missing.length > 0) {
    throw new Error(
      `The rig offers the player a choice nothing names: ${missing.join(', ')}. A slot the rig ` +
        'marks playerSelectable is drawn or the build fails; it is never silently left out. ' +
        'See docs/stories/TN-LOOK-what-the-player-can-choose.md (TN-LOOK-04) and ADR-0024.',
    );
  }
  const unswatched = missingSwatches(rig, palette);
  if (unswatched.length > 0) {
    throw new Error(
      `No palette ramp draws these skin options: ${unswatched.join(', ')}. Every skin tone is ` +
        'shown as a swatch from assets/style/palette.json, so colour and name arrive together.',
    );
  }

  return playerSlots(rig).map(({ name, slot }): CreatorSlot => {
    const helpKey = slotHelpKey(name);
    const options = slot.options.map((optionId): CreatorOption => {
      const swatch = SWATCHED_SLOTS.has(name) ? optionSwatch(optionId, palette) : undefined;
      return {
        id: optionId,
        name: text(locale, optionLabelKey(name, optionId) as Parameters<typeof text>[1]),
        ...(swatch === undefined ? {} : { swatch }),
      };
    });
    return {
      id: name,
      testId: slotTestId(name),
      label: text(locale, slotLabelKey(name) as Parameters<typeof text>[1]),
      /* Optional by design: a slot whose options read on their own needs no
         line explaining how to read them. */
      ...(hasCopyRow(helpKey) ? { help: text(locale, helpKey) } : {}),
      options,
    };
  });
}

/** Both languages at once, which is the shape `app/ui/shell.ts` takes. */
export function creatorSlotsByLocale(
  rig: RigDocument = RIG,
  palette: SwatchPalette = PALETTE,
): Readonly<Record<UiLocale, readonly CreatorSlot[]>> {
  const table: Partial<Record<UiLocale, readonly CreatorSlot[]>> = {};
  for (const locale of UI_LOCALES) table[locale] = creatorSlots(locale, rig, palette);
  return table as Record<UiLocale, readonly CreatorSlot[]>;
}

/** One option, drawn uniformly. `random` returns [0, 1). */
function draw(options: readonly string[], random: () => number): string | undefined {
  if (options.length === 0) return undefined;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

export interface RepairedSelection {
  readonly selection: CharacterSelection;
  /** A slot was redrawn, so the player is told once (`TN-LOOK-05`). */
  readonly repaired: boolean;
}

/**
 * Make a saved appearance wearable again, without ever choosing the fallback.
 *
 * `TN-LOOK-05`: "the slot whose option is gone was filled by a uniform draw
 * over that slot's options. And it was not filled with the rig's `fallback` for
 * that slot." `repairSkins` in `app/domain/entities/character.ts` used to fill
 * every slot from `slot.fallback`, which is right for a costume slot and is a
 * default player for a selectable one; it now draws uniformly for a selectable
 * slot and takes a `draw` it cannot be called without. This function stays
 * because it repairs against **the rig**, which is where the creator's slots
 * come from while `content/characters/player.json` does not exist; the domain
 * one repairs against a `Character` document. The day that document lands, this
 * is the caller that hands `repairSkins` its draw.
 *
 * **A slot the save does not name is not a repair.** It is a save written
 * before that slot existed — every save made before `presentation` opened —
 * and the player lost nothing, so telling them "one of your choices is not in
 * this version" would be untrue, and would be told to every returning player.
 * That slot takes the rig's `fallback`, silently: the case the rig reserves
 * `fallback` for ("an NPC document or a repaired save must not acquire a
 * presentation nobody chose"). Only a saved option id this build does not
 * offer is a choice taken away, and only that is redrawn and told.
 *
 * A slot in the save that **this build does not have** is ignored and costs
 * nothing: an unknown slot draws no part, which is the mechanism every "none"
 * option already uses (`OQ-FIRSTRUN-5`).
 */
export function repairSelection(
  saved: CharacterSelection | undefined,
  random: () => number,
  rig: RigDocument = RIG,
): RepairedSelection {
  const selection: Record<string, string> = {};
  let repaired = false;
  for (const { name, slot } of playerSlots(rig)) {
    const chosen = saved?.[name];
    if (chosen !== undefined && slot.options.includes(chosen)) {
      selection[name] = chosen;
      continue;
    }
    if (saved !== undefined && chosen === undefined) {
      /* Named by nothing in the save: the slot is newer than the save. The
         fallback when the rig gives a usable one, a draw when it does not, and
         never a repair either way. */
      const filled =
        slot.fallback !== null && slot.options.includes(slot.fallback)
          ? slot.fallback
          : draw(slot.options, random);
      if (filled !== undefined) selection[name] = filled;
      continue;
    }
    const drawn = draw(slot.options, random);
    if (drawn === undefined) continue;
    selection[name] = drawn;
    /* Only a *saved* character can be repaired. A save with no character at all
       is a first run, and a first run is a draw rather than a repair, so it
       raises no message. */
    if (saved !== undefined) repaired = true;
  }
  return { selection, repaired };
}

/* --------------------------------------------- the save, in the rig's words --- */

/**
 * The creator's choices as the save carries them: **unchanged**.
 *
 * There were two conversions here, and they are gone.
 * `content/schemas/progress.schema.json` used to constrain `skins`' property
 * names with `common.schema.json#/$defs/id`, which is kebab-case, while the rig
 * names its slots `hairShape`, `hairColour` and `headCovering` and interpolates
 * them into part templates by exactly those keys - the same contradiction
 * `character.schema.json` had already fixed on its own side. Because
 * `progress-schema.ts` enforces the pattern on **encode** as well as decode,
 * every save write of a character keyed the rig's way was refused, and the
 * player stayed a first-run player for ever. So this module kebab-cased the
 * slot name on the way in and camel-cased it on the way out, in one place, with
 * the defect written on it.
 *
 * The schema now accepts the rig's form, `save-migrations.ts` carries a
 * version-3 save's kebab keys forward, and these two functions are the identity
 * they always should have been. What is left below is the branding and the
 * null-to-undefined step, which are type boundaries rather than conversions.
 */
export function toPlayerCharacter(
  selection: CharacterSelection,
  rig: RigDocument = RIG,
): PlayerCharacter {
  return {
    /* Branded at the boundary. `parseCharacterId` would answer a `Result` for
       a string the rig already validated against `common.schema.json`'s id
       pattern, and a boot sequence that could fail on its own content is a
       worse failure mode than a cast the schema has already checked. */
    characterId: playerCharacterId(rig) as CharacterId,
    /* Copied, not passed through: the save must not alias an object the creator
       still holds. */
    skins: { ...selection },
  };
}

/** The saved character as the creator reads it. */
export function toSelection(character: PlayerCharacter | null): CharacterSelection | undefined {
  /* `null` is "no character yet", which is what decides the first run, and
     `undefined` is what `repairSelection` reads as one. The only thing this
     function still does. */
  if (character === null) return undefined;
  return { ...character.skins };
}
