/**
 * The quest, from the offer to the stamp.
 *
 * `docs/stories/TN-QUEST-parliament-hill.md` is the acceptance criteria, and the
 * shape of this file follows the one sentence in `content/schemas/quest.schema.json`
 * that decides everything: a quest has a **giver**, and a step may carry
 * **dialogue**. This is something talking to the player, not a checklist — so
 * the surface is `app/ui/dialogue.ts` with the tracker in the HUD behind it, and
 * not a list of objectives nobody would read.
 *
 * *Something*, not somebody: ADR-0029. A giver is whatever the level **places**
 * under that id — a character, or a point of interest. Peggy's Cove and the
 * North may draw no figure of any kind at any scale, so on those two levels the
 * offerer is a landmark, and `./engageables.ts` is where an id becomes a kind
 * and a name. Nothing in this file branches on which of the two it got: a plaque
 * is the named source of words on screen, and it acquires no mouth, no rig and
 * no mood by being one.
 *
 * ## Why it is here and not in `app/ui`
 *
 * Every decision below needs something `app/ui` may not hold: the `Progress`
 * value, the clock, the quest documents and the domain's transition rules
 * (ADR-0005). What `app/ui` gets is what it always gets — already-localised
 * strings and callbacks. `createDialogue` never learns that a quest exists, which
 * is what lets it carry any NPC in any level.
 *
 * ## Where the words come from, and the three that have no home
 *
 * Everything the giver says is the **quest document's**: the offer is the
 * leading `talk` step's `dialogue[].text`, the tracker is the current step's
 * `prompt`, and the reminder is that same prompt read back. Only two strings are
 * copy rows, because they are the same in every quest in the game: `quest.accept`
 * and `quest.decline`.
 *
 * Three of `TN-QUEST`'s lines have **nowhere to live** and are therefore not
 * drawn: `officer.declined` ("No problem. Come back when you are ready."),
 * `officer.reminder` and `officer.afterStamp`. `quest.schema.json` puts dialogue
 * on a *step*, so a quest can say what its giver says when the step starts and
 * has no field for what he says when the player declines, comes back mid-quest,
 * or returns after finishing. Rather than invent three copy rows keyed on a quest
 * — the `level.loading` defect, one story later — declining closes the dialogue,
 * and coming back reads the step's own prompt. Reported with the task.
 *
 * ## Teaching at the landmark, which is what a `visit` step is for
 *
 * A quest runs talk → visit → answer → visit → answer, and **a `visit` step
 * carries lines of its own**: the player is told why this place matters and is
 * asked about it while they are standing there. `readStep` has always carried
 * them and the schema has always permitted them; nothing drew them, so 27
 * authored lines existed in the tree and never reached a screen.
 *
 * They are spoken by {@link VisitedOutcome.speak}, after the landmark's own card
 * and before the question — the place introduces itself in its own card, then a
 * named speaker says what it means. Two surfaces, because they are two voices: a
 * blurb is the level document's claim about a place and has no speaker, and a
 * line has one, which on two levels is a **plaque**. Folding them together would
 * give the pair one accessible name and one voice, and a screen-reader user
 * would have no way to tell the place from whoever is commenting on it.
 *
 * ## The pause, which is the trap this file was written around
 *
 * A dialogue over a live level is the same trap the menu was: whoever takes the
 * level has to give it back on **every** path out, including the ones nobody
 * pressed. So this controller holds one reason of its own, takes it when a
 * dialogue opens and releases it on accept, decline, close, Escape and teardown —
 * and the completion card takes its own reason (`'complete'`), never this one.
 */

import type { QuestDocument } from '@application/ports';
import type { Clock } from '@application/ports/clock';
import { startQuest, questIsOnOffer, offerQuest } from '@application/use-cases/start-quest';
import {
  currentStep,
  progressQuest,
  requiredForStep,
  type QuestState,
} from '@domain/entities/quest';
import {
  hasStamp,
  questStateFor,
  withQuestState,
  withStamp,
  type Progress,
} from '@domain/entities/progress';
import type { LevelId } from '@domain/ids';
import type { LocalizedText } from '@domain/entities/values';
import { text, type UiLocale } from '@ui/copy';
import { createDialogue, type Dialogue } from '@ui/dialogue';
import { bareTargetId } from '@ui/interact';
import type { SettingsStore } from '@ui/settings';

