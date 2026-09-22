/**
 * The runtime and the CI gate decide "may a player read this passage?" the same
 * way — driven over one matrix, and over all 302 shipped passages.
 *
 * ## Why there are two implementations at all, and why that is not fixable
 *
 * `scripts/lib/lesson-passages.mjs` is ADR-0063's infra gate: plain Node, no
 * build step, run by `make verify-content` over `content/**`. The runtime route
 * is `app/application/content/lesson-passages.ts`, which ADR-0063 §6 places in
 * `app/application` so the level reader and the Learn reader cannot disagree
 * about what is readable.
 *
 * **The runtime may not reuse the tooling.** `.dependency-cruiser.cjs`'s
 * `no-tooling-in-runtime` keeps `scripts/` out of the bundle, and it is right
 * to: `lesson-passages.mjs` reads the file system. So one rule is written twice,
 * `docs/architecture.md` §6 says so out loud rather than after the fact, and
 * **this file is what the second writer owes the first**. It is the same
 * arrangement `a-claim-draws-only-when-verified.test.ts` holds between the
 * domain's copy of ADR-0003 and the adapter's, for the same reason.
 *
 * ## What is NOT duplicated, which is the part worth noticing
 *
 * ADR-0003's three conditions are **not** in the application module. It takes an
 * `AdjudicateClaim` and the composition root supplies one from the one rule
 * (`app/bootstrap/verified-passages.ts` ->
 * `app/adapters/phaser/verified-claim.ts`), because
 * `one-rule-decides-what-may-be-drawn.test.ts` allows no third copy in `app/`
 * and `app/application` may not import an adapter. So the runtime path actually
 * exercises **the game's own ADR-0003**, which is why driving it against the
 * tooling here compares three implementations' worth of agreement in two calls.
 *
 * What the application module owns by itself is the one condition ADR-0003 does
 * not state: `factual: false` is a refusal for a lesson passage (ADR-0061 §9.3),
 * where it is an exemption for a greeting. That is in the matrix below.
 *
 * ## What is compared
 *
 * `readable` and `why`, per case and per shipped passage, and the resolution
 * verdict (`ok`, `why`, `count`) for the same references. Not the messages: they
 * are written for different readers — one prints to a CI log naming a file and a
 * JSON pointer, the other reaches a browser console — and asserting they match
 * would be asserting the wrong thing and would make both harder to improve.
 */

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  passageVerdict as toolingVerdict,
  readLessonCorpus,
  resolvePassage as toolingResolve,
  type CorpusPassage,
} from '../../../scripts/lib/lesson-passages.mjs';

import {
  passageVerdict as runtimeVerdict,
  resolvePassage as runtimeResolve,
  type PassageRefusal,
} from '@application/content/lesson-passages';
import type { FactClaim, LessonDocument, LessonPassage } from '@application/ports';

import { grantsPassage } from '../../../app/bootstrap/verified-passages';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const corpus = readLessonCorpus(REPO_ROOT);

/* -------------------------------------------------------------------------- */
/* the matrix                                                                 */
/* -------------------------------------------------------------------------- */

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);

const claim = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  factual: true,
  source: {
    sourceId: 'discover-canada',
    chapter: 'Canada in Brief',
    page: 1,
    url: 'https://example.invalid/',
    sourceHash: HASH,
    asOf: '2026-01-01T00:00:00Z',
    volatile: false,
    quote: 'Something the guide says.',
  },
  verification: {
    status: 'verified',
    model: 'test',
    checkedAt: '2026-01-02T00:00:00Z',
    sourceHash: HASH,
    evidence: 'Something the guide says.',
  },
  ...over,
});

const withVerification = (over: Record<string, unknown>): Record<string, unknown> =>
  claim({ verification: { ...(claim()['verification'] as object), ...over } });

/**
 * Every case both implementations must answer identically, with the answer
 * written down so the pair cannot agree on the *wrong* thing — two copies that
 * drifted the same way would still pass a bare "they agree".
 */
