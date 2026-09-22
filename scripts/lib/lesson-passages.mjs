/**
 * The cross-document resolver for `{ lesson, passage }` references — ADR-0063's
 * infra obligation.
 *
 * ## Why a resolver exists at all, and why the pair is the key
 *
 * `content/schemas/quest.schema.json#/$defs/lessonPassageRef` addresses a
 * passage by the pair `{ lesson, passage }` rather than by a bare id, and
 * ADR-0063 §4 is explicit that this is a *contract* rather than a preference:
 * `lesson.schema.json` requires a passage's `id` to be unique **within its
 * lesson** and says so in prose, because `uniqueItems` compares whole items and
 * cannot express it. Measured on the tree this was written against, all 302
 * authored passage ids happen to be distinct corpus-wide — which is luck, not a
 * guarantee, and a reference resting on it breaks silently the first time two
 * chapters both name a passage `e1-the-vote`.
 *
 * A schema sees one file. It cannot know whether the lesson a quest names
 * exists, so `make validate-content` will accept a `read` step pointing at
 * nothing at all. That is the hole this module fills, and
 * `common.schema.json#/$defs/id` states the shape of the fill: an unbranded id
 * is resolved either by a sibling discriminator on the same object **or by a
 * cross-document gate that names the collections it searched and fails on zero
 * matches and on two**. `lesson` is the discriminator; this is that gate.
 *
 * ## The two failures are different failures, and that is the whole design
 *
 * {@link resolvePassage} answers **exactly one, or a named failure**. It never
 * answers `undefined`, and it never resolves to the first match. `find`, `some`
 * and `filter` all reduce an empty collection to a success-shaped value —
 * `undefined`, `false`, `[]` — and two of those read as an answer, which is the
 * ADR-0024 defect stated in one sentence. "Exactly one" has no identity element
 * to be mistaken for a result:
 *
 *  - **dangling** (0 matches) — the reference names nothing. Usually a renamed
 *    passage, and `lesson.schema.json` records that a rename is a *new
 *    identity*: the old id points at nothing and must fail here rather than
 *    fall back to a position, which is exactly how a grant once followed the
 *    slot `/pois/2` instead of the claim in it.
 *  - **ambiguous** (2+ matches) — the reference names more than one paragraph.
 *    This is the case a bare passage id would have hidden. It arises two ways
 *    and both are real: two lesson *documents* sharing an `id`, or two passages
 *    sharing an `id` inside one lesson. Neither is caught by any schema.
 *
 * ## The shippable-passage rule is here too, for one reason
 *
 * A quarantined passage must leave the level the way it leaves Learn. ADR-0016's
 * clock can invalidate a grant long after a quest was authored, so a `read` step
 * that resolved cleanly last month can be pointing at unreadable prose today —
 * and a step whose every passage is unreadable is a reader that opens on a blank
 * sheet, which is ADR-0024's empty collection reducing to a pass with a screen
 * attached. {@link passageVerdict} is the same three conditions
 * `app/adapters/phaser/verified-claim.ts` applies to a blurb and
 * `app/domain/entities/question.ts` applies to a question, restated here
 * because this module is plain Node with no build step and cannot import
 * either. The seam is watched rather than trusted: the contract test drives
 * this function and the adapter's `adjudicateClaim` over the same matrix.
 *
 * ## What this module is NOT
 *
 * It is not the runtime catalogue. ADR-0063 §6 puts that in
 * `app/adapters/content` as one `import.meta.glob` per chapter, lazily
 * imported, so a chapter is a chunk fetched on first open and the ≤ 8 MB
 * initial payload does not move. Eagerly globbing 48 lesson documents into the
 * composition root to check a reference at load would spend that budget to hold
 * a gate CI can hold for free, and would pre-empt a design that is owed to
 * somebody else. `app/bootstrap/quests.ts` therefore checks a `read` step's
 * *shape* — loudly, at load, naming the field — and this checks the *reference*,
 * over the whole corpus, in CI.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Where lessons live, relative to a repository root. */
export const LESSONS_DIR = join('content', 'lessons');

/** Where quests live, relative to a repository root. */
export const QUESTS_DIR = join('content', 'quests');

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const directoriesIn = (dir) =>
  readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();

