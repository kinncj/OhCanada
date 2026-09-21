/**
 * `{ lesson, passage }` -> exactly one passage, or a named failure — and then
 * the shippable-passage filter, which ADR-0063 §6 puts here and nowhere else.
 *
 * ## Why this is in `app/application` and not in the screen that draws it
 *
 * §6: *"The shippable-passage filter (only `verified` for the current
 * `sourceHash`) lives in `app/application`, never in a screen, so the level
 * reader and the Learn reader cannot disagree about what is readable."* Two
 * surfaces read one corpus — a `read` step on the quest path (ADR-0063) and the
 * Learn chapter reader (ADR-0061) — and a rule written twice is a rule that
 * eventually disagrees with itself in favour of the screen that forgot it. A
 * quarantined paragraph has to leave the level the way it leaves Learn: by not
 * being in the list.
 *
 * `app/ui/lesson-reader.ts` therefore has **no field** a `LessonPassage`, a
 * `fact` block or a `LocalizedText` fits into, and
 * `tests/unit/contracts/a-read-step-reaches-a-reader.test.ts` reads its source
 * to keep it that way. What this module answers is the input that view is built
 * from.
 *
 * ## The grant is injected, and that is what stops a third copy of ADR-0003
 *
 * {@link passageVerdict} does **not** restate "status is `verified`, the grant
 * cites the hash the claim cites, the grant quotes evidence". That rule exists
 * twice in `app/` already — `app/domain/entities/question.ts` for a question and
 * `app/adapters/phaser/verified-claim.ts` for everything else — and
 * `tests/unit/contracts/one-rule-decides-what-may-be-drawn.test.ts` exists to
 * stop a third. `app/application` can reach neither copy: `.dependency-cruiser.cjs`
 * forbids `app/application -> app/adapters` outright, and the adapter's copy
 * exists precisely because `isVerified` is typed for a `Question`.
 *
 * So the rule arrives as a parameter. {@link AdjudicateClaim} is satisfied by
 * `app/bootstrap/verified-passages.ts`, which is the one place in the program
 * that turns `adjudicateClaim` into this shape, and the composition root gives
 * the same function to every reader. One rule, one wiring, and the two surfaces
 * still cannot disagree — a stronger guarantee than a copy living here would be,
 * because a copy can drift and a parameter cannot.
 *
 * **What this module does own** is the one condition ADR-0003 does not state:
 * **every lesson passage is a claim** (ADR-0061 §9.3), so `factual: false` is a
 * refusal here rather than the exemption it is for a greeting in an NPC's
 * mouth. `lesson.schema.json` says it cannot say so, and says why.
 *
 * ## The other implementation, and how the two are kept honest
 *
 * `scripts/lib/lesson-passages.mjs` is the same resolution and the same
 * readable-passage rule for the CI gate over `content/**`. It cannot be reused
 * here — it is tooling, and `.dependency-cruiser.cjs`'s `no-tooling-in-runtime`
 * keeps `scripts/` out of the bundle — so there are two implementations of one
 * rule and somebody owns keeping them in step. They are watched rather than
 * trusted: `tests/unit/contracts/a-passage-is-readable-by-one-rule.test.ts`
 * drives this module and that one over the same matrix of statuses, hashes,
 * evidence and `factual` flags, **and over all 302 shipped passages**, and fails
 * on any disagreement about `readable`, `why` or the resolution verdict. The
 * refusal vocabularies are deliberately the same five words for that reason.
 *
 * ## Exactly one, never `undefined`
 *
 * {@link resolvePassage} answers one passage or a named failure and never
 * resolves to the first match. `find`, `some` and `filter` all fold an empty
 * collection into a success-shaped value, and two of those read as an answer,
 * which is ADR-0024 in one sentence. Zero matches and two matches are different
 * failures because they are different mistakes:
 *
 *  - **dangling** — the reference names nothing. Usually a renamed passage, and
 *    `lesson.schema.json` records that a rename is a *new identity*.
 *  - **ambiguous** — it names more than one. Two lesson documents sharing an
 *    `id`, or two passages sharing one inside a lesson; no schema sees either,
 *    because `uniqueItems` compares whole items.
 *  - **malformed** — half a pair. A passage id is unique only within its lesson,
 *    so a bare id is not a key (ADR-0063 §4).
 *
 * Pure: no ports are called, no clock is read, nothing is fetched. Everything
 * arrives as a value and a new value is returned.
 */

