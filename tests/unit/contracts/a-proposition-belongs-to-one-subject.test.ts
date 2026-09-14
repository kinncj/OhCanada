/**
 * `TN-LEVELS-03`'s last row, at the grain that carries the property.
 *
 * > its question bank has at least thirty verified questions for its subject,
 * > and **shares none of them with another level's subject**
 *
 * Until ADR-0028 that row had a floor (`question-bank-floor.test.ts` checks the
 * thirty) and no mechanism at all for the second half. Nothing stopped two
 * authors working the same pages from writing one proposition into two
 * subjects, and until ADR-0028 nobody needed to: each subject was assumed to
 * own one chapter of *Discover Canada*, so the subjects could not collide.
 *
 * That assumption was false before it was relied upon. Eleven `government`
 * questions (level 4) cite the *Federal Elections* chapter (level 5) and
 * interleave with `elections` questions on pages 60, 62 and 66. ADR-0028 makes
 * the many-to-many relation explicit - a subject is a teaching remit, a chapter
 * is where the sentences are - and points `economy` at *Modern Canada* and
 * *Canada's Regions*, which is the first time two subjects are deliberately
 * sent to one chapter. So the mechanism has to exist now.
 *
 * ## What is compared: what is GRADED, found by shape (ADR-0030)
 *
 * A proposition is graded by at most one subject, and may be TOLD by anything,
 * anywhere, as long as it is true. The three things that break when one
 * proposition counts twice - the ship floor, the exam's by-subject rows and the
 * scheduler - are all made of question documents, so a question document is
 * what "graded" means. A landmark blurb, a territorial statement, a dialogue
 * line, an explanation and a verifier's evidence are told: none of them enters
 * a floor, an exam row or a schedule, and none of them is compared here.
 *
 * The compared corpus is therefore selected by the SHAPE of a graded item -
 * `claimsIn()` from `scripts/lib/claims.mjs`, the same recogniser gate
 * `verify-content` uses, keeping `kind === 'question'` - over every non-schema
 * document under `content/`. It used to be a `readdirSync` over
 * `content/questions/`, which selected the same 486 documents on the tree
 * ADR-0030 was measured on. ADR-0019: a rule drawn round a container measures
 * the container. The directory is only where graded things live today; a
 * question moved out of it must still be compared, and a told claim that sits
 * beside a graded one must still not be.
 *
 * ## Why `source.quote` and not the prompt
 *
 * The property is *which subject grades this proposition*. ADR-0019: name the
 * property, then find the smallest thing that carries it. The chapter does not
 * carry it (pages 60-69 are the proof) and neither does the page (pages 60, 62
 * and 66 are the proof). The proposition does, and the closest thing to a
 * proposition's identity in this repository is `source.quote` - the sentence
 * the author lifted out of the guide, required by `common.schema.json`, present
 * on every question in the tree.
 *
 * It is the source's words rather than the author's, which is exactly what
 * makes it work: two authors who independently reach for one sentence produce
 * the same string, while two authors who independently write one proposition
 * produce two different prompts. Prompt equality is checked below as well, but
 * as a copy-paste catch, not as the mechanism - a gate whose false negatives
 * land on the common case is worse than no gate, because its silence reads as
 * coverage (ADR-0015).
 *
 * ## Within a subject, sharing a quote is normal, and that is pinned
 *
 * One sentence routinely carries several propositions. Page 90's NAFTA sentence
 * carries the 1988 free trade date, Mexico joining in 1994 and a 2008 trade
 * magnitude. Fourteen quotes are shared inside a subject today and every one is
 * correct authoring. The test below asserts that this is *still true*, so that
 * a later reader who tightens this gate to global quote uniqueness finds out
 * from a failure rather than from fourteen deleted questions.
 *
 * ## What this does not catch, said plainly
 *
 * Two authors paraphrasing one proposition from two different sentences. No
 * string in this repository identifies a paraphrase and there will not be one.
 * That check belongs to the `content-verifier`, who reads the chapter; ADR-0028
 * records it as a rule enforced by review rather than by CI. This file is a
 * tripwire on the machine-visible half.
 *
 * It can also fire *wrongly*, when one sentence genuinely carries two
 * propositions that belong to two remits. That is a loud failure with a named
 * remedy in its message - narrow one quote to the clause its question actually
 * rests on - and a loud false positive is the correct trade against a silent
 * false negative.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  claimsIn,
  isFactClaim,
  isQuestionDocument,
  isSchemaDocument,
} from '../../../scripts/lib/claims.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTENT_DIR = `${REPO_ROOT}content`;

interface QuestionLike {
  readonly id: string;
  readonly subject: string;
  readonly prompt: { readonly en: string; readonly fr: string };
  readonly source: { readonly sourceId: string; readonly quote: string };
}

/** One parsed document under `content/`, addressed by its repo-relative path. */
interface ContentDocument {
  readonly where: string;
  readonly root: unknown;
}

