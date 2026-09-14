/**
 * A drive comes to rest beside a character, not inside one. ADR-0037.
 *
 * Holding right from the front door, the player stopped inside the beaver guide
 * on Halifax and the two faces merged; the bike rode through the guide on
 * Toronto; and on the Prairies the train stopped with its glass dome where the
 * guide stands. Every one of those was ADR-0032's stop doing what it said —
 * resting level with the subject's `x` — for a subject that has a body.
 *
 * This file holds `stand-off.ts`'s arithmetic on a rig small enough to read, so
 * each rule can be seen to be the rule. Every shipped level, every character and
 * the real strategy are `tests/unit/contracts/a-stop-rests-beside-a-character.test.ts`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { MAX_STEP_SECONDS } from '@adapters/phaser/locomotion';
import { rideFor } from '@adapters/phaser/ride';
import {
  STAND_OFF_GAP_PX,
  figureSpan,
  landingSlackPx,
  mirrorSpan,
  restPointsBeside,
  rideFootprintSpan,
  riderSpan,
  stopSubjectsFor,
  type HorizontalSpan,
} from '@adapters/phaser/stand-off';

import type { LocomotionTuning, Ride, RigArtboard, RigDocument, RigFrame } from '@application/ports';

import rigJson from '@content/characters/rig.json';
import gameConfigJson from '@content/game.config.json';

const RIG = rigJson as unknown as RigDocument;
const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };
const PREFIX = RIG.atlas.framePrefix;
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

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

const ANY_TUNING: LocomotionTuning = ((): LocomotionTuning => {
  const tuning = LEVELS.flatMap((level) => level.locomotion).find(
    (candidate) => (candidate.interaction?.reachPx ?? 0) > 0,
  );
  if (tuning === undefined) throw new Error('no shipped level moves in a mode that can engage');
  return tuning;
})();

/* ------------------------------------------------------------ a tiny rig --- */

const frame = (x: number, w: number): RigFrame => ({ source: 'src/svg/shared/character/test.svg', x, y: 0, w, h: 10 });

const artboard = (name: string, over: Partial<Omit<RigArtboard, 'artboard'>> = {}): RigArtboard => ({
  characterId: name as RigArtboard['characterId'],
  artboard: name,
  stateMachine: 'motion',
  skins: {},
  playerSelectableSlots: [],
  ...over,
});

/**
 * Four parts, in the real rig's character space (centre 120):
 *
 *  - a coat window at 130..170, drawn once as it is and once mirrored, so the
 *    pair spans 70..170 — the reflection is what the renderer does to a twin;
 *  - equipment at 0..240, drawn only in the mode that names it;
 *  - hair whose options differ in width, so an envelope over a player's choices
 *    is observable.
 */
const TINY: RigDocument = {
  ...RIG,
  parts: [
    { name: 'coat-near', z: 1, frame: 'coat-{costume}', pivot: [120, 100], mirrorX: false },
    { name: 'coat-far', z: 2, frame: 'coat-{costume}', pivot: [120, 100], mirrorX: true },
    { name: 'gear', z: 3, frame: 'gear-{mode}', pivot: [120, 400], mirrorX: false },
    { name: 'hair', z: 4, frame: 'hair-{hairShape}', pivot: [120, 40], mirrorX: false },
  ],
  frames: {
    [`${PREFIX}coat-wool`]: frame(130, 40),
    [`${PREFIX}gear-wheels`]: frame(0, 240),
    [`${PREFIX}hair-crop`]: frame(100, 40),
    [`${PREFIX}hair-long`]: frame(40, 90),
  },
  artboards: [
    artboard('stranger', { skins: { costume: 'wool', hairShape: 'crop' } }),
    artboard('hero', { skins: { costume: 'wool' }, playerSelectableSlots: ['hairShape'] }),
    artboard('ghost', { skins: { costume: 'silk', hairShape: 'coil' } }),
  ],
};

