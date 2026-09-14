/**
 * Refusing a claim withholds the claim, not the landmark — ADR-0003 × ADR-0029.
 *
 * ## The defect
 *
 * A verifier rejected the blurb of `content/levels/peggys-cove.json` `/pois/1`,
 * Peggy's Point Lighthouse. That landmark is the level's **quest giver**
 * (ADR-0029: a lighthouse may offer a quest on a level that may draw no figure).
 * The claim filter did exactly what it was built to do with the blurb — the card
 * would not draw it — and then went one step further than anybody meant:
 * `app/bootstrap/main.ts` built the giver resolver's placements from
 * `teachingPois`, so the lighthouse stopped *existing* for naming. The quest
 * could not be offered, every line it speaks was left unsaid, and the console
 * called it "dangling" — "places nothing called peggys-point-light" — which is
 * a different fact from "its claim was refused" printed in the same words.
 *
 * Rejecting one blurb deleted a level's quest.
 *
 * ## What is pinned
 *
 *  1. **The claim is withheld.** The blurb is `null` and the landmark is not a
 *     teaching landmark, so the card has nothing to draw. Unchanged.
 *  2. **The landmark is not.** It is still a placement: resolvable, named from
 *     its own `pois[].name`, and marked `card: 'withheld'` so the state is
 *     readable rather than inferred.
 *  3. **It is still reachable for its quest.** The level declares a quest role
 *     with `pois[].questId`, so the scene keeps it in reach, the prompt offers
 *     it as a place with something to do, and the dialog opens in its name.
 *  4. **A withheld landmark with no quest role is still scenery.** The blurb
 *     path's other promise — never offer a tap that cannot be honoured — holds.
 *  5. **ADR-0024.** "Withheld" and "dangling" are different answers.
 *
 * ## Why the North and not Peggy's Cove
 *
 * Peggy's Cove is the live input and it is being re-verified as this is written,
 * so a test that needed it rejected would pass over nothing the day it is
 * granted. The North is the other level whose giver is a landmark; its
 * sternwheeler is verified today, and this file refuses it **in memory**, one
 * verdict flipped on the real document, both halves asserted.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestController } from '../../../app/bootstrap/quest';
import { readQuest } from '../../../app/bootstrap/quests';
import {
  levelPlacements,
  resolveEngageable,
  whyNotEngageable,
} from '../../../app/bootstrap/engageables';
import { promptTargets } from '../../../app/bootstrap/prompt-targets';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { withQuestState, type Progress } from '@domain/entities/progress';
import { createSettingsStore } from '@ui/settings';
import { text } from '@ui/copy';
import gameConfigJson from '@content/game.config.json';

import { buildPage, type FakePage } from '../ui/support/fake-dom';
import { emptyProgress, flavourFact, ORIGIN, spoken, testClock } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MODES: readonly string[] = (gameConfigJson as { locomotionModes: readonly string[] })
  .locomotionModes;

/* ------------------------------------------------------------- the documents */

