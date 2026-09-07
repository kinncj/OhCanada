#!/usr/bin/env node
/**
 * make assets — idempotent asset pipeline into assets/dist (served as Vite publicDir).
 *  1. assets/src/manifest.json lists remote CC0/CC-BY sources (HDRIs, glTF) with licence metadata.
 *     Each is fetched once (skipped if the output exists) and recorded in assets/credits.json.
 *  2. Procedural audio (wind loop + UI cues) is synthesised as 16-bit WAV (licence: Generated).
 *  3. Any assets/src/**.glb is compressed with gltf-transform (draco + resize + ktx2 when toktx is on PATH).
 * Re-running never changes bytes that already exist.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'assets', 'src');
const dist = join(root, 'assets', 'dist');
const creditsPath = join(root, 'assets', 'credits.json');
mkdirSync(dist, { recursive: true });
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : { $schema: '../content/schemas/credits.schema.json', assets: [] };
const upsertCredit = (entry) => {
  const i = credits.assets.findIndex((a) => a.path === entry.path);
  if (i >= 0) credits.assets[i] = entry;
  else credits.assets.push(entry);
};

// 1. Remote sources
const manifestPath = join(src, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { remote: [] };
for (const r of manifest.remote ?? []) {
  const out = join(dist, r.path);
  if (!existsSync(out)) {
    console.log(`fetch ${r.url} -> assets/dist/${r.path}`);
    const res = await fetch(r.url);
    if (!res.ok) throw new Error(`Failed to fetch ${r.url}: ${res.status}`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  }
  upsertCredit({ path: r.path, title: r.title, author: r.author, license: r.license, source: r.source, ...(r.notes ? { notes: r.notes } : {}) });
}

// 2. Procedural audio
function wav(samples, rate = 22050) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
const audioOut = join(dist, 'audio');
mkdirSync(audioOut, { recursive: true });
const audioFiles = {
  'wind.wav': () => { // brown-noise wind, 6 s seamless loop
    const rate = 22050, n = rate * 6, out = new Float32Array(n); let b = 0;
    for (let i = 0; i < n; i++) { b = (b + rnd() * 0.02) * 0.995; const env = 0.6 + 0.4 * Math.sin((i / n) * Math.PI * 2 * 3); out[i] = b * 6 * env; }
    for (let i = 0; i < rate * 0.5; i++) { const k = i / (rate * 0.5); out[i] = out[i] * k + out[n - 1 - i] * (1 - k) * 0; }
    return wav(out, rate);
  },
  'click.wav': () => tone([[880, 0.03]], 0.05),
  'correct.wav': () => tone([[523, 0.08], [659, 0.08], [784, 0.14]], 0.3),
  'wrong.wav': () => tone([[220, 0.12], [185, 0.18]], 0.32),
  'stamp.wav': () => tone([[392, 0.08], [523, 0.08], [659, 0.08], [1046, 0.25]], 0.5),
  'step.wav': () => { const rate = 22050, n = Math.floor(rate * 0.08), out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = rnd() * Math.exp(-i / (rate * 0.012)) * 0.8; return wav(out, rate); },
};
function tone(notes, total) {
  const rate = 22050, n = Math.floor(rate * total), out = new Float32Array(n); let t = 0;
  for (const [f, d] of notes) { const len = Math.floor(rate * d); for (let i = 0; i < len && t + i < n; i++) { const e = Math.min(1, i / 200) * Math.exp(-i / (rate * 0.25)); out[t + i] += Math.sin((2 * Math.PI * f * i) / rate) * 0.5 * e; } t += len; }
  return wav(out, rate);
}
for (const [name, make] of Object.entries(audioFiles)) {
  const out = join(audioOut, name);
  if (!existsSync(out)) { writeFileSync(out, make()); console.log(`generated audio/${name}`); }
  upsertCredit({ path: `audio/${name}`, title: `Procedural ${name.replace('.wav', '')} cue`, author: 'TrueNorth (scripts/assets.mjs)', license: 'Generated', source: 'https://github.com/kinncj/OhCanada/blob/main/scripts/assets.mjs' });
}

// 3. glTF compression
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const hasToktx = (() => { try { execSync('toktx --version', { stdio: 'ignore' }); return true; } catch { return false; } })();
for (const file of walk(src).filter((f) => ['.glb', '.gltf'].includes(extname(f)))) {
  const rel = relative(src, file).replace(/\.gltf$/, '.glb');
  const out = join(dist, 'models', rel);
  if (existsSync(out)) continue;
  mkdirSync(dirname(out), { recursive: true });
  const cmds = [`npx gltf-transform optimize "${file}" "${out}" --compress draco --texture-compress ${hasToktx ? 'ktx2' : 'webp'} --texture-size 2048`];
  for (const c of cmds) { console.log(c); execSync(c, { stdio: 'inherit' }); }
  if (!hasToktx) console.warn(`toktx not found: ${rel} textures were compressed as WebP instead of KTX2. CI installs KTX-Software so the deployed build is KTX2.`);
}

writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n');
console.log(`assets: ${credits.assets.length} credited files`);
