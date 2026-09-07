#!/usr/bin/env node
/**
 * make assets — idempotent asset pipeline into assets/dist (served as Vite publicDir).
 *  1. assets/src/manifest.json `remote`: CC0/CC-BY files fetched verbatim (HDRI).
 *  2. Procedural audio (wind loop + UI cues) synthesised as 16-bit WAV (licence: Generated).
 *  3. three.js KTX2/Draco transcoders copied to basis/ and draco/ (MIT).
 *  4. `polyhaven.models`: photoscans → LOD0/LOD1 GLBs (meshoptimizer decimation, Draco, KTX2 textures).
 *  5. `polyhaven.textures`: tiling PBR sets → diff/nor/arm KTX2 (ETC1S colour+ARM, UASTC normals).
 *  6. `characters`: Quaternius Universal Base Characters + Animation Library → male.glb / female.glb.
 *  7. assets/dist/manifest.json (renderer contract) + assets/credits.json.
 * Every output is skipped when it already exists and no file is rewritten with identical bytes, so a second run
 * is a no-op. Downloads are cached outside the repo ($ASSETS_CACHE, default <os tmpdir>/truenorth-asset-cache).
 * KTX2 needs KTX-Software >= 4.4 (`ktx`); it is auto-installed under node_modules/.cache on Linux x86_64,
 * otherwise textures fall back to WebP and the manifest says so.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { getHeapStatistics } from 'node:v8';

// ---- Optional modules produced by the art/audio pipelines (loaded only when present) ----
async function optional(modulePath) {
  try {
    return await import(modulePath);
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw e;
  }
}

// Photoscans run to millions of triangles: make sure V8 has room, re-executing with a bigger heap when it does not.
const HEAP_MB = 8192;
if (getHeapStatistics().heap_size_limit < HEAP_MB * 1024 * 1024 * 0.9 && !process.env.TRUENORTH_ASSETS_CHILD) {
  const r = spawnSync(process.execPath, [`--max-old-space-size=${HEAP_MB}`, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, TRUENORTH_ASSETS_CHILD: '1' } });
  process.exit(r.status ?? 1);
}

const { phFetchModel, phFetchTexture, phInfo, phAuthors, phSource } = await import('./lib/polyhaven.mjs');
const { ensureKtx, prependPath } = await import('./lib/toktx.mjs');
const { createIO, processModel, modelStats } = await import('./lib/models.mjs');
const { encodeTexture, textureExt } = await import('./lib/textures.mjs');
const { buildCharacter, inspectCharacter, unzipOnce, BODIES, ANIMATIONS, UBC_URL, UAL_URL } = await import('./lib/characters.mjs');
const { itchFreeDownload } = await import('./lib/itch.mjs');

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'assets', 'src');
const dist = join(root, 'assets', 'dist');
const creditsPath = join(root, 'assets', 'credits.json');
const cacheDir = process.env.ASSETS_CACHE ?? join(tmpdir(), 'truenorth-asset-cache');
mkdirSync(dist, { recursive: true });
mkdirSync(cacheDir, { recursive: true });
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : { $schema: '../content/schemas/credits.schema.json', assets: [] };
const upsertCredit = (entry) => {
  const i = credits.assets.findIndex((a) => a.path === entry.path);
  if (i >= 0) credits.assets[i] = entry;
  else credits.assets.push(entry);
};
const report = { written: [], skipped: [], warnings: [] };
const warn = (m) => { report.warnings.push(m); console.warn(`warn: ${m}`); };
/** Write only when the bytes differ; returns true when the file changed. */
const writeIfChanged = (rel, bytes) => {
  const out = join(dist, rel);
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (existsSync(out) && buf.equals(readFileSync(out))) return false;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  report.written.push(rel);
  console.log(`wrote assets/dist/${rel} (${(buf.byteLength / 1e6).toFixed(2)} MB)`);
  return true;
};
const exists = (rel) => existsSync(join(dist, rel));

