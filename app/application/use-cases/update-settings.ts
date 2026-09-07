import type { EventPublisher } from '@common/event-bus';
import { withSettings, type Settings } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock } from '../ports';
import type { SessionStore } from '../session-store';

export class UpdateSettings {
  constructor(
    private readonly store: SessionStore,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  execute(patch: Partial<Settings>): Settings {
    const next = this.store.update((p) => withSettings(p, patch, this.clock.nowIso()));
    for (const [key, value] of Object.entries(patch)) this.events.emit('settings:changed', { key, value });
    return next.settings;
  }
}
