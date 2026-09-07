import * as THREE from 'three/webgpu';
import { SeededRandom } from '@common/rng';

export type WeatherKind = 'clear' | 'snow' | 'rain' | 'fog';

/** Snow / rain particles as one InstancedMesh that follows the camera. */
export class Weather {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private velocities: Float32Array = new Float32Array(0);
  private offsets: Float32Array = new Float32Array(0);
  private kind: WeatherKind = 'clear';
  private readonly box = 40;
  private readonly tmp = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();

  constructor(private count = 1400) {
    this.group.name = 'weather';
  }

  set(kind: WeatherKind, count = this.count): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = null;
    }
    this.kind = kind;
    this.count = count;
    if (kind !== 'snow' && kind !== 'rain') return;
    const geo = kind === 'snow' ? new THREE.SphereGeometry(0.045, 5, 4) : new THREE.BoxGeometry(0.02, 0.5, 0.02);
    const mat = new THREE.MeshBasicNodeMaterial({ color: kind === 'snow' ? 0xffffff : 0xaac8e8, transparent: true, opacity: kind === 'snow' ? 0.95 : 0.55 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.velocities = new Float32Array(count);
    this.offsets = new Float32Array(count * 3);
    const rng = new SeededRandom(99);
    for (let i = 0; i < count; i++) {
      this.offsets[i * 3] = (rng.next() - 0.5) * this.box;
      this.offsets[i * 3 + 1] = rng.next() * this.box;
      this.offsets[i * 3 + 2] = (rng.next() - 0.5) * this.box;
      this.velocities[i] = kind === 'snow' ? 1.2 + rng.next() * 1.4 : 14 + rng.next() * 6;
    }
    this.group.add(this.mesh);
  }

  update(dt: number, center: THREE.Vector3, elapsed: number): void {
    if (!this.mesh) return;
    const half = this.box / 2;
    for (let i = 0; i < this.count; i++) {
      let y = (this.offsets[i * 3 + 1] ?? 0) - (this.velocities[i] ?? 0) * dt;
      if (y < 0) y += this.box;
      this.offsets[i * 3 + 1] = y;
      const drift = this.kind === 'snow' ? Math.sin(elapsed * 0.8 + i) * 0.6 : 0.3;
      this.pos.set(center.x + (this.offsets[i * 3] ?? 0) + drift, center.y + y - 4, center.z + (this.offsets[i * 3 + 2] ?? 0));
      // wrap horizontally around the camera
      if (this.pos.x - center.x > half) this.pos.x -= this.box;
      if (this.pos.z - center.z > half) this.pos.z -= this.box;
      this.tmp.makeTranslation(this.pos.x, this.pos.y, this.pos.z);
      this.mesh.setMatrixAt(i, this.tmp);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.set('clear');
    this.group.removeFromParent();
  }
}
