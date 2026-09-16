/**
 * ADR-0003 at run time, for the claims that are not questions.
 *
 * ## The defect this exists for
 *
 * `app/adapters/content/question-catalog.ts` and
 * `app/application/content/question-bank.ts` between them mean a question whose
 * `verification.status` is not `verified` is never dealt: the rule is
 * `isVerified` in `@domain/entities/question`, and `Shippable<T>`'s private
 * symbol makes forgetting to apply it a compile error.
 *
 * **Nothing did that for a level's claims.** A point of interest carries a
 * `factClaim` beside its blurb and a level carries one beside its territorial
 * statement, and both were read as prose and drawn. On the day this was written
 * the tree held four claims a verifier had declined — `halifax /territory`
 * (rejected), `ottawa /pois/3` (rejected), `prairie-rail /pois/0` (rejected) and
 * `vancouver /territory` (quarantined) — and the blurbs among them drew to a
 * player while `verify-content` printed "8 excluded from the build". That line
 * was true of four questions and false of these.
 *
 * ADR-0003's scope amendment says verification follows *the claim*, not the
 * screen it lands on. This module is that rule for everything under
 * `content/levels/`.
 *
 * ## Why the rule is restated here and not imported
 *
 * `isVerified(question: Question)` is the rule, and it is in `app/domain`, where
 * it belongs. It cannot be called with a `factClaim`: a `Question` is a
 * different shape, and satisfying its type from a landmark blurb would mean
 * fabricating a prompt, four options and a correct index in order to ask one
 * question about two fields.
 *
 * So the three conditions are written once more, in the layer that has the
 * claim — and the seam is watched rather than trusted:
 * `tests/unit/adapters/phaser/a-claim-draws-only-when-verified.test.ts` drives
 * {@link adjudicateClaim} and the domain's `isVerified` over the same matrix of
 * statuses, hashes and evidence, and fails if they ever disagree. The right
 * long-term home is one predicate in `@domain` over a `{ source, verification }`
 * pair, with `Question` and `FactClaim` both satisfying it.
 *
 * ## What "loudly" means here (ADR-0024)
 *
 * A filter that removes nothing because it read the wrong field and a filter
 * that removes nothing because nothing needed removing are the same observation
 * unless something counts. So:
 *
 * - {@link readFactClaim} **refuses the document** when a claim declares
 *   `factual: true` and its `source` or `verification` block is missing,
 *   mistyped or misspelt. A claim this module cannot read is never a claim it
 *   waves through — the level does not load, and the message names the field.
 * - {@link ClaimCensus} counts what was *examined*, not only what was refused,
 *   so "0 refused of 40 examined" and "0 refused of 0 examined" are different
 *   sentences on the console and different attributes on the probe.
 *
 * Pure: no Phaser, no DOM, no fetch.
 */

import type { FactVerification, LocalizedText } from '@application/ports';
import { appErr, ok, type Result } from '@common/result';

/**
 * The one field of `FactSource` a rule reads, and the three of
 * `FactVerification`.
 *
 * `app/domain/entities/question.ts` declares exactly these two narrow shapes for
 * exactly this reason, and they cannot be imported: `.dependency-cruiser.cjs`'s
 * `outer-layers-use-domain-vocabulary-only` lets an adapter take the id
 * vocabulary from `app/domain` and nothing else, because a rule executed inside
 * an adapter is a rule the domain coverage gate never runs. So the shapes are
 * narrowed here from the **port**, which is what an adapter is supposed to take
 * domain data as, and the port's wider `FactSource` and `FactVerification`
 * satisfy them structurally — the same mechanism `QuestionDocument` uses to
 * satisfy the domain's pair.
 *
 * `status` is the port's own union rather than a second list of four strings, so
 * a fifth status is a compile error here rather than a value this file silently
 * treats as "not verified".
 */
export interface ClaimSource {
  /** SHA-256 of what the verifier read. A status granted for another is stale. */
  readonly sourceHash: string;
}

export interface ClaimVerification {
  readonly status: FactVerification['status'];
  readonly sourceHash: string;
  /** The passage that entails the claim. `verified` with none is an assertion. */
  readonly evidence: string;
}

