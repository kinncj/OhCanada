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

import type { RigDocument, RigSlot } from '@application/ports';
import type { PlayerCharacter } from '@domain/entities/character';
import type { CharacterId } from '@domain/ids';
import type { CharacterSelection, CreatorSlot } from '@ui/character-creator';
import { hasCopyRow, text, UI_LOCALES, type UiLocale } from '@ui/copy';

const RIG = rigJson as unknown as RigDocument;

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
 * The player-selectable slots, in the rig's order, with the ids the rig
 * declares — and nothing about what they are called.
 *
 * The order is the artboard's `playerSelectableSlots`, which is the list a
 * player reads down. `slots` is a record and a record has no order worth
 * relying on.
 */
export function playerSlots(
  rig: RigDocument = RIG,
): readonly { readonly name: string; readonly slot: RigSlot }[] {
  const artboard = playerArtboard(rig);
  if (artboard === null) return [];
  const slots = rig.slots as unknown as Readonly<Record<string, RigSlot | undefined>>;
  const found: { name: string; slot: RigSlot }[] = [];
  for (const name of artboard.playerSelectableSlots) {
    const slot = slots[name];
    /* A name the artboard offers and the rig does not declare is a rig defect,
       and dropping it is the only honest answer here: inventing a slot would be
       inventing content, and throwing would take the game down for a screen the
       player can still use with four groups. */
    if (slot === undefined || !slot.playerSelectable || slot.options.length === 0) continue;
    found.push({ name, slot });
  }
  return found;
}

/** The character document id the creator's choices belong to. */
export function playerCharacterId(rig: RigDocument = RIG): string {
  return String(playerArtboard(rig)?.characterId ?? 'player');
}

/**
 * A slot or an option the rig declares and the copy table has never named.
 *
 * Reported rather than drawn. `ADR-0010` forbids this directory inventing
 * player-facing text, and a group whose heading is a key — or an option whose
 * name is `creator.hairShape.fringe` — is that rule broken in the one place a
 * player would see it. So a slot with no row is **left out of the creator** and
 * named on the console, which is a screen that works with four groups rather
 * than a screen that shows a developer a string.
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
 * The creator's groups for one language.
 *
 * A slot whose own label has no row is dropped entirely; an option with no row
 * is dropped from its slot. Both are build defects that
 * `tests/unit/bootstrap/character-slots.test.ts` fails on, so neither reaches a
 * player — this is what the program does if one ever did.
 */
export function creatorSlots(locale: UiLocale, rig: RigDocument = RIG): readonly CreatorSlot[] {
  const built: CreatorSlot[] = [];
  for (const { name, slot } of playerSlots(rig)) {
    const labelKey = slotLabelKey(name);
    if (!hasCopyRow(labelKey)) continue;
    const options = slot.options
      .filter((optionId) => hasCopyRow(optionLabelKey(name, optionId)))
      .map((optionId) => ({
        id: optionId,
        name: text(locale, optionLabelKey(name, optionId) as Parameters<typeof text>[1]),
      }));
    if (options.length === 0) continue;
    built.push({
      id: name,
      testId: slotTestId(name),
      label: text(locale, labelKey as Parameters<typeof text>[1]),
      options,
    });
  }
  return built;
}

/** Both languages at once, which is the shape `app/ui/shell.ts` takes. */
export function creatorSlotsByLocale(
  rig: RigDocument = RIG,
): Readonly<Record<UiLocale, readonly CreatorSlot[]>> {
  const table: Partial<Record<UiLocale, readonly CreatorSlot[]>> = {};
  for (const locale of UI_LOCALES) table[locale] = creatorSlots(locale, rig);
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
 * that slot." `repairSkins` in `app/domain/entities/character.ts` does the
 * opposite — it fills from `slot.fallback` — which is right for the NPC it was
 * written for and is a default player for this one, so the creator's repair
 * lives here. That divergence is reported rather than fixed: `app/domain` is
 * not this task's to edit.
 *
 * A slot the save does not name is the same case as a slot whose option is
 * gone. A slot in the save that **this build does not have** is ignored and
 * costs nothing: an unknown slot draws no part, which is the mechanism every
 * "none" option already uses (`OQ-FIRSTRUN-5`).
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

/* ------------------------------------------- the slot name the save accepts --- */

/**
 * **A defect in `content/schemas/progress.schema.json`, encoded around rather
 * than fixed, because content is not this task's to edit.**
 *
 * The rig names its slots `hairShape`, `hairColour` and `headCovering`.
 * `progress.schema.json`'s `playerCharacter.skins` constrains its property
 * names with `common.schema.json#/$defs/id`, which is kebab-case
 * (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), and `app/application/persistence/progress-schema.ts`
 * enforces the same pattern at runtime — **on the way out as well as in**. So a
 * character keyed the way the rig spells it fails `SaveCodec.encode`, every
 * write is refused, and the player is a first-run player for ever.
 *
 * This is the same contradiction `content/schemas/character.schema.json` has
 * already fixed on its own side, in its own words: "this used to $ref common
 * schema's id, which is kebab-case, while content/characters/rig.json names its
 * slots hairShape, hairColour and headCovering … a document could satisfy the
 * pattern while naming a slot the rig does not have". The progress schema is
 * the copy of that rule nobody updated.
 *
 * Until it is, the save carries the **kebab form of the rig's slot name** and
 * these two functions are the only place that knows. It is a rule, not a table:
 * no slot name is written down, the transformation is mechanical in both
 * directions, and it is a bijection for every name the rig has or is likely to
 * gain. A camelCase key read back — from a build that stored what the rig
 * spells — is simply a slot this build does not recognise, so
 * {@link repairSelection} redraws it, which is a uniform draw and never a
 * fallback. The player loses nothing either way.
 *
 * **What retires this:** change `skins`' `propertyNames` in
 * `content/schemas/progress.schema.json` to `^[a-z][A-Za-z0-9]*$` — the pattern
 * `character.schema.json` already uses for the same names — and the matching
 * `keys` shape in `app/application/persistence/progress-schema.ts`. Then both
 * functions below become `{ ...selection }` and a save migration maps the
 * kebab keys forward. Reported with the task.
 */
function savedSlotName(slotName: string): string {
  return slotName.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`);
}

function rigSlotName(savedName: string): string {
  return savedName.replace(/-([a-z])/g, (_whole, letter: string) => letter.toUpperCase());
}

/** The creator's choices as the save carries them. */
export function toPlayerCharacter(
  selection: CharacterSelection,
  rig: RigDocument = RIG,
): PlayerCharacter {
  const skins: Record<string, string> = {};
  for (const [slotName, optionId] of Object.entries(selection)) {
    skins[savedSlotName(slotName)] = optionId;
  }
  return {
    /* Branded at the boundary. `parseCharacterId` would answer a `Result` for
       a string the rig already validated against `common.schema.json`'s id
       pattern, and a boot sequence that could fail on its own content is a
       worse failure mode than a cast the schema has already checked. */
    characterId: playerCharacterId(rig) as CharacterId,
    skins,
  };
}

/** The saved character as the creator reads it. */
export function toSelection(character: PlayerCharacter | null): CharacterSelection | undefined {
  if (character === null) return undefined;
  const selection: Record<string, string> = {};
  for (const [savedName, optionId] of Object.entries(character.skins)) {
    selection[rigSlotName(savedName)] = optionId;
  }
  return selection;
}
