import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import type { Landmark } from '@domain/district';
import { drawCanadianFlag } from './procedural/maple-leaf';
import type { MaterialKit } from './materials';

export interface ColliderSpec {
  readonly kind: 'box' | 'cylinder';
  readonly center: [number, number, number];
  readonly halfExtents: [number, number, number];
  readonly rotationY: number;
}

export interface LandmarkBuild {
  readonly object: TransformNode;
  readonly colliders: readonly ColliderSpec[];
  readonly footprint: { readonly w: number; readonly d: number };
  readonly lights: readonly PointLight[];
  readonly meshes: readonly Mesh[];
}

/** Landmark types with a real builder; anything else must come from a hero asset (ADR-0009). */
export const PROCEDURAL_TYPES: ReadonlySet<string> = new Set([
  'parliament', 'flame', 'flagpole', 'lamp', 'bench', 'station', 'locks',
  'courthouse', 'legislature', 'supremecourt', 'pollingstation', 'arena', 'fort', 'port', 'rink',
  'apartments', 'factory', 'circle', 'lookout', 'hydrant', 'power-pole', 'utility-box', 'barrier', 'gate',
  'town-hall', 'city-hall', 'rideau-hall', 'confederation-hall', 'police-station', 'returning-office',
  'campaign-office', 'tech-incubator', 'friendship-centre', 'fur-post', 'festival-pavilion', 'volunteer-tent', 'street',
]);

/**
 * Accumulates parts per material and merges each group into one mesh, so a whole building costs a handful of
 * draw calls instead of dozens — the difference between smooth and unplayable on a phone.
 */
class Batch {
  private readonly parts = new Map<Material, Mesh[]>();
  readonly extras: Mesh[] = [];
  readonly lights: PointLight[] = [];
  readonly colliders: ColliderSpec[] = [];

  constructor(private readonly scene: Scene) {}

  private add(mesh: Mesh, mat: Material): void {
    mesh.isVisible = false;
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(mesh);
  }

  box(w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0, rotY = 0): void {
    const m = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, this.scene);
    m.position.set(x, y + h / 2, z);
    if (rotY) m.rotation.y = rotY;
    this.add(m, mat);
  }

  cyl(diameterTop: number, diameterBottom: number, h: number, mat: Material, x = 0, y = 0, z = 0, tessellation = 16): void {
    const m = MeshBuilder.CreateCylinder('p', { diameterTop, diameterBottom, height: h, tessellation }, this.scene);
    m.position.set(x, y + h / 2, z);
    this.add(m, mat);
  }

  sphere(diameter: number, mat: Material, x: number, y: number, z: number, slice = 1): void {
    const m = MeshBuilder.CreateSphere('p', { diameter, segments: 16, slice }, this.scene);
    m.position.set(x, y, z);
    this.add(m, mat);
  }

  cone(diameter: number, h: number, mat: Material, x: number, y: number, z: number, tessellation = 4, rotY = 0): void {
    const m = MeshBuilder.CreateCylinder('p', { diameterTop: 0, diameterBottom: diameter, height: h, tessellation }, this.scene);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    this.add(m, mat);
  }

  /** Ridge roof as a 4-sided pyramid squashed along z — reads as a pitched roof from every angle. */
  roof(w: number, d: number, h: number, mat: Material, x = 0, y = 0, z = 0): void {
    const m = MeshBuilder.CreateCylinder('p', { diameterTop: 0, diameterBottom: Math.max(w, d) * 1.06, height: h, tessellation: 4 }, this.scene);
    m.rotation.y = Math.PI / 4;
    m.scaling.z = d / Math.max(w, d);
    m.scaling.x = w / Math.max(w, d);
    m.position.set(x, y + h / 2, z);
    this.add(m, mat);
  }

  light(x: number, y: number, z: number, colour: string, intensity: number, range: number, name = 'lamp-light'): void {
    const l = new PointLight(name, new Vector3(x, y, z), this.scene);
    l.diffuse = Color3.FromHexString(colour);
    l.intensity = intensity;
    l.range = range;
    this.lights.push(l);
  }

  collide(kind: 'box' | 'cylinder', center: [number, number, number], halfExtents: [number, number, number], rotationY = 0): void {
    this.colliders.push({ kind, center, halfExtents, rotationY });
  }

  finish(name: string): { root: TransformNode; meshes: Mesh[] } {
    const root = new TransformNode(name, this.scene);
    const meshes: Mesh[] = [];
    for (const [mat, list] of this.parts) {
      const merged = list.length === 1 ? list[0]! : Mesh.MergeMeshes(list, true, true, undefined, false, false);
      if (!merged) continue;
      merged.isVisible = true;
      merged.material = mat;
      merged.parent = root;
      merged.receiveShadows = true;
      merged.alwaysSelectAsActiveMesh = false;
      meshes.push(merged);
    }
    for (const e of this.extras) {
      e.parent = root;
      meshes.push(e);
    }
    for (const l of this.lights) l.parent = root;
    return { root, meshes };
  }
}

