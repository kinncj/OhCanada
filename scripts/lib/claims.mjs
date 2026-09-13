/**
 * Every claim about Canada in `content/`, found by SHAPE, and the text
 * comparison every gate makes against it. One implementation, two callers.
 *
 * WHY THIS FILE EXISTS
 *
 * `scripts/verify-content.mjs` walked `content/questions/` and nothing else, and
 * so did `tests/unit/contracts/questions-cite-a-cached-source.test.ts`. ADR-0003's
 * second amendment had already moved the boundary — "verification now follows the
 * claim rather than the screen it appears on" — and the two gates did not follow
 * it. The measured cost, on the tree this file was written against: 29 factual
 * dialogue claims across ten quests and 31 territorial statements and landmark
 * blurbs across ten level documents got the schema's "sourced and verified when
 * factual" conditional and NONE of the quote-contiguity, evidence-floor,
 * verbatim, banned-term, page-range or 180-day checks. Sixty sentences a player
 * reads on every level, checked by hand twice and by nothing else, in a
 * repository that has already shipped two fabricated citations.
 *
 * ADR-0019 names the pattern: a rule drawn round a container measures the
 * container. `content/questions/` is a container; a claim is not. So the scope
 * here is the SHAPE OF A CLAIM, and the three collections that carry claims
 * today appear in exactly one place — `CLAIM_COLLECTIONS`, which is an
 * anti-vacuum FLOOR (ADR-0024) and not the scope of the walk. A new collection
 * is checked the day it is written; what it does not get automatically is a
 * floor, and the summary prints where the claims were found so an unlisted
 * collection is visible rather than silent.
 *
 * THE TWO SHAPES, AND WHY THEY ARE NORMALISED HERE AND NOWHERE ELSE
 *
 * A question carries `source` and `verification` at its root: it is a claim by
 * construction, so ADR-0003 gives it no `factual` flag to set. A quest's
 * dialogue line and a level's blurb carry `common.schema.json#/$defs/factClaim`
 * — `{ factual, source, verification }` — beside the text they are about. Those
 * are different shapes with the same obligations, and branching per collection
 * at each of eight checks is how the two drift apart. Every claim leaves this
 * module as one record:
 *
 *   where        repo-relative path of the document
 *   pointer      JSON pointer to the claim inside it ('' for a question)
 *   at           `where` plus the pointer, for messages
 *   collection   first path segment under content/ — 'questions', 'quests', …
 *   kind         'question' | 'fact'
 *   factual      always true for a question; the author's declaration otherwise
 *   source       FactSource, or null
 *   verification FactVerification, or null
 *   prose        the author's own player-facing words, for the verbatim check
 *   asserted     what the player is told is TRUE, for ADR-0016 §3's banned terms
 *   surface      how to name `asserted` in a message
 *   document     the node the claim is made of — the question, or the block
 *
 * WHICH WORDS ARE "THE PROSE" OF A FACT CLAIM. Not a list of field names. A
 * `factClaim` sits beside the text it governs, so the prose is every
 * `localizedText`-shaped SIBLING of the block — `text` on a dialogue line,
 * `blurb` and `name` on a point of interest, `statement` on a territory
 * acknowledgement. Naming those four fields here would be the same
 * scope-by-container mistake one level down, and the fifth surface would escape
 * silently.
 *
 * WHY `words()` LIVES HERE. Contiguity had two implementations, reconciled by
 * hand after they disagreed — `verify-content` splitting on every
 * non-alphanumeric, and the contract test rejoining hyphens across a line break
 * and then comparing strings. Measured on the corpus as this was written, they
 * now agree completely: the string rule rejects 0 of the 527 quotes the token
 * rule accepts. That agreement is the dangerous state, not the safe one — it is
 * held in place by care, nothing watches the seam, and the last time it slipped
 * two correctly cited economy questions were red in one gate and green in the
 * other.
 *
 * Where the two CAN differ, stated rather than hypothesised: `pdftotext -layout`
 * wraps at the column, so the extraction contains both `three-\nquarters` (a
 * real hyphen) and `one-\nthird` (also a real hyphen here, but the same shape a
 * wrap produces in a word that has none). The string rule must decide whether to
 * rejoin, and whichever it decides it then rejects a correct quote that spells
 * the pair the other way; the extraction does not record which kind of hyphen it
 * was, so there is no normalisation that is right about both. The token rule
 * does not have to decide, and it is also the more permissive of the two — which
 * is worth saying out loud, because the permissive one is the one that caught
 * both fabricated citations this project has shipped.
 */

