import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SeededRandom } from '@common/rng';
import { positionLocal, positionWorld, sin, time, vec3, float } from 'three/tsl';
import type { HeightFn } from './procedural/noise';
import type { LoadedModel } from './asset-library';

export type VegetationKind = 'pine' | 'maple' | 'birch' | 'spruce' | 'shrub' | 'rock' | 'iceberg' | 'tundra-grass' | 'wheat' | 'cactus-none';

interface Proto {
  /** Per LOD: list of (geometry, material) pairs to instance. */
  lods: { geometry: THREE.BufferGeometry; material: THREE.Material }[][];
  scale: [number, number];
  /** Y offset so the model base sits on the ground. */
  yOffset: number;
  castShadow: boolean;
}

const CHUNKS = 6;

function tinted(): THREE.MeshStandardNodeMaterial {
  return new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
}

function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.attributes.position!.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  for (const p of parts) p.dispose();
  return merged;
}

function conifer(tiers: number, trunk: number, leaf: number, detail: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(0.12, 0.2, 1.4, detail).translate(0, 0.7, 0), trunk)];
  for (let i = 0; i < tiers; i++) parts.push(paint(new THREE.ConeGeometry(1.4 - i * (1.0 / tiers), 1.6, detail).translate(0, 1.6 + i * 1.05, 0), leaf));
  return merge(parts);
}

function broadleaf(canopy: number, trunk: number, detail: number): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.16, 0.26, 2.2, detail).translate(0, 1.1, 0), trunk),
    paint(new THREE.IcosahedronGeometry(1.5, detail > 6 ? 1 : 0).translate(0, 3.1, 0), canopy),
    paint(new THREE.IcosahedronGeometry(1.0, 0).translate(0.8, 2.7, 0.4), canopy),
    paint(new THREE.IcosahedronGeometry(0.9, 0).translate(-0.7, 2.9, -0.5), canopy),
  ]);
}

let proceduralProtos: Record<VegetationKind, Proto> | null = null;
/** Shared per source material: keeps shader permutations (and compile time) low across LODs and variants. */
const materialCache = new Map<string, THREE.Material>();
function procedural(): Record<VegetationKind, Proto> {
  const mat = tinted();
  const two = (hi: THREE.BufferGeometry, lo: THREE.BufferGeometry, scale: [number, number]): Proto => ({ lods: [[{ geometry: hi, material: mat }], [{ geometry: lo, material: mat }]], scale, yOffset: -0.05, castShadow: true });
  return {
    pine: two(conifer(3, 0x4a3320, 0x2f5e34, 8), conifer(2, 0x4a3320, 0x2f5e34, 4), [0.9, 1.6]),
    spruce: two(conifer(4, 0x3f2d1c, 0x1f4a2e, 8), conifer(2, 0x3f2d1c, 0x1f4a2e, 4), [1.0, 1.8]),
    maple: two(broadleaf(0xb8432a, 0x5a3b26, 8), broadleaf(0xb8432a, 0x5a3b26, 4), [0.9, 1.4]),
    birch: two(broadleaf(0x8fbf4a, 0xe8e6dc, 8), broadleaf(0x8fbf4a, 0xe8e6dc, 4), [0.7, 1.2]),
    shrub: two(paint(new THREE.IcosahedronGeometry(0.7, 1).translate(0, 0.5, 0), 0x4f7a34), paint(new THREE.IcosahedronGeometry(0.7, 0).translate(0, 0.5, 0), 0x4f7a34), [0.6, 1.3]),
    rock: two(paint(new THREE.DodecahedronGeometry(0.8, 1).translate(0, 0.3, 0), 0x777b80), paint(new THREE.DodecahedronGeometry(0.8, 0).translate(0, 0.3, 0), 0x777b80), [0.5, 1.8]),
    iceberg: two(paint(new THREE.DodecahedronGeometry(2.4, 1).translate(0, 0.6, 0), 0xdfeaf5), paint(new THREE.DodecahedronGeometry(2.4, 0).translate(0, 0.6, 0), 0xdfeaf5), [0.8, 2.2]),
    'tundra-grass': two(paint(new THREE.ConeGeometry(0.35, 0.6, 5).translate(0, 0.3, 0), 0x9aa16a), paint(new THREE.ConeGeometry(0.35, 0.6, 3).translate(0, 0.3, 0), 0x9aa16a), [0.8, 1.4]),
    wheat: two(paint(new THREE.CylinderGeometry(0.02, 0.05, 1.1, 4).translate(0, 0.55, 0), 0xd9b25a), paint(new THREE.CylinderGeometry(0.02, 0.05, 1.1, 3).translate(0, 0.55, 0), 0xd9b25a), [0.9, 1.2]),
    'cactus-none': { lods: [[], []], scale: [1, 1], yOffset: 0, castShadow: false },
  };
}

