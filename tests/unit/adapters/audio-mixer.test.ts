import { describe, expect, it } from 'vitest';
import { SoundscapeMixer, crossfadeCurve, rampGain, DEFAULT_MIXER_OPTIONS, type SoundscapeZone } from '@adapters/audio/soundscape-mixer';
import { SeededRandom } from '@common/rng';

const prairie: SoundscapeZone = { loop: 'prairie', oneshots: ['goose-honk', 'goose-flock', 'train-whistle'], volume: 0.5 };
const harbour: SoundscapeZone = { loop: 'harbour', oneshots: ['gull'], volume: 0.8 };
const silent: SoundscapeZone = { loop: 'wind', oneshots: [], volume: 0.45 };
const { crossfadeMs, fadeOutMs, duckMs, duckLevel, oneshotMinMs, oneshotMaxMs, panSpread } = DEFAULT_MIXER_OPTIONS;
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('crossfade curve', () => {
  it('is equal-power: in² + out² = 1, from (0, 1) to (1, 0), monotonic', () => {
    near(crossfadeCurve(0).incoming, 0);
    near(crossfadeCurve(0).outgoing, 1);
    near(crossfadeCurve(1).incoming, 1);
    near(crossfadeCurve(1).outgoing, 0);
    let last = -1;
    for (let p = 0; p <= 1; p += 0.05) {
      const { incoming, outgoing } = crossfadeCurve(p);
      near(incoming * incoming + outgoing * outgoing, 1);
      expect(incoming).toBeGreaterThanOrEqual(last);
      last = incoming;
    }
    near(crossfadeCurve(0.5).incoming, Math.SQRT1_2);
    near(crossfadeCurve(-1).incoming, 0);
    near(crossfadeCurve(2).outgoing, 0);
  });
  it('rampGain follows the sine when rising and the cosine when falling', () => {
    near(rampGain(0, 0.5, 0.5), 0.5 * Math.SQRT1_2);
    near(rampGain(0.5, 0, 0.5), 0.5 * Math.SQRT1_2);
    near(rampGain(0.2, 0.6, 0), 0.2);
    near(rampGain(0.2, 0.6, 1), 0.6);
    near(rampGain(0.6, 0.2, 1), 0.2);
  });
});

