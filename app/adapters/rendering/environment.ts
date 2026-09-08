import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
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
  private readonly sky: SkyMesh;
  private readonly stars: THREE.Points;
  private readonly sunDir = new THREE.Vector3();
  private useSky = true;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly assetBase: string,
    private readonly allowCascades = true,
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

    // Physical sky (Preetham, TSL) — renders on both WebGPU and WebGL2 and reacts to the sun position.
    this.sky = new SkyMesh();
    this.sky.scale.setScalar(45000);
    this.sky.name = 'sky';
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    // Star field: a sphere of points that fades in after dusk.
    const starCount = 900;
    const pos = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * r * 9000;
      pos[i * 3 + 1] = Math.abs(u) * 9000 + 200;
      pos[i * 3 + 2] = Math.sin(a) * r * 9000;
      sizes[i] = 12 + Math.random() * 26;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.stars = new THREE.Points(starGeo, new THREE.PointsNodeMaterial({ color: 0xdfe8ff, sizeAttenuation: false, size: 2, transparent: true, opacity: 0, depthWrite: false }));
    this.stars.name = 'stars';
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -999;
    scene.add(this.stars);
  }

  async load(ambience: Ambience, preset: GraphicsPreset, cycleEnabled: boolean, worldSize = 260): Promise<void> {
    this.timeOfDay = ambience.timeOfDay;
    const w = ambience.weather;
    this.sky.turbidity.value = w === 'fog' ? 14 : w === 'rain' ? 10 : w === 'snow' ? 6 : 2.6;
    this.sky.rayleigh.value = w === 'rain' || w === 'fog' ? 0.6 : w === 'snow' ? 1.6 : 2.2;
    this.sky.mieCoefficient.value = w === 'fog' ? 0.03 : 0.006;
    this.sky.mieDirectionalG.value = w === 'snow' ? 0.85 : 0.8;
    // The Preetham sky is one of the largest shaders in the build; the phone tier gets a gradient instead.
    this.useSky = preset.assetPolicy !== 'lite';
    this.sky.visible = this.useSky;
    this.cycleSpeed = cycleEnabled ? 1 / 3600 : 0; // full day in an hour: a short session should not end at midnight
    // Fog is authored per district but must scale with the map: exp2 fog at a fixed density that suited a
    // 260 m block turns a 1.3 km district into haze. Keep roughly one map-width of visibility.
    const reach = (ambience.weather === 'fog' ? 2.2 : ambience.weather === 'rain' || ambience.weather === 'snow' ? 1.4 : 0.85) / Math.max(120, worldSize);
    (this.scene.fog as THREE.FogExp2).density = Math.min(ambience.fogDensity ?? 0.004, reach);
    this.sun.castShadow = preset.shadows;
    this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    if (preset.shadowCascades > 1 && this.allowCascades) {
      this.csm = new CSMShadowNode(this.sun, { cascades: preset.shadowCascades, maxFar: 260, mode: 'practical', lightMargin: 120 });
      this.csm.fade = true;
      this.sun.shadow.shadowNode = this.csm;
    } else {
      this.csm = null;
      delete (this.sun.shadow as { shadowNode?: THREE.Node }).shadowNode;
    }
    try {
      const tex = await Promise.race([
        new HDRLoader().loadAsync(`${this.assetBase}${ambience.hdri}`),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('HDRI timed out')), 8000)),
      ]);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this.hdri?.dispose();
      this.hdri = tex;
      this.scene.environment = tex; // image-based lighting only: the sky itself is the SkyMesh
      this.scene.background = null;
    } catch {
      // No HDRI (offline dev): the SkyMesh still provides the visible sky.
      this.scene.environment = null;
      this.scene.background = null;
    }
    this.update(0, new THREE.Vector3());
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.timeOfDay = (this.timeOfDay + dt * this.cycleSpeed) % 1;
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2; // sunrise at 0.25
    const elev = Math.sin(angle);
    const dir = this.sunDir.set(Math.cos(angle) * 0.6, elev, Math.sin(angle) * 0.4 + 0.3).normalize();
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
    if (this.useSky) {
      this.sky.sunPosition.value.copy(dir).multiplyScalar(40000);
      this.sky.position.copy(focus);
    } else if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.fogColor);
    } else {
      this.scene.background = this.fogColor.clone();
    }
    this.stars.position.copy(focus);
    const night = THREE.MathUtils.clamp(-elev * 3, 0, 1);
    (this.stars.material as THREE.PointsNodeMaterial).opacity = night * 0.9;
    this.stars.visible = this.useSky && night > 0.01;
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
    this.scene.remove(this.sun, this.sun.target, this.hemi, this.sky, this.stars);
    this.sky.geometry.dispose();
    this.stars.geometry.dispose();
  }
}