let flagTexture: DynamicTexture | null = null;
function flagMaterial(scene: Scene): StandardMaterial {
  if (!flagTexture) {
    const canvas = drawCanadianFlag(512, 256);
    flagTexture = new DynamicTexture('flag', { width: 512, height: 256 }, scene, false);
    const ctx = flagTexture.getContext();
    ctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
    flagTexture.update();
  }
  const m = new StandardMaterial('flag-mat', scene);
  m.diffuseTexture = flagTexture;
  m.emissiveColor = new Color3(0.25, 0.25, 0.25);
  m.backFaceCulling = false;
  return m;
}

interface FacadeOptions {
  roof: 'copper' | 'flat' | 'gable' | 'dome' | 'mansard';
  windows?: boolean;
  wall?: Material;
  arches?: boolean;
}

/** Civic facade: plinth, pilasters, recessed windows with sills, cornice and a roof form. */
function facade(b: Batch, kit: MaterialKit, w: number, h: number, d: number, opts: FacadeOptions): void {
  const wall = opts.wall ?? kit.sandstone;
  b.box(w, h, d, wall);
  b.box(w + 0.7, 1.1, d + 0.7, kit.darkStone);
  b.box(w + 0.5, 0.45, d + 0.5, kit.darkStone, 0, h - 0.45);
  const floors = Math.max(1, Math.floor((h - 2.5) / 3.6));
  for (let f = 1; f < floors; f++) b.box(w + 0.3, 0.22, d + 0.3, kit.darkStone, 0, 2.2 + f * 3.6 - 1.6);
  if (opts.windows !== false) {
    const bays = Math.max(1, Math.floor(w / 3.4));
    for (const sz of [1, -1]) {
      const zFace = sz * (d / 2);
      for (let bay = 0; bay <= bays; bay++) b.box(0.5, h - 1.2, 0.45, wall, -w / 2 + bay * (w / bays), 0.6, zFace + sz * 0.15);
      for (let f = 0; f < floors; f++) {
        const y = 2.4 + f * 3.6;
        for (let bay = 0; bay < bays; bay++) {
          const x = -w / 2 + (bay + 0.5) * (w / bays);
          b.box(1.5, 2.5, 0.5, kit.darkStone, x, y - 1.25, zFace - sz * 0.2);
          b.box(1.3, 2.3, 0.06, kit.glass, x, y - 1.15, zFace + sz * 0.06);
          b.box(1.9, 0.28, 0.42, kit.darkStone, x, y + 1.25, zFace + sz * 0.1);
          b.box(1.9, 0.28, 0.42, kit.darkStone, x, y - 1.55, zFace + sz * 0.16);
        }
      }
    }
    if (opts.arches) {
      b.box(4.2, 4.3, 0.6, kit.darkStone, 0, 0, d / 2 + 0.25);
      b.box(3.4, 4.0, 0.3, kit.wood, 0, 0, d / 2 + 0.5);
      for (let k = 0; k < 4; k++) b.box(9 - k * 1.6, 0.3, 1.4, kit.darkStone, 0, k * 0.3, d / 2 + 2.4 - k * 0.6);
    }
  }
  b.collide('box', [0, h / 2, 0], [w / 2 + 0.4, h / 2, d / 2 + 0.4]);
  switch (opts.roof) {
    case 'copper':
    case 'gable': {
      const mat = opts.roof === 'copper' ? kit.copper : kit.roof;
      const rh = Math.min(d * 0.55, 6.5);
      b.roof(w + 1, d + 1, rh, mat, 0, h);
      const n = Math.max(1, Math.floor(w / 6));
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + (k + 0.5) * (w / n);
        for (const sz of [1, -1]) {
          const z = sz * (d * 0.3);
          b.box(1.6, 1.8, 1.4, kit.sandstone, x, h + 0.5, z);
          b.box(0.8, 1.0, 0.1, kit.glass, x, h + 0.9, z + sz * 0.72);
          b.roof(1.9, 1.7, 1.1, mat, x, h + 2.3, z);
        }
      }
      break;
    }
    case 'mansard':
      b.box(w * 0.92, 2.4, d * 0.92, kit.roof, 0, h);
      b.box(w * 0.7, 0.7, d * 0.7, kit.roof, 0, h + 2.4);
      break;
    case 'dome': {
      const r = Math.min(w, d) * 0.34;
      b.cyl(r * 2, r * 2, 2.4, kit.sandstone, 0, h, 0, 24);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        b.cyl(0.44, 0.44, 2.4, kit.white, Math.cos(a) * (r + 0.1), h, Math.sin(a) * (r + 0.1), 8);
      }
      b.sphere((r + 0.4) * 2, kit.copper, 0, h + 2.4, 0, 2);
      b.cyl(1.2, 1.6, 1.6, kit.sandstone, 0, h + 2.4 + r + 0.2, 0, 12);
      break;
    }
    default:
      b.box(w * 1.02, 0.6, d * 1.02, kit.roof, 0, h);
      b.box(w * 0.98, 0.9, 0.35, kit.sandstone, 0, h + 0.6, d / 2 - 0.2);
      b.box(w * 0.98, 0.9, 0.35, kit.sandstone, 0, h + 0.6, -d / 2 + 0.2);
  }
}

