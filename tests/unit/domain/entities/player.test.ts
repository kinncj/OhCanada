/**
 * The player's settings: the defaults a new player gets, and the bounds a saved
 * file is held to (TN-SAVE items 2 and 3, CLAUDE.md accessibility).
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  clampSettings,
  defaultSettings,
  hasCharacter,
  newPlayer,
  withCharacter,
  withSettings,
} from '@domain/entities/player';

import { characterId, locale, settings } from '../../support/fixtures';

describe('a new player', () => {
  it('starts with subtitles on, without having opened Settings (TN-QUEST-01)', () => {
    expect(defaultSettings(locale('fr')).subtitles).toBe(true);
  });

  it('starts in the language the build defaults to, not one hardcoded here', () => {
    expect(defaultSettings(locale('fr')).locale).toBe('fr');
    expect(newPlayer(locale('en')).settings.locale).toBe('en');
  });

  it('has no character until the creator has run', () => {
    const player = newPlayer(locale());
    expect(hasCharacter(player)).toBe(false);
    const dressed = withCharacter(player, { characterId: characterId('skater'), skins: {} });
    expect(hasCharacter(dressed)).toBe(true);
    expect(player.character).toBeNull();
  });
});

describe('changing settings', () => {
  it('keeps everything not named in the change', () => {
    const player = newPlayer(locale());
    const changed = withSettings(player, { reducedMotion: true, textScale: 1.5 });
    expect(changed.settings.reducedMotion).toBe(true);
    expect(changed.settings.textScale).toBe(1.5);
    expect(changed.settings.subtitles).toBe(true);
    expect(player.settings.reducedMotion).toBe(false);
  });

  it('clamps a text scale outside 100-200 %', () => {
    expect(withSettings(newPlayer(locale()), { textScale: 40 }).settings.textScale).toBe(
      MAX_TEXT_SCALE,
    );
    expect(withSettings(newPlayer(locale()), { textScale: 0.1 }).settings.textScale).toBe(
      MIN_TEXT_SCALE,
    );
    expect(
      withSettings(newPlayer(locale()), { textScale: Number.NaN }).settings.textScale,
    ).toBe(MIN_TEXT_SCALE);
  });

  it('clamps every volume into 0-1, and reads a nonsense one as silence', () => {
    // JSON cannot carry Infinity, so a non-finite volume can only come from a
    // caller building settings by hand. Silence is the safe end of that range:
    // the alternative is a game that plays at full volume because a number was
    // broken.
    const loud = clampSettings(
      settings({ volumes: { master: 9, music: -3, sfx: 0.5, voice: Number.POSITIVE_INFINITY } }),
      locale(),
    );
    expect(loud.volumes).toEqual({ master: 1, music: 0, sfx: 0.5, voice: 0 });
  });

  it('falls an unreadable locale back rather than losing the save with it', () => {
    const foreign = clampSettings(settings({ locale: locale('de') }), locale('fr'));
    expect(foreign.locale).toBe('fr');
    expect(clampSettings(settings({ locale: locale('fr') }), locale('en')).locale).toBe('fr');
  });
});
