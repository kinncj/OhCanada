import * as THREE from 'three/webgpu';
import { positionLocal, sin, time, vec3 } from 'three/tsl';
import type { Landmark } from '@domain/district';
import { drawCanadianFlag } from './procedural/maple-leaf';

export interface ColliderSpec {
  readonly kind: 'box' | 'cylinder';
  readonly center: [number, number, number];
  readonly halfExtents: [number, number, number]; // cylinder: [radius, halfHeight, radius]
  readonly rotationY: number;
}

export interface LandmarkBuild {
  readonly object: THREE.Object3D;
  readonly colliders: readonly ColliderSpec[];
  /** Footprint used to keep vegetation away. */
  readonly footprint: { readonly w: number; readonly d: number };
  readonly lights: readonly THREE.Light[];
}

const stone = new THREE.MeshStandardNodeMaterial({ color: 0xb9a98c, roughness: 0.85 });
const darkStone = new THREE.MeshStandardNodeMaterial({ color: 0x7d7468, roughness: 0.9 });
const copper = new THREE.MeshStandardNodeMaterial({ color: 0x4f8a72, roughness: 0.5, metalness: 0.35 });
const wood = new THREE.MeshStandardNodeMaterial({ color: 0x6b4a2b, roughness: 0.9 });
const metal = new THREE.MeshStandardNodeMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 });
const glass = new THREE.MeshStandardNodeMaterial({ color: 0x9fc6e8, roughness: 0.1, metalness: 0.6 });
const brick = new THREE.MeshStandardNodeMaterial({ color: 0x8a4a3a, roughness: 0.9 });
const white = new THREE.MeshStandardNodeMaterial({ color: 0xf1f1ee, roughness: 0.6 });
const flameMat = new THREE.MeshStandardNodeMaterial({ color: 0xff9a2a, emissive: 0xff6a00, emissiveIntensity: 3.5, roughness: 0.4 });
const bulbMat = new THREE.MeshStandardNodeMaterial({ color: 0xfff3c4, emissive: 0xffe2a0, emissiveIntensity: 2.2 });
const redPaint = new THREE.MeshStandardNodeMaterial({ color: 0xc8102e, roughness: 0.5, metalness: 0.2 });
let flagTexture: THREE.CanvasTexture | null = null;

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function building(w: number, h: number, d: number, mat: THREE.Material, roof: 'flat' | 'gable' | 'copper' | 'dome', windows = true): { g: THREE.Group; colliders: ColliderSpec[] } {
  const g = new THREE.Group();
  g.add(box(w, h, d, mat));
  if (windows) {
    const rows = Math.max(1, Math.floor(h / 3.2));
    const colsN = Math.max(1, Math.floor(w / 3));
    const winGeo = new THREE.BoxGeometry(1.2, 1.8, 0.1);
    const inst = new THREE.InstancedMesh(winGeo, glass, rows * colsN * 2);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < colsN; c++) {
        const x = -w / 2 + (c + 0.5) * (w / colsN);
        const y = 2 + r * 3.2;
        m.makeTranslation(x, y, d / 2 + 0.02);
        inst.setMatrixAt(i++, m);
        m.makeTranslation(x, y, -d / 2 - 0.02);
        inst.setMatrixAt(i++, m);
      }
    }
    g.add(inst);
  }
  if (roof === 'gable') {
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.35, 4), copper);
    r.rotation.y = Math.PI / 4;
    r.position.y = h + h * 0.175;
    r.castShadow = true;
    g.add(r);
  } else if (roof === 'copper') {
    const r = box(w * 1.04, 0.8, d * 1.04, copper, 0, h);
    g.add(r);
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, d * 0.5, w, 4), copper);
    ridge.rotation.z = Math.PI / 2;
    ridge.rotation.y = Math.PI / 4;
    ridge.position.y = h + 0.8 + d * 0.25;
    ridge.scale.set(1, 1, 0.5);
    g.add(ridge);
  } else if (roof === 'dome') {
    const dm = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), copper);
    dm.position.y = h;
    dm.castShadow = true;
    g.add(dm);
  }
  return { g, colliders: [{ kind: 'box', center: [0, h / 2, 0], halfExtents: [w / 2, h / 2, d / 2], rotationY: 0 }] };
}

