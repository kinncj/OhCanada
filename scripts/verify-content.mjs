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
 *   B. ADR-0003's CI clause, PER CLAIM. A shipped claim must be `verified` for
 *      the CURRENT `sourceHash`, quote a passage the cached extraction actually
 *      contains, carry a non-empty `evidence` when verified, and be worded so it
 *      is not lifted from the source. Where the claim is a question it must also
 *      carry four options and EN and FR throughout.
 *
 *      A CLAIM IS NOT A FILE IN content/questions/. That is what it used to be,
 *      and ADR-0003's second amendment had already said otherwise —
 *      "verification now follows the claim rather than the screen it appears
 *      on". A landmark blurb, a territory acknowledgement and a line of NPC
 *      dialogue carry `common.schema.json#/$defs/factClaim` and state facts
 *      about Canada in exactly the same way; 60 of them shipped past this gate
 *      because this gate walked a directory. `scripts/lib/claims.mjs` finds a
 *      claim by SHAPE, wherever under content/ it lives, and normalises the two
 *      shapes into one record so no check below has to branch per collection.
 *      ADR-0018 and ADR-0019 are the decisions behind that; ADR-0024 is the
 *      reason the summary prints per-collection counts and a floor fails a
 *      collection that goes quiet.
 *
 *   C. ADR-0016 §2's four-row re-check table, and §3's banned terms. Which
 *      clock a claim is under depends on what the source register's
 *      `liveChecks[]` establishes about the source, not on the claim alone;
 *      and where a flag says the publisher will never correct a fact, nothing a
 *      player is told is true may name it. Both rules come from
 *      `scripts/lib/staleness.mjs`, which is the single implementation the
 *      contract test imports too.
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

import {
  CLAIM_COLLECTIONS,
  claimCountFault,
  claimKeys,
  claimsIn,
  collectionOf,
  containsRun,
  DOCUMENT_SCOPE_FIELDS,
  indexText,
  isSchemaDocument,
  longestSharedRun,
  recogniserFaults,
  schemaRegistry,
  unknownWords,
} from './lib/claims.mjs';
import {
  applicableFlags,
  bannedTermFaultsIn,
  dispositionRow,
  STALE_AFTER_DAYS,
} from './lib/staleness.mjs';

/* -------------------------------------------------------------------------- */
/* Constants that are decisions, with the measurement behind each one          */
/* -------------------------------------------------------------------------- */

/*
 * 180 days — the age at which a granted status stops being trusted — is
 * imported from scripts/lib/staleness.mjs with the table that decides which
 * clock it applies to. One number, one rule, one file: ADR-0016's amendment
 * named the duplicate as a boundary defect, and a second copy of the constant
 * here would be the same defect in miniature.
 */

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

/*
 * WHICH TEXT THE THRESHOLD APPLIES TO is `claim.prose`, decided in
 * scripts/lib/claims.mjs: for a question, the prompt and the explanation; for a
 * fact claim, every localised sibling of the block — a dialogue line's `text`, a
 * landmark's `blurb`, a territory acknowledgement's `statement`. Options are
 * exempt for a measured reason recorded there. The list used to live here as
 * `VERBATIM_FIELDS`, and a list of two question field names is precisely what
 * could not describe the surfaces a level and a quest put in front of a player.
 */

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