describe('SoundscapeMixer crossfade', () => {
  it('fades the first loop in over crossfadeMs on one slot', () => {
    const m = new SoundscapeMixer();
    const change = m.setZone(prairie, 1000);
    expect(change).toEqual({ slot: 0, loop: 'prairie', evicted: null });
    expect(m.gains(1000)).toEqual([0, 0]);
    near(m.gains(1000 + crossfadeMs / 2)[0], 0.5 * Math.SQRT1_2);
    near(m.gains(1000 + crossfadeMs)[0], 0.5);
    near(m.gains(1000 + crossfadeMs * 5)[0], 0.5);
    expect(m.gains(1000 + crossfadeMs)[1]).toBe(0);
    expect(m.isSettled(1000 + crossfadeMs - 1)).toBe(false);
    expect(m.isSettled(1000 + crossfadeMs)).toBe(true);
  });
  it('crossfades to the other slot with equal power and drains the old one', () => {
    const m = new SoundscapeMixer();
    m.setZone(prairie, 0);
    const change = m.setZone(harbour, 5000);
    expect(change).toEqual({ slot: 1, loop: 'harbour', evicted: null });
    expect(m.slotLoop(0)).toBe('prairie');
    expect(m.slotLoop(1)).toBe('harbour');
    const mid = m.gains(5000 + crossfadeMs / 2);
    near(mid[0], 0.5 * Math.SQRT1_2);
    near(mid[1], 0.8 * Math.SQRT1_2);
    expect(m.drained(5000 + crossfadeMs - 1)).toEqual([]);
    const end = m.gains(5000 + crossfadeMs);
    near(end[0], 0);
    near(end[1], 0.8);
    expect(m.drained(5000 + crossfadeMs)).toEqual([0]);
    m.release(0);
    expect(m.slotLoop(0)).toBeNull();
    expect(m.drained(9000)).toEqual([]);
  });
  it('starts a mid-fade change from the current level (no jump) and evicts a slot on rapid hopping', () => {
    const m = new SoundscapeMixer();
    m.setZone(prairie, 0);
    m.setZone(harbour, 0); // prairie → harbour immediately: slot 1 in, slot 0 out
    const c = m.setZone(silent, 750); // half way: slot 0 still holds prairie
    expect(c).toEqual({ slot: 0, loop: 'wind', evicted: 'prairie' });
    // harbour was at 0.8·sin(π/4) and now ramps to 0 from there; wind starts at 0.
    near(m.gains(750)[1], 0.8 * Math.SQRT1_2);
    near(m.gains(750)[0], 0);
    near(m.gains(750 + crossfadeMs)[0], 0.45);
    near(m.gains(750 + crossfadeMs)[1], 0);
  });
  it('re-uses the active slot when only the volume changes', () => {
    const m = new SoundscapeMixer();
    m.setZone(prairie, 0);
    expect(m.setZone({ ...prairie, volume: 1 }, 2000)).toBeNull();
    near(m.gains(2000)[0], 0.5);
    near(m.gains(2000 + crossfadeMs)[0], 1);
    expect(m.slotLoop(1)).toBeNull();
  });
  it('scales by the master volume', () => {
    const m = new SoundscapeMixer();
    m.setMaster(0.5);
    m.setZone(harbour, 0);
    near(m.gains(crossfadeMs)[0], 0.4);
    m.setMaster(2); // clamped
    near(m.gains(crossfadeMs)[0], 0.8);
  });
  it('stop() fades every slot out over fadeOutMs, then the mixer is idle', () => {
    const m = new SoundscapeMixer();
    m.setZone(prairie, 0);
    m.setZone(harbour, 10000);
    m.stop(10000 + crossfadeMs);
    expect(m.currentZone).toBeNull();
    expect(m.nextOneshotAt).toBe(Infinity);
    const t = 10000 + crossfadeMs;
    near(m.gains(t + fadeOutMs / 2)[1], 0.8 * Math.SQRT1_2);
    expect(m.drained(t + fadeOutMs).sort()).toEqual([0, 1]);
    expect(m.isIdle()).toBe(false);
    m.release(0);
    m.release(1);
    expect(m.isIdle()).toBe(true);
    expect(m.needsTick(t + fadeOutMs)).toBe(false);
  });
});

