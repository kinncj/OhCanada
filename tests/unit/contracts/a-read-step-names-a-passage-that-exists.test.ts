/**
 * A `{ lesson, passage }` REFERENCE RESOLVES TO EXACTLY ONE PASSAGE, AND ZERO
 * AND TWO FAIL DIFFERENTLY. ADR-0063's infra obligation, ADR-0024, ADR-0029's
 * pattern.
 *
 * `quest.schema.json` can say that a `read` step's `passages[]` entries are
 * objects carrying two kebab-case ids. It cannot say that the lesson exists,
 * because a schema sees one file — so `make validate-content` will happily
 * accept a `read` step pointing at nothing at all. This is the other half.
 *
 * **Why the pair, and why counting matters.** `lesson.schema.json` scopes a
 * passage id's uniqueness to *within its lesson*, and says so in prose because
 * `uniqueItems` compares whole items and cannot express it. All 302 authored
 * passage ids happen to be distinct corpus-wide today; ADR-0063 §4 calls that
 * luck rather than a contract, and a reference resting on it breaks silently the
 * first time two chapters both name a passage `e1-the-vote`.
 * `common.schema.json#/$defs/id` states the rule an unbranded id obeys: resolved
 * by a sibling discriminator, or by **a cross-document gate that names the
 * collections it searched and fails on zero matches and on two.** `lesson` is
 * the discriminator; this is that gate.
 *
 * The resolution rule is deliberately *exactly one* rather than `find`, `some`
 * or `filter`, for the reason `a-quest-giver-is-placed-on-its-level.test.ts`
 * gives: those reduce an empty collection to `undefined`, `false` or `[]`, and
 * two of those read as an answer. "Exactly one" has no success-shaped identity
 * element. Zero is a **dangling** reference — usually a renamed passage, which
 * `lesson.schema.json` records as a new identity — and two is an **ambiguous**
 * one, the case a bare id would have hidden. The failure names which.
 *
 * **It is not vacuous on a tree with no `read` step**, which is the tree it
 * ships on. ADR-0024 is explicit that a check over an empty collection must not
 * reduce to a pass, so the sweep below resolves *every passage in the corpus by
 * its own pair* — 302 real resolutions against 48 real documents — and a
 * resolver that had stopped matching anything fails here rather than waiting for
 * the first quest to need it.
 *
 * The rules are then proved by breaking them, against synthesised corpora rather
 * than anything on disk: a gate nobody has seen fail is not a gate, and the
 * repository stays green while the gate stays exercised.
 */

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  passageVerdict,
  readLessonCorpus,
  readQuestCorpus,
  readStepFaults,
  referencesIn,
  resolveEveryPassage,
  resolvePassage,
  type CorpusLesson,
  type LessonCorpus,
} from '../../../scripts/lib/lesson-passages.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const corpus = readLessonCorpus(REPO_ROOT);
const quests = readQuestCorpus(REPO_ROOT);

/**
 * What the corpus held when this gate was written: 302 passages, 48 lessons, 10
 * chapters, every one `verified`.
 *
 * A floor rather than an equality, so authoring a lesson does not turn this red
 * — but a floor and not `> 0`, because the number this gate exists to protect is
 * the one ADR-0063 measured, and a corpus that collapsed to three passages would
 * satisfy "more than nothing" while every assertion below quietly stopped
 * meaning anything.
 */
const PASSAGES_WHEN_WRITTEN = 302;
const LESSONS_WHEN_WRITTEN = 48;

/* -------------------------------------------------------------------------- */
/* the shipped corpus                                                         */
/* -------------------------------------------------------------------------- */

describe('the lesson corpus this gate searches', () => {
  it('is a real corpus, and every document in it could be read', () => {
    expect(corpus.faults, corpus.faults.join('\n')).toEqual([]);
    expect(corpus.passageCount).toBeGreaterThanOrEqual(PASSAGES_WHEN_WRITTEN);
    expect(corpus.lessonCount).toBeGreaterThanOrEqual(LESSONS_WHEN_WRITTEN);
    expect(corpus.chapters.length).toBeGreaterThan(0);
  });

  it('resolves every passage it holds by its own pair (ADR-0024)', () => {
    /*
     * The anti-vacuum sweep, and the reason this file is worth running on a tree
     * that holds no `read` step. Every passage goes through the same
     * `resolvePassage` a quest reference goes through, so "the resolver works"
     * is evidence rather than an assumption waiting for its first caller.
     */
    const sweep = resolveEveryPassage(corpus);
    expect(sweep.faults, sweep.faults.join('\n')).toEqual([]);
    expect(sweep.resolved).toBe(corpus.passageCount);
  });

  it('holds only passages a player may actually be shown', () => {
    /*
     * A `read` step names passages that are already granted, so the corpus it
     * names from has to be readable. A quarantined passage must leave the level
     * the way it leaves Learn — one object, one grant (ADR-0063 §2) — and this
     * is what would say so if ADR-0016's clock ever moved under one.
     */
    const unreadable: string[] = [];
    for (const lesson of corpus.lessons) {
      for (const passage of lesson.passages) {
        const verdict = passageVerdict(passage);
        if (!verdict.readable) {
          unreadable.push(`${lesson.where}${passage.pointer}: ${verdict.why} (${String(verdict.status)})`);
        }
      }
    }
    expect(unreadable, unreadable.join('\n')).toEqual([]);
  });
});