import { appErr, ok, type Result } from '@common/result';
import type {
  FactClaim,
  LessonChapter,
  LessonDocument,
  LessonPassage,
  LessonPassageReference,
} from '@application/ports/content-repository';

/* -------------------------------------------------------------------------- */
/* the grant, injected                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Why a verifier's grant does not let a claim be put in front of a player.
 *
 * The three words are `app/adapters/phaser/verified-claim.ts`'s
 * `ClaimRefusalReason`, restated structurally rather than imported — this layer
 * may not import that one — plus `unreadable` for a block that cannot be
 * adjudicated at all. A block nothing can read is never a block that is waved
 * through (ADR-0024).
 */
export type GrantRefusal = 'not-verified' | 'stale' | 'unevidenced' | 'unreadable';

/** A verifier's grant, adjudicated. */
export interface ClaimGrant {
  readonly granted: boolean;
  /** `null` exactly when `granted`. */
  readonly why: GrantRefusal | null;
  /** The status the grant carries, when there was one to read. */
  readonly status: string | null;
}

/**
 * ADR-0003's three conditions, supplied by the composition root.
 *
 * Required rather than defaulted, and there is no default in this file to fall
 * back to. A default would be the third copy this parameter exists to avoid, and
 * "the filter ran with the permissive rule because nobody passed one" is the
 * exact shape of a quarantined paragraph reaching a phone with every gate green.
 */
export type AdjudicateClaim = (claim: FactClaim) => ClaimGrant;

/* -------------------------------------------------------------------------- */
/* the shippable-passage rule                                                 */
/* -------------------------------------------------------------------------- */

/** Why a resolved passage may not be read. */
export type PassageRefusal = 'not-factual' | GrantRefusal;

export type PassageVerdict =
  | { readonly readable: true; readonly why: null; readonly status: string | null }
  | { readonly readable: false; readonly why: PassageRefusal; readonly status: string | null };

/**
 * May this passage be put in front of a player?
 *
 * One lesson-specific condition, then the injected grant. The order matters and
 * is the tooling implementation's: `factual: false` is refused *before* the
 * grant is consulted, because a passage that asserts nothing has nothing for a
 * verifier to have granted, and asking the adjudicator would answer `drawable`
 * — which is right for a greeting and wrong for a paragraph of the guide.
 */
export function passageVerdict(passage: LessonPassage, grant: AdjudicateClaim): PassageVerdict {
  if (passage.fact.factual !== true) {
    return { readable: false, why: 'not-factual', status: null };
  }
  const verdict = grant(passage.fact);
  if (verdict.granted) return { readable: true, why: null, status: verdict.status };
  return { readable: false, why: verdict.why ?? 'unreadable', status: verdict.status };
}

/** One sentence a developer can act on, for a passage that may not be read. */
export function whyUnreadable(
  lesson: LessonDocument,
  passage: LessonPassage,
  verdict: Extract<PassageVerdict, { readable: false }>,
): string {
  const at = `"${lesson.id}/${passage.id}"`;
  switch (verdict.why) {
    case 'not-verified':
      return (
        `${at} resolves, and its grant is "${verdict.status ?? 'unreadable'}". Only "verified" ` +
        'ships (ADR-0003), and a quarantined passage leaves the level the way it leaves Learn ' +
        '— one object, one grant, one edit (ADR-0063 §2).'
      );
    case 'stale':
      return (
        `${at} is "verified", but for a different sourceHash than the one it now cites. The ` +
        'source moved under the verdict, so the verdict is stale.'
      );
    case 'unevidenced':
      return `${at} is "verified" with no quoted evidence, which is an assertion rather than a verification.`;
    case 'not-factual':
      return (
        `${at} declares "factual": false. Every lesson passage is a claim (ADR-0061 §9.3); one ` +
        'that asserts nothing teaches nothing, and a read step pointing at it puts an empty ' +
        'paragraph in front of a player.'
      );
    default:
      return (
        `${at} carries a fact block this filter cannot read. A block that cannot be adjudicated ` +
        'is never one that is waved through (ADR-0024).'
      );
  }
}

/* -------------------------------------------------------------------------- */
/* resolution                                                                 */
/* -------------------------------------------------------------------------- */

export type ResolutionFailure = 'malformed' | 'dangling' | 'ambiguous';

export type PassageResolution =
  | {
      readonly ok: true;
      readonly count: 1;
      readonly lesson: LessonDocument;
      readonly passage: LessonPassage;
    }
  | {
      readonly ok: false;
      readonly why: ResolutionFailure;
      readonly count: number;
      readonly message: string;
    };

