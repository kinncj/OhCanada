import * as THREE from 'three/webgpu';
import { attribute, float, mix, texture as texNode, vec3, vec4, Fn, select, userData as userDataNode } from 'three/tsl';

function userData(name: string, type: 'vec3'): THREE.Node<'vec3'>;
function userData(name: string, type: 'float'): THREE.Node<'float'>;
function userData(name: string, type: 'vec3' | 'float'): THREE.Node<'vec3'> | THREE.Node<'float'> {
  return userDataNode(name, type) as unknown as THREE.Node<'vec3'>;
}

type N = THREE.Node<'float'>;
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AppearanceSpec } from './character-view';
import type { AssetLibrary, CharacterEntry } from './asset-library';

export type AnimName = 'idle' | 'talk' | 'walk' | 'jog' | 'sprint' | 'jump' | 'interact';

const CLIP: Record<AnimName, string> = {
  idle: 'Idle_Loop',
  talk: 'Idle_Talking_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  jump: 'Jump_Loop',
  interact: 'Interact',
};

/** Materials are shared across every character so the GPU compiles each shader once. */
const SHARED = new Map<string, THREE.Material>();
function sharedMaterial<T extends THREE.Material>(key: string, make: () => T): T {
  let m = SHARED.get(key) as T | undefined;
  if (!m) {
    m = make();
    m.name = key;
    SHARED.set(key, m);
  }
  return m;
}

/** Clothing class per joint name: 0 skin, 1 top, 2 bottom, 3 shoes. Hands/head/neck stay skin. */
function clothClass(joint: string): number {
  if (/^(pelvis|thigh|calf)/.test(joint)) return 2;
  if (/^(foot|ball)/.test(joint)) return 3;
  if (/^(spine|clavicle|upperarm|lowerarm)/.test(joint)) return 1;
  return 0;
}

const HAIR_STYLE: Record<string, string> = {
  short: 'Hair_SimpleParted',
  long: 'Hair_Long',
  bun: 'Hair_Buns',
  braids: 'Hair_Long',
  buzz: 'Hair_Buzzed',
  none: '',
};

/**
 * Rigged, animated human from the asset library (Quaternius Universal Base Characters + Animation Library,
 * CC0). Clothing is shaded procedurally from bone weights (fitted top / bottom / shoes) so outfits are data.
 * Hair meshes are toggled by name; accessories are procedural meshes parented to the Head bone.
 */