import { answerText } from './staleness.mjs';

/**
 * The collections that MUST yield claims, and the only reason a list of
 * directory names appears in this file.
 *
 * ADR-0024: an empty collection must not reduce to a pass. The walk finds claims
 * wherever they are; this list is what makes "found none" a failure instead of a
 * green run over a directory somebody moved. It is deliberately NOT the scope —
 * a fourth collection of claims is checked without being named here, and the
 * per-collection counts in the summary are what make it visible.
 */
export const CLAIM_COLLECTIONS = ['questions', 'quests', 'levels'];

/**
 * Documents whose CONTENT is a definition of these shapes rather than an
 * instance of one. `content/schemas/question.schema.json` has a `properties`
 * object carrying `prompt`, `options` and `correctIndex`; `common.schema.json`
 * has one carrying `factual`, `source` and `verification`. Both recognisers
 * below refuse them on a TYPE test as well — a schema's `factual` is a subschema
 * object and not a boolean, a schema's `options` is a subschema object and not
 * an array — and `recogniserFaults()` proves that against the real schemas on
 * every run. This exclusion is the belt, the type tests are the braces, and the
 * braces are what would survive a schema file growing a genuine example.
 */
export const isSchemaDocument = (where) => where.startsWith('content/schemas/');

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value) => (typeof value === 'string' ? value : null);

/**
 * A `localizedText`: both official languages present as strings. What makes a
 * sibling of a `factClaim` the prose that claim is ABOUT, and the reason this
 * module needs no list of field names.
 */
const localizedTextOf = (value) =>
  isObject(value) && str(value.en) !== null && str(value.fr) !== null ? value : null;

/* -------------------------------------------------------------------------- */
/* Text, as one implementation                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Words, for every text comparison any gate makes.
 *
 * NFKC first so a PDF's ligatures and non-breaking spaces do not read as
 * different characters from a keyboard's. Curly punctuation is folded to ASCII
 * because the extraction and the authored JSON disagree about it constantly and
 * that disagreement is typography, not wording. Then everything that is not a
 * letter or a digit is a separator, so the apostrophe splits — the same decision,
 * for the same reason, as the banned-terms matcher in `staleness.mjs`.
 *
 * The separator rule is what makes a line-broken hyphen a non-event: the
 * extraction's `one-\nthird` and an author's `one third` are both the tokens
 * `one third`, and so are `three-\nquarters` and `three-quarters`. A string
 * comparison has to decide whether to rejoin the hyphen and is wrong about one
 * of those two cases whichever way it decides.
 */
export const words = (text) =>
  text
    .normalize('NFKC')
    .replace(/[‘’ʼ]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[–—]/gu, '-')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');

/**
 * A haystack prepared once. Every gate compares many short texts against one
 * long extraction, and tokenising 130,000 words per comparison is the difference
 * between a gate that runs and one that gets turned off.
 */
export const indexText = (text) => {
  const list = words(text);
  return { words: list, joined: ` ${list.join(' ')} `, vocabulary: new Set(list) };
};

/** Is `text` a contiguous passage of the indexed haystack? */
export const containsRun = (index, text) => index.joined.includes(` ${words(text).join(' ')} `);

/** The longest run of consecutive words of `text` that appears in the haystack. */
export const longestSharedRun = (index, text) => {
  const needle = words(text);
  if (needle.length === 0) return 0;
  for (let n = needle.length; n > 0; n -= 1) {
    for (let i = 0; i + n <= needle.length; i += 1) {
      if (index.joined.includes(` ${needle.slice(i, i + n).join(' ')} `)) return n;
    }
  }
  return 0;
};

