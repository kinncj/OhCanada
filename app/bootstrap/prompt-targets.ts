/**
 * What the interact prompt says about everything a level can put in reach.
 *
 * **This function is where the defect was.** It used to answer with the
 * landmark's own localised name from the level document, because
 * `app/ui/copy.ts` had no `hud.interact.*` row — so a player riding through
 * Toronto read "CN Tower" in the HUD. Two things were wrong with that: a noun
 * says what is *there* rather than what choosing it will do, and `TN-NAMES-04`
 * fails the build for a name from its list drawn by the HUD. It got past that
 * check because the name was never a copy string; it was content, interpolated
 * here, at runtime.
 *
 * Every string it can now produce comes from the copy table, through
 * `app/ui/interact.ts`, which holds the whole precedence: **done** beats a
 * level's own per-target row, which beats the kind. A target with no row at all
 * offers `null`, and the announcer draws no prompt for it — never "Interact",
 * never a name, never an empty string (`TN-REACH-05`).
 *
 * ## Both spellings of an id, on purpose
 *
 * The stories write a subject two ways — `poi/entered` for `npc.officer`, and a
 * level document that calls the same character `officer` — and a copy row is
 * keyed on the document's id. Both are registered, so whichever spelling the
 * scene sends finds the same target rather than silently offering nothing.
 *
 * A level that has not loaded has nothing in reach, which is the correct answer
 * rather than a special case.
 *
 * ## Why it is a module of its own
 *
 * It moved out of `app/bootstrap/main.ts` when ADR-0029 made a landmark able to
 * offer a quest, because the rule below about *kind* became a rule worth a test
 * and `main.ts` cannot be imported by one — importing it boots the game. It is
 * pure: no DOM, no Phaser, no state. It takes the two placement lists
 * structurally ({@link LevelPlacements}), so it never learns which adapter
 * parsed them.
 */

import { interactPrompt, bareTargetId, type InteractKind } from '@ui/interact';
import type { LevelTarget } from '@ui/level-events';
import type { UiLocale } from '@ui/copy';

import type { LevelPlacements } from './engageables';

