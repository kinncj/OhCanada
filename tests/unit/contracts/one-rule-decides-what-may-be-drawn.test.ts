/**
 * ADR-0003 is decided in one place, and the list of places is enforced.
 *
 * ## Why this file exists
 *
 * `app/adapters/phaser/verified-claim.ts` holds the rule for every claim that is
 * not a question: three conditions — the status is `verified`, the grant cites
 * the hash the claim still cites, the grant quotes evidence. `app/domain` holds
 * the same three for a question, as `isVerified`, and the two cannot be one
 * function today because a `Question` and a `factClaim` are different shapes and
 * `.dependency-cruiser.cjs` will not let an adapter execute a domain rule.
 *
 * Two copies is the most this project can bear, and both are watched:
 * `a-claim-draws-only-when-verified.test.ts` drives `adjudicateClaim` and
 * `isVerified` over the same matrix, and `a-line-is-said-only-when-verified.test.ts`
 * drives `adjudicateClaim` and the quest adjudicator over another.
 *
 * A **third** copy is what this file exists to prevent. The dialogue gate needed
 * the rule and could have restated it — three conditions are ten lines, and they
 * would have been ten lines in a directory nobody compares with the first. It
 * imports instead, and the import is a deep one through the phaser index's
 * curated surface, which the index's own comment says is closed. That comment is
 * true only for as long as something checks it.
 *
 * ## What is asserted
 *
 * Only the file that defines `adjudicateClaim` and `readFactClaim`, and the
 * named callers below, may say those words in `app/`. Anything else is a layer
 * deciding for itself what "verified" means, which is the shape of every defect
 * this mechanism has been built twice to catch.
 *
 * **Calling the rule and copying it are different acts, and this file draws the
 * line between them.** The check below the list is the one about copies: no file
 * outside the two holders may compare a `status` to `'verified'` by hand. A
 * caller that *imports* the rule is the opposite of the defect — it is what
 * stops a copy being written — so the list is allowed to grow, on one condition
 * that is stated per entry: the caller adapts or applies the verdict and never
 * re-derives it.
 *
 * A source scan and not a type check, deliberately. There is no type that can
 * say "nobody else may call this", and a dependency-cruiser rule would be a
 * fourth place to state the boundary; what a reader needs is the rule, the
 * allowance, and the reason, in one file they can read in a minute.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const APP = `${REPO_ROOT}app`;

/** The file that defines the rule. */
const THE_RULE = 'app/adapters/phaser/verified-claim.ts';

/**
 * The composition-root files allowed to *call* it, each with the reason.
 *
 * Both are in `app/bootstrap`, and that is the whole of the pattern rather than
 * a coincidence: the composition root is the one layer that may see an adapter
 * and the application at once (ADR-0005), so it is the only place a rule that
 * lives in an adapter can be handed to a layer that may not import one.
 */
const THE_CALLERS: Readonly<Record<string, string>> = {
  // The quest's voice. A line a verifier declined is not a value the quest
  // surface can be given (ADR-0003's scope amendment).
  'app/bootstrap/verified-dialogue.ts':
    'adjudicates each dialogue line; holds no copy of the conditions',
  // ADR-0063 §6 puts the shippable-passage filter in `app/application`, and
  // `.dependency-cruiser.cjs` forbids `app/application -> app/adapters`, so the
  // filter takes the rule as a parameter and this file is what supplies it.
  // Writing the conditions into `app/application/content/lesson-passages.ts`
  // instead is exactly the third copy this gate exists to prevent; injecting
  // them is what makes that copy unnecessary.
  'app/bootstrap/verified-passages.ts':
    'adapts the verdict for the lesson-passage filter; holds no copy of the conditions',
};

const THE_SECOND_HOLDER = 'app/bootstrap/verified-dialogue.ts';

/**
 * The domain's own copy, which is the original and is not going anywhere.
 *
 * `isVerified(question: Question)` is where the rule *belongs*, and the reason
 * `verified-claim.ts` restates it rather than calling it is written at the top
 * of that file: a `factClaim` cannot be passed to a function typed for a
 * `Question` without fabricating a prompt, four options and a correct index. The
 * seam between the two is driven over a shared matrix by
 * `a-claim-draws-only-when-verified.test.ts`, so this pair is watched rather
 * than merely tolerated. A *third* is not.
 */
const THE_DOMAIN_RULE = 'app/domain/entities/question.ts';

/** The two names that *are* the rule. Neither may be called from anywhere else. */
const RULE_NAMES = ['adjudicateClaim', 'readFactClaim'] as const;

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = `${directory}/${entry}`;
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/**
 * A file's source, and the same source **with its comments taken out**.
 *
 * Every check below reads `code`, not `text`, and that distinction is the one
 * this file got wrong the first time it was asked a new question. The scan is
 * about what a layer *does*; a comment is what it *says*. The gate as written
 * failed `app/application/content/lesson-passages.ts`, whose header exists
 * entirely to explain that it does **not** hold the rule and takes
 * `adjudicateClaim`'s verdict as a parameter instead — the most useful sentence
 * in the file, and the one thing this gate punished.
 *
 * That is the same trap `ports-are-provisional.test.ts` documents for the
 * `PROVISIONAL` marker, in its own words: "a check that punishes explaining
 * yourself teaches people to explain themselves less." It is also how
 * `a-read-step-reaches-a-reader.test.ts` already reads a screen's source. The
 * line-level filter is deliberately crude and cannot see a trailing comment
 * after code — which fails in the safe direction, because a file with
 * `adjudicateClaim(…)  // …` still reports.
 */
