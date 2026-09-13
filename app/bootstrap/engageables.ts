/**
 * What the player can engage on a level, and what it is called — ADR-0029.
 *
 * A quest is offered by an **engageable**: a character the level places, or a
 * point of interest it places. `CLAUDE.md`'s traversal rule has said so from the
 * beginning — *"tap NPC or POI to engage"* — and `quest.schema.json` said
 * otherwise until ADR-0029, which cost Peggy's Cove and the North their quests,
 * because neither level may draw a figure of any kind at any scale and a quest
 * used to require one.
 *
 * This module is the runtime half of that decision, and it holds exactly two
 * rules.
 *
 * ## 1. Exactly one placement, or a named failure
 *
 * `tests/unit/contracts/a-quest-giver-is-placed-on-its-level.test.ts` checks the
 * *documents* agree: a giver matches exactly one placement, counting
 * `characters[].characterId` and `pois[].id` together. This is the same rule at
 * run time, over the level that actually loaded, and it is written the same way
 * for the same reason (ADR-0024 §1): not `find`, not `some`, not `filter`, all
 * of which reduce an empty collection to something that reads as an answer.
 * Zero matches is **dangling** and two is **ambiguous**, and the caller is told
 * which. Nothing here ever picks one of two.
 *
 * The *kind* is never declared twice. It is read from the list the level put the
 * thing in, which is the only document that owns placement — so a quest cannot
 * claim a lighthouse is a person, because a quest is not asked.
 *
 * ## 2. The name comes from where the name lives
 *
 * | Giver | Name |
 * |---|---|
 * | a character | `content/characters/<id>.json#/name` (`./characters.ts`) |
 * | a landmark | the level's own `pois[].name` — required, bilingual, and already the string the POI card draws |
 *
 * No new copy row, in either case. `app/ui/dialogue.ts` takes `speakerName` as a
 * **required** option so an unnamed dialog cannot be constructed, which means the
 * name has to be resolved *before* it reaches the DOM — `app/ui` may not read
 * content (ADR-0005), so the composition root is the only layer that can see a
 * level document and a character document at once.
 *
 * A resolution that cannot produce a name fails as `unnamed` rather than
 * answering with `''` or with the id. A dialog announced as "" or as
 * "peggys-point-light" is a defect, not a cosmetic gap (CLAUDE.md,
 * Accessibility), and an id read aloud one hyphen at a time is the worse of the
 * two.
 *
 * ## What is deliberately absent
 *
 * **A pose.** A landmark speaker carries no `expression` — the contract gate
 * rejects one — and nothing on this path asks a character renderer for
 * anything. `Engageable.kind` is the field any future code must branch on
 * *before* it looks a rig up, so that an `undefined` expression can never reach
 * `ICharacterRenderer.setExpression` at the moment a player taps a plaque.
 */

import type { LocalizedText } from '@domain/entities/values';

import { characterName } from './characters';

/** Which of the level's two lists a thing was placed in. The level decides. */
export type EngageableKind = 'character' | 'landmark';

/** One thing the player can engage, resolved and named. */
export interface Engageable {
  /** The bare id, as the level document spells it. */
  readonly id: string;
  readonly kind: EngageableKind;
  /** Never empty, in either language: see {@link resolveEngageable}. */
  readonly name: LocalizedText;
}

/** A point of interest, as the level places it. `name` is required by the schema. */
export interface PlacedPoi {
  readonly id: string;
  readonly name: LocalizedText;
}

/** A character, as the level places it. The name is the character document's. */
export interface PlacedCharacter {
  readonly characterId: string;
}

/**
 * The two lists, apart.
 *
 * `SceneLevel` satisfies this structurally, which is the point: the composition
 * root hands over the level it already loaded and no second shape is declared.
 */
export interface LevelPlacements {
  readonly pois: readonly PlacedPoi[];
  readonly characters: readonly PlacedCharacter[];
}

