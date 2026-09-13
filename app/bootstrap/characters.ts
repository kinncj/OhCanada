/**
 * What this build calls the characters it ships, read from
 * `content/characters/*.json`.
 *
 * ## Why this file exists at all
 *
 * `app/bootstrap/quest.ts` used to name a quest giver from the `npc.<id>.name`
 * row in `app/ui/copy.ts`. ADR-0029 §6 records why that was so, and it is not a
 * design: `content/characters/` was **empty** when that code was written, so the
 * copy table was the only place a character's name could be. It holds documents
 * now, each with a required, bilingual `name`, validated against
 * `content/schemas/character.schema.json` by `make validate-content` — so the
 * copy row is the weaker of two available sources, and this module is the
 * stronger one.
 *
 * The point is not tidiness. ADR-0029 widened a quest's giver to anything the
 * level **places**, and a landmark giver's name comes from the level document's
 * own `pois[].name`. If a character giver's name kept coming from a copy table,
 * two givers on one screen would draw their accessible names from two different
 * kinds of source, and a third character document — correct, complete, bilingual
 * — would still be refused a dialog for want of a row somebody forgot to add in
 * a directory it has nothing to do with. That is the defect this project keeps
 * finding, in the shape it keeps finding it.
 *
 * ## Why the composition root
 *
 * Same answer as `./quests.ts` and `./character-slots.ts`: `ContentRepository`
 * is the port a character catalogue will live behind, no adapter implements it
 * yet, and `app/ui` may not read content at all (ADR-0005). Eager rather than
 * lazy for the same reason quests are eager — a name is a few dozen bytes and it
 * has to be ready on the frame the player taps a giver, not a round trip later.
 *
 * ## What is refused
 *
 * A document that does not declare itself a character (`rig.json` lives in this
 * directory and is not one) is skipped, and a character whose `name` is missing
 * or blank in either language is **dropped rather than half-loaded**. The lookup
 * then answers `null`, the caller refuses to open an unnamed dialog and says so,
 * and nobody gets a dialog whose accessible name is an empty string. A name that
 * exists in one language only would announce an English label to a French
 * screen-reader user, which is `TN-CREATOR-09`'s defect wearing a different hat.
 */

import type { LocalizedText } from '@domain/entities/values';

/** Declared as a type so a test can run this over a fixture directory. */
export type CharacterModuleMap = Readonly<Record<string, unknown>>;

const BUNDLED_CHARACTER_MODULES: CharacterModuleMap = import.meta.glob(
  '../../content/characters/*.json',
  { eager: true },
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A vite module namespace (`{ default: … }`), or the document itself. */
const documentOf = (module: unknown): unknown =>
  isRecord(module) && 'default' in module ? module['default'] : module;

/**
 * Is this one of the character documents, or something else in the directory?
 *
 * By `$schema`, which every content file declares (CLAUDE.md, Content rules) and
 * which `make validate-content` already enforces — not by "has a `name`", which
 * would be a guess, and not by filename, which would make `rig.json` a rule
 * written in a string.
 */
const isCharacterDocument = (document: unknown): document is Record<string, unknown> =>
  isRecord(document) &&
  typeof document['$schema'] === 'string' &&
  document['$schema'].endsWith('character.schema.json');

/** Both languages, both non-blank, or nothing at all. */
function nameOf(document: Record<string, unknown>): LocalizedText | null {
  const name = document['name'];
  if (!isRecord(name)) return null;
  const en = name['en'];
  const fr = name['fr'];
  if (typeof en !== 'string' || en.trim() === '') return null;
  if (typeof fr !== 'string' || fr.trim() === '') return null;
  return { en, fr };
}

/**
 * Every shipped character's name, by id.
 *
 * Sorted by path so two machines build the same map; a duplicate id would
 * otherwise resolve to whichever the bundler listed first.
 */
export function readCharacterNames(
  modules: CharacterModuleMap = BUNDLED_CHARACTER_MODULES,
): ReadonlyMap<string, LocalizedText> {
  const names = new Map<string, LocalizedText>();
  for (const path of Object.keys(modules).sort()) {
    const document = documentOf(modules[path]);
    if (!isCharacterDocument(document)) continue;
    const id = document['id'];
    if (typeof id !== 'string' || id === '') continue;
    const name = nameOf(document);
    if (name === null) continue;
    names.set(id, name);
  }
  return names;
}

/** The bundled map, read once. */
const SHIPPED = readCharacterNames();

/**
 * What `content/characters/<id>.json` calls this character, or `null`.
 *
 * `null` is the fail-closed answer and the only one: a character this build has
 * no document for cannot be named, and a caller that needs a name must refuse
 * rather than invent one.
 */
export function characterName(id: string): LocalizedText | null {
  return SHIPPED.get(id) ?? null;
}