const MATRIX: readonly {
  readonly name: string;
  readonly fact: Record<string, unknown>;
  readonly readable: boolean;
  readonly why: PassageRefusal | null;
}[] = [
  { name: 'verified for the hash it cites, with evidence', fact: claim(), readable: true, why: null },
  {
    name: 'unverified',
    fact: withVerification({ status: 'unverified', evidence: '', checkedAt: null }),
    readable: false,
    why: 'not-verified',
  },
  {
    name: 'quarantined by the clock (ADR-0016)',
    fact: withVerification({ status: 'quarantined' }),
    readable: false,
    why: 'not-verified',
  },
  {
    name: 'rejected by the verifier',
    fact: withVerification({ status: 'rejected' }),
    readable: false,
    why: 'not-verified',
  },
  {
    name: 'verified for a hash the passage no longer cites',
    fact: withVerification({ sourceHash: OTHER_HASH }),
    readable: false,
    why: 'stale',
  },
  {
    name: 'verified with no evidence quoted',
    fact: withVerification({ evidence: '' }),
    readable: false,
    why: 'unevidenced',
  },
  {
    name: 'verified with only whitespace for evidence',
    fact: withVerification({ evidence: '   \n ' }),
    readable: false,
    why: 'unevidenced',
  },
  {
    /* ADR-0061 §9.3: the one condition ADR-0003 does not state. A greeting in an
       NPC's mouth is exempt; a paragraph of the guide that asserts nothing
       teaches nothing. */
    name: 'factual: false',
    fact: { factual: false, source: null, verification: null },
    readable: false,
    why: 'not-factual',
  },
  {
    name: 'factual with no source block at all',
    fact: { factual: true, source: null, verification: null },
    readable: false,
    why: 'unreadable',
  },
  {
    /*
     * The case that caught a real divergence on this branch's first CI run. The
     * tooling read any non-`verified` string as `not-verified`; the runtime
     * refuses a status no schema allows through `readFactClaim`. The runtime was
     * right — `not-verified` means a verifier DECIDED something, and carries
     * which — so `scripts/lib/lesson-passages.mjs` now reads before it
     * adjudicates, in the runtime's own order.
     */
    name: 'factual with a verification block nothing can read',
    fact: { factual: true, source: { sourceHash: HASH }, verification: { status: 'granted' } },
    readable: false,
    why: 'unreadable',
  },
  {
    name: 'a status that is not even a string',
    fact: withVerification({ status: 42 }),
    readable: false,
    why: 'unreadable',
  },
  {
    name: 'a grant whose own sourceHash is not a string',
    fact: withVerification({ sourceHash: 7 }),
    readable: false,
    why: 'unreadable',
  },
  {
    name: 'a grant whose evidence is not a string',
    fact: withVerification({ evidence: null }),
    readable: false,
    why: 'unreadable',
  },
  {
    name: 'a source whose own sourceHash is not a string',
    fact: claim({ source: { sourceHash: 9 } }),
    readable: false,
    why: 'unreadable',
  },
];

const asRuntime = (fact: Record<string, unknown>): LessonPassage => ({
  id: 'p1',
  text: { en: 'A paragraph.', fr: 'Un paragraphe.' },
  fact: fact as unknown as FactClaim,
});

const asTooling = (fact: Record<string, unknown>): CorpusPassage =>
  ({
    id: 'p1',
    index: 0,
    pointer: '/passages/0',
    fact,
    text: { en: 'A paragraph.', fr: 'Un paragraphe.' },
  }) as unknown as CorpusPassage;