/** One item the gate compares, and the claim record it was selected from. */
interface GradedItem {
  readonly where: string;
  readonly pointer: string;
  readonly kind: 'question' | 'fact';
  readonly question: QuestionLike;
}

/**
 * Enough normalisation that quoting the same sentence twice produces one key,
 * and no more. Case, diacritics, the punctuation a copy out of a PDF picks up,
 * and whitespace. Nothing that could merge two different sentences: no
 * stemming, no stop-word removal, no truncation.
 */
export const normaliseQuote = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

/**
 * The GRADED items among a set of documents, by shape (ADR-0030).
 *
 * Every claim `claimsIn()` finds, kept only when it is a question - the one
 * shape that enters a floor, an exam row and a schedule. Schema documents are
 * skipped by the same predicate `verify-content` skips them by. Exported so the
 * fixtures below can prove the selection both ways: it must find a question
 * wherever it lives, and it must not find a told claim however closely that
 * claim's quote matches a question's.
 */
export const gradedItems = (documents: readonly ContentDocument[]): readonly GradedItem[] =>
  documents.flatMap(({ where, root }) =>
    isSchemaDocument(where)
      ? []
      : claimsIn(root, where)
          .filter((claim) => claim.kind === 'question')
          .map((claim) => ({
            where: claim.where,
            pointer: claim.pointer,
            kind: claim.kind,
            question: claim.document as QuestionLike,
          })),
  );

/**
 * Every way two questions can be found to grade one proposition, as strings.
 * Exported so the fixtures below can prove the gate fails, rather than proving
 * the corpus passes - a green run over a clean tree is evidence about the tree,
 * not about the gate (`TN-LEVELS-02`).
 */
export const subjectClaimFaults = (questions: readonly QuestionLike[]): readonly string[] => {
  const faults: string[] = [];

  const byQuote = new Map<string, QuestionLike[]>();
  const byPrompt = new Map<string, QuestionLike[]>();

  for (const question of questions) {
    const quote = question.source.quote;
    if (quote.trim() === '') {
      faults.push(
        `${question.subject}/${question.id}: source.quote is empty. The quote is what identifies ` +
          `the proposition this question grades (ADR-0028), so a question without one cannot be ` +
          `checked against another subject's claim and silently exempts itself from this gate.`,
      );
      continue;
    }
    const quoteKey = `${question.source.sourceId} ${normaliseQuote(quote)}`;
    byQuote.set(quoteKey, [...(byQuote.get(quoteKey) ?? []), question]);

    for (const locale of ['en', 'fr'] as const) {
      const promptKey = `${locale} ${normaliseQuote(question.prompt[locale])}`;
      byPrompt.set(promptKey, [...(byPrompt.get(promptKey) ?? []), question]);
    }
  }

  for (const [, sharing] of byQuote) {
    const subjects = [...new Set(sharing.map((entry) => entry.subject))].sort();
    if (subjects.length < 2) continue;
    const where = sharing.map((entry) => `${entry.subject}/${entry.id}`).sort();
    faults.push(
      `${where.join(' and ')} rest on the same sentence of ${sharing[0]?.source.sourceId ?? '?'} ` +
        `while belonging to different subjects (${subjects.join(', ')}). TN-LEVELS-03: a level's ` +
        `bank "shares none of them with another level's subject", and two subjects grading one ` +
        `sentence is what that forbids. Quote: "${sharing[0]?.source.quote ?? ''}". Either one ` +
        `subject drops the question - ADR-0028 says the question that already exists keeps the ` +
        `claim - or, if the sentence genuinely carries two propositions for two remits, narrow ` +
        `each quote to the clause its own question rests on.`,
    );
  }

  for (const [key, sharing] of byPrompt) {
    if (sharing.length < 2) continue;
    const where = sharing.map((entry) => `${entry.subject}/${entry.id}`).sort();
    faults.push(
      `${where.join(' and ')} ask the same question word for word in "${key.slice(0, 2)}". Two ` +
        `identical prompts are one question twice however they are filed; a learner meets the ` +
        `same card under two names and the scheduler treats them as two facts.`,
    );
  }

  return faults;
};

const jsonFilesUnder = (dir: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return jsonFilesUnder(path);
        return entry.isFile() && path.endsWith('.json') ? [path] : [];
      })
    : [];

/** Every document under `content/`, schemas included - `gradedItems` is what skips them. */
const readContent = (): readonly ContentDocument[] =>
  jsonFilesUnder(CONTENT_DIR).map((path) => ({
    where: path.slice(REPO_ROOT.length),
    root: JSON.parse(readFileSync(path, 'utf8')) as unknown,
  }));

