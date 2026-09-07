import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import type { Progress } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock, PersistenceError, ProgressRepository, SaveCodec } from '../ports';
import type { SessionStore } from '../session-store';

export class SaveProgress {
  constructor(
    private readonly store: SessionStore,
    private readonly repo: ProgressRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  async execute(): Promise<Result<void, PersistenceError>> {
    const res = await this.repo.save(this.store.progress);
    if (res.ok) this.events.emit('progress:saved', { at: this.clock.nowIso() });
    else this.events.emit('progress:error', { message: res.error.message });
    return res;
  }
}

export class ExportSave {
  constructor(
    private readonly store: SessionStore,
    private readonly codec: SaveCodec,
  ) {}

  execute(): string {
    return this.codec.encode(this.store.progress);
  }
}

export class ImportSave {
  constructor(
    private readonly store: SessionStore,
    private readonly codec: SaveCodec,
    private readonly repo: ProgressRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  /** Validates (schema + version) before touching state. Never evaluates code. */
  async execute(json: string): Promise<Result<Progress, PersistenceError>> {
    const decoded = this.codec.decode(json);
    if (!decoded.ok) {
      this.events.emit('progress:error', { message: decoded.error.message });
      return decoded;
    }
    this.store.set(decoded.value);
    const saved = await this.repo.save(decoded.value);
    if (!saved.ok) return err(saved.error);
    this.events.emit('progress:imported', { at: this.clock.nowIso() });
    return ok(decoded.value);
  }
}

export class ResetProgress {
  constructor(
    private readonly store: SessionStore,
    private readonly repo: ProgressRepository,
  ) {}

  async execute(): Promise<Result<void, PersistenceError>> {
    this.store.reset();
    return this.repo.clear();
  }
}
