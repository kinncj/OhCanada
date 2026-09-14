/**
 * A line reaches a player only if a verifier granted it — ADR-0003, on the
 * dialogue path.
 *
 * ## The defect
 *
 * `content/questions/` is filtered twice: `make verify-content` in CI, and
 * `isVerified` + `Shippable<T>` at run time, so a rejected question is never
 * dealt. `app/adapters/phaser/verified-claim.ts` did the same for a **level's**
 * claims a week ago, so a landmark whose blurb a verifier declined keeps its art
 * and loses its card.
 *
 * Nothing did it for a line of **dialogue**. `app/bootstrap/quests.ts` said so
 * in as many words — "whether a line's claim is verified is
 * `make validate-content`'s question, not this file's" — and `app/bootstrap/quest.ts`
 * mapped `line.text` into a dialog. On the day this file was written the tree
 * held five lines a verifier had declined and all five were spoken aloud by a
 * named character:
 *
 * | line | why it was declined |
 * |---|---|
 * | `toronto-cn-tower /steps/2/dialogue/1` | "the people living in it" elect the MP; the source says "the citizens" |
 * | `ottawa-parliament-hill /steps/5/dialogue/1` | "four kinds of government", already rejected in `gov-02-four-levels` off the same quote |
 * | `alberta-foothills-ranch-barn /steps/5/dialogue/1` | largest trading partners; true on p.92, false in the world since 2023 |
 * | `halifax-clock-and-pier /steps/3/dialogue/1` | "written law", a word the passage lacks |
 * | `peggys-cove-point-light /steps/4/dialogue/1` | « doit adopter » hardens "is expected to take up" into an obligation |
 *
 * Meanwhile `verify-content` printed "13 excluded from the build", which was
 * true of eight claims and false of these five.
 *
 * ## How this suite avoids being the next thing that passes over nothing
 *
 * Four kinds of test, because each fails for a different reason.
 *
 * 1. **The seam.** `adjudicateQuest` must decide a line exactly as
 *    `adjudicateClaim` decides a blurb, because it is the same block and the
 *    same three conditions. The matrix below drives both over the same inputs
 *    and fails if they ever disagree.
 * 2. **The mutation.** One document, one field flipped in memory, both sides
 *    asserted in the same `it`. The same block is spoken when its line says
 *    `verified` and silent when it says `rejected`. **This is the test that
 *    fails if the filter stops filtering**, and it can never be vacuous: it
 *    builds its own rejected line rather than borrowing one of the five, which
 *    an author is rewriting as this is written.
 * 3. **The unaffected.** A block of `factual: false` lines — a greeting, a stage
 *    direction — must behave exactly as it does today. Most lines in the game
 *    are these, and a filter that swept them up would be a worse defect than the
 *    one it fixed.
 * 4. **The census.** ADR-0024: "nothing to refuse" and "refused everything" must
 *    be different observations. Both are constructed here, and so is the third
 *    one that matters — a filter that has stopped matching the blocks it reads,
 *    which publishes `examined: 0` over a build that has quests in it.
 */

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestController } from '../../../app/bootstrap/quest';
import { readQuest, readQuests } from '../../../app/bootstrap/quests';
import {
  adjudicateQuest,
  createDialogueLedger,
  describeDialogueCensus,
  dialogueCensusIsRemarkable,
  EMPTY_DIALOGUE_CENSUS,
  QUEST_MOMENTS,
  spokenStep,
  type DialogueCensus,
  type SpokenQuest,
} from '../../../app/bootstrap/verified-dialogue';
import {
  adjudicateClaim,
  CLAIM_STATUSES,
  readFactClaim,
} from '@adapters/phaser/verified-claim';
import { withQuestState, type Progress } from '@domain/entities/progress';
import { createSettingsStore } from '@ui/settings';
import type { LevelPlacements } from '../../../app/bootstrap/engageables';
import { buildPage, type FakePage } from '../ui/support/fake-dom';
import {
  declinedFact,
  emptyProgress,
  flavourFact,
  grantedFact,
  ORIGIN,
  testClock,
  text as localised,
} from '../support/fixtures';