describe('a figure is as wide as the frames it can draw', () => {
  it('reflects a mirrored twin about the centre, as the renderer places it', () => {
    expect(figureSpan(TINY, 'stranger', null)).toEqual({ left: -50, right: 50 });
  });

  it('adds the equipment of the mode it moves in, and only that mode', () => {
    expect(figureSpan(TINY, 'stranger', 'wheels')).toEqual({ left: -120, right: 120 });
    expect(figureSpan(TINY, 'stranger', 'paddles')).toEqual({ left: -50, right: 50 });
  });

  it('covers every option a player could choose, so a choice cannot put them inside somebody', () => {
    /* Long hair reaches 40..130, that is -80..10 about the centre; the crop does
       not. The player may choose either, so the span is the envelope. */
    expect(figureSpan(TINY, 'hero', null)).toEqual({ left: -80, right: 50 });
  });

  it('answers null for an artboard the rig does not have, or one that draws nothing', () => {
    expect(figureSpan(TINY, 'nobody', null)).toBeNull();
    expect(figureSpan(TINY, 'ghost', null)).toBeNull();
  });

  it('on the shipped rig, a mode with equipment is never narrower than the figure without it', () => {
    const player = RIG.artboards.find((candidate) => candidate.playerSelectableSlots.length > 0);
    expect(player, 'the rig has no player artboard').toBeDefined();
    if (player === undefined) return;
    const bare = figureSpan(RIG, player.artboard, null);
    expect(bare).not.toBeNull();
    for (const mode of CONFIG.locomotionModes) {
      const dressed = figureSpan(RIG, player.artboard, mode);
      expect(dressed?.left ?? 0, mode).toBeLessThanOrEqual(bare?.left ?? 0);
      expect(dressed?.right ?? 0, mode).toBeGreaterThanOrEqual(bare?.right ?? 0);
    }
  });
});

describe('what travels with the rider', () => {
  const body: HorizontalSpan = { left: -40, right: 60 };
  const car: Ride = {
    mode: 'rail',
    art: [{ key: 'car-front', side: 'front' }],
    riderAnchor: { x: 380, y: 420 },
    groundLineY: 330,
    turnsWithRider: false,
    footprint: { x: 220, width: 400 },
  };

  it('measures a footprint about the rider, from the anchor', () => {
    expect(rideFootprintSpan(car)).toEqual({ left: -160, right: 240 });
  });

  it('turns the body with the rider', () => {
    expect(mirrorSpan(body)).toEqual({ left: -60, right: 40 });
    expect(riderSpan(body, null, 1)).toEqual(body);
    expect(riderSpan(body, null, -1)).toEqual({ left: -60, right: 40 });
    expect(riderSpan(null, null, 1)).toBeNull();
  });

  it('turns a ride only when the ride turns with its rider', () => {
    /* A train backs up without turning round: its dome stays where it is. */
    expect(riderSpan(body, car, -1)).toEqual({ left: -160, right: 240 });
    expect(riderSpan(body, { ...car, turnsWithRider: true }, -1)).toEqual({ left: -240, right: 160 });
    expect(riderSpan(null, car, 1)).toEqual({ left: -160, right: 240 });
  });
});