const HELP = `verify-content — verify every claim in content/ against its cached source (ADR-0003, ADR-0016)

Usage: node scripts/verify-content.mjs [options]

  --root <dir>      run over another tree (fixtures drive the real CLI)
  --since <rev>     only inspect commits after <rev>; default is all history
  --now <iso>       override the clock used by the 180-day rules
  --require-source  fail when a cached extraction is missing rather than
                    reporting which checks it disables
  --collections <a,b>
                    the collections under content/ that MUST yield a factual
                    claim. Default questions,quests,levels. This is an
                    anti-vacuum floor and NOT the scope: every claim under
                    content/ is checked wherever it lives.
  --no-history      skip the git separation-of-duties gate
  --roles <file>    a git-author-email to role map, enabling ADR-0003's rule as
                    worded. Default scripts/content-roles.json, which does not
                    exist; see the header for why that is the honest state.
  -h, --help

Gate A  separation of duties, from git history
        one commit may not both author a claim and grant its verification, in
        the same document; no commit may move communityReview off "not-sought".
        A claim is matched across commits by the id its schema requires, not
        by its position in a list.
        Read the header: authorship itself is NOT establishable in this
        repository, and the header specifies what would make it so.
Gate B  ADR-0003's CI clause, per CLAIM - a question, a line of NPC dialogue, a
        landmark blurb, a territory acknowledgement, wherever under content/ it
        lives - verified for the current sourceHash; four options and EN/FR
        where the claim is a question; non-empty evidence when verified;
        source.quote contiguous in the extraction; wording not lifted from the
        source.
Gate C  ADR-0016 §2's re-check table and §3's banned terms
        which 180-day clock binds — the question's source.asOf or the register's
        liveChecks[].checkedAt — depends on what the register establishes about
        the source; and no option or explanation may name a term the register
        bans under a flag the publisher will never correct.
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

/**
 * The ANTI-VACUUM FLOOR, not the scope of the walk. See the floors at the bottom
 * of this file: gate B checks every claim it finds anywhere under content/, and
 * this list is only the set of collections whose silence is a failure rather
 * than a smaller number. `--collections questions` is what a tree that
 * legitimately holds only questions — every fixture in
 * tests/unit/infra/verify-content-gate.test.ts — says on the command line, so
 * that "this tree has no quests" is a statement somebody made and not an
 * omission nobody saw.
 */
const REQUIRED_COLLECTIONS =
  flagValue('--collections') === null
    ? CLAIM_COLLECTIONS
    : flagValue('--collections')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '');

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

/*
 * `words`, `indexText`, `containsRun`, `longestSharedRun` and `unknownWords`
 * live in scripts/lib/claims.mjs and are imported at the top of this file. They
 * used to live here, in one of TWO implementations of "is this quote a passage
 * of the source" — this one tokenising, and
 * tests/unit/contracts/questions-cite-a-cached-source.test.ts rejoining
 * line-broken hyphens and comparing strings. The two were reconciled by hand
 * once, after two correctly cited economy questions read as fabricated in one
 * gate and contiguous in the other. They agree on every quote in the corpus
 * today — which is what a reconciliation held in place by care looks like right
 * up until it does not. There is now one implementation and both gates import
 * it; see that module's header for which of the two rules survived, why, and the
 * measurement behind it.
 */

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
  const questionPath = join(CONTENT_DIR, 'schemas', 'question.schema.json');
  if (!existsSync(path)) {
    note(
      `content/schemas/common.schema.json is absent, so the recogniser self-test did not run. ` +
        `Gate A's rules are only as wide as isVerification()/isCommunityReview(), and gate B's are ` +
        `only as wide as isFactClaim(); nothing here checked either against the schema that ` +
        `defines the blocks.`,
    );
    return;
  }
  const schema = readJson(path);
  const defs = isObject(schema?.$defs) ? schema.$defs : {};

  // The same three assertions, for the two shapes GATE B is scoped by, from the
  // module that defines them. isFactClaim() decides whether a quest line or a
  // landmark blurb is checked at all, so it is held to exactly what
  // isVerification() is held to and for exactly the reason: a recogniser that
  // quietly narrows turns a corpus into a silent pass.
  const recogniser = recogniserFaults(
    schema,
    existsSync(questionPath) ? readJson(questionPath) : null,
  );
  for (const fault of recogniser.faults) fail(fault);
  for (const message of recogniser.notes) note(message);
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

/* -------------------------------------------------------------------------- */
/* WHAT A CLAIM'S AUTHOR FIELDS ARE — the unit gate A4 binds a grant to        */
/* -------------------------------------------------------------------------- */
/*
 * READ THIS BEFORE CHANGING WHAT VOIDS A GRANT. Everything below is a decision
 * about which bytes a verifier's "verified" is a statement about, and the
 * failure mode of getting it wrong in one direction is silence.
 *
 * A4 used to bind a grant to `authorFieldsOf(document)` — the WHOLE document —
 * while its own comment said "the unit is the claim, which is what it should
 * have been". That is document grain wearing a claim-grain label, and it cost
 * two verifier passes: one commit wrote `territory.nationSource.sourceHash` and
 * `.asOf` into ten level documents, two lines each, and voided every grant in
 * all ten — including thirty point-of-interest blurbs whose prose, quote, page
 * and chapter were byte-identical to what a verifier had checked hours earlier.
 *
 * So: WHICH FIELDS DOES A CLAIM BIND TO? Three answers, and the reason for each.
 *
 * 1. THE UNIT — the author-owned fields of the node the claim's apparatus hangs
 *    off, taken WHOLE.
 *
 *    A verification block sits at `<unit>/<apparatus>/verification`:
 *    `/pois/3/fact/verification`, `/territory/fact/verification`,
 *    `/territory/nationSource/verification`,
 *    `/steps/1/dialogue/0/fact/verification`. Two segments up from the block is
 *    the thing an author wrote as one piece — the point of interest, the
 *    territory acknowledgement, the dialogue line. A question has no such
 *    enclosing node: its apparatus IS the document root, `/verification`, so its
 *    unit is the document, which is what it already was and still is. That is
 *    why this narrowing changes nothing for `content/questions/`.
 *
 *    Taking the unit WHOLE rather than as a list of field names is the
 *    load-bearing decision here. A name list is how a claim-grain A4 fails
 *    SILENTLY AND IN THE DIRECTION OF PASSING: the day a point of interest grows
 *    a `caption`, or a territory grows a second citation, the list stops
 *    covering it and nothing says so. The unit covers a field the moment it
 *    exists. `scripts/lib/claims.mjs` reaches the same conclusion one level down
 *    for the prose — every `localizedText`-shaped SIBLING of the block, never a
 *    fixed list of field names — and that prose is a subset of the unit by
 *    construction, so the gate and the walk cannot drift apart.
 *
 *    WHAT THIS DELIBERATELY OVER-BINDS, since an over-bind that is not written
 *    down reads as a bug: a point of interest's `position`, `artKey` and
 *    `radiusPx`, and a dialogue line's `speaker` and `expression`, are in the
 *    unit and WILL void that one grant if they move. Accepted. Over-binding
 *    costs one re-verification of a claim whose words did not change;
 *    under-binding ships a grant that outlived the words it was granted over,
 *    which is the whole reason A4 exists. The two are not symmetric.
 *
 * 2. THE APPARATUS — `factual`, and every field of `source`: `sourceId`,
 *    `chapter`, `page`, `quote`, `sourceHash`, `asOf`, `volatile`, `url`.
 *
 *    These are inside the unit already, so this is a consequence of (1) and not
 *    a second rule. It is written out because it is the half a reader is most
 *    likely to mistake for the whole rule, and because binding to the `fact`
 *    block ALONE is the obvious wrong answer: it misses the prose the claim
 *    governs, which is the thing the verifier actually read.
 *
 *    `verification` and `communityReview` are NOT author fields anywhere in
 *    here — `authorFieldsOf` collapses both to a constant. They must not be, or
 *    every grant would void itself the instant it was written.
 *
 * 3. THE DOCUMENT SCOPE — root fields whose value the claim's MEANING depends
 *    on, even though they sit outside the unit. These are NAMED, in
 *    `DOCUMENT_SCOPE_FIELDS` in scripts/lib/claims.mjs, each with the reason it
 *    is there — one list, because the gate binds by it and a contract test
 *    proves against the corpus that no name on it has gone dead.
 *
 *    They have to be named, and the reason is the same measurement that made (1)
 *    go the other way: a level root also carries `ground`, `layers`, `camera`,
 *    `theme` and `textureBudgetBytes`, so binding every blurb's grant to
 *    everything at the root would be the document-grain defect back again under
 *    a new name — a collision polygon moving would void thirty verified
 *    sentences. There is no shape that separates `subject` from `order`; only a
 *    reason does. Being named, they can go dead silently, which is what the
 *    second anti-vacuity guard is for.
 *
 *    ASKED AND ANSWERED NO, so the next reader does not have to re-derive it:
 *    a level's or a quest's `id` (renaming the file the claim lives in changes
 *    nothing a verifier read — and the questions' `id` is bound anyway, because
 *    for a question the unit is the document); `order` (presentation); `title`,
 *    `theme`, `size`, `spawn`, `camera`, `ground`, `layers`, `locomotion`,
 *    `assets`, `characters`, `textureBudgetBytes` (art and engineering, none of
 *    which a verifier checks a citation against); a level's `quests` array
 *    (those claims live in `content/quests/` and bind there).
 *
 *    NOT NAMED BECAUSE IT DOES NOT NEED TO BE: `territory.nationSource`. It is
 *    the field that started this, and it binds to the territorial statement for
 *    free, because it is a SIBLING of `/territory/fact` and therefore inside
 *    that claim's unit. It binds to nothing else in the level, which is the
 *    whole point: the territory claims come unbound and the blurbs do not.
 *
 * ANTI-VACUITY (ADR-0024). The failure mode of a NARROWING gate is a field set
 * that is empty: a grant bound to nothing can never be voided and reports green
 * for ever, which is strictly worse than the document-grain rule it replaced.
 * Two guards, because the two ways it can empty out are different:
 *
 *   - PER CLAIM, at HEAD: a bound field set carrying no author-owned leaf FAILS,
 *     loudly. That catches a pointer shape this code does not understand
 *     resolving to nothing.
 *   - PER NAMED SCOPE FIELD: the run prints how many grants each one bound, so a
 *     name that has gone dead — renamed in the schema, dropped from the
 *     documents — is visible in the summary rather than absent from it, and
 *     tests/unit/contracts/a-grant-binds-to-its-claim.test.ts fails if any of
 *     them binds to zero grants in the real corpus. The count lives in the
 *     script and the floor lives in the test, because a fixture tree that
 *     legitimately has no quests would fail a floor stated here.
 */

/** A JSON pointer as its unescaped segments. `''` is the document itself. */
const pointerSegments = (pointer) =>
  pointer === ''
    ? []
    : pointer
        .slice(1)
        .split('/')
        .map((segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));

const atPointer = (document, segments) => {
  let node = document;
  for (const segment of segments) {
    if (Array.isArray(node)) node = node[Number(segment)];
    else if (isObject(node)) node = node[segment];
    else return undefined;
    if (node === undefined) return undefined;
  }
  return node;
};

/**
 * Author-owned leaves in a collapsed field set. A governed block counts zero
 * because it is the verifier's, and `{}` and `[]` count zero because they are
 * nothing — which is exactly the state the ADR-0024 guard is looking for.
 */
const authorLeafCount = (value) => {
  if (value === GOVERNED_BLOCK) return 0;
  if (Array.isArray(value)) return value.reduce((total, item) => total + authorLeafCount(item), 0);
  if (isObject(value)) {
    return Object.values(value).reduce((total, item) => total + authorLeafCount(item), 0);
  }
  return 1;
};

/**
 * The field set the grant at `pointer` is a grant OF. The essay above is the
 * specification; this is six lines of it.
 *
 * `segments.length >= 3` is the test for "the apparatus is enclosed in a unit":
 * `/pois/0/fact/verification` is, `/verification` and `/fact/verification` are
 * not, and in the second case the unit is the document root — which is where
 * the prose sibling lives, so the answer is the same one by another route.
 */
const claimAuthorFieldsAt = (document, pointer) => {
  const segments = pointerSegments(pointer);
  const enclosed = segments.length >= 3;
  const resolved = enclosed ? atPointer(document, segments.slice(0, -2)) : document;
  // A unit that does not resolve, or resolves to something that is not a
  // container, must reach the ADR-0024 guard below as EMPTY and not as `null`:
  // `authorFieldsOf(null)` is a LEAF, so it would count as a bound field, bind
  // to nothing, and report green for ever. That is the silent pass this whole
  // narrowing is most exposed to, and it costs one line to close.
  const unit = isObject(resolved) || Array.isArray(resolved) ? resolved : {};
  const bound = { unit: authorFieldsOf(unit) };
  // Skipped when the unit IS the document: the scope fields are already in it,
  // and counting them twice would report one edit as two.
  if (enclosed && isObject(document)) {
    for (const { key } of DOCUMENT_SCOPE_FIELDS) {
      if (key in document) bound[key] = authorFieldsOf(document[key]);
    }
  }
  return bound;
};

/**
 * Which fields of a bound set moved, as dotted paths, so the failure names the
 * edit instead of making a verifier diff two revisions by hand. A narrowing is
 * only auditable if it says what it caught.
 */
const changedPaths = (before, after, prefix = '', found = []) => {
  if (canonical(before) === canonical(after)) return found;
  if (isObject(before) && isObject(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      changedPaths(before[key], after[key], prefix === '' ? key : `${prefix}.${key}`, found);
    }
    return found;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((item, index) => changedPaths(item, after[index], `${prefix}[${index}]`, found));
    return found;
  }
  found.push(prefix === '' ? '(the whole claim)' : prefix);
  return found;
};

/** `unit` is this module's word for the claim's node, not a field a reader has seen. */
const readablePath = (path) => path.replace(/^unit\./u, '').replace(/^unit$/u, '(the whole claim)');

/* -------------------------------------------------------------------------- */
/* WHICH CLAIM IS WHICH — the identity gate A matches claims by               */
/* -------------------------------------------------------------------------- */
/*
 * The scheme, per claim kind, and the measurement behind each decision are the
 * essay above `claimKeys` in scripts/lib/claims.mjs. In one line: a claim inside
 * a list is known by the `id` its item schema requires, and by its position only
 * where the schema requires none.
 *
 * The working tree's schemas key the claims at HEAD. History keys each revision
 * with the schemas of that revision — see `registryAt` in the history gate —
 * because the identity rule is whatever a document's own `$schema` required
 * when it was written.
 */
const EMPTY_REGISTRY = schemaRegistry([]);
const WORKING_SCHEMAS = schemaRegistry(
  jsonFilesUnder(join(CONTENT_DIR, 'schemas')).flatMap((path) => {
    try {
      return [{ where: relative(ROOT, path).replaceAll('\\', '/'), document: JSON.parse(readFileSync(path, 'utf8')) }];
    } catch {
      // An unparseable schema is make validate-content's failure. Here it simply
      // resolves nothing, and the documents naming it are counted as unkeyed.
      return [];
    }
  }),
);

/** What the working tree's claims are known by, for the summary. ADR-0024: counted, not assumed. */
const identityTally = {
  blocks: 0,
  byId: 0,
  byPath: 0,
  positional: new Map(),
  unresolvedBlocks: 0,
  unresolvedDocuments: [],
};

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
    // How to get it back, from the register rather than from folklore. Before
    // `extraction` existed this note told a contributor to re-fetch a file it
    // could not tell them how to produce: the digest every question is granted
    // against is the digest of the EXTRACTION, and nothing recorded how the
    // extraction was made.
    const extraction = isObject(manifest.extraction) ? manifest.extraction : null;
    const how =
      extraction === null
        ? ` The register records no "extraction" block, so nothing here can tell you how to produce it.`
        : extraction.unrecorded === true
          ? ` The register declares the extraction UNRECORDED: nobody wrote down how it was made, so ` +
            `${name} cannot be reproduced from ${str(manifest.file) ?? 'the document'} by anyone who ` +
            `does not already have it. ${str(extraction.reason) ?? ''} See content/sources/README.md.`
          : ` Re-derive it with \`make sources\` — the register records: ${str(extraction.command) ?? '(no command)'}`;
    const message =
      `${id}: the cached extraction ${name} is not present, so the verbatim, quote-contiguity ` +
      `and evidence checks cannot run against it. The file is git-ignored because the source is ` +
      `Crown copyright (committed: false), so this is expected in CI and NOT expected on a ` +
      `verifier's machine. Re-fetch it, or pass --require-source to make this a failure.${how}`;
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
  extractions.set(id, indexText(bytes.toString('utf8')));
}

