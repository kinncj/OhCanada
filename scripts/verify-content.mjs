#!/usr/bin/env node
/**
 * verify-content — the content verification gate (slice 1, task 1.17).
 *
 * Three gates, in the order they are cheapest to explain:
 *
 *   A. SEPARATION OF DUTIES, read from git history. ADR-0003 splits authoring
 *      from verifying between two agents and says an author-authored commit may
 *      write a `verification` object only in the null form and may never change
 *      one that exists. `docs/content-review.md` §1 says the same of
 *      `communityReview`: an agent may write `not-sought` and nothing else.
 *      READ "WHAT AUTHORSHIP THIS REPOSITORY CAN AND CANNOT ESTABLISH" BELOW
 *      BEFORE TRUSTING THIS GATE. It does not do what its name suggests, and
 *      the difference is written down rather than implied.
 *
 *   B. ADR-0003's CI clause, per document. A shipped question must be
 *      `verified` for the CURRENT `sourceHash`, carry four options, EN and FR
 *      throughout, a non-empty `evidence` when verified, and wording that is
 *      not lifted from the source.
 *
 *   C. ADR-0016 §2's four-row re-check table. Which clock a question is under
 *      depends on what the source register's `liveChecks[]` establishes about
 *      the source, not on the question alone.
 *
 * WHAT THIS SCRIPT DELIBERATELY DOES NOT DO
 *
 * It does not fetch canada.ca. The slice-0 stub header said it would ("refresh
 * content/sources/* and recompute each sourceHash"), and ADR-0016 replaced that
 * plan: a live check is a judgement — did the live page still say the same
 * thing about the claims we use? — recorded by a named checker in
 * `liveChecks[]`. A CI job that fetched a page and wrote its own finding would
 * be granting itself the very attestation the separation of duties exists to
 * withhold, which is the defect this file is meant to close, not commit. The
 * gate reads the record and checks its form, its chapter binding and its age.
 *
 * It never writes to content/. Where ADR-0016's table says "quarantines the
 * question" or "quarantines the source", this script FAILS and names what must
 * be quarantined. A gate that edited `verification` blocks would be a third
 * agent writing them.
 *
 * ------------------------------------------------------------------------
 * WHAT AUTHORSHIP THIS REPOSITORY CAN AND CANNOT ESTABLISH
 * ------------------------------------------------------------------------
 *
 * The rule to enforce names an actor: "an AUTHOR-AUTHORED commit". So the first
 * question is whether this repository can tell who authored a commit. Measured,
 * not assumed:
 *
 *     git log --format='%an|%ae|%cn|%ce|%G?' | sort -u
 *     Kinn Coelho Juliao|kinncj@gmail.com|Kinn Coelho Juliao|kinncj@gmail.com|N
 *
 * Every commit in this repository — 58 of them at the time of writing — carries
 * one author identity, one committer identity, and no signature. CLAUDE.md
 * forbids attribution trailers, so the message carries nothing either. There is
 * no field, anywhere in the object graph, that separates a commit made by the
 * content-author agent from one made by the content-verifier agent from one
 * made by the repository owner at a keyboard.
 *
 * THEREFORE: AUTHORSHIP CANNOT BE ESTABLISHED FROM THIS REPOSITORY'S HISTORY,
 * and a gate claiming to fail "when a commit authored by an agent" does X would
 * be asserting something it cannot see. This file does not make that claim.
 *
 * What it enforces instead is the rule's checkable consequence, which needs no
 * identity at all:
 *
 *     WITHIN ONE DOCUMENT, ONE COMMIT MAY NOT DO BOTH JOBS.
 *
 * A commit that changes any author-owned field of a document (prompt, options,
 * explanation, source, ids) may not, in that same document, also write or
 * change a `verification` block — with one allowance, that a newly added file
 * may introduce the block in the null form, because the schema requires the
 * block to exist and the null form is the only shape an author may write.
 *
 * That is not a proxy for authorship; it is a different and weaker property
 * that happens to catch the failure this task exists for. State it in both
 * directions:
 *
 *   CAUGHT. An agent holding `Write(content/questions/**)` writes a question
 *   file with `"status": "verified"` already in it. The file's author-owned
 *   fields and its granted verification arrive in the same commit, in the same
 *   document, and this gate fails. That is the exact scenario the removed
 *   permission prompt used to stand in front of, and it is now closed.
 *
 *   NOT CAUGHT. One agent makes two commits: the first adds the question in the
 *   null form, the second flips it to `verified` and touches nothing else. That
 *   is byte-for-byte the same history two properly separated agents produce.
 *   Nothing in git distinguishes them, and no amount of care in this file will
 *   change that. The cost of the lie goes from zero to "you must split it into
 *   two commits, in that order". Non-zero, real, and not the rule.
 *
 * WHAT WOULD MAKE AUTHORSHIP ESTABLISHABLE, in increasing order of how much it
 * actually proves. This is the specification the architect asked for:
 *
 *   1. DISTINCT GIT IDENTITIES PER ROLE. The author agent commits as
 *      `TrueNorth content-author <content-author@truenorth.invalid>`, the
 *      verifier as `content-verifier@...`. This gate then reads `%ae` and the
 *      rule becomes literally checkable. It is SELF-ATTESTED — any process can
 *      set `GIT_AUTHOR_EMAIL` — so it proves nothing against a dishonest agent.
 *      It is still worth having, for the same reason ADR-0003 accepts the
 *      `communityReview` schema: it changes the shape of the lie from an
 *      invisible omission into a specific false statement inside an immutable,
 *      hash-chained object. This is a one-line change to each agent's
 *      environment and does not involve a commit trailer, so CLAUDE.md's
 *      prohibition does not reach it. It is the cheapest real improvement
 *      available and this file is ALREADY WIRED for it: drop a
 *      `scripts/content-roles.json` mapping each role's commit email to
 *      "author" or "verifier" and gate A starts enforcing the rule as worded,
 *      including the two-commit case below that it otherwise cannot see.
 *
 *   2. PER-ROLE SIGNING KEYS IN SEPARATE SANDBOXES. The verifier holds a key
 *      the author's process cannot read; `%G?` and `%GK` then carry an
 *      unforgeable answer. This is genuinely establishable — but ONLY if the
 *      sandboxes are real. Two agent roles running as the same OS user against
 *      the same keyring is theatre, and would read as cryptographic proof.
 *
 *   3. AN IDENTITY THE COMMITTER DOES NOT CONTROL. Verification blocks land
 *      only through a pull request pushed by a distinct GitHub App installation,
 *      with `content/questions/**` under CODEOWNERS and branch protection
 *      refusing a self-approved change. GitHub asserts that identity, not the
 *      committer, so it is the only option on this list that is not ultimately
 *      a claim an agent makes about itself.
 *
 * Until one of those lands, this gate holds the one-commit-one-job rule, and
 * `communityReview` is handled by refusing every non-`not-sought` transition
 * outright (rule A3 in the history gate) — because there the correct answer to
 * "was this an agent?" is "we cannot tell", and the cost of guessing wrong is a
 * fabricated sign-off naming a real person.
 *
 * ------------------------------------------------------------------------
 * FLAGS
 * ------------------------------------------------------------------------
 *   --root <dir>       run the whole gate over another tree. Fixtures in
 *                      tests/unit/infra/verify-content-gate.test.ts drive the
 *                      real CLI over scratch git repositories, so the rules the
 *                      tests prove are the rules the corpus gets.
 *   --since <rev>      only inspect commits after <rev>. Default is the whole
 *                      history, which is cheap here and re-checks the record
 *                      every run rather than trusting a base ref.
 *   --now <iso>        override the clock, for the 180-day rules.
 *   --require-source   fail when a source's cached extraction is absent instead
 *                      of reporting the checks it disables. See SOURCE TEXT.
 *   --no-history       skip gate A. For running gates B and C over a tree that
 *                      is not a git repository. Prints a loud line saying so.
 *   --roles <file>     override scripts/content-roles.json. See ROLE_IDENTITIES.
 *   --help
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* -------------------------------------------------------------------------- */
/* Constants that are decisions, with the measurement behind each one          */
/* -------------------------------------------------------------------------- */

