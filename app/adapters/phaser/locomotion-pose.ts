/**
 * How the way a level moves reaches the character rig.
 *
 * ## The defect
 *
 * The HUD said "Skating" and the character walked. It said "Sledding" and the
 * character walked. It said "Biking" and the character walked. Not because the
 * pose was wrong — because **nothing ever told the rig which mode the level
 * declared**. `LocomotionStep` gives the scene `animationSpeed`, `grounded`,
 * `moving` and a vertical speed, and those reach the rig every frame; the mode
 * itself reached nothing. Eight level documents declare eight ways of getting
 * about and every one of them drew the same cycle.
 *
 * ## `locomotion[].animation` was not the mechanism, and could not have been
 *
 * `level.schema.json#/$defs/locomotionAnimationBinding` looks like the place
 * this belongs, and it is not. It binds **input names** — `speedInput`,
 * `airborneInput`, `jumpTrigger`, `landTrigger`, `brakeTrigger` — and an input
 * name cannot say what a skater looks like. Read the eight shipped documents and
 * the point makes itself: every binding is the same five names, except that the
 * two modes with no jump omit three of them. A field whose value is identical
 * across every level that differs cannot be what makes them differ.
 *
 * It is also two-fifths dead. `airborne` and `brake` are not in the rig's
 * `stateMachine.inputs` — the rig declares `grounded`, not its negation, and has
 * no brake at all — so `character-cast.ts#unboundAnimationInputs` reports them
 * at every level open and the scene drives only what the rig declares. Nothing
 * else reads the binding. It is a feature declared in content and implemented
 * nowhere, and this module does not revive it: the mode's *name* is what reaches
 * the rig, because the mode's name is the only thing in the document that
 * actually varies with how the player is drawn.
 *
 * ## The mechanism, in the rig's own existing vocabulary
 *
 * ADR-0017 gives the rig the vocabulary and ADR-0022 makes it content the
 * adapter is handed. So the mode is resolved against `RigDocument` as it already
 * is — no new port field, no new slot, no schema change:
 *
 *  1. **Poses are a namespace over the states that already exist.** The selector
 *     is untouched: it still picks `idle`, `walk`, `run`, `jump-rise`,
 *     `jump-fall`, `land`, `talk` or `interact` from the same prose rules, in
 *     the same order, with the same conditions in
 *     `sprite-character-renderer.ts`. What the mode changes is *which timeline
 *     that name plays*: `<mode>{@link MODE_STATE_SEPARATOR}<state>` when the rig
 *     declares one, the bare state when it does not. A mode that shares the
 *     talking pose simply does not declare one, and gets it.
 *
 *     Doing it this way rather than adding selector rules is the difference
 *     between data and code: a rule naming a state the sprite backend has no
 *     condition for is **refused at construction**
 *     (`character.rig.unknownState`), so eight modes as eight rules would be
 *     eight conditions in an adapter — which is precisely the `if (mode ===
 *     …)` that ADR-0023 and `level-is-data-only.test.ts` exist to make
 *     impossible.
 *
 *  2. **Equipment is a `{`{@link MODE_TEMPLATE_KEY}`}` brace on a part.** The
 *     puppet already resolves `{slot}` and `{expression}` braces against the
 *     character's choices and draws nothing for a part whose resolved frame is
 *     absent — that is how every "none" option in the rig works. The mode is
 *     bound as one more brace, so skates are a part whose template names it, and
 *     a mode with no equipment authors no frame and draws no equipment. No
 *     special case, in either backend.
 *
 * Neither is a slot, and that matters for `docs/content-review.md` §8.2: slot
 * independence is a rule about what a *player chooses*, and the mode is not
 * chosen — it is where they are. The product rule counts slots, and a
 * `{mode}` brace adds no coupling between two of them.
 *
 * ## A fallback that cannot be observed becomes permanent
 *
 * The whole defect, restated: a mode with no art drew a walking figure and
 * nothing anywhere said so. So {@link modeArtGaps} answers *which declared modes
 * the rig cannot draw*, the scene prints one line per gap in **every** build —
 * the same treatment `character-cast.ts` gives a missing character part — and
 * the count is published on the probe as `data-mode-gaps`. A level whose art has
 * landed reads 0. That number is what makes "the HUD says Skating and the
 * character walks" a fact a test can fail on instead of a thing somebody has to
 * notice.
 *
 * Pure: rig in, answers out. No Phaser, no DOM, no clock, and — as
 * `level-is-data-only.test.ts` requires of everything in this directory — not
 * one mode's name.
 */