describe('where the drive comes to rest beside somebody', () => {
  const x = 1000;
  const person: HorizontalSpan = { left: -50, right: 50 };
  const rider: HorizontalSpan = { left: -60, right: 60 };

  it('rests short of them, clear by the gap, when that fits in reach with the slack', () => {
    const rest = restPointsBeside({ x, subject: person, riderRight: rider, riderLeft: rider, reachPx: 240, slackPx: 20 });
    const short = 60 + 50 + STAND_OFF_GAP_PX;
    expect(rest).toEqual({ right: x - short, left: x + short });
  });

  it('rests past them when short of them does not fit, and charges the slack to the clearance', () => {
    /* The Prairies' shape: a dome that reaches 240 px ahead of its rider, a guide
       facing left whose tail reaches 100 px behind him, a 320 px reach. */
    const dome: HorizontalSpan = { left: -160, right: 240 };
    const guide: HorizontalSpan = { left: -62, right: 100 };
    const slackPx = 26;
    const rest = restPointsBeside({ x, subject: guide, riderRight: dome, riderLeft: dome, reachPx: 320, slackPx });
    /* Travelling right: short would be 240 + 62 + gap + slack > 320, so past,
       where landing short moves the dome back toward the guide. */
    expect(rest.right).toBe(x + 100 + 160 + STAND_OFF_GAP_PX + slackPx);
    /* Travelling left the dome leads by 160 and the tail is the near side. */
    expect(rest.left).toBe(x + 160 + 100 + STAND_OFF_GAP_PX);
  });

  it('rests level with them when neither side fits, which is the old stop and the contract refuses it', () => {
    const rest = restPointsBeside({ x, subject: person, riderRight: rider, riderLeft: rider, reachPx: 100, slackPx: 20 });
    expect(rest).toEqual({ right: x, left: x });
  });

  it('keeps the clearance wherever inside its slack the stop lands', () => {
    const overlapAt = (at: number, span: HorizontalSpan): number =>
      Math.min(at + span.right, x + person.right) - Math.max(at + span.left, x + person.left);
    for (const reachPx of [180, 240, 320]) {
      const slackPx = 24;
      const rest = restPointsBeside({ x, subject: person, riderRight: rider, riderLeft: rider, reachPx, slackPx });
      for (const [aim, heading, span] of [
        [rest.right, 1, rider],
        [rest.left, -1, rider],
      ] as const) {
        if (aim === x) continue;
        for (const landed of [aim, aim - heading * slackPx]) {
          expect(overlapAt(landed, span), `reach ${String(reachPx)}`).toBeLessThan(0);
          expect(Math.abs(landed - x), `reach ${String(reachPx)}`).toBeLessThanOrEqual(reachPx);
        }
      }
    }
  });

  it('honours a gap it is given', () => {
    const rest = restPointsBeside({ x, subject: person, riderRight: rider, riderLeft: rider, reachPx: 400, slackPx: 0, gapPx: 40 });
    expect(rest.right).toBe(x - (60 + 50 + 40));
  });

  it('allows for one capped frame at the fastest the mode goes, a descent included', () => {
    const tuning = { ...ANY_TUNING, maxSpeed: 600, maxSpeedMultiplierDownhill: 1.5 };
    expect(landingSlackPx(tuning)).toBeCloseTo(600 * 1.5 * MAX_STEP_SECONDS, 9);
    expect(landingSlackPx({ ...tuning, maxSpeedMultiplierDownhill: 0.5 })).toBeCloseTo(600 * MAX_STEP_SECONDS, 9);
  });
});

describe('the subjects a drive stops for, as the scene lists them', () => {
  it('lists landmarks then characters, and aims beside every character only', () => {
    for (const level of LEVELS) {
      for (const tuning of level.locomotion) {
        const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride: rideFor(level.rides, tuning.mode) });
        const where = `${String(level.id)}/${tuning.mode}`;
        expect(subjects.map((subject) => subject.id), where).toEqual([
          ...level.reachablePois.map((poi) => String(poi.id)),
          ...level.characters.map((character) => String(character.characterId)),
        ]);
        const landmarkIds = new Set(level.reachablePois.map((poi) => String(poi.id)));
        for (const subject of subjects) {
          if (landmarkIds.has(subject.id)) expect(subject.rest, `${where}: ${subject.id}`).toBeUndefined();
          else if ((tuning.interaction?.reachPx ?? 0) > 0) {
            expect(subject.rest, `${where}: ${subject.id} has no rest point beside them`).toBeDefined();
          }
        }
      }
    }
  });

  it('aims level with everybody when there is no rig to measure, or nothing can be engaged', () => {
    const level = LEVELS.find((candidate) => candidate.characters.length > 0);
    expect(level, 'no shipped level places a character').toBeDefined();
    if (level === undefined) return;
    const tuning = level.locomotion[0] ?? ANY_TUNING;
    const ride = rideFor(level.rides, tuning.mode);
    expect(stopSubjectsFor({ level, rig: null, tuning, ride }).every((subject) => subject.rest === undefined)).toBe(true);
    expect(
      stopSubjectsFor({ level, rig: RIG, tuning: { ...tuning, interaction: null }, ride }).every(
        (subject) => subject.rest === undefined,
      ),
    ).toBe(true);
  });
});