// 1. Remote sources
const manifestPath = join(src, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { remote: [] };
for (const r of manifest.remote ?? []) {
  if (!exists(r.path)) {
    console.log(`fetch ${r.url} -> assets/dist/${r.path}`);
    const res = await fetch(r.url);
    if (!res.ok) throw new Error(`Failed to fetch ${r.url}: ${res.status}`);
    writeIfChanged(r.path, Buffer.from(await res.arrayBuffer()));
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
  if (!exists(`audio/${name}`)) writeIfChanged(`audio/${name}`, make());
  upsertCredit({ path: `audio/${name}`, title: `Procedural ${name.replace('.wav', '')} cue`, author: 'TrueNorth (scripts/assets.mjs)', license: 'Generated', source: 'https://github.com/kinncj/OhCanada/blob/main/scripts/assets.mjs' });
}

// 3. three.js transcoders (MIT)
const threeLibs = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');
const transcoders = [
  ...['basis_transcoder.js', 'basis_transcoder.wasm'].map((f) => [join(threeLibs, 'basis', f), `basis/${f}`, 'Basis Universal / KTX2 transcoder']),
  ...['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'].map((f) => [join(threeLibs, 'draco', 'gltf', f), `draco/${f}`, 'Draco mesh decoder']),
];
for (const [from, rel, what] of transcoders) {
  if (!exists(rel)) writeIfChanged(rel, readFileSync(from));
  upsertCredit({ path: rel, title: `${what} (${basename(rel)})`, author: 'three.js authors', license: 'MIT', source: 'https://github.com/mrdoob/three.js', notes: 'Copied from three/examples/jsm/libs; also bundles Google Draco / Binomial Basis Universal (Apache-2.0).' });
}

// 4. Texture toolchain
const ktxBin = await ensureKtx({ root });
if (ktxBin) prependPath(ktxBin);
const textureFormat = ktxBin ? 'ktx2' : 'webp';
const ext = textureExt(textureFormat);
if (!ktxBin) warn('KTX-Software not available: textures are WebP (manifest.textureFormat = "webp").');
const io = await createIO();
const tmpDir = join(cacheDir, 'tmp');

// 5. Poly Haven models → models/env/<id>.glb with LOD0 + LOD1
const models = {};
for (const [key, spec] of Object.entries(manifest.polyhaven?.models ?? {})) {
  const rel = `models/env/${spec.id}.glb`;
  let bytes;
  if (exists(rel)) bytes = readFileSync(join(dist, rel));
  else {
    const fetched = await phFetchModel(spec.id, cacheDir, { log: console.log }).catch((e) => { warn(`${spec.id}: ${e.message}`); return null; });
    if (!fetched) { report.skipped.push(`${key} (${spec.id}: no 1k glTF on Poly Haven)`); continue; }
    console.log(`process ${spec.id} (${spec.category})`);
    const files = JSON.parse(readFileSync(join(cacheDir, 'polyhaven', 'meta', `${spec.id}.files.json`), 'utf8'));
    ({ glb: bytes } = await processModel(io, { id: spec.id, category: spec.category, gltf: fetched.gltf, files, cacheDir, textureFormat, log: console.log }));
    writeIfChanged(rel, bytes);
  }
  const stats = await modelStats(io, bytes);
  const limit = ['tree', 'sapling'].includes(spec.category) ? 3e6 : 1.5e6;
  if (bytes.byteLength > limit) warn(`${rel} is ${(bytes.byteLength / 1e6).toFixed(2)} MB (budget ${limit / 1e6} MB)`);
  models[key] = { path: rel, lods: stats.lods, triangles: stats.triangles, height: stats.height, radius: stats.radius, category: spec.category };
  const info = await phInfo(spec.id, cacheDir);
  upsertCredit({ path: rel, title: `${info?.name ?? spec.id} (Poly Haven photoscan, LOD0/LOD1)`, author: phAuthors(info), license: 'CC0-1.0', source: phSource(spec.id) });
}

// 6. Poly Haven tiling textures → textures/<id>/{diff,nor,arm}.<ext>
const textures = {};
const TEX_SIZE = { diff: 1024, nor: 512, arm: 512 };
const TEX_KIND = { diff: 'color', nor: 'normal', arm: 'data' };
for (const [key, spec] of Object.entries(manifest.polyhaven?.textures ?? {})) {
  const maps = ['diff', 'nor', 'arm'];
  const rels = Object.fromEntries(maps.map((m) => [m, `textures/${spec.id}/${m}.${ext}`]));
  let fetched = null;
  if (!maps.every((m) => exists(rels[m]))) {
    fetched = await phFetchTexture(spec.id, cacheDir, { log: console.log }).catch((e) => { warn(`${spec.id}: ${e.message}`); return null; });
    if (!fetched) { report.skipped.push(`${key} (${spec.id}: not on Poly Haven)`); continue; }
  }
  const entry = { tileMeters: spec.tileMeters };
  for (const m of maps) {
    if (!exists(rels[m])) {
      if (!fetched[m]) { warn(`${spec.id}: no ${m} map`); continue; }
      console.log(`encode ${rels[m]}`);
      writeIfChanged(rels[m], await encodeTexture(fetched[m], { kind: TEX_KIND[m], size: TEX_SIZE[m], format: textureFormat, tmpDir }));
    }
    entry[m] = rels[m];
  }
  const info = await phInfo(spec.id, cacheDir);
  for (const m of maps) if (entry[m]) upsertCredit({ path: rels[m], title: `${info?.name ?? spec.id} — ${{ diff: 'diffuse', nor: 'normal (GL)', arm: 'AO/roughness/metal' }[m]}`, author: phAuthors(info), license: 'CC0-1.0', source: phSource(spec.id) });
  textures[key] = { diff: entry.diff, nor: entry.nor, arm: entry.arm, tileMeters: spec.tileMeters };
}

// 7. Quaternius characters → models/characters/<body>.glb + textures/characters/<body>_skin_{light,dark}.<ext>
const characters = {};
const quaterniusCredit = (path, title) => upsertCredit({ path, title, author: 'Quaternius', license: 'CC0-1.0', source: UBC_URL, notes: 'Universal Base Characters / Universal Animation Library' });
let packs = null;
const ensurePacks = async () => {
  if (packs) return packs;
  const itchDir = join(cacheDir, 'itch');
  mkdirSync(itchDir, { recursive: true });
  const zips = [['universal-base-characters', UBC_URL], ['universal-animation-library', UAL_URL]];
  for (const [name, url] of zips) {
    const zip = join(itchDir, `${name}.zip`);
    if (!existsSync(zip)) {
      console.log(`itch: downloading ${url} [Standard]`);
      await itchFreeDownload(url, '[Standard]', `${zip}.part`);
      renameSync(`${zip}.part`, zip);
    }
    unzipOnce(zip, join(itchDir, name));
  }
  packs = {
    ubcDir: join(itchDir, 'universal-base-characters', 'Universal Base Characters[Standard]'),
    ualGlb: join(itchDir, 'universal-animation-library', 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb'),
  };
  return packs;
};
for (const body of manifest.characters?.bodies ?? []) {
  if (!BODIES[body]) { warn(`unknown character body "${body}"`); continue; }
  const rel = `models/characters/${body}.glb`;
  const skinRel = { light: `textures/characters/${body}_skin_light.${ext}`, dark: `textures/characters/${body}_skin_dark.${ext}` };
  let bytes;
  if (exists(rel) && exists(skinRel.light) && exists(skinRel.dark)) bytes = readFileSync(join(dist, rel));
  else {
    const { ubcDir, ualGlb } = await ensurePacks();
    console.log(`build character ${body}`);
    const built = await buildCharacter(io, { body, ubcDir, ualGlb, textureFormat, log: console.log });
    bytes = built.glb;
    if (!exists(rel)) writeIfChanged(rel, bytes);
    for (const tone of ['light', 'dark']) if (!exists(skinRel[tone])) writeIfChanged(skinRel[tone], await encodeTexture(built.skin[tone], { kind: 'color', size: 1024, format: textureFormat, tmpDir }));
  }
  const info = await inspectCharacter(io, bytes);
  const problems = [];
  if (info.skins !== 1) problems.push(`skins=${info.skins}`);
  if (info.joints !== 65) problems.push(`joints=${info.joints}`);
  for (const h of BODIES[body].hair) if (!info.meshNodes.includes(h)) problems.push(`missing hair ${h}`);
  for (const a of ANIMATIONS) if (!info.animations.includes(a)) problems.push(`missing clip ${a}`);
  if (problems.length) warn(`${rel}: ${problems.join(', ')}`);
  if (bytes.byteLength > 4e6) warn(`${rel} is ${(bytes.byteLength / 1e6).toFixed(2)} MB (budget 4 MB)`);
  characters[body] = {
    path: rel,
    hair: BODIES[body].hair.filter((h) => info.meshNodes.includes(h)),
    animations: ANIMATIONS.filter((a) => info.animations.includes(a)),
    skin: { light: skinRel.light, dark: skinRel.dark },
  };
  quaterniusCredit(rel, `Universal Base Character (${body}) with hairstyles and UAL animation clips`);
  quaterniusCredit(skinRel.light, `Universal Base Character ${body} skin, light tone`);
  quaterniusCredit(skinRel.dark, `Universal Base Character ${body} skin, dark tone`);
}

// 7b. Hero assets (scripts/lib/hero.mjs) and soundscapes (scripts/lib/soundscapes.mjs), when those modules exist
{
  const hero = await optional('./lib/hero.mjs');
  if (hero?.processHeroAssets) {
    const entries = await hero.processHeroAssets({ srcDir: join(src, 'hero'), distDir: dist, upsertCredit, toktx: await optional('./lib/toktx.mjs') });
    if (entries) Object.assign(models, entries);
  }
  const sound = await optional('./lib/soundscapes.mjs');
  if (sound?.generateSoundscapes) await sound.generateSoundscapes({ outDir: dist, upsertCredit });
}

// 8. Renderer manifest + credits (credits for files that no longer exist are dropped)
const distManifest = { version: 1, textureFormat, basisTranscoderPath: 'basis/', dracoDecoderPath: 'draco/', models, textures, characters };
writeIfChanged('manifest.json', JSON.stringify(distManifest, null, 2) + '\n');

// 8b. Hero-asset ledger (assets/manifest.json): every hero asset with its source, licence and poly budget.
// `make validate-content` fails when a hero model is missing here or busts its budget.
{
  const promptsDir = join(root, 'assets', 'prompts');
  const ledger = { generatedBy: 'scripts/assets.mjs', generatedAt: new Date().toISOString().slice(0, 10), assets: [] };
  const prompts = existsSync(promptsDir) ? readdirSync(promptsDir).filter((f) => f.endsWith('.json')) : [];
  for (const f of prompts.sort()) {
    const spec = JSON.parse(readFileSync(join(promptsDir, f), 'utf8'));
    const entry = models[spec.key];
    ledger.assets.push({
      key: spec.key,
      category: spec.category,
      path: entry?.path ?? null,
      source: 'generated',
      generator: spec.model,
      prompt: `assets/prompts/${f}`,
      license: 'CC0-1.0',
      polyBudget: spec.polyBudget,
      triangles: entry?.triangles?.LOD0 ?? null,
      targetHeightMeters: spec.targetHeightMeters,
      ...(spec.notes ? { notes: spec.notes } : {}),
    });
  }
  for (const [key, spec] of Object.entries(manifest.polyhaven?.models ?? {})) {
    const entry = models[key];
    ledger.assets.push({ key, category: entry?.category ?? 'prop', path: entry?.path ?? null, source: 'CC0', generator: `Poly Haven: ${spec.id ?? key}`, license: 'CC0-1.0', polyBudget: spec.polyBudget ?? 15000, triangles: entry?.triangles?.LOD0 ?? null });
  }
  for (const body of manifest.characters?.bodies ?? []) {
    const entry = characters[body];
    ledger.assets.push({ key: body, category: 'character', path: entry?.path ?? null, source: 'CC0', generator: 'Quaternius: Universal Base Characters + Universal Animation Library', license: 'CC0-1.0', polyBudget: 30000, triangles: null });
  }
  const ledgerPath = join(root, 'assets', 'manifest.json');
  const ledgerJson = JSON.stringify(ledger, null, 2) + '\n';
  const prev = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
  // Ignore the date when comparing so a no-op run stays a no-op.
  if (prev.replace(/"generatedAt": "[^"]*"/, '') !== ledgerJson.replace(/"generatedAt": "[^"]*"/, '')) {
    writeFileSync(ledgerPath, ledgerJson);
    console.log(`wrote assets/manifest.json (${ledger.assets.length} hero/source assets)`);
  }
}

const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const distFiles = new Set(walk(dist).map((f) => relative(dist, f)));
for (const a of [...credits.assets]) if (!distFiles.has(a.path)) { console.log(`credits: dropping ${a.path} (file removed)`); credits.assets.splice(credits.assets.indexOf(a), 1); }
for (const f of distFiles) if (f !== 'manifest.json' && !f.endsWith('.gitkeep') && !credits.assets.some((a) => a.path === f)) warn(`assets/dist/${f} has no credit entry`);
const creditsJson = JSON.stringify(credits, null, 2) + '\n';
if (!existsSync(creditsPath) || readFileSync(creditsPath, 'utf8') !== creditsJson) { writeFileSync(creditsPath, creditsJson); console.log('updated assets/credits.json'); }

// Summary
const total = [...distFiles].reduce((n, f) => n + statSync(join(dist, f)).size, 0);
console.log(`\nassets: ${credits.assets.length} credited files, ${(total / 1e6).toFixed(1)} MB in assets/dist, textureFormat=${textureFormat}`);
for (const f of [...distFiles].filter((f) => f.endsWith('.glb')).sort()) console.log(`  ${(statSync(join(dist, f)).size / 1e6).toFixed(2).padStart(6)} MB  ${f}`);
if (report.skipped.length) console.log(`skipped: ${report.skipped.join('; ')}`);
console.log(report.written.length ? `${report.written.length} file(s) written` : 'no changes (no-op)');
