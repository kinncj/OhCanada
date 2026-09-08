import * as THREE from 'three/webgpu';
import type { District } from '@domain/district';
import type { GraphicsPreset } from '@application/ports';
import { hashString } from '@common/rng';
import { makeHeightFunction, type HeightFn } from './procedural/noise';
import { buildTerrain, type TerrainBuild, type TerrainTextures } from './terrain';
import { buildWater } from './water';
import { KIND_MODELS, Vegetation, protoFromModel, type VegetationKind } from './vegetation';
import { buildLandmark, buildMaterialKit, LANDMARK_MODEL_KEYS, PROCEDURAL_TYPES, type ColliderSpec, type MaterialKit } from './landmarks';
import type { AssetLibrary } from './asset-library';
import { FaunaSystem } from './fauna';

export interface Marker {
  readonly id: string;
  readonly object: THREE.Object3D;
}

/**
 * One streamed district: terrain (+ physics heights), water, chunked vegetation, landmarks (+ colliders),
 * trigger markers. Real assets come from the AssetLibrary; every builder degrades to procedural geometry when
 * a model/texture is missing so the game always runs.
 */
export class WorldScene {
  readonly group = new THREE.Group();
  readonly colliders: ColliderSpec[] = [];
  readonly occluders: THREE.Object3D[] = [];
  readonly markers: Marker[] = [];
  readonly lights: THREE.Light[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  fauna: FaunaSystem | null = null;
  /** Objects added a few per frame after the loading screen hides: turns one long shader-compile freeze into a fill-in. */
  readonly pending: THREE.Object3D[] = [];
  /** Distance-culled landmarks: big silhouettes stay visible far away, street furniture drops out early. */
  private readonly culled: { obj: THREE.Object3D; pos: THREE.Vector3; range: number }[] = [];
  drawDistance = 400;
  private hydrationBudget = 2;

  private constructor(
    readonly district: District,
    readonly heightAt: HeightFn,
    readonly terrain: TerrainBuild,
    private readonly vegetation: Vegetation,
  ) {}

  static async create(district: District, preset: GraphicsPreset, library: AssetLibrary | null, onProgress?: (f: number, stage?: string) => void): Promise<WorldScene> {
    const s = district.scene;
    const flatSpots = s.landmarks.map((l) => ({ x: l.position[0], z: l.position[2], r: 18 }));
    for (const t of district.triggers) flatSpots.push({ x: t.position[0], z: t.position[2], r: t.radius + 4 });
    for (const n of district.npcs) flatSpots.push({ x: n.position[0], z: n.position[2], r: (n.wanderRadius ?? 2) + 3 });
    for (const w of s.water ?? []) flatSpots.push({ x: w.position[0], z: w.position[2], r: Math.max(w.size[0], w.size[1]) * 0.6 });
    const heightAt = makeHeightFunction({ seed: s.seed ^ hashString(district.id), amplitude: s.terrain.amplitude, frequency: s.terrain.frequency, size: s.size, flatRadius: 40, flatSpots });

    // Textures + models load in parallel while the terrain mesh is computed.
    const snow = s.terrain.snow ?? false;
    const texKeys = ['grass', 'forest-floor', 'rock', 'snow', 'cobble'];
    const policy = preset.assetPolicy ?? 'full';
    // lite (CI / weak devices): characters only — untextured terrain and architecture keep shader compiles minimal.
    const texPromise = policy !== 'lite' && library && library.hasTexture('grass') && library.hasTexture('forest-floor') && library.hasTexture('rock')
      ? (async (): Promise<TerrainTextures | null> => {
          try {
            const [grass, detail, rock, snowT, plaza] = await Promise.all(texKeys.map((k) => (library.hasTexture(k) ? library.texture(k) : Promise.resolve(null))));
            if (!grass || !detail || !rock) return null;
            return { grass, detail, rock, ...(snowT ? { snow: snowT } : {}), ...(plaza ? { plaza } : {}) };
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null);
    const kitPromise = buildMaterialKit(policy === 'lite' ? null : library, policy === 'lite' ? [] : LANDMARK_MODEL_KEYS);
    const vegKinds = policy === 'lite' ? [] : s.vegetation.kinds.filter((k): k is VegetationKind => k in KIND_MODELS).slice(0, policy === 'standard' ? 2 : 99);
    let loaded = 0;
    const totalToLoad = vegKinds.reduce((n, k) => n + KIND_MODELS[k].length, 0) + 1;
    const tick = () => onProgress?.(0.4 + 0.35 * Math.min(1, ++loaded / totalToLoad), `models ${loaded}/${totalToLoad}`);
    const vegPromise = (async () => {
      const protos: Partial<Record<VegetationKind, ReturnType<typeof protoFromModel>[]>> = {};
      if (!library) return protos;
      for (const kind of vegKinds) {
        const list: ReturnType<typeof protoFromModel>[] = [];
        for (const key of KIND_MODELS[kind]) {
          if (!library.hasModel(key)) continue;
          try {
            const model = await library.model(key);
            tick();
            const tint = kind === 'maple' ? 0xc8683a : kind === 'birch' ? 0xb9d27a : undefined;
            // Scanned broadleaf trees are small specimens; scale trees into a believable 9–15 m canopy band.
            const h = Math.max(0.5, model.entry.height);
            const scale: [number, number] = model.entry.category === 'tree' ? (h < 8 ? [9 / h, 13 / h] : [0.85, 1.2]) : model.entry.category === 'grass' ? [0.8, 1.4] : [0.7, 1.6];
            list.push(protoFromModel(model, scale, tint));
          } catch {
            /* fall back */
          }
        }
        if (list.length) protos[kind] = list;
      }
      return protos;
    })();

    onProgress?.(0.15, 'terrain');
    const textures = await texPromise;
    // Terrain resolution follows world size (≈5 m quads, capped) so 1 km+ districts stay smooth and cheap.
    const segments = policy === 'lite' ? Math.min(96, Math.max(48, Math.round(s.size / 16))) : Math.min(320, Math.max(96, Math.round(s.size / 5)));
    const terrain = buildTerrain(s.size, heightAt, s.terrain.palette, snow, textures, segments, district.subject === 'hub' ? 34 : 22);
    onProgress?.(0.4, 'textures and models');
    const [kit, protos] = await Promise.all([kitPromise, vegPromise]);
    onProgress?.(0.78, 'placing landmarks');

    const rects: { x: number; z: number; w: number; d: number }[] = [];
    for (const w of s.water ?? []) rects.push({ x: w.position[0], z: w.position[2], w: w.size[0], d: w.size[1] });
    const exclusions = [{ x: 0, z: 0, r: 36 }, ...district.triggers.map((t) => ({ x: t.position[0], z: t.position[2], r: t.radius + 3 })), ...district.npcs.map((n) => ({ x: n.position[0], z: n.position[2], r: (n.wanderRadius ?? 2) + 2 }))];
    const landmarkBuilds = s.landmarks.map((l) => ({ l, b: buildLandmark(l, kit, policy === 'lite') }));
    // POIs may carry a hero asset key (assets/dist/manifest models) or a procedural landmark type.
    for (const poi of district.pois) {
      if (!poi.landmark) continue;
      if (library?.hasModel(poi.landmark)) {
        try {
          const model = await library.model(poi.landmark);
          const obj = model.lods[0]!.clone(true);
          obj.name = `hero:${poi.id}`;
          obj.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          const r = Math.max(2, model.entry.radius * 0.7);
          landmarkBuilds.push({ l: { id: poi.id, type: poi.landmark, position: poi.position }, b: { object: obj, colliders: [{ kind: 'cylinder', center: [poi.position[0], model.entry.height / 2, poi.position[2]], halfExtents: [r, model.entry.height / 2, r], rotationY: 0 }], footprint: { w: r * 2, d: r * 2 }, lights: [] } });
          continue;
        } catch {
          /* fall through to procedural */
        }
      }
      // A hero key with no generated asset yet places nothing: better an empty plot than a generic box.
      if (!PROCEDURAL_TYPES.has(poi.landmark)) continue;
      landmarkBuilds.push({ l: { id: poi.id, type: poi.landmark, position: poi.position }, b: buildLandmark({ id: poi.id, type: poi.landmark, position: poi.position }, kit, policy === 'lite') });
    }
    for (const { l, b } of landmarkBuilds) if (b.footprint.w > 3) rects.push({ x: l.position[0], z: l.position[2], w: b.footprint.w * (l.scale ?? 1), d: b.footprint.d * (l.scale ?? 1) });

    const vegetation = new Vegetation({ size: s.size, density: s.vegetation.density, kinds: s.vegetation.kinds, seed: s.seed, maxInstances: preset.maxInstances, heightAt, exclusions, rects, protos, castShadows: policy === 'full' });
    const scene = new WorldScene(district, heightAt, terrain, vegetation);
    scene.drawDistance = preset.drawDistance;
    scene.group.name = `district:${district.id}`;
    scene.group.add(terrain.mesh);
    scene.occluders.push(terrain.mesh);
    scene.group.add(vegetation.group);
    scene.kit = kit;

    const frozen = s.ambience.weather === 'snow';
    for (const w of s.water ?? []) {
      const mesh = buildWater(w.position, w.size, frozen);
      scene.group.add(mesh);
      scene.disposables.push({ dispose: () => mesh.geometry.dispose() });
    }
    for (const { l, b } of landmarkBuilds) {
      scene.pending.push(b.object);
      // Cull range scales with footprint: a tower is visible across the map, a bench only nearby.
      const extent = Math.max(b.footprint.w, b.footprint.d) * (l.scale ?? 1);
      scene.culled.push({ obj: b.object, pos: new THREE.Vector3(l.position[0], l.position[1], l.position[2]), range: Math.max(90, Math.min(1400, extent * 26)) });
      scene.colliders.push(...b.colliders);
      scene.lights.push(...b.lights);
      if (b.footprint.w > 3) scene.occluders.push(b.object);
      b.object.position.y += heightAt(l.position[0], l.position[2]);
    }
    for (const poi of district.pois) {
      if (!poi.fastTravel) continue;
      const beacon = scene.buildMarker('portal', 2.2);
      beacon.position.set(poi.position[0], heightAt(poi.position[0], poi.position[2]) + 0.05, poi.position[2]);
      beacon.name = `poi:${poi.id}`;
      scene.pending.push(beacon);
      scene.markers.push({ id: `poi:${poi.id}`, object: beacon });
    }
    for (const t of district.triggers) {
      const marker = scene.buildMarker(t.kind, t.radius);
      marker.position.set(t.position[0], heightAt(t.position[0], t.position[2]) + 0.05, t.position[2]);
      marker.name = `trigger:${t.id}`;
      scene.pending.push(marker);
      scene.markers.push({ id: t.id, object: marker });
    }
    if (policy !== 'lite') {
      const fauna = new FaunaSystem(library, heightAt);
      await fauna.populate(district.pois, s.seed, (s.water?.[0]?.position[1] ?? -0.6));
      scene.pending.push(fauna.group);
      scene.fauna = fauna;
    }
    onProgress?.(0.8, 'fauna');
    return scene;
  }

  private kit: MaterialKit | null = null;

  private buildMarker(kind: 'zone' | 'pickup' | 'portal', radius: number): THREE.Object3D {
    const g = new THREE.Group();
    const color = kind === 'portal' ? 0x46b3ff : kind === 'pickup' ? 0xffc542 : 0xff5a5a;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 48), new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8, 1, true), new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    beam.position.y = 3;
    g.add(beam);
    if (kind === 'pickup') {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshStandardNodeMaterial({ color, emissive: color, emissiveIntensity: 1.5 }));
      gem.position.y = 1.2;
      gem.name = 'gem';
      g.add(gem);
    }
    return g;
  }