/**
 * Both halves are strings — the TYPE check and deliberately not an emptiness
 * check.
 *
 * `scripts/lib/lesson-passages.mjs` draws the line in exactly this place, and
 * the two have to draw it identically or they classify the same reference
 * differently: an empty `passage` is a string, so it is a pair that resolves to
 * nothing, which is `dangling` — a reference naming a passage that is not there
 * — and not `malformed`, which is a reference that is not a pair at all. A
 * reference reaching here at all has been through `app/bootstrap/quests.ts`,
 * which requires both halves to be kebab-case ids, so this is the belt to that
 * braces and the case it catches is untyped JSON.
 */
const isPair = (reference: LessonPassageReference): boolean =>
  typeof reference.lesson === 'string' && typeof reference.passage === 'string';

/** How a failure names the collection it searched, in the tooling's words. */
const searched = (lessons: readonly LessonDocument[]): string => {
  const passages = lessons.reduce((total, lesson) => total + lesson.passages.length, 0);
  return (
    `searched ${String(lessons.length)} loaded lesson document(s) holding ` +
    `${String(passages)} passage(s)`
  );
};

/**
 * Exactly one passage, or a named failure. Never `undefined`.
 *
 * Counts matches over a **flat list** and deliberately does not index it. A map
 * keyed by lesson id keeps one of two documents that share one — last writer
 * wins — and the ambiguity this exists to catch would be gone before anything
 * looked for it. `scripts/lib/lesson-passages.mjs` says the same at greater
 * length, and the two agree because one test drives both.
 */
export function resolvePassage(
  lessons: readonly LessonDocument[],
  reference: LessonPassageReference,
): PassageResolution {
  if (!isPair(reference)) {
    return {
      ok: false,
      why: 'malformed',
      count: 0,
      message:
        'a lesson passage reference must carry a string "lesson" and a string "passage". Both ' +
        'halves are required because a passage id is unique only within its lesson ' +
        '(lesson.schema.json), so a bare id is not a key (ADR-0063 §4).',
    };
  }

  const matches: { lesson: LessonDocument; passage: LessonPassage }[] = [];
  for (const lesson of lessons) {
    if (lesson.id !== reference.lesson) continue;
    for (const passage of lesson.passages) {
      if (passage.id === reference.passage) matches.push({ lesson, passage });
    }
  }

  const only = matches[0];
  if (matches.length === 1 && only !== undefined) {
    return { ok: true, count: 1, lesson: only.lesson, passage: only.passage };
  }

  const pair = `"${reference.lesson}/${reference.passage}"`;
  if (matches.length === 0) {
    return {
      ok: false,
      why: 'dangling',
      count: 0,
      message:
        `${pair} is DANGLING: 0 passages carry that pair (${searched(lessons)}). A reference ` +
        "names a lesson document's own \"id\" — not its filename and not its chapter — and a " +
        'passage "id" inside that document. Renaming a passage is a NEW IDENTITY ' +
        '(lesson.schema.json), so a reference still naming the old id points at nothing and is ' +
        'refused here rather than falling back to a position (ADR-0063 §4, ADR-0024).',
    };
  }

  return {
    ok: false,
    why: 'ambiguous',
    count: matches.length,
    message:
      `${pair} is AMBIGUOUS: ${String(matches.length)} passages carry that pair. A passage id ` +
      'is unique only WITHIN its lesson, so either two lesson documents share an "id" or two ' +
      'passages share one inside a lesson. It is refused rather than resolved to the first ' +
      'match, because picking one would put a paragraph nobody chose in front of a player ' +
      '(ADR-0063 §4, ADR-0024).',
  };
}

/* -------------------------------------------------------------------------- */
/* the chapter a lesson is in                                                 */
/* -------------------------------------------------------------------------- */

export type ChapterResolution =
  | { readonly ok: true; readonly chapter: string }
  | { readonly ok: false; readonly why: 'dangling' | 'ambiguous'; readonly count: number };

/**
 * Which chapter chunk holds a lesson — the same "exactly one" over the index.
 *
 * Two chapters listing one lesson id is the corpus-level half of the ambiguity
 * `resolvePassage` refuses inside a document, and it is the case that makes
 * fetching "the" chapter meaningless. It fails here rather than picking the
 * first, for the same reason and with the same count.
 */
