#!/usr/bin/env node
/**
 * Procedural soundscapes — per-district / per-zone ambience loops and one-shot cues synthesised offline.
 * No samples are downloaded: everything is filtered noise (brown/pink via one-pole filters), sine/FM tones with
 * envelopes, biquad resonators, comb reverbs and granular crackle, driven by a seeded PRNG so every run produces
 * identical bytes (licence: Generated). Output: 22050 Hz mono 16-bit WAV.
 *
 *   generateSoundscapes({ outDir, upsertCredit })  → writes <outDir>/audio/<name>.wav, credits each file.
 *   Idempotent: existing files are never overwritten (wind.wav from scripts/assets.mjs is kept as-is).
 *
 * Loops are 8–12 s and seamless: the renderer produces 0.5 s of pre-roll (filters settle) + loop + 0.3 s of
 * tail, and the tail is equal-power crossfaded into the head. Peak ≤ -3 dBFS, RMS-normalised for even loudness.
 *
 *   node scripts/lib/soundscapes.mjs [outDir]   → renders everything into <outDir>/audio and prints a table.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const RATE = 22050;
const PEAK = Math.pow(10, -3 / 20); // -3 dBFS
const LOOP_RMS = 0.14; // loudness target for loops before the peak cap
const SEAM = 0.3; // loop crossfade seconds
const PRE = 0.5; // pre-roll seconds (discarded; lets filters/envelopes settle)
const TAU = Math.PI * 2;
const SOURCE = 'https://github.com/kinncj/OhCanada/blob/main/scripts/lib/soundscapes.mjs';
const AUTHOR = 'TrueNorth (scripts/lib/soundscapes.mjs)';
const sec = (s) => Math.round(s * RATE);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------------------------- RNG
export function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** mulberry32 — same generator as common/rng.ts so seeds mean the same thing everywhere. */
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a, b) => a + (b - a) * next(), sym: (a = 1) => (next() * 2 - 1) * a, pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

// ---------------------------------------------------------------------------------------------- WAV (as in scripts/assets.mjs)
export function wav(samples, rate = RATE) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}

// ---------------------------------------------------------------------------------------------- buffers
const zeros = (n) => new Float32Array(n);
const copy = (x) => Float32Array.from(x);
function add(dst, src, at = 0, g = 1) { const n = Math.min(src.length, dst.length - at); for (let i = 0; i < n; i++) dst[at + i] += src[i] * g; return dst; }
function gain(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
function mulEnv(x, e) { for (let i = 0; i < x.length; i++) x[i] *= e[i]; return x; }
function peak(x) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; }
function rms(x) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)); }
function norm(x, p = 1) { const m = peak(x); if (m > 0) gain(x, p / m); return x; }
function fadeEdges(x, ms = 4) { const k = Math.min(sec(ms / 1000), x.length >> 1); for (let i = 0; i < k; i++) { const g = i / k; x[i] *= g; x[x.length - 1 - i] *= g; } return x; }

