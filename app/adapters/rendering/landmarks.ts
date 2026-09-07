import * as THREE from 'three/webgpu';
import { positionLocal, sin, time, vec3, positionWorld, normalWorld, texture as texNode, vec2, vec4, float, mix } from 'three/tsl';
import type { Landmark } from '@domain/district';
import { drawCanadianFlag } from './procedural/maple-leaf';
import type { AssetLibrary, LoadedModel, PbrTextureSet } from './asset-library';

export interface ColliderSpec {
  readonly kind: 'box' | 'cylinder';
  readonly center: [number, number, number];
  readonly halfExtents: [number, number, number]; // cylinder: [radius, halfHeight, radius]
  readonly rotationY: number;
}

export interface LandmarkBuild {
  readonly object: THREE.Object3D;
  readonly colliders: readonly ColliderSpec[];
  readonly footprint: { readonly w: number; readonly d: number };
  readonly lights: readonly THREE.Light[];
}

/** Materials resolved once per district from the asset library; procedural colours when textures are missing. */
export interface MaterialKit {
  readonly sandstone: THREE.Material;
  readonly darkStone: THREE.Material;
  readonly copper: THREE.Material;
  readonly wood: THREE.Material;
  readonly metal: THREE.Material;
  readonly glass: THREE.Material;
  readonly brick: THREE.Material;
  readonly plaster: THREE.Material;
  readonly concrete: THREE.Material;
  readonly roof: THREE.Material;
  readonly white: THREE.Material;
  readonly models: ReadonlyMap<string, LoadedModel>;
}

/** World-space tiling for box architecture: side projection blended with a top projection by the surface normal. */
function tiled(tex: PbrTextureSet, extra: Partial<THREE.MeshStandardNodeMaterialParameters> = {}): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0, ...extra });
  const p = positionWorld;
  const scale = 1 / tex.tileMeters;
  const uvSide = vec2(p.x.add(p.z), p.y).mul(scale);
  const uvTop = vec2(p.x, p.z).mul(scale);
  const upness = normalWorld.y.abs().smoothstep(0.6, 0.9);
  const col = mix(texNode(tex.map, uvSide).rgb, texNode(tex.map, uvTop).rgb, upness);
  m.colorNode = vec4(col, 1);
  if (tex.normalMap) {
    const n = mix(texNode(tex.normalMap, uvSide).rgb, texNode(tex.normalMap, uvTop).rgb, upness);
    m.normalNode = n.mul(2).sub(1).normalize();
  }
  if (tex.armMap) {
    const arm = mix(texNode(tex.armMap, uvSide).rgb, texNode(tex.armMap, uvTop).rgb, upness);
    m.roughnessNode = arm.g.max(extra.roughness !== undefined ? float(extra.roughness).mul(0.5) : float(0));
    m.metalnessNode = extra.metalness !== undefined ? float(extra.metalness) : arm.b;
    m.aoNode = arm.r;
  }
  return m;
}

export async function buildMaterialKit(lib: AssetLibrary | null, modelKeys: readonly string[]): Promise<MaterialKit> {
  const solid = (color: number, roughness: number, metalness = 0) => new THREE.MeshStandardNodeMaterial({ color, roughness, metalness });
  const tex = async (key: string, fallback: THREE.Material, extra?: Partial<THREE.MeshStandardNodeMaterialParameters>): Promise<THREE.Material> => {
    if (!lib?.hasTexture(key)) return fallback;
    try {
      return tiled(await lib.texture(key), extra);
    } catch {
      return fallback;
    }
  };
  const models = new Map<string, LoadedModel>();
  if (lib) {
    await Promise.all(
      modelKeys.filter((k) => lib.hasModel(k)).map(async (k) => {
        try {
          models.set(k, await lib.model(k));
        } catch {
          /* missing model: builder falls back */
        }
      }),
    );
  }
  const [sandstone, brick, plaster, concrete, roof, wood, metal, copper] = await Promise.all([
    tex('sandstone', solid(0xb9a98c, 0.85)),
    tex('brick', solid(0x8a4a3a, 0.9)),
    tex('plaster', solid(0xd9d2c3, 0.85)),
    tex('concrete', solid(0x9a9a96, 0.9)),
    tex('roof-grey', solid(0x55595e, 0.8)),
    tex('wood', solid(0x6b4a2b, 0.9)),
    tex('metal', solid(0x9aa0a6, 0.35, 0.8), { metalness: 0.8 }),
    tex('roof-copper', solid(0x4f8a72, 0.5, 0.35), { metalness: 0.4 }),
  ]);
  return {
    sandstone, brick, plaster, concrete, roof, wood, metal, copper,
    darkStone: solid(0x6f6a62, 0.9),
    glass: new THREE.MeshPhysicalNodeMaterial({ color: 0x8fb8d8, roughness: 0.08, metalness: 0.2, transmission: 0.35, thickness: 0.2, envMapIntensity: 1.2 }),
    white: solid(0xf1f1ee, 0.6),
    models,
  };
}

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

