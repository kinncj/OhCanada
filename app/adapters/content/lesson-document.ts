/**
 * The runtime reading of `content/lessons/<chapter>/<id>.json`.
 *
 * ## Why a hand parser and not ajv
 *
 * `app/adapters/content/question-document.ts`'s reason, unchanged:
 * `make validate-content` already checks every lesson against
 * `content/schemas/lesson.schema.json` in CI with `additionalProperties: false`,
 * and pulling a JSON Schema validator into a chunk a player waits on would spend
 * the 6 s time-to-play budget re-proving what the build proved. What this file
 * is for is the other half — turning "the document on disk is not a lesson" into
 * a `Result` the caller can report, instead of a cast that opens a reader with
 * `undefined` where a paragraph should be.
 *
 * ## What it does NOT decide
 *
 * **Whether a passage may be read.** That is ADR-0063 §6's filter and it lives
 * in `app/application/content/lesson-passages.ts`, one layer up, so the level
 * reader and the Learn reader cannot disagree. This parser reads a `quarantined`
 * passage as happily as a `verified` one and hands both on, because the
 * verification block is exactly the evidence the filter needs to refuse it — and
 * because an adapter that dropped passages here would make "this chapter has
 * three lessons" and "this chapter has three *readable* lessons" the same
 * number, which is the diagnostic that tells a missing chapter from a fully
 * quarantined one.
 *
 * The `fact` block is therefore carried through **as declared**, checked only as
 * far as `factual` being the boolean the schema requires. Narrowing it here
 * would be this directory deciding what a grant means, and there is exactly one
 * place in `app/` allowed to do that
 * (`tests/unit/contracts/one-rule-decides-what-may-be-drawn.test.ts`).
 *
 * ## Locale
 *
 * Nothing here takes a `LocaleCode`. Both languages are read and both are
 * returned; the caller picks, so the settings screen's language toggle stays a
 * re-render rather than a reload (CLAUDE.md, Language).
 *
 * Pure: no fetch, no DOM, no Phaser.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { FactClaim, LessonDocument, LessonPassage, LocalizedText } from '@application/ports';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `common.schema.json#/$defs/id`: kebab-case, dots allowed as the quest ids use. */
const ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

const invalid = (field: string, message: string, details?: Record<string, unknown>): Result<never> =>
  appErr('invalid', `content.lesson.${field}`, message, { field, ...details });

const readId = (source: Record<string, unknown>, field: string): Result<string> => {
  const value = source[field];
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    return invalid(field, `"${field}" must be a kebab-case id.`);
  }
  return ok(value);
};

/**
 * Both languages, or neither.
 *
 * `localizedText` requires `en` and `fr`, which is how ADR-0003's "missing EN or
 * FR text" clause is enforced per document (ADR-0010). A lesson missing its
 * French would reach a French player as English prose under a French heading,
 * which is the defect `app/ui/lesson-reader.ts`'s required `setLocale` view
 * exists to make impossible from the other end.
 */
const readLocalizedText = (
  source: Record<string, unknown>,
  field: string,
): Result<LocalizedText> => {
  const value = source[field];
  if (!isRecord(value)) return invalid(field, `"${field}" must be an object with "en" and "fr".`);
  const en = value['en'];
  const fr = value['fr'];
  if (typeof en !== 'string' || en.length === 0 || typeof fr !== 'string' || fr.length === 0) {
    return invalid(field, `"${field}" must carry both "en" and "fr" as non-empty strings.`);
  }
  return ok({ en, fr });
};

/**
 * The claim, carried through rather than adjudicated.
 *
 * Only `factual` is checked, and it is checked because the schema requires it
 * and because the filter one layer up reads it first: a block with no `factual`
 * at all did not come from `lesson.schema.json`, and refusing it here is the
 * difference between a renamed field and an honest `factual: false`. `source`
 * and `verification` are handed on exactly as they are, nullable as the schema
 * has them, for `grantsPassage` to read — a block it cannot read is refused
 * there, never waved through (ADR-0024).
 */
