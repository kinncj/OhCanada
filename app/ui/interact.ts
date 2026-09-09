/**
 * What the interact prompt says — the one rule, written once.
 *
 * `docs/stories/TN-REACH-what-is-in-reach.md` is the acceptance criteria, and
 * the defect it exists to make impossible is worth restating here because it is
 * the reason this file is a module rather than three lines at a call site:
 *
 * > A player riding through Toronto comes within reach of the level's one point
 * > of interest, and the HUD's button reads **"CN Tower"**.
 *
 * Two things were wrong with that. It said **what is there** rather than what
 * choosing it will do, so a screen-reader user was read a noun with no verb. And
 * it put a trade name inside `hud`, which `TN-NAMES-04` fails the build for —
 * except that the name was never a copy string. It was the level document's own
 * `pois[].name`, interpolated at runtime by the composition root, which is
 * precisely how it walked past a check written against copy tables.
 *
 * So the prompt is resolved **only** from the copy table, and this function is
 * the only way to resolve one. A target this build has no row for offers no
 * prompt at all: `null`, never "Interact", never "Engage", never a name, never
 * an empty string. That is the same rule `TN-WAIT` applies to a level with no
 * waiting sentence, for the same reason — a screen that has to invent a word
 * ends up inventing the wrong one.
 *
 * ## The order, and why "done" wins
 *
 *  1. **The target has been engaged already** → `hud.interact.done`, whatever
 *     kind it is and whatever row its level wrote. The state is the news; the
 *     invitation is not, and a player told "Talk to the officer" about somebody
 *     they have finished with walks back for nothing.
 *  2. **The level wrote a row for this target** → `hud.interact.<id>`, keyed on
 *     the id the level document gives it. Ottawa writes two.
 *  3. **Otherwise, by kind** → `hud.interact.npc` for a person,
 *     `hud.interact.poi` for a place.
 *
 * DOM only, and in fact no DOM at all: every function here is pure, so the rule
 * is assertable without a browser and the HUD cannot hold a second copy of it.
 */

import { hasCopyRow, text, type UiLocale } from './copy';

/** A person or a place. The two kinds a level's document can put in reach. */
export type InteractKind = 'poi' | 'npc';

/**
 * One thing in reach.
 *
 * `id` is the level document's own id — `officer`, `parliament-hill`,
 * `cn-tower` — because that is what the scene sends with `poi/entered` and what
 * a per-target row is keyed on. See {@link bareTargetId} for the prefixed spelling
 * the same id also arrives in.
 */
export interface ReachableTarget {
  readonly id: string;
  readonly kind: InteractKind;
  /** Engaged already in this sitting. `TN-REACH-03`: this beats everything. */
  readonly done?: boolean;
}

/**
 * The id, without the `poi.`/`npc.` prefix an event detail may carry.
 *
 * The stories write a detail two ways — `TN-QUEST-01` emits `poi/entered` for
 * `npc.officer`, and the level document calls the same character `officer` —
 * and a copy row is keyed on the document's id. Rather than pick a winner and
 * make the other spelling silently offer nothing, the prefix is stripped here
 * and the composition root registers both spellings. A detail with no prefix is
 * returned unchanged, which is the normal case.
 *
 * The *kind* is deliberately not read back out of a prefix. What a target is —
 * a person or a place — is the level document's answer, and taking it from an
 * event name instead would let a scene decide that a landmark is a character.
 */
export function bareTargetId(detail: string): string {
  const dot = detail.indexOf('.');
  if (dot === -1) return detail;
  const head = detail.slice(0, dot);
  return head === 'poi' || head === 'npc' ? detail.slice(dot + 1) : detail;
}

/**
 * What the prompt for this target says, or `null` when this build has no row.
 *
 * `null` is a state and not a failure: `TN-REACH-05` requires a target with no
 * row to offer **no prompt**, so the HUD draws nothing rather than something it
 * had to make up.
 */
export function interactPrompt(locale: UiLocale, target: ReachableTarget): string | null {
  if (target.done === true) return text(locale, 'hud.interact.done');

  const own = `hud.interact.${bareTargetId(target.id)}`;
  if (hasCopyRow(own)) return text(locale, own);

  const generic = `hud.interact.${target.kind}`;
  return hasCopyRow(generic) ? text(locale, generic) : null;
}

/**
 * The one-time explanation of the marks in the world.
 *
 * It names no input — not "tap", not a key, not "hold" — because this game is
 * playable with a thumb, a keyboard and one switch, and a hint that names one of
 * them is wrong for the other three. "Choose it" is the word the single-switch
 * contract already uses.
 */
export function interactHint(locale: UiLocale): string {
  return text(locale, 'hud.interact.hint');
}