/** Place a library model (LOD0) at the origin of a group, scaled to a target height if given. */
function placeModel(kit: MaterialKit, key: string, targetHeight?: number): THREE.Object3D | null {
  const model = kit.models.get(key);
  if (!model) return null;
  const clone = model.lods[0]!.clone(true);
  clone.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box3.getSize(size);
  if (targetHeight && size.y > 0) clone.scale.setScalar(targetHeight / size.y);
  clone.position.y = -box3.min.y * clone.scale.y;
  clone.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return clone;
}

/**
 * Gothic-revival facade: recessed windows with stone surrounds, string courses, a pitched copper roof with
 * dormers and finials. Windows are instanced boxes; recesses come from an inset dark panel behind the glass.
 */
function facade(kit: MaterialKit, w: number, h: number, d: number, opts: { roof: 'copper' | 'flat' | 'gable' | 'dome' | 'mansard'; windows?: boolean; wall?: THREE.Material; arches?: boolean }): { g: THREE.Group; colliders: ColliderSpec[] } {
  const g = new THREE.Group();
  const wall = opts.wall ?? kit.sandstone;
  g.add(box(w, h, d, wall));
  // plinth + cornice
  g.add(box(w + 0.6, 0.9, d + 0.6, kit.darkStone, 0, 0, 0));
  g.add(box(w + 0.5, 0.35, d + 0.5, kit.darkStone, 0, h - 0.35, 0));
  if (opts.windows !== false) {
    const rows = Math.max(1, Math.floor((h - 2.5) / 3.4));
    const colsN = Math.max(1, Math.floor(w / 3.2));
    const glassGeo = new THREE.BoxGeometry(1.25, 2.2, 0.08);
    const frameGeo = new THREE.BoxGeometry(1.65, 2.7, 0.35);
    const sillGeo = new THREE.BoxGeometry(1.8, 0.16, 0.5);
    const count = rows * colsN * 2;
    const glass = new THREE.InstancedMesh(glassGeo, kit.glass, count);
    const frame = new THREE.InstancedMesh(frameGeo, kit.darkStone, count);
    const sill = new THREE.InstancedMesh(sillGeo, kit.darkStone, count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < colsN; c++) {
        const x = -w / 2 + (c + 0.5) * (w / colsN);
        const y = 2.4 + r * 3.4;
        for (const sz of [1, -1]) {
          m.makeTranslation(x, y, sz * (d / 2 - 0.1));
          frame.setMatrixAt(i, m);
          m.makeTranslation(x, y, sz * (d / 2 + 0.12));
          glass.setMatrixAt(i, m);
          m.makeTranslation(x, y - 1.4, sz * (d / 2 + 0.2));
          sill.setMatrixAt(i, m);
          i++;
        }
      }
    }
    frame.castShadow = glass.castShadow = false;
    g.add(frame, glass, sill);
    if (opts.arches) {
      // arched entrance
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.2, 24, 1, false, 0, Math.PI), kit.darkStone);
      arch.rotation.z = Math.PI / 2;
      arch.rotation.y = Math.PI / 2;
      arch.position.set(0, 4.2, d / 2 + 0.2);
      g.add(arch);
      const door = box(3.4, 4.2, 0.3, kit.wood, 0, 0, d / 2 + 0.25);
      g.add(door);
    }
  }
  const colliders: ColliderSpec[] = [{ kind: 'box', center: [0, h / 2, 0], halfExtents: [w / 2 + 0.3, h / 2, d / 2 + 0.3], rotationY: 0 }];
  switch (opts.roof) {
    case 'copper':
    case 'gable': {
      const mat = opts.roof === 'copper' ? kit.copper : kit.roof;
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, d * 0.72, w + 0.8, 4, 1), mat);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1, 1, 0.55);
      roof.position.y = h + d * 0.36 * 0.55 + 0.1;
      roof.castShadow = true;
      g.add(roof);
      // dormers
      const n = Math.max(1, Math.floor(w / 6));
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + (k + 0.5) * (w / n);
        for (const sz of [1, -1]) {
          const dm = box(1.4, 1.6, 1.2, kit.sandstone, x, h + 0.6, sz * (d * 0.28));
          g.add(dm);
          const dr = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.0, 4), mat);
          dr.rotation.y = Math.PI / 4;
          dr.position.set(x, h + 2.7, sz * (d * 0.28));
          g.add(dr);
        }
      }
      break;
    }
    case 'mansard': {
      g.add(box(w * 0.9, 2.2, d * 0.9, kit.roof, 0, h));
      g.add(box(w * 0.7, 0.6, d * 0.7, kit.roof, 0, h + 2.2));
      break;
    }
    case 'dome': {
      const drum = cyl(Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 2.2, kit.sandstone, 0, h, 0, 24);
      g.add(drum);
      const dm = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.36, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), kit.copper);
      dm.position.y = h + 2.2;
      dm.castShadow = true;
      g.add(dm);
      break;
    }
    default:
      g.add(box(w * 1.02, 0.5, d * 1.02, kit.roof, 0, h));
  }
  return { g, colliders };
}

