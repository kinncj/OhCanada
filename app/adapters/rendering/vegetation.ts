import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SeededRandom } from '@common/rng';
import type { HeightFn } from './procedural/noise';

export type VegetationKind = 'pine' | 'maple' | 'birch' | 'spruce' | 'shrub' | 'rock' | 'iceberg' | 'tundra-grass' | 'wheat' | 'cactus-none';

interface Proto {
  high: THREE.BufferGeometry;
  low: THREE.BufferGeometry;
  material: THREE.Material;
  scale: [number, number];
}

const CHUNKS = 6;
const LOD_DISTANCE = 90;

function tinted(color: number, roughness = 0.9): THREE.MeshStandardNodeMaterial {
  return new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness, metalness: 0, color });
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
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.CylinderGeometry(0.12, 0.2, 1.4, detail).translate(0, 0.7, 0), trunk));
  for (let i = 0; i < tiers; i++) {
    const r = 1.4 - i * (1.0 / tiers);
    parts.push(paint(new THREE.ConeGeometry(r, 1.6, detail).translate(0, 1.6 + i * 1.05, 0), leaf));
  }
  return merge(parts);
}

function broadleaf(canopy: number, trunk: number, detail: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.CylinderGeometry(0.16, 0.26, 2.2, detail).translate(0, 1.1, 0), trunk));
  parts.push(paint(new THREE.IcosahedronGeometry(1.5, detail > 6 ? 1 : 0).translate(0, 3.1, 0), canopy));
  parts.push(paint(new THREE.IcosahedronGeometry(1.0, 0).translate(0.8, 2.7, 0.4), canopy));
  parts.push(paint(new THREE.IcosahedronGeometry(0.9, 0).translate(-0.7, 2.9, -0.5), canopy));
  return merge(parts);
}

function makeProtos(): Record<VegetationKind, Proto> {
  const mat = tinted(0xffffff);
  return {
    pine: { high: conifer(3, 0x4a3320, 0x2f5e34, 8), low: conifer(2, 0x4a3320, 0x2f5e34, 4), material: mat, scale: [0.9, 1.6] },
    spruce: { high: conifer(4, 0x3f2d1c, 0x1f4a2e, 8), low: conifer(2, 0x3f2d1c, 0x1f4a2e, 4), material: mat, scale: [1.0, 1.8] },
    maple: { high: broadleaf(0xb8432a, 0x5a3b26, 8), low: broadleaf(0xb8432a, 0x5a3b26, 4), material: mat, scale: [0.9, 1.4] },
    birch: { high: broadleaf(0x8fbf4a, 0xe8e6dc, 8), low: broadleaf(0x8fbf4a, 0xe8e6dc, 4), material: mat, scale: [0.7, 1.2] },
    shrub: { high: paint(new THREE.IcosahedronGeometry(0.7, 1).translate(0, 0.5, 0), 0x4f7a34), low: paint(new THREE.IcosahedronGeometry(0.7, 0).translate(0, 0.5, 0), 0x4f7a34), material: mat, scale: [0.6, 1.3] },
    rock: { high: paint(new THREE.DodecahedronGeometry(0.8, 1).translate(0, 0.3, 0), 0x777b80), low: paint(new THREE.DodecahedronGeometry(0.8, 0).translate(0, 0.3, 0), 0x777b80), material: mat, scale: [0.5, 1.8] },
    iceberg: { high: paint(new THREE.DodecahedronGeometry(2.4, 1).translate(0, 0.6, 0), 0xdfeaf5), low: paint(new THREE.DodecahedronGeometry(2.4, 0).translate(0, 0.6, 0), 0xdfeaf5), material: mat, scale: [0.8, 2.2] },
    'tundra-grass': { high: paint(new THREE.ConeGeometry(0.35, 0.6, 5).translate(0, 0.3, 0), 0x9aa16a), low: paint(new THREE.ConeGeometry(0.35, 0.6, 3).translate(0, 0.3, 0), 0x9aa16a), material: mat, scale: [0.8, 1.4] },
    wheat: { high: paint(new THREE.CylinderGeometry(0.02, 0.05, 1.1, 4).translate(0, 0.55, 0), 0xd9b25a), low: paint(new THREE.CylinderGeometry(0.02, 0.05, 1.1, 3).translate(0, 0.55, 0), 0xd9b25a), material: mat, scale: [0.9, 1.2] },
    'cactus-none': { high: new THREE.BufferGeometry(), low: new THREE.BufferGeometry(), material: mat, scale: [1, 1] },
  };
}