const jsonFilesIn = (dir) => readdirSync(dir).filter((name) => name.endsWith('.json')).sort();

/**
 * Every lesson document under `content/lessons/**`, flattened to what a
 * reference has to resolve against.
 *
 * Deliberately does NOT de-duplicate by id, and deliberately does not build a
 * `Map` keyed by `lesson`. A map would silently keep one of two lessons sharing
 * an id — the last writer wins — and the ambiguity this gate exists to catch
 * would be gone before anything looked for it. The corpus is a flat list and
 * resolution counts matches over it.
 *
 * `faults` carries documents this reader could not make sense of at all: a file
 * that does not parse, or one with no `id` or no `passages` array. Those are a
 * schema's job (`make validate-content`) and are recorded rather than thrown,
 * so one unreadable file does not hide the state of the other forty-seven.
 */
export function readLessonCorpus(root) {
  const dir = join(root, LESSONS_DIR);
  const lessons = [];
  const chapters = [];
  const faults = [];
  let passageCount = 0;

  for (const chapter of directoriesIn(dir)) {
    chapters.push(chapter);
    for (const file of jsonFilesIn(join(dir, chapter))) {
      const where = `${LESSONS_DIR}/${chapter}/${file}`;
      let document;
      try {
        document = readJson(join(dir, chapter, file));
      } catch (error) {
        faults.push(`${where}: does not parse as JSON (${String(error)})`);
        continue;
      }
      if (!isRecord(document) || typeof document.id !== 'string') {
        faults.push(`${where}: carries no string "id", so nothing can reference it`);
        continue;
      }
      if (!Array.isArray(document.passages)) {
        faults.push(`${where}: carries no "passages" array`);
        continue;
      }

      const passages = [];
      for (const [index, passage] of document.passages.entries()) {
        if (!isRecord(passage) || typeof passage.id !== 'string') {
          faults.push(`${where}: passages[${index}] carries no string "id"`);
          continue;
        }
        passages.push({
          id: passage.id,
          index,
          pointer: `/passages/${index}`,
          fact: isRecord(passage.fact) ? passage.fact : null,
          text: isRecord(passage.text) ? passage.text : null,
        });
        passageCount += 1;
      }

      lessons.push({
        id: document.id,
        chapter: typeof document.chapter === 'string' ? document.chapter : '',
        where,
        passages,
      });
    }
  }

  return { lessons, chapters, faults, lessonCount: lessons.length, passageCount };
}

/** How the failure messages name the place they searched. */
const searched = (corpus) =>
  `searched ${corpus.lessonCount} lesson document(s) holding ${corpus.passageCount} ` +
  `passage(s) under ${LESSONS_DIR}/**`;

/**
 * Exactly one passage, or a named failure. Never `undefined`, which is the point.
 *
 * `count` is carried on the failure so a reader of a red gate sees *how many*
 * rather than only that the number was not one — the difference between "you
 * renamed it" and "you have two of them".
 */
export function resolvePassage(corpus, reference) {
  if (!isRecord(reference) ||
      typeof reference.lesson !== 'string' ||
      typeof reference.passage !== 'string') {
    return {
      ok: false,
      why: 'malformed',
      count: 0,
      message:
        'a lesson passage reference must be an object carrying a string "lesson" and a string ' +
        '"passage". Both halves are required because a passage id is unique only within its ' +
        'lesson (lesson.schema.json), so a bare id is not a key (ADR-0063 §4).',
    };
  }

  const { lesson: lessonId, passage: passageId } = reference;
  const matches = [];
  for (const lesson of corpus.lessons) {
    if (lesson.id !== lessonId) continue;
    for (const passage of lesson.passages) {
      if (passage.id === passageId) matches.push({ lesson, passage });
    }
  }

  if (matches.length === 1) return { ok: true, count: 1, match: matches[0] };

  if (matches.length === 0) {
    return {
      ok: false,
      why: 'dangling',
      count: 0,
      message:
        `"${lessonId}/${passageId}" is DANGLING: 0 passages carry that pair (${searched(corpus)}). ` +
        'A reference names a lesson document\'s own "id" — not its filename and not its chapter — ' +
        'and a passage "id" inside that document. lesson.schema.json records that renaming a ' +
        'passage is a NEW IDENTITY, so a reference still naming the old id points at nothing and ' +
        'is refused here rather than falling back to a position (ADR-0063 §4, ADR-0024).',
    };
  }

  return {
    ok: false,
    why: 'ambiguous',
    count: matches.length,
    message:
      `"${lessonId}/${passageId}" is AMBIGUOUS: ${matches.length} passages carry that pair ` +
      `(${matches.map(({ lesson, passage }) => `${lesson.where}${passage.pointer}`).join(', ')}). ` +
      'A passage id is unique only WITHIN its lesson, so either two lesson documents share an ' +
      '"id" or two passages share one inside a lesson. This is the case a bare passage id would ' +
      'have hidden (ADR-0063 §4); it is refused rather than resolved to the first match, because ' +
      'picking one would put a paragraph nobody chose in front of a player (ADR-0024).',
  };
}

