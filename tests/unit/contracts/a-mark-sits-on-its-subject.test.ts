/**
 * Every mark sits on or just above the art it points at, and never on the
 * player's head where a stop holds them. ADR-0049.
 *
 * The audit's pictures, at 390 × 844: hollow rings in empty sky over Québec City
 * and Toronto, and at the North's sternwheeler a pin over the player's face. A
 * mark sat a fixed height above its subject's rectangle — a texture's bounds, or
 * `characterSpace` — and neither is the art; and a drive rests level with a
 * landmark, so a landmark lower than the player put its mark where the player
 * stands.
 *
 * Held here for every level, every mode it declares that can engage, every
 * engageable subject and three mark sizes (the floor, 44 pt on a desktop canvas,
 * 44 pt on a 390 px phone), with the real level documents, the real rig, the real
 * stop and each landmark's art rasterised at 1x as `make assets` rasterises it:
 *
 *  1. the mark's point lies over its subject's art, and no more than
 *     {@link JUST_ABOVE_PX} above the art under the mark;
 *  2. no mark overlaps the player's head at any place a stop can leave them there;
 *  3. no mark overlaps the player anywhere they can walk, crown to soles, nor any
 *     other character — and every mark stays inside the playfield, above the
 *     ground under it and on the canvas.
 *
 * A mark that had to rise over the player or a character is "just above" what it
 * rose over rather than its own art: rule 1 is measured from the higher of the two.
 *
 * And the gate is shown to fail: marks placed over rectangles and blind to the
 * player — the old rule — float above art and cover heads on the shipped levels;
 * and marks that keep off the resting head alone — the rule before a real build
 * at 390 × 844 showed the granite erratic's ring on the walking player's chest at
 * Peggy's Cove — cover the player as they walk up.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  placeSilhouette,
  silhouetteBounds,
  silhouetteFromRgba,
  topWithin,
  type ArtSilhouette,
} from '@adapters/phaser/art-silhouette';
import { artboardFor } from '@adapters/phaser/character-cast';
import { figureSilhouette } from '@adapters/phaser/figure-extent';
import { groundYAt } from '@adapters/phaser/ground-profile';
import {
  MARK_GAP_PX,
  MIN_MARK_PX,
  affordanceMarks,
  markAnchor,
  markExtent,
  type AffordanceMark,
} from '@adapters/phaser/interaction-affordance';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { markClearance, restingHeadBoxes, walkingFigureBoxes } from '@adapters/phaser/mark-clearance';
import { rideFor } from '@adapters/phaser/ride';
import { stopSubjectsFor } from '@adapters/phaser/stand-off';
import type { TargetRect } from '@adapters/phaser/touch-controls';

import type { LocomotionTuning, RigDocument, Vec2 } from '@application/ports';

import rigJson from '@content/characters/rig.json';
import gameConfigJson from '@content/game.config.json';

const RIG = rigJson as unknown as RigDocument;
const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const LEVELS: readonly SceneLevel[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const parsed = parseLevelDocument(
      JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')),
      CONFIG.locomotionModes,
    );
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error.message}`);
    return parsed.value;
  });

/** Every (level, mode) that can engage. */
const CASES = LEVELS.flatMap((level) =>
  level.locomotion
    .filter((tuning) => (tuning.interaction?.reachPx ?? 0) > 0)
    .map((tuning) => ({ level, tuning })),
);

/** The mark's floor, 44 pt on a 1080-wide desktop canvas, and 44 pt on a 390 px phone. */
const MARK_SIZES = [MIN_MARK_PX, 95, 122] as const;

/**
 * How far above the art under it a mark's point may be: the gap it is placed at,
 * and half the smallest mark again for a mark that had to rise over a head.
 */
const JUST_ABOVE_PX = MARK_GAP_PX + MIN_MARK_PX / 2;

interface Picture {
  readonly width: number;
  readonly height: number;
  /** In the picture's own pixels. */
  readonly art: ArtSilhouette;
}

/** Each landmark's art, rasterised once. */
const pictures = new Map<string, Picture>();