/* ------------------------------------------------------------- the documents */

const GATE = 'The ranch gate';
const GUIDE = 'guide';

const PLACEMENTS: LevelPlacements = {
  characters: [{ characterId: GUIDE }],
  pois: [
    {
      id: 'ranch-gate',
      name: localised(GATE, 'La barrière du ranch'),
      blurb: localised('A true, short thing.', 'Une chose vraie et courte.'),
    },
  ],
};

/** The run-up, and the payoff. The shape all five live rejections are in. */
const RUN_UP = 'One last thing, and it is the one you will be asked about.';
const PAYOFF = 'Alberta has the most beef cattle in Canada.';
const GREETING = 'Good afternoon.';

const line = (en: string, fact: Record<string, unknown>): Record<string, unknown> => ({
  speaker: GUIDE,
  text: { en, fr: `${en} (fr)` },
  fact,
});

/**
 * A quest whose second step is a `visit` carrying a two-line block.
 *
 * `teaching` is the `fact` block on the **payoff**. Everything else is held
 * constant, so the only thing that differs between the mutation's two halves is
 * one word inside one verification block.
 */
const ranchQuest = (teaching: Record<string, unknown>): Record<string, unknown> => ({
  id: 'alberta-foothills-ranch-gate',
  levelId: 'alberta-foothills',
  giver: GUIDE,
  title: { en: 'Ride out to the ranch', fr: 'Allez jusqu’au ranch' },
  summary: { en: 'You rode out.', fr: 'Vous y êtes allé.' },
  steps: [
    {
      id: 'meet-the-guide',
      kind: 'talk',
      targetId: GUIDE,
      prompt: { en: 'Talk to the guide', fr: 'Parlez au guide' },
      dialogue: [line('Come and see the ranch.', flavourFact())],
    },
    {
      id: 'ride-to-the-gate',
      kind: 'visit',
      targetId: 'ranch-gate',
      prompt: { en: 'Ride to the gate', fr: 'Allez à la barrière' },
      dialogue: [line(RUN_UP, flavourFact()), line(PAYOFF, teaching)],
    },
  ],
});

/** Read and adjudicate, as `readQuests` does, keeping the ledger for the census. */
function adjudicate(raw: Record<string, unknown>): {
  readonly quest: SpokenQuest;
  readonly census: DialogueCensus;
} {
  const read = readQuest(raw, 'fixture');
  if (!read.ok) throw new Error(`fixture did not load: ${read.error.message}`);
  const ledger = createDialogueLedger();
  const spoken = adjudicateQuest(read.value, ledger, String(read.value.id));
  if (!spoken.ok) throw new Error(`fixture was not adjudicable: ${spoken.error.message}`);
  return { quest: spoken.value, census: ledger.census };
}

/* ------------------------------------------------------------------ the seam */

interface Harness {
  readonly page: FakePage;
  readonly controller: QuestController;
}

/**
 * The player standing on step `stepIndex` of an accepted quest — or, with
 * `stepIndex` of `'on-offer'`, a player who has never met the giver.
 *
 * The distinction matters for `canEngage`: a quest that is being played answers
 * true because the giver reads the current step back, and only a quest **on
 * offer** is refused for having no opening block.
 */
function harnessFor(quest: SpokenQuest, stepIndex: number | 'on-offer'): Harness {
  const page = buildPage();
  let progress: Progress =
    stepIndex === 'on-offer'
      ? emptyProgress()
      : withQuestState(emptyProgress(), quest.levelId, {
          questId: quest.id,
          status: 'active',
          stepIndex,
          stepProgress: 0,
          updatedAt: ORIGIN,
        });

  const controller = createQuestController({
    levelId: quest.levelId,
    quests: [quest],
    placements: () => PLACEMENTS,
    host: page.host,
    store: createSettingsStore(),
    clock: testClock(),
    announce: vi.fn(),
    progress: () => progress,
    commit: (next) => {
      progress = next;
    },
    setTask: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    restoreFocusTo: () => null,
  });

  return { page, controller };
}

