import { ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import type { DistrictId } from '@domain/ids';
import { applyQuestEvent, type Quest, type QuestEvent, type QuestState } from '@domain/quest';
import { completeQuest, upsertActiveQuest, stampsByDistrict, withUnlocked } from '@domain/progress';
import { computeUnlockedDistricts } from '@domain/district';
import type { GameEvents } from '../events';
import type { Clock, ContentError, ContentRepository } from '../ports';
import type { SessionStore } from '../session-store';

/**
 * Feed a world event (talked/reached/collected/answered) to every active quest.
 * Completes quests, awards stamps, and re-evaluates district unlocks.
 */
export class AdvanceQuest {
  constructor(
    private readonly store: SessionStore,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  async execute(event: QuestEvent): Promise<Result<readonly QuestState[], ContentError>> {
    const active = this.store.progress.activeQuests.filter((q) => q.status === 'active');
    const changed: QuestState[] = [];
    for (const state of active) {
      const questRes = await this.content.getQuest(state.questId);
      if (!questRes.ok) return questRes;
      const next = applyQuestEvent(questRes.value, state, event);
      if (next === state) continue;
      changed.push(next);
      this.apply(questRes.value, next);
    }
    return ok(changed);
  }

  private apply(quest: Quest, next: QuestState): void {
    const nowIso = this.clock.nowIso();
    if (next.status === 'completed') {
      const before = this.store.progress.stamps.length;
      const progress = this.store.update((p) => completeQuest(p, quest.id, quest.reward.stamp, quest.district, nowIso));
      this.events.emit('quest:completed', { quest: quest.id, stamp: quest.reward.stamp, district: quest.district });
      if (progress.stamps.length > before) this.events.emit('stamp:earned', { stamp: quest.reward.stamp, total: progress.stamps.length });
      this.evaluateUnlocks(quest.reward.unlocks ?? []);
      return;
    }
    this.store.update((p) => upsertActiveQuest(p, next, nowIso));
    if (next.status === 'failed') this.events.emit('quest:failed', { quest: quest.id });
    else this.events.emit('quest:updated', { quest: quest.id, state: next });
  }

  private evaluateUnlocks(explicit: readonly DistrictId[]): void {
    const cfg = this.content.getConfig();
    const p = this.store.progress;
    const unlocked = computeUnlockedDistricts(cfg.unlockRules, {
      stampsByDistrict: stampsByDistrict(p),
      explicitlyUnlocked: [...p.unlockedDistricts, ...explicit],
    });
    const fresh = unlocked.filter((d) => !p.unlockedDistricts.includes(d));
    if (fresh.length === 0) return;
    this.store.update((q) => withUnlocked(q, unlocked, this.clock.nowIso()));
    this.events.emit('district:unlocked', { districts: fresh });
  }
}
