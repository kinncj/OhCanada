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

import { posix } from 'node:path';

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
 * ROOT FIELDS A CLAIM BINDS TO FROM OUTSIDE ITS OWN UNIT, and the reason each
 * one is here.
 *
 * Gate A4 in `scripts/verify-content.mjs` voids a grant when the claim's author
 * fields move. Most of a claim's fields are found by SHAPE — its unit, which is
 * the node the `factClaim` hangs off, so the prose and the `source` come for
 * free and so does anything added beside them later. These do not: they sit at
 * the document ROOT, beside a level's `ground` polygon and a quest's `giver`,
 * and no shape separates where a line is spoken from how it is drawn. Only a
 * reason does, so each carries one. The full argument, including the fields that
 * were asked this question and answered no, is the essay above
 * `claimAuthorFieldsAt` in verify-content.mjs.
 *
 * ADD TO THIS LIST ONLY WITH A REASON OF THE SAME KIND: "a verifier's check of
 * this claim reads this field, so changing it makes the grant a statement about
 * something else."
 *
 * `subject` WAS HERE AND IS NOT, BY ADR-0030. A subject owns the propositions its
 * questions GRADE, not the ones its levels and quests TELL, and no check a
 * verifier makes of a blurb, a territorial statement or a dialogue line reads the
 * level's remit. A question's `subject` is still bound, and needs no entry to be:
 * for a question the unit is the document, so it is inside the unit already.
 *
 * Two readers, one list (ADR-0019). The gate binds by it;
 * tests/unit/contracts/a-grant-binds-to-its-claim.test.ts proves against the
 * real corpus that each name still has grants it applies to — because a name
 * that has gone dead binds nothing, voids nothing, and is invisible in a gate
 * whose only symptom would be a number going down.
 */
export const DOCUMENT_SCOPE_FIELDS = [
  {
    key: 'levelId',
    why:
      "the place a quest's lines are said at. Lines are written about where they are spoken — " +
      "'here', 'this river', 'the capital of this territory', and every landmark giver's line by " +
      'design (ADR-0029 §5) — so re-attaching a quest to another level makes each grant a statement ' +
      'about somewhere else, however untouched its words. ADR-0030.',
  },
];

/**
 * THE FIELDS THAT CARRY A NAME RATHER THAN PROSE, and why a name needs a rule
 * of its own.
 *
 * Every other text a claim governs is found by SHAPE — a `localizedText`-shaped
 * sibling — and is held to the verbatim rule: prose that shares a long run with
 * its source is lifted rather than paraphrased. A NAME is the opposite case. It
 * is correct only when it is copied exactly, so the verbatim rule exempts it by
 * construction and nothing else looked at it: `verify-content` never read
 * `nations`, and `make validate-content` can check a deny-list but cannot open a
 * page. A name a player reads as a fact about whose land they are standing on
 * was the one thing in a level document that no gate compared with a source
 * (ADR-0051).
 *
 * A NAME CANNOT BE FOUND BY SHAPE. An array of strings beside a claim is an
 * array of strings; nothing in its shape says the strings are names of peoples
 * rather than texture keys. So this list names the field, with a reason, in the
 * manner of {@link DOCUMENT_SCOPE_FIELDS} — and, like that list, it can go dead
 * silently if the schema renames the field, which is why the gate prints how
 * many names it searched for and
 * tests/unit/contracts/a-territory-names-what-its-source-prints.test.ts asserts
 * that what this finds is exactly what the level documents print.
 */
export const NAME_FIELDS = [
  {
    key: 'nations',
    why:
      'the peoples a territory statement names. ADR-0051: a statement cites one source and every ' +
      'name in it must be a name that source prints, so the check is "does the cited extraction ' +
      'contain this name" — the one comparison that catches a name copied out of somewhere else.',
  },
];

/**
 * The names the unit around a claim prints, as `{ field, name }`.
 *
 * Empty for every claim whose unit carries none, which is every claim in the
 * corpus except a territory statement's. Strings only, and non-empty ones: a
 * malformed entry is `make validate-content`'s to refuse, and a gate that
 * searched a source for `""` would find it in every document ever written.
 */