/** Each ride's silhouette in the textures it shows at rest, by level and mode, as the scene reads them for a stop. */
const rideArts = new Map<string, readonly ArtSilhouette[]>();

/** The 1x source a landmark's art key is rasterised from, as `make assets` finds it. */
function sourceFor(levelId: string, key: string): string {
  const path = `${REPO_ROOT}assets/src/svg/${levelId}/${key.slice(levelId.length + 1)}@1x.svg`;
  if (!existsSync(path)) {
    throw new Error(`${levelId}: "${key}" has no 1x-pinned source at ${path}, so its size on screen is not known here`);
  }
  return path;
}

interface Target {
  readonly id: string;
  readonly npc: boolean;
  readonly position: Vec2;
  readonly rect: TargetRect;
  readonly art: ArtSilhouette;
  readonly clear: readonly TargetRect[];
  /** Only the player's head where a stop holds them here: the rule before walking was counted. */
  readonly resting: readonly TargetRect[];
  /** The player wherever they can walk, and every other character. */
  readonly standing: readonly TargetRect[];
}

/** Every engageable subject, drawn and placed as `level-scene.ts` draws and places it. */
function targetsFor(level: SceneLevel, tuning: LocomotionTuning): readonly Target[] {
  const ride = rideFor(level.rides, tuning.mode);
  const rideArt = ride === null ? [] : (rideArts.get(`${String(level.id)}:${ride.mode}`) ?? []);
  const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride, rideArt });
  const heads = restingHeadBoxes({ ground: level.ground, subjects, rig: RIG, tuning, ride });
  const walking = walkingFigureBoxes({ ground: level.ground, rig: RIG, tuning, ride });

  const landmarks = level.reachablePois.map((poi): Target => {
    const picture = pictures.get(sourceFor(String(level.id), poi.artKey));
    if (picture === undefined) throw new Error(`${String(level.id)}: "${poi.artKey}" was not rasterised`);
    const groundY = groundYAt(level.ground, poi.position.x);
    const rect = {
      x: poi.position.x - picture.width / 2,
      y: groundY - picture.height,
      width: picture.width,
      height: picture.height,
    };
    return {
      id: String(poi.id),
      npc: false,
      position: poi.position,
      rect,
      art: placeSilhouette(picture.art, { x: rect.x, y: rect.y, scale: 1 }),
      clear: [],
      resting: heads.get(String(poi.id)) ?? [],
      standing: [],
    };
  });

  const characters = level.characters.map((character): Target => {
    const id = String(character.characterId);
    const board = artboardFor(RIG, id);
    const groundY = groundYAt(level.ground, character.position.x);
    const art =
      board === null
        ? null
        : figureSilhouette(RIG, board.artboard, { x: character.position.x, groundY, facing: character.facing });
    if (art === null) throw new Error(`${String(level.id)}: the rig cannot draw "${id}"`);
    const space = RIG.characterSpace;
    return {
      id,
      npc: true,
      position: character.position,
      rect: { x: character.position.x - space.centreX, y: groundY - space.soleY, width: space.width, height: space.height },
      art,
      clear: [],
      resting: heads.get(id) ?? [],
      standing: [],
    };
  });

  /* As `level-scene.ts` puts it together: each character's drawn art is what
     every other subject's mark keeps off. */
  const actors = characters.map((target) => {
    const bounds = silhouetteBounds(target.art);
    if (bounds === null) throw new Error(`${String(level.id)}: "${target.id}" has no art`);
    return {
      id: target.id,
      rect: { x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top },
    };
  });
  const all = [...landmarks, ...characters];
  const clearance = markClearance(
    all.map((target) => target.id),
    { resting: heads, walking, actors },
  );
  return all.map((target) => ({
    ...target,
    clear: clearance.get(target.id) ?? [],
    standing: [...walking, ...actors.filter((actor) => actor.id !== target.id).map((actor) => actor.rect)],
  }));
}

