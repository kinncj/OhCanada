import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import { newProgress, type Progress } from '@domain/progress';
import { computeUnlockedDistricts } from '@domain/district';
import type { GameEvents } from '../events';
import type { Clock, ContentRepository, PersistenceError, ProgressRepository } from '../ports';
import type { SessionStore } from '../session-store';

/** Load an existing save or create a fresh Progress. */
export class InitializeSession {
  constructor(
    private readonly store: SessionStore,
    private readonly repo: ProgressRepository,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  async execute(): Promise<Result<Progress, PersistenceError>> {
    const cfg = this.content.getConfig();
    const loaded = await this.repo.load();
    if (!loaded.ok) {
      this.events.emit('progress:error', { message: loaded.error.message });
      return err(loaded.error);
    }
    let progress: Progress;
    if (loaded.value) {
      progress = loaded.value;
      this.events.emit('progress:loaded', { at: this.clock.nowIso() });
    } else {
      const unlocked = computeUnlockedDistricts(cfg.unlockRules, { stampsByDistrict: {}, explicitlyUnlocked: [] });
      progress = newProgress(this.clock.nowIso(), cfg.startDistrict, unlocked);
    }
    this.store.set(progress);
    this.events.emit('session:ready', { progress });
    return ok(progress);
  }
}
