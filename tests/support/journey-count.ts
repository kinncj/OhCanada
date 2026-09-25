import gameConfig from '../../content/game.config.json' with { type: 'json' };
import { journeyPlaces } from '../../app/bootstrap/journey';

/**
 * How long the shipped journey is, read from `content/game.config.json` rather
 * than written into a test (`docs/plan/kingston.md` K-0.3).
 *
 * A suite that types "10", "ten" or "of 10" fails the day an eleventh place is
 * added to `journey`, and that config change is not a defect. Every unit, a11y
 * and e2e suite that asserts a count of places or a place's map number asks
 * this module, which asks the same function the composition root asks
 * (`journeyPlaces`), so the number a test expects and the number the map draws
 * cannot drift apart.
 */

/** `content/game.config.json#/journey`: the places, in map order, `null` where unscoped. */
export const SHIPPED_JOURNEY: readonly (string | null)[] = gameConfig.journey;

/** How many cards the map draws and how many slots the passport draws. */
export const PLACE_COUNT: number = journeyPlaces(SHIPPED_JOURNEY);

/** A place's map number, 1-based, as its card and its pin draw it. Throws on an id the journey lacks. */
export function placeNumber(id: string, journey: readonly (string | null)[] = SHIPPED_JOURNEY): number {
  const index = journey.indexOf(id);
  if (index < 0) {
    throw new Error(`content/game.config.json#/journey has no place "${id}".`);
  }
  return index + 1;
}