const withoutComments = (source: string): string =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line))
    .join('\n');

const FILES = sourceFiles(APP).map((path) => {
  const text = readFileSync(path, 'utf8');
  return { relative: path.slice(REPO_ROOT.length), text, code: withoutComments(text) };
});

describe('the rule that decides whether a claim may be drawn', () => {
  it('is read from a source tree that is not empty', () => {
    /* The floor, because every check below folds an empty list into a pass. */
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.map((file) => file.relative)).toContain(THE_RULE);
    expect(FILES.map((file) => file.relative)).toContain(THE_SECOND_HOLDER);
  });

  it('is named only in the rule\u2019s own directory and by the listed callers', () => {
    const holders = FILES.filter((file) =>
      RULE_NAMES.some((name) => new RegExp(`\\b${name}\\b`).test(file.code)),
    ).map((file) => file.relative);

    /*
     * `level-document.ts` calls `readFactClaim` because it is the level's own
     * parser inside the same directory, which is inside the enclosure; what this
     * check is about is a *third directory*. (`app/adapters/phaser/index.ts`
     * names them only in a comment saying why they are not exported, so it no
     * longer appears here at all — see `withoutComments` above.)
     */
    const outside = holders.filter(
      (path) => THE_CALLERS[path] === undefined && !path.startsWith('app/adapters/phaser/'),
    );

    expect(
      outside,
      `${outside.join(', ')} reaches for the rule without being listed for it. ` +
        `The rule lives in ${THE_RULE}; import it from the composition root and add the file ` +
        `to THE_CALLERS with its reason, or say in an ADR why a third copy is right.`,
    ).toEqual([]);
    expect(holders).toContain(THE_RULE);
    /* A listed caller that stopped calling is a stale allowance, and it reads as
       coverage of something nothing does any more (ADR-0015). */
    for (const caller of Object.keys(THE_CALLERS)) {
      expect(holders, `${caller} is listed as a caller and names neither rule`).toContain(caller);
    }
  });

  it('lets every listed caller take it from the file that defines it', () => {
    for (const caller of Object.keys(THE_CALLERS)) {
      const file = FILES.find((candidate) => candidate.relative === caller);
      expect(file, `${caller} is listed as a caller and does not exist`).toBeDefined();
      expect(file?.code).toContain("from '@adapters/phaser/verified-claim'");
      /* Not through the index: that would be a Phaser import on the boot path
         for a module that touches no canvas. */
      expect(file?.code, `${caller} imports the phaser barrel`).not.toContain(
        "from '@adapters/phaser'",
      );
    }
  });

  it('is not re-exported from the phaser index, so a deep import is the only route', () => {
    const index = FILES.find((file) => file.relative === 'app/adapters/phaser/index.ts');
    expect(index).toBeDefined();

    /*
     * The export block, not the comment above it. `export { … } from
     * './verified-claim'` must not list either name — if it did, any layer could
     * take the rule through the public surface and this contract would be about
     * nothing.
     */
    const exported = /export \{([^}]*)\} from '\.\/verified-claim';/.exec(index?.text ?? '');
    expect(exported, 'the verified-claim export block moved or was renamed').not.toBeNull();
    for (const name of RULE_NAMES) {
      expect(exported?.[1] ?? '', `${name} is on the public surface`).not.toContain(name);
    }
  });

  it('is not restated: no second copy of the three conditions in app/', () => {
    /*
     * A cheap shape check for the rule written out by hand — a comparison
     * against the literal `'verified'` next to a `status` — outside the two
     * files that are allowed to make it. It cannot catch every paraphrase, and
     * it does catch the copy-paste, which is the way a third copy actually
     * arrives.
     */
    const restated = FILES.filter(
      (file) =>
        file.relative !== THE_RULE &&
        file.relative !== THE_SECOND_HOLDER &&
        file.relative !== THE_DOMAIN_RULE &&
        /status\s*(!==|===)\s*'verified'/.test(file.code),
    ).map((file) => file.relative);
    /* A caller is allowed to NAME the rule and not to restate it, which is the
       distinction this pair of checks is made of: `verified-passages.ts` is in
       THE_CALLERS above and is deliberately not exempted here. */

    expect(
      restated,
      `${restated.join(', ')} compares a verification status to 'verified' by hand. ` +
        `Two copies of ADR-0003's conditions exist and both are watched by a seam test; ` +
        `a third is a layer deciding for itself what "verified" means.`,
    ).toEqual([]);

    /* The two that are allowed still say it, so this check is about something. */
    const allowed = FILES.filter(
      (file) => file.relative === THE_RULE || file.relative === THE_DOMAIN_RULE,
    ).filter((file) => /status\s*(!==|===)\s*'verified'/.test(file.code));
    expect(allowed).toHaveLength(2);
  });
});
