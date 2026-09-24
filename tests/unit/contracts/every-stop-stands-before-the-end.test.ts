/**
 * Every stop and every character stands before the level's end line.
 *
 * The owner's playtest of 2026-09-24: "Dow's Lake reaches the end of the map
 * before the actual last POI." Ottawa's end line — `watchExit`'s, half a view
 * back from the right bound (`app/adapters/phaser/level-exit.ts`) — sat at
 * x 8,460 and Dow's Lake stood at x 8,700, so a player walking to the last stop
 * crossed the end first and met a card about the end of the level on the way to
 * a landmark they had not reached.
 *
 * `level-exit.ts` keeps the line where it is for a reason it states: at that
 * point the camera has settled on its right-hand clamp and the player is still
 * walking freely. So the fix is the level's geometry, not the line, and this
 * file is the claim every level document has to satisfy for that to hold — a
 * claim of one document against the engine's own arithmetic, over every file in
 * `content/levels`, so a level added tomorrow is checked the day it lands.
 *
 * ## What "before the end" means
 *
 * A stop is engaged from its `position.x`, within the **larger** of its own
 * `radiusPx` and the widest `interaction.reachPx` any of the level's modes
 * declares (`interaction-affordance.ts`: "reach is measured exactly as the
 * engage rule measures it"). A character is engaged the same way, from its
 * position, within that reach. The right edge of that engage zone must lie
 * strictly before the end line, so a player can come into reach of the last
 * thing the level places, and engage it, without having arrived at the end.
 *
 * The line is computed exactly as `LevelScene` computes it: the bounds from
 * `levelBounds` (and `backingBounds` for the spawn mode's ride), the spawn from
 * the document, and a view of `designWidth / camera.zoom`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { backingBounds } from '@adapters/phaser/backing';
import { levelBounds } from '@adapters/phaser/ground-profile';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { watchExit } from '@adapters/phaser/level-exit';
import { rideFor } from '@adapters/phaser/ride';

import gameConfigJson from '@content/game.config.json';

const CONFIG = gameConfigJson as {
  readonly locomotionModes: readonly string[];
  readonly designWidth: number;
};

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const LEVELS: readonly SceneLevel[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const parsed = parseLevelDocument(
      JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')),
      CONFIG.locomotionModes,
    );
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error.message}`);
    return parsed.value;
  });

/** The end line, exactly as `LevelScene`'s constructor builds it. */
function endLineOf(level: SceneLevel): number {
  const spawnMode = level.locomotion[0];
  if (spawnMode === undefined) throw new Error(`${level.id} declares no locomotion`);
  return watchExit({
    bounds: backingBounds(
      levelBounds(level.ground, level.size),
      rideFor(level.rides, spawnMode.mode),
    ),
    spawnX: level.spawn.x,
    viewWidth: CONFIG.designWidth / level.camera.zoom,
  }).x;
}

/** The widest engage reach any of the level's modes offers. Zero when none engages. */
const widestReach = (level: SceneLevel): number =>
  Math.max(0, ...level.locomotion.map((mode) => mode.interaction?.reachPx ?? 0));

interface Placed {
  readonly what: string;
  readonly x: number;
  /** The right edge of where it can be engaged from. */
  readonly edge: number;
}

function placedIn(level: SceneLevel): readonly Placed[] {
  const reach = widestReach(level);
  return [
    ...level.pois.map((poi) => ({
      what: `point of interest "${String(poi.id)}"`,
      x: poi.position.x,
      edge: poi.position.x + Math.max(poi.radiusPx, reach),
    })),
    ...level.characters.map((character) => ({
      what: `character "${String(character.characterId)}"`,
      x: character.position.x,
      edge: character.position.x + reach,
    })),
  ];
}

describe('every stop and every character stands before the end of its level', () => {
  it('reads every level document', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))(
    '%s engages its last stop before its end line',
    (_id, level) => {
      const line = endLineOf(level);
      const past = placedIn(level)
        .filter((placed) => !(placed.edge < line))
        .map(
          (placed) =>
            `${placed.what} at x ${String(placed.x)} is engaged up to x ${String(placed.edge)}, ` +
            `${String(Math.ceil(placed.edge - line))} px at or past the end line at x ` +
            `${String(Math.round(line))}`,
        );

      expect(
        past,
        `${String(level.id)}: a player walking to the last thing this level places crosses the ` +
          'end of the level first. Move the end, not the line: extend `size.x` and the ground ' +
          'polyline so the line (`size.x` minus half a view) falls past the last engage zone ' +
          '(`app/adapters/phaser/level-exit.ts`, ADR-0074).',
      ).toEqual([]);
    },
  );
});
