/**
 * The runtime reading of `content/questions/<subject>/<id>.json`.
 *
 * ## Why a hand parser and not ajv
 *
 * The same reason `app/adapters/phaser/level-document.ts` gives, and it applies
 * harder here: `make validate-content` already checks all 237 documents against
 * `content/schemas/question.schema.json` in CI with `additionalProperties:
 * false`, and pulling a JSON Schema validator into a chunk a learner waits on
 * would spend the 6 s time-to-play budget re-proving something the build proved.
 * What this file is for is the other half — turning "the document on disk is not
 * a question" into a `Result` the caller can report, instead of a cast that
 * produces a card with `undefined` where the prompt should be.
 *
 * ## What it does NOT decide
 *
 * Whether the question may be *shown*. That is ADR-0003's rule, it lives in
 * `app/domain/entities/question.ts`, and it reaches this layer only through
 * `app/application/content/question-bank.ts`. This parser reads a `rejected`
 * document as happily as a `verified` one and hands both on, because the
 * verification block is exactly the evidence the gate above needs to refuse it.
 * A parser that dropped rejected documents silently would make the count of
 * "offered" indistinguishable from the count of "admitted", which is the
 * diagnostic that separates a missing directory from a fully rejected subject.
 *
 * ## Locale
 *
 * Nothing here takes a `LocaleCode`. Both languages are read and both are
 * returned; `isBilingual` in the domain is what refuses a half-translated one.
 * Choosing a language at load time would make the settings screen's language
 * toggle a reload rather than a re-render (CLAUDE.md, Language).
 *
 * Pure: no fetch, no DOM, no Phaser.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { IsoInstant, QuestionId, SubjectId } from '@domain/ids';
import type {
  FactSource,
  FactVerification,
  LocalizedText,
  QuestionDocument,
} from '@application/ports';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `common.schema.json#/$defs/questionId` and `subjectId`: kebab-case. */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VERIFICATION_STATUSES: readonly FactVerification['status'][] = [
  'unverified',
  'verified',
  'quarantined',
  'rejected',
];

const invalid = (field: string, message: string, details?: Record<string, unknown>): Result<never> =>
  appErr('invalid', `content.question.${field}`, message, { field, ...details });

const readString = (
  source: Record<string, unknown>,
  field: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): Result<string> => {
  const value = source[field];
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    return invalid(field, `"${field}" must be a ${allowEmpty ? '' : 'non-empty '}string.`);
  }
  return ok(value);
};

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
 * The parser refuses a `localizedText` that is missing a language outright
 * rather than passing a half-shaped object to the shippability rule, because the
 * two failures deserve different words: a document with `fr: ""` is authored and
 * incomplete, and a document with no `fr` key at all did not come from this
 * schema.
 */
const readLocalizedText = (
  source: Record<string, unknown>,
  field: string,
): Result<LocalizedText> => {
  const value = source[field];
  if (!isRecord(value)) return invalid(field, `"${field}" must be an object with "en" and "fr".`);
  const en = value['en'];
  const fr = value['fr'];
  if (typeof en !== 'string' || typeof fr !== 'string') {
    return invalid(field, `"${field}" must carry both "en" and "fr" as strings.`);
  }
  return ok({ en, fr });
};

/** `common.schema.json#/$defs/factSource`. `page` is the one optional member. */
const readFactSource = (source: Record<string, unknown>): Result<FactSource> => {
  const block = source['source'];
  if (!isRecord(block)) return invalid('source', '"source" must be an object.');

  const sourceId = readString(block, 'sourceId');
  if (!sourceId.ok) return sourceId;
  const chapter = readString(block, 'chapter');
  if (!chapter.ok) return chapter;
  const quote = readString(block, 'quote');
  if (!quote.ok) return quote;
  const url = readString(block, 'url');
  if (!url.ok) return url;
  const sourceHash = readString(block, 'sourceHash');
  if (!sourceHash.ok) return sourceHash;
  const asOf = readString(block, 'asOf');
  if (!asOf.ok) return asOf;

  const volatile = block['volatile'];
  if (typeof volatile !== 'boolean') {
    return invalid('source.volatile', '"source.volatile" must be a boolean.');
  }

  const page = block['page'];
  if (page !== undefined && (typeof page !== 'number' || !Number.isInteger(page) || page < 1)) {
    return invalid('source.page', '"source.page" must be a positive whole number when present.');
  }

  return ok({
    sourceId: sourceId.value,
    chapter: chapter.value,
    ...(page === undefined ? {} : { page: page as number }),
    quote: quote.value,
    url: url.value,
    sourceHash: sourceHash.value,
    asOf: asOf.value as IsoInstant,
    volatile,
  });
};

/**
 * `common.schema.json#/$defs/factVerification`.
 *
 * `evidence` and `model` are read with `allowEmpty`, and `checkedAt` may be
 * `null`, because an `unverified` document legitimately has all three empty.
 * Refusing them here would make an un-checked question a *parse* failure, which
 * would hide it from the count of what the gate above rejected. The rule that an
 * empty `evidence` may not ship is `isVerified`'s, and it is applied there.
 */
