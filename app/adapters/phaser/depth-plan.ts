/**
 * Where everything in a level draws, front to back.
 *
 * ## The defect
 *
 * On Toronto the player on the bicycle drew scrambled: the torso came off the
 * hips, both mitts sat in front of the coat hem, somebody else's hair showed
 * under the red toque, and a green shape lay across the face. The rig was not at
 * fault — `bike/*` renders correctly offline — and nor was the pose arithmetic:
 * read back from the running scene, every part carried exactly the angle and
 * position its keyframe asks for. The **order** was wrong.
 *
 * A character's parts draw at `baseDepth + z` (`sprite-character-renderer.ts`).
 * The scene gave every non-player character `500` and the player `501`, so with
 * the rig's `z` running 1..27 the two occupied 501..527 and 502..528 — the same
 * depths, one apart. Phaser sorts by depth, so wherever the player stood on a
 * character the two puppets were shuffled together: the guide's head-shell at
 * 519 over the player's head at 518, the guide's near arm at 524 over the
 * player's toque at 522. ADR-0032 stops every drive level with the thing it
 * engages, which made standing on a character the normal way to meet one — on
 * every level with a character in it, whatever the mode.
 *
 * ## The plan
 *
 * Each character gets a **slot** of `span + 3` depths, where `span` is the rig's
 * `z` range: one empty depth under its first part, its parts, one empty depth
 * over its last. Non-player characters take slots in the order the level lists
 * them, and the player takes the slot above all of them, so the player is in
 * front of anybody they stand on. The player's two empty depths are where a ride
 * goes (ADR-0031): its `behind` art under the rider's first part and its `front`
 * art over the last — which also puts the whole ride in front of every other
 * character, as a ride running on a nearer line must be.
 *
 * Everything else keeps the band it always had. The marks and the weather sit
 * above the last slot rather than at fixed numbers, because a fixed number is a
 * ceiling a level with enough characters would pass through.
 *
 * The slot size is read from the rig, never assumed, so a rig that grows a
 * twenty-eighth part moves every slot up rather than into its neighbour; and the
 * number of slots is read from the level, so a level that places a tenth
 * character is a JSON edit. `tests/unit/adapters/phaser/depth-plan.test.ts`
 * holds the one promise against the real rig and every real level: nothing draws
 * between the first and last part of a character it is not part of.
 *
 * Pure: no Phaser. `level-scene.ts` sets the numbers.
 */

/** The sky gradient, fixed to the screen. */
export const DEPTH_SKY = 0;
/** The first parallax layer; each further layer is one above. */
export const DEPTH_LAYERS = 100;
export const DEPTH_GROUND = 400;
/**
 * The level's ground dressing (ADR-0042): over the ground fill and its sheen,
 * under a ride's track and every actor. Over the sheen because the sheen is a
 * tier-gated wash, and the strip's colours are the art sheet's at every tier;
 * under the track because a train's rails run across the strip, not under it.
 */
export const DEPTH_GROUND_DRESSING = DEPTH_GROUND + 2;
/**
 * A ride's track (ADR-0031): on the ground and under every actor. Not a parallax
 * layer, because layers sit below the ground fill and the tier drops them, and a
 * train whose rails the low tier removed is floating.
 */
export const DEPTH_RIDE_TRACK = DEPTH_GROUND + 3;
/** Where the character slots begin. Landmarks draw one below it. */
export const DEPTH_ACTORS = 500;

/** One character's draw band: its parts draw at `baseDepth + z`. */
export interface CharacterDepthBand {
  readonly baseDepth: number;
}

export interface DepthPlanInput {
  /** Characters the level places, not counting the player. */
  readonly characters: number;
  /** Every part's `z` in the rig, in any order. Empty when there is no rig. */
  readonly partZ: readonly number[];
}