/** Words of `text` that occur nowhere in the haystack. */
export const unknownWords = (index, text) => words(text).filter((word) => !index.vocabulary.has(word));

/* -------------------------------------------------------------------------- */
/* Recognising the two shapes                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A `factClaim` instance: the three required keys, and `factual` actually a
 * boolean.
 *
 * The type test is what separates an instance from the SCHEMA that defines one,
 * exactly as `verify-content`'s verification recogniser separates them on a
 * legal `status` string. Required-subset rather than exact key set, for the
 * reason ADR-0003's `record` amendment demonstrated: an exact set stops matching
 * the moment the schema grows a field, and every rule scoped by the recogniser
 * then skips the documents the amendment created, silently.
 */
export const isFactClaim = (value) =>
  isObject(value) &&
  typeof value.factual === 'boolean' &&
  'source' in value &&
  'verification' in value;

/**
 * A question DOCUMENT, recognised by shape rather than by living under
 * `content/questions/`.
 *
 * Two of the three keys, not all three: a question that lost its `correctIndex`
 * must still be recognised, because "this is a malformed question" is a finding
 * and "this is not a question" is silence. Two is enough to keep a quest — whose
 * steps carry a `prompt` of their own, but never `options` or `correctIndex` at
 * the document root — from matching.
 *
 * The second clause is the type test that separates an instance from the schema
 * that defines one: a real question's `options` is an ARRAY and its
 * `correctIndex` is a NUMBER, where `question.schema.json`'s are subschema
 * objects. What escapes is a question whose options are not an array, whose
 * correctIndex is not a number AND whose prompt is not localised text — three
 * simultaneous type errors, each of which `make validate-content` fails on the
 * file before this gate is reached.
 */
export const isQuestionDocument = (value) =>
  isObject(value) &&
  ['prompt', 'options', 'correctIndex'].filter((key) => key in value).length >= 2 &&
  (Array.isArray(value.options) ||
    typeof value.correctIndex === 'number' ||
    localizedTextOf(value.prompt) !== null);

/**
 * `content/quests/x.json` -> `quests`. The claim's collection, for the floors and
 * for the per-collection counts.
 *
 * A file sitting directly under `content/` — `game.config.json` — belongs to no
 * collection and says so, rather than becoming a collection named after itself.
 */
export const collectionOf = (where) => {
  const parts = where.split('/');
  return parts.length > 2 ? parts[1] : '(root)';
};

const proseOf = (fields) =>
  fields.flatMap(([field, localized]) =>
    ['en', 'fr'].flatMap((locale) => {
      const text = str(localized[locale]);
      return text === null ? [] : [{ field, locale, text }];
    }),
  );

const claimRecord = (where, pointer, over) => ({
  where,
  pointer,
  at: pointer === '' ? where : `${where} at ${pointer}`,
  collection: collectionOf(where),
  ...over,
});

/**
 * The claim a question document IS. Exported because the contract test's
 * fixtures are question literals and must go through the same normalisation the
 * corpus does — a predicate proved on fixtures and a predicate run over content
 * must not be two predicates.
 */
export const questionClaim = (document, where) =>
  claimRecord(where, '', {
    kind: 'question',
    document,
    factual: true,
    source: isObject(document.source) ? document.source : null,
    verification: isObject(document.verification) ? document.verification : null,
    prose: proseOf(
      // ADR-0003 check 5 falls on the prose the author actually WROTE, which for
      // a question is the prompt and the explanation. Options are exempt and the
      // reason is a measurement rather than an omission: four of the corpus's
      // options are 100% verbatim — "The House of Commons.", "Band chiefs and
      // councillors.", "The province or territory." — because a four-word
      // institutional noun phrase has no paraphrase that is not a distortion,
      // and any threshold loose enough to admit those admits everything.
      ['prompt', 'explanation'].flatMap((field) => {
        const localized = localizedTextOf(document[field]);
        return localized === null ? [] : [[field, localized]];
      }),
    ),
    asserted: answerText(document),
    surface: 'an option or explanation',
  });

