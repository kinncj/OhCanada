import { ok, err, type Result } from '@common/result';
import type { ContentError, ContentRepository, GameConfig } from '@application/ports';
import type { Question } from '@domain/question';
import type { Quest } from '@domain/quest';
import type { District } from '@domain/district';
import type { CharacterCatalog } from '@domain/character';
import { districtId, npcId, questId, questionId, stampId, triggerId, type Subject } from '@domain/ids';

export const CONFIG: GameConfig = {
  title: 'TrueNorth',
  version: '0.0.0-test',
  basePath: '/',
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  startDistrict: districtId('hub'),
  districts: [districtId('hub'), districtId('rights-responsibilities'), districtId('who-we-are')],
  unlockRules: {
    initialDistricts: [districtId('hub')],
    order: [districtId('hub'), districtId('rights-responsibilities'), districtId('who-we-are')],
    stampsToUnlockNext: 1,
    stampsForExam: 2,
  },
  exam: { questionCount: 4, passMark: 3, timeLimitSeconds: 600 },
  graphicsPresets: {
    minimal: preset(), low: preset(), medium: preset(), high: preset(), ultra: preset(),
  },
  featureFlags: {},
  volatileMaxAgeDays: 180,
  benchmark: { durationMs: 1000, thresholdsFps: { low: 20, medium: 30, high: 50, ultra: 100 }, mobileDefault: 'minimal' },
  budgets: { initialPayloadBytes: 1, hubSceneBytes: 1, districtSceneBytes: 1, timeToInteractiveMs: 1 },
};

function preset() {
  return { renderScale: 1, maxPixelRatio: 1, shadows: false, postProcessing: false, shadowMapSize: 1024, shadowCascades: 1, ssao: false, bloom: false, antialias: 'none' as const, maxInstances: 10, drawDistance: 200, anisotropy: 1, volumetricFog: false };
}

export function q(id: string, subject: Subject, volatile = false, asOf = '2026-09-01'): Question {
  return {
    id: questionId(id), subject, text: { en: `Q ${id}`, fr: `Q ${id} fr` }, answer: { en: 'right', fr: 'vrai' },
    distractors: [{ en: 'w1', fr: 'f1' }, { en: 'w2', fr: 'f2' }, { en: 'w3', fr: 'f3' }],
    source: 'Discover Canada: Test', asOf, volatile,
  };
}

export const QUESTIONS: Question[] = [
  q('q-rr-001', 'rights-responsibilities'), q('q-rr-002', 'rights-responsibilities'), q('q-rr-003', 'rights-responsibilities'),
  q('q-ww-001', 'who-we-are'), q('q-hi-001', 'history'), q('q-gv-001', 'government', true, '2026-08-01'),
];

export const QUEST_WELCOME: Quest = {
  id: questId('hub-welcome'), district: districtId('hub'), type: 'dialogue',
  title: { en: 'Welcome', fr: 'Bienvenue' }, summary: { en: 's', fr: 's' }, giverNpc: npcId('guide'),
  steps: [
    { id: 'talk', kind: 'talk', npc: npcId('guide'), objective: { en: 'talk', fr: 'parler' }, dialogue: [{ speaker: 'guide', text: { en: 'hi', fr: 'salut' } }] },
    { id: 'reach', kind: 'reach', trigger: triggerId('flagpole'), objective: { en: 'go', fr: 'aller' } },
    { id: 'quiz', kind: 'answer', questions: [questionId('q-rr-001'), questionId('q-rr-002'), questionId('q-rr-003')], minCorrect: 2, objective: { en: 'quiz', fr: 'quiz' } },
  ],
  reward: { stamp: stampId('stamp-hub-welcome') },
};

