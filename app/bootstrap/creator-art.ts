/**
 * The character creator's picture, wired (ADR-0040).
 *
 * `app/ui/character-creator.ts` owns a host element and the `CreatorArtFactory`
 * shape, and knows nothing about what draws. `app/adapters/phaser/character-preview.ts`
 * paints the level's sprite puppet into a canvas, and knows nothing about the
 * creator. This is the join, and the one place that decides the picture is drawn
 * by the sprite backend: the decision `level-scene.ts` makes for the level, for
 * the same reason — the sprite path is the one that ships.
 *
 * The rig is handed to the adapter rather than opened by it (ADR-0022), and it
 * is the same `content/characters/rig.json` that `character-slots.ts` builds the
 * creator's groups from, so the options and the picture cannot be describing two
 * different documents.
 */

import rigJson from '@content/characters/rig.json';

import type { RigDocument } from '@application/ports';
import type { CreatorArt, CreatorArtFactory, CreatorArtRequest } from '@ui/character-creator';

const RIG = rigJson as unknown as RigDocument;

/**
 * What the creator's picture dresses the player in: the jacket.
 *
 * `costume` is not player-selectable. A level puts it on the player for its
 * season (`playerCostume`), and the creator is not a level, so this is the one
 * place that decides what the picture wears. The jacket, because it is what the
 * player wears most: eight levels of ten put it on, Halifax among them, where
 * the journey starts, and only Ottawa and Québec City put on the parka. It also
 * leaves the hands bare, in the skin tone the player is choosing.
 *
 * Two other answers were weighed. A costume toggle beside the picture would be
 * a control for a choice the rig says no player makes, and would add a stop to
 * every keyboard and switch walk through the screen. The parka with a "winter
 * look" label would need a new sentence and would still show the costume of
 * two levels in ten. `tests/unit/bootstrap/creator-art.test.ts` holds this to
 * the level documents, so it fails if most levels stop wearing it.
 */
export const CREATOR_COSTUME = 'jacket';

/** A renderer that can draw the picture: the shape of `createCharacterPreview`. */
export type CreatorArtBackend = (
  host: HTMLElement,
  request: CreatorArtRequest,
  deps: { readonly rig: RigDocument; readonly costume: string },
) => CreatorArt;

/** The factory the shell hands both of the creator's errands. */
export function creatorArt(
  backend: CreatorArtBackend,
  rig: RigDocument = RIG,
  costume: string = CREATOR_COSTUME,
): CreatorArtFactory {
  return (host, request) => backend(host, request, { rig, costume });
}