interface Spoken {
  readonly outcome: string;
  readonly page: string;
  readonly owed: number;
  readonly advanced: boolean;
}

/** Arrive at the gate, ask the step for its lines, and read the page back. */
function arrive(quest: SpokenQuest): Spoken {
  const { page, controller } = harnessFor(quest, 1);
  const owed = vi.fn();
  const visit = controller.visited('ranch-gate');
  const outcome = visit.speak(owed);
  return {
    outcome,
    page: page.host.textContent ?? '',
    owed: owed.mock.calls.length,
    advanced: visit.advanced,
  };
}

const HASH = 'a'.repeat(64);

/* ------------------------------------------------------------ 1. the seam --- */

describe('a line is adjudicated by the same rule as a blurb', () => {
  /**
   * A `fact` block in every combination that matters: four statuses, a hash that
   * matches and one that does not, evidence and none.
   */
  const matrix = CLAIM_STATUSES.flatMap((status) =>
    [HASH, 'b'.repeat(64)].flatMap((verifiedHash) =>
      ['A quoted passage.', '', '   '].map((evidence) => ({
        status,
        verifiedHash,
        evidence,
      })),
    ),
  );

  it('agrees with adjudicateClaim on every combination of status, hash and evidence', () => {
    const disagreements: string[] = [];

    for (const entry of matrix) {
      const fact = {
        factual: true,
        source: { sourceHash: HASH },
        verification: {
          status: entry.status,
          sourceHash: entry.verifiedHash,
          evidence: entry.evidence,
        },
      };

      /* The rule, asked directly. */
      const block = readFactClaim(fact, 'fixture');
      expect(block.ok).toBe(true);
      const byTheRule = block.ok && adjudicateClaim(block.value).drawable;

      /* The same block, inside a quest, decided by the thing under test. */
      const { quest } = adjudicate(ranchQuest(fact));
      const step = quest.steps[1];
      const byTheQuest = step?.dialogue !== undefined;

      if (byTheRule !== byTheQuest) {
        disagreements.push(
          `${entry.status} / hash ${entry.verifiedHash === HASH ? 'same' : 'moved'} / evidence ` +
            `${entry.evidence.trim() === '' ? 'none' : 'present'}: the rule says ${String(
              byTheRule,
            )} and the quest says ${String(byTheQuest)}`,
        );
      }
    }

    expect(disagreements, disagreements.join('\n')).toEqual([]);
    /* The matrix is not empty and it is not all one answer, so "they agree" is
       a statement about both branches. */
    expect(matrix.length).toBe(24);
  });

  it('refuses the document when a fact block cannot be read, rather than treating it as unverified', () => {
    /*
     * A misspelt field must not present as an honest rejection (ADR-0024). Four
     * suites in this repository were carrying `{ claimsFact: false }` and every
     * one of them passed, because until now nothing read the block at all.
     */
    for (const broken of [
      { claimsFact: false },
      { factual: 'false' },
      { factual: true, source: null, verification: null },
      { factual: true, source: { sourceHash: HASH } },
      { factual: true, source: { sourceHash: HASH }, verification: { status: 'granted' } },
    ]) {
      const read = readQuest(ranchQuest(broken), 'fixture');
      expect(read.ok, JSON.stringify(broken)).toBe(true);
      if (!read.ok) continue;
      const result = adjudicateQuest(read.value, createDialogueLedger(), 'fixture');
      expect(result.ok, `${JSON.stringify(broken)} was waved through`).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('/steps/1/dialogue/1');
      }
    }
  });

  it('puts a refused document on the catalogue’s refused list and keeps the others', () => {
    const catalogue = readQuests({
      'a.json': ranchQuest(grantedFact()),
      'b.json': { ...ranchQuest({ claimsFact: false }), id: 'alberta-foothills-broken' },
    });

    expect(catalogue.quests.map((quest) => String(quest.id))).toEqual([
      'alberta-foothills-ranch-gate',
    ]);
    expect(catalogue.refused).toHaveLength(1);
    expect(catalogue.refused[0]).toContain('content.quest.claim');
  });
});