/** The four statuses `common.schema.json#/$defs/factVerification` allows. */
export const CLAIM_STATUSES: readonly FactVerification['status'][] = [
  'unverified',
  'verified',
  'quarantined',
  'rejected',
];

/**
 * Why a claim may not be drawn. Three reasons, because ADR-0003 has three
 * conditions and a single "not verified" would hide the two that are silent
 * failures of an otherwise green document.
 *
 * - `not-verified` — the verifier said `unverified`, `quarantined` or
 *   `rejected`. The status is carried beside this so the console can say which.
 * - `stale` — the status was granted for a `sourceHash` the claim no longer
 *   cites. The source moved under a verdict that was once true.
 * - `unevidenced` — `verified` with no quoted passage, which is an assertion
 *   rather than a verification.
 */
export type ClaimRefusalReason = 'not-verified' | 'stale' | 'unevidenced';

/**
 * A claim, once it has been read.
 *
 * A discriminated union rather than the port's `FactClaim` (whose `source` and
 * `verification` are nullable) so that no caller downstream has to decide what
 * a `factual: true` claim with a null verification means. {@link readFactClaim}
 * is the only way to get one, and it refuses that combination outright.
 */
export type FactClaimBlock =
  | {
      /** Flavour: a greeting, an instruction, a caption. Nothing to verify. */
      readonly factual: false;
    }
  | {
      readonly factual: true;
      readonly source: ClaimSource;
      readonly verification: ClaimVerification;
    };

/** May this claim be put in front of a player, and if not, why not. */
export type ClaimVerdict =
  | { readonly drawable: true }
  | {
      readonly drawable: false;
      readonly status: FactVerification['status'];
      readonly why: ClaimRefusalReason;
    };

/**
 * ADR-0003's three conditions, and the one exemption.
 *
 * The exemption is `factual: false`: text the author has declared states no fact
 * about Canada needs no source and no verifier, which is the same judgement
 * `scripts/verify-content.mjs` makes and the reason `factual` is required rather
 * than optional. It is *counted* rather than ignored — see {@link ClaimCensus} —
 * because a document whose every claim is flavour is an authoring decision that
 * should be visible, not a quiet pass.
 */