export class SkinnedCharacterView {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<AnimName, THREE.AnimationAction>();
  private current: AnimName | null = null;
  private readonly head: THREE.Object3D | null;
  private readonly spine: THREE.Object3D | null;
  /** Per-character tints live in mesh.userData and are read by SHARED materials via TSL userData nodes. */
  private readonly uniforms = {
    skinTint: new THREE.Color('#ffffff'),
    top: new THREE.Color('#c8102e'),
    bottom: new THREE.Color('#2b2f3a'),
    shoes: new THREE.Color('#3a2a1e'),
    hair: new THREE.Color('#1a1412'),
    clothRough: 0.92,
  };
  private readonly tintedMeshes: THREE.Mesh[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly bodyMeshes: THREE.SkinnedMesh[] = [];
  private lut!: THREE.DataTexture;
  private boneCount = 1;
  private bodyKey: string;

  constructor(gltf: GLTF, entry: CharacterEntry, bodyKey: string, spec: AppearanceSpec, private readonly library: AssetLibrary, private readonly simple = false) {
    this.bodyKey = bodyKey;
    const scene = SkeletonUtils.clone(gltf.scene);
    scene.traverse((o) => {
      o.frustumCulled = false;
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
    this.root.add(scene);
    this.head = scene.getObjectByName('Head') ?? null;
    this.spine = scene.getObjectByName('spine_03') ?? null;

    // Joint -> clothing class lookup baked from the skeleton order.
    const skinned = scene.getObjectByProperty('type', 'SkinnedMesh') as THREE.SkinnedMesh | undefined;
    const bones = skinned?.skeleton.bones ?? [];
    const classes = new Float32Array(Math.max(1, bones.length) * 4);
    bones.forEach((b, i) => {
      classes[i * 4] = clothClass(b.name) / 3;
    });
    const lut = new THREE.DataTexture(classes, Math.max(1, bones.length), 1, THREE.RGBAFormat, THREE.FloatType);
    lut.needsUpdate = true;
    lut.minFilter = lut.magFilter = THREE.NearestFilter;
    const lutKey = bones.map((b) => clothClass(b.name)).join('');
    this.lut = lut;
    this.boneCount = bones.length;
    const toRemove: THREE.Object3D[] = [];

    scene.traverse((o) => {
      if (!(o instanceof THREE.SkinnedMesh)) return;
      const name = o.name;
      const isHair = entry.hair.includes(name) || name.startsWith('Hair') || name === 'Eyebrows';
      if (isHair) {
        const style = HAIR_STYLE[spec.hair] ?? '';
        const keep = name === 'Eyebrows' || name === style || (name === 'Hair_Beard' && (spec.accessory === 'beard' || spec.beard === true));
        if (!keep) {
          toRemove.push(o); // removed (not hidden) so no shader is compiled for unused hairstyles
          return;
        }
        const base = o.material as THREE.MeshStandardMaterial;
        if (this.simple) {
          o.material = sharedMaterial(`hair-simple:${base.uuid}`, () => new THREE.MeshStandardMaterial({ map: base.map, color: 0x2a2320, roughness: 0.7, side: THREE.DoubleSide }));
          return;
        }
        o.material = sharedMaterial(`hair:${base.uuid}`, () => {
          const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0 });
          m.side = THREE.DoubleSide;
          const tint = userData('hairTint', 'vec3');
          m.colorNode = base.map ? texNode(base.map).mul(vec4(tint, 1)) : vec4(tint, 1);
          if (base.normalMap) m.normalMap = base.normalMap;
          if (base.alphaMap || base.transparent) {
            m.transparent = true;
            m.alphaTest = 0.4;
          }
          return m;
        });
        this.tintedMeshes.push(o);
        return;
      }
      if (/eye/i.test(name) || /Face/.test(name)) {
        // Face / eyes keep the imported material but get the skin tint.
        const base = o.material as THREE.MeshStandardMaterial;
        if (this.simple) return;
        if (/Face/.test(name) && base.map) {
          o.material = sharedMaterial(`face:${base.uuid}`, () => {
            const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.6 });
            m.colorNode = texNode(base.map!).mul(vec4(userData('skinTint', 'vec3'), 1));
            if (base.normalMap) m.normalMap = base.normalMap;
            return m;
          });
          this.tintedMeshes.push(o);
        }
        return;
      }
      // Body: skin texture tinted + procedural clothing by bone weight.
      const base = o.material as THREE.MeshStandardMaterial;
      this.tintedMeshes.push(o);
      this.bodyMeshes.push(o);
      o.material = this.simple
        ? sharedMaterial(`body-simple:${base.uuid}`, () => new THREE.MeshStandardMaterial({ map: base.map, normalMap: base.normalMap, roughness: 0.8, metalness: 0 }))
        : sharedMaterial(`body:${base.uuid}:${lutKey}`, () => this.buildBodyMaterial(base, lut, bones.length));
    });
    for (const o of toRemove) o.removeFromParent();