export interface DepthPlan {
  readonly sky: number;
  /** The horizon haze, just under the first parallax layer. */
  readonly haze: number;
  /** The depth of the `index`-th parallax layer, nearest last. */
  layer(index: number): number;
  readonly ground: number;
  /** The surface sheen, just over the ground fill. */
  readonly sheen: number;
  /** The ground dressing strip (ADR-0042), over the sheen and under the ride track. */
  readonly groundDressing: number;
  readonly rideTrack: number;
  /** A landmark's art, or its placeholder: under every character. */
  readonly poi: number;
  /** One band per character the level places, in the order the level lists them. */
  readonly characters: readonly CharacterDepthBand[];
  readonly player: CharacterDepthBand;
  /** A ride's `behind` art: under the rider's first part, over every other character. */
  readonly rideBehind: number;
  /** A ride's `front` art: over the rider's last part. */
  readonly rideFront: number;
  /** The tappable marks, over everything they describe. */
  readonly affordance: number;
  /** The weather, over everything. */
  readonly snow: number;
}

/** The lowest and highest `z` a rig declares, or 0 and 0 for none. */
function zBounds(partZ: readonly number[]): { readonly low: number; readonly high: number } {
  const finite = partZ.filter((z) => Number.isFinite(z));
  if (finite.length === 0) return { low: 0, high: 0 };
  return { low: Math.min(...finite), high: Math.max(...finite) };
}

export function depthPlan(input: DepthPlanInput): DepthPlan {
  const { low, high } = zBounds(input.partZ);
  const span = high - low;
  /* An empty depth under the first part, the parts, an empty depth over the last. */
  const slot = span + 3;
  const characters = Math.max(0, Math.floor(input.characters));
  /* A slot starting at `start` puts its first part at `start + 1`. */
  const bandAt = (start: number): CharacterDepthBand => ({ baseDepth: start + 1 - low });

  const bands: CharacterDepthBand[] = [];
  for (let index = 0; index < characters; index += 1) {
    bands.push(bandAt(DEPTH_ACTORS + index * slot));
  }
  const playerStart = DEPTH_ACTORS + characters * slot;
  const top = playerStart + slot;

  return {
    sky: DEPTH_SKY,
    haze: DEPTH_LAYERS - 1,
    layer: (index) => DEPTH_LAYERS + index,
    ground: DEPTH_GROUND,
    sheen: DEPTH_GROUND + 1,
    groundDressing: DEPTH_GROUND_DRESSING,
    rideTrack: DEPTH_RIDE_TRACK,
    poi: DEPTH_ACTORS - 1,
    characters: bands,
    player: bandAt(playerStart),
    rideBehind: playerStart,
    rideFront: playerStart + span + 2,
    affordance: top,
    snow: top + 1,
  };
}

/** The depths a band's first and last parts draw at. */
export function partDepthRange(
  band: CharacterDepthBand,
  partZ: readonly number[],
): { readonly first: number; readonly last: number } {
  const { low, high } = zBounds(partZ);
  return { first: band.baseDepth + low, last: band.baseDepth + high };
}

/** One character's parts as drawn, by owner, for {@link interleavedDepths}. */
export interface DepthGroup {
  readonly owner: string;
  readonly depths: readonly number[];
}

/**
 * How many drawn things sit strictly between the first and last part of a
 * character they are not part of.
 *
 * 0 on a healthy scene. `groups` are the characters, each its parts' depths as
 * the display list holds them; `loose` is every other drawn thing. A depth equal
 * to a range's end is not counted: a stable sort draws a tie in the order the
 * objects were added, which the scene controls, and the plan leaves no ties
 * anyway. The scene publishes this as `data-parts-interleaved`, read off the
 * real display list rather than restated from the plan, so a depth set anywhere
 * else in the scene is caught too.
 */
export function interleavedDepths(groups: readonly DepthGroup[], loose: readonly number[]): number {
  let count = 0;
  for (const group of groups) {
    if (group.depths.length === 0) continue;
    const first = Math.min(...group.depths);
    const last = Math.max(...group.depths);
    const inside = (depth: number): boolean => depth > first && depth < last;
    for (const other of groups) {
      if (other === group) continue;
      count += other.depths.filter(inside).length;
    }
    count += loose.filter(inside).length;
  }
  return count;
}
