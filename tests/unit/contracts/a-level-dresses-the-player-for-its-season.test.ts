/**
 * A level's `playerCostume` is the costume its art sheet states, and one the rig
 * can draw the player in.
 *
 * A live-site audit photographed the player in a parka, a scarf and mitts on
 * every level, the late-summer ones included, because nothing let a level say
 * otherwise: the scene dressed the player in the rig artboard's own `skins`, and
 * those say `parka`. The season was never undecided. Each
 * `assets/style/<id>-level.md` states it, and since 2026-09-14 each one names the
 * player's costume beside its weather, in one of the sheets' two forms:
 *
 *   - a `| player costume | \`<costume>\`` row in the treatment table, or
 *   - a `**Player costume: \`<costume>\`**` sentence beside "No falling weather".
 *
 * A sheet must make exactly one such statement, and the document must agree with
 * it. The same gate holds the other half: every costume the schema lets a level
 * choose is a rig `costume` option, is not another artboard's pinned costume, and
 * draws every body part the player's default costume draws. A level cannot dress
 * the player as the officer, or in a costume with no torso.
 *
 * Two suites, as `a-level-snows-only-where-its-art-sheet-says.test.ts` has: the
 * fixtures prove the reader rejects what it should, so a reader that stopped
 * matching anything cannot pass the corpus by reading nothing.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;
const STYLE_DIR = `${REPO_ROOT}assets/style`;

interface RigDoc {
  readonly artboards: readonly {
    readonly characterId: string;
    readonly skins: Readonly<Record<string, string>>;
    readonly playerSelectableSlots: readonly string[];
  }[];
  readonly slots: Readonly<Record<string, { readonly options: readonly string[] }>>;
  readonly parts: readonly { readonly name: string; readonly frame: string }[];
  readonly atlas: { readonly framePrefix: string };
  readonly frames: Readonly<Record<string, unknown>>;
}

const rig = JSON.parse(readFileSync(`${REPO_ROOT}content/characters/rig.json`, 'utf8')) as RigDoc;
const offered = (
  JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/level.schema.json`, 'utf8')) as {
    readonly properties: { readonly playerCostume: { readonly enum: readonly string[] } };
  }
).properties.playerCostume.enum;

/** Every statement about the player's costume a sheet makes, in the sheets' own two forms. */
const statementsIn = (sheet: string): readonly string[] =>
  [
    ...sheet.matchAll(/^\|\s*player costume\s*\|\s*`([a-z-]+)`/gimu),
    ...sheet.matchAll(/\*\*Player costume: `([a-z-]+)`\*\*/giu),
  ].map((match) => match[1] ?? '');

const levelIds = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort();

describe("the reader finds what a sheet says the player wears", () => {
  it('reads the treatment-table row', () => {
    expect(statementsIn('| falling weather | **none** |\n| player costume | `jacket`: because. | — |\n')).toEqual([
      'jacket',
    ]);
  });

  it('reads the sentence beside the weather', () => {
    expect(statementsIn('**No falling weather.** **Player costume: `parka`**: because.')).toEqual(['parka']);
  });

  it('does not read a costume into a sheet that only mentions one', () => {
    const prose = 'six people in winter coats, a parka, and a `jacket` on a hook.\n| player | `parka` |\n';
    expect(statementsIn(prose)).toEqual([]);
  });

  it('reports a sheet that says two things, so a contradiction cannot pick a side', () => {
    const both = '| player costume | `parka` |\n**Player costume: `jacket`**\n';
    expect(statementsIn(both)).toHaveLength(2);
  });
});

describe('every costume a level may choose is one the rig draws for the player', () => {
  const player = rig.artboards.find((artboard) => artboard.playerSelectableSlots.length > 0);
  const costumeOnly = rig.parts.filter((part) =>
    [...part.frame.matchAll(/\{(\w+)\}/gu)].every((match) => match[1] === 'costume'),
  );
  const drawn = (part: { readonly frame: string }, costume: string): boolean =>
    `${rig.atlas.framePrefix}${part.frame.replaceAll('{costume}', costume)}` in rig.frames;

  it('there is a player artboard and a choice to make', () => {
    expect(player, 'no rig artboard offers the creator a slot, so nobody is the player').toBeDefined();
    expect(offered.length).toBeGreaterThan(1);
  });

  it.each(offered)('%s is a rig costume option', (costume) => {
    expect(rig.slots['costume']?.options ?? []).toContain(costume);
  });

  it.each(offered)("%s is not another character's costume", (costume) => {
    const others = rig.artboards
      .filter((artboard) => artboard !== player)
      .map((artboard) => artboard.skins['costume'])
      .filter((value): value is string => value !== undefined);
    expect(others, `a level could dress the player as another character, in "${costume}"`).not.toContain(costume);
  });

  it.each(offered)('%s draws every body part the player artboard draws by default', (costume) => {
    const fallback = player?.skins['costume'] ?? '';
    const missing = costumeOnly
      .filter((part) => drawn(part, fallback) && !drawn(part, costume))
      .map((part) => part.name);
    expect(missing, `the player in "${costume}" would have no ${missing.join(', ')}`).toEqual([]);
  });
});

describe("every level dresses the player as its art sheet says", () => {
  it('there are levels, so this suite is not measuring an empty directory', () => {
    expect(levelIds.length).toBeGreaterThan(0);
  });

  it.each(levelIds)('%s', (id) => {
    const sheetPath = `${STYLE_DIR}/${id}-level.md`;
    expect(existsSync(sheetPath), `assets/style/${id}-level.md does not exist, so nothing says what ${id}'s player wears`).toBe(
      true,
    );

    const statements = statementsIn(readFileSync(sheetPath, 'utf8'));
    expect(
      statements,
      `assets/style/${id}-level.md must name the player's costume exactly once - a "| player costume | \`<costume>\`" ` +
        `row or a "**Player costume: \`<costume>\`**" sentence - and it names ` +
        `${statements.length === 0 ? 'none' : statements.join(' and ')}.`,
    ).toHaveLength(1);

    const document = JSON.parse(readFileSync(`${LEVELS_DIR}/${id}.json`, 'utf8')) as {
      readonly playerCostume?: unknown;
    };
    expect(
      document.playerCostume,
      `content/levels/${id}.json dresses the player in ${JSON.stringify(document.playerCostume)}, and its art ` +
        `sheet says ${String(statements[0])}. The sheet is where the season is decided.`,
    ).toBe(statements[0]);
  });
});