let protos: Record<VegetationKind, Proto> | null = null;

export interface VegetationOptions {
  readonly size: number;
  readonly density: number;
  readonly kinds: readonly string[];
  readonly seed: number;
  readonly maxInstances: number;
  readonly heightAt: HeightFn;
  /** Discs where nothing grows (plazas, buildings, water). */
  readonly exclusions: readonly { x: number; z: number; r: number }[];
  readonly rects: readonly { x: number; z: number; w: number; d: number }[];
}

interface Chunk {
  center: THREE.Vector3;
  high: THREE.InstancedMesh[];
  low: THREE.InstancedMesh[];
}

/**
 * Chunked GPU instancing with two LOD levels: each chunk owns a high and a low detail
 * InstancedMesh per kind; distance to the camera toggles which one is visible, and Three's frustum
 * culling works per chunk. Placement is seeded so every client sees the same forest.
 */
export class Vegetation {
  readonly group = new THREE.Group();
  private readonly chunks: Chunk[] = [];

  constructor(opts: VegetationOptions) {
    protos ??= makeProtos();
    this.group.name = 'vegetation';
    const rng = new SeededRandom(opts.seed);
    const kinds = opts.kinds.filter((k): k is VegetationKind => k in protos! && k !== 'cactus-none');
    if (kinds.length === 0) return;
    const total = Math.min(opts.maxInstances, Math.floor(opts.density * opts.size * opts.size * 0.02));
    const half = opts.size / 2;
    const chunkSize = opts.size / CHUNKS;
    const placements = new Map<string, THREE.Matrix4[]>(); // key `${cx}:${cz}:${kind}`
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
      const proto = protos[kind];
      const y = opts.heightAt(x, z);
      if (y < -0.3) continue;
      const sc = proto.scale[0] + rng.next() * (proto.scale[1] - proto.scale[0]);
      p.set(x, y - 0.05, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * Math.PI * 2);
      s.set(sc, sc * (0.9 + rng.next() * 0.2), sc);
      m.compose(p, q, s);
      const cx = Math.min(CHUNKS - 1, Math.floor((x + half) / chunkSize));
      const cz = Math.min(CHUNKS - 1, Math.floor((z + half) / chunkSize));
      const key = `${cx}:${cz}:${kind}`;
      let list = placements.get(key);
      if (!list) {
        list = [];
        placements.set(key, list);
      }
      list.push(m.clone());
      placed++;
    }
    for (let cx = 0; cx < CHUNKS; cx++) {
      for (let cz = 0; cz < CHUNKS; cz++) {
        const chunk: Chunk = { center: new THREE.Vector3(-half + (cx + 0.5) * chunkSize, 0, -half + (cz + 0.5) * chunkSize), high: [], low: [] };
        for (const kind of kinds) {
          const list = placements.get(`${cx}:${cz}:${kind}`);
          if (!list || list.length === 0) continue;
          const proto = protos[kind];
          const hi = new THREE.InstancedMesh(proto.high, proto.material, list.length);
          const lo = new THREE.InstancedMesh(proto.low, proto.material, list.length);
          list.forEach((mat, i) => {
            hi.setMatrixAt(i, mat);
            lo.setMatrixAt(i, mat);
          });
          hi.castShadow = true;
          hi.receiveShadow = true;
          lo.castShadow = false;
          lo.receiveShadow = true;
          hi.computeBoundingSphere();
          lo.computeBoundingSphere();
          lo.visible = false;
          this.group.add(hi, lo);
          chunk.high.push(hi);
          chunk.low.push(lo);
        }
        this.chunks.push(chunk);
      }
    }
  }

  updateLod(camera: THREE.Vector3): void {
    for (const c of this.chunks) {
      const near = c.center.distanceTo(camera) < LOD_DISTANCE;
      for (const h of c.high) h.visible = near;
      for (const l of c.low) l.visible = !near;
    }
  }

  get instanceCount(): number {
    return this.chunks.reduce((n, c) => n + c.high.reduce((m, h) => m + h.count, 0), 0);
  }

  dispose(): void {
    for (const c of this.chunks) for (const mesh of [...c.high, ...c.low]) mesh.dispose();
    this.group.removeFromParent();
  }
}
