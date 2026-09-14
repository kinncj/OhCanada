/**
 * ADR-0003 at run time, for the claims a character says out loud.
 *
 * ## The defect this exists for
 *
 * `app/adapters/phaser/verified-claim.ts` closed this on the **level** path: a
 * point of interest's `blurb` and a level's territorial `statement` carry a
 * `factClaim`, `parseLevelDocument` adjudicates it, and `ScenePoi.blurb` is
 * `LocalizedText | null` so an unverified blurb is not a value any drawer can
 * reach. The card does not open because there is nothing in the object to draw.
 *
 * **Nothing did that for a line of dialogue.** `./quests.ts` validates every
 * field the quest surface *draws* and says so in as many words — "whether a
 * line's claim is verified is `make validate-content`'s question, not this
 * file's" — and `./quest.ts` then maps `line.text` into a dialog. So a line a
 * verifier declined was spoken in a named character's voice, with the same
 * typography, the same accessible name and the same authority as a granted one.
 *
 * On the day this file was written the tree held five of them, and none was a
 * near miss:
 *
 * | line | why it was declined |
 * |---|---|
 * | `toronto-cn-tower /steps/2/dialogue/1` | "the people living in it" elect the MP; the source says "the citizens" |
 * | `ottawa-parliament-hill /steps/5/dialogue/1` | "four kinds of government", the count already rejected in `gov-02-four-levels` off the same quote |
 * | `alberta-foothills-ranch-barn /steps/5/dialogue/1` | largest trading partners — true on p.92, false in the world since 2023 |
 * | `halifax-clock-and-pier /steps/3/dialogue/1` | "written law", a word the passage lacks and the chapter contradicts |
 * | `peggys-cove-point-light /steps/4/dialogue/1` | « doit adopter » hardens "is expected to take up" into an obligation |
 *
 * Meanwhile `scripts/verify-content.mjs` printed `content/quests/ — 5 rejected,
 * 51 verified` and `547 shipped, 13 excluded from the build`. Those five were
 * counted as excluded and were drawn, which makes the summary line a guarantee
 * of something that was not happening — the same false receipt the blurb path
 * printed before `verified-claim.ts`.
 *
 * ## The unit of refusal is the utterance, not the line
 *
 * A blurb had an easy answer because the card **was** the claim: no claim, no
 * card. A dialogue line sits in a sequence, and dropping one silently changes
 * what the speaker says. All five live rejections are `dialogue[1]` of a
 * two-line block whose `dialogue[0]` is the run-up to it:
 *
 * > "Get out of the wind for a minute. One last thing, and it is the one you
 * > will be asked about."  ← granted, and now a promise of nothing
 * > "There is not one government here. There are four kinds…"  ← declined
 *
 * Dropping only the declined line leaves a speaker mid-thought, which is a
 * second defect introduced to fix the first. So the unit is the **utterance**:
 * one `dialogue` array, which is one thing a speaker says at one moment, one
 * `Dialogue.show`, one dialog with one accessible name. A block holding a
 * refused line is not spoken at all.
 *
 * Refusing the whole *quest* was the third candidate and is not taken. It is
 * out of proportion — a quest is four to nine steps and one stamp, and the
 * other blocks in it were granted — and it is not what the blurb path does
 * either: "a refused blurb does not remove the landmark… what it removes is the
 * teaching". A silenced `visit` step still advances, still owes the caller the
 * landmark's question, and still lets the level be finished.
 *
 * The one place this *does* cost a quest is the opening `talk` step, because
 * that block is the offer. A silenced offer leaves `openingDialogue` with
 * nothing, `canEngage` answers false and the quest is never offered. That is
 * accepted rather than worked around: the alternatives are opening a dialog
 * whose words include a declined claim, or opening one with no words at all,
 * and `./quests.ts` already settled the second — "a giver who opens a dialog and
 * says nothing is worse than a giver who is not offered".
 *
 * ## Why it is unrepresentable and not filtered
 *
 * {@link SpeakableLine} carries a `unique symbol` private to this file, exactly
 * as `Shippable<T>` is private to `app/domain/entities/question.ts`, and
 * {@link adjudicateQuest} is the only function in the program that attaches it.
 * `./quest.ts` takes {@link SpokenQuest}, so handing the controller the
 * `QuestDocument` that came out of `readQuest` is a **compile error** and not a
 * filter somebody forgot to call. The next surface to draw a line cannot forget,
 * because it will not have a line to draw until it has been given one.
 *
 * {@link SpokenQuest} stays structurally assignable to `QuestDocument`, so
 * `startQuest`, `progressQuest` and `currentStep` take one unchanged. That is
 * the reason the receipt is an extra property on the line rather than a
 * nullable `dialogue`: `dialogue: … | null` would not satisfy the port and every
 * domain call would need a cast, which is the hole re-opened at the seam.
 *
 * ## Where the rule comes from
 *
 * `adjudicateClaim` and `readFactClaim` are imported from
 * `@adapters/phaser/verified-claim` rather than restated. A dialogue line's
 * `fact` is the *same* block as a landmark blurb's `factClaim` — the same four
 * statuses, the same stale-hash rule, the same "verified with no evidence is an
 * assertion" rule — and a second copy of three conditions is how the copies come
 * to disagree. `app/adapters/phaser/index.ts` deliberately does not export the
 * rule, and this file is the one deep import of it; that is stated there, and
 * `tests/unit/contracts/one-rule-decides-what-may-be-drawn.test.ts` holds it, so
 * the enclosure is enforced rather than only described.
 *
 * ## What "loudly" means here (ADR-0024)
 *
 * A `visit` step with no `dialogue` is supposed to be silent. A step whose lines
 * were dropped because this file read the wrong field would look exactly the
 * same on screen, which is the failure ADR-0024 names. So:
 *
 *  - {@link adjudicateQuest} **refuses the document** when a line's `fact` block
 *    cannot be read — misspelt, mistyped, absent when `factual` is true. A block
 *    this file cannot adjudicate is never one it waves through, and the refusal
 *    names the pointer.
 *  - {@link DialogueCensus} counts what was **examined**, not only what was
 *    refused, at both levels: lines and utterances. "0 refused of 92 examined"
 *    and "0 refused of 0 examined" are different sentences and different probe
 *    attributes. `quests` is in the census for the same reason — a build with no
 *    `content/quests/` legitimately examines nothing, and that must be readable
 *    apart from a filter that has stopped matching the blocks it reads.
 *  - {@link SpokenStep.silenced} travels on the step, so `./quest.ts` answers
 *    `'unverified'` where it would otherwise answer `'no-dialogue'`. The two
 *    silences are one word apart in the outcome a test reads.
 *
 * Pure: no Phaser, no DOM, no fetch.
 */

