/**
 * A quest's giver, and every line's speaker, resolves to exactly one thing the
 * level places — ADR-0029.
 *
 * `quest.giver` and `dialogueLine.speaker` used to be `characterId`, which said
 * *a quest is offered by somebody* in the type system. Two levels may draw no
 * figure of any kind at any scale (`assets/style/peggys-cove-level.md` §0,
 * `assets/style/the-north-level.md` §0), so those two levels could hold no quest
 * at all. ADR-0029 widened both fields to an unbranded id naming an
 * **engageable**: a character the level places, or a point of interest on it —
 * a plaque, an interpretive panel, a marker.
 *
 * Widening a reference is only safe if something resolves it, and JSON Schema
 * cannot: the quest document does not know what its level placed. So this file
 * is the other half of that ADR, and it is written the way ADR-0024 §4 asks for
 * — **a claim checked against another claim**, two documents that must agree,
 * with no corpus walk that could pass over nothing.
 *
 * The resolution rule is deliberately *exactly one* rather than `find`, `some`
 * or `filter`. Those reduce an empty collection to `undefined`, `false` or `[]`,
 * and two of those read as an answer. "Exactly one" has no success-shaped
 * identity element: zero matches is a **dangling** giver and two matches is an
 * **ambiguous** one, and the failure names which.
 *
 * It also closes two things that were unheld:
 *
 * 1. `quest.schema.json#/properties/levelId` claimed `validate-content`
 *    cross-checked the quest against its level's `quests[]`. It never did.
 * 2. `a-quest-line-is-complete-and-sourced.test.ts` records, honestly, that *"a
 *    line whose speaker the level does not place"* was an open obligation on
 *    ADR-0010. It is held here, for characters and landmarks alike.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const QUESTS = `${REPO_ROOT}content/quests`;
const LEVELS = `${REPO_ROOT}content/levels`;
const CHARACTERS = `${REPO_ROOT}content/characters`;

type Json = Record<string, unknown>;

const read = (path: string): Json => JSON.parse(readFileSync(path, 'utf8')) as Json;

const questFiles = readdirSync(QUESTS).filter((name) => name.endsWith('.json'));
const levelFiles = readdirSync(LEVELS).filter((name) => name.endsWith('.json'));

const quests = questFiles.map((file) => ({ file, document: read(`${QUESTS}/${file}`) }));
const levels = new Map(
  levelFiles.map((file) => {
    const document = read(`${LEVELS}/${file}`);
    return [String(document['id']), document] as const;
  }),
);

/** What a level places that a player can engage, with the kind the level gave it. */
type Placement = { readonly id: string; readonly kind: 'character' | 'landmark'; readonly questId?: string };

/**
 * The two lists, read apart and then concatenated.
 *
 * This is the whole of ADR-0029's "the kind is resolved from the placement": the
 * level is the document that knows, so the quest does not restate it and cannot
 * contradict it.
 */
function placementsOn(level: Json): readonly Placement[] {
  const characters = (level['characters'] as Json[] | undefined) ?? [];
  const pois = (level['pois'] as Json[] | undefined) ?? [];
  return [
    ...characters.map((placement) => ({
      id: String(placement['characterId']),
      kind: 'character' as const,
      ...(typeof placement['questId'] === 'string' ? { questId: placement['questId'] } : {}),
    })),
    ...pois.map((placement) => ({
      id: String(placement['id']),
      kind: 'landmark' as const,
      ...(typeof placement['questId'] === 'string' ? { questId: placement['questId'] } : {}),
    })),
  ];
}

type Resolution =
  | { readonly ok: true; readonly placement: Placement }
  | { readonly ok: false; readonly why: 'dangling' | 'ambiguous'; readonly count: number };

/** Exactly one, or a named failure. Never `undefined`, which is the point. */
function resolve(level: Json, id: string): Resolution {
  const matches = placementsOn(level).filter((placement) => placement.id === id);
  if (matches.length === 1) return { ok: true, placement: matches[0]! };
  return { ok: false, why: matches.length === 0 ? 'dangling' : 'ambiguous', count: matches.length };
}

/** Every line a quest document carries, wherever it carries it. */
function linesOf(quest: Json): readonly { readonly at: string; readonly line: Json }[] {
  const lines: { at: string; line: Json }[] = [];
  for (const field of ['declinedLine', 'reminderLine', 'afterLine', 'doneLine']) {
    const line = quest[field];
    if (line !== undefined && line !== null) lines.push({ at: field, line: line as Json });
  }
  for (const [index, rawStep] of ((quest['steps'] as Json[] | undefined) ?? []).entries()) {
    for (const [lineIndex, line] of ((rawStep['dialogue'] as Json[] | undefined) ?? []).entries()) {
      lines.push({ at: `steps[${String(index)}].dialogue[${String(lineIndex)}]`, line });
    }
  }
  return lines;
}

/** Counters, so a gate that resolved nothing cannot report a pass (ADR-0024). */
let giversResolved = 0;
let speakersResolved = 0;