function parliament(kit: MaterialKit): LandmarkBuild {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const centre = facade(kit, 46, 15, 15, { roof: 'copper', arches: true });
  g.add(centre.g);
  colliders.push(...centre.colliders);
  for (const sx of [-1, 1]) {
    const wing = facade(kit, 15, 13, 24, { roof: 'copper' });
    wing.g.position.set(sx * 30.5, 0, -4.5);
    g.add(wing.g);
    colliders.push({ kind: 'box', center: [sx * 30.5, 6.5, -4.5], halfExtents: [7.8, 6.5, 12.3], rotationY: 0 });
    // corner turrets
    const turret = cyl(1.6, 1.8, 18, kit.sandstone, sx * 38.5, 0, 8, 12);
    g.add(turret);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.5, 12), kit.copper);
    cap.position.set(sx * 38.5, 20.2, 8);
    cap.castShadow = true;
    g.add(cap);
  }
  // Peace Tower: shaft, clock stage, belfry, steep copper spire, finial.
  const tower = box(7.2, 44, 7.2, kit.sandstone, 0, 0, 9.5);
  g.add(tower);
  for (const yy of [12, 24, 36]) g.add(box(7.8, 0.4, 7.8, kit.darkStone, 0, yy, 9.5));
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), kit.white);
    clockFace.position.set(dx * 3.65, 37.5, 9.5 + dz * 3.65);
    clockFace.rotation.y = dx !== 0 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;
    g.add(clockFace);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.15, 8, 32), kit.copper);
    rim.position.copy(clockFace.position);
    rim.rotation.copy(clockFace.rotation);
    g.add(rim);
  }
  const belfry = box(6.2, 5, 6.2, kit.sandstone, 0, 44, 9.5);
  g.add(belfry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.35, 0.35, 5, kit.darkStone, sx * 2.6, 44, 9.5 + sz * 2.6, 8));
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.6, 14, 4), kit.copper);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, 56, 9.5);
  spire.castShadow = true;
  g.add(spire);
  g.add(cyl(0.08, 0.08, 4, kit.metal, 0, 63, 9.5, 6));
  colliders.push({ kind: 'box', center: [0, 22, 9.5], halfExtents: [3.9, 22, 3.9], rotationY: 0 });
  // Steps and forecourt
  for (let i = 0; i < 5; i++) g.add(box(24 - i * 2, 0.32, 2.2, kit.darkStone, 0, i * 0.32, 15.5 - i * 0.8));
  colliders.push({ kind: 'box', center: [0, 0.8, 14.2], halfExtents: [12, 0.8, 2.2], rotationY: 0 });
  return { object: g, colliders, footprint: { w: 84, d: 46 }, lights: [] };
}