import type { DialogueLine, QuestDocument, QuestStepDocument } from '@application/ports';
import { appErr, ok, type Result } from '@common/result';
import {
  createClaimLedger,
  readFactClaim,
  type ClaimLedger,
  type RefusedClaim,
} from '@adapters/phaser/verified-claim';

/**
 * The receipt. Private, so no other module can mint one.
 *
 * The same mechanism and the same reasoning as `Shippable<T>`'s symbol in
 * `app/domain/entities/question.ts`: a type a caller can satisfy by writing an
 * object literal is a convention, and a convention is what the dialogue path had
 * instead of a gate.
 */
declare const SPEAKABLE: unique symbol;

/**
 * A line ADR-0003 allows in front of a player.
 *
 * Either it claims nothing about Canada (`fact.factual: false` — a greeting, a
 * stage direction, "Get out of the wind for a minute"), or a verifier granted
 * its claim against the `sourceHash` it still cites, with evidence. Those are
 * the only two ways one of these comes to exist.
 */
export interface SpeakableLine extends DialogueLine {
  readonly [SPEAKABLE]: true;
}

/**
 * A step, with the lines it may say.
 *
 * `dialogue` absent means one of two different things, and the difference is
 * {@link silenced}:
 *
 *  - `dialogue` absent, `silenced` absent — the document carried no lines here.
 *    The author chose silence. This is the majority of `answer` steps.
 *  - `dialogue` absent, `silenced` present — the document carried lines and this
 *    file refused the block. The step is silent for a reason that has a pointer,
 *    a status and a sentence.
 *
 * Assignable to `QuestStepDocument` in both cases, which is what lets the domain
 * take one unchanged.
 */
