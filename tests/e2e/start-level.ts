import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { unlockedLevelIds, type UnlockRules } from '@domain/entities/level';

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
) as { readonly unlockRules: UnlockRules };

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
