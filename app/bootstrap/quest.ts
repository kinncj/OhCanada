/**
 * The quest, from the offer to the stamp.
 *
 * `docs/stories/TN-QUEST-parliament-hill.md` is the acceptance criteria, and the
 * shape of this file follows the one sentence in `content/schemas/quest.schema.json`
 * that decides everything: a quest has a **giver**, and a step may carry
 * **dialogue**. This is a character talking to the player, not a checklist — so
 * the surface is `app/ui/dialogue.ts` with the tracker in the HUD behind it, and
 * not a list of objectives nobody would read.
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
 * ## The pause, which is the trap this file was written around
 *
 * A dialogue over a live level is the same trap the menu was: whoever takes the
 * level has to give it back on **every** path out, including the ones nobody
 * pressed. So this controller holds one reason of its own, takes it when a
 * dialogue opens and releases it on accept, decline, close, Escape and teardown —
 * and the completion card takes its own reason (`'complete'`), never this one.
 */

import type { QuestDocument, QuestStepDocument } from '@application/ports';
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
import { hasCopyRow, text, type UiLocale } from '@ui/copy';
import { createDialogue, type Dialogue } from '@ui/dialogue';
import { bareTargetId } from '@ui/interact';
import type { SettingsStore } from '@ui/settings';

export interface QuestWiring {
  readonly levelId: LevelId;
  /** This level's quests, in a stable order. Empty is the normal case today. */
  readonly quests: readonly QuestDocument[];
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
  /** A landmark was engaged: advance a `visit` step if that is the current one. */
  visited(targetId: string): void;
  /**
   * Would engaging this target open a dialogue?
   *
   * Asked by the composition root **before** it offers a prompt for a character,
   * because a character who is not a giver — or whose name this build has no row
   * for — cannot be spoken to, and a prompt that opens nothing is the dead
   * control this project keeps finding. It is not the same question as
   * {@link QuestController.isGiver}: a giver this build cannot name is a giver
   * who cannot be engaged.
   */
  canEngage(targetId: string): boolean;
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

/** The `talk` step a quest opens with, when it opens with one. */
const openingDialogue = (quest: QuestDocument): QuestStepDocument | undefined => {
  const first = quest.steps[0];
  return first !== undefined && first.kind === 'talk' && first.dialogue !== undefined
    ? first
    : undefined;
};

export function createQuestController(wiring: QuestWiring): QuestController {
  let locale = wiring.store.current.locale;
  let dialogue: Dialogue | null = null;
  /** The quest whose dialogue is open, so closing knows what it was about. */
  let talking: QuestDocument | null = null;

  const stateOf = (quest: QuestDocument): QuestState | undefined =>
    questStateFor(wiring.progress(), wiring.levelId, quest.id);

  /** The quest a giver id belongs to, or `null`. Ids are compared bare. */
  function questFor(targetId: string): QuestDocument | null {
    const wanted = bareTargetId(targetId);
    return (
      wiring.quests.find((quest) => bareTargetId(`${quest.giver}`) === wanted) ?? null
    );
  }

  /** The quest that is being played right now, or `null`. */
  function active(): QuestDocument | null {
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
   * The giver's name, or `null` when this build has none for him.
   *
   * `TN-QUEST-08` requires the dialog's accessible name to be the speaker's, and
   * `app/ui/dialogue.ts` takes it as a **required** option so that an unnamed
   * dialog cannot be built. `content/characters/` has no documents yet, so the
   * name comes from `npc.<id>.name` in the copy table — and a giver with no row
   * is refused rather than given a dialog called nothing.
   */
  function speakerName(quest: QuestDocument): string | null {
    const key = `npc.${bareTargetId(`${quest.giver}`)}.name`;
    return hasCopyRow(key) ? text(locale, key) : null;
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
    dialogue?.hide();
    wiring.onClose();
    const destination = wiring.restoreFocusTo();
    if (destination !== null && destination.isConnected) {
      destination.focus({ preventScroll: true });
    }
  }

  function open(quest: QuestDocument, lines: readonly string[], offer: boolean): boolean {
    const name = speakerName(quest);
    if (name === null) {
      console.error(
        `[bootstrap] "${String(quest.id)}" is given by "${String(quest.giver)}", and this ` +
          'build has no npc.<id>.name row for him. The offer is refused rather than ' +
          'opened in a dialog with no accessible name (TN-QUEST-08).',
      );
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
  function decide(quest: QuestDocument, decision: 'accept' | 'decline'): void {
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
  function earn(quest: QuestDocument): void {
    const progress = wiring.progress();
    if (!hasStamp(progress, quest.levelId)) {
      wiring.commit(withStamp(progress, quest.levelId, wiring.clock.now()));
    }
    refresh();
    wiring.onCompleted(quest);
  }

  return {
    get answering(): QuestDocument | undefined {
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

    canEngage(targetId): boolean {
      const quest = questFor(targetId);
      if (quest === null) return false;
      /* An unnameable giver cannot be offered: `app/ui/dialogue.ts` requires the
         speaker's name, and a dialog with no accessible name is the defect
         `TN-QUEST-08` exists to catch. Reported on the console the first time
         anything tries. */
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

    visited(targetId): void {
      const quest = active();
      if (quest === null) return;
      const state = stateOf(quest);
      if (state === undefined) return;
      const step = currentStep(quest, state);
      /* Only the step the player is actually on, and only when the thing they
         engaged is the thing it names. Steps cannot be skipped (`TN-QUEST-04`),
         and a landmark on the far side of the level cannot close this one. */
      if (step === undefined) return;
      if (step.kind !== 'visit' && step.kind !== 'collect') return;
      if (bareTargetId(step.targetId) !== bareTargetId(targetId)) return;

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
        return;
      }
      wiring.commit(withQuestState(wiring.progress(), quest.levelId, advance.value.state));
      refresh();
      if (advance.value.questCompleted) earn(quest);
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
      dialogue?.destroy();
      dialogue = null;
    },
  };
}