describe('every read step in the build names passages that exist', () => {
  it('is judging a real quest corpus', () => {
    expect(quests.length).toBeGreaterThan(0);
  });

  it('resolves every reference every quest carries', () => {
    const faults = quests.flatMap(({ document, where }) =>
      readStepFaults(document, where, corpus),
    );
    expect(faults, faults.join('\n')).toEqual([]);
  });

  it('reports how many references the build actually holds', () => {
    /*
     * Two today — `read-at-dows-lake` on `ottawa-parliament-hill`, the last step
     * of that quest, standing on the level's last stop. A floor rather than an
     * equality, because authoring a second `read` step must not turn this red;
     * but a floor of one rather than of zero, because the day this walk goes
     * back to nothing it has stopped being a walk over anything and the `read`
     * step has silently left the build.
     *
     * It reached zero once before, and the reason is worth keeping: the first
     * attempt read at the canal locks and was withdrawn when Ottawa's canal
     * turned out to have no room for it. A `read` step needs a stop the level
     * does not already spend a `visit` on, the locks stand before the officer,
     * and moving either is refused by three separate gates at once — the physics
     * run-up in `tests/e2e/level-ottawa.spec.ts`, the 1 080 px between landmark
     * heroes in `level-art-is-placed-where-it-is-drawn.test.ts`, and
     * `verify-content`'s A4, which binds a landmark's grant to its own position.
     * The arithmetic is in ADR-0063. The answer was the far end of the level.
     */
    const found = quests.flatMap(({ document }) => referencesIn(document));
    expect(found.length).toBeGreaterThanOrEqual(1);
    for (const reference of found) expect(reference.kind).toBe('read');
  });
});

/* -------------------------------------------------------------------------- */
/* and the rule fails when it is broken                                       */
/* -------------------------------------------------------------------------- */

const lesson = (id: string, where: string, passageIds: readonly string[]): CorpusLesson => ({
  id,
  chapter: 'A Chapter',
  where,
  passages: passageIds.map((passageId, index) => ({
    id: passageId,
    index,
    pointer: `/passages/${String(index)}`,
    fact: {
      factual: true,
      source: { sourceHash: 'hash' },
      verification: { status: 'verified', sourceHash: 'hash', evidence: 'A passage.' },
    },
    text: { en: 'A passage.', fr: 'Un passage.' },
  })),
});

const corpusOf = (...lessons: readonly CorpusLesson[]): LessonCorpus => ({
  lessons,
  chapters: ['a-chapter'],
  faults: [],
  lessonCount: lessons.length,
  passageCount: lessons.reduce((total, one) => total + one.passages.length, 0),
});

describe('a reference that names nothing is dangling', () => {
  const one = corpusOf(lesson('a-lesson', 'content/lessons/a-chapter/a-lesson.json', ['p-1']));

  it('reports zero matches as dangling, with the count', () => {
    const result = resolvePassage(one, { lesson: 'a-lesson', passage: 'p-2' });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.why).toBe('dangling');
    expect(result.ok ? -1 : result.count).toBe(0);
  });

  it('is dangling when the LESSON is the half that does not exist', () => {
    const result = resolvePassage(one, { lesson: 'another-lesson', passage: 'p-1' });
    expect(result.ok ? '' : result.why).toBe('dangling');
  });

  it('says what it searched, so a red gate is actionable', () => {
    const result = resolvePassage(one, { lesson: 'a-lesson', passage: 'p-2' });
    expect(result.ok ? '' : result.message).toContain('DANGLING');
    expect(result.ok ? '' : result.message).toContain('content/lessons/**');
    expect(result.ok ? '' : result.message).toContain('1 lesson document(s)');
  });

  it('does not fall back to position when a passage is renamed', () => {
    /*
     * `lesson.schema.json`: a rename is a NEW IDENTITY. The passage is still
     * there, at the same index, with the same words — and the old reference must
     * still fail, because falling back to `/passages/0` is exactly how a grant
     * once followed a slot instead of the claim in it.
     */
    const renamed = corpusOf(lesson('a-lesson', 'content/lessons/a-chapter/a-lesson.json', ['p-renamed']));
    expect(resolvePassage(renamed, { lesson: 'a-lesson', passage: 'p-1' }).ok).toBe(false);
  });
});

