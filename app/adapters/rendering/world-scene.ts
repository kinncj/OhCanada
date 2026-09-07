import * as THREE from 'three/webgpu';
import type { District } from '@domain/district';
import type { GraphicsPreset } from '@application/ports';
import { hashString } from '@common/rng';
import { makeHeightFunction, type HeightFn } from './procedural/noise';
import { buildTerrain, type TerrainBuild } from './terrain';
import { buildWater } from './water';
import { Vegetation } from './vegetation';
import { buildLandmark, type ColliderSpec } from './landmarks';

export interface Marker {
  readonly id: string;
  readonly object: THREE.Object3D;
}

/**
 * Builds one streamed district scene from its manifest: terrain (+ physics heights), water,
 * chunked vegetation, landmarks (+ colliders), trigger markers. Disposable as a unit.
 */
export class WorldScene {
  readonly group = new THREE.Group();
  readonly heightAt: HeightFn;
  readonly terrain: TerrainBuild;
  readonly colliders: ColliderSpec[] = [];
  readonly occluders: THREE.Object3D[] = [];
  readonly markers: Marker[] = [];
  readonly lights: THREE.Light[] = [];
  private readonly vegetation: Vegetation;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(readonly district: District, preset: GraphicsPreset) {
    const s = district.scene;
    this.group.name = `district:${district.id}`;
    const flatSpots = s.landmarks.map((l) => ({ x: l.position[0], z: l.position[2], r: 16 }));
    for (const t of district.triggers) flatSpots.push({ x: t.position[0], z: t.position[2], r: t.radius + 4 });
    for (const n of district.npcs) flatSpots.push({ x: n.position[0], z: n.position[2], r: (n.wanderRadius ?? 2) + 3 });
    for (const w of s.water ?? []) flatSpots.push({ x: w.position[0], z: w.position[2], r: Math.max(w.size[0], w.size[1]) * 0.6 });
    this.heightAt = makeHeightFunction({ seed: s.seed ^ hashString(district.id), amplitude: s.terrain.amplitude, frequency: s.terrain.frequency, size: s.size, flatRadius: 40, flatSpots });

    this.terrain = buildTerrain(s.size, this.heightAt, s.terrain.palette, s.terrain.snow ?? false);
    this.group.add(this.terrain.mesh);
    this.occluders.push(this.terrain.mesh);

    const frozen = s.ambience.weather === 'snow';
    for (const w of s.water ?? []) {
      const mesh = buildWater(w.position, w.size, frozen);
      this.group.add(mesh);
      this.disposables.push({ dispose: () => mesh.geometry.dispose() });
    }

    const rects: { x: number; z: number; w: number; d: number }[] = [];
    for (const l of s.landmarks) {
      const b = buildLandmark(l);
      this.group.add(b.object);
      this.colliders.push(...b.colliders);
      this.lights.push(...b.lights);
      if (b.footprint.w > 3) {
        this.occluders.push(b.object);
        rects.push({ x: l.position[0], z: l.position[2], w: b.footprint.w * (l.scale ?? 1), d: b.footprint.d * (l.scale ?? 1) });
      }
      // sit on terrain
      b.object.position.y += this.heightAt(l.position[0], l.position[2]);
    }
    for (const w of s.water ?? []) rects.push({ x: w.position[0], z: w.position[2], w: w.size[0], d: w.size[1] });

    const exclusions = [{ x: 0, z: 0, r: 34 }, ...district.triggers.map((t) => ({ x: t.position[0], z: t.position[2], r: t.radius + 3 })), ...district.npcs.map((n) => ({ x: n.position[0], z: n.position[2], r: (n.wanderRadius ?? 2) + 2 }))];
    this.vegetation = new Vegetation({ size: s.size, density: s.vegetation.density, kinds: s.vegetation.kinds, seed: s.seed, maxInstances: preset.maxInstances, heightAt: this.heightAt, exclusions, rects });
    this.group.add(this.vegetation.group);

    for (const t of district.triggers) {
      const marker = this.buildMarker(t.kind, t.radius);
      marker.position.set(t.position[0], this.heightAt(t.position[0], t.position[2]) + 0.05, t.position[2]);
      marker.name = `trigger:${t.id}`;
      this.group.add(marker);
      this.markers.push({ id: t.id, object: marker });
    }
  }

  private buildMarker(kind: 'zone' | 'pickup' | 'portal', radius: number): THREE.Object3D {
    const g = new THREE.Group();
    const color = kind === 'portal' ? 0x46b3ff : kind === 'pickup' ? 0xffc542 : 0xff5a5a;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 40), new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8, 1, true), new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
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

  update(dt: number, cameraPos: THREE.Vector3, elapsed: number): void {
    this.vegetation.updateLod(cameraPos);
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

  /** Night lighting: only lamps within range are lit to stay within light budgets. */
  setNight(night: boolean): void {
    for (const l of this.lights) if (l.name === 'lamp-light') l.intensity = night ? 14 : 0;
  }

  get vegetationCount(): number {
    return this.vegetation.instanceCount;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.disposeBoundsTree?.();
        o.geometry.dispose();
      }
    });
    this.vegetation.dispose();
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
