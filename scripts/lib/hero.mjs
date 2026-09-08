/**
 * Generated hero assets (landmarks, fauna, props) → game-ready GLBs.
 *   assets/src/hero/<key>.glb (scripts/gen3d output: +Y up, base at y=0, metres, one PBR material with a base colour
 *   texture) → flatten → LOD0 = decimated to the category / prompt budget (meshoptimizer) → LOD1 = ~20 % of LOD0
 *   → base colour KTX2 (ETC1S) or WebP → Draco → prune/dedup → assets/dist/models/hero/<key>.glb.
 * Two top-level nodes "LOD0" and "LOD1" share materials, exactly like scripts/lib/models.mjs, so the renderer's
 * asset library can treat both kinds of model alike.
 *
 * The prompt file assets/prompts/<key>.json (same key as the GLB) supplies the category ('hero' | 'fauna' | 'prop')
 * and an optional per-asset polyBudget; the credits entry records the generator and its seed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { getBounds } from '@gltf-transform/core';
import { dedup, draco, flatten, prune, textureCompress, weld } from '@gltf-transform/functions';
import { toktx as toktxTransform, Mode } from '@gltf-transform/cli';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { createIO, modelStats, nodeTriangles } from './models.mjs';
import { prependPath } from './toktx.mjs';

/** LOD0 triangle ceilings per category; a smaller `polyBudget` in the prompt file wins. LOD1 is 20 % of LOD0. */
export const HERO_BUDGET = { hero: 25000, fauna: 12000, prop: 6000 };
/** Base colour texture edge per category (single ETC1S colour map; no normal maps on generated meshes). */
export const HERO_TEX = { hero: 1024, fauna: 1024, prop: 512 };
const CATEGORIES = Object.keys(HERO_BUDGET);
const SIZE_LIMIT = 2.5e6; // bytes, compressed
const COLOR_SLOTS = /baseColorTexture|metallicRoughnessTexture|occlusionTexture|emissiveTexture/;

const primTriangles = (prim) => Math.floor((prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3);

/** Replace a primitive's indices, dropping vertices no longer referenced (same approach as models.mjs). */
function compactPrim(doc, prim, indices) {
  const count = prim.getAttribute('POSITION').getCount();
  const remap = new Int32Array(count).fill(-1);
  let next = 0;
  for (const i of indices) if (remap[i] < 0) remap[i] = next++;
  const newIdx = next < 65536 ? new Uint16Array(indices.length) : new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) newIdx[i] = remap[indices[i]];
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem);
    const size = acc.getElementSize();
    const src = acc.getArray();
    const dst = new src.constructor(next * size);
    for (let i = 0; i < count; i++) if (remap[i] >= 0) for (let k = 0; k < size; k++) dst[remap[i] * size + k] = src[i * size + k];
    prim.setAttribute(sem, acc.clone().setArray(dst));
    if (acc.listParents().length <= 1) acc.dispose();
  }
  const oldIdx = prim.getIndices();
  prim.setIndices((oldIdx ? oldIdx.clone() : doc.createAccessor()).setArray(newIdx).setType('SCALAR').setBuffer(prim.getAttribute('POSITION').getBuffer()));
  if (oldIdx && oldIdx.listParents().length <= 1) oldIdx.dispose();
}

/** Edge-collapse one primitive to `target` triangles, falling back to vertex clustering when collapse stalls. */
function simplifyPrim(doc, prim, target) {
  const pos = prim.getAttribute('POSITION');
  let indices = prim.getIndices()?.getArray();
  if (!indices) indices = Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
  const idx = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  const positions = pos.getArray() instanceof Float32Array ? pos.getArray() : new Float32Array(pos.getArray());
  const targetIndexCount = Math.max(3, Math.floor(target) * 3);
  if (idx.length <= targetIndexCount) return;
  let [out] = MeshoptSimplifier.simplify(idx, positions, 3, targetIndexCount, 0.05, ['Permissive']);
  if (out.length > targetIndexCount * 1.5) {
    const [sloppy] = MeshoptSimplifier.simplifySloppy(idx, positions, 3, null, targetIndexCount, 1);
    if (sloppy.length && sloppy.length < out.length) out = sloppy;
  }
  compactPrim(doc, prim, out);
}

