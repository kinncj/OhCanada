/**
 * Poly Haven photoscan → game-ready GLB.
 *   read → keep one variant (trees) → flatten → LOD0 = decimated (meshoptimizer, whole-card pruning for foliage)
 *   → LOD1 = ~20 % of LOD0 → alpha maps recomposed into MASK materials → textures resized + KTX2/WebP
 *   → Draco → prune/dedup → GLB. Two top-level nodes "LOD0" and "LOD1" share materials.
 */
import { NodeIO, getBounds } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, flatten, prune, textureCompress, weld } from '@gltf-transform/functions';
import { toktx, Mode } from '@gltf-transform/cli';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { join } from 'node:path';
import { download } from './polyhaven.mjs';

/** Triangle budgets per category (LOD0); LOD1 is 20 % of LOD0. */
export const BUDGET = { tree: 15000, sapling: 15000, rock: 6000, prop: 6000, structure: 6000, foliage: 3000 };
/** Texture edge per slot per category: colour/ARM and normal (normal maps are UASTC and cost ~4x per pixel). */
export const TEX = {
  tree: { color: 512, normal: 256 }, sapling: { color: 512, normal: 256 }, rock: { color: 512, normal: 256 },
  prop: { color: 256, normal: 256 }, structure: { color: 512, normal: 256 }, foliage: { color: 512, normal: 256 },
};
const NORMAL_SLOTS = /normalTexture/;
const COLOR_SLOTS = /baseColorTexture|metallicRoughnessTexture|occlusionTexture|emissiveTexture/;

export async function createIO() {
  return new NodeIO().registerExtensions(KHRONOS_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
}

const primTriangles = (prim) => Math.floor((prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3);
const meshTriangles = (mesh) => mesh.listPrimitives().reduce((n, p) => n + primTriangles(p), 0);
export const nodeTriangles = (node) => (node.getMesh() ? meshTriangles(node.getMesh()) : 0) + node.listChildren().reduce((n, c) => n + nodeTriangles(c), 0);

/** Decimate one primitive in place to `target` triangles (edge collapse; `Prune` drops whole disconnected leaf cards). */
function simplifyPrim(doc, prim, target, { prune: pruneParts }) {
  const pos = prim.getAttribute('POSITION');
  let indices = prim.getIndices()?.getArray();
  if (!indices) indices = Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
  const idx = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  const positions = pos.getArray() instanceof Float32Array ? pos.getArray() : new Float32Array(pos.getArray());
  const targetIndexCount = Math.max(3, Math.floor(target) * 3);
  if (idx.length <= targetIndexCount) return;
  const flags = pruneParts ? ['Permissive', 'Prune'] : ['Permissive']; // Permissive: collapse across the UV seams photoscans are full of
  let out;
  try {
    [out] = MeshoptSimplifier.simplify(idx, positions, 3, targetIndexCount, 1, flags);
  } catch (err) {
    throw new Error(`simplify failed: indices=${idx.length} vertices=${pos.getCount()} mode=${prim.getMode()} target=${targetIndexCount}`, { cause: err });
  }
  if (out.length > targetIndexCount * 1.5) {
    // Edge collapse stalled (non-manifold scan topology); vertex clustering always reaches the target.
    const [sloppy] = MeshoptSimplifier.simplifySloppy(idx, positions, 3, null, targetIndexCount, 1);
    if (sloppy.length && sloppy.length < out.length) out = sloppy;
  }
  compactPrim(doc, prim, out);
}

/** Replace the primitive's indices, dropping vertices that are no longer referenced. */
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
    const fresh = acc.clone().setArray(dst);
    prim.setAttribute(sem, fresh);
    if (acc.listParents().length <= 1) acc.dispose();
  }
  const oldIdx = prim.getIndices();
  prim.setIndices((oldIdx ? oldIdx.clone() : doc.createAccessor()).setArray(newIdx).setType('SCALAR').setBuffer(prim.getAttribute('POSITION').getBuffer()));
  if (oldIdx && oldIdx.listParents().length <= 1) oldIdx.dispose();
}

/** Deep-copy a primitive (new accessors, same material). */
function clonePrim(doc, prim) {
  const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) p.setAttribute(sem, prim.getAttribute(sem).clone().setArray(prim.getAttribute(sem).getArray().slice()));
  if (prim.getIndices()) p.setIndices(prim.getIndices().clone().setArray(prim.getIndices().getArray().slice()));
  return p;
}

