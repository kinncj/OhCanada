import { Howl, Howler } from 'howler';
import type { AudioPort } from '@application/engine-ports';
import type { Soundscape } from '@domain/district';
import { SoundscapeMixer, type OneshotCue } from './soundscape-mixer';

type SfxId = 'click' | 'correct' | 'wrong' | 'stamp' | 'step';

const TICK_MS = 50;
const noop = (): undefined => undefined;
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Howler behind AudioPort. Files come from assets/dist/audio (generated: scripts/assets.mjs for UI cues,
 * scripts/lib/soundscapes.mjs for ambience loops and one-shots — see docs/audio.md).
 * Two loop slots are crossfaded by SoundscapeMixer; a 50 ms ticker applies its gains and fires scheduled one-shots.
 */
export class HowlerAudio implements AudioPort {
  private readonly loops: [Howl | null, Howl | null] = [null, null];
  private readonly applied: [number, number] = [-1, -1];
  private readonly mixer = new SoundscapeMixer();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private readonly sfx = new Map<SfxId, Howl>();
  private readonly oneshots = new Map<string, Howl>();
  private master = 0.8;

  constructor(private readonly base: string) {
    Howler.autoUnlock = true;
  }

  private url(file: string): string {
    return `${this.base}audio/${file}`;
  }

  setSoundscape(zone: Soundscape): void {
    const change = this.mixer.setZone(zone, now());
    if (change) {
      this.loops[change.slot]?.unload();
      const h = new Howl({ src: [this.url(`${change.loop}.wav`)], loop: true, volume: 0, html5: false, onloaderror: noop, onplayerror: noop });
      h.play();
      this.loops[change.slot] = h;
      this.applied[change.slot] = -1;
      for (const id of zone.oneshots) this.oneshot(id); // preload
    }
    this.ensureTicker();
  }

  /** Thin wrapper kept for callers that only know a loop id. */
  playAmbience(id: string): void {
    this.setSoundscape({ loop: id, oneshots: [], volume: 0.45 });
  }

  stopAmbience(): void {
    this.mixer.stop(now());
    this.ensureTicker();
  }

  playSfx(id: SfxId): void {
    let h = this.sfx.get(id);
    if (!h) {
      h = new Howl({ src: [this.url(`${id}.wav`)], volume: this.master, onloaderror: noop, onplayerror: noop });
      this.sfx.set(id, h);
    }
    h.volume(this.master * (id === 'step' ? 0.35 : 0.9));
    h.play();
  }

  setMasterVolume(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
    Howler.volume(1);
    this.mixer.setMaster(this.master);
    this.ensureTicker();
  }

  duck(enabled: boolean): void {
    this.mixer.setDucked(enabled, now());
    this.ensureTicker();
  }

  private ensureTicker(): void {
    if (this.ticker === null) this.ticker = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private tick(): void {
    const t = now();
    const g = this.mixer.gains(t);
    for (const i of [0, 1] as const) {
      const h = this.loops[i];
      if (h && Math.abs(g[i] - this.applied[i]) > 0.002) {
        h.volume(g[i]);
        this.applied[i] = g[i];
      }
    }
    for (const i of this.mixer.drained(t)) {
      this.loops[i]?.unload();
      this.loops[i] = null;
      this.mixer.release(i);
    }
    const cue = this.mixer.pollOneshot(t);
    if (cue) this.playOneshot(cue);
    if (this.ticker !== null && !this.mixer.needsTick(t)) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private oneshot(id: string): Howl {
    let h = this.oneshots.get(id);
    if (!h) {
      h = new Howl({ src: [this.url(`${id}.wav`)], volume: 0, preload: true, onloaderror: noop, onplayerror: noop });
      this.oneshots.set(id, h);
    }
    return h;
  }

  private playOneshot(cue: OneshotCue): void {
    const h = this.oneshot(cue.id);
    const soundId = h.play();
    h.volume(cue.gain, soundId);
    // Stereo pan needs Howler's spatial plugin (bundled in the default build); the core-only build simply plays centred.
    if (typeof (h as { stereo?: unknown }).stereo === 'function') h.stereo(cue.pan, soundId);
  }
}