const q = (over: Partial<QuestionLike> & Pick<QuestionLike, 'id' | 'subject'>): QuestionLike => ({
  prompt: { en: `prompt ${over.id}`, fr: `question ${over.id}` },
  source: { sourceId: 'discover-canada', quote: `sentence ${over.id}` },
  ...over,
});

const quoting = (id: string, subject: string, quote: string, sourceId = 'discover-canada') =>
  q({ id, subject, source: { sourceId, quote } });

describe('the gate is proven by a failing case, not by a green run', () => {
  it('rejects one sentence claimed by two subjects', () => {
    const faults = subjectClaimFaults([
      quoting('a', 'economy', 'Alberta produces oil.'),
      quoting('b', 'regions', 'Alberta produces oil.'),
    ]);
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('economy/a and regions/b');
    expect(faults[0]).toContain('TN-LEVELS-03');
    expect(faults[0]).toContain('two subjects grading one sentence');
  });

  it('sees through casing, accents and the punctuation a PDF copy carries', () => {
    expect(
      subjectClaimFaults([
        quoting('a', 'economy', '"Québec produces hydro-electricity."'),
        quoting('b', 'regions', 'Quebec produces hydro electricity'),
      ]),
    ).toHaveLength(1);
  });

  it('allows two subjects to quote different sentences of one chapter', () => {
    expect(
      subjectClaimFaults([
        quoting('a', 'economy', 'Alberta produces oil.'),
        quoting('b', 'regions', 'Edmonton is the capital of Alberta.'),
      ]),
    ).toEqual([]);
  });

  it('allows one subject to draw several propositions from one sentence', () => {
    /* Page 90's NAFTA sentence carries 1988, 1994 and a 2008 magnitude. This is
       the case a global uniqueness rule would break, and it is why the rule is
       scoped to a subject boundary rather than to the corpus. */
    const sentence = 'In 1988, Canada enacted free trade with the United States.';
    expect(
      subjectClaimFaults([
        quoting('a', 'economy', sentence),
        quoting('b', 'economy', sentence),
      ]),
    ).toEqual([]);
  });

  it('does not collide two sentences that merely read alike in different sources', () => {
    expect(
      subjectClaimFaults([
        quoting('a', 'economy', 'Alberta produces oil.'),
        quoting('b', 'regions', 'Alberta produces oil.', 'statcan'),
      ]),
    ).toEqual([]);
  });

  it('rejects an empty quote, which would otherwise exempt itself', () => {
    const faults = subjectClaimFaults([quoting('a', 'economy', '   ')]);
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('source.quote is empty');
  });

  it('rejects the same prompt filed twice, in either language', () => {
    expect(
      subjectClaimFaults([
        q({ id: 'a', subject: 'economy', prompt: { en: 'What does Canada sell?', fr: 'Alpha?' } }),
        q({ id: 'b', subject: 'regions', prompt: { en: 'what does canada sell', fr: 'Beta?' } }),
      ]).filter((fault) => fault.includes('word for word')),
    ).toHaveLength(1);
    expect(
      subjectClaimFaults([
        q({ id: 'a', subject: 'economy', prompt: { en: 'Alpha?', fr: 'Que vend le Canada?' } }),
        q({ id: 'b', subject: 'economy', prompt: { en: 'Beta?', fr: 'Que vend le Canada?' } }),
      ]).filter((fault) => fault.includes('word for word')),
    ).toHaveLength(1);
  });
});

/*
 * THE SELECTION, PROVED BOTH WAYS (ADR-0030). A directory scope fails the first
 * case - it never reads the moved question, so the collision goes unseen. A
 * scope widened to every quoted claim fails the second - it compares a blurb
 * with a question and refuses a told claim ADR-0030 rules legal.
 */
const SENTENCE = 'Alberta produces oil.';

/** A question document as the corpus carries one: prompt, options, correctIndex. */
const questionDocument = (id: string, subject: string): QuestionLike & Record<string, unknown> => ({
  ...quoting(id, subject, SENTENCE),
  options: [
    { en: 'Yes.', fr: 'Oui.' },
    { en: 'No.', fr: 'Non.' },
    { en: 'Sometimes.', fr: 'Parfois.' },
    { en: 'Never.', fr: 'Jamais.' },
  ],
  correctIndex: 0,
  verification: null,
});

/** A level in another subject whose blurb TELLS the same sentence. */
const tellingLevel = (subject: string): Record<string, unknown> => ({
  id: 'a-level',
  subject,
  pois: [
    {
      id: 'a-well',
      name: { en: 'A well', fr: 'Un puits' },
      blurb: {
        en: 'This province pumps a lot of oil.',
        fr: 'Cette province pompe beaucoup de petrole.',
      },
      fact: {
        factual: true,
        source: { sourceId: 'discover-canada', quote: SENTENCE },
        verification: null,
      },
    },
  ],
});