describe('a reference that names two things is ambiguous, and is never resolved to the first', () => {
  it('reports two lessons sharing an id as ambiguous', () => {
    const collision = corpusOf(
      lesson('a-lesson', 'content/lessons/one/a-lesson.json', ['p-1']),
      lesson('a-lesson', 'content/lessons/two/a-lesson.json', ['p-1']),
    );
    const result = resolvePassage(collision, { lesson: 'a-lesson', passage: 'p-1' });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.why).toBe('ambiguous');
    expect(result.ok ? -1 : result.count).toBe(2);
  });

  it('reports two passages sharing an id INSIDE one lesson as ambiguous', () => {
    /*
     * The case the schema cannot see at all: `uniqueItems` compares whole items,
     * so two passages with one id and different words satisfy every keyword
     * there is. This is the harm ADR-0063 §4 says a bare id would have hidden,
     * and it is why the pair is not enough on its own — the gate has to count.
     */
    const collision = corpusOf(
      lesson('a-lesson', 'content/lessons/a-chapter/a-lesson.json', ['p-1', 'p-1']),
    );
    const result = resolvePassage(collision, { lesson: 'a-lesson', passage: 'p-1' });
    expect(result.ok ? '' : result.why).toBe('ambiguous');
    expect(result.ok ? -1 : result.count).toBe(2);
  });

  it('names both places, rather than picking one', () => {
    const collision = corpusOf(
      lesson('a-lesson', 'content/lessons/one/a-lesson.json', ['p-1']),
      lesson('a-lesson', 'content/lessons/two/a-lesson.json', ['p-1']),
    );
    const result = resolvePassage(collision, { lesson: 'a-lesson', passage: 'p-1' });
    expect(result.ok ? '' : result.message).toContain('AMBIGUOUS');
    expect(result.ok ? '' : result.message).toContain('content/lessons/one/a-lesson.json');
    expect(result.ok ? '' : result.message).toContain('content/lessons/two/a-lesson.json');
  });
});

describe('a reference that is not a pair at all', () => {
  const one = corpusOf(lesson('a-lesson', 'content/lessons/a-chapter/a-lesson.json', ['p-1']));

  it.each([
    ['a bare id', 'p-1'],
    ['only the passage half', { passage: 'p-1' }],
    ['only the lesson half', { lesson: 'a-lesson' }],
    ['nothing', null],
  ])('refuses %s as malformed', (_what, reference) => {
    const result = resolvePassage(one, reference);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.why).toBe('malformed');
  });
});

describe('a resolved passage still has to be readable', () => {
  const withFact = (fact: unknown): LessonCorpus =>
    corpusOf({
      id: 'a-lesson',
      chapter: 'A Chapter',
      where: 'content/lessons/a-chapter/a-lesson.json',
      passages: [{ id: 'p-1', index: 0, pointer: '/passages/0', fact: fact as never, text: null }],
    });

  const verdictOf = (fact: unknown): string => {
    const found = withFact(fact).lessons[0]?.passages[0];
    expect(found).toBeDefined();
    if (found === undefined) return 'missing';
    const verdict = passageVerdict(found);
    return verdict.readable ? 'readable' : verdict.why;
  };

  it('refuses a quarantined grant, so it leaves the level as it leaves Learn', () => {
    expect(
      verdictOf({
        factual: true,
        source: { sourceHash: 'hash' },
        verification: { status: 'quarantined', sourceHash: 'hash', evidence: 'A passage.' },
      }),
    ).toBe('not-verified');
  });

  it('refuses a grant made for a sourceHash the passage no longer cites', () => {
    expect(
      verdictOf({
        factual: true,
        source: { sourceHash: 'new-hash' },
        verification: { status: 'verified', sourceHash: 'old-hash', evidence: 'A passage.' },
      }),
    ).toBe('stale');
  });

  it('refuses a grant with no quoted evidence, which is an assertion', () => {
    expect(
      verdictOf({
        factual: true,
        source: { sourceHash: 'hash' },
        verification: { status: 'verified', sourceHash: 'hash', evidence: '   ' },
      }),
    ).toBe('unevidenced');
  });

  it('refuses `factual: false`, because a passage that asserts nothing teaches nothing', () => {
    // ADR-0061 §9.3: every lesson passage is a claim, and the schema cannot say
    // so without breaking ADR-0007's rule against inline object shapes.
    expect(verdictOf({ factual: false, source: null, verification: null })).toBe('not-factual');
  });

  it('refuses a fact block it cannot read, rather than waving it through', () => {
    // ADR-0024: a block that cannot be adjudicated must never present as one
    // that had nothing wrong with it.
    expect(verdictOf(null)).toBe('unreadable');
    expect(verdictOf({ factual: true, source: null, verification: null })).toBe('unreadable');
  });

  it('refuses a status no schema allows as unreadable, not as a verifier’s verdict', () => {
    // `not-verified` means a verifier decided something other than "verified",
    // and it carries WHICH. A status of "granted", or of 42, is nobody having
    // decided anything and a field that did not come from this schema; calling
    // it `not-verified` would report a renamed field as an honest rejection.
    // The runtime refuses these through `readFactClaim` and the two are driven
    // over one matrix by `a-passage-is-readable-by-one-rule.test.ts`.
    const hashed = (verification: unknown): unknown => ({
      factual: true,
      source: { sourceHash: 'hash' },
      verification,
    });
    expect(verdictOf(hashed({ status: 'granted', sourceHash: 'hash', evidence: 'x' }))).toBe(
      'unreadable',
    );
    expect(verdictOf(hashed({ status: 42, sourceHash: 'hash', evidence: 'x' }))).toBe('unreadable');
    expect(verdictOf(hashed({ status: 'verified', sourceHash: 7, evidence: 'x' }))).toBe(
      'unreadable',
    );
    expect(verdictOf(hashed({ status: 'verified', sourceHash: 'hash', evidence: null }))).toBe(
      'unreadable',
    );
    expect(verdictOf({ factual: true, source: { sourceHash: 9 }, verification: {} })).toBe(
      'unreadable',
    );
  });

  it('admits a passage that is verified for the hash it cites', () => {
    expect(
      verdictOf({
        factual: true,
        source: { sourceHash: 'hash' },
        verification: { status: 'verified', sourceHash: 'hash', evidence: 'A passage.' },
      }),
    ).toBe('readable');
  });
});

