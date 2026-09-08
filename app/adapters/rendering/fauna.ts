import * as THREE from 'three/webgpu';
import { SeededRandom } from '@common/rng';
import type { Fauna, Poi } from '@domain/district';
import type { AssetLibrary } from './asset-library';
import type { HeightFn } from './procedural/noise';

interface Animal {
  readonly obj: THREE.Object3D;
  readonly species: string;
  readonly behavior: Fauna['behavior'];
  readonly home: THREE.Vector3;
  readonly radius: number;
  target: THREE.Vector3;
  speed: number;
  phase: number;
  pause: number;
}

/**
 * Fauna spawner: places hero fauna models (assets/dist manifest keys = species) around POIs and drives
 * simple behaviours — graze (wander/pause), swim (bob + drift on water), fly (circle), patrol, skate (loops
 * on the canal), idle. Spawns nothing when a species model is missing (no generic stand-ins).
 */
export class FaunaSystem {
  readonly group = new THREE.Group();
  private readonly animals: Animal[] = [];

  constructor(
    private readonly library: AssetLibrary | null,
    private readonly heightAt: HeightFn,
  ) {
    this.group.name = 'fauna';
  }

  async populate(pois: readonly Poi[], seed: number, waterLevel = -0.6): Promise<void> {
    if (!this.library) return;
    const rng = new SeededRandom(seed ^ 0x5f1a);
    for (const poi of pois) {
      for (const f of poi.fauna ?? []) {
        if (!this.library.hasModel(f.species)) continue;
        let model;
        try {
          model = await this.library.model(f.species);
        } catch {
          continue;
        }
        for (let i = 0; i < f.count; i++) {
          const obj = model.lods[0]!.clone(true);
          obj.traverse((o) => (o.userData.shared = true));
          obj.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          const a = poi.position[0] + (rng.next() - 0.5) * poi.radius * 1.4;
          const b = poi.position[2] + (rng.next() - 0.5) * poi.radius * 1.4;
          const swim = f.behavior === 'swim' || f.behavior === 'skate';
          const y = swim ? waterLevel + (f.behavior === 'skate' ? 0.05 : -0.15) : this.heightAt(a, b);
          obj.position.set(a, y, b);
          obj.rotation.y = rng.next() * Math.PI * 2;
          this.group.add(obj);
          this.animals.push({
            obj, species: f.species, behavior: f.behavior, home: new THREE.Vector3(poi.position[0], y, poi.position[2]), radius: poi.radius * 0.7,
            target: obj.position.clone(), speed: f.behavior === 'fly' ? 6 : f.behavior === 'skate' ? 3 : f.species === 'moose' ? 1.2 : 0.7, phase: rng.next() * 10, pause: rng.next() * 4,
          });
        }
      }
    }
  }

  update(dt: number, elapsed: number): void {
    for (const an of this.animals) {
      an.phase += dt;
      switch (an.behavior) {
        case 'fly': {
          const r = an.radius;
          const t = an.phase * (an.speed / r);
          an.obj.position.set(an.home.x + Math.cos(t) * r, an.home.y + 12 + Math.sin(t * 2) * 2, an.home.z + Math.sin(t) * r);
          an.obj.rotation.y = -t + Math.PI / 2;
          break;
        }
        case 'swim': {
          const d = an.target.clone().sub(an.obj.position);
          d.y = 0;
          if (d.length() < 0.5) an.target.set(an.home.x + (Math.random() - 0.5) * an.radius, an.home.y, an.home.z + (Math.random() - 0.5) * an.radius);
          else {
            d.normalize();
            an.obj.position.addScaledVector(d, an.speed * dt);
            an.obj.rotation.y = Math.atan2(d.x, d.z);
          }
          an.obj.position.y = an.home.y + Math.sin(elapsed * 1.5 + an.phase) * 0.06;
          break;
        }
        case 'skate':
        case 'patrol':
        case 'graze': {
          if (an.pause > 0) {
            an.pause -= dt;
            break;
          }
          const d = an.target.clone().sub(an.obj.position);
          d.y = 0;
          if (d.length() < 0.6) {
            an.target.set(an.home.x + (Math.random() - 0.5) * an.radius * 2, 0, an.home.z + (Math.random() - 0.5) * an.radius * 2);
            an.pause = an.behavior === 'graze' ? 2 + Math.random() * 6 : 0;
          } else {
            d.normalize();
            an.obj.position.addScaledVector(d, an.speed * dt);
            const yaw = Math.atan2(d.x, d.z);
            an.obj.rotation.y += (yaw - an.obj.rotation.y) * Math.min(1, dt * 4);
            if (an.behavior !== 'skate') an.obj.position.y = this.heightAt(an.obj.position.x, an.obj.position.z);
            else an.obj.position.y = an.home.y + Math.abs(Math.sin(elapsed * 6 + an.phase)) * 0.02;
          }
          break;
        }
        default:
          an.obj.position.y = (an.behavior === 'idle' ? this.heightAt(an.obj.position.x, an.obj.position.z) : an.obj.position.y) + Math.sin(elapsed * 2 + an.phase) * 0.01;
      }
    }
  }

  get count(): number {
    return this.animals.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.animals.length = 0;
  }
}