function listPrims(node) {
  const prims = [];
  const visit = (n) => { if (n.getMesh()) prims.push(...n.getMesh().listPrimitives()); n.listChildren().forEach(visit); };
  visit(node);
  return prims;
}

/** Decimate every primitive under `node` in place so the subtree holds at most `budget` triangles. */
function decimateNode(doc, node, budget) {
  const prims = listPrims(node);
  const total = prims.reduce((s, p) => s + primTriangles(p), 0);
  if (total <= budget) return;
  const ratio = budget / total;
  for (const p of prims) simplifyPrim(doc, p, Math.max(16, Math.round(primTriangles(p) * ratio)));
}

function clonePrim(doc, prim) {
  const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) p.setAttribute(sem, prim.getAttribute(sem).clone().setArray(prim.getAttribute(sem).getArray().slice()));
  if (prim.getIndices()) p.setIndices(prim.getIndices().clone().setArray(prim.getIndices().getArray().slice()));
  return p;
}

/** Deep-copy the LOD0 subtree as "LOD1" (node transforms and materials preserved, geometry duplicated). */
function cloneAsLod1(doc, lod0) {
  const lod1 = doc.createNode('LOD1').setScale(lod0.getScale());
  const copy = (src, dst) => {
    for (const child of src.listChildren()) {
      const n = doc.createNode(`${child.getName()}_LOD1`).setMatrix(child.getMatrix());
      if (child.getMesh()) {
        const mesh = doc.createMesh(`${child.getMesh().getName()}_LOD1`);
        for (const p of child.getMesh().listPrimitives()) mesh.addPrimitive(clonePrim(doc, p));
        n.setMesh(mesh);
      }
      dst.addChild(n);
      copy(child, n);
    }
  };
  copy(lod0, lod1);
  return lod1;
}

