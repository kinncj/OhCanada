/**
 * What the domain reads off a level: where the player starts, what can be
 * engaged, and which levels are open.
 */

import { describe, expect, it } from 'vitest';

import {
  journeyLevelIds,
  levelOffersQuest,
  poiById,
  questAtPoi,
  questGivenBy,
  spawnPoint,
  unlockedLevelIds,
  unmappedLevelIds,
  unreachableLevelIds,
} from '@domain/entities/level';
import type { Journey, Level, UnlockRules } from '@domain/entities/level';
import type { LevelId } from '@domain/ids';
import gameConfig from '@content/game.config.json';

import {
  characterId,
  levelId,
  makeLevel,
  poiId,
  questId,
  seededRandomSource,
} from '../../support/fixtures';

const level: Level = makeLevel();

describe('reading a level', () => {
  it('answers where the skater starts, which TN-SAVE-02 asks on every reload', () => {
    expect(spawnPoint(level)).toEqual({ x: 240, y: 1500 });
  });

  it('finds a landmark, and the quest it belongs to', () => {
    expect(poiById(level, poiId())?.name.en).toBe('Parliament Hill');
    expect(poiById(level, poiId('rideau-canal'))).toBeUndefined();
    expect(questAtPoi(level, poiId())).toBe(questId());
    expect(questAtPoi(level, poiId('rideau-canal'))).toBeUndefined();
  });

  it('finds the quest a character gives', () => {
    expect(questGivenBy(level, characterId())).toBe(questId());
    expect(questGivenBy(level, characterId('skater'))).toBeUndefined();
  });

  it('knows which quests belong to it', () => {
    expect(levelOffersQuest(level, questId())).toBe(true);
    expect(levelOffersQuest(level, questId('quebec-city-walls'))).toBe(false);
  });
});

describe('unlocking (game.config unlockRules)', () => {
  const rules: UnlockRules = {
    initialLevels: [levelId('ottawa')],
    order: [levelId('ottawa'), levelId('halifax'), levelId('victoria')],
    stampsToUnlockNext: 1,
  };

  it('opens the initial levels and nothing else', () => {
    expect(unlockedLevelIds(rules, [])).toEqual(['ottawa']);
  });

  it('opens the next level when the stamp is earned', () => {
    expect(unlockedLevelIds(rules, [levelId('ottawa')])).toEqual(['ottawa', 'halifax']);
    expect(unlockedLevelIds(rules, [levelId('ottawa'), levelId('halifax')])).toEqual([
      'ottawa',
      'halifax',
      'victoria',
    ]);
  });

  it('does not open a later level before an earlier one', () => {
    // A stamp for a level that is not open yet cannot happen in play; if a save
    // claims it, the stamped level stays open — a stamp is proof it was played
    // (ADR-0068 §9) — and the order still holds for everything else rather than
    // opening the map.
    expect(unlockedLevelIds(rules, [levelId('victoria')])).toEqual(['ottawa', 'victoria']);
  });

  it('charges the full price for each unlock', () => {
    const expensive: UnlockRules = { ...rules, stampsToUnlockNext: 2 };
    expect(unlockedLevelIds(expensive, [levelId('ottawa')])).toEqual(['ottawa']);
  });

  it('refuses to be talked into a free map by a config typo', () => {
    const free: UnlockRules = { ...rules, stampsToUnlockNext: 0 };
    expect(unlockedLevelIds(free, [])).toEqual(['ottawa']);
    expect(unlockedLevelIds(free, [levelId('ottawa')])).toEqual(['ottawa', 'halifax']);
  });
});

describe('a chain that can never be walked (OQ-MAP-2)', () => {
  /*
   * The defect this block is written against shipped: `order` began at
   * `halifax`, `initialLevels` named only `ottawa`, and the walk breaks at the
   * first level it cannot open — so it broke at index 0 and no stamp ever
   * unlocked anything. The map looked fine. Every test passed. Québec City had
   * art, a level document and no route to it.
   */
  const dead: UnlockRules = {
    initialLevels: [levelId('ottawa')],
    order: [levelId('halifax'), levelId('quebec-city'), levelId('ottawa')],
    stampsToUnlockNext: 1,
  };

  it('names every level the chain can never open, however the player plays', () => {
    expect(unreachableLevelIds(dead)).toEqual(['halifax', 'quebec-city']);
  });

  it('is empty for a chain that starts where the player starts', () => {
    const live: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('quebec-city')],
      stampsToUnlockNext: 1,
    };
    expect(unreachableLevelIds(live)).toEqual([]);
  });

  it('counts a level that costs more stamps than the chain can ever pay', () => {
    const steep: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('quebec-city'), levelId('halifax')],
      stampsToUnlockNext: 2,
    };
    /* Two stamps to open the second level, and only one level can be stamped
       before it. Nothing after `ottawa` is ever reachable. */
    expect(unreachableLevelIds(steep)).toEqual(['quebec-city', 'halifax']);
  });

  it('is empty for a chain nobody has written yet', () => {
    expect(
      unreachableLevelIds({ initialLevels: [], order: [], stampsToUnlockNext: 1 }),
    ).toEqual([]);
  });
});

