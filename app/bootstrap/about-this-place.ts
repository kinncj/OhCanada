/**
 * The seam between the adjudicated territorial claim and the panel that draws
 * it — `docs/content-review.md` §10.2.
 *
 * `app/adapters/phaser` decides whether a level's territorial statement may be
 * drawn (`SceneLevel.about`, from `verified-claim.ts`), and `app/ui` draws it
 * (`createAboutThisPlace`). Neither may import the other: the panel is DOM-only
 * and never imports an adapter (ADR-0005), and the adapter knows nothing about a
 * screen. The composition root is the only layer that sees both, so the mapping
 * lives here, where concretes are wired, and it is **twelve lines with a test
 * against it** rather than an inline expression in `openLevel`.
 *
 * ## Why this is not a `??` at the call site
 *
 * Two facts have to hold every time, and both are invisible at a glance:
 *
 *  1. **`LevelDocument.territory` is never read.** `SceneLevel.about` is the
 *     adjudicated claim and the only input here. A panel written against the raw
 *     document would draw the sentence a verifier declined — Halifax's
 *     `/territory` is `rejected` today — with every gate still green. The type
 *     of {@link aboutThisPlaceView}'s parameter is what makes that impossible
 *     rather than discouraged.
 *  2. **The refused branch loses the nation list and the publisher.** They are
 *     the same attribution in another form: `nations: ["Mi'kmaq"]` states what
 *     the rejected sentence states, and "Assembly of Nova Scotia Mi'kmaw Chiefs"
 *     states it indirectly. `AboutThisPlace`'s `unavailable` branch carries
 *     neither, and {@link AboutThisPlaceView}'s carries neither, so this function
 *     has nothing to leak — but it also drops `status`, `why` and `message`,
 *     which are a developer's and would reach a player as either a verdict about
 *     a nation's page or a pointer to a JSON path.
 *
 * The four statuses and three refusal reasons collapse into two player-facing
 * cases, which is the one judgement this file makes: see
 * {@link AboutUnavailableReason}.
 */

import type { AboutThisPlace } from '@adapters/phaser';
import type { LocalizedText } from '@domain/entities/values';
import type { AboutThisPlaceView, AboutUnavailableReason } from '@ui/about-this-place';
import type { UiLocale } from '@ui/copy';

/**
 * Which of the panel's two refusals a claim earns.
 *
 * `being-checked` is the case where a verdict *was* granted and the ground moved
 * under it: `quarantined`, which `verify-content` sets when a `volatile` source
 * changes or its `asOf` ages out, and `stale`, which is a status granted for a
 * `sourceHash` the claim no longer cites. `TN-PEGGYS-06` and `TN-NORTH-06` both
 * require the panel to "say plainly that the source is being checked" in exactly
 * that situation, and `content/sources/kmk-about-consultation.json` records that
 * level 2's statement is one sentence away from being in it.
 *
 * Everything else — never verified, verified with no evidence quoted, or read
 * and declined — is `not-checked`. Splitting those three on screen would publish
 * a verdict about a nation's own page, which is not this game's to publish and
 * is not information a player can act on.
 */
function reasonFor(
  about: Extract<AboutThisPlace, { kind: 'unavailable' }>,
): AboutUnavailableReason {
  if (about.why === 'stale') return 'being-checked';
  return about.status === 'quarantined' ? 'being-checked' : 'not-checked';
}

/**
 * The adjudicated claim as the panel's view, in one language.
 *
 * `localise` is the caller's — `openLevel` already holds the one function that
 * turns a `LocalizedText` into a string for the language in force, and a second
 * copy of that decision here is how a level ends up half-translated.
 */
export function aboutThisPlaceView(
  about: AboutThisPlace,
  locale: UiLocale,
  localise: (value: LocalizedText, locale: UiLocale) => string,
): AboutThisPlaceView {
  if (about.kind === 'statement') {
    return {
      kind: 'statement',
      statement: localise(about.statement, locale),
      /* Copied, not aliased: the panel holds this until the level closes and a
         readonly array the adapter also holds is one refactor from being sorted
         under it. Each name is already spelled as that nation spells it, in both
         languages (`docs/content-review.md` §9.3), so nothing here translates. */
      nations: [...about.nations],
      publisher: about.publisher,
      sourceUrl: about.sourceUrl,
    };
  }
  return { kind: 'unavailable', reason: reasonFor(about) };
}