describe('one readable-passage rule, written twice and watched', () => {
  it('has a matrix and a corpus to compare over (ADR-0024)', () => {
    expect(MATRIX.length).toBeGreaterThan(6);
    expect(corpus.faults).toEqual([]);
    expect(corpus.passageCount).toBeGreaterThan(0);
  });

  for (const useCase of MATRIX) {
    it(`agrees on a passage that is ${useCase.name}`, () => {
      const runtime = runtimeVerdict(asRuntime(useCase.fact), grantsPassage);
      const tooling = toolingVerdict(asTooling(useCase.fact));

      /* Written down, so the two cannot agree on the wrong answer. */
      expect(runtime.readable, `the runtime disagrees with the expected verdict`).toBe(
        useCase.readable,
      );
      expect(runtime.why).toBe(useCase.why);

      expect(
        { readable: tooling.readable, why: tooling.why },
        `scripts/lib/lesson-passages.mjs and app/application/content/lesson-passages.ts ` +
          `disagree about a passage that is ${useCase.name}. One rule, two implementations ` +
          `(docs/architecture.md §6): fix both or neither.`,
      ).toEqual({ readable: runtime.readable, why: runtime.why });
    });
  }

  /* ------------------------------------------------------------------ */
  /* and over every passage the build actually ships                     */
  /* ------------------------------------------------------------------ */

  it('agrees about every shipped passage, one by one', () => {
    const disagreements: string[] = [];
    let compared = 0;

    for (const lesson of corpus.lessons) {
      for (const passage of lesson.passages) {
        compared += 1;
        const tooling = toolingVerdict(passage);
        const runtime = runtimeVerdict(
          asRuntime((passage.fact ?? { factual: false }) as Record<string, unknown>),
          grantsPassage,
        );
        if (tooling.readable !== runtime.readable || tooling.why !== runtime.why) {
          disagreements.push(
            `${lesson.where}${passage.pointer}: tooling says ${String(tooling.readable)}/` +
              `${String(tooling.why)}, runtime says ${String(runtime.readable)}/` +
              `${String(runtime.why)}`,
          );
        }
      }
    }

    expect(disagreements, disagreements.join('\n')).toEqual([]);
    /* The floor, because a walk over nothing folds to a pass (ADR-0024). */
    expect(compared).toBe(corpus.passageCount);
    expect(compared).toBeGreaterThan(300);
  });

  it('finds every shipped passage readable, by both, so this is not a pass on refusals', () => {
    /*
     * Two implementations that both refused everything would agree perfectly and
     * mean nothing. The shipped corpus is entirely granted, so both must say so.
     */
    const unreadable = corpus.lessons.flatMap((lesson) =>
      lesson.passages
        .filter(
          (passage) =>
            !runtimeVerdict(
              asRuntime((passage.fact ?? { factual: false }) as Record<string, unknown>),
              grantsPassage,
            ).readable,
        )
        .map((passage) => `${lesson.where}${passage.pointer}`),
    );
    expect(unreadable, unreadable.join('\n')).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /* resolution: exactly one, or the same named failure                  */
  /* ------------------------------------------------------------------ */

  const documents: readonly LessonDocument[] = corpus.lessons.map((lesson) => ({
    $schema: '../../schemas/lesson.schema.json',
    id: lesson.id,
    chapter: lesson.chapter,
    order: 1,
    title: { en: lesson.id, fr: lesson.id },
    passages: lesson.passages.map((passage) => ({
      id: passage.id,
      text: { en: 'x', fr: 'x' },
      fact: (passage.fact ?? { factual: false }) as unknown as FactClaim,
    })),
  }));

  it('resolves every shipped pair to exactly one, by both', () => {
    const disagreements: string[] = [];
    let resolved = 0;
    for (const lesson of corpus.lessons) {
      for (const passage of lesson.passages) {
        const reference = { lesson: lesson.id, passage: passage.id };
        const tooling = toolingResolve(corpus, reference);
        const runtime = runtimeResolve(documents, reference);
        if (tooling.ok !== runtime.ok || tooling.count !== runtime.count) {
          disagreements.push(`${lesson.where}${passage.pointer}`);
          continue;
        }
        if (runtime.ok) resolved += 1;
      }
    }
    expect(disagreements, disagreements.join('\n')).toEqual([]);
    expect(resolved).toBe(corpus.passageCount);
  });

  it('fails the same way on a reference that names nothing, and on half a pair', () => {
    const dangling = { lesson: 'no-such-lesson', passage: 'no-such-passage' };
    const tooling = toolingResolve(corpus, dangling);
    const runtime = runtimeResolve(documents, dangling);
    expect(runtime.ok).toBe(false);
    expect(tooling.ok).toBe(false);
    expect(runtime.ok ? null : runtime.why).toBe(tooling.ok ? null : tooling.why);
    expect(runtime.count).toBe(0);

    /*
     * An EMPTY half is a string, so it is a pair naming a passage that is not
     * there: `dangling`, in both. `malformed` is reserved for a reference that
     * is not a pair at all, and the two implementations draw that line in the
     * same place on purpose — classifying one reference two ways is precisely
     * the drift this file exists to catch.
     */
    const half = { lesson: 'govern-01-a-federal-state', passage: '' };
    const toolingHalf = toolingResolve(corpus, half);
    const runtimeHalf = runtimeResolve(documents, half);
    expect(runtimeHalf.ok).toBe(false);
    expect(runtimeHalf.ok ? null : runtimeHalf.why).toBe(toolingHalf.ok ? null : toolingHalf.why);
    expect(runtimeHalf.ok ? null : runtimeHalf.why).toBe('dangling');

    /* And a reference that is not a pair at all. */
    const notAPair = { lesson: 'govern-01-a-federal-state' } as unknown as {
      lesson: string;
      passage: string;
    };
    const runtimeNotAPair = runtimeResolve(documents, notAPair);
    const toolingNotAPair = toolingResolve(corpus, notAPair);
    expect(runtimeNotAPair.ok).toBe(false);
    expect(runtimeNotAPair.ok ? null : runtimeNotAPair.why).toBe('malformed');
    expect(toolingNotAPair.ok ? null : toolingNotAPair.why).toBe('malformed');
  });

  it('fails the same way on a pair two passages answer to', () => {
    /*
     * Built rather than found: all 302 shipped ids are distinct, which is luck
     * and not a contract (ADR-0063 §4), so the case has to be constructed for
     * either implementation to be asked about it at all.
     */
    const twice = {
      id: 'doubled-lesson',
      chapter: 'Canada in Brief',
      where: 'content/lessons/x/doubled-lesson.json',
      passages: [
        { id: 'p1', index: 0, pointer: '/passages/0', fact: claim(), text: { en: 'a', fr: 'a' } },
        { id: 'p1', index: 1, pointer: '/passages/1', fact: claim(), text: { en: 'b', fr: 'b' } },
      ],
    };
    const shadow = {
      lessons: [twice],
      chapters: ['x'],
      faults: [],
      lessonCount: 1,
      passageCount: 2,
    };

    const reference = { lesson: 'doubled-lesson', passage: 'p1' };
    const tooling = toolingResolve(shadow as unknown as Parameters<typeof toolingResolve>[0], reference);
    const runtime = runtimeResolve(
      [
        {
          $schema: 's',
          id: 'doubled-lesson',
          chapter: 'Canada in Brief',
          order: 1,
          title: { en: 'a', fr: 'a' },
          passages: twice.passages.map((passage) => ({
            id: passage.id,
            text: passage.text,
            fact: passage.fact as unknown as FactClaim,
          })),
        },
      ],
      reference,
    );

    expect(runtime.ok).toBe(false);
    expect(runtime.ok ? null : runtime.why).toBe('ambiguous');
    expect(runtime.count).toBe(2);
    expect(tooling.ok ? null : tooling.why).toBe(runtime.ok ? null : runtime.why);
    expect(tooling.count).toBe(runtime.count);
  });
});