/**
 * The four statuses `common.schema.json#/$defs/factVerification` allows.
 *
 * Listed so that a value outside them is `unreadable` rather than
 * `not-verified`. Those are different things: `not-verified` is a verifier
 * having decided something other than "verified", and it carries WHICH; a
 * `status` of `"granted"`, or of `42`, is nobody having decided anything and a
 * field that did not come from this schema. Reporting the second as the first
 * would present a renamed field as an honest rejection, which is the failure
 * ADR-0024 is about, and it is the one place this module and
 * `app/adapters/phaser/verified-claim.ts` had drifted apart — caught by
 * `tests/unit/contracts/a-passage-is-readable-by-one-rule.test.ts`, which is
 * what that gate is for.
 */
const CLAIM_STATUSES = ['unverified', 'verified', 'quarantined', 'rejected'];

/**
 * ADR-0003's three conditions, plus the one ADR-0061 §9.3 adds for a lesson.
 *
 * Every shippable passage declares `factual: true` — a passage that asserts
 * nothing is a passage that teaches nothing, and the schema cannot state that
 * constant without breaking ADR-0007's rule against inline object shapes — so
 * `factual: false` is a refusal here rather than the exemption it is for a
 * greeting in an NPC's mouth.
 *
 * READ FIRST, THEN ADJUDICATE, which is `readFactClaim` followed by
 * `adjudicateClaim` in the runtime and is the same order here. A block whose
 * fields are the wrong type or the wrong value is refused as `unreadable`
 * before any of the three conditions is asked, because a condition asked of a
 * field nobody can read answers about something else.
 */
export function passageVerdict(passage) {
  const fact = passage.fact;
  if (fact === null) {
    return { readable: false, why: 'unreadable', status: null };
  }
  if (fact.factual !== true) {
    return { readable: false, why: 'not-factual', status: null };
  }

  /* The read. Every branch below is a block this gate cannot adjudicate, and a
     block it cannot adjudicate is never one it waves through (ADR-0024). */
  const source = isRecord(fact.source) ? fact.source : null;
  const verification = isRecord(fact.verification) ? fact.verification : null;
  if (source === null || verification === null) {
    return { readable: false, why: 'unreadable', status: null };
  }
  if (typeof source.sourceHash !== 'string') {
    return { readable: false, why: 'unreadable', status: null };
  }
  if (!CLAIM_STATUSES.includes(verification.status)) {
    return {
      readable: false,
      why: 'unreadable',
      status: typeof verification.status === 'string' ? verification.status : null,
    };
  }
  const status = verification.status;
  if (typeof verification.sourceHash !== 'string' || typeof verification.evidence !== 'string') {
    return { readable: false, why: 'unreadable', status };
  }

  /* The three conditions. */
  if (status !== 'verified') {
    return { readable: false, why: 'not-verified', status };
  }
  if (verification.sourceHash !== source.sourceHash) {
    return { readable: false, why: 'stale', status };
  }
  if (verification.evidence.trim().length === 0) {
    return { readable: false, why: 'unevidenced', status };
  }
  return { readable: true, why: null, status };
}

