/**
 * Player — the person at the controls: their character and their settings.
 *
 * `Settings` and `VolumeSettings` mirror `progress.schema.json#/$defs/settings`
 * and `#/$defs/volumeSettings`. `Player` is a *view* of the saved document
 * rather than a second place to keep the same facts: `Progress` holds `character`
 * and `settings` at the top level exactly as the schema does, and satisfies this
 * interface structurally. That is the whole reason it is `character` and
 * `settings` and not `avatar` and `preferences`.
 *
 * TN-SAVE items 1, 2 and 3 — the character, the language and every accessibility
 * setting — are this file. Items 3's list is closed: eight switches and four
 * volumes, all of them in the schema, none of them free text.
 */

import type { LocaleCode } from '@domain/ids';

import { isSupportedLocale } from '@domain/entities/values';
import type { PlayerCharacter } from '@domain/entities/character';

/** One 0-1 level per audio bus. Fixed keys: the buses are code, not content. */
export interface VolumeSettings {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly voice: number;
}

export interface Settings {
  readonly locale: LocaleCode;
  readonly autoMove: boolean;
  readonly singleSwitch: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly dyslexiaFont: boolean;
  /** 100-200 %, as a multiplier. */
  readonly textScale: number;
  readonly subtitles: boolean;
  readonly volumes: VolumeSettings;
}

/** The two saved facts that describe the player rather than their progress. */
export interface Player {
  /** `null` before the creator has run; settings persist from the first screen. */
  readonly character: PlayerCharacter | null;
  readonly settings: Settings;
}

/** Text scaling bounds, from the schema and from CLAUDE.md's accessibility rules. */
export const MIN_TEXT_SCALE = 1;
export const MAX_TEXT_SCALE = 2;

/**
 * Clamp, reading a non-finite value as the low end.
 *
 * JSON carries neither `NaN` nor `Infinity`, so one can only reach here from a
 * caller building settings by hand — and the low end is the safe answer for both
 * of the things this clamps: 100 % text rather than unreadable, and silence
 * rather than a game that plays at full volume because a number was broken.
 */
const clamp = (value: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;

const clampVolumes = (volumes: VolumeSettings): VolumeSettings => ({
  master: clamp(volumes.master, 0, 1),
  music: clamp(volumes.music, 0, 1),
  sfx: clamp(volumes.sfx, 0, 1),
  voice: clamp(volumes.voice, 0, 1),
});

/**
 * Settings a new player starts with, in the language the build defaults to.
 *
 * The locale is a parameter rather than a constant because `game.config.json`
 * owns `defaultLocale`; a default hardcoded here would be a second answer to a
 * question the config already answers.
 *
 * Subtitles start on. TN-QUEST-01 asserts a player who has never opened Settings
 * still sees the officer's words as text, so "on" is the default, not a
 * preference the player has to discover.
 */
export const defaultSettings = (locale: LocaleCode): Settings => ({
  locale,
  autoMove: false,
  singleSwitch: false,
  reducedMotion: false,
  highContrast: false,
  dyslexiaFont: false,
  textScale: MIN_TEXT_SCALE,
  subtitles: true,
  volumes: { master: 1, music: 0.6, sfx: 0.8, voice: 1 },
});

/**
 * Bring settings back inside their bounds.
 *
 * Applied on the way *in* from a save and on every change, so a hand-edited file
 * with a text scale of 40 cannot make the first screen unreadable. An unsupported
 * locale falls back rather than failing: the save is otherwise fine, and losing a
 * whole game over a language tag would be the wrong trade (TN-SAVE-04 keeps the
 * loud failure for a document that is not a save at all).
 */
export const clampSettings = (settings: Settings, fallbackLocale: LocaleCode): Settings => ({
  ...settings,
  locale: isSupportedLocale(`${settings.locale}`) ? settings.locale : fallbackLocale,
  textScale: clamp(settings.textScale, MIN_TEXT_SCALE, MAX_TEXT_SCALE),
  volumes: clampVolumes(settings.volumes),
});

/** A player who has set nothing and made nobody. */
export const newPlayer = (locale: LocaleCode): Player => ({
  character: null,
  settings: defaultSettings(locale),
});

/** Has the creator run? What decides whether the game opens on the creator (TN-SAVE-01). */
export const hasCharacter = (player: Player): boolean => player.character !== null;

/** Change some settings. Returns a new player; the change is clamped. */
export const withSettings = <T extends Player>(player: T, patch: Partial<Settings>): T => ({
  ...player,
  settings: clampSettings({ ...player.settings, ...patch }, player.settings.locale),
});

/** Record the character the creator produced. */
export const withCharacter = <T extends Player>(player: T, character: PlayerCharacter): T => ({
  ...player,
  character,
});