/**
 * ADR-0003 and ADR-0016: 180 days is the age at which a granted status stops
 * being trusted. Which clock it is applied to — the question's `source.asOf` or
 * the register's `liveChecks[].checkedAt` — is ADR-0016 §2's table, below.
 */
const STALE_AFTER_DAYS = 180;

/**
 * ADR-0003 check 5, "confirm the wording is not verbatim (n-gram check)".
 *
 * This threshold was measured, not chosen. Over the 57-question government
 * bank, the longest run of consecutive words shared between a question's own
 * prose and the cached extraction is 12 — in
 * `gov-42-voter-information-card`'s explanation, "the card is mailed to each
 * elector whose name is in the National Register of Electors". The runs just
 * below it are institutional machinery that cannot be paraphrased away: "the
 * party holding the most seats in the House of Commons", "the Sovereign, the
 * Senate and the House of Commons".
 *
 * So 14 is one word of headroom over the observed ceiling of unavoidable
 * terminology. It is a weak threshold and this comment says so rather than
 * letting the number imply strength: it catches a lifted SENTENCE, which is
 * what an author copying rather than paraphrasing produces, and it does not
 * catch a lifted clause. The measured maximum is printed on every run — see the
 * summary — so the number moves with the corpus and can be tightened against
 * evidence instead of taste.
 */
const VERBATIM_RUN_WORDS = 14;

/**
 * Options are NOT checked for verbatim wording, and the reason is a
 * measurement rather than an omission. Four of the corpus's options are 100%
 * verbatim — "The House of Commons.", "Band chiefs and councillors.", "The
 * province or territory." — because a four-word institutional noun phrase has
 * no paraphrase that is not a distortion. Any threshold loose enough to admit
 * those admits everything. The obligation to paraphrase falls on the prose the
 * author actually wrote: the prompt and the explanation.
 */
const VERBATIM_FIELDS = ['prompt', 'explanation'];

/**
 * ADR-0003, "Two quotes, one per side of the separation": `source.quote` "must
 * be a contiguous passage of the cached extraction at the recorded hash, which
 * is a check that catches a fabricated citation before any verifier runs".
 * Enforced exactly, with no tolerance: 57 of 57 pass today.
 *
 * `verification.evidence` is held to a weaker rule on purpose. Five of the
 * corpus's evidence spans are not contiguous in the extraction, and all five
 * are PDF layout artefacts rather than fabrications — a step label separated
 * from its sentence ("STEP 3 Committee Stage — Committee members study the bill
 * clause by clause"), and one two-column responsibilities table read across.
 * The verifier reconstructed a passage a human reads as contiguous and the text
 * extractor does not. So evidence must instead contain a contiguous run of at
 * least EVIDENCE_RUN_WORDS words from the extraction and introduce no word the
 * source does not contain. Measured over the corpus: the shortest such run is
 * 7, and the number of unknown words across all 57 spans is ZERO. Both floors
 * are printed on every run.
 */
const EVIDENCE_RUN_WORDS = 5;

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

const HELP = `verify-content — verify question data against Discover Canada sources (ADR-0003, ADR-0016)

Usage: node scripts/verify-content.mjs [options]

  --root <dir>      run over another tree (fixtures drive the real CLI)
  --since <rev>     only inspect commits after <rev>; default is all history
  --now <iso>       override the clock used by the 180-day rules
  --require-source  fail when a cached extraction is missing rather than
                    reporting which checks it disables
  --no-history      skip the git separation-of-duties gate
  --roles <file>    a git-author-email to role map, enabling ADR-0003's rule as
                    worded. Default scripts/content-roles.json, which does not
                    exist; see the header for why that is the honest state.
  -h, --help

Gate A  separation of duties, from git history
        one commit may not both author a claim and grant its verification, in
        the same document; no commit may move communityReview off "not-sought".
        Read the header: authorship itself is NOT establishable in this
        repository, and the header specifies what would make it so.
Gate B  ADR-0003's CI clause, per document
        verified for the current sourceHash; four options; EN and FR; non-empty
        evidence when verified; source.quote contiguous in the extraction;
        wording not lifted from the source.
Gate C  ADR-0016 §2's re-check table
        which 180-day clock binds — the question's source.asOf or the register's
        liveChecks[].checkedAt — depends on what the register establishes about
        the source.
`;

const argv = process.argv.slice(2);
if (argv.some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

const flagValue = (name) => {
  const at = argv.indexOf(name);
  if (at === -1) return null;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`verify-content: ${name} needs a value`);
    process.exit(2);
  }
  return value;
};

const ROOT = flagValue('--root') === null
  ? fileURLToPath(new URL('..', import.meta.url))
  : resolve(flagValue('--root'));
const SINCE = flagValue('--since');
const NOW = flagValue('--now') === null ? new Date() : new Date(flagValue('--now'));
const REQUIRE_SOURCE = argv.includes('--require-source');
const NO_HISTORY = argv.includes('--no-history');

if (Number.isNaN(NOW.getTime())) {
  console.error('verify-content: --now is not a date');
  process.exit(2);
}

/**
 * ROLE IDENTITIES — the switch described in option 1 of the authorship note
 * above, wired rather than aspirational.
 *
 * `scripts/content-roles.json` is an optional map from a git author email to a
 * role: `{ "content-author@truenorth.invalid": "author",
 * "content-verifier@truenorth.invalid": "verifier" }`. The file DOES NOT EXIST
 * today, and until each agent role commits under its own identity it should not:
 * a map that named this repository's single identity as one role would make the
 * gate confidently wrong rather than honestly weak.
 *
 * When it exists, gate A additionally enforces the rule as ADR-0003 words it —
 * a commit whose author is the AUTHOR role may write a verification object only
 * in the null form and may never change one that exists; a commit whose author
 * is the VERIFIER role may not touch author-owned fields at all. That is
 * strictly stronger than the one-commit-one-job rule, and it catches the case
 * one-commit-one-job cannot: one actor making two commits. It remains
 * SELF-ATTESTED — anything can set GIT_AUTHOR_EMAIL — which is why the summary
 * says which rule was in force rather than letting the reader assume the strong
 * one.
 */
const ROLE_IDENTITIES_FILE =
  flagValue('--roles') ?? join(fileURLToPath(new URL('.', import.meta.url)), 'content-roles.json');
const ROLE_IDENTITIES = existsSync(ROLE_IDENTITIES_FILE)
  ? JSON.parse(readFileSync(ROLE_IDENTITIES_FILE, 'utf8'))
  : {};
const roleOf = (email) => {
  const role = ROLE_IDENTITIES[email.toLowerCase()];
  return role === 'author' || role === 'verifier' ? role : null;
};

/**
 * git's empty tree, so a ROOT commit — which has no parent — is diffed against
 * nothing rather than skipped. Skipping it would mean the very first commit of
 * a repository could add a question already marked verified and never be looked
 * at, which is precisely the case the fixtures exercise.
 */

const CONTENT_DIR = join(ROOT, 'content');
const QUESTIONS_DIR = join(CONTENT_DIR, 'questions');
const SOURCES_DIR = join(CONTENT_DIR, 'sources');

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);
const note = (message) => notes.push(message);

/* -------------------------------------------------------------------------- */
/* Small shared helpers                                                        */
/* -------------------------------------------------------------------------- */

