import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { unlockedLevelIds, type UnlockRules } from '@domain/entities/level';
import { hasCopyRow, text } from '@ui/copy';

/**
 * The level a cold load can open **from the map**, asked of the same two sources
 * the game asks.
 *
 * Not a spec file: `testMatch` in `tests/e2e/playwright.config.ts` is
 * `**\/*.spec.ts`, so this is a module two specs share rather than a suite.
 *
 * Which level the player starts on is configuration and it moves. It was Ottawa,
 * because `unlockRules.initialLevels` named Ottawa while Halifax had no level
 * document; it is Halifax now that Halifax has one; it moves again when
 * Mi'kma'ki or Winnipeg ships. A spec that types the name has to be edited on
 * every one of those changes and proves nothing a spec that reads the config
 * does not — worse, it fails on a config change that is not a defect, which
 * teaches people to edit the test rather than read it.
 *
 * Two questions, two sources, exactly as `app/bootstrap/journey.ts` asks them:
 *
 *  - **unlocked**: `unlockedLevelIds(rules, [])` — what the rules open for a
 *    passport with no stamps in it. The real domain function, not a re-statement
 *    of it, so a change to how credit is spent reaches these specs too;
 *  - **built**: a document in `content/levels/`, which is what the level
 *    catalogue's bundler glob answers with in the app.
 *
 * A card must be both to be pressable, so the first level that is both is where
 * a player who presses Play lands.
 */
const CONFIG = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../content/game.config.json', import.meta.url)), 'utf8'),
) as {
  readonly unlockRules: UnlockRules;
  /** The map's ten places, in map order — a different list from the unlock order. */
  readonly journey: readonly (string | null)[];
};

const BUILT_LEVELS = readdirSync(
  fileURLToPath(new URL('../../content/levels', import.meta.url)),
)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length));

const found = unlockedLevelIds(CONFIG.unlockRules, []).find((id) =>
  BUILT_LEVELS.includes(`${id}`),
);

if (found === undefined) {
  throw new Error(
    'content/game.config.json opens no level that content/levels/ has a document for, ' +
      'so a cold load reaches a map with no card it can press. Every spec that goes in ' +
      'through the front door is about to fail, and this is the reason.',
  );
}

/** The id of that level, for a `level-card-<id>` selector or a `?level=` link. */
export const START_LEVEL: string = `${found}`;

/**
 * What the HUD must call the way the player moves in that level, in English.
 *
 * Asked of the same two sources the game asks, for the same reason `START_LEVEL`
 * is: the level document declares `locomotion[0].labelKey` — a *key*, because
 * ADR-0010 keeps the wording out of the engine — and `app/ui/copy.ts` says what
 * the key means. A spec that typed "Walking" would have to be edited when the
 * start level moves, and would still pass on the defect this constant exists
 * for: the table had one row, `locomotion.skate.label`, so the level the game
 * opens on drew an **empty** paragraph. An empty paragraph has no box, which is
 * why `boot.spec.ts` could only assert it was attached.
 */
export const START_LEVEL_MODE_LABEL: string = ((): string => {
  const document = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../content/levels/${START_LEVEL}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { readonly locomotion?: readonly { readonly labelKey: string }[] };
  const key = document.locomotion?.[0]?.labelKey;
  if (key === undefined) {
    throw new Error(
      `content/levels/${START_LEVEL}.json declares no locomotion, so the HUD has no mode ` +
        'to name and the level cannot say how the player moves.',
    );
  }
  if (!hasCopyRow(key)) {
    throw new Error(
      `content/levels/${START_LEVEL}.json declares "${key}" and app/ui/copy.ts has no row ` +
        'for it, so the HUD would draw an empty mode strip — silent to a screen reader ' +
        'and invisible to everyone else (TN-MOVE-02). Add the row to ' +
        'docs/stories/TN-MOVE-locomotion-labels.md and transcribe it.',
    );
  }
  return text('en', key);
})();


/* --------------------------------------------------- where the level leads --- */

/**
 * The level that opens when the start level is finished.
 *
 * Derived the same way the game derives it, and for the same reason
 * {@link START_LEVEL} is: it was Ottawa, it is Québec City, and it moves again
 * when Mi'kma'ki ships. Three questions, asked of the same three sources
 * `app/bootstrap/journey.ts` and `main.ts` ask:
 *
 *  - **the unlock rule**, run over a passport holding exactly the start level's
 *    stamp. The real domain function, not a restatement;
 *  - **the map order**, `journey`, because `openedWhileIn` takes the *first*
 *    newly opened card in map order and that is the one the completion card
 *    offers;
 *  - **built**, from `content/levels/`, because a level with no document cannot
 *    be walked into.
 *
 * `null` when this build's chain opens nothing — a real state for a game with
 * one level, and the spec that needs a second level says so rather than failing
 * on an `undefined`.
 */
const openedBefore = new Set(unlockedLevelIds(CONFIG.unlockRules, []).map(String));

const nextFound = CONFIG.journey.find(
  (id): id is string =>
    id !== null &&
    BUILT_LEVELS.includes(id) &&
    !openedBefore.has(id) &&
    unlockedLevelIds(CONFIG.unlockRules, [found as never])
      .map(String)
      .includes(id),
);

/** The id of that level, or `null` when finishing the start level opens nothing. */
export const NEXT_LEVEL: string | null = nextFound ?? null;

/**
 * What the completion card's route into it is labelled.
 *
 * `level.<id>.play` — "Play Québec City" — and not that level's place name. A
 * label that says what pressing does beats one that says where you would end up,
 * and the row is written out per level because French takes « à » for three of
 * the four built levels and « dans la » for the fourth, so no template is right
 * in both languages (`TN-DONE-04`).
 */
export const NEXT_LEVEL_PLAY_LABEL: string | null = ((): string | null => {
  if (NEXT_LEVEL === null) return null;
  const key = `level.${NEXT_LEVEL}.play`;
  if (!hasCopyRow(key)) {
    throw new Error(
      `content/game.config.json opens "${NEXT_LEVEL}" after "${START_LEVEL}" and ` +
        `app/ui/copy.ts has no ${key}, so the completion card can offer no route into it ` +
        'and a player who finishes a level is left one tap short of the next one. ' +
        'Transcribe the row from that level\'s story file (TN-DONE-05 carries the gate).',
    );
  }
  return text('en', key);
})();

/**
 * How the HUD says the player moves in that level, in English.
 *
 * The one fact that tells the two levels apart from outside the game: they
 * declare different locomotion, so the mode strip changing is proof that the
 * *second* level loaded rather than the first one reloading.
 */
export const NEXT_LEVEL_MODE_LABEL: string | null = ((): string | null => {
  if (NEXT_LEVEL === null) return null;
  const document = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../content/levels/${NEXT_LEVEL}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { readonly locomotion?: readonly { readonly labelKey: string }[] };
  const key = document.locomotion?.[0]?.labelKey;
  if (key === undefined || !hasCopyRow(key)) return null;
  return text('en', key);
})();