describe('the fault report a quest gets', () => {
  const one = corpusOf(lesson('a-lesson', 'content/lessons/a-chapter/a-lesson.json', ['p-1']));

  const questWith = (step: Record<string, unknown>): Record<string, unknown> => ({
    id: 'quest.somewhere.a-job',
    steps: [step],
  });

  it('is empty for a read step naming a passage that exists and is readable', () => {
    const quest = questWith({
      id: 'read-it',
      kind: 'read',
      targetId: 'a-plaque',
      passages: [{ lesson: 'a-lesson', passage: 'p-1' }],
    });
    expect(readStepFaults(quest, 'fixture', one)).toEqual([]);
  });

  it('names the step and the index of the reference that failed', () => {
    const quest = questWith({
      id: 'read-it',
      kind: 'read',
      targetId: 'a-plaque',
      passages: [{ lesson: 'a-lesson', passage: 'gone' }],
    });
    const faults = readStepFaults(quest, 'content/quests/a.json', one);
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('content/quests/a.json');
    expect(faults[0]).toContain('steps[0].passages[0]');
    expect(faults[0]).toContain('DANGLING');
  });

  it('refuses passages carried on a step that is not a read step', () => {
    /*
     * The schema's conditional already forbids this, and it is checked again
     * here for the reason `app/bootstrap/quests.ts` re-checks what the schema
     * owns: this walk reads the raw document, so it must be able to report a
     * document that got past the other gate rather than assume it could not.
     */
    const quest = questWith({
      id: 'visit-it',
      kind: 'visit',
      targetId: 'a-plaque',
      passages: [{ lesson: 'a-lesson', passage: 'p-1' }],
    });
    const faults = readStepFaults(quest, 'fixture', one);
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('"visit"');
  });

  it('reports every bad reference in one run, not the first', () => {
    const quest = questWith({
      id: 'read-it',
      kind: 'read',
      targetId: 'a-plaque',
      passages: [
        { lesson: 'a-lesson', passage: 'gone' },
        { lesson: 'no-such-lesson', passage: 'p-1' },
      ],
    });
    expect(readStepFaults(quest, 'fixture', one)).toHaveLength(2);
  });

  it('finds every reference a document carries, wherever the step sits', () => {
    const quest = {
      steps: [
        { id: 'talk', kind: 'talk', targetId: 'officer' },
        { id: 'read-1', kind: 'read', passages: [{ lesson: 'a', passage: 'x' }] },
        { id: 'answer', kind: 'answer', targetId: 'rights' },
        {
          id: 'read-2',
          kind: 'read',
          passages: [
            { lesson: 'b', passage: 'y' },
            { lesson: 'c', passage: 'z' },
          ],
        },
      ],
    };
    expect(referencesIn(quest).map((found) => found.at)).toEqual([
      'steps[1].passages[0]',
      'steps[3].passages[0]',
      'steps[3].passages[1]',
    ]);
  });
});
