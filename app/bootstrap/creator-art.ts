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

/** A renderer that can draw the picture: the shape of `createCharacterPreview`. */
export type CreatorArtBackend = (
  host: HTMLElement,
  request: CreatorArtRequest,
  deps: { readonly rig: RigDocument },
) => CreatorArt;

/** The factory the shell hands both of the creator's errands. */
export function creatorArt(backend: CreatorArtBackend, rig: RigDocument = RIG): CreatorArtFactory {
  return (host, request) => backend(host, request, { rig });
}