import {
  resolveEngageable,
  whyNotEngageable,
  type EngageableResolution,
  type LevelPlacements,
} from './engageables';
import {
  spokenStep,
  type SilencedUtterance,
  type SpokenQuest,
  type SpokenStep,
} from './verified-dialogue';

export interface QuestWiring {
  readonly levelId: LevelId;
  /**
   * This level's quests, in a stable order. Empty is the normal case today.
   *
   * {@link SpokenQuest} and not `QuestDocument`, which is the whole of ADR-0003
   * on this path: a line reaches here only once `./verified-dialogue.ts` has
   * adjudicated it, and the `unique symbol` on `SpeakableLine` means handing
   * this controller the raw document `readQuest` produced does not compile. The
   * filter cannot be forgotten by a caller who never heard of it — the property
   * `Shippable<T>` gives the question bank, for the words a character says.
   */
  readonly quests: readonly SpokenQuest[];
  /**
   * What the level places, read when it is asked rather than when this
   * controller is built.
   *
   * A thunk, and that is not a style choice: the controller is constructed
   * before `loadLevel` resolves, so a value read here would be `null` for the
   * whole sitting and every giver would be refused as unplaced. `null` is the
   * honest answer until the document arrives.
   *
   * This is the whole of ADR-0029 at run time. A giver is named from what the
   * level placed it as — `pois[].name` for a landmark, `content/characters/<id>.json`
   * for a character — so the quest document never has to say which kind it is and
   * cannot contradict the document that does.
   */
  readonly placements: () => LevelPlacements | null;
  /** `hud.main`: a dialog is not a landmark, so a modal goes inside `<main>`. */
  readonly host: HTMLElement;
  readonly store: SettingsStore;
  readonly clock: Clock;
  readonly announce: (message: string, lang?: string) => void;
  /** The live save. A getter, because every answer replaces it. */
  readonly progress: () => Progress;
  /** Write the new save and persist it. The caller owns both. */
  readonly commit: (progress: Progress) => void;
  /** `hud-quest-tracker`. `null` removes it: there is no task (`TN-HUD-01`). */
  readonly setTask: (step: string | null) => void;
  /** A dialogue opened: hold the level. */
  readonly onOpen: () => void;
  /** The dialogue closed, whichever way: give the level back. */
  readonly onClose: () => void;
  /** The last step is done and the stamp is earned. Draw the card. */
  readonly onCompleted: (quest: QuestDocument) => void;
  /** Where focus goes when the dialogue closes back into the level. */
  readonly restoreFocusTo: () => HTMLElement | null;
}

/**
 * Why a step said nothing, or that it did.
 *
 * ADR-0024, and the reason this is a word rather than a boolean: **silence has
 * to say which silence it is.** A `visit` step with no `dialogue` is a document
 * choosing to be quiet, and a step whose lines were dropped because something
 * read the wrong field looks exactly the same on screen. It does not look the
 * same here: `no-dialogue` is the document's choice, `unverified` is ADR-0003
 * declining to say something a verifier declined, `unnamed` and `many-speakers`
 * are refusals this file made and wrote to the console, and `no-step` means the
 * player engaged something the current step is not about. Only `spoken` puts
 * words on screen.
 */
export type VisitSpeech =
  /** A dialogue opened, named after the speaker, and holds the step's lines. */
  | 'spoken'
  /** The current step was not this target's `visit`/`collect` step. */
  | 'no-step'
  /** The step carried no `dialogue`. The document is quiet, and so is the game. */
  | 'no-dialogue'
  /**
   * The step carried dialogue and a verifier declined a claim in it, so the
   * whole block is left unsaid (ADR-0003, `./verified-dialogue.ts`).
   *
   * A separate word from `no-dialogue` and that is the entire point of it being
   * a word. The two look identical on screen — nothing opens, the caller's
   * continuation runs, the quest advances — and they are opposite facts about
   * the document: one author wrote nothing, another wrote something a verifier
   * would not grant. ADR-0024 says a silence must say which silence it is.
   */
  | 'unverified'
  /** The speaker is not placed on this level, or this build cannot name it. */
  | 'unnamed'
  /**
   * The step's lines name more than one speaker.
   *
   * `app/ui/dialogue.ts` has one speaker per dialog, because the name is the
   * dialog's accessible name (`TN-QUEST-08`). Two speakers in one surface would
   * put one of them behind the other's name, which is a screen reader told the
   * wrong thing rather than a layout compromise — so the step is refused and the
   * console names the document. No shipped quest is shaped this way.
   */
  | 'many-speakers';

