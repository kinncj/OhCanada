/**
 * Who is in this level, and what to say when one of them cannot be drawn.
 *
 * ## The defect this closes
 *
 * The player was a rounded rectangle in production. Not because the renderer was
 * missing — `sprite-character-renderer.ts` composes twenty parts and the perf
 * suite measures it — but because **nothing ever asked it to draw the player**.
 * `LevelScene#paintPlayer` called `fillRoundedRect` unconditionally; the rig
 * path existed only for the characters a level *places*, and the player is not
 * one of those: they are not in `level.characters`, so they were not in
 * `data-actors` either, and the counter that was added to stop exactly this
 * could not see the one character on screen at the spawn.
 *
 * ## Naming the player without naming content
 *
 * `level-is-data-only.test.ts` forbids this directory from containing a level's
 * vocabulary, and a hard-coded character id would be exactly that. It is also
 * unnecessary, because the rig already draws the distinction: `RigArtboard`
 * carries `playerSelectableSlots`, documented as *"slots the creator offers for
 * this artboard. Empty is a real answer, and is what an NPC has."*
 *
 * So **the player's artboard is the one the character creator can dress**. That
 * is a fact about the rig, it is checked against the shipped document by
 * `tests/unit/adapters/phaser/character-cast.test.ts`, and adding a second
 * playable character is a rig edit rather than an engine one.
 *
 * ## A silent fallback is itself a defect
 *
 * Every function here that cannot answer returns `null` **and the caller reports
 * it** — see {@link castGapMessage} and `LevelScene#reportCastGap`. A missing
 * part used to be four silent `return null`s ending in a rectangle, which is how
 * a placeholder ships twice: once because the art is late, and once because
 * nothing could tell the difference afterwards.
 *
 * Pure. No Phaser: the texture manager arrives as a list of keys and a
 * predicate, which is what lets the atlas rule be tested without a browser.
 */

import type { RigArtboard, RigDocument } from '@application/ports';

/** Every reason a character can fail to compose. Exhaustive on purpose. */
export const CAST_GAPS = ['no-rig', 'no-artboard', 'no-atlas', 'no-parts'] as const;

export type CastGap = (typeof CAST_GAPS)[number];

/**
 * The artboard the character creator dresses.
 *
 * The first one offering a choice. More than one would mean the rig has more
 * than one playable character, which is a decision with a document behind it;
 * until there is, the first is the only.
 */
export function playerArtboard(rig: RigDocument | null | undefined): RigArtboard | null {
  if (rig === null || rig === undefined) return null;
  return rig.artboards.find((candidate) => candidate.playerSelectableSlots.length > 0) ?? null;
}

/** The artboard a level's placement names. */
export function artboardFor(
  rig: RigDocument | null | undefined,
  characterId: string,
): RigArtboard | null {
  if (rig === null || rig === undefined) return null;
  return rig.artboards.find((candidate) => String(candidate.characterId) === characterId) ?? null;
}

/**
 * Which loaded texture the rig's frames were packed into.
 *
 * Derived rather than named: the packer decides the atlas key, and this file may
 * not know a level's or a rig's vocabulary. The first loaded texture that
 * carries **any** frame the rig declares is the one.
 *
 * "Any", and that word is the fix. The version this replaces asked about
 * `Object.keys(rig.frames)[0]` and nothing else, so a rig whose first frame was
 * an option still in flight — one hair colour — answered "there is no atlas" for
 * every character in the game, and every one of them fell back to a rectangle.
 * One unpacked frame could turn off the whole cast, silently.
 */
export function rigAtlasKey(
  rig: RigDocument | null | undefined,
  textureKeys: readonly string[],
  hasFrame: (textureKey: string, frame: string) => boolean,
): string | null {
  if (rig === null || rig === undefined) return null;
  const frames = Object.keys(rig.frames);
  if (frames.length === 0) return null;

  for (const key of textureKeys) {
    for (const frame of frames) {
      if (hasFrame(key, frame)) return key;
    }
  }
  return null;
}

/**
 * What to print when a character cannot be composed.
 *
 * One sentence per gap, each naming the subject and the missing thing, because
 * "a character did not draw" is not actionable and "the atlas carrying the rig's
 * frames was not loaded for this level" is. These reach the console in every
 * build, not only in development: the case that matters is the deployed one,
 * which is where every previous instance of this defect lived.
 */
