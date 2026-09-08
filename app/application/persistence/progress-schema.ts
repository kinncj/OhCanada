/**
 * `progress.schema.json`, in TypeScript, and the check that runs it.
 *
 * `SaveCodec.decode` promises to validate against the save schema before it
 * trusts a byte of its input (the port says so; SECURITY.md requires it). The
 * schema is JSON and ajv reads JSON, but `application-no-frameworks` forbids
 * this layer from importing ajv or reaching into `content/` — and rightly:
 * pulling a validator and a schema loader into the initial payload to read one
 * document a session is a cost the 8 MB budget should not pay, and it would put
 * the one check standing between a hand-edited file and the player's save behind
 * an adapter, outside the >= 90% gate.
 *
 * So the shape below mirrors the schema, and
 * `tests/unit/contracts/save-codec-matches-progress-schema.test.ts` pins the two
 * together the way ADR-0012 pinned the memory model to `ts-fsrs`: it compiles
 * the real `content/schemas/progress.schema.json` with the real ajv, generates
 * every single-property mutation of a valid save, and fails unless ajv and this
 * file agree on *every* one. The schema stays the authority; this file is the
 * runtime, and the test is what stops them drifting.
 *
 * Every object here is `additionalProperties: false`, as every object in the
 * schema is: an unknown property is a refusal, not something to ignore.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { ProgressSnapshot } from '@application/ports/progress-repository';

import { isIsoInstant } from '@application/persistence/iso-instant';

/** `common.schema.json#/$defs/id`. Duplicated as data, not imported: this is a *schema* mirror. */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ID_MAX_LENGTH = 64;

/** The subset of JSON Schema `progress.schema.json` actually uses. Internal: the
 * exported surface of this module is one function, because one function is what
 * `SaveCodec.decode` needs and an exported shape table invites a second reader
 * with a second opinion about what the schema says. */
type Shape =
  | {
      readonly kind: 'string';
      readonly pattern?: RegExp;
      readonly minLength?: number;
      readonly maxLength?: number;
      readonly values?: readonly string[];
    }
  | { readonly kind: 'isoInstant' }
  | {
      readonly kind: 'number';
      readonly integer?: boolean;
      readonly minimum?: number;
      readonly maximum?: number;
    }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'null' }
  | {
      readonly kind: 'object';
      readonly properties: Readonly<Record<string, Shape>>;
      readonly required: readonly string[];
    }
  | { readonly kind: 'record'; readonly keys: Shape; readonly values: Shape }
  | { readonly kind: 'array'; readonly items: Shape; readonly uniqueItems?: boolean }
  | { readonly kind: 'either'; readonly options: readonly Shape[] };

/** One thing wrong with the document, located the way a schema error is. */
interface Violation {
  /** JSON pointer into the document, e.g. `/levels/0/quests/1/status`. */
  readonly path: string;
  readonly message: string;
}

const id: Shape = { kind: 'string', pattern: ID_PATTERN, minLength: 1, maxLength: ID_MAX_LENGTH };
const isoInstant: Shape = { kind: 'isoInstant' };
const nullable = (shape: Shape): Shape => ({ kind: 'either', options: [shape, { kind: 'null' }] });
const unitInterval: Shape = { kind: 'number', minimum: 0, maximum: 1 };
const countOf: Shape = { kind: 'number', integer: true, minimum: 0 };

const object = (properties: Readonly<Record<string, Shape>>): Shape => ({
  kind: 'object',
  properties,
  // Every object in progress.schema.json requires every property it declares.
  required: Object.keys(properties),
});

const volumeSettings = object({
  master: unitInterval,
  music: unitInterval,
  sfx: unitInterval,
  voice: unitInterval,
});

const settings = object({
  locale: { kind: 'string', values: ['en', 'fr'] },
  autoMove: { kind: 'boolean' },
  singleSwitch: { kind: 'boolean' },
  reducedMotion: { kind: 'boolean' },
  highContrast: { kind: 'boolean' },
  dyslexiaFont: { kind: 'boolean' },
  textScale: { kind: 'number', minimum: 1, maximum: 2 },
  subtitles: { kind: 'boolean' },
  volumes: volumeSettings,
});