const str = (value) => (typeof value === 'string' ? value : null);
const int = (value) => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const jsonFilesUnder = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return jsonFilesUnder(path);
        return entry.isFile() && path.endsWith('.json') ? [path] : [];
      })
    : [];

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${relative(ROOT, path)}: is not parseable JSON — ${String(error)}`);
    return null;
  }
};

const ageInDays = (iso) => {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((NOW.getTime() - then.getTime()) / 86_400_000);
};

/**
 * Words, for every text comparison in gate B.
 *
 * NFKC first so a PDF's ligatures and non-breaking spaces do not read as
 * different characters from a keyboard's. Curly punctuation is folded to ASCII
 * because the extraction and the authored JSON disagree about it constantly and
 * that disagreement is typography, not wording. Then everything that is not a
 * letter or a digit is a separator, so the apostrophe splits — the same
 * decision, for the same reason, as the banned-terms matcher in
 * tests/unit/contracts/questions-cite-a-cached-source.test.ts.
 */
const words = (text) =>
  text
    .normalize('NFKC')
    .replace(/[‘’ʼ]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[–—]/gu, '-')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');

/** The longest run of consecutive words of `text` that appears in `haystack`. */
const longestSharedRun = (haystack, text) => {
  const needle = words(text);
  if (needle.length === 0) return 0;
  const hay = ` ${haystack.join(' ')} `;
  for (let n = needle.length; n > 0; n -= 1) {
    for (let i = 0; i + n <= needle.length; i += 1) {
      if (hay.includes(` ${needle.slice(i, i + n).join(' ')} `)) return n;
    }
  }
  return 0;
};

/* -------------------------------------------------------------------------- */
/* Structural recognition of the two blocks the separation of duties governs    */
/* -------------------------------------------------------------------------- */
/*
 * Recognised by SHAPE and not by key name. `content/schemas/*.json` contains a
 * property literally called `verification`, and a gate that matched on the name
 * would find blocks inside the schemas that define them. Matching the required
 * key set plus a legal `status` cannot make that mistake, and it also means a
 * block nested anywhere — `factClaim.verification`, `nationSource.verification`,
 * a level's `territoryStatement` — is found without this file carrying a list of
 * where blocks are allowed to live, which would go stale the first time a schema
 * grew one.
 */

const VERIFICATION_KEYS = ['status', 'model', 'checkedAt', 'sourceHash', 'evidence'];
const VERIFICATION_STATUSES = ['unverified', 'verified', 'quarantined', 'rejected'];
const REVIEW_KEYS = ['status', 'reviewer', 'organisation', 'date', 'scope'];
const REVIEW_STATUSES = ['not-sought', 'sought', 'granted', 'refused'];

/**
 * REQUIRED SUBSET, NOT EXACT KEY SET. This predicate previously also refused
 * any block carrying a key it did not know about, and that made the recogniser
 * a function of the SCHEMA'S CURRENT SHAPE rather than of the block's identity.
 * ADR-0003's amendment added `record` to `communityReview`; the seven-key block
 * that field makes mandatory stopped being recognised, so rule A3 — the one
 * standing between an agent and a fabricated Indigenous sign-off naming a real
 * person — silently stopped firing on the exact documents the amendment
 * created. The only visible signal was a count in the summary going down.
 *
 * The property being tested is "is this an instance of the block?", and what
 * carries it is the keys the block MUST have plus a legal `status` — not the
 * keys it must NOT have (ADR-0019). Extra keys are schema growth, which is
 * expected; a missing required key or an illegal status is what says "not an
 * instance".
 *
 * The false-positive this widening could have opened, and why it does not: a
 * JSON Schema's `properties` object for `factVerification` has exactly these
 * five key names, so key presence alone would match the files that DEFINE the
 * blocks. `status` there is a subschema object, not one of the four status
 * strings, so the status test rejects it. `assertRecogniserIsLive` below proves
 * both directions against the real schema on every run, and the fixtures prove
 * them against a schema mutated the way the next amendment will mutate it.
 */
const looksLike = (value, keys, statuses) =>
  isObject(value) &&
  keys.every((key) => key in value) &&
  statuses.includes(str(value.status) ?? '');

const isVerification = (value) => looksLike(value, VERIFICATION_KEYS, VERIFICATION_STATUSES);
const isCommunityReview = (value) => looksLike(value, REVIEW_KEYS, REVIEW_STATUSES);

/**
 * THE FLOOR UNDER THE RECOGNISER, anchored to the schema rather than to a
 * comment. Every rule in gate A is scoped by these two predicates: if either
 * stops recognising the blocks the schema requires, A0/A1/A2/A3/A4 and the
 * null-form allowance all stop firing at once, over a corpus that still looks
 * fully inspected. That is the failure this run has already had once, so it is
 * a case rather than a note.
 *
 * Three assertions, each of which the `record` amendment would have tripped:
 *
 *   1. Every key this file uses to identify a block is still REQUIRED by the
 *      schema. If the schema drops one, the identifying set is over-specified
 *      and would miss legitimate blocks — fail rather than under-match.
 *   2. A synthetic block carrying EXACTLY the schema's current required keys is
 *      recognised, for every legal status. This is the assertion that fails if
 *      anyone reintroduces an exact-key-set test, because the schema's required
 *      list is longer than the identifying set and always will be after an
 *      amendment.
 *   3. A JSON Schema `properties` object built from the same key names is NOT
 *      recognised. The widening in (2) is only safe while this holds.
 */
const assertRecogniserIsLive = () => {
  const path = join(CONTENT_DIR, 'schemas', 'common.schema.json');
  if (!existsSync(path)) {
    note(
      `content/schemas/common.schema.json is absent, so the recogniser self-test did not run. ` +
        `Gate A's rules are only as wide as isVerification()/isCommunityReview(), and nothing here ` +
        `checked them against the schema that defines the blocks.`,
    );
    return;
  }
  const schema = readJson(path);
  const defs = isObject(schema?.$defs) ? schema.$defs : {};
  const cases = [
    ['factVerification', VERIFICATION_KEYS, VERIFICATION_STATUSES, isVerification],
    ['communityReview', REVIEW_KEYS, REVIEW_STATUSES, isCommunityReview],
  ];
  for (const [def, keys, statuses, recognise] of cases) {
    const required = Array.isArray(defs[def]?.required) ? defs[def].required.filter((k) => str(k) !== null) : null;
    if (required === null) {
      fail(
        `content/schemas/common.schema.json has no $defs.${def}.required, so the recogniser this ` +
          `gate scopes every rule by cannot be checked against the schema. Either the def was ` +
          `renamed — in which case this file must follow it — or the schema stopped requiring a ` +
          `shape, in which case there is nothing left to recognise.`,
      );
      continue;
    }
    for (const key of keys) {
      if (!required.includes(key)) {
        fail(
          `${def}: this gate identifies the block by "${key}" and the schema no longer requires it. ` +
            `A legitimate block written without that key would not be recognised, and every rule ` +
            `scoped by the recogniser would skip it silently. Drop it from the identifying set here, ` +
            `deliberately, or put it back in the schema.`,
        );
      }
    }
    for (const status of statuses) {
      const instance = Object.fromEntries(required.map((key) => [key, key === 'status' ? status : null]));
      if (!recognise(instance)) {
        fail(
          `${def}: a block carrying exactly the schema's ${String(required.length)} required key(s) ` +
            `(${required.join(', ')}) with status "${status}" is NOT recognised by this gate. The ` +
            `schema and the recogniser have diverged, and every rule scoped by it is now skipping ` +
            `the blocks the schema mandates — which is a silent pass, not a failure. This is the ` +
            `defect ADR-0003's "record" amendment produced: an exact-key-set test disabled rule A3 ` +
            `the moment the schema grew a field.`,
        );
      }
    }
    const definition = Object.fromEntries(required.map((key) => [key, { type: 'string' }]));
    if (recognise(definition)) {
      fail(
        `${def}: a JSON Schema properties object built from the same key names IS recognised as an ` +
          `instance of the block. The recogniser matches on a required subset, which is only safe ` +
          `while the files that DEFINE the blocks cannot match it.`,
      );
    }
  }
};

/**
 * ADR-0003: "The null form is now the ONLY legal shape of an unverified block".
 * `make validate-content` pins it, which is what lets this gate be one sentence
 * with no per-field carve-out.
 */
const isNullForm = (block) =>
  str(block.status) === 'unverified' &&
  block.model === '' &&
  block.checkedAt === null &&
  block.sourceHash === '' &&
  block.evidence === '';

