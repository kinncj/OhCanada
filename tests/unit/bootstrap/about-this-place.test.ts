/**
 * The seam between an adjudicated territorial claim and the panel that draws it.
 *
 * `app/bootstrap/about-this-place.ts` is twelve lines, and each of the two
 * things it does is a decision that a wrong version of would be invisible:
 *
 *  1. It reads `SceneLevel.about` — the verdict — and there is no path through
 *     it that can reach a level document's raw `territory` block. That is a
 *     type, not a discipline, and the test for it is that the function takes
 *     `AboutThisPlace` and nothing else.
 *  2. **A refused claim loses its nations and its publisher.** Halifax's
 *     statement was declined because its first sentence places Halifax in
 *     Mi'kma'ki and the cited source does not say so, so `nations: ["Mi'kmaq"]`
 *     is the same attribution in list form and "Assembly of Nova Scotia Mi'kmaw
 *     Chiefs" is the same attribution by its publisher. The adapter's union has
 *     no field for either on that branch; this file proves the mapping does not
 *     reintroduce one, and that the developer-facing `status`, `why` and
 *     `message` stop here.
 *
 * The third thing it decides is which of two sentences a player reads, and the
 * matrix below is written out rather than sampled, because every status and
 * every refusal reason has to land somewhere and "somewhere" is the bug.
 */

import { describe, expect, it } from 'vitest';

import { aboutThisPlaceView } from '../../../app/bootstrap/about-this-place';
import type { AboutThisPlace, ClaimRefusalReason } from '@adapters/phaser';
import type { LocalizedText } from '@domain/entities/values';
import type { UiLocale } from '@ui/copy';

const localise = (value: LocalizedText, locale: UiLocale): string =>
  locale === 'fr' ? value.fr : value.en;

const STATEMENT: AboutThisPlace = {
  kind: 'statement',
  nations: ['Fixture Nation'],
  statement: {
    en: 'Fixture Town is on the traditional territory of the Fixture Nation.',
    fr: 'Fixture Town se trouve sur le territoire traditionnel de la Fixture Nation.',
  },
  publisher: 'Fixture Nation Council',
  sourceUrl: 'https://example.invalid/about',
};

const refused = (
  status: 'unverified' | 'verified' | 'quarantined' | 'rejected',
  why: ClaimRefusalReason,
): AboutThisPlace => ({
  kind: 'unavailable',
  status,
  why,
  /* What the console gets: a field in a document, and a player never sees it. */
  message: 'level "halifax" /territory: verification.status is "rejected".',
});

describe('the "About this place" view', () => {
  it('carries a verified statement through in the language asked for', () => {
    expect(aboutThisPlaceView(STATEMENT, 'en', localise)).toEqual({
      kind: 'statement',
      statement: 'Fixture Town is on the traditional territory of the Fixture Nation.',
      nations: ['Fixture Nation'],
      publisher: 'Fixture Nation Council',
      sourceUrl: 'https://example.invalid/about',
    });

    const fr = aboutThisPlaceView(STATEMENT, 'fr', localise);
    expect(fr).toMatchObject({
      statement: 'Fixture Town se trouve sur le territoire traditionnel de la Fixture Nation.',
      /* `docs/content-review.md` §9.3: the endonym is not translated, so it is
         the same string in the French view as in the English one. */
      nations: ['Fixture Nation'],
      publisher: 'Fixture Nation Council',
    });
  });

  it('copies the nation list rather than aliasing the adapter\'s', () => {
    const view = aboutThisPlaceView(STATEMENT, 'en', localise);
    expect(view.kind).toBe('statement');
    if (view.kind !== 'statement') return;
    expect(view.nations).not.toBe(STATEMENT.kind === 'statement' ? STATEMENT.nations : null);
    expect([...view.nations]).toEqual(['Fixture Nation']);
  });

  it('drops the nations, the publisher and the developer message when a claim was refused', () => {
    const view = aboutThisPlaceView(refused('rejected', 'not-verified'), 'en', localise);

    expect(view).toEqual({ kind: 'unavailable', reason: 'not-checked' });
    /* Written as a property of the whole object rather than as three absences,
       so a field added later fails this rather than passing unnoticed. */
    expect(Object.keys(view).sort()).toEqual(['kind', 'reason']);
    expect(JSON.stringify(view)).not.toContain('Fixture');
    expect(JSON.stringify(view)).not.toContain('/territory');
  });

  it('says the source is being checked only where a verdict was granted and moved', () => {
    /*
     * `TN-PEGGYS-06` and `TN-NORTH-06` require "the source is being checked"
     * when a statement is quarantined because its source changed, and that is
     * two situations rather than one: the verifier quarantined it, or the status
     * it was granted no longer matches the `sourceHash` the claim cites
     * (`stale`). Everything else is the other sentence.
     */
    const matrix: readonly [
      'unverified' | 'verified' | 'quarantined' | 'rejected',
      ClaimRefusalReason,
      'being-checked' | 'not-checked',
    ][] = [
      ['quarantined', 'not-verified', 'being-checked'],
      ['verified', 'stale', 'being-checked'],
      ['rejected', 'stale', 'being-checked'],
      ['rejected', 'not-verified', 'not-checked'],
      ['unverified', 'not-verified', 'not-checked'],
      ['verified', 'unevidenced', 'not-checked'],
    ];

    for (const [status, why, reason] of matrix) {
      expect(
        aboutThisPlaceView(refused(status, why), 'en', localise),
        `${status}/${why}`,
      ).toEqual({ kind: 'unavailable', reason });
    }
  });

  it('never lets a verifier\'s verdict reach a player as a verdict', () => {
    /* "Rejected", "unverified" and "verified with nothing quoted" differ to a
       verifier and not to a player, and the difference is a judgement about a
       nation's own page. All three collapse into one sentence. */
    const reasons = new Set(
      (
        [
          refused('rejected', 'not-verified'),
          refused('unverified', 'not-verified'),
          refused('verified', 'unevidenced'),
        ] as const
      ).map((about) => {
        const view = aboutThisPlaceView(about, 'en', localise);
        return view.kind === 'unavailable' ? view.reason : 'statement';
      }),
    );
    expect([...reasons]).toEqual(['not-checked']);
  });
});