/**
 * The claim a `factClaim` block makes about the text beside it.
 *
 * `parent` is the object the block hangs off, and its `localizedText`-shaped
 * siblings are the player-facing words the block is a claim ABOUT. A block with
 * no such sibling is a claim attached to nothing, which the caller reports: it
 * means either the recogniser found something that is not a claim, or an author
 * has verified a sentence that is not there.
 */
export const factClaim = (block, parent, where, pointer) => {
  const siblings = isObject(parent)
    ? Object.entries(parent).flatMap(([key, value]) => {
        if (value === block) return [];
        const localized = localizedTextOf(value);
        return localized === null ? [] : [[key, localized]];
      })
    : [];
  const prose = proseOf(siblings);
  return claimRecord(where, pointer, {
    kind: 'fact',
    document: block,
    factual: block.factual === true,
    source: isObject(block.source) ? block.source : null,
    verification: isObject(block.verification) ? block.verification : null,
    prose,
    // Every word of it. A question separates the prompt (may name a stale
    // topic) from the answers (may not assert a stale value); a blurb has no
    // such separation, so all of it is an assertion.
    asserted: prose.map((entry) => entry.text),
    surface:
      siblings.length === 0
        ? 'the text this claim is attached to'
        : `the ${siblings.map(([key]) => key).join(' and ')} this claim is attached to`,
  });
};

/**
 * Every claim in one parsed document, in document order.
 *
 * The walk does not descend into a `factClaim` it has recognised: the block's own
 * `source` and `verification` are not claims, they are the claim's apparatus.
 */