import type { RigDocument } from '@application/ports';

/**
 * What separates a mode from the state it re-poses: `<mode>/<state>`.
 *
 * A slash rather than the hyphen the rig uses inside a state name, because
 * `jump-rise` already has one and `x-jump-rise` would be two readings of the
 * same string. This one cannot be misread, and it says "namespace" to anyone
 * opening the file.
 */
export const MODE_STATE_SEPARATOR = '/';

/**
 * The brace a part template uses to ask for the mode's equipment.
 *
 * Not a slot name, deliberately — see the header. It joins `expression` as the
 * second brace that names something the character does not choose.
 */
export const MODE_TEMPLATE_KEY = 'mode';

/** `<mode>/<state>`, the key a mode's re-pose of one state is declared under. */
export function posePath(mode: string, state: string): string {
  return `${mode}${MODE_STATE_SEPARATOR}${state}`;
}

/**
 * The timeline to play for one selected state, in one mode.
 *
 * The mode's own if the rig declares it, else the state as the rig ships it.
 * That fallback is what {@link modeArtGaps} exists to stop being silent.
 */
export function poseFor(
  rig: RigDocument | null | undefined,
  mode: string | null | undefined,
  state: string,
): string {
  if (rig === null || rig === undefined) return state;
  if (mode === null || mode === undefined || mode.length === 0) return state;
  const path = posePath(mode, state);
  return rig.states[path] === undefined ? state : path;
}

/** The `{brace}` names in a frame template, in order. */
export function braceNames(template: string): readonly string[] {
  return [...template.matchAll(/\{([a-zA-Z]+)\}/gu)].map(([, name]) => name ?? '');
}

/** Parts whose frame template asks for the mode. Empty until art authors one. */
export function modeTemplatedParts(rig: RigDocument): readonly RigDocument['parts'][number][] {
  return rig.parts.filter((part) => braceNames(part.frame).includes(MODE_TEMPLATE_KEY));
}

/** What the rig can draw for one mode. */
export interface ModeArt {
  readonly mode: string;
  /** Base states this mode re-poses, e.g. the moving cycle and the idle. */
  readonly poses: readonly string[];
  /** Frame keys the mode's equipment parts resolve to and the atlas carries. */
  readonly equipment: readonly string[];
  /**
   * Does the rig already ship a cycle **named** for this mode?
   *
   * The one case where a mode needs no namespace and no equipment: the rig's
   * base states are drawn as somebody getting about on their own two feet, and
   * one of those states carries that mode's name. So a mode the rig names among
   * its own states is drawn by it, which is both true and the reason the mode
   * every level falls back to is not reported as a gap.
   */
  readonly base: boolean;
  /** Can the rig draw this mode at all? `false` is the gap. */
  readonly covered: boolean;
}

/**
 * What the rig has for one mode, against the atlas that was actually loaded.
 *
 * `packed` is asked as well as `rig.frames`, because a rig that declares skates
 * whose page was never packed is the same experience as a rig with no skates in
 * it — the part is skipped and the figure walks. `character-cast.ts` learned
 * that one the expensive way; this asks the same question before, rather than
 * discovering it after.
 */