// ---------------------------------------------------------------------------------------------- noise
function white(rng, n) { const o = zeros(n); for (let i = 0; i < n; i++) o[i] = rng.sym(); return o; }
/** Pink noise via Paul Kellet's three one-pole economy filter. */
function pink(rng, n) {
  const o = zeros(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = rng.sym(); b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; o[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; }
  return norm(o);
}
/** Brown noise: leaky one-pole integrator of white noise. */
function brown(rng, n, leak = 0.998) { const o = zeros(n); let b = 0; for (let i = 0; i < n; i++) { b = (b + rng.sym(0.02)) * leak; o[i] = b; } return norm(o); }
/** Random impulses (granular crackle), `perSecond` average density. */
function crackle(rng, n, perSecond, amp = () => 1) { const o = zeros(n), p = perSecond / RATE; for (let i = 0; i < n; i++) if (rng.next() < p) o[i] = rng.sym() * amp(); return o; }

// ---------------------------------------------------------------------------------------------- filters
function coeffs(type, fc, Q) {
  const w = (TAU * clamp(fc, 10, RATE * 0.45)) / RATE, cw = Math.cos(w), sw = Math.sin(w), alpha = sw / (2 * Q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; } else { b0 = alpha; b1 = 0; b2 = -alpha; }
  const a0 = 1 + alpha;
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * cw) / a0, (1 - alpha) / a0];
}
/** RBJ biquad in place; `fc` may be a number or a function of the sample index (swept filter). */
function biquad(x, type, fc, Q = 0.707) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const fixed = typeof fc === 'number';
  let c = fixed ? coeffs(type, fc, Q) : null;
  for (let i = 0; i < x.length; i++) {
    if (!fixed) c = coeffs(type, fc(i), Q);
    const y = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
const lp = (x, fc, Q) => biquad(x, 'lp', fc, Q);
const hp = (x, fc, Q) => biquad(x, 'hp', fc, Q);
const bp = (x, fc, Q) => biquad(x, 'bp', fc, Q);
/** Feedback comb filter in place (hollow bodies, reverb). */
function comb(x, delaySec, fb) { const d = Math.max(1, sec(delaySec)); for (let i = d; i < x.length; i++) x[i] += fb * x[i - d]; return x; }
/** Tiny Schroeder-style reverb: four parallel combs + a low-pass, mixed with the dry signal. */
function reverb(x, { mix = 0.25, size = 1, decay = 0.6 } = {}) {
  const wet = zeros(x.length);
  for (const d of [0.0297, 0.0371, 0.0411, 0.0437]) add(wet, comb(copy(x), d * size, decay), 0, 0.25);
  lp(wet, 3800);
  const out = zeros(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * (1 - mix) + wet[i] * mix * (1 - decay) * 1.5;
  return out;
}
/** Parallel band-pass resonators (vocal-tract style formants). */
function formants(x, list) { const out = zeros(x.length); for (const [fc, Q, g] of list) add(out, bp(copy(x), fc, Q), 0, g); return out; }

// ---------------------------------------------------------------------------------------------- envelopes & oscillators
function env(n, fn) { const o = zeros(n); for (let i = 0; i < n; i++) o[i] = fn(i / n, i / RATE, i); return o; }
function ar(n, attack, release) { const A = Math.max(1, sec(attack)), R = Math.max(1, sec(release)); return env(n, (_u, _t, i) => (i < A ? Math.sin((Math.PI / 2) * (i / A)) ** 2 : i > n - R ? Math.cos((Math.PI / 2) * ((i - (n - R)) / R)) ** 2 : 1)); }
function expDecay(n, tau) { return env(n, (_u, t) => Math.exp(-t / tau)); }
/** Smooth random envelope in [1-depth, 1]: random points at `hz`, cosine-interpolated, raised to `power` for sparseness. */
function gusts(rng, n, hz, depth, power = 1) {
  const step = RATE / hz, pts = Array.from({ length: Math.ceil(n / step) + 2 }, () => rng.next()), o = zeros(n);
  for (let i = 0; i < n; i++) { const p = i / step, k = Math.floor(p), s = 0.5 - 0.5 * Math.cos(Math.PI * (p - k)); o[i] = 1 - depth + depth * (pts[k] * (1 - s) + pts[k + 1] * s) ** power; }
  return o;
}
/** Oscillator with a phase accumulator; `freq` is Hz or fn(i, t). Waves: sine | pulse | tri | saw (band-limited additive). */
function osc(n, freq, wave = 'sine', phase0 = 0) {
  const o = zeros(n); let ph = phase0; const fixed = typeof freq === 'number';
  for (let i = 0; i < n; i++) {
    const f = fixed ? freq : freq(i, i / RATE);
    if (wave === 'sine') o[i] = Math.sin(TAU * ph);
    else if (wave === 'pulse') o[i] = ph < 0.5 ? 1 : -1;
    else if (wave === 'tri') o[i] = 4 * Math.abs(ph - 0.5) - 1;
    else { const H = clamp(Math.floor((0.45 * RATE) / Math.max(f, 20)), 1, 80), p = TAU * ph; let s = 0; for (let k = 1; k <= H; k++) s += Math.sin(k * p) / k; o[i] = s * (2 / Math.PI); }
    ph += f / RATE; ph -= Math.floor(ph);
  }
  return o;
}
/** Periodic wave-set envelope: (raised cosine)^shape with period `period` seconds, offset `off` samples, lagged by `lag` seconds. */
function swell(n, off, period, shape, lag = 0, floor = 0) { const P = sec(period), L = sec(lag); return env(n, (_u, _t, i) => { const ph = (((i - off - L) % P) + P) % P / P; return floor + (1 - floor) * (0.5 - 0.5 * Math.cos(TAU * ph)) ** shape; }); }

/**
 * Seamless loop: render(N, off) fills N = pre-roll + loop + seam samples (off = pre-roll length); the seam tail is
 * equal-power crossfaded into the loop head. Generators place discrete events with `place()` so none straddles the seam.
 */
function seamless(seconds, render) {
  const n = sec(seconds), X = sec(SEAM), off = sec(PRE);
  const r = render(off + n + X, off);
  hp(r, 20); // DC removal (brown noise drifts); the pre-roll absorbs the filter's start-up
  const out = zeros(n);
  out.set(r.subarray(off, off + n));
  for (let i = 0; i < X; i++) { const k = (Math.PI / 2) * (i / X); out[i] = r[off + i] * Math.sin(k) + r[off + n + i] * Math.cos(k); }
  return out;
}
/** Random start index for an event of `len` samples that stays inside the loop body (never in the seam). */
const place = (rng, N, len) => Math.floor(rng.range(sec(PRE + SEAM), Math.max(sec(PRE + SEAM) + 1, N - sec(SEAM) - len)));
/** Lapping water texture (shared by canal and harbour). */
function lapping(rng, N) {
  const laps = zeros(N).fill(0.12);
  for (let t = 0; t < N; t += sec(rng.range(0.5, 1.4))) { const len = sec(rng.range(0.5, 1.4)), a = rng.range(0.4, 1); for (let i = 0; i < len && t + i < N; i++) laps[t + i] += a * Math.sin((Math.PI * i) / len) ** 2; }
  const water = mulEnv(bp(white(rng, N), 700, 0.6), laps);
  add(water, mulEnv(bp(white(rng, N), 250, 1.2), laps), 0, 0.5);
  for (let k = 0; k < 8; k++) { const f0 = rng.range(700, 1800), len = sec(0.09), b = mulEnv(osc(len, (i) => f0 * (1 + (0.3 * i) / len)), expDecay(len, 0.02)); add(water, b, place(rng, N, len), 0.15); }
  return norm(water);
}
/** Gull cry: two raspy descending notes (shared by harbour loop and gull one-shot). */
function gullCry(rng, pitch = 1) {
  const out = zeros(sec(0.95));
  for (const [s, l, f0, f1] of [[0, 0.5, 1500, 1050], [0.54, 0.36, 1650, 1250]]) {
    const len = sec(l), rasp = rng.range(28, 36);
    const c = osc(len, (i, t) => pitch * (f0 + (f1 - f0) * (i / len)) * (1 + 0.05 * Math.sin(TAU * rasp * t)), 'saw');
    bp(c, 2000 * pitch, 1.2); mulEnv(c, ar(len, 0.05, 0.12)); add(out, c, sec(s));
  }
  return norm(out);
}
/** Goose honk: sawtooth glide through nasal formants. */
function honk(rng, pitch = 1, seconds = 0.42) {
  const n = sec(seconds), fq = Math.sqrt(pitch);
  const src = osc(n, (i) => pitch * (360 + 110 * Math.sin(Math.PI * Math.min(1, (i / n) * 1.1))), 'saw');
  add(src, white(rng, n), 0, 0.12);
  const out = formants(src, [[620 * fq, 5, 1], [1250 * fq, 6, 0.6], [2500 * fq, 8, 0.3]]);
  add(out, src, 0, 0.15); lp(out, 4200); mulEnv(out, ar(n, 0.035, 0.09));
  return norm(out);
}
function footThud(rng, f, decay) { const len = sec(0.25); return mulEnv(osc(len, (i) => f * Math.exp((-i / len) * 1.2)), expDecay(len, decay)); }

// ---------------------------------------------------------------------------------------------- loops
export const LOOPS = {
  wind: { seconds: 10, title: 'Open prairie wind (ambience loop)', make: (rng) => seamless(10, (N) => {
    const g = gusts(rng, N, 0.18, 0.7, 1.5);
    const out = mulEnv(lp(brown(rng, N), 380), g);
    add(out, mulEnv(bp(pink(rng, N), 900, 5), mulEnv(gusts(rng, N, 0.3, 1, 3), g)), 0, 0.12);
    return out;
  }) },
  'canal-water': { seconds: 10, title: 'Canal: lapping water with distant traffic (ambience loop)', make: (rng) => seamless(10, (N) => {
    const out = lapping(rng, N);
    add(out, norm(mulEnv(lp(brown(rng, N), 110), gusts(rng, N, 0.2, 0.4))), 0, 0.35);
    return out;
  }) },
  'city-hum': { seconds: 12, title: 'City: distant traffic hum with a far horn (ambience loop)', make: (rng) => seamless(12, (N) => {
    const out = norm(mulEnv(lp(brown(rng, N), 160), gusts(rng, N, 0.25, 0.45)));
    add(out, norm(mulEnv(lp(pink(rng, N), 1100), gusts(rng, N, 0.4, 0.5))), 0, 0.22);
    for (let k = 0; k < 2; k++) {
      const len = sec(rng.range(0.9, 1.6)), f = rng.pick([311, 370, 415]);
      const horn = osc(len, f); add(horn, osc(len, f * 1.26), 0, 0.8); add(horn, osc(len, f * 0.5), 0, 0.4); add(horn, bp(white(rng, len), f, 3), 0, 0.15);
      lp(horn, 900); mulEnv(horn, ar(len, 0.25, 0.45)); add(out, norm(horn), place(rng, N, len), 0.13);
    }
    return out;
  }) },
  forest: { seconds: 12, title: 'Boreal forest: wind in conifers with birdsong (ambience loop)', make: (rng) => seamless(12, (N) => {
    const g = gusts(rng, N, 0.2, 0.8, 1.6);
    const out = gain(norm(mulEnv(bp(pink(rng, N), 1600, 0.5), g)), 0.55);
    add(out, norm(mulEnv(lp(brown(rng, N), 300), gusts(rng, N, 0.15, 0.5))), 0, 0.5);
    const species = Array.from({ length: 3 }, () => ({ f: rng.range(2400, 4200), slide: rng.range(0.7, 1.5), len: rng.range(0.05, 0.13), gap: rng.range(0.07, 0.18), count: Math.floor(rng.range(2, 6)) }));
    for (let p = 0; p < 6; p++) {
      const s = rng.pick(species); let at = place(rng, N, sec(2));
      for (let c = 0; c < s.count; c++) {
        const len = sec(s.len * rng.range(0.85, 1.15)), f0 = s.f * rng.range(0.95, 1.05);
        const chirp = mulEnv(osc(len, (i) => f0 * Math.pow(s.slide, i / len)), env(len, (u) => Math.sin(Math.PI * u) ** 1.5));
        add(out, chirp, at, 0.22 * rng.range(0.6, 1)); at += len + sec(s.gap);
      }
    }
    return out;
  }) },
  ocean: { seconds: 10, title: 'Ocean: rolling waves with foam hiss, 10 s period (ambience loop)', make: (rng) => seamless(10, (N, off) => {
    const wave = swell(N, off, 10, 2.5, 0, 0.06); add(wave, swell(N, off, 5, 3, 1.5), 0, 0.35);
    const out = norm(mulEnv(lp(brown(rng, N), 220), wave));
    add(out, norm(mulEnv(bp(white(rng, N), 2800, 0.4), swell(N, off, 10, 1.8, 1.3, 0.12))), 0, 0.55);
    add(out, norm(mulEnv(lp(pink(rng, N), 1500), swell(N, off, 10, 2, 0.6, 0.1))), 0, 0.4);
    return out;
  }) },
  rain: { seconds: 10, title: 'Rain on ground with occasional drips (ambience loop)', make: (rng) => seamless(10, (N) => {
    const patter = hp(lp(crackle(rng, N, 2500, () => rng.range(0.2, 1) ** 2), 5000), 350);
    const out = norm(mulEnv(patter, gusts(rng, N, 0.12, 0.3)));
    add(out, norm(hp(pink(rng, N), 600)), 0, 0.45);
    for (let k = 0; k < 6; k++) { const len = sec(0.14), f0 = rng.range(900, 1600); add(out, mulEnv(osc(len, (i) => f0 * (1 + (0.5 * i) / len)), expDecay(len, 0.03)), place(rng, N, len), 0.3); }
    return out;
  }) },
  snowfield: { seconds: 10, title: 'Snowfield: muffled wind with soft creaks (ambience loop)', make: (rng) => seamless(10, (N) => {
    const g = gusts(rng, N, 0.12, 0.6, 1.3);
    const out = norm(mulEnv(lp(brown(rng, N), 240), g));
    add(out, norm(mulEnv(bp(white(rng, N), 500, 0.8), mulEnv(gusts(rng, N, 0.3, 1, 2.5), g))), 0, 0.12);
    for (let k = 0; k < 4; k++) {
      const len = sec(rng.range(0.4, 0.9)), f0 = rng.range(800, 1300);
      const c = mulEnv(bp(white(rng, len), (i) => f0 * (1 + (0.5 * i) / len), 14), env(len, (u) => Math.sin(Math.PI * u) ** 2));
      add(out, norm(c), place(rng, N, len), 0.1);
    }
    return out;
  }) },
  harbour: { seconds: 12, title: 'Harbour: waves, gull cries and rope creak (ambience loop)', make: (rng) => seamless(12, (N, off) => {
    const out = norm(mulEnv(lp(brown(rng, N), 200), swell(N, off, 6, 2.2, 0, 0.08)));
    add(out, norm(mulEnv(bp(white(rng, N), 2500, 0.5), swell(N, off, 6, 1.5, 0.9, 0.1))), 0, 0.4);
    add(out, lapping(rng, N), 0, 0.35);
    for (let k = 0; k < 3; k++) { const g = lp(gullCry(rng, rng.range(0.9, 1.15)), 2600); add(out, g, place(rng, N, g.length), 0.16 * rng.range(0.6, 1)); }
    for (let k = 0; k < 2; k++) {
      const len = sec(rng.range(0.6, 1.1));
      const c = bp(osc(len, (i) => 55 + 35 * Math.sin((Math.PI * i) / len), 'pulse'), (i) => 650 + (250 * i) / len, 9);
      add(out, norm(mulEnv(c, env(len, (u) => Math.sin(Math.PI * u) ** 1.2))), place(rng, N, len), 0.12);
    }
    return out;
  }) },
  'tundra-wind': { seconds: 10, title: 'Tundra: thin high wind, sparse (ambience loop)', make: (rng) => seamless(10, (N) => {
    const g = gusts(rng, N, 0.1, 0.85, 2.5);
    const out = gain(norm(mulEnv(hp(white(rng, N), 1400), g)), 0.7);
    const wf = gusts(rng, N, 0.35, 1);
    add(out, norm(mulEnv(bp(white(rng, N), (i) => 1500 + 1300 * wf[i], 22), mulEnv(gusts(rng, N, 0.25, 1, 3), g))), 0, 0.35);
    add(out, norm(mulEnv(lp(brown(rng, N), 300), g)), 0, 0.25);
    return out;
  }) },
  campfire: { seconds: 8, title: 'Campfire: crackle and low roar (ambience loop)', make: (rng) => seamless(8, (N) => {
    const out = norm(mulEnv(lp(brown(rng, N), 140), gusts(rng, N, 0.6, 0.35)));
    add(out, norm(mulEnv(bp(pink(rng, N), 450, 0.6), mulEnv(gusts(rng, N, 7, 0.6), gusts(rng, N, 0.5, 0.5)))), 0, 0.35);
    for (let k = 0; k < 45; k++) {
      const len = sec(rng.range(0.008, 0.03)), c = bp(white(rng, len), rng.range(1500, 5500), 5);
      add(out, norm(mulEnv(c, expDecay(len, len / RATE / 3))), place(rng, N, len), rng.range(0.15, 0.6) ** 1.5);
    }
    for (let k = 0; k < 5; k++) { const len = sec(0.04); add(out, norm(mulEnv(lp(white(rng, len), 1200), expDecay(len, 0.008))), place(rng, N, len), 0.5); }
    return out;
  }) },
  prairie: { seconds: 10, title: 'Prairie: wind through grain with insects (ambience loop)', make: (rng) => seamless(10, (N) => {
    const g = gusts(rng, N, 0.25, 0.7, 1.4);
    const out = gain(norm(mulEnv(bp(pink(rng, N), 2200, 0.7), g)), 0.6);
    add(out, norm(mulEnv(lp(brown(rng, N), 320), gusts(rng, N, 0.15, 0.5))), 0, 0.55);
    for (let v = 0; v < 3; v++) {
      const f = rng.range(3800, 6500), am = rng.range(22, 48);
      for (let t = sec(PRE + SEAM); t < N - sec(SEAM + 1.3); t += sec(rng.range(0.6, 2.2))) {
        const len = sec(rng.range(0.4, 1.2));
        add(out, mulEnv(osc(len, f), env(len, (u, tt) => (0.5 + 0.5 * Math.sin(TAU * am * tt)) ** 3 * Math.sin(Math.PI * u) ** 0.5)), t, 0.045);
        t += len;
      }
    }
    return out;
  }) },
  rink: { seconds: 10, title: 'Arena rink: hum with distant skate scrapes (ambience loop)', make: (rng) => seamless(10, (N) => {
    const hum = zeros(N);
    for (const [f, a] of [[60, 1], [120, 0.5], [180, 0.3], [240, 0.15]]) { add(hum, osc(N, f), 0, a); add(hum, osc(N, f + 0.3), 0, a * 0.5); }
    const out = gain(norm(hum), 0.45);
    add(out, norm(mulEnv(lp(pink(rng, N), 900), gusts(rng, N, 0.06, 0.2))), 0, 0.5);
    add(out, norm(lp(brown(rng, N), 500)), 0, 0.35);
    for (let k = 0; k < 5; k++) {
      const len = sec(rng.range(0.3, 0.55));
      const s = lp(mulEnv(bp(white(rng, len), (i) => 3200 - (1700 * i) / len, 3), env(len, (u) => Math.sin(Math.PI * u) ** 0.8)), 2400);
      add(out, norm(s), place(rng, N, len), 0.1);
    }
    const thump = footThud(rng, 95, 0.08); add(thump, lp(white(rng, sec(0.02)), 1500), 0, 0.5); add(out, norm(thump), place(rng, N, thump.length), 0.18);
    return out;
  }) },
  'aurora-drone': { seconds: 12, level: 0.6, title: 'Aurora: soft evolving synth pad for the North at night (ambience loop)', make: (rng) => seamless(12, (N, off) => {
    // Just-intonation A2 sus2/add9 voicing; every frequency, detune and LFO completes whole cycles in 12 s so the loop is truly periodic.
    const voices = [[110, 12], [165, 6], [247.5, 4], [1100 / 3, 3]], d = 1 / 12;
    const pad = zeros(N);
    for (const [f, period] of voices) {
      const v = osc(N, f); add(v, osc(N, f - d), 0, 0.8); add(v, osc(N, f + d), 0, 0.8); add(v, osc(N, 2 * f + 2 * d), 0, 0.25); add(v, osc(N, 3 * f), 0, 0.1);
      const phase = rng.next() * TAU;
      add(pad, mulEnv(v, env(N, (_u, _t, i) => 0.55 + 0.45 * Math.sin((TAU * (i - off)) / sec(period) + phase))), 0, 1 / voices.length);
    }
    lp(pad, (i) => 500 + 400 * Math.sin((TAU * (i - off)) / sec(12)), 0.9);
    const out = norm(pad);
    add(out, norm(mulEnv(hp(pink(rng, N), 3500), env(N, (_u, _t, i) => 0.5 + 0.5 * Math.sin((TAU * (i - off)) / sec(6))))), 0, 0.03);
    return out;
  }) },
};

// ---------------------------------------------------------------------------------------------- one-shots
export const ONESHOTS = {
  'goose-honk': { title: 'Canada goose honk (one-shot)', make: (rng) => honk(rng) },
  'goose-flock': { title: 'Canada goose flock, several honks (one-shot)', make: (rng) => {
    const out = zeros(sec(2.6));
    for (let k = 0; k < 7; k++) { const h = honk(rng, rng.range(0.85, 1.2), rng.range(0.3, 0.5)); if (rng.next() < 0.5) lp(h, 2500); add(out, h, Math.floor(rng.range(0, sec(2.0))), rng.range(0.45, 1)); }
    return out;
  } },
  'loon-call': { title: 'Common loon two-note tremolo call (one-shot)', make: () => {
    const out = zeros(sec(2.2));
    const note = (start, l, fFn, trem) => { const len = sec(l); const v = osc(len, fFn); add(v, osc(len, (i, t) => 2 * fFn(i, t)), 0, 0.3); mulEnv(v, env(len, (_u, t) => 1 - trem + trem * (0.5 + 0.5 * Math.sin(TAU * 11 * t)))); add(out, mulEnv(v, ar(len, 0.06, 0.15)), sec(start)); };
    note(0, 0.55, (i) => 600 + (90 * i) / sec(0.55), 0.25);
    note(0.6, 0.95, (i, t) => (880 - (50 * i) / sec(0.95)) * (1 + 0.01 * Math.sin(TAU * 5 * t)), 0.6);
    return reverb(out, { mix: 0.3, size: 1.4, decay: 0.7 });
  } },
  'beaver-splash': { title: 'Beaver tail slap and splash (one-shot)', make: (rng) => {
    const n = sec(1.3), out = hp(lp(mulEnv(white(rng, sec(0.03)), ar(sec(0.03), 0.002, 0.02)), 3000), 200);
    const body = mulEnv(lp(white(rng, n), (i) => 4000 * Math.exp((-i / n) * 2.5) + 500), expDecay(n, 0.3));
    const res = add(zeros(n), out); add(res, body, sec(0.02), 0.8); add(res, footThud(rng, 70, 0.15), 0, 0.5);
    for (let k = 0; k < 8; k++) { const len = sec(0.08), f0 = rng.range(1200, 2500); add(res, mulEnv(osc(len, (i) => f0 * (1 + (0.25 * i) / len)), expDecay(len, 0.03)), sec(rng.range(0.15, 1.0)), 0.2); }
    return res;
  } },
  'moose-call': { title: 'Bull moose bellow (one-shot)', make: (rng) => {
    const n = sec(2.0), src = osc(n, (i, t) => (95 + 55 * Math.sin((Math.PI * i) / n) ** 0.7) * (1 + 0.01 * Math.sin(TAU * 6 * t)), 'saw');
    const out = formants(src, [[330, 4, 1], [780, 5, 0.6], [1500, 6, 0.25]]);
    add(out, src, 0, 0.35); add(out, bp(white(rng, n), 900, 2), 0, 0.12); lp(out, 2500); mulEnv(out, ar(n, 0.25, 0.5));
    return reverb(out, { mix: 0.2, size: 1.2 });
  } },
  'bear-grunt': { title: 'Black bear grunt (one-shot)', make: (rng) => {
    const n = sec(0.7), src = osc(n, (i) => (72 - (18 * i) / n) * (1 + rng.sym(0.03)), 'pulse');
    const out = formants(src, [[240, 3, 1], [620, 4, 0.5]]);
    add(out, mulEnv(lp(white(rng, n), 700), ar(n, 0.01, 0.5)), 0, 0.25); lp(out, 1400);
    return mulEnv(out, env(n, (u) => (u < 0.03 ? u / 0.03 : Math.exp(-(u - 0.03) * 4))));
  } },
  gull: { title: 'Herring gull cry (one-shot)', make: (rng) => reverb(gullCry(rng), { mix: 0.15 }) },
  'skate-scrape': { title: 'Skate blade scrape on ice (one-shot)', make: (rng) => {
    const n = sec(0.55), out = mulEnv(bp(white(rng, n), (i) => 3200 - (1800 * i) / n, 4), ar(n, 0.04, 0.08));
    add(out, mulEnv(hp(white(rng, n), 6000), ar(n, 0.05, 0.1)), 0, 0.3);
    add(out, hp(mulEnv(white(rng, sec(0.01)), expDecay(sec(0.01), 0.003)), 2000), 0, 0.6);
    return out;
  } },
  'footstep-snow': { title: 'Footstep in snow (one-shot)', make: (rng) => {
    const n = sec(0.32), out = zeros(n);
    for (const [at, g, l] of [[0, 1, 0.16], [0.12, 0.6, 0.14]]) { const len = sec(l); const c = bp(mulEnv(crackle(rng, len, 6000, () => rng.range(0.3, 1)), env(len, (u) => (u < 0.06 ? u / 0.06 : Math.exp(-(u - 0.06) * 5)))), 1800, 0.7); add(out, c, sec(at), g); }
    add(out, mulEnv(lp(brown(rng, n), 600), expDecay(n, 0.05)), 0, 0.5);
    return out;
  } },
  'footstep-gravel': { title: 'Footstep on gravel (one-shot)', make: (rng) => {
    const n = sec(0.38), out = bp(mulEnv(crackle(rng, n, 1400, () => rng.range(0.2, 1) ** 2), env(n, (u) => (u < 0.05 ? u / 0.05 : Math.exp(-(u - 0.05) * 6)))), 3000, 2);
    add(out, mulEnv(lp(white(rng, n), 400), expDecay(n, 0.04)), 0, 0.5);
    return out;
  } },
  'footstep-wood': { title: 'Footstep on wooden boardwalk (one-shot)', make: (rng) => {
    const n = sec(0.3), out = zeros(n);
    add(out, footThud(rng, 110, 0.12), 0, 0.9);
    add(out, bp(mulEnv(white(rng, sec(0.03)), expDecay(sec(0.03), 0.008)), 900, 6), 0, 0.8);
    return lp(comb(out, 0.004, 0.6), 2500);
  } },
  'train-whistle': { title: 'Train horn chord in the distance (one-shot)', make: (rng) => {
    const n = sec(2.6), out = zeros(n);
    for (const f of [233, 311, 370, 466]) {
      const fFn = (i, t) => f * (1 + 0.015 * Math.exp(-t * 8) - 0.02 * Math.max(0, i / n - 0.8) * 5) * (1 + 0.004 * Math.sin(TAU * 6 * t));
      const v = osc(n, fFn); add(v, osc(n, (i, t) => 2 * fFn(i, t)), 0, 0.4); add(v, osc(n, (i, t) => 3 * fFn(i, t)), 0, 0.2); add(v, bp(white(rng, n), f, 3), 0, 0.15);
      add(out, v, 0, 0.25);
    }
    lp(out, 3000); mulEnv(out, ar(n, 0.2, 0.5));
    return reverb(out, { mix: 0.3, size: 1.6, decay: 0.7 });
  } },
  'church-bell': { title: 'Church bell strike (one-shot)', make: (rng) => {
    const n = sec(3.0), f0 = 349, out = zeros(n);
    for (const [r, g, tau] of [[0.5, 0.6, 1.4], [1, 0.8, 1.0], [1.2, 0.5, 0.6], [1.5, 0.35, 0.5], [2, 0.6, 0.4], [2.51, 0.25, 0.28], [3, 0.2, 0.2], [4.2, 0.15, 0.12]]) {
      add(out, mulEnv(osc(n, f0 * r), expDecay(n, tau)), 0, g); add(out, mulEnv(osc(n, f0 * r + 0.7), expDecay(n, tau)), 0, g * 0.5);
    }
    add(out, bp(mulEnv(white(rng, sec(0.015)), expDecay(sec(0.015), 0.004)), 3000, 2), 0, 0.5);
    return out;
  } },
  'fiddle-riff': { title: 'Fiddle riff, short D-pentatonic phrase (one-shot)', make: (rng) => {
    const D4 = 293.66, notes = [[D4, 0.2], [329.63, 0.2], [369.99, 0.2], [440, 0.4], [493.88, 0.2], [440, 0.2], [369.99, 0.2], [D4, 0.6]];
    const out = zeros(sec(2.6)); let at = 0;
    for (const [f, d] of notes) {
      const len = sec(d + 0.05);
      const v = osc(len, (_i, t) => f * (1 + 0.006 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 0.15)), 'saw');
      const body = formants(v, [[280, 2, 0.8], [650, 2, 0.6], [1400, 2, 0.4], [3000, 2, 0.2]]); add(body, v, 0, 0.5); add(body, bp(white(rng, len), 3000, 1), 0, 0.03);
      add(out, mulEnv(body, ar(len, 0.04, 0.06)), at); at += sec(d);
    }
    return reverb(out, { mix: 0.18, size: 1.2 });
  } },
  'whistle-referee': { title: 'Referee pea whistle (one-shot)', make: (rng) => {
    const n = sec(0.85), rate = rng.range(0.85, 1.15) * 38, out = zeros(n);
    for (const f of [2150, 2330]) add(out, osc(n, (_i, t) => f * (1 + 0.01 * Math.exp(-t * 20))), 0, 0.5);
    add(out, bp(white(rng, n), 2200, 3), 0, 0.2);
    mulEnv(out, env(n, (_u, t) => 0.55 + 0.45 * Math.sin(TAU * rate * t)));
    return mulEnv(out, ar(n, 0.015, 0.08));
  } },
  'camera-shutter': { title: 'Camera shutter click (one-shot)', make: (rng) => {
    const out = zeros(sec(0.3));
    const click = (at, len, fc, g) => { add(out, bp(mulEnv(white(rng, sec(len)), expDecay(sec(len), len / 3)), fc, 3), sec(at), g); };
    click(0, 0.006, 3500, 1); add(out, mulEnv(osc(sec(0.004), 400), expDecay(sec(0.004), 0.002)), 0, 0.5);
    add(out, mulEnv(bp(white(rng, sec(0.06)), 1500, 1), env(sec(0.06), (u, t) => Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(TAU * 120 * t)))), sec(0.02), 0.15);
    click(0.11, 0.008, 2800, 0.8); add(out, mulEnv(osc(sec(0.015), 250), expDecay(sec(0.015), 0.005)), sec(0.11), 0.5);
    return hp(out, 200);
  } },
};