export interface SpokenStep extends Omit<QuestStepDocument, 'dialogue'> {
  /** Every line here has been adjudicated. There is no other way to get one. */
  readonly dialogue?: readonly SpeakableLine[];
  /** Present only when a block was read and refused. Never drawn; developer-facing. */
  readonly silenced?: SilencedUtterance;
}

/**
 * The four lines a quest document carries outside its steps, by field name.
 *
 * `TN-DIALOGUE-what-a-quest-giver-says.md` rules what each is for: `declinedLine`
 * when the player chose "Not now", `reminderLine` when they come back while the
 * quest is accepted and unfinished, `afterLine` when they come back after it is
 * complete, and `doneLine` on the completion card, in the past tense.
 *
 * The field names are the keys, rather than a friendlier vocabulary, so a
 * pointer printed on the console (`halifax-clock-and-pier#/afterLine`) is the
 * JSON path an author opens.
 */
export type QuestMoment = 'declinedLine' | 'reminderLine' | 'afterLine' | 'doneLine';

/** Every moment, in the order a player can meet them. */
export const QUEST_MOMENTS: readonly QuestMoment[] = [
  'declinedLine',
  'reminderLine',
  'afterLine',
  'doneLine',
];

/**
 * A quest whose every line has been through {@link adjudicateQuest}.
 *
 * The four moment lines are re-declared as {@link SpeakableLine}, so a raw
 * `DialogueLine` off the document cannot be handed to anything that speaks. They
 * stay assignable to `QuestDocument`'s optional `DialogueLine` fields, which is
 * what lets `startQuest` and `progressQuest` take one of these unchanged.
 */
export interface SpokenQuest extends Omit<QuestDocument, 'steps' | QuestMoment> {
  readonly steps: readonly SpokenStep[];
  readonly declinedLine?: SpeakableLine;
  readonly reminderLine?: SpeakableLine;
  readonly afterLine?: SpeakableLine;
  readonly doneLine?: SpeakableLine;
  /**
   * The moments whose line was read and refused, and why.
   *
   * The moment's twin of {@link SpokenStep.silenced}. A moment field absent from
   * this quest **and** from this map is a document that wrote nothing for that
   * moment; absent from the quest and present here is a line a verifier did not
   * grant. Both are silent on screen, and ADR-0024 is why they are two states.
   */
  readonly momentsSilenced?: Readonly<Partial<Record<QuestMoment, SilencedUtterance>>>;
}

/**
 * What one moment has to say, read off an adjudicated quest.
 *
 * - `spoken` — the document wrote a line and ADR-0003 allows it.
 * - `unverified` — the document wrote a line and a verifier did not grant it.
 * - `no-line` — the document wrote nothing for this moment. Silence is legal for
 *   every moment (`TN-DIALOGUE-02`), so this is not a fault.
 */
export type MomentVerdict =
  | { readonly said: 'spoken'; readonly line: SpeakableLine }
  | { readonly said: 'unverified'; readonly silenced: SilencedUtterance }
  | { readonly said: 'no-line' };

/** The verdict for one moment. Reads the receipt; never re-derives it. */
export function momentVerdict(quest: SpokenQuest, moment: QuestMoment): MomentVerdict {
  const line = quest[moment];
  if (line !== undefined) return { said: 'spoken', line };
  const silenced = quest.momentsSilenced?.[moment];
  if (silenced !== undefined) return { said: 'unverified', silenced };
  return { said: 'no-line' };
}

/** One block of dialogue that will not be said, and why, line by line. */
export interface SilencedUtterance {
  /** `toronto-cn-tower#/steps/2/dialogue`. The block, as the document holds it. */
  readonly pointer: string;
  /** How many lines are being withheld, refused and granted together. */
  readonly lines: number;
  /** The lines that caused it. At least one; the rest of the block is collateral. */
  readonly refused: readonly RefusedClaim[];
  /** One paragraph for the console. Developer-facing English, never drawn. */
  readonly message: string;
}