function flame(kit: MaterialKit): LandmarkBuild {
  const g = new THREE.Group();
  g.add(cyl(3.4, 3.8, 0.5, kit.darkStone, 0, 0, 0, 32));
  g.add(cyl(1.5, 1.9, 0.9, kit.sandstone, 0, 0.5, 0, 24));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 32), new THREE.MeshPhysicalNodeMaterial({ color: 0x2b5f7a, roughness: 0.05, metalness: 0.1, transmission: 0.2 }));
  water.position.y = 0.45;
  g.add(water);
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 12), flameMat);
  f.position.y = 2.1;
  flameMat.positionNode = positionLocal.add(vec3(sin(time.mul(9).add(positionLocal.y.mul(6))).mul(0.06), 0, sin(time.mul(7)).mul(0.05)));
  g.add(f);
  const light = new THREE.PointLight(0xff8a2a, 40, 18, 2);
  light.position.set(0, 2.4, 0);
  g.add(light);
  return { object: g, colliders: [{ kind: 'cylinder', center: [0, 0.7, 0], halfExtents: [1.9, 0.7, 1.9], rotationY: 0 }], footprint: { w: 8, d: 8 }, lights: [light] };
}

function flagpole(kit: MaterialKit): LandmarkBuild {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.11, 9, kit.metal, 0, 0, 0, 12));
  g.add(cyl(0.5, 0.6, 0.4, kit.darkStone, 0, 0, 0, 16));
  flagTexture ??= new THREE.CanvasTexture(drawCanadianFlag(1024, 512));
  flagTexture.colorSpace = THREE.SRGBColorSpace;
  flagTexture.anisotropy = 8;
  const mat = new THREE.MeshStandardNodeMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 0.85 });
  const wave = sin(positionLocal.x.mul(3.0).add(time.mul(4.5))).mul(positionLocal.x.mul(0.09));
  mat.positionNode = positionLocal.add(vec3(0, wave.mul(0.35), wave));
  const geo = new THREE.PlaneGeometry(2.4, 1.2, 24, 10).translate(1.2, 0, 0);
  const flag = new THREE.Mesh(geo, mat);
  flag.position.set(0.1, 8.3, 0);
  flag.castShadow = true;
  g.add(flag);
  return { object: g, colliders: [{ kind: 'cylinder', center: [0, 4.5, 0], halfExtents: [0.15, 4.5, 0.15], rotationY: 0 }], footprint: { w: 1, d: 1 }, lights: [] };
}

function lamp(kit: MaterialKit): LandmarkBuild {
  const g = new THREE.Group();
  const post = cyl(0.06, 0.1, 3.6, kit.metal, 0, 0, 0, 10);
  g.add(post);
  g.add(cyl(0.16, 0.18, 0.4, kit.metal, 0, 0, 0, 10));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 8), kit.metal);
  head.position.y = 3.9;
  g.add(head);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), bulbMat);
  bulb.position.y = 3.65;
  g.add(bulb);
  const light = new THREE.PointLight(0xffdca0, 14, 12, 2);
  light.position.y = 3.5;
  light.name = 'lamp-light';
  g.add(light);
  return { object: g, colliders: [], footprint: { w: 1, d: 1 }, lights: [light] };
}

function bench(kit: MaterialKit): LandmarkBuild {
  const model = placeModel(kit, 'bench-wood', 0.95) ?? placeModel(kit, 'bench-street', 0.9);
  const g = new THREE.Group();
  if (model) g.add(model);
  else {
    g.add(box(1.8, 0.08, 0.5, kit.wood, 0, 0.45, 0));
    g.add(box(1.8, 0.5, 0.06, kit.wood, 0, 0.5, -0.24));
    for (const sx of [-0.8, 0.8]) g.add(box(0.08, 0.45, 0.5, kit.metal, sx, 0, 0));
  }
  return { object: g, colliders: [{ kind: 'box', center: [0, 0.4, 0], halfExtents: [0.9, 0.4, 0.3], rotationY: 0 }], footprint: { w: 2, d: 1 }, lights: [] };
}

