import * as THREE from 'three/webgpu';
import { attribute, float, mix, texture as texNode, uniform, vec3, vec4, Fn, select } from 'three/tsl';
import type { TextureNode } from 'three/webgpu';

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
  private readonly uniforms = {
    skinTint: uniform(new THREE.Color('#ffffff')),
    top: uniform(new THREE.Color('#c8102e')),
    bottom: uniform(new THREE.Color('#2b2f3a')),
    shoes: uniform(new THREE.Color('#3a2a1e')),
    hair: uniform(new THREE.Color('#1a1412')),
  };
  private readonly disposables: { dispose(): void }[] = [];
  private readonly bodyTextureNodes: TextureNode[] = [];
  private bodyKey: string;

  constructor(gltf: GLTF, entry: CharacterEntry, bodyKey: string, spec: AppearanceSpec, private readonly library: AssetLibrary) {
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
    this.disposables.push(lut);

    scene.traverse((o) => {
      if (!(o instanceof THREE.SkinnedMesh)) return;
      const name = o.name;
      const isHair = entry.hair.includes(name) || name.startsWith('Hair') || name === 'Eyebrows';
      if (isHair) {
        const style = HAIR_STYLE[spec.hair] ?? '';
        o.visible = name === 'Eyebrows' || name === style || (name === 'Hair_Beard' && spec.accessory === 'beard');
        const base = o.material as THREE.MeshStandardMaterial;
        const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0 });
        m.side = THREE.DoubleSide;
        if (base.map) m.colorNode = texNode(base.map).mul(vec4(this.uniforms.hair, 1));
        else m.colorNode = vec4(this.uniforms.hair, 1);
        if (base.normalMap) m.normalMap = base.normalMap;
        if (base.alphaMap || base.transparent) {
          m.transparent = true;
          m.alphaTest = 0.4;
        }
        o.material = m;
        this.disposables.push(m);
        return;
      }
      if (/eye/i.test(name) || /Face/.test(name)) {
        // Face / eyes keep the imported material but get the skin tint.
        const base = o.material as THREE.MeshStandardMaterial;
        if (/Face/.test(name) && base.map) {
          const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.6 });
          m.colorNode = texNode(base.map).mul(vec4(this.uniforms.skinTint, 1));
          if (base.normalMap) m.normalMap = base.normalMap;
          o.material = m;
          this.disposables.push(m);
        }
        return;
      }
      // Body: skin texture tinted + procedural clothing by bone weight.
      const base = o.material as THREE.MeshStandardMaterial;
      const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0 });
      const skinTexNode = base.map ? texNode(base.map) : null;
      if (skinTexNode) this.bodyTextureNodes.push(skinTexNode);
      const skinTex = skinTexNode ?? vec4(0.8, 0.6, 0.5, 1);
      const idx = attribute<'vec4'>('skinIndex', 'vec4');
      const w = attribute<'vec4'>('skinWeight', 'vec4');
      const lutNode = texNode(lut);
      const n = float(Math.max(1, bones.length));
      const classOf = (j: N) => lutNode.sample(vec3(j.add(0.5).div(n), 0.5, 0).xy).x.mul(3);
      const cls = Fn(() => {
        const comps = [
          [idx.x, w.x],
          [idx.y, w.y],
          [idx.z, w.z],
          [idx.w, w.w],
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
      const skin = skinTex.rgb.mul(this.uniforms.skinTint);
      const topMask = cls.x.smoothstep(0.35, 0.65);
      const bottomMask = cls.y.smoothstep(0.35, 0.65);
      const shoeMask = cls.z.smoothstep(0.3, 0.6);
      // Fabric shading: reuse the skin texture's luminance so cloth keeps folds/AO instead of being flat.
      const shade = skinTex.rgb.dot(vec3(0.299, 0.587, 0.114)).mul(0.5).add(0.6);
      let rgb = mix(skin, this.uniforms.top.mul(shade), topMask);
      rgb = mix(rgb, this.uniforms.bottom.mul(shade), bottomMask);
      rgb = mix(rgb, this.uniforms.shoes.mul(shade), shoeMask);
      m.colorNode = vec4(rgb, 1);
      m.roughnessNode = mix(float(0.6), float(0.92), topMask.max(bottomMask)).max(shoeMask.mul(0.7));
      if (base.normalMap) m.normalMap = base.normalMap;
      o.material = m;
      this.disposables.push(m);
    });

    this.mixer = new THREE.AnimationMixer(scene);
    for (const [key, clipName] of Object.entries(CLIP) as [AnimName, string][]) {
      const clip = gltf.animations.find((c) => c.name === clipName);
      if (clip) this.actions.set(key, this.mixer.clipAction(clip));
    }
    this.applyAppearance(spec);
    this.play('idle');
  }

  applyAppearance(spec: AppearanceSpec): void {
    this.uniforms.skinTint.value.set(skinTintFor(spec.skinColor));
    this.uniforms.top.value.set(spec.outfitColor);
    this.uniforms.bottom.value.set(bottomFor(spec.outfitColor));
    this.uniforms.hair.value.set(spec.hairColor);
    // Deep tones use the pack's dark base texture so shading detail stays natural.
    const entry = this.library.characterEntry(this.bodyKey);
    const tone = new THREE.Color(spec.skinColor);
    const path = entry?.skin[tone.r + tone.g + tone.b < 1.1 ? 'dark' : 'light'];
    if (path) {
      void this.library.loadTexture(path, true).then((t) => {
        t.flipY = false;
        for (const node of this.bodyTextureNodes) node.value = t;
      });
    }
    this.rebuildAccessories(spec);
    const sc = spec.body === 'broad' ? 1.06 : spec.body === 'tall' ? 1.05 : 1;
    this.root.scale.setScalar(sc);
  }

  private accessories: THREE.Object3D[] = [];
  private rebuildAccessories(spec: AppearanceSpec): void {
    for (const a of this.accessories) a.removeFromParent();
    this.accessories = [];
    if (!this.head) return;
    const attach = (obj: THREE.Object3D, to: THREE.Object3D | null) => {
      if (!to) return;
      to.add(obj);
      this.accessories.push(obj);
    };
    switch (spec.accessory) {
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
      case 'glasses': {
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
        break;
      }
      case 'scarf': {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 18), new THREE.MeshStandardNodeMaterial({ color: '#e3b505', roughness: 0.95 }));
        t.rotation.x = Math.PI / 2;
        t.position.y = -0.02;
        attach(t, this.head);
        break;
      }
      case 'backpack': {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.14), new THREE.MeshStandardNodeMaterial({ color: '#2f6b4f', roughness: 0.9 }));
        b.position.set(0, 0.02, -0.17);
        attach(b, this.spine);
        break;
      }
      default:
        break;
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
    for (const d of this.disposables) d.dispose();
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