/**
 * What the filter looked at on the dialogue path, and what it did.
 *
 * Two layers, because the refusal happens at one and the verdict at the other.
 * `examined` / `factual` / `drawable` / `refused` are lines and mean exactly what
 * `ClaimCensus`'s fields mean on a level. `utterances` / `spoken` / `silenced`
 * are blocks, and are the layer that says what a **player** experienced: one
 * refused line silences the whole block it is in, so `refused.length` and
 * `silenced.length` are different numbers and both are worth reading.
 *
 * `quests` is the floor. A build with an empty `content/quests/` examines
 * nothing and that is normal; a build with ten quests that examines nothing is a
 * filter that has stopped matching the blocks it reads (ADR-0024). Without this
 * field those two publish the same zeros.
 */
export interface DialogueCensus {
  /** Quest documents walked. */
  readonly quests: number;
  /** Lines read, factual or not. Equals `drawable + refused.length`. */
  readonly examined: number;
  /** Of those, the ones declaring a fact about Canada. */
  readonly factual: number;
  /** Lines ADR-0003 allows on screen. */
  readonly drawable: number;
  readonly refused: readonly RefusedClaim[];
  /** Dialogue blocks read. One block is one thing a speaker says at one moment. */
  readonly utterances: number;
  /** Blocks whose every line is drawable, and which are therefore said. */
  readonly spoken: number;
  /** Blocks said in full by nobody, because a line in them was refused. */
  readonly silenced: readonly SilencedUtterance[];
  /**
   * Of `examined`, the lines that are a quest's moment lines — `declinedLine`,
   * `reminderLine`, `afterLine`, `doneLine` — rather than a step's dialogue.
   *
   * Its own number because it is the half that used to be missing. The filter
   * once read steps only, so 40 authored and verified lines were neither spoken
   * nor counted, and `examined` published 92 against the 132 `verify-content`
   * counts. Each moment line is also one utterance: a moment is one thing a
   * speaker says at one moment, which is what an utterance is.
   */
  readonly moments: number;
}

/** The census of a build that ships no quest at all. */
export const EMPTY_DIALOGUE_CENSUS: DialogueCensus = {
  quests: 0,
  examined: 0,
  factual: 0,
  drawable: 0,
  refused: [],
  utterances: 0,
  spoken: 0,
  silenced: [],
  moments: 0,
};

/**
 * An accumulating census, across every quest in the build.
 *
 * A builder rather than a `reduce` for the reason `ClaimLedger` gives: the
 * blocks arrive from a loop inside a loop and threading a running total through
 * them is how one of them comes to be left out.
 */
export interface DialogueLedger {
  /**
   * Adjudicate one block and record it.
   *
   * `Result` for the case that is neither spoken nor silenced: a `fact` block
   * this file cannot read. That refuses the **document**, because a renamed or
   * misspelt field must not present as an honest rejection — it is the rename
   * that this whole mechanism exists to catch, and swallowing it here would hide
   * the catcher behind the catch.
   */
  admit(pointer: string, lines: readonly DialogueLine[]): Result<UtteranceVerdict>;
  /** Record that a document was walked, whatever it turned out to hold. */
  countQuest(): void;
  /**
   * Record that the block just admitted was a moment line rather than a step's
   * dialogue. Called beside `admit`, never instead of it: a moment line is
   * examined, adjudicated and counted exactly as any other line is.
   */
  countMoment(): void;
  readonly census: DialogueCensus;
}

/** May this block be said, and if not, what was withheld with it. */
export type UtteranceVerdict =
  | { readonly spoken: true; readonly lines: readonly SpeakableLine[] }
  | { readonly spoken: false; readonly silenced: SilencedUtterance };