function station(kit: MaterialKit): LandmarkBuild {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  g.add(box(18, 0.6, 6, kit.concrete, 0, 0, 0));
  colliders.push({ kind: 'box', center: [0, 0.3, 0], halfExtents: [9, 0.3, 3], rotationY: 0 });
  for (const sx of [-7, -2.3, 2.3, 7]) g.add(cyl(0.14, 0.14, 4, kit.metal, sx, 0.6, -2.5, 8));
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 4, 19, 4, 1), kit.copper);
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 4;
  canopy.scale.set(1, 1, 0.35);
  canopy.position.set(0, 5.4, -0.5);
  g.add(canopy);
  const hall = facade(kit, 11, 5.5, 6.5, { roof: 'gable', wall: kit.brick, arches: true });
  hall.g.position.set(0, 0, -8);
  g.add(hall.g);
  colliders.push({ kind: 'box', center: [0, 2.75, -8], halfExtents: [5.8, 2.75, 3.5], rotationY: 0 });
  // Rails
  for (const dz of [3.9, 5.1]) g.add(box(30, 0.12, 0.12, kit.metal, 0, 0, dz));
  // Train (VIA-style livery)
  const train = new THREE.Group();
  train.add(box(16, 2.8, 2.7, kit.metal, 0, 0.6, 0));
  train.add(box(16.2, 0.9, 2.75, redPaint, 0, 1.7, 0));
  train.add(box(16.4, 0.3, 2.9, kit.roof, 0, 3.4, 0));
  for (let i = -6.5; i <= 6.5; i += 2.2) for (const sz of [1, -1]) train.add(box(1.3, 1.0, 0.06, kit.glass, i, 2.15, sz * 1.38));
  for (const x of [-5.5, -2.5, 2.5, 5.5]) {
    for (const sz of [-1, 1]) {
      const w = cyl(0.5, 0.5, 0.25, kit.darkStone, x, 0, 0, 14);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.5, sz * 1.25);
      train.add(w);
    }
  }
  train.position.set(0, 0, 4.5);
  g.add(train);
  colliders.push({ kind: 'box', center: [0, 1.9, 4.5], halfExtents: [8, 1.9, 1.45], rotationY: 0 });
  return { object: g, colliders, footprint: { w: 22, d: 22 }, lights: [] };
}

function locks(kit: MaterialKit): LandmarkBuild {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  for (let i = 0; i < 4; i++) {
    g.add(box(6, 1.2 + i * 0.4, 1.2, kit.darkStone, 0, 0, -i * 5));
    colliders.push({ kind: 'box', center: [0, 0.8, -i * 5], halfExtents: [3, 0.8, 0.6], rotationY: 0 });
    for (const sx of [-4, 4]) g.add(box(0.5, 0.5, 4, kit.wood, sx, 1.2 + i * 0.4, -i * 5));
  }
  const pier = placeModel(kit, 'pier');
  if (pier) {
    pier.position.set(6, 0, -6);
    g.add(pier);
  }
  return { object: g, colliders, footprint: { w: 12, d: 22 }, lights: [] };
}

function prop(kit: MaterialKit, key: string, height: number, fallback: () => THREE.Object3D, footprint: number, collider?: ColliderSpec): (k: MaterialKit) => LandmarkBuild {
  return () => {
    const obj = placeModel(kit, key, height) ?? fallback();
    const g = new THREE.Group();
    g.add(obj);
    return { object: g, colliders: collider ? [collider] : [], footprint: { w: footprint, d: footprint }, lights: [] };
  };
}

