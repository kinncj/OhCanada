import type { Character } from '@domain/character';
import type { DistrictId, NpcId, QuestId, QuestionId, StampId, TriggerId } from '@domain/ids';
import type { QuestState, DialogueLine } from '@domain/quest';
import type { ExamGrade } from '@domain/exam';
import type { Progress } from '@domain/progress';
import type { Vec3 } from '@domain/district';

/** Every cross-system message in the game. Adapters/UI subscribe; use cases emit. */
export interface GameEvents {
  'session:ready': { progress: Progress };
  'character:created': { character: Character };
  'district:load-requested': { district: DistrictId };
  'district:loaded': { district: DistrictId };
  'district:unlocked': { districts: readonly DistrictId[] };
  'district:locked-attempt': { district: DistrictId };
  'quest:started': { quest: QuestId; state: QuestState };
  'quest:updated': { quest: QuestId; state: QuestState };
  'quest:completed': { quest: QuestId; stamp: StampId; district: DistrictId };
  'quest:failed': { quest: QuestId };
  'dialogue:open': { npc: NpcId; lines: readonly DialogueLine[]; quest?: QuestId };
  'dialogue:closed': { npc: NpcId };
  'question:asked': { quest: QuestId; question: QuestionId };
  'question:answered': { question: QuestionId; correct: boolean; correctKey: string; chosenKey: string };
  'stamp:earned': { stamp: StampId; total: number };
  'progress:saved': { at: string };
  'progress:loaded': { at: string };
  'progress:imported': { at: string };
  'progress:error': { message: string };
  'exam:started': { total: number; timeLimitSeconds: number };
  'exam:finished': { grade: ExamGrade };
  'player:interact': { target: NpcId | TriggerId; kind: 'npc' | 'trigger' };
  'player:entered-trigger': { trigger: TriggerId; kind: 'zone' | 'pickup' | 'portal' };
  'player:exited-trigger': { trigger: TriggerId };
  'player:moved': { position: Vec3 };
  'settings:changed': { key: string; value: unknown };
  'ui:notify': { key: string; params?: Record<string, string | number> };
  'debug:frame': { fps: number; frameMs: number; drawCalls: number; triangles: number; memoryMb: number; chunks: number };
}