/**
 * Why an id is not an engageable.
 *
 * - `no-level` — nothing is loaded yet, so nothing is placed. A state, not a
 *   fault: the quest controller is built before the level arrives.
 * - `dangling` — the level places nothing with that id.
 * - `ambiguous` — a character and a point of interest share it. Refused in both
 *   directions rather than resolved to whichever was looked at first.
 * - `unnamed` — placed, but this build has no name for it. A character with no
 *   `content/characters/<id>.json`, or a document or POI whose `name` is blank
 *   in a language.
 */
export type EngageableRefusal = 'no-level' | 'dangling' | 'ambiguous' | 'unnamed';

export type EngageableResolution =
  | { readonly ok: true; readonly engageable: Engageable }
  | {
      readonly ok: false;
      readonly why: EngageableRefusal;
      /** How many placements carried the id: 0 for dangling, 2+ for ambiguous. */
      readonly count: number;
      /** The kind, when the id resolved and only the name failed. */
      readonly kind?: EngageableKind;
    };

/** Both languages present and non-blank, or `null`. An empty name is not a name. */
function usableName(name: LocalizedText | null | undefined): LocalizedText | null {
  if (name === undefined || name === null) return null;
  if (typeof name.en !== 'string' || name.en.trim() === '') return null;
  if (typeof name.fr !== 'string' || name.fr.trim() === '') return null;
  return name;
}

/** How a character's name is found. Injectable so the `unnamed` branch is testable. */
export type CharacterNameLookup = (id: string) => LocalizedText | null;

/**
 * The one thing this level places under this id, named — or why not.
 *
 * `id` is compared bare: an event detail may arrive as `npc.officer` or
 * `poi.peggys-point-light`, and the caller strips the prefix before asking.
 */
export function resolveEngageable(
  placements: LevelPlacements | null,
  id: string,
  lookup: CharacterNameLookup = characterName,
): EngageableResolution {
  if (placements === null) return { ok: false, why: 'no-level', count: 0 };

  const matches: readonly { readonly kind: EngageableKind; readonly name: LocalizedText | null }[] =
    [
      ...placements.characters
        .filter((placement) => placement.characterId === id)
        .map((placement) => ({
          kind: 'character' as const,
          name: lookup(placement.characterId),
        })),
      ...placements.pois
        .filter((placement) => placement.id === id)
        .map((placement) => ({ kind: 'landmark' as const, name: placement.name ?? null })),
    ];

  const only = matches.length === 1 ? matches[0] : undefined;
  if (only === undefined) {
    return {
      ok: false,
      why: matches.length === 0 ? 'dangling' : 'ambiguous',
      count: matches.length,
    };
  }

  const name = usableName(only.name);
  if (name === null) return { ok: false, why: 'unnamed', count: 1, kind: only.kind };

  return { ok: true, engageable: { id, kind: only.kind, name } };
}

/**
 * One sentence for the console, naming the id, the reason and the fix.
 *
 * Written here rather than at the call site so that every refusal reads the
 * same, and so that the sentence names the *source a maintainer must edit* —
 * which is the half the old message got wrong: it pointed at a copy table for a
 * fact that lives in a content document.
 */
export function whyNotEngageable(
  id: string,
  levelId: string,
  resolution: Extract<EngageableResolution, { ok: false }>,
): string {
  switch (resolution.why) {
    case 'no-level':
      return `"${id}" cannot be resolved: no level document is loaded yet.`;
    case 'dangling':
      return (
        `"${levelId}" places nothing called "${id}" — no characters[].characterId and no ` +
        `pois[].id carries that id, so there is nothing to name or to talk to.`
      );
    case 'ambiguous':
      return (
        `"${levelId}" places ${String(resolution.count)} things called "${id}" across ` +
        `characters[] and pois[]. Which one speaks is not something to guess at, so both ` +
        `are refused. Give one of them another id.`
      );
    case 'unnamed':
      return resolution.kind === 'landmark'
        ? `"${id}" is a point of interest on "${levelId}" with no usable pois[].name in both ` +
            `languages, and a dialog whose accessible name is empty is a defect.`
        : `"${id}" is placed on "${levelId}" as a character, and this build has no ` +
            `content/characters/${id}.json with a name in English and in French. The dialog ` +
            `is refused rather than opened with no accessible name.`;
  }
}