/** Read the prompt file for a key; missing files degrade to category 'hero'. */
function readPrompt(promptsDir, key) {
  const file = join(promptsDir, `${key}.json`);
  if (!existsSync(file)) return { key, category: 'hero' };
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Process one generated GLB into LOD0/LOD1 bytes.
 * @returns {{ glb: Uint8Array, before: number }} compressed bytes and the pre-decimation triangle count
 */
export async function processHero(io, { key, category, budget, texSize, glb, textureFormat, log = console.log }) {
  const doc = await io.read(glb);
  doc.setLogger({ debug() {}, info() {}, warn: (m) => log(`  warn ${m}`), error: (m) => log(`  ERROR ${m}`) });
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  await doc.transform(flatten());
  const lod0 = doc.createNode('LOD0');
  for (const n of scene.listChildren()) { scene.removeChild(n); lod0.addChild(n); }
  scene.addChild(lod0);

  // Generated meshes are metres with the base at y=0 (scripts/gen3d/postprocess.py); anything over 400 units is cm.
  const b = getBounds(lod0);
  if (b.max[1] - b.min[1] > 400) { log(`  ${key}: bbox ${(b.max[1] - b.min[1]).toFixed(0)} units tall → scaling cm→m`); lod0.setScale([0.01, 0.01, 0.01]); }
  for (const mat of root.listMaterials()) if (mat.getAlphaMode() !== 'OPAQUE') mat.setAlphaMode('OPAQUE');

  await doc.transform(weld());
  const before = nodeTriangles(lod0);
  await MeshoptSimplifier.ready;
  decimateNode(doc, lod0, budget);
  const lod1 = cloneAsLod1(doc, lod0);
  scene.addChild(lod1);
  decimateNode(doc, lod1, Math.max(200, Math.round(Math.min(budget, before) * 0.2)));

  if (textureFormat === 'ktx2') {
    await doc.transform(toktxTransform({ mode: Mode.ETC1S, encoder: sharp, slots: COLOR_SLOTS, resize: [texSize, texSize], quality: 128 }));
  } else {
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', slots: COLOR_SLOTS, resize: [texSize, texSize], quality: 80 }));
  }
  await doc.transform(prune(), dedup(), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  return { glb: await io.writeBinary(doc), before, category };
}

/**
 * Compress every assets/src/hero/*.glb into <distDir>/models/hero/<key>.glb and return renderer manifest entries.
 * @param {object} opts
 * @param {string} opts.srcDir      assets/src/hero (generated GLBs; assets/prompts is resolved as ../../prompts)
 * @param {string} opts.distDir     assets/dist (outputs go under models/hero/)
 * @param {(entry: object) => void} opts.upsertCredit  credits.json upsert from scripts/assets.mjs
 * @param {string|boolean|object|null} opts.toktx  how to reach KTX-Software: a bin dir (prepended to PATH), `true`
 *   when `ktx` is already on PATH, the `./toktx.mjs` module itself (its `ensureKtx` is called to resolve the dir),
 *   or falsy for WebP textures. When the module resolves to nothing, KTX2 is impossible and WebP is used.
 * @param {string} [opts.promptsDir]  defaults to <srcDir>/../../prompts (assets/prompts)
 * @param {(m: string) => void} [opts.log]
 * @param {(m: string) => void} [opts.warn]
 * @returns {Promise<Record<string, { path: string, lods: string[], triangles: Record<string, number>, height: number, radius: number, category: 'hero'|'fauna'|'prop' }>>}
 */
export async function processHeroAssets({ srcDir, distDir, upsertCredit, toktx, promptsDir, log = console.log, warn = (m) => console.warn(`warn: ${m}`) }) {
  const entries = {};
  if (!existsSync(srcDir)) return entries;
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.glb')).sort();
  if (!files.length) return entries;
  // `toktx` may arrive as a bin dir, as `true`, or as the toktx.mjs module (what scripts/assets.mjs passes).
  let ktxDir = toktx;
  if (ktxDir && typeof ktxDir === 'object') ktxDir = await ktxDir.ensureKtx?.({ root: join(srcDir, '..', '..', '..'), log });
  if (typeof ktxDir === 'string') prependPath(ktxDir);
  const textureFormat = ktxDir ? 'ktx2' : 'webp';
  if (!ktxDir) warn('hero: KTX-Software not available, hero textures are WebP');
  const prompts = promptsDir ?? join(srcDir, '..', '..', 'prompts'); // assets/src/hero → assets/prompts
  const io = await createIO();
  for (const file of files) {
    const key = basename(file, '.glb');
    const prompt = readPrompt(prompts, key);
    const category = CATEGORIES.includes(prompt.category) ? prompt.category : 'hero';
    const budget = Math.min(HERO_BUDGET[category], Number(prompt.polyBudget) || Infinity);
    const rel = `models/hero/${key}.glb`;
    const out = join(distDir, rel);
    const srcPath = join(srcDir, file);
    let bytes;
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(srcPath).mtimeMs) bytes = readFileSync(out);
    else {
      log(`process hero ${key} (${category}, budget ${budget})`);
      const { glb, before } = await processHero(io, { key, category, budget, texSize: HERO_TEX[category], glb: srcPath, textureFormat, log });
      bytes = Buffer.from(glb);
      log(`  ${key}: ${before} → LOD0 ≤ ${budget} triangles, ${(bytes.byteLength / 1e6).toFixed(2)} MB`);
      mkdirSync(dirname(out), { recursive: true });
      if (!existsSync(out) || !bytes.equals(readFileSync(out))) writeFileSync(out, bytes);
    }
    if (bytes.byteLength > SIZE_LIMIT) warn(`${rel} is ${(bytes.byteLength / 1e6).toFixed(2)} MB (budget ${SIZE_LIMIT / 1e6} MB)`);
    const stats = await modelStats(io, bytes);
    if (stats.triangles.LOD0 > budget) warn(`${rel} LOD0 has ${stats.triangles.LOD0} triangles (budget ${budget})`);
    entries[key] = { path: rel, lods: stats.lods, triangles: stats.triangles, height: stats.height, radius: stats.radius, category };
    upsertCredit?.({
      path: rel,
      title: `${key} (generated ${category}, LOD0/LOD1)`,
      author: 'TrueNorth (scripts/gen3d: Hunyuan3D-2mini shape from an SDXL-Turbo concept image)',
      license: 'Generated',
      source: 'https://github.com/kinncj/OhCanada/tree/main/scripts/gen3d',
      notes: `Prompt assets/prompts/${key}.json (seed ${prompt.seed ?? 'n/a'}). Model weights: Tencent Hunyuan Community License; SDXL-Turbo: Stability AI Community License.${/culturalReview: true/.test(prompt.notes ?? '') ? ' Requires cultural review before release.' : ''}`,
    });
  }
  return entries;
}