  /** Add up to `budget` queued objects; called once per frame. */
  hydrate(budget = this.hydrationBudget): number {
    let n = 0;
    while (n < budget && this.pending.length > 0) {
      const obj = this.pending.shift();
      if (obj) this.group.add(obj);
      n++;
    }
    return this.pending.length;
  }

  get hydrated(): boolean {
    return this.pending.length === 0;
  }

  update(dt: number, cameraPos: THREE.Vector3, elapsed: number): void {
    this.hydrate();
    for (const c of this.culled) {
      const d = c.pos.distanceTo(cameraPos);
      const want = d < c.range * (c.obj.visible ? 1.12 : 1); // hysteresis so objects do not flicker at the boundary
      if (c.obj.visible !== want) c.obj.visible = want;
    }
    this.vegetation.updateLod(cameraPos, this.drawDistance);
    this.fauna?.update(dt, elapsed);
    for (const m of this.markers) {
      m.object.rotation.y += dt * 0.6;
      const gem = m.object.getObjectByName('gem');
      if (gem) gem.position.y = 1.2 + Math.sin(elapsed * 2) * 0.15;
    }
  }

  setMarkerVisible(id: string, visible: boolean): void {
    const m = this.markers.find((x) => x.id === id);
    if (m) m.object.visible = visible;
  }

  setNight(night: boolean): void {
    for (const l of this.lights) if (l.name === 'lamp-light') l.intensity = night ? 14 : 0;
  }

  get vegetationCount(): number {
    return this.vegetation.instanceCount;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) {
        o.geometry.disposeBoundsTree?.();
        if (o.name === 'terrain' || o.name === 'water') o.geometry.dispose();
      }
    });
    this.vegetation.dispose();
    this.fauna?.dispose();
    for (const d of this.disposables) d.dispose();
    void this.kit;
    this.group.removeFromParent();
  }
}