type Builder = (b: Batch, kit: MaterialKit, scene: Scene) => { w: number; d: number };

const BUILDERS: Record<string, Builder> = {
  parliament: (b, kit) => {
    facade(b, kit, 46, 15, 15, { roof: 'copper', arches: true });
    for (const sx of [-1, 1]) {
      const wing = new Batch(b['scene' as never] as unknown as Scene);
      void wing;
      b.box(15, 13, 24, kit.sandstone, sx * 30.5, 0, -4.5);
      b.roof(16, 25, 6, kit.copper, sx * 30.5, 13, -4.5);
      b.collide('box', [sx * 30.5, 6.5, -4.5], [7.8, 6.5, 12.3]);
      b.cyl(3.2, 3.6, 18, kit.sandstone, sx * 38.5, 0, 8, 12);
      b.cone(4, 4.5, kit.copper, sx * 38.5, 18, 8, 12);
    }
    b.box(7.2, 44, 7.2, kit.sandstone, 0, 0, 9.5);
    for (const yy of [12, 24, 36]) b.box(7.8, 0.4, 7.8, kit.darkStone, 0, yy, 9.5);
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      b.box(dx !== 0 ? 0.15 : 4.6, 4.6, dz !== 0 ? 0.15 : 4.6, kit.white, dx * 3.7, 35.2, 9.5 + dz * 3.7);
    }
    b.box(6.2, 5, 6.2, kit.sandstone, 0, 44, 9.5);
    b.cone(9.2, 14, kit.copper, 0, 49, 9.5, 4, Math.PI / 4);
    b.cyl(0.16, 0.16, 4, kit.metal, 0, 63, 9.5, 6);
    b.collide('box', [0, 22, 9.5], [3.9, 22, 3.9]);
    for (let i = 0; i < 5; i++) b.box(24 - i * 2, 0.32, 2.2, kit.darkStone, 0, i * 0.32, 15.5 - i * 0.8);
    b.collide('box', [0, 0.8, 14.2], [12, 0.8, 2.2]);
    return { w: 84, d: 46 };
  },
  flame: (b, kit) => {
    b.cyl(6.8, 7.6, 0.5, kit.darkStone, 0, 0, 0, 32);
    b.cyl(3, 3.8, 0.9, kit.sandstone, 0, 0.5, 0, 24);
    b.cone(1.2, 1.5, kit.flame, 0, 1.5, 0, 10);
    b.light(0, 2.4, 0, '#ff8a2a', 1.4, 20, 'flame-light');
    b.collide('cylinder', [0, 0.7, 0], [1.9, 0.7, 1.9]);
    return { w: 8, d: 8 };
  },
  flagpole: (b, kit, scene) => {
    b.cyl(0.14, 0.22, 9, kit.metal, 0, 0, 0, 12);
    b.cyl(1, 1.2, 0.4, kit.darkStone, 0, 0, 0, 16);
    const flag = MeshBuilder.CreatePlane('flag', { width: 2.4, height: 1.2, sideOrientation: Mesh.DOUBLESIDE }, scene);
    flag.material = flagMaterial(scene);
    flag.position.set(1.3, 8.3, 0);
    b.extras.push(flag);
    b.collide('cylinder', [0, 4.5, 0], [0.15, 4.5, 0.15]);
    return { w: 1, d: 1 };
  },
  lamp: (b, kit) => {
    b.cyl(0.12, 0.2, 3.6, kit.metal, 0, 0, 0, 10);
    b.cyl(0.32, 0.36, 0.4, kit.metal);
    b.cone(0.68, 0.3, kit.metal, 0, 3.75, 0, 8);
    b.sphere(0.44, kit.bulb, 0, 3.65, 0);
    b.light(0, 3.5, 0, '#ffdca0', 0.8, 14);
    return { w: 1, d: 1 };
  },
  bench: (b, kit) => {
    b.box(1.8, 0.08, 0.5, kit.wood, 0, 0.45, 0);
    b.box(1.8, 0.5, 0.06, kit.wood, 0, 0.5, -0.24);
    for (const sx of [-0.8, 0.8]) b.box(0.08, 0.45, 0.5, kit.metal, sx, 0, 0);
    b.collide('box', [0, 0.4, 0], [0.9, 0.4, 0.3]);
    return { w: 2, d: 1 };
  },
  station: (b, kit) => {
    b.box(18, 0.6, 6, kit.concrete);
    b.collide('box', [0, 0.3, 0], [9, 0.3, 3]);
    for (const sx of [-7, -2.3, 2.3, 7]) b.cyl(0.28, 0.28, 4, kit.metal, sx, 0.6, -2.5, 8);
    b.roof(19, 8, 1.4, kit.copper, 0, 4.6, -0.5);
    facadeAt(b, kit, 11, 5.5, 6.5, { roof: 'gable', wall: kit.brick, arches: true }, 0, -8);
    b.collide('box', [0, 2.75, -8], [5.8, 2.75, 3.5]);
    for (const dz of [3.9, 5.1]) b.box(30, 0.12, 0.12, kit.metal, 0, 0, dz);
    b.box(16, 2.8, 2.7, kit.metal, 0, 0.6, 4.5);
    b.box(16.2, 0.9, 2.75, kit.red, 0, 1.7, 4.5);
    b.box(16.4, 0.3, 2.9, kit.roof, 0, 3.4, 4.5);
    for (let i = -6.5; i <= 6.5; i += 2.2) for (const sz of [1, -1]) b.box(1.3, 1.0, 0.06, kit.glass, i, 2.15, 4.5 + sz * 1.38);
    b.collide('box', [0, 1.9, 4.5], [8, 1.9, 1.45]);
    return { w: 22, d: 22 };
  },
  locks: (b, kit) => {
    for (let i = 0; i < 4; i++) {
      b.box(6, 1.2 + i * 0.4, 1.2, kit.darkStone, 0, 0, -i * 5);
      b.collide('box', [0, 0.8, -i * 5], [3, 0.8, 0.6]);
      for (const sx of [-4, 4]) b.box(0.5, 0.5, 4, kit.wood, sx, 1.2 + i * 0.4, -i * 5);
    }
    return { w: 12, d: 22 };
  },
  courthouse: (b, kit) => (facade(b, kit, 24, 12, 15, { roof: 'dome', arches: true }), { w: 24, d: 15 }),
  legislature: (b, kit) => (facade(b, kit, 32, 13, 17, { roof: 'dome', arches: true }), { w: 32, d: 17 }),
  supremecourt: (b, kit) => (facade(b, kit, 28, 15, 17, { roof: 'copper', wall: kit.concrete }), { w: 28, d: 17 }),
  pollingstation: (b, kit) => (facade(b, kit, 15, 5.5, 11, { roof: 'gable', wall: kit.brick, arches: true }), { w: 15, d: 11 }),
  arena: (b, kit) => (facade(b, kit, 32, 12, 24, { roof: 'flat', wall: kit.metal, windows: false }), { w: 32, d: 24 }),
  port: (b, kit) => (facade(b, kit, 20, 8, 12, { roof: 'flat', wall: kit.concrete }), { w: 20, d: 12 }),
  rink: (b, kit) => (facade(b, kit, 26, 1, 15, { roof: 'flat', wall: kit.white, windows: false }), { w: 26, d: 15 }),
  apartments: (b, kit) => (facade(b, kit, 16, 14, 10, { roof: 'flat', wall: kit.brick }), { w: 16, d: 10 }),
  factory: (b, kit) => (facade(b, kit, 18, 9, 12, { roof: 'flat', wall: kit.brick }), { w: 18, d: 12 }),
  'town-hall': (b, kit) => (facade(b, kit, 20, 9, 13, { roof: 'gable', wall: kit.brick, arches: true }), { w: 20, d: 13 }),
  'city-hall': (b, kit) => (facade(b, kit, 26, 14, 15, { roof: 'flat', wall: kit.concrete }), { w: 26, d: 15 }),
  'rideau-hall': (b, kit) => (facade(b, kit, 30, 11, 16, { roof: 'mansard', wall: kit.sandstone, arches: true }), { w: 30, d: 16 }),
  'confederation-hall': (b, kit) => (facade(b, kit, 24, 12, 16, { roof: 'dome', wall: kit.sandstone, arches: true }), { w: 24, d: 16 }),
  'police-station': (b, kit) => (facade(b, kit, 18, 8, 12, { roof: 'flat', wall: kit.concrete }), { w: 18, d: 12 }),
  'returning-office': (b, kit) => (facade(b, kit, 14, 5, 10, { roof: 'flat', wall: kit.plaster }), { w: 14, d: 10 }),
  'campaign-office': (b, kit) => (facade(b, kit, 12, 4.5, 9, { roof: 'flat', wall: kit.brick }), { w: 12, d: 9 }),
  'tech-incubator': (b, kit) => (facade(b, kit, 22, 13, 14, { roof: 'flat', wall: kit.metal }), { w: 22, d: 14 }),
  'friendship-centre': (b, kit) => (facade(b, kit, 16, 6, 12, { roof: 'gable', wall: kit.wood }), { w: 16, d: 12 }),
  fort: (b, kit) => {
    facade(b, kit, 10, 4, 8, { roof: 'gable', wall: kit.wood, windows: false });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      b.cyl(0.44, 0.52, 3.2, kit.wood, Math.cos(a) * 12, 0, Math.sin(a) * 12, 6);
    }
    return { w: 26, d: 26 };
  },
  circle: (b, kit) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.cyl(1, 1.4, 1.2 + (i % 3) * 0.4, kit.darkStone, Math.cos(a) * 6, 0, Math.sin(a) * 6, 8);
      b.collide('cylinder', [Math.cos(a) * 6, 0.8, Math.sin(a) * 6], [0.6, 0.8, 0.6]);
    }
    b.cone(1, 1.2, kit.flame, 0, 0.2, 0, 8);
    return { w: 14, d: 14 };
  },
  lookout: (b, kit) => {
    b.box(6, 0.4, 6, kit.wood, 0, 4);
    for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]] as const) b.cyl(0.3, 0.3, 4, kit.wood, x, 0, z, 8);
    b.box(6, 0.3, 6, kit.copper, 0, 7.4);
    b.collide('box', [0, 2.2, 0], [3, 2.2, 3]);
    return { w: 7, d: 7 };
  },
  'fur-post': (b, kit) => {
    facade(b, kit, 10, 4, 8, { roof: 'gable', wall: kit.wood, windows: false });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      b.cyl(0.44, 0.52, 3.2, kit.wood, Math.cos(a) * 11, 0, Math.sin(a) * 11, 6);
    }
    return { w: 24, d: 24 };
  },
  'festival-pavilion': (b, kit) => {
    for (const [x, z] of [[-7, -5], [7, -5], [-7, 5], [7, 5]] as const) {
      b.cyl(0.4, 0.48, 5, kit.metal, x, 0, z, 8);
      b.collide('cylinder', [x, 2.5, z], [0.3, 2.5, 0.3]);
    }
    b.roof(17, 12, 2.6, kit.white, 0, 5);
    b.box(16, 0.4, 11, kit.wood, 0, 0.05, 0);
    return { w: 18, d: 13 };
  },
  'volunteer-tent': (b, kit) => {
    b.roof(6, 5, 1.2, kit.white, 0, 2.4);
    for (const [x, z] of [[-2.8, -2.2], [2.8, -2.2], [-2.8, 2.2], [2.8, 2.2]] as const) b.cyl(0.1, 0.12, 2.4, kit.metal, x, 0, z, 6);
    b.box(4, 0.75, 0.7, kit.wood, 0, 0, -1.6);
    b.collide('box', [0, 0.4, -1.6], [2, 0.4, 0.35]);
    return { w: 7, d: 6 };
  },
  street: (b, kit) => {
    b.box(46, 0.12, 12, kit.concrete);
    for (let i = 0; i < 6; i++) {
      const x = -18 + i * 7.2;
      const z = i % 2 === 0 ? -3.6 : 3.6;
      b.roof(4.4, 3, 0.8, i % 2 === 0 ? kit.red : kit.copper, x, 2.3, z);
      for (const [dx, dz] of [[-1.9, -1.3], [1.9, -1.3], [-1.9, 1.3], [1.9, 1.3]] as const) b.cyl(0.1, 0.12, 2.3, kit.metal, x + dx, 0, z + dz, 6);
      b.box(4, 0.85, 1.2, kit.wood, x, 0, z);
      b.collide('box', [x, 0.45, z], [2, 0.45, 0.6]);
    }
    // bilingual street-name blades, EN above FR
    for (const sx of [-1, 1]) {
      b.cyl(0.12, 0.16, 3.2, kit.metal, sx * 21, 0, 5.4, 8);
      b.box(2.4, 0.42, 0.06, kit.white, sx * 21 + sx * 1.1, 2.9, 5.4);
      b.box(2.4, 0.42, 0.06, kit.white, sx * 21 + sx * 1.1, 2.4, 5.4);
    }
    return { w: 48, d: 14 };
  },
  hydrant: (b, kit) => {
    b.cyl(0.3, 0.36, 0.9, kit.red, 0, 0, 0, 10);
    b.sphere(0.34, kit.red, 0, 0.95, 0);
    b.collide('cylinder', [0, 0.45, 0], [0.2, 0.45, 0.2]);
    return { w: 1, d: 1 };
  },
  'power-pole': (b, kit) => {
    b.cyl(0.24, 0.32, 9, kit.wood, 0, 0, 0, 8);
    b.box(2.6, 0.16, 0.16, kit.wood, 0, 8.2, 0);
    b.collide('cylinder', [0, 4.5, 0], [0.2, 4.5, 0.2]);
    return { w: 1, d: 1 };
  },
  'utility-box': (b, kit) => {
    b.box(0.8, 1.4, 0.5, kit.metal);
    b.collide('box', [0, 0.7, 0], [0.4, 0.7, 0.25]);
    return { w: 1, d: 1 };
  },
  barrier: (b, kit) => {
    b.box(2, 0.8, 0.5, kit.concrete);
    b.collide('box', [0, 0.4, 0], [1, 0.4, 0.25]);
    return { w: 2, d: 1 };
  },
  gate: (b, kit) => {
    for (const sx of [-1, 1]) b.cyl(0.4, 0.5, 4, kit.darkStone, sx * 2.2, 0, 0, 8);
    for (let i = -1.8; i <= 1.8; i += 0.45) b.cyl(0.08, 0.08, 3.2, kit.metal, i, 0, 0, 6);
    b.box(4.4, 0.2, 0.2, kit.metal, 0, 3.2, 0);
    b.collide('box', [0, 1.75, 0], [2.2, 1.75, 0.15]);
    return { w: 5, d: 1 };
  },
};