function generic(kit: MaterialKit, type: string): LandmarkBuild {
  const table: Record<string, () => { g: THREE.Group; colliders: ColliderSpec[]; w: number; d: number }> = {
    courthouse: () => ({ ...facade(kit, 24, 12, 15, { roof: 'dome', arches: true }), w: 24, d: 15 }),
    legislature: () => ({ ...facade(kit, 32, 13, 17, { roof: 'dome', arches: true }), w: 32, d: 17 }),
    supremecourt: () => ({ ...facade(kit, 28, 15, 17, { roof: 'copper', wall: kit.concrete }), w: 28, d: 17 }),
    pollingstation: () => ({ ...facade(kit, 15, 5.5, 11, { roof: 'gable', wall: kit.brick, arches: true }), w: 15, d: 11 }),
    arena: () => ({ ...facade(kit, 32, 12, 24, { roof: 'flat', wall: kit.metal, windows: false }), w: 32, d: 24 }),
    fort: () => {
      const model = placeModel(kit, 'fort', 7);
      if (model) return { g: new THREE.Group().add(model), colliders: [{ kind: 'box', center: [0, 3.5, 0], halfExtents: [10, 3.5, 10], rotationY: 0 }], w: 22, d: 22 };
      return { ...facade(kit, 24, 6, 24, { roof: 'flat', wall: kit.wood, windows: false }), w: 24, d: 24 };
    },
    port: () => ({ ...facade(kit, 20, 8, 12, { roof: 'flat', wall: kit.concrete }), w: 20, d: 12 }),
    rink: () => ({ ...facade(kit, 26, 1, 15, { roof: 'flat', wall: kit.white, windows: false }), w: 26, d: 15 }),
    apartments: () => {
      const model = placeModel(kit, 'facade-apartments', 14);
      if (model) return { g: new THREE.Group().add(model), colliders: [{ kind: 'box', center: [0, 7, 0], halfExtents: [8, 7, 3], rotationY: 0 }], w: 16, d: 6 };
      return { ...facade(kit, 16, 14, 10, { roof: 'flat', wall: kit.brick }), w: 16, d: 10 };
    },
    factory: () => {
      const model = placeModel(kit, 'facade-factory', 10);
      if (model) return { g: new THREE.Group().add(model), colliders: [{ kind: 'box', center: [0, 5, 0], halfExtents: [8, 5, 3], rotationY: 0 }], w: 16, d: 6 };
      return { ...facade(kit, 18, 9, 12, { roof: 'flat', wall: kit.brick }), w: 18, d: 12 };
    },
    circle: () => {
      const g = new THREE.Group();
      const colliders: ColliderSpec[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rock = placeModel(kit, ['rock-boulder', 'rock-2', 'rock-3'][i % 3]!, 1.2 + (i % 3) * 0.3);
        const s = rock ?? cyl(0.5, 0.7, 1.2 + (i % 3) * 0.4, kit.darkStone, 0, 0, 0, 8);
        s.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6);
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
      g.add(box(6, 0.4, 6, kit.wood, 0, 4));
      for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) g.add(cyl(0.15, 0.15, 4, kit.wood, x, 0, z, 8));
      g.add(box(6, 0.3, 6, kit.copper, 0, 7.4));
      return { g, colliders: [{ kind: 'box', center: [0, 2.2, 0], halfExtents: [3, 2.2, 3], rotationY: 0 }], w: 7, d: 7 };
    },
  };
  const make = table[type] ?? (() => ({ ...facade(kit, 9, 5, 8, { roof: 'gable', wall: kit.brick }), w: 9, d: 8 }));
  const r = make();
  return { object: r.g, colliders: r.colliders, footprint: { w: r.w, d: r.d }, lights: [] };
}

export const LANDMARK_MODEL_KEYS = ['bench-wood', 'bench-street', 'pier', 'fort', 'facade-apartments', 'facade-factory', 'rock-boulder', 'rock-2', 'rock-3', 'hydrant', 'power-pole', 'utility-box', 'barrier', 'iron-gate'] as const;

export function buildLandmark(l: Landmark, kit: MaterialKit): LandmarkBuild {
  const builders: Record<string, (k: MaterialKit) => LandmarkBuild> = {
    parliament, flame, flagpole, lamp, bench, station, locks,
    hydrant: prop(kit, 'hydrant', 0.9, () => cyl(0.15, 0.18, 0.9, redPaint, 0, 0, 0, 10), 1, { kind: 'cylinder', center: [0, 0.45, 0], halfExtents: [0.2, 0.45, 0.2], rotationY: 0 }),
    'power-pole': prop(kit, 'power-pole', 9, () => cyl(0.12, 0.16, 9, kit.wood, 0, 0, 0, 8), 1, { kind: 'cylinder', center: [0, 4.5, 0], halfExtents: [0.2, 4.5, 0.2], rotationY: 0 }),
    'utility-box': prop(kit, 'utility-box', 1.4, () => box(0.8, 1.4, 0.5, kit.metal), 1, { kind: 'box', center: [0, 0.7, 0], halfExtents: [0.4, 0.7, 0.25], rotationY: 0 }),
    barrier: prop(kit, 'barrier', 0.8, () => box(2, 0.8, 0.5, kit.concrete), 2, { kind: 'box', center: [0, 0.4, 0], halfExtents: [1, 0.4, 0.25], rotationY: 0 }),
    gate: prop(kit, 'iron-gate', 3.5, () => box(4, 3.5, 0.2, kit.metal), 4, { kind: 'box', center: [0, 1.75, 0], halfExtents: [2, 1.75, 0.1], rotationY: 0 }),
  };
  const b = (builders[l.type] ?? ((k: MaterialKit) => generic(k, l.type)))(kit);
  b.object.position.set(l.position[0], l.position[1], l.position[2]);
  b.object.rotation.y = l.rotationY ?? 0;
  const s = l.scale ?? 1;
  b.object.scale.setScalar(s);
  b.object.name = `landmark:${l.id}`;
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
