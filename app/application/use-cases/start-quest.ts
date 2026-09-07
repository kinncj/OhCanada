import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import type { QuestId } from '@domain/ids';
import { startQuest, type Quest, type QuestState } from '@domain/quest';
import { upsertActiveQuest } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock, ContentError, ContentRepository } from '../ports';
import type { SessionStore } from '../session-store';

export type StartQuestError = ContentError | { readonly code: 'already-completed' | 'already-active'; readonly message: string };

export class StartQuest {
  constructor(
    private readonly store: SessionStore,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  async execute(questId: QuestId): Promise<Result<{ quest: Quest; state: QuestState }, StartQuestError>> {
    const progress = this.store.progress;
    if (progress.completedQuests.includes(questId)) return err({ code: 'already-completed', message: `Quest ${questId} already completed` });
    if (progress.activeQuests.some((q) => q.questId === questId && q.status === 'active')) {
      return err({ code: 'already-active', message: `Quest ${questId} already active` });
    }
    const questRes = await this.content.getQuest(questId);
    if (!questRes.ok) return err(questRes.error);
    const quest = questRes.value;
    const state = startQuest(quest, this.clock.now());
    this.store.update((p) => upsertActiveQuest(p, state, this.clock.nowIso()));
    this.events.emit('quest:started', { quest: quest.id, state });
    return ok({ quest, state });
  }
}