export function chapterOfLesson(
  chapters: readonly LessonChapter[],
  lessonId: string,
): ChapterResolution {
  const holders = chapters.filter((chapter) => chapter.lessons.includes(lessonId));
  const only = holders[0];
  if (holders.length === 1 && only !== undefined) return { ok: true, chapter: only.chapter };
  return { ok: false, why: holders.length === 0 ? 'dangling' : 'ambiguous', count: holders.length };
}

/* -------------------------------------------------------------------------- */
/* what a reader may be given                                                 */
/* -------------------------------------------------------------------------- */

/** One lesson, and the passages of it a step may show, in the step's order. */
export interface Reading {
  readonly lesson: LessonDocument;
  /** Readable, in the order the references named them. May be shorter than the references. */
  readonly passages: readonly LessonPassage[];
  /** One sentence per passage that resolved and may not be read. Empty is the normal case. */
  readonly refused: readonly string[];
}

/** Every distinct lesson a step's references name, in first-seen order. */
export function lessonsNamedBy(references: readonly LessonPassageReference[]): readonly string[] {
  const seen: string[] = [];
  for (const reference of references) {
    const id = reference.lesson;
    /* A string, empty or not: an empty lesson id is a lesson nothing holds,
       which fails as `dangling` at the chapter index rather than being quietly
       dropped here and reported as "this step names no lessons" (ADR-0024). */
    if (typeof id === 'string' && !seen.includes(id)) seen.push(id);
  }
  return seen;
}

/**
 * Resolve a step's references against one chapter's loaded lessons, drop what a
 * verifier will not let a player read, and keep the step's order.
 *
 * Refuses the whole step when a reference cannot be resolved, and drops a single
 * passage when it resolves and is not readable. That asymmetry is deliberate and
 * it is ADR-0016's clock: a dangling reference is a **document defect** somebody
 * has to fix, and a quarantined passage is the **verification machinery working**
 * — a step authored in March can be pointing at prose that stopped being
 * readable in June with nobody having touched the quest. The first must be loud;
 * the second must be survivable, exactly as a refused blurb costs a landmark its
 * card and not its art.
 *
 * A step whose passages all turn out unreadable answers an empty
 * {@link Reading.passages}, and the caller opens nothing: a sheet with a heading
 * and no words is a screen the player dismisses having been told nothing
 * (ADR-0024). It is `ok` rather than an error because the level is still
 * finishable and the step still advances; what is lost is the teaching.
 */
export function readingFor(
  lessons: readonly LessonDocument[],
  references: readonly LessonPassageReference[],
  grant: AdjudicateClaim,
): Result<Reading> {
  if (references.length === 0) {
    return appErr(
      'invalid',
      'content.lesson.passages.empty',
      'a read step names no passages, so there is nothing to read (ADR-0024).',
    );
  }

  const named = lessonsNamedBy(references);
  const first = named[0];
  if (named.length !== 1 || first === undefined) {
    return appErr(
      'invalid',
      'content.lesson.passages.manyLessons',
      `a read step names passages from ${String(named.length)} lessons (${named.join(', ')}), ` +
        'and a reader is named by one lesson\'s title. Two lessons in one sheet would put one ' +
        "author's paragraphs under another's heading, which is the defect `app/ui/dialogue.ts` " +
        'refuses for two speakers in one dialog. Split it into one step per lesson.',
      { lessons: named },
    );
  }

  const passages: LessonPassage[] = [];
  const refused: string[] = [];
  let lesson: LessonDocument | undefined;

  for (const reference of references) {
    const resolution = resolvePassage(lessons, reference);
    if (!resolution.ok) {
      return appErr(
        resolution.why === 'dangling' ? 'not-found' : 'invalid',
        `content.lesson.passage.${resolution.why}`,
        resolution.message,
        { lesson: reference.lesson, passage: reference.passage, count: resolution.count },
      );
    }
    lesson = resolution.lesson;
    const verdict = passageVerdict(resolution.passage, grant);
    if (verdict.readable) passages.push(resolution.passage);
    else refused.push(whyUnreadable(resolution.lesson, resolution.passage, verdict));
  }

  if (lesson === undefined) {
    /* Unreachable: `references` is non-empty and every iteration either returns
       or assigns. Stated rather than asserted, because a cast here would be the
       one place this file pretended to know something it had not checked. */
    return appErr(
      'invalid',
      'content.lesson.passages.empty',
      'a read step names no passages, so there is nothing to read (ADR-0024).',
    );
  }

  return ok({ lesson, passages, refused });
}