const readFactVerification = (source: Record<string, unknown>): Result<FactVerification> => {
  const block = source['verification'];
  if (!isRecord(block)) return invalid('verification', '"verification" must be an object.');

  const status = block['status'];
  if (typeof status !== 'string' || !VERIFICATION_STATUSES.includes(status as never)) {
    return invalid(
      'verification.status',
      `"verification.status" must be one of ${VERIFICATION_STATUSES.join(', ')}.`,
      { status },
    );
  }

  const model = readString(block, 'model', { allowEmpty: true });
  if (!model.ok) return model;
  const sourceHash = readString(block, 'sourceHash', { allowEmpty: true });
  if (!sourceHash.ok) return sourceHash;
  const evidence = readString(block, 'evidence', { allowEmpty: true });
  if (!evidence.ok) return evidence;

  const checkedAt = block['checkedAt'];
  if (checkedAt !== null && typeof checkedAt !== 'string') {
    return invalid('verification.checkedAt', '"verification.checkedAt" must be a string or null.');
  }

  return ok({
    status: status as FactVerification['status'],
    model: model.value,
    checkedAt: checkedAt === null ? null : (checkedAt as IsoInstant),
    sourceHash: sourceHash.value,
    evidence: evidence.value,
  });
};

/** Exactly four options, as a tuple. A bank with three is a card with a gap. */
const readOptions = (source: Record<string, unknown>): Result<QuestionDocument['options']> => {
  const value = source['options'];
  if (!Array.isArray(value) || value.length !== 4) {
    return invalid('options', '"options" must be exactly four localized strings.', {
      length: Array.isArray(value) ? value.length : null,
    });
  }
  const read: LocalizedText[] = [];
  for (let index = 0; index < 4; index += 1) {
    const option = readLocalizedText({ option: value[index] }, 'option');
    if (!option.ok) {
      return invalid(`options.${index}`, `"options[${index}]" must carry both "en" and "fr".`);
    }
    read.push(option.value);
  }
  return ok([read[0], read[1], read[2], read[3]] as QuestionDocument['options']);
};

/**
 * Read one question document, or say precisely which field is wrong.
 *
 * `expectedSubject` is the directory the file was found in. The file name and
 * the directory are both part of the address (`content/questions/<subject>/<id>.json`),
 * so a document whose `subject` disagrees with its directory would be loadable
 * under one name and invisible under the other — the same class of defect
 * `interpretLevelModule` refuses for a level id.
 */
export const parseQuestionDocument = (
  raw: unknown,
  expectedSubject?: string,
  expectedId?: string,
): Result<QuestionDocument> => {
  /* A JSON module is `{ default: … }` under the bundler and the bare object in a
     test that stubs the map; both are accepted rather than assuming a shape that
     differs between the artefact under test and the artefact deployed. */
  const document =
    isRecord(raw) && 'default' in raw ? (raw as { readonly default: unknown }).default : raw;

  if (!isRecord(document)) {
    return invalid('document', 'a question document must be a JSON object.');
  }

  const schema = readString(document, '$schema');
  if (!schema.ok) return schema;
  const id = readId(document, 'id');
  if (!id.ok) return id;
  const subject = readId(document, 'subject');
  if (!subject.ok) return subject;

  if (expectedId !== undefined && expectedId !== id.value) {
    return invalid(
      'id',
      `the document declares id "${id.value}" but is filed as "${expectedId}.json". The file ` +
        'name is the id, so a mismatch makes the question unreachable under the name every ' +
        'quest pool refers to it by.',
      { declared: id.value, filed: expectedId },
    );
  }
  if (expectedSubject !== undefined && expectedSubject !== subject.value) {
    return invalid(
      'subject',
      `the document declares subject "${subject.value}" but sits in ` +
        `content/questions/${expectedSubject}/. The directory is the bank key.`,
      { declared: subject.value, directory: expectedSubject },
    );
  }

  const prompt = readLocalizedText(document, 'prompt');
  if (!prompt.ok) return prompt;
  const options = readOptions(document);
  if (!options.ok) return options;

  const correctIndex = document['correctIndex'];
  if (
    typeof correctIndex !== 'number' ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex > 3
  ) {
    return invalid('correctIndex', '"correctIndex" must be 0, 1, 2 or 3.', { correctIndex });
  }

  const explanation = readLocalizedText(document, 'explanation');
  if (!explanation.ok) return explanation;
  const source = readFactSource(document);
  if (!source.ok) return source;
  const verification = readFactVerification(document);
  if (!verification.ok) return verification;

  return ok({
    $schema: schema.value,
    id: id.value as QuestionId,
    subject: subject.value as SubjectId,
    prompt: prompt.value,
    options: options.value,
    correctIndex: correctIndex as QuestionDocument['correctIndex'],
    explanation: explanation.value,
    source: source.value,
    verification: verification.value,
  });
};