const namesIn = (parent) => {
  if (!isObject(parent)) return [];
  return NAME_FIELDS.flatMap(({ key }) => {
    const value = parent[key];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      const name = str(item);
      return name === null || name.trim() === '' ? [] : [{ field: key, name }];
    });
  });
};

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
    /* A question names no people in a field of its own: a name it uses is inside
       its prompt, its options or its explanation, which are already checked as
       prose. Present and empty rather than absent, so every consumer reads one
       shape (ADR-0051). */
    names: [],
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
    /* The names the unit prints, which are held to a different rule from the
       prose beside them — see {@link NAME_FIELDS}. */
    names: namesIn(parent),
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

/* -------------------------------------------------------------------------- */
/* Which claim is which: a claim's identity, stable across revisions          */
/* -------------------------------------------------------------------------- */
/*
 * READ THIS BEFORE CHANGING HOW GATE A TELLS ONE CLAIM FROM ANOTHER.
 *
 * Gate A in `scripts/verify-content.mjs` compares a document with its parent:
 * A1/A2 ask whether a commit wrote or changed a claim's grant, and A4 asks
 * whether a grant still sits on the fields it was granted over. Both need to
 * know which claim in the parent is which claim in the child. They used to
 * answer with the JSON pointer — `/pois/2/fact/verification` — and an array
 * index is a POSITION, not an identity.
 *
 * Measured cost, on the commit that gave Toronto a streetcar and Nathan Phillips
 * Square and the foothills a pump jack: inserting landmarks ahead of the CN
 * Tower and the beef cattle made that commit read as rewriting both of their
 * grants and as changing grants in the new slots, which is four A1/A2 failures
 * that no later grant can clear, because A1/A2 is judged per commit. Worse, the
 * cattle MOVED in the same commit, from x 6800 to 7600, and A4 said nothing:
 * the cattle's old grant was re-recorded as a fresh grant in slot 3, bound to
 * the moved fields. The grant followed a slot rather than the claim it was made
 * on.
 *
 * THE KEY. Every array step on the path to a block is keyed by the item's `id`
 * WHEN THE ITEM'S SCHEMA REQUIRES `id`, and by position otherwise:
 *
 *   /pois[id=streetcar]/fact/verification
 *   /steps[id=visit-barn]/dialogue/1/fact/verification
 *   /territory/fact/verification                 (no array: the path IS the identity)
 *   /verification                                (a question: the document is the claim)
 *
 * Whether an array is keyed is READ FROM THE SCHEMA — the `required` list of the
 * item schema, through `$ref` and unconditional `allOf`, in the schema the
 * document names in its own `$schema`, at the revision being read. There is no
 * list of arrays here. A new collection whose items require an id is keyed by it
 * the day its schema says so; a schema that stops requiring one while its
 * documents still carry distinct ids is a DRIFT, reported by `claimKeys` rather
 * than silently degrading to positions.
 *
 * WHY THE ONE NAME `id`. It is the schemas' own word for an entity's identity —
 * `common.schema.json#/$defs/id`, "Stable kebab-case identifier, unique within
 * its collection" — and every entity document and entity item uses it. Being
 * id-TYPED is not being an identity: `questStep.targetId` is id-typed and names
 * the thing the step points AT. So the type cannot decide; the requiredness of
 * the entity's own `id` does.
 *
 * PER CLAIM KIND, and why:
 *
 *   - A question is its document. Pointer `''`, block `/verification`. A file
 *     path is already an identity.
 *   - A territory statement (`/territory/fact`) and a
 *     quest moment line (`/afterLine/fact`, `/declinedLine/fact`, …) are
 *     singletons at a fixed path. No array is crossed, so the pointer is stable.
 *   - A point of interest requires `id`: `/pois[id=cn-tower]`.
 *   - A quest step requires `id`: `/steps[id=visit-barn]`.
 *   - A DIALOGUE LINE requires no id of its own, so it is its step's id plus its
 *     index in that step: `/steps[id=visit-barn]/dialogue/1`. Decided, not
 *     defaulted:
 *
 *       * Every content-derived identity — the quote, a hash of the text, the
 *         speaker — changes on exactly the edit A4 exists to see. A reworded line
 *         would read as a NEW claim arriving already verified, and A4's record
 *         would start again on the new words: the slot bug by another route.
 *       * Step id plus index is stable against every edit outside the step —
 *         steps inserted, removed or reordered, landmarks moved — which is where
 *         a whole-document index broke. What it does not survive is a line
 *         inserted, removed or reordered AHEAD of a granted line inside ONE
 *         step. That can only happen in a commit that authors the step, and a
 *         grant that changes index in an authoring commit fails A1/A2 in that
 *         commit: loud, not silent, and the A1/A2 message says the claim is
 *         keyed by position so nobody splits a commit to satisfy it.
 *       * Measured over this repository's history: of 35 commits touching levels
 *         or quests, a granted dialogue line changed its index inside its step 0
 *         times. Granted points of interest changed index twice, both in the
 *         landmark commit above.
 *       * If lines are ever reordered as a matter of course, a required `id` on
 *         `dialogueLine` (a schema change, so an ADR) keys them by it with no
 *         change to this module.
 *
 * A RENAME IS A NEW IDENTITY. Changing an item's `id` removes one claim and adds
 * another. A grant carried across in the same commit is a grant arriving on a
 * claim in an authoring commit, which A1/A2 fails: write the null form and have
 * it re-verified. Measured: no granted point of interest or step has ever been
 * renamed here. Matching a renamed claim to its old self by content was
 * considered and refused, because the same matcher would accept an author moving
 * a grant onto a different claim — which is ADR-0003's letter, not a heuristic's
 * judgement call.
 *
 * AMBIGUITY FAILS (ADR-0024). Two items of one array with the same required id,
 * or an item missing it, give the claims inside them no identity. Keying them by
 * position "just this once" is how a grant reattached to a moved landmark, so
 * `claimKeys` returns a fault and a disambiguated key that names the problem;
 * the gate decides where a fault is a failure.
 *
 * NO SCHEMA, NO IDENTITY — AND SAID SO. A document whose `$schema` does not
 * resolve (a fixture tree carrying no schemas, a revision older than them) is
 * keyed by position, which is exactly the old behaviour, and the result says it
 * was not resolved so the caller can count it rather than let it pass as keyed.
 */

