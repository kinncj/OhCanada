/**
 * The save migrations this build ships: 1 -> 2, 2 -> 3 and 3 -> 4.
 *
 * A migration runs on a document that has been parsed and version-gated and
 * nothing else — the schema check comes after it — so half of what is asserted
 * here is about input the step does not recognise. A migration that threw, or
 * that "repaired" something it had not understood, would turn a save the player
 * could still download into one nobody can read.
 */

import { describe, expect, it } from 'vitest';

import { CURRENT_SAVE_VERSION } from '@application/persistence/json-save-codec';
import {
  SAVE_MIGRATIONS,
  addHoldToChooseMs,
  dropVersionTwoExams,
  renameSkinSlotsToTheRigsSpelling,
} from '@application/persistence/save-migrations';
import { validateProgressDocument } from '@application/persistence/progress-schema';
import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';

const apply = (document: Record<string, unknown>): Record<string, unknown> => {
  const migrated = addHoldToChooseMs.apply(document);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error('this step never fails');
  return migrated.value;
};

describe('1 -> 2: the switch hold time becomes a saved setting', () => {
  it('is the first of the three steps this build ships', () => {
    expect(SAVE_MIGRATIONS).toEqual([
      addHoldToChooseMs,
      dropVersionTwoExams,
      renameSkinSlotsToTheRigsSpelling,
    ]);
    expect(addHoldToChooseMs.from).toBe(1);
    expect(addHoldToChooseMs.to).toBe(2);
  });

  it('gives a version-1 save the hold time the game ships with', () => {
    const migrated = apply({ version: 1, settings: { autoMove: true, singleSwitch: true } });
    expect(migrated['version']).toBe(2);
    expect(migrated['settings']).toEqual({
      autoMove: true,
      singleSwitch: true,
      holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS,
    });
  });

  it('does not mutate the document it was given', () => {
    const before = { version: 1, settings: { autoMove: false } };
    apply(before);
    expect(before).toEqual({ version: 1, settings: { autoMove: false } });
  });

  it('keeps a hold time that is somehow already there', () => {
    const migrated = apply({ version: 1, settings: { holdToChooseMs: 1_200 } });
    expect(migrated['settings']).toEqual({ holdToChooseMs: 1_200 });
  });

  it('replaces a hold time that is not a usable number', () => {
    for (const broken of ['1200', null, Number.NaN, {}]) {
      const migrated = apply({ version: 1, settings: { holdToChooseMs: broken } });
      expect(migrated['settings']).toEqual({ holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS });
    }
  });

  it('leaves settings it does not recognise exactly as they were', () => {
    // Not repaired, not dropped: the schema check that runs next says what is
    // wrong with it, in the language of a JSON pointer.
    for (const settings of [undefined, null, 'off', [], 7]) {
      const migrated = apply({ version: 1, settings });
      expect(migrated['version']).toBe(2);
      expect(migrated['settings']).toBe(settings);
    }
  });

  it('carries every other property through untouched', () => {
    const migrated = apply({
      version: 1,
      settings: {},
      levels: [{ levelId: 'ottawa' }],
      reviews: [{ questionId: 'q-1' }],
    });
    expect(migrated['levels']).toEqual([{ levelId: 'ottawa' }]);
    expect(migrated['reviews']).toEqual([{ questionId: 'q-1' }]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2 -> 3                                                                     */
/* -------------------------------------------------------------------------- */

const migrate = (document: Record<string, unknown>): Record<string, unknown> => {
  const migrated = dropVersionTwoExams.apply(document);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error('this step never fails');
  return migrated.value;
};

/** A version-2 attempt, in the shape version 2 actually wrote. */
const version2Attempt = (): Record<string, unknown> => ({
  startedAt: '2026-09-01T10:00:00.000Z',
  finishedAt: '2026-09-01T10:20:00.000Z',
  askedQuestionIds: ['gov-01', 'gov-02'],
  correctCount: 16,
  passed: true,
  timed: true,
});

describe('2 -> 3: the exam record becomes the exam', () => {
  it('is the second step, and it moves the version', () => {
    expect(dropVersionTwoExams.from).toBe(2);
    expect(dropVersionTwoExams.to).toBe(3);
  });

  it('drops a version-2 attempt rather than inventing the answers it never held', () => {
    const migrated = migrate({ version: 2, exams: [version2Attempt()] });
    expect(migrated['version']).toBe(3);
    expect(migrated['exams']).toEqual([]);
    // The alternative was twenty answers with `chosenIndex: null`, which would
    // print a player's 16 out of 20 as "answered nothing, got nothing wrong"
    // (ADR-0024, ADR-0027). Nothing here fabricates a subject, a choice or a key.
    expect(JSON.stringify(migrated)).not.toContain('chosenIndex');
    expect(JSON.stringify(migrated)).not.toContain('correctCount');
  });

  it('opens the exam in progress as absent, not as an empty one', () => {
    // `null` is "no exam to finish". An empty object or an attempt with no
    // answers would both be an exam the resume screen would offer.
    expect(migrate({ version: 2, exams: [] })['examInProgress']).toBeNull();
  });

  it('leaves an `exams` it does not understand exactly as it found it', () => {
    for (const exams of [undefined, null, 'none', 7, {}]) {
      const migrated = migrate({ version: 2, exams });
      expect(migrated['version']).toBe(3);
      expect(migrated['exams']).toBe(exams);
    }
  });

  it('does not mutate the document it was given', () => {
    const before = { version: 2, exams: [version2Attempt()] };
    migrate(before);
    expect(before.version).toBe(2);
    expect(before.exams).toHaveLength(1);
  });

  it('carries every other property through untouched', () => {
    const migrated = migrate({
      version: 2,
      exams: [version2Attempt()],
      levels: [{ levelId: 'ottawa' }],
      reviews: [{ questionId: 'gov-01' }],
      subjectsStarted: ['government'],
    });
    expect(migrated['levels']).toEqual([{ levelId: 'ottawa' }]);
    expect(migrated['reviews']).toEqual([{ questionId: 'gov-01' }]);
    expect(migrated['subjectsStarted']).toEqual(['government']);
  });

  it('is dropping attempts no build that could write one ever wrote', () => {
    /*
     * The step's justification, pinned rather than asserted in prose.
     *
     * It used to be pinned the other way round: no file under `app/` called
     * `withExamAttempt`, so no build could produce a version-2 attempt for this
     * step to reach. **Exam mode has landed and that case has done its job** —
     * `app/bootstrap/exam.ts` files an attempt now, through
     * `app/application/use-cases/exam-attempt.ts` — and the case retired itself
     * exactly as its own comment instructed.
     *
     * What is left is the claim that survived: an attempt is only ever written
     * by a build that writes **version 3**, so the document this step drops
     * attempts from is still one no player can be holding. `CURRENT_SAVE_VERSION`
     * is what makes that true, so `CURRENT_SAVE_VERSION` is what is asserted.
     */
    expect(dropVersionTwoExams.from).toBe(2);
    expect(dropVersionTwoExams.to).toBe(3);
    // Attempts arrived WITH version 3 — the version this step produces — so no
    // document a player holds at version 2 can contain one. This used to read
    // `dropVersionTwoExams.to === CURRENT_SAVE_VERSION`, which said the same
    // thing only while 3 was the newest; the format has since moved to 4 and
    // that spelling would have quietly stopped being the claim it was making.
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(dropVersionTwoExams.to);
  });
});

/* -------------------------------------------------------------------------- */

describe('3 -> 4: a character is keyed the way the rig spells its slots', () => {
  const migrate = (document: Record<string, unknown>): Record<string, unknown> => {
    const migrated = renameSkinSlotsToTheRigsSpelling.apply(document);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) throw new Error('this step never fails');
    return migrated.value;
  };

  /** A character as the workaround wrote it, which is what is on a device. */
  const version3Character = (): Record<string, unknown> => ({
    characterId: 'player',
    skins: {
      skin: 'skin-5',
      'hair-shape': 'coil',
      'hair-colour': 'black',
      'head-covering': 'none',
      feature: 'glasses',
    },
  });

  it('is the last of the three steps this build ships, and the one it writes', () => {
    expect(renameSkinSlotsToTheRigsSpelling.from).toBe(3);
    expect(renameSkinSlotsToTheRigsSpelling.to).toBe(CURRENT_SAVE_VERSION);
    expect(CURRENT_SAVE_VERSION).toBe(4);
  });

  it('restores the rig’s spelling, keeping every choice and every option id', () => {
    const migrated = migrate({ version: 3, character: version3Character() });
    expect(migrated['version']).toBe(4);
    expect(migrated['character']).toEqual({
      characterId: 'player',
      skins: {
        skin: 'skin-5',
        hairShape: 'coil',
        hairColour: 'black',
        headCovering: 'none',
        feature: 'glasses',
      },
    });
  });

  it('writes keys the shipped validator accepts, which is what the old ones failed', () => {
    /*
     * The point of the step, checked against the validator rather than against a
     * pattern this test restates: the kebab keys are what `SaveCodec.encode`
     * refused, which is why no save write ever succeeded.
     */
    const document = (character: unknown): unknown => ({
      $schema: '../schemas/progress.schema.json',
      version: 4,
      updatedAt: '2026-09-13T00:00:00.000Z',
      settings: {
        locale: 'en',
        autoMove: false,
        singleSwitch: false,
        holdToChooseMs: 600,
        reducedMotion: false,
        highContrast: false,
        dyslexiaFont: false,
        textScale: 1,
        subtitles: true,
        volumes: { master: 1, music: 1, sfx: 1, voice: 1 },
      },
      character,
      levels: [],
      lastPlayedLevelId: null,
      reviews: [],
      subjectsStarted: [],
      exams: [],
      examInProgress: null,
    });

    expect(validateProgressDocument(document(version3Character())).ok).toBe(false);
    const migrated = migrate({ version: 3, character: version3Character() });
    expect(validateProgressDocument(document(migrated['character'])).ok).toBe(true);
  });

  it('leaves a save with no character alone, because that is most of them', () => {
    for (const character of [null, undefined, 'player', 7, []]) {
      const migrated = migrate({ version: 3, character });
      expect(migrated['version']).toBe(4);
      expect(migrated['character']).toBe(character);
    }
  });

  it('leaves a `skins` it does not understand exactly as it found it', () => {
    for (const skins of [null, undefined, 'none', 7, []]) {
      const migrated = migrate({ version: 3, character: { characterId: 'player', skins } });
      expect(migrated['character']).toEqual({ characterId: 'player', skins });
    }
  });

  it('does not turn a character that chose nothing into a first run (ADR-0024)', () => {
    /*
     * `{}` and an absent character are different states and this step keeps them
     * different. Converting an empty `skins` to `character: null` would be the
     * tidiest-looking branch here and it would merge the two: a player who chose
     * nothing would read as a player who has not been to the creator yet. No
     * build ever wrote `{}` — every writer covers each selectable slot — so the
     * document that gets here is hand-edited, and the schema's floor refuses it
     * by name rather than this step guessing which state it meant.
     */
    const migrated = migrate({ version: 3, character: { characterId: 'player', skins: {} } });
    expect(migrated['character']).toEqual({ characterId: 'player', skins: {} });
    expect(migrated['character']).not.toBeNull();
  });

  it('leaves a key it cannot un-spell alone, so the validator names it', () => {
    /*
     * `hair-1` is not in the image of the rule the workaround applied — a rig
     * slot named `hair1` kebabs to `hair1` — so it can only come from a
     * hand-edited file. Converting it would produce `hair-1` again, which the
     * schema refuses; half-converting the document would lose a slot silently.
     * The step touches nothing and `validateProgressDocument` says which key,
     * which is this module's rule for input it does not understand.
     */
    const skins = { 'hair-shape': 'coil', 'hair-1': 'brown' };
    const migrated = migrate({ version: 3, character: { characterId: 'player', skins } });
    expect(migrated['version']).toBe(4);
    expect(migrated['character']).toEqual({ characterId: 'player', skins });
  });

  it('leaves two keys that would collide alone rather than dropping one', () => {
    const skins = { 'hair-shape': 'coil', hairShape: 'fringe' };
    const migrated = migrate({ version: 3, character: { characterId: 'player', skins } });
    expect(migrated['character']).toEqual({ characterId: 'player', skins });
  });

  it('does not mutate the document it was given', () => {
    const before = { version: 3, character: version3Character() };
    migrate(before);
    expect(before.version).toBe(3);
    expect(before.character).toEqual(version3Character());
  });

  it('carries every other property through untouched', () => {
    const migrated = migrate({
      version: 3,
      character: version3Character(),
      levels: [{ levelId: 'ottawa' }],
      reviews: [{ questionId: 'gov-01' }],
      exams: [{ passed: true }],
      examInProgress: null,
    });
    expect(migrated['levels']).toEqual([{ levelId: 'ottawa' }]);
    expect(migrated['reviews']).toEqual([{ questionId: 'gov-01' }]);
    expect(migrated['exams']).toEqual([{ passed: true }]);
    expect(migrated['examInProgress']).toBeNull();
  });
});