const readFact = (source: Record<string, unknown>, field: string): Result<FactClaim> => {
  const block = source['fact'];
  if (!isRecord(block)) return invalid(`${field}.fact`, `"${field}.fact" must be an object.`);
  if (typeof block['factual'] !== 'boolean') {
    return invalid(
      `${field}.fact.factual`,
      `"${field}.fact.factual" must be a boolean. It records the author's judgement that this ` +
        'passage states a fact, and it is required so the judgement cannot default to unchecked.',
    );
  }
  return ok(block as unknown as FactClaim);
};

const readPassage = (raw: unknown, index: number): Result<LessonPassage> => {
  const field = `passages[${String(index)}]`;
  if (!isRecord(raw)) return invalid(field, `"${field}" must be an object.`);

  const id = readId(raw, 'id');
  if (!id.ok) return invalid(`${field}.id`, `"${field}.id" must be a kebab-case id.`);
  const text = readLocalizedText(raw, 'text');
  if (!text.ok) return invalid(`${field}.text`, `"${field}.text" must carry "en" and "fr".`);
  const fact = readFact(raw, field);
  if (!fact.ok) return fact;

  return ok({ id: id.value, text: text.value, fact: fact.value });
};

/**
 * One `content/lessons/<chapter>/<id>.json`, checked.
 *
 * `expect` is the address the catalogue read off the module path. Both halves
 * are compared with the document's own fields, because a lesson reachable under
 * one name and self-described under another is reachable by the `read` step that
 * names it and invisible to the index that addresses it — the exact failure
 * `parseQuestionDocument` checks for, and one a schema cannot see because a
 * schema sees one file and never its path.
 */
export function parseLessonDocument(
  raw: unknown,
  expect: { readonly chapter: string; readonly id: string },
): Result<LessonDocument> {
  /* A JSON module is `{ default: … }` under the bundler and the bare object in a
     test that stubs the map; both are accepted rather than assuming a shape that
     differs between the artefact under test and the artefact deployed. */
  const document =
    isRecord(raw) && 'default' in raw ? (raw as { readonly default: unknown }).default : raw;

  if (!isRecord(document)) return invalid('document', 'a lesson document must be an object.');

  const schema = document['$schema'];
  if (typeof schema !== 'string' || schema.length === 0) {
    return invalid('$schema', '"$schema" must name the schema this document is written against.');
  }

  const id = readId(document, 'id');
  if (!id.ok) return id;
  if (id.value !== expect.id) {
    return invalid(
      'id',
      `"${id.value}" is filed at "${expect.chapter}/${expect.id}.json". A lesson is addressed by ` +
        'its path and referenced by its "id", so the two disagreeing makes it reachable by one ' +
        'and invisible to the other.',
      { addressed: expect.id, declared: id.value },
    );
  }

  const chapter = document['chapter'];
  if (typeof chapter !== 'string' || chapter.length === 0) {
    return invalid('chapter', '"chapter" must name the chapter of the guide this is read under.');
  }

  const order = document['order'];
  if (typeof order !== 'number' || !Number.isInteger(order) || order < 1) {
    return invalid('order', '"order" must be a whole number of at least 1.');
  }

  const title = readLocalizedText(document, 'title');
  if (!title.ok) return title;

  const rawPassages = document['passages'];
  if (!Array.isArray(rawPassages) || rawPassages.length === 0) {
    /* `minItems: 1` is ADR-0024 in the schema: a lesson with no passages renders
       as an empty screen, and an empty collection must not reduce to a pass. */
    return invalid('passages', '"passages" must be a non-empty array.');
  }

  const passages: LessonPassage[] = [];
  for (let index = 0; index < rawPassages.length; index += 1) {
    const passage = readPassage(rawPassages[index], index);
    if (!passage.ok) return passage;
    passages.push(passage.value);
  }

  return ok({ $schema: schema, id: id.value, chapter, order, title: title.value, passages });
}