function parliament(): LandmarkBuild {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const centre = building(44, 14, 14, stone, 'copper');
  g.add(centre.g);
  colliders.push(...centre.colliders);
  for (const sx of [-1, 1]) {
    const wing = building(14, 12, 22, stone, 'copper');
    wing.g.position.set(sx * 29, 0, -4);
    g.add(wing.g);
    colliders.push({ kind: 'box', center: [sx * 29, 6, -4], halfExtents: [7, 6, 11], rotationY: 0 });
  }
  // Peace Tower
  const tower = box(7, 46, 7, stone, 0, 0, 9);
  g.add(tower);
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), white);
  clockFace.position.set(0, 36, 12.6);
  g.add(clockFace);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.2, 12, 4), copper);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, 52, 9);
  spire.castShadow = true;
  g.add(spire);
  colliders.push({ kind: 'box', center: [0, 23, 9], halfExtents: [3.5, 23, 3.5], rotationY: 0 });
  // Steps
  for (let i = 0; i < 4; i++) g.add(box(20 - i * 2, 0.35, 2.5, darkStone, 0, i * 0.35, 14.5 + i * -0.6));
  colliders.push({ kind: 'box', center: [0, 0.7, 14], halfExtents: [10, 0.7, 1.5], rotationY: 0 });
  return { object: g, colliders, footprint: { w: 78, d: 40 }, lights: [] };
}

function flame(): LandmarkBuild {
  const g = new THREE.Group();
  g.add(cyl(3.2, 3.6, 0.5, darkStone, 0, 0, 0, 24));
  g.add(cyl(1.4, 1.8, 0.9, stone, 0, 0.5, 0, 16));
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 10), flameMat);
  f.position.y = 2.1;
  (flameMat as THREE.MeshStandardNodeMaterial).positionNode = positionLocal.add(vec3(sin(time.mul(9).add(positionLocal.y.mul(6))).mul(0.06), 0, sin(time.mul(7)).mul(0.05)));
  g.add(f);
  const light = new THREE.PointLight(0xff8a2a, 40, 18, 2);
  light.position.set(0, 2.4, 0);
  g.add(light);
  return { object: g, colliders: [{ kind: 'cylinder', center: [0, 0.7, 0], halfExtents: [1.8, 0.7, 1.8], rotationY: 0 }], footprint: { w: 8, d: 8 }, lights: [light] };
}

function flagpole(): LandmarkBuild {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.11, 9, metal, 0, 0, 0, 10));
  flagTexture ??= new THREE.CanvasTexture(drawCanadianFlag());
  flagTexture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardNodeMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 0.8 });
  const wave = sin(positionLocal.x.mul(3.0).add(time.mul(4.5))).mul(positionLocal.x.mul(0.09));
  mat.positionNode = positionLocal.add(vec3(0, wave.mul(0.35), wave));
  const geo = new THREE.PlaneGeometry(2.4, 1.2, 20, 8).translate(1.2, 0, 0);
  const flag = new THREE.Mesh(geo, mat);
  flag.position.set(0.1, 8.3, 0);
  flag.castShadow = true;
  g.add(flag);
  return { object: g, colliders: [{ kind: 'cylinder', center: [0, 4.5, 0], halfExtents: [0.15, 4.5, 0.15], rotationY: 0 }], footprint: { w: 1, d: 1 }, lights: [] };
}

function lamp(): LandmarkBuild {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.1, 3.4, metal, 0, 0, 0, 8));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), bulbMat);
  bulb.position.y = 3.55;
  g.add(bulb);
  const light = new THREE.PointLight(0xffdca0, 14, 12, 2);
  light.position.y = 3.5;
  light.name = 'lamp-light';
  g.add(light);
  return { object: g, colliders: [], footprint: { w: 1, d: 1 }, lights: [light] };
}

function bench(): LandmarkBuild {
  const g = new THREE.Group();
  g.add(box(1.8, 0.08, 0.5, wood, 0, 0.45, 0));
  g.add(box(1.8, 0.5, 0.06, wood, 0, 0.5, -0.24));
  for (const sx of [-0.8, 0.8]) g.add(box(0.08, 0.45, 0.5, metal, sx, 0, 0));
  return { object: g, colliders: [{ kind: 'box', center: [0, 0.4, 0], halfExtents: [0.9, 0.4, 0.3], rotationY: 0 }], footprint: { w: 2, d: 1 }, lights: [] };
}

function station(): LandmarkBuild {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  g.add(box(16, 0.6, 6, darkStone, 0, 0, 0));
  colliders.push({ kind: 'box', center: [0, 0.3, 0], halfExtents: [8, 0.3, 3], rotationY: 0 });
  for (const sx of [-6.5, 0, 6.5]) g.add(cyl(0.15, 0.15, 4, metal, sx, 0.6, -2.5, 8));
  g.add(box(17, 0.3, 7, copper, 0, 4.6, -0.5));
  const hall = building(10, 5, 6, brick, 'gable');
  hall.g.position.set(0, 0, -7);
  g.add(hall.g);
  colliders.push({ kind: 'box', center: [0, 2.5, -7], halfExtents: [5, 2.5, 3], rotationY: 0 });
  // Train
  const train = new THREE.Group();
  train.add(box(14, 2.6, 2.6, redPaint, 0, 0.6, 0));
  train.add(box(14.2, 0.3, 2.8, metal, 0, 3.2, 0));
  for (let i = -5; i <= 5; i += 2.5) train.add(box(1.2, 1.0, 0.1, glass, i, 1.6, 1.35));
  for (const x of [-5, -2, 2, 5]) {
    const w = cyl(0.5, 0.5, 0.3, metal, x, 0, 1.2, 12);
    w.rotation.x = Math.PI / 2;
    w.position.y = 0.5;
    train.add(w);
  }
  train.position.set(0, 0, 4.5);
  g.add(train);
  colliders.push({ kind: 'box', center: [0, 1.9, 4.5], halfExtents: [7, 1.9, 1.4], rotationY: 0 });
  return { object: g, colliders, footprint: { w: 20, d: 20 }, lights: [] };
}