describe('what is compared is what is graded, selected by shape (ADR-0030)', () => {
  it('compares a question wherever it lives, not only under content/questions/', () => {
    const graded = gradedItems([
      { where: 'content/questions/economy/a.json', root: questionDocument('a', 'economy') },
      { where: 'content/bank-moved/regions/b.json', root: questionDocument('b', 'regions') },
    ]);
    expect(graded.map((item) => item.where)).toEqual([
      'content/questions/economy/a.json',
      'content/bank-moved/regions/b.json',
    ]);
    expect(subjectClaimFaults(graded.map((item) => item.question))).toHaveLength(1);
  });

  it('does not compare a told claim, however exactly it quotes another subject', () => {
    const documents = [
      { where: 'content/questions/economy/a.json', root: questionDocument('a', 'economy') },
      { where: 'content/levels/a-level.json', root: tellingLevel('regions') },
    ];
    // The told claim is really there to be excluded: the recogniser finds it.
    expect(
      documents.flatMap(({ where, root }) => claimsIn(root, where)).map((claim) => claim.kind),
    ).toEqual(['question', 'fact']);
    const graded = gradedItems(documents);
    expect(graded.map((item) => item.where)).toEqual(['content/questions/economy/a.json']);
    expect(subjectClaimFaults(graded.map((item) => item.question))).toEqual([]);
  });

  it('never compares a document under content/schemas/, even one shaped like a question', () => {
    // Question-shaped at its ROOT, so the recogniser alone would take it; the
    // path exclusion `verify-content` uses is what keeps it out, and this is
    // the case that proves the selection applies it.
    const shaped = questionDocument('s', 'economy');
    expect(claimsIn(shaped, 'content/schemas/example.json').map((claim) => claim.kind)).toEqual([
      'question',
    ]);
    expect(gradedItems([{ where: 'content/schemas/example.json', root: shaped }])).toEqual([]);
  });
});

describe('no proposition is graded by two subjects (TN-LEVELS-03, ADR-0028, ADR-0030)', () => {
  const content = readContent();
  const graded = gradedItems(content);
  const corpus = graded.map((item) => item.question);

  it('reads a bank at all', () => {
    /* The floor under every check below: this whole file passes over an empty
       array, which is the failure ADR-0024 names. */
    expect(corpus.length).toBeGreaterThan(100);
    expect(new Set(corpus.map((question) => question.subject)).size).toBeGreaterThan(1);
    for (const question of corpus) expect(question.source.quote.trim().length).toBeGreaterThan(0);
  });

  it('compares graded items only, and never a told claim', () => {
    /* Pins ADR-0030's ruling the way the test below pins ADR-0028's exemption.
       The corpus has told claims to exclude - this floor is what stops the
       assertion after it holding over a tree that has none. */
    const told = content.flatMap(({ where, root }) =>
      isSchemaDocument(where) ? [] : claimsIn(root, where).filter((claim) => claim.kind === 'fact'),
    );
    expect(told.length).toBeGreaterThan(0);

    const notGraded = graded.filter(
      (item) =>
        item.kind !== 'question' ||
        item.pointer !== '' ||
        !isQuestionDocument(item.question) ||
        isFactClaim(item.question),
    );
    expect(
      notGraded.map((item) => `${item.where} at ${item.pointer === '' ? '(document)' : item.pointer}`),
      `the proposition gate compared something that is not a question document. Under ADR-0030 a ` +
        `subject owns the propositions its questions GRADE, not the ones its levels and quests ` +
        `TELL: landmark blurbs, territorial statements, dialogue lines, explanations and evidence ` +
        `are outside this rule, because none of them enters a ship floor, an exam row or a ` +
        `schedule. Nine told claims on the tree ADR-0030 was measured on share a sentence with a ` +
        `question in another subject - streetcar, nathan-phillips-square, cn-tower, ` +
        `library-of-parliament, container-car, marina, granite-shore and two dialogue lines - and ` +
        `a gate widened to told claims would refuse every one of them for a harm none of them ` +
        `can cause. Select graded items by shape, and only those.`,
    ).toEqual([]);
  });

  it('still has subjects that draw more than one proposition from one sentence', () => {
    /* Pins the exemption ADR-0028 relies on. If this ever reaches zero, the
       within-subject case has stopped being exercised by the corpus and the
       fixture above is the only thing holding it. */
    const byQuote = new Map<string, number>();
    for (const question of corpus) {
      const key = `${question.subject} ${normaliseQuote(question.source.quote)}`;
      byQuote.set(key, (byQuote.get(key) ?? 0) + 1);
    }
    expect([...byQuote.values()].filter((count) => count > 1).length).toBeGreaterThan(0);
  });

  it('has no sentence graded by two subjects', () => {
    expect(subjectClaimFaults(corpus)).toEqual([]);
  });
});
