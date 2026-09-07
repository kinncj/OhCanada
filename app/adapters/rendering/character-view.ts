import * as THREE from 'three/webgpu';

/** Resolved appearance (ids -> colours) handed to the view by bootstrap. */
export interface AppearanceSpec {
  readonly body: string;
  readonly face: string;
  readonly skinColor: string;
  readonly hair: string;
  readonly hairColor: string;
  readonly outfitColor: string;
  readonly accessory: string;
}

const BODY_SCALE: Record<string, [number, number, number]> = {
  average: [1, 1, 1],
  slim: [0.88, 1.02, 0.9],
  broad: [1.18, 1, 1.12],
  tall: [1, 1.14, 1],
};

/**
 * Modular procedural humanoid. Every part is a named child so a glTF part
 * (catalog `mesh`) can replace it later without touching gameplay code.
 */
export class CharacterView {
  readonly root = new THREE.Group();
  private readonly limbs: { lArm: THREE.Object3D; rArm: THREE.Object3D; lLeg: THREE.Object3D; rLeg: THREE.Object3D; torso: THREE.Object3D; head: THREE.Object3D };
  private phase = 0;
  private readonly materials: THREE.Material[] = [];

  constructor(spec: AppearanceSpec) {
    const skin = this.mat(spec.skinColor, 0.7);
    const cloth = this.mat(spec.outfitColor, 0.85);
    const pants = this.mat('#2b2f3a', 0.9);
    const hairM = this.mat(spec.hairColor, 0.6);
    const boots = this.mat('#3a2a1e', 0.8);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), cloth);
    torso.position.y = 1.15;
    torso.name = 'part:torso';
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.22, 12), pants);
    hips.position.y = 0.82;
    const head = new THREE.Group();
    head.name = 'part:head';
    const headGeo = spec.face === 'square' ? new THREE.BoxGeometry(0.34, 0.36, 0.34, 2, 2, 2) : new THREE.SphereGeometry(0.19, 20, 14);
    const headMesh = new THREE.Mesh(headGeo, skin);
    if (spec.face === 'oval') headMesh.scale.set(0.9, 1.12, 0.92);
    head.add(headMesh);
    head.position.y = 1.72;
    const eyeM = this.mat('#1a1a1a', 0.3);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeM);
      eye.position.set(sx * 0.07, 0.03, 0.17);
      head.add(eye);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), skin);
    neck.position.y = 1.52;

    const hair = this.buildHair(spec.hair, hairM);
    if (hair) head.add(hair);
    const acc = this.buildAccessory(spec.accessory);
    if (acc) (acc.name === 'part:accessory:backpack' || acc.name === 'part:accessory:scarf' ? torso : head).add(acc);

    const makeArm = (sx: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.34, 1.42, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), cloth);
      upper.position.y = -0.18;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin);
      hand.position.y = -0.42;
      pivot.add(upper, hand);
      pivot.name = sx < 0 ? 'part:arm-left' : 'part:arm-right';
      return pivot;
    };
    const makeLeg = (sx: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.12, 0.78, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), pants);
      leg.position.y = -0.32;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), boots);
      boot.position.set(0, -0.66, 0.04);
      pivot.add(leg, boot);
      pivot.name = sx < 0 ? 'part:leg-left' : 'part:leg-right';
      return pivot;
    };
    const lArm = makeArm(-1);
    const rArm = makeArm(1);
    const lLeg = makeLeg(-1);
    const rLeg = makeLeg(1);
    this.root.add(hips, torso, neck, head, lArm, rArm, lLeg, rLeg);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const sc = BODY_SCALE[spec.body] ?? BODY_SCALE.average!;
    this.root.scale.set(sc[0], sc[1], sc[2]);
    this.limbs = { lArm, rArm, lLeg, rLeg, torso, head };
  }

  private mat(color: string, roughness: number): THREE.MeshStandardNodeMaterial {
    const m = new THREE.MeshStandardNodeMaterial({ color, roughness, metalness: 0 });
    this.materials.push(m);
    return m;
  }

  private buildHair(style: string, m: THREE.Material): THREE.Object3D | null {
    if (style === 'none') return null;
    const g = new THREE.Group();
    g.name = `part:hair:${style}`;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m);
    cap.position.y = 0.02;
    if (style === 'buzz') cap.scale.setScalar(0.98);
    g.add(cap);
    if (style === 'long') {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10), m);
      back.position.set(0, -0.2, -0.1);
      g.add(back);
    }
    if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m);
      bun.position.set(0, 0.16, -0.14);
      g.add(bun);
    }
    if (style === 'braids') {
      for (const sx of [-1, 1]) {
        const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.34, 4, 8), m);
        braid.position.set(sx * 0.16, -0.22, -0.02);
        g.add(braid);
      }
    }
    return g;
  }

  private buildAccessory(id: string): THREE.Object3D | null {
    switch (id) {
      case 'toque': {
        const g = new THREE.Group();
        g.name = 'part:accessory:toque';
        const m = this.mat('#c8102e', 0.9);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
        cap.position.y = 0.03;
        const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.mat('#f4f4f4', 0.95));
        pom.position.y = 0.26;
        g.add(cap, pom);
        return g;
      }
      case 'scarf': {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), this.mat('#e3b505', 0.9));
        t.rotation.x = Math.PI / 2;
        t.position.y = 0.36;
        t.name = 'part:accessory:scarf';
        return t;
      }
      case 'backpack': {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), this.mat('#2f6b4f', 0.9));
        b.position.set(0, 0.05, -0.3);
        b.name = 'part:accessory:backpack';
        return b;
      }
      case 'glasses': {
        const g = new THREE.Group();
        g.name = 'part:accessory:glasses';
        const m = this.mat('#222222', 0.4);
        for (const sx of [-1, 1]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12), m);
          ring.position.set(sx * 0.07, 0.03, 0.185);
          g.add(ring);
        }
        return g;
      }
      default:
        return null;
    }
  }

  /** speed in m/s drives the walk cycle; dt in seconds. */
  animate(dt: number, speed: number, grounded: boolean): void {
    const walking = speed > 0.2;
    this.phase += dt * (walking ? Math.min(14, 6 + speed * 1.4) : 2.2);
    const swing = walking ? Math.min(0.9, speed * 0.18) : 0;
    const s = Math.sin(this.phase);
    this.limbs.lArm.rotation.x = s * swing;
    this.limbs.rArm.rotation.x = -s * swing;
    this.limbs.lLeg.rotation.x = -s * swing;
    this.limbs.rLeg.rotation.x = s * swing;
    if (!grounded) {
      this.limbs.lLeg.rotation.x = -0.4;
      this.limbs.rLeg.rotation.x = 0.3;
    }
    this.limbs.torso.position.y = 1.15 + (walking ? Math.abs(Math.sin(this.phase * 2)) * 0.03 : Math.sin(this.phase) * 0.01);
    this.limbs.head.position.y = 1.72 + (this.limbs.torso.position.y - 1.15);
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.root.removeFromParent();
  }
}