/* -------------------------------------------------------- 2. the mutation --- */

describe('the same block, one word apart', () => {
  it('is spoken when the verifier granted it and silent when the verifier declined it', () => {
    /*
     * Both halves in one `it`, which is what stops this being vacuous: a filter
     * that silenced everything would fail the first expectation and a filter
     * that silenced nothing would fail the second. One of them is always false
     * for a broken filter, whichever way it broke.
     */
    const granted = arrive(adjudicate(ranchQuest(grantedFact())).quest);
    expect(granted.outcome).toBe('spoken');
    expect(granted.page).toContain(RUN_UP);
    expect(granted.page).toContain(PAYOFF);

    const declined = arrive(adjudicate(ranchQuest(declinedFact())).quest);
    expect(declined.outcome).toBe('unverified');
    expect(declined.page).not.toContain(PAYOFF);
  });

  it('withholds the whole block, so the speaker is never left mid-thought', () => {
    /*
     * The run-up is a `factual: false` line that ADR-0003 has nothing to say
     * about, and it goes anyway. That is the presentation decision: the unit of
     * refusal is the utterance, because "One last thing, and it is the one you
     * will be asked about." followed by silence is a speaker stopped in the
     * middle of a sentence they started.
     */
    const declined = arrive(adjudicate(ranchQuest(declinedFact())).quest);
    expect(declined.page).not.toContain(RUN_UP);
    expect(declined.page).not.toContain(PAYOFF);
    expect(declined.page.trim()).toBe('');
  });

  it('is silent for every status that is not "verified", not only for "rejected"', () => {
    for (const status of ['unverified', 'quarantined', 'rejected'] as const) {
      const { outcome, page } = arrive(adjudicate(ranchQuest(declinedFact(status))).quest);
      expect(outcome, status).toBe('unverified');
      expect(page, status).not.toContain(PAYOFF);
    }
  });

  it('is silent when the grant was for a sourceHash the line no longer cites', () => {
    const stale = grantedFact();
    const verification = { ...(stale['verification'] as Record<string, unknown>) };
    verification['sourceHash'] = 'c'.repeat(64);
    const { outcome, page } = arrive(adjudicate(ranchQuest({ ...stale, verification })).quest);

    expect(outcome).toBe('unverified');
    expect(page).not.toContain(PAYOFF);
  });

  it('is silent when the grant cites no evidence, which is an assertion and not a check', () => {
    const unevidenced = grantedFact();
    const verification = { ...(unevidenced['verification'] as Record<string, unknown>) };
    verification['evidence'] = '   ';
    const { outcome } = arrive(adjudicate(ranchQuest({ ...unevidenced, verification })).quest);

    expect(outcome).toBe('unverified');
  });

  it('advances the step and pays the caller’s continuation exactly once either way', () => {
    /*
     * The level must stay finishable. A refused blurb does not remove the
     * landmark and a refused line does not remove the step: what is lost is the
     * teaching, and the question that follows is still owed.
     */
    const granted = arrive(adjudicate(ranchQuest(grantedFact())).quest);
    const declined = arrive(adjudicate(ranchQuest(declinedFact())).quest);

    expect(granted.advanced).toBe(true);
    expect(declined.advanced).toBe(true);
    /* `spoken` owes its continuation to the dialogue's close, so it is not paid
       yet; `unverified` has nothing to open and pays at once. Both pay exactly
       once, which is the invariant — never twice, never none. */
    expect(granted.owed).toBe(0);
    expect(declined.owed).toBe(1);
  });

  it('says why on the console, naming the pointer and the status', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      arrive(adjudicate(ranchQuest(declinedFact())).quest);
      const said = spy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(said).toContain('/steps/1/dialogue/1');
      expect(said).toContain('rejected');
      expect(said).toContain('ADR-0003');
    } finally {
      spy.mockRestore();
    }
  });
});

/* ------------------------------------------------------- 3. the unaffected --- */