/** Which real models stand in for each manifest-less kind. Several models per kind give variety. */
export const KIND_MODELS: Record<VegetationKind, readonly string[]> = {
  pine: ['tree-pine', 'sapling-pine'],
  spruce: ['tree-fir', 'sapling-fir'],
  maple: ['tree-broadleaf-1', 'tree-broadleaf-2'],
  birch: ['tree-broadleaf-2', 'tree-broadleaf-1'],
  shrub: ['fern', 'grass-clump'],
  rock: ['rock-boulder', 'rock-2', 'rock-3'],
  iceberg: ['rock-coast', 'rock-boulder'],
  'tundra-grass': ['grass-clump', 'fern'],
  wheat: ['grass-clump'],
  'cactus-none': [],
};

/** Convert a loaded glTF model (LOD0/LOD1 nodes) into an instancing prototype with world-space baked transforms. */
export function protoFromModel(model: LoadedModel, scale: [number, number], tint?: THREE.ColorRepresentation): Proto {
  const lods = model.lods.map((lod) => {
    lod.updateMatrixWorld(true);
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    lod.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const g = o.geometry.clone();
      // bake the node transform relative to the LOD root
      const rel = new THREE.Matrix4().copy(lod.matrixWorld).invert().multiply(o.matrixWorld);
      g.applyMatrix4(rel);
      const src = o.material as THREE.MeshStandardMaterial;
      const cacheKey = `${src.uuid}:${tint ?? ''}`;
      let m = materialCache.get(cacheKey);
      if (!m) {
        m = src.clone();
        if (tint && m instanceof THREE.MeshStandardMaterial) m.color.multiply(new THREE.Color(tint));
        if (model.entry.category === 'tree' && m instanceof THREE.MeshStandardMaterial) m = windSway(m, model.entry.height);
        materialCache.set(cacheKey, m);
      }
      out.push({ geometry: g, material: m });
    });
    return out;
  });
  const box = new THREE.Box3();
  for (const p of lods[0] ?? []) {
    p.geometry.computeBoundingBox();
    if (p.geometry.boundingBox) box.union(p.geometry.boundingBox);
  }
  return { lods, scale, yOffset: Number.isFinite(box.min.y) ? -box.min.y : 0, castShadow: model.entry.category !== 'grass' };
}

export interface VegetationOptions {
  readonly size: number;
  readonly density: number;
  readonly kinds: readonly string[];
  readonly seed: number;
  readonly maxInstances: number;
  readonly heightAt: HeightFn;
  readonly exclusions: readonly { x: number; z: number; r: number }[];
  readonly rects: readonly { x: number; z: number; w: number; d: number }[];
  /** Vegetation shadow casting doubles its geometry cost; only the full asset policy pays it. */
  readonly castShadows?: boolean;
  /** Real-asset prototypes per kind (several for variety); falls back to procedural when absent. */
  readonly protos?: Partial<Record<VegetationKind, Proto[]>>;
}

interface Chunk {
  center: THREE.Vector3;
  high: THREE.InstancedMesh[];
  low: THREE.InstancedMesh[];
}

/**
 * Chunked GPU instancing with two LOD levels per prototype; frustum culling works per chunk and distance to the
 * camera toggles LOD0/LOD1. Placement is seeded so every client sees the same forest.
 */
export class Vegetation {
  readonly group = new THREE.Group();
  private readonly chunks: Chunk[] = [];
  private readonly owned: THREE.InstancedMesh[] = [];
  private chunkExtent = 40;