/**
 * What reaching a step's target did, and what that step has to say about it.
 *
 * `speak` is a thunk rather than a list of strings for the reason ADR-0029
 * exists: turning a line into a dialog needs the speaker resolved against what
 * the level **placed** and named from the document that names it, and that is
 * this file's job, not its caller's. Handing back raw text would invite a second
 * naming path beside the one the `talk` step already uses — the path that would
 * eventually reach for a pose on a lighthouse.
 */
export interface VisitedOutcome {
  /** The current step was this target's, and the quest moved on. */
  readonly advanced: boolean;
  /**
   * Say the finished step's lines, then call `onClosed`.
   *
   * `onClosed` is called **exactly once on every path**: when the player
   * dismisses the dialogue, and immediately when there is nothing to open. The
   * caller therefore has one continuation and no branch, which is what stops the
   * landmark's question from being owed down one route and not the other.
   */
  speak(onClosed: () => void): VisitSpeech;
}

/** Nothing happened here: not this step's target, or no quest is running. */
const NOT_THIS_STEP: VisitedOutcome = {
  advanced: false,
  speak(onClosed): VisitSpeech {
    onClosed();
    return 'no-step';
  },
};

export interface QuestController {
  /**
   * The quest an answer would count toward right now, or `undefined`.
   *
   * Asked by the composition root on every recorded answer and passed straight
   * to `answerQuestion`, which is the only thing allowed to advance an `answer`
   * step. Supplying it does not force a count: the use case advances a quest only
   * while it is active *and* on an `answer` step, so a Study drill taken from the
   * menu in the middle of a quest cannot finish it by accident.
   */
  readonly answering: QuestDocument | undefined;
  /** Is a quest dialogue on screen? */
  readonly dialogueOpen: boolean;
  /**
   * Something was engaged. `true` when it was a giver and a dialogue opened, so
   * the caller knows not to treat it as a landmark as well.
   */
  engage(targetId: string): boolean;
  /**
   * A landmark was engaged: advance a `visit` step if that is the current one,
   * and hand back what that step had to say about the place.
   *
   * One call rather than two, and that is the whole of why it returns something.
   * A step's lines have to be read **before** the step advances — `currentStep`
   * is the next one the instant `progressQuest` succeeds — so a caller that
   * asked "did it advance?" and then "what did it say?" would always be asking
   * the second question of the wrong step. The lines are captured here, in the
   * closure {@link VisitedOutcome.speak} carries, and the caller decides *when*
   * they are spoken without being able to change *which* they are.
   */
  visited(targetId: string): VisitedOutcome;
  /**
   * Would engaging this target open a dialogue?
   *
   * Asked by the composition root **before** it offers a prompt, because a
   * target that is not a giver — or that this build cannot name — cannot be
   * spoken to, and a prompt that opens nothing is the dead control this project
   * keeps finding. It is not the same question as
   * {@link QuestController.isGiver}: a giver this build cannot name is a giver
   * that cannot be engaged.
   *
   * True for a **landmark** giver as well as a character one (ADR-0029): the
   * lighthouse at Peggy's Cove offers a quest and no figure is drawn to hold it.
   */
  canEngage(targetId: string): boolean;
  /**
   * Is the step the player is on a `visit` or `collect` step for this target?
   *
   * The question the prompt needs about a landmark whose claim was refused: it
   * has no card, so it is worth offering only while a quest is waiting for the
   * player there. Asking changes nothing — {@link QuestController.visited} is
   * the call that advances.
   */
  awaits(targetId: string): boolean;
  /** Is this target a quest giver in this level? */
  isGiver(targetId: string): boolean;
  /** An answer was recorded: redraw the tracker from the save. */
  refresh(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs: number): void;
  destroy(): void;
}

/**
 * Fill `{{done}}` and `{{count}}` in a step's prompt.
 *
 * The quest author writes "Answer 3 questions ({{done}} of 3)" — one row, no
 * plural rule, because `{{done}}` is not followed by a noun (`TN-QUEST`, and
 * `TN-COPY`'s rule 5). This is the only interpolation the quest surface does, and
 * it is deliberately not `app/ui/copy.ts`'s: that module interpolates rows *it*
 * owns, and a step's prompt is content.
 */
