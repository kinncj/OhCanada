import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import type { Ambience } from '@domain/district';
import type { GraphicsPreset } from '@application/ports';

/** HDRI image-based lighting + sun with cascaded shadows + day/night cycle + fog. */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private hdri: THREE.Texture | null = null;
  private timeOfDay = 0.4; // 0 = midnight, 0.5 = noon
  private cycleSpeed = 0; // day fraction per second
  private readonly fogColor = new THREE.Color();
  private csm: CSMShadowNode | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly assetBase: string,
  ) {
    this.sun = new THREE.DirectionalLight(0xfff2dc, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -120;
    cam.right = cam.top = 120;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a30, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xcfd9e6, 0.004);
  }

  async load(ambience: Ambience, preset: GraphicsPreset, cycleEnabled: boolean): Promise<void> {
    this.timeOfDay = ambience.timeOfDay;
    this.cycleSpeed = cycleEnabled ? 1 / 600 : 0; // full day in 10 minutes
    (this.scene.fog as THREE.FogExp2).density = ambience.fogDensity ?? 0.004;
    this.sun.castShadow = preset.shadows;
    this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    if (preset.shadowCascades > 1) {
      this.csm = new CSMShadowNode(this.sun, { cascades: preset.shadowCascades, maxFar: 260, mode: 'practical', lightMargin: 120 });
      this.csm.fade = true;
      this.sun.shadow.shadowNode = this.csm;
    } else {
      this.csm = null;
      delete (this.sun.shadow as { shadowNode?: THREE.Node }).shadowNode;
    }
    try {
      const tex = await new HDRLoader().loadAsync(`${this.assetBase}${ambience.hdri}`);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this.hdri?.dispose();
      this.hdri = tex;
      this.scene.environment = tex;
      this.scene.background = tex;
      this.scene.backgroundBlurriness = 0.02;
    } catch {
      // No HDRI (offline dev): fall back to a gradient-ish solid sky.
      this.scene.environment = null;
      this.scene.background = new THREE.Color(0x9fc2e6);
    }
    this.update(0, new THREE.Vector3());
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.timeOfDay = (this.timeOfDay + dt * this.cycleSpeed) % 1;
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2; // sunrise at 0.25
    const elev = Math.sin(angle);
    const dir = new THREE.Vector3(Math.cos(angle) * 0.6, elev, Math.sin(angle) * 0.4 + 0.3).normalize();
    this.sun.position.copy(focus).addScaledVector(dir, 180);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    const day = THREE.MathUtils.clamp(elev * 1.6 + 0.2, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 4, 0, 1);
    this.sun.intensity = 0.15 + day * 3.0;
    this.sun.color.setHSL(0.09 - dusk * 0.06, 0.5 + dusk * 0.4, 0.6 + day * 0.35);
    this.hemi.intensity = 0.12 + day * 0.55;
    this.scene.environmentIntensity = 0.12 + day * 0.9;
    this.scene.backgroundIntensity = 0.06 + day * 0.95;
    this.fogColor.setHSL(0.58, 0.35 + dusk * 0.3, 0.2 + day * 0.62);
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogColor);
    if (!(this.scene.background instanceof THREE.Texture)) this.scene.background = this.fogColor.clone();
  }

  get isNight(): boolean {
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    return Math.sin(angle) < 0.05;
  }

  get time(): number {
    return this.timeOfDay;
  }

  dispose(): void {
    this.hdri?.dispose();
    this.scene.remove(this.sun, this.sun.target, this.hemi);
  }
}