const paragraph = (pointer: string, total: number, refused: readonly RefusedClaim[]): string => {
  const held = total - refused.length;
  const reasons = refused.map((claim) => `    - ${claim.message}`).join('\n');
  if (total === 1) {
    /* A moment line is a block of one. There is no run-up to leave mid-thought,
       so the block-versus-line sentence below would describe nothing. */
    return (
      `"${pointer}" is a line a verifier did not grant, so it is left unsaid (ADR-0003) and ` +
      `the moment it belongs to is silent. Fixing this is an author's and then a verifier's ` +
      `job; the runtime staying quiet is not a substitute for either.\n${reasons}`
    );
  }
  return (
    `"${pointer}" holds ${String(total)} line(s), ${String(refused.length)} of which a ` +
    `verifier did not grant, so the whole block is left unsaid (ADR-0003). The block is the ` +
    `unit and not the line: the ${String(held)} granted line(s) beside it are the run-up to ` +
    `the one that was refused, and saying them alone leaves the speaker mid-thought. Fixing ` +
    `this is an author's and then a verifier's job; the runtime staying quiet is not a ` +
    `substitute for either.\n${reasons}`
  );
};

export function createDialogueLedger(): DialogueLedger {
  const claims: ClaimLedger = createClaimLedger();
  let quests = 0;
  let utterances = 0;
  let spoken = 0;
  let moments = 0;
  const silenced: SilencedUtterance[] = [];

  return {
    countQuest(): void {
      quests += 1;
    },

    countMoment(): void {
      moments += 1;
    },

    admit(pointer, lines): Result<UtteranceVerdict> {
      utterances += 1;
      const refused: RefusedClaim[] = [];

      for (const [index, line] of lines.entries()) {
        const at = `${pointer}/${String(index)}`;
        /* The block, read. A `fact` this reader cannot parse refuses the
           document rather than defaulting to "not verified": see `admit`. */
        const claim = readFactClaim(line.fact, at);
        if (!claim.ok) {
          /*
           * Re-coded, not re-worded. The rule is the level's and its message
           * names the field a maintainer must fix, which is the part worth
           * keeping; the *code* is what `./quests.ts` prints beside a refused
           * document and `content.level.claim` on a quest would send whoever
           * reads it to the wrong directory.
           */
          return appErr('invalid', 'content.quest.claim', claim.error.message, { field: at });
        }
        const refusal = claims.admit(at, claim.value);
        if (refusal !== null) refused.push(refusal);
      }

      if (refused.length === 0) {
        spoken += 1;
        /* The one place the receipt is attached, and it is attached to lines
           that have just been adjudicated one by one. */
        return ok({ spoken: true, lines: lines as readonly SpeakableLine[] });
      }

      const block: SilencedUtterance = {
        pointer,
        lines: lines.length,
        refused,
        message: paragraph(pointer, lines.length, refused),
      };
      silenced.push(block);
      return ok({ spoken: false, silenced: block });
    },

    get census(): DialogueCensus {
      const lines = claims.census;
      return {
        quests,
        examined: lines.examined,
        factual: lines.factual,
        drawable: lines.drawable,
        refused: lines.refused,
        utterances,
        spoken,
        silenced: [...silenced],
        moments,
      };
    },
  };
}

/**
 * One quest document, adjudicated.
 *
 * Every step that carries a `dialogue` array goes through the ledger. A step
 * that carries none is passed through untouched and is **not** counted as an
 * utterance: the author wrote no block there, and counting an absence would make
 * `utterances` a count of steps rather than of things a speaker says.
 *
 * **The four moment lines go through the same ledger**, each as a block of one
 * at `<id>#/<field>`. One line is one utterance there by construction: a moment
 * is one thing a speaker says at one moment. A granted one is carried as a
 * {@link SpeakableLine}; a refused one is removed from the quest and its receipt
 * put in {@link SpokenQuest.momentsSilenced}; an absent one is neither, and is
 * not counted, for the reason a step with no `dialogue` is not. The raw
 * `DialogueLine`s are stripped from the result rather than spread through, so an
 * unadjudicated moment line is not a value this function can hand back.
 *
 * `Result` rather than a throw, and the failure is a document this file cannot
 * adjudicate rather than one it has adjudicated badly. `./quests.ts` puts it on
 * the same `refused` channel a malformed quest already uses, so one unreadable
 * `fact` block costs its own quest and not the other nine.
 */
