/**
 * A level claim reaches a player only if a verifier granted it — ADR-0003.
 *
 * ## The defect
 *
 * `content/questions/` is filtered twice: `make verify-content` in CI, and
 * `isVerified` + `Shippable<T>` at run time, so a rejected question is never
 * dealt. Nothing did that for a **level or quest claim**. A point of interest's
 * `blurb` and a level's territorial `statement` carry the same `factClaim`
 * block, `parseLevelDocument` carried it through untouched, and the POI card
 * drew the prose.
 *
 * On the day this file was written the repository held four claims a verifier
 * had declined, and two of them drew to a player:
 *
 * | claim | status | what it says |
 * |---|---|---|
 * | `halifax /territory` | rejected | places Halifax in Mi'kma'ki; the cited source does not say so |
 * | `ottawa /pois/3` | rejected | "was built as a military waterway"; the source says it was *once* one |
 * | `prairie-rail /pois/0` | rejected | a share the register bans from answers |
 * | `vancouver /territory` | quarantined | names three nations; the source covers one |
 *
 * Meanwhile `verify-content` printed "8 excluded from the build", which was true
 * of four questions and false of these four — a summary line that read as a
 * guarantee.
 *
 * ## How this suite avoids being the next thing that passes over nothing
 *
 * Three kinds of test, because each one fails for a different reason.
 *
 * 1. **The seam.** `adjudicateClaim` restates a rule that lives in
 *    `@domain/entities/question`, because a `factClaim` cannot be passed to a
 *    function typed for a `Question`. The matrix below drives *both* over the
 *    same sixteen inputs and fails if they ever disagree, so the copy cannot
 *    drift in silence.
 * 2. **The corpus.** Every level under `content/levels/` is parsed, and what the
 *    parser decided is compared with a verdict this file computes **out of the
 *    raw JSON by a different route**. That keeps tracking the content: when an
 *    author fixes Halifax, the expectation moves with it and nothing here needs
 *    editing. What it cannot do is pass because no input reached it — a filter
 *    reading the wrong field disagrees with the independent verdict on every
 *    refused claim.
 * 3. **The mutation.** Real documents, one field flipped in memory. The same
 *    Ottawa document draws its fourth landmark when `/pois/3` says `verified`
 *    and does not when it says `rejected`. That is the test that fails if the
 *    filter stops filtering, and it can never be vacuous, because both sides of
 *    it are asserted in the same `it`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseLevelDocument, refuseSilentLevel } from '@adapters/phaser/level-document';
import {
  CLAIM_STATUSES,
  adjudicateClaim,
  censusIsRemarkable,
  createClaimLedger,
  describeCensus,
  readFactClaim,
  type FactClaimBlock,
} from '@adapters/phaser/verified-claim';
import { isVerified, type Question } from '@domain/entities/question';
import type { QuestionId, SubjectId } from '@domain/ids';

import gameConfigJson from '@content/game.config.json';

const MODES: readonly string[] = (gameConfigJson as { locomotionModes: readonly string[] })
  .locomotionModes;

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;

const levelFiles = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

/** A level document, freshly read, so a mutation in one test cannot reach another. */
const readLevel = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${LEVELS_DIR}/${file}`, 'utf8')) as Record<string, unknown>;

const parse = (document: unknown): ReturnType<typeof parseLevelDocument> =>
  parseLevelDocument(document, MODES);

const parsedOrThrow = (document: unknown): Extract<ReturnType<typeof parse>, { ok: true }>['value'] => {
  const result = parse(document);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

/* ---------------------------------------------------------------- the seam --- */

const HASH = 'a'.repeat(64);

const claimOf = (
  status: (typeof CLAIM_STATUSES)[number],
  verifiedHash: string,
  evidence: string,
): FactClaimBlock => ({
  factual: true,
  source: { sourceHash: HASH },
  verification: { status, sourceHash: verifiedHash, evidence },
});

/**
 * The same claim as a question, so the domain's rule can be asked about it.
 *
 * Everything except `source` and `verification` is filler that `isVerified` does
 * not read — which is precisely why the rule could not simply be imported: a
 * landmark blurb has no prompt, no options and no correct index, and inventing
 * them at the call site in `level-document.ts` would be a lie told to a type.
 */
const asQuestion = (claim: Extract<FactClaimBlock, { factual: true }>): Question => ({
  id: 'a-question' as QuestionId,
  subject: 'government' as SubjectId,
  prompt: { en: 'A prompt.', fr: 'Une question.' },
  options: [
    { en: 'A', fr: 'A' },
    { en: 'B', fr: 'B' },
    { en: 'C', fr: 'C' },
    { en: 'D', fr: 'D' },
  ],
  correctIndex: 0,
  explanation: { en: 'Because.', fr: 'Parce que.' },
  source: claim.source,
  verification: claim.verification,
});

describe('the rule is the domain’s rule, written twice and watched', () => {
  const matrix = CLAIM_STATUSES.flatMap((status) =>
    [HASH, 'b'.repeat(64)].flatMap((verifiedHash) =>
      ['A passage that entails the claim.', '', '   '].map((evidence) => ({
        status,
        verifiedHash,
        evidence,
      })),
    ),
  );

  it('agrees with isVerified on every combination of status, hash and evidence', () => {
    expect(matrix.length).toBe(CLAIM_STATUSES.length * 2 * 3);
    for (const { status, verifiedHash, evidence } of matrix) {
      const claim = claimOf(status, verifiedHash, evidence);
      const mine = adjudicateClaim(claim).drawable;
      const theirs = isVerified(asQuestion(claim as Extract<FactClaimBlock, { factual: true }>));
      expect(
        mine,
        `status=${status} hash=${verifiedHash === HASH ? 'match' : 'stale'} ` +
          `evidence=${evidence === '' ? 'empty' : JSON.stringify(evidence)}: ` +
          'app/adapters/phaser/verified-claim.ts and @domain/entities/question.ts disagree. ' +
          'They are two spellings of ADR-0003 and this is the only thing watching the seam.',
      ).toBe(theirs);
    }
  });

  it('separates the three reasons, because two of them look like a green document', () => {
    expect(adjudicateClaim(claimOf('rejected', HASH, 'quoted'))).toMatchObject({
      drawable: false,
      status: 'rejected',
      why: 'not-verified',
    });
    expect(adjudicateClaim(claimOf('verified', 'b'.repeat(64), 'quoted'))).toMatchObject({
      drawable: false,
      why: 'stale',
    });
    expect(adjudicateClaim(claimOf('verified', HASH, '  '))).toMatchObject({
      drawable: false,
      why: 'unevidenced',
    });
    expect(adjudicateClaim(claimOf('verified', HASH, 'quoted'))).toEqual({ drawable: true });
  });

  it('exempts text the author declared states no fact, and counts it as examined', () => {
    /* A caption is not a claim. `factual: false` is the author's recorded
       judgement and `verify-content` honours it, so the runtime does too — but
       the census still counts it, because a document whose every claim is
       flavour is a decision somebody made and not a quiet pass. */
    const ledger = createClaimLedger();
    expect(ledger.admit('/pois/0', { factual: false })).toBeNull();
    expect(ledger.census).toMatchObject({ examined: 1, factual: 0, drawable: 1 });
  });
});

/* -------------------------------------------------------------- the corpus --- */

type RawClaim = {
  readonly factual?: unknown;
  readonly source?: { readonly sourceHash?: unknown };
  readonly verification?: {
    readonly status?: unknown;
    readonly sourceHash?: unknown;
    readonly evidence?: unknown;
  };
};

/**
 * ADR-0003 spelled out again, over the raw JSON, on purpose.
 *
 * A third implementation is normally the defect. Here it is the instrument: if
 * the parser's filter read the wrong field, or stopped matching the block, it
 * would agree with this only by drawing everything — and this disagrees with
 * that on every claim the verifier declined. Deliberately written from the
 * document's own field names rather than from the parser's types.
 */
function drawableByHand(claim: RawClaim | undefined): boolean {
  if (claim === undefined) throw new Error('a claim block is missing from a shipped level');
  if (claim.factual !== true) return true;
  const source = claim.source ?? {};
  const verification = claim.verification ?? {};
  return (
    verification.status === 'verified' &&
    verification.sourceHash === source.sourceHash &&
    typeof verification.evidence === 'string' &&
    verification.evidence.trim().length > 0
  );
}

interface RawLevel {
  readonly territory?: { readonly fact?: RawClaim };
  readonly pois?: readonly { readonly id: string; readonly fact?: RawClaim }[];
}

describe('every shipped level, against a verdict computed a different way', () => {
  it('there is at least one level, so this suite is not reading an empty directory', () => {
    expect(levelFiles.length).toBeGreaterThan(0);
  });

  it.each(levelFiles)('%s: every landmark draws its blurb if and only if it was verified', (file) => {
    const raw = readLevel(file) as RawLevel;
    const level = parsedOrThrow(raw);
    const placed = raw.pois ?? [];

    expect(
      level.pois.length,
      'the parser dropped or invented a landmark; `pois` is every placement the level authored',
    ).toBe(placed.length);

    for (const [index, poi] of placed.entries()) {
      const expected = drawableByHand(poi.fact);
      const parsedPoi = level.pois[index];
      expect(parsedPoi?.id).toBe(poi.id);
      expect(
        parsedPoi?.blurb !== null,
        `${file} /pois/${String(index)} ("${poi.id}"): the parser ` +
          `${parsedPoi?.blurb === null ? 'withheld' : 'drew'} a blurb the document says is ` +
          `${expected ? 'verified' : 'not verified'}.`,
      ).toBe(expected);
      expect(
        level.teachingPois.some((candidate) => candidate.id === poi.id),
        `${file} /pois/${String(index)}: engageable and teachable must be the same set — a ` +
          'landmark the player can tap that has nothing to say is a card that teaches nothing, ' +
          'and a landmark that teaches but cannot be tapped is a fact nobody can reach.',
      ).toBe(expected);
    }
  });

  it.each(levelFiles)('%s: the panel draws the statement only if it was verified', (file) => {
    const raw = readLevel(file) as RawLevel;
    const level = parsedOrThrow(raw);
    const expected = drawableByHand(raw.territory?.fact);

    expect(
      level.about.kind === 'statement',
      `${file}: the "About this place" panel would ` +
        `${level.about.kind === 'statement' ? 'draw' : 'withhold'} a territorial statement the ` +
        `document says is ${expected ? 'verified' : 'not verified'}.`,
    ).toBe(expected);

    if (level.about.kind === 'unavailable') {
      /* The nations are the same attribution as the sentence, in list form. A
         panel that dropped "Halifax is in Mi'kma'ki" and kept ["Mi'kmaq"] would
         still be making the claim a verifier declined, in a form the reader
         cannot even disagree with. */
      expect(JSON.stringify(level.about)).not.toContain('nations');
      expect(level.about.message).toContain('/territory');
    }
  });

  it.each(levelFiles)('%s: the census counts what it looked at, not only what it refused', (file) => {
    const raw = readLevel(file) as RawLevel;
    const level = parsedOrThrow(raw);
    const claims = [raw.territory?.fact, ...(raw.pois ?? []).map((poi) => poi.fact)];

    expect(
      level.claims.examined,
      'a claim in the document was never looked at, which is how a filter goes quiet',
    ).toBe(claims.length);
    expect(level.claims.drawable + level.claims.refused.length).toBe(level.claims.examined);
    expect(level.claims.drawable).toBe(claims.filter(drawableByHand).length);
    expect(level.claims.factual).toBe(claims.filter((claim) => claim?.factual === true).length);
  });

  it('names every claim the build must not draw, and the shipped tree has some', () => {
    const refused = levelFiles.flatMap((file) =>
      parsedOrThrow(readLevel(file)).claims.refused.map((claim) => `${file}${claim.pointer}`),
    );
    const byHand = levelFiles.flatMap((file) => {
      const raw = readLevel(file) as RawLevel;
      return [
        ...(drawableByHand(raw.territory?.fact) ? [] : [`${file}/territory`]),
        ...(raw.pois ?? [])
          .map((poi, index) => (drawableByHand(poi.fact) ? null : `${file}/pois/${String(index)}`))
          .filter((pointer): pointer is string => pointer !== null),
      ];
    });

    expect(refused.sort()).toEqual(byHand.sort());
  });
});

/* ------------------------------------------------------------ the mutation --- */

/** A deep copy, so a flipped field cannot leak into another test. */
const clone = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

const poiAt = (document: Record<string, unknown>, index: number): Record<string, unknown> => {
  const pois = document['pois'] as Record<string, unknown>[];
  const poi = pois[index];
  if (poi === undefined) throw new Error(`the fixture level has no /pois/${String(index)}`);
  return poi;
};

const factOf = (holder: Record<string, unknown>): Record<string, unknown> =>
  holder['fact'] as Record<string, unknown>;

/**
 * Write the verdict a verifier writes when it grants a claim: the status, the
 * hash it was granted for, and the passage it was granted on.
 *
 * All three, not just `status`. ADR-0003 has three conditions and a mutation
 * that flipped only the first would be asking a narrower question than the rule
 * answers — and would start failing the day an author reset a claim to
 * `unverified` with an empty hash, which is a thing that happens while this is
 * being written.
 */
const grant = (holder: Record<string, unknown>): Record<string, unknown> => {
  const fact = factOf(holder);
  const source = fact['source'] as { readonly sourceHash: string; readonly quote?: string };
  fact['verification'] = {
    status: 'verified',
    model: 'a-verifier',
    checkedAt: '2026-09-13T00:00:00Z',
    sourceHash: source.sourceHash,
    evidence: source.quote ?? 'A passage that entails the claim.',
  };
  return holder;
};

/** Write the verdict a verifier writes when it declines one. */
const decline = (
  holder: Record<string, unknown>,
  status: 'rejected' | 'quarantined' | 'unverified' = 'rejected',
): Record<string, unknown> => {
  grant(holder);
  (factOf(holder)['verification'] as Record<string, unknown>)['status'] = status;
  return holder;
};

/**
 * A copy of a shipped level with **every** claim granted.
 *
 * The baseline a mutation is measured against. Taking a level as it stands would
 * tie these scenarios to whatever a verifier has said about it this week — and
 * an author is fixing two of those four claims while this is being written, so
 * "the shipped Ottawa has a rejected landmark" is a fact with a short life. The
 * question these tests ask has none.
 */
const grantAll = (document: Record<string, unknown>): Record<string, unknown> => {
  const copy = clone(document);
  grant(copy['territory'] as Record<string, unknown>);
  for (const poi of copy['pois'] as Record<string, unknown>[]) grant(poi);
  return copy;
};

/** One landmark of an otherwise fully granted level, declined. */
const declineAt = (
  document: Record<string, unknown>,
  index: number,
  status: 'rejected' | 'quarantined' | 'unverified',
): Record<string, unknown> => {
  const copy = grantAll(document);
  decline(poiAt(copy, index), status);
  return copy;
};

/**
 * The same document, twice, with one verdict written both ways.
 *
 * Built from a shipped level rather than from a fixture, so the geometry, the
 * locomotion, the assets and the ten other things a level has to get right are
 * the real ones — and **built in both directions inside one test**, so neither
 * half can pass because no input reached it. This is the test that fails if the
 * filter stops filtering, and the one that fails if the filter refuses
 * everything; those are different defects and one assertion cannot catch both.
 *
 * It is deliberately independent of what the verifier has said about Ottawa
 * *today*. The corpus suite above is what tracks the shipped verdicts; when an
 * author fixes a blurb and a verifier grants it, that suite follows the content
 * and this one keeps asking the question.
 */
describe('the same document, one verdict written both ways', () => {
  const OTTAWA = 'ottawa.json';
  const LANDMARK = 3;

  it('withholds a landmark whose claim was declined and draws it when it is granted', () => {
    const declined = parsedOrThrow(declineAt(clone(readLevel(OTTAWA)), LANDMARK, 'rejected'));
    const granted = parsedOrThrow(grantAll(readLevel(OTTAWA)));

    const withheld = declined.pois[LANDMARK];
    const drawn = granted.pois[LANDMARK];
    expect(withheld?.id, 'the two parses are of different landmarks').toBe(drawn?.id);

    /* Declined: art, a name, no teaching, not engageable. */
    expect(
      withheld?.blurb,
      'a landmark whose claim a verifier declined still teaches its blurb, which is the ' +
        'whole defect: ADR-0003 is enforced in CI and not at run time.',
    ).toBeNull();
    expect(withheld?.name.en.length, 'the landmark lost its name as well').toBeGreaterThan(0);
    expect(withheld?.artKey, 'the landmark lost its art').toBe(drawn?.artKey);
    expect(declined.pois, 'the landmark was removed from the picture').toHaveLength(
      granted.pois.length,
    );
    expect(declined.teachingPois.map((poi) => poi.id)).not.toContain(withheld?.id);
    /* Still placed, and out of reach unless the level gives it a quest role:
       this landmark carries no `questId`, so it is scenery. A refused landmark
       that does carry one stays reachable for its quest —
       `tests/unit/bootstrap/a-refused-landmark-keeps-its-quest.test.ts`. */
    expect(declined.pois.map((poi) => poi.id)).toContain(withheld?.id);
    if (withheld?.questId === undefined) {
      expect(declined.reachablePois.map((poi) => poi.id)).not.toContain(withheld?.id);
    }
    expect(declined.claims.refused.map((claim) => claim.pointer)).toContain(
      `/pois/${String(LANDMARK)}`,
    );

    /* Granted: the same landmark teaches, from the same document. */
    expect(
      drawn?.blurb,
      'the claim was granted and the blurb still did not draw: the filter is reading something ' +
        'other than the verification block, or it is not reading anything at all.',
    ).not.toBeNull();
    expect(granted.teachingPois.map((poi) => poi.id)).toContain(drawn?.id);
    expect(granted.claims.refused.map((claim) => claim.pointer)).not.toContain(
      `/pois/${String(LANDMARK)}`,
    );
    expect(granted.claims.examined).toBe(declined.claims.examined);
  });

  it.each(['rejected', 'quarantined', 'unverified'] as const)(
    'withholds a landmark a verifier called "%s"',
    (status) => {
      const level = parsedOrThrow(declineAt(clone(readLevel(OTTAWA)), LANDMARK, status));
      expect(level.pois[LANDMARK]?.blurb).toBeNull();
      expect(level.claims.refused).toContainEqual(
        expect.objectContaining({ pointer: `/pois/${String(LANDMARK)}`, status, why: 'not-verified' }),
      );
    },
  );

  it('refuses a verdict granted for a source that has since moved', () => {
    const stale = grantAll(readLevel(OTTAWA));
    grant(poiAt(stale, 0));
    (factOf(poiAt(stale, 0))['verification'] as Record<string, unknown>)['sourceHash'] =
      'f'.repeat(64);

    const level = parsedOrThrow(stale);
    expect(level.pois[0]?.blurb).toBeNull();
    expect(level.claims.refused[0]).toMatchObject({ pointer: '/pois/0', why: 'stale' });
  });

  it('refuses a verdict with no evidence quoted, which is an assertion', () => {
    const unevidenced = grantAll(readLevel(OTTAWA));
    grant(poiAt(unevidenced, 0));
    (factOf(poiAt(unevidenced, 0))['verification'] as Record<string, unknown>)['evidence'] = '   ';

    const level = parsedOrThrow(unevidenced);
    expect(level.pois[0]?.blurb).toBeNull();
    expect(level.claims.refused[0]).toMatchObject({ pointer: '/pois/0', why: 'unevidenced' });
  });

  it('draws a territorial statement only when the verifier granted it', () => {
    const refusedDocument = clone(readLevel('halifax.json'));
    decline(refusedDocument['territory'] as Record<string, unknown>);
    const declined = parsedOrThrow(refusedDocument);
    expect(declined.about.kind).toBe('unavailable');
    if (declined.about.kind === 'unavailable') {
      expect(declined.about.status).toBe('rejected');
      expect(declined.about.message).toContain('/territory');
    }

    const document = clone(readLevel('halifax.json'));
    grant(document['territory'] as Record<string, unknown>);
    const granted = parsedOrThrow(document);

    expect(granted.about.kind).toBe('statement');
    if (granted.about.kind === 'statement') {
      /* The sentence, both languages, and where it came from — §10.2 requires
         the panel to name its source, and a panel that cannot cite it may not
         draw it. */
      expect(granted.about.statement.en).toContain('Halifax');
      expect(granted.about.statement.fr.length).toBeGreaterThan(0);
      /* Both halves, because the panel draws the one matching the language in
         force and a publisher carried only in English put an English department
         name under a French sentence. The exact strings are pinned to the cited
         register, per language, by
         tests/unit/contracts/a-territory-names-what-its-source-prints.test.ts;
         what matters here is that the adapter carries both through. */
      expect(granted.about.publisher.en.length).toBeGreaterThan(0);
      expect(granted.about.publisher.fr.length).toBeGreaterThan(0);
      expect(granted.about.sourceUrl).toMatch(/^https?:\/\//);
      /* Halifax names nobody, and that is the point of ADR-0051: *Discover
         Canada* names no people for this place, and a statement names only what
         its source names. The panel still draws, still cites, and says what the
         guide does say about the city. */
      expect(granted.about.nations).toEqual([]);
    }
  });

  it('withholds the nations along with the sentence, because the list is the same claim', () => {
    /* Halifax's rejection is a *territorial attribution*: the first sentence
       places Halifax in Mi'kma'ki and the cited source does not say so. A panel
       that dropped the sentence and kept ["Mi'kmaq"] would still be making that
       attribution, in a form a reader cannot even disagree with — and naming the
       publisher does it indirectly, since "Assembly of Nova Scotia Mi'kmaw
       Chiefs" attributes the territory as plainly as the sentence. */
    const document = clone(readLevel('halifax.json'));
    decline(document['territory'] as Record<string, unknown>);
    const level = parsedOrThrow(document);

    const drawn = JSON.stringify(level.about);
    expect(drawn).not.toContain("Mi'kmaq");
    expect(drawn).not.toContain("Mi'kma'ki");
    expect(drawn).not.toContain('Chiefs');
  });
});

/* ------------------------------------------- the filter that reads nothing --- */

describe('a filter that cannot find its field refuses the level (ADR-0024)', () => {
  const OTTAWA = 'ottawa.json';

  it('refuses a claim whose verification block has been renamed', () => {
    const renamed = clone(readLevel(OTTAWA));
    const fact = poiAt(renamed, 0)['fact'] as Record<string, unknown>;
    fact['verifiction'] = fact['verification'];
    delete fact['verification'];

    const result = parse(renamed);
    expect(
      result.ok,
      'a misspelt verification block parsed cleanly, which means a rename would present as ' +
        '"nothing needed removing" — the exact failure ADR-0024 names.',
    ).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid');
      expect(result.error.message).toContain('verification');
    }
  });

  it.each([
    ['a status the schema does not define', { status: 'probably' }],
    ['a hash that is not a string', { sourceHash: 42 }],
    ['evidence that is not a string', { evidence: null }],
  ])('refuses %s rather than reading past it', (_label, patch) => {
    const spoiled = clone(readLevel(OTTAWA));
    Object.assign(factOf(poiAt(spoiled, 0))['verification'] as Record<string, unknown>, patch);
    expect(parse(spoiled).ok).toBe(false);
  });

  it('refuses a claim with no source to compare the verdict against', () => {
    const spoiled = clone(readLevel(OTTAWA));
    const fact = poiAt(spoiled, 0)['fact'] as Record<string, unknown>;
    fact['source'] = null;
    expect(parse(spoiled).ok).toBe(false);
  });

  it('refuses a level with no territory block rather than opening an empty panel', () => {
    const spoiled = clone(readLevel(OTTAWA));
    delete spoiled['territory'];
    const result = parse(spoiled);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('§10.2');
  });

  it('reads the block directly, so the refusal is not only reachable through a level', () => {
    expect(readFactClaim(undefined, 'pois[0].fact').ok).toBe(false);
    expect(readFactClaim({ factual: 'yes' }, 'pois[0].fact').ok).toBe(false);
    expect(readFactClaim({ factual: false }, 'pois[0].fact')).toMatchObject({
      ok: true,
      value: { factual: false },
    });
  });
});

/* ------------------------------------- a level that teaches nothing at all --- */

describe('a level whose every claim is filtered out is not a level (ADR-0024)', () => {
  const OTTAWA = 'ottawa.json';

  it('refuses it, and says how many were placed and how many may speak', () => {
    const silenced = clone(readLevel(OTTAWA));
    for (const poi of silenced['pois'] as Record<string, unknown>[]) {
      (poi['fact'] as { verification: Record<string, unknown> }).verification['status'] =
        'quarantined';
    }

    const result = parse(silenced);
    expect(
      result.ok,
      'every landmark on the level was refused and the level still opened, which presents to a ' +
        'player as a level with nothing in it and to a gate as a pass.',
    ).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('content.level.noVerifiedClaim');
      /* `admitSubjectBank` puts `offered` and `admitted` in its message for the
         same reason: "no landmarks" and "no landmark that may speak" need
         different fixes and look identical from outside. */
      expect(result.error.details).toMatchObject({ placed: 4, teaching: 0 });
    }
  });

  it('does not refuse a level that simply places no landmarks', () => {
    const bare = clone(readLevel(OTTAWA));
    bare['pois'] = [];
    const level = parsedOrThrow(bare);
    expect(refuseSilentLevel(level)).toBeNull();
    /* The territorial claim is still examined, so "no landmarks" does not read
       as "no claims". */
    expect(level.claims.examined).toBe(1);
  });

  it('does not refuse a level for a territorial statement alone', () => {
    /* §10.2 fixes the panel as always reachable. Refusing the level would take
       the panel away with everything else, and the panel is the surface that can
       say the statement could not be verified. */
    const document = clone(readLevel('halifax.json'));
    decline(document['territory'] as Record<string, unknown>);
    const level = parsedOrThrow(document);
    expect(level.about.kind).toBe('unavailable');
    expect(refuseSilentLevel(level)).toBeNull();
    expect(level.teachingPois.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------ the reporting --- */

describe('what a developer is told, on every load', () => {
  it('says how many claims were examined even when none was refused', () => {
    const clean = parsedOrThrow(grantAll(readLevel('toronto.json')));
    expect(clean.claims.refused).toHaveLength(0);
    const line = describeCensus('toronto', clean.claims);
    expect(line).toContain(`${String(clean.claims.examined)} claim(s) examined`);
    expect(line).toContain('0 not drawn');
    expect(line).not.toContain('  - ');
  });

  it('names each refused claim and why, so the console is actionable', () => {
    const document = clone(readLevel('ottawa.json'));
    decline(poiAt(document, 3), 'rejected');
    const line = describeCensus('ottawa', parsedOrThrow(document).claims);
    expect(line).toContain('/pois/3');
    expect(line).toContain('rejected');
    expect(line).toContain('ADR-0003');
  });

  it('puts a line on the console for a refusal and for a filter that examined nothing', () => {
    const withARefusal = clone(readLevel('ottawa.json'));
    decline(poiAt(withARefusal, 3));
    /* Every level carries at least a territorial claim — the schema requires
       `territory` and the parser refuses a level without one — so `examined: 0`
       cannot be "a level with no claims". It is the filter having stopped
       matching, and it is the state this whole module exists to make audible. */
    expect(censusIsRemarkable(createClaimLedger().census)).toBe(true);
    expect(censusIsRemarkable(parsedOrThrow(withARefusal).claims)).toBe(true);
    expect(censusIsRemarkable(parsedOrThrow(grantAll(readLevel('toronto.json'))).claims)).toBe(
      false,
    );
  });

  it('reads differently for a filter that examined nothing and one that refused nothing', () => {
    const examinedNothing = describeCensus('nowhere', createClaimLedger().census);
    const refusedNothing = describeCensus(
      'toronto',
      parsedOrThrow(grantAll(readLevel('toronto.json'))).claims,
    );
    expect(examinedNothing).toContain('0 claim(s) examined');
    expect(refusedNothing).not.toContain('0 claim(s) examined');
    expect(examinedNothing).not.toBe(refusedNothing);
  });
});