describe('a line that claims nothing is untouched', () => {
  /** A block of pure flavour: a greeting and a stage direction, no claim at all. */
  const flavourOnly = (): Record<string, unknown> => {
    const quest = ranchQuest(flavourFact()) as { steps: Record<string, unknown>[] };
    quest.steps[1] = {
      ...quest.steps[1],
      dialogue: [line(GREETING, flavourFact()), line(RUN_UP, flavourFact())],
    };
    return quest as unknown as Record<string, unknown>;
  };

  it('is spoken, in full, exactly as it was before any of this existed', () => {
    const { outcome, page } = arrive(adjudicate(flavourOnly()).quest);

    expect(outcome).toBe('spoken');
    expect(page).toContain(GREETING);
    expect(page).toContain(RUN_UP);
  });

  it('is counted rather than ignored, so "all flavour" is visible and not a quiet pass', () => {
    const { census } = adjudicate(flavourOnly());

    /* Three lines in the document: one on the `talk` step, two on the visit. */
    expect(census.examined).toBe(3);
    expect(census.factual).toBe(0);
    expect(census.drawable).toBe(3);
    expect(census.refused).toEqual([]);
    expect(census.utterances).toBe(2);
    expect(census.spoken).toBe(2);
    expect(census.silenced).toEqual([]);
  });

  it('needs no source and no verifier, and is not refused for lacking one', () => {
    /* `factual: false` with `source: null, verification: null` is the shape
       every greeting in `content/quests/` is in, and it must read cleanly. */
    const read = readFactClaim(flavourFact(), 'fixture');
    expect(read.ok).toBe(true);
    expect(read.ok && read.value.factual).toBe(false);
    expect(read.ok && adjudicateClaim(read.value).drawable).toBe(true);
  });
});

/* ----------------------------------------------------------- 4. the census --- */

describe('the census tells "nothing to refuse" from "refused everything"', () => {
  it('publishes different numbers for a clean build and a wholly refused one', () => {
    const clean = adjudicate(ranchQuest(grantedFact())).census;
    const all = adjudicate(ranchQuest(declinedFact())).census;

    expect(clean.examined).toBe(3);
    expect(clean.refused).toHaveLength(0);
    expect(clean.utterances).toBe(2);
    expect(clean.spoken).toBe(2);
    expect(clean.silenced).toHaveLength(0);

    expect(all.examined).toBe(3);
    expect(all.refused).toHaveLength(1);
    expect(all.drawable).toBe(2);
    expect(all.utterances).toBe(2);
    expect(all.spoken).toBe(1);
    expect(all.silenced).toHaveLength(1);

    /* The whole point of ADR-0024 in one assertion: the two are not the same
       observation. */
    expect(describeDialogueCensus(clean)).not.toBe(describeDialogueCensus(all));
  });

  it('tells a build with no quests from a filter that has stopped matching', () => {
    const nothing = readQuests({}).census;
    expect(nothing).toEqual(EMPTY_DIALOGUE_CENSUS);
    expect(nothing.quests).toBe(0);
    expect(nothing.examined).toBe(0);
    /* Normal, and therefore silent. A build that ships no quest is not news. */
    expect(dialogueCensusIsRemarkable(nothing)).toBe(false);

    /* The same zeros, over ten quests, is a filter that has stopped matching
       the blocks it reads — and it is remarkable. */
    const broken = { ...EMPTY_DIALOGUE_CENSUS, quests: 10 };
    expect(dialogueCensusIsRemarkable(broken)).toBe(true);
    expect(describeDialogueCensus(broken)).toContain('10 quest(s)');
    expect(describeDialogueCensus(broken)).toContain('0 line(s) examined');
  });

  it('is remarkable the moment a block is silenced, and quiet when none is', () => {
    expect(dialogueCensusIsRemarkable(adjudicate(ranchQuest(grantedFact())).census)).toBe(false);
    expect(dialogueCensusIsRemarkable(adjudicate(ranchQuest(declinedFact())).census)).toBe(true);
  });

  it('names the block, its size and every refusal in it, for the console', () => {
    const census = adjudicate(ranchQuest(declinedFact())).census;
    const sentence = describeDialogueCensus(census);

    expect(sentence).toContain('alberta-foothills-ranch-gate#/steps/1/dialogue');
    expect(sentence).toContain('2 line(s)');
    expect(sentence).toContain('mid-thought');
    expect(census.silenced[0]?.refused[0]?.why).toBe('not-verified');
    expect(census.silenced[0]?.refused[0]?.status).toBe('rejected');
  });

  it('counts what the reader carries, and nothing it does not', () => {
    /*
     * `examined` equals the number of lines the parsed documents hold. A filter
     * that matched half the blocks would publish a smaller number while every
     * behavioural assertion above stayed green, which is precisely the failure
     * this field exists to make visible.
     */
    const catalogue = readQuests();
    /* A moment line is carried either spoken or with a receipt, never both. */
    const momentsCarried = catalogue.quests.reduce(
      (total, quest) =>
        total +
        QUEST_MOMENTS.filter(
          (moment) => quest[moment] !== undefined || quest.momentsSilenced?.[moment] !== undefined,
        ).length,
      0,
    );
    const carried = catalogue.quests.reduce(
      (total, quest) =>
        total +
        quest.steps.reduce(
          (inner, step) => inner + (step.dialogue?.length ?? step.silenced?.lines ?? 0),
          0,
        ),
      momentsCarried,
    );

    expect(catalogue.census.examined).toBe(carried);
    expect(catalogue.census.moments).toBe(momentsCarried);
    expect(catalogue.census.utterances).toBe(
      catalogue.census.spoken + catalogue.census.silenced.length,
    );
  });
});

