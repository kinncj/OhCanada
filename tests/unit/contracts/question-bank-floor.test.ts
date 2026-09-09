/**
 * The build gate for CLAUDE.md's content rules, read off the tree with `fs`.
 *
 * ## Why this is a gate and not a runtime check
 *
 * ">= 30 verified questions per subject before that level ships" is a statement
 * about *shipping*, not about a drill. Enforcing it inside `ContentRepository`
 * would black out Study for a subject sitting at twenty-nine, which contradicts
 * TN-STUDY-02's "a drill can be shorter than the drill size" and turns an
 * authoring backlog into a runtime outage a player cannot tell from a bug. So
 * the adapter refuses only *zero* (`MIN_SHIPPABLE_PER_SUBJECT`) and the
 * threshold is checked here, where a breach fails CI with the subject named.
 *
 * ## Which subjects it applies to
 *
 * The rule's own words are "before that **level** ships", so the subjects it
 * binds are the ones a level document declares — read from `content/levels/`,
 * not from the question directories. That distinction is not pedantry, it is
 * the difference between a gate that is useful and one that is always red: a
 * subject being authored with no level yet reaches no player, is skipped by
 * `loadEveryBank` and cannot be drawn from by name, and holding it to a
 * shipping threshold would fail CI for the whole time anybody is writing it.
 * Four of the five subjects in this repository passed through exactly that
 * state.
 *
 * The moment a level names a subject, that subject is being shipped and the
 * threshold applies. That is the transition the rule is about, and the failure
 * message names the level rather than the directory, because the level is the
 * thing that may not go out.
 *
 * `shippingSubjects` is deliberately floor-checked. "Every shipping subject has
 * 30" over zero levels is the vacuous pass this whole file exists to refuse,
 * and `it.each([])` registers no test at all and reports a green file.
 *
 * ## Why `fs` and not the adapter
 *
 * The adapter reads what the bundler globbed. This reads what is on disk. They
 * should agree, and the last assertion checks that they do — but a gate that can
 * only see through the thing it is guarding cannot catch a glob that quietly
 * stopped matching, which is the first failure ADR-0024 names.
 *
 * ## The anti-vacuity floor
 *
 * Every count below is a floor as well as a comparison. `every([])` is true, so
 * "every subject has 30 verified questions" passes over zero subjects, and
 * "every question is bilingual" passes over an empty directory. The three
 * `toBeGreaterThan` assertions at the top are what stop this file reporting a
 * green run about a tree that is not there.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUNDLED_QUESTION_MODULES, questionAddress } from '@adapters/content';
import { SUBJECT_SHIP_THRESHOLD } from '@application/content/question-bank';

const BANK_DIR = fileURLToPath(new URL('../../../content/questions/', import.meta.url));
const LEVEL_DIR = fileURLToPath(new URL('../../../content/levels/', import.meta.url));

interface RawQuestion {
  readonly id: string;
  readonly subject: string;
  readonly prompt: { readonly en: string; readonly fr: string };
  readonly source: { readonly sourceHash: string };
  readonly verification: {
    readonly status: string;
    readonly sourceHash: string;
    readonly evidence: string;
  };
}

const subjectDirs = (): readonly string[] =>
  readdirSync(BANK_DIR).filter((name) => statSync(`${BANK_DIR}${name}`).isDirectory());

const documentsIn = (subject: string): readonly { file: string; document: RawQuestion }[] =>
  readdirSync(`${BANK_DIR}${subject}`)
    .filter((name) => name.endsWith('.json'))
    .map((file) => ({
      file,
      document: JSON.parse(readFileSync(`${BANK_DIR}${subject}/${file}`, 'utf8')) as RawQuestion,
    }));

/**
 * Level id -> the subject it teaches, from `content/levels/*.json`.
 *
 * A file that will not parse is skipped rather than thrown on: level documents
 * are authored continuously and a half-written one is not evidence about the
 * question bank. The floor below is what stops that leniency turning into an
 * empty list nobody notices.
 */
const shippingSubjects = (): ReadonlyMap<string, string> => {
  const byLevel = new Map<string, string>();
  for (const name of readdirSync(LEVEL_DIR)) {
    if (!name.endsWith('.json')) continue;
    try {
      const level = JSON.parse(readFileSync(`${LEVEL_DIR}${name}`, 'utf8')) as {
        readonly id?: unknown;
        readonly subject?: unknown;
      };
      if (typeof level.id === 'string' && typeof level.subject === 'string') {
        byLevel.set(level.id, level.subject);
      }
    } catch {
      continue;
    }
  }
  return byLevel;
};

const shippable = (document: RawQuestion): boolean =>
  document.verification.status === 'verified' &&
  document.verification.sourceHash === document.source.sourceHash &&
  document.verification.evidence.trim().length > 0 &&
  document.prompt.en.trim().length > 0 &&
  document.prompt.fr.trim().length > 0;

describe('the question bank on disk', () => {
  const subjects = subjectDirs();
  const levels = shippingSubjects();
  /** `[levelId, subjectId]` for every level that names a subject. */
  const shipping = [...levels.entries()];

  it('exists at all', () => {
    /* The floor under every `every` below. A missing or renamed directory makes
       this file pass silently in the absence of these three lines. */
    expect(subjects.length).toBeGreaterThan(0);
    const total = subjects.reduce((sum, subject) => sum + documentsIn(subject).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(
      subjects.reduce(
        (sum, subject) => sum + documentsIn(subject).filter((e) => shippable(e.document)).length,
        0,
      ),
    ).toBeGreaterThan(0);
  });

  it('has levels naming subjects, so the threshold below binds something', () => {
    /* The floor under the `it.each`. `it.each([])` registers no test and reports
       a green file, which is the exact shape of a gate that stopped gating. */
    expect(shipping.length).toBeGreaterThan(0);
    for (const [, subject] of shipping) expect(subjects).toContain(subject);
  });

  it.each(shipping)(
    `%s teaches %s, which needs at least ${SUBJECT_SHIP_THRESHOLD} verified questions`,
    (levelId, subject) => {
      const documents = documentsIn(subject);
      expect(documents.length).toBeGreaterThan(0);
      const verified = documents.filter((entry) => shippable(entry.document));
      expect(
        verified.length,
        `content/levels/${levelId}.json teaches "${subject}", and ` +
          `content/questions/${subject}/ has ${verified.length} shippable question(s) of ` +
          `${documents.length}. CLAUDE.md: ">= 30 verified questions per subject before that ` +
          `level ships". Either the bank is finished or the level does not go out.`,
      ).toBeGreaterThanOrEqual(SUBJECT_SHIP_THRESHOLD);
    },
  );

  it.each(subjects)('%s files are named for the id they declare', (subject) => {
    const documents = documentsIn(subject);
    expect(documents.length).toBeGreaterThan(0);
    for (const entry of documents) {
      expect(entry.document.id).toBe(entry.file.slice(0, -'.json'.length));
      expect(entry.document.subject).toBe(subject);
    }
  });

  it('is the same set the bundler globbed', () => {
    const onDisk = new Set(
      subjects.flatMap((subject) => documentsIn(subject).map((e) => `${subject}/${e.document.id}`)),
    );
    const globbed = new Set(
      Object.keys(BUNDLED_QUESTION_MODULES).flatMap((path) => {
        const address = questionAddress(path);
        return address === null ? [] : [`${address.subject}/${address.id}`];
      }),
    );
    expect(globbed.size).toBeGreaterThan(0);
    expect([...globbed].sort()).toEqual([...onDisk].sort());
  });
});
