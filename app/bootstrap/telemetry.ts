import type { EventBus } from '@common/event-bus';
import type { GameEvents } from '@application/events';

export const TELEMETRY_PREFIX = '[truenorth]';

/** Structured console events for Playwright assertions and debugging. */
export function attachTelemetry(bus: EventBus<GameEvents>): () => void {
  return bus.onAny((type, payload) => {
    if (type === 'debug:frame' || type === 'player:moved') return;
    let body: string;
    try {
      body = JSON.stringify(payload, (_k, v: unknown) => (typeof v === 'object' && v !== null && 'stamps' in (v as object) && 'settings' in (v as object) ? '[Progress]' : v));
    } catch {
      body = '{}';
    }
    if (body.length > 1500) body = `${body.slice(0, 1500)}…`;
    console.info(`${TELEMETRY_PREFIX} ${JSON.stringify({ type, payload: JSON.parse(body.endsWith('…') ? '"[truncated]"' : body) })}`);
  });
}