/* ------------------------------------------------------------- the receipt --- */

describe('the receipt cannot be forged or mislaid', () => {
  it('recovers the branded step by identity, and refuses a step from another quest', () => {
    const mine = adjudicate(ranchQuest(grantedFact())).quest;
    const theirs = adjudicate(ranchQuest(grantedFact())).quest;

    expect(spokenStep(mine, mine.steps[1])).toBe(mine.steps[1]);
    expect(spokenStep(mine, undefined)).toBeUndefined();
    /* Structurally identical and a different object: the identity check is what
       stops a widened step being cast back into a branded one. */
    expect(spokenStep(mine, theirs.steps[1])).toBeUndefined();
  });

  it('leaves the offer unofferable, loudly, when the opening block is refused', () => {
    /*
     * The one place this mechanism costs a whole quest. No shipped quest is in
     * this state, which is exactly why it is synthesised: the alternative to
     * refusing the offer is speaking a declined claim, or opening a dialog with
     * no words, and `app/bootstrap/quests.ts` already settled the second.
     */
    const raw = ranchQuest(grantedFact()) as { steps: Record<string, unknown>[] };
    raw.steps[0] = {
      ...raw.steps[0],
      dialogue: [line('Come and see the ranch.', flavourFact()), line(PAYOFF, declinedFact())],
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const quest = adjudicate(raw as unknown as Record<string, unknown>).quest;
      const { page, controller } = harnessFor(quest, 'on-offer');

      expect(controller.isGiver(GUIDE), 'it is still the giver').toBe(true);
      expect(controller.canEngage(GUIDE), 'but there is nothing it can say').toBe(false);
      expect(controller.engage(GUIDE)).toBe(false);
      expect(page.host.textContent ?? '').toBe('');

      const said = spy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(said).toContain('cannot be offered');
      expect(said).toContain('/steps/0/dialogue/1');
    } finally {
      spy.mockRestore();
    }
  });

  it('still offers a quest whose opening block is granted', () => {
    /* The other half, so the check above cannot pass by refusing everything. */
    const quest = adjudicate(ranchQuest(grantedFact())).quest;
    const { page, controller } = harnessFor(quest, 'on-offer');

    expect(controller.isGiver(GUIDE)).toBe(true);
    expect(controller.canEngage(GUIDE)).toBe(true);
    expect(controller.engage(GUIDE)).toBe(true);
    expect(page.host.textContent ?? '').toContain('Come and see the ranch.');
  });
});