const overlaps = (a: TargetRect, b: TargetRect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** What is wrong with where a mark points, or `null`. */
function misplaced(target: Target, mark: AffordanceMark): string | null {
  const anchor = markAnchor(mark);
  const bounds = silhouetteBounds(target.art);
  const at = `"${target.id}" at mark size ${String(mark.size)}`;
  if (bounds === null) return `${at}: has no art to point at`;
  if (anchor.x < bounds.left || anchor.x > bounds.right) {
    return `${at}: points at x ${String(Math.round(anchor.x))}, outside its art (${String(Math.round(bounds.left))}..${String(Math.round(bounds.right))})`;
  }
  const top = topWithin(target.art, mark.x - mark.size / 2, mark.x + mark.size / 2);
  if (top === null) return `${at}: has no art under the mark`;
  /* A mark risen over something it keeps clear of is just above that instead. */
  const extent = markExtent(mark);
  const risen = target.clear
    .filter((box) => box.x < extent.x + extent.width && extent.x < box.x + box.width)
    .reduce((highest, box) => Math.min(highest, box.y), top);
  if (anchor.y < Math.min(top, risen) - JUST_ABOVE_PX) {
    return `${at}: floats ${String(Math.round(top - anchor.y))} px above its art, in empty sky`;
  }
  if (anchor.y > bounds.bottom) return `${at}: points below its art`;
  return null;
}

/** Whether a mark overlaps the player's head anywhere a stop leaves them at its subject. */
const coversHead = (target: Target, mark: AffordanceMark): boolean =>
  target.resting.some((head) => overlaps(markExtent(mark), head));

/** Whether a mark overlaps the player anywhere they can walk, or another character. */
const coversStanding = (target: Target, mark: AffordanceMark): boolean =>
  target.standing.some((box) => overlaps(markExtent(mark), box));

const nameOf = (level: SceneLevel, tuning: LocomotionTuning): string => `${String(level.id)}/${tuning.mode}`;

describe('a mark sits on or just above the art it points at, and off the player (ADR-0049)', () => {
  beforeAll(async () => {
    for (const level of LEVELS) {
      for (const poi of level.reachablePois) {
        const path = sourceFor(String(level.id), poi.artKey);
        if (pictures.has(path)) continue;
        const { data, info } = await sharp(readFileSync(path), { density: 72 })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const art = silhouetteFromRgba(data, info.width, info.height);
        if (art === null) throw new Error(`${path} draws nothing`);
        pictures.set(path, { width: info.width, height: info.height, art });
      }
      for (const ride of level.rides) {
        const keys = new Set(
          ride.art.flatMap((layer) => [layer.key, ...(layer.cycle === undefined ? [] : [layer.cycle.rest])]),
        );
        const silhouettes: ArtSilhouette[] = [];
        for (const key of keys) {
          const { data, info } = await sharp(readFileSync(sourceFor(String(level.id), key)), { density: 72 })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const art = silhouetteFromRgba(data, info.width, info.height, { step: 1 });
          if (art !== null) silhouettes.push(art);
        }
        rideArts.set(`${String(level.id)}:${ride.mode}`, silhouettes);
      }
    }
  }, 180_000);

  it('has marks to check, so this is not a pass over nothing (ADR-0024)', () => {
    expect(CASES.length).toBeGreaterThan(0);
    expect(LEVELS.some((level) => level.characters.length > 0), 'no level places a character').toBe(true);
  });

  for (const { level, tuning } of CASES) {
    const reachPx = tuning.interaction?.reachPx ?? 0;

    it(`${nameOf(level, tuning)}: every mark points at its own art, from on it or at most ${String(JUST_ABOVE_PX)} px above`, () => {
      const targets = targetsFor(level, tuning);
      const problems: string[] = [];
      for (const minTouchPx of MARK_SIZES) {
        const marks = affordanceMarks(targets, { playerX: level.spawn.x, reachPx, minTouchPx });
        expect(marks).toHaveLength(targets.length);
        marks.forEach((mark, index) => {
          const target = targets[index];
          const problem = target === undefined ? `mark ${String(index)} has no subject` : misplaced(target, mark);
          if (problem !== null) problems.push(problem);
        });
      }
      expect(problems, `${nameOf(level, tuning)}:\n${problems.join('\n')}`).toEqual([]);
    });

    it(`${nameOf(level, tuning)}: no mark covers the player's head wherever a stop holds them`, () => {
      const targets = targetsFor(level, tuning);
      expect(
        targets.every((target) => target.resting.length > 0),
        'a subject has no head to keep clear of, so this checks nothing for it',
      ).toBe(true);
      const problems: string[] = [];
      for (const minTouchPx of MARK_SIZES) {
        affordanceMarks(targets, { playerX: level.spawn.x, reachPx, minTouchPx }).forEach((mark, index) => {
          const target = targets[index];
          if (target !== undefined && coversHead(target, mark)) {
            problems.push(`"${target.id}" at mark size ${String(minTouchPx)} covers the player's head at its stop`);
          }
        });
      }
      expect(problems, `${nameOf(level, tuning)}:\n${problems.join('\n')}`).toEqual([]);
    });

    it(`${nameOf(level, tuning)}: no mark covers the player as they walk, or another character, and every mark stays in the playfield`, () => {
      const targets = targetsFor(level, tuning);
      expect(
        targets.every((target) => target.standing.length > 0),
        'there is nowhere the player walks to keep clear of, so this checks nothing',
      ).toBe(true);
      const problems: string[] = [];
      for (const minTouchPx of MARK_SIZES) {
        affordanceMarks(targets, { playerX: level.spawn.x, reachPx, minTouchPx }).forEach((mark, index) => {
          const target = targets[index];
          if (target === undefined) return;
          const at = `"${target.id}" at mark size ${String(minTouchPx)}`;
          if (coversStanding(target, mark)) problems.push(`${at} covers the player where they walk, or a character`);
          const extent = markExtent(mark);
          if (extent.y < 0) problems.push(`${at} leaves the top of the canvas`);
          if (extent.y + extent.height > groundYAt(level.ground, mark.x)) {
            problems.push(`${at} reaches below the ground line, out of the playfield`);
          }
        });
      }
      expect(problems, `${nameOf(level, tuning)}:\n${problems.join('\n')}`).toEqual([]);
    });
  }

  it('the gate can fail: marks over rectangles, blind to the player, float above art and cover heads', () => {
    let floating = 0;
    let covering = 0;
    let walkedInto = 0;
    const struck = new Set<string>();
    for (const { level, tuning } of CASES) {
      const targets = targetsFor(level, tuning);
      const blind = targets.map((target) => ({ ...target, art: null, clear: [] }));
      const marks = affordanceMarks(blind, {
        playerX: level.spawn.x,
        reachPx: tuning.interaction?.reachPx ?? 0,
        minTouchPx: 122,
      });
      marks.forEach((mark, index) => {
        const target = targets[index];
        if (target === undefined) return;
        if (misplaced(target, mark) !== null) floating += 1;
        if (coversHead(target, mark)) covering += 1;
      });
      /* The rule before walking was counted: clear of the resting head alone. */
      const restingOnly = targets.map((target) => ({ ...target, clear: target.resting }));
      affordanceMarks(restingOnly, {
        playerX: level.spawn.x,
        reachPx: tuning.interaction?.reachPx ?? 0,
        minTouchPx: 122,
      }).forEach((mark, index) => {
        const target = targets[index];
        if (target === undefined || !coversStanding(target, mark)) return;
        walkedInto += 1;
        struck.add(`${String(level.id)}/${target.id}`);
      });
    }
    expect(floating, 'no mark over a rectangle floats above its art, so the first check proves nothing').toBeGreaterThan(0);
    expect(covering, "no mark blind to the player covers a head, so the second check proves nothing").toBeGreaterThan(0);
    expect(walkedInto, 'no mark clear of the resting head alone covers the walking player, so the third proves nothing').toBeGreaterThan(0);
    /* The subject of the report: the ring on the walking player's chest. */
    expect([...struck]).toContain('peggys-cove/granite-shore');
  });
});