/* -------------------------------------------------------------------------- */
/* ADR-0016 §2 and §3 — the row, and the ban, from one shared module            */
/* -------------------------------------------------------------------------- */
/*
 * `applicableFlags`, `dispositionRow` and `bannedTermFaults` live in
 * scripts/lib/staleness.mjs and are imported at the top of this file. They used
 * to live here, in a copy this file and
 * tests/unit/contracts/questions-cite-a-cached-source.test.ts each kept of the
 * same rule; ADR-0016 recorded that as a boundary defect and this is the
 * obligation it carried, discharged.
 *
 * Two things this file still owns, because they are output rather than rule:
 * the note about a run of `source-unreachable` checks (the module returns the
 * count and prints nothing), and every `fail()` below.
 */

/* -------------------------------------------------------------------------- */
/* Gates B and C, over the working tree                                        */
/* -------------------------------------------------------------------------- */

/*
 * THE CORPUS IS EVERY CLAIM IN content/, NOT EVERY FILE IN content/questions/.
 *
 * This loop used to be `for (const path of jsonFilesUnder(content/questions))`, and
 * that one line was the whole of gate B's scope. ADR-0003's second amendment had
 * already said verification follows the CLAIM rather than the screen it appears
 * on, and `content/quests/` and `content/levels/` had been carrying
 * `factClaim` blocks for a slice: 29 dialogue claims and 31 blurbs and territory
 * statements that got the schema's "sourced and verified when factual"
 * conditional and none of the six checks below. The commit that granted the
 * quest bank its statuses says so in its own message — "verify-content walks
 * content/questions and nothing else … they were run by hand this time".
 *
 * ADR-0019: a rule drawn round a container measures the container. So the walk
 * is over every document under content/ that is not a schema, and what makes
 * something a claim is its SHAPE — `scripts/lib/claims.mjs` decides that, once,
 * for this gate and for the contract test. Adding `content/quests` and
 * `content/levels` as two more directory constants would have closed today's
 * hole and left the next collection to find its own way in.
 */

const CLAIM_FIELDS = ['source', 'verification'];

const collections = new Map();
const collectionTally = (name) => {
  const existing = collections.get(name);
  if (existing !== undefined) return existing;
  const fresh = {
    documents: 0,
    claims: 0,
    factual: 0,
    flavour: 0,
    checked: 0,
    unchecked: 0,
    byStatus: new Map(),
  };
  collections.set(name, fresh);
  return fresh;
};

const tally = {
  questions: 0,
  claims: 0,
  byStatus: new Map(),
  shipped: 0,
  rows: new Map(),
  verbatimChecked: 0,
  verbatimUnchecked: 0,
  maxVerbatimRun: 0,
  maxVerbatimWhere: '(none)',
  minEvidenceRun: Number.POSITIVE_INFINITY,
  minEvidenceWhere: '(none)',
  banFaults: 0,
  banClaims: 0,
  banTermChecks: 0,
  unknownEvidenceWords: 0,
  quoteChecked: 0,
};