describe('the chain and the map are the same ten places (TN-MAP-01)', () => {
  const journey: Journey = [
    levelId('halifax'),
    null,
    levelId('quebec-city'),
    levelId('ottawa'),
  ];

  it('names a level the rules can open that no slot on the map shows', () => {
    const rules: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('yellowknife')],
      stampsToUnlockNext: 1,
    };
    expect(unmappedLevelIds(rules, journey)).toEqual(['yellowknife']);
  });

  it('checks the levels that are open from the first frame too', () => {
    const rules: UnlockRules = {
      initialLevels: [levelId('atlantis')],
      order: [levelId('ottawa')],
      stampsToUnlockNext: 1,
    };
    expect(unmappedLevelIds(rules, journey)).toEqual(['atlantis']);
  });

  it('is empty when every id the rules name has a place on the map', () => {
    const rules: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('quebec-city')],
      stampsToUnlockNext: 1,
    };
    expect(unmappedLevelIds(rules, journey)).toEqual([]);
  });

  it('reads the ids off the map, skipping the slots whose id is not fixed', () => {
    /* Levels 2 and 10 have no id (`TN-LEVELS`, `docs/content-review.md` §1).
       A slot with no id is a place, not a level, and names nothing. */
    expect(journeyLevelIds(journey)).toEqual(['halifax', 'quebec-city', 'ottawa']);
  });
});

/**
 * ADR-0068 §9: inserting a level into `order` never re-locks a level a save
 * could already open.
 *
 * `legacyWalk` is the walk as it stood before the obligation, kept here as the
 * counterfactual: each fixture below is asserted to fail on it, so the fixture
 * is known to bite and not merely to pass.
 */
