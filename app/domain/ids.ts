/**
 * Identifier vocabulary shared by the domain, the application ports and the
 * content schemas. Type-only: this file emits no JavaScript.
 *
 * Ids are branded so that a `QuestionId` can never be passed where a `QuestId`
 * is expected. Values still travel as plain strings in JSON and in `localStorage`.
 *
 * Slice 1, domain agent: add the parse/validate constructors (`parseLevelId`, ...)
 * next to the entities. Until then, the content adapter is the only place that
 * casts a validated string into an id, immediately after schema validation.
 */

declare const brand: unique symbol;

/** Nominal typing helper. `Brand<string, 'LevelId'>` is a string that is not any other string. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** `content/levels/<id>.json` — one of the ten levels. */
export type LevelId = Brand<string, 'LevelId'>;

/** A quest inside a level. */
export type QuestId = Brand<string, 'QuestId'>;

/** One of the ten *Discover Canada* subjects; also the question bank key. */
export type SubjectId = Brand<string, 'SubjectId'>;

/** A single exam-style question. */
export type QuestionId = Brand<string, 'QuestionId'>;

/** A playable or non-playable character definition. */
export type CharacterId = Brand<string, 'CharacterId'>;

/** A point of interest / landmark a player can engage on a level. */
export type PoiId = Brand<string, 'PoiId'>;

/** BCP-47 locale tag. EN and FR ship from the first commit (CLAUDE.md). */
export type LocaleCode = Brand<string, 'LocaleCode'>;

/** ECS-lite entity handle: an id, never an object graph (ADR-0005). */
export type EntityId = Brand<number, 'EntityId'>;

/** Milliseconds since the Unix epoch, as produced by `Clock.now()`. */
export type EpochMillis = Brand<number, 'EpochMillis'>;

/** ISO-8601 instant, as persisted in save data and content `asOf` fields. */
export type IsoInstant = Brand<string, 'IsoInstant'>;