export function promptTargets(
  level: LevelPlacements | null,
  locale: UiLocale,
  state: {
    /** Bare ids engaged in this sitting. */
    readonly done: ReadonlySet<string>;
    /**
     * Would choosing this target open a dialogue?
     *
     * Asked of a **character** only, and that is the change ADR-0029 forced. It
     * used to be asked of a point of interest as well, to decide whether the
     * prompt should call it a person — see the loop below for why that is now
     * wrong.
     */
    readonly canEngage: (targetId: string) => boolean;
    /**
     * Is a running quest waiting for the player at this target right now?
     *
     * Asked only about a landmark whose claim was refused. Such a landmark has no
     * card, so the prompt is offered for it only while there is something else
     * to do there — a quest it gives (`canEngage`), or the `visit` step the
     * player is on. Optional, and absent reads as "no": a caller that never
     * learned about quests offers nothing it cannot open.
     */
    readonly awaits?: (targetId: string) => boolean;
    /**
     * Is there still something to do at this target, whatever this sitting has
     * engaged?
     *
     * `done` is "engaged in this sitting", and that is not the same as finished.
     * A giver who has just handed over a task, or a landmark a running quest is
     * waiting for, was drawn as "Done. See this one again" the moment it was
     * engaged — which read as the task being complete (ADR-0039). Such a target
     * keeps its own prompt. Optional, and absent reads as "nothing left", which
     * is what `done` meant before.
     */
    readonly stillToDo?: (targetId: string) => boolean;
  },
): Readonly<Record<string, LevelTarget>> {
  if (level === null) return {};

  const targets: Record<string, LevelTarget> = {};

  const offer = (rawId: string, kind: InteractKind, offersQuest = false): void => {
    const bare = bareTargetId(rawId);
    const prompt = interactPrompt(locale, {
      id: bare,
      kind,
      done: state.done.has(bare) && !(state.stillToDo?.(bare) ?? false),
      offersQuest,
    });
    /* No row, no offer. The alternative is a button whose label this file would
       have had to make up, which is the whole of `TN-REACH`'s defect. */
    if (prompt === null) return;
    const target: LevelTarget = { prompt };
    targets[bare] = target;
    targets[`${kind}.${bare}`] = target;
  };

  /*
   * A character is offered only while there is something for them to say. A
   * point of interest is offered when it has a card, and — when its claim was
   * refused and it has none — only while it has a quest to give or a step
   * waiting for the player (see the loop below).
   */
  for (const character of level.characters) {
    if (state.canEngage(`${character.characterId}`)) offer(`${character.characterId}`, 'npc');
  }

  /*
   * **A point of interest is a place, whether or not it offers a quest.**
   *
   * This line used to read `state.canEngage(poi.id) ? 'npc' : 'poi'`, on the
   * reasoning that "a character who stands on a point of interest is a person:
   * being spoken to is the more specific thing choosing them does". Two things
   * killed that reasoning on the same day.
   *
   * It is now **unreachable as written**: ADR-0029 §2 resolves a giver to
   * *exactly one* placement, so an id in both `characters[]` and `pois[]` is an
   * ambiguous giver and is refused in both directions. The character-standing-on-
   * a-POI case can no longer be a giver at all, so `canEngage` can no longer be
   * true for that reason.
   *
   * And it is now **actively wrong**: ADR-0029 made `canEngage` true for a
   * landmark that offers a quest, and with no `hud.interact.<id>` row the kind
   * row is what the HUD draws — so Peggy's Point Lighthouse would have offered
   * a button reading *"Talk to this person"*, announced in exactly those words
   * to a screen-reader user, on one of the two levels whose art documents forbid
   * a figure of any kind at any scale precisely so that nobody is read as being
   * there. That is `assets/style/peggys-cove-level.md` §0's failure arriving
   * through the HUD instead of through the picture, which is the same route
   * ADR-0029 §5 refuses for the prose.
   *
   * **This is half the answer, and the other half is not this layer's.**
   * `docs/stories/TN-REACH-what-is-in-reach.md`, amended the same day, asks for
   * a third generic row — `hud.interact.poi.offer`, "See what there is to do
   * here" — because a landmark that opens a *dialogue* is under-promised by
   * "Look at this place". That row and the precedence case that picks it live in
   * `app/ui/copy.ts` and `app/ui/interact.ts`; both have landed, and the call
   * below now passes `state.canEngage(poi.id)` as that flag instead of dropping
   * it. What must not come back is the flag deciding the target's **kind**: a
   * place that offers something is still a place, and `targets` is keyed by
   * kind, so `npc.<id>` would also stop matching the `poi.<id>` the scene sends.
   * `interactPrompt` guards that itself now — the flag is ignored unless the
   * kind is already `poi` — so this call cannot reintroduce it, and the guard
   * lives there rather than here because here is where it went wrong.
   */
  for (const poi of level.pois) {
    const offersQuest = state.canEngage(poi.id);
    /*
     * **Refusing a claim withholds the claim, not the landmark** — and not the
     * invitation either, while there is still something to do there.
     *
     * A landmark whose blurb a verifier declined has no card. It is offered only
     * when it gives a quest or a running quest is waiting for the player at it,
     * and then as "See what there is to do here", because "Look at this place"
     * would promise the card it no longer has. A refused landmark with neither
     * is scenery and gets no prompt at all: the game does not offer a tap it
     * cannot honour.
     */
    if (poi.blurb === null) {
      const awaited = state.awaits?.(poi.id) ?? false;
      if (!offersQuest && !awaited) continue;
      offer(poi.id, 'poi', true);
      continue;
    }
    offer(poi.id, 'poi', offersQuest);
  }

  return targets;
}
