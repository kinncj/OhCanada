/**
 * Pure soundscape timing logic: two loop slots with equal-power crossfades, ducking and a seeded one-shot scheduler.
 * No Howler, no DOM — the adapter (howler-audio.ts) feeds it a clock and applies the gains it computes, so all of the
 * timing can be unit-tested (tests/unit/adapters/audio-mixer.test.ts).
 */
import { SeededRandom, hashString, type RandomSource } from '@common/rng';

export interface SoundscapeZone {
  readonly loop: string;
  readonly oneshots: readonly string[];
  readonly volume: number;
}

export interface OneshotCue {
  readonly id: string;
  /** Stereo pan, -1 (left) .. 1 (right). */
  readonly pan: number;
  /** Final gain (master and ducking already applied). */
  readonly gain: number;
}

export interface MixerOptions {
  readonly crossfadeMs: number;
  readonly fadeOutMs: number;
  readonly duckMs: number;
  readonly duckLevel: number;
  readonly oneshotMinMs: number;
  readonly oneshotMaxMs: number;
  /** One-shots sit a little above the bed: gain = min(1, zone.volume × oneshotGain). */
  readonly oneshotGain: number;
  /** Random pan is drawn from [-panSpread, panSpread]. */
  readonly panSpread: number;
}

export const DEFAULT_MIXER_OPTIONS: MixerOptions = {
  crossfadeMs: 1500,
  fadeOutMs: 600,
  duckMs: 300,
  duckLevel: 0.4,
  oneshotMinMs: 6000,
  oneshotMaxMs: 25000,
  oneshotGain: 1.4,
  panSpread: 0.8,
};

export type SlotIndex = 0 | 1;

export interface SlotChange {
  /** Slot that should start playing `loop` at volume 0. */
  readonly slot: SlotIndex;
  readonly loop: string;
  /** Loop that was still occupying that slot (rapid zone hopping) and must be unloaded first. */
  readonly evicted: string | null;
}

interface Slot {
  loop: string | null;
  from: number;
  to: number;
  startMs: number;
  durMs: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Equal-power crossfade: incoming² + outgoing² = 1 for every progress p in [0, 1]. */
export function crossfadeCurve(p: number): { readonly incoming: number; readonly outgoing: number } {
  const k = (Math.PI / 2) * clamp01(p);
  return { incoming: Math.sin(k), outgoing: Math.cos(k) };
}

/** Gain ramp between two levels following the equal-power curve (sine when rising, cosine when falling). */
export function rampGain(from: number, to: number, p: number): number {
  const { incoming, outgoing } = crossfadeCurve(p);
  return to >= from ? from + (to - from) * incoming : to + (from - to) * outgoing;
}

const emptySlot = (): Slot => ({ loop: null, from: 0, to: 0, startMs: 0, durMs: 0 });

export class SoundscapeMixer {
  private readonly opts: MixerOptions;
  private readonly slots: [Slot, Slot] = [emptySlot(), emptySlot()];
  private active: SlotIndex = 0;
  private zone: SoundscapeZone | null = null;
  private master = 1;
  private readonly duck = { from: 1, to: 1, startMs: 0 };
  private rng: RandomSource | null = null;
  private nextOneshotMs = Infinity;

  constructor(opts: Partial<MixerOptions> = {}, private readonly makeRng: (seed: number) => RandomSource = (seed) => new SeededRandom(seed)) {
    this.opts = { ...DEFAULT_MIXER_OPTIONS, ...opts };
  }

  get currentZone(): SoundscapeZone | null {
    return this.zone;
  }

  slotLoop(slot: SlotIndex): string | null {
    return this.slots[slot].loop;
  }

  /** Time (ms) at which the next one-shot is due; Infinity when the zone has none. */
  get nextOneshotAt(): number {
    return this.nextOneshotMs;
  }

  /**
   * Switch to a zone. Returns which slot must start the new loop, or null when the loop is unchanged (the volume
   * and one-shot roster are still updated in place).
   */
  setZone(zone: SoundscapeZone, nowMs: number): SlotChange | null {
    const prev = this.zone;
    const activeSlot = this.slots[this.active];
    this.zone = zone;
    if (prev && prev.loop === zone.loop && activeSlot.loop === zone.loop) {
      this.ramp(this.active, zone.volume, nowMs, this.opts.crossfadeMs);
      if (prev.oneshots.join(',') !== zone.oneshots.join(',')) this.schedule(zone, nowMs);
      return null;
    }
    const outgoing = this.active;
    const incoming: SlotIndex = activeSlot.loop === null ? outgoing : outgoing === 0 ? 1 : 0;
    const evicted = incoming === outgoing ? null : this.slots[incoming].loop;
    if (incoming !== outgoing && activeSlot.loop !== null) this.ramp(outgoing, 0, nowMs, this.opts.crossfadeMs);
    this.slots[incoming] = { loop: zone.loop, from: 0, to: zone.volume, startMs: nowMs, durMs: this.opts.crossfadeMs };
    this.active = incoming;
    this.schedule(zone, nowMs);
    return { slot: incoming, loop: zone.loop, evicted };
  }