describe('the unlock walk is monotone under insertion (ADR-0068 §9)', () => {
  const legacyWalk = (rules: UnlockRules, stampedIds: readonly LevelId[]): readonly LevelId[] => {
    const stamped = new Set(stampedIds);
    const unlocked = new Set(rules.initialLevels);
    const cost = Math.max(1, Math.floor(rules.stampsToUnlockNext));
    let credit = 0;
    for (const id of rules.order) {
      if (!unlocked.has(id)) {
        if (credit < cost) break;
        credit -= cost;
        unlocked.add(id);
      }
      if (stamped.has(id)) credit += 1;
    }
    return [...unlocked];
  };

  const insertBefore = (rules: UnlockRules, inserted: LevelId, before: LevelId): UnlockRules => {
    const at = rules.order.indexOf(before);
    if (at < 0) throw new Error(`${String(before)} is not in order`);
    return { ...rules, order: [...rules.order.slice(0, at), inserted, ...rules.order.slice(at)] };
  };

  const includesAll = (outer: readonly LevelId[], inner: readonly LevelId[]): boolean =>
    inner.every((id) => outer.includes(id));

  describe("with content/game.config.json's own order, and kingston before ottawa", () => {
    const shipped: UnlockRules = {
      initialLevels: gameConfig.unlockRules.initialLevels.map((id) => levelId(id)),
      order: gameConfig.unlockRules.order.map((id) => levelId(id)),
      stampsToUnlockNext: gameConfig.unlockRules.stampsToUnlockNext,
    };
    const withKingston = insertBefore(shipped, levelId('kingston'), levelId('ottawa'));
    const upToQuebec = [levelId('halifax'), levelId('peggys-cove'), levelId('quebec-city')];

    it('is the shipped chain this fixture assumes', () => {
      expect(shipped.stampsToUnlockNext).toBe(1);
      expect(shipped.order.slice(0, 5)).toEqual([
        'halifax',
        'peggys-cove',
        'quebec-city',
        'ottawa',
        'toronto',
      ]);
    });

    it('keeps Ottawa open when the stamps that opened it now reach Kingston first', () => {
      const before = unlockedLevelIds(shipped, upToQuebec);
      expect(before).toContain('ottawa');

      /* The defect, on the old walk: the credit goes to Kingston and Ottawa locks. */
      expect(legacyWalk(withKingston, upToQuebec)).not.toContain('ottawa');

      const after = unlockedLevelIds(withKingston, upToQuebec, before);
      expect(includesAll(after, before)).toBe(true);
      expect(after).toContain('kingston');
      expect(after).toContain('ottawa');
      expect(after).not.toContain('toronto');
    });

    it('keeps a stamped Ottawa, and what its stamp opened, even with nothing remembered', () => {
      const stamps = [...upToQuebec, levelId('ottawa')];
      const before = unlockedLevelIds(shipped, stamps);
      expect(before).toContain('toronto');

      /* Worse on the old walk: it stops at the first level it cannot open, so a
         level the player has finished locks, and so does the one after it. */
      const legacy = legacyWalk(withKingston, stamps);
      expect(legacy).not.toContain('ottawa');
      expect(legacy).not.toContain('toronto');

      expect(includesAll(unlockedLevelIds(withKingston, stamps, before), before)).toBe(true);
      expect(unlockedLevelIds(withKingston, stamps)).toEqual(
        expect.arrayContaining(['kingston', 'ottawa', 'toronto']),
      );
    });

    it('lets play carry on past the inserted level', () => {
      const remembered = unlockedLevelIds(
        withKingston,
        upToQuebec,
        unlockedLevelIds(shipped, upToQuebec),
      );
      const stamps = [...upToQuebec, levelId('kingston'), levelId('ottawa')];
      expect(unlockedLevelIds(withKingston, stamps, remembered)).toContain('toronto');
    });
  });

  it('spends credit on a remembered level it can pay for, so memory opens nothing extra', () => {
    /* Were a remembered level passed free, each reload would leave one stamp
       unspent and open one more level: one stamp would open the map. */
    const rules: UnlockRules = {
      initialLevels: [levelId('a')],
      order: ['a', 'b', 'c', 'd'].map((id) => levelId(id)),
      stampsToUnlockNext: 1,
    };
    const once = unlockedLevelIds(rules, [levelId('a')]);
    expect(once).toEqual(['a', 'b']);
    expect(unlockedLevelIds(rules, [levelId('a')], once)).toEqual(['a', 'b']);
  });

  it('holds over random orders, stamps, costs and chained insertions (seeded)', () => {
    const random = seededRandomSource(0x0068_0009);
    const pool = Array.from({ length: 14 }, (_unused, index) => levelId(`place-${String(index)}`));
    let insertions = 0;
    let legacyBroken = 0;

    for (let trial = 0; trial < 400; trial += 1) {
      const size = random.int(2, 10);
      const shuffled = random.shuffle(pool);
      const order = shuffled.slice(0, size);
      const spare = shuffled.slice(size);
      const first = order[0] as LevelId;
      const initialLevels =
        random.next() < 0.2 ? [first, random.pick(order) as LevelId] : [first];
      let rules: UnlockRules = { initialLevels, order, stampsToUnlockNext: random.int(1, 4) };

      /* A save, played: each stamp lands on a level that is open, and the set the
         rules open is persisted and fed back after every one. */
      const stamps: LevelId[] = [];
      let remembered = unlockedLevelIds(rules, stamps, []);
      const play = (turns: number): void => {
        for (let turn = 0; turn < turns; turn += 1) {
          const next = random.pick(remembered.filter((id) => !stamps.includes(id)));
          if (next === undefined) return;
          stamps.push(next);
          const opened = unlockedLevelIds(rules, stamps, remembered);
          /* Persisting and feeding back is a fixed point: memory opens nothing. */
          expect(unlockedLevelIds(rules, stamps, opened)).toEqual(opened);
          remembered = opened;
        }
      };
      play(random.int(0, 12));

      /* Before any insertion, memory changes nothing for a save played in order. */
      expect(new Set(remembered)).toEqual(new Set(legacyWalk(rules, stamps)));

      for (let chained = random.int(1, 4); chained > 0 && spare.length > 0; chained -= 1) {
        const inserted = spare.shift() as LevelId;
        const at = random.int(1, rules.order.length + 1);
        const longer: UnlockRules = {
          ...rules,
          order: [...rules.order.slice(0, at), inserted, ...rules.order.slice(at)],
        };

        if (!includesAll(legacyWalk(longer, stamps), legacyWalk(rules, stamps))) legacyBroken += 1;

        const before = remembered;
        const after = unlockedLevelIds(longer, stamps, before);
        expect(
          includesAll(after, before),
          `trial ${String(trial)}: inserting ${String(inserted)} at ${String(at)} into ` +
            `[${rules.order.join(', ')}] at cost ${String(rules.stampsToUnlockNext)} with stamps ` +
            `[${stamps.join(', ')}] locked [${before.filter((id) => !after.includes(id)).join(', ')}]`,
        ).toBe(true);
        insertions += 1;

        rules = longer;
        remembered = after;
        play(random.int(0, 4));
      }
    }

    expect(insertions).toBeGreaterThan(400);
    /* The loop has teeth: the walk it replaces fails the same property. */
    expect(legacyBroken).toBeGreaterThan(0);
  });
});
