import { describe, expect, it } from 'vitest';
import { StaticContentRepository } from '@adapters/content/static-content-repository';
import { districtId, questId, questionId, SUBJECTS } from '@domain/ids';

/** Loads the real content tree through the same code path as the game (import.meta.glob + Ajv). */
describe('StaticContentRepository (real content)', () => {
  const repo = new StaticContentRepository();
  it('validates game.config and exposes districts', async () => {
    const cfg = repo.getConfig();
    expect(cfg.districts).toContain('hub');
    expect(cfg.exam).toEqual({ questionCount: 20, passMark: 15, timeLimitSeconds: 1800 });
    const list = await repo.listDistricts();
    expect(list.ok && list.value.length).toBe(cfg.districts.length);
    const hub = await repo.getDistrict(districtId('hub'));
    expect(hub.ok && hub.value.npcs.some((n) => n.id === 'guide-amelie')).toBe(true);
    expect((await repo.getDistrict(districtId('atlantis'))).ok).toBe(false);
  });
  it('loads quests and resolves their questions', async () => {
    const q = await repo.getQuest(questId('hub-welcome'));
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    const step = q.value.steps[2];
    expect(step?.kind).toBe('answer');
    if (step?.kind !== 'answer') return;
    const qs = await repo.getQuestions(step.questions);
    expect(qs.ok && qs.value.length).toBe(3);
    expect((await repo.getQuestions([questionId('q-zz-001')])).ok).toBe(false);
    expect((await repo.getQuestions([questionId('q-rr-999')])).ok).toBe(false);
  });
  it('has ≥ 30 validated questions per subject and 300 total', async () => {
    for (const s of SUBJECTS) {
      const r = await repo.getQuestionsBySubject(s);
      expect(r.ok && r.value.length, s).toBeGreaterThanOrEqual(30);
    }
    const all = await repo.getAllQuestions();
    expect(all.ok && all.value.length).toBeGreaterThanOrEqual(300);
    const cat = await repo.getCharacterCatalog();
    expect(cat.ok && cat.value.outfits.length).toBeGreaterThan(0);
  });
});