/** The name the schemas give an entity's own identity. See the essay above. */
const IDENTITY_KEY = 'id';

const stripHash = (url) => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
};

const unescapePointer = (segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
const escapePointer = (segment) => segment.replace(/~/gu, '~0').replace(/\//gu, '~1');

/** A JSON pointer as its unescaped segments. `''` is the document itself. */
const segmentsOf = (pointer) => (pointer === '' ? [] : pointer.slice(1).split('/').map(unescapePointer));

/**
 * Every schema of one revision, by `$id` and by repo-relative path.
 *
 * `entries` is `{ where, document }` per schema file. A schema with no `$id` is
 * addressed by a file URL of its path, so a relative `$ref` out of it still
 * resolves.
 */
export const schemaRegistry = (entries) => {
  const byId = new Map();
  const byPath = new Map();
  for (const { where, document } of entries) {
    if (!isObject(document)) continue;
    const fileUrl = new URL(posix.normalize(where), 'file:///').href;
    const declared = str(document.$id) === null ? null : stripHash(document.$id);
    const base = declared ?? fileUrl;
    const entry = { document, base, file: posix.basename(posix.normalize(where)) };
    byPath.set(posix.normalize(where), entry);
    byId.set(base, entry);
    byId.set(fileUrl, entry);
  }
  return { byId, byPath, size: byPath.size };
};

/** A schema node, the base URL its `$ref`s resolve against, and a readable name. */
const schemaAt = (entry, fragment) => {
  let node = entry.document;
  const segments = fragment === '' || fragment === '#' ? [] : segmentsOf(fragment.slice(1));
  for (const segment of segments) {
    if (!isObject(node) && !Array.isArray(node)) return null;
    node = node[segment];
    if (node === undefined) return null;
  }
  return { schema: node, base: entry.base, label: `${entry.file}${fragment === '' ? '#' : fragment}` };
};

const refTarget = (registry, ref, base) => {
  let url;
  try {
    url = new URL(ref, base);
  } catch {
    return null;
  }
  const fragment = decodeURIComponent(url.hash);
  const entry = registry.byId.get(stripHash(url.href) ?? '');
  return entry === undefined ? null : schemaAt(entry, fragment);
};

/**
 * The schema nodes that apply UNCONDITIONALLY to one instance: the node, what
 * its `$ref` points at, and every `allOf` member that is not an `if`. A
 * conditional's `required` binds only some instances, so it cannot make an
 * identity.
 */
const facetsOf = (registry, context, depth = 0) => {
  if (context === null || !isObject(context.schema) || depth > 32) return [];
  const found = [context];
  if (str(context.schema.$ref) !== null) {
    found.push(...facetsOf(registry, refTarget(registry, context.schema.$ref, context.base), depth + 1));
  }
  if (Array.isArray(context.schema.allOf)) {
    context.schema.allOf.forEach((member, index) => {
      if (!isObject(member) || 'if' in member) return;
      found.push(
        ...facetsOf(
          registry,
          { schema: member, base: context.base, label: `${context.label}/allOf/${String(index)}` },
          depth + 1,
        ),
      );
    });
  }
  return found;
};

/** The schema for one step down: `segment` of an object, or an array's items when `null`. */
const childSchema = (registry, context, segment) => {
  for (const facet of facetsOf(registry, context)) {
    const sub =
      segment === null
        ? facet.schema.items
        : isObject(facet.schema.properties)
          ? facet.schema.properties[segment]
          : undefined;
    if (!isObject(sub)) continue;
    const where = `${facet.label}${segment === null ? '/items' : `/properties/${escapePointer(segment)}`}`;
    const target = str(sub.$ref) === null ? null : refTarget(registry, sub.$ref, facet.base);
    return { schema: sub, base: facet.base, label: target?.label ?? where };
  }
  return null;
};

const requiresIdentity = (registry, context) =>
  facetsOf(registry, context).some(
    (facet) => Array.isArray(facet.schema.required) && facet.schema.required.includes(IDENTITY_KEY),
  );

/** The schema a document names in `$schema`, resolved against the document's own path. */
const documentSchema = (registry, document, where) => {
  const declared = isObject(document) ? str(document.$schema) : null;
  if (declared === null) return null;
  const entry = /^[a-z][a-z0-9+.-]*:/iu.test(declared)
    ? registry.byId.get(stripHash(declared) ?? '')
    : registry.byPath.get(posix.normalize(posix.join(posix.dirname(where), declared)));
  return entry === undefined ? null : schemaAt(entry, '');
};

/** An id as it appears in a key: bare when it is a plain identifier, quoted when it is not. */
const idText = (id) => (/^[A-Za-z0-9._-]+$/u.test(id) ? id : JSON.stringify(id));

/**
 * The identity key of every block at `pointers` in one document, under the
 * schemas of the same revision. See the essay above for the scheme.
 *
 *   keys        pointer -> identity key
 *   faults      duplicate or missing required ids, and any two pointers sharing a
 *               key — each a string naming the document
 *   ambiguous   key -> the key the claim would have had (null when it has no id at
 *               all), for every key a fault made
 *   positional  pointer -> the item schemas it was keyed through BY POSITION
 *   drift       arrays keyed by position whose items nonetheless all carry a
 *               distinct string id: the schema and the documents disagree
 *   resolved    whether the document's `$schema` resolved at all
 */
export const claimKeys = (document, where, pointers, registry) => {
  const root = documentSchema(registry, document, where);
  const keys = new Map();
  const faults = [];
  const ambiguous = new Map();
  const positional = new Map();
  const drift = [];
  const idCounts = new WeakMap();
  const said = new Set();
  const once = (list, token, message) => {
    if (said.has(token)) return;
    said.add(token);
    list.push(message);
  };
  const countsOf = (array) => {
    let counts = idCounts.get(array);
    if (counts === undefined) {
      counts = new Map();
      for (const item of array) {
        const id = isObject(item) ? str(item[IDENTITY_KEY]) : null;
        if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      idCounts.set(array, counts);
    }
    return counts;
  };

  for (const pointer of pointers) {
    let node = document;
    let context = root;
    let key = '';
    let canonical = '';
    let unidentified = false;
    let hasNoId = false;
    const through = [];
    for (const segment of segmentsOf(pointer)) {
      if (!Array.isArray(node)) {
        key += `/${escapePointer(segment)}`;
        canonical += `/${escapePointer(segment)}`;
        context = context === null ? null : childSchema(registry, context, segment);
        node = isObject(node) ? node[segment] : undefined;
        continue;
      }
      const index = Number(segment);
      const item = node[index];
      const itemContext = context === null ? null : childSchema(registry, context, null);
      const label = itemContext?.label ?? '(no schema resolved)';
      if (itemContext !== null && requiresIdentity(registry, itemContext)) {
        const id = isObject(item) ? str(item[IDENTITY_KEY]) : null;
        const copies = id === null ? 0 : (countsOf(node).get(id) ?? 0);
        if (id === null) {
          unidentified = true;
          hasNoId = true;
          key += `[${segment},no-id]`;
          once(
            faults,
            `${key} no-id`,
            `${where}: item ${segment} of ${canonical === '' ? 'the document' : canonical} carries no string ` +
              `"${IDENTITY_KEY}", and its schema ${label} requires one. The claims inside it have no ` +
              `identity, so gate A cannot tell a grant on them from a grant on any other item. ` +
              `ADR-0024: an ambiguous identity is a failure, not a guess — falling back to the position ` +
              `is how a grant came to follow a slot instead of its claim. Give it the id its schema requires.`,
          );
        } else if (copies > 1) {
          unidentified = true;
          key += `[id=${idText(id)},duplicate-at=${segment}]`;
          canonical += `[id=${idText(id)}]`;
          once(
            faults,
            `${canonical} duplicate`,
            `${where}: ${String(copies)} items of ${canonical.slice(0, canonical.lastIndexOf('['))} carry ` +
              `${IDENTITY_KEY} "${id}", which their schema ${label} requires to identify each one. The ` +
              `claims inside them have no identity: a grant on one cannot be told from a grant on the ` +
              `other, in A1/A2 or in A4. ADR-0024: an ambiguous identity is a failure, not a guess — ` +
              `picking one by position is how a grant came to follow a slot instead of its claim. Give ` +
              `each a distinct id.`,
          );
        } else {
          key += `[id=${idText(id)}]`;
          canonical += `[id=${idText(id)}]`;
        }
      } else {
        key += `/${segment}`;
        canonical += `/${segment}`;
        through.push(label);
        const ids = node.map((entry) => (isObject(entry) ? str(entry[IDENTITY_KEY]) : null));
        if (
          itemContext !== null &&
          ids.length > 0 &&
          ids.every((id) => id !== null) &&
          new Set(ids).size === ids.length
        ) {
          const arrayAt = key.slice(0, key.lastIndexOf('/'));
          once(
            drift,
            `${arrayAt} drift`,
            `${where}: every item of ${arrayAt === '' ? 'the document' : arrayAt} carries a distinct string ` +
              `"${IDENTITY_KEY}", and its schema ${label} does not require one, so the claims inside are ` +
              `keyed by POSITION — an insertion ahead of them reads as rewriting their grants, and a moved ` +
              `claim's grant follows the slot. Claim identity is read from what a schema requires. Either ` +
              `the schema stopped requiring an id its documents still carry, and it should require it ` +
              `again, or these ids are not identities, which should be said where the schema is.`,
          );
        }
      }
      node = item;
      context = itemContext;
    }
    keys.set(pointer, key);
    if (unidentified) ambiguous.set(key, hasNoId ? null : canonical);
    if (through.length > 0) positional.set(pointer, through);
  }

  const owners = new Map();
  for (const [pointer, key] of keys) {
    const other = owners.get(key);
    if (other !== undefined) {
      faults.push(
        `${where}: the blocks at ${other} and ${pointer} resolve to one identity, ${key}, so gate A ` +
          `cannot tell their grants apart. ADR-0024: an ambiguous identity is a failure, not a guess.`,
      );
      ambiguous.set(key, null);
    } else {
      owners.set(key, pointer);
    }
  }
  return { keys, faults, ambiguous, positional, drift, resolved: root !== null };
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