describe('SoundscapeMixer one-shot scheduler', () => {
  it('schedules within the 6–25 s window, picks ids from the zone and pans within the spread', () => {
    const m = new SoundscapeMixer();
    m.setZone(prairie, 1000);
    let t = 1000;
    for (let k = 0; k < 40; k++) {
      const due = m.nextOneshotAt;
      expect(due - t).toBeGreaterThanOrEqual(oneshotMinMs);
      expect(due - t).toBeLessThanOrEqual(oneshotMaxMs);
      expect(m.pollOneshot(due - 1)).toBeNull();
      const cue = m.pollOneshot(due);
      expect(cue).not.toBeNull();
      expect(prairie.oneshots).toContain(cue!.id);
      expect(Math.abs(cue!.pan)).toBeLessThanOrEqual(panSpread);
      near(cue!.gain, Math.min(1, prairie.volume * DEFAULT_MIXER_OPTIONS.oneshotGain));
      t = due;
      expect(m.nextOneshotAt).toBeGreaterThan(due);
    }
  });
  it('is deterministic per zone and differs between zones', () => {
    const run = (zone: SoundscapeZone) => {
      const m = new SoundscapeMixer({}, (seed) => new SeededRandom(seed));
      m.setZone(zone, 0);
      const out: string[] = [];
      for (let k = 0; k < 8; k++) {
        const t = m.nextOneshotAt;
        const cue = m.pollOneshot(t)!;
        out.push(`${t.toFixed(0)}:${cue.id}:${cue.pan.toFixed(3)}`);
      }
      return out;
    };
    expect(run(prairie)).toEqual(run(prairie));
    expect(run(prairie)).not.toEqual(run({ ...prairie, oneshots: ['gull', 'goose-honk', 'train-whistle'] }));
    expect(run(prairie)).not.toEqual(run({ ...prairie, loop: 'forest' }));
  });
  it('fires nothing for zones without one-shots, after stop(), or when the roster is unchanged', () => {
    const m = new SoundscapeMixer();
    m.setZone(silent, 0);
    expect(m.nextOneshotAt).toBe(Infinity);
    expect(m.pollOneshot(1e9)).toBeNull();
    m.setZone(prairie, 0);
    const due = m.nextOneshotAt;
    expect(m.setZone({ ...prairie, volume: 0.9 }, 100)).toBeNull();
    expect(m.nextOneshotAt).toBe(due); // same roster: schedule kept
    m.setZone({ ...prairie, oneshots: ['gull'] }, 200);
    expect(m.nextOneshotAt).not.toBe(due); // roster changed: rescheduled from now
    expect(m.nextOneshotAt).toBeGreaterThanOrEqual(200 + oneshotMinMs);
    m.stop(300);
    expect(m.pollOneshot(1e9)).toBeNull();
  });
  it('honours custom windows', () => {
    const m = new SoundscapeMixer({ oneshotMinMs: 100, oneshotMaxMs: 100 });
    m.setZone(harbour, 0);
    expect(m.nextOneshotAt).toBe(100);
    expect(m.pollOneshot(100)?.id).toBe('gull');
    expect(m.nextOneshotAt).toBe(200);
  });
});

describe('SoundscapeMixer ducking', () => {
  it('ramps the bed to 40 % over duckMs and back', () => {
    const m = new SoundscapeMixer();
    m.setZone(harbour, 0);
    const t = crossfadeMs;
    near(m.gains(t)[0], 0.8);
    m.setDucked(true, t);
    expect(m.isSettled(t)).toBe(false);
    near(m.duckFactor(t), 1);
    near(m.duckFactor(t + duckMs / 2), (1 + duckLevel) / 2);
    near(m.gains(t + duckMs)[0], 0.8 * duckLevel);
    near(m.gains(t + duckMs * 10)[0], 0.8 * duckLevel);
    expect(m.isSettled(t + duckMs)).toBe(true);
    m.setDucked(false, t + duckMs * 10);
    near(m.gains(t + duckMs * 10)[0], 0.8 * duckLevel);
    near(m.gains(t + duckMs * 11)[0], 0.8);
  });
  it('un-ducking mid-ramp continues from the current factor, and one-shots are ducked too', () => {
    const m = new SoundscapeMixer({ oneshotMinMs: 1000, oneshotMaxMs: 1000 });
    m.setZone(harbour, 0);
    m.setDucked(true, 0);
    m.setDucked(false, duckMs / 2);
    near(m.duckFactor(duckMs / 2), (1 + duckLevel) / 2);
    near(m.duckFactor(duckMs), (1 + duckLevel) / 2 + (1 - (1 + duckLevel) / 2) / 2); // half-way back
    near(m.duckFactor(duckMs * 1.5), 1);
    m.setDucked(true, 500);
    const cue = m.pollOneshot(1000)!;
    near(cue.gain, duckLevel * Math.min(1, harbour.volume * DEFAULT_MIXER_OPTIONS.oneshotGain));
  });
  it('with duckMs = 0 the change is immediate', () => {
    const m = new SoundscapeMixer({ duckMs: 0 });
    m.setZone(harbour, 0);
    m.setDucked(true, crossfadeMs);
    near(m.gains(crossfadeMs)[0], 0.8 * duckLevel);
    expect(m.isSettled(crossfadeMs)).toBe(true);
  });
});
