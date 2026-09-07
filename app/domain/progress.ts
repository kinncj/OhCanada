import type { Character } from './character';
import type { DistrictId, QuestId, QuestionId, StampId } from './ids';
import type { QuestState } from './quest';

export const SAVE_VERSION = 1;

export interface AnsweredRecord {
  readonly questionId: QuestionId;
  readonly correct: boolean;
  readonly at: string; // ISO
}

export interface ExamResult {
  readonly at: string;
  readonly correct: number;
  readonly total: number;
  readonly passed: boolean;
  readonly durationSeconds: number;
}

export interface Settings {
  readonly locale: 'en' | 'fr';
  readonly graphicsPreset: 'auto' | 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
  readonly reducedMotion: boolean;
  readonly subtitles: boolean;
  readonly colourBlindSafe: boolean;
  readonly masterVolume: number; // 0..1
  readonly keyBindings: Readonly<Record<string, string>>;
}

export interface Progress {
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly character: Character | null;
  readonly currentDistrict: DistrictId;
  readonly stamps: readonly { readonly id: StampId; readonly district: DistrictId; readonly earnedAt: string }[];
  readonly completedQuests: readonly QuestId[];
  readonly activeQuests: readonly QuestState[];
  readonly answered: readonly AnsweredRecord[];
  readonly unlockedDistricts: readonly DistrictId[];
  readonly examResults: readonly ExamResult[];
  readonly settings: Settings;
  /** Question selection history (exclusion window + wrong-answer weighting). */
  readonly seenQuestionIds: readonly QuestionId[];
  readonly wrongQuestionIds: readonly QuestionId[];
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  graphicsPreset: 'auto',
  reducedMotion: false,
  subtitles: true,
  colourBlindSafe: false,
  masterVolume: 0.8,
  keyBindings: {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    sprint: 'ShiftLeft',
    jump: 'Space',
    interact: 'KeyE',
    journal: 'KeyJ',
    pause: 'Escape',
  },
};

export function newProgress(nowIso: string, startDistrict: DistrictId, unlocked: readonly DistrictId[]): Progress {
  return {
    version: SAVE_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    character: null,
    currentDistrict: startDistrict,
    stamps: [],
    completedQuests: [],
    activeQuests: [],
    answered: [],
    unlockedDistricts: [...unlocked],
    examResults: [],
    settings: DEFAULT_SETTINGS,
    seenQuestionIds: [],
    wrongQuestionIds: [],
  };
}

export function withCharacter(p: Progress, character: Character, nowIso: string): Progress {
  return { ...p, character, updatedAt: nowIso };
}

export function withSettings(p: Progress, settings: Partial<Settings>, nowIso: string): Progress {
  return { ...p, settings: { ...p.settings, ...settings }, updatedAt: nowIso };
}

export function withDistrict(p: Progress, district: DistrictId, nowIso: string): Progress {
  return { ...p, currentDistrict: district, updatedAt: nowIso };
}

export function upsertActiveQuest(p: Progress, state: QuestState, nowIso: string): Progress {
  const others = p.activeQuests.filter((q) => q.questId !== state.questId);
  return { ...p, activeQuests: [...others, state], updatedAt: nowIso };
}

export function completeQuest(p: Progress, questId: QuestId, stamp: StampId, district: DistrictId, nowIso: string): Progress {
  if (p.completedQuests.includes(questId)) return p;
  const stamps = p.stamps.some((s) => s.id === stamp) ? p.stamps : [...p.stamps, { id: stamp, district, earnedAt: nowIso }];
  return {
    ...p,
    stamps,
    completedQuests: [...p.completedQuests, questId],
    activeQuests: p.activeQuests.filter((q) => q.questId !== questId),
    updatedAt: nowIso,
  };
}

export function recordAnswer(p: Progress, record: AnsweredRecord): Progress {
  const wrong = new Set(p.wrongQuestionIds ?? []);
  if (record.correct) wrong.delete(record.questionId);
  else wrong.add(record.questionId);
  const seen = [...(p.seenQuestionIds ?? []), record.questionId].slice(-200);
  return { ...p, answered: [...p.answered, record], seenQuestionIds: seen, wrongQuestionIds: [...wrong], updatedAt: record.at };
}

export function withUnlocked(p: Progress, unlocked: readonly DistrictId[], nowIso: string): Progress {
  const merged = [...new Set([...p.unlockedDistricts, ...unlocked])];
  if (merged.length === p.unlockedDistricts.length) return p;
  return { ...p, unlockedDistricts: merged, updatedAt: nowIso };
}

export function recordExam(p: Progress, result: ExamResult): Progress {
  return { ...p, examResults: [...p.examResults, result], updatedAt: result.at };
}

export function stampsByDistrict(p: Progress): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of p.stamps) out[s.district] = (out[s.district] ?? 0) + 1;
  return out;
}

export function accuracy(p: Progress): number {
  if (p.answered.length === 0) return 0;
  return p.answered.filter((a) => a.correct).length / p.answered.length;
}