function fill(template: string, values: Readonly<Record<string, number>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined ? whole : String(value);
  });
}

const localised = (value: LocalizedText, locale: UiLocale): string =>
  locale === 'fr' ? value.fr : value.en;

/**
 * The `talk` step a quest opens with, when it opens with one.
 *
 * `dialogue !== undefined` is now two facts and not one: the document wrote an
 * opening block, **and** ADR-0003 allows it to be said. A quest whose offer was
 * silenced answers `undefined` here, which routes through `canEngage` and
 * `engage` to "the quest is not offered" — and that is the one place this
 * mechanism costs a whole quest. It is said out loud rather than worked around:
 * {@link openingWasSilenced} is why, and `createQuestController` writes the
 * sentence to the console the first time the giver is examined.
 */
const openingDialogue = (quest: SpokenQuest): SpokenStep | undefined => {
  const first = quest.steps[0];
  return first !== undefined && first.kind === 'talk' && first.dialogue !== undefined
    ? first
    : undefined;
};

/**
 * Did this quest open with words a verifier declined?
 *
 * The difference between a quest that cannot be offered because nobody wrote an
 * offer — which `./quests.ts` already refuses outright, so it cannot happen —
 * and one that cannot be offered because its opening block holds a refused
 * claim. Only the second has a `silenced` receipt on step 0.
 */
const openingWasSilenced = (quest: SpokenQuest): SilencedUtterance | undefined => {
  const first = quest.steps[0];
  return first !== undefined && first.kind === 'talk' ? first.silenced : undefined;
};