  constructor(opts: VegetationOptions) {
    proceduralProtos ??= procedural();
    this.group.name = 'vegetation';
    const rng = new SeededRandom(opts.seed);
    const kinds = opts.kinds.filter((k): k is VegetationKind => k in proceduralProtos! && k !== 'cactus-none');
    if (kinds.length === 0) return;
    const protoSets = new Map<VegetationKind, Proto[]>();
    for (const k of kinds) protoSets.set(k, opts.protos?.[k]?.length ? opts.protos[k]! : [proceduralProtos[k]]);
    // Trees are heavier than grass: scale the count by the average LOD0 triangle load of the chosen kinds.
    const total = Math.min(opts.maxInstances, Math.floor(opts.density * opts.size * opts.size * 0.02));
    const half = opts.size / 2;
    const chunkSize = opts.size / CHUNKS;
    this.chunkExtent = chunkSize * 0.71; // half-diagonal: a chunk is visible until its far corner leaves range
    const placements = new Map<string, THREE.Matrix4[]>(); // `${cx}:${cz}:${kind}:${variant}`
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    let attempts = 0;
    while (placed < total && attempts < total * 4) {
      attempts++;
      const x = (rng.next() * 2 - 1) * (half - 4);
      const z = (rng.next() * 2 - 1) * (half - 4);
      if (opts.exclusions.some((e) => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
      if (opts.rects.some((r) => Math.abs(x - r.x) < r.w / 2 + 2 && Math.abs(z - r.z) < r.d / 2 + 2)) continue;
      const kind = kinds[rng.int(kinds.length)] as VegetationKind;
      const variants = protoSets.get(kind)!;
      const vi = rng.int(variants.length);
      const proto = variants[vi]!;
      const y = opts.heightAt(x, z);
      if (y < -0.3) continue;
      const sc = proto.scale[0] + rng.next() * (proto.scale[1] - proto.scale[0]);
      p.set(x, y + proto.yOffset * sc, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * Math.PI * 2);
      s.set(sc, sc * (0.92 + rng.next() * 0.16), sc);
      m.compose(p, q, s);
      const cx = Math.min(CHUNKS - 1, Math.floor((x + half) / chunkSize));
      const cz = Math.min(CHUNKS - 1, Math.floor((z + half) / chunkSize));
      const key = `${cx}:${cz}:${kind}:${vi}`;
      let list = placements.get(key);
      if (!list) placements.set(key, (list = []));
      list.push(m.clone());
      placed++;
    }
    for (let cx = 0; cx < CHUNKS; cx++) {
      for (let cz = 0; cz < CHUNKS; cz++) {
        const chunk: Chunk = { center: new THREE.Vector3(-half + (cx + 0.5) * chunkSize, 0, -half + (cz + 0.5) * chunkSize), high: [], low: [] };
        for (const kind of kinds) {
          const variants = protoSets.get(kind)!;
          variants.forEach((proto, vi) => {
            const list = placements.get(`${cx}:${cz}:${kind}:${vi}`);
            if (!list || list.length === 0) return;
            const lod0 = proto.lods[0] ?? [];
            const lod1 = proto.lods[1] ?? lod0;
            const make = (parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[], high: boolean) =>
              parts.map((part) => {
                const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
                list.forEach((mat, i) => im.setMatrixAt(i, mat));
                im.castShadow = high && proto.castShadow && (opts.castShadows ?? true);
                im.receiveShadow = true;
                im.computeBoundingSphere();
                im.visible = high;
                this.group.add(im);
                this.owned.push(im);
                return im;
              });
            chunk.high.push(...make(lod0, true));
            chunk.low.push(...make(lod1, false));
          });
        }
        this.chunks.push(chunk);
      }
    }
  }

  /**
   * Per chunk: nothing beyond the draw distance is submitted at all, and only the closest quarter of that
   * range uses LOD0. Without the cull a 1 km district draws every scanned tree (14k triangles each) plus a
   * shadow pass, which is what made phones crawl.
   */
  updateLod(camera: THREE.Vector3, drawDistance = 400): void {
    const half = this.chunkExtent;
    const cull = drawDistance + half;
    const lod0 = drawDistance * 0.25 + half;
    for (const c of this.chunks) {
      const d = c.center.distanceTo(camera);
      if (d > cull) {
        for (const m of c.high) m.visible = false;
        for (const m of c.low) m.visible = false;
        continue;
      }
      const near = d < lod0;
      for (const h of c.high) h.visible = near;
      for (const l of c.low) l.visible = !near;
    }
  }

  get instanceCount(): number {
    return this.chunks.reduce((n, c) => n + c.high.reduce((m, h) => m + h.count, 0), 0);
  }

  dispose(): void {
    for (const im of this.owned) im.dispose();
    this.group.removeFromParent();
  }
}

/** Convert an imported standard material into a node material whose vertices sway with height (wind). */
function windSway(base: THREE.MeshStandardMaterial, height: number): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial();
  m.copy(base as unknown as THREE.MeshStandardNodeMaterial);
  m.alphaTest = base.alphaTest;
  m.transparent = base.transparent;
  m.side = base.side;
  const h = Math.max(1, height);
  const phase = positionWorld.x.mul(0.15).add(positionWorld.z.mul(0.12)).add(time.mul(0.9));
  const amount = positionLocal.y.div(h).clamp(0, 1).pow(1.6).mul(0.12 * h);
  const sway = vec3(sin(phase).mul(amount), float(0), sin(phase.mul(1.3).add(1.7)).mul(amount).mul(0.6));
  m.positionNode = positionLocal.add(sway);
  return m;
}