// ---------------------------------------------------------------------------------------------- rendering & generation
function finishLoop(x, level = 1) {
  const r = rms(x); if (r > 0) gain(x, LOOP_RMS / r);
  const p = peak(x); if (p > PEAK) gain(x, PEAK / p);
  return level === 1 ? x : gain(x, level);
}
const finishShot = (x) => norm(fadeEdges(hp(x, 25), 3), PEAK);

/** Render one sound by name (deterministic: the seed is the name). */
export function render(name) {
  const loop = LOOPS[name], shot = ONESHOTS[name];
  if (!loop && !shot) throw new Error(`unknown soundscape "${name}"`);
  const rng = makeRng(hashString(name));
  return loop ? finishLoop(loop.make(rng), loop.level ?? 1) : finishShot(shot.make(rng));
}
export const SOUNDSCAPE_NAMES = [...Object.keys(LOOPS), ...Object.keys(ONESHOTS)];

/**
 * Write every loop and one-shot into <outDir>/audio and credit it. Existing files are skipped (idempotent; a
 * pre-existing wind.wav — owned and credited by scripts/assets.mjs — is neither overwritten nor re-credited).
 * Returns [{ file, path, written, bytes, seconds, kind }].
 */
export async function generateSoundscapes({ outDir, upsertCredit, log = () => {} }) {
  const dir = join(outDir, 'audio');
  mkdirSync(dir, { recursive: true });
  const report = [];
  for (const name of SOUNDSCAPE_NAMES) {
    const kind = LOOPS[name] ? 'loop' : 'oneshot', spec = LOOPS[name] ?? ONESHOTS[name];
    const file = `${name}.wav`, path = join(dir, file);
    const existed = existsSync(path);
    if (!existed) {
      const bytes = wav(render(name));
      writeFileSync(path, bytes);
      log(`wrote audio/${file} (${(bytes.byteLength / 1e6).toFixed(2)} MB, ${kind})`);
    }
    if (!existed || name !== 'wind') upsertCredit({ path: `audio/${file}`, title: spec.title, author: AUTHOR, license: 'Generated', source: SOURCE });
    const bytes = statSync(path).size;
    report.push({ file, path, written: !existed, bytes, seconds: (bytes - 44) / 2 / RATE, kind });
  }
  return report;
}

// CLI: node scripts/lib/soundscapes.mjs [outDir]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ?? join(tmpdir(), 'truenorth-soundscapes');
  const credits = [];
  const t0 = Date.now();
  const report = await generateSoundscapes({ outDir, upsertCredit: (c) => credits.push(c), log: console.log });
  let total = 0;
  for (const r of report) { total += r.bytes; console.log(`${r.kind.padEnd(7)} ${r.seconds.toFixed(2).padStart(6)} s ${(r.bytes / 1e3).toFixed(0).padStart(6)} kB  ${r.file}${r.written ? '' : '  (kept)'}`); }
  console.log(`${report.length} files, ${(total / 1e6).toFixed(2)} MB, ${credits.length} credits, ${((Date.now() - t0) / 1000).toFixed(1)} s → ${join(outDir, 'audio')}`);
}