export function createQuestController(wiring: QuestWiring): QuestController {
  let locale = wiring.store.current.locale;
  let dialogue: Dialogue | null = null;
  /** The quest whose dialogue is open, so closing knows what it was about. */
  let talking: SpokenQuest | null = null;
  /**
   * What the caller is owed when the open dialogue closes, or `null`.
   *
   * The landmark chain is one hold across two dialogs and a question
   * (`app/bootstrap/main.ts`), so the thing that follows a `visit` step's lines
   * has to be run by whichever way the player left them — the button, Escape, or
   * the close that a second engagement would cause. Holding it here rather than
   * passing it to `Dialogue` keeps `app/ui` unaware that a quest exists.
   */
  let afterClose: (() => void) | null = null;

  /*
   * The one refusal that costs a whole quest, said once, where it happens.
   *
   * A quest's opening `talk` block is its offer. Silenced, `openingDialogue`
   * answers `undefined`, `canEngage` answers false and the giver is never
   * offered — the player walks past a character who does nothing. That is the
   * right outcome (the alternatives are speaking a declined claim, or opening a
   * dialog with no words, which `./quests.ts` already settled) and it is the one
   * outcome a player cannot tell from a bug, so it is named here rather than
   * left to `canEngage`, which runs on every prompt refresh and is silent by
   * design.
   */
  for (const quest of wiring.quests) {
    const silenced = openingWasSilenced(quest);
    if (silenced === undefined) continue;
    console.error(
      `[bootstrap] "${String(quest.id)}" cannot be offered: its opening talk step is what a ` +
        `giver says to offer it, and that block is left unsaid. ` +
        silenced.message,
    );
  }

  const stateOf = (quest: SpokenQuest): QuestState | undefined =>
    questStateFor(wiring.progress(), wiring.levelId, quest.id);

  /** The quest a giver id belongs to, or `null`. Ids are compared bare. */
  function questFor(targetId: string): SpokenQuest | null {
    const wanted = bareTargetId(targetId);
    return (
      wiring.quests.find((quest) => bareTargetId(`${quest.giver}`) === wanted) ?? null
    );
  }

  /** The quest that is being played right now, or `null`. */
  function active(): SpokenQuest | null {
    return (
      wiring.quests.find((quest) => stateOf(quest)?.status === 'active') ?? null
    );
  }

  /**
   * The tracker's line: what to do **now**, not what the quest is called.
   *
   * `TN-QUEST-02` — "the tracker says what to do now, not what the quest is
   * called" — and `TN-HUD-01`'s "the tracker appears only when there is a task",
   * which is why the answer is `null` rather than an empty strip when nothing is
   * accepted.
   */
  function trackerLine(): string | null {
    const quest = active();
    if (quest === null) return null;
    const state = stateOf(quest);
    if (state === undefined) return null;
    const step = currentStep(quest, state);
    if (step === undefined) return null;
    return fill(localised(step.prompt, locale), {
      done: state.stepProgress,
      count: requiredForStep(step),
    });
  }

  function refresh(): void {
    wiring.setTask(trackerLine());
  }

  /**
   * The giver, resolved against what the level placed — or a refusal.
   *
   * ADR-0029: a quest is offered by an **engageable**, which is a character the
   * level places *or a point of interest it places*, and the name comes from
   * whichever of the two it turned out to be. Nothing here asks the quest
   * document which kind its giver is; the quest does not know, and a field for
   * it would be a second declaration that can disagree with the level's.
   */
  const giverOf = (quest: SpokenQuest): EngageableResolution =>
    resolveEngageable(wiring.placements(), bareTargetId(`${quest.giver}`));

  /**
   * The giver's name in the language in force, or `null` when this build has
   * none for it.
   *
   * `TN-QUEST-08` requires the dialog's accessible name to be the speaker's, and
   * `app/ui/dialogue.ts` takes it as a **required** option so that an unnamed
   * dialog cannot be built. A giver that cannot be named is refused rather than
   * announced as nothing, or — worse for the one user this matters most to —
   * announced as a kebab-case id read out one hyphen at a time.
   */
  function speakerName(quest: SpokenQuest): string | null {
    const resolution = giverOf(quest);
    return resolution.ok ? localised(resolution.engageable.name, locale) : null;
  }

  /** The refusal, as one sentence naming the document a maintainer must fix. */
  function refuse(quest: SpokenQuest): void {
    const resolution = giverOf(quest);
    if (resolution.ok) return;
    console.error(
      `[bootstrap] "${String(quest.id)}" is offered by "${String(quest.giver)}", and this ` +
        `build cannot name it, so the offer is refused rather than opened in a dialog with no ` +
        `accessible name (TN-QUEST-08, ADR-0029). ` +
        whyNotEngageable(bareTargetId(`${quest.giver}`), String(wiring.levelId), resolution),
    );
  }

  function ensureDialogue(name: string): Dialogue {
    if (dialogue !== null) {
      dialogue.setSpeaker(name);
      return dialogue;
    }
    dialogue = createDialogue(wiring.host, {
      speakerName: name,
      locale,
      announce: wiring.announce,
      singleSwitch: wiring.store.current.singleSwitch,
      holdMs: wiring.store.current.holdToChooseMs,
      /* Escape and the absence of a choice. `TN-QUEST-03`: "leaving the dialogue
         without choosing is not a decline", so this routes nowhere near the
         decline path — it gives the level back and nothing else. */
      onClose: () => {
        close();
      },
    });
    return dialogue;
  }

  /** One way out, taken by every path: the level is given back exactly once. */
  function close(): void {
    if (talking === null) return;
    talking = null;
    /* Taken before anything else runs, so a continuation that opened something
       of its own cannot be run twice by the close that follows it. */
    const owed = afterClose;
    afterClose = null;
    dialogue?.hide();
    wiring.onClose();
    const destination = wiring.restoreFocusTo();
    if (destination !== null && destination.isConnected) {
      destination.focus({ preventScroll: true });
    }
    /* Last, and after the level has been given back: what the caller is owed
       when this dialogue ends — the landmark's question, today. */
    owed?.();
  }

  /**
   * Put words on screen in somebody's — or something's — name.
   *
   * `speaker` is the resolved name when the caller has already worked out whose
   * words these are; absent, it is the quest's giver. Both come out of
   * `./engageables.ts`, which is the point: there is one place an id becomes a
   * name, and it reads the level's own placement to decide whether that id is a
   * character or a landmark. Nothing here looks at a rig, a portrait or a pose,
   * and a landmark line has no `expression` key to look at even if it did
   * (ADR-0029 §4).
   */
  function open(
    quest: SpokenQuest,
    lines: readonly string[],
    offer: boolean,
    speaker?: string,
  ): boolean {
    const name = speaker ?? speakerName(quest);
    if (name === null) {
      refuse(quest);
      return false;
    }
    if (lines.length === 0) return false;

    const view = ensureDialogue(name);
    talking = quest;
    wiring.onOpen();
    view.show({
      lines,
      ...(offer
        ? {
            accept: {
              label: text(locale, 'quest.accept'),
              onSelect: () => {
                decide(quest, 'accept');
              },
            },
            decline: {
              label: text(locale, 'quest.decline'),
              onSelect: () => {
                decide(quest, 'decline');
              },
            },
          }
        : {
            /* A line with nothing to decide gets one way onward, which is also
               what a switch user's long press takes. */
            next: {
              label: text(locale, 'common.close'),
              onSelect: () => {
                close();
              },
            },
          }),
    });
    return true;
  }

  /**
   * "Yes, let's go" or "Not now".
   *
   * Accepting finishes a leading `talk` step in the same move, which is the
   * domain's rule and not this file's (`acceptQuest`), so the tracker shows step
   * 2 the moment the dialogue closes. Declining leaves the quest offerable:
   * `TN-QUEST-03`, "the quest can be accepted later".
   */
  function decide(quest: SpokenQuest, decision: 'accept' | 'decline'): void {
    const result = startQuest(
      { clock: wiring.clock },
      { quest, progress: wiring.progress(), decision },
    );
    if (!result.ok) {
      console.error(
        `[bootstrap] "${String(quest.id)}" could not be ${decision}ed. ` +
          `${result.error.code}: ${result.error.message}`,
      );
      close();
      return;
    }
    wiring.commit(result.value.progress);
    close();
    refresh();
    /*
     * A quest of one `talk` step would be complete on acceptance. Nothing in
     * `content/quests/` is shaped that way today and the domain allows it, so the
     * stamp is folded here rather than left to a path that happens not to exist.
     */
    if (result.value.questCompleted) earn(quest);
  }

  /**
   * The last step is done: the stamp goes in the passport, once.
   *
   * The same rule `answerQuestion` applies to an answer that finishes a quest,
   * and it is written twice because there is no `progress-quest` use case to
   * hold it — `app/application` is not this task's to add to. Both copies are
   * idempotent through `hasStamp`, so a quest finished twice is one stamp, one
   * unlock and one line in the passport (`TN-QUEST-04`). Reported: the right home
   * is one use case that both call.
   */
  function earn(quest: SpokenQuest): void {
    const progress = wiring.progress();
    if (!hasStamp(progress, quest.levelId)) {
      wiring.commit(withStamp(progress, quest.levelId, wiring.clock.now()));
    }
    refresh();
    wiring.onCompleted(quest);
  }

  /**
   * What a step the player has just reached the target of has to say.
   *
   * The lines are read **here**, while `step` is still the step that was
   * finished, and everything that turns them into a dialog is deferred to
   * {@link VisitedOutcome.speak} — so the caller owns the *moment* and this file
   * owns the *voice*. Call `speak` once.
   *
   * Three things this deliberately does not do:
   *
   *  - **It does not assume the giver is speaking.** The name is resolved from
   *    the lines' own `speaker` through `./engageables.ts`, which is the same
   *    resolution the `talk` step uses and the only one there is. On Peggy's
   *    Cove and in the North that id is a **point of interest**, and it is named
   *    from the level's own `pois[].name` exactly as the offer was.
   *  - **It does not read `expression`.** Only `text` is taken off a line. A
   *    landmark line has no `expression` key at all (ADR-0029 §4, and
   *    `tests/unit/contracts/a-quest-giver-is-placed-on-its-level.test.ts`
   *    holds it), and the way that stays true is that nothing on this path asks.
   *    `app/ui/dialogue.ts` has no portrait and takes no pose.
   *  - **It does not invent a line.** A step with no `dialogue` is silent, and
   *    says which silence it is (ADR-0024): `no-dialogue` for a quiet document,
   *    `unverified` for a block ADR-0003 declined, and a console sentence naming
   *    the file for anything else.
   *
   * It also does not decide *whether* a line may be said. That is settled before
   * this file sees it: `step.dialogue` on a `SpokenStep` is `SpeakableLine[]`,
   * and there is no way to be holding one that a verifier declined
   * (`./verified-dialogue.ts`).
   */
  function speechFor(quest: SpokenQuest, step: SpokenStep): VisitedOutcome {
    const lines = step.dialogue;
    const where = `"${String(quest.id)}" step "${step.id}"`;

    return {
      advanced: true,
      speak(onClosed): VisitSpeech {
        if (lines === undefined || lines.length === 0) {
          /*
           * Two silences, and they are told apart by the receipt rather than by
           * re-reading the document (ADR-0024).
           *
           * `silenced` present means `./verified-dialogue.ts` read a block here
           * and would not let it be said: the whole block, because the granted
           * lines beside a refused one are its run-up and saying them alone
           * leaves the speaker mid-thought. The step still advanced and the
           * caller is still owed its continuation, so the level remains
           * finishable — what is lost is the teaching, exactly as a refused
           * blurb costs a landmark its card and not its art.
           *
           * `silenced` absent means the author wrote no lines here, which is a
           * document choosing to be quiet and is not news.
           */
          const { silenced } = step;
          if (silenced !== undefined) {
            console.error(
              `[bootstrap] ${where} is left unsaid. ` + silenced.message,
            );
            onClosed();
            return 'unverified';
          }
          /* The document chose to be quiet. Nothing opens, and the caller is
             owed its continuation just the same. */
          onClosed();
          return 'no-dialogue';
        }

        /* One speaker per surface: the name is the dialog's accessible name, so
           two of them would put one speaker's words behind the other's name. */
        const speakers = [...new Set(lines.map((line) => bareTargetId(String(line.speaker))))];
        const only = speakers.length === 1 ? speakers[0] : undefined;
        if (only === undefined) {
          console.error(
            `[bootstrap] ${where} is spoken by ${String(speakers.length)} different speakers ` +
              `(${speakers.join(', ')}), and a dialog has one accessible name. The step is ` +
              `left unsaid rather than attributed to whichever was listed first ` +
              `(TN-QUEST-08). Split it into one step per speaker.`,
          );
          onClosed();
          return 'many-speakers';
        }

        const resolution = resolveEngageable(wiring.placements(), only);
        if (!resolution.ok) {
          console.error(
            `[bootstrap] ${where} is spoken by "${only}", and this build cannot name it, so ` +
              `the line is left unsaid rather than announced as nothing (TN-QUEST-08, ` +
              `ADR-0029). ` +
              whyNotEngageable(only, String(wiring.levelId), resolution),
          );
          onClosed();
          return 'unnamed';
        }

        /* `line.text`, and nothing else off the line. See above. */
        const said = lines.map((line) => localised(line.text, locale));
        if (!open(quest, said, false, localised(resolution.engageable.name, locale))) {
          onClosed();
          return 'unnamed';
        }
        afterClose = onClosed;
        return 'spoken';
      },
    };
  }

  return {
    get answering(): SpokenQuest | undefined {
      const quest = active();
      if (quest === null) return undefined;
      const state = stateOf(quest);
      if (state === undefined) return undefined;
      return currentStep(quest, state)?.kind === 'answer' ? quest : undefined;
    },

    get dialogueOpen(): boolean {
      return talking !== null;
    },

    isGiver(targetId): boolean {
      return questFor(targetId) !== null;
    },

    awaits(targetId): boolean {
      const quest = active();
      if (quest === null) return false;
      const state = stateOf(quest);
      if (state === undefined) return false;
      const step = currentStep(quest, state);
      if (step === undefined) return false;
      if (step.kind !== 'visit' && step.kind !== 'collect') return false;
      return bareTargetId(step.targetId) === bareTargetId(targetId);
    },

    canEngage(targetId): boolean {
      const quest = questFor(targetId);
      if (quest === null) return false;
      /* An unnameable giver cannot be offered: `app/ui/dialogue.ts` requires the
         speaker's name, and a dialog with no accessible name is the defect
         `TN-QUEST-08` exists to catch. Silent here — this runs on every prompt
         refresh, and `open` says why once, where a developer will see it. */
      if (speakerName(quest) === null) return false;

      const state = questStateFor(wiring.progress(), wiring.levelId, quest.id);
      /* On offer: only if the quest actually opens with something to say. */
      if (questIsOnOffer(wiring.progress(), quest)) {
        return openingDialogue(quest) !== undefined;
      }
      /* Being played, or finished: the reminder and the summary are both real
         things to read (`TN-REACH-03`: "the dialogue for that target opens
         again"). */
      return state !== undefined;
    },

    engage(targetId): boolean {
      const quest = questFor(targetId);
      if (quest === null || talking !== null) return false;

      const progress = wiring.progress();
      const state = questStateFor(progress, wiring.levelId, quest.id);

      /*
       * On offer — never met, or declined and come back. The offer is recorded
       * first, so a tab closed with the dialogue open comes back as "offered"
       * rather than as never met (`TN-SAVE` item 5).
       */
      if (questIsOnOffer(progress, quest)) {
        const opening = openingDialogue(quest);
        if (opening?.dialogue === undefined) return false;
        const recorded = offerQuest({ clock: wiring.clock }, { quest, progress });
        if (recorded.ok) wiring.commit(recorded.value.progress);
        return open(
          quest,
          opening.dialogue.map((line) => localised(line.text, locale)),
          true,
        );
      }

      /*
       * Being played: the giver reads the current step back. It is a reminder in
       * the quest's own words rather than a second offer — `TN-QUEST-02`, "no
       * second quest/offered event is emitted" — and it is the step's `prompt`
       * because `officer.reminder` has nowhere in the schema to live.
       */
      if (state?.status === 'active') {
        const step = currentStep(quest, state);
        if (step === undefined) return false;
        return open(quest, [localised(step.prompt, locale)], false);
      }

      /*
       * Finished. The job, read back — which is what `summary` is for, and what
       * "See this one again" offers a player who wants to read it twice
       * (`TN-REACH-03`). Nothing is earned a second time: `earn` is not on this
       * path at all.
       */
      if (state?.status === 'completed') {
        return open(quest, [localised(quest.summary, locale)], false);
      }

      return false;
    },

    visited(targetId): VisitedOutcome {
      const quest = active();
      if (quest === null) return NOT_THIS_STEP;
      const state = stateOf(quest);
      if (state === undefined) return NOT_THIS_STEP;
      const step = currentStep(quest, state);
      /* Only the step the player is actually on, and only when the thing they
         engaged is the thing it names. Steps cannot be skipped (`TN-QUEST-04`),
         and a landmark on the far side of the level cannot close this one. */
      if (step === undefined) return NOT_THIS_STEP;
      if (step.kind !== 'visit' && step.kind !== 'collect') return NOT_THIS_STEP;
      if (bareTargetId(step.targetId) !== bareTargetId(targetId)) return NOT_THIS_STEP;

      /*
       * Read before the step moves. `currentStep` answers with the *next* step
       * the moment `progressQuest` succeeds, so a caller that came back for the
       * lines afterwards would be handed the `answer` step's — which carries
       * none, and the 27 lines authored to teach at a landmark would be dropped
       * on the floor while everything went on passing.
       */
      /*
       * The branded step, recovered by identity from the quest's own array.
       *
       * `currentStep` is the domain's rule for which step the player is on and
       * is typed for the domain's `Quest`, so what it answers has lost the
       * receipt `./verified-dialogue.ts` attached. `spokenStep` gives it back
       * without re-deriving the index: the value is an element of `quest.steps`,
       * and a step that is not one of this quest's own answers `undefined`
       * rather than being cast back into one.
       */
      const spoken = spokenStep(quest, step);
      if (spoken === undefined) return NOT_THIS_STEP;

      const speech = speechFor(quest, spoken);

      const advance = progressQuest(
        quest,
        state,
        { kind: step.kind, targetId: step.targetId },
        wiring.clock.now(),
      );
      if (!advance.ok) {
        console.error(
          `[bootstrap] "${String(quest.id)}" refused a ${step.kind} step. ` +
            `${advance.error.code}: ${advance.error.message}`,
        );
        return NOT_THIS_STEP;
      }
      wiring.commit(withQuestState(wiring.progress(), quest.levelId, advance.value.state));
      refresh();
      if (advance.value.questCompleted) earn(quest);
      return speech;
    },

    refresh,

    setLocale(next): void {
      locale = next;
      dialogue?.setLocale(next);
      /* The tracker is the step's own prompt, so it is re-read in the new
         language rather than translated: `TN-QUEST-11`, "switching language
         mid-quest keeps the progress". */
      refresh();
    },

    setSingleSwitch(enabled, holdMs): void {
      dialogue?.setSingleSwitch(enabled, holdMs);
    },

    destroy(): void {
      /* The level is going. Whatever hold this controller had is released by the
         caller's teardown, and the dialogue is destroyed rather than left as a
         modal over a level that no longer exists. */
      talking = null;
      /* Dropped, not run: what a closing dialogue owes is a question about a
         landmark on a level that is being torn down. */
      afterClose = null;
      dialogue?.destroy();
      dialogue = null;
    },
  };
}