export const claimsIn = (document, where) => {
  const found = [];
  if (isQuestionDocument(document)) found.push(questionClaim(document, where));
  const walk = (node, pointer, parent) => {
    if (isFactClaim(node)) {
      found.push(factClaim(node, parent, where, pointer));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${pointer}/${String(index)}`, parent));
      return;
    }
    if (isObject(node)) {
      for (const [key, value] of Object.entries(node)) walk(value, `${pointer}/${key}`, node);
    }
  };
  walk(document, '', null);
  return found;
};

/**
 * THE TRIPWIRE UNDER THE RECOGNISER, per document, on every run.
 *
 * `isFactClaim` is what scopes every check a quest or a level claim gets. If it
 * stops matching — a schema amendment, a key rename, a stricter test somebody
 * thought was safe — the gate keeps passing over a corpus it has stopped
 * inspecting, and the only visible signal is a count going down. That exact
 * failure has already happened once here, to gate A's `communityReview`
 * recogniser, and it disabled the rule standing between an agent and a
 * fabricated Indigenous sign-off.
 *
 * So the document's own bytes are the oracle: every `"factual"` key in the raw
 * JSON must correspond to a recognised claim. It needs no schema, no list of
 * collections and no maintenance, and it fails on the exact drift it is about.
 */
export const claimCountFault = (rawText, found, where) => {
  const declared = rawText.split('"factual"').length - 1;
  const recognised = found.filter((claim) => claim.kind === 'fact').length;
  if (declared === recognised) return null;
  return (
    `${where}: the document's bytes carry ${String(declared)} "factual" key(s) and the claim ` +
    `recogniser found ${String(recognised)} factClaim block(s) in it. Those must agree, because ` +
    `isFactClaim() is what scopes every check a non-question claim gets: if it stops matching, this ` +
    `gate keeps reporting green over claims it has silently stopped inspecting, which is what ` +
    `ADR-0003's "record" amendment did to gate A's communityReview rule. Either the schema moved ` +
    `and the recogniser must follow it, or a "factual" string appears somewhere that is not a claim ` +
    `and this tripwire needs to say so deliberately.`
  );
};

/**
 * Both recognisers, proved against the schemas that define the shapes, on every
 * run — the floor `claimCountFault` cannot provide, because a recogniser that
 * matched nothing anywhere would agree with a corpus it had emptied.
 *
 * Three assertions per shape, each of which a schema amendment would trip:
 * the keys this file identifies a block by are still REQUIRED by the schema; a
 * synthetic block carrying exactly the schema's current required keys IS
 * recognised; and the schema's own `properties` object is NOT.
 */
export const recogniserFaults = (commonSchema, questionSchema) => {
  const faults = [];
  const notes = [];
  const defs = isObject(commonSchema?.$defs) ? commonSchema.$defs : {};

  // ABSENT AND DIVERGED ARE DIFFERENT ANSWERS, and only one of them is a fault.
  // A schema that does not define the shape at all cannot be compared with a
  // recogniser of it — that is a gap in what was checked, reported as one. A
  // schema that DOES define it and disagrees is drift, and drift is a failure.
  // Collapsing the two would make every scratch tree carrying a partial schema
  // fail for a reason that has nothing to do with the tree.
  const required = Array.isArray(defs.factClaim?.required) ? defs.factClaim.required : null;
  if (!('factClaim' in defs)) {
    notes.push(
      `the common schema here defines no factClaim, so the recogniser that scopes every quest and ` +
        `level claim was NOT checked against a definition of the shape. isFactClaim() is still what ` +
        `decides which claims are inspected; nothing here confirmed it matches the schema.`,
    );
  } else if (required === null) {
    faults.push(
      `content/schemas/common.schema.json has $defs.factClaim but no "required" list, so the ` +
        `recogniser that scopes every quest and level claim cannot be checked against the schema ` +
        `that defines it. Either the def was renamed — in which case this module must follow it — or ` +
        `the schema stopped requiring a shape, in which case there is nothing left to recognise.`,
    );
  } else {
    for (const key of ['factual', 'source', 'verification']) {
      if (!required.includes(key)) {
        faults.push(
          `factClaim: this gate identifies a claim by "${key}" and the schema no longer requires ` +
            `it. A legitimate claim written without that key would not be recognised, and every ` +
            `check scoped by the recogniser would skip it silently.`,
        );
      }
    }
    const instance = Object.fromEntries(
      required.map((key) => [key, key === 'factual' ? true : null]),
    );
    if (!isFactClaim(instance)) {
      faults.push(
        `factClaim: a block carrying exactly the schema's ${String(required.length)} required ` +
          `key(s) (${required.join(', ')}) is NOT recognised. The schema and the recogniser have ` +
          `diverged, and every check scoped by it is now skipping the blocks the schema mandates — ` +
          `a silent pass, not a failure.`,
      );
    }
    if (isFactClaim(defs.factClaim?.properties)) {
      faults.push(
        `factClaim: the JSON Schema properties object that DEFINES the block is recognised as an ` +
          `instance of one. The recogniser matches on a required subset, which is only safe while ` +
          `the definition cannot match it.`,
      );
    }
  }

  const properties = isObject(questionSchema?.properties) ? questionSchema.properties : null;
  const declared = ['prompt', 'options', 'correctIndex'].filter(
    (key) => properties !== null && key in properties,
  );
  if (properties === null || declared.length === 0) {
    notes.push(
      `the question schema here declares none of prompt/options/correctIndex, so the ` +
        `question-document recogniser was NOT checked against a definition of one.`,
    );
  } else {
    for (const key of ['prompt', 'options', 'correctIndex']) {
      if (!(key in properties)) {
        faults.push(
          `question: this gate recognises a question document by two of prompt/options/` +
            `correctIndex and the schema no longer declares "${key}". Two of the three must remain ` +
            `available or a malformed question stops being recognised as one at all.`,
        );
      }
    }
    if (
      !isQuestionDocument({
        ...Object.fromEntries(Object.keys(properties).map((key) => [key, null])),
        options: [],
      })
    ) {
      faults.push(
        `question: a document carrying every property the schema declares is NOT recognised as a ` +
          `question. The schema and the recogniser have diverged.`,
      );
    }
    if (isQuestionDocument(properties)) {
      faults.push(
        `question: the JSON Schema properties object that DEFINES a question is recognised as a ` +
          `question document. The path exclusion in isSchemaDocument() is then the only thing ` +
          `keeping the schemas out of the corpus, and a single missed exclusion would put the ` +
          `definition of a question into the bank of them.`,
      );
    }
  }
  return { faults, notes };
};
