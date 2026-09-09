/**
 * The journey: ten places, and which of them this build has, has opened, and
 * has stamped.
 *
 * `app/ui/level-select.ts` renders a {@link MapEntry}; it does not decide one.
 * That split is `TN-MAP`'s rule and the reason this file exists on this side of
 * the seam: whether a *document* exists is the level catalogue's answer, and
 * whether a level is *unlocked* is `unlockedLevelIds`' answer. Two sources, two
 * different questions, and the bug the rule prevents is a screen answering one
 * of them with the other. `app/ui` may import the id vocabulary from
 * `app/domain` and nothing else (ADR-0005), so the unlock rule is run here — in
 * the one place allowed to see both — and the map is handed the result.
 *
 * Everything below is a pure function over data, so the map's ten rows are
 * assertable without a browser, a bundler or a Phaser game.
 *
 * ## Two lists, and why the rows are not numbered from the unlock order
 *
 * They were, and the chain died of it. `unlockRules.order` began `[halifax,
 * mikmaki, quebec-city, ottawa, …]` so that the map could number Halifax 1 and
 * Ottawa 4, while `initialLevels` named only `ottawa` because Halifax is not
 * built. `unlockedLevelIds` stops at the first level it cannot open, so it
 * stopped at index 0: **no stamp unlocked anything**, and Québec City — built,
 * with art and a level document — was reachable by no sequence of play. One
 * list cannot be both a fixed catalogue of ten places and a progression that
 * starts where the player starts.
 *
 * So the rows are numbered from `journey`, which is the game's shape, and the
 * unlock rule is run over `unlockRules.order`, which is its progression. The
 * two agree about *which places exist* — `unmappedLevelIds` is that check, and
 * `tests/unit/contracts/unlock-chain-is-reachable.test.ts` runs it against the
 * shipped config — and they are allowed to disagree about order, because today
 * the only two built levels are numbers 4 and 3 and the player starts at 4.
 */

import { unlockedLevelIds, type Journey, type UnlockRules } from '@domain/entities/level';
import type { LevelId } from '@domain/ids';
import type { MapEntry } from '@ui/level-select';

/**
 * How many places the journey has (CLAUDE.md, Scope: "10 levels, 10 subjects,
 * exam"; `TN-MAP-01`: "the ten levels, in order, each with a state").
 *
 * It is a floor rather than a slice: a config carrying fewer than ten ids still
 * draws ten cards, because a player learning that the game is a journey across
 * Canada should not be shown a shorter Canada because a config is unfinished —
 * and `TN-MAP-04` forbids drawing the shortfall as an error. A config carrying
 * *more* than ten is not truncated either: silently hiding a level would be this
 * file deciding the map is wrong about itself.
 */
export const JOURNEY_LENGTH = 10;

export interface JourneyState {
  /** `content/game.config.json#/unlockRules` — the unlock sequence, not the map. */
  readonly rules: UnlockRules;
  /** `content/game.config.json#/journey` — the places, in map order. */
  readonly journey: Journey;
  /** The stamps in the passport — `stampedLevelIds(progress)`. */
  readonly stamped: readonly LevelId[];
  /** The catalogue's answer: `hasLevel(id)`. Never a list anybody maintains. */
  readonly isBuilt: (id: LevelId) => boolean;
}

/**
 * The ten entries, in map order, ready to hand to `createShell`.
 *
 * A place with no id — a `null` slot, or a row `journey` does not reach — is a numbered
 * card with no name and no state but "not made yet". That is deliberate:
 * `TN-LEVELS` declines to fix ids for levels 2 and 10 while
 * `docs/content-review.md` §1 blocks them, and `TN-MAP-04` forbids a placeholder
 * standing in for the name. The card carries its number, which is the handle its
 * copy rows are keyed on.
 */
export function journeyEntries(state: JourneyState): readonly MapEntry[] {
  const unlocked = new Set<LevelId>(unlockedLevelIds(state.rules, state.stamped));
  const stamped = new Set<LevelId>(state.stamped);
  const places = Math.max(JOURNEY_LENGTH, state.journey.length);

  return Array.from({ length: places }, (_unused, index): MapEntry => {
    const number = index + 1;
    /* `null` is a place whose id is not fixed; `undefined` is a place past the
       end of a config that names fewer than ten. The card is the same either
       way: a number, and no placeholder (`TN-MAP-04`). */
    const id = state.journey[index] ?? undefined;
    if (id === undefined) return { number, built: false, unlocked: false, stamped: false };
    return {
      number,
      id,
      built: state.isBuilt(id),
      unlocked: unlocked.has(id),
      stamped: stamped.has(id),
    };
  });
}

/**
 * May this level be opened right now?
 *
 * `onPlayLevel` is a request, not a transition (`TN-FLOW`): the map only draws a
 * control on a card it believes is open, but "the player asked" and "the game
 * agreed" are different facts, and the composition root owns the second. A save
 * imported from another build, or a config edited between two sittings, can
 * produce a request for a level this build cannot open, and answering it would
 * put the player on a black screen rather than on a card that says why.
 */
export function isPlayable(entries: readonly MapEntry[], id: LevelId): boolean {
  const entry = entries.find((candidate) => candidate.id === id);
  return entry !== undefined && entry.built && entry.unlocked;
}