  /** Fade everything out (fadeOutMs) and stop scheduling one-shots. */
  stop(nowMs: number): void {
    for (const i of [0, 1] as const) if (this.slots[i].loop !== null) this.ramp(i, 0, nowMs, this.opts.fadeOutMs);
    this.zone = null;
    this.rng = null;
    this.nextOneshotMs = Infinity;
  }

  setMaster(v: number): void {
    this.master = clamp01(v);
  }

  setDucked(enabled: boolean, nowMs: number): void {
    this.duck.from = this.duckFactor(nowMs);
    this.duck.to = enabled ? this.opts.duckLevel : 1;
    this.duck.startMs = nowMs;
  }

  /** Current linear ducking multiplier (1 = not ducked). */
  duckFactor(nowMs: number): number {
    const p = this.opts.duckMs <= 0 ? 1 : clamp01((nowMs - this.duck.startMs) / this.opts.duckMs);
    return this.duck.from + (this.duck.to - this.duck.from) * p;
  }

  /** Final per-slot gains to apply right now: ramp × master × duck. */
  gains(nowMs: number): readonly [number, number] {
    const d = this.master * this.duckFactor(nowMs);
    return [this.level(this.slots[0], nowMs) * d, this.level(this.slots[1], nowMs) * d];
  }

  /** Slots whose fade-out has completed: the adapter unloads them, then calls release(). */
  drained(nowMs: number): SlotIndex[] {
    const out: SlotIndex[] = [];
    for (const i of [0, 1] as const) {
      const s = this.slots[i];
      if (s.loop !== null && s.to === 0 && this.progress(s, nowMs) >= 1) out.push(i);
    }
    return out;
  }

  release(slot: SlotIndex): void {
    this.slots[slot] = emptySlot();
  }

  /** True when no ramp (slot or duck) is still in flight. */
  isSettled(nowMs: number): boolean {
    const duckDone = this.opts.duckMs <= 0 || nowMs - this.duck.startMs >= this.opts.duckMs || this.duck.from === this.duck.to;
    return duckDone && this.slots.every((s) => s.loop === null || this.progress(s, nowMs) >= 1);
  }

  /** True when nothing is playing or pending — the adapter can stop ticking. */
  isIdle(): boolean {
    return this.zone === null && this.slots.every((s) => s.loop === null);
  }

  /** True while the adapter needs to keep ticking (a ramp, a drained slot to unload, or a one-shot to fire). */
  needsTick(nowMs: number): boolean {
    return !this.isSettled(nowMs) || this.drained(nowMs).length > 0 || this.nextOneshotMs < Infinity;
  }

  /** Returns the one-shot to fire now (and schedules the next one), or null when none is due. */
  pollOneshot(nowMs: number): OneshotCue | null {
    const zone = this.zone;
    if (!zone || !this.rng || zone.oneshots.length === 0 || nowMs < this.nextOneshotMs) return null;
    const id = zone.oneshots[Math.floor(this.rng.next() * zone.oneshots.length)] ?? zone.oneshots[0]!;
    const pan = (this.rng.next() * 2 - 1) * this.opts.panSpread;
    this.nextOneshotMs = nowMs + this.interval();
    return { id, pan, gain: this.master * this.duckFactor(nowMs) * Math.min(1, zone.volume * this.opts.oneshotGain) };
  }

  private schedule(zone: SoundscapeZone, nowMs: number): void {
    if (zone.oneshots.length === 0) {
      this.rng = null;
      this.nextOneshotMs = Infinity;
      return;
    }
    this.rng = this.makeRng(hashString(`${zone.loop}|${zone.oneshots.join(',')}`));
    this.nextOneshotMs = nowMs + this.interval();
  }

  private interval(): number {
    const { oneshotMinMs, oneshotMaxMs } = this.opts;
    return oneshotMinMs + (this.rng?.next() ?? 0) * (oneshotMaxMs - oneshotMinMs);
  }

  private ramp(slot: SlotIndex, to: number, nowMs: number, durMs: number): void {
    const s = this.slots[slot];
    s.from = this.level(s, nowMs);
    s.to = to;
    s.startMs = nowMs;
    s.durMs = durMs;
  }

  private progress(s: Slot, nowMs: number): number {
    return s.durMs <= 0 ? 1 : clamp01((nowMs - s.startMs) / s.durMs);
  }

  private level(s: Slot, nowMs: number): number {
    return s.loop === null ? 0 : rampGain(s.from, s.to, this.progress(s, nowMs));
  }
}
