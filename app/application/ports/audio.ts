/**
 * AudioPort — sound, with an accessibility contract attached.
 *
 * Every sound has a visual equivalent (CLAUDE.md, Accessibility), so a cue is not
 * just a file: it carries the localiser key of its caption. The audio adapter plays
 * the sound; the DOM UI renders the caption from the same cue. Neither imports the
 * other — both read the cue.
 *
 * Buses exist so a player can turn music down without losing dialogue, and so an
 * interruption (a question card opening) can duck the level bed rather than cut it.
 * Loading is per level and released on unload, because audio counts against the
 * per-level payload budget.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port, nothing implements it, and
 * no task schedules it. Slice 0 excluded audio outright and slice 1 has no audio
 * task, which makes this the only file in the directory with nothing named
 * against it. The bus split, the ducking semantics and the autoplay handshake
 * below were designed with no implementation to check them and are expected to
 * change wholesale when the first adapter is written; treat them as a sketch, not
 * a contract. If slice 2 closes without an audio adapter, delete this file rather
 * than renewing the marker.
 */

import type { LevelId } from '@domain/ids';
import type { Result } from '@common/result';

export type AudioBus = 'master' | 'music' | 'sfx' | 'voice';

/** Content-defined cue name, e.g. `sfx.jump`, `music.prairies`, `voice.guide.intro`. */
export type CueId = string;

export interface AudioCue {
  readonly id: CueId;
  readonly bus: Exclude<AudioBus, 'master'>;
  /** Localiser key for the subtitle/caption. Required — silence is not an option here. */
  readonly captionKey: string;
  readonly loop: boolean;
  /** 0–1, before bus and master volume. */
  readonly gain: number;
}

/** Handle for a playing sound, so a caller can stop the one it started. */
export interface PlaybackHandle {
  readonly cueId: CueId;
  readonly id: number;
}

export interface AudioPort {
  /** Load a level's cues. Returns `unsupported` where the host blocks audio entirely. */
  load(levelId: LevelId, cues: readonly AudioCue[]): Promise<Result<void>>;
  /** Release a level's buffers. Called before the next level loads. */
  unload(levelId: LevelId): Promise<Result<void>>;

  play(cueId: CueId): Result<PlaybackHandle>;
  stop(handle: PlaybackHandle): void;
  stopBus(bus: Exclude<AudioBus, 'master'>): void;

  /** Crossfade the music bed. `0` swaps immediately. */
  crossfadeMusic(cueId: CueId | null, durationMs: number): Result<void>;
  /** Duck a bus to `gain` while a card or dialogue is open; restore with `1`. */
  duck(bus: Exclude<AudioBus, 'master'>, gain: number, durationMs: number): void;

  setBusVolume(bus: AudioBus, volume: number): void;
  getBusVolume(bus: AudioBus): number;
  setMuted(muted: boolean): void;

  /**
   * Browsers require a gesture before audio starts. The UI calls this from the
   * first tap; until it resolves, `play` returns `unsupported` rather than throwing.
   */
  unlock(): Promise<Result<void>>;
  readonly unlocked: boolean;
}