const playerCharacter = object({
  characterId: id,
  skins: { kind: 'record', keys: id, values: id },
});

const questProgress = object({
  questId: id,
  status: { kind: 'string', values: ['offered', 'declined', 'active', 'completed'] },
  stepIndex: countOf,
  stepProgress: countOf,
  updatedAt: isoInstant,
});

const levelProgress = object({
  levelId: id,
  unlocked: { kind: 'boolean' },
  quests: { kind: 'array', items: questProgress },
  bestScore: { kind: 'number', minimum: 0 },
  stampEarnedAt: nullable(isoInstant),
});

const reviewState = object({
  questionId: id,
  due: isoInstant,
  stability: { kind: 'number', minimum: 0 },
  difficulty: { kind: 'number', minimum: 0 },
  reps: countOf,
  lapses: countOf,
  lastReview: nullable(isoInstant),
  firstReviewedAt: nullable(isoInstant),
  learningSteps: countOf,
  phase: { kind: 'string', values: ['new', 'learning', 'review', 'relearning'] },
});

const examAttempt = object({
  startedAt: isoInstant,
  finishedAt: nullable(isoInstant),
  askedQuestionIds: { kind: 'array', items: id },
  correctCount: countOf,
  passed: { kind: 'boolean' },
  timed: { kind: 'boolean' },
});

