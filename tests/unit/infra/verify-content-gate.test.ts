/**
 * Slice 1 task 1.17's gate, proved on fixtures.
 *
 * `verify-content` is the thing standing between an agent and marking its own
 * work verified, now that the `Write(content/questions/**)` permission prompt is
 * gone. A gate that detects false claims and itself makes one would be a poor
 * joke, so every failure mode below is proved SEPARATELY, and every rule has a
 * matching case proving it does NOT fire on the legitimate shape it is closest
 * to. A gate with no negative cases is a gate nobody has shown can pass.
 *
 * Each case drives the real CLI - argv, exit code, stdout, stderr - over a
 * scratch tree, and for the separation-of-duties gate a scratch GIT REPOSITORY
 * with real commits, because "what did this commit do to this document" is the
 * only question that gate asks and it cannot be asked of a directory.
 *
 * The anti-vacuum cases at the bottom are not decoration. The credit gate spent
 * a whole slice reporting green over an empty directory; `verify-content`
 * returning OK over an empty `content/questions/` would be the same defect in a
 * more dangerous place.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/verify-content.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'verify-content-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* The fixture source                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Short enough to reason about, long enough that the text checks have something
 * to bite on. Every quote, evidence span and verbatim case below is written
 * against these exact sentences, so a case that passes or fails does so for a
 * reason that can be read here rather than inferred from a 19,000-word PDF.
 */
const SOURCE_TEXT = [
  'Canada is a constitutional monarchy, a parliamentary democracy and a federal state.',
  'Parliament has three parts: the Sovereign, the Senate and the House of Commons.',
  'A bill must pass both Houses before it receives royal assent and becomes law.',
  'The Governor General is appointed by the Sovereign on the advice of the Prime Minister.',
].join('\n');

const SOURCE_SHA = createHash('sha256').update(SOURCE_TEXT).digest('hex');
const FILE_SHA = createHash('sha256').update('a pretend pdf').digest('hex');

const CHAPTER = 'How Canadians Govern Themselves';

const TODAY = '2026-09-08T00:00:00Z';
const daysAgo = (days: number): string =>
  new Date(Date.parse(TODAY) - days * 86_400_000).toISOString();
const dateAgo = (days: number): string => daysAgo(days).slice(0, 10);

interface Json {
  readonly [key: string]: unknown;
}

const manifest = (overrides: Json = {}): Json => ({
  $schema: '../schemas/source.schema.json',
  id: 'fixture-source',
  title: 'A fixture source',
  publisher: 'Nobody',
  edition: 'fixture',
  url: 'https://example.invalid/fixture',
  file: 'fixture-source.pdf',
  extractedText: 'fixture-source.txt',
  sha256: FILE_SHA,
  extractedTextSha256: SOURCE_SHA,
  bytes: 13,
  pages: 100,
  retrievedAt: '2026-09-08',
  licence: 'fixture',
  committed: false,
  chapters: [{ title: CHAPTER, page: 54, endPage: 59 }],
  ...overrides,
});

/** A question that passes every rule, so each case can break exactly one thing. */
const question = (overrides: Json = {}): Json => ({
  $schema: '../../schemas/question.schema.json',
  id: 'fix-01',
  subject: 'government',
  prompt: { en: 'How many parts does Parliament have?', fr: 'Combien de parties le Parlement a-t-il ?' },
  options: [
    { en: 'Three.', fr: 'Trois.' },
    { en: 'Two.', fr: 'Deux.' },
    { en: 'Four.', fr: 'Quatre.' },
    { en: 'Five.', fr: 'Cinq.' },
  ],
  correctIndex: 0,
  explanation: { en: 'The Crown plus two chambers.', fr: 'La Couronne et deux chambres.' },
  source: {
    sourceId: 'fixture-source',
    chapter: CHAPTER,
    page: 55,
    quote: 'Parliament has three parts: the Sovereign, the Senate and the House of Commons.',
    url: 'https://example.invalid/fixture',
    sourceHash: SOURCE_SHA,
    asOf: daysAgo(3),
    volatile: false,
  },
  verification: {
    status: 'verified',
    model: 'fixture-model',
    checkedAt: daysAgo(2),
    sourceHash: SOURCE_SHA,
    evidence: 'Parliament has three parts: the Sovereign',
  },
  ...overrides,
});

const NULL_FORM = { status: 'unverified', model: '', checkedAt: null, sourceHash: '', evidence: '' };

/* -------------------------------------------------------------------------- */
/* Scratch trees and scratch repositories                                      */
/* -------------------------------------------------------------------------- */

let counter = 0;
const nextRoot = (label: string): string => {
  counter += 1;
  const root = join(WORK, `${label}-${String(counter)}`);
  mkdirSync(join(root, 'content', 'sources'), { recursive: true });
  mkdirSync(join(root, 'content', 'questions', 'government'), { recursive: true });
  return root;
};

