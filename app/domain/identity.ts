/**
 * Turning a string into an id, and refusing the ones that are not.
 *
 * `app/domain/ids.ts` declares the branded types and asks for these constructors
 * "next to the entities"; this is that file. The pattern, the length bound and
 * the vocabulary are `common.schema.json#/$defs/id` and `#/$defs/localeCode`,
 * mirrored rather than reinvented (ADR-0007) — a value these functions accept is
 * a value `make validate-content` accepts, and
 * `tests/unit/domain/identity.test.ts` pins the pattern against the schema file
 * so a change to one fails on the other.
 *
 * Everything here is pure and total: a bad value comes back as a `Result`, never
 * as an exception. The content adapter validates a document against its schema
 * and then casts; anything that did not come through a schema — a save file, a
 * URL fragment, a hand-typed test fixture — comes through here instead.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type {
  CharacterId,
  LevelId,
  LocaleCode,
  PoiId,
  QuestId,
  QuestionId,
  SubjectId,
} from '@domain/ids';

import { isSupportedLocale } from '@domain/entities/values';

/** `common.schema.json#/$defs/id`: kebab-case, lowercase, no leading or double dash. */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** `common.schema.json#/$defs/id`: `maxLength`. */
export const MAX_ID_LENGTH = 64;

/** Does this value satisfy the shared id shape? */
export const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_ID_LENGTH && ID_PATTERN.test(value);

/**
 * One parser per id kind, so a `QuestionId` can never be produced where a
 * `QuestId` was meant. The kind name is only used in the error, which is
 * developer-facing: player copy comes from the localizer (`Result`'s contract).
 */
const idParser =
  <T extends string>(kind: string) =>
  (value: unknown): Result<T> =>
    isId(value)
      ? ok(value as T)
      : appErr('invalid', `id.${kind}.invalid`, `Not a valid ${kind} id.`, { value });

export const parseLevelId = idParser<LevelId>('level');
export const parseQuestId = idParser<QuestId>('quest');
export const parseQuestionId = idParser<QuestionId>('question');
export const parseSubjectId = idParser<SubjectId>('subject');
export const parseCharacterId = idParser<CharacterId>('character');
export const parsePoiId = idParser<PoiId>('poi');

/** `common.schema.json#/$defs/localeCode`: an enum, not a pattern. */
export const parseLocaleCode = (value: unknown): Result<LocaleCode> =>
  typeof value === 'string' && isSupportedLocale(value)
    ? ok(value as LocaleCode)
    : appErr('invalid', 'id.locale.invalid', 'Not a supported locale.', { value });
