import { describe, expect, it } from 'vitest';
import {
  accuracy, completeQuest, newProgress, recordAnswer, recordExam, stampsByDistrict, upsertActiveQuest, withCharacter, withDistrict, withSettings, withUnlocked,
} from '@domain/progress';
import { districtId, questId, questionId, stampId } from '@domain/ids';
import { startQuest } from '@domain/quest';
import { QUEST_WELCOME, CATALOG } from '../../fixtures/content';
import { defaultCharacter } from '@domain/character';

const T = '2026-09-07T12:00:00.000Z';

describe('progress', () => {
  it('creates, sets character/settings/district', () => {
    let p = newProgress(T, districtId('hub'), [districtId('hub')]);
    expect(p.character).toBeNull();
    p = withCharacter(p, defaultCharacter(CATALOG), T);
    expect(p.character?.name).toBe('Explorer');
    p = withSettings(p, { locale: 'fr' }, T);
    expect(p.settings.locale).toBe('fr');
    expect(p.settings.subtitles).toBe(true);
    p = withDistrict(p, districtId('rights-responsibilities'), T);
    expect(p.currentDistrict).toBe('rights-responsibilities');
  });
  it('tracks quests, stamps, unlocks idempotently', () => {
    let p = newProgress(T, districtId('hub'), [districtId('hub')]);
    const s = startQuest(QUEST_WELCOME, 0);
    p = upsertActiveQuest(p, s, T);
    p = upsertActiveQuest(p, { ...s, stepIndex: 1 }, T);
    expect(p.activeQuests).toHaveLength(1);
    expect(p.activeQuests[0]?.stepIndex).toBe(1);
    p = completeQuest(p, questId('hub-welcome'), stampId('stamp-hub-welcome'), districtId('hub'), T);
    p = completeQuest(p, questId('hub-welcome'), stampId('stamp-hub-welcome'), districtId('hub'), T);
    expect(p.stamps).toHaveLength(1);
    expect(p.activeQuests).toHaveLength(0);
    expect(p.completedQuests).toEqual(['hub-welcome']);
    expect(stampsByDistrict(p)).toEqual({ hub: 1 });
    const u = withUnlocked(p, [districtId('hub'), districtId('rights-responsibilities')], T);
    expect(u.unlockedDistricts).toEqual(['hub', 'rights-responsibilities']);
    expect(withUnlocked(u, [districtId('hub')], T)).toBe(u);
    // a second quest with the same stamp id does not duplicate stamps
    const dup = completeQuest(u, questId('other'), stampId('stamp-hub-welcome'), districtId('hub'), T);
    expect(dup.stamps).toHaveLength(1);
  });
  it('answers and exams', () => {
    let p = newProgress(T, districtId('hub'), []);
    expect(accuracy(p)).toBe(0);
    p = recordAnswer(p, { questionId: questionId('q-rr-001'), correct: true, at: T });
    p = recordAnswer(p, { questionId: questionId('q-rr-002'), correct: false, at: T });
    expect(accuracy(p)).toBe(0.5);
    p = recordExam(p, { at: T, correct: 15, total: 20, passed: true, durationSeconds: 900 });
    expect(p.examResults[0]?.passed).toBe(true);
  });
});
