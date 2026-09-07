import { Howl, Howler } from 'howler';
import type { AudioPort } from '@application/engine-ports';

type SfxId = 'click' | 'correct' | 'wrong' | 'stamp' | 'step';

/** Howler behind AudioPort. Files come from assets/dist/audio (generated, see scripts/assets.mjs). */
export class HowlerAudio implements AudioPort {
  private ambience: Howl | null = null;
  private ambienceId: string | null = null;
  private readonly sfx = new Map<SfxId, Howl>();
  private master = 0.8;
  private ducked = false;

  constructor(private readonly base: string) {
    Howler.autoUnlock = true;
  }

  private url(file: string): string {
    return `${this.base}audio/${file}`;
  }

  playAmbience(id: string): void {
    if (this.ambienceId === id && this.ambience?.playing()) return;
    this.stopAmbience();
    this.ambienceId = id;
    this.ambience = new Howl({ src: [this.url(`${id}.wav`)], loop: true, volume: 0, html5: false, onloaderror: () => undefined, onplayerror: () => undefined });
    this.ambience.play();
    this.ambience.fade(0, this.ambienceVolume(), 1500);
  }

  stopAmbience(): void {
    if (this.ambience) {
      const h = this.ambience;
      h.fade(h.volume(), 0, 600);
      setTimeout(() => h.unload(), 700);
    }
    this.ambience = null;
    this.ambienceId = null;
  }

  playSfx(id: SfxId): void {
    let h = this.sfx.get(id);
    if (!h) {
      h = new Howl({ src: [this.url(`${id}.wav`)], volume: this.master, onloaderror: () => undefined, onplayerror: () => undefined });
      this.sfx.set(id, h);
    }
    h.volume(this.master * (id === 'step' ? 0.35 : 0.9));
    h.play();
  }

  setMasterVolume(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
    Howler.volume(1);
    this.ambience?.volume(this.ambienceVolume());
  }

  duck(enabled: boolean): void {
    this.ducked = enabled;
    this.ambience?.fade(this.ambience.volume(), this.ambienceVolume(), 300);
  }

  private ambienceVolume(): number {
    return this.master * (this.ducked ? 0.18 : 0.45);
  }
}