/** The root of `progress.schema.json`. */
const PROGRESS_SHAPE: Shape = object({
  $schema: { kind: 'string', minLength: 1 },
  version: { kind: 'number', integer: true, minimum: 1 },
  updatedAt: isoInstant,
  settings,
  character: nullable(playerCharacter),
  levels: { kind: 'array', items: levelProgress },
  reviews: { kind: 'array', items: reviewState },
  subjectsStarted: { kind: 'array', items: id, uniqueItems: true },
  exams: { kind: 'array', items: examAttempt },
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkString = (
  shape: Extract<Shape, { kind: 'string' }>,
  value: unknown,
  path: string,
): readonly Violation[] => {
  if (typeof value !== 'string') return [{ path, message: 'must be a string' }];
  if (shape.values !== undefined && !shape.values.includes(value)) {
    return [{ path, message: `must be one of ${shape.values.join(', ')}` }];
  }
  if (shape.minLength !== undefined && value.length < shape.minLength) {
    return [{ path, message: `must be at least ${shape.minLength} characters` }];
  }
  if (shape.maxLength !== undefined && value.length > shape.maxLength) {
    return [{ path, message: `must be at most ${shape.maxLength} characters` }];
  }
  if (shape.pattern !== undefined && !shape.pattern.test(value)) {
    return [{ path, message: `must match ${shape.pattern.source}` }];
  }
  return [];
};

const checkNumber = (
  shape: Extract<Shape, { kind: 'number' }>,
  value: unknown,
  path: string,
): readonly Violation[] => {
  // `typeof NaN === 'number'`, and JSON cannot carry NaN or Infinity, so a
  // non-finite number can only come from a caller building a document by hand.
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return [{ path, message: 'must be a number' }];
  }
  if (shape.integer === true && !Number.isInteger(value)) {
    return [{ path, message: 'must be a whole number' }];
  }
  if (shape.minimum !== undefined && value < shape.minimum) {
    return [{ path, message: `must be at least ${shape.minimum}` }];
  }
  if (shape.maximum !== undefined && value > shape.maximum) {
    return [{ path, message: `must be at most ${shape.maximum}` }];
  }
  return [];
};

const checkObject = (
  shape: Extract<Shape, { kind: 'object' }>,
  value: unknown,
  path: string,
): readonly Violation[] => {
  if (!isPlainObject(value)) return [{ path, message: 'must be an object' }];
  const violations: Violation[] = [];
  for (const key of shape.required) {
    if (!Object.hasOwn(value, key)) violations.push({ path: `${path}/${key}`, message: 'is required' });
  }
  for (const [key, entry] of Object.entries(value)) {
    /*
     * `Object.hasOwn`, not a plain lookup. `JSON.parse('{"__proto__":{}}')`
     * produces a real own property with that name, and a plain lookup on the
     * shape table would answer with `Object.prototype` — a truthy value that is
     * not a shape — so the unknown-property branch would be skipped and the
     * walk would then try to iterate a non-existent violation list. Found by
     * `json-save-codec.test.ts`'s prototype-pollution case, which is exactly
     * the input SECURITY.md has in mind.
     */
    const property = Object.hasOwn(shape.properties, key) ? shape.properties[key] : undefined;
    if (property === undefined) {
      violations.push({ path: `${path}/${key}`, message: 'is not a property of this document' });
      continue;
    }
    violations.push(...checkShape(property, entry, `${path}/${key}`));
  }
  return violations;
};

const checkRecord = (
  shape: Extract<Shape, { kind: 'record' }>,
  value: unknown,
  path: string,
): readonly Violation[] => {
  if (!isPlainObject(value)) return [{ path, message: 'must be an object' }];
  const violations: Violation[] = [];
  for (const [key, entry] of Object.entries(value)) {
    for (const failure of checkShape(shape.keys, key, `${path}/${key}`)) {
      violations.push({ path: failure.path, message: `property name ${failure.message}` });
    }
    violations.push(...checkShape(shape.values, entry, `${path}/${key}`));
  }
  return violations;
};

const checkArray = (
  shape: Extract<Shape, { kind: 'array' }>,
  value: unknown,
  path: string,
): readonly Violation[] => {
  if (!Array.isArray(value)) return [{ path, message: 'must be an array' }];
  const violations: Violation[] = [];
  value.forEach((entry, index) => {
    violations.push(...checkShape(shape.items, entry, `${path}/${index}`));
  });
  if (shape.uniqueItems === true) {
    const seen = new Set(value.map((entry) => JSON.stringify(entry)));
    if (seen.size !== value.length) violations.push({ path, message: 'must not repeat an entry' });
  }
  return violations;
};

/** Validate one value against one shape, collecting every failure. */
const checkShape = (shape: Shape, value: unknown, path = ''): readonly Violation[] => {
  switch (shape.kind) {
    case 'string':
      return checkString(shape, value, path);
    case 'isoInstant':
      return typeof value === 'string' && isIsoInstant(value)
        ? []
        : [{ path, message: 'must be an ISO-8601 instant' }];
    case 'number':
      return checkNumber(shape, value, path);
    case 'boolean':
      return typeof value === 'boolean' ? [] : [{ path, message: 'must be true or false' }];
    case 'null':
      return value === null ? [] : [{ path, message: 'must be null' }];
    case 'object':
      return checkObject(shape, value, path);
    case 'record':
      return checkRecord(shape, value, path);
    case 'array':
      return checkArray(shape, value, path);
    case 'either': {
      const failures = shape.options.map((option) => checkShape(option, value, path));
      return failures.some((found) => found.length === 0) ? [] : (failures[0] ?? []);
    }
  }
};

/**
 * Validate a parsed value as a save document.
 *
 * Everything wrong with it is reported at once, in `details.violations`, so a
 * developer reading a rejected import sees the whole story rather than the first
 * line of it. Nothing partial is ever returned: SECURITY.md requires invalid
 * input to be rejected without partial application, and TN-SAVE-04 says the game
 * must not start "with a half-loaded state".
 */
export const validateProgressDocument = (value: unknown): Result<ProgressSnapshot> => {
  const violations = checkShape(PROGRESS_SHAPE, value);
  if (violations.length > 0) {
    return appErr('invalid', 'save.schema.invalid', 'That is not a TrueNorth save.', {
      violations: violations.map((violation) => `${violation.path || '/'} ${violation.message}`),
    });
  }
  return ok(value as ProgressSnapshot);
};
