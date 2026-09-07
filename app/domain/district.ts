import type { DistrictId, LocalizedText, NpcId, QuestId, Subject, TriggerId } from './ids';

export type Vec3 = readonly [number, number, number];

export interface Npc {
  readonly id: NpcId;
  readonly name: LocalizedText;
  readonly position: Vec3;
  readonly behavior: 'idle' | 'wander' | 'patrol';
  readonly wanderRadius?: number;
  readonly questRefs: readonly QuestId[];
  readonly idleDialogue: LocalizedText;
  readonly appearance: NpcAppearance;
}

export interface NpcAppearance {
  readonly skinTone: string;
  readonly outfit: string;
  readonly hair: string;
  readonly hairColor: string;
  readonly accessory?: string;
}

export interface Trigger {
  readonly id: TriggerId;
  readonly position: Vec3;
  readonly radius: number;
  readonly label: LocalizedText;
  readonly kind: 'zone' | 'pickup' | 'portal';
  readonly toDistrict?: DistrictId;
}

export interface Landmark {
  readonly id: string;
  readonly type: string;
  readonly position: Vec3;
  readonly rotationY?: number;
  readonly scale?: number;
  readonly label?: LocalizedText;
}

export interface Ambience {
  readonly hdri: string;
  readonly timeOfDay: number; // 0..1
  readonly weather: 'clear' | 'snow' | 'rain' | 'fog';
  readonly audio?: string;
  readonly fogDensity?: number;
}

export interface SceneManifest {
  readonly generator: string;
  readonly seed: number;
  readonly size: number;
  readonly terrain: { readonly amplitude: number; readonly frequency: number; readonly snow?: boolean; readonly palette: readonly string[] };
  readonly water?: readonly { readonly position: Vec3; readonly size: readonly [number, number] }[];
  readonly vegetation: { readonly density: number; readonly kinds: readonly string[] };
  readonly landmarks: readonly Landmark[];
  readonly ambience: Ambience;
}

export interface District {
  readonly id: DistrictId;
  readonly subject: Subject | 'hub';
  readonly chapter: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly spawn: { readonly position: Vec3; readonly yaw: number };
  readonly scene: SceneManifest;
  readonly npcs: readonly Npc[];
  readonly triggers: readonly Trigger[];
  readonly quests: readonly QuestId[];
}

export interface UnlockRules {
  readonly initialDistricts: readonly DistrictId[];
  /** Order in which districts unlock. Completing a district's required stamps unlocks the next. */
  readonly order: readonly DistrictId[];
  /** Stamps needed from a district before the next one unlocks. */
  readonly stampsToUnlockNext: number;
  /** Total stamps required before the Citizenship Ceremony exam unlocks. */
  readonly stampsForExam: number;
}

export interface UnlockInput {
  readonly stampsByDistrict: Readonly<Record<string, number>>;
  readonly explicitlyUnlocked: readonly DistrictId[];
}

/** Compute unlocked districts from progress. Pure and order-independent. */
export function computeUnlockedDistricts(rules: UnlockRules, input: UnlockInput): DistrictId[] {
  const unlocked = new Set<DistrictId>([...rules.initialDistricts, ...input.explicitlyUnlocked]);
  for (let i = 0; i < rules.order.length - 1; i++) {
    const current = rules.order[i] as DistrictId;
    const next = rules.order[i + 1] as DistrictId;
    if (unlocked.has(current) && (input.stampsByDistrict[current] ?? 0) >= rules.stampsToUnlockNext) unlocked.add(next);
  }
  return [...unlocked];
}

export function isExamUnlocked(rules: UnlockRules, totalStamps: number): boolean {
  return totalStamps >= rules.stampsForExam;
}