const unreadableSentence = (lessonId, passageId, verdict, where) => {
  switch (verdict.why) {
    case 'not-verified':
      return (
        `"${lessonId}/${passageId}" (${where}) resolves, and its grant is "${verdict.status}". ` +
        'Only "verified" ships (ADR-0003), and a quarantined passage must leave the level the ' +
        'way it leaves Learn — one object, one grant, one edit (ADR-0063 §2).'
      );
    case 'stale':
      return (
        `"${lessonId}/${passageId}" (${where}) is "verified", but for a different sourceHash ` +
        'than the one it now cites. The source moved under the verdict, so the verdict is stale.'
      );
    case 'unevidenced':
      return (
        `"${lessonId}/${passageId}" (${where}) is "verified" with no quoted evidence, which is ` +
        'an assertion rather than a verification.'
      );
    case 'not-factual':
      return (
        `"${lessonId}/${passageId}" (${where}) declares "factual": false. Every lesson passage ` +
        'is a claim (ADR-0061 §9.3); one that asserts nothing teaches nothing, and a read step ' +
        'pointing at it puts an empty paragraph in front of a player.'
      );
    default:
      return (
        `"${lessonId}/${passageId}" (${where}) carries a fact block this gate cannot read. A ` +
        'block that cannot be adjudicated is never one that is waved through (ADR-0024).'
      );
  }
};

/**
 * Every `{ lesson, passage }` reference a quest document carries, with the
 * pointer the document holds it at.
 *
 * Reads the raw document rather than a loaded one on purpose: this gate must be
 * able to fail a quest that `app/bootstrap/quests.ts` would also refuse, and a
 * walk over already-validated values could only ever see the documents that got
 * past the other check.
 */
export function referencesIn(quest) {
  const found = [];
  if (!isRecord(quest) || !Array.isArray(quest.steps)) return found;
  for (const [index, step] of quest.steps.entries()) {
    if (!isRecord(step) || !Array.isArray(step.passages)) continue;
    for (const [refIndex, reference] of step.passages.entries()) {
      found.push({
        at: `steps[${index}].passages[${refIndex}]`,
        kind: typeof step.kind === 'string' ? step.kind : '',
        reference,
      });
    }
  }
  return found;
}

/**
 * One quest document, resolved against the lesson corpus.
 *
 * Answers a list of sentences, empty when the document is sound. A list rather
 * than a first failure, so one quest reports everything wrong with it in one
 * run instead of one thing per commit.
 */
export function readStepFaults(quest, where, corpus) {
  const faults = [];
  for (const { at, kind, reference } of referencesIn(quest)) {
    if (kind !== 'read') {
      faults.push(
        `${where} ${at}: passages[] sits on a "${kind}" step. It belongs to a "read" step and ` +
          'to nothing else (quest.schema.json\'s conditional, ADR-0063 §3).',
      );
      continue;
    }
    const resolution = resolvePassage(corpus, reference);
    if (!resolution.ok) {
      faults.push(`${where} ${at}: ${resolution.message}`);
      continue;
    }
    const { lesson, passage } = resolution.match;
    const verdict = passageVerdict(passage);
    if (!verdict.readable) {
      faults.push(
        `${where} ${at}: ${unreadableSentence(lesson.id, passage.id, verdict, lesson.where)}`,
      );
    }
  }
  return faults;
}

/** Every quest document in a tree, paired with the path it was read from. */
export function readQuestCorpus(root) {
  const dir = join(root, QUESTS_DIR);
  return jsonFilesIn(dir).map((file) => ({
    where: `${QUESTS_DIR}/${file}`,
    document: readJson(join(dir, file)),
  }));
}

/**
 * The anti-vacuum sweep (ADR-0024), and the reason this gate is not hollow on a
 * tree that holds no `read` step.
 *
 * Every passage in the corpus is resolved **by its own pair**, through the same
 * `resolvePassage` a quest goes through. On a tree with no `read` step that is
 * still 302 resolutions of real references against real documents, so a
 * resolver that had stopped matching anything — a renamed field, a changed
 * directory layout, a `Map` that collapsed duplicates — fails here rather than
 * passing quietly until the first quest needs it.
 */
export function resolveEveryPassage(corpus) {
  const faults = [];
  let resolved = 0;
  for (const lesson of corpus.lessons) {
    for (const passage of lesson.passages) {
      const resolution = resolvePassage(corpus, { lesson: lesson.id, passage: passage.id });
      if (!resolution.ok) {
        faults.push(`${lesson.where}${passage.pointer}: ${resolution.message}`);
        continue;
      }
      resolved += 1;
    }
  }
  return { resolved, faults };
}