export const QUEST_COLLECT: Quest = {
  id: questId('rr-collect'), district: districtId('rights-responsibilities'), type: 'fetch',
  title: { en: 'Collect', fr: 'Collecter' }, summary: { en: 's', fr: 's' }, giverNpc: npcId('judge'),
  steps: [
    { id: 'collect', kind: 'collect', items: [triggerId('a'), triggerId('b')], objective: { en: 'c', fr: 'c' }, timeLimitSeconds: 60 },
  ],
  reward: { stamp: stampId('stamp-rr-collect'), unlocks: [districtId('who-we-are')] },
};

export const HUB: District = {
  id: districtId('hub'), subject: 'hub', chapter: 'Intro', name: { en: 'Hub', fr: 'Hub' }, description: { en: 'd', fr: 'd' },
  spawn: { position: [0, 0, 0], yaw: 0 },
  scene: { generator: 'hub', seed: 1, size: 100, terrain: { amplitude: 1, frequency: 0.1, palette: ['#000000', '#ffffff'] }, vegetation: { density: 0, kinds: [] }, landmarks: [], ambience: { hdri: 'x', timeOfDay: 0.5, weather: 'clear', soundscape: { loop: 'wind', oneshots: [], volume: 0.5 } } },
  pois: [],
  npcs: [{ id: npcId('guide'), name: { en: 'G', fr: 'G' }, position: [1, 0, 1], behavior: 'idle', questRefs: [questId('hub-welcome')], idleDialogue: { en: 'hi', fr: 'salut' }, appearance: { skinTone: 't', outfit: 'o', hair: 'h', hairColor: 'c' } }],
  triggers: [{ id: triggerId('flagpole'), position: [5, 0, 5], radius: 2, label: { en: 'f', fr: 'f' }, kind: 'zone' }],
  quests: [questId('hub-welcome')],
};

export const CATALOG: CharacterCatalog = {
  bodies: [{ id: 'average', label: { en: 'A', fr: 'A' } }],
  faces: [{ id: 'round', label: { en: 'R', fr: 'R' } }],
  skinTones: [{ id: 'tone-1', label: { en: 'T', fr: 'T' }, value: '#ffffff' }],
  hair: [{ id: 'short', label: { en: 'S', fr: 'S' } }, { id: 'none', label: { en: 'N', fr: 'N' } }],
  hairColors: [{ id: 'black', label: { en: 'B', fr: 'B' }, value: '#000000' }],
  outfits: [{ id: 'parka', label: { en: 'P', fr: 'P' } }],
  accessories: [{ id: 'none', label: { en: 'N', fr: 'N' } }, { id: 'toque', label: { en: 'T', fr: 'T' } }],
};

export class FakeContent implements ContentRepository {
  quests = new Map<string, Quest>([[QUEST_WELCOME.id, QUEST_WELCOME], [QUEST_COLLECT.id, QUEST_COLLECT]]);
  questions = [...QUESTIONS];
  failQuests = false;

  getConfig(): GameConfig { return CONFIG; }
  async listDistricts(): Promise<Result<readonly District[], ContentError>> { return ok([HUB]); }
  async getDistrict(id: string): Promise<Result<District, ContentError>> { return id === 'hub' ? ok(HUB) : err({ code: 'not-found', message: id }); }
  async getQuest(id: string): Promise<Result<Quest, ContentError>> {
    if (this.failQuests) return err({ code: 'io', message: 'boom' });
    const qq = this.quests.get(id);
    return qq ? ok(qq) : err({ code: 'not-found', message: id });
  }
  async getQuestions(ids: readonly string[]): Promise<Result<readonly Question[], ContentError>> { return ok(this.questions.filter((x) => ids.includes(x.id))); }
  async getQuestionsBySubject(subject: Subject): Promise<Result<readonly Question[], ContentError>> { return ok(this.questions.filter((x) => x.subject === subject)); }
  async getAllQuestions(): Promise<Result<readonly Question[], ContentError>> { return ok(this.questions); }
  async getCharacterCatalog(): Promise<Result<CharacterCatalog, ContentError>> { return ok(CATALOG); }
}