export function adjudicateClaim(claim: FactClaimBlock): ClaimVerdict {
  if (!claim.factual) return { drawable: true };
  const { source, verification } = claim;
  if (verification.status !== 'verified') {
    return { drawable: false, status: verification.status, why: 'not-verified' };
  }
  if (verification.sourceHash !== source.sourceHash) {
    return { drawable: false, status: verification.status, why: 'stale' };
  }
  if (verification.evidence.trim().length === 0) {
    return { drawable: false, status: verification.status, why: 'unevidenced' };
  }
  return { drawable: true };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (field: string, message: string): Result<never> =>
  appErr('invalid', 'content.level.claim', message, { field });

/**
 * Read a `factClaim` block, or refuse the document.
 *
 * Every branch here is a document that cannot be adjudicated, and every one of
 * them refuses rather than defaulting. The alternative — treating an unreadable
 * block as unverified and dropping the prose — would make a renamed field look
 * exactly like an honest rejection, and would hide the rename behind the feature
 * that is meant to catch it.
 */
export function readFactClaim(raw: unknown, where: string): Result<FactClaimBlock> {
  if (!isRecord(raw)) {
    return invalid(
      where,
      `"${where}" must be a factClaim object. ADR-0003 governs a landmark blurb and a ` +
        'territorial statement exactly as it governs a question, and an absent block is an ' +
        'unchecked claim rather than an unclaimed one.',
    );
  }

  const factual = raw['factual'];
  if (typeof factual !== 'boolean') {
    return invalid(
      `${where}.factual`,
      `"${where}.factual" must be a boolean. It records the author's judgement that this text ` +
        'states a fact, and it is required so the judgement cannot default to unchecked.',
    );
  }
  if (!factual) return ok({ factual: false });

  const source = raw['source'];
  if (!isRecord(source) || typeof source['sourceHash'] !== 'string') {
    return invalid(
      `${where}.source`,
      `"${where}.source" must carry a sourceHash when "factual" is true. A claim with no source ` +
        'cannot be checked, and one this reader cannot parse must not pass for one that was.',
    );
  }

  const verification = raw['verification'];
  if (!isRecord(verification)) {
    return invalid(
      `${where}.verification`,
      `"${where}.verification" must be present when "factual" is true. This is the field the ` +
        'runtime filter reads; a missing or misspelt one is refused here so that it can never ' +
        'present as "nothing needed removing" (ADR-0024).',
    );
  }
  const status = verification['status'];
  if (typeof status !== 'string' || !CLAIM_STATUSES.includes(status as FactVerification['status'])) {
    return invalid(
      `${where}.verification.status`,
      `"${where}.verification.status" must be one of ${CLAIM_STATUSES.join(', ')}.`,
    );
  }
  const verifiedHash = verification['sourceHash'];
  const evidence = verification['evidence'];
  if (typeof verifiedHash !== 'string' || typeof evidence !== 'string') {
    return invalid(
      `${where}.verification`,
      `"${where}.verification" must carry a string sourceHash and a string evidence. A status ` +
        'granted for a hash nobody recorded cannot be told from a stale one.',
    );
  }

  return ok({
    factual: true,
    source: { sourceHash: source['sourceHash'] },
    verification: { status: status as FactVerification['status'], sourceHash: verifiedHash, evidence },
  });
}

/** One claim this level may not draw, named where the document names it. */
export interface RefusedClaim {
  /** JSON pointer into the level document: `/pois/3`, `/territory`. */
  readonly pointer: string;
  readonly status: FactVerification['status'];
  readonly why: ClaimRefusalReason;
  /** One sentence for the console. Developer-facing English, never drawn. */
  readonly message: string;
}

/**
 * What the filter looked at, and what it did.
 *
 * `examined` is the field that makes this a census rather than a list of
 * complaints. A filter that has stopped matching the blocks it reads produces
 * `examined: 0, refused: 0`; a level whose claims are all in order produces
 * `examined: 40, refused: 0`. Those were the same observation before this
 * existed, and the whole defect is that they read identically.
 */
export interface ClaimCensus {
  /** Claims read, factual or not. Equals `drawable + refused.length`. */
  readonly examined: number;
  /** Of those, the ones declaring a fact about Canada. */
  readonly factual: number;
  /** Claims whose prose the runtime may draw. */
  readonly drawable: number;
  readonly refused: readonly RefusedClaim[];
}

/** The census of a document that carries no claim at all. */
export const EMPTY_CENSUS: ClaimCensus = { examined: 0, factual: 0, drawable: 0, refused: [] };

/**
 * An accumulating census.
 *
 * A tiny builder rather than a `reduce`, because the claims of a level arrive
 * from three readers at three depths and threading a running total through them
 * is how one of them comes to be left out.
 */
export interface ClaimLedger {
  /**
   * Adjudicate one claim and record it.
   *
   * Answers with the refusal, or `null` when the prose may be drawn. The refusal
   * rather than a boolean, because the two surfaces that have to say something
   * about a refused claim — the console line and the "About this place" panel —
   * must say the *same* thing, and a caller that had to re-derive the reason
   * would eventually derive a different one.
   */
  admit(pointer: string, claim: FactClaimBlock): RefusedClaim | null;
  readonly census: ClaimCensus;
}

const sentence = (pointer: string, verdict: Extract<ClaimVerdict, { drawable: false }>): string => {
  switch (verdict.why) {
    case 'not-verified':
      return (
        `"${pointer}" is "${verdict.status}", so its prose is not drawn (ADR-0003: only ` +
        '"verified" ships). Fixing it is an author\'s and then a verifier\'s job; the runtime ' +
        'refusing to draw it is not a substitute for either.'
      );
    case 'stale':
      return (
        `"${pointer}" is "verified", but for a different sourceHash than the one it now cites. ` +
        'The source moved under the verdict, so the verdict is stale and the prose is not drawn.'
      );
    case 'unevidenced':
      return (
        `"${pointer}" is "verified" with no quoted evidence, which is an assertion rather than ` +
        'a verification, so the prose is not drawn.'
      );
  }
};

export function createClaimLedger(): ClaimLedger {
  let examined = 0;
  let factual = 0;
  let drawable = 0;
  const refused: RefusedClaim[] = [];

  return {
    admit(pointer, claim): RefusedClaim | null {
      examined += 1;
      if (claim.factual) factual += 1;
      const verdict = adjudicateClaim(claim);
      if (verdict.drawable) {
        drawable += 1;
        return null;
      }
      const refusal: RefusedClaim = {
        pointer,
        status: verdict.status,
        why: verdict.why,
        message: sentence(pointer, verdict),
      };
      refused.push(refusal);
      return refusal;
    },
    get census(): ClaimCensus {
      return { examined, factual, drawable, refused: [...refused] };
    },
  };
}

/**
 * The census as one line for the console, printed on every level load.
 *
 * Printed when nothing was refused too. A report that only appears when
 * something is wrong cannot show that the check ran at all, which is the
 * failure mode this whole module is about.
 */
/**
 * Is this census worth a line on the console?
 *
 * Two states, and the second is the one that matters.
 *
 * - **Something was refused.** A developer needs the pointer and the reason.
 * - **Nothing was examined.** Every level document carries a territorial claim —
 *   `level.schema.json` requires `territory` and `parseLevelDocument` refuses a
 *   level without one — so `examined: 0` is not "a level with no claims". It is
 *   the filter having stopped matching the blocks it reads, which is precisely
 *   the failure that used to be indistinguishable from success (ADR-0024).
 *
 * A level in good order is silent here and still publishes all three numbers to
 * the scene probe, so "0 refused of 4 examined" remains readable from outside
 * without a warning on every load.
 */
export function censusIsRemarkable(census: ClaimCensus): boolean {
  return census.refused.length > 0 || census.examined === 0;
}

export function describeCensus(levelId: string, census: ClaimCensus): string {
  const head =
    `level "${levelId}": ${String(census.examined)} claim(s) examined, ` +
    `${String(census.factual)} state a fact, ${String(census.drawable)} drawable, ` +
    `${String(census.refused.length)} not drawn.`;
  if (census.refused.length === 0) return head;
  return [head, ...census.refused.map((claim) => `  - ${claim.message}`)].join('\n');
}

/**
 * What the "About this place" panel draws (`docs/content-review.md` §10.2).
 *
 * §10.2 fixes the panel as **always reachable and never dismissed**, so there is
 * no third case where the panel is absent: a level always has one of these two.
 *
 * The `unavailable` branch deliberately carries **no nations and no publisher**.
 * The claim that was refused is a territorial attribution — "Halifax is in
 * Mi'kma'ki, the territory of the Mi'kmaq" — and `nations` is the same
 * attribution as a list, so a panel that dropped the sentence and kept the list
 * would still be making the statement a verifier declined, in a form that cannot
 * even be read and disagreed with. Naming the publisher does the same work
 * indirectly: "Assembly of Nova Scotia Mi'kmaw Chiefs" attributes the territory
 * to the Mi'kmaq as plainly as the sentence does.
 *
 * So the honest panel says that the statement for this place could not be
 * verified and is therefore not shown. That is less than §10.2 asks for and it
 * is stated out loud rather than papered over; a wrong attribution is worse than
 * an absent one, and an absent one that says nothing about its absence is worse
 * than one that does.
 */
export type AboutThisPlace =
  | {
      readonly kind: 'statement';
      /**
       * Each named as that nation names itself, and as the cited source names
       * them. Drawn only with the statement.
       *
       * **May be empty** (ADR-0051): where the source a statement cites names no
       * people for that place, the statement names none, and the panel draws no
       * list and no heading over one. That is a legitimate state, not a defect —
       * the level document records why the list is empty, and the panel's job is
       * to show what the statement says and where it came from.
       */
      readonly nations: readonly string[];
      readonly statement: LocalizedText;
      /**
       * §10.2: "the panel names where the territorial statement comes from".
       *
       * Who published the source the *statement* cites — `sourcePublisher` over
       * `fact.source.url`. Before ADR-0051 both came from `nationSource`, where
       * the names came from — a different page from the one the sentence was
       * quoted from on seven of the ten levels, and a different body on five.
       */
      readonly publisher: string;
      readonly sourceUrl: string;
    }
  | {
      readonly kind: 'unavailable';
      readonly status: FactVerification['status'];
      readonly why: ClaimRefusalReason;
      /** Developer-facing. The player-facing sentence is `app/ui`'s to write. */
      readonly message: string;
    };