export function adjudicateQuest(
  quest: QuestDocument,
  ledger: DialogueLedger,
  where: string = String(quest.id),
): Result<SpokenQuest> {
  ledger.countQuest();

  const steps: SpokenStep[] = [];
  for (const [index, step] of quest.steps.entries()) {
    const { dialogue, ...rest } = step;
    if (dialogue === undefined) {
      steps.push(rest);
      continue;
    }

    const verdict = ledger.admit(`${where}#/steps/${String(index)}/dialogue`, dialogue);
    if (!verdict.ok) return verdict;
    steps.push(
      verdict.value.spoken
        ? { ...rest, dialogue: verdict.value.lines }
        : { ...rest, silenced: verdict.value.silenced },
    );
  }

  const moments: { [M in QuestMoment]?: SpeakableLine } = {};
  const momentsSilenced: { [M in QuestMoment]?: SilencedUtterance } = {};
  for (const moment of QUEST_MOMENTS) {
    const line = quest[moment];
    if (line === undefined) continue;

    const verdict = ledger.admit(`${where}#/${moment}`, [line]);
    if (!verdict.ok) return verdict;
    ledger.countMoment();

    if (!verdict.value.spoken) {
      momentsSilenced[moment] = verdict.value.silenced;
      continue;
    }
    const [said] = verdict.value.lines;
    if (said !== undefined) moments[moment] = said;
  }

  /* Named with a leading underscore because they are taken off on purpose: the
     raw lines must not survive into a `SpokenQuest` beside the adjudicated ones. */
  const {
    steps: _steps,
    declinedLine: _declinedLine,
    reminderLine: _reminderLine,
    afterLine: _afterLine,
    doneLine: _doneLine,
    ...rest
  } = quest;

  return ok({
    ...rest,
    steps,
    ...moments,
    ...(Object.keys(momentsSilenced).length === 0 ? {} : { momentsSilenced }),
  });
}

/**
 * The branded step the domain just chose.
 *
 * `currentStep` is `app/domain`'s rule for **which** step the player is on, it
 * is typed for the domain's own `Quest`, and what it hands back has therefore
 * lost the receipt this file attached. It has not lost the *identity*: the value
 * it returns is an element of `quest.steps`. So the receipt is recovered by
 * reference and never re-derived — a step that is not one of this quest's own
 * answers `undefined` rather than being cast back into one, and the index
 * arithmetic stays in the domain where it belongs.
 */
export function spokenStep(
  quest: SpokenQuest,
  step: QuestStepDocument | undefined,
): SpokenStep | undefined {
  if (step === undefined) return undefined;
  return quest.steps.find((candidate) => candidate === step);
}

/**
 * Is this census worth a line on the console?
 *
 * Three states, and the last is the one that matters.
 *
 *  - **A block was silenced**, or a line was refused. A developer needs the
 *    pointer and the reason.
 *  - **Quests were read and nothing was examined.** Every shipped quest opens on
 *    a `talk` step whose `dialogue` `./quests.ts` requires, so this is the filter
 *    having stopped matching the blocks it reads — precisely the failure that
 *    used to be indistinguishable from success (ADR-0024).
 *  - **No quest was read at all.** Normal, and silent: `content/quests/` may be
 *    empty, and a warning on every load of a build that ships no quest is a
 *    warning people learn to ignore.
 *
 * A build in good order says nothing here and still publishes every number to
 * the scene probe, so "0 silenced of 46 blocks" stays readable from outside.
 */
export function dialogueCensusIsRemarkable(census: DialogueCensus): boolean {
  if (census.silenced.length > 0 || census.refused.length > 0) return true;
  return census.quests > 0 && census.examined === 0;
}

export function describeDialogueCensus(census: DialogueCensus): string {
  const head =
    `${String(census.quests)} quest(s): ${String(census.utterances)} block(s) of dialogue, ` +
    `${String(census.examined)} line(s) examined, ${String(census.factual)} state a fact, ` +
    `${String(census.drawable)} drawable, ${String(census.refused.length)} not drawn ` +
    `(${String(census.moments)} of the lines are moment lines); ` +
    `${String(census.spoken)} block(s) said, ${String(census.silenced.length)} left unsaid.`;
  if (census.silenced.length === 0) return head;
  return [head, ...census.silenced.map((block) => `  - ${block.message}`)].join('\n');
}