const claims = [];
for (const path of jsonFilesUnder(CONTENT_DIR)) {
  const where = relative(ROOT, path).replaceAll('\\', '/');
  // The schemas DEFINE the two shapes this gate recognises, so they are the one
  // exclusion. `claims.mjs`'s recogniser self-test proves the type tests refuse
  // them anyway; this keeps the belt on as well as the braces.
  if (isSchemaDocument(where)) continue;
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    fail(`${where}: cannot be read — ${String(error)}`);
    continue;
  }
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    fail(`${where}: is not parseable JSON — ${String(error)}`);
    continue;
  }
  const found = claimsIn(document, where);
  const collection = collectionTally(collectionOf(where));
  collection.documents += 1;
  collection.claims += found.length;
  // ADR-0024, per document: every `"factual"` key in the bytes must have become
  // a recognised claim. The recogniser is what scopes every check below, and a
  // recogniser that quietly stops matching produces a run identical to a clean
  // one. Gate A has already had that failure once.
  const drift = claimCountFault(raw, found, where);
  if (drift !== null) fail(drift);
  claims.push(...found);

  // WHICH CLAIM IS WHICH, at HEAD. Gate A matches claims across revisions by
  // identity, so an identity that is ambiguous HERE is a failure however the
  // history reads: the next commit to grant one of these claims would be judged
  // by a guess. It is recoverable, unlike a per-commit verdict — give the item
  // the id its schema requires.
  if (bearsClaims(where)) {
    const governed = blocksIn(document);
    const pointers = [...governed.verification.keys(), ...governed.review.keys()];
    if (pointers.length > 0) {
      const identity = claimKeys(document, where, pointers, WORKING_SCHEMAS);
      for (const fault of identity.faults) fail(fault);
      for (const message of identity.drift) fail(message);
      if (!identity.resolved && pointers.some((pointer) => identity.positional.has(pointer))) {
        identityTally.unresolvedDocuments.push(where);
      }
      for (const pointer of pointers) {
        identityTally.blocks += 1;
        const through = identity.positional.get(pointer);
        if (through !== undefined && !identity.resolved) {
          identityTally.unresolvedBlocks += 1;
        } else if (through !== undefined) {
          const label = through.at(-1) ?? '?';
          identityTally.positional.set(label, (identityTally.positional.get(label) ?? 0) + 1);
        } else if ((identity.keys.get(pointer) ?? pointer) !== pointer) {
          identityTally.byId += 1;
        } else {
          identityTally.byPath += 1;
        }
      }
    }
  }
}
if (identityTally.unresolvedDocuments.length > 0) {
  note(
    `claim identity: ${String(identityTally.unresolvedDocuments.length)} document(s) carrying claims ` +
      `inside a list name a $schema that does not resolve in content/schemas/ here — ` +
      `${identityTally.unresolvedDocuments.slice(0, 3).join(', ')}` +
      `${identityTally.unresolvedDocuments.length > 3 ? ', and more' : ''} — so gate A keys those claims ` +
      `by POSITION, and an insertion ahead of one reads as rewriting its grant. Identity is read from what ` +
      `a schema requires; with no schema there is nothing to read.`,
  );
}

