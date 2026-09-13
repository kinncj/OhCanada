/**
 * The 3 -> 4 migration, in the shape `a-version-1-save-survives-the-first-migration.test.ts`
 * fixed for a format change: what an existing player's save is owed.
 *
 * **What version 3 is.** `progress.schema.json` constrained `character.skins`'
 * property names with the shared kebab-case id while `content/characters/rig.json`
 * names its slots `hairShape`, `hairColour`, `headCovering`. Because
 * `SaveCodec.encode` validates on the way out as well as in, a character keyed
 * the rig's way failed *every* write, so the composition root kebab-cased the
 * slot name into the save and camel-cased it back out. Every version-3 document
 * on a device therefore holds kebab keys, and this build's schema refuses them.
 *
 * **So the whole save is at stake, not only the character.** A document the
 * validator rejects is rejected entire: TN-SAVE-04 forbids a half-load, so a
 * `skins` key the schema will not accept costs the player their levels, their
 * stamps and every review state beside it. That is why this step converts rather
 * than drops, and it is the difference from 2 -> 3, which had nothing to convert
 * from.
 *
 * The version-3 document here is derived from this build's own `encode` and then
 * un-spelled by the exact rule the workaround applied, for the reason the
 * version-1 file gives: a hand-written fixture drifts from what the previous
 * build actually wrote, and a migration tested against a fixture nobody ever
 * stored proves nothing about the save on a real device.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import type { ProgressSnapshot } from '@application/ports/progress-repository';
import {
  withBestScore,
  withCharacter,
  withReview,
  withStamp,
  withSubjectStarted,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';

import { DAY, HOUR, ORIGIN, at, characterId, emptyProgress, levelId, questionId, subjectId } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
};

/** The codec the composition root builds: this build's version, with its steps. */
const codec = createJsonSaveCodec({
  maxImportBytes: config.save.maxImportBytes,
  migrations: SAVE_MIGRATIONS,
});

/** A build with no migrations wired in, to show the step is what does the work. */
const bareCodec = createJsonSaveCodec({ maxImportBytes: config.save.maxImportBytes });

/**
 * A player who made a character and then played: five slots chosen, a stamp, a
 * best score, a subject started and a review state. The things beside the
 * character are the point — they are what a rejected document would take with
 * it.
 */
const CHOSEN = {
  skin: 'skin-5',
  hairShape: 'coil',
  hairColour: 'black',
  headCovering: 'none',
  feature: 'glasses',
} as const;

const playedGame = (): Progress => {
  let progress = withCharacter(emptyProgress(), {
    characterId: characterId('player'),
    skins: { ...CHOSEN },
  });
  progress = withStamp(progress, levelId(), at(ORIGIN - DAY));
  progress = withBestScore(progress, levelId(), 18);
  progress = withSubjectStarted(progress, subjectId());
  return withReview(progress, {
    questionId: questionId('government-1'),
    dueAt: at(ORIGIN + DAY),
    stability: 3.5,
    difficulty: 5.25,
    reps: 2,
    lapses: 0,
    lastReviewedAt: at(ORIGIN - HOUR),
    firstReviewedAt: at(ORIGIN - 10 * DAY),
    phase: 'review',
    learningSteps: 0,
  });
};

const current = (): ProgressSnapshot => {
  const written = toProgressSnapshot(playedGame(), { version: codec.version, updatedAt: ORIGIN });
  if (!written.ok) throw new Error('the fixture must be encodable by this build');
  return written.value;
};

/**
 * The same save as the build with the workaround in it wrote: version 3, with
 * every slot name kebab-cased by the rule that module applied — one hyphen and a
 * lower-case letter for every upper-case one. Nothing else about version 3
 * differs from version 4, which is why this inverse is one line.
 */
const version3Bytes = (): string => {
  const document = current();
  const character = document.character;
  if (character === null) throw new Error('the fixture must hold a character');
  const skins: Record<string, string> = {};
  for (const [slot, option] of Object.entries(character.skins)) {
    skins[slot.replace(/[A-Z]/gu, (upper) => `-${upper.toLowerCase()}`)] = option;
  }
  return JSON.stringify({ ...document, version: 3, character: { ...character, skins } });
};

describe('a version-3 save keeps the character the player chose', () => {
  it('is holding keys this build refuses, or the migration would be testing nothing', () => {
    const before = JSON.parse(version3Bytes()) as {
      readonly character: { readonly skins: Record<string, string> };
    };
    expect(Object.keys(before.character.skins).sort()).toEqual([
      'feature',
      'hair-colour',
      'hair-shape',
      'head-covering',
      'skin',
    ]);
  });

  it('is refused before the migration, so the step is what does the work', () => {
    const refused = bareCodec.decode(version3Bytes());
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.kind).toBe('unsupported');
      expect(refused.error.code).toBe('save.migration.missing');
    }
  });

  it('decodes into this build’s document, with every choice the player made', () => {
    const decoded = codec.decode(version3Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.version).toBe(codec.version);
    expect(decoded.value.character?.skins).toEqual(CHOSEN);
    // Nothing else in the document moved: the only change between 3 and 4 is
    // how five keys are spelled.
    expect(decoded.value).toEqual(current());
  });

  it('loses nothing — not the character, and not what was beside it', () => {
    /*
     * The cost of this step, stated the way 1 -> 2 states the hold time it
     * cannot restore and 2 -> 3 states the attempt it drops. Here it is nothing,
     * and the reason is that the kebab key IS the rig's key, spelled by a rule
     * that is exact in both directions — so there was never anything to invent.
     */
    const decoded = codec.decode(version3Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.levels[0]?.stampEarnedAt).toBe(current().levels[0]?.stampEarnedAt);
    expect(decoded.value.levels[0]?.bestScore).toBe(18);
    expect(decoded.value.reviews).toEqual(current().reviews);
    expect(decoded.value.subjectsStarted).toEqual(current().subjectsStarted);
    expect(decoded.value.character?.characterId).toBe('player');
    // Not a kebab key left anywhere: the conversion is complete, not partial.
    expect(JSON.stringify(decoded.value)).not.toContain('hair-shape');
  });

  it('re-encodes what it migrated, so the next save is this build’s version', () => {
    const decoded = codec.decode(version3Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const written = codec.encode(decoded.value);
    expect(written.ok, JSON.stringify(written.ok ? null : written.error.details)).toBe(true);
    if (!written.ok) return;
    const again = codec.decode(written.value);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value).toEqual(decoded.value);
  });

  it('refuses a version-3 document whose keys no build ever wrote, and says which', () => {
    // Migrated first, validated after. A key outside the image of the rule the
    // workaround applied can only come from a hand-edited file, and a readable
    // refusal is better than a silently dropped slot (SECURITY.md).
    const handEdited = JSON.parse(version3Bytes()) as {
      character: { skins: Record<string, string> };
    };
    handEdited.character.skins = { 'hair-1': 'brown' };
    const decoded = codec.decode(JSON.stringify(handEdited));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error.code).toBe('save.schema.invalid');
      expect(JSON.stringify(decoded.error.details)).toContain('/character/skins/hair-1');
    }
  });

  it('reads a version-3 save with no character as a first run, not as a broken one', () => {
    const noCharacter = JSON.stringify({ ...current(), version: 3, character: null });
    const decoded = codec.decode(noCharacter);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value.character).toBeNull();
  });
});
