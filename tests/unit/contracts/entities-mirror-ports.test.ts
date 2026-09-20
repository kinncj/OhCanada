/**
 * The domain entities mirror the schemas, by way of the ports.
 *
 * `ports-match-schemas.test.ts` already pins every port document type to
 * `content/schemas/*.schema.json`, property by property and type by type. This
 * file closes the other half of the chain: a document that came through the
 * content port is *assignable* to the domain entity that reads it, with no
 * mapping function in between. Put together — schema ≡ port, port ⊆ entity — a
 * domain entity that renamed a property, changed a value type or invented a
 * shape stops compiling here, which is the only place it could be caught: the
 * contract test cannot see `app/domain` and the domain cannot import the port
 * (`domain-is-pure`).
 *
 * The functions below are the assertion. Each one is the identity, typed
 * `document -> entity`; if the two shapes ever diverge, `make typecheck` fails
 * on this file with the property that moved. The runtime expectations then prove
 * these really are identities — no copy, no default, no coercion — because a
 * mapping layer is exactly what this arrangement exists to avoid.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type {
  CharacterDocument,
  LevelDocument,
  QuestDocument,
  QuestStepDocument,
  QuestionDocument,
} from '@application/ports/content-repository';
import type {
  PlayerCharacterDocument,
  ProgressSnapshot,
  SettingsDocument,
  VolumeSettings as VolumeSettingsDocument,
} from '@application/ports/progress-repository';

import type { Character, PlayerCharacter } from '@domain/entities/character';
import type { Level } from '@domain/entities/level';
import type { Player, Settings, VolumeSettings } from '@domain/entities/player';
import type { Progress } from '@domain/entities/progress';
import type { Quest, QuestStep, QuestStepKind } from '@domain/entities/quest';
import type { Question } from '@domain/entities/question';

import { spawnPoint } from '@domain/entities/level';

import { locale, makeCharacter, makeQuest, makeQuestion } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * The real level document, not a fixture: this assertion is about whether an
 * authored file reaches a domain rule unchanged, and a fixture written to fit
 * the type would prove only that it fits itself. `make validate-content` is what
 * holds the file to `level.schema.json`.
 */
const ottawa = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/ottawa.json`, 'utf8'),
) as LevelDocument;

/* -------------------------------------------------------------------------- */
/* content documents                                                          */
/* -------------------------------------------------------------------------- */

const asQuestion = (document: QuestionDocument): Question => document;
const asQuest = (document: QuestDocument): Quest => document;
const asQuestStep = (document: QuestStepDocument): QuestStep => document;

/**
 * The step-kind vocabulary, pinned in **both** directions — ADR-0063.
 *
 * Everywhere else in this file the relation is port ⊆ entity, because a document
 * flowing into a domain rule is the direction that matters. For this union that
 * is not enough, and ADR-0063 recorded exactly why: the vocabulary is stated
 * four times, `app/domain` cannot import the port so it has to restate it, and
 * one-way assignability would let the domain grow a kind the schema has never
 * heard of. Two identity functions in opposite directions is mutual
 * assignability, which for a union of string literals is equality — so the two
 * lists are the same list or `make typecheck` fails here.
 *
 * ADR-0063 predicted this would be latent and was wrong: adding `read` to the
 * port alone broke `tests/unit/domain/entities/quest.test.ts`, a file that looks
 * unrelated to the change, because a `QuestDocument` is passed where a domain
 * `Quest` is expected. The duplication has teeth; what it lacked was a place
 * where the failure *names the vocabulary*. This is that place.
 */
const asDomainStepKind = (kind: QuestStepDocument['kind']): QuestStepKind => kind;
const asPortStepKind = (kind: QuestStepKind): QuestStepDocument['kind'] => kind;
const asCharacter = (document: CharacterDocument): Character => document;
const asLevel = (document: LevelDocument): Level => document;

/* -------------------------------------------------------------------------- */
/* save documents                                                             */
/* -------------------------------------------------------------------------- */

const asPlayerCharacter = (document: PlayerCharacterDocument): PlayerCharacter => document;
const asSettings = (document: SettingsDocument): Settings => document;
const asVolumes = (document: VolumeSettingsDocument): VolumeSettings => document;
/**
 * The save document is *not* assignable to `Progress` — its instants are
 * `IsoInstant` and the domain's are `EpochMillis` — but its two untimed halves
 * are, and `Player` is the view `Progress` and the document share. That is the
 * whole of the difference ADR-0012 records, stated as a type.
 */
const asPlayer = (document: Pick<ProgressSnapshot, 'character' | 'settings'>): Player => document;

describe('a content document is the domain entity that reads it', () => {
  it('passes a question straight through', () => {
    const document = makeQuestion('gov-01');
    expect(asQuestion(document)).toBe(document);
  });

  it('passes a quest and its steps straight through', () => {
    const document = makeQuest();
    expect(asQuest(document)).toBe(document);
    const step = document.steps[0];
    expect(step).toBeDefined();
    if (step !== undefined) expect(asQuestStep(step)).toBe(step);
  });

  it('spells a step kind the same way in the port and in the domain', () => {
    /*
     * The assertion is the two functions above, at compile time. This runs them
     * so the pin is exercised rather than merely declared, and it names `read`
     * specifically: it is the kind ADR-0063 added, and the one that reached the
     * schema and the port while `app/bootstrap/quests.ts` still refused it.
     */
    expect(asDomainStepKind('read')).toBe('read');
    expect(asPortStepKind('read')).toBe('read');
    for (const kind of ['talk', 'visit', 'collect', 'answer', 'read'] as const) {
      expect(asPortStepKind(asDomainStepKind(kind))).toBe(kind);
    }
  });

  it('passes a character straight through', () => {
    const document = makeCharacter();
    expect(asCharacter(document)).toBe(document);
  });

  it('passes an authored level straight through to the rules that read it', () => {
    expect(asLevel(ottawa)).toBe(ottawa);
    expect(spawnPoint(asLevel(ottawa))).toBe(ottawa.spawn);
    expect(asLevel(ottawa).pois.length).toBe(ottawa.pois.length);
  });
});

describe('a save document is the player half of progress', () => {
  it('passes the character, the settings and the volumes straight through', () => {
    const character: PlayerCharacterDocument = { characterId: makeCharacter().id, skins: {} };
    expect(asPlayerCharacter(character)).toBe(character);

    const settings: SettingsDocument = {
      locale: locale('fr'),
      autoMove: false,
      singleSwitch: false,
      holdToChooseMs: 600,
      reducedMotion: false,
      highContrast: false,
      dyslexiaFont: false,
      textScale: 1,
      subtitles: true,
      volumes: { master: 1, music: 1, sfx: 1, voice: 1 },
    };
    expect(asSettings(settings)).toBe(settings);
    expect(asVolumes(settings.volumes)).toBe(settings.volumes);
    expect(asPlayer({ character, settings })).toMatchObject({ character, settings });
  });
});

describe('the domain aggregate is a player', () => {
  it('reads a Progress wherever a Player is asked for', () => {
    const readPlayer = (player: Player): PlayerCharacter | null => player.character;
    const progress: Progress = {
      character: null,
      settings: {
        locale: locale('en'),
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
      levels: [],
      lastPlayedLevelId: null,
      reviews: [],
      subjectsStarted: [],
      exams: [],
      examInProgress: null,
    };
    expect(readPlayer(progress)).toBeNull();
  });
});