const isMasked = (prim) => ['MASK', 'BLEND'].includes(prim.getMaterial()?.getAlphaMode());

/** Distribute `budget` triangles over primitives proportionally, decimating each in place. */
function decimateNode(doc, node, budget) {
  const prims = [];
  const visit = (n) => { if (n.getMesh()) prims.push(...n.getMesh().listPrimitives()); n.listChildren().forEach(visit); };
  visit(node);
  const total = prims.reduce((s, p) => s + primTriangles(p), 0);
  if (total <= budget) return;
  const ratio = budget / total;
  for (const p of prims) simplifyPrim(doc, p, Math.max(16, Math.round(primTriangles(p) * ratio)), { prune: isMasked(p) });
}

/**
 * Compose Poly Haven's separate alpha/mask map into the base colour texture of translucent materials
 * and switch them to alpha-mask (the 1k JPG glTF ships opaque JPGs, losing the cutout).
 */
async function restoreAlpha(doc, { id, files, cacheDir, log }) {
  const keys = Object.keys(files ?? {});
  const findKey = (...names) => keys.find((k) => names.includes(k.toLowerCase()) && files[k]?.['1k']?.jpg);
  for (const mat of doc.getRoot().listMaterials()) {
    const tex = mat.getBaseColorTexture();
    const suffix = mat.getName().replace(new RegExp(`^${id}_?`), '').toLowerCase();
    const key = findKey(`${suffix}_alpha`, `${suffix}_mask`) ?? (mat.getAlphaMode() !== 'OPAQUE' || suffix === '' ? findKey('alpha', 'mask') : undefined);
    if (!key || !tex) {
      if (mat.getAlphaMode() === 'OPAQUE') continue;
      if (tex && tex.getMimeType() === 'image/png' && (await sharp(tex.getImage()).metadata()).hasAlpha) { mat.setAlphaMode('MASK').setAlphaCutoff(0.5); continue; }
      log(`  ${id}: no alpha map for material ${mat.getName()}, forcing OPAQUE`);
      mat.setAlphaMode('OPAQUE');
      continue;
    }
    const entry = files[key]['1k'].jpg;
    const alphaPath = await download(entry.url, join(cacheDir, 'polyhaven', 'models', id, 'textures', `${id}_${key}_1k.jpg`), entry.size, log);
    // Interleave RGB + mask by hand: sharp's joinChannel on a JPEG source silently returns a 3-channel
    // image, which strips the cutout and renders foliage as bare branches.
    const { width, height } = await sharp(tex.getImage()).metadata();
    const rgb = await sharp(tex.getImage()).removeAlpha().raw().toBuffer();
    const mask = await sharp(alphaPath).resize(width, height).greyscale().raw().toBuffer();
    const rgbaRaw = Buffer.allocUnsafe(width * height * 4);
    for (let i = 0, j = 0, k = 0; i < width * height; i++, j += 3, k += 4) {
      rgbaRaw[k] = rgb[j];
      rgbaRaw[k + 1] = rgb[j + 1];
      rgbaRaw[k + 2] = rgb[j + 2];
      rgbaRaw[k + 3] = mask[i];
    }
    const rgba = await sharp(rgbaRaw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    tex.setImage(rgba).setMimeType('image/png').setURI((tex.getURI() || `${suffix}_diff`).replace(/\.jpe?g$/i, '.png'));
    const meta = await sharp(rgba).metadata();
    if (!meta.hasAlpha) log(`  ${id}: WARNING alpha join produced ${meta.channels} channels for ${mat.getName()}`);
    mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
  }
}

/**
 * Process one Poly Haven model into `outPath`. Returns stats { lod0, lod1, height, radius }.
 * `textureFormat` is 'ktx2' (requires ktx on PATH) or 'webp'.
 */
export async function processModel(io, { id, category, gltf, files, cacheDir, textureFormat, log = console.log }) {
  const budget = BUDGET[category] ?? 6000;
  const tex = TEX[category] ?? TEX.prop;
  const doc = await io.read(gltf);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  doc.setLogger({ debug() {}, info() {}, warn: (m) => log(`  warn ${m}`), error: (m) => log(`  ERROR ${m}`) });

  // 1. Variants: Poly Haven trees ship a/b/c side by side; keep the leanest one.
  const roots = scene.listChildren();
  if (['tree', 'sapling', 'foliage'].includes(category) && roots.length > 1) {
    // Richest variant that fits the budget; otherwise the leanest one (trees are all far above budget).
    const ranked = roots.map((n) => [nodeTriangles(n), n]).sort((a, b) => a[0] - b[0]);
    const keep = ranked.filter(([t]) => t <= budget).pop() ?? ranked[0];
    log(`  ${id}: variants ${ranked.map(([t, n]) => `${n.getName()}=${t}`).join(' ')} → keeping ${keep[1].getName()}`);
    for (const [, n] of ranked) if (n !== keep[1]) n.dispose();
    keep[1].setTranslation([0, 0, 0]);
  }
  await doc.transform(flatten());
  const lod0 = doc.createNode('LOD0');
  for (const n of scene.listChildren()) { scene.removeChild(n); lod0.addChild(n); }
  scene.addChild(lod0);

  // 2. Units: anything taller than 100 units is centimetres.
  let b = getBounds(lod0);
  if (b.max[1] - b.min[1] > 100) { log(`  ${id}: bbox ${(b.max[1] - b.min[1]).toFixed(0)} units tall → scaling cm→m`); lod0.setScale([0.01, 0.01, 0.01]); }

  // 3. Foliage cutouts, then decimation.
  await restoreAlpha(doc, { id, files, cacheDir, log });
  await doc.transform(weld());
  const before = nodeTriangles(lod0);
  await MeshoptSimplifier.ready;
  decimateNode(doc, lod0, budget);
  const lod1 = doc.createNode('LOD1').setScale(lod0.getScale());
  for (const child of lod0.listChildren()) {
    const n = doc.createNode(`${child.getName()}_LOD1`).setMatrix(child.getMatrix());
    if (child.getMesh()) {
      const mesh = doc.createMesh(`${child.getMesh().getName()}_LOD1`);
      for (const p of child.getMesh().listPrimitives()) mesh.addPrimitive(clonePrim(doc, p));
      n.setMesh(mesh);
    }
    lod1.addChild(n);
  }
  scene.addChild(lod1);
  decimateNode(doc, lod1, Math.round(Math.min(budget, before) * 0.2));

  // 4. Textures. Base-colour maps of MASK/BLEND materials (leaf and twig cutouts) must keep their alpha
  // channel — the ETC1S encoder drops it (alphaSliceByteLength 0), which renders foliage as bare branches —
  // so those are encoded with UASTC and everything else stays ETC1S.
  const cutoutNames = new Set();
  for (const mat of doc.getRoot().listMaterials()) {
    if (!['MASK', 'BLEND'].includes(mat.getAlphaMode())) continue;
    const t = mat.getBaseColorTexture();
    if (t?.getName()) cutoutNames.add(t.getName());
  }
  const cutoutPattern = cutoutNames.size ? new RegExp(`^(${[...cutoutNames].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`) : null;
  if (textureFormat === 'ktx2') {
    await doc.transform(
      toktx({ mode: Mode.UASTC, encoder: sharp, slots: NORMAL_SLOTS, resize: [tex.normal, tex.normal], level: 2, rdo: true, rdoLambda: 2, zstd: 18 }),
      ...(cutoutPattern ? [toktx({ mode: Mode.UASTC, encoder: sharp, slots: COLOR_SLOTS, pattern: cutoutPattern, resize: [tex.color, tex.color], level: 2, rdo: true, rdoLambda: 3, zstd: 18 })] : []),
      toktx({ mode: Mode.ETC1S, encoder: sharp, slots: COLOR_SLOTS, resize: [tex.color, tex.color], quality: 128 }),
    );
  } else {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: NORMAL_SLOTS, resize: [tex.normal, tex.normal], quality: 85 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: COLOR_SLOTS, resize: [tex.color, tex.color], quality: 80 }),
    );
  }

  // 5. Geometry compression + cleanup.
  await doc.transform(prune(), dedup(), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const glb = await io.writeBinary(doc);
  return { glb, before };
}

/** Stats the renderer needs, computed from final GLB bytes so first and later runs agree byte-for-byte. */
export async function modelStats(io, glbBytes) {
  const doc = await io.readBinary(glbBytes);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const byName = Object.fromEntries(scene.listChildren().map((n) => [n.getName(), n]));
  const lods = Object.keys(byName).filter((k) => /^LOD\d$/.test(k)).sort();
  const b = getBounds(byName.LOD0);
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    lods,
    triangles: Object.fromEntries(lods.map((k) => [k, nodeTriangles(byName[k])])),
    height: r2(b.max[1] - b.min[1]),
    radius: r2(Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2),
  };
}
