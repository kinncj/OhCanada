/**
 * ADR-0003's rule, handed to the lesson filter — and the reason there is still
 * no third copy of it in `app/`.
 *
 * ADR-0063 §6 puts the shippable-passage filter in `app/application`, "never in
 * a screen, so the level reader and the Learn reader cannot disagree about what
 * is readable". That is where `app/application/content/lesson-passages.ts` is.
 * But the *rule* it has to apply — status `verified`, granted for the hash the
 * claim still cites, evidence quoted — already exists twice in this tree:
 *
 *  - `app/domain/entities/question.ts`, for a `Question`;
 *  - `app/adapters/phaser/verified-claim.ts`, for every claim that is not one,
 *    because `isVerified` is typed for a `Question` and satisfying that type
 *    from a lesson passage would mean fabricating a prompt, four options and a
 *    correct index.
 *
 * `tests/unit/contracts/one-rule-decides-what-may-be-drawn.test.ts` exists to
 * stop a third, and it is right to: two copies is the most this project can
 * bear, and both of those are driven over a shared matrix. `app/application` can
 * reach neither — `.dependency-cruiser.cjs` forbids `app/application` from
 * importing `app/adapters` at all, and the adapter's copy is not a domain rule
 * it could take instead.
 *
 * **So the rule is injected, and this file is the injector.** It is the
 * composition root, which is the one layer that may see both (ADR-0005), and it
 * is the same deep import `./verified-dialogue.ts` already uses for the same
 * reason — through `@adapters/phaser/verified-claim` and never through
 * `@adapters/phaser`, so a module that touches no canvas does not put Phaser on
 * the boot path. Nothing here decides anything; it adapts one shape to another
 * and names the refusal.
 *
 * ## What this file deliberately does NOT decide
 *
 * **Whether `factual: false` is readable.** `adjudicateClaim` answers *drawable*
 * for it, and that is correct for what it was written for: a greeting in an
 * NPC's mouth claims nothing and needs no verifier. A lesson passage is not
 * exempt that way — every passage is a claim (ADR-0061 §9.3), so one asserting
 * nothing teaches nothing — and that condition belongs to the filter, beside the
 * rest of what "readable" means for a passage. It is in
 * `lesson-passages.ts`'s `passageVerdict`, which asks it *before* it asks this
 * function, and the tooling gate asks it in the same order.
 */

import { adjudicateClaim, readFactClaim } from '@adapters/phaser/verified-claim';
import type { AdjudicateClaim, ClaimGrant } from '@application/content/lesson-passages';
import type { FactClaim } from '@application/ports';

/**
 * One claim, through the one rule, as the application layer's {@link ClaimGrant}.
 *
 * A block this build cannot read is `unreadable` and never granted: a claim that
 * cannot be adjudicated is never one that is waved through (ADR-0024), and
 * `readFactClaim` refuses exactly the cases — a `factual: true` claim with a
 * missing, mistyped or misspelt `source` or `verification` — that would
 * otherwise present as "nothing needed removing".
 *
 * The four refusal words are the ones `scripts/lib/lesson-passages.mjs` uses,
 * because one test drives both over the same matrix and a disagreement has to be
 * visible as a different word rather than as a different sentence.
 */
export const grantsPassage: AdjudicateClaim = (claim: FactClaim): ClaimGrant => {
  const block = readFactClaim(claim, 'fact');
  if (!block.ok) return { granted: false, why: 'unreadable', status: null };

  /* The status is read for the message, not for the verdict: which of the four
     a refused grant carries is what tells "you renamed the source" from "the
     verifier declined it", and the verdict itself is `adjudicateClaim`'s. */
  const status = block.value.factual ? block.value.verification.status : null;

  const verdict = adjudicateClaim(block.value);
  if (verdict.drawable) return { granted: true, why: null, status };
  return { granted: false, why: verdict.why, status: verdict.status };
};