const write = (root: string, rel: string, value: unknown): void => {
  const path = join(root, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};

/** A tree with the source register, its extraction, and the given questions. */
const tree = (label: string, questions: readonly Json[], source: Json = manifest()): string => {
  const root = nextRoot(label);
  write(root, 'content/sources/fixture-source.txt', SOURCE_TEXT);
  write(root, 'content/sources/fixture-source.json', source);
  questions.forEach((doc, index) => {
    write(root, `content/questions/government/fix-${String(index)}.json`, doc);
  });
  return root;
};

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

const inRepo = (root: string, args: readonly string[]): void => {
  execFileSync('git', ['-C', root, ...args], { env: GIT_ENV, stdio: ['ignore', 'ignore', 'pipe'] });
};

const initRepo = (root: string): void => {
  inRepo(root, ['init', '-q', '-b', 'main']);
  inRepo(root, ['config', 'commit.gpgsign', 'false']);
};

const commit = (root: string, subject: string): void => {
  inRepo(root, ['add', '-A']);
  inRepo(root, ['commit', '-q', '-m', subject]);
};

interface Run {
  readonly status: number;
  readonly out: string;
}

const run = (root: string, extra: readonly string[] = []): Run => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--root', root, '--now', TODAY, '--require-source', ...extra],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV },
  );
  return { status: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
};

/** Gates B and C only, for cases that are not about history. */
const runFlat = (root: string): Run => run(root, ['--no-history']);

/* -------------------------------------------------------------------------- */
/* Gate A - separation of duties                                               */
/* -------------------------------------------------------------------------- */