describe('a quest giver is something the level places, and the level says which kind', () => {
  it('is judging a real corpus, not an empty one', () => {
    expect(quests.length).toBeGreaterThan(0);
    expect(levels.size).toBeGreaterThan(0);
  });

  it('names a level that exists and that lists it back', () => {
    for (const { file, document } of quests) {
      const levelId = String(document['levelId']);
      const level = levels.get(levelId);
      expect(level, `${file}: levelId "${levelId}" names no level document`).toBeDefined();
      const listed = (level?.['quests'] as string[] | undefined) ?? [];
      expect(
        listed,
        `${file}: ${levelId} does not list "${String(document['id'])}" in quests[]`,
      ).toContain(String(document['id']));
    }
  });

  it('lists no quest on a level that no quest document claims', () => {
    // The other direction. A level naming a quest that does not exist would load
    // a level whose tracker points at nothing.
    const claimed = new Map(quests.map(({ document }) => [String(document['id']), String(document['levelId'])]));
    for (const [levelId, level] of levels) {
      for (const questId of (level['quests'] as string[] | undefined) ?? []) {
        expect(claimed.get(questId), `${levelId}: quests[] names "${questId}", which no document claims`).toBe(
          levelId,
        );
      }
    }
  });

  it('resolves every giver to exactly one placement, which claims the quest back', () => {
    for (const { file, document } of quests) {
      const level = levels.get(String(document['levelId']))!;
      const giver = String(document['giver']);
      const resolution = resolve(level, giver);
      expect(
        resolution.ok,
        resolution.ok
          ? ''
          : `${file}: giver "${giver}" is ${resolution.why} — ${String(resolution.count)} placements on ` +
            `${String(document['levelId'])} carry that id (characters[].characterId and pois[].id together)`,
      ).toBe(true);
      if (!resolution.ok) continue;
      giversResolved += 1;
      expect(
        resolution.placement.questId,
        `${file}: "${giver}" is placed on ${String(document['levelId'])} but does not declare ` +
          `questId "${String(document['id'])}", so the level does not agree that it gives this quest`,
      ).toBe(String(document['id']));
    }
  });

  it('resolves every speaker on the same level, and a landmark speaker carries no expression', () => {
    for (const { file, document } of quests) {
      const level = levels.get(String(document['levelId']))!;
      for (const { at, line } of linesOf(document)) {
        const speaker = String(line['speaker']);
        const resolution = resolve(level, speaker);
        expect(
          resolution.ok,
          resolution.ok ? '' : `${file} ${at}: speaker "${speaker}" is ${resolution.why}`,
        ).toBe(true);
        if (!resolution.ok) continue;
        speakersResolved += 1;

        if (resolution.placement.kind === 'landmark') {
          /* A plaque has no face and no mood. `expression: "happy"` on one is the
             small lie ADR-0029 refuses to let propagate into ICharacterRenderer
             and the dialogue UI. */
          expect(
            line['expression'],
            `${file} ${at}: "${speaker}" is a point of interest, and a point of interest has no rig ` +
              `to pose. Drop the expression.`,
          ).toBeUndefined();
        } else {
          /* And a character speaker must actually have a rig to pose. */
          expect(
            existsSync(`${CHARACTERS}/${speaker}.json`),
            `${file} ${at}: "${speaker}" is placed as a character but has no content/characters/${speaker}.json`,
          ).toBe(true);
        }
      }
    }
  });

  it('resolved something, so a pass here is evidence rather than a vacuum', () => {
    // ADR-0024's floor, on this gate's own summary. Ordered last so the counters
    // above have run; if the corpus ever empties, this is what says so.
    expect(giversResolved).toBeGreaterThan(0);
    expect(speakersResolved).toBeGreaterThan(0);
  });
});

/**
 * Each rule above, proved by a document that breaks it.
 *
 * ADR-0024: a check is proved by making it fail, not by trusting that it would.
 * The fixtures are synthesised rather than left on disk, so the repository stays
 * green while the gate stays exercised.
 */
describe('and the rule fails when it is broken', () => {
  const level = (placements: {
    characters?: { characterId: string; questId?: string }[];
    pois?: { id: string; questId?: string }[];
  }): Json => ({
    id: 'somewhere',
    quests: ['a-quest'],
    characters: placements.characters ?? [],
    pois: placements.pois ?? [],
  });

  it('reports a giver no placement carries as dangling, with the count', () => {
    const result = resolve(level({ pois: [{ id: 'a-plaque' }] }), 'a-keeper');
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.why).toBe('dangling');
    expect(result.ok ? -1 : result.count).toBe(0);
  });

  it('reports a giver two placements carry as ambiguous, rather than picking one', () => {
    const collision = level({
      characters: [{ characterId: 'the-light' }],
      pois: [{ id: 'the-light' }],
    });
    const result = resolve(collision, 'the-light');
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.why).toBe('ambiguous');
    expect(result.ok ? -1 : result.count).toBe(2);
  });

  it('tells a landmark giver from a character giver by the list it was placed in', () => {
    const both = level({ characters: [{ characterId: 'guide' }], pois: [{ id: 'a-plaque' }] });
    const asCharacter = resolve(both, 'guide');
    const asLandmark = resolve(both, 'a-plaque');
    expect(asCharacter.ok && asCharacter.placement.kind).toBe('character');
    expect(asLandmark.ok && asLandmark.placement.kind).toBe('landmark');
  });

  it('finds a placement that does not claim the quest back', () => {
    const resolution = resolve(level({ pois: [{ id: 'a-plaque', questId: 'another-quest' }] }), 'a-plaque');
    expect(resolution.ok && resolution.placement.questId).toBe('another-quest');
    // The assertion in the live case compares this to the quest's own id, so a
    // plaque claiming a different quest fails there.
  });

  it('collects every line a quest carries, so no moment escapes the speaker rule', () => {
    const quest: Json = {
      declinedLine: { speaker: 'a' },
      reminderLine: { speaker: 'b' },
      afterLine: { speaker: 'c' },
      doneLine: { speaker: 'd' },
      steps: [{ dialogue: [{ speaker: 'e' }, { speaker: 'f' }] }, { kind: 'visit' }],
    };
    expect(linesOf(quest).map(({ line }) => String(line['speaker']))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });
});