    this.mixer = new THREE.AnimationMixer(scene);
    for (const [key, clipName] of Object.entries(CLIP) as [AnimName, string][]) {
      const clip = gltf.animations.find((c) => c.name === clipName);
      if (clip) this.actions.set(key, this.mixer.clipAction(clip));
    }
    this.applyAppearance(spec);
    this.play('idle');
  }


  private buildBodyMaterial(base: THREE.MeshStandardMaterial, lut: THREE.DataTexture, boneCount: number): THREE.MeshStandardNodeMaterial {
      const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0 });
      const skinTexNode = base.map ? texNode(base.map) : null;
      const skinTex = skinTexNode ?? vec4(0.8, 0.6, 0.5, 1);
      const idx = attribute<'uvec4'>('skinIndex', 'uvec4');
      const w = attribute<'vec4'>('skinWeight', 'vec4');
      const lutNode = texNode(lut);
      const n = float(Math.max(1, boneCount));
      // skinIndex is an integer attribute: convert before arithmetic (WebGL2 rejects uint + float).
      const classOf = (j: N) => lutNode.sample(vec3(float(j).add(0.5).div(n), 0.5, 0).xy).x.mul(3);
      const cls = Fn(() => {
        const comps = [
          [idx.x as unknown as N, w.x as N],
          [idx.y as unknown as N, w.y as N],
          [idx.z as unknown as N, w.z as N],
          [idx.w as unknown as N, w.w as N],
        ] as const;
        let top: N = float(0);
        let bottom: N = float(0);
        let shoes: N = float(0);
        for (const [j, wt] of comps) {
          const c = classOf(j);
          shoes = shoes.add(select(c.greaterThan(2.5), wt, 0));
          bottom = bottom.add(select(c.greaterThan(1.5).and(c.lessThanEqual(2.5)), wt, 0));
          top = top.add(select(c.greaterThan(0.5).and(c.lessThanEqual(1.5)), wt, 0));
        }
        return vec3(top, bottom, shoes);
      })();
      const skin = skinTex.rgb.mul(userData('skinTint', 'vec3'));
      const topMask = cls.x.smoothstep(0.35, 0.65);
      const bottomMask = cls.y.smoothstep(0.35, 0.65);
      const shoeMask = cls.z.smoothstep(0.3, 0.6);
      // Fabric shading: reuse the skin texture's luminance so cloth keeps folds/AO instead of being flat.
      const shade = skinTex.rgb.dot(vec3(0.299, 0.587, 0.114)).mul(0.5).add(0.6);
      let rgb = mix(skin, userData('topTint', 'vec3').mul(shade), topMask);
      rgb = mix(rgb, userData('bottomTint', 'vec3').mul(shade), bottomMask);
      rgb = mix(rgb, userData('shoesTint', 'vec3').mul(shade), shoeMask);
      m.colorNode = vec4(rgb, 1);
      m.roughnessNode = mix(float(0.6), userData('clothRough', 'float'), topMask.max(bottomMask)).max(shoeMask.mul(0.7));
      if (base.normalMap) m.normalMap = base.normalMap;
      return m;
  }

  applyAppearance(spec: AppearanceSpec): void {
    this.uniforms.skinTint.copy(skinTintFor(spec.skinColor));
    this.uniforms.hair.set(spec.hairColor);
    const style = spec.outfitStyle ?? 'casual';
    const top = new THREE.Color(spec.outfitColor);
    const bottom = new THREE.Color(spec.bottomColor ?? bottomFor(spec.outfitColor));
    let rough = 0.92;
    switch (style) {
      case 'robe': // judge / ceremonial: one dark garment head to toe
        top.set('#141620');
        bottom.copy(top);
        rough = 0.85;
        break;
      case 'uniform': // police / harbour: navy tunic, darker trousers
        top.set('#1f2d4d');
        bottom.set(spec.bottomColor ?? '#141a2b');
        rough = 0.8;
        break;
      case 'formal': // suit jacket + trousers
        rough = 0.75;
        break;
      case 'raincoat': // glossy, long: covers hips too
        rough = 0.35;
        bottom.copy(top).multiplyScalar(0.9);
        break;
      case 'parka':
        rough = 0.98;
        break;
      case 'jersey':
        rough = 0.9;
        break;
      case 'workwear':
        top.set('#6b4a2b');
        rough = 0.95;
        break;
      default:
        break;
    }
    this.uniforms.top.copy(top);
    this.uniforms.bottom.copy(bottom);
    this.uniforms.clothRough = rough;
    this.pushTints();
    // Deep tones use the pack's dark base texture: a second SHARED body material variant keyed on the texture.
    const entry = this.library.characterEntry(this.bodyKey);
    const tone = new THREE.Color(spec.skinColor);
    const path = entry?.skin[tone.r + tone.g + tone.b < 1.1 ? 'dark' : 'light'];
    if (path && tone.r + tone.g + tone.b < 1.1) {
      void this.library.loadTexture(path, true).then((t) => {
        t.flipY = false;
        for (const o of this.bodyMeshes) {
          const current = o.material as THREE.MeshStandardNodeMaterial;
          o.material = sharedMaterial(`${current.name || current.uuid}:dark:${path}`, () => {
            const base = new THREE.MeshStandardMaterial({ map: t, normalMap: (current.normalMap as THREE.Texture | null) ?? null });
            return this.buildBodyMaterial(base, this.lut, this.boneCount);
          });
        }
      });
    }
    this.rebuildAccessories(spec);
    const sc = spec.body === 'broad' ? 1.06 : spec.body === 'tall' ? 1.05 : 1;
    this.root.scale.setScalar(sc);
  }

  private accessories: THREE.Object3D[] = [];
  private rebuildAccessories(spec: AppearanceSpec): void {
    if (this.simple) return; // one shader per prop is too costly on the phone preset
    for (const a of this.accessories) a.removeFromParent();
    this.accessories = [];
    if (!this.head) return;
    const attach = (obj: THREE.Object3D, to: THREE.Object3D | null) => {
      if (!to) return;
      to.add(obj);
      this.accessories.push(obj);
    };
    const hatColor = spec.outfitStyle === 'uniform' ? '#141a2b' : spec.outfitColor;
    switch (spec.hat ?? (spec.accessory === 'toque' ? 'toque' : 'none')) {
      case 'cap': {
        const g = new THREE.Group();
        g.name = 'part:hat:cap';
        const m = new THREE.MeshStandardNodeMaterial({ color: hatColor, roughness: 0.9 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.113, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
        crown.position.y = 0.06;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20, 1, false, -Math.PI / 2, Math.PI), m);
        brim.position.set(0, 0.06, 0.09);
        brim.scale.set(1.2, 1, 1.3);
        g.add(crown, brim);
        attach(g, this.head);
        break;
      }
      case 'police':
      case 'captain': {
        const g = new THREE.Group();
        g.name = `part:hat:${spec.hat}`;
        const dark = new THREE.MeshStandardNodeMaterial({ color: spec.hat === 'captain' ? '#f2f2ee' : '#141a2b', roughness: 0.8 });
        const band = new THREE.MeshStandardNodeMaterial({ color: '#0c0f18', roughness: 0.6 });
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.105, 0.075, 24), dark);
        crown.position.y = 0.105;
        const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.02, 24), dark);
        topDisc.position.set(0, 0.15, -0.01);
        const bandM = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.03, 24), band);
        bandM.position.y = 0.075;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 20, 1, false, -Math.PI / 2, Math.PI), band);
        brim.position.set(0, 0.062, 0.085);
        brim.scale.set(1.15, 1, 1.2);
        const badge = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardNodeMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.3 }));
        badge.position.set(0, 0.11, 0.115);
        g.add(crown, topDisc, bandM, brim, badge);
        attach(g, this.head);
        break;
      }
      case 'hardhat': {
        const g = new THREE.Group();
        g.name = 'part:hat:hardhat';
        const m = new THREE.MeshStandardNodeMaterial({ color: '#f5c518', roughness: 0.35 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m);
        shell.position.y = 0.05;
        const brim = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 6, 24), m);
        brim.rotation.x = Math.PI / 2;
        brim.position.y = 0.055;
        g.add(shell, brim);
        attach(g, this.head);
        break;
      }
      case 'beret': {
        const m = new THREE.MeshStandardNodeMaterial({ color: hatColor, roughness: 0.95 });
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), m);
        b.scale.set(1, 0.6, 1);
        b.position.set(0.02, 0.075, -0.01);
        b.rotation.z = -0.25;
        b.name = 'part:hat:beret';
        attach(b, this.head);
        break;
      }
      case 'hood': {
        const m = new THREE.MeshStandardNodeMaterial({ color: spec.outfitColor, roughness: 0.98 });
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 14, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.62), m);
        hood.position.set(0, 0.02, -0.02);
        hood.rotation.y = Math.PI;
        hood.name = 'part:hat:hood';
        attach(hood, this.head);
        break;
      }
      case 'toque': {
        const g = new THREE.Group();
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardNodeMaterial({ color: '#c8102e', roughness: 0.95 }));
        cap.position.y = 0.075;
        const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardNodeMaterial({ color: '#f4f4f4', roughness: 1 }));
        pom.position.y = 0.19;
        g.add(cap, pom);
        g.position.y = 0.06;
        attach(g, this.head);
        break;
      }
      default:
        break;
    }
    // Remaining accessories (glasses, scarf, backpack) are independent of the hat.
    switch (spec.accessory) {
      case 'glasses':
      case 'scarf':
      case 'backpack':
        this.buildSmallAccessory(spec.accessory, attach);
        break;
      default:
        break;
    }
  }

  private buildSmallAccessory(kind: 'glasses' | 'scarf' | 'backpack', attach: (obj: THREE.Object3D, to: THREE.Object3D | null) => void): void {
    if (kind === 'glasses') {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardNodeMaterial({ color: '#222', roughness: 0.4, metalness: 0.6 });
      for (const sx of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 14), m);
        ring.position.set(sx * 0.033, 0.05, 0.095);
        g.add(ring);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.004), m);
      bridge.position.set(0, 0.05, 0.095);
      g.add(bridge);
      attach(g, this.head);
    } else if (kind === 'scarf') {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 18), new THREE.MeshStandardNodeMaterial({ color: '#e3b505', roughness: 0.95 }));
      t.rotation.x = Math.PI / 2;
      t.position.y = -0.02;
      attach(t, this.head);
    } else {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.14), new THREE.MeshStandardNodeMaterial({ color: '#2f6b4f', roughness: 0.9 }));
      b.position.set(0, 0.02, -0.17);
      attach(b, this.spine);
    }
  }

  private pushTints(): void {
    for (const o of this.tintedMeshes) {
      o.userData.skinTint = this.uniforms.skinTint;
      o.userData.hairTint = this.uniforms.hair;
      o.userData.topTint = this.uniforms.top;
      o.userData.bottomTint = this.uniforms.bottom;
      o.userData.shoesTint = this.uniforms.shoes;
      o.userData.clothRough = this.uniforms.clothRough;
    }
  }

  play(name: AnimName, fade = 0.25): void {
    if (this.current === name) return;
    const next = this.actions.get(name) ?? this.actions.get('idle');
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.current = name;
  }

  /** Drive locomotion from speed (m/s) and grounded state. */
  animate(dt: number, speed: number, grounded: boolean, talking = false): void {
    if (!grounded) this.play('jump');
    else if (speed > 6) this.play('sprint');
    else if (speed > 3) this.play('jog');
    else if (speed > 0.3) this.play('walk');
    else this.play(talking ? 'talk' : 'idle');
    const a = this.actions.get(this.current ?? 'idle');
    if (a && (this.current === 'walk' || this.current === 'jog' || this.current === 'sprint')) a.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / (this.current === 'walk' ? 1.6 : this.current === 'jog' ? 4 : 7), 0.7, 1.6));
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const d of this.disposables) d.dispose(); // shared materials are intentionally kept
    this.root.removeFromParent();
  }
}

/** The base textures are already skin-coloured (light/dark). Convert the chosen tone into a multiplier. */
function skinTintFor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const ref = new THREE.Color('#e8b894'); // approximate albedo of the light base texture
  return new THREE.Color(THREE.MathUtils.clamp(c.r / ref.r, 0.3, 1.25), THREE.MathUtils.clamp(c.g / ref.g, 0.3, 1.25), THREE.MathUtils.clamp(c.b / ref.b, 0.3, 1.25));
}

function bottomFor(top: string): string {
  const c = new THREE.Color(top);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return `#${new THREE.Color().setHSL((hsl.h + 0.55) % 1, Math.min(0.25, hsl.s), 0.18).getHexString()}`;
}