export function modeArt(
  rig: RigDocument,
  mode: string,
  packed: (frame: string) => boolean = () => true,
): ModeArt {
  const prefix = `${mode}${MODE_STATE_SEPARATOR}`;
  const poses = Object.keys(rig.states)
    .filter((state) => state.startsWith(prefix))
    .map((state) => state.slice(prefix.length));

  const equipment: string[] = [];
  for (const part of modeTemplatedParts(rig)) {
    const resolved = part.frame.replaceAll(`{${MODE_TEMPLATE_KEY}}`, mode);
    if (braceNames(resolved).length > 0) continue;
    const frame = `${rig.atlas.framePrefix}${resolved}`;
    if (rig.frames[frame] !== undefined && packed(frame)) equipment.push(frame);
  }

  const base = rig.states[mode] !== undefined;
  return { mode, poses, equipment, base, covered: base || poses.length > 0 || equipment.length > 0 };
}

/**
 * Mode poses that name a state the rig has none of, e.g. `<mode>/glide` where
 * the selector never selects `glide`.
 *
 * The same defect as `character-cast.ts#unboundAnimationInputs`, pointed the
 * other way: art has drawn a timeline, the selector has no name for it, and the
 * only symptom is a pose nobody ever sees. Reported at level open rather than
 * discovered, because a `once` state that is never entered looks exactly like a
 * state that is entered and looks the same as the one before it.
 */
export function strandedPoses(rig: RigDocument | null | undefined): readonly string[] {
  if (rig === null || rig === undefined) return [];
  const declared = Object.keys(rig.states);
  const base = new Set(declared.filter((state) => !state.includes(MODE_STATE_SEPARATOR)));
  return declared.filter((state) => {
    const cut = state.indexOf(MODE_STATE_SEPARATOR);
    return cut !== -1 && !base.has(state.slice(cut + MODE_STATE_SEPARATOR.length));
  });
}

/** One mode a level declares that the rig cannot draw. */
export interface ModeArtGap {
  readonly mode: string;
  /**
   * Is this the mode the level opens in?
   *
   * Both are reported, because eight documents declare a second mode after the
   * first and a gap found only when somebody switches is a gap found by a
   * player. Only the first is on screen today, and the sentence says which.
   */
  readonly inForce: boolean;
}

/**
 * Every declared mode the rig has no art for, in the order the level declares
 * them. The first entry of `modes` is the mode the level opens in.
 */
export function modeArtGaps(
  rig: RigDocument | null | undefined,
  modes: readonly string[],
  packed: (frame: string) => boolean = () => true,
): readonly ModeArtGap[] {
  if (rig === null || rig === undefined) return [];
  const seen = new Set<string>();
  const gaps: ModeArtGap[] = [];
  for (const [index, mode] of modes.entries()) {
    if (seen.has(mode)) continue;
    seen.add(mode);
    if (modeArt(rig, mode, packed).covered) continue;
    gaps.push({ mode, inForce: index === 0 });
  }
  return gaps;
}

/**
 * What to print when a level declares a way of moving the rig cannot draw.
 *
 * Names the mode, says what will be on screen instead, and says exactly what
 * would close it — the shape `castGapMessage` established, for the same reason:
 * "the animation is wrong" is not actionable and "this rig declares no state
 * named `skate/walk` and no part template resolving equipment for `skate`" is.
 */
export function modeArtGapMessage(gap: ModeArtGap): string {
  const path = posePath(gap.mode, '<state>');
  return (
    `this level moves by "${gap.mode}" and the rig cannot draw it: no state is namespaced ` +
    `"${posePath(gap.mode, '')}", no part template resolves equipment for it, and the rig ships ` +
    `no state of that name. ` +
    (gap.inForce
      ? `It is the mode the level opens in, so the character on screen is posed as the rig's ` +
        `own base cycle while the HUD names this mode. That is a placeholder, not a pose.`
      : `The level declares it after the mode it opens in, so nothing is wrong on screen yet — ` +
        `it would be the moment anything switched to it.`) +
    ` To close it, the rig (ADR-0017 owns the vocabulary) declares states named "${path}" for the ` +
    `states this mode re-poses, and/or a part whose frame template names {${MODE_TEMPLATE_KEY}} ` +
    `with a frame for this mode. Counted as data-mode-gaps; a level whose art has landed reads 0.`
  );
}