describe('separation of duties, over git history (ADR-0003)', () => {
  it('fails a commit that adds a question already marked verified', () => {
    // THE CASE THIS TASK EXISTS FOR. An agent holding Write(content/questions/**)
    // writes the file and the granted status in one go. Before this gate, the
    // permission prompt was the only thing in its way, and it was removed.
    const root = tree('a-grant-on-add', [question()]);
    initRepo(root);
    commit(root, 'Add a question and mark it verified');

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('changes the question\'s own fields AND writes');
    expect(result.out).toContain('status "verified"');
    expect(result.out).toContain('One commit doing both jobs is one actor doing both jobs');
  });

  it('accepts the same question when the author and the verifier commit separately', () => {
    // The negative case, and it matters more than the positive one: if this
    // failed, the gate would forbid the legitimate workflow and be turned off.
    const root = tree('a-two-commits', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author fifty-seven questions');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify the question bank');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('fails a commit that edits the question text and its verification together', () => {
    const root = tree('a-edit-and-grant', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question');
    write(
      root,
      'content/questions/government/fix-0.json',
      question({ explanation: { en: 'Reworded.', fr: 'Reformule.' } }),
    );
    commit(root, 'Reword the explanation and verify it');

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('changes the question\'s own fields AND changes');
  });

  it('fails ONE COMMIT that authors one file and grants another, touching neither twice', () => {
    // The rule used to be stated over one DOCUMENT, which is right on the case
    // that prompted it and silent on the natural one. With a 57-file bank a
    // commit touches many files: rewording qA while flipping qB from the null
    // form to `verified` showed nothing in either file on its own - for qA the
    // block was unchanged, for qB the author fields were unchanged - and the
    // gate fired nothing. The property is "did one actor do both jobs", and
    // what carries it is the commit.
    const root = tree('a-two-files-one-commit', [
      question({ id: 'q-a', verification: NULL_FORM }),
      question({ id: 'q-b', verification: NULL_FORM }),
    ]);
    initRepo(root);
    commit(root, 'Author two questions in the null form');
    const rewordedA = question({
      id: 'q-a',
      verification: NULL_FORM,
      explanation: { en: 'Reworded by the author.', fr: 'Reformule.' },
    });
    write(root, 'content/questions/government/fix-0.json', rewordedA);
    write(root, 'content/questions/government/fix-1.json', question({ id: 'q-b' }));
    commit(root, 'Reword qA and verify qB');
    // A third commit grants qA as well, so the tree ends fully verified and the
    // only thing left to fail on is the separation rule itself.
    write(root, 'content/questions/government/fix-0.json', {
      ...rewordedA,
      verification: question().verification,
    });
    commit(root, 'Verify qA');

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('Reword qA and verify qB');
    expect(result.out).toContain('AND authors content in 1 other file(s)');
    expect(result.out).toContain('even though no single file shows it');
  });

  it('accepts one commit that grants many files and authors none', () => {
    // The negative case that matters most: verifying a bank is ONE job and it
    // arrives as one commit over 57 files. A rule that failed this would forbid
    // the workflow it exists to protect.
    const root = tree('a-bulk-verify', [
      question({ id: 'q-a', verification: NULL_FORM }),
      question({ id: 'q-b', verification: NULL_FORM }),
    ]);
    initRepo(root);
    commit(root, 'Author two questions in the null form');
    write(root, 'content/questions/government/fix-0.json', question({ id: 'q-a' }));
    write(root, 'content/questions/government/fix-1.json', question({ id: 'q-b' }));
    commit(root, 'Verify the bank');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('accepts one commit that edits one file and ADDS another in the null form', () => {
    // Authoring is also one job across many files, and a new file must carry
    // the block. The null form is not a grant, so it does not put the commit on
    // both sides of the rule.
    const root = tree('a-bulk-author', [question({ id: 'q-a', verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author one question');
    const reworded = question({
      id: 'q-a',
      verification: NULL_FORM,
      explanation: { en: 'Reworded.', fr: 'Reformule.' },
    });
    write(root, 'content/questions/government/fix-0.json', reworded);
    write(root, 'content/questions/government/fix-1.json', question({ id: 'q-b', verification: NULL_FORM }));
    commit(root, 'Reword qA and add qB in the null form');
    write(root, 'content/questions/government/fix-0.json', { ...reworded, verification: question().verification });
    write(root, 'content/questions/government/fix-1.json', question({ id: 'q-b' }));
    commit(root, 'Verify the bank');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('accepts a verifier appending a live check to the register while granting statuses', () => {
    // ADR-0016 makes a live check the VERIFIER's own record, so a commit that
    // grants statuses and appends one is one job, not two. The first draft of
    // the per-commit rule read the register as authored content and fired 57
    // times on the real `Verify the question bank` commit; the separation rules
    // are scoped to claim-bearing documents for that reason.
    const root = tree('a-register-edit', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question in the null form');
    write(root, 'content/questions/government/fix-0.json', question());
    write(
      root,
      'content/sources/fixture-source.json',
      manifest({
        liveChecks: [
          {
            checkedAt: dateAgo(1),
            checkedBy: 'fixture',
            finding: 'source-unrevised',
            consequence: 'recorded',
            pages: [
              {
                url: 'https://example.invalid/chapter',
                chapter: CHAPTER,
                sourceDateModified: '2017-12-21',
                agreesWithCache: true,
                claimsCompared: ['the three parts of Parliament'],
              },
            ],
          },
        ],
      }),
    );
    commit(root, 'Verify the bank and record the live check');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  /* --- A4: a grant is a grant OF something -------------------------------- */
  //
  // This block replaces a case that read "accepts an author editing text and
  // leaving the verification block alone", over a fixture whose default
  // verification is already `verified`. That case ASSERTED THE DEFECT: it took
  // the untouched block as proof that nothing was wrong, when an untouched
  // block over changed text is precisely the failure. `verification.sourceHash`
  // binds a grant to the SOURCE and nothing bound it to the CLAIM, so the
  // sequence below used to exit 0 with the correct answer replaced.
  //
  // Leaving the block alone is still the author's obligation. What is no longer
  // accepted is leaving a GRANTED block alone; the null form is untouched by
  // definition, and that is the negative case immediately after.

  it('fails an author who edits the question after its verification was granted', () => {
    const root = tree('a-edit-after-grant', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question in the null form');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');
    // Three properly separated commits, and the third breaks nothing the old
    // gate knew about: the block is byte-identical, the source has not moved,
    // the quote and the evidence are untouched. Only the answer changed.
    write(
      root,
      'content/questions/government/fix-0.json',
      question({
        correctIndex: 1,
        prompt: { en: 'How many parts does Parliament really have?', fr: 'Combien vraiment ?' },
      }),
    );
    commit(root, 'Reword the prompt and change the answer');

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('was granted in');
    expect(result.out).toContain('the claim\'s own fields have changed since');
    expect(result.out).toContain('Verify it');
  });

  it('accepts an author editing text while the verification is still the null form', () => {
    // The legitimate case this is closest to, and the reason the rule is about
    // a GRANT and not about any verification block: before a verifier has
    // granted anything there is nothing for an edit to invalidate. Authoring is
    // iterative and must stay that way.
    const root = tree('a-edit-before-grant', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question in the null form');
    const reworded = question({
      verification: NULL_FORM,
      explanation: { en: 'Reworded before anyone checked it.', fr: 'Reformule.' },
    });
    write(root, 'content/questions/government/fix-0.json', reworded);
    commit(root, 'Reword the explanation');
    write(root, 'content/questions/government/fix-0.json', { ...reworded, verification: question().verification });
    commit(root, 'Verify it');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('clears the failure when the verifier re-verifies the edited question', () => {
    // A4 is evaluated at HEAD, not at the offending commit, precisely so there
    // is a way back. A permanent historical failure would leave the only exit
    // as rewriting history.
    const root = tree('a-edit-then-reverify', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question in the null form');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');
    const edited = question({ explanation: { en: 'Reworded, nothing else.', fr: 'Reformule.' } });
    write(root, 'content/questions/government/fix-0.json', edited);
    commit(root, 'Reword the explanation');
    expect(run(root).status).toBe(1);

    write(root, 'content/questions/government/fix-0.json', {
      ...edited,
      verification: { ...(question().verification as Json), checkedAt: daysAgo(1) },
    });
    commit(root, 'Re-verify the reworded question');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('binds a grant made before an explicit --since, rather than exempting it', () => {
    // --since seeds A4's state from the range's base commit. Without that seed
    // a range would report green over exactly the edit A4 exists to catch,
    // which is how the replaced test passed: it pointed --since past the grant.
    const root = tree('a-edit-since', [question()]);
    initRepo(root);
    commit(root, 'Seed, with the grant already in place');
    write(
      root,
      'content/questions/government/fix-0.json',
      question({ explanation: { en: 'Reworded, nothing else.', fr: 'Reformule.' } }),
    );
    commit(root, 'Reword the explanation');

    const result = run(root, ['--since', 'HEAD~1']);
    expect(result.status).toBe(1);
    expect(result.out).toContain('the base of HEAD~1');
    expect(result.out).toContain('the claim\'s own fields have changed since');
  });

  it('does not fire on a verifier quarantining a question, which changes no claim', () => {
    const root = tree('a-quarantine-no-a4', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question in the null form');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');
    write(
      root,
      'content/questions/government/fix-0.json',
      question({
        verification: {
          status: 'quarantined',
          model: 'fixture-model',
          checkedAt: daysAgo(1),
          sourceHash: SOURCE_SHA,
          evidence: 'Parliament has three parts: the Sovereign',
        },
      }),
    );
    commit(root, 'Quarantine it');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('accepts a verifier quarantining a question it had verified', () => {
    const root = tree('a-quarantine', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');
    write(
      root,
      'content/questions/government/fix-0.json',
      question({
        verification: {
          status: 'quarantined',
          model: 'fixture-model',
          checkedAt: daysAgo(1),
          sourceHash: SOURCE_SHA,
          evidence: 'Parliament has three parts: the Sovereign',
        },
      }),
    );
    commit(root, 'Quarantine it');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('fails a ROOT commit that grants a verification, having no parent to diff against', () => {
    // A root commit has no parent. If it were skipped, the first commit of a
    // repository could add a bank already marked verified and never be read.
    const root = tree('a-root-commit', [question()]);
    initRepo(root);
    commit(root, 'Initial commit');

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('One commit doing both jobs');
  });

  it('fails a commit that moves communityReview off not-sought', () => {
    const root = tree('a-review-granted', [question()]);
    initRepo(root);
    commit(root, 'Seed');
    write(root, 'content/characters/guide.json', {
      id: 'guide',
      indigenous: true,
      nation: 'Algonquin Anishinaabe',
      communityReview: {
        status: 'granted',
        reviewer: 'A Real Person',
        organisation: 'A Real Organisation',
        date: daysAgo(1),
        scope: 'the whole character',
        note: '',
      },
    });
    commit(root, 'Record the community sign-off');

    const result = run(root, ['--since', 'HEAD~1']);
    expect(result.status).toBe(1);
    expect(result.out).toContain('sets communityReview.status to "granted"');
    expect(result.out).toContain('naming A Real Person');
    expect(result.out).toContain('no agent may grant cultural sign-off');
    expect(result.out).toContain('an identity the committer does not control');
  });

  it('accepts a commit writing communityReview as not-sought', () => {
    const root = tree('a-review-not-sought', [question()]);
    initRepo(root);
    commit(root, 'Seed');
    write(root, 'content/characters/guide.json', {
      id: 'guide',
      indigenous: true,
      nation: 'Algonquin Anishinaabe',
      communityReview: {
        status: 'not-sought',
        reviewer: null,
        organisation: null,
        date: null,
        scope: null,
        note: '',
      },
    });
    commit(root, 'Add a character');

    const result = run(root, ['--since', 'HEAD~1']);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('does not mistake the schemas that DEFINE these blocks for instances of them', () => {
    // content/schemas/*.json contains a property literally called
    // `verification` with a `status` under it. A gate matching on key name would
    // find blocks inside the files that define blocks.
    const root = tree('a-schemas', [question({ verification: NULL_FORM })]);
    write(root, 'content/schemas/question.schema.json', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      properties: {
        verification: {
          properties: { status: { enum: ['unverified', 'verified', 'quarantined', 'rejected'] } },
        },
      },
    });
    initRepo(root);
    commit(root, 'Add the schema and a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
    // One block, from the question. The schema's `properties.verification`,
    // which has a `status` under it, was not counted as a second.
    expect(result.out).toContain('2 verification block(s)');
  });

  it('refuses to run over a shallow clone rather than reporting green over what it cannot see', () => {
    // actions/checkout defaults to fetch-depth 1. A history gate in a
    // one-commit clone inspects one commit and passes, which is the quietest
    // possible way for this file to become decorative.
    const origin = tree('a-shallow-origin', [question({ verification: NULL_FORM })]);
    initRepo(origin);
    commit(origin, 'Author a question');
    write(origin, 'content/questions/government/fix-0.json', question());
    commit(origin, 'Verify it');

    counter += 1;
    const shallow = join(WORK, `a-shallow-clone-${String(counter)}`);
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${origin}`, shallow], {
      env: GIT_ENV,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const result = run(shallow);
    expect(result.status).toBe(1);
    expect(result.out).toContain('shallow clone');
    expect(result.out).toContain('fetch-depth: 0');
  });

  it('fails rather than skipping when the tree is not a git repository', () => {
    const root = tree('a-not-a-repo', [question()]);
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('is not a git repository');
    expect(result.out).toContain('not allowed to pass silently');
  });

  it('says out loud that authorship is not established, on every passing run', () => {
    const root = tree('a-honesty', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');

    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.out).toContain('commit AUTHORSHIP is not established here');
    expect(result.out).toContain('One agent committing twice is indistinguishable from two agents');
  });
});

/* -------------------------------------------------------------------------- */
/* The recogniser every rule in gate A is scoped by                            */
/* -------------------------------------------------------------------------- */

/**
 * A minimal `common.schema.json`, carrying only what the recogniser self-test
 * reads: the two `required` lists. `extra` adds a required key the way an ADR
 * amendment does - which is the whole point of these cases, because the
 * previous recogniser matched on an EXACT key set and stopped recognising a
 * block the moment the schema grew a field.
 */
const commonSchema = (extra: { verification?: readonly string[]; review?: readonly string[] } = {}): Json => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://truenorth.app/schemas/common.schema.json',
  $defs: {
    factVerification: {
      type: 'object',
      required: ['status', 'model', 'checkedAt', 'sourceHash', 'evidence', ...(extra.verification ?? [])],
    },
    communityReview: {
      type: 'object',
      required: ['status', 'reviewer', 'organisation', 'date', 'scope', 'note', ...(extra.review ?? [])],
    },
  },
});

const guide = (review: Json): Json => ({
  id: 'guide',
  indigenous: true,
  nation: 'Algonquin Anishinaabe',
  communityReview: review,
});

const GRANTED_REVIEW = {
  status: 'granted',
  reviewer: 'Elder Jane Doe',
  organisation: 'A Real Organisation',
  date: '2026-09-01T00:00:00Z',
  scope: 'the whole character',
  note: '',
};

describe('the recogniser gate A is scoped by (ADR-0003 as amended, ADR-0019)', () => {
  it('fails a fabricated sign-off that carries a key the recogniser has never seen', () => {
    // THE DEFECT. ADR-0003's amendment made `record` required whenever the
    // status is not `not-sought`. The recogniser matched an EXACT key set, so
    // the six-key block failed correctly and the SEVEN-key block that the
    // amendment mandates - same fabricated grant, same named person, one extra
    // field - exited 0. The only signal was the block count in the summary
    // dropping from 2 to 1, on a line nobody diffs.
    const root = tree('r-record-field', [question()]);
    write(root, 'content/schemas/common.schema.json', commonSchema({ review: ['record'] }));
    initRepo(root);
    commit(root, 'Seed');
    write(
      root,
      'content/characters/guide.json',
      guide({ ...GRANTED_REVIEW, record: 'https://example.invalid/letter' }),
    );
    commit(root, 'Record the community sign-off');

    const result = run(root, ['--since', 'HEAD~1']);
    expect(result.status).toBe(1);
    expect(result.out).toContain('sets communityReview.status to "granted"');
    expect(result.out).toContain('naming Elder Jane Doe');
    expect(result.out).toContain('1 communityReview block(s) inspected');
  });

  it('fails the same sign-off without that key, so the six-key case did not regress', () => {
    const root = tree('r-no-record-field', [question()]);
    write(root, 'content/schemas/common.schema.json', commonSchema());
    initRepo(root);
    commit(root, 'Seed');
    write(root, 'content/characters/guide.json', guide(GRANTED_REVIEW));
    commit(root, 'Record the community sign-off');

    const result = run(root, ['--since', 'HEAD~1']);
    expect(result.status).toBe(1);
    expect(result.out).toContain('sets communityReview.status to "granted"');
  });

  it('fails when the schema requires a key the recogniser identifies blocks by', () => {
    // The other direction, and the one that decays silently: if the schema
    // stops requiring a field this file matches on, legitimate blocks written
    // without it are not recognised and every rule scoped by the recogniser
    // skips them. Here `scope` is dropped from the schema's required list.
    const root = tree('r-schema-drift', [question()]);
    write(root, 'content/schemas/common.schema.json', {
      ...commonSchema(),
      $defs: {
        factVerification: {
          type: 'object',
          required: ['status', 'model', 'checkedAt', 'sourceHash', 'evidence'],
        },
        communityReview: {
          type: 'object',
          required: ['status', 'reviewer', 'organisation', 'date', 'note'],
        },
      },
    });
    const result = runFlat(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('this gate identifies the block by "scope"');
    expect(result.out).toContain('would not be recognised');
  });

  it('says out loud when it could not check the recogniser against a schema', () => {
    const result = runFlat(tree('r-no-schema', [question()]));
    expect(result.out).toContain('the recogniser self-test did not run');
    expect(result.status).toBe(0);
  });

  it('still refuses to read the schema that DEFINES a block as an instance of one', () => {
    // Matching on a required SUBSET is only safe while this holds. A JSON
    // Schema's `properties` object for factVerification has exactly the five
    // key names; what rejects it is that `status` there is a subschema and not
    // one of the four status strings.
    const root = tree('r-definition-not-instance', [question({ verification: NULL_FORM })]);
    write(root, 'content/schemas/common.schema.json', commonSchema({ review: ['record'] }));
    write(root, 'content/schemas/question.schema.json', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      properties: {
        verification: {
          properties: {
            status: { enum: ['unverified', 'verified', 'quarantined', 'rejected'] },
            model: { type: 'string' },
            checkedAt: { type: 'string' },
            sourceHash: { type: 'string' },
            evidence: { type: 'string' },
          },
        },
      },
    });
    initRepo(root);
    commit(root, 'Add the schemas and a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');

    const result = run(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
    expect(result.out).toContain('2 verification block(s)');
  });
});

/** A roles map, for the cases that exercise the stronger rule. */
const rolesFile = (root: string): string => {
  const path = join(root, 'content-roles.json');
  writeFileSync(
    path,
    `${JSON.stringify({ 'author@example.invalid': 'author', 'verifier@example.invalid': 'verifier' }, null, 2)}\n`,
  );
  return path;
};

const commitAs = (root: string, email: string, subject: string): void => {
  inRepo(root, ['add', '-A']);
  execFileSync('git', ['-C', root, 'commit', '-q', '-m', subject], {
    env: { ...GIT_ENV, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_EMAIL: email },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
};

/* -------------------------------------------------------------------------- */
/* Gate A - the stronger rule, once a role is knowable                         */
/* -------------------------------------------------------------------------- */

describe('the rule as ADR-0003 words it, once commits carry a role identity', () => {
  it('catches the one thing one-commit-one-job cannot: an author granting in its own commit', () => {
    // Two commits, in the right order, touching the right fields. Indistinguishable
    // from correct behaviour without an identity - and caught with one.
    const root = tree('a-role-author-grants', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commitAs(root, 'author@example.invalid', 'Author a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commitAs(root, 'author@example.invalid', 'Verify it');

    const result = run(root, ['--roles', rolesFile(root)]);
    expect(result.status).toBe(1);
    expect(result.out).toContain('authored by the content-author role');
    expect(result.out).toContain('only in the null form');
  });

  it('accepts the same two commits when the second is the verifier', () => {
    const root = tree('a-role-split', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commitAs(root, 'author@example.invalid', 'Author a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commitAs(root, 'verifier@example.invalid', 'Verify it');

    const result = run(root, ['--roles', rolesFile(root)]);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.out).toContain('2 of 2 commit(s) carried a known role');
    expect(result.out).toContain('SELF-ATTESTED and proves nothing against a dishonest agent');
    expect(result.status).toBe(0);
  });

  it('fails a verifier that edits the question text', () => {
    const root = tree('a-role-verifier-edits', [question()]);
    initRepo(root);
    commitAs(root, 'author@example.invalid', 'Seed');
    write(
      root,
      'content/questions/government/fix-0.json',
      question({ explanation: { en: 'The verifier rewrote this.', fr: 'Reformule.' } }),
    );
    commitAs(root, 'verifier@example.invalid', 'Tidy the explanation while verifying');

    const result = run(root, ['--roles', rolesFile(root), '--since', 'HEAD~1']);
    expect(result.status).toBe(1);
    expect(result.out).toContain('authored by the content-verifier role');
    expect(result.out).toContain('it cannot edit question text');
  });

  it('says which rule was in force, so a missing roles file is never read as a passing check', () => {
    const root = tree('a-role-absent', [question({ verification: NULL_FORM })]);
    initRepo(root);
    commit(root, 'Author a question');
    write(root, 'content/questions/government/fix-0.json', question());
    commit(root, 'Verify it');

    const result = run(root, ['--roles', join(root, 'no-such-file.json')]);
    expect(result.status).toBe(0);
    expect(result.out).toContain('commit AUTHORSHIP is not established here');
    expect(result.out).toContain('does not exist');
  });
});

/* -------------------------------------------------------------------------- */
/* Gate B - ADR-0003's CI clause, per document                                 */
/* -------------------------------------------------------------------------- */

describe("ADR-0003's CI clause, per document", () => {
  it('passes the fixture bank it is about to break, one rule at a time', () => {
    const result = runFlat(tree('b-baseline', [question()]));
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('fails a shipped question that is not verified', () => {
    const result = runFlat(tree('b-unverified', [question({ verification: NULL_FORM })]));
    expect(result.status).toBe(1);
    expect(result.out).toContain('status is "unverified" and the question is in the shipped bank');
  });

  it('excludes rejected and quarantined questions from that rule rather than failing them', () => {
    const rejected = question({
      verification: {
        status: 'rejected',
        model: 'fixture-model',
        checkedAt: daysAgo(2),
        sourceHash: SOURCE_SHA,
        evidence: 'Parliament has three parts: the Sovereign',
      },
    });
    const result = runFlat(tree('b-rejected', [question(), rejected]));
    expect(result.out).toContain('1 rejected, 1 verified; 1 shipped, 1 excluded from the build');
    expect(result.status).toBe(0);
  });

  it('fails a verified status with an empty evidence quote', () => {
    // The clause ADR-0003 had omitted, which is how the port dropped the field
    // with nothing noticing.
    const result = runFlat(
      tree('b-no-evidence', [
        question({
          verification: {
            status: 'verified',
            model: 'fixture-model',
            checkedAt: daysAgo(2),
            sourceHash: SOURCE_SHA,
            evidence: '',
          },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('status is "verified" and evidence is empty');
    expect(result.out).toContain('does not accept assertions');
  });

  it('fails a status granted for a sourceHash the source no longer has', () => {
    const stale = 'f'.repeat(64);
    const result = runFlat(
      tree('b-stale-hash', [
        question({
          source: { ...(question().source as Json), sourceHash: stale },
          verification: { ...(question().verification as Json), sourceHash: stale },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('now hashes to');
    expect(result.out).toContain('The source moved under this claim');
  });

  it('fails when the granted hash and the cited hash disagree with each other', () => {
    const result = runFlat(
      tree('b-two-hashes', [
        question({ verification: { ...(question().verification as Json), sourceHash: 'e'.repeat(64) } }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('The two ends of ADR-0003');
  });

  it('fails a question with fewer than four options', () => {
    const result = runFlat(
      tree('b-three-options', [
        question({ options: (question().options as unknown[]).slice(0, 3) }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('has 3 option(s)');
    expect(result.out).toContain('three distractors');
  });

  it('fails a question whose distractors repeat, which is two options wearing four', () => {
    const result = runFlat(
      tree('b-dup-distractor', [
        question({
          options: [
            { en: 'Three.', fr: 'Trois.' },
            { en: 'Two.', fr: 'Deux.' },
            { en: 'Two.', fr: 'Deux.' },
            { en: 'Five.', fr: 'Cinq.' },
          ],
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('not three distinct non-empty options');
  });

  it('fails a question missing its French', () => {
    const result = runFlat(
      tree('b-no-fr', [question({ explanation: { en: 'The Crown plus two chambers.' } })]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('explanation.fr is missing or empty');
  });

  it('fails prose lifted verbatim from the source', () => {
    const result = runFlat(
      tree('b-verbatim', [
        question({
          explanation: {
            en: 'The Governor General is appointed by the Sovereign on the advice of the Prime Minister.',
            fr: 'La Couronne et deux chambres.',
          },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('consecutive words with');
    expect(result.out).toContain('the wording must not be verbatim');
  });

  it('does not fire on institutional terminology a paraphrase cannot avoid', () => {
    // "the Sovereign, the Senate and the House of Commons" is nine words of
    // machinery with no honest paraphrase. Four corpus OPTIONS are 100%
    // verbatim for the same reason, which is why options are exempt.
    const result = runFlat(
      tree('b-terminology', [
        question({
          explanation: {
            en: 'They are the Sovereign, the Senate and the House of Commons.',
            fr: 'La Couronne et deux chambres.',
          },
        }),
      ]),
    );
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('fails a source.quote that is not a contiguous passage of the extraction', () => {
    const result = runFlat(
      tree('b-fabricated-quote', [
        question({
          source: {
            ...(question().source as Json),
            quote: 'Parliament has four parts: the Sovereign and the Senate.',
          },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('is not a contiguous passage');
    expect(result.out).toContain('catches a fabricated citation before any verifier runs');
  });

  it('fails an evidence span containing a word the source does not contain', () => {
    const result = runFlat(
      tree('b-fabricated-evidence', [
        question({
          verification: {
            ...(question().verification as Json),
            evidence: 'Parliament has three parts: the Sovereign, the Senate and the Taoiseach',
          },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('do not occur anywhere in');
    expect(result.out).toContain('"taoiseach"');
  });

  it('fails an evidence span that shares no run with the source', () => {
    const result = runFlat(
      tree('b-scattered-evidence', [
        question({
          verification: {
            ...(question().verification as Json),
            evidence: 'Commons Senate Sovereign Parliament',
          },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('longest contiguous run from the source is');
  });

  it('tolerates an evidence span broken by layout, which is why the floor is not contiguity', () => {
    // Five of the 57 corpus spans read across a PDF table or a step label. They
    // are reconstructions of a passage a human sees as one, and they are not
    // fabrications - which is a distinction the unknown-word check keeps.
    const result = runFlat(
      tree('b-layout-evidence', [
        question({
          verification: {
            ...(question().verification as Json),
            evidence: 'STEP 3 Parliament has three parts: the Sovereign',
          },
        }),
      ]),
    );
    // "step" and "3" are not in the fixture source, so this one fails on the
    // unknown-word rule and NOT on the run floor - proving the two rules are
    // separable and that the run of 6 was accepted.
    expect(result.out).not.toContain('longest contiguous run from the source is');
  });

  it('fails when the extraction on disk does not hash to what the register declares', () => {
    const root = tree('b-hash-drift', [question()]);
    write(root, 'content/sources/fixture-source.txt', `${SOURCE_TEXT}\nAn added sentence.`);
    const result = runFlat(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('was granted against different bytes');
  });

  it('reports, rather than silently skipping, when the extraction is absent', () => {
    // The CI case. discover-canada is Crown copyright and git-ignored, so this
    // is what a pull request actually runs, and it must not read as a pass.
    const root = nextRoot('b-no-extraction');
    write(root, 'content/sources/fixture-source.json', manifest());
    write(root, 'content/questions/government/fix-0.json', question());

    const reported = spawnSync(
      process.execPath,
      [SCRIPT, '--root', root, '--now', TODAY, '--no-history'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV },
    );
    expect(reported.status).toBe(0);
    expect(reported.stdout).toContain('1 could NOT be checked because the extraction is absent');
    expect(reported.stdout).toContain('those questions are unchecked, not passing');

    // and --require-source turns it into a failure, which is what the verifier's
    // own runs use.
    const required = runFlat(root);
    expect(required.status).toBe(1);
    expect(required.out).toContain('is not present');
  });
});

/* -------------------------------------------------------------------------- */
/* Gate C - ADR-0016 §2's four-row table                                       */
/* -------------------------------------------------------------------------- */

const withLiveCheck = (finding: string, checkedAt: string, extra: Json = {}): Json =>
  manifest({
    knownStaleness: [
      {
        topic: 'The monarch',
        problem: 'Pre-accession throughout.',
        affects: [CHAPTER],
        grain: 'chapter',
        action: 'route the answers around it',
        upstream: 'does-not-revise',
        bannedFromAnswers: ['Elizabeth', 'Her Majesty'],
      },
    ],
    liveChecks: [
      {
        checkedAt,
        checkedBy: 'fixture',
        finding,
        consequence: 'recorded',
        pages: [
          {
            url: 'https://example.invalid/chapter',
            chapter: CHAPTER,
            sourceDateModified: '2017-12-21',
            agreesWithCache: true,
            claimsCompared: ['the three parts of Parliament'],
          },
        ],
      },
    ],
    ...extra,
  });

describe("ADR-0016 §2's re-check table", () => {
  it('row 1: a volatile question from a source nobody has live-checked ages out on its own asOf', () => {
    const result = runFlat(
      tree('c-row1-stale', [
        question({
          source: { ...(question().source as Json), volatile: true, asOf: daysAgo(200) },
        }),
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('row 1 per-question re-verification');
    expect(result.out).toContain("Row 1's clock is on the question");
  });

  it('row 1: a STABLE question does not expire on a calendar', () => {
    // volatile means "this fact can change without notice". A stable fact from
    // a maintained source does not go stale because 181 days passed.
    const result = runFlat(
      tree('c-row1-stable', [
        question({
          source: { ...(question().source as Json), volatile: false, asOf: daysAgo(2000) },
        }),
      ]),
    );
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('row 2: an unrevised source moves the clock OFF the question', () => {
    // The whole trick. asOf is five years old and nothing fails, because the
    // page cannot have changed and the register was checked yesterday.
    const result = runFlat(
      tree(
        'c-row2-fresh',
        [question({ source: { ...(question().source as Json), volatile: true, asOf: daysAgo(2000) } })],
        withLiveCheck('source-unrevised', dateAgo(1)),
      ),
    );
    expect(result.out).toContain('1 on row 2 source-unrevised, liveChecks clock');
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('row 2: the clock does not go away - a live check that ages out fails every question under it', () => {
    const result = runFlat(
      tree(
        'c-row2-stale',
        [question(), question({ id: 'fix-02' })],
        withLiveCheck('source-unrevised', dateAgo(200)),
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('was 200 days ago');
    expect(result.out).toContain('quarantines the SOURCE');
    // BOTH questions, not one: the source quarantines, so everything citing it does.
    expect(result.out.match(/quarantines the SOURCE/g) ?? []).toHaveLength(2);
  });

  it('row 2 requires the flags to say does-not-revise; "unknown" is treated exactly as "revises"', () => {
    const source = withLiveCheck('source-unrevised', dateAgo(1));
    const flags = (source.knownStaleness as Json[]).map((flag) => ({
      ...flag,
      upstream: 'unknown',
      bannedFromAnswers: undefined,
    }));
    const result = runFlat(
      tree(
        'c-row2-unknown',
        [question({ source: { ...(question().source as Json), volatile: true, asOf: daysAgo(200) } })],
        { ...source, knownStaleness: flags },
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('row 1 per-question re-verification');
    expect(result.out).toContain('absent and "unknown" are treated exactly as "revises"');
  });

  it('row 3: a withdrawn document quarantines every question citing it, immediately', () => {
    const result = runFlat(
      tree('c-row3', [question()], withLiveCheck('source-withdrawn', dateAgo(1))),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('source-withdrawn');
    expect(result.out).toContain('quarantines immediately');
  });

  it('row 3: and stops complaining once the question is actually quarantined', () => {
    const result = runFlat(
      tree(
        'c-row3-done',
        [
          question({
            verification: {
              status: 'quarantined',
              model: 'fixture-model',
              checkedAt: daysAgo(1),
              sourceHash: SOURCE_SHA,
              evidence: 'Parliament has three parts: the Sovereign',
            },
          }),
        ],
        withLiveCheck('source-withdrawn', dateAgo(1)),
      ),
    );
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('row 4: an unreachable page is a retry, not a retraction, and not a state change', () => {
    // ADR-0009's split of DISCHARGED from VOIDED, at content grain: a 500 or a
    // DNS failure must not read as the Government of Canada removing a document.
    const source = withLiveCheck('source-unrevised', dateAgo(1));
    const decisive = (source.liveChecks as Json[])[0];
    const unreachable = { ...decisive, checkedAt: dateAgo(0), finding: 'source-unreachable' };
    const result = runFlat(
      tree(
        'c-row4',
        [question({ source: { ...(question().source as Json), volatile: true, asOf: daysAgo(2000) } })],
        { ...source, liveChecks: [decisive, unreachable] },
      ),
    );
    expect(result.out).toContain('source-unreachable');
    expect(result.out).toContain('needs its own decision');
    // The disposition is still row 2, from the last check that decided anything.
    expect(result.out).toContain('1 on row 2 source-unrevised');
    expect(result.status).toBe(0);
  });

  it('binds the disposition to the CHAPTER, so a check of one chapter does not cover another', () => {
    const source = withLiveCheck('source-unrevised', dateAgo(1), {
      chapters: [
        { title: CHAPTER, page: 54, endPage: 59 },
        { title: 'Federal Elections', page: 60, endPage: 74 },
      ],
    });
    const result = runFlat(
      tree(
        'c-chapter-binding',
        [
          question({
            source: {
              ...(question().source as Json),
              chapter: 'Federal Elections',
              page: 61,
              volatile: true,
              asOf: daysAgo(200),
            },
          }),
        ],
        source,
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('no live check in the register names this chapter');
  });
});

/* -------------------------------------------------------------------------- */
/* Anti-vacuum floors                                                          */
/* -------------------------------------------------------------------------- */

describe('the gate refuses to pass by having nothing to check', () => {
  it('fails on an empty content/questions/', () => {
    const result = runFlat(tree('d-no-questions', []));
    expect(result.status).toBe(1);
    expect(result.out).toContain('holds no question');
    expect(result.out).toContain('is how a gate becomes decorative');
  });

  it('fails on an empty content/sources/', () => {
    const root = nextRoot('d-no-sources');
    write(root, 'content/questions/government/fix-0.json', question());
    const result = runFlat(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('holds no source manifest');
  });

  it('fails when the history gate finds no commit touching content/', () => {
    const root = tree('d-no-commits', [question({ verification: NULL_FORM })]);
    initRepo(root);
    write(root, 'README.md', '# nothing to do with content');
    inRepo(root, ['add', 'README.md']);
    inRepo(root, ['commit', '-q', '-m', 'Add a readme']);

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('inspected 0 commits touching content/');
    expect(result.out).toContain('cannot pass by finding nothing to look at');
  });

  it('reports real counts rather than a bare tick', () => {
    const result = runFlat(tree('d-counts', [question(), question({ id: 'fix-02' })]));
    expect(result.out).toContain('2 question(s) in 1 source register(s)');
    expect(result.out).toContain('2 verified; 2 shipped, 0 excluded');
    expect(result.out).toContain('text checks ran against a cached extraction for 2 question(s)');
    expect(result.out).toContain('longest verbatim run in authored prose');
    expect(result.status).toBe(0);
  });
});