function locks(): LandmarkBuild {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  for (let i = 0; i < 4; i++) {
    g.add(box(6, 1.2 + i * 0.4, 1.2, darkStone, 0, 0, -i * 5));
    colliders.push({ kind: 'box', center: [0, 0.8, -i * 5], halfExtents: [3, 0.8, 0.6], rotationY: 0 });
    for (const sx of [-4, 4]) g.add(box(0.5, 0.5, 4, wood, sx, 1.2 + i * 0.4, -i * 5));
  }
  return { object: g, colliders, footprint: { w: 10, d: 22 }, lights: [] };
}

function generic(type: string): LandmarkBuild {
  const table: Record<string, () => { g: THREE.Group; colliders: ColliderSpec[]; w: number; d: number }> = {
    courthouse: () => ({ ...building(22, 11, 14, stone, 'dome'), w: 22, d: 14 }),
    legislature: () => ({ ...building(30, 12, 16, stone, 'dome'), w: 30, d: 16 }),
    supremecourt: () => ({ ...building(26, 14, 16, darkStone, 'copper'), w: 26, d: 16 }),
    pollingstation: () => ({ ...building(14, 5, 10, brick, 'gable'), w: 14, d: 10 }),
    arena: () => ({ ...building(30, 12, 22, metal, 'dome', false), w: 30, d: 22 }),
    fort: () => ({ ...building(24, 6, 24, wood, 'flat', false), w: 24, d: 24 }),
    port: () => ({ ...building(18, 8, 10, metal, 'flat'), w: 18, d: 10 }),
    rink: () => ({ ...building(24, 1, 14, white, 'flat', false), w: 24, d: 14 }),
    circle: () => {
      const g = new THREE.Group();
      const colliders: ColliderSpec[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const s = cyl(0.5, 0.7, 1.2 + (i % 3) * 0.4, darkStone, Math.cos(a) * 6, 0, Math.sin(a) * 6, 8);
        g.add(s);
        colliders.push({ kind: 'cylinder', center: [Math.cos(a) * 6, 0.8, Math.sin(a) * 6], halfExtents: [0.6, 0.8, 0.6], rotationY: 0 });
      }
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), flameMat);
      fire.position.y = 0.8;
      g.add(fire);
      return { g, colliders, w: 14, d: 14 };
    },
    lookout: () => {
      const g = new THREE.Group();
      g.add(box(6, 0.4, 6, wood, 0, 4));
      for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) g.add(cyl(0.15, 0.15, 4, wood, x, 0, z, 8));
      g.add(box(6, 0.3, 6, copper, 0, 7.4));
      return { g, colliders: [{ kind: 'box', center: [0, 2.2, 0], halfExtents: [3, 2.2, 3], rotationY: 0 }], w: 7, d: 7 };
    },
  };
  const make = table[type] ?? (() => ({ ...building(8, 4, 8, brick, 'gable'), w: 8, d: 8 }));
  const r = make();
  return { object: r.g, colliders: r.colliders, footprint: { w: r.w, d: r.d }, lights: [] };
}

const BUILDERS: Record<string, () => LandmarkBuild> = { parliament, flame, flagpole, lamp, bench, station, locks };

export function buildLandmark(l: Landmark): LandmarkBuild {
  const b = (BUILDERS[l.type] ?? (() => generic(l.type)))();
  b.object.position.set(l.position[0], l.position[1], l.position[2]);
  b.object.rotation.y = l.rotationY ?? 0;
  const s = l.scale ?? 1;
  b.object.scale.setScalar(s);
  b.object.name = `landmark:${l.id}`;
  // Transform collider centres into world space.
  const cos = Math.cos(l.rotationY ?? 0);
  const sin = Math.sin(l.rotationY ?? 0);
  const colliders = b.colliders.map((c) => ({
    ...c,
    center: [l.position[0] + (c.center[0] * cos + c.center[2] * sin) * s, l.position[1] + c.center[1] * s, l.position[2] + (-c.center[0] * sin + c.center[2] * cos) * s] as [number, number, number],
    halfExtents: [c.halfExtents[0] * s, c.halfExtents[1] * s, c.halfExtents[2] * s] as [number, number, number],
    rotationY: (l.rotationY ?? 0) + c.rotationY,
  }));
  return { ...b, colliders };
}
