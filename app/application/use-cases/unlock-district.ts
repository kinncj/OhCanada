import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import type { DistrictId } from '@domain/ids';
import { withDistrict } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock, ContentRepository } from '../ports';
import type { SessionStore } from '../session-store';

export type TravelError = { readonly code: 'locked' | 'unknown'; readonly message: string };

/** Travel to a district if unlocked. Emits the load request that the scene streamer listens for. */
export class UnlockDistrict {
  constructor(
    private readonly store: SessionStore,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  isUnlocked(district: DistrictId): boolean {
    return this.store.progress.unlockedDistricts.includes(district);
  }

  travel(district: DistrictId): Result<DistrictId, TravelError> {
    const cfg = this.content.getConfig();
    if (!cfg.districts.includes(district)) return err({ code: 'unknown', message: `Unknown district ${district}` });
    if (!this.isUnlocked(district)) {
      this.events.emit('district:locked-attempt', { district });
      return err({ code: 'locked', message: `District ${district} is locked` });
    }
    this.store.update((p) => withDistrict(p, district, this.clock.nowIso()));
    this.events.emit('district:load-requested', { district });
    return ok(district);
  }
}