for (const claim of claims) {
  const where = claim.at;
  const collection = collectionTally(claim.collection);
  if (claim.kind === 'question') tally.questions += 1;

  /* --- A claim the author says states no fact is not verified ------------ */
  //
  // `factual: false` is the author's recorded judgement that a line is a
  // greeting, an instruction or flavour. ADR-0003 makes it a required field for
  // exactly this reason — a greeting and a claim look identical to a machine —
  // and the schema already forbids it carrying a source. Counted rather than
  // skipped silently, so the split between checked prose and exempt prose is
  // visible in the summary.
  if (!claim.factual) {
    collection.flavour += 1;
    continue;
  }
  tally.claims += 1;
  collection.factual += 1;

  const verification = claim.verification;
  const source = claim.source;
  if (verification === null || source === null) {
    const missing = CLAIM_FIELDS.filter((field) => claim[field] === null).join(' and no ');
    fail(
      `${where}: states a fact and has no ${missing} block. make validate-content owns the shape; ` +
        `this gate cannot check a claim it cannot find.`,
    );
    continue;
  }

  if (claim.prose.length === 0) {
    fail(
      `${where}: states a fact and there is no localised text beside it for the claim to be ABOUT. ` +
        `A factClaim governs the sibling prose a player reads; with none, either the recogniser has ` +
        `matched something that is not a claim, or a sentence has been verified that is not there.`,
    );
  }

  const status = str(verification.status) ?? '(missing)';
  tally.byStatus.set(status, (tally.byStatus.get(status) ?? 0) + 1);
  collection.byStatus.set(status, (collection.byStatus.get(status) ?? 0) + 1);

  const excluded = status === 'rejected' || status === 'quarantined';
  if (!excluded) tally.shipped += 1;

  /* --- B1: a shipped claim is verified ---------------------------------- */
  if (!excluded && status !== 'verified') {
    fail(
      claim.kind === 'question'
        ? `${where}: status is "${status}" and the question is in the shipped bank. ADR-0003: CI ` +
            `fails if any shipped claim lacks "verified". Only "rejected" and "quarantined" are ` +
            `excluded from the build; "unverified" means no check has run, and a question nobody ` +
            `checked may not ship.`
        : `${where}: status is "${status}" and this sentence ships — a player reads it on the ` +
            `level. ADR-0003: CI fails if any shipped claim lacks "verified", and its scope is the ` +
            `claim rather than the screen it appears on, so a landmark blurb and a line of dialogue ` +
            `are held exactly as a question is. "unverified" means no check has run. The verifier ` +
            `owns the next move; this gate does not write verification blocks.`,
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

  /* --- B3/B4: the two rules that are about a QUESTION and not a claim ----- */
  //
  // Four options with three distinct distractors, and both languages on every
  // one of them. These are scoped to the question shape because that is the
  // shape they are about: a dialogue line has no distractors to count, and its
  // French is held by `localizedText` requiring both locales on the file. That
  // is a scope drawn round a SHAPE, not round a directory — a question in some
  // other collection would still be held to both.
  if (claim.kind === 'question') {
    const question = claim.document;

    /* --- B3: four options, three of them distractors --------------------- */
    const options = Array.isArray(question.options) ? question.options : [];
    const correctIndex = int(question.correctIndex);
    if (options.length !== 4) {
      fail(
        `${where}: has ${String(options.length)} option(s). ADR-0003 and CLAUDE.md require one ` +
          `correct answer and three distractors.`,
      );
    } else if (correctIndex === null || correctIndex < 0 || correctIndex > 3) {
      fail(
        `${where}: correctIndex is ${JSON.stringify(question.correctIndex)}, which indexes no option.`,
      );
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

    /* --- B4: EN and FR everywhere ---------------------------------------- */
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
  }

  /* --- B6/B7: the text checks, when the extraction is available ---------- */
  const extraction = sourceId === null ? undefined : extractions.get(sourceId);
  if (extraction === undefined) {
    tally.verbatimUnchecked += 1;
    collection.unchecked += 1;
  } else {
    tally.verbatimChecked += 1;
    collection.checked += 1;

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
      const run = longestSharedRun(extraction, evidence);
      if (run < tally.minEvidenceRun) {
        tally.minEvidenceRun = run;
        tally.minEvidenceWhere = where;
      }
      const unknown = unknownWords(extraction, evidence);
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

    /* --- B8: the author's own prose is not lifted from the source --------- */
    //
    // `claim.prose` is what the author WROTE, whichever surface it is on: a
    // question's prompt and explanation, a dialogue line's `text`, a landmark's
    // `blurb`, a territory acknowledgement's `statement`. Options are exempt and
    // the reason is measured — see scripts/lib/claims.mjs's `questionClaim`.
    for (const { field, locale, text } of claim.prose) {
      const run = longestSharedRun(extraction, text);
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

  /* --- Gate C: ADR-0016 §2's table --------------------------------------- */
  if (manifest === undefined) {
    // Which source a question cites, and whether that source exists, is
    // tests/unit/contracts/questions-cite-a-cached-source.test.ts's rule. Not
    // duplicated here; without a manifest there is simply no disposition.
    continue;
  }

  const chapter = str(source.chapter) ?? '';
  const flags = applicableFlags(manifest, chapter, int(source.page));

  /* --- C0: ADR-0016 §3, no answer depends on a fact nobody will correct ---- */
  //
  // THIS FAILS THE RUN, and from the day ADR-0016 §3 landed (2026-09-08) until
  // 2026-09-09 it did not.
  // The ban used to reach this gate only as an input to the row: violating one
  // demoted the question from row 2 to row 1, and row 1 fails only a claim that
  // is `volatile` with an `asOf` past 180 days. So a banned term could be
  // injected into a shipped option — "It is a member of the G8." into an economy
  // question on a page the G8 flag covers — and `verify-content` stayed green,
  // with the row tally as the only visible effect. The rule was enforced, but
  // only by the contract test, so the two commands the content guidelines name
  // agreed that a wrong fact was fine.
  //
  // It is checked for EVERY claim, not only the shipped ones. A banned term
  // is a defect in the answer, and `rejected` or `quarantined` is where a
  // defective answer waits to be fixed, not a licence for it — which is also
  // exactly what the contract gate does over the same corpus. Nothing here may
  // be weaker than the file it was extracted from.
  //
  // `claim.asserted` is what a player is told is TRUE. For a question that is
  // its options and explanation and deliberately not its prompt, which may name
  // a stale topic without asserting a stale value. A blurb has no such
  // separation — every word of it is the assertion — so the claim record carries
  // the texts and the surface to name them by, and §3 reads them the same way
  // for both.
  const bannedHere = flags.flatMap((flag) => flag.bannedFromAnswers ?? []);
  if (bannedHere.length > 0) {
    tally.banClaims += 1;
    tally.banTermChecks += bannedHere.length;
  }
  const banFaults = bannedTermFaultsIn(
    claim.asserted,
    String(sourceId),
    flags,
    where,
    claim.surface,
  );
  for (const fault of banFaults) fail(fault);
  tally.banFaults += banFaults.length;

  const disposition = dispositionRow(manifest, chapter, flags, banFaults.length === 0);
  if (disposition.unreachableTail > 0) {
    note(
      `${String(sourceId)} / ${chapter}: the last ${String(disposition.unreachableTail)} ` +
        `live check(s) are source-unreachable. ADR-0016 makes that a retry and not a state ` +
        `change, so the disposition falls back to the last decisive check` +
        `${disposition.check === null ? ' — and there is none, so this chapter is on row 1' : ''}. A ` +
        `run of consecutive unreachables is its own signal and ADR-0016 says it needs its own ` +
        `decision; none exists yet, so this is reported and not failed.`,
    );
  }
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

const history = {
  commits: 0,
  documents: 0,
  grants: 0,
  reviews: 0,
  roled: 0,
  bound: 0,
  rekeyed: 0,
  ran: false,
};

/**
 * How many grants each NAMED document-scope binding actually bound, counted at
 * HEAD. ADR-0024's second guard: a name that has gone dead — renamed in a schema,
 * dropped from the documents — voids nothing and would otherwise be invisible.
 * The count is printed here; the floor that makes zero a failure lives in
 * tests/unit/contracts/a-grant-binds-to-its-claim.test.ts, because a fixture tree
 * with no quests in it legitimately binds `levelId` zero times.
 */
const scopeBinds = new Map(DOCUMENT_SCOPE_FIELDS.map(({ key }) => [key, 0]));

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
   * are recoverable from history. For each verification block, remember THAT
   * CLAIM'S AUTHOR-OWNED fields as they stood in the commit that last wrote the
   * block, and compare them with the same fields as they stand now.
   *
   * THE UNIT IS THE CLAIM, and for six months it was not — this comment said
   * "claim" while `recordRevision` stored `authorFieldsOf(document)`. See the
   * essay above `DOCUMENT_SCOPE_FIELDS` for which fields a claim's are and why;
   * `claimAuthorFieldsAt()` is the whole of the answer. Editing one blurb now
   * voids that blurb's grant and no other grant in the file.
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
  /*
   * WHICH CLAIM IS WHICH, BETWEEN TWO REVISIONS. Every rule in this gate compares
   * a document with its parent, and matches a claim across the two by its
   * IDENTITY KEY — `/pois[id=cn-tower]/fact/verification`, not
   * `/pois/0/fact/verification`. The scheme per claim kind, and why, is the essay
   * above `claimKeys` in scripts/lib/claims.mjs.
   *
   * It used to be the JSON pointer, and an array index is a position. Inserting
   * two landmarks ahead of the CN Tower made the commit that added them read as
   * rewriting the tower's grant — a per-commit A1/A2 failure no later grant can
   * clear — and the same shift re-recorded the moved beef cattle's grant as a
   * fresh grant in its new slot, bound to the moved fields, so A4 never said a
   * word. The grant followed a slot rather than the claim it was made on.
   *
   * Keys are made with the schemas OF THE REVISION being read, and both sides of
   * one commit are keyed with that commit's schemas, so one comparison never
   * mixes two identity rules. A4's state outlives a commit, so where the rule
   * changes under a document between two of its revisions, `rekeyState` carries
   * the state across by pointer — the one correspondence that holds inside a
   * single revision.
   */
  const schemaRegistries = new Map(); // content/schemas tree id -> registry
  const schemaBlobs = new Map(); // blob id -> parsed schema, or null
  const registryAt = (rev) => {
    let tree;
    try {
      tree = git(['rev-parse', '--verify', '--quiet', `${rev}:content/schemas`]).trim();
    } catch {
      return EMPTY_REGISTRY;
    }
    const cached = schemaRegistries.get(tree);
    if (cached !== undefined) return cached;
    const entries = git(['ls-tree', '-r', tree])
      .split('\n')
      .filter((line) => line.trim() !== '')
      .flatMap((line) => {
        const [meta = '', name = ''] = line.split('\t');
        const [, type, oid = ''] = meta.split(' ');
        if (type !== 'blob' || !name.endsWith('.json')) return [];
        if (!schemaBlobs.has(oid)) {
          try {
            schemaBlobs.set(oid, JSON.parse(git(['cat-file', 'blob', oid])));
          } catch {
            schemaBlobs.set(oid, null);
          }
        }
        return [{ where: `content/schemas/${name}`, document: schemaBlobs.get(oid) }];
      });
    const registry = schemaRegistry(entries);
    schemaRegistries.set(tree, registry);
    return registry;
  };

  /** A document's governed blocks, keyed by claim identity, each remembering its pointer. */
  const keyedBlocks = (document, path, registry) => {
    const { verification, review } = blocksIn(document);
    const identity = claimKeys(document, path, [...verification.keys(), ...review.keys()], registry);
    const byKey = (blocks) =>
      new Map(
        [...blocks].map(([pointer, block]) => [identity.keys.get(pointer) ?? pointer, { pointer, block }]),
      );
    return { verification: byKey(verification), review: byKey(review), identity };
  };
  const NO_BLOCKS = {
    verification: new Map(),
    review: new Map(),
    identity: { keys: new Map(), faults: [], ambiguous: new Map(), positional: new Map(), drift: [], resolved: false },
  };

  const grantState = new Map(); // `${path} ${key}` -> { bound, sha, subject }
  const latestAuthor = new Map(); // `${path} ${key}` -> that claim's bound fields, latest seen
  const latestGrants = new Map(); // path -> Map(key -> { pointer, block }), latest revision seen
  const keyRule = new Map(); // path -> the schema registry its state was last keyed with
  const stateKey = (path, key) => `${path} ${key}`;

  // PER CLAIM, and per claim IDENTITY rather than per pointer. The bound field
  // set is a property of the claim, so two grants in one document hold two
  // different sets and one of them moving says nothing about the other; and a
  // claim that changes position keeps its own state instead of inheriting the
  // state of whichever claim sat in that slot before.
  const recordRevision = (path, document, keyed, registry, sha, subject, rebind) => {
    for (const [key, { pointer, block }] of keyed.verification) {
      const state = stateKey(path, key);
      const bound = claimAuthorFieldsAt(document, pointer);
      if (rebind(key, block) || !grantState.has(state)) {
        grantState.set(state, { bound, sha, subject });
      }
      latestAuthor.set(state, bound);
    }
    for (const state of [...grantState.keys()]) {
      if (state.startsWith(`${path} `) && !keyed.verification.has(state.slice(path.length + 1))) {
        grantState.delete(state);
        latestAuthor.delete(state);
      }
    }
    latestGrants.set(path, keyed.verification);
    keyRule.set(path, registry);
  };

  // A schema change can change a claim's key without touching the claim: a list
  // whose items start requiring an id goes from `/pois/0` to `/pois[id=x]`.
  // Without this, every grant in the document would read as new at its next
  // revision and be re-recorded against whatever its fields are by then — A4's
  // silent pass, by a third route. `before` is the last revision recorded for
  // the path, so its pointers are the correspondence between the two rules.
  const rekeyState = (path, before, registry) => {
    const previous = keyRule.get(path);
    if (previous === undefined || previous === registry) return;
    const pointers = [...blocksIn(before).verification.keys()];
    const from = claimKeys(before, path, pointers, previous).keys;
    const to = claimKeys(before, path, pointers, registry).keys;
    const moves = pointers.flatMap((pointer) => {
      const was = from.get(pointer);
      const is = to.get(pointer);
      return was === undefined || is === undefined || was === is
        ? []
        : [[stateKey(path, was), stateKey(path, is)]];
    });
    const carried = moves.map(([was, is]) => [is, grantState.get(was), latestAuthor.get(was)]);
    for (const [was] of moves) {
      grantState.delete(was);
      latestAuthor.delete(was);
    }
    for (const [is, state, author] of carried) {
      if (state !== undefined) grantState.set(is, state);
      if (author !== undefined) latestAuthor.set(is, author);
    }
    history.rekeyed += moves.length;
    keyRule.set(path, registry);
  };

  const forgetPath = (path) => {
    for (const state of [...grantState.keys()]) {
      if (state.startsWith(`${path} `)) {
        grantState.delete(state);
        latestAuthor.delete(state);
      }
    }
    latestGrants.delete(path);
    keyRule.delete(path);
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
          const registry = registryAt(base);
          recordRevision(
            path,
            document,
            keyedBlocks(document, path, registry),
            registry,
            base.slice(0, 9),
            `the base of ${SINCE}`,
            () => true,
          );
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
    // One identity rule per commit: both sides of every comparison below are
    // keyed with the schemas this commit carries.
    const registry = registryAt(sha);
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

      const afterKeyed = keyedBlocks(after, path, registry);
      const beforeKeyed = before === null ? NO_BLOCKS : keyedBlocks(before, path, registry);
      history.grants += afterKeyed.verification.size;
      history.reviews += afterKeyed.review.size;

      /* --- ADR-0024: a grant on a claim that has no identity ------------- */
      //
      // Duplicate or missing required ids leave the claims inside them with no
      // identity, and every rule below matches claims by identity. Where a grant
      // sits on one of them, in this revision or in its parent, a verdict here
      // depends on an identity that does not exist, so the commit fails rather
      // than being judged by a guess. Where none does — an ambiguity among
      // null-form claims, fixed before anything was granted — there is no verdict
      // to get wrong, and the working-tree check is what stops it shipping.
      if (bearsClaims(path) && afterKeyed.identity.faults.length > 0) {
        const carriesGrant = (entry) =>
          entry !== undefined &&
          !(isVerification(entry.block) && isNullForm(entry.block)) &&
          !(isCommunityReview(entry.block) && str(entry.block.status) === 'not-sought');
        const decides = [...afterKeyed.identity.ambiguous].some(
          ([key, wouldBe]) =>
            carriesGrant(afterKeyed.verification.get(key) ?? afterKeyed.review.get(key)) ||
            (wouldBe !== null &&
              carriesGrant(beforeKeyed.verification.get(wouldBe) ?? beforeKeyed.review.get(wouldBe))),
        );
        if (decides) {
          for (const fault of afterKeyed.identity.faults) {
            fail(
              `${short} "${subject}" — ${fault} A grant sits on one of those claims in this commit or ` +
                `its parent, so whether this commit granted it, and what the grant is bound to, both ` +
                `depend on an identity the claim does not have.`,
            );
          }
        }
      }

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
        for (const [key, { block }] of afterKeyed.verification) {
          // A claim with no identity is judged by the ADR-0024 rule above, which
          // says why; "writes a verification block" about a key made up to tell
          // two duplicates apart would be a second finding and a wrong one.
          if (afterKeyed.identity.ambiguous.has(key)) continue;
          const previous = beforeKeyed.verification.get(key)?.block;
          if (previous !== undefined && canonical(previous) === canonical(block)) continue;
          if (previous === undefined && isNullForm(block)) continue;
          fail(
            `${short} "${subject}" — ${path}${key === '' ? '' : ` at ${key}`}: this commit ` +
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
      const grantedHere = [];
      for (const [key, { pointer, block }] of bearsClaims(path) ? afterKeyed.verification : []) {
        // No identity, no per-claim verdict: the ADR-0024 rule above owns it.
        if (afterKeyed.identity.ambiguous.has(key)) continue;
        const previous = beforeKeyed.verification.get(key)?.block;
        if (previous !== undefined && canonical(previous) === canonical(block)) continue;
        // The one allowance: a new claim must carry the block, and the null form
        // is the only shape an author may write it in. That is authoring, not
        // granting, so it does not count as a grant here.
        if (previous === undefined && isNullForm(block)) continue;
        grantedHere.push({
          path,
          key,
          block,
          previous,
          positional: afterKeyed.identity.positional.get(pointer) ?? [],
        });
      }
      granted.push(...grantedHere);

      /* --- say why, where identity and position disagree ----------------- */
      //
      // A change to how claims are matched is only auditable if the run says
      // what it matched. Where a claim changed position, or where matching by
      // pointer would have attributed a different number of grants to this
      // commit than matching by identity does, the claims are named with both
      // counts — so a verdict that changed because of identity reads as a
      // reason, not as a rule that quietly stopped firing.
      if (bearsClaims(path) && before !== null) {
        const beforeAt = new Map(
          [...beforeKeyed.verification.values()].map(({ pointer, block }) => [pointer, block]),
        );
        const byPosition = [...afterKeyed.verification.values()].filter(({ pointer, block }) => {
          const previous = beforeAt.get(pointer);
          if (previous !== undefined && canonical(previous) === canonical(block)) return false;
          return !(previous === undefined && isNullForm(block));
        }).length;
        const moves = [...afterKeyed.verification].flatMap(([key, { pointer, block }]) => {
          const was = beforeKeyed.verification.get(key);
          if (was === undefined || was.pointer === pointer) return [];
          const status = isNullForm(block) ? 'null form' : `status "${str(block.status) ?? '?'}"`;
          const same = canonical(was.block) === canonical(block) ? 'block unchanged' : 'block changed';
          return [
            {
              text: `${key} (${was.pointer} -> ${pointer}, ${status}, ${same})`,
              atStake: !(isNullForm(block) && isNullForm(was.block)),
            },
          ];
        });
        const moved = moves.map((move) => move.text);
        // Only where something was at stake. Null-form claims shifting behind a
        // new one change no verdict, and naming them would bury the notes that do.
        if (moves.some((move) => move.atStake) || byPosition !== grantedHere.length) {
          const arrived = [...afterKeyed.verification].flatMap(([key, { block }]) =>
            beforeKeyed.verification.has(key) || afterKeyed.identity.ambiguous.has(key)
              ? []
              : [`${key} (${isNullForm(block) ? 'null form, no grant' : `status "${str(block.status) ?? '?'}"`})`],
          );
          const left = [...beforeKeyed.verification.keys()].filter((key) => !afterKeyed.verification.has(key));
          const listed = (items) =>
            items.length === 0 ? '' : `: ${items.slice(0, 6).join('; ')}${items.length > 6 ? '; and more' : ''}`;
          note(
            `${short} "${subject}" — ${path}: claims are matched across this commit by identity, not by ` +
              `position. ${String(moved.length)} changed position${listed(moved)}. ` +
              `${String(arrived.length)} arrived${listed(arrived)}. ${String(left.length)} left${listed(left)}. ` +
              `Matched by position, this commit would have written or changed ${String(byPosition)} ` +
              `verification block(s) here; matched by identity it wrote or changed ` +
              `${String(grantedHere.length)}.`,
          );
        }
      }

      /* --- A3: no agent grants cultural sign-off ------------------------- */
      for (const [key, { block }] of afterKeyed.review) {
        const previous = beforeKeyed.review.get(key)?.block;
        const changed_ = previous === undefined || canonical(previous) !== canonical(block);
        if (!changed_) continue;
        const status = str(block.status) ?? '?';
        if (status === 'not-sought') continue;
        fail(
          `${short} "${subject}" — ${path}${key === '' ? '' : ` at ${key}`}: this commit ` +
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
      if (before !== null) rekeyState(path, before, registry);
      recordRevision(path, after, afterKeyed, registry, short, subject, (key, block) => {
        const previous = beforeKeyed.verification.get(key)?.block;
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
    for (const { path, key, block, previous, positional } of granted) {
      const at = key === '' ? '' : ` at ${key}`;
      const wrote = previous === undefined ? 'writes' : 'changes';
      // The one shape identity cannot rescue, said where it fires so nobody
      // "fixes" it by splitting a commit that did nothing wrong.
      const byPosition =
        positional.length === 0
          ? ''
          : ` This claim is matched by POSITION inside ${[...new Set(positional)].join(', ')}, which ` +
            `requires no id (scripts/lib/claims.mjs, "Which claim is which"). An item inserted, removed ` +
            `or reordered ahead of it in this commit reads exactly like this; if that is what happened, ` +
            `the finding is about position rather than duties, and the durable remedy is an id on that ` +
            `schema.`;
      if (authored.includes(path)) {
        fail(
          `${short} "${subject}" — ${path}${at}: this commit ` +
            `changes the question's own fields AND ${wrote} ` +
            `its verification block (status "${str(block.status) ?? '?'}"). ADR-0003 splits ` +
            `authoring from verifying between two agents with no shared context: an author-authored ` +
            `commit may write a verification object only in the null form and may never change one ` +
            `that exists. One commit doing both jobs is one actor doing both jobs. Split it: the ` +
            `authored text in one commit with the null form, the granted status in another that ` +
            `touches nothing else.${byPosition}`,
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
          `authored text in one, granted statuses in another that touches nothing else.${byPosition}`,
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* A4, evaluated at HEAD                                                     */
  /* ------------------------------------------------------------------------ */
  for (const [state, record] of grantState) {
    const cut = state.indexOf(' ');
    const path = state.slice(0, cut);
    const key = state.slice(cut + 1);
    const entry = latestGrants.get(path)?.get(key);
    if (entry === undefined) continue;
    const { pointer, block } = entry;
    const at = key === '' ? '' : ` at ${key}`;
    const now = latestAuthor.get(state);
    if (now === undefined) continue;
    history.bound += 1;

    /* --- ADR-0024: a grant bound to nothing can never be voided ---------- */
    //
    // The vacuity shape a NARROWING is exposed to, and the reason this is a
    // failure rather than a `continue`: every check below is a comparison
    // between two field sets, so an empty one compares equal for ever and this
    // gate reports green over a claim it has stopped binding. Silent, and in the
    // direction of passing — which is worse than the document-grain rule this
    // replaced, because that one at least over-fired.
    // The UNIT, not the whole bound set: a document-scope field such as
    // `subject` would keep the set non-empty while the claim's OWN words and
    // citation bound to nothing, which is the hazard, dressed as coverage.
    if (authorLeafCount(now.unit) === 0) {
      fail(
        `${path}${at}: this verification block binds to NO author-owned field of its own claim, ` +
          `so nothing an author could write to that claim would ever void the grant. A4 binds a ` +
          `grant to the claim's UNIT — the node the block hangs off, carrying its prose and its ` +
          `source — plus the document-scope fields ` +
          `${DOCUMENT_SCOPE_FIELDS.map(({ key: field }) => field).join(' and ')}; here the unit is ` +
          `empty, and a document-scope field alone is not a claim. Either the block sits at a ` +
          `pointer shape claimAuthorFieldsAt() does not understand, or it is attached to a node ` +
          `with no authored content. ADR-0024: an empty field set is a failure and not a pass, ` +
          `because a grant that can never be voided reports green for ever — which is worse than ` +
          `the document-grain rule this replaced, since that one at least over-fired.`,
      );
      continue;
    }
    for (const { key: field } of DOCUMENT_SCOPE_FIELDS) {
      if (field in now) scopeBinds.set(field, (scopeBinds.get(field) ?? 0) + 1);
    }

    if (str(block.status) !== 'verified') continue;
    if (canonical(now) === canonical(record.bound)) continue;
    const moved = changedPaths(record.bound, now).map(readablePath);
    fail(
      `${path}${at}: the status "verified" was granted in ` +
        `${record.sha} "${record.subject}", and the claim's own fields have changed since without ` +
        `the verification block being rewritten — ${String(moved.length)} field(s): ` +
        `${moved.slice(0, 6).join(', ')}${moved.length > 6 ? ', and more' : ''}. ` +
        `verification.sourceHash binds a grant to the SOURCE, and nothing bound it to the CLAIM, ` +
        `so an edit to the prose, the citation, the options or correctIndex inherits a status ` +
        `granted for different text — including an edit that changes which answer is correct. ` +
        `What a grant is bound to is THIS claim's own fields and no other claim's: an edit ` +
        `elsewhere in this document does not appear here, and the fields named above are the ones ` +
        `that moved. The claim is matched across revisions by its identity` +
        `${pointer === key ? '' : ` (in the file today at ${pointer})`}, so a claim that moved within ` +
        `its list is judged on its own fields and never on whichever claim now sits in its old slot. ` +
        `Re-verify against the current wording, or quarantine. This is recoverable: ` +
        `rewriting the block re-binds the grant and clears it.`,
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

/*
 * THE SAME FLOOR, PER COLLECTION. ADR-0024.
 *
 * The walk above is scoped by the shape of a claim, so a collection that
 * disappears, gets renamed, or stops carrying `factClaim` blocks produces output
 * IDENTICAL to one that was checked and was clean — the summary's counts go down
 * and nothing fails. That is the exact defect this whole task was raised to fix,
 * reintroduced one level up: gate B did not fail over `content/quests/`, it
 * simply never looked there.
 *
 * So the three collections that carry claims today are named ONCE, in
 * scripts/lib/claims.mjs, and each must yield at least one FACTUAL claim. The
 * list is a floor and not a scope: a fourth collection is walked and checked
 * without appearing here, and the per-collection line printed below is what
 * makes it visible. `--collections` restates the floor for a tree that
 * legitimately has fewer — the fixture trees in
 * tests/unit/infra/verify-content-gate.test.ts are questions-only by design, and
 * stating that on the command line is a decision somebody made rather than an
 * absence nobody noticed.
 */
for (const name of REQUIRED_COLLECTIONS) {
  const collection = collections.get(name);
  if (collection === undefined) {
    fail(
      `content/${name}/ does not exist, and it is one of the collections this gate requires claims ` +
        `from (${REQUIRED_COLLECTIONS.join(', ')}). A missing directory and a clean one produce the ` +
        `same silence, so this is a failure rather than a smaller number in the summary. If the ` +
        `collection genuinely moved, say so with --collections.`,
    );
    continue;
  }
  if (collection.factual === 0) {
    fail(
      `content/${name}/ holds ${String(collection.documents)} document(s) and ${String(collection.claims)} ` +
        `claim(s), of which ZERO state a fact. This gate would report green over it either way, so ` +
        `zero is a failure: either the recogniser has stopped matching the blocks in those files, ` +
        `or every claim in the collection has been marked "factual": false, which is an authoring ` +
        `decision and not something a gate should discover by going quiet.`,
    );
  }
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
  1: 'row 1 per-claim re-verification, asOf clock',
  2: 'row 2 source-unrevised, liveChecks clock',
  3: 'row 3 source-withdrawn',
};
const rowLine =
  tally.rows.size === 0
    ? '(none — no claim resolved to a source)'
    : [...tally.rows.entries()]
        .sort(([a], [b]) => a - b)
        .map(([row, count]) => `${String(count)} on ${rowNames[row] ?? `row ${String(row)}`}`)
        .join('; ');

for (const message of notes) console.log(`verify-content: note: ${message}`);

console.log(
  `verify-content: ${String(tally.claims)} claim(s) in ${String(sourceFiles.length)} ` +
    `source register(s) — ${statusLine || 'no statuses'}; ${String(tally.shipped)} shipped, ` +
    `${String(tally.claims - tally.shipped)} excluded from the build.`,
);
/*
 * WHERE THE CLAIMS WERE, per collection, on every run. ADR-0024.
 *
 * This line is the one that would have shown the hole this gate had: it walked
 * content/questions/ and nothing else, and printed a count of questions, so a
 * green run said "462 questions checked" while 60 claims a player reads on every
 * level were not checked at all — and there was nothing in the output to notice
 * the absence of. A per-collection breakdown cannot be read as coverage of a
 * collection that is not in it.
 */
const silent = [...collections.entries()]
  .filter(([, collection]) => collection.claims === 0)
  .map(
    ([name, collection]) =>
      `${name === '(root)' ? 'content/ itself' : `content/${name}/`} ` +
      `(${String(collection.documents)} document(s))`,
  )
  .sort((a, b) => a.localeCompare(b));
for (const [name, collection] of [...collections.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (collection.claims === 0) continue;
  const statuses = [...collection.byStatus.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${String(count)} ${status}`)
    .join(', ');
  console.log(
    `verify-content:   content/${name}/ — ${String(collection.documents)} document(s), ` +
      `${String(collection.claims)} claim(s): ${String(collection.factual)} state a fact and were ` +
      `checked, ${String(collection.flavour)} are declared factual: false and were not` +
      `${collection.unchecked > 0 ? `, ${String(collection.unchecked)} could not be text-checked` : ''}` +
      `${statuses === '' ? '' : ` — ${statuses}`}` +
      `${REQUIRED_COLLECTIONS.includes(name) ? '' : ' (not named in --collections, so an empty run of it would not fail)'}.`,
  );
}
// The rest of the walk, named rather than omitted. A collection carrying no
// claim is the expected state for a source register or a locale bundle — and it
// is also what a collection whose claims stopped being recognised looks like, so
// the extent of the walk is printed rather than inferred from what is missing.
console.log(
  `verify-content: walked and found no claim in ${silent.length === 0 ? '(nothing else)' : silent.join(', ')}. ` +
    `The floor that makes an empty collection a failure covers ${REQUIRED_COLLECTIONS.join(', ')}.`,
);
/*
 * WHAT THE CLAIMS ARE KNOWN BY, on every run. ADR-0024: gate A matches a claim
 * across revisions by identity, and a claim keyed by position is exactly the
 * state that let a grant follow a slot. So the split is printed rather than
 * implied — a schema that stopped requiring an id would show here as a number
 * moving from one column to the other.
 */
const positionalLine = [...identityTally.positional.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([label, count]) => `${String(count)} inside ${label}`)
  .join(', ');
console.log(
  `verify-content: claim identity — ${String(identityTally.blocks)} verification/communityReview ` +
    `block(s) in the working tree: ${String(identityTally.byId)} known by a schema-required id, ` +
    `${String(identityTally.byPath)} at a fixed path, ` +
    `${positionalLine === '' ? '0 by position' : `by position ${positionalLine}, whose schema requires no id`}` +
    `${
      identityTally.unresolvedBlocks > 0
        ? `; ${String(identityTally.unresolvedBlocks)} by POSITION because their document's $schema does ` +
          `not resolve here, so NOT known by identity`
        : ''
    }.`,
);
console.log(`verify-content: ADR-0016 re-check disposition — ${rowLine}.`);
// Printed on every run, including when it is zero, and with the SIZE of what was
// searched rather than a tick. A banned-term gate that ran over no term list
// produces output identical to one that ran over every list and found nothing
// (ADR-0024), and this gate was silent about a real violation for long enough
// that the difference is not hypothetical.
console.log(
  `verify-content: ADR-0016 §3 banned terms — ${String(tally.banClaims)} claim(s) sat under ` +
    `a staleness flag naming ${String(tally.banTermChecks)} term(s) to search for; ` +
    `${String(tally.banFaults)} violation(s)` +
    `${tally.banClaims === 0 ? '. NOTHING WAS SEARCHED: no claim resolved to a flag with a bannedFromAnswers list, so this line is not evidence of anything' : ''}.`,
);
console.log(
  `verify-content: text checks ran against a cached extraction for ` +
    `${String(tally.verbatimChecked)} claim(s); ${String(tally.verbatimUnchecked)} could NOT be ` +
    `checked because the extraction is absent` +
    `${tally.verbatimUnchecked > 0 ? ' (this is the CI case — those claims are unchecked, not passing)' : ''}.`,
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
      `block(s) and ${String(history.reviews)} communityReview block(s) inspected` +
      `${history.rekeyed > 0 ? `; ${String(history.rekeyed)} grant state(s) carried across a schema change that re-keyed their claim` : ''}.`,
  );
  console.log(
    `verify-content: A4 binds each grant to its own claim — ${String(history.bound)} grant(s) ` +
      `bound at HEAD; document-scope bindings ${[...scopeBinds.entries()]
        .map(([field, count]) => `${field} ${String(count)}`)
        .join(', ')}. A named field binding 0 grants voids nothing (ADR-0024)${
        [...scopeBinds.entries()].some(([, count]) => count === 0)
          ? `; the zeroes here are ${DOCUMENT_SCOPE_FIELDS.filter(
              ({ key }) => (scopeBinds.get(key) ?? 0) === 0,
            )
              .map(({ key, why }) => `"${key}" — ${why}`)
              .join(' ')}`
          : ''
      }.`,
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
