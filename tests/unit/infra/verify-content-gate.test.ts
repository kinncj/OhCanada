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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  // The register has to say how the extraction was made, or its digest is a
  // number only the machine that made it can reproduce (source.schema.json).
  extraction: {
    tool: 'cat (coreutils)',
    version: 'fixture',
    command: 'cat content/sources/fixture-source.txt',
    reproducedAt: '2026-09-08',
  },
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
/* The other two shapes a claim arrives in                                     */
/* -------------------------------------------------------------------------- */

/**
 * `common.schema.json#/$defs/factClaim`, the block a quest line and a landmark
 * blurb carry. Everything below it is the same apparatus a question has at its
 * root — which is the whole point, and was exactly why walking one directory
 * looked like walking the corpus.
 */
const factOf = (overrides: Json = {}): Json => ({
  factual: true,
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

/** A quest whose one factual dialogue line passes every rule. */
const quest = (line: Json = {}): Json => ({
  $schema: '../schemas/quest.schema.json',
  id: 'fix-quest',
  levelId: 'fix-level',
  giver: 'guide',
  title: { en: 'A fixture quest', fr: 'Une quete de fixture' },
  summary: { en: 'Walk and talk.', fr: 'Marchez et parlez.' },
  steps: [
    {
      id: 'talk',
      kind: 'talk',
      targetId: 'guide',
      prompt: { en: 'Talk to the guide', fr: 'Parlez au guide' },
      dialogue: [
        {
          speaker: 'guide',
          expression: 'happy',
          text: { en: 'Hello again!', fr: 'Rebonjour!' },
          fact: { factual: false, source: null, verification: null },
        },
        {
          speaker: 'guide',
          expression: 'neutral',
          text: {
            en: 'Our Parliament has a Crown, an elected chamber and an appointed one.',
            fr: 'Notre Parlement a une Couronne, une chambre elue et une chambre nommee.',
          },
          fact: factOf(),
          ...line,
        },
      ],
    },
  ],
});

/** A level whose territory statement and one landmark blurb pass every rule. */
const level = (poi: Json = {}): Json => ({
  $schema: '../schemas/level.schema.json',
  id: 'fix-level',
  pois: [
    {
      id: 'a-landmark',
      name: { en: 'A landmark', fr: 'Un point de repere' },
      blurb: {
        en: 'A bill becomes law only after both chambers agree and the Crown assents.',
        fr: 'Un projet de loi devient loi seulement apres accord des deux chambres.',
      },
      fact: factOf({
        source: {
          ...(factOf().source as Json),
          quote: 'A bill must pass both Houses before it receives royal assent and becomes law.',
        },
        verification: {
          ...(factOf().verification as Json),
          evidence: 'A bill must pass both Houses before it receives royal assent',
        },
      }),
      ...poi,
    },
  ],
});

/**
 * A tree carrying all three collections, for the cases about the widened walk.
 * `tree()` above stays questions-only on purpose: the cases that use it are each
 * about one rule, and extra documents would put other documents' output in them.
 */
const treeWithClaims = (
  label: string,
  parts: { questions?: readonly Json[]; quests?: readonly Json[]; levels?: readonly Json[] },
  source: Json = manifest(),
): string => {
  const root = tree(label, parts.questions ?? [question()], source);
  (parts.quests ?? [quest()]).forEach((doc, index) => {
    write(root, `content/quests/fix-quest-${String(index)}.json`, doc);
  });
  (parts.levels ?? [level()]).forEach((doc, index) => {
    write(root, `content/levels/fix-level-${String(index)}.json`, doc);
  });
  return root;
};

/** Gates B and C over a tree with all three collections, at the real floor. */
const runClaims = (root: string): Run =>
  run(root, ['--no-history', '--collections', 'questions,quests,levels']);

/** The CLI with no `--collections` at all, so the DEFAULT floor is exercised. */
const runRaw = (root: string, extra: readonly string[] = []): Run => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--root', root, '--now', TODAY, '--require-source', '--no-history', ...extra],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV },
  );
  return { status: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
};

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

/**
 * `--collections questions` on every fixture run, deliberately and visibly.
 *
 * The gate's anti-vacuum floor requires `content/questions`, `content/quests`
 * and `content/levels` each to yield a factual claim, because a collection that
 * silently yields none produces output identical to a clean one — which is the
 * defect the widened gate exists to close, and it would be a poor joke to
 * reintroduce it one level up. These fixture trees are questions-only by design:
 * every case below is about one rule, and adding a quest and a level to all of
 * them would make each case's output depend on documents it is not about. So the
 * narrower floor is STATED here rather than being an absence nobody noticed, and
 * the cases at the bottom of this file drive the real default over trees that do
 * carry quests and levels.
 */
const run = (root: string, extra: readonly string[] = []): Run => {
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--root',
      root,
      '--now',
      TODAY,
      '--require-source',
      ...(extra.includes('--collections') ? [] : ['--collections', 'questions']),
      ...extra,
    ],
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
const commonSchema = (
  extra: {
    verification?: readonly string[];
    review?: readonly string[];
    /** Rename `factual` to this, to drive the claim recogniser's drift case. */
    claim?: string;
  } = {},
): Json => ({
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
    factClaim: {
      type: 'object',
      required: [extra.claim ?? 'factual', 'source', 'verification'],
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
      [SCRIPT, '--root', root, '--now', TODAY, '--no-history', '--collections', 'questions'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV },
    );
    expect(reported.status).toBe(0);
    expect(reported.stdout).toContain('1 could NOT be checked because the extraction is absent');
    expect(reported.stdout).toContain('those claims are unchecked, not passing');

    // and it says how to get the file back, out of the register rather than out
    // of folklore. This note used to tell a contributor to "re-fetch" the
    // EXTRACTION, which is not a thing you can fetch: it is derived, and until
    // the register recorded the command, deriving it was guesswork.
    expect(reported.stdout).toContain('Re-derive it with `make sources`');
    expect(reported.stdout).toContain('cat content/sources/fixture-source.txt');

    // and --require-source turns it into a failure, which is what the verifier's
    // own runs use.
    const required = runFlat(root);
    expect(required.status).toBe(1);
    expect(required.out).toContain('is not present');
  });

  it('says so plainly when the register declares the extraction unrecorded', () => {
    // Five of the seven real registers are in this state: the HTML pages'
    // extractions were made by a command nobody wrote down, and no candidate
    // tried since reproduces their digests. A contributor who cannot run the
    // text checks should be told which of the two situations they are in.
    const root = nextRoot('b-unrecorded-extraction');
    write(root, 'content/sources/fixture-source.json', {
      ...manifest(),
      extraction: { unrecorded: true, reason: 'Nobody wrote it down.' },
    });
    write(root, 'content/questions/government/fix-0.json', question());

    const reported = spawnSync(
      process.execPath,
      [SCRIPT, '--root', root, '--now', TODAY, '--no-history', '--collections', 'questions'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV },
    );
    expect(reported.status).toBe(0);
    expect(reported.stdout).toContain('declares the extraction UNRECORDED');
    expect(reported.stdout).toContain('Nobody wrote it down.');
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
    expect(result.out).toContain('row 1 per-claim re-verification');
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
    expect(result.out).toContain('row 1 per-claim re-verification');
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

/* -------------------------------------------------------------------------- */
/* Gate C0 - ADR-0016 section 3, the banned terms                              */
/* -------------------------------------------------------------------------- */

/**
 * THE REGRESSION THESE CASES EXIST FOR. From the day ADR-0016 section 3 landed
 * until 2026-09-09 this script did not
 * fail on a banned term at all. It computed `banRespected` and handed it to
 * section 2's table, where a violation demoted the question from row 2 to row 1
 * - and row 1 fails only a claim that is `volatile` with an `asOf` past 180
 * days, which a fresh question never is. So a wrong fact could be written into
 * a shipped option and this gate printed OK, with one number in the row tally as
 * the only visible effect.
 *
 * The rule was enforced the whole time by
 * tests/unit/contracts/questions-cite-a-cached-source.test.ts, which is why CI
 * was never exposed. What was exposed is the contributor who runs the two
 * content commands the guidelines name and reads a pass over a banned term.
 * Both gates now call `bannedTermFaults` in scripts/lib/staleness.mjs.
 */
describe("ADR-0016 section 3: an answer may not depend on a fact nobody will correct", () => {
  const banned = (overrides: Json = {}): Json =>
    question({
      options: [
        { en: 'Three.', fr: 'Trois.' },
        { en: 'Her Majesty alone.', fr: 'Sa Majeste seule.' },
        { en: 'Four.', fr: 'Quatre.' },
        { en: 'Five.', fr: 'Cinq.' },
      ],
      ...overrides,
    });

  it('FAILS a shipped option carrying a banned term, rather than only demoting its row', () => {
    const result = runFlat(
      tree('c0-ban-fails', [banned()], withLiveCheck('source-unrevised', dateAgo(1))),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('an option or explanation contains "Her Majesty"');
    expect(result.out).toContain('bans from answers under the staleness flag');
    // The demotion is still made - nothing is excused by a rule it is currently
    // breaking - and it is still not the failure.
    expect(result.out).toContain('1 on row 1 per-claim re-verification');
  });

  it('fails the same way when the term is in the explanation and only in French', () => {
    // Both official languages ship, so a stale fact in one of them is a stale
    // fact shipped to half the players. The prompt is deliberately not searched.
    const result = runFlat(
      tree(
        'c0-ban-french',
        [
          question({
            prompt: { en: 'Who was Elizabeth?', fr: 'Qui etait Elizabeth ?' },
            explanation: {
              en: 'Two chambers and the Crown.',
              fr: 'Deux chambres et la reine Elizabeth.',
            },
          }),
        ],
        withLiveCheck('source-unrevised', dateAgo(1)),
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('an option or explanation contains "Elizabeth"');
  });

  it('does not fire on the answer routed around the stale fact, which is the point', () => {
    const result = runFlat(
      tree('c0-ban-clean', [question()], withLiveCheck('source-unrevised', dateAgo(1))),
    );
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('fails a REJECTED question too: a banned term is a defect in the answer', () => {
    // `rejected` and `quarantined` are excluded from the shipped-status rule
    // because they are not in the build. They are not a licence to leave a wrong
    // fact in the file: this is where a defective answer waits to be fixed, and
    // the contract gate over the real corpus has always read every question
    // regardless of status. Neither gate may be the weaker one.
    const result = runFlat(
      tree(
        'c0-ban-rejected',
        [
          banned({
            verification: {
              status: 'rejected',
              model: 'fixture-model',
              checkedAt: daysAgo(2),
              sourceHash: SOURCE_SHA,
              evidence: 'Parliament has three parts: the Sovereign',
            },
          }),
        ],
        withLiveCheck('source-unrevised', dateAgo(1)),
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('an option or explanation contains "Her Majesty"');
  });

  it('reports the SIZE of the search, so an idle check cannot look like a clean one', () => {
    // ADR-0024. A banned-term gate that ran over no term list produces output
    // identical to one that searched every list and found nothing, and this gate
    // was silent about a real violation for long enough that the difference is
    // not hypothetical.
    const searched = runFlat(
      tree('c0-ban-counted', [question()], withLiveCheck('source-unrevised', dateAgo(1))),
    );
    expect(searched.out).toContain(
      'banned terms — 1 claim(s) sat under a staleness flag naming 2 term(s) to search for; ' +
        '0 violation(s)',
    );

    const nothing = runFlat(tree('c0-ban-nothing', [question()]));
    expect(nothing.out).toContain('NOTHING WAS SEARCHED');
    expect(nothing.status).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The widened walk - a claim is a claim wherever a player reads it             */
/* -------------------------------------------------------------------------- */

describe('gate B walks every claim in content/, not every file in content/questions/', () => {
  it('checks a quest line and a landmark blurb, and says how many of each', () => {
    // The baseline the cases below break one at a time, and the line that would
    // have shown the hole: before this, a green run printed "462 question(s)"
    // over a corpus that also held 60 unchecked claims, and there was nothing in
    // the output to notice the absence of.
    const result = runClaims(treeWithClaims('w-baseline', {}));
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
    expect(result.out).toContain('content/questions/ — 1 document(s), 1 claim(s)');
    expect(result.out).toContain(
      'content/quests/ — 1 document(s), 2 claim(s): 1 state a fact and were checked, 1 are ' +
        'declared factual: false and were not',
    );
    expect(result.out).toContain('content/levels/ — 1 document(s), 1 claim(s)');
  });

  it('fails a fabricated quote in a line of NPC dialogue', () => {
    // The check ADR-0003 calls the one that catches a fabricated citation before
    // any verifier runs. This repository has shipped two of those, in questions,
    // where the check was running. Nothing was looking at dialogue.
    const fabricated = quest({
      fact: factOf({
        source: {
          ...(factOf().source as Json),
          quote: 'Parliament has four parts: the Sovereign and the Senate.',
        },
      }),
    });
    const result = runClaims(treeWithClaims('w-quest-quote', { quests: [fabricated] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('is not a contiguous passage');
    expect(result.out).toContain('/steps/0/dialogue/1/fact');
  });

  it('fails a landmark blurb lifted verbatim from the source', () => {
    const lifted = level({
      blurb: {
        en: 'The Governor General is appointed by the Sovereign on the advice of the Prime Minister.',
        fr: 'Le gouverneur general est nomme sur avis du premier ministre.',
      },
    });
    const result = runClaims(treeWithClaims('w-level-verbatim', { levels: [lifted] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('blurb.en shares a run of 15 consecutive words');
    expect(result.out).toContain('the wording must not be verbatim');
  });

  it('fails an unverified claim on a level, exactly as it fails an unverified question', () => {
    const unchecked = level({ fact: factOf({ verification: NULL_FORM }) });
    const result = runClaims(treeWithClaims('w-level-unverified', { levels: [unchecked] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('this sentence ships — a player reads it on the level');
  });

  it('leaves a line the author declared states no fact alone', () => {
    // The negative case, and it carries the weight: `factual: false` is the
    // author's recorded judgement about a greeting, and a gate that demanded a
    // citation for "Hello again!" would be turned off within a day.
    const result = runClaims(treeWithClaims('w-flavour', {}));
    expect(result.out).toContain('1 are declared factual: false and were not');
    expect(result.status).toBe(0);
  });

  it('fails a banned term in a blurb, and names the blurb rather than an option', () => {
    const stale = level({
      blurb: {
        en: 'The chamber sits under a portrait of Her Majesty.',
        fr: 'La chambre siege sous un portrait de Sa Majeste.',
      },
    });
    const result = runClaims(
      treeWithClaims(
        'w-level-banned',
        { levels: [stale] },
        withLiveCheck('source-unrevised', dateAgo(1)),
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('contains "Her Majesty"');
    // ADR-0016 §3's message used to be hard-coded to "an option or explanation",
    // which is a sentence about a surface a blurb does not have. A report that
    // names the wrong field is a report somebody has to decode.
    expect(result.out).toContain('the name and blurb this claim is attached to');
  });

  it('fails a factClaim the recogniser cannot match, rather than passing over it', () => {
    // THE TRIPWIRE. `isFactClaim` is what scopes every check a non-question claim
    // gets, and a recogniser that quietly stops matching produces a run identical
    // to a clean one - which is precisely what ADR-0003's `record` amendment did
    // to gate A's communityReview rule, where the only signal was a count in the
    // summary going down. Here the block has lost its `verification` key, so the
    // document's bytes and the recogniser disagree.
    const malformed = level({
      fact: { factual: true, source: (factOf().source as Json) },
    });
    const result = runClaims(treeWithClaims('w-tripwire', { levels: [malformed] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('"factual" key(s) and the claim recogniser found');
    expect(result.out).toContain('silently stopped inspecting');
  });

  it('fails a collection that exists and yields no factual claim', () => {
    // ADR-0024, one level up from the gate it is about. A quests directory whose
    // claims are all flavour produces output identical to one that was checked
    // and was clean.
    const allFlavour = quest({ fact: { factual: false, source: null, verification: null } });
    const result = runClaims(treeWithClaims('w-empty-collection', { quests: [allFlavour] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('of which ZERO state a fact');
    expect(result.out).toContain('not something a gate should discover by going quiet');
  });

  it('fails a collection that has gone missing entirely, by the DEFAULT floor', () => {
    // No `--collections` here, so this is the floor the Makefile target runs
    // under. A directory that is renamed or deleted must not lift the
    // requirement by disappearing.
    const result = runRaw(tree('w-missing-collection', [question()]));
    expect(result.status).toBe(1);
    expect(result.out).toContain('content/quests/ does not exist');
    expect(result.out).toContain('content/levels/ does not exist');
    expect(result.out).toContain('A missing directory and a clean one produce the same silence');
  });

  it('names a collection nobody declared a floor for, rather than counting it silently', () => {
    const root = treeWithClaims('w-unlisted', {});
    write(root, 'content/vignettes/fix-0.json', level());
    const result = runClaims(root);
    expect(result.out).toContain('content/vignettes/ — 1 document(s), 1 claim(s)');
    expect(result.out).toContain('not named in --collections');
    expect(result.status).toBe(0);
  });

  it('does not read the schemas that DEFINE a claim as claims', () => {
    const root = treeWithClaims('w-schema-not-claim', {});
    write(root, 'content/schemas/common.schema.json', commonSchema());
    write(root, 'content/schemas/question.schema.json', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      properties: {
        prompt: { type: 'object' },
        options: { type: 'array' },
        correctIndex: { type: 'integer' },
      },
    });
    const result = runClaims(root);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.out).toContain('content/questions/ — 1 document(s), 1 claim(s)');
    expect(result.out).not.toContain('content/schemas/');
  });

  it('fails when the schema defines a factClaim the recogniser would not match', () => {
    const root = treeWithClaims('w-claim-schema-drift', {});
    write(root, 'content/schemas/common.schema.json', commonSchema({ claim: 'drift' }));
    const result = runClaims(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('this gate identifies a claim by "factual"');
    expect(result.out).toContain('would skip it silently');
  });

  it('says out loud when the schemas here define no claim to check the recogniser against', () => {
    // ABSENT AND DIVERGED ARE DIFFERENT ANSWERS. A schema that does not define
    // the shape cannot be compared with a recogniser of it, and reporting that
    // as a failure would make every scratch tree carrying a partial schema red
    // for a reason that has nothing to do with the tree. Reporting it as nothing
    // at all is what makes a gap read as coverage, so it is a note.
    const root = treeWithClaims('w-no-claim-schema', {});
    const { $defs, ...rest } = commonSchema() as { $defs: Json };
    const { factClaim: _factClaim, ...withoutClaim } = $defs;
    write(root, 'content/schemas/common.schema.json', { ...rest, $defs: withoutClaim });
    const result = runClaims(root);
    expect(result.out).toContain('defines no factClaim');
    expect(result.out).toContain('nothing here confirmed it matches the schema');
    expect(result.status).toBe(0);
  });
});

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
    expect(result.out).toContain('2 claim(s) in 1 source register(s)');
    expect(result.out).toContain('2 verified; 2 shipped, 0 excluded');
    expect(result.out).toContain('text checks ran against a cached extraction for 2 claim(s)');
    expect(result.out).toContain('longest verbatim run in authored prose');
    expect(result.status).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* A4's GRAIN - a grant is a grant of ONE CLAIM, not of a document             */
/* -------------------------------------------------------------------------- */
/*
 * A4 stored `authorFieldsOf(document)` while its own comment said "the unit is
 * the claim". Two lines written into `territory.nationSource` - a sourceHash and
 * an asOf, filling fields that had been empty since the first level shipped -
 * voided every grant in all ten level documents: thirty point-of-interest blurbs
 * whose prose, quote, page and chapter were byte-identical to what a verifier
 * had checked hours earlier, plus the ten territorial statements that genuinely
 * had come unbound. It cost two verifier passes.
 *
 * THE NARROWING IS PROVED BY MUTATION, IN BOTH DIRECTIONS, and that is the only
 * way it can be proved. "The thirty stopped failing" is not evidence: a gate
 * that binds a grant to nothing also makes them stop failing, reports green for
 * ever, and fails silently in the direction of passing - which is worse than the
 * document-grain rule it replaced, because that one at least over-fired.
 *
 * So every row of the table below states the EXACT set of grants a single edit
 * unbinds. The positive half is "this edit voids this grant"; the negative half
 * is the rest of the set being empty, which is what says the edit did NOT reach
 * the other claims in the same file. A row that only asserted `toContain` would
 * pass against the defect.
 */

/** Every verification block in a document, reset to the null form. */
const unverified = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(unverified);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Json).map(([key, inner]) =>
        key === 'verification' && inner !== null ? [key, NULL_FORM] : [key, unverified(inner)],
      ),
    );
  }
  return value;
};

/** One field of a document, changed, with nothing else touched. */
const patched = (document: Json, path: readonly string[], value: unknown): Json => {
  const copy = JSON.parse(JSON.stringify(document)) as Json;
  const last = path.at(-1);
  if (last === undefined) throw new Error('patched() needs a path');
  let node = copy as Record<string, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[last] = value;
  return copy;
};

/**
 * A level carrying the three claim shapes that share a document: a territorial
 * statement with the `nationSource` block beside it, and two points of interest.
 * Deliberately NOT the `level()` fixture above - the cases that use that one are
 * each about a single rule, and a territory would put a second claim's output
 * into them.
 */
const a4Level = (): Json => ({
  $schema: '../schemas/level.schema.json',
  id: 'fix-level',
  subject: 'government',
  // Two root fields that were asked whether they belong to a claim and answered
  // no. The negative case below edits both and expects nothing to come unbound.
  order: 1,
  textureBudgetBytes: 8_000_000,
  territory: {
    nations: ['A fixture nation'],
    statement: {
      en: "The Crown's representative here is chosen on the advice of the head of government.",
      fr: "Le representant de la Couronne ici est choisi sur l'avis du chef du gouvernement.",
    },
    fact: factOf({
      source: {
        ...(factOf().source as Json),
        quote:
          'The Governor General is appointed by the Sovereign on the advice of the Prime Minister.',
      },
      verification: {
        ...(factOf().verification as Json),
        evidence: 'The Governor General is appointed by the Sovereign',
      },
    }),
    // Not a claim - no `factual` - but it carries a verification block of its
    // own, and it is the field whose two added lines started all this.
    nationSource: {
      publisher: 'A fixture nation',
      url: 'https://example.invalid/nation',
      sourceHash: '',
      asOf: null,
      verification: NULL_FORM,
    },
  },
  pois: [
    {
      id: 'a-landmark',
      name: { en: 'A landmark', fr: 'Un point de repere' },
      blurb: {
        en: 'The country keeps a crown, elects one chamber and appoints the other.',
        fr: 'Le pays garde une couronne, elit une chambre et nomme l autre.',
      },
      position: { x: 100, y: 200 },
      fact: factOf({
        source: {
          ...(factOf().source as Json),
          quote:
            'Canada is a constitutional monarchy, a parliamentary democracy and a federal state.',
        },
        verification: {
          ...(factOf().verification as Json),
          evidence: 'is a constitutional monarchy, a parliamentary democracy',
        },
      }),
    },
    {
      id: 'another-landmark',
      name: { en: 'Another landmark', fr: 'Un autre point de repere' },
      blurb: {
        en: 'A new law needs both chambers to agree, and then the Crown signs it.',
        fr: 'Une nouvelle loi exige l accord des deux chambres, puis la Couronne la signe.',
      },
      position: { x: 400, y: 200 },
      fact: factOf({
        source: {
          ...(factOf().source as Json),
          quote: 'A bill must pass both Houses before it receives royal assent and becomes law.',
        },
        verification: {
          ...(factOf().verification as Json),
          evidence: 'A bill must pass both Houses before it receives royal assent',
        },
      }),
    },
  ],
});

const LEVEL_PATH = 'content/levels/fix-level.json';
const QUEST_PATH = 'content/quests/fix-quest.json';

/**
 * The schemas the level and the quest name, copied from content/schemas/.
 *
 * Gate A matches a claim across revisions by the id its item schema REQUIRES
 * (scripts/lib/claims.mjs, "Which claim is which"), so a fixture tree without
 * these keys every claim by position — the behaviour the identity fix exists to
 * replace. The real files rather than fixture copies: the recogniser self-test
 * reads common.schema.json too, and a hand-written one would test a schema
 * nobody ships.
 */
const SCHEMAS_THAT_KEY_CLAIMS = ['common.schema.json', 'level.schema.json', 'quest.schema.json'];
const writeSchemas = (root: string): void => {
  for (const name of SCHEMAS_THAT_KEY_CLAIMS) {
    write(
      root,
      `content/schemas/${name}`,
      readFileSync(fileURLToPath(new URL(`../../../content/schemas/${name}`, import.meta.url)), 'utf8'),
    );
  }
};

type Edit = (level: Json, questDoc: Json) => readonly [Json, Json];

/**
 * Author everything in the null form, grant every status in a second commit,
 * then one commit per step. Properly separated commits, so a failure is the
 * rule under test and not the fixture doing two jobs at once.
 */
const historyRepo = (
  label: string,
  steps: readonly (readonly [string, Edit])[],
  options: { readonly schemas?: boolean } = {},
): Run => {
  const root = tree(label, [question({ verification: NULL_FORM })]);
  if (options.schemas ?? true) writeSchemas(root);
  let level_ = a4Level();
  let quest_ = quest();
  write(root, LEVEL_PATH, unverified(level_));
  write(root, QUEST_PATH, unverified(quest_));
  initRepo(root);
  commit(root, 'Author a level, a quest and a question in the null form');

  write(root, 'content/questions/government/fix-0.json', question());
  write(root, LEVEL_PATH, level_);
  write(root, QUEST_PATH, quest_);
  commit(root, 'Verify them all');

  for (const [subject, edit] of steps) {
    [level_, quest_] = edit(level_, quest_);
    write(root, LEVEL_PATH, level_);
    write(root, QUEST_PATH, quest_);
    commit(root, subject);
  }

  return run(root, ['--collections', 'questions,quests,levels']);
};

/** Three commits: author, grant, and the one edit under test. Nothing but A4 can fire. */
const a4Repo = (label: string, edit: Edit): Run => historyRepo(label, [['Edit one field', edit]]);

/** Exactly which grants came unbound, as `path at pointer`, in sorted order. */
const unbound = (out: string): readonly string[] =>
  out
    .split('\n')
    .filter((line) => line.includes("the claim's own fields have changed since"))
    .map((line) => line.slice(line.indexOf('FAIL: ') + 'FAIL: '.length, line.indexOf(': the status')))
    .sort((a, b) => a.localeCompare(b));

// Claims as gate A names them: by identity. The two landmarks and the step are
// keyed by the id their schemas require; the dialogue line has none of its own,
// so it is its step's id plus its index; the territory is a fixed path.
const TERRITORY = `${LEVEL_PATH} at /territory/fact/verification`;
const POI_0 = `${LEVEL_PATH} at /pois[id=a-landmark]/fact/verification`;
const POI_1 = `${LEVEL_PATH} at /pois[id=another-landmark]/fact/verification`;
const DIALOGUE = `${QUEST_PATH} at /steps[id=talk]/dialogue/1/fact/verification`;

describe('A4 binds a grant to its own claim, not to the document around it', () => {
  const cases: readonly {
    readonly what: string;
    readonly edit: (level: Json, questDoc: Json) => readonly [Json, Json];
    readonly voids: readonly string[];
    readonly names: string;
  }[] = [
    {
      // THE TRAP A FIELD LIST WOULD FALL INTO. French only: an implementation
      // that reached for `blurb.en`, or that compared prose in one locale,
      // would report green over a rewritten sentence half this country reads.
      what: 'a blurb, in French only',
      edit: (level_, quest_) => [
        patched(level_, ['pois', '0', 'blurb', 'fr'], 'Une phrase entierement differente.'),
        quest_,
      ],
      voids: [POI_0],
      names: 'blurb.fr',
    },
    {
      // `name` is the second `localizedText` sibling on a point of interest, and
      // scripts/lib/claims.mjs already counts it as prose the claim governs.
      what: "a point of interest's name",
      edit: (level_, quest_) => [
        patched(level_, ['pois', '0', 'name', 'en'], 'A renamed landmark'),
        quest_,
      ],
      voids: [POI_0],
      names: 'name.en',
    },
    {
      // The citation, not the prose. A verifier checked page 55; page 56 is a
      // different page of the same chapter and the grant is not a statement
      // about it.
      what: "a citation's page",
      edit: (level_, quest_) => [patched(level_, ['pois', '1', 'fact', 'source', 'page'], 56), quest_],
      voids: [POI_1],
      names: 'fact.source.page',
    },
    {
      what: "a citation's asOf date",
      edit: (level_, quest_) => [
        patched(level_, ['pois', '1', 'fact', 'source', 'asOf'], daysAgo(1)),
        quest_,
      ],
      voids: [POI_1],
      names: 'fact.source.asOf',
    },
    {
      // THE EDIT THAT COST TWO VERIFIER PASSES, at the grain it should always
      // have had. `nationSource` names the nation whose page is the authority
      // for the territorial statement, so the statement's grant SHOULD come
      // unbound - and the two blurbs' grants should not, which is what the
      // empty rest of `voids` asserts.
      what: "the nation source beside a territorial statement, the two lines that started this",
      edit: (level_, quest_) => [
        patched(
          patched(level_, ['territory', 'nationSource', 'sourceHash'], SOURCE_SHA),
          ['territory', 'nationSource', 'asOf'],
          dateAgo(1),
        ),
        quest_,
      ],
      voids: [TERRITORY],
      names: 'nationSource.sourceHash',
    },
    {
      what: 'a territorial statement',
      edit: (level_, quest_) => [
        patched(
          level_,
          ['territory', 'statement', 'en'],
          'The head of state is represented here by somebody the head of government names.',
        ),
        quest_,
      ],
      voids: [TERRITORY],
      names: 'statement.en',
    },
    {
      // The over-bind, asserted rather than left to be discovered. A point of
      // interest's position is inside its unit and WILL void that one grant.
      // The unit is taken whole because a field list is how this rule goes
      // silent, and one re-verification is the price of that.
      what: "a point of interest's position, which is the documented over-bind",
      edit: (level_, quest_) => [patched(level_, ['pois', '0', 'position', 'x'], 999), quest_],
      voids: [POI_0],
      names: 'position.x',
    },
    {
      // DOCUMENT SCOPE. ADR-0028: a subject is a teaching remit, and the
      // one-proposition-one-subject check is made against it, so re-filing a
      // level under another remit re-files every claim in it. All three grants,
      // and nothing in the quest or the bank.
      what: "the level's subject, which every claim in the level is filed under",
      edit: (level_, quest_) => [patched(level_, ['subject'], 'history'), quest_],
      voids: [POI_0, POI_1, TERRITORY],
      names: 'subject',
    },
    {
      // The same rule for the collection that carries no subject of its own.
      what: "a quest's levelId, which is the only remit label it has",
      edit: (level_, quest_) => [level_, patched(quest_, ['levelId'], 'some-other-level')],
      voids: [DIALOGUE],
      names: 'levelId',
    },
  ];

  for (const { what, edit, voids, names } of cases) {
    it(`voids the grant over ${what}, and no other grant`, () => {
      const result = a4Repo(`a4-${names.replace(/[^a-z]+/giu, '-')}`, edit);
      expect(unbound(result.out)).toEqual([...voids].sort((a, b) => a.localeCompare(b)));
      expect(result.out).toContain(names);
      expect(result.status).toBe(1);
    });
  }

  /**
   * The edit the whole table is measured against: two root fields that were
   * asked whether a claim binds to them and answered NO. `order` is
   * presentation and `textureBudgetBytes` is an engineering budget, and neither
   * is anything a verifier read. Under the document-grain rule this edit voided
   * all three grants in the file; it must now void none.
   *
   * Without a case like this, a gate that voided EVERYTHING would satisfy every
   * row above, because each row's expected set is compared only with itself.
   */
  const reorderAndRebudget = (level_: Json, quest_: Json): readonly [Json, Json] => [
    patched(patched(level_, ['order'], 2), ['textureBudgetBytes'], 9_000_000),
    quest_,
  ];

  it('voids nothing when the level is reordered and its texture budget retuned', () => {
    const result = a4Repo('a4-untouched', reorderAndRebudget);
    expect(unbound(result.out)).toEqual([]);
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it('reports how many grants each named document-scope field bound', () => {
    // ADR-0024's second guard, visible. A named field is the one part of a
    // claim's field set that cannot be found by shape, so it is the one part
    // that can go dead silently - renamed in a schema, dropped from the
    // documents - and bind nothing for ever.
    //
    // Six grants: the question, the territorial statement, the two blurbs, the
    // `nationSource` block's own grant, and the quest's one factual line. Four
    // bind `subject` - the level's three claims plus `nationSource`, which is
    // not a claim but does carry a verification block of its own. One binds
    // `levelId`. A question's grant binds neither, because for a question the
    // unit IS the document and `subject` is already inside it.
    const result = a4Repo('a4-scope-counts', reorderAndRebudget);
    expect(result.out).toContain('A4 binds each grant to its own claim');
    expect(result.out).toContain('6 grant(s) bound at HEAD');
    expect(result.out).toContain('document-scope bindings subject 4, levelId 1');
  });

  it('fails loudly when a grant binds to no author field of its own claim', () => {
    // ADR-0024, the vacuity shape a NARROWING is exposed to. A grant bound to
    // nothing can never be voided, so it reports green for ever; that is a
    // failure and not a pass. The block below sits two levels down from the
    // root with nothing authored beside it, which is the shape that empties a
    // unit out. Note the document still carries `subject`, so the bound SET is
    // not empty - the guard is on the claim's own unit, deliberately, because
    // a remit label alone is not a claim.
    const result = a4Repo('a4-vacuous-binding', (level_, quest_) => [
      { ...level_, acknowledgement: { wrapper: { verification: NULL_FORM } } },
      quest_,
    ]);
    expect(result.status).toBe(1);
    expect(result.out).toContain('/acknowledgement/wrapper/verification');
    expect(result.out).toContain('binds to NO author-owned field of its own claim');
    expect(result.out).toContain('ADR-0024');
    expect(unbound(result.out)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* WHICH CLAIM IS WHICH - known by its id, not by its position in a list       */
/* -------------------------------------------------------------------------- */
/*
 * Gate A matched a claim across two revisions by its JSON pointer, and an array
 * index is a position. The commit that gave Toronto a streetcar and Nathan
 * Phillips Square, and the foothills a pump jack, inserted them ahead of granted
 * landmarks: A1/A2 read that as rewriting the landmarks' grants - four failures
 * no later grant can clear, because A1/A2 is judged per commit - and the beef
 * cattle, moved in the same commit, had their old grant re-recorded against
 * the moved fields, so A4 never said a word. The commit that made those
 * landmarks quest stops did the same to quest steps, three failures more.
 *
 * Each shape is proved in BOTH directions: what identity lets through (an
 * insertion, a reorder, a deletion, a step inserted ahead of a granted line) and
 * what it must still catch (a moved landmark's own position, a moved line's own
 * words, a grant sliding into another claim's slot, an ambiguous id). The shapes
 * are rebuilt here rather than read from this repository's history, because a
 * commit id is not a fixture.
 */

const GRANTED = factOf().verification;

/** A point of interest as an author adds one: in the null form. */
const newPoi = (id: string, x: number): Json => ({
  id,
  name: { en: 'A new landmark', fr: 'Un nouveau point de repere' },
  blurb: {
    en: 'A crown and two chambers together make the laws here.',
    fr: 'Une couronne et deux chambres font ensemble les lois ici.',
  },
  position: { x, y: 200 },
  fact: factOf({ verification: NULL_FORM }),
});

/** A quest step as an author adds one, ahead of the step that holds the granted line. */
const newStep = (): Json => ({
  id: 'arrive',
  kind: 'visit',
  targetId: 'a-landmark',
  prompt: { en: 'Walk to the landmark', fr: 'Marchez jusqu au point de repere' },
  dialogue: [
    {
      speaker: 'guide',
      text: {
        en: 'A crown and two chambers make up our Parliament.',
        fr: 'Une couronne et deux chambres forment notre Parlement.',
      },
      fact: factOf({ verification: NULL_FORM }),
    },
  ],
});

const itemAt = (document: Json, list: string, index: number): Json => {
  const found = (document[list] as readonly Json[])[index];
  if (found === undefined) throw new Error(`no ${list}[${String(index)}] in the fixture`);
  return found;
};

/** A verifier's commit: one landmark's block granted, nothing else touched. */
const grantPoi =
  (index: number): Edit =>
  (level_, quest_) => [patched(level_, ['pois', String(index), 'fact', 'verification'], GRANTED), quest_];

const grantNewStep: Edit = (level_, quest_) => [
  level_,
  patched(quest_, ['steps', '0', 'dialogue', '0', 'fact', 'verification'], GRANTED),
];

/** Every separation-of-duties failure, so a case can say there were none. */
const dutyFailures = (out: string): readonly string[] =>
  out
    .split('\n')
    .filter(
      (line) =>
        line.includes('AND writes its verification block') ||
        line.includes('AND changes its verification block') ||
        line.includes('AND authors content in'),
    );

describe('a claim is known by its id, not by its position in a list', () => {
  it('clears the landmark shape: new landmarks were authored with no grant, and no grant changed', () => {
    const result = historyRepo('id-insert-landmarks', [
      [
        'Give the level two more landmarks',
        (level_, quest_) => [
          {
            ...level_,
            pois: [newPoi('streetcar', 50), itemAt(level_, 'pois', 0), newPoi('square', 250), itemAt(level_, 'pois', 1)],
          },
          quest_,
        ],
      ],
      ['Verify the new landmarks', (level_, quest_) => grantPoi(2)(...grantPoi(0)(level_, quest_))],
    ]);
    expect(dutyFailures(result.out)).toEqual([]);
    expect(unbound(result.out)).toEqual([]);
    // The gate says why, rather than a rule going quiet.
    expect(result.out).toContain('/pois[id=streetcar]/fact/verification (null form, no grant)');
    expect(result.out).toContain(
      '/pois[id=a-landmark]/fact/verification (/pois/0/fact/verification -> /pois/1/fact/verification, ' +
        'status "verified", block unchanged)',
    );
    expect(result.out).toContain(
      'Matched by position, this commit would have written or changed 3 verification block(s) here; ' +
        'matched by identity it wrote or changed 0.',
    );
    expect(result.out).toContain('verify-content: OK.');
    expect(result.status).toBe(0);
  });

  it("unbinds a moved landmark because its OWN position changed, not because a slot moved", () => {
    // The beef cattle: a landmark inserted ahead, and the granted one moved in
    // the same commit. Under positions A4 was silent here.
    const result = historyRepo('id-move-behind-insert', [
      [
        'Add a pump jack and move the second landmark',
        (level_, quest_) => [
          {
            ...level_,
            pois: [
              itemAt(level_, 'pois', 0),
              newPoi('pump-jack', 300),
              { ...itemAt(level_, 'pois', 1), position: { x: 900, y: 200 } },
            ],
          },
          quest_,
        ],
      ],
      ['Verify the pump jack', grantPoi(1)],
    ]);
    expect(unbound(result.out)).toEqual([POI_1]);
    expect(result.out).toContain('position.x');
    expect(result.out).toContain('(in the file today at /pois/2/fact/verification)');
    expect(dutyFailures(result.out)).toEqual([]);
    expect(result.status).toBe(1);
  });

  it('leaves a granted landmark bound when one is inserted ahead of it', () => {
    const result = historyRepo('id-insert-before', [
      [
        'Add a landmark at the front',
        (level_, quest_) => [
          { ...level_, pois: [newPoi('new-first', 50), itemAt(level_, 'pois', 0), itemAt(level_, 'pois', 1)] },
          quest_,
        ],
      ],
      ['Verify it', grantPoi(0)],
    ]);
    expect(dutyFailures(result.out)).toEqual([]);
    expect(unbound(result.out)).toEqual([]);
    expect(result.status).toBe(0);
  });

  it('leaves both grants bound when two landmarks swap places', () => {
    const result = historyRepo('id-reorder', [
      [
        'Swap the two landmarks',
        (level_, quest_) => [{ ...level_, pois: [itemAt(level_, 'pois', 1), itemAt(level_, 'pois', 0)] }, quest_],
      ],
    ]);
    expect(dutyFailures(result.out)).toEqual([]);
    expect(unbound(result.out)).toEqual([]);
    expect(result.status).toBe(0);
  });

  it('accepts deleting a landmark', () => {
    const result = historyRepo('id-delete', [
      ['Remove the first landmark', (level_, quest_) => [{ ...level_, pois: [itemAt(level_, 'pois', 1)] }, quest_]],
    ]);
    expect(dutyFailures(result.out)).toEqual([]);
    expect(unbound(result.out)).toEqual([]);
    expect(result.status).toBe(0);
  });

  it("does not let a deleted landmark's grant attach to the claim that slides into its slot", () => {
    // The survivor slides into slot 0 AND is reworded in the same commit. By
    // position, slot 0's grant was re-recorded against the reworded survivor and
    // A4 said nothing. By identity, the survivor is judged on its own words.
    const result = historyRepo('id-delete-and-edit', [
      [
        'Remove the first landmark and reword the second',
        (level_, quest_) => [
          {
            ...level_,
            pois: [patched(itemAt(level_, 'pois', 1), ['blurb', 'fr'], 'Une phrase entierement differente.')],
          },
          quest_,
        ],
      ],
    ]);
    expect(unbound(result.out)).toEqual([POI_1]);
    expect(result.out).toContain('blurb.fr');
    expect(dutyFailures(result.out)).toEqual([]);
    expect(result.status).toBe(1);
  });

  it('keeps a dialogue line bound when a step is inserted ahead of its step', () => {
    // The quest-stops commit: a step inserted, every later step moved, the
    // granted lines untouched. A line is its step's id plus its index.
    const result = historyRepo('id-insert-step', [
      [
        'Add a stop before the talk',
        (level_, quest_) => [level_, { ...quest_, steps: [newStep(), itemAt(quest_, 'steps', 0)] }],
      ],
      ['Verify the new stop', grantNewStep],
    ]);
    expect(dutyFailures(result.out)).toEqual([]);
    expect(unbound(result.out)).toEqual([]);
    expect(result.out).toContain(
      '/steps[id=talk]/dialogue/1/fact/verification (/steps/0/dialogue/1/fact/verification -> ' +
        '/steps/1/dialogue/1/fact/verification, status "verified", block unchanged)',
    );
    expect(result.status).toBe(0);
  });

  it('still unbinds that line when its own words change in the same commit', () => {
    const result = historyRepo('id-insert-step-and-edit', [
      [
        'Add a stop before the talk and reword its line',
        (level_, quest_) => [
          level_,
          {
            ...quest_,
            steps: [
              newStep(),
              patched(itemAt(quest_, 'steps', 0), ['dialogue', '1', 'text', 'en'], 'Parliament is three things, and one is the Crown.'),
            ],
          },
        ],
      ],
      ['Verify the new stop', grantNewStep],
    ]);
    expect(unbound(result.out)).toEqual([DIALOGUE]);
    expect(result.out).toContain('text.en');
    expect(dutyFailures(result.out)).toEqual([]);
    expect(result.status).toBe(1);
  });

  it('fails loudly on a duplicate id among granted claims, in the commit and in the tree', () => {
    const result = historyRepo('id-duplicate', [
      [
        'Give the second landmark the id of the first',
        (level_, quest_) => [patched(level_, ['pois', '1', 'id'], 'a-landmark'), quest_],
      ],
    ]);
    const ambiguous = result.out.split('\n').filter((line) => line.includes('carry id "a-landmark"'));
    expect(
      ambiguous.filter((line) => line.includes('"Give the second landmark the id of the first" — content/levels/fix-level.json:')),
    ).toHaveLength(1);
    expect(ambiguous.filter((line) => line.includes('FAIL: content/levels/fix-level.json: 2 items of /pois'))).toHaveLength(1);
    expect(result.out).toContain('ADR-0024');
    // One finding, not a second invented one about keys made up to tell them apart.
    expect(dutyFailures(result.out)).toEqual([]);
    expect(result.status).toBe(1);
  });

  it('fails a duplicate id in the tree before anything is granted, and leaves no permanent failure', () => {
    const twins: Edit = (level_, quest_) => [
      { ...level_, pois: [itemAt(level_, 'pois', 0), itemAt(level_, 'pois', 1), newPoi('twin', 600), newPoi('twin', 700)] },
      quest_,
    ];
    const unfixed = historyRepo('id-twins-unfixed', [['Add two landmarks that share an id', twins]]);
    expect(unfixed.out).toContain('FAIL: content/levels/fix-level.json: 2 items of /pois carry id "twin"');
    expect(unfixed.out).not.toContain('"Add two landmarks that share an id" — content/levels/fix-level.json: 2 items');
    expect(unfixed.status).toBe(1);

    const fixed = historyRepo('id-twins-fixed', [
      ['Add two landmarks that share an id', twins],
      ['Give the second twin its own id', (level_, quest_) => [patched(level_, ['pois', '3', 'id'], 'twin-two'), quest_]],
      ['Verify the twins', (level_, quest_) => grantPoi(3)(...grantPoi(2)(level_, quest_))],
    ]);
    expect(fixed.out).toContain('verify-content: OK.');
    expect(fixed.status).toBe(0);
  });

  it('treats a rename as a new claim: a grant carried across it is a grant in an authoring commit', () => {
    const kept = historyRepo('id-rename-kept', [
      ['Rename the first landmark', (level_, quest_) => [patched(level_, ['pois', '0', 'id'], 'renamed-landmark'), quest_]],
    ]);
    expect(
      dutyFailures(kept.out).filter((line) =>
        line.includes("/pois[id=renamed-landmark]/fact/verification: this commit changes the question's own fields AND writes"),
      ),
    ).toHaveLength(1);
    expect(kept.status).toBe(1);

    const reset = historyRepo('id-rename-reset', [
      [
        'Rename the first landmark and reset its grant',
        (level_, quest_) => [
          patched(patched(level_, ['pois', '0', 'id'], 'renamed-landmark'), ['pois', '0', 'fact', 'verification'], NULL_FORM),
          quest_,
        ],
      ],
      ['Re-verify the renamed landmark', grantPoi(0)],
    ]);
    expect(dutyFailures(reset.out)).toEqual([]);
    expect(reset.status).toBe(0);
  });

  it('keys by position when the tree carries no schema, fails loudly, and says why', () => {
    const result = historyRepo(
      'id-no-schemas',
      [
        [
          'Give the level two more landmarks',
          (level_, quest_) => [
            {
              ...level_,
              pois: [newPoi('streetcar', 50), itemAt(level_, 'pois', 0), newPoi('square', 250), itemAt(level_, 'pois', 1)],
            },
            quest_,
          ],
        ],
      ],
      { schemas: false },
    );
    expect(result.out).toContain('does not resolve in content/schemas/');
    expect(result.out).toContain('NOT known by identity');
    expect(dutyFailures(result.out).length).toBeGreaterThan(0);
    expect(dutyFailures(result.out).every((line) => line.includes('matched by POSITION'))).toBe(true);
    expect(result.status).toBe(1);
  });

  it('carries a grant across a schema change that re-keys its claim, so a later edit still unbinds it', () => {
    // Granted while no schema said the landmarks had ids, so keyed by position;
    // then the schemas arrive and the same claims are keyed by id. Without the
    // grant state being carried from one key to the other, the next revision
    // would re-record every grant against whatever its fields are by then - and
    // the reworded blurb below would pass A4 in silence.
    const root = tree('id-rekey', [question({ verification: NULL_FORM })]);
    const level_ = a4Level();
    write(root, LEVEL_PATH, unverified(level_));
    write(root, QUEST_PATH, unverified(quest()));
    initRepo(root);
    commit(root, 'Author a level, a quest and a question in the null form');
    write(root, 'content/questions/government/fix-0.json', question());
    write(root, LEVEL_PATH, level_);
    write(root, QUEST_PATH, quest());
    commit(root, 'Verify them all');
    writeSchemas(root);
    commit(root, 'Add the schemas');
    write(root, LEVEL_PATH, patched(level_, ['pois', '1', 'blurb', 'fr'], 'Une phrase entierement differente.'));
    commit(root, 'Reword the second landmark');

    const result = run(root, ['--collections', 'questions,quests,levels']);
    expect(unbound(result.out)).toEqual([POI_1]);
    expect(result.out).toContain('blurb.fr');
    expect(result.out).toContain('2 grant state(s) carried across a schema change that re-keyed their claim');
    expect(result.status).toBe(1);
  });

  it('fails when a schema stops requiring the id its documents still carry', () => {
    const root = tree('id-drift', [question()]);
    writeSchemas(root);
    const levelSchemaPath = 'content/schemas/level.schema.json';
    const levelSchema = JSON.parse(readFileSync(join(root, levelSchemaPath), 'utf8')) as {
      $defs: { pointOfInterest: { required: string[] } };
    };
    levelSchema.$defs.pointOfInterest.required = levelSchema.$defs.pointOfInterest.required.filter(
      (key) => key !== 'id',
    );
    write(root, levelSchemaPath, levelSchema);
    write(root, LEVEL_PATH, a4Level());
    write(root, QUEST_PATH, quest());
    const result = runClaims(root);
    expect(result.out).toContain('every item of /pois carries a distinct string "id"');
    expect(result.out).toContain('keyed by POSITION');
    expect(result.status).toBe(1);
  });
});