const NORTH = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/the-north.json`, 'utf8'),
) as Record<string, unknown>;

const poisOf = (document: Record<string, unknown>): Record<string, unknown>[] =>
  document['pois'] as Record<string, unknown>[];

const indexOf = (id: string): number => {
  const index = poisOf(NORTH).findIndex((poi) => poi['id'] === id);
  if (index < 0) throw new Error(`content/levels/the-north.json no longer places "${id}"`);
  return index;
};

/** The giver: a landmark with a `questId`, which is how the level declares the role. */
const STERNWHEELER = 'yukon-river-sternwheeler';
/** A landmark with no quest role: scenery when its claim is withheld. */
const SPRUCE = 'spruce-stand';
/** A landmark this file gives a quest role to, so the visit path can be asked. */
const DRIFTWOOD = 'driftwood';

const clone = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

/** A verifier's grant: the status, the hash it was granted for, the passage. */
const grant = (poi: Record<string, unknown>): void => {
  const fact = poi['fact'] as Record<string, unknown>;
  const source = fact['source'] as { readonly sourceHash: string; readonly quote?: string };
  fact['verification'] = {
    status: 'verified',
    model: 'a-verifier',
    checkedAt: '2026-09-14T00:00:00Z',
    sourceHash: source.sourceHash,
    evidence: source.quote ?? 'A passage that entails the claim.',
  };
};

const decline = (poi: Record<string, unknown>): void => {
  grant(poi);
  ((poi['fact'] as Record<string, unknown>)['verification'] as Record<string, unknown>)['status'] =
    'rejected';
};

/** The North with every claim granted, then the given edits. */
function north(edit: (pois: Record<string, unknown>[]) => void = () => undefined): SceneLevel {
  const copy = clone(NORTH);
  for (const poi of poisOf(copy)) grant(poi);
  edit(poisOf(copy));
  const parsed = parseLevelDocument(copy, MODES);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

const GRANTED = north();

/** The giver's claim refused. The live Peggy's Cove defect, on another level. */
const GIVER_WITHHELD = north((pois) => {
  const giver = pois[indexOf(STERNWHEELER)];
  if (giver !== undefined) decline(giver);
});

/** A quest target's claim refused, and a landmark with no role refused beside it. */
const TARGET_WITHHELD = north((pois) => {
  const driftwood = pois[indexOf(DRIFTWOOD)];
  const spruce = pois[indexOf(SPRUCE)];
  if (driftwood !== undefined) {
    driftwood['questId'] = 'the-north-sternwheeler';
    decline(driftwood);
  }
  if (spruce !== undefined) decline(spruce);
});

const RAW_GIVER = poisOf(NORTH)[indexOf(STERNWHEELER)] as {
  readonly name: { readonly en: string; readonly fr: string };
  readonly blurb: { readonly en: string; readonly fr: string };
};

/** A quest the sternwheeler gives, that sends the player back to it and to the driftwood. */
const QUEST = (() => {
  const read = readQuest(
    {
      id: 'the-north-sternwheeler',
      levelId: 'the-north',
      giver: STERNWHEELER,
      title: { en: 'Read the boat', fr: 'Lire le bateau' },
      summary: { en: 'You read the boat.', fr: 'Vous avez lu le bateau.' },
      steps: [
        {
          id: 'read-the-plaque',
          kind: 'talk',
          targetId: STERNWHEELER,
          prompt: { en: 'Read the plaque', fr: 'Lisez la plaque' },
          dialogue: [
            {
              speaker: STERNWHEELER,
              text: { en: 'You are standing at the river.', fr: 'Vous êtes au bord du fleuve.' },
              fact: flavourFact(),
            },
          ],
        },
        {
          id: 'walk-to-the-bar',
          kind: 'visit',
          targetId: DRIFTWOOD,
          prompt: { en: 'Walk to the gravel bar', fr: 'Allez au banc de gravier' },
          dialogue: [
            {
              speaker: STERNWHEELER,
              text: { en: 'Look at the wood the river left.', fr: 'Regardez le bois du fleuve.' },
              fact: flavourFact(),
            },
          ],
        },
      ],
    },
    'fixture',
  );
  if (!read.ok) throw new Error(read.error.message);
  return spoken(read.value);
})();

/* ------------------------------------------------------------------ the seam */

interface Harness {
  readonly page: FakePage;
  readonly controller: QuestController;
}

function harnessFor(level: SceneLevel, progress: Progress): Harness {
  const page = buildPage();
  let current = progress;
  const controller = createQuestController({
    levelId: QUEST.levelId,
    quests: [QUEST],
    /* The same helper `app/bootstrap/main.ts` calls, over a parsed level. */
    placements: () => levelPlacements(level),
    host: page.host,
    store: createSettingsStore(),
    clock: testClock(),
    announce: vi.fn(),
    progress: () => current,
    commit: (next) => {
      current = next;
    },
    setTask: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    restoreFocusTo: () => null,
  });
  return { page, controller };
}

const onOffer = (): Progress => emptyProgress();
const atTheBar = (): Progress =>
  withQuestState(emptyProgress(), QUEST.levelId, {
    questId: QUEST.id,
    status: 'active',
    stepIndex: 1,
    stepProgress: 0,
    updatedAt: ORIGIN,
  });

const dialogName = (page: FakePage): string => {
  const dialog = page.doc.byTestId('dialogue');
  if (dialog === null) return '';
  return page.doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent ?? '';
};

const ids = (list: readonly { readonly id: string }[]): readonly string[] =>
  list.map((poi) => String(poi.id));

/* --------------------------------------------------- 1. the claim is withheld */

describe('a refused giver’s claim is withheld', () => {
  it('has no blurb to draw and is not a teaching landmark, and the granted one is', () => {
    const withheld = GIVER_WITHHELD.pois.find((poi) => poi.id === STERNWHEELER);
    const granted = GRANTED.pois.find((poi) => poi.id === STERNWHEELER);

    expect(withheld?.blurb).toBeNull();
    expect(ids(GIVER_WITHHELD.teachingPois)).not.toContain(STERNWHEELER);

    expect(granted?.blurb?.en).toBe(RAW_GIVER.blurb.en);
    expect(ids(GRANTED.teachingPois)).toContain(STERNWHEELER);
  });
});

/* ------------------------------------------------------ 2. the landmark is not */

describe('a refused giver is still placed, and still named', () => {
  it('resolves to the landmark, named from its own pois[].name, with the card marked withheld', () => {
    const resolution = resolveEngageable(levelPlacements(GIVER_WITHHELD), STERNWHEELER);

    expect(
      resolution.ok,
      resolution.ok ? '' : whyNotEngageable(STERNWHEELER, 'the-north', resolution),
    ).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.engageable.kind).toBe('landmark');
    expect(resolution.engageable.name).toEqual(RAW_GIVER.name);
    expect(resolution.engageable.card).toBe('withheld');
  });

  it('is marked as teaching when its claim is granted, so the two states are readable apart', () => {
    const resolution = resolveEngageable(levelPlacements(GRANTED), STERNWHEELER);
    expect(resolution.ok && resolution.engageable.card).toBe('teaches');
  });

  it('keeps every landmark in the placements, refused or not', () => {
    /*
     * The line that was wrong. `main.ts` handed the resolver `teachingPois`, and
     * this is what would have caught it: the placements are every landmark the
     * level places, and a refused claim takes away a card, never a placement.
     */
    const placed = levelPlacements(GIVER_WITHHELD);
    expect(placed).not.toBeNull();
    expect(ids(placed?.pois ?? [])).toEqual(ids(GIVER_WITHHELD.pois));
    expect(ids(placed?.pois ?? [])).toContain(STERNWHEELER);
  });
});

/* --------------------------------------------- 3. still reachable for its quest */

describe('a refused giver is still reachable for its quest', () => {
  it('stays in reach, because the level declares it a quest landmark', () => {
    expect(ids(GIVER_WITHHELD.reachablePois)).toContain(STERNWHEELER);
  });

  it('is offered by the prompt as a place with something to do', () => {
    const { controller } = harnessFor(GIVER_WITHHELD, onOffer());
    const targets = promptTargets(levelPlacements(GIVER_WITHHELD), 'en', {
      done: new Set(),
      canEngage: (id) => controller.canEngage(id),
      awaits: (id) => controller.awaits(id),
    });

    expect(targets[STERNWHEELER]?.prompt).toBe(text('en', 'hud.interact.poi.offer'));
    expect(targets[`poi.${STERNWHEELER}`]).toBeDefined();
  });

  it('opens its quest in its own name, in both languages, and shows no word of the withheld blurb', () => {
    for (const locale of ['en', 'fr'] as const) {
      const { page, controller } = harnessFor(GIVER_WITHHELD, onOffer());
      controller.setLocale(locale);

      expect(controller.canEngage(STERNWHEELER), `[${locale}] the quest cannot be offered`).toBe(true);
      expect(controller.engage(STERNWHEELER), `[${locale}] no dialog opened`).toBe(true);
      expect(dialogName(page)).toBe(RAW_GIVER.name[locale]);

      const everything = page.host.textContent ?? '';
      expect(everything).not.toContain(RAW_GIVER.blurb.en);
      expect(everything).not.toContain(RAW_GIVER.blurb.fr);
    }
  });

  it('opens the same way when the claim is granted, so the check above is not passing by accident', () => {
    const { page, controller } = harnessFor(GRANTED, onOffer());
    expect(controller.engage(STERNWHEELER)).toBe(true);
    expect(dialogName(page)).toBe(RAW_GIVER.name.en);
  });

  it('speaks a visit step’s lines in its name', () => {
    const { page, controller } = harnessFor(GIVER_WITHHELD, atTheBar());
    expect(controller.visited(DRIFTWOOD).speak(vi.fn())).toBe('spoken');
    expect(dialogName(page)).toBe(RAW_GIVER.name.en);
  });
});

describe('a refused quest target is reachable while its step is waiting for it', () => {
  it('stays in reach, and is not a teaching landmark', () => {
    expect(ids(TARGET_WITHHELD.reachablePois)).toContain(DRIFTWOOD);
    expect(ids(TARGET_WITHHELD.teachingPois)).not.toContain(DRIFTWOOD);
  });

  it('is offered while the quest waits for it, and not otherwise', () => {
    const waiting = harnessFor(TARGET_WITHHELD, atTheBar()).controller;
    const notYet = harnessFor(TARGET_WITHHELD, onOffer()).controller;

    expect(waiting.awaits(DRIFTWOOD)).toBe(true);
    expect(notYet.awaits(DRIFTWOOD)).toBe(false);

    const offered = (controller: QuestController): boolean =>
      promptTargets(levelPlacements(TARGET_WITHHELD), 'en', {
        done: new Set(),
        canEngage: (id) => controller.canEngage(id),
        awaits: (id) => controller.awaits(id),
      })[DRIFTWOOD] !== undefined;

    expect(offered(waiting)).toBe(true);
    expect(offered(notYet), 'a withheld landmark was offered with nothing to open').toBe(false);
  });
});

/* ----------------------------------------------- 4. no role, still scenery */

describe('a refused landmark with no quest role is still scenery', () => {
  it('is placed and named, and is neither reachable nor offered', () => {
    const resolution = resolveEngageable(levelPlacements(TARGET_WITHHELD), SPRUCE);
    expect(resolution.ok && resolution.engageable.card).toBe('withheld');

    expect(ids(TARGET_WITHHELD.pois)).toContain(SPRUCE);
    expect(ids(TARGET_WITHHELD.reachablePois)).not.toContain(SPRUCE);

    const targets = promptTargets(levelPlacements(TARGET_WITHHELD), 'en', {
      done: new Set(),
      canEngage: () => false,
      awaits: () => false,
    });
    expect(targets[SPRUCE], 'the HUD offered a tap on a landmark with nothing to open').toBeUndefined();
  });
});

/* --------------------------------------------------------------- 5. ADR-0024 */

describe('"its claim was refused" and "nothing is placed" are different answers', () => {
  it('answers withheld for the refused giver and dangling for an id nobody placed', () => {
    const placements = levelPlacements(GIVER_WITHHELD);

    const withheld = resolveEngageable(placements, STERNWHEELER);
    const nothing = resolveEngageable(placements, 'a-landmark-nobody-placed');

    expect(withheld.ok).toBe(true);
    expect(withheld.ok && withheld.engageable.card).toBe('withheld');
    expect(nothing.ok).toBe(false);
    expect(!nothing.ok && nothing.why).toBe('dangling');
  });

  it('never describes a withheld landmark in the words used for a dangling one', () => {
    /*
     * The shape of the defect, stated as an assertion: the teaching subset is
     * not the placements. Resolving over it is what printed "places nothing
     * called peggys-point-light" about a lighthouse the level places.
     */
    const overTeachingOnly = resolveEngageable(
      { pois: GIVER_WITHHELD.teachingPois, characters: GIVER_WITHHELD.characters },
      STERNWHEELER,
    );
    const overPlacements = resolveEngageable(levelPlacements(GIVER_WITHHELD), STERNWHEELER);

    expect(!overTeachingOnly.ok && overTeachingOnly.why).toBe('dangling');
    expect(overPlacements.ok).toBe(true);
  });
});