/** facade() at an offset, used where a building sits inside a larger composition. */
function facadeAt(b: Batch, kit: MaterialKit, w: number, h: number, d: number, opts: FacadeOptions, x: number, z: number): void {
  const inner = new Batch((b as unknown as { scene: Scene }).scene);
  facade(inner, kit, w, h, d, opts);
  const built = inner.finish('sub');
  for (const m of built.meshes) {
    m.position.x += x;
    m.position.z += z;
    b.extras.push(m);
  }
  built.root.dispose();
}

export function buildLandmark(scene: Scene, l: Landmark, kit: MaterialKit, lite = false): LandmarkBuild {
  const b = new Batch(scene);
  const build = BUILDERS[l.type] ?? ((bb: Batch, k: MaterialKit) => (facade(bb, k, 9, 5, 8, { roof: 'gable', wall: k.brick }), { w: 9, d: 8 }));
  const size = build(b, kit, scene);
  const { root, meshes } = b.finish(`landmark:${l.id}`);
  root.position.set(l.position[0], l.position[1], l.position[2]);
  root.rotation.y = l.rotationY ?? 0;
  const s = l.scale ?? 1;
  root.scaling.setAll(s);
  for (const m of meshes) {
    m.receiveShadows = !lite;
    m.isPickable = true;
  }
  const cos = Math.cos(l.rotationY ?? 0);
  const sin = Math.sin(l.rotationY ?? 0);
  const colliders = b.colliders.map((c) => ({
    ...c,
    center: [
      l.position[0] + (c.center[0] * cos + c.center[2] * sin) * s,
      l.position[1] + c.center[1] * s,
      l.position[2] + (-c.center[0] * sin + c.center[2] * cos) * s,
    ] as [number, number, number],
    halfExtents: [c.halfExtents[0] * s, c.halfExtents[1] * s, c.halfExtents[2] * s] as [number, number, number],
    rotationY: (l.rotationY ?? 0) + c.rotationY,
  }));
  return { object: root, colliders, footprint: { w: size.w, d: size.d }, lights: b.lights, meshes };
}