/** Every verification / communityReview block in a document, by JSON pointer. */
const blocksIn = (document) => {
  const verification = new Map();
  const review = new Map();
  const walk = (node, pointer) => {
    if (isVerification(node)) {
      verification.set(pointer, node);
      return;
    }
    if (isCommunityReview(node)) {
      review.set(pointer, node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${pointer}/${String(index)}`));
      return;
    }
    if (isObject(node)) {
      for (const [key, value] of Object.entries(node)) walk(value, `${pointer}/${key}`);
    }
  };
  walk(document, '');
  return { verification, review };
};

/**
 * The stand-in every governed block collapses to, so that "did the AUTHOR-owned
 * fields of this document change?" is one string comparison. A field literally
 * holding this exact string would confuse it; nothing in a content schema can,
 * and the alternative - a NUL byte - made this file read as binary to grep.
 */
const GOVERNED_BLOCK = '<verification or communityReview block>';

/** The document with every governed block replaced by a constant. */
const authorFieldsOf = (node) => {
  if (isVerification(node) || isCommunityReview(node)) return GOVERNED_BLOCK;
  if (Array.isArray(node)) return node.map(authorFieldsOf);
  if (isObject(node)) {
    return Object.fromEntries(
      Object.keys(node)
        .sort()
        .map((key) => [key, authorFieldsOf(node[key])]),
    );
  }
  return node;
};

/**
 * WHICH DOCUMENTS THE SEPARATION OF DUTIES GOVERNS, and it is not "every file
 * under content/".
 *
 * ADR-0003 splits authoring a CLAIM from granting its verification. A source
 * register carries no claim: it records where a document was fetched from, what
 * it hashes to, which regions are known stale, and — per ADR-0016 — the live
 * checks a named checker made against it. Both roles legitimately write to it,
 * and the first draft of the per-commit rule below therefore fired 57 times on
 * commit e4f2c89, which granted 54 statuses and, in the same commit, appended
 * the live check and the `upstream` / `bannedFromAnswers` declarations that
 * ADR-0016 makes the checker's own judgement. That is one job done properly.
 *
 * So A0, A1/A2 and A4 are scoped to claim-bearing documents. A3 is not: it
 * refuses a cultural sign-off wherever one appears, because there the cost of
 * missing one is a fabricated review naming a real person.
 *
 * The stated limit, since an exclusion that is not written down reads as
 * coverage: a commit that edits a source register is NOT held to the
 * one-commit-one-job rule. What records who made a live check is the register's
 * own `liveChecks[].checkedBy` field, which is self-attested exactly like a git
 * identity — see the authorship note at the top of this file.
 */
const bearsClaims = (path) => !path.startsWith('content/sources/');

const canonical = (value) => JSON.stringify(value);

assertRecogniserIsLive();

/* -------------------------------------------------------------------------- */
/* Sources: the register, and the cached extraction when we have it            */
/* -------------------------------------------------------------------------- */

const sourceFiles = jsonFilesUnder(SOURCES_DIR);
const sources = new Map();
for (const path of sourceFiles) {
  const manifest = readJson(path);
  if (manifest === null) continue;
  const id = str(manifest.id);
  if (id === null) {
    fail(`${relative(ROOT, path)}: source manifest has no id`);
    continue;
  }
  sources.set(id, { manifest, path });
}

/**
 * SOURCE TEXT. `discover-canada` is Crown copyright and `committed: false`, so
 * the extraction is git-ignored and CI has never seen it. Every text check in
 * gate B — the verbatim n-gram, the contiguity of `source.quote`, the evidence
 * floors — depends on it.
 *
 * That is a real hole and it is reported as one rather than skipped quietly. On
 * a machine with the file present (the verifier's, and any developer who has
 * fetched it) the checks run; in CI they cannot, and the summary says so with a
 * count of how many questions went unchecked rather than printing a tick.
 * `--require-source` turns the absence into a failure, which is what the
 * verifier agent's own runs should use.
 */
const extractions = new Map();
for (const [id, { manifest }] of sources) {
  const name = str(manifest.extractedText);
  if (name === null) continue;
  const file = join(SOURCES_DIR, name);
  if (!existsSync(file)) {
    const message =
      `${id}: the cached extraction ${name} is not present, so the verbatim, quote-contiguity ` +
      `and evidence checks cannot run against it. The file is git-ignored because the source is ` +
      `Crown copyright (committed: false), so this is expected in CI and NOT expected on a ` +
      `verifier's machine. Re-fetch it, or pass --require-source to make this a failure.`;
    if (REQUIRE_SOURCE) fail(message);
    else note(message);
    continue;
  }
  const bytes = readFileSync(file);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const declared = str(manifest.extractedTextSha256);
  if (declared !== null && declared !== sha) {
    fail(
      `${id}: ${name} on disk hashes to ${sha}, and the register declares ` +
        `extractedTextSha256 ${declared}. Every verification granted against the declared hash was ` +
        `granted against different bytes from the ones here. Re-extract, or re-hash the register — ` +
        `but do not verify anything until they agree.`,
    );
    continue;
  }
  const text = bytes.toString('utf8');
  extractions.set(id, { words: words(text), joined: ` ${words(text).join(' ')} ` });
}

const containsRun = (extraction, text) => extraction.joined.includes(` ${words(text).join(' ')} `);

/* -------------------------------------------------------------------------- */
/* ADR-0016 §2 — which row of the table a question is under                    */
/* -------------------------------------------------------------------------- */
/*
 * The disposition belongs to the SOURCE and is read per chapter, because a
 * source with several chapters lives at several URLs and they are revised
 * independently. The live check that governs a question is the most recent one
 * whose `pages[]` names the question's chapter; when no check names it, the
 * question falls to row 1, which is the pre-ADR-0016 behaviour and the safe
 * direction.
 */

const applicableFlags = (manifest, chapter, page) =>
  (manifest.knownStaleness ?? []).filter((flag) => {
    if (!(flag.affects ?? []).some((affected) => str(affected) === chapter)) return false;
    const flagPages = (flag.pages ?? []).flatMap((value) => {
      const parsed = int(value);
      return parsed === null ? [] : [parsed];
    });
    if (str(flag.grain) !== 'pages' || flagPages.length === 0) return true;
    // A page-grain flag on a question with no page cannot be ruled out.
    return page === null || flagPages.includes(page);
  });

const liveChecksForChapter = (manifest, chapter) =>
  (manifest.liveChecks ?? [])
    .filter((check) => (check.pages ?? []).some((page) => str(page.chapter) === chapter))
    .sort((a, b) => String(a.checkedAt).localeCompare(String(b.checkedAt)));

const dispositionFor = (manifest, chapter, flags, banRespected) => {
  const checks = liveChecksForChapter(manifest, chapter);
  if (checks.length === 0) {
    return { row: 1, why: 'no live check in the register names this chapter', check: null };
  }

  // `source-unreachable` is explicitly "no state change": it does not become the
  // disposition, it defers to the last check that decided anything. ADR-0016
  // keeps it separate from `source-withdrawn` for exactly this reason — a DNS
  // failure is not a retraction.
  const trailingUnreachable = [];
  for (let i = checks.length - 1; i >= 0; i -= 1) {
    if (str(checks[i].finding) !== 'source-unreachable') break;
    trailingUnreachable.push(checks[i]);
  }
  const decisive = checks
    .filter((check) => str(check.finding) !== 'source-unreachable')
    .at(-1);

  if (trailingUnreachable.length > 0) {
    note(
      `${str(manifest.id) ?? '?'} / ${chapter}: the last ${String(trailingUnreachable.length)} ` +
        `live check(s) are source-unreachable. ADR-0016 makes that a retry and not a state ` +
        `change, so the disposition falls back to the last decisive check` +
        `${decisive === undefined ? ' — and there is none, so this chapter is on row 1' : ''}. A ` +
        `run of consecutive unreachables is its own signal and ADR-0016 says it needs its own ` +
        `decision; none exists yet, so this is reported and not failed.`,
    );
  }
  if (decisive === undefined) {
    return { row: 1, why: 'every live check for this chapter is source-unreachable', check: null };
  }

  const finding = str(decisive.finding);
  if (finding === 'source-withdrawn') return { row: 3, why: 'source-withdrawn', check: decisive };
  if (finding === 'source-revised') {
    return { row: 1, why: 'the latest live check found the source revised', check: decisive };
  }
  if (finding !== 'source-unrevised') {
    return { row: 1, why: `unrecognised finding ${String(finding)}`, check: decisive };
  }

  // Row 2 additionally requires that EVERY flag over this question's region has
  // declared the source will not revise, and that the question satisfies the
  // banned-answer list that declaration makes mandatory. A flag still saying
  // `unknown` means nobody has established the source is unrevised THERE, and
  // `unknown` is treated exactly as `revises`.
  const undeclared = flags.filter((flag) => str(flag.upstream) !== 'does-not-revise');
  if (undeclared.length > 0) {
    return {
      row: 1,
      why:
        `the live check found the source unrevised, but the staleness flag(s) ` +
        `${undeclared.map((flag) => `"${str(flag.topic) ?? '?'}"`).join(', ')} over this claim ` +
        `declare upstream ${undeclared.map((flag) => str(flag.upstream) ?? 'absent').join(', ')}; ` +
        `absent and "unknown" are treated exactly as "revises"`,
      check: decisive,
    };
  }
  if (!banRespected) {
    return {
      row: 1,
      why:
        'the flags declare does-not-revise but the question does not satisfy their ' +
        'bannedFromAnswers list, so the mitigation row 2 depends on is not in place ' +
        '(the failure itself belongs to tests/unit/contracts/questions-cite-a-cached-source.test.ts)',
      check: decisive,
    };
  }
  return { row: 2, why: 'source-unrevised, and every flag declares does-not-revise', check: decisive };
};

/* -------------------------------------------------------------------------- */
/* Gates B and C, over the working tree                                        */
/* -------------------------------------------------------------------------- */

const WORDLIKE = /[\p{L}\p{N}]/u;
const mentionsTerm = (text, term) => {
  const haystack = text.toLocaleLowerCase();
  const needle = term.trim().toLocaleLowerCase();
  if (needle === '') return false;
  for (let from = 0; ; ) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? '' : haystack.charAt(at - 1);
    const after = haystack.charAt(at + needle.length);
    if (!WORDLIKE.test(before) && !WORDLIKE.test(after)) return true;
    from = at + 1;
  }
};

const questionFiles = jsonFilesUnder(QUESTIONS_DIR);

const tally = {
  questions: 0,
  byStatus: new Map(),
  shipped: 0,
  rows: new Map(),
  verbatimChecked: 0,
  verbatimUnchecked: 0,
  maxVerbatimRun: 0,
  maxVerbatimWhere: '(none)',
  minEvidenceRun: Number.POSITIVE_INFINITY,
  minEvidenceWhere: '(none)',
  unknownEvidenceWords: 0,
  quoteChecked: 0,
};

for (const path of questionFiles) {
  const where = relative(ROOT, path);
  const question = readJson(path);
  if (question === null) continue;
  tally.questions += 1;

  const verification = isObject(question.verification) ? question.verification : null;
  const source = isObject(question.source) ? question.source : null;
  if (verification === null || source === null) {
    fail(`${where}: has no verification or no source block. make validate-content owns the shape; ` +
      `this gate cannot check a claim it cannot find.`);
    continue;
  }

  const status = str(verification.status) ?? '(missing)';
  tally.byStatus.set(status, (tally.byStatus.get(status) ?? 0) + 1);

  const excluded = status === 'rejected' || status === 'quarantined';
  if (!excluded) tally.shipped += 1;

  /* --- B1: a shipped claim is verified ---------------------------------- */
  if (!excluded && status !== 'verified') {
    fail(
      `${where}: status is "${status}" and the question is in the shipped bank. ADR-0003: CI fails ` +
        `if any shipped claim lacks "verified". Only "rejected" and "quarantined" are excluded from ` +
        `the build; "unverified" means no check has run, and a question nobody checked may not ship.`,
    );
  }

  /* --- B5: verified means a quoted passage exists ------------------------ */
  if (status === 'verified') {
    for (const [field, what] of [
      ['evidence', 'the passage that entails the answer'],
      ['model', 'the model that granted the status'],
      ['checkedAt', 'when the check ran'],
    ]) {
      const value = verification[field];
      if (value === null || value === undefined || value === '') {
        fail(
          `${where}: status is "verified" and ${field} is empty — ${what} is missing. A status with ` +
            `no quoted passage is an assertion, and ADR-0003 does not accept assertions. This is ` +
            `the clause the ADR had omitted until it was amended, which is how the port dropped ` +
            `the field with nothing noticing.`,
        );
      }
    }
  }

  /* --- B2: verified for the CURRENT sourceHash --------------------------- */
  const sourceId = str(source.sourceId);
  const entry = sourceId === null ? undefined : sources.get(sourceId);
  const manifest = entry?.manifest;
  const currentHash =
    manifest === undefined
      ? null
      : manifest.extractedText === undefined
        ? str(manifest.sha256)
        : str(manifest.extractedTextSha256);

  if (status === 'verified') {
    const granted = str(verification.sourceHash);
    const cited = str(source.sourceHash);
    if (granted !== null && cited !== null && granted !== cited) {
      fail(
        `${where}: the status was granted for sourceHash ${granted} and the claim cites ${cited}. ` +
          `The two ends of ADR-0003's mechanism disagree, so nothing is verified.`,
      );
    }
    if (granted !== null && currentHash !== null && granted !== currentHash) {
      fail(
        `${where}: the status was granted for sourceHash ${granted} and ${String(sourceId)} now ` +
          `hashes to ${currentHash}. The source moved under this claim; ADR-0003 grants a status ` +
          `FOR a hash, so this one no longer applies. Re-verify, or quarantine.`,
      );
    }
  }

  /* --- B3: four options, three of them distractors ----------------------- */
  const options = Array.isArray(question.options) ? question.options : [];
  const correctIndex = int(question.correctIndex);
  if (options.length !== 4) {
    fail(
      `${where}: has ${String(options.length)} option(s). ADR-0003 and CLAUDE.md require one ` +
        `correct answer and three distractors.`,
    );
  } else if (correctIndex === null || correctIndex < 0 || correctIndex > 3) {
    fail(`${where}: correctIndex is ${JSON.stringify(question.correctIndex)}, which indexes no option.`);
  } else {
    const distractors = options.filter((_, index) => index !== correctIndex);
    const seen = new Set(distractors.map((option) => str(option?.en) ?? ''));
    if (seen.size !== 3 || seen.has('')) {
      fail(
        `${where}: the three distractors are not three distinct non-empty options ` +
          `(${String(seen.size)} distinct). A repeated distractor is a two-option question wearing ` +
          `four.`,
      );
    }
  }

  /* --- B4: EN and FR everywhere ------------------------------------------ */
  const localised = [
    ['prompt', question.prompt],
    ['explanation', question.explanation],
    ...options.map((option, index) => [`options[${String(index)}]`, option]),
  ];
  for (const [field, value] of localised) {
    for (const locale of ['en', 'fr']) {
      const text = isObject(value) ? str(value[locale]) : null;
      if (text === null || text.trim() === '') {
        fail(
          `${where}: ${field}.${locale} is missing or empty. EN and FR ship from the first commit ` +
            `(CLAUDE.md); a monolingual question is half a question.`,
        );
      }
    }
  }

  /* --- B6/B7: the text checks, when the extraction is available ---------- */
  const extraction = sourceId === null ? undefined : extractions.get(sourceId);
  if (extraction === undefined) {
    tally.verbatimUnchecked += 1;
  } else {
    tally.verbatimChecked += 1;

    const quote = str(source.quote);
    if (quote !== null) {
      tally.quoteChecked += 1;
      if (!containsRun(extraction, quote)) {
        fail(
          `${where}: source.quote is not a contiguous passage of ${String(sourceId)}'s cached ` +
            `extraction. ADR-0003 requires it to be, because that is the check that catches a ` +
            `fabricated citation before any verifier runs. Quote: "${quote.slice(0, 120)}"`,
        );
      }
    }

    const evidence = str(verification.evidence);
    if (evidence !== null && evidence !== '') {
      const run = longestSharedRun(extraction.words, evidence);
      if (run < tally.minEvidenceRun) {
        tally.minEvidenceRun = run;
        tally.minEvidenceWhere = where;
      }
      const vocabulary = new Set(extraction.words);
      const unknown = words(evidence).filter((word) => !vocabulary.has(word));
      tally.unknownEvidenceWords += unknown.length;
      if (unknown.length > 0) {
        fail(
          `${where}: verification.evidence contains ${String(unknown.length)} word(s) that do not ` +
            `occur anywhere in ${String(sourceId)}'s extraction — ` +
            `${unknown.slice(0, 6).map((word) => `"${word}"`).join(', ')}. An evidence span is a ` +
            `quotation; a word the source does not contain means it is not one.`,
        );
      }
      if (run < EVIDENCE_RUN_WORDS) {
        fail(
          `${where}: verification.evidence's longest contiguous run from the source is ` +
            `${String(run)} word(s), under the floor of ${String(EVIDENCE_RUN_WORDS)}. The floor is ` +
            `loose because five corpus spans are non-contiguous for layout reasons — a step label ` +
            `split from its sentence, a two-column table read across — but a span that shares no ` +
            `run with the source is not a quotation of it.`,
        );
      }
    }

    for (const field of VERBATIM_FIELDS) {
      const value = question[field];
      if (!isObject(value)) continue;
      for (const locale of ['en', 'fr']) {
        const text = str(value[locale]);
        if (text === null) continue;
        const run = longestSharedRun(extraction.words, text);
        if (run > tally.maxVerbatimRun) {
          tally.maxVerbatimRun = run;
          tally.maxVerbatimWhere = `${where} ${field}.${locale}`;
        }
        if (run >= VERBATIM_RUN_WORDS) {
          fail(
            `${where}: ${field}.${locale} shares a run of ${String(run)} consecutive words with ` +
              `${String(sourceId)}'s text, at or over the threshold of ` +
              `${String(VERBATIM_RUN_WORDS)}. ADR-0003 check 5: the wording must not be verbatim. ` +
              `Paraphrase it. Options are exempt and prose is not — see the header for why.`,
          );
        }
      }
    }
  }

  /* --- Gate C: ADR-0016 §2's table --------------------------------------- */
  if (manifest === undefined) {
    // Which source a question cites, and whether that source exists, is
    // tests/unit/contracts/questions-cite-a-cached-source.test.ts's rule. Not
    // duplicated here; without a manifest there is simply no disposition.
    continue;
  }

  const chapter = str(source.chapter) ?? '';
  const flags = applicableFlags(manifest, chapter, int(source.page));
  const answerText = [
    ...options.flatMap((option) =>
      isObject(option) ? [str(option.en), str(option.fr)] : [],
    ),
    ...(isObject(question.explanation) ? [str(question.explanation.en), str(question.explanation.fr)] : []),
  ].filter((text) => text !== null);
  const banRespected = flags.every((flag) =>
    (flag.bannedFromAnswers ?? []).every(
      (term) => str(term) === null || !answerText.some((text) => mentionsTerm(text, str(term))),
    ),
  );

  const disposition = dispositionFor(manifest, chapter, flags, banRespected);
  tally.rows.set(disposition.row, (tally.rows.get(disposition.row) ?? 0) + 1);

  if (status === 'quarantined') continue; // already where the table wants it

  if (disposition.row === 3) {
    fail(
      `${where}: ${String(sourceId)}'s latest live check for "${chapter}" found the page ` +
        `source-withdrawn. ADR-0016 §2: every question citing a withdrawn document quarantines ` +
        `immediately. Set verification.status to "quarantined" — the verifier owns the next move.`,
    );
  }

  if (disposition.row === 1) {
    // ADR-0003, unchanged: the 180-day clock is on the QUESTION, and it is the
    // volatile items that are re-verified every run. A stable fact from a
    // maintained source does not expire on a calendar.
    const asOf = str(source.asOf);
    const age = asOf === null ? null : ageInDays(asOf);
    if (source.volatile === true && age !== null && age > STALE_AFTER_DAYS) {
      fail(
        `${where}: the claim is volatile, its source.asOf is ${String(age)} days old, and ` +
          `${String(sourceId)} is on ADR-0016 row 1 (${disposition.why}). Row 1's clock is on the ` +
          `question: over ${String(STALE_AFTER_DAYS)} days it quarantines. Re-verify against the ` +
          `live page, or set verification.status to "quarantined".`,
      );
    }
  }

  if (disposition.row === 2) {
    // The clock does not go away; it moved from the question to the source.
    // One fetch per chapter replaces N re-verifications of a page that cannot
    // have changed, and it still fails closed: a stale live check quarantines
    // everything under it.
    const checkedAt = str(disposition.check?.checkedAt);
    const age = checkedAt === null ? null : ageInDays(checkedAt);
    if (age === null) {
      fail(
        `${where}: ${String(sourceId)} is on ADR-0016 row 2 for "${chapter}" and its governing ` +
          `live check has no readable checkedAt. Row 2 rests entirely on that date.`,
      );
    } else if (age > STALE_AFTER_DAYS) {
      fail(
        `${where}: ${String(sourceId)}'s live check for "${chapter}" was ${String(age)} days ago, ` +
          `over ${String(STALE_AFTER_DAYS)}. ADR-0016 §2 row 2 moves the clock from the question to ` +
          `the source: a live check that ages out quarantines the SOURCE, which fails every ` +
          `question citing it — this one and every other from that chapter. The fix is one live ` +
          `check appended to ${String(sourceId)}'s liveChecks[], not N re-verifications.`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Gate A — separation of duties, over git history                             */
/* -------------------------------------------------------------------------- */

const git = (args) =>
  execFileSync('git', ['-C', ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // stderr is captured rather than inherited: several calls below probe for
    // something that may legitimately be absent (a parent commit, a path in a
    // revision) and git's message on the way to a caught exception is noise.
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const history = { commits: 0, documents: 0, grants: 0, reviews: 0, roled: 0, bound: 0, ran: false };

const runHistoryGate = () => {
  try {
    git(['rev-parse', '--git-dir']);
  } catch {
    fail(
      `${ROOT} is not a git repository, so the separation-of-duties gate cannot run. It is the ` +
        `only thing standing between an agent and marking its own work verified, so it is not ` +
        `allowed to pass silently. Pass --no-history if you meant to run gates B and C alone.`,
    );
    return;
  }

  // A shallow clone is the failure mode this gate is most likely to die of
  // quietly: actions/checkout defaults to fetch-depth 1, which is exactly one
  // commit, and every rule below would then be checked against nothing and
  // report green. ci.yml sets fetch-depth: 0 for this reason; this refuses to
  // run if that is ever undone.
  if (SINCE === null && git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    fail(
      `the repository is a shallow clone, so the separation-of-duties gate would inspect only the ` +
        `commits that happen to be present and report green over the ones it cannot see. Set ` +
        `fetch-depth: 0 on actions/checkout, or pass --since <rev> to state the range deliberately.`,
    );
    return;
  }

  const range = SINCE === null ? [] : [`${SINCE}..HEAD`];
  // `--reverse`: oldest first. A4 below is a state machine over "what did the
  // claim look like when its grant was written", and git log's default
  // newest-first order asks that question backwards.
  const commits = git(['log', '--reverse', '--no-merges', '--format=%H', ...range, '--', 'content'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  history.ran = true;
  history.commits = commits.length;

  const blobAt = (rev, path) => {
    try {
      return JSON.parse(git(['show', `${rev}:${path}`]));
    } catch {
      return null;
    }
  };

  const isGovernedPath = (path) => path.endsWith('.json') && !path.startsWith('content/schemas/');

  /* ------------------------------------------------------------------------ */
  /* A4 — a grant is a grant OF something                                      */
  /* ------------------------------------------------------------------------ */
  /*
   * `verification.sourceHash` binds a granted status to the SOURCE. Nothing
   * bound it to the CLAIM, so this sequence used to pass, exit 0, with three
   * properly separated commits and no rule to break:
   *
   *   1. author writes the question with the null form
   *   2. verifier grants "verified"
   *   3. author changes correctIndex 3 -> 0 and rewrites the prompt
   *
   * A1/A2 do not see it because commit 3 does not touch the block. B2 does not
   * see it because the source did not move. The question then ships a wrong
   * answer under a status granted for a different question.
   *
   * The fix needs no new schema field: the bytes a grant was granted against
   * are recoverable from history. For each verification block, remember the
   * document's AUTHOR-OWNED fields as they stood in the commit that last wrote
   * that block, and compare them with the fields as they stand now. The unit is
   * the claim, which is what it should have been.
   *
   * It is deliberately evaluated at HEAD rather than at the offending commit,
   * because unlike A1/A2 this is RECOVERABLE: re-verifying rewrites the block,
   * which re-binds the grant and clears the failure. A permanent historical
   * failure would leave no way back. In the interval the tree is red — exactly
   * as it is red between an author's commit and the verifier's, since B1
   * already fails a shipped claim that is not verified.
   *
   * A rename is reported by diff-tree as a delete plus an add, so the added
   * path is bound to its own new bytes. That does not open a hole: an add whose
   * verification block is already granted is a grant in a commit that also
   * authors that file, which A1/A2 fails.
   */
  const grantState = new Map(); // `${path} ${pointer}` -> { author, sha, subject }
  const latestAuthor = new Map(); // path -> canonical author fields, latest revision seen
  const latestGrants = new Map(); // path -> Map(pointer -> block), latest revision seen
  const stateKey = (path, pointer) => `${path} ${pointer}`;

  const recordRevision = (path, document, sha, subject, rebind) => {
    const blocks = blocksIn(document).verification;
    const author = canonical(authorFieldsOf(document));
    for (const [pointer, block] of blocks) {
      const key = stateKey(path, pointer);
      if (rebind(pointer, block) || !grantState.has(key)) {
        grantState.set(key, { author, sha, subject });
      }
    }
    for (const key of [...grantState.keys()]) {
      if (key.startsWith(`${path} `) && !blocks.has(key.slice(path.length + 1))) grantState.delete(key);
    }
    latestAuthor.set(path, author);
    latestGrants.set(path, blocks);
  };

  const forgetPath = (path) => {
    for (const key of [...grantState.keys()]) if (key.startsWith(`${path} `)) grantState.delete(key);
    latestAuthor.delete(path);
    latestGrants.delete(path);
  };

  // An explicit --since means the grant may have been written before the range
  // starts. Seed from the range's base commit so those grants are bound to the
  // text as it stood there, rather than being silently exempt: an unseeded
  // range would report green over exactly the edit A4 exists to catch.
  if (SINCE !== null) {
    const base = (() => {
      try {
        return git(['rev-parse', '--verify', `${SINCE}^{commit}`]).trim();
      } catch {
        return null;
      }
    })();
    if (base !== null) {
      const paths = git(['ls-tree', '-r', '--name-only', base, '--', 'content'])
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && isGovernedPath(line) && bearsClaims(line));
      for (const path of paths) {
        const document = blobAt(base, path);
        if (document !== null) {
          recordRevision(path, document, base.slice(0, 9), `the base of ${SINCE}`, () => true);
        }
      }
    }
  }

  for (const sha of commits) {
    const parent = (() => {
      try {
        return git(['rev-parse', '--verify', `${sha}^`]).trim();
      } catch {
        return EMPTY_TREE;
      }
    })();

    const changed = git(['diff-tree', '-r', '--no-commit-id', '--name-status', parent, sha, '--', 'content'])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => {
        const [statusCode, ...rest] = line.split('\t');
        return { statusCode: statusCode.charAt(0), path: rest.at(-1) ?? '' };
      })
      .filter(({ path }) => isGovernedPath(path));

    const subject = git(['log', '-1', '--format=%s', sha]).trim();
    const short = sha.slice(0, 9);
    const role = roleOf(git(['log', '-1', '--format=%ae', sha]).trim());
    if (role !== null) history.roled += 1;

    // A1/A2 are collected across the WHOLE COMMIT and judged at the end of it.
    // See "ONE COMMIT may not do both jobs" below.
    const authored = [];
    const granted = [];

    for (const { statusCode, path } of changed) {
      if (statusCode === 'D') {
        forgetPath(path);
        continue;
      }
      const after = blobAt(sha, path);
      if (after === null) continue;
      const before = statusCode === 'A' ? null : blobAt(parent, path);
      history.documents += 1;

      const afterBlocks = blocksIn(after);
      const beforeBlocks = before === null ? { verification: new Map(), review: new Map() } : blocksIn(before);
      history.grants += afterBlocks.verification.size;
      history.reviews += afterBlocks.review.size;

      const authorChanged =
        bearsClaims(path) &&
        (before === null || canonical(authorFieldsOf(before)) !== canonical(authorFieldsOf(after)));
      if (authorChanged) authored.push(path);

      /* --- A0: the rule as ADR-0003 words it, when a role is knowable ---- */
      //
      // Only reachable when scripts/content-roles.json exists. It is strictly
      // stronger than A1/A2 below, because it does not need the commit to have
      // done both jobs at once: an author-role commit that grants a status,
      // alone, in its own commit, fails here and would pass there.
      if (role === 'author' && bearsClaims(path)) {
        for (const [pointer, block] of afterBlocks.verification) {
          const previous = beforeBlocks.verification.get(pointer);
          if (previous !== undefined && canonical(previous) === canonical(block)) continue;
          if (previous === undefined && isNullForm(block)) continue;
          fail(
            `${short} "${subject}" — ${path}${pointer === '' ? '' : ` at ${pointer}`}: this commit ` +
              `is authored by the content-author role and it ` +
              `${previous === undefined ? 'writes' : 'changes'} a verification block (status ` +
              `"${str(block.status) ?? '?'}"). ADR-0003: an author-authored commit may write a ` +
              `verification object only in the null form and may never change one that exists.`,
          );
        }
      }
      if (role === 'verifier' && authorChanged) {
        fail(
          `${short} "${subject}" — ${path}: this commit is authored by the content-verifier role ` +
            `and it changes the document's authored fields. ADR-0003: the verifier writes the ` +
            `verification block and only the verification block; it cannot edit question text.`,
        );
      }

      /* --- collect this document's grants, for the per-commit rule ------- */
      for (const [pointer, block] of bearsClaims(path) ? afterBlocks.verification : []) {
        const previous = beforeBlocks.verification.get(pointer);
        if (previous !== undefined && canonical(previous) === canonical(block)) continue;
        // The one allowance: a new file must carry the block, and the null form
        // is the only shape an author may write it in. That is authoring, not
        // granting, so it does not count as a grant here.
        if (previous === undefined && isNullForm(block)) continue;
        granted.push({ path, pointer, block, previous });
      }

      /* --- A3: no agent grants cultural sign-off ------------------------- */
      for (const [pointer, block] of afterBlocks.review) {
        const previous = beforeBlocks.review.get(pointer);
        const changed_ = previous === undefined || canonical(previous) !== canonical(block);
        if (!changed_) continue;
        const status = str(block.status) ?? '?';
        if (status === 'not-sought') continue;
        fail(
          `${short} "${subject}" — ${path}${pointer === '' ? '' : ` at ${pointer}`}: this commit ` +
            `sets communityReview.status to "${status}"` +
            `${isObject(block) && str(block.reviewer) !== null ? `, naming ${String(block.reviewer)}` : ''}` +
            `. docs/content-review.md §1: no agent may grant cultural sign-off, ever, for any ` +
            `reason — an agent may write "not-sought" and nothing else. This repository cannot tell ` +
            `an agent's commit from a person's: every commit carries one identity and no signature ` +
            `(see the header of this file). So the gate refuses the transition outright rather than ` +
            `guessing, because the cost of guessing wrong is a fabricated review naming a real ` +
            `person at a real organisation. A genuine sign-off needs an identity the committer does ` +
            `not control — see "WHAT WOULD MAKE AUTHORSHIP ESTABLISHABLE", option 3 — and until one ` +
            `exists this record cannot hold one.`,
        );
      }

      // A4's state, after the rules that read the diff.
      if (!bearsClaims(path)) continue;
      recordRevision(path, after, short, subject, (pointer, block) => {
        const previous = beforeBlocks.verification.get(pointer);
        return previous === undefined || canonical(previous) !== canonical(block);
      });
    }

    /* --- A1/A2: ONE COMMIT may not do both jobs ------------------------- */
    //
    // Stated over the COMMIT, not over the document. The rule was previously
    // "within one document", which is right on the case that prompted it — a
    // file arriving with its own grant — and silent on the natural one: with a
    // 57-file bank, an agent's commit touches many files, and rewording qA
    // while flipping qB from the null form to `verified` fired nothing. For qA
    // the block was unchanged; for qB the author fields were unchanged. The
    // property is "did one actor do both jobs", and what carries it is the
    // commit (ADR-0019).
    for (const { path, pointer, block, previous } of granted) {
      const at = pointer === '' ? '' : ` at ${pointer}`;
      const wrote = previous === undefined ? 'writes' : 'changes';
      if (authored.includes(path)) {
        fail(
          `${short} "${subject}" — ${path}${at}: this commit ` +
            `changes the question's own fields AND ${wrote} ` +
            `its verification block (status "${str(block.status) ?? '?'}"). ADR-0003 splits ` +
            `authoring from verifying between two agents with no shared context: an author-authored ` +
            `commit may write a verification object only in the null form and may never change one ` +
            `that exists. One commit doing both jobs is one actor doing both jobs. Split it: the ` +
            `authored text in one commit with the null form, the granted status in another that ` +
            `touches nothing else.`,
        );
        continue;
      }
      if (authored.length === 0) continue;
      fail(
        `${short} "${subject}" — ${path}${at}: this commit ${wrote} a verification block (status ` +
          `"${str(block.status) ?? '?'}") AND authors content in ${String(authored.length)} other ` +
          `file(s) — ${authored.slice(0, 3).join(', ')}${authored.length > 3 ? ', and more' : ''}. ` +
          `The two jobs are in one commit, which is one actor doing both, even though no single ` +
          `file shows it: the file it granted was not edited, and the files it edited were not ` +
          `granted. ADR-0003 splits authoring from verifying between two agents. Split the commit: ` +
          `authored text in one, granted statuses in another that touches nothing else.`,
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* A4, evaluated at HEAD                                                     */
  /* ------------------------------------------------------------------------ */
  for (const [key, record] of grantState) {
    const cut = key.indexOf(' ');
    const path = key.slice(0, cut);
    const pointer = key.slice(cut + 1);
    const block = latestGrants.get(path)?.get(pointer);
    if (block === undefined) continue;
    history.bound += 1;
    if (str(block.status) !== 'verified') continue;
    const now = latestAuthor.get(path);
    if (now === undefined || now === record.author) continue;
    fail(
      `${path}${pointer === '' ? '' : ` at ${pointer}`}: the status "verified" was granted in ` +
        `${record.sha} "${record.subject}", and the claim's own fields have changed since without ` +
        `the verification block being rewritten. verification.sourceHash binds a grant to the ` +
        `SOURCE, and nothing bound it to the CLAIM, so an edit to the prompt, the options or ` +
        `correctIndex inherits a status granted for different text — including an edit that changes ` +
        `which answer is correct. Re-verify against the current wording, or quarantine. This is ` +
        `recoverable: rewriting the block re-binds the grant and clears it.`,
    );
  }
};

if (NO_HISTORY) {
  note(
    '--no-history: the separation-of-duties gate did NOT run. Gates B and C alone cannot tell ' +
      'whether an agent granted its own verification.',
  );
} else {
  runHistoryGate();
}

/* -------------------------------------------------------------------------- */
/* Anti-vacuum floors                                                          */
/* -------------------------------------------------------------------------- */
/*
 * Zero questions must FAIL, not pass. A gate that returns OK over an empty
 * content/questions/ is the state that let the credit gate report green for a
 * whole slice, and it is the single most likely way for this file to become
 * decorative.
 */

if (sources.size === 0) {
  fail(
    `content/sources/ holds no source manifest. Every check here reads one, so an empty register ` +
      `would make this gate pass by having nothing to check.`,
  );
}
if (tally.questions === 0) {
  fail(
    `content/questions/ holds no question. verify-content passing over an empty bank is not ` +
      `evidence of anything, and reporting it as a pass is how a gate becomes decorative.`,
  );
}
if (!NO_HISTORY && history.ran) {
  if (history.commits === 0) {
    fail(
      `the separation-of-duties gate inspected 0 commits touching content/. Either the range is ` +
        `wrong (--since ${String(SINCE)}) or history is not visible here. It cannot pass by ` +
        `finding nothing to look at.`,
    );
  }
  if (history.documents === 0) {
    fail(
      `the separation-of-duties gate inspected ${String(history.commits)} commit(s) and 0 content ` +
        `documents. The rule is about what commits do to documents, so zero documents is zero ` +
        `coverage.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

const statusLine = [...tally.byStatus.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([status, count]) => `${String(count)} ${status}`)
  .join(', ');

const rowNames = {
  1: 'row 1 per-question re-verification, asOf clock',
  2: 'row 2 source-unrevised, liveChecks clock',
  3: 'row 3 source-withdrawn',
};
const rowLine =
  tally.rows.size === 0
    ? '(none — no question resolved to a source)'
    : [...tally.rows.entries()]
        .sort(([a], [b]) => a - b)
        .map(([row, count]) => `${String(count)} on ${rowNames[row] ?? `row ${String(row)}`}`)
        .join('; ');

for (const message of notes) console.log(`verify-content: note: ${message}`);

console.log(
  `verify-content: ${String(tally.questions)} question(s) in ${String(sourceFiles.length)} ` +
    `source register(s) — ${statusLine || 'no statuses'}; ${String(tally.shipped)} shipped, ` +
    `${String(tally.questions - tally.shipped)} excluded from the build.`,
);
console.log(`verify-content: ADR-0016 re-check disposition — ${rowLine}.`);
console.log(
  `verify-content: text checks ran against a cached extraction for ` +
    `${String(tally.verbatimChecked)} question(s); ${String(tally.verbatimUnchecked)} could NOT be ` +
    `checked because the extraction is absent` +
    `${tally.verbatimUnchecked > 0 ? ' (this is the CI case — those questions are unchecked, not passing)' : ''}.`,
);
if (tally.verbatimChecked > 0) {
  console.log(
    `verify-content: longest verbatim run in authored prose ${String(tally.maxVerbatimRun)} word(s) ` +
      `at ${tally.maxVerbatimWhere}, threshold ${String(VERBATIM_RUN_WORDS)}; ` +
      `${String(tally.quoteChecked)} source.quote(s) contiguous in the extraction; shortest ` +
      `evidence run ${
        tally.minEvidenceRun === Number.POSITIVE_INFINITY ? 'n/a' : String(tally.minEvidenceRun)
      } word(s) at ${tally.minEvidenceWhere}, floor ${String(EVIDENCE_RUN_WORDS)}; ` +
      `${String(tally.unknownEvidenceWords)} evidence word(s) absent from the source.`,
  );
}
if (history.ran) {
  console.log(
    `verify-content: separation of duties — ${String(history.commits)} commit(s) touching content/, ` +
      `${String(history.documents)} document revision(s), ${String(history.grants)} verification ` +
      `block(s) and ${String(history.reviews)} communityReview block(s) inspected.`,
  );
  if (Object.keys(ROLE_IDENTITIES).length === 0) {
    console.log(
      `verify-content: NOTE — commit AUTHORSHIP is not established here. ` +
        `${ROLE_IDENTITIES_FILE} does not exist, every commit in this repository carries one ` +
        `identity and no signature, and CLAUDE.md forbids trailers. What is enforced is that no ` +
        `single commit both authors a claim and grants its verification. One agent committing twice ` +
        `is indistinguishable from two agents; read the header of this file for what would change ` +
        `that.`,
    );
  } else {
    console.log(
      `verify-content: role identities loaded from ${ROLE_IDENTITIES_FILE}; ` +
        `${String(history.roled)} of ${String(history.commits)} commit(s) carried a known role and ` +
        `were held to ADR-0003's rule as worded. The rest were held to the one-commit-one-job rule. ` +
        `A git identity is SELF-ATTESTED and proves nothing against a dishonest agent — see the ` +
        `header for the two stronger options.`,
    );
  }
}

if (failures.length > 0) {
  console.error('');
  for (const message of failures) console.error(`verify-content: FAIL: ${message}`);
  console.error('');
  console.error(`verify-content: ${String(failures.length)} failure(s).`);
  process.exit(1);
}

console.log('verify-content: OK.');