export function castGapMessage(subject: string, gap: CastGap): string {
  switch (gap) {
    case 'no-rig':
      return (
        `"${subject}" is drawn as a placeholder because no character rig was loaded. The rig ` +
        `is fetched once per session by the renderer; a failure to load it is logged above this.`
      );
    case 'no-artboard':
      return (
        `"${subject}" is drawn as a placeholder because the rig declares no artboard for it. ` +
        `Either the level places a character the rig has never heard of, or the rig offers no ` +
        `artboard with player-selectable slots for the player to wear.`
      );
    case 'no-atlas':
      return (
        `"${subject}" is drawn as a placeholder because no loaded texture carries any frame ` +
        `the rig declares. The character atlas is not in this level's asset list, or it was ` +
        `not packed.`
      );
    case 'no-parts':
      return (
        `"${subject}" is drawn as a placeholder because the atlas loaded but not one of the ` +
        `rig's parts resolved to a frame in it. That is a half-packed atlas: the renderer ` +
        `would have reported itself built and drawn nothing at all.`
      );
  }
}

/* -------------------------------------------------- driving the character --- */

/**
 * The rig inputs a level scene can actually compute, and their types.
 *
 * These names are the **rig's** vocabulary, not a level's, which is why they may
 * live here: ADR-0017 gives the rig ownership of the vocabulary, and
 * `sprite-character-renderer.ts` already transcribes the meaning of every state
 * that reads them ("the rules' order and membership are data; what each named
 * state means is code"). A level cannot invent a new one, and this table cannot
 * grow without somebody deciding what the scene would compute for it.
 *
 * `verticalSpeed` is positive **upwards**, because the rig's `jump-rise` rule
 * reads `verticalSpeed > 0` while screen y grows downwards. Getting that sign
 * wrong swaps the rise and fall poses, which looks like an animation bug and is
 * an arithmetic one.
 */
export const DRIVEN_INPUTS: Readonly<Record<string, 'bool' | 'number'>> = {
  grounded: 'bool',
  moving: 'bool',
  talking: 'bool',
  reducedMotion: 'bool',
  speed: 'number',
  verticalSpeed: 'number',
};

/** Which of {@link DRIVEN_INPUTS} this rig actually declares, split by type. */
export function drivableInputs(rig: RigDocument | null | undefined): {
  readonly bools: readonly string[];
  readonly numbers: readonly string[];
} {
  const bools: string[] = [];
  const numbers: string[] = [];
  for (const input of rig?.stateMachine.inputs ?? []) {
    const wanted = DRIVEN_INPUTS[input.name];
    if (wanted === undefined || wanted !== input.type) continue;
    if (input.type === 'bool') bools.push(input.name);
    else numbers.push(input.name);
  }
  return { bools, numbers };
}

/**
 * Names a level's `locomotion[].animation` binding gives that the rig has never
 * declared.
 *
 * **This is a real boundary defect and it is reported rather than worked
 * around.** `level.schema.json` lets a level name the rig inputs its mode
 * drives — `speedInput`, `airborneInput`, `jumpTrigger`, `landTrigger`,
 * `brakeTrigger` — and nothing checks those names against
 * `content/characters/rig.json`. ADR-0017 §1 says the rig owns the vocabulary
 * and a character selects from it; the level document is a third party selecting
 * from a vocabulary nobody joins it to.
 *
 * A binding entry with no rig input behind it is a state the character can never
 * enter, and it fails **silently**: the renderer would return
 * `character.input.unknown` from a setter whose `Result` a per-frame caller
 * cannot usefully read. So the scene calls this once at create, logs what does
 * not join, and then drives only what the rig declares.
 *
 * The durable fix is a content-side gate — the same shape as
 * `locomotion-tuning-is-coherent.test.ts` — asserting every animation binding
 * name against the rig's `stateMachine.inputs`. That is not this directory's to
 * write.
 */
export function unboundAnimationInputs(
  rig: RigDocument | null | undefined,
  named: readonly string[],
): readonly string[] {
  if (rig === null || rig === undefined) return [];
  const declared = new Set(rig.stateMachine.inputs.map((input) => input.name));
  return [...new Set(named)].filter((name) => !declared.has(name));
}
